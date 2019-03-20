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

var ms_per_inference = 999999;

const port = process.env.PORT || 8080;
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

// Firestore initialization
const firestoreAdmin = require('firebase-admin');
var telemetrySA = require('./service_account.json');
var telemetryApp = firestoreAdmin.initializeApp({
    credential: firestoreAdmin.credential.cert(telemetrySA),
    databaseURL: 'https://sorting-demo-230918.firebaseio.com'
}, "telemetry");
var telemetryDB = telemetryApp.firestore();
// end Firestore initialization

// Example of writing a document out to our telemetry collection
/*
var addTelemetry = telemetryDB.collection('telemetry').add({
    number: 1,
    confidence: 0.72,
    inference_time: 5,
    timestamp: Date.now()
});
*/

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
    socket.on('config', function(data) {
        if (data.t === "chute") {
            servos.chute.positions[data.i][data.s] = data.v;
            // if (is_ready && !is_running) 
                runAnimation(data.i);
        } else if (data.t === "servo") {
            servos[data.i][data.p] = data.v;
            // runAnimation(data.i);
        }
        save();
    });
});


app.use('/js', express.static(__dirname + '/js'));
app.use('/css', express.static(__dirname + '/css'));
app.use('/img', express.static(__dirname + '/img'));
app.use('/config.json', express.static(__dirname + '/config.json'));
app.use('/jquery.js', express.static(__dirname + '/node_modules/jquery/dist/jquery.min.js'));

// healthcheck
app.get('/_health', function(req, res) {
    // add any necessary business logic (db connection, etc)
    res.status(200).send({
        ok: true
    });
});

app.get('/config', function(req, res) {
    res.sendFile(__dirname + '/config.html');
});
app.get('/', function(req, res) {
    res.sendFile(__dirname + '/display.html');
});

// These variables were used in the bounding box detection
// See note in code block below
/*
var targetX = 10;
var targetY = 0;
*/

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

var inferenceCount  = 0;
var totalConfidence = 0;
const INFERENCE_AVERAGE_COUNT = 5;
const KEY_CONFIDENCE = "confidence";
const KEY_HIT_COUNT  = "count";
var counts           = {};
var avgInferenceTime = 0;

app.post('/', function(req, res) {
    res.status(200).send({ ok: true });
    var body          = req.body;
    var gearNumber    = body.number;
    var confidence    = body.confidence;
    avgInferenceTime += Math.round(body.inference_time * 1000);

    if (inferenceCount < INFERENCE_AVERAGE_COUNT) {
        ++inferenceCount;

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

    /*
        For Next 2019, we're tracking some stats on how often the app gets
        run. The schema wants a start and end time. This demo happens VERY
        fast, but I'll dutifully record a start and end time anway.
    */
    var demoStartTime = Date.now();

    var leadNumber     = 0;
    var leadConfidence = 0;
    var brokenTooth    = false;
    avgInferenceTime = avgInferenceTime / INFERENCE_AVERAGE_COUNT;

    var keys = Object.keys(counts);
    for (var i = 0; i < keys.length; ++i) {
        var tmpNumber = keys[i];
        var tmpConfidenceTotal = counts[tmpNumber][KEY_CONFIDENCE];
        var tmpConfidenceEqualized = tmpConfidenceTotal / totalConfidence;

        if (tmpConfidenceEqualized > leadConfidence) {
            if (tmpNumber.length > 0 && tmpNumber.charAt(0) != "0") {
                brokenTooth = true;
            }
            else {
                brokenTooth = false;
            }
            leadNumber = Number(tmpNumber);
            leadConfidence = tmpConfidenceEqualized;
        }

            // DEBUGGING for the knob to tune for the confidence results
        console.log("REPORTING FOR " + tmpNumber);
        console.log("Count for this number: " + counts[tmpNumber][KEY_HIT_COUNT]);
        console.log("Normalized confidence: " + tmpConfidenceEqualized);
        console.log("");
    }
    console.log("Total Confidence: " + totalConfidence);
    console.log("\n\n\n");

    // LEAVING IN
    // this is code for detecting bounding box output. The logic will change
    // because now we're dealing with JSON blog in the body, but we may still
    // use some piece of this when we re-introduce bounding boxes when AutoML
    // gets object detection
/*
    var totalDiff = 999999999;
    body.classes = body.classes.split('|');
    body.bounding_boxes = body.bounding_boxes.split('|');
    for (var i = 0; i < body.bounding_boxes.length; i++) {
        body.bounding_boxes[i] = body.bounding_boxes[i].split(',');
        var diff = (Math.abs(body.bounding_boxes[i][0] - targetX) + Math.abs(body.bounding_boxes[i][1] - targetY));
        if ((!leadNumber || diff < totalDiff) && (body.bounding_boxes[i][0] < 125)) {
            totalDiff = diff;
             leadNumber = body.classes[i];
        }
    }
*/
    //console.log(is_ready);
    if (leadNumber && is_ready && !is_running) {
        //console.log("I'm getting here?");
        is_running = true;

        // if our leading digit isn't a 0, it means we have broken teeth, so don't
        // bother parsing the number at all, it doesn't matter.
        if (brokenTooth) {
            val = 8;
        }
        else {
            var val = parseInt(leadNumber)%10;
            if(val == 9){
                val = 6;
            }
            if (val < 1 || val > 7) {
                val = 8;
            }
        }

        runAnimation(val);

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
                    /*
                        TODO: Add in logic around defective gears once we have
                        that working. Until then, we're going to just consider
                        numbers written because we don't have that chunk in yet.
                        Once it is, then that may circumvent this switch statement
                    */
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
            console.log('Updated telemetry');
        }).catch(err => {
            console.log('Telemetry database update failed');
        });
    }
    else if (is_running) {
        // TODO: There's a bug here, if we get a post event, but we're
        // running, it means we haven't reset yet but we have post events
        // coming in and we probably need to handle them? Maybe? This might
        // be the bug on why we're stalling and not continuing until we
        // jiggle the puck
        console.log("I'm ready to go, and got some inferences in, but the demo is running still.");
    }

    // reset our variables to be ready to start gathering the next 5
    inferenceCount   = 0;
    counts           = {};
    totalConfidence  = 0;
    avgInferenceTime = 0;
});

http.listen(port, function() {
    console.log('listening on *:' + port);
});
var is_ready = false;
var is_running = false;

var five = require("johnny-five");
var board = new five.Board();


var currentPos = 4;
var expectedChuteDelay = 1000;
function runAnimation(val) {
    is_running = true;

    minTime = (parseInt(val)/8)*1000;
    
    expectedChuteDelay = (Math.abs(parseInt(val)-currentPos)*100);
    expectedToChuteDelay = ((parseInt(val)-1)/7)*2000;
    bestDelay = Math.max(expectedChuteDelay-expectedToChuteDelay, 1)

    console.log('expectedChuteDelay: '+expectedChuteDelay);
    console.log('expectedToChuteDelay: '+expectedToChuteDelay);
    console.log('bestDelay: '+bestDelay);
    
    // longestDelay = Math.max(expectedChuteDelay, expectedToChuteDelay);
    // servos["chute"].j5Obj.to(servos["chute"].positions[1]);
    // setTimeout(function() {
        // console.log(val);
        // console.log(servos[1].j5Obj);
        for (var i = 1; i <= 8; i++) {
            if (servos[i].j5Obj) {
                console.log(i);
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
                console.log("to: "+servos["chute"].positions[val].right);
            }else{
                servos["chute"].j5Obj.to(servos["chute"].positions[val].left);
                console.log("to: "+servos["chute"].positions[val].left);
            }
            currentPos = val;
        }
        clearTimeout(timeoutFunction);
        timeoutFunction = setTimeout(function() {
            is_running = false;
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
            process.exit();
        } else {
            Object.keys(servos).forEach(function(key) {
                console.log(servos[key].props);
                servos[key].j5Obj = new five.Servo(servos[key].props);
            });
            Object.keys(sensors).forEach(function(key) {
                var sensor = new five.Light("A" + key);
                if (key == 0) {
                sensor.on("change", function() {
                    //console.log(this.value);
                    if (this.value > lightThreshold) {
                        if (is_ready == true) {
                            console.log("Changing ready value from false to true");
                        }
                        is_ready = false;
                    } else {
                        if (is_ready == false) {
                            console.log("Changing ready value from true to false");
                        }
                        is_ready = true;
                    }
                });

                } else {
                    sensor.on("change", function() {
                        if (this.level > lightThreshold && !sensor.active) {
                            sensor.active = true;
                        } else if (sensor.is_active && minTime > (new Date().getTime() - triggeredTime) && "A"+currentPos == this.pin) {
                            sensor.active = false;
                            is_running = false;
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