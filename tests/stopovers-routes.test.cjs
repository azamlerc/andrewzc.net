const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'stopovers.js'), 'utf8');

for (const alreadyLoaded of [true, false]) {
  test(`Stopovers selects its air-route subset (shared layer loaded: ${alreadyLoaded})`, async () => {
    let selection;
    let scriptsLoaded = 0;
    const context = { console };
    const api = { showWhenReady(filter) { selection = filter; } };
    context.window = context;
    if (alreadyLoaded) context.MapRoutes = api;
    context.document = {
      createElement() { return {}; },
      head: {
        appendChild(script) {
          scriptsLoaded++;
          assert.equal(script.src, 'map-routes.js');
          context.MapRoutes = api;
          script.onload();
        },
      },
    };
    await vm.runInNewContext(source, context);
    assert.equal(selection.mode, 'air');
    assert.equal(selection.trip, 'stopovers');
    assert.equal(scriptsLoaded, alreadyLoaded ? 0 : 1);
  });
}
