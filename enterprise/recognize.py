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


def recognize(od_engine, digit_engine, image):
    # ClassifyWithImage returns a list of top_k pairs of (class_label: int, confidence_score: float) whose confidence_scores are greater than threshold.

    start_time = time.time()
    digit_label_scores = digit_engine.ClassifyWithImage(image, threshold=0.55, top_k=3)
    digit_inference_time = time.time() - start_time
    
    # Short circuit if no digit is detected
    if len(digit_label_scores) == 0:
        return [], digit_inference_time, [(0.0,)*5]*2

    start_time = time.time()
    candidates = od_engine.DetectWithImage(image, threshold=0.6, top_k=1)
    od_inference_time = time.time() - start_time

    inference_time = od_inference_time + digit_inference_time

    # the label_id for the missing tooth depends on the model
    if 'gd' in od_engine.model_path():
        missing_id = 10
    else:
        missing_id = 0

    missing = [candidate for candidate in candidates if candidate.label_id == missing_id]

    print('{} missing teeth detected'.format(len(missing)))
    n_missing = min(len(missing), 2)
    
    # construct label_scores
    label_scores = [(10*n_missing + digit_label_scores[0][0], digit_label_scores[0][1])]

    # return also bounding boxes and scores (up to 2) with padding so that bbox_scores is always a list of length 2.
    bbox_scores = []
    for c in missing[:n_missing]:
        (x1, y1), (x2, y2) = c.bounding_box
        score = c.score
        bbox_scores.append((x1, y1, x2, y2, score))
    # padding
    bbox_scores.extend([(0.0,)*5]*(2-len(bbox_scores)))
    
    return label_scores, inference_time, bbox_scores


def format_results(label_scores, inference_time):
    # keeping only the top result
    label, score = label_scores[0]
    data_dict = {
            'number': '{:02d}'.format(int(label)),
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
def worker(od_model_file, digit_model_file, video_device_index, server_url, socket_host, socket_port):
    od_engine = DetectionEngine(od_model_file)
    digit_engine = ClassificationEngine(digit_model_file)

    with video_capture(video_device_index) as camera, socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.connect((socket_host, socket_port))
        except:
            print('Cannot connect to socket.')

        while True:
            # The while loop go through the steps of capture, recognize, and post, along with data transformation steps.
            try:
                image_bytes = capture(camera)

                image = image_bytes_to_image(image_bytes, camera.width, camera.height)

                label_scores, inference_time, bbox_scores = recognize(od_engine, digit_engine, image)

                # format bbox_scores into 2*5*8 bytes and add to image_bytes

                bbox_bytes = b''
                for bbox_score in bbox_scores:
                    for f in bbox_score:
                        bbox_bytes += struct.pack('!d', f)

                data_bytes = image_bytes + bbox_bytes

                assert len(data_bytes) == 640*480*3 + 2*5*8
                try:
                    s.send(data_bytes)
                except:
                    pass

                if len(label_scores) == 0:
                    continue

                print(label_scores, inference_time, bbox_scores)
                
                data = format_results(label_scores, inference_time)
                response = post(server_url, data)
                print(response)

            except KeyboardInterrupt:
                break
            except Exception as e:
                print(repr(e))
                import ipdb; ipdb.set_trace()


def to_jpeg(image_bytes):
    import io
    bytes_buffer = io.BytesIO()

    image = Image.frombytes('RGB', (640, 480), image_bytes, 'raw', 'RGB')
    image.save(bytes_buffer, format='JPEG')
    frame = bytes_buffer.getvalue()

    return frame


if __name__ == '__main__':
    parser = argparse.ArgumentParser()

    parser.add_argument('--od-model-file', default='models/model_od_edgetpu.tflite.3_30_2019')
    parser.add_argument('--digit-model-file', default='models/model_digit_ll_edgetpu.tflite.3_30_2019')
    parser.add_argument('--server-url', default='http://192.168.42.100:8080')
    parser.add_argument('--socket-host', default='192.168.42.100')
    parser.add_argument('--socket-port', default=54321)
    parser.add_argument('--video-device-index', default=1)
    parser.add_argument('--debug', action='store_true')
    parser.add_argument('--thread', action='store_true', default=False)

    args, _ = parser.parse_known_args()

    if args.thread:
        thread = threading.Thread(target=worker, args=(args.od_model_file, args.digit_model_file, args.video_device_index, args.server_url, args.socket_host, args.socket_port))

        thread.start()

        thread.join()
    else:
        worker(args.od_model_file, args.digit_model_file, args.video_device_index, args.server_url, args.socket_host, args.socket_port)
