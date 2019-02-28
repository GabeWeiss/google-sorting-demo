from PyV4L2Camera.camera import Camera
from edgetpu.classification.engine import ClassificationEngine
from PIL import Image

camera = Camera('/dev/video1')
width, height = camera.width, camera.height

engine = ClassificationEngine('edgetpu_model.tflite')

image_bytes = camera.get_frame()

with open('image_bytes.txt', 'wb') as f:
    f.write(image_bytes)

# w640 h480 c3 bytes in RGB, or YUY2?
image = Image.frombytes('RGB', (width, height), image_bytes, 'raw', 'RGB')

result = engine.ClassifyWithImage(image)

print(result)

