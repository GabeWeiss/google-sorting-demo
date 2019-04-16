## PLACEHOLDER: This is the repo for the Google sorting demo (it's gone by many names).

**_android/Sorting_Demo_**: This is the folder for the Android application used at Google I/O 2019 to show off AutoML's model compiled down to mobile device and showing off the ability to use the same model on multiple formats of devices accurately.

**base_training_images**: Holder folder for any images we take and need to transfer between places for training our model. Heavily depending upon lighting changes, etc to be accurate.

**dashboard**: Front-end UI code for displaying the dashboard which is shown on the monitor attached to the demo.

**enterprise**: Code that lives and runs on the Edge TPU development board made by Coral (coral.withgoogle.com/products/dev-board)

**lenovo**: Code that lives and runs on the Windows Lenovo box. The node.js code that has all the business logic for what to do with the outputs from our AutoML model, as well as running the mechanicals of the demo itself by way of the Arduino.

