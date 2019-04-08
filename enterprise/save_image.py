# This script is to capture the images as the demo will see them, save them to
# disk for copying to training purposes


from PyV4L2Camera.camera import Camera
from PIL import Image

camera = Camera('/dev/video1')
width  = camera.width
height = camera.height

counter = 0
folder = 2
outpath = 'captured_images/gear_{}/image_{}.jpg'

def image_bytes_to_image(image_bytes):
    image = Image.frombytes('RGB', (width, height), image_bytes, 'raw', 'RGB')
    
    side = 224
    top = (height - side) / 2 + 20
    left = (width - side) / 2 + 50
    bottom = top + side
    right = left + side

    image = image.crop((left, top, right, bottom))

    return image

while True:
    try:
        ib = camera.get_frame()

        assert len(ib) == 3 * width * height

        import io
        bytes_buffer = io.BytesIO()

        image = image_bytes_to_image(ib)
        image.save(bytes_buffer, format='JPEG')
        frame = bytes_buffer.getvalue()

        with open(outpath.format(folder, counter), 'wb') as f:
            f.write(frame)

        counter += 1

        _ = input('press Enter to capture the next: {}'.format(counter))
    except KeyboardInterrupt:
        break

camera.close()

