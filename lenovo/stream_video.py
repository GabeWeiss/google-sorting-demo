import socket
from flask import Flask, Response
from PIL import Image, ImageDraw
import threading
from collections import deque
import struct
import io

HOST = '0.0.0.0'
PORT = 54321

image_bytes_length = 640*480*3
bbox_bytes_length = 5*8

# The socket client sends one bounding box and score.
data_bytes_length = image_bytes_length + bbox_bytes_length

app = Flask(__name__)

# The buffer that holds the most recent data bytes.
d = deque(maxlen=1)

def server_worker(host, port, d):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((host, port))
        s.listen()

        print('Waiting for connection.')
        conn, addr = s.accept()

        with conn:
            print('Client: {}'.format(addr))
            while True:
                try:
                    # image bytes and bounding box score bytes
                    data = conn.recv(data_bytes_length)
                    if data and len(data) == data_bytes_length:
                        d.append(data)

                except Exception as e:
                    print(repr(e))
                    break


@app.route('/')
def index():
    return 'OK', 200


def to_jpeg(image_bytes, bbox_bytes):
    # Unpack the bytes to a list of floats.
    f = []
    for i in range(5):
        # Each float was encoded into 8 bytes.
        float_bytes = bbox_bytes[8*i:8*(i+1)]
        float_value, = struct.unpack('!d', float_bytes)
        f.append(float_value)

    # This buffer holds the JPEG image which will be a single frame of the streaming video.
    bytes_buffer = io.BytesIO()

    image = Image.frombytes('RGB', (640, 480), image_bytes, 'raw', 'RGB')

    # Draw a box showing the part of the image that was sent to the model, with corner coordinates (0, 0) and (224, 224).
    x1, y1, x2, y2 = (0.0, 0.0, 224.0, 224.0)

    # These offsets invert the cropping in recognize.py:image_bytes_to_image.
    x1 += 258
    x2 += 258
    y1 += 148
    y2 += 148

    draw = ImageDraw.Draw(image)
    draw.line(xy=[(x1, y1), (x2, y1), (x2, y2), (x1, y2), (x1, y1)], fill=128, width=5)
    del draw

    # Draw an additional bounding box if a missing tooth was detected.
    x1, y1, x2, y2, score = f
    if score < 0.5:
        continue

    # The coordinates from the DetectionEngine were normalized.  Transform to the pixel scale before drawing.
    x1 *= 224
    x2 *= 224
    y1 *= 224
    y2 *= 224

    # Place the cropped (224, 224) image back in the (640, 480) image at the corret position.
    x1 += 258
    x2 += 258
    y1 += 148
    y2 += 148

    draw = ImageDraw.Draw(image)
    draw.line(xy=[(x1, y1), (x2, y1), (x2, y2), (x1, y2), (x1, y1)], fill=128, width=5)

    # Write image to the buffer and return the JPEG bytes.
    image.save(bytes_buffer, format='JPEG')
    frame = bytes_buffer.getvalue()

    return frame


def gen():
    global d
    while True:
        try:
            # An error is raised if the buffer d has no data.
            data_bytes = d.popleft()
            image_bytes = data_bytes[:image_bytes_length]
            bbox_bytes = data_bytes[image_bytes_length:]
        except Exception as e:
            continue
        frame = to_jpeg(image_bytes, bbox_bytes)
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/video')
def video():
    return Response(gen(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')


if __name__ == '__main__':
    thread = threading.Thread(target=server_worker, args=(HOST, PORT, d))

    thread.start()

    app.run(host='0.0.0.0', debug=False)

    thread.join()
