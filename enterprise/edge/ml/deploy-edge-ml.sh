gcloud alpha iot edge ml create detect_v1 \
         --region us-central1 \
         --registry edge_device_registry \
         --device enterprise_board \
         --accelerator tpu \
         --model-uri gs://sorting-demo-data/models/edge_compile/model_od_edgetpu.tflite
