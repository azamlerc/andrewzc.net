# Routes workflow

## How a page draws routes

The map page loads `map.js`, which creates the Leaflet map and dispatches a
`mapReady` event. A page-specific script can then select routes through the
shared `map-routes.js` layer.

`airports.js` is the reference implementation:

1. It loads `map-routes.js` if that script is not already present.
2. It calls `MapRoutes.showWhenReady({ mode: "air" })`.
3. `map-routes.js` waits for the map context, then requests
   `GET /routes?mode=air` from the configured API (the page URL's `api` query
   parameter overrides the default API host).
4. The API reads matching documents from the MongoDB `routes` collection. For
   every route stop it resolves the `{ list, key }` reference against the
   `entities` collection and returns `{ routes, entities }`.
5. The browser indexes those endpoint entities by their list/key pair,
   converts `location` or legacy `coords` to Leaflet latitude/longitude
   points, and draws a polyline through the ordered `stops` array. A route with
   a missing or coordinate-less stop is skipped rather than drawing a false
   connection.

## Route document shape

The useful fields in a `routes` document are:

```json
{
  "key": "mexico-city-line-1",
  "name": "Mexico City Line 1",
  "mode": "rail",
  "trips": ["mexico-city"],
  "style": {"lineType": "solid", "weight": 6, "color": "#f04a9b"},
  "stops": [
    {"list": "stations", "key": "observatorio"},
    {"list": "stations", "key": "tacubaya"}
  ],
  "path": {"kind": "straight"}
}
```

`stops` must be in travel order. The `list` and `key` pair is required even
when a key happens to be unique across the database. Use `path.kind` `straight`
for ordinary map lines or `great-circle` for flights. The API currently
supports `mode` values `air`, `rail`, `road`, and `sea`; `trip` can be added to
the query to select only routes tagged with that trip.

Routes may set `style.color` to any Leaflet-compatible color value,
`style.weight` to a positive stroke width in pixels, and `style.lineType` to
`solid`, `dashed`, or `dotted`. The renderer falls back to the legacy top-level
`color`, then green for travelled routes and red for planned routes. Rail
remains dashed by default on general maps; Mexico City sets a solid, six-pixel
stroke on every line. Road routes remain dotted by default. The older
`path.dashArray` override still works when `style.lineType` is absent.
Page scripts can pass style defaults as the second argument to
`MapRoutes.showWhenReady(filter, defaults)`; a route's own `style` fields take
precedence. Mexico City supplies solid, six-pixel defaults, while each route
supplies its line color.

## Adding a page route map

1. Add or update the page document in the `pages` collection with
   `script: "<page-key>.js"`.
2. Create the page script following `airports.js`: load `map-routes.js` if
   needed, then call `MapRoutes.showWhenReady` with a `mode` and, when the page
   should show a subset, a `trip`.
3. Insert route documents with ordered `{ list, key }` stops. Make sure every
   endpoint entity has coordinates. Mexico City is a `propertyOf: "stations"`
   page: its visible markers are `entities` with `list: "stations"` and a
   `props.mexico-city` field. Routes must reference those canonical station
   keys, which sometimes differ from the old `data/mexico-city.json` keys.
   The migration matches stations by name and includes only those with usable
   coordinates. Correct missing or misplaced coordinates on the `stations`
   records from their linked Spanish Wikipedia pages, then rerun it. The Line
   12 ordering includes Lomas Estrella, but that station is not currently in
   the Mexico City page's `stations` set, so the route skips that stop.
4. For a transit system, set `route.style` to the line's type, thickness, and
   color, and tag it with the page key in `trips`.
5. Test the API response and browser page. The map should show the expected
   number of routes, and the browser console should have no “missing endpoint
   coordinates” warnings.

Mexico City follows this workflow in `mexico-city.js`; its route records are
created by `andrewzc-v4/migrations/import-mexico-city-routes.js`.
