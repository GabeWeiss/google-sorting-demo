var five = require("johnny-five");
var board = new five.Board();
var servo = false;
var servo2 = false;
board.on("ready", function() {
     servo = five.Servo({
         pin: 9,
         startAt: 90,
         range: [0, 180],
         interval: 10
     });
     servo.sweep([45,135]);
     servo2 = five.Servo({
         pin: 10,
         startAt: 90,
         range: [0, 180],
         interval: 10
     });
     servo2.sweep([135,45]);
     // servo.to(50);
     // left();
});
var sensorValues = {};

// 
// function left() {
//     servo.to(50);
//     setTimeout(right, 3000);
// }
// 
// function right() {
//     servo.to(250);
//     setTimeout(left, 3000);
// }


/*

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
}
*/