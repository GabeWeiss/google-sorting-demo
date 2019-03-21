import socket
from flask import Flask, Response
from PIL import Image, ImageDraw
import threading
from collections import deque
import struct

HOST = '0.0.0.0'
PORT = 54321

image_bytes_length = 640*480*3
bbox_bytes_length = 5*8

# the socket client sends two bounding boxes and scores
data_bytes_length = image_bytes_length + 2*bbox_bytes_length

app = Flask(__name__)
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
    # process bounding box and score
    b1, b2 = bbox_bytes[bbox_bytes_length:], bbox_bytes[:bbox_bytes_length]

    # unpack to list of floats
    f1 = []
    for i in range(5):
        float_bytes = b1[8*i:8*(i+1)]
        float_value, = struct.unpack('!d', float_bytes)
        f1.append(float_value)
        
    f2 = []
    for i in range(5):
        float_bytes = b2[8*i:8*(i+1)]
        float_value, = struct.unpack('!d', float_bytes)
        f2.append(float_value)

    import io
    bytes_buffer = io.BytesIO()

    image = Image.frombytes('RGB', (640, 480), image_bytes, 'raw', 'RGB')

    # draw bounding boxes
    for f in [f1, f2]:
        x1, y1, x2, y2, score = f
        if score < 0.5:
            continue

        # the coordinates were normalized.  transform to the pixel scale before drawing
        x1 *= 224
        x2 *= 224
        y1 *= 224
        y2 *= 224

        # place the cropped (224, 224) image back in the (640, 480) image
        x1 += 258
        x2 += 258
        y1 += 148
        y2 += 148

        draw = ImageDraw.Draw(image)
        draw.line(xy=[(x1, y1), (x2, y1), (x2, y2), (x1, y2), (x1, y1)], fill=128, width=5)

    image.save(bytes_buffer, format='JPEG')
    frame = bytes_buffer.getvalue()

    return frame


def gen():
    global d
    while True:
        try:
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
