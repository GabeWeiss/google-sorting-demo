var five = require("johnny-five");
var board = new five.Board();
var servo = false;
board.on("ready", function() {
    //  servo = five.Servo({
    // 
    //         pin: 3,
    //         startAt: 100,
    //         range: [0, 180],
    //         interval: 1000
    // });
    //  servo.sweep([0,300]);
    //  left();
    var sensor = false;
    for (var i = 0; i <= 0; i++) {
        sensor = new five.Light("A" + i);
        sensor.on("change", function() {
            sensorValues[this.pin] = this.value;
            console.log(this.value);
        });
    }
    setInterval(function() {
        console.log("----------------");
        Object.keys(sensorValues).forEach(function(key) {
            console.log(key + ":" + sensorValues[key]);
        });
        console.log("----------------");
    }, 1000);
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