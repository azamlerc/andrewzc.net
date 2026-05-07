// results.js — shared rendering logic for pages that display grouped entity results.
// Used by city.js, country.js, and the future search results page.

const API_BASE = (
  new URL(window.location.href).searchParams.get("api") ||
  "https://api.andrewzc.net"
).replace(/\/+$/, "");
let adminSessionPromise = null;
let editClickHandlerInstalled = false;

(function ensureResultsAdminStyle() {
  if (document.getElementById("results-admin-style")) return;
  const style = document.createElement("style");
  style.id = "results-admin-style";
  style.textContent = `
    .headlineWrap { position: relative; }
    .headlineWrap.hasActions .headline { padding-right: 220px; }

    .headerActions {
      position: absolute;
      top: 50%;
      right: 10px;
      transform: translateY(-50%);
      display: flex;
      gap: 10px;
      align-items: center;
      z-index: 20;
    }

    .pillToggle {
      font: 16pt Avenir;
      padding: 8px 24px;
      border-radius: 999px;
      border: 1px solid rgba(0,0,0,0.18);
      background: transparent;
      cursor: pointer;
    }

    .pillToggle.on {
      background: rgba(47,116,208,0.92);
      color: white;
      border-color: transparent;
    }

    .headerActions a.pillToggle {
      text-decoration: none;
      color: inherit;
    }

    .pillToggle:active { transform: translateY(1px); }
  `;
  document.head.appendChild(style);
})();

function ensureHeadlineWrap(headlineEl) {
  if (!headlineEl) return null;
  const parent = headlineEl.parentElement;
  if (parent?.classList?.contains("headlineWrap")) return parent;

  const wrap = document.createElement("div");
  wrap.className = "headlineWrap";
  parent?.insertBefore(wrap, headlineEl);
  wrap.appendChild(headlineEl);
  return wrap;
}

async function isAdminSession() {
  if (!adminSessionPromise) {
    adminSessionPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/me`, {
          method: "GET",
          credentials: "include",
          headers: { "Accept": "application/json" },
        });
        if (!res.ok) return false;

        const data = await res.json().catch(() => null);
        return !!data && data.authenticated === true;
      } catch (_) {
        return false;
      }
    })();
  }

  return adminSessionPromise;
}

function applyEditModeToDom(storageKey) {
  const editMode = sessionStorage.getItem(`editMode:${storageKey}`) === "1";
  document.body.classList.toggle("edit-mode", editMode);

  const links = document.querySelectorAll("a[data-entity-key][data-entity-list]");
  links.forEach((a) => {
    if (!a.dataset.viewHref) a.dataset.viewHref = a.getAttribute("href") || "#";

    if (editMode) {
      const key  = a.dataset.entityKey || "";
      const list = a.dataset.entityList || "";
      a.setAttribute("href", `edit.html?list=${encodeURIComponent(list)}&key=${encodeURIComponent(key)}`);
    } else {
      a.setAttribute("href", a.dataset.viewHref || "#");
    }
  });

  document.querySelectorAll(".headerActions .editToggle").forEach((btn) => {
    btn.classList.toggle("on", editMode);
  });
}

function ensureEditClickHandler() {
  if (editClickHandlerInstalled) return;
  editClickHandlerInstalled = true;

  document.addEventListener("click", (event) => {
    const link = event.target?.closest?.("a[data-entity-key][data-entity-list]");
    if (!link) return;
    if (!document.body.classList.contains("edit-mode")) return;

    const key = link.dataset.entityKey || "";
    const list = link.dataset.entityList || "";
    if (!key || !list) return;

    event.preventDefault();
    window.location.href = `edit.html?list=${encodeURIComponent(list)}&key=${encodeURIComponent(key)}`;
  });
}

function ensureAdminControls({ headlineEl, storageKey, infoPageId = null } = {}) {
  const headlineWrap = ensureHeadlineWrap(headlineEl);
  if (!headlineWrap) return;

  let actions = document.getElementById("headerActions") || headlineWrap.querySelector(".headerActions");
  if (!actions) {
    actions = UI.el("div", { className: "headerActions", id: "headerActions" });
    headlineWrap.appendChild(actions);
  }
  headlineWrap.classList.add("hasActions");

  if (infoPageId && !actions.querySelector(".pageInfoBtn")) {
    actions.appendChild(UI.el("a", {
      className: "pillToggle pageInfoBtn",
      href: `info.html?id=${encodeURIComponent(infoPageId)}`,
    }, "Info"));
  }

  if (!actions.querySelector(".editToggle")) {
    const editBtn = UI.el("button", {
      type: "button",
      className: "pillToggle editToggle",
      onclick: () => {
        const key = `editMode:${storageKey}`;
        const next = !(sessionStorage.getItem(key) === "1");
        sessionStorage.setItem(key, next ? "1" : "0");
        applyEditModeToDom(storageKey);
      },
    }, "Edit");
    actions.appendChild(editBtn);
  }

  applyEditModeToDom(storageKey);
}

async function enableAdminControls(options = {}) {
  const { storageKey } = options;
  if (!storageKey) return false;

  ensureEditClickHandler();

  const admin = await isAdminSession();
  if (!admin) {
    sessionStorage.setItem(`editMode:${storageKey}`, "0");
    applyEditModeToDom(storageKey);
    return false;
  }

  ensureAdminControls(options);
  return true;
}

// Fetch /pages and a data endpoint in parallel.
// Returns { pages, data } or throws.
async function fetchPagesAndJson(dataUrl, fetchOptions = {}) {
  const headers = {
    Accept: "application/json",
    ...(fetchOptions.headers || {}),
  };
  if (fetchOptions.body != null && headers["Content-Type"] == null) {
    headers["Content-Type"] = "application/json";
  }

  const [pagesRes, dataRes] = await Promise.all([
    fetch(`${API_BASE}/pages`, { headers: { Accept: "application/json" } }),
    fetch(dataUrl, { ...fetchOptions, headers }),
  ]);
  if (!pagesRes.ok) throw new Error(`Failed /pages: ${pagesRes.status}`);
  if (!dataRes.ok)  throw new Error(`Failed ${dataUrl}: ${dataRes.status}`);
  const pagesPayload = await pagesRes.json();
  const data         = await dataRes.json();
  return { pages: pagesPayload.pages || [], data };
}

async function fetchPagesAndData(dataUrl) {
  return fetchPagesAndJson(dataUrl);
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

function withPageIcons(entities, pages) {
  const pageMeta = new Map(
    (pages || [])
      .filter(p => p?.key)
      .map(p => [
        p.key,
        {
          icon: p.icon || p.emoji || "",
          hide: Array.isArray(p.tags) && p.tags.includes("regions"),
        },
      ])
  );

  return (entities || []).map((entity) => ({
    ...entity,
    pageIcon: entity?.pageIcon || pageMeta.get(entity?.list)?.icon || "",
    hide: entity?.hide === true || pageMeta.get(entity?.list)?.hide === true,
  }));
}

function scrollToHashAnchor() {
  const rawHash = window.location.hash || "";
  const id = decodeURIComponent(rawHash.replace(/^#/, ""));
  if (!id) return;

  const target = document.getElementById(id);
  if (target) target.scrollIntoView({ block: "start" });
}

// Render the page title, document.title, and visited line into headlineEl / captionEl.
function renderHeader(headlineEl, captionEl, { name, icons, been }) {
  const iconStr = Array.isArray(icons) ? icons.join(" ") : (icons || "");
  const title   = `${iconStr ? iconStr + " " : ""}${name}`;

  document.title         = title;
  headlineEl.textContent = title;

  if (typeof been === "boolean") {
    captionEl.appendChild(document.createTextNode(been ? "✅ Visited" : "📝 Not visited"));
    captionEl.appendChild(UI.br());
  }
}

function visitedFirstRows(rows) {
  const visited = [];
  const todo = [];

  for (const row of rows || []) {
    if (row?.been === false) todo.push(row);
    else visited.push(row);
  }

  return [...visited, ...todo];
}

function pagePathForKey(listKey) {
  return ["mosques", "synagogues"].includes(listKey) ? "page-rtl.html" : "page.html";
}

// Render a single section: anchor + icon + page link (+ count) + entity rows.
function renderSection(captionEl, page, hits, { pageName = null, maxItems = 10, dedupe = false } = {}) {
  const listKey  = page.key;
  const pageIcon = page.icon || page.emoji || "";
  const name     = page.name || listKey;
  const rows     = visitedFirstRows(dedupe ? UI.dedupeEntities(hits) : hits);
  const suppressTodoIcons = Array.isArray(page?.tags) && page.tags.includes("people");

  captionEl.appendChild(document.createTextNode(pageIcon ? `${pageIcon} ` : ""));

  const a = UI.el("a", { href: `${pagePathForKey(listKey)}?id=${encodeURIComponent(listKey)}`, className: "link", id: listKey });
  a.textContent = name;
  captionEl.appendChild(a);

  if (rows.length > maxItems) {
    captionEl.appendChild(document.createTextNode(` (${rows.length})`));
  }

  captionEl.appendChild(UI.br());

  for (const ent of rows.slice(0, maxItems)) {
    captionEl.appendChild(UI.renderEntityRow(ent, {
      ...(pageName ? { pageName } : {}),
      sectionKey: listKey,
      suppressTodoIcons,
    }));
  }
}

// Iterate pages, rendering a section for each that has hits.
// sort: null (pages array order) | "alphabetical" | "encounter" | "count" | "count-asc"
// Returns true if at least one section was rendered.
function renderSections(captionEl, pages, byList, options = {}) {
  const { pageName = null, maxItems = 10, dedupeLists = new Set(), sort = null } = options;
  let any = false;

  let orderedPages = pages;
  if (sort === "alphabetical") {
    orderedPages = pages
      .filter(p => byList.has(p?.key))
      .sort((a, b) => (a.name || a.key || "").localeCompare(b.name || b.key || "", undefined, { sensitivity: "base" }));
  } else if (sort === "encounter") {
    const pagesByKey = new Map(pages.filter(p => p?.key).map(p => [p.key, p]));
    orderedPages = [...byList.keys()].map(k => pagesByKey.get(k)).filter(Boolean);
  } else if (sort === "count") {
    orderedPages = pages
      .filter(p => byList.has(p?.key))
      .sort((a, b) => (byList.get(b.key)?.length || 0) - (byList.get(a.key)?.length || 0));
  } else if (sort === "count-asc") {
    orderedPages = pages
      .filter(p => byList.has(p?.key))
      .sort((a, b) => (byList.get(a.key)?.length || 0) - (byList.get(b.key)?.length || 0));
  }

  for (const page of orderedPages) {
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

  if (any) scrollToHashAnchor();
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
  fetchPagesAndJson,
  fetchPagesAndData,
  bucketByList,
  withPageIcons,
  scrollToHashAnchor,
  renderHeader,
  renderSection,
  renderSections,
  renderEmpty,
  renderError,
  enableAdminControls,
};
