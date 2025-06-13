let iconIndex = 0;

function isNear(place) {
  return (place.reference && place.reference.includes(" km")) || (place.info && place.info.endsWith("%"));
}

addStylesheets([
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css",
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"
]);

loadScripts([
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js",
  "https://unpkg.com/leaflet-graticule@0.0.1/Leaflet.Graticule.js"
]).then(() => {	
	let element = document.getElementById('map');
	let lat = element.getAttribute('lat') || 37;
	let lon = element.getAttribute('lon') || -40;
	let zoom = element.getAttribute('zoom') || 3;
	iconIndex = Number(element.getAttribute('icon')) || 0;
  let cluster = (element.getAttribute('cluster') || "true") == "true";
  let lines = (element.getAttribute('lines') || "false") == "true";
	let maxClusterRadius = 60;
  let disableClusteringAtZoom = 10;
  let overrideClick = false;
  let filename = getFilename();
  
	fetch(`data/${filename}.json`)
	  .then(response => response.json())
	  .then(places => {
      let been = !cluster ? L.layerGroup() : L.markerClusterGroup({
        maxClusterRadius,
        disableClusteringAtZoom,
        iconCreateFunction: function (cluster) {
          return createClusterIcon(cluster, 'been');
        }
      });

      let near = !cluster ? L.layerGroup() : L.markerClusterGroup({
        maxClusterRadius,
        disableClusteringAtZoom,
        iconCreateFunction: function (cluster) {
          return createClusterIcon(cluster, 'near');
        }
      });

      let todo = !cluster ? L.layerGroup() : L.markerClusterGroup({
        maxClusterRadius,
        disableClusteringAtZoom,
        iconCreateFunction: function (cluster) {
          return createClusterIcon(cluster, 'todo');
        }
      });
      
      const darkTiles = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {subdomains: 'abcd', maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors & CartoDB'}
      );
      const lightTiles = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}
      );
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initialTiles = prefersDark ? darkTiles : lightTiles;

			const map = L.map('map', {center: [lat, lon], zoom: zoom, layers: [initialTiles, todo, near, been]});
			const baseLayers = { 'OpenStreetMap': initialTiles };
      const graticule = L.latlngGraticule({
        showLabel: false,
        color: 'blue',
        weight: 0.5,
        opacity: 0.6,
        zoomInterval: [
          {start: 2, end: 3, interval: 30},
          {start: 4, end: 4, interval: 10},
          {start: 5, end: 10, interval: 1}
        ]
      });

      if (lines) graticule.addTo(map);
			const overlays = { 'Been': been, 'Near': near, 'Todo': todo, 'Gridlines': graticule };
			const layerControl = L.control.layers(null, overlays).addTo(map);
      
    	addMarkers(map, been, places, place => place.been == true && !isNear(place), "markerBeen");
    	addMarkers(map, near, places, place => isNear(place), "markerNear");
    	addMarkers(map, todo, places, place => place.been == false && !isNear(place), "markerTodo");
      
      if (filename == "route-20") {
        map.removeLayer(been);
        map.removeLayer(near);
        map.removeLayer(todo);

        map.on('zoomend', () => {
          if (map.getZoom() >= 8) {
            map.addLayer(been);
            map.addLayer(near);
            map.addLayer(todo);
          } else {
            map.removeLayer(been);
            map.removeLayer(near);
            map.removeLayer(todo);
          }
        });
      }
      
      if (overrideClick) {
        been.on('clusterclick', function (a) {
          const currentZoom = map.getZoom();
          map.setView(a.latlng, currentZoom + 1);
        });

        todo.on('clusterclick', function (a) {
          const currentZoom = map.getZoom();
          map.setView(a.latlng, currentZoom  + 1);
        });
      }
      
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        const isDark = e.matches;
        if (isDark) {
          map.removeLayer(lightTiles);
          map.addLayer(darkTiles);
        } else {
          map.removeLayer(darkTiles);
          map.addLayer(lightTiles);
        }
      });
            
      var event = new CustomEvent('mapReady', { detail: { map, places } });
      document.dispatchEvent(event);
      console.log('Map ready');
		})
	  .catch(error => {
	    console.error('Error loading JSON:', error);
	  });
});

function createClusterIcon(cluster, type) {
  const count = cluster.getChildCount();

  let className = 'marker-cluster';
  if (type === 'been') className += ' marker-cluster-been';
  if (type === 'near') className += ' marker-cluster-near';
  if (type === 'todo') className += ' marker-cluster-todo';

  return L.divIcon({
    html: `<div><span>${count}</span></div>`,
    className: className,
    iconSize: L.point(40, 40)
  });
}

function addMarkers(map, layer, places, test, tag) {
	for (let key in places) {
  	let place = places[key];
		if (place.coords) {
			let marker = addEmojiMarker(map, place, test, tag);
			if (marker) marker.addTo(layer);
		} else {
			console.log(`No coordinates: ${place.name}`);
		}
  }
}

function addMarker(map, place, test, tag) {
	if (test(place)) {
		let latLong = place.coords.split(',').map(s => convertToDecimal(s));
		if (latLong.length == 2) {
			let text = `<a href="${place.link}" target="_blank">${place.name}</a>`;
			if (place.icons) text = place.icons.join(' ') + ' ' + text;
			if (place.prefix) text = place.prefix + "<br>" + text;
			if (place.reference) text += "<br>" + place.reference;
			if (place.info) text += "<br>" + place.info;
			let marker = L.marker(latLong).addTo(map).bindPopup(text);
			marker._icon.classList.add(tag);
			if (place.strike) marker._icon.classList.add("markerStrike");
			return marker;
		} else {
			console.log(`Invalid coordinates: ${place.name}, ${place.coord}`);
		}
	}
}

function addEmojiMarker(map, place, test, tag) {
	if (test(place)) {
		let latLong = place.coords.split(',').map(s => convertToDecimal(s));
		if (latLong.length === 2) {
			let text = `<a href="${place.link}" target="_blank">${place.name}</a>`;
			if (place.icons) text = place.icons.join(' ') + ' ' + text;
			if (place.prefix) text = place.prefix + "<br>" + text;
			if (place.reference) text += "<br>" + place.reference;
			if (place.info) text += "<br>" + place.info;

			let emoji = (place.icons && place.icons.length > iconIndex) ? place.icons[iconIndex] : "";

			let marker = L.marker(latLong, {
				icon: L.divIcon({
					className: `emoji-pin ${tag} ${place.strike ? 'markerStrike' : ''}`,
					html: `<div class="pin-emoji ${tag}">${emoji}</div>`,
					iconSize: [25, 41], // Size of default Leaflet pin
					iconAnchor: [12, 41], // Bottom center point
					popupAnchor: [0, -30]
				})
			})
      
      marker.bindPopup(text);
			return marker;
		} else {
			console.log(`Invalid coordinates: ${place.name}, ${place.coord}`);
		}
	}
}

function loadScripts(urls) {
  return Promise.all(urls.map(loadScript));
}

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
    document.head.appendChild(script);
  });
}

function addStylesheets(urls) {
  urls.forEach(url => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
  });
}

function getFilename() {
  return window.location.pathname.split('/').pop().split('.')[0];
}

function convertToDecimal(coord) {
  const regex = /(\d{1,3})°(\d{1,2})′(\d{1,2}(?:\.\d+)?)″([NSWE])|(\d{1,3})°(\d{1,2}(?:\.\d+)?)′([NSWE])|(\d{1,3})°([NSWE])|([+-]?\d*\.?\d+)(°?\s?)([NSWE]?)/;

  const match = coord.match(regex);

  if (!match) {
    throw new Error("Invalid coordinate format: " + coord);
  }

  let decimalDegrees = 0;
  let degrees = 0, minutes = 0, seconds = 0, direction;

  if (match[1] && match[2] && match[3]) {
    degrees = parseInt(match[1], 10);
    minutes = parseInt(match[2], 10);
    seconds = parseFloat(match[3]);
    direction = match[4];
  } else if (match[5] && match[6]) {
    degrees = parseInt(match[5], 10);
    minutes = parseFloat(match[6]);
    direction = match[7];
  } else if (match[8]) {
    degrees = parseInt(match[8], 10);
    direction = match[9];
  } else if (match[10]) {
    decimalDegrees = parseFloat(match[10]);

    if (match[12]) {
      direction = match[12];
      if (direction === 'W' || direction === 'S') {
        decimalDegrees = -decimalDegrees;
      }
    }

    return decimalDegrees;
  }

  decimalDegrees = degrees + (minutes / 60) + (seconds / 3600);

  if (direction === 'S' || direction === 'W') {
    decimalDegrees = -decimalDegrees;
  }

  return decimalDegrees;
}

