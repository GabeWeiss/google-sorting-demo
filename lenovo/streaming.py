import socket
from flask import Flask, Response
from PIL import Image
import threading
from collections import deque

HOST = '0.0.0.0'
PORT = 54321

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
                    data = conn.recv(640*480*3)
                    if data and len(data) == 640*480*3:
                        d.append(data)

                except:
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
        except:
            continue
        frame = to_jpeg(image_bytes)
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
