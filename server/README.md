The code in this folder is what runs on the secondary machine connected to the Coral board. In our case, this was a Lenovo Windows box because that's what the initial agency that did the physical build setup used, but there's no reason it needs to be a Windows box.

The models directory contains the last two sets of models that we've used at our events, and then an archive of all the models we've tested or used.

**server.js** is one of the primary files in here. It has the business logic for handling the output from the ML models from the Coral board. It handles driving the Arduino attached to the secondary machine, and the logic around fine tuning the accuracy of the demo. E.g. the **THROW_AWAY_COUNT** and **KEEP_COUNT** variables tune the tradeoff between latency and accuracy by considering more inferences from the model, and normalizing the confidence values to guard against outlier values throwing off your accuracy. This script also serves up an HTML page for configuring the calibration of the main chute and the gates for the gears.

**stream_video.py** is the other primary file. This is a small forwarding stream server that takes the video feed from the Coral board, and serves it up on a local port for the dashboard to stream. Also handles saving a screenshot in a buffer (also served up for the dashboard) for the captured gear, along with a bounding box to highlight a missing gear if detected.

**config.html** is the configuration page mentioned above. It handles calibrating the chute and gate servo positions.

**config.json** is the data file written to by the **config.html** page. Do not write directly to this file, things can get weird. Safer to use the config page.

**server_moc.py** is the test file that emulates output from the Coral board for a single roll of a gear. You can configure a couple knobs in the script to match what you have in the **server.js** for things like, the throwaway count, and the keep count, what number you want to have, etc. It builds in some random variance as well to emulate the model not being 100% accurate.