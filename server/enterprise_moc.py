import requests
import random

# This number should match the INFERENCE_AVERAGE_COUNT value in server.js unless
# You're testing overflow (or stalling)
inference_count = 8

# Moc for detected number
num = 1
broken = 0

# Moc for model confidence
baseline_confidence = 0.75

# Moc for model inference time
baseline_inference = 0.029

for x in range(inference_count + 1):
    #### Adding noise to our inference base
    rand = random.randint(1,101)
    inference_shift = random.uniform(0.000, 0.0013)
    tmp_inference = baseline_inference
    if rand <= 50:
        tmp_inference = baseline_inference + inference_shift
    else:
        tmp_inference = baseline_inference - inference_shift


    #### Adding noise to our confidence base
    #### Note that if our detect number or broken is mis-detected, then the confidence
    #### will also get shifted down a bit with some extra noise in the below tests
    rand = random.randint(1,101)
    confidence_shift = random.uniform(0.00, 0.10)
    tmp_confidence = baseline_confidence
    if rand <= 50:
        tmp_confidence = baseline_confidence + confidence_shift
    else:
        tmp_confidence = baseline_confidence + confidence_shift

    tmp_num = num
    tmp_broken = broken

    #### 5% chance we get a missed number one way or the other
    rand = random.randint(1,101)
    if rand <= 2:
        tmp_num = num + 1
        tmp_confidence = tmp_confidence - random.uniform(0.00, 0.2)
    elif rand <= 5:
        tmp_num = num - 1
        tmp_confidence = tmp_confidence - random.uniform(0.00, 0.2)

    #### 6% chance we miss detecting what type of broken or not broken gear it is
    rand = random.randint(1,101)
    if broken == 0:
        if rand <= 4:
            tmp_broken = 1
            tmp_confidence = tmp_confidence - random.uniform(0.05, 0.2)
        elif rand <= 5:
            tmp_broken = 2
            tmp_confidence = tmp_confidence - random.uniform(0.05, 0.2)
    elif broken == 1:
        if rand <= 3:
            tmp_broken = 0
            tmp_confidence = tmp_confidence - random.uniform(0.05, 0.2)
        elif rand <= 6:
            tmp_broken = 2
            tmp_confidence = tmp_confidence - random.uniform(0.05, 0.2)
    elif broken == 2:
        if rand <= 2:
            tmp_broken = 0
            tmp_confidence = tmp_confidence - random.uniform(0.05, 0.2)
        elif rand <= 6:
            tmp_broken = 1
            tmp_confidence = tmp_confidence - random.uniform(0.05, 0.2)

    tmp_num = str(tmp_broken) + str(tmp_num)
    
    #### This is the data structure that is built in enterprise/recognize.py. If changes are made to the
    #### schema there, this will need the same changes.
    d = {
        'number':tmp_num,
        'confidence':tmp_confidence,
        'inference_time':tmp_inference
    }

    # This is designed to be run on the same machine as the server.js, but there's no reason
    # it has to be. You can run this on the same network as the Lenovo box for the main demo
    # and change the localhost over to the IP of the Lenovo box and this should drive the
    # main demo sans puck (it will still not actually drive the servos because the light
    # sensor won't ever trip)
    r = requests.post("http://localhost:8080", data = d)
