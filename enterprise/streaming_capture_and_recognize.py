import argparse
import contextlib
from PyV4L2Camera.camera import Camera
from PIL import Image
from edgetpu.classification.engine import ClassificationEngine
import json
import numpy as np
import time
from urllib import request

from flask import Flask, Response
import threading
from collections import deque

d = deque(maxlen=1)

# Use a context manager to make sure the video device is released.
@contextlib.contextmanager
def video_capture(video_device_index):
    video_device_name = '/dev/video{}'.format(video_device_index)
    camera = Camera(video_device_name)
    try:
        yield camera
    finally:
        camera.close()


def capture(camera):
    try:
        image_bytes = camera.get_frame()
        return image_bytes
    except:
        raise ValueError('Failed to capture image.')


def image_bytes_to_image(image_bytes, width, height):
    image = Image.frombytes('RGB', (width, height), image_bytes, 'raw', 'RGB')

    return image


def recognize(engine, array):
    # ClassifyWithImage returns a list of top_k pairs of (class_label: int, confidence_score: float) whose confidence_scores are greater than threshold.
    start_time = time.time()
    label_scores = engine.ClassifyWithImage(array, threshold=0.5, top_k=3)
    inference_time = time.time() - start_time

    return label_scores, inference_time


def format_results(label_scores, inference_time):
    # keeping only the top result
    label, score = label_scores[0]
    data_dict = {
        'number': int(label),
        'confidence': float(score),
        'inference_time': float(inference_time)
    }
    data = json.dumps(data_dict)

    return data


# Send the recognition results to a server for downstream consumption.
def post(url, data):
    print(data)

    req = request.Request(url, data=str.encode(data))
    req.add_header('Content-Type', 'application/json')
    try:
        response = request.urlopen(req)
        return response
    except Exception as e:
        print('Failed to post to server {}: {}'.format(url, repr(e)))


# worker running in a thread handling capture and recognize
def worker(model_file, video_device_index, server_url, d):
    engine = ClassificationEngine(model_file)

    with video_capture(video_device_index) as camera:
        while True:
            # The while loop go through the steps of capture, recognize, and post, along with data transformation steps.
            try:
                image_bytes = capture(camera)
                
                # put the image to the deque

                
                image = image_bytes_to_image(image_bytes, camera.width, camera.height)

                # put the image to the deque
                d.append(image_bytes)

                label_scores, inference_time = recognize(engine, image)
                if len(label_scores) == 0:
                    continue

                print(label_scores, inference_time)
                
                data = format_results(label_scores, inference_time)
                response = post(server_url, data)
                print(response)

            except KeyboardInterrupt:
                break
            except Exception as e:
                print(repr(e))
                break


if __name__ == '__main__':
    parser = argparse.ArgumentParser()

    parser.add_argument('--model-file', default='edgetpu_model.tflite.2_27_2019')
    parser.add_argument('--server-url', default='http://192.168.42.100:8080')
    parser.add_argument('--video-device-index', default=1)

    args, _ = parser.parse_known_args()

    thread = threading.Thread(target=worker, args=(args.model_file, args.video_device_index, args.server_url, d))

    thread.start()

    thread.join()

    

