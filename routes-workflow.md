# Routes workflow

## Page route configuration

Route selection lives in the page document's **top-level routes** field, separate
from the Leaflet view settings in map. Once the shared frontend/API changes are
deployed, adding routes to another mapped page needs only database changes.

For a trip, tag route documents with trips: ["my-trip"] and configure the page:

```json
{
  "key": "my-trip",
  "map": { "lat": "45", "lon": "10", "zoom": "5" },
  "routes": { "trip": "my-trip" }
}
```

Filters mode, trip and country can be combined (all must match). Examples:

```json
{ "routes": { "mode": "bus" } }
{ "routes": { "mode": "car", "trip": "my-road-trip" } }
{ "routes": { "mode": "metro", "trip": "mexico-city", "style": { "lineType": "solid", "weight": 6 } } }
```

Omit routes on an ordinary page to show no route layer. Set routes to false to
disable it explicitly, including on trip/country result pages. An empty object
explicitly selects all routes; avoid it unless that is intended. Filters must be
nonempty strings. Unknown filters or malformed settings are rejected rather than
accidentally loading every route. Page configuration does not infer journeys from
station visits or create route documents automatically.

map.js reads window.pageInfo.routes when the map is ready and loads map-routes.js
only when needed. The shared layer requests GET /routes with the filters, resolves
canonical {list,key} stops and inline GeoJSON points, and draws the ordered line.
It works whether the route renderer loads before or after map initialization.
Standalone map fetches retain the returned page information as well. No per-page
route script is required. Genuine custom scripts may still use page.script.

Trip result pages default to {trip: tripKey}; country result pages default to
{country: code}. Their top-level routes settings can override or disable these
defaults. The shared loader handles both; trip.js and country.js remain responsible
for rendering their pages.

## Transport modes and styling

- air: flights, normally using great-circle paths.
- train: mainline trains, dashed by default.
- metro: metro systems; route/page styling can specify solid colored lines.
- bus: buses, dotted by default.
- car: road trips, solid by default.
- sea: ferries; their page supplies dashed defaults.

The redundant rail and road modes have been removed: classify railway journeys as
train or metro, and road journeys as bus or car. All ten existing road journeys were
confirmed buses and migrated to bus on 10 November 2026, preserving dotted styling.
Tirana–Pristina is explicitly confirmed as bus. Bus Stations has a world map and
routes: {mode: "bus"}. The API rejects modes rail and road after deployment.

Optional routes.style supplies page defaults for lineType (solid, dashed, dotted),
weight and color. A route's own style overrides these. Existing been true/false
colors and route tooltips are preserved. Keep styling in route records when it is
specific to one journey or transit line. map.lines still means gridlines, not routes.

## Route-only script inventory and deployment transition

| Page | Current compatibility script | Top-level routes configuration |
| --- | --- | --- |
| Airports | airports.js | {mode: "air"} |
| Ferries | ferries.js | {mode: "sea", style: {lineType: "dashed"}} |
| Train Stations | train-stations.js | {mode: "train", style: {lineType: "dashed"}} |
| Mexico City | mexico-city.js | {mode: "metro", trip: "mexico-city", style: {lineType: "solid", weight: 6}} |
| Stopovers | stopovers.js | {mode: "air", trip: "stopovers"} |
| Qibla | qibla.js | {trip: "qibla"} |
| Bus Stations | None needed | {mode: "bus"} |

The six existing page records now have their top-level routes settings. Their
script fields and route-only files are temporarily retained so the current live
frontend keeps drawing routes before deployment. Deploy the frontend changes and
API bus/car validation first. Then verify the six pages and Bus Stations, unset
only those six page.script fields, verify data-driven loading without the wrappers,
and delete their six files (and the obsolete stopovers wrapper test). Keep map.js,
map-routes.js, trip.js and country.js. Scripts for transit statistics and other
non-route features are unrelated and remain.

## Route records

Insert route documents directly into routes, for example:

```json
{
  "key": "my-train-journey",
  "name": "Origin–Destination",
  "mode": "train",
  "been": true,
  "country": "FR",
  "trips": ["my-trip"],
  "path": { "kind": "straight" },
  "stops": [
    { "list": "train-stations", "key": "origin" },
    { "name": "Geometry waypoint", "country": "FR", "location": { "type": "Point", "coordinates": [2, 48] } },
    { "list": "train-stations", "key": "destination" }
  ]
}
```

stops must follow travel order. GeoJSON is longitude, latitude. Verify every
canonical reference resolves and every point has coordinates: an incomplete route
is skipped rather than drawing across a missing stop. Use schematic verified
waypoints for bends, not an invented timetable or station visits. Do not create new
station entities or change station been flags merely to draw a passed-through point.
Use straight paths for ordinary lines or great-circle for flights.

Verify the saved records, API selection and shared renderer after additions. New
pages require an existing map configuration plus top-level routes; no new script,
HTML page or migration framework is needed.

## Ferries

The Ferries page (top-level routes mode sea) shows every `mode: "sea"` route with dashed
straight lines. Each `ferries` entity is a single port/terminal: its `been`
means Andrew visited the terminal, while the route’s `been` means he took
that ferry (a “been to one port” line is a been port, a not-been port, and a
not-been route). Terminals close enough to act as one complex share an entity,
so one port can sit on several routes (South Ferry → Staten Island and
Governors Island; Dover → Calais and Dunkirk). The page, entities and routes
were created directly in MongoDB (2026-10-28); correct positions by editing
the `ferries` entities' `location`.

## Qibla

`qibla` is a database page with top-level `routes: {trip: "qibla"}`. Its only entity is
`qibla/mecca`, at the Kaaba, with `been: false` and `strike: false`.
Inaccessibility is described in `info`; it does not mean the place no longer qualifies.
The page selects `trip=qibla` routes. Each route stores its example origin as
`{ name, location: { type: "Point", coordinates: [longitude, latitude] } }`
and references `qibla/mecca` as its destination. The shared renderer accepts
inline GeoJSON stops as well as canonical entity references. This keeps example
origins out of personal visit lists and marker layers. Routes have no `been`
field; gold styling lives in each database route’s `style` object.


## Train and metro modes (9 November 2026)

Use `mode: "train"` for mainline train journeys and `mode: "metro"` for metro
lines. `train-stations.js` follows `airports.js`, selecting `{mode: "train"}`
with dashed defaults in the original implementation. The page now stores
top-level `routes: {mode: "train", style: {lineType: "dashed"}}`.
Mexico City selects `mode: "metro"` and its
importer writes that mode. The API accepts train and metro as distinct modes. The redundant rail mode
was removed on 10 November 2026 after confirming no route or page still used it. These small code changes require normal deployment.

Three researched Amtrak routes were inserted directly into `routes`, using
canonical `train-stations` references for endpoints and inline GeoJSON stops for
intermediate geometry. No new page, station entities, or waypoint entities were
created. Existing station visit flags were preserved. The European Sleeper now
uses `train`; the 12 Mexico City lines use `metro`.

Sources: Amtrak's May 1988 timetable (Cardinal p.41, Southwest Chief p.51;
Cardinal cross-checked against January 1989 p.41) and April 2005 timetable
(Southwest Chief p.92), read in Timetable World. Source links and limitations
are in route and inline-stop notes. Lafayette remains an explicit city-scale
approximation for its unresolved historical Fifth Street platform location;
Kansas City uses station-complex geometry for its adjacent late-1980s Amshack.
Lines are schematic, not track-level geometry. There is no migration to run.
