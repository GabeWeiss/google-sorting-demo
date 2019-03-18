# Copyright 2018 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https:#www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
import time
import cv2 as cv
import argparse
import os

from paho.mqtt import client as mqtt
from google.cloud.edge_v1alpha import ml
from google.cloud.edge_v1alpha import pubsub

BROKER_HOSTNAME = os.getenv('X_GOOGLE_BROKER_HOSTNAME', 'localhost')
BROKER_PORT = int(os.getenv('X_GOOGLE_BROKER_PORT', '1883'))
CAPTURE_FPS = int(os.getenv('CAPTURE_FPS', 30))

CAP_WIDTH = 640
CAP_HEIGHT = 480
INPUT_SIZE = 224

MODEL_NAME = 'detect_v1'


print('in container')

try:
    CV_CAP_PROP_FRAME_WIDTH = cv.CAP_PROP_FRAME_WIDTH
    CV_CAP_PROP_FRAME_HEIGHT = cv.CAP_PROP_FRAME_HEIGHT
except:
    CV_CAP_PROP_FRAME_WIDTH = 3
    CV_CAP_PROP_FRAME_HEIGHT = 4

def crop_and_resize(img, size):
    """crops given img to square and resize to size."""
    h, w = img.shape[:2]
    min_size = min(h, w)
    hrange = (int((h-min_size)/2), int((h+min_size)/2))
    wrange = (int((w-min_size)/2), int((w+min_size)/2))
    return cv.resize(img[hrange[0]:hrange[1], wrange[0]:wrange[1]],
                     (size, size))

def on_message(client, topic, msg):
    print('Received classification response: %s' % (len(msg.payload)))
    response = ml.ClassificationResponse(msg.payload)
    print(msg.payload)

def main(args):
    print('Starting video capture container')
    cap = cv.VideoCapture(args.video)
    cap.set(CV_CAP_PROP_FRAME_WIDTH, CAP_WIDTH)
    cap.set(CV_CAP_PROP_FRAME_HEIGHT, CAP_HEIGHT)
    cap.set(cv.CAP_PROP_FPS, CAPTURE_FPS)
    print('Started video capture')

    client_id, username, password = pubsub.gen_credentials()
    client = mqtt.Client(client_id)
    client.username_pw_set(username, password)
    client.connect(*pubsub.get_broker_params())
    client.subscribe('/mlservice/{model}/output'
                     .format(model=MODEL_NAME))

    print('Client connected')
    client.loop_start()

    # unique identifier for each camera frame
    id = 1

    # dict from ids to frame bytes
    frames_dict = {}

    try:
        while(True):
            ret, frame = cap.read()
            if ret:
                start = time.time()
                converted = cv.cvtColor(frame, cv.COLOR_BGR2RGB) 
                image = crop_and_resize(converted, 224)
                frames_dict[id] = image.tobytes()

                request = ml.ClassificationRequest(MODEL_NAME)
                request.add_example('normalized_input_image_tensor', [image.tobytes()])
                publish_topic = '/mlservice/{}/input'.format(MODEL_NAME);
                client.publish(publish_topic, request.to_bytes()).wait_for_publish()
                id += 1
                duration = time.time() - start
                print('Published. Process time: %.2f ms'
                      % (duration * 1000), flush=True)
    finally:
        client.loop_stop()
        client.disconnect()
        cap.release()
if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--video', help='v4l2 device number:'
                        '(default=0, which means /dev/video0)',
                        type=int, default=0)
    args = parser.parse_args()
    print('using /dev/video{video}'.format(video=args.video))
    main(args)
