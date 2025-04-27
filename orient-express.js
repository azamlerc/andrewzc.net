const stations = {
  london: [51.4952, -0.1441],
  calais: [50.94805556, 1.85638889],
  paris: [48.87694444, 2.35916667],
  strasbourg: [48.585, 7.73444444],
  zurich: [47.37444444, 8.54111111],
  lausanne: [46.52, 6.63333333],
  "simplon-tunnel": [46.324, 8.007],
  milan: [45.48611111, 9.20361111],
  innsbruck: [47.2639, 11.4008],
  vienna: [48.208333333333336, 16.3725],
  budapest: [47.50027778, 19.08388889],
  belgrade: [44.7936, 20.4539],
  bucharest: [44.44636667, 26.07420833],
  sofia: [42.7, 23.33],
  varna: [43.19805556, 27.91222222],
  istanbul: [41.015, 28.977222],
  venice: [45.44083333, 12.32083333],
  athens: [37.99228889, 23.72055556],
  munich: [48.14083333, 11.555]
};

// Main classic Orient Express (Red line)
const orientExpressClassic = [
  stations.paris,
  stations.strasbourg,
  stations.vienna,
  stations.budapest,
  stations.belgrade,
  stations.bucharest,
  stations.varna,
  stations.istanbul
];

// Simplon-Orient Express (Green line)
const simplonOrientExpress = [
  stations.paris,
  stations.lausanne,
  stations["simplon-tunnel"],
  stations.milan,
  stations.venice,
  stations.belgrade,
  stations.sofia,
  stations.istanbul
];

// Arlberg/Venice-Simplon-Orient Express (Blue line)
const veniceSimplon = [
  stations.london,
  stations.calais,
  stations.paris,
  stations.zurich,
  stations.innsbruck,
  stations.vienna,
  stations.budapest,
  stations.belgrade,
  stations.athens
];

function animateTrain(routeCoords, map) {
  let trainIcon = L.divIcon({
    html: '<div id="train-emoji" style="font-size: 36px; line-height: 36px; text-align: center; transform:scaleX(-1);">🚂</div>',
    className: '',
    iconSize: [40, 60]
  });

  let trainMarker = L.marker(routeCoords[0], { icon: trainIcon }).addTo(map);

  const speed = 100; // km/h
  const interval = 20; // ms
  let forward = true;

  let segmentDistances = [];
  for (let i = 0; i < routeCoords.length - 1; i++) {
    segmentDistances.push(distance(routeCoords[i], routeCoords[i + 1]));
  }

  let currentIndex = 0;
  let traveled = 0;

  function distance(a, b) {
    const R = 6371;
    const dLat = (b[0] - a[0]) * Math.PI / 180;
    const dLon = (b[1] - a[1]) * Math.PI / 180;
    const lat1 = a[0] * Math.PI / 180;
    const lat2 = b[0] * Math.PI / 180;
    const aCalc = Math.sin(dLat/2)**2 + Math.sin(dLon/2)**2 * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(aCalc), Math.sqrt(1 - aCalc));
    return R * c;
  }

  function interpolate(start, end, t) {
    return [
      start[0] + (end[0] - start[0]) * t,
      start[1] + (end[1] - start[1]) * t
    ];
  }

  function moveTrain() {
    const distancePerTick = (speed * interval) / 360; // km per tick

    const nextIndex = forward ? currentIndex + 1 : currentIndex - 1;
    const segmentDistance = segmentDistances[forward ? currentIndex : nextIndex];
    traveled += distancePerTick;

    let progress = traveled / segmentDistance;
    if (progress > 1) progress = 1;

    const position = interpolate(routeCoords[currentIndex], routeCoords[nextIndex], progress);
    trainMarker.setLatLng(position);

    if (progress >= 1) {
      traveled = 0;
      currentIndex = nextIndex;

      if (currentIndex === 0 || currentIndex === routeCoords.length - 1) {
        forward = !forward; // Reverse direction

        const trainEmoji = document.getElementById('train-emoji');
        if (forward) {
          trainEmoji.style.transform = 'scaleX(-1)'; // Facing right
        } else {
          trainEmoji.style.transform = 'scaleX(1)'; // Facing left
        }
      }
    }

    setTimeout(moveTrain, interval);
  }

  moveTrain();
}

document.addEventListener('mapReady', (e) => {
  var map = e.detail.map; 
  L.polyline(orientExpressClassic, { color: 'red', weight: 3, opacity: 0.7, dashArray: '8,8' }).addTo(map);
  L.polyline(simplonOrientExpress, { color: 'green', weight: 3, opacity: 0.7, dashArray: '8,8' }).addTo(map);
  L.polyline(veniceSimplon, { color: 'blue', weight: 3, opacity: 0.7, dashArray: '8,8' }).addTo(map);
  animateTrain(orientExpressClassic, map);
});