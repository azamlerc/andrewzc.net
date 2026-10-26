const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const helpers = import('../location-input.js');
const point = (lon, lat) => ({ type: 'Point', coordinates: [lon, lat] });
const plain = value => JSON.parse(JSON.stringify(value));

async function editor() {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) {
      const classes = new Set();
      nodes.set(id, { value: '', textContent: '', style: {}, events: {},
        setAttribute() {}, addEventListener(name, fn) { this.events[name] = fn; },
        classList: { contains: name => classes.has(name), add: name => classes.add(name),
          remove: name => classes.delete(name), toggle(name, on) { on ? classes.add(name) : classes.delete(name); } },
      });
    }
    return nodes.get(id);
  };
  const writes = [];
  const context = vm.createContext({
    ...await helpers, URL, URLSearchParams, console: { log() {} },
    location: { search: '?list=bridges&key=test', href: 'https://example.test/edit.html?list=bridges&key=test' },
    document: { getElementById: node, addEventListener() {}, body: node('body') },
    window: { addEventListener() {} },
    renderImages() {},
    async createEntity(list, payload) { writes.push({ list, payload }); return { ...payload, list, key: 'created' }; },
    async updateEntity(list, key, payload) { writes.push({ list, key, payload }); return { ...payload, list, key }; },
    history: { replaceState() {} },
  });
  const source = fs.readFileSync(require.resolve('../edit.js'), 'utf8')
    .replace(/^import[\s\S]*?from "[^"]+";\n/gm, '')
    .replace(/loadReferenceAutocomplete\(\);\nloadTripAutocomplete\(\);\nload\(\);\s*$/, '');
  vm.runInContext(source, context);
  return { context, nodes, writes, node, setOriginal(entity, create = false) {
    context.fixture = entity;
    vm.runInContext(`original = fixture; isCreateMode = ${create}; populateFields(original);`, context);
  } };
}

test('location presentation preserves order, zero, and stored precision', async () => {
  const { formatLocation, parseLocationInput } = await helpers;
  for (const location of [point(-34.5678, 1.12345), point(0, 0), point(4.1234567890123, 50.9876543210987)]) {
    const result = parseLocationInput(formatLocation(location));
    assert.deepEqual(point(result.lon, result.lat), location);
  }
});

test('decimal and DMS pastes normalize, while malformed/out-of-range values are rejected', async () => {
  const { normalizeLocationInput, parseLocationInput } = await helpers;
  for (const text of ['40.5, -73.5', '40°30′0″N, 73°30′0″W', '40°30\'N 73°30\'W', '40.5N 73.5O']) {
    assert.equal(normalizeLocationInput(text).text, '40.5, -73.5');
  }
  for (const text of ['', 'not-found', '91, 0', '0, 181', ', ', '1,2,3', '1E, 2N', '1e2, 0', '40°60′N, 0']) {
    assert.equal(parseLocationInput(text), null, text);
  }
});

test('editor loads GeoJSON despite conflicting legacy data and saves only location', async () => {
  const app = await editor();
  app.setOriginal({ name: 'Bridge', location: point(2, 1), coords: '80, 90' });
  assert.equal(app.node('location').value, '1, 2');
  app.node('location').value = '40°30′N, 73°30′W';
  app.node('location').events.blur();
  assert.equal(app.node('location').value, '40.5, -73.5');
  await app.context.save();
  assert.deepEqual(plain(app.writes[0].payload), { location: point(-73.5, 40.5) });
});

test('clearing a location sends null; unchanged GeoJSON sends no write', async () => {
  const app = await editor();
  app.setOriginal({ name: 'Bridge', location: { coordinates: [2, 1], type: 'Point' } });
  await app.context.save();
  assert.equal(app.writes.length, 0);
  app.node('location').value = '';
  await app.context.save();
  assert.deepEqual(plain(app.writes[0].payload), { location: null });
});

test('invalid editor input blocks saving and preserves the stored location', async () => {
  const app = await editor();
  app.setOriginal({ name: 'Bridge', location: point(2, 1) });
  app.node('location').value = '100, 200';
  await app.context.save();
  assert.equal(app.writes.length, 0);
  assert.match(app.node('status').textContent, /Invalid location/);
});

test('URL enrichment displays GeoJSON and still populates the nearest city', async () => {
  const app = await editor();
  app.setOriginal({ name: 'Bridge', link: 'https://en.wikipedia.org/wiki/Bridge' });
  app.context.lookupLocation = async () => ({ location: point(2, 1) });
  app.context.lookupNearestCity = async (lat, lon) => {
    assert.deepEqual([lat, lon], [1, 2]);
    return { results: [{ name: 'City' }] };
  };
  await app.context.enrichFromLink();
  assert.equal(app.node('location').value, '1, 2');
  assert.equal(app.node('city').value, 'City');
});

test('new entities store pasted coordinates as GeoJSON', async () => {
  const app = await editor();
  app.setOriginal({ name: 'New bridge' }, true);
  app.node('location').value = '0, 0';
  await app.context.save();
  assert.deepEqual(plain(app.writes[0].payload.location), point(0, 0));
  assert.equal('coords' in app.writes[0].payload, false);
});

test('map ignores legacy-only records and uses canonical geometry when values conflict', () => {
  const context = vm.createContext({ window: {}, document: { createElement: () => ({}), head: { appendChild() {} }, addEventListener() {} } });
  vm.runInContext(fs.readFileSync(require.resolve('../map.js'), 'utf8'), context);
  assert.equal(context.getLatLong({ coords: '1, 2' }), null);
  assert.deepEqual(plain(context.getLatLong({ coords: '80, 90', location: point(2, 1) })), [1, 2]);
  for (const location of [point(0, 91), point(181, 0), point('2', '1'), { type: 'Point', coordinates: [null, null] }]) {
    assert.equal(context.getLatLong({ location }), null);
  }
});

test('standalone maps load GeoJSON entities from the API', async () => {
  let requested;
  const context = vm.createContext({ window: {}, document: { createElement: () => ({}), head: { appendChild() {} }, addEventListener() {} },
    fetch: async url => { requested = url; return { ok: true, json: async () => ({ entities: [{ list: 'bridges', key: 'a', location: point(2, 1) }] }) }; },
  });
  vm.runInContext(fs.readFileSync(require.resolve('../map.js'), 'utf8'), context);
  const places = await context.loadPlaces('bridges');
  assert.equal(requested, 'https://api.andrewzc.net/pages/bridges/entities');
  assert.deepEqual(plain(context.getLatLong(places['bridges/a'])), [1, 2]);
});
