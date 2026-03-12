# andrewzc.net

Frontend for [andrewzc.net](https://andrewzc.net), a personal website built around travel, transit, geography, music, and other catalog-style collections.

## What This Repo Contains

This repo is in the middle of a long transition from hand-maintained static HTML pages to data-driven pages backed by the `andrewzc-api` and a MongoDB database of pages and entities.

The old model was "one HTML file per list." The current model is increasingly:

- `page.html?id=<page>` for most list pages
- API-driven rendering in the browser
- optional admin editing directly on the site

Most older static files still exist in the repo, but many now function mainly as legacy entry points or pages that have not been migrated yet. An upcoming cleanup step will archive many of those static files.

## Current Architecture

The frontend is mostly plain HTML, CSS, and browser JavaScript. There is no large app framework here. The important pieces are:

- `page.html`: shared shell for dynamic list pages
- `page.js`: main renderer for a page loaded from the API
- `edit.js`: admin editing UI for creating and updating entities from the website
- `results.js`: shared grouped-results renderer used by search/location-style pages
- `api.js`: small client library for calling the backend API
- `ui.js`: shared DOM/rendering helpers used across the frontend

In practice, the center of gravity for ongoing work is:

- `page.js`
- `edit.js`
- `results.js`

## Important Files

### Core

- `page.js` renders a list page, fetches page data from the API, builds rows, loads page-specific scripts when needed, and handles the dynamic page experience.
- `edit.js` powers the admin edit interface. When authenticated as an admin, the site can expose editing controls for entities directly in the browser.
- `results.js` provides shared logic for pages that display grouped search-like results, such as city, country, and nearby pages.
- `api.js` contains the browser-side API helpers used by the edit flow and other dynamic features.
- `ui.js` contains reusable rendering and DOM helpers.

### Supporting Modules

- `images.js` supports image upload and rendering on the edit page.
- `map.js` adds Leaflet-based maps to pages that need them.
- `typeahead.js` supports remote-control navigation behavior.
- `new-home.js` is a prototype for a newer feed-style home page.
- `bingo.js` supports dynamic travel bingo card pages.
- `artists.js` makes artist names clickable on older pages; this is likely to become less important as more pages move to the dynamic model.

### Search / Discovery

- `search.js` supports the contextual search page.
- `results.js` is the shared renderer for grouped result pages.
- `city.js` shows page-grouped entities for a city.
- `country.js` shows page-grouped entities for a country.
- `nearby.js` shows nearby places based on current location.

### Chat

- `chat.js` supports chatbot-style interaction with website content.
- `hello.js` and `senza.js` are bot-specific configuration files.

### Page-Specific Scripts

These scripts exist for individual pages with custom behavior and are generally less central than the shared infrastructure above:

- `confluence.js`
- `flags-table.js`
- `gauges.js`
- `orient-express.js`
- `route-20.js`
- `swimming.js`
- `trans-siberian.js`

## Repo Shape

The repo still contains a large number of top-level `.html` files. Historically each one represented a standalone page. Today, they fall into a few buckets:

- pages that still have custom static implementations
- legacy pages preserved during migration
- lightweight entry pages that increasingly point toward shared dynamic rendering

That means the file count can look noisier than the actual maintenance surface area. If you are starting fresh in this codebase, focus on the shared JavaScript modules before spending much time on individual static pages.

## How Data Flows

The general dynamic flow is:

1. A page loads `page.html` or another lightweight HTML shell.
2. Browser JavaScript calls the backend API.
3. The API returns page metadata and entity data from MongoDB.
4. Shared rendering code turns that data into the visible list/search/edit UI.

For admin use, the edit flow extends that model by allowing authenticated in-browser updates and image uploads.

## Recommended Starting Points

If you are opening a new thread on this project, these are usually the right files to read first:

- `page.js`
- `edit.js`
- `results.js`
- `api.js`
- `ui.js`

Then check any page-specific script only if the task is tied to a custom page behavior.

## Notes For Future Maintenance

- The project is actively moving away from one-off static list pages toward shared dynamic rendering.
- Many static HTML files remain only because the migration is incomplete and archival has not happened yet.
- Work that improves shared behavior is usually higher leverage than work on a single legacy page.
- Public documentation should avoid describing admin authentication details. It is enough to say that admin-only controls appear when authenticated.
