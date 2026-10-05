const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
  const nodes = [];
  function node(tag) {
    const attrs = {};
    const result = {
      tagName: tag.toUpperCase(), dataset: {}, style: {}, children: [],
      classList: { toggle() {}, contains() { return false; } },
      appendChild(child) { this.children.push(child); return child; },
      addEventListener() {},
      setAttribute(key, value) {
        attrs[key] = value;
        if (key.startsWith('data-')) {
          this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
        }
      },
      getAttribute: key => attrs[key] ?? null,
    };
    nodes.push(result);
    return result;
  }
  const storage = new Map();
  const context = vm.createContext({
    URL, console,
    location: { href: 'https://example.com/city.html?city=durres' },
    sessionStorage: { getItem: key => storage.get(key) ?? null },
    document: {
      getElementById: () => null,
      createElement: node,
      createDocumentFragment: () => node('fragment'),
      createTextNode: text => ({ textContent: text }),
      head: node('head'), body: node('body'),
      querySelectorAll: selector => selector === '[data-entity-key][data-entity-list]'
        ? nodes.filter(n => n.dataset.entityKey && n.dataset.entityList) : [],
    },
  });
  context.window = context;
  for (const file of ['ui.js', 'results.js']) {
    vm.runInContext(fs.readFileSync(require.resolve(`../${file}`), 'utf8'), context);
  }
  return { context, nodes, storage };
}

for (const link of [undefined, null, '', 'https://example.com/place']) {
  test(`results label supports edit-mode round trip with link ${String(link)}`, () => {
    const { context, nodes, storage } = setup();
    const entity = { name: 'Example', key: 'some key', list: 'some-list', been: false, link };
    context.UI.renderEntityRow(entity);
    const label = nodes.find(n => n.className === 'resultsEntityLabel');
    assert.equal(label.tagName, 'A');
    assert.equal(label.getAttribute('href'), link || '#');
    assert.equal(label.dataset.entityKey, entity.key);
    assert.equal(label.dataset.entityList, entity.list);
    storage.set('editMode:city', '1');
    context.applyEditModeToDom('city');
    assert.equal(label.getAttribute('href'), 'edit.html?list=some-list&key=some%20key');
    storage.set('editMode:city', '0');
    context.applyEditModeToDom('city');
    assert.equal(label.getAttribute('href'), link || '#');
    assert.equal(entity.link, link);
  });
}
