document.addEventListener('mapReady', (e) => {
  var map = e.detail.map; 
  var places = Object.values(e.detail.places);
  places.sort((a, b) => a.order - b.order);
  let points = places
    .filter(p => p.coords)
    .map(p => p.coords.split(',').map(s => s.trim()).map(Number));
  var routeLine = L.polyline(points, {
    color: '#009900',
    weight: 4,
    opacity: 0.7
  }).addTo(map);
});