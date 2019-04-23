import socket
import struct
import random
import time

def random_bbox():
    return [random.random() for _ in range(5)]

with open('image_bytes_0.txt', 'rb') as f:
    image_bytes = f.read()

image_bytes_length = 640*480*3
bbox_bytes_length = 5*8

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    s.connect(('0.0.0.0', 54321))

    while True:
        bbox_score = random_bbox()

        bbox_bytes = b''
        for f in bbox_score:
            bbox_bytes += struct.pack('!d', f)

        data_bytes = image_bytes + bbox_bytes

        assert len(data_bytes) == image_bytes_length + bbox_bytes_length

        s.send(data_bytes)

        time.sleep(0.01)

