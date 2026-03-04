// results.js — shared rendering logic for pages that display grouped entity results.
// Used by city.js, country.js, and the future search results page.

const API_BASE = "https://api.andrewzc.net";

// Fetch /pages and a data endpoint in parallel.
// Returns { pages, data } or throws.
async function fetchPagesAndData(dataUrl) {
  const [pagesRes, dataRes] = await Promise.all([
    fetch(`${API_BASE}/pages`),
    fetch(dataUrl),
  ]);
  if (!pagesRes.ok) throw new Error(`Failed /pages: ${pagesRes.status}`);
  if (!dataRes.ok)  throw new Error(`Failed ${dataUrl}: ${dataRes.status}`);
  const pagesPayload = await pagesRes.json();
  const data         = await dataRes.json();
  return { pages: pagesPayload.pages || [], data };
}

// Group an array of entities into a Map keyed by list.
function bucketByList(entities) {
  const map = new Map();
  for (const e of entities || []) {
    if (!e?.list) continue;
    if (!map.has(e.list)) map.set(e.list, []);
    map.get(e.list).push(e);
  }
  return map;
}

// Render the page title, document.title, and visited line into headlineEl / captionEl.
function renderHeader(headlineEl, captionEl, { name, icons, been }) {
  const iconStr = Array.isArray(icons) ? icons.join(" ") : (icons || "");
  const title   = `${iconStr ? iconStr + " " : ""}${name}`;

  document.title         = title;
  headlineEl.textContent = title;

  captionEl.appendChild(document.createTextNode(been === true ? "✅ Visited" : "📝 Not visited"));
  captionEl.appendChild(UI.br());
}

// Render a single section: anchor + icon + page link (+ count) + entity rows.
function renderSection(captionEl, page, hits, { pageName = null, maxItems = 10, dedupe = false } = {}) {
  const listKey  = page.key;
  const pageIcon = page.icon || page.emoji || "";
  const name     = page.name || listKey;
  const rows     = dedupe ? UI.dedupeEntities(hits) : hits;

  captionEl.appendChild(UI.el("a", { name: listKey }));
  captionEl.appendChild(document.createTextNode(" "));
  captionEl.appendChild(document.createTextNode(pageIcon ? `${pageIcon} ` : ""));

  const a = UI.el("a", { href: `${listKey}.html`, className: "link" });
  a.textContent = name;
  captionEl.appendChild(a);

  if (rows.length > maxItems) {
    captionEl.appendChild(document.createTextNode(` (${rows.length})`));
  }

  captionEl.appendChild(UI.br());

  for (const ent of rows.slice(0, maxItems)) {
    captionEl.appendChild(UI.renderEntityRow(ent, pageName ? { pageName } : {}));
  }
}

// Iterate pages in order, rendering a section for each that has hits.
// Returns true if at least one section was rendered.
function renderSections(captionEl, pages, byList, options = {}) {
  const { pageName = null, maxItems = 10, dedupeLists = new Set() } = options;
  let any = false;

  for (const page of pages) {
    const hits = byList.get(page?.key);
    if (!hits?.length) continue;
    if (any) captionEl.appendChild(UI.smallSpace());
    renderSection(captionEl, page, hits, {
      pageName,
      maxItems,
      dedupe: dedupeLists.has(page.key),
    });
    any = true;
  }

  return any;
}

// Render a "nothing found" message.
function renderEmpty(captionEl) {
  captionEl.appendChild(UI.smallSpace());
  captionEl.appendChild(document.createTextNode("No matching entities found."));
  captionEl.appendChild(UI.br());
}

// Render an error into the standard headline/caption slots.
function renderError(headlineEl, captionEl, err) {
  console.error(err);
  headlineEl.textContent = "Error";
  captionEl.textContent  = String(err?.message || err);
}

window.Results = {
  API_BASE,
  fetchPagesAndData,
  bucketByList,
  renderHeader,
  renderSection,
  renderSections,
  renderEmpty,
  renderError,
};
