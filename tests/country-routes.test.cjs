const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'country.js'), 'utf8');
for (const input of ['be', 'es-cn']) {
  test(`country map selects all transport modes for ${input}`, async () => {
    let mapLoaded = false;
    const element = () => ({textContent: '', appendChild(child) {
      if (child.src === 'map.js') {mapLoaded = true; assert.equal(context.pageInfo.routes.country, input.toUpperCase());}
    }, setAttribute() {}});
    const context = {URLSearchParams, location: {search: `?code=${input}`}, console,
      document: {getElementById: element, createElement: element, createTextNode: text => ({text})},
      UI: {entityLocation: e => e.location, el: element, br: element, smallSpace: element, flagEmojiFromCountryCode: () => ''},
      Results: {API_BASE: 'test', fetchPagesAndData: async () => ({pages: [], data: {country: {name: input}, entities: [{location: {}}]}}),
        withPageIcons: entities => entities, renderHeader() {}, bucketByList() {return {};}, renderSections() {return true;},
        async enableAdminControls() {}, renderError(h, c, error) {throw error;}}};
    context.window = context;
    await vm.runInNewContext(source, context);
    assert.deepEqual(JSON.parse(JSON.stringify(context.pageInfo.routes)), {country: input.toUpperCase()});
    assert.equal(mapLoaded, true);
  });
}
test('country routes use the shared map initialization without a separate renderer script', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'country.html'), 'utf8');
  assert.ok(!html.includes('src="map-routes.js"'));
  assert.ok(html.includes('src="country.js"'));
});
