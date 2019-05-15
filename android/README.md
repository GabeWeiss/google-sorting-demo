Android app we built to use as a companion piece to the main demo at Google I/O 2019.

There are three pages to the app:

1. A graph that reads the same dashboard data for number of times each gear number gets hit. For our demo, we isolated it to specific events, so we have a bucket for each even we ran at, and at the start of each event, we zeroed out the firestore collection containing the counts
2. Output from the main demo's model for the last gear roll. As of the writing of this, for example, we throw away the first 3 inferences from the model, and keep the next 5. So in this page of the app, the throwaways show up in red, and the keeps show in black. The output currently is detected number, confidence value, and inference time.
3. A version of the main demo's vision detection. We trained a hand-held version of the model which it runs using the phone's camera to do live inference.

The app will require a service account file in the Sorting_Demo/app/ directory named google-services.json. The service account needs read access to the Firestore instance used for the other parts of the demo so it can fetch the column counts and last-rolled model output.