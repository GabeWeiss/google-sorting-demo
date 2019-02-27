nmcli dev wifi connect EdgeTPU24 ifname wlan0 password blacklotus
./capture_and_recognize --model_file=detection_model_edgetpu.tflite --video_device=/dev/video1 --server_url=192.168.42.100:8080 --show_ui=true
