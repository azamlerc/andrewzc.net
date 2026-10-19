const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'recent.js'), 'utf8');

for (const [search, days] of [['', 30], ['?days=60', 60]]) {
  test(`Recent requests 300 results for ${days} days`, async () => {
    let requestedUrl;
    const context = {
      URLSearchParams,
      window: { location: { search } },
      document: {
        getElementById: () => ({ appendChild() {}, textContent: '' }),
      },
      UI: { el: () => ({}) },
      Results: {
        API_BASE: 'https://api.example.test',
        async fetchPagesAndData(url) {
          requestedUrl = url;
          throw new Error('Stop after capturing the request');
        },
        renderError() {},
      },
    };
    await vm.runInNewContext(source, context);
    const url = new URL(requestedUrl);
    assert.equal(url.pathname, '/entities/recent');
    assert.equal(url.searchParams.get('days'), String(days));
    assert.equal(url.searchParams.get('limit'), '300');
  });
}
