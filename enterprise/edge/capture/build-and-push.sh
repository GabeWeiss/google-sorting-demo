#!/bin/bash
sudo docker build -t gcr.io/$PROJECT_ID/capture:aarch64 -f ./Dockerfile .

sudo docker push gcr.io/$PROJECT_ID/capture:aarch64

