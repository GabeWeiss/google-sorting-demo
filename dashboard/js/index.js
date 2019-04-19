const socket = io();
socket.on('counts', function (d) {
    console.log(d);
    if(series){
        series.setData([d.one,d.two,d.three,d.four,d.five,d.six,d.seven,d.X])
    }
});
var lastChangeTime = new Date().getTime();
var lastChangeNumber = new Date().getTime();
socket.on('inference', function (data) {
    console.log(data);

    var time = (Math.round(data.time*10)/10) + "ms";
    if($('.js-inference-number').text() != time){
        lastChangeTime = new Date().getTime();
        $('.js-inference-number').text(time).addClass('changed');
    }

    var raw_number = Math.round(data.number*10)/10;
    number = raw_number % 10;
    if(raw_number > 10) number += " - broken";
    if($('.js-last').text() != number){
        lastChangeNumber = new Date().getTime();
        $('.js-last').text(number).addClass('changed');
    }
});
setInterval(()=>{
    let now = new Date().getTime();
    if(now-lastChangeTime > 567 && $('.js-inference-number').hasClass('changed')){
        $('.js-inference-number').removeClass('changed')
    }
    if(now-lastChangeNumber > 567 && $('.js-last').hasClass('changed')){
        $('.js-last').removeClass('changed')
    }
}, 20);

var series = false;
Highcharts.chart('chart', {
    chart: {
        type: 'column',
        events: {
            load: function () {
                series = this.series[0];
            }
        }
    },
    title: false,
    subtitle: false,
    legend: false,
    xAxis: {
        categories: [
            '1',
            '2',
            '3',
            '4',
            '5',
            '6',
            '7',
            'X'
        ],
        crosshair: false,
        labels: {
            y: 45,
            style: {
                fontSize: '16px',
                fontFamily: 'Google Sans',
                color: "#797A7C",
            }
        },
        lineColor: "#9AA0A6",
        lineWidth: 3,
        tickWidth: 0
    },
    yAxis: {
        min: 0,
        softMax: 100,
        title: false,
        tickInterval: 25,
        labels: {
            style: {
                fontSize: '16px',
                fontFamily: 'Google Sans',
                color: "#797A7C"
            }
        },
        x: 10,
        gridLineColor: "#F1F3F4",
        gridLineWidth: 2
    },
    tooltip: {
        footerFormat: '</table>',
        shared: true,
        useHTML: true
    },
    plotOptions: {
        column: {
            pointPadding: 0,
            groupPadding: 0.1,
            borderWidth: 0
        }
    },
    tooltip: {
        enabled: false
    },
    series: [{
        data: [0, 0, 0, 0, 0, 0, 0, 0],
        color: '#4285F4',
        dataLabels: {
            enabled: true,
            color: '#5F6368',
            align: 'center',
            format: '{point.y:.0f}', // one decimal
            y: 0, // 10 pixels down from the top,

            borderWidth: 0,
            style: {
                fontSize: '50px',
                fontFamily: 'Google Sans Display',
                textOutline: "none"
            }
        }
    }]
});