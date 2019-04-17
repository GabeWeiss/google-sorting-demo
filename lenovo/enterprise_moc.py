import requests
import random

# Test number
num = 1
broken = 0

# Test confidence
baseline_confidence = 0.75

# Test inference time
baseline_inference = 0.029

for x in range(9):
    rand = random.randint(1,101)
    inference_shift = random.uniform(0.000, 0.0013)
    tmp_inference = baseline_inference
    if rand <= 50:
        tmp_inference = baseline_inference + inference_shift
    else:
        tmp_inference = baseline_inference - inference_shift

    rand = random.randint(1,101)
    confidence_shift = random.uniform(0.00, 0.10)
    tmp_confidence = baseline_confidence
    if rand <= 50:
        tmp_confidence = baseline_confidence + confidence_shift
    else:
        tmp_confidence = baseline_confidence + confidence_shift

    tmp_num = num
    tmp_broken = broken
    rand = random.randint(1,101)
    print ("number rand: " + str(rand))
    # Test for number deviance
    if rand <= 2:
        tmp_num = num + 1
        tmp_confidence = tmp_confidence - random.uniform(0.00, 0.2)
    elif rand <= 5:
        tmp_num = num - 1
        tmp_confidence = tmp_confidence - random.uniform(0.00, 0.2)
    rand = random.randint(1,101)
    print ("broken rand: " + str(rand))
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
    
    d = {
        'number':tmp_num,
        'confidence':tmp_confidence,
        'inference_time':tmp_inference
    }

    r = requests.post("http://localhost:8080", data = d)
