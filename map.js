let iconIndex = 0;

function isNear(place) {
  return (place.distance || (place.info && place.info.endsWith("%")));
}

addStylesheets([
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css",
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"
]);

// Convert an array of place entities into the object shape this file expects:
// { [key]: place }
function placesArrayToObject(arr) {
  const out = {};
  (arr || []).forEach(p => {
    if (!p) return;
    const k = p.key || simplify(p.name || "");
    if (!k) return;
    out[k] = p;
  });
  return out;
}

// Prefer GeoJSON location over legacy coords for marker placement
function getLatLong(place) {
  // Prefer GeoJSON location: { type: "Point", coordinates: [lon, lat] }
  const loc = place && place.location;
  if (loc && loc.type === "Point" && Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
    const lon = Number(loc.coordinates[0]);
    const lat = Number(loc.coordinates[1]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return [lat, lon]; // Leaflet expects [lat, lon]
    }
  }

  // Fallback to legacy coords string: "lat, lon" (supports DMS via convertToDecimal)
  if (place && typeof place.coords === "string") {
    const parts = place.coords.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      try {
        const lat = convertToDecimal(parts[0]);
        const lon = convertToDecimal(parts[1]);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          return [lat, lon];
        }
      } catch (e) {
        // handled by caller
      }
    }
  }

  return null;
}

function getPlacesBounds(places) {
  const bounds = [];
  for (const key in places) {
    const latLong = getLatLong(places[key]);
    if (latLong) bounds.push(latLong);
  }
  return bounds;
}

// Try to reuse places data already loaded by the page renderer.
// Supported globals:
// - window.__ANDREWZC_PLACES__  (object map or array)
// - window.__ANDREWZC_PAGE_DATA__ (API payload like {"--info--":..., entities:[...]})
// - window.places (legacy)
function getPlacesFromGlobals(filename) {
  const g = window.__ANDREWZC_PLACES__ ?? window.places;
  if (g) {
    if (Array.isArray(g)) return placesArrayToObject(g);
    if (typeof g === "object") return g;
  }

  const pageData = window.__ANDREWZC_PAGE_DATA__;
  if (pageData && Array.isArray(pageData.entities)) {
    return placesArrayToObject(pageData.entities);
  }

  // Some renderers might stash per-page data in a map.
  const pagesMap = window.__ANDREWZC_PAGES__;
  if (pagesMap && pagesMap[filename] && Array.isArray(pagesMap[filename].entities)) {
    return placesArrayToObject(pagesMap[filename].entities);
  }

  return null;
}

async function loadPlaces(filename) {
  const fromGlobals = getPlacesFromGlobals(filename);
  if (fromGlobals) return fromGlobals;

  // Fallback to the legacy static JSON location
  const res = await fetch(`data/${filename}.json`);
  if (!res.ok) {
    throw new Error(`Failed to load data/${filename}.json (${res.status})`);
  }

  const json = await res.json();
  // Accept either an object-map or an array
  return Array.isArray(json) ? placesArrayToObject(json) : json;
}

loadScripts([
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js",
  "https://unpkg.com/leaflet-graticule@0.0.1/Leaflet.Graticule.js"
]).then(async () => {
  const filename = getFilename();

  try {
    const places = await loadPlaces(filename);
    showPlaces(places, filename);
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
  }
});

const markerLayers = [
    {
        key: "been",
        name: "Been",
        filter: p => p.been == true,
        tag: "markerBeen"
    },
    {
        key: "near",
        name: "Near",
        filter: p => p.been == false && isNear(p),
        tag: "markerNear"
    },
    {
        key: "todo",
        name: "Todo",
        filter: p => p.been == false && !isNear(p),
        tag: "markerTodo"
    }
];

let map;

function showPlaces(places, filename) {
    let element = document.getElementById('map');
    let lat = element.getAttribute('lat') || 37;
    let lon = element.getAttribute('lon') || -40;
    let zoom = element.getAttribute('zoom') || 3;
    let fitMode = element.getAttribute('fit') || "";
    iconIndex = Number(element.getAttribute('icon')) || 0;
  let cluster = (element.getAttribute('cluster') || "true") == "true";
  let lines = (element.getAttribute('lines') || "false") == "true";
    let maxClusterRadius = 60;
  let disableClusteringAtZoom = element.getAttribute('clusterLevel') || 8;
  let overrideClick = false;

    markerLayers.forEach(markerLayer => {
        markerLayer.group = !cluster ? L.layerGroup() : L.markerClusterGroup({
        maxClusterRadius,
        disableClusteringAtZoom,
        iconCreateFunction: function (cluster) {
          return createClusterIcon(cluster, markerLayer.key);
        }
      });
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

    map = L.map('map', {center: [lat, lon], zoom: zoom, scrollWheelZoom: false, zoomSnap: 1, wheelDebounceTime: 150, wheelPxPerZoomLevel: 2000, layers: [initialTiles, ...(markerLayers.map(l => l.group))]});
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
  map.once('mousedown touchstart', () => map.scrollWheelZoom.enable());
  
  if (lines) graticule.addTo(map);
    let overlays = { };
    markerLayers.forEach(layer => {
        overlays[layer.name] = layer.group;
    });
    overlays["Gridlines"] = graticule;
    const layerControl = L.control.layers(null, overlays).addTo(map);
  
    markerLayers.forEach(layer => {
        addMarkers(map, layer.group, places, layer.filter, layer.tag, filename);
    });

  if (fitMode === "results") {
    const points = getPlacesBounds(places);
    if (points.length > 1) {
      map.fitBounds(points, { padding: [30, 30] });
    } else if (points.length === 1) {
      map.setView(points[0], Math.max(Number(zoom) || 3, 10));
    }
  }
  
  if (filename == "route-20") {
  
        markerLayers.forEach(layer => {
            map.removeLayer(layer.group);
            
        map.on('zoomend', () => {
          if (map.getZoom() >= 8) {
            map.addLayer(layer.group);
          } else {
            map.removeLayer(layer.group);
          }
        });
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
}

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

function addMarkers(map, layer, places, test, tag, filename) {
    for (let key in places) {
      let place = places[key];
      const latLong = getLatLong(place);
      if (latLong) {
        if (!place.hide) {
          let marker = addEmojiMarker(map, place, test, tag, filename);
          if (marker) marker.addTo(layer);
        }
      } else {
        console.log(`No coordinates: ${place.name}`);
      }
  }
}

function addMarker(map, place, test, tag) {
    if (test(place)) {
        let latLong = getLatLong(place);
        if (latLong && latLong.length == 2) {
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
            console.log(`Invalid coordinates: ${place.name}, ${place.coords}`);
        }
    }
}

function addEmojiMarker(map, place, test, tag, filename) {
    if (test(place)) {
        let latLong = getLatLong(place);
        if (latLong && latLong.length === 2) {
            let text = `<a href="${place.link}" target="_blank">${place.name}</a>`;
            if (place.icons) text = place.icons.join(' ') + ' ' + text;
            if (place.prefix) text = place.prefix + "<br>" + text;
            if (place.images) text = `<img src="https://images.andrewzc.net/${filename}/tn/${place.images[0]}" width="120" style="float: left; margin: 0px 10px 10px 0px;">` + ' ' + text;
            if (place.reference) text += "<br>" + place.reference;
            if (place.info) text += "<br>" + place.info;
            if (place.caption) text += '<br><div class="mapcap">' + firstSentence(place.caption) + "</div>";
      if (place.images) text = `<div class="imagepopup">${text}</div>`;
      
            const usePageIcons = window.pageInfo && window.pageInfo.usePageIconsOnMap === true;
            let emoji = usePageIcons
              ? (place.pageIcon || "")
              : ((place.icons && place.icons.length > iconIndex) ? place.icons[iconIndex] : "");

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
            console.log(`Invalid coordinates: ${place.name}, ${place.coords}`);
        }
    }
}

function firstSentence(text) {
  if (!text) return "";
  // split on ". " but keep the period on the first part
  const match = text.match(/(.*?[.!?])(\s|$)/);
  return match ? match[1] : text;
}

function refreshMap(places) {
    markerLayers.forEach(layer => {
        layer.group.clearLayers();
        addMarkers(map, layer.group, places, layer.filter, layer.tag);
    });
}

function loadScripts(urls) {
  return urls.reduce(
    (p, url) => p.then(() => loadScript(url)),
    Promise.resolve()
  );
}

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = false;
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
  if (window.pageInfo && window.pageInfo.key) return window.pageInfo.key;
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

function simplify(value) {
  return value
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/’/g, "")
    .replace(/\./g, "")
    .replace(/,/g, "")
    .replace(/\*/g, "")
    .replace(/"/g, "")
    .replace(/</g, "")
    .replace(/>/g, "")
    .replace(/\(/g, "")
    .replace(/\)/g, "")
    .replace(/\//g, "-")
    .replace(/&/g, "-")
    .replace(/–/g, "-")
    .replace(/—/g, "-")
    .replace(/---/g, "-")
    .normalize("NFD") // decompose accents/diacritics
    .replace(/[\u0300-\u036f]/g, "") // remove diacritical marks
    .replace(/the-/, "");
}
