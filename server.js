var lightThreshold = 3;

var ms_per_inference = 999999;

const port = process.env.PORT || 8080;
const express = require('express');
const fs = require('fs');
const async = require("async");
const app = express();
app.use(express.json());
app.use(express.urlencoded());
const http = require('http').Server(app);

const io = require('socket.io')(http, {
    wsEngine: 'ws'
});

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

var targetX = 10;
var targetY = 0;
var lastDetected = 4;
var lastSend = 0;
app.post('/', function(req, res) {
    console.log(req.body);
    res.status(200).send({ ok: true });
    var body = req.body;
    var totalDiff = 999999999;
    var best_guess = false;

    ms_per_inference = body.ms_per_inference;
    if(lastSend+200 < new Date().getTime()){
        lastSend = new Date().getTime();
        io.emit('speed', ms_per_inference);
    }
    body.classes = body.classes.split('|');
    body.bounding_boxes = body.bounding_boxes.split('|');
    for (var i = 0; i < body.bounding_boxes.length; i++) {
        body.bounding_boxes[i] = body.bounding_boxes[i].split(',');
        var diff = (Math.abs(body.bounding_boxes[i][0] - targetX) + Math.abs(body.bounding_boxes[i][1] - targetY));
        if ((!best_guess || diff < totalDiff) && (body.bounding_boxes[i][0] < 125)) {
            totalDiff = diff;
             best_guess = body.classes[i];
        }
    }

    console.log(best_guess);
    if (best_guess && is_ready && !is_running) {
        is_running = true;
        var val = parseInt(best_guess)%10;
        if(val == 9){
            val = 6;
        }
        if (val < 1 || val > 7) {
            val = 8;
        }
        // if (lastDetected != val) {
            // lastDetected = val;
            runAnimation(val);
        // }
    }
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
        console.log(val);
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
                    // console.log(this.level);
                    if (this.value > lightThreshold) {
                        is_ready = false;
                    } else {
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