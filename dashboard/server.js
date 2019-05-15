const port = process.env.PORT || 8000;
const express = require('express');
const app = express();
const http = require('http').Server(app);

const io = require('socket.io')(http, {
    wsEngine: 'ws'
});

io.on('connection', function (socket) {
    console.log('socket');
    if(last_inference) io.emit("inference", last_inference);
    if(last_counts) io.emit("counts", last_counts);
});

app.use('/js', express.static(__dirname + '/js'));
app.use('/css', express.static(__dirname + '/css'));
app.use('/img', express.static(__dirname + '/img'));
app.use('/jquery.js', express.static(__dirname + '/node_modules/jquery/dist/jquery.min.js'));

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

http.listen(port, function () {
    console.log('listening on *:' + port);
});

const firestoreAdmin = require('firebase-admin');
var telemetrySA = require('./sorting-demo-sparks-key.json');
var telemetryApp = firestoreAdmin.initializeApp({
    credential: firestoreAdmin.credential.cert(telemetrySA),
    databaseURL: 'https://sorting-demo-230918.firebaseio.com'
}, "telemetry");
var telemetryDB = telemetryApp.firestore();

var liveTelemetryDoc = "chutes-test";
var liveInferenceDoc = "live-inference";
var liveRef = telemetryDB.collection("telemetry-live-count")
    .doc(liveTelemetryDoc);
var liveInferenceRef = telemetryDB.collection("telemetry-live-count")
    .doc(liveInferenceDoc);

last_counts = false;
liveRef.onSnapshot(docSnapshot => {
    last_counts = docSnapshot.data();
    io.emit("counts", last_counts);
}, err => {
    console.log(`Encountered error: ${err}`);
});

last_inference = false;
liveInferenceRef.onSnapshot(docSnapshot => {
    last_inference = docSnapshot.data();
    io.emit("inference", last_inference);
}, err => {
    console.log(`Encountered error: ${err}`);
});