gcloud alpha iot edge containers update capture_v1 \
                                        --region us-central1 \
                                        --registry edge_device_registry \
                                        --device enterprise_board \
                                        --docker-image gcr.io/sorting-demo-230918/capture:aarch64 \
                                        --device-binding /dev/video1:/dev/video0
