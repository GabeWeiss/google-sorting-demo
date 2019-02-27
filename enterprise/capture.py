from PyV4L2Camera.camera import Camera

camera = Camera('/dev/video1')

counter = 0
outpath = 'ibs/image_bytes_{}.txt'

while True:
    try:
        ib = camera.get_frame()
        assert len(ib) == 3 * camera.width * camera.height

        with open(outpath.format(counter), 'wb') as f:
            f.write(ib)

        counter += 1

        _ = input('press Enter to capture the next: {}'.format(counter))
    except KeyboardInterrupt:
        break

camera.close()

