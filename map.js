addStylesheet("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
loadScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js", () => {
	
	let element = document.getElementById('map');
	let lat = element.getAttribute('lat') || 37;
	let lon = element.getAttribute('lon') || -40;
	let zoom = element.getAttribute('zoom') || 3;
	
	fetch(`data/${getFilename()}.json`)
	  .then(response => response.json())
	  .then(places => {
    	let todo = L.layerGroup();
    	let been = L.layerGroup();

			const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19,
				attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
			});
			const map = L.map('map', {center: [lat, lon], zoom: zoom, layers: [osm, todo, been]});
			const baseLayers = { 'OpenStreetMap': osm };
			const overlays = { 'Todo': todo, 'Been': been};
			const layerControl = L.control.layers(null, overlays).addTo(map);

    	addMarkers(map, todo, places, place => place.been == false, "markerTodo");
    	addMarkers(map, been, places, place => place.been == true, "markerBeen");
		})
	  .catch(error => {
	    console.error('Error loading JSON:', error);
	  });
});

function addMarkers(map, layer, places, test, tag) {
	for (let key in places) {
  	let place = places[key];
		if (place.coords) {
			let marker = addMarker(map, place, test, tag);
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

function addStylesheet(url) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}

function loadScript(url, callback) {
  const script = document.createElement('script');
  script.src = url;
  script.type = 'text/javascript';
  script.async = true;  // Optional: makes sure the script is loaded asynchronously

  // If provided, execute the callback once the script is loaded
  script.onload = () => {
    if (callback) callback();
  };

  // Handle errors loading the script
  script.onerror = (error) => {
    console.error(`Error loading script: ${url}`, error);
  };

  document.head.appendChild(script);
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

