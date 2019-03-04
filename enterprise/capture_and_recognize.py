import argparse
import contextlib
from PyV4L2Camera.camera import Camera
from PIL import Image
from edgetpu.classification.engine import ClassificationEngine
import json
import numpy as np
import urllib


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
    label_scores = engine.ClassifyWithImage(array, threshold=0.3, top_k=2)

    return label_scores


def format_results(label_scores):
    lss = [(int(l), float(s)) for l, s in label_scores]
    data = json.dumps(lss)

    return data


# Send the recognition results to a server for downstream consumption.
def post(url, data):
    print(data)

    request = urllib.request.Request(url)
    request.add_header('Content-Type', 'application/json')
    try:
        response = urllib.request.urlopen(request, data)
        return response
    except Exception as e:
        print('Failed to post to server {}: {}'.format(url, repr(e)))


def main(args):
    engine = ClassificationEngine(args.model_file)

    with video_capture(args.video_device_index) as camera:
        while True:
            # The while loop go through the steps of capture, recognize, and post, along with data transformation steps.
            try:
                image_bytes = capture(camera)
                image = image_bytes_to_image(image_bytes, camera.width, camera.height)
                label_scores = recognize(engine, image)
                print(label_scores)
                
                data = format_results(label_scores)
                # response = post(args.server_url, data)

            except KeyboardInterrupt:
                break
            except Exception as e:
                print(repr(e))
                break


if __name__ == '__main__':
    parser = argparse.ArgumentParser()

    parser.add_argument('--model-file', default='edgetpu_model.tflite.2_27_2019')
    parser.add_argument('--server-url', default='192.168.42.100:8080')
    parser.add_argument('--video-device-index', default=1)

    args, _ = parser.parse_known_args()

    main(args)

