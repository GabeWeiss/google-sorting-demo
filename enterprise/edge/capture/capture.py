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
import cv2
import argparse
import os
from paho.mqtt import client as mqtt

BROKER_HOSTNAME = os.getenv('X_GOOGLE_BROKER_HOSTNAME', 'localhost')
BROKER_PORT = int(os.getenv('X_GOOGLE_BROKER_PORT', '1883'))
CAPTURE_FPS = int(os.getenv('CAPTURE_FPS', 30))

CAP_WIDTH = 640
CAP_HEIGHT = 480
INPUT_SIZE = 224

try:
    CV_CAP_PROP_FRAME_WIDTH = cv2.CAP_PROP_FRAME_WIDTH
    CV_CAP_PROP_FRAME_HEIGHT = cv2.CAP_PROP_FRAME_HEIGHT
except:
    CV_CAP_PROP_FRAME_WIDTH = 3
    CV_CAP_PROP_FRAME_HEIGHT = 4


def main(args):
    cap = cv2.VideoCapture(args.video)
    cap.set(CV_CAP_PROP_FRAME_WIDTH, CAP_WIDTH)
    cap.set(CV_CAP_PROP_FRAME_HEIGHT, CAP_HEIGHT)
    cap.set(cv2.CAP_PROP_FPS, CAPTURE_FPS)

    mqttc = mqtt.Client()
    mqttc.connect(BROKER_HOSTNAME, BROKER_PORT)
    mqttc.loop_start()

    try:
        while(True):
            ret, frame = cap.read()
            if ret:
                start = time.time()
                img = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB) 
                mqttc.publish('camera/frame', img.tobytes())
    finally:
        mqttc.loop_stop()
        mqttc.disconnect()
        cap.release()
if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--video', help='v4l2 device number:'
                        '(default=0, which means /dev/video0)',
                        type=int, default=0)
    args = parser.parse_args()
    print('using /dev/video{video}'.format(video=args.video))
    main(args)
