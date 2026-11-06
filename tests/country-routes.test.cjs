const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'country.js'), 'utf8');
for (const input of ['be', 'es-cn']) {
  test(`country map selects all transport modes for ${input}`, async () => {
    let selection, mapLoaded = false;
    const element = () => ({textContent: '', appendChild(child) {
      if (child.src === 'map.js') {mapLoaded = true; assert.equal(selection.country, input.toUpperCase());}
    }, setAttribute() {}});
    const context = {URLSearchParams, location: {search: `?code=${input}`}, console,
      document: {getElementById: element, createElement: element, createTextNode: text => ({text})},
      MapRoutes: {showWhenReady(filter) {selection = filter;}},
      UI: {entityLocation: e => e.location, el: element, br: element, smallSpace: element, flagEmojiFromCountryCode: () => ''},
      Results: {API_BASE: 'test', fetchPagesAndData: async () => ({pages: [], data: {country: {name: input}, entities: [{location: {}}]}}),
        withPageIcons: entities => entities, renderHeader() {}, bucketByList() {return {};}, renderSections() {return true;},
        async enableAdminControls() {}, renderError(h, c, error) {throw error;}}};
    context.window = context;
    await vm.runInNewContext(source, context);
    assert.deepEqual(JSON.parse(JSON.stringify(selection)), {country: input.toUpperCase()});
    assert.equal(mapLoaded, true);
  });
}
test('HTML loads the shared route layer before the country script', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'country.html'), 'utf8');
  assert.ok(html.indexOf('src="map-routes.js"') < html.indexOf('src="country.js"'));
});
