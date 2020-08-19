let dataLabels = [];
let pressureBarogramData = [];
let gpsBarogramData = [];
let timestamp;
let myChart;
let pruningFactor;

function plotBarogramChart(igcFile) {
    getBarogramData(igcFile);
    const ctx = document.getElementById("canvas").getContext('2d');
    const config = getChartConfig();

    myChart = new Chart(ctx, config);
}

function getBarogramData(igcFile) {
    pruningFactor = getPruningFactor(igcFile.recordTime.length);
    console.log(pruningFactor)
    for (let i = 0; i < igcFile.recordTime.length; i += pruningFactor) {
        timestamp = moment(igcFile.recordTime[i]).format('HH:mm');
        dataLabels.push(timestamp);
        pressureBarogramData.push(igcFile.pressureAltitude[i] * altitudeConversionFactor);
        gpsBarogramData.push(igcFile.gpsAltitude[i] * altitudeConversionFactor);
    }
    console.log(dataLabels)
}

function getPruningFactor(recordLength) {
    return recordLength > 200 ? Math.round(recordLength / 50) : 1;
}

chartElement.onclick = function (evt) {
    const point = myChart.getElementsAtEventForMode(evt, 'point', myChart.options)[0];
    if (!point) return; // no point was focused, just the chart background was clicked
    setTimelineValue(point._index * pruningFactor, mapControl);
};

function getChartConfig() {
    return {
        type: 'line',
        data: {
            labels: dataLabels,
            datasets: [
                {
                    label: 'Pressure altitude',
                    data: pressureBarogramData,
                    fill: false,
                    steppedLine: false,
                    borderColor: '#2196f3',
                    backgroundColor: '#2196f3',
                    borderWidth: 5
                },
                {
                    label: 'GPS altitude',
                    data: gpsBarogramData,
                    fill: false,
                    steppedLine: false,
                    borderColor: 'green',
                    backgroundColor: 'green',
                    borderWidth: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            title: {
                display: true,
                text: 'Barogram Data Line Chart'
            },
            scales: {
                xAxes: [{
                    afterTickToLabelConversion: function (data) {
                        let xLabels = data.ticks;
                        xLabels.forEach(function (labels, i) {
                            if (i % 2 == 1) {
                                xLabels[i] = '';
                            }
                        });
                    }
                }]
            },
            legend: {
                display: true,
                position: 'bottom',
                labels: {
                    fontColor: 'rgb(0, 0, 0 )'
                }
            }
        }

    };
}