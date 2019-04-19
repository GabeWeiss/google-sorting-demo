import argparse
import contextlib
from PyV4L2Camera.camera import Camera
from PIL import Image
from edgetpu.detection.engine import DetectionEngine
from edgetpu.classification.engine import ClassificationEngine
import json
import numpy as np
import time
from urllib import request

import socket
import struct
import threading


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
        # PyV4L2Camera.camera.Camera.get_frame returns width * height * 3 bytes for the three RGB channels.
        image_bytes = camera.get_frame()
        return image_bytes
    except:
        raise ValueError('Failed to capture image.')


def image_bytes_to_image(image_bytes, width, height):
    image = Image.frombytes('RGB', (width, height), image_bytes, 'raw', 'RGB')
    
    # Crop a certain section of the full image where the gear should be processed.
    side = 224
    top = (height - side) / 2 + 20
    left = (width - side) / 2 + 50
    bottom = top + side
    right = left + side

    image = image.crop((left, top, right, bottom))

    return image


def recognize(od_engine, digit_engine, image):
    # od_engine is a DetectionEngine for object detection.
    # digit_ending is a ClassificationEngine for recognizing the written digit.
    # For more information on the EdgeTPU Python API:
    # https://coral.withgoogle.com/docs/edgetpu/api-intro/

    start_time = time.time()
    digit_label_scores = digit_engine.ClassifyWithImage(image, threshold=0.55, top_k=3)
    digit_inference_time = time.time() - start_time
    
    # Return an empty result if no digit is detected. 
    if len(digit_label_scores) == 0:
        return None, digit_inference_time, None

    start_time = time.time()
    # Return only one missing tooth detection.  The server has additional logic to improve recall.
    candidates = od_engine.DetectWithImage(image, threshold=0.6, top_k=1)
    od_inference_time = time.time() - start_time

    inference_time = od_inference_time + digit_inference_time

    # The object detection model has two labels:
    # 0: missing tooth
    # 1: gear
    missing_id = 0
    missing = [candidate for candidate in candidates if candidate.label_id == missing_id]
    n_missing = len(missing)

    print('{} missing teeth detected'.format(n_missing))

    if n_missing == 0:
        return digit_label_scores[0], inference_time, None
    
    # Construct label_score when there is a missing tooth:
    # If a gear has a written '5' and is missing at least one tooth, then it is labeled as '15'.
    label_score = (10 + digit_label_scores[0][0], digit_label_scores[0][1])

    # Return also the bounding box coordinates (left, top, right, bottom) and the confidence score.
    (x1, y1), (x2, y2) = missing[0].bounding_box
    score = missing[0].score

    bbox_score = (x1, y1, x2, y2, score)

    return label_score, inference_time, bbox_score


def format_results(label_score, inference_time):
    # Keep only the top classification result.
    label, score = label_score
    data_dict = {
        'number': '{:02d}'.format(int(label)),
        # Only the digit classification's confidence score is sent to the server.
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


# The function worker handles capture, recognize, and post.
def worker(od_model_file, digit_model_file, video_device_index, server_url, socket_host, socket_port):
    # We're using two models because trying to get both the digit recognized and 
    # the broken gear recognized in a single classification model from AutoML wasn't
    # doable. The od_engine tracks the broken gear or not, and the digit_engine tracks
    # the digit classification.
    od_engine = DetectionEngine(od_model_file)
    digit_engine = ClassificationEngine(digit_model_file)

    with video_capture(video_device_index) as camera, socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.connect((socket_host, socket_port))
        except:
            print('Cannot connect to socket.')

        while True:
            # The while loop go through the steps of capture, recognize, and post,
            # along with data transformation steps.
            try:
                image_bytes = capture(camera)

                image = image_bytes_to_image(image_bytes, camera.width, camera.height)

                label_score, inference_time, bbox_score = recognize(od_engine, digit_engine, image)

                # First we send image and bounding box data to the streaming video server through the socket.

                # If no missing tooth is detected, we send some zero bytes.
                if bbox_score is None:
                    bbox_score = (0.0,) * 5

                # Pack bbox_score into 5*8 bytes (since each float is a float64) and append to image_bytes.
                bbox_bytes = b''
                for f in bbox_score:
                    bbox_bytes += struct.pack('!d', f)

                data_bytes = image_bytes + bbox_bytes

                # Constant length "packets" to the socket server makes it easier for the streaming server to handle the data.
                assert len(data_bytes) == 640*480*3 + 5*8
                try:
                    s.send(data_bytes)
                except:
                    pass

                # If no digits is detected, do not post to the server that controls mechanical components.
                if label_score is None:
                    continue

                print(label_score, inference_time, bbox_score)
                
                data = format_results(label_score, inference_time)
                unused_response = post(server_url, data)

            except KeyboardInterrupt:
                break
            except Exception as e:
                print(repr(e))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()

    parser.add_argument('--od-model-file', default='models/model_od_bt_edgetpu.tflite.4_7_2019')
    parser.add_argument('--digit-model-file', default='models/model_digit_bt_edgetpu.tflite.4_7_2019')
    parser.add_argument('--server-url', default='http://192.168.42.100:8080')
    parser.add_argument('--socket-host', default='192.168.42.100')
    parser.add_argument('--socket-port', default=54321)
    parser.add_argument('--video-device-index', default=1)

    args, _ = parser.parse_known_args()

    worker(args.od_model_file, args.digit_model_file, args.video_device_index, args.server_url, args.socket_host, args.socket_port)
