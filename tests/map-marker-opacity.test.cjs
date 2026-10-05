const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
  const context = vm.createContext({
    console,
    window: {},
    document: {
      createElement: () => ({}),
      head: { appendChild() {} },
      addEventListener() {},
    },
    L: {
      divIcon: options => options,
      marker: (point, options) => ({
        point, options,
        _icon: { classList: { add() {} } },
        addTo() { return this; },
        bindPopup() { return this; },
        on() { return this; },
      }),
    },
  });
  vm.runInContext(fs.readFileSync(require.resolve('../map.js'), 'utf8'), context);
  // Popup linking is independent of marker opacity.
  context.mapPopupEntityLink = () => '<a>Example</a>';
  return context;
}

for (const renderer of ['addMarker', 'addEmojiMarker']) {
  for (const tag of ['markerBeen', 'markerNear', 'markerTodo']) {
    test(`${renderer} sets strike opacity in Leaflet options for ${tag}`, () => {
      const context = setup();
      for (const [strike, expected] of [[true, 0.5], [false, 1], [undefined, 1]]) {
        const place = {
          name: 'Example', icons: ['🇺🇸'], strike,
          location: { type: 'Point', coordinates: [-97.74, 30.29] },
        };
        const marker = context[renderer]({}, place, () => true, tag, 'moonlight');
        assert.equal(marker.options.opacity, expected);
      }
    });
  }
}
