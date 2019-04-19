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

app = Flask(__name__)

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
    
    side = 224
    top = (height - side) / 2 + 20
    left = (width - side) / 2 + 50
    bottom = top + side
    right = left + side

    image = image.crop((left, top, right, bottom))

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


@app.route('/')
def index():
    return 'OK', 200


def to_jpeg(image_bytes):
    import io
    bytes_buffer = io.BytesIO()

    image = Image.frombytes('RGB', (640, 480), image_bytes, 'raw', 'RGB')
    image.save(bytes_buffer, format='JPEG')
    frame = bytes_buffer.getvalue()

    return frame


def gen():
    global d
    while True:
        try:
            image_bytes = d.popleft()
            frame = to_jpeg(image_bytes)
            # yield '{}\n'.format(len(frame))
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n\r\n')
        except:
            pass

@app.route('/video')
def video():
    return Response(gen(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()

    parser.add_argument('--model-file', default='edgetpu_model.tflite.3_7_2019')
    parser.add_argument('--server-url', default='http://192.168.42.100:8080')
    parser.add_argument('--socket-port', default=54321)
    parser.add_argument('--video-device-index', default=1)
    parser.add_argument('--debug', action='store_true')

    args, _ = parser.parse_known_args()

    thread = threading.Thread(target=worker, args=(args.model_file, args.video_device_index, args.server_url, d))

    thread.start()

    if not args.debug:
        app.run(host='0.0.0.0', debug=False)

    thread.join()

    

