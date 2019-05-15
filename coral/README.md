This folder contains the scripts that run on the [Coral Dev Board](http://coral.withgoogle.com/products/dev-board).

**run_python[_55].sh** is just running the **recognize.py** with flags for the specific models we needed for the most recent show we did. You can just as easily replace the model values in the **recognize.py** script and run that directly.

**recognize.py** is the core script which handles all the logic you need for the actual running of the demo.

**save_image.py** is a script we made to capture images from the webcam. This is what we use to capture the training data for the models. We've found the best accuracy results were to get the demo setup on site at the event, get the lighting set as it will be on the day, and use this script to capture the gear as we've rolled it down the ramp. We found that actually rolling the gear gave us just enough noise to make the accuracy better than if we placed the gear and rotated it by hand.

**mock_socket_client.py** is a test script which mocks the video stream output so we could test some functionality on the frame buffer capture functionality we added for Google I/O. Basically it throws a stream of model output with bounding rects so we could see it in the dashboard in motion.

**fix_git.sh** on purpose we didn't have GitHub permanently setup on the board as a remote device shouldn't have full access, but that meant when we were doing live testing/adjustments we needed to be able to set it up quickly. We set a deploy key up on the board, but didn't permanently add it to the ssh-agent. This shell script was so folks didn't have to remember the voodoo of eval "$(ssh-agent -s)" to then manually add the deploy key so we could use the GitHub repo.

**image_bytes_0.txt** is a capture of the binary bits of an image frame from the webcam. We haven't done anything specific with it, but it's useful if you wanted to moc an image frame from the webcam.