from PyV4L2Camera.camera import Camera
from edgetpu.classification.engine import ClassificationEngine
from PIL import Image

camera = Camera('/dev/video1')
width, height = camera.width, camera.height

model_fn = 'edgetpu_model.tflite'
model_fn = 'edgetpu_model.tflite.2_27_2019'

engine = ClassificationEngine(model_fn)

image_bytes = camera.get_frame()

with open('image_bytes.txt', 'wb') as f:
    f.write(image_bytes)

# w640 h480 c3 bytes in RGB, or YUY2?
image = Image.frombytes('RGB', (width, height), image_bytes, 'raw')

side = 448

left = (width - side) / 2
top = (height - side) / 2

# still not quite the same as the training images
left = 130
top = 30
right = left + side
bottom = top + side

cropped = image.crop((left, top, right, bottom))

result = engine.ClassifyWithImage(cropped)

print(result)

