const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(href, storage = new Map(), attributes = {}) {
  const maps = [];
  const context = vm.createContext({
    URL, URLSearchParams,
    console: { log() {} },
    CustomEvent: class {},
    sessionStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    window: {
      location: { href },
      matchMedia: () => ({ matches: false, addEventListener() {} }),
    },
    document: {
      createElement: () => ({}),
      head: { appendChild() {} },
      getElementById: () => ({ getAttribute: key => attributes[key] ?? null }),
      dispatchEvent() {},
      addEventListener() {},
    },
    L: {
      tileLayer: () => ({}),
      markerClusterGroup: () => ({}),
      latlngGraticule: () => ({}),
      control: { layers: () => ({ addTo() {} }) },
      map: (id, options) => {
        const events = {};
        const currentMap = {
          options, events, fits: 0,
          center: { lat: Number(options.center[0]), lng: Number(options.center[1]) },
          zoom: Number(options.zoom),
          on: (name, handler) => { events[name] = handler; },
          once() {},
          fitBounds() { this.fits++; this.center = { lat: 50, lng: 10 }; this.zoom = 6; },
          setView(point, zoom) { this.center = { lat: point[0], lng: point[1] }; this.zoom = zoom; },
          getCenter() { return this.center; },
          getZoom() { return this.zoom; },
        };
        maps.push(currentMap);
        return currentMap;
      },
    },
  });
  vm.runInContext(fs.readFileSync(require.resolve('../map.js'), 'utf8'), context);
  // Marker rendering is unrelated to view persistence; retain real bounds logic.
  context.addMarkers = () => {};
  const places = { a: { coords: '45, 5' }, b: { coords: '55, 15' } };
  return { context, maps, storage, show: () => context.showPlaces(places, 'example') };
}

test('page and query identities are isolated, while query order and anchors are ignored', () => {
  const { context } = setup('https://example.com/maps.html');
  const key = path => context.mapViewStorageKey(new URL(path, 'https://example.com'));
  for (const [page, param] of [
    ['page', 'id'], ['trip', 'id'], ['city', 'city'], ['country', 'code'],
    ['search', 'q'], ['recent', 'days'], ['nearby', 'lat'],
  ]) {
    assert.notEqual(key(`/${page}.html?${param}=one`), key(`/${page}.html?${param}=two`));
  }
  assert.notEqual(key('/trip.html?id=one'), key('/page.html?id=one'));
  assert.notEqual(key('/parks.html'), key('/ferries.html'));
  assert.equal(key('/nearby.html?lat=1&lon=2#map'), key('/nearby.html?lon=2&lat=1'));
});

test('pan and zoom survive reload without result fitting overwriting the saved view', () => {
  const href = 'https://example.com/country.html?code=BE';
  const first = setup(href, new Map(), { fit: 'results' });
  first.show();
  assert.equal(first.maps[0].fits, 1);
  first.maps[0].center = { lat: 51.2, lng: 4.4 };
  first.maps[0].zoom = 12;
  first.maps[0].events.moveend();
  const reload = setup(href, first.storage, { fit: 'results' });
  reload.show();
  assert.equal(reload.maps[0].fits, 0);
  assert.equal(reload.maps[0].center.lat, 51.2);
  assert.equal(reload.maps[0].center.lng, 4.4);
  assert.equal(reload.maps[0].zoom, 12);
  const freshTab = setup(href, new Map(), { fit: 'results' });
  freshTab.show();
  assert.equal(freshTab.maps[0].fits, 1);
});

test('normal pages retain their configured defaults until a view is saved', () => {
  const app = setup('https://example.com/parks.html', new Map(), { lat: '25', lon: '15', zoom: '2' });
  app.show();
  assert.equal(app.maps[0].center.lat, 25);
  assert.equal(app.maps[0].center.lng, 15);
  assert.equal(app.maps[0].zoom, 2);
  assert.equal(app.maps[0].fits, 0);
});

test('invalid or blocked storage falls back safely and saving failures do not interrupt interaction', () => {
  const app = setup('https://example.com/recent.html?days=30', new Map(), { fit: 'auto' });
  const key = app.context.mapViewStorageKey();
  for (const value of ['invalid JSON', '{}', '{"lat":100,"lon":0,"zoom":3}', '{"lat":0,"lon":0,"zoom":99}', '{"lat":"1","lon":0,"zoom":3}']) {
    app.storage.set(key, value);
    assert.equal(app.context.readMapView(key), null);
  }
  app.context.sessionStorage.getItem = () => { throw new Error('blocked'); };
  app.context.sessionStorage.setItem = () => { throw new Error('blocked'); };
  app.show();
  assert.equal(app.maps[0].fits, 1);
  assert.doesNotThrow(() => app.maps[0].events.moveend());
});

test('an old map continues saving to its own query after the page URL changes', () => {
  const app = setup('https://example.com/search.html?q=first');
  const firstKey = app.context.mapViewStorageKey();
  app.show();
  app.context.window.location.href = 'https://example.com/search.html?q=second';
  const secondKey = app.context.mapViewStorageKey();
  app.show();
  app.maps[0].zoom = 9;
  app.maps[0].events.moveend();
  assert.equal(JSON.parse(app.storage.get(firstKey)).zoom, 9);
  assert.equal(app.storage.has(secondKey), false);
});
