import requests

d = {
    'number':'01',
    'confidence':0.765,
    'inference_time':0.02965432
}

for x in range(9):
    r = requests.post("http://localhost:8080", data = d)
