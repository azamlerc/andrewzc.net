document.addEventListener('mapReady', (e) => {
  var map = e.detail.map; 
  var places = Object.values(e.detail.places);
  places.sort((a, b) => a.order - b.order);
  let points = places
    .map(getLatLong)
    .filter(Boolean);
  var routeLine = L.polyline(points, {
    color: '#009900',
    weight: 4,
    opacity: 0.7
  }).addTo(map);
});