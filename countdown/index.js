/*

Notes:

- Assumes that express trains run in both directions at all times. In fact, there is only one express track and it only runs inbound in the morning rush and outbound in the evening rush.
- Assumes that there is a depot at both ends. In fact, the depot is at 111 St.
- Assumes that trains should be regularly spaced in Manhattan, which makes them irregularly spaced in Queens.
- Assumes trains always stop for 30 seconds.
- Assumes that trains drive a little faster when running express.

Todo:

√ Retina
√ Needle line
- configure constants

*/
// CONSTANTS
var startHour = 5;
var endHour = 6;
var delayFactor = 0.0;
var minutesPerSecond = (endHour - startHour) * 2;
function setStartHour(value) {
    startHour = value;
}
function setEndHour(value) {
    endHour = value;
}
function setDelayFactor(value) {
    delayFactor = value;
}
var stations = [
    { id: 0, local: 0, express: 0, name: "Hudson Yards" },
    { id: 1, local: 3.5, express: 3.5, name: "Times Square" },
    { id: 2, local: 5, express: 5, name: "Fifth Avenue" },
    { id: 3, local: 7.5, express: 7.5, name: "Grand Central" },
    { id: 4, local: 16, express: 16, name: "Court Square" },
    { id: 5, local: 17.5, express: 17.5, name: "Queensboro Plaza" },
    { id: 6, local: 26, express: 24, name: "Woodside" },
    { id: 7, local: 29.5, express: null, name: "74 St" },
    { id: 8, local: 36, express: null, name: "111 St" },
    { id: 9, local: 39.5, express: 32.5, name: "Willets Point" },
    { id: 10, local: 43, express: 36, name: "Flushing Main St" }
];
var firstStation = stations[0];
var selectedStation = stations[3];
var lastStation = stations[stations.length - 1];
var stationPopup = document.getElementById("station");
stations.slice().reverse().forEach(function (station) {
    var option = document.createElement("option");
    option.value = station.id.toString();
    option.text = station.name;
    option.selected = station.id == selectedStation.id;
    stationPopup.appendChild(option);
});
function formatTime(time) {
    while (time > 1400)
        time -= 1400;
    var hours = Math.floor(time / 60);
    var minutes = Math.floor(time) % 60;
    var paddedMinutes = ('00' + minutes).slice(-2);
    return hours + ":" + paddedMinutes;
}
function stationTime(station, express) {
    return express ? station.express : station.local;
}
// if condition is true, returns a copy of the array with objects reversed
function reverseIf(array, condition) {
    return condition ? array.slice().reverse() : array;
}
function generateSchedule(stations, startHour, endHour) {
    var missions = [];
    var startMinute = startHour * 60;
    var endMinute = endHour * 60;
    var gap = 5;
    var inboundExpressStartDelay = -3;
    [true, false].forEach(function (outbound) {
        var id = outbound ? 101 : 102;
        var destination = outbound ? lastStation : firstStation;
        var start = startMinute;
        var express = false;
        var _loop_1 = function () {
            var stops = [];
            reverseIf(stations, !outbound)
                .filter(function (station) { return !express || station.express !== null; })
                .forEach(function (station) {
                var arrive = start + (outbound ?
                    stationTime(station, express) :
                    stationTime(lastStation, express) - stationTime(station, express) +
                        (express ? inboundExpressStartDelay : 0));
                var depart = arrive + 0.5;
                stops.push({ station: station, arrive: { expected: arrive, actual: null, drawn: false },
                    depart: { expected: depart, actual: null, drawn: false } });
            });
            missions.push({ id: id, outbound: outbound, express: express, stops: stops, destination: destination });
            id += 2;
            start += gap;
            express = !express;
        };
        while (start <= endMinute) {
            _loop_1();
        }
    });
    return missions;
}
// https://stackoverflow.com/questions/25582882/javascript-math-random-normal-distribution-gaussian-bell-curve
function randomBoxMuller() {
    var u = 0, v = 0;
    while (u === 0)
        u = Math.random(); //Converting [0,1) to (0,1)
    while (v === 0)
        v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
function addDelay(delay) {
    return delay + Math.abs(randomBoxMuller() * delayFactor);
}
function generateTrains(schedule) {
    return schedule.map(function (mission) {
        var delay = 0;
        mission.stops.forEach(function (stop) {
            delay = addDelay(delay);
            stop.arrive.actual = stop.arrive.expected + delay;
            delay = addDelay(delay);
            stop.depart.actual = stop.depart.expected + delay;
        });
        return { id: mission.id * 10, mission: mission, stop: mission.stops[0], delay: 0 };
    });
}
// DRAWING
var canvasWidth = 1100;
var canvasHeight = 700;
var spacePixels = 15; // height of a kilometer in pixels
var timePixels = 900 / ((endHour - startHour) * 60); // width of a minute in pixels
var minSpace = 0; // start distance in kilometers
var maxSpace = lastStation.local; // end distance in kilometers
var minTime = startHour * 60; // start time in minutes
var maxTime = endHour * 60; // end time in minutes
var margin = 20; // pixels of padding around the map
var leftMargin = 140; // pixels of padding on the left side (allows for labels)
var gridLineWidth = 1;
var scheduleLineWidth = 1;
var trainLineWidth = 2;
function setupCanvas(canvas) {
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return ctx;
}
var countdownTable = document.getElementById("countdown");
var canvas = document.getElementById('diagram');
var overlay = document.getElementById('overlay');
var ctx = setupCanvas(canvas);
var ctx2 = setupCanvas(overlay);
overlay.addEventListener("mousedown", handleMousedown);
function pixelToTime(x) {
    var time = maxTime - ((x - leftMargin) / timePixels);
    if (time < 0)
        return 0;
    if (time > maxTime)
        return maxTime;
    return time;
}
function pixelToSpace(y) {
    var street = Math.round(maxSpace - ((y - margin) / spacePixels));
    if (street < minSpace)
        return minSpace;
    if (street > maxSpace)
        return maxSpace;
    return street;
}
function timeToPixel(time) {
    return leftMargin + (time - minTime) * timePixels;
}
function spaceToPixel(space) {
    return margin + (maxSpace - space) * spacePixels;
}
function pointToSpaceTime(point) {
    return { time: pixelToTime(point.x), space: pixelToSpace(point.y) };
}
function spaceTimeToPoint(spaceTime) {
    return { x: timeToPixel(spaceTime.time), y: spaceToPixel(spaceTime.space) };
}
function drawLine(ctx, start, end, width, color, dashed) {
    if (color === void 0) { color = 'black'; }
    if (dashed === void 0) { dashed = false; }
    ctx.beginPath();
    var point1 = spaceTimeToPoint(start);
    var point2 = spaceTimeToPoint(end);
    ctx.moveTo(point1.x, point1.y);
    ctx.lineTo(point2.x, point2.y);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.setLineDash(dashed ? [5, 5] : []);
    ctx.stroke();
    ctx.closePath();
    ctx.setLineDash([]);
}
function fillRect(ctx, bottomRight, topLeft, color) {
    ctx.fillStyle = color;
    ctx.fillRect(timeToPixel(bottomRight.time), spaceToPixel(bottomRight.space), timeToPixel(topLeft.time) - timeToPixel(bottomRight.time), spaceToPixel(topLeft.space) - spaceToPixel(bottomRight.space));
}
function strokeRect(ctx, bottomRight, topLeft, color) {
    ctx.strokeStyle = color;
    ctx.strokeRect(timeToPixel(bottomRight.time), spaceToPixel(bottomRight.space), timeToPixel(topLeft.time) - timeToPixel(bottomRight.time), spaceToPixel(topLeft.space) - spaceToPixel(bottomRight.space));
}
function drawGrid() {
    ctx.font = "16px Avenir";
    ctx.fillStyle = 'gray';
    ctx.textAlign = 'right';
    stations.forEach(function (station) {
        var space = station.local;
        var start = { time: minTime, space: space };
        var end = { time: maxTime, space: space };
        drawLine(ctx, start, end, gridLineWidth, '#BBB');
        ctx.fillText(station.name, leftMargin - 10, spaceToPixel(space) + 5);
    });
    ctx.textAlign = 'center';
    var timeInterval = endHour - startHour < 3 ? 10 : 60;
    for (var time = minTime; time <= maxTime; time += timeInterval) {
        if (time != maxTime) {
            var start = { time: time, space: minSpace };
            var end = { time: time, space: maxSpace };
            drawLine(ctx, start, end, gridLineWidth, '#BBB');
        }
        ctx.fillText(formatTime(time), timeToPixel(time), spaceToPixel(minSpace) + 22);
    }
}
function drawGrid2() {
    // cover the lines that go out of bounds
    fillRect(ctx, { time: maxTime + 60, space: minSpace - 0.1 }, { time: maxTime, space: maxSpace + 0.1 }, 'white');
    // draw the line for maxTime
    drawLine(ctx, { time: maxTime, space: minSpace }, { time: maxTime, space: maxSpace }, gridLineWidth, '#BBB');
}
function drawOverlay(time) {
    ctx2.clearRect(0, 0, canvasWidth, canvasHeight);
    if (time < maxTime) {
        drawLine(ctx2, { time: time, space: minSpace }, { time: time, space: maxSpace }, 1, 'red');
    }
}
function drawSchedule(schedule) {
    schedule.forEach(function (mission) {
        var prevStop = null;
        mission.stops.forEach(function (stop) {
            if (prevStop != null) {
                var tunnelStart = { time: prevStop.depart.expected, space: prevStop.station.local };
                var tunnelEnd = { time: stop.arrive.expected, space: stop.station.local };
                drawLine(ctx, tunnelStart, tunnelEnd, scheduleLineWidth, '#BBB');
            }
            var start = { time: stop.arrive.expected, space: stop.station.local };
            var end = { time: stop.depart.expected, space: stop.station.local };
            drawLine(ctx, start, end, scheduleLineWidth, '#BBB');
            prevStop = stop;
        });
    });
}
function drawTrains(trains, clock) {
    trains.forEach(function (train) {
        var mission = train.mission;
        var prevStop = null;
        mission.stops.forEach(function (stop) {
            if (prevStop != null) {
                if (stop.arrive.actual && stop.arrive.actual <= clock && !stop.arrive.drawn) {
                    var tunnelStart = { time: prevStop.depart.actual, space: prevStop.station.local };
                    var tunnelEnd = { time: stop.arrive.actual, space: stop.station.local };
                    drawLine(ctx, tunnelStart, tunnelEnd, trainLineWidth, 'purple');
                    stop.arrive.drawn = true;
                    train.delay = stop.arrive.actual - stop.arrive.expected;
                }
            }
            if (stop.depart.actual && stop.depart.actual <= clock && !stop.depart.drawn) {
                var start = { time: stop.arrive.actual, space: stop.station.local };
                var end = { time: stop.depart.actual, space: stop.station.local };
                drawLine(ctx, start, end, trainLineWidth, 'purple');
                stop.depart.drawn = true;
                train.delay = stop.arrive.actual - stop.arrive.expected;
            }
            prevStop = stop;
        });
    });
}
function countdown(selectedStation, trains, clock) {
    return trains.filter(function (train) {
        return train.mission.stops.filter(function (stop) { return stop.station.id == selectedStation.id; }).length > 0;
    }).map(function (train) {
        var stop = train.mission.stops.filter(function (stop) { return stop.station.id == selectedStation.id; })[0];
        return { train: train, arrive: stop.arrive, depart: stop.depart, minutes: null };
    }).filter(function (countdown) {
        return !countdown.depart.drawn;
    }).sort(function (c1, c2) {
        var predicted1 = (c1.depart.expected + c1.train.delay);
        var predicted2 = (c2.depart.expected + c2.train.delay);
        return predicted1 - predicted2;
    }).slice(0, 4).map(function (countdown) {
        var express = countdown.train.mission.express;
        var destination = countdown.train.mission.destination.name;
        var minutes = Math.round(countdown.depart.actual - clock);
        return { express: express, destination: destination, minutes: minutes };
    });
}
function updateCountdown(data) {
    for (var i = 0; i < 4; i++) {
        var row = countdownTable.children[0].children[i];
        var bulletCell = row.children[0].children[0].children[0];
        var destinationCell = row.children[1];
        var minutesCell = row.children[2];
        if (i < data.length) {
            var countdownRow = data[i];
            bulletCell.classList.remove(countdownRow.express ? 'local' : 'express');
            bulletCell.classList.add(countdownRow.express ? 'express' : 'local');
            destinationCell.innerHTML = countdownRow.destination;
            minutesCell.innerHTML = countdownRow.minutes + " min";
        }
        else {
            bulletCell.classList.remove('local');
            bulletCell.classList.remove('express');
            destinationCell.innerHTML = "";
            minutesCell.innerHTML = "";
        }
    }
}
function handleMousedown(event) {
    var rect = canvas.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;
    var point = { x: x, y: y };
    var click = pointToSpaceTime(point);
    selectedStation = stations.sort(function (s1, s2) {
        return Math.abs(s1.local - click.space) - Math.abs(s2.local - click.space);
    })[0];
    stationPopup.value = selectedStation.id.toString();
}
function selectStation(value) {
    selectedStation = stations[value];
}
var fineRatio = 30;
var clockId = null;
function go() {
    if (clockId)
        clearInterval(clockId);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    minTime = startHour * 60;
    maxTime = endHour * 60;
    timePixels = 900 / ((endHour - startHour) * 60);
    minutesPerSecond = (endHour - startHour) * 2;
    var schedule = generateSchedule(stations, startHour, endHour);
    var trains = generateTrains(schedule);
    var clock = startHour * 60;
    var fineClock = clock * fineRatio;
    drawGrid();
    drawSchedule(schedule);
    drawGrid2();
    clockId = setInterval(function () {
        if (fineClock % fineRatio == 0) {
            clock = fineClock / fineRatio;
            drawTrains(trains, clock);
            drawGrid2();
            updateCountdown(countdown(selectedStation, trains, clock));
            if (clock > (endHour + 1) * 60) {
                clearInterval(clockId);
            }
        }
        drawOverlay(fineClock / fineRatio);
        fineClock++;
    }, 1000 / (minutesPerSecond * fineRatio));
}
go();
