const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.env.ROUTE_FRONTEND_ROOT || path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const settle = () => new Promise(resolve => setImmediate(resolve));

function setup({ ready = true, loaded = false, failLoad = false } = {}) {
  const requests = [], styles = [], errors = [], listeners = new Map();
  let loads = 0;
  const context = { URL, URLSearchParams, console: { log() {}, warn() {}, error(...args) { errors.push(args); } },
    location: { href: 'https://example.test/page.html?id=any-new-page&api=https://api.example.test' },
    document: {
      createElement() { return {}; },
      addEventListener(name, handler) { listeners.set(name, handler); },
      head: { appendChild(element) {
        if (element.src === 'map-routes.js') {
          loads++;
          if (failLoad) { failLoad = false; element.onerror(); return; }
          vm.runInContext(read('map-routes.js'), ctx);
          element.onload();
        }
      } },
    },
    L: {
      layerGroup() { return { addTo() { return this; } }; },
      polyline(points, style) { styles.push(plain(style)); return { bindTooltip() { return this; }, addTo() { return this; } }; },
    },
    async fetch(url) {
      requests.push(String(url));
      return { ok: true, async json() { return {
        '--info--': { key: 'any-new-page', routes: { trip: 'my-trip' } },
        routes: [{ key: 'test', been: true, style: { color: '#123456' }, stops: [
          { location: { type: 'Point', coordinates: [2, 48] } },
          { location: { type: 'Point', coordinates: [3, 49] } },
        ] }], entities: [],
      }; } };
    },
  };
  context.window = context;
  const ctx = vm.createContext(context);
  vm.runInContext(read('map.js'), ctx);
  if (loaded) vm.runInContext(read('map-routes.js'), ctx);
  if (ready) context.__ANDREWZC_MAP_CONTEXT__ = { map: {} };
  return { context, requests, styles, errors, loads: () => loads,
    mapReady() { context.__ANDREWZC_MAP_CONTEXT__ = { map: {} }; listeners.get('mapReady')({ detail: context.__ANDREWZC_MAP_CONTEXT__ }); } };
}

for (const loaded of [true, false]) for (const ready of [true, false]) {
  test(`page data draws routes with renderer loaded=${loaded}, map ready=${ready}`, async () => {
    const app = setup({ loaded, ready });
    await app.context.showPageRoutes({ key: 'any-new-page', routes: {
      trip: 'my-trip', mode: 'metro', style: { lineType: 'solid', weight: 6 },
    } });
    if (!ready) { assert.equal(app.requests.length, 0); app.mapReady(); }
    await settle();
    const request = new URL(app.requests[0]);
    assert.equal(request.origin, 'https://api.example.test');
    assert.equal(request.searchParams.get('trip'), 'my-trip');
    assert.equal(request.searchParams.get('mode'), 'metro');
    assert.equal(request.searchParams.has('style'), false);
    assert.equal(app.styles.length, 1);
    assert.equal(app.styles[0].weight, 6);
    assert.equal(app.styles[0].dashArray, null);
    assert.equal(app.styles[0].color, '#123456');
    assert.equal(app.loads(), loaded ? 0 : 1);
    assert.equal(app.errors.length, 0);
  });
}

test('absent/disabled routes do not fetch anything; map.routes is not configuration', async () => {
  const app = setup();
  for (const info of [{}, { routes: false }, { map: { routes: { mode: 'air' } } }]) await app.context.showPageRoutes(info);
  assert.equal(app.loads(), 0);
  assert.equal(app.requests.length, 0);
});

test('invalid filters cannot accidentally select every route', async () => {
  const app = setup();
  for (const routes of [true, [], { mode: '' }, { trip: [] }, { typo: 'my-trip' }]) await app.context.showPageRoutes({ routes });
  assert.equal(app.loads(), 0);
  assert.equal(app.requests.length, 0);
  assert.equal(app.errors.length, 5);
});

test('empty routes object explicitly selects all modes; country filter is supported', async () => {
  for (const routes of [{}, { country: 'BE' }]) {
    const app = setup();
    await app.context.showPageRoutes({ routes });
    await settle();
    const params = new URL(app.requests[0]).searchParams;
    assert.equal(params.get('country'), routes.country || null);
    assert.equal(params.has('mode'), false);
  }
});

test('legacy and declarative initialization do not draw the same selection twice', async () => {
  const app = setup({ loaded: true });
  app.context.MapRoutes.showWhenReady({ mode: 'train' }, { lineType: 'dashed' });
  await app.context.showPageRoutes({ routes: { mode: 'train', style: { lineType: 'dashed' } } });
  await settle();
  assert.equal(app.requests.length, 1);
  assert.equal(app.styles.length, 1);
  assert.equal(app.styles[0].dashArray, '14,10');
});

test('failed shared renderer load can be retried', async () => {
  const app = setup({ failLoad: true });
  await app.context.showPageRoutes({ routes: { trip: 'my-trip' } });
  assert.equal(app.requests.length, 0);
  await app.context.showPageRoutes({ routes: { trip: 'my-trip' } });
  await settle();
  assert.equal(app.loads(), 2);
  assert.equal(app.styles.length, 1);
});

test('standalone maps retain the page context returned with entities', async () => {
  const app = setup();
  await app.context.loadPlaces('any-new-page');
  assert.deepEqual(plain(app.context.pageInfo.routes), { trip: 'my-trip' });
});

for (const [routes, expected] of [[undefined, { trip: 'sample-trip' }], [false, false], [{ mode: 'car', trip: 'other' }, { mode: 'car', trip: 'other' }]]) {
  test(`trip renderer supplies route context (${JSON.stringify(routes)})`, async () => {
    let sawMap = false;
    const element = () => ({ textContent: '', setAttribute() {}, appendChild(child) {
      if (child.src === 'map.js') {
        sawMap = true;
        assert.deepEqual(plain(context.pageInfo.routes), expected);
      }
    } });
    const page = { key: 'sample-trip', name: 'Sample', map: { lat: 1, lon: 2, zoom: 3 }, ...(routes !== undefined ? { routes } : {}) };
    const context = { URLSearchParams, location: { search: '?id=sample-trip' }, console,
      document: { getElementById: element, createElement: element, createTextNode: element },
      UI: { titleCase: value => value, el: element, smallSpace: element },
      Results: { API_BASE: 'test', async fetchPagesAndData() { return { pages: [], data: { page, entities: [] } }; },
        withPageIcons: entities => entities, bucketByList() { return {}; }, renderSections() { return true; },
        async enableAdminControls() {}, renderError(h, c, error) { throw error; } },
    };
    context.window = context;
    await vm.runInNewContext(read('trip.js'), context);
    assert.equal(sawMap, true);
  });
}

for (const mode of ['air', 'train', 'metro', 'bus', 'car', 'sea']) {
  test(`${mode} routes default to solid lines`, async () => {
    const app = setup({ loaded: true });
    assert.equal(app.context.MapRoutes.style({ mode, been: true }).dashArray, null);
    await app.context.showPageRoutes({ routes: { mode } });
    await settle();
    assert.equal(new URL(app.requests[0]).searchParams.get('mode'), mode);
  });
}
