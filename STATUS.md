# Status

Updated by Codex on March 12, 2026.

## Summary

Implemented direct image upload from the website edit page and refactored the edit page into smaller frontend files.

## Changes Made Today

- Added an `Images` row to `edit.html` with:
  - thumbnail display for existing images
  - an upload button
  - a multi-file picker
- Implemented direct image upload from the edit page using the API's presigned upload flow.
- Added browser-side image processing in Safari-friendly JavaScript to:
  - normalize uploads to JPEG
  - generate square `600x600` JPEG thumbnails
- Wired the page to:
  - request presigned upload pairs from the API
  - upload originals and thumbnails directly to S3
  - call the completion endpoint so the database updates `entity.images`
- Verified that uploaded images render correctly on dynamic page views.
- Made small UI adjustments:
  - moved `Flags` above `Images`
  - removed unnecessary upload help text for existing entities
- Split edit page code into:
  - `edit.html` for markup
  - `edit.css` for page-specific styling
  - `edit.js` for page controller logic
  - `api.js` for API calls
  - `images.js` for image processing and upload workflow

## Result

The website can now upload images directly from the edit page without manual S3 steps, and the edit page code is substantially cleaner and easier to maintain.

## March 12, 2026 Update

### Summary

Implemented the `todo-icon` rendering path in the shared dynamic page renderer so `twin-stations` and `twin-cities` now match the old static grouped layout.

### Changes Made

- Updated `page.js` so pages whose `tags` contain `todo-icon` use the legacy twin-page behavior.
- Stopped those pages from splitting entities into been/todo sections with an `<hr>`.
- Grouped adjacent entities by shared `group` so related names stay together.
- Rendered todo icons and flags inside a `<span class="todo">...</span>` wrapper so unvisited entries appear faded.
- Inserted `<div class="smallSpace"><br></div>` between adjacent groups to match the legacy spacing.
- Verified the renderer change against `twin-stations` and `twin-cities`.
- Confirmed a separate data issue in the API response: many `twin-stations` entities were missing `group`, which caused an ungrouped tail section.
- After the data was fixed outside this repo, confirmed the dynamic pages now render as expected.

### Result

The shared dynamic renderer now supports the special `todo-icon` twin-page layout, and `twin-stations` / `twin-cities` render correctly once the API data includes consistent `group` values.

## March 26, 2026 Update

### Summary

Extended the shared dynamic page and results renderers with new sorting behavior, better results-page map icons, and additional edit-form support for entity trip references.

### Changes Made

- Updated `page.js` sorting so names ignore the prefix `The ` when sorting by `name`.
- Added a `sort` query parameter to `page.html` that prepends override keys ahead of the page's configured sort.
- Added browser-side `distance` sorting for `page.html`, using geolocation plus haversine distance from entity GeoJSON or legacy `coords`.
- Moved the computed geolocation sort value to an internal `locationDistance` property so `sort=distance` does not collide with existing entity `distance` data.
- Added a dedicated `coords` sort mode in `page.js` that parses the `coords` string and sorts by decreasing latitude, then increasing longitude.
- Fixed fraction badge rendering in `page.js` so fraction badges output the expected two-level `<div class="fraction"><div>…</div></div>` markup.
- Added a `Trips` field to `edit.html` after `Caption`, and moved the `Flags` section above `Icons`.
- Wired `edit.js` so `trips` is edited as a space-separated string in the UI and stored as an array of strings in the entity payload.
- Normalized `trips` on edit-page load so the field populates correctly from either `trips` or `trip`, whether the API returns an array or a string.
- Updated `ui.js` so on pages that use `results.js`, unvisited entities only fade the icon/flag via `<span class="todo">`, while the place name remains fully opaque.
- Updated `results.js` so entities inside each page section are ordered with visited entries first and unvisited entries after them.
- Changed result-section page links from legacy `<key>.html` URLs to `page.html?id=<key>`, with a special-case route to `page-rtl.html` for `mosques` and `synagogues`.
- Added results-page map icon support that enriches entities with `pageIcon` and tells `map.js` to use page icons instead of entity country flags on `nearby`, `trip`, and `city` maps.

### Result

The shared page and results infrastructure is now more flexible: dynamic pages support URL-level sort overrides and richer sort modes, results pages are easier to scan and navigate, results-page maps use more informative per-page icons, and the entity editor now supports trip metadata cleanly.

## March 27, 2026 Update

### Summary

Refined the frontend behavior for dynamic page grouping, results-page navigation, results-page maps, and the edit form so the shared UI behaves more like the intended site conventions.

### Changes Made

- Updated `edit.js` so the `Trips` field reliably loads existing trip references by normalizing either `trips` or `trip` from array or string API responses before populating the form.
- Updated `results.js` and `ui.js` so results-page sections now show visited entities before unvisited ones, while only fading the icon/flag for `been: false` rows instead of fading the place name.
- Changed result-section page links to use `page.html?id=<key>` instead of legacy `<key>.html` paths, with a special-case route to `page-rtl.html` for `mosques` and `synagogues`.
- Added results-page map icon support by enriching entities with `pageIcon` and teaching `map.js` to use that icon on `city`, `trip`, and `nearby` pages instead of reusing the entity's first flag icon.
- Updated `page.js` so `type: "city"` pages now split into visited and todo sections with an `<hr>`, matching the behavior already used for `place` and `country` pages.
- Fixed the effective default sort logic in `page.js` so pages tagged `reference-first` correctly default to `[reference, name]` rather than falling back to a plain name-first sort through the query-sort path.

### Result

Dynamic pages now group city lists more consistently, results pages are easier to scan and navigate, map pins on aggregated results pages are more informative, and the edit form now correctly surfaces existing trip metadata for editing.

## March 27, 2026 Update (Later)

### Summary

Refined the edit workflow for entity enrichment, expanded dynamic city and country navigation, and replaced several remaining static-page hacks in the shared page and results renderers.

### Changes Made

- Reworked `edit.html`, `edit.css`, and `edit.js` so enrichment actions use explicit `Auto` buttons instead of clickable labels, and successful autofill actions save immediately.
- Added explicit `Open` actions for entity links and city detail pages from the edit form, using the shared `simplify` behavior for city-page routing.
- Expanded the edit form to support `badges`, `info`, and `caption`, moved `Badges` between `Info` and `Caption`, and improved the mobile-safe stacked label/button layout.
- Updated `page.js` admin controls so the `New` button uses the same button styling as the other header controls and remains visible whenever the viewer is signed in as an admin.
- Changed `page.js` entity links so `cities` rows open `city.html?city=<key>` and `countries` rows open `country.html?code=<country>`.
- Updated `city.js` so the visited status appears below the map, and added a `🌍 Wikipedia` line linking to the city's actual external URL.
- Updated `country.js` so country pages render a map like city pages, move the visited status below the map, and use results-based bounds fitting instead of depending on `country.coords`.
- Added opt-in results-bounds fitting to `map.js`, enabled it for `country` and `search`, and added a search-results map in `search.js`.
- Removed the legacy `replaceFlagsWithLinks()` DOM-rewrite hack from `map.js`.
- Updated `page.js` and `ui.js` so country flag emoji in entity icons are rendered as real links to `country.html?code=<cc>#<section>` instead of being rewritten after render.
- Updated `results.js` to replace old `<a name>` anchors with `id` attributes on section links, and to scroll to `location.hash` after async rendering so section hashes work on results pages.

### Result

The edit experience is faster and more explicit, dynamic city and country pages are now the primary navigation targets, results-driven maps can fit their content intelligently, and shared rendering no longer depends on brittle post-processing hacks for country links or section anchors.
