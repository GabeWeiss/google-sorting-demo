// Copyright 2019 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var lightThreshold = 10;

const express = require('express');
const fs = require('fs');
const async = require("async");
const app = express();
app.use(express.json());
app.use(express.urlencoded());
const http = require('http').Server(app);
// io is for the port connections and notifications
const io = require('socket.io')(http, {
    wsEngine: 'ws'
});

// Firestore initialization for the demo's telemetry
const firestoreAdmin = require('firebase-admin');
var telemetrySA = require('./service_account.json');
var telemetryApp = firestoreAdmin.initializeApp({
    credential: firestoreAdmin.credential.cert(telemetrySA),
    databaseURL: 'https://sorting-demo-230918.firebaseio.com'
}, "telemetry");
var telemetryDB = telemetryApp.firestore();

// Example of writing a document out to our telemetry collection
/*
var addTelemetry = telemetryDB.collection('telemetry').add({
    number: 1,
    confidence: 0.72,
    inference_time: 5,
    timestamp: Date.now()
});
*/

// Firestore initialization for the demo's usage during Next 2019
var statsSA = require('./next19-metrics-service-account.json');
var statsApp = firestoreAdmin.initializeApp({
    credential: firestoreAdmin.credential.cert(statsSA),
    databaseURL: 'https://next19-metrics-test.firebaseio.com'
}, "stats");
var statsDB = statsApp.firestore();


// Example of writing a document out to our stats collection
/*
var addStat = statsDB.collection('demos').doc("SortingDemo").collection('sessions').add({
    start: firestoreAdmin.firestore.Timestamp.fromDate(new Date(Date.now())),
    end: firestoreAdmin.firestore.Timestamp.fromDate(new Date(Date.now()))
});
*/

var lastpos = 1;
io.on('connection', function(socket) {
    socket.screen_id = socket.handshake.query.id;
    socket.join(socket.handshake.query.id);
    socket.on('run', function(data) {
        runAnimation(data);
    });

    // When calibrating the demo from the /config page, this is the callback
    // it's used for setting the motor rotational position for the individual
    // slot servos (and grabber claw), as well as the main chute. Under normal
    // conditions, you shouldn't ever really need to recalibrate the individual
    // servos, just the main chute
    socket.on('config', function(data) {
        if (data.t === "chute") {
            servos.chute.positions[data.i][data.s] = data.v;
            // if (lightSensorIsBlocked && !isRunning) 
                runAnimation(data.i);
        } else if (data.t === "servo") {
            servos[data.i][data.p] = data.v;
            // runAnimation(data.i);
        }
        save();
    });
});

// Direct webpage access is managed here. The only page we're currently working with here
// is the configuration page for calibrating the servos and chute
app.use('/config.json', express.static(__dirname + '/config.json'));
app.use('/jquery.js', express.static(__dirname + '/node_modules/jquery/dist/jquery.min.js'));
app.get('/config', function(req, res) {
    res.sendFile(__dirname + '/config.html');
});
app.get('/', function(req, res) {
    res.sendFile(__dirname + '/config.html');
});

const port = process.env.PORT || 8080;
http.listen(port, function() {
    console.log('listening on *:' + port);
});

/*
    One of the knobs we can turn in order to get more accuracy out of our models is in the two
    variables below. As the gear rolls down the ramp, there's a tiny fraction of a second as it
    rolls into the target zone where we get partial frames, and as a result, sometimes bad results.
    The THROW_AWAY_COUNT is, as it describes, the number of inferences we throw away before we
    start to "count". We're only getting inferences to us that are above the confidence threshold
    from the model as well, so that's the other knob we can turn, is how low/high we want to accept
    inferences from the model on the Enterprise board itself.

    The INFERENCE_AVERAGE_COUNT is how many inferences to wait for before we start to calculate
    what we think we're seeing. So the code below will take INFERENCE_AVERAGE_COUNT and normalize
    the confidence across the groupings that we are seeing to vette which number being seen is the
    best option.

    Tuning these two is potentially detrimental to the demo, be careful. Keeping in mind, that if
    the confidence of the model is right on the edge of the threshold, it's possible that it could
    take a very long time to get n inferences from the Enterprise board, and while it's waiting,
    the gear will stick in the grabber claw and not be droped. It is indeed possible that the gear
    never drops. Important that whomever is running the demo understands that if/when it happens
    so they can explain it.
*/
const THROW_AWAY_COUNT = 3;
const INFERENCE_AVERAGE_COUNT = THROW_AWAY_COUNT + 5;

const KEY_CONFIDENCE = "confidence";
const KEY_HIT_COUNT  = "count";

var inferenceCount   = 0;
var counts           = {};
var totalConfidence  = 0;
var avgInferenceTime = 0.0;

// This is the core loop of the application. It relies on receiving post events from the
// Edge TPU development board. 
/*
    Schema for EdgeTPU dev board output:
        model output for number detected on puck
        tens digit is the key for broken teeth or not
            0 == no teeth broken
            1 == one broken tooth
            2 == two broken teeth
    number: nn
        confidence value from model on the number detected
    confidence: nn.nnnnnnnn
        inference time model took to give result in seconds
    inference_time: nn.nnnnnnnnn
*/
app.post('/', function(req, res) {
    res.status(200).send({ ok: true });

    // if we're currently running the board (meaning a gear is in motion),
    // don't do anything with incoming messages
    if (isRunning) {
        return;
    }

    var body          = req.body;
    var gearNumber    = body.number;
    var confidence    = Number(body.confidence);
    var inference     = Number(body.inference_time);
    
    // If we're still under our average count (which is our magic number + the throwaway count)
    // then just keep iterating and gathering our inference numbers from the Enterprise board
    if (inferenceCount < INFERENCE_AVERAGE_COUNT) {
        ++inferenceCount;

        // Throw away the first 'THROW_AWAY_COUNT' inferences to reduce noisiness from images
        // captured while puck is rolling.
        if (inferenceCount <= THROW_AWAY_COUNT) {
            return;
        }

        avgInferenceTime += inference;

        if (!counts[gearNumber]) {
            counts[gearNumber] = {};
        }

        counts[gearNumber][KEY_CONFIDENCE] = 
            counts[gearNumber][KEY_CONFIDENCE] ? 
                counts[gearNumber][KEY_CONFIDENCE] + confidence :
                confidence;
        counts[gearNumber][KEY_HIT_COUNT] = 
            counts[gearNumber][KEY_HIT_COUNT] ?
                counts[gearNumber][KEY_HIT_COUNT] + 1 :
                1;
        totalConfidence += confidence;
        return;
    }

    //console.log("Got our inference values, moving forward to running the demo now.");

    /*
        For Next 2019, we're tracking some stats on how often the app gets
        run. The schema wants a start and end time. This demo happens VERY
        fast, but I'll dutifully record a start and end time anway.
    */
    var demoStartTime = Date.now();

    var leadNumber     = 0;
    var leadConfidence = 0;
    var brokenTooth    = false;
    
    // inference time is given as micro-seconds, so average our accumulated values from the
    // inference gathering above by the number of actual inferences we've taken, and then
    // multiple by 1000 to get microseconds, and then truncate to only 2 digits of precision
    // to get a compact value to display
    avgInferenceTime = (avgInferenceTime / (INFERENCE_AVERAGE_COUNT - THROW_AWAY_COUNT)) * 1000;
    avgInferenceTime = avgInferenceTime.toFixed(2);

    // iterating over our gathered set of inferences to find out what we saw, and which is
    // the likely real value
    var keys = Object.keys(counts);
    for (var i = 0; i < keys.length; ++i) {
        var tmpNumber = keys[i];
        var tmpConfidenceTotal = counts[tmpNumber][KEY_CONFIDENCE];
        var tmpConfidenceEqualized = tmpConfidenceTotal / totalConfidence;

        // we had some problems with false negatives where we'd have a broken tooth, but the digit
        // confidence was highest on a gear that happened to NOT have the broken tooth returned
        // with it. To combat that, we're rolling with, if we have any gears in our set of inferences
        // that had a broken tooth, then we'll consider the gear as broken. We can fine tune this
        // value in the code that runs on the Edge TPU development board by adjusting the
        // confidence threshold for the model tracking the broken teeth
		if (tmpNumber.length > 0 && tmpNumber.charAt(0) != "0") {
            brokenTooth = true;
        }

        if (tmpConfidenceEqualized > leadConfidence) {
            leadNumber = Number(tmpNumber);
            leadConfidence = tmpConfidenceEqualized;
        }

        // DEBUGGING
        // This is tracking our normalized values from the inferences sent by the Edge TPU board
        console.log("REPORTING FOR " + tmpNumber);
        console.log("Count for this number: " + counts[tmpNumber][KEY_HIT_COUNT]);
        console.log("Normalized confidence: " + tmpConfidenceEqualized);
    }

    console.log("Total Confidence: " + totalConfidence);
    console.log("\n\n");


    // the light sensor in question here is in the grabber claw. So when it's blocked it means
    // we have a gear in the position, AND we've gathered our requisite inferences. I think
    // there's probably some better logic where we only start gathering inferences once the light
    // is blocked at the sensor, but that was a bigger change than we could make in the time before
    // we had the demo up and running
    if (lightSensorIsBlocked && !isRunning) {

        // If we have broken teeth, don't bother parsing the number at all, it doesn't matter.
        // Our demo has 8 buckets. 1-7 plus a "reject" bucket which is position 8.
        if (brokenTooth) {
            val = 8;
        }
        else {
            // recall values coming in are in the format nn, where the tens digit is tooth missing
            // detection, and the ones digit is our actual detected number
            var val = parseInt(leadNumber) % 10;
            if (val == null){
                val = 8;
            }
            else if(val == 9){
                val = 6;
            }
            else if (val < 1 || val > 7) {
                val = 8;
            }
        }

        runAnimation(val);

/*  // UNCOMMENT HERE TO START SENDING DATA AGAIN TO FIRESTORE DATABASES
            // to avoid re-entrancy problems with new values coming in for the "lead"
            // numbers in the loop before the telemetry can finish sending.
        var telemetryNumber = leadNumber;
        var telemetryConfidence = leadConfidence;
        var telemetryInference = avgInferenceTime;

            // send the data off to the stats server
        var addStat = statsDB.collection('demos').doc("SortingDemo").collection('sessions').add({
            start: firestoreAdmin.firestore.Timestamp.fromDate(new Date(demoStartTime)),
            end: firestoreAdmin.firestore.Timestamp.fromDate(new Date(Date.now()))
        });

        // send the telemetry for what chute was hit
        var longTermCollectionName = "next2019-test";
        var longTermTelemetryDoc = telemetryDB.collection("telemetry-long-term")
                                            .doc("events")
                                            .collection(longTermCollectionName);
        var addTelemetry = longTermTelemetryDoc.add({
            number: telemetryNumber,
            confidence: telemetryConfidence,
            inference_time: telemetryInference,
            timestamp: Date.now()
        });

        var liveTelemetryDoc = "chutes-test";
        var liveInferenceDoc = "live-inference";
        var liveRef = telemetryDB.collection("telemetry-live-count")
                                 .doc(liveTelemetryDoc);
        var liveInferenceRef = telemetryDB.collection("telemetry-live-count")
                                          .doc(liveInferenceDoc);
        liveInferenceRef.update({time: telemetryInference,
                                 number: telemetryNumber});
        var telemetryTransaction = telemetryDB.runTransaction(t => {
            return t.get(liveRef)
                .then(doc => {
                    // increment the appropriate value
                    var docData = doc.data();
                    //
                    //  TODO: Add in logic around defective gears once we have
                    //  that working. Until then, we're going to just consider
                    //  numbers written because we don't have that chunk in yet.
                    //  Once it is, then that may circumvent this switch statement
                    //
                    switch(telemetryNumber) {
                        case 1:
                            var newVal = docData.one + 1;
                            t.update(liveRef, {one: newVal});
                            break;
                        case 2:
                            var newVal = docData.two + 1;
                            t.update(liveRef, {two: newVal});
                            break;
                        case 3:
                            var newVal = docData.three + 1;
                            t.update(liveRef, {three: newVal});
                            break;
                        case 4:
                            var newVal = docData.four + 1;
                            t.update(liveRef, {four: newVal});
                            break;
                        case 5:
                            var newVal = docData.five + 1;
                            t.update(liveRef, {five: newVal});
                            break;
                        case 6:
                            var newVal = docData.six + 1;
                            t.update(liveRef, {six: newVal});
                            break;
                        case 7:
                            var newVal = docData.seven + 1;
                            t.update(liveRef, {seven: newVal});
                            break;
                        default:
                            var newVal = docData.X + 1;
                            t.update(liveRef, {X: newVal});
                            break;
                    }
                });
        }).then(result => {
            //console.log('Updated telemetry');
        }).catch(err => {
            console.log('Telemetry database update failed');
        });
*/  // UNCOMMENT HERE TO START SENDING DATA AGAIN TO FIRESTORE DATABASES
    }

    // reset our variables to be ready to start gathering the next 5
    inferenceCount   = 0;
    counts           = {};
    totalConfidence  = 0;
    avgInferenceTime = 0.0;
}); // end of the app.post() call



var lightSensorIsBlocked = false;
var isRunning = false;

// Johnny-five is an awesome node library for all things robotics and IoT sensor
// http://johnny-five.io/
var five = require("johnny-five");
var board = new five.Board();

var currentPos = 4;
var expectedChuteDelay = 1000;
function runAnimation(val) {
    //console.log("Setting isRunning to true now");
    isRunning = true;

    minTime = (parseInt(val) / 8) * 1000;
    
    expectedChuteDelay = (Math.abs(parseInt(val) - currentPos) * 100);
    expectedToChuteDelay = ((parseInt(val) - 1) / 7) * 2000;
    bestDelay = Math.max(expectedChuteDelay-expectedToChuteDelay, 1)
/*
    console.log('expectedChuteDelay: '+expectedChuteDelay);
    console.log('expectedToChuteDelay: '+expectedToChuteDelay);
    console.log('bestDelay: '+bestDelay);
*/    
    // longestDelay = Math.max(expectedChuteDelay, expectedToChuteDelay);
    // servos["chute"].j5Obj.to(servos["chute"].positions[1]);
    // setTimeout(function() {
        // console.log(val);
        // console.log(servos[1].j5Obj);
        for (var i = 1; i <= 8; i++) {
            if (servos[i].j5Obj) {
                //console.log(i);
                var pos = parseInt(servos[i].close);
                if (i == parseInt(val))
                    pos = parseInt(servos[i].open);
                servos[i].j5Obj.to(pos);
            }
        }
        
        setTimeout(function() {
            if (servos["dropper"].j5Obj) {
                servos["dropper"].j5Obj.to(servos["dropper"].open);
            }
            setTimeout(function() {
                if (servos["dropper"].j5Obj) {
                    servos["dropper"].j5Obj.to(servos["dropper"].close);
                }
            }, 2000);
        }, bestDelay);
        if (servos["chute"].j5Obj) {
            if(currentPos < val){
                servos["chute"].j5Obj.to(servos["chute"].positions[val].right);
                //console.log("to: "+servos["chute"].positions[val].right);
            }else{
                servos["chute"].j5Obj.to(servos["chute"].positions[val].left);
                //console.log("to: "+servos["chute"].positions[val].left);
            }
            currentPos = val;
        }
        clearTimeout(timeoutFunction);
        timeoutFunction = setTimeout(function() {
            isRunning = false;
            //console.log("Setting isRunning to false now");
        }, bestDelay+3000);
    // }, 2000);
}
var timeoutFunction = false;

function save() {
    var clone = Object.assign({}, servos);
    var keys = Object.keys(clone);
    for (var i = 0; i < keys.length; i++) {
        clone[keys[i]] = Object.assign({}, clone[keys[i]]);
        clone[keys[i]].j5Obj = false;
    }
    fs.writeFile("config.json", JSON.stringify({
        servos: clone
    }), function(err) {
        if (err) {
            return console.log(err);
        }
        console.log("The config was saved!");
    });
}

function load(cb) {
    fs.access('config.json', fs.constants.F_OK | fs.constants.W_OK, (err) => {
        if (err) {
            console.log("NO CONFIG FILE FOUND");
            save();
            cb(null);
        } else {
            fs.readFile('config.json', (err, raw) => {
                if (!err) {
                    var data = JSON.parse(raw);
                    // console.log(data);
                    servos = data.servos;
                }
                cb(null);
            });
        }
    });
}
var minTime = 100;
var triggeredTime = new Date().getTime();
async.parallel([
        function(callback) {
            board.on("ready", function() {
                callback(null);
            });
            board.on("fail", function(e) {
                console.log("FAILED TO CONNECT TO BOARD!!!");
                console.log(e.message);
                callback(e.message);
            });
        },
        load
    ],
    // optional callback
    function(err, results) {
        console.log("Started");
        if (err) {
            console.log("CRITICAL ERROR: FAILED TO START");
            //process.exit();
        } else {
            Object.keys(servos).forEach(function(key) {
                //console.log(servos[key].props);
                servos[key].j5Obj = new five.Servo(servos[key].props);
            });
            Object.keys(sensors).forEach(function(key) {
                var sensor = new five.Light("A" + key);
                if (key == 0) {
                sensor.on("change", function() {
                    //console.log(this.value);
                    if (this.value > lightThreshold) {
//                        if (lightSensorIsBlocked == true) {
//                            console.log("Changing lightSensorIsBlocked value from false to true");
//                        }
                        lightSensorIsBlocked = false;
                    } else {
//                        if (lightSensorIsBlocked == false) {
//                            console.log("Changing lightSensorIsBlocked value from true to false");
//                        }
                        lightSensorIsBlocked = true;
                    }
                });

                } else {
                    sensor.on("change", function() {
                        if (this.level > lightThreshold && !sensor.active) {
                            sensor.active = true;
                        } else if (sensor.is_active && minTime > (new Date().getTime() - triggeredTime) && "A"+currentPos == this.pin) {
                            sensor.active = false;
                            isRunning = false;
//                            console.log("Looks like we have been waiting too long, I'm resetting isRunning to false.");
                            clearTimeout(timeoutFunction);
                        }
                    });
                }
                sensors[key].j5Obj = sensor;
            });

        }

    });

//Default servos object
var servos = {
    1: {
        open: 150,
        close: 48,
        props: {
            pin: 3,
            startAt: 100,
            range: [0, 180],
            interval: 1000
        },
        j5Obj: false
    },
    2: {
        open: 150,
        close: 60,
        props: {
            pin: 4,
            startAt: 100,
            range: [0, 180],
            interval: 1000
        },
        j5Obj: false
    },
    3: {
        open: 132,
        close: 54,
        props: {
            pin: 5,
            startAt: 100,
            range: [0, 180],
            interval: 1000
        },
        j5Obj: false
    },
    4: {
        open: 130,
        close: 52,
        props: {
            pin: 6,
            startAt: 100,
            range: [0, 180],
            interval: 1000
        },
        j5Obj: false
    },
    5: {
        open: 127,
        close: 54,
        props: {
            pin: 7,
            startAt: 100,
            range: [0, 180],
            interval: 1000
        },
        j5Obj: false
    },
    6: {
        open: 114,
        close: 54,
        props: {
            pin: 8,
            startAt: 100,
            range: [0, 180],
            interval: 1000
        },
        j5Obj: false
    },
    7: {
        open: 150,
        close: 69,
        props: {
            pin: 9,
            startAt: 100,
            range: [0, 180],
            interval: 1000
        },
        j5Obj: false
    },
    8: {
        open: 140,
        close: 55,
        props: {
            pin: 10,
            startAt: 100,
            range: [0, 180],
            interval: 1000
        },
        j5Obj: false
    },
    "dropper": {
        open: 94,
        close: 33,
        props: {
            pin: 11,
            startAt: 60,
            range: [0, 180],
        },
        j5Obj: false
    },
    "chute": {
        open: 38,
        close: 142,
        props: {
            pin: 12,
            range: [0, 300],
            pwmRange: [1000, 2000],
            deviceRange: [0, 300],
            offset: 0,
            startAt: 150,
        },
        positions: {
            8: {left:76,right:76},
            7: {left:76,right:76},
            6: {left:76,right:76},
            5: {left:76,right:76},
            4: {left:76,right:76},
            3: {left:76,right:76},
            2: {left:76,right:76},
            1: {left:76,right:76},
        },
        j5Obj: false
    },
};

var sensors = {
    0: {
        j5Obj: false
    }
    // ,
    // 1: {
    //     j5Obj: false
    // },
    // 2: {
    //     j5Obj: false
    // },
    // 3: {
    //     j5Obj: false
    // },
    // 4: {
    //     j5Obj: false
    // },
    // 5: {
    //     j5Obj: false
    // },
    // 6: {
    //     j5Obj: false
    // },
    // 7: {
    //     j5Obj: false
    // },
    // 8: {
    //     j5Obj: false
    // },
}