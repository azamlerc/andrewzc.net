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
  let filename = getFilename();
	fetch(`data/${filename}.json`)
	  .then(response => response.json())
	  .then(places => {
			enhancePage(places, filename);
			replaceFlagsWithLinks();
			showPlaces(places, filename);
		})
	  .catch(error => {
	    console.error('Error loading JSON:', error);
	  });
});

const markerLayers = [
	{
		key: "been",
		name: "Been",
		filter: p => p.been == true && !isNear(p),
		tag: "markerBeen"
	},
	{
		key: "near",
		name: "Near",
		filter: p => isNear(p),
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

function enhancePage(places, pageName) {
  // --- PASS 1: collect insertion anchors from the unmodified DOM ---
  const ops = [];

  document.querySelectorAll(".items a").forEach(a => {
    const key = simplify(a.textContent.trim());
    const entry = places[key];

    if (!entry) return;

    // find the <br> that ends THIS line
    let br = a.nextSibling;
    while (br && br.nodeName !== "BR") br = br.nextSibling;
    if (!br) return; // should not happen per your format

    // find the first node of THIS line in the original DOM
    // walk backwards to the previous <br>, then take the next sibling;
    // if none, the line starts at the container's firstChild
    let prev = a.previousSibling;
    while (prev && prev.nodeName !== "BR") prev = prev.previousSibling;
    const lineStart = prev ? prev.nextSibling : a.parentNode.firstChild;

    ops.push({ entry, lineStart, br, a });
  });

  // --- PASS 2: perform inserts based on stored anchors ---
  ops.forEach(({ entry, lineStart, br, a }) => {
    const parent = a.parentNode;

    if (Array.isArray(entry.images) && entry.images.length) {
      const imagesDiv = document.createElement("div");
      imagesDiv.className = "images";
      entry.images.forEach(fname => {
        const full = `https://images.andrewzc.net/${pageName}/${fname}`;
        const tn   = `https://images.andrewzc.net/${pageName}/tn/${fname}`;
        const link = document.createElement("a");
        link.href = full; link.target = "_blank"; link.rel = "noopener";
        const img = document.createElement("img");
        img.src = tn; img.alt = entry.name || a.textContent.trim();
        link.appendChild(img);
        imagesDiv.appendChild(link);
      });
      parent.insertBefore(imagesDiv, lineStart);   // above THIS line only
    }

    if (entry.caption) {
      const cap = document.createElement("div");
      cap.className = "caption";
      cap.textContent = entry.caption;
      parent.insertBefore(cap, br.nextSibling);    // below THIS line only
      highlightDistances(cap);
    }
  });
}

function highlightDistances(el) {
  const escapeHTML = s =>
    s.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  const DIST_RE = /\b(?:\d+(?:[.,]\d+)?\skm|\d+m|exact)\b/gi;

  const text = el.textContent;
  const escaped = escapeHTML(text);

  // Find all matches
  const matches = [...escaped.matchAll(DIST_RE)];
  if (matches.length === 0) {
    return;
  }

  const lastMatch = matches[matches.length - 1];

  // Replace only the last one
  const highlighted =
    escaped.slice(0, lastMatch.index) +
    `<span class="dark">${lastMatch[0]}</span>` +
    escaped.slice(lastMatch.index + lastMatch[0].length);

  el.innerHTML = highlighted;
}

function showPlaces(places, filename) {
	let element = document.getElementById('map');
	let lat = element.getAttribute('lat') || 37;
	let lon = element.getAttribute('lon') || -40;
	let zoom = element.getAttribute('zoom') || 3;
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

	map = L.map('map', {center: [lat, lon], zoom: zoom, layers: [initialTiles, ...(markerLayers.map(l => l.group))]});
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
	let overlays = { };
	markerLayers.forEach(layer => {
		overlays[layer.name] = layer.group;
	});
	overlays["Gridlines"] = graticule;
	const layerControl = L.control.layers(null, overlays).addTo(map);
  
	markerLayers.forEach(layer => {
		addMarkers(map, layer.group, places, layer.filter, layer.tag, filename);
	});
  
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
		if (place.coords) {
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

function addEmojiMarker(map, place, test, tag, filename) {
	if (test(place)) {
		let latLong = place.coords.split(',').map(s => convertToDecimal(s));
		if (latLong.length === 2) {
			let text = `<a href="${place.link}" target="_blank">${place.name}</a>`;
			if (place.icons) text = place.icons.join(' ') + ' ' + text;
			if (place.prefix) text = place.prefix + "<br>" + text;
			if (place.images) text = `<img src="https://images.andrewzc.net/${filename}/tn/${place.images[0]}" width="120" style="float: left; margin: 0px 10px 10px 0px;">` + ' ' + text;
			if (place.reference) text += "<br>" + place.reference;
			if (place.info) text += "<br>" + place.info;
			if (place.caption) text += '<br><div class="mapcap">' + firstSentence(place.caption) + "</div>";
      if (place.images) text = `<div class="imagepopup">${text}</div>`;
      
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
    .normalize("NFD") // decompose accents/diacritics
    .replace(/[\u0300-\u036f]/g, "") // remove diacritical marks
    .replace(/the-/, "");
}

// Create a JavaScript object where the keys are the two letter country codes 
// for every country and the values are the name of the country in lowercase 
// with spaces replaced by hyphens
const countryCodes = {
    "ad": "andorra",
    "ae": "united-arab-emirates",
    "af": "afghanistan",
    "ag": "antigua-and-barbuda",
    "ai": "anguilla",
    "al": "albania",
    "am": "armenia",
    "ao": "angola",
    "aq": "antarctica",
    "ar": "argentina",
    "as": "american-samoa",
    "at": "austria",
    "au": "australia",
    "aw": "aruba",
    "ax": "aland",
    "az": "azerbaijan",
    "ba": "bosnia-and-herzegovina",
    "bb": "barbados",
    "bd": "bangladesh",
    "be": "belgium",
    "bf": "burkina-faso",
    "bg": "bulgaria",
    "bh": "bahrain",
    "bi": "burundi",
    "bj": "benin",
    "bl": "saint-barthelemy",
    "bm": "bermuda",
    "bn": "brunei",
    "bo": "bolivia",
    "bq": "bonaire",
    "br": "brazil",
    "bs": "bahamas",
    "bt": "bhutan",
    "bw": "botswana",
    "by": "belarus",
    "bz": "belize",
    "ca": "canada",
    "cc": "cocos-islands",
    "cd": "congo-kinshasa",
    "cf": "central-african-republic",
    "cg": "congo-brazzaville",
    "ch": "switzerland",
    "ci": "cote-divoire",
    "ck": "cook-islands",
    "cl": "chile",
    "cm": "cameroon",
    "cn": "china",
    "co": "colombia",
    "cr": "costa-rica",
    "cu": "cuba",
    "cv": "cape-verde",
    "cw": "curacao",
    "cx": "christmas-island",
    "cy": "cyprus",
    "cz": "czechia",
    "de": "germany",
    "dj": "djibouti",
    "dk": "denmark",
    "dm": "dominica",
    "do": "dominican-republic",
    "dz": "algeria",
    "ec": "ecuador",
    "ee": "estonia",
    "eg": "egypt",
    "eh": "western-sahara",
    "er": "eritrea",
    "es": "spain",
    "et": "ethiopia",
    "fi": "finland",
    "fj": "fiji",
    "fk": "falklands",
    "fm": "micronesia",
    "fo": "faroe-islands",
    "fr": "france",
    "ga": "gabon",
    "gb": "united-kingdom",
    "gd": "grenada",
    "ge": "georgia",
    "gf": "french-guiana",
    "gg": "guernsey",
    "gh": "ghana",
    "gi": "gibraltar",
    "gl": "greenland",
    "gm": "gambia",
    "gn": "guinea",
    "gp": "guadeloupe",
    "gq": "equatorial-guinea",
    "gr": "greece",
    "gs": "south-georgia",
    "gt": "guatemala",
    "gu": "guam",
    "gw": "guinea-bissau",
    "gy": "guyana",
    "hk": "hong-kong",
    "hm": "heard-island-and-mcdonald-islands",
    "hn": "honduras",
    "hr": "croatia",
    "ht": "haiti",
    "hu": "hungary",
    "id": "indonesia",
    "ie": "ireland",
    "il": "israel",
    "im": "isle-of-man",
    "in": "india",
    "io": "british-indian-ocean-territory",
    "iq": "iraq",
    "ir": "iran",
    "is": "iceland",
    "it": "italy",
    "je": "jersey",
    "jm": "jamaica",
    "jo": "jordan",
    "jp": "japan",
    "ke": "kenya",
    "kg": "kyrgyzstan",
    "kh": "cambodia",
    "ki": "kiribati",
    "km": "comoros",
    "kn": "saint-kitts-and-nevis",
    "kp": "north-korea",
    "kr": "south-korea",
    "kw": "kuwait",
    "ky": "cayman-islands",
    "kz": "kazakhstan",
    "la": "laos",
    "lb": "lebanon",
    "lc": "saint-lucia",
    "li": "liechtenstein",
    "lk": "sri-lanka",
    "lr": "liberia",
    "ls": "lesotho",
    "lt": "lithuania",
    "lu": "luxembourg",
    "lv": "latvia",
    "ly": "libya",
    "ma": "morocco",
    "mc": "monaco",
    "md": "moldova",
    "me": "montenegro",
    "mf": "saint-martin",
    "mg": "madagascar",
    "mh": "marshall-islands",
    "mk": "north-macedonia",
    "ml": "mali",
    "mm": "myanmar",
    "mn": "mongolia",
    "mo": "macau",
    "mp": "northern-mariana-islands",
    "mq": "martinique",
    "mr": "mauritania",
    "ms": "montserrat",
    "mt": "malta",
    "mu": "mauritius",
    "mv": "maldives",
    "mw": "malawi",
    "mx": "mexico",
    "my": "malaysia",
    "mz": "mozambique",
    "na": "namibia",
    "nc": "new-caledonia",
    "ne": "niger",
    "nf": "norfolk-island",
    "ng": "nigeria",
    "ni": "nicaragua",
    "nl": "netherlands",
    "no": "norway",
    "np": "nepal",
    "nr": "nauru",
    "nu": "niue",
    "nz": "new-zealand",
    "om": "oman",
    "pa": "panama",
    "pe": "peru",
    "pf": "french-polynesia",
    "pg": "papua-new-guinea",
    "ph": "philippines",
    "pk": "pakistan",
    "pl": "poland",
    "pm": "saint-pierre-and-miquelon",
    "pn": "pitcairn-islands",
    "pr": "puerto-rico",
    "ps": "palestine",
    "pt": "portugal",
    "pw": "palau",
    "py": "paraguay",
    "qa": "qatar",
    "re": "reunion",
    "ro": "romania",
    "rs": "serbia",
    "ru": "russia",
    "rw": "rwanda",
    "sa": "saudi-arabia",
    "sb": "solomon-islands",
    "sc": "seychelles",
    "sd": "sudan",
    "se": "sweden",
    "sg": "singapore",
    "sh": "saint-helena",
    "si": "slovenia",
    "sj": "svalbard",
    "sk": "slovakia",
    "sl": "sierra-leone",
    "sm": "san-marino",
    "sn": "senegal",
    "so": "somalia",
    "sr": "suriname",
    "ss": "south-sudan",
    "st": "sao-tome-and-principe",
    "sv": "el-salvador",
    "sx": "sint-maarten",
    "sy": "syria",
    "sz": "eswatini",
    "tc": "turks-and-caicos",
    "td": "chad",
    "tf": "french-southern-territories",
    "tg": "togo",
    "th": "thailand",
    "tj": "tajikistan",
    "tk": "tokelau",
    "tl": "east-timor",
    "tm": "turkmenistan",
    "tn": "tunisia",
    "to": "tonga",
    "tr": "turkey",
    "tt": "trinidad-and-tobago",
    "tv": "tuvalu",
    "tw": "taiwan",
    "tz": "tanzania",
    "ua": "ukraine",
    "ug": "uganda",
    "us": "united-states",
    "uy": "uruguay",
    "uz": "uzbekistan",
    "va": "vatican-city",
    "vc": "saint-vincent-and-the-grenadines",
    "ve": "venezuela",
    "vg": "virgin-islands",
    "vi": "u.s.-virgin-islands",
    "vn": "vietnam",
    "vu": "vanuatu",
    "wf": "wallis-and-futuna",
    "ws": "samoa",
    "xk": "kosovo",
    "ye": "yemen",
    "yt": "mayotte",
    "za": "south-africa",
    "zm": "zambia",
    "zw": "zimbabwe"
};

const filename = window.location.href.split('/').slice(-1)[0].split('.')[0];

function replaceFlagsWithLinks() {
    // Regional Indicator Symbol range: U+1F1E6 to U+1F1FF
    const flagPattern = /([\uD83C][\uDDE6-\uDDFF])([\uD83C][\uDDE6-\uDDFF])/g;

    const newContent = document.body.innerHTML.replace(flagPattern, function(match, p1, p2) {
        // Extract the country code from the matched flag, for example: "US" for 🇺🇸
        const countryCode = String.fromCodePoint(p1.codePointAt(0) - 0x1F1E6 + 'A'.codePointAt(0))
                          + String.fromCodePoint(p2.codePointAt(0) - 0x1F1E6 + 'A'.codePointAt(0));
      
        return `<a class="flag" href="countries/${countryCodes[countryCode.toLowerCase()] || 'united-states'}.html#${filename}">${match}</a>`;
    });
  
    document.body.innerHTML = newContent;
}
