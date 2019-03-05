nmcli dev wifi connect EdgeTPU24 ifname wlan0 password blacklotus

python3 capture_and_recognize.py \
	--model-file=edgetpu_model.tflite.2_27_2019 \
	--video-device-index=1 \
	--server-url=http://192.168.42.100:8080 \
	--show-ui=true
