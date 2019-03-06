from PyV4L2Camera.camera import Camera

camera = Camera('/dev/video1')
ib = camera.get_frame()

outpath = 'ib.txt'

with open(outpath, 'wb') as f:
    f.write(ib)

camera.close()

