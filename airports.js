// airports.js
// Draws great-circle flight lines between airports on the /airports map.
//
// Loaded automatically once the "airports" page has "script": "airports.js" set
// in its page metadata — same mechanism confluence.js and swimming.js already use
// (see page.js's "Optional per-page script" block, which calls
// ensureScript(listInfo.script) after rendering the list). No <script> tag needs
// to be added to page.html; the page metadata lives in the API/DB, not this repo,
// so that field has to be set from the admin/edit UI (data/pages.json here is
// just a legacy export and isn't read at runtime).
//
// Uses the Leaflet.Geodesic plugin so routes follow the actual great-circle path
// a plane would fly, instead of a straight line in Mercator space, and so
// routes crossing the antimeridian split cleanly instead of streaking across
// the whole map. https://github.com/henrythasler/Leaflet.Geodesic

// Each pair is [origin IATA code, destination IATA code]; direction doesn't
// matter for rendering. Sorted alphabetically within each pair, then the whole
// list sorted alphabetically, with duplicates (round trips, multi-leg repeats)
// collapsed to one entry.
//
// Parsed from a manually curated list of every airport visited and its known
// connections. A few entries were left out entirely rather than guessed:
// airports only ever marked "XXX" (physically visited on the ground, but no
// flight connection remembered at all) have no pair to draw yet —
// BIO, BMA, BOD, BUF, BVE, CAS, DBV, DSS, EAS, HAJ, HYA, ILG, ISP, KLE, LBE,
// LTQ, LYN, MCO, PVC, PWM, THF, TLL, VIT, VNO.
// Entries marked "???" (flew through, but the other end is forgotten) are
// commented out below rather than dropped, so they're easy to find and fill
// in later once/if the connection is remembered.
const AIRPORT_ROUTES = [
  ["ABJ", "DSS"],
  ["ABJ", "KGL"],
  ["ABQ", "DEN"],
  ["ABQ", "DFW"],
  ["ABQ", "PHI"],
  ["ABQ", "SLC"],
  ["ABQ", "STL"],
  ["ADD", "IAD"],
  ["AMS", "ARN"],
  ["AMS", "BUD"],
  ["AMS", "HND"],
  ["AMS", "JFK"],
  ["AMS", "LBA"],
  ["AMS", "PRG"],
  ["AMS", "SVO"],
  ["AMS", "TXL"],
  ["AMS", "VCE"],
  ["ARN", "BRU"],
  ["ARN", "CRL"],
  ["ARN", "HAM"],
  ["ARN", "OSL"],
  ["ARN", "RIX"],
  ["ATL", "IAD"],
  ["BCN", "CRL"],
  ["BCN", "JFK"],
  ["BEG", "BUD"],
  ["BER", "JFK"],
  ["BFI", "ESD"],
  ["BKK", "CDG"],
  ["BKO", "ORY"],
  ["BKO", "OUA"],
  ["BLR", "CDG"],
  ["BLR", "DXB"],
  ["BLR", "LHR"],
  ["BLR", "SIN"],
  ["BUD", "STN"],
  ["MDE", "SJO"],
  ["BOG", "EOH"],
  ["BOI", "SFO"],
  // ["BOS", "???"], // flew through, don't remember the other end
  ["BRU", "CPH"],
  ["BRU", "IST"],
  ["BRU", "JFK"],
  ["BRU", "RAK"],
  // ["BTS", "???"], // flew through, don't remember the other end
  // ["BVA", "???"], // flew through, don't remember the other end
  ["BWI", "SFO"],
  ["CAI", "EBB"],
  ["CAI", "JFK"],
  ["CDG", "FCO"],
  ["CDG", "FUK"],
  ["CDG", "JFK"],
  ["CDG", "KEF"],
  ["CDG", "LOS"],
  ["CDG", "MAD"],
  ["CDG", "NCE"],
  ["CDG", "NRT"],
  ["CDG", "OPO"],
  ["CDG", "OUA"],
  ["CDG", "SIN"],
  ["CDG", "TLV"],
  ["CDG", "WAW"],
  ["CFE", "ORY"],
  ["CHI", "IAD"],
  ["CMN", "ORY"],
  ["COO", "KGL"],
  ["COO", "OUA"],
  ["CPH", "OSL"],
  ["CRL", "WMI"],
  ["CTA", "LTN"],
  ["CTG", "BOG"],
  ["CTG", "SDQ"],
  ["CTS", "NRT"],
  ["DAB", "LGA"],
  ["DCA", "DEN"],
  ["DCA", "DFW"],
  ["DCA", "MDW"],
  ["DCA", "MOB"],
  ["DCA", "SFO"],
  ["DCA", "SJC"],
  ["DCA", "SLC"],
  ["DSS", "JFK"],
  ["DSS", "MAD"],
  ["DSS", "NBO"],
  ["DSS", "ORY"],
  ["DSS", "OUA"],
  ["DSS", "RAI"],
  ["DLY", "VLI"],
  ["DXB", "JFK"],
  ["EBB", "KGL"],
  // ["EIN", "???"], // flew through, don't remember the other end
  ["EWR", "KEF"],
  ["EWR", "ORY"],
  ["EWR", "YTZ"],
  ["FLL", "JFK"],
  ["FRA", "IAD"],
  ["FRA", "SVO"],
  ["FTA", "VLI"],
  // ["GVA", "???"], // flew through, don't remember the other end
  ["HKG", "LAX"],
  ["IAD", "LGA"],
  ["IAD", "OAK"],
  ["IAD", "SFO"],
  ["IAD", "STL"],
  ["ICN", "SVO"],
  ["IST", "KGL"],
  ["JFK", "KEF"],
  ["JFK", "LAS"],
  ["JFK", "LGW"],
  ["JFK", "LHR"],
  ["JFK", "LIS"],
  ["JFK", "MEX"],
  ["JFK", "MIA"],
  ["JFK", "PDX"],
  ["JFK", "PIT"],
  ["JFK", "PUJ"],
  ["JFK", "SFO"],
  ["KEF", "LHR"],
  ["KEF", "OSL"],
  ["KGL", "NBO"],
  ["LAS", "SFO"],
  ["LAU", "WIL"],
  ["LAX", "NOU"],
  ["LAX", "SFO"],
  // ["LCY", "???"], // flew through, don't remember the other end
  ["LGA", "ROC"],
  ["LIS", "VXE"],
  ["LPY", "ORY"],
  ["LTN", "PMO"],
  // ["LUX", "???"], // flew through, don't remember the other end
  ["LYS", "LIS"],
  // ["MAN", "???"], // flew through, don't remember the other end
  ["MEX", "SJO"],
  ["MMH", "PAO"],
  ["MPP", "PTY"],
  ["NOU", "VLI"],
  // ["ONT", "???"], // flew through, don't remember the other end
  ["ORY", "SOU"],
  ["OSL", "RIX"],
  ["PHI", "SFO"],
  // ["PHL", "???"], // flew through, don't remember the other end
  ["PTY", "PYV"],
  ["PTY", "SJO"],
  ["RAI", "VXE"],
  // ["RTM", "???"], // flew through, don't remember the other end
  ["SAN", "SJC"],
  ["SEA", "SFO"],
  ["SFO", "SJO"],
  ["SFO", "YYC"],
  ["TAH", "VLI"],
  ["YTZ", "YUL"],
];

document.addEventListener('mapReady', async (e) => {
  const map = e.detail.map;
  const places = e.detail.places || {};

  // Index airports by their 3-letter code (place.prefix) — the same field the
  // page itself calls out ("The prefix is the three-letter airport code").
  const byCode = {};
  for (const key in places) {
    const place = places[key];
    const code = place && place.prefix && String(place.prefix).trim().toUpperCase();
    if (code) byCode[code] = place;
  }

  try {
    await loadScript("https://unpkg.com/leaflet.geodesic@2.7.2/dist/leaflet.geodesic.umd.min.js");
  } catch (err) {
    console.error("airports.js: failed to load Leaflet.Geodesic", err);
    return;
  }

  const missing = new Set();
  const lines = [];

  AIRPORT_ROUTES.forEach(([fromCode, toCode]) => {
    const from = byCode[String(fromCode).toUpperCase()];
    const to = byCode[String(toCode).toUpperCase()];
    if (!from) missing.add(fromCode);
    if (!to) missing.add(toCode);
    if (!from || !to) return;

    // getLatLong() is defined globally by map.js (GeoJSON location, falling
    // back to the legacy "lat, lon" coords string) — reuse it instead of
    // re-parsing coordinates here.
    const fromLatLng = getLatLong(from);
    const toLatLng = getLatLong(to);
    if (!fromLatLng || !toLatLng) return;

    lines.push([fromLatLng, toLatLng]);
  });

  if (missing.size) {
    console.warn(`airports.js: no airport found for code(s): ${[...missing].join(", ")}`);
  }

  if (lines.length) {
    // A single Geodesic instance can hold every route as a MultiLineString-style
    // array of [from, to] pairs, so we only need to add one layer to the map.
    L.geodesic(lines, {
      wrap: true,   // Split at the antimeridian rather than drawing off the edge.
                    // This map is a fixed, non-panning world view (not a scrolling
                    // globe), so a continuous "wrap: false" line crossing 180°
                    // would just run off-screen and never reappear. Flip this to
                    // false only if the map is changed to allow panning/repeating
                    // world copies and a single unbroken curve is preferred.
      steps: 4,
      color: '#4169e1',
      weight: 2.0,
      opacity: 0.75
    }).addTo(map);
  }
});
