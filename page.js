// -----------------------------
// URL + fetch
// -----------------------------
function getPageId() {
  const u = new URL(window.location.href);
  const qs = u.searchParams.get("id");
  if (qs) return qs;

  // fallback: /apple or /apple.html
  const last = u.pathname.split("/").filter(Boolean).pop() || "";
  return last.replace(/\.html$/i, "") || "apple";
}

function getSortOverride() {
  const u = new URL(window.location.href);
  const raw = u.searchParams.get("sort");
  if (!raw) return [];
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

function getApiBase() {
  // optional override: ?api=https://api.andrewzc.net
  const u = new URL(window.location.href);
  return u.searchParams.get("api") || "https://api.andrewzc.net";
}

async function fetchPageData(pageId) {
  const base = getApiBase().replace(/\/+$/, "");
  const url = `${base}/pages/${encodeURIComponent(pageId)}/entities`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return await res.json();
}

// -----------------------------
// DOM helpers (idiomatic JS)
// -----------------------------
function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === "class") node.className = v;
      else if (k === "dataset") Object.assign(node.dataset, v);
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, String(v));
    }
  }
  for (const child of children.flat()) {
    if (child == null) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

function text(s) {
  return document.createTextNode(String(s ?? ""));
}

function br() {
  return document.createElement("br");
}

function smallSpace() {
  return el("div", { class: "smallSpace" }, br());
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function ensureMeta(name) {
  let m = document.querySelector(`meta[name="${name}"]`);
  if (!m) {
    m = document.createElement("meta");
    m.setAttribute("name", name);
    document.head.appendChild(m);
  }
  return m;
}

function ensureScript(src) {
  return new Promise((resolve, reject) => {
    // Already loaded?
    if ([...document.scripts].some(s => s.src && s.src.endsWith(src))) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = (e) => reject(e);
    document.body.appendChild(s);
  });
}

(function ensureGapStyle() {
  if (document.getElementById("group-gap-style")) return;
  const style = document.createElement("style");
  style.id = "group-gap-style";
  style.textContent = ".group-gap{height:12px;}";
  document.head.appendChild(style);
})();

(function ensureEditModeStyle() {
  if (document.getElementById("edit-mode-style")) return;
  const style = document.createElement("style");
  style.id = "edit-mode-style";
  style.textContent = `
    /* Header wrapper (we build this in JS) */
    .headlineWrap { position: relative; }

    /* Header actions: vertically centered with title */
    .headerActions {
      position: absolute;
      top: 50%;
      right: 10px;
      transform: translateY(-50%);
      display: flex;
      gap: 10px;
      align-items: center;
      z-index: 20; /* above .headline (z-index:10 in styles.css) */
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

// -----------------------------
// Port of Entity.rowHTML() (entity.swift)
// -----------------------------
const FRACTIONS = new Set(["½", "¼", "¾", "⅛", "⅜", "⅝", "⅞"]);

function computePrefixDate(prefix) {
  const p = (prefix ?? "20??");
  if (p == "20??") return "2099";
  if (String(p).length === 4) return `${p}-13-32`;
  if (String(p).length === 7) return `${p}-32`;
  return String(p);
}

function formatDistance(meters) {
  const m = Number(meters);
  if (!Number.isFinite(m)) return "";
  if (m >= 10_000) return `${(m / 1000).toFixed(1)}km`;
  return `${Math.round(m)}m`;
}

function entityCoords(entity) {
  const loc = entity?.location;
  if (loc?.type === "Point" && Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
    const [lon, lat] = loc.coordinates.map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }

  if (typeof entity?.coords === "string") {
    const parts = entity.coords.split(",").map(s => Number(s.trim()));
    if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      return { lat: parts[0], lon: parts[1] };
    }
  }

  return null;
}

function haversineMeters(a, b) {
  const R = 6_371_000;
  const toRad = (deg) => deg * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function effectiveSortSpec(sortSpec, sortOverride) {
  const base = normalizeSortParts(sortSpec, []);
  if (!Array.isArray(sortOverride) || sortOverride.length === 0) return base;
  return [...sortOverride, ...base];
}

function sortSpecIncludes(sortSpec, key) {
  return effectiveSortSpec(sortSpec, []).some(part => part.replace(/^[-+]/, "") === key);
}

async function getCurrentPosition() {
  if (!navigator.geolocation) {
    throw new Error("Geolocation is not supported by this browser.");
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lon: coords.longitude }),
      (err) => {
        if (err?.code === err.PERMISSION_DENIED) {
          reject(new Error("Location access was denied."));
        } else {
          reject(new Error("Could not get your location."));
        }
      }
    );
  });
}

function renderIcons(entity, listCtx) {
  const icons = Array.isArray(entity.icons) ? entity.icons.join(" ") : "";

  // Swift behavior: if flags present and flagClass == "icon", suppress icons.
  const flags = entity.flags;
  if (Array.isArray(flags) && flags.length > 0 && listCtx.flagClass === "icon") {
    return [commented(icons)];
  }

  if (!icons) return [];

  if (listCtx.todoIcon && entity.been === false) {
    return [el("span", { class: "todo" }, text(icons))];
  }

  return [text(icons)];
}

function renderFlags(entity, listCtx) {
  if (!Array.isArray(entity.flags) || entity.flags.length === 0) return [];

  // Twin-* pages show TODO flags at 50% opacity (keyed off todoIcon).
  const isTodo = entity.been === false;
  const flags = entity.flags.map(f =>
    el("img", {
      class: listCtx.flagClass,
      src: `images/${listCtx.flagFolder}/${f}.png`
    })
  );

  if (listCtx.todoIcon && isTodo) {
    return [el("span", { class: "todo" }, flags)];
  }

  return flags;
}

function renderBadges(entity, listCtx) {
  const badges = Array.isArray(entity.badges) ? [...entity.badges] : [];
  if (badges.length === 0) return [];

  if (!listCtx.tags.includes("fractions")) {
    return [text(" "), ...badges.flatMap((b, i) => [i ? text(" ") : null, text(b)])].filter(Boolean);
  }

  // Fractions: wrap fraction glyphs in nested divs like the Swift output
  return badges.flatMap((b, i) => {
    if (FRACTIONS.has(b)) {
      return [i ? text(" ") : null, el("div", { class: "fraction" }, el("div", null, text(b)))].filter(Boolean);
    }
    return [i ? text(" ") : null, text(b)].filter(Boolean);
  });
}

function renderRow(entity, listCtx) {
  const frag = document.createDocumentFragment();

  // prefix logic
  let prefix = entity.prefix ?? null;
  if (listCtx.tags.includes("size") && prefix == null && entity.size != null) {
    prefix = formatDistance(entity.size);
  }

  if (prefix != null) {
    if (listCtx.prefixClass) {
      frag.append(el("span", { class: listCtx.prefixClass }, text(prefix)), text(" "));
    } else {
      frag.append(text(prefix), text(" "));
    }
  }

  // icons
  const icons = renderIcons(entity, listCtx);
  if (icons.length) {
    frag.append(...icons, text(" "));
  }

  // flags
  const flags = renderFlags(entity, listCtx);
  if (flags.length) {
    flags.forEach((imgNode, idx) => {
      if (idx) frag.append(text(" "));
      frag.append(imgNode);
    });
    frag.append(text(" "));
  }

  const referenceFirst = listCtx.tags.includes("reference-first");
  const noReference = listCtx.tags.includes("no-reference");
  if (entity.reference && referenceFirst && !noReference) {
    frag.append(el("span", { class: "dark" }, text(entity.reference)), text(" "));
  }

  // link (always view link; edit link will be swapped in DOM if needed)
  frag.append(
    el(
      "a",
      {
        href: entity.link || "#",
        id: entity.key || null,
        class: entity.strike ? "strike" : null
      },
      text(entity.name || "untitled")
    )
  );

  if (entity.reference && !referenceFirst && !noReference) {
    frag.append(text(" "), el("span", { class: "dark" }, text(entity.reference)));
  }

  if (entity.info) {
    frag.append(text(" "), text(entity.info));
  }

  const badges = renderBadges(entity, listCtx);
  if (badges.length) {
    frag.append(text(" "), ...badges);
  }

  frag.append(br(), text("\n"));
  return frag;
}

// -----------------------------
// Port of List.sortedGroups() + pageHTML()
// -----------------------------
// Swift-compatible icon ordering: compass arrows clockwise from up.
const COMPASS_ARROW_RANK = new Map([
  ["⬆️", 0],
  ["↗️", 1],
  ["➡️", 2],
  ["↘️", 3],
  ["⬇️", 4],
  ["↙️", 5],
  ["⬅️", 6],
  ["↖️", 7]
]);

function compareIcons(a, b) {
  // Entities may store icons as an array of emoji strings.
  // Sort lexicographically by per-icon rank, then by raw string; shorter list first.
  const aa = Array.isArray(a) ? a.map(String) : [];
  const bb = Array.isArray(b) ? b.map(String) : [];

  const n = Math.min(aa.length, bb.length);
  for (let i = 0; i < n; i++) {
    const ar = COMPASS_ARROW_RANK.get(aa[i]) ?? 1000;
    const br = COMPASS_ARROW_RANK.get(bb[i]) ?? 1000;
    if (ar !== br) return ar < br ? -1 : 1;

    if (aa[i] !== bb[i]) {
      const c = aa[i].localeCompare(bb[i], undefined, { numeric: true, sensitivity: "base" });
      if (c !== 0) return c;
    }
  }

  if (aa.length === bb.length) return 0;
  return aa.length < bb.length ? -1 : 1;
}

function codesFromEntity(entity, pluralKey, singularKey) {
  const v = entity?.[pluralKey];
  if (Array.isArray(v)) return v.map(String);

  const s = entity?.[singularKey];
  if (typeof s === "string" && s.length) return [s];

  return [];
}

// Sort overrides for country codes whose ISO code doesn't match the common English name.
// Maps ISO 3166-1 alpha-2 → sort key used in place of the raw code.
const COUNTRY_SORT_OVERRIDES = {
  AE: "UAE",        // United Arab Emirates sorts as U, not A
  CH: "Switzerland", // Switzerland sorts as S, not C
  DE: "Germany",    // Germany sorts as G, not D
  ES: "Spain",      // Spain sorts as S, not E
  HR: "Croatia",    // Croatia sorts as C, not H
  MK: "North Macedonia", // North Macedonia sorts as N, not M
  RS: "Serbia",     // Serbia sorts as S, not R
};

function countrySortKey(code) {
  return COUNTRY_SORT_OVERRIDES[code] ?? code;
}

function compareCodeArrays(aCodes, bCodes) {
  // Swift's `lexicographicallyPrecedes` behavior, with sort key overrides applied.
  const a = Array.isArray(aCodes) ? aCodes.map(c => countrySortKey(String(c))) : [];
  const b = Array.isArray(bCodes) ? bCodes.map(c => countrySortKey(String(c))) : [];

  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] === b[i]) continue;
    const c = a[i].localeCompare(b[i], undefined, { numeric: true, sensitivity: "base" });
    if (c !== 0) return c;
  }

  if (a.length === b.length) return 0;
  return a.length < b.length ? -1 : 1;
}
function stripSortableArticle(value) {
  return String(value ?? "").replace(/^The\s+/i, "");
}

function compareValues(av, bv, { numeric = false, descending = false, ignoreLeadingThe = false } = {}) {
  const aU = av == null;
  const bU = bv == null;
  if (aU && bU) return 0;
  if (aU) return 1;
  if (bU) return -1;

  let out = 0;

  if (numeric) {
    const an = Number(av);
    const bn = Number(bv);
    const aBad = !Number.isFinite(an);
    const bBad = !Number.isFinite(bn);
    if (aBad && bBad) out = 0;
    else if (aBad) out = 1;
    else if (bBad) out = -1;
    else out = an === bn ? 0 : (an < bn ? -1 : 1);
  } else {
    const aValue = ignoreLeadingThe ? stripSortableArticle(av) : String(av);
    const bValue = ignoreLeadingThe ? stripSortableArticle(bv) : String(bv);
    out = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: "base" });
  }

  return descending ? -out : out;
}

function normalizeSortParts(sortSpec, tags) {
  let parts = [];

  // Accept:
  //   - string: "section,name" or "-size,name"
  //   - array:  ["section", "name"] or ["-size", "name"]
  if (Array.isArray(sortSpec)) {
    parts = sortSpec.map(s => String(s).trim()).filter(Boolean);
  } else {
    const spec = (typeof sortSpec === "string" ? sortSpec : "").trim();
    parts = spec ? spec.split(",").map(s => s.trim()).filter(Boolean) : [];
  }

  // Default sort if none supplied
  if (parts.length === 0) {
    // If reference-first tag is present, sort by reference then name
    if (Array.isArray(tags) && tags.includes("reference-first")) {
      parts.push("reference", "name");
    } else {
      parts.push("name");
    }
  }

  return parts;
}

function buildComparator(sortSpec, tags) {
  // Supports `sort` as either a string ("-size,name") or an array of strings (["-size","name"]).
  // Earlier keys take precedence; later keys break ties.
  const parts = normalizeSortParts(sortSpec, tags);

  const keys = parts.map(p => {
    // Leading '-' means descending. Leading '+' means explicit ascending.
    const descending = p.startsWith("-");
    const key = p.replace(/^[-+]/, "");
    const numeric = ["size", "distance", "lat", "lon", "zoom", "clusterLevel"].includes(key);
    const isIcons = (key === "icons");
    const isCountries = (key === "countries");
    const isStates = (key === "states");
    const valueKey = (key === "distance") ? "locationDistance" : key;
    return { key, valueKey, descending, numeric, isIcons, isCountries, isStates };
  });

  return (a, b) => {
    for (const k of keys) {
      let c = 0;

      if (k.isIcons) {
        c = compareIcons(a?.icons, b?.icons);
        if (k.descending) c = -c;
      } else if (k.isCountries) {
        const ac = codesFromEntity(a, "countries", "country");
        const bc = codesFromEntity(b, "countries", "country");
        c = compareCodeArrays(ac, bc);
        if (k.descending) c = -c;
      } else if (k.isStates) {
        const as = codesFromEntity(a, "states", "state");
        const bs = codesFromEntity(b, "states", "state");
        c = compareCodeArrays(as, bs);
        if (k.descending) c = -c;
      } else {
        c = compareValues(a?.[k.valueKey], b?.[k.valueKey], {
          numeric: k.numeric,
          descending: k.descending,
          ignoreLeadingThe: k.key === "name"
        });
      }

      if (c !== 0) return c;
    }
    return 0;
  };
}

function groupPlaces(entities) {
  const groups = [];
  let currentGroup = [];
  let lastGroupKey = Symbol("initial-group");

  for (const entity of entities) {
    const groupKey = entity?.group ?? null;
    if (currentGroup.length === 0 || groupKey === lastGroupKey) {
      currentGroup.push(entity);
    } else {
      groups.push(currentGroup);
      currentGroup = [entity];
    }
    lastGroupKey = groupKey;
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

function sortedGroups(listInfo, entities, listCtx) {
  const list = [...entities];

  // Sort (supports specs like "name" or "-size"; leading '-' means descending)
  const comparator = buildComparator(listInfo.sort, listInfo.tags);
  list.sort(comparator);

  let groups = [list];

  if (listCtx.todoIcon) {
    groups = groupPlaces(list);
  } else if (Array.isArray(listInfo.sections)) {
    const sections = listInfo.sections;
    groups = sections.map(section => list.filter(e => e.section === section));
    groups.push(list.filter(e => e.section == null || !sections.includes(e.section)));
  } else if (listInfo.group === "date") {
    const today = new Date().toISOString().slice(0, 10);
    const future = list.filter(e => e.prefixDate > today);
    const past = list.filter(e => e.prefixDate <= today);
    groups = [future, past];
  } else if (typeof listInfo.nearDistance === "number") {
    const nearDistance = listInfo.nearDistance;
    const been = list.filter(e => e.been === true && (Number(e.distance) || 0) < nearDistance);
    const near = list.filter(e => e.been === true && (Number(e.distance) || 0) >= nearDistance);
    const todo = list.filter(e => e.been === false);
    groups = [been, near, todo];
  } else if (listCtx.tags.includes("people")) {
    // People lists: been is not meaningful; render everything in one section.
    groups = [list];
  } else if (["place", "country"].includes(listInfo.type)) {
    const been = list.filter(e => e.been === true);
    const todo = list.filter(e => e.been === false || e.been == null);
    if (todo.length > 0) groups = [been, todo];
  }

  return groups;
}

// --- DOM-based admin controls and edit mode toggling ---
function applyEditModeToDom(pageId, editMode) {
  document.body.classList.toggle("edit-mode", !!editMode);

  // Swap entity row links in-place.
  const links = document.querySelectorAll(".items a[id]");
  links.forEach(a => {
    if (!a.dataset.viewHref) a.dataset.viewHref = a.getAttribute("href") || "#";
    if (editMode) {
      const key = a.getAttribute("id") || "";
      const editList = window.pageInfo?.propertyOf || pageId;
      a.setAttribute("href", `edit.html?list=${encodeURIComponent(editList)}&key=${encodeURIComponent(key)}`);
    } else {
      a.setAttribute("href", a.dataset.viewHref || "#");
    }
  });

  // Toggle header buttons
  const actions = document.querySelector(".headerActions");
  if (actions) {
    const editBtn = actions.querySelector(".editToggle");
    if (editBtn) editBtn.classList.toggle("on", !!editMode);
  }
}

function ensureAdminControls(pageId) {
  const headlineWrap = document.querySelector(".headlineWrap");
  if (!headlineWrap) return;

  let actions = headlineWrap.querySelector(".headerActions");
  if (actions) return; // already mounted

  actions = el("div", { class: "headerActions" });

  const infoBtn = el(
    "a",
    { class: "pillToggle pageInfoBtn", href: `info.html?id=${encodeURIComponent(pageId)}` },
    text("Info")
  );

  const newBtn = el(
    "a",
    { class: "pillToggle newEntityBtn", href: `edit.html?list=${encodeURIComponent(pageId)}` },
    text("New")
  );

  const editBtn = el(
    "button",
    { type: "button", class: "pillToggle editToggle" },
    text("Edit")
  );

  editBtn.addEventListener("click", () => {
    const key = `editMode:${pageId}`;
    const next = !(sessionStorage.getItem(key) === "1");
    sessionStorage.setItem(key, next ? "1" : "0");
    applyEditModeToDom(pageId, next);
  });

  actions.append(infoBtn, newBtn, editBtn);
  headlineWrap.append(actions);

  // Apply stored state (if any)
  const stored = (sessionStorage.getItem(`editMode:${pageId}`) === "1");
  applyEditModeToDom(pageId, stored);
}

function renderPage(listInfo, entities, { pageId, isAdmin, editMode }) {
  const app = document.getElementById("app");
  clear(app);

  document.body.classList.toggle("edit-mode", !!editMode);

  const icon = listInfo.icon || "❓";
  const name = listInfo.name || "Untitled";

  // Title
  document.title = `${icon} ${name}`;

  // Tags meta
  const tags = Array.isArray(listInfo.tags) ? [...listInfo.tags].sort() : [];
  const meta = ensureMeta("andrewzc");
  if (tags.length) meta.setAttribute("content", tags.join(", "));
  else meta.removeAttribute("content");

  const headlineLines = (Array.isArray(listInfo.headlines) && listInfo.headlines.length > 0)
    ? listInfo.headlines
    : [name];

  // Headline(s)
  const headline = el("div", { class: "headline" });

  headlineLines.forEach((h, i) => {
    if (i) headline.append(br());
    headline.append(text(`${icon} ${h}`));
  });

  // (No inline EDIT badge)

  const headlineWrap = el("div", { class: "headlineWrap" }, headline);
  const hasMap = Boolean(listInfo.map && typeof listInfo.map === "object");

  // (No admin controls here; mounted after auth)

  app.append(headlineWrap);

  // Map container (map.js will read #map attributes)
  if (hasMap) {
    const fields = ["lat", "lon", "zoom", "cluster", "clusterLevel", "icon", "lines"];
    const attrs = { id: "map" };
    for (const f of fields) {
      if (listInfo.map[f] != null) attrs[f] = listInfo.map[f];
    }
    app.append(el("div", attrs));

    // Load map.js (once)
    // map.js can now reuse window.pageInfo / window.places without fetching data/*.json
    ensureScript("map.js").catch(() => {});
  }

  // Optional header caption
  if (listInfo.header) {
    const headerEl = el("div", { class: "caption" });
    headerEl.innerHTML = listInfo.header;
    app.append(headerEl);

    if (!hasMap && listInfo.size === "small") {
      app.append(smallSpace());
    }
  }

  const listCtx = {
    tags: Array.isArray(listInfo.tags) ? listInfo.tags : [],
    flagFolder: listInfo.flagFolder || "flags",
    flagClass: listInfo.flagClass || "state",
    // "fixed" is the default; individual pages can override by setting prefixClass explicitly
    prefixClass: listInfo.prefixClass || "fixed",
    todoIcon: Boolean(listInfo.todoIcon) || (Array.isArray(listInfo.tags) && listInfo.tags.includes("todo-icon")),
    // subtle grouping for twin-* pages
    groupSeparator: ((Boolean(listInfo.todoIcon) || (Array.isArray(listInfo.tags) && listInfo.tags.includes("todo-icon"))) ? "gap" : "hr"),
    header: listInfo.header || null,
    footer: listInfo.footer || null,
    headlines: listInfo.headlines || null,
    script: listInfo.script || null,
    editMode: !!editMode,
    listId: pageId
  };

  const items = el("div", { class: `items ${listInfo.size || "large"}` });
  app.append(items);

  const groups = sortedGroups(listInfo, entities, listCtx);
  const headers = Array.isArray(listInfo.headers) ? listInfo.headers : null;

  groups.forEach((group, idx) => {
    if (!group || group.length === 0) return;

    if (idx > 0) {
      if (listCtx.groupSeparator === "hr") items.append(el("hr"));
      else items.append(smallSpace());
    }

    if (headers && idx < headers.length) {
      items.append(el("div", { class: "caption" }, text(headers[idx])));
    }

    for (const e of group) {
      items.append(renderRow(e, listCtx));
    }
  });

  // Optional footer caption
  if (listInfo.footer) {
    const footerEl = el("div", { class: "caption" });
    footerEl.innerHTML = listInfo.footer;
    app.append(footerEl);
  }

  // Optional per-page script
  if (listInfo.script) {
    ensureScript(listInfo.script).catch(() => {});
  }
}

async function isAdminSession() {
  // Uses the canonical endpoint. Requires cross-site cookies to be allowed for api.andrewzc.net.
  try {
    const base = getApiBase().replace(/\/+$/, "");
    const res = await fetch(`${base}/admin/me`, {
      method: "GET",
      credentials: "include",
      headers: { "Accept": "application/json" }
    });
    if (!res.ok) return false;

    const data = await res.json().catch(() => null);
    return !!data && data.authenticated === true;
  } catch (_) {
    return false;
  }
}

// -----------------------------
// Boot: fetch JSON -> render full HTML
// -----------------------------
(async function main() {
  const app = document.getElementById("app");
  const pageId = getPageId();
  const sortOverride = getSortOverride();

  try {
    const data = await fetchPageData(pageId);

    const info = data["--info--"] || {};
    const effectiveSort = effectiveSortSpec(info.sort, sortOverride);
    const renderInfo = { ...info, sort: effectiveSort };
    window.pageInfo = info;

    let entities = Array.isArray(data.entities) ? data.entities : [];

    window.__isAdmin = false;
    document.body.classList.remove("admin");
    const editKey = `editMode:${pageId}`;
    const storedEditMode = (sessionStorage.getItem(editKey) === "1");
    
    // Enrich with Swift-compatible computed property when sorting by prefixDate.
    const sortSpecRaw = effectiveSort;
    const sortSpecStr = Array.isArray(sortSpecRaw)
      ? sortSpecRaw.map(s => String(s)).join(",")
      : String(sortSpecRaw ?? "");

    if (sortSpecStr.includes("prefixDate")) {
      entities = entities.map(e => ({
        ...e,
        prefixDate: computePrefixDate(e?.prefix)
      }));
    }

    if (sortSpecIncludes(effectiveSort, "distance")) {
      const origin = await getCurrentPosition();
      entities = entities.map(e => {
        const point = entityCoords(e);
        return {
          ...e,
          locationDistance: point ? haversineMeters(origin, point) : e.locationDistance
        };
      });
    }

    window.places = entities;

    window.pageInfo = renderInfo;
    renderPage(renderInfo, entities, { pageId, isAdmin: false, editMode: false });
    applyEditModeToDom(pageId, false);

    // Background admin check (do NOT re-render the whole page — it breaks Leaflet by recreating #map).
    isAdminSession().then((admin) => {
      window.__isAdmin = !!admin;
      document.body.classList.toggle("admin", !!admin);

      if (admin) {
        ensureAdminControls(pageId);
      } else {
        sessionStorage.setItem(editKey, "0");
      }
    });
  } catch (err) {
    console.error(err);
    const app = document.getElementById("app");
    clear(app);
    app.append(
      el("div", { class: "headline" }, text("⚠️ Error")),
      el("div", { class: "items large" }, el("pre", { style: "white-space:pre-wrap" }, text(String(err?.stack || err))))
    );
    document.body.classList.remove("edit-mode");
    document.title = "Error";
  }
})();

function commented(text) {
  return document.createComment(text ?? "");
}
