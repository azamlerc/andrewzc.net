const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const script = fs.readFileSync(path.join(__dirname, "../connections.js"), "utf8");

async function loadGames(page, response) {
  const items = new Map();
  const urls = [];
  vm.runInNewContext(script, {
    URLSearchParams, location: new URL(page),
    window: { addEventListener() {} },
    document: {
      addEventListener() {},
      getElementById(id) {
        if (!items.has(id)) {
          items.set(id, { children: [], addEventListener() {}, setAttribute() {}, append() {}, replaceChildren() {} });
        }
        return items.get(id);
      },
    },
    async fetch(url) {
      urls.push(url);
      return response ?? {
        ok: true,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ games: [], next: null }),
      };
    },
  });
  await new Promise(setImmediate);
  return { urls, note: items.get("history-note").textContent };
}

test("the localhost site uses the deployed Games API on load", async () => {
  const { urls, note } = await loadGames("http://localhost/andrewzc/connections-game.html");
  assert.deepEqual(urls, ["https://api.andrewzc.net/connections/games"]);
  assert.equal(note, "No saved games yet.");
});

test("ports and query parameters do not change the API origin", async () => {
  const { urls } = await loadGames("http://localhost:3000/connections-game.html?api=local");
  assert.deepEqual(urls, ["https://api.andrewzc.net/connections/games"]);
});

test("an HTML response identifies the failed endpoint and HTTP status", async () => {
  const { note } = await loadGames("http://localhost/connections-game.html?api=local", {
    status: 404,
    headers: new Headers({ "Content-Type": "text/html" }),
  });
  assert.equal(note, "Expected JSON from https://api.andrewzc.net/connections/games (HTTP 404).");
});
