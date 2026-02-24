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

function getApiBase() {
  // optional override: ?api=https://api.andrewzc.net
  const u = new URL(window.location.href);
  return u.searchParams.get("api") || "https://api.andrewzc.net";
}

async function fetchPageData(pageId) {
  const base = getApiBase().replace(/\/+$/, "");
  const url = `${base}/pages/${encodeURIComponent(pageId)}`;
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

    .newEntityBtn {
      font: 16pt Avenir;
      padding: 8px 24px;
      border-radius: 999px;
      border: 1px solid rgba(0,0,0,0.18);
      background: transparent;
      text-decoration: none;
      color: inherit;
      cursor: pointer;
    }

    .pillToggle:active, .newEntityBtn:active { transform: translateY(1px); }

    @media (prefers-color-scheme: dark) {
      .newEntityBtn { border-color: rgba(255,255,255,0.22); }
    }
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

function renderIcons(entity, listCtx) {
  const icons = Array.isArray(entity.icons) ? entity.icons.join(" ") : "";

  // Swift behavior: if flags present and flagClass == "icon", suppress icons.
  const flags = entity.flags;
  if (Array.isArray(flags) && flags.length > 0 && listCtx.flagClass === "icon") {
    return [commented(icons)];
  }

  return icons ? [text(icons)] : [];
}

function renderFlags(entity, listCtx) {
  if (!Array.isArray(entity.flags) || entity.flags.length === 0) return [];

  // Twin-* pages show TODO flags at 50% opacity (keyed off todoIcon).
  const isTodo = entity.been === false;
  const opacity = (listCtx.todoIcon && isTodo) ? 0.5 : 1;

  return entity.flags.map(f =>
    el("img", {
      class: listCtx.flagClass,
      src: `images/${listCtx.flagFolder}/${f}.png`,
      style: opacity < 1 ? `opacity:${opacity}` : null
    })
  );
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
      const inner = el("div", null, el("div", null, text(b)));
      return [i ? text(" ") : null, el("div", { class: "fraction" }, inner)].filter(Boolean);
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
  if (entity.reference && referenceFirst) {
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

  if (entity.reference && !referenceFirst) {
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

function compareCodeArrays(aCodes, bCodes) {
  // Swift's `lexicographicallyPrecedes` behavior.
  const a = Array.isArray(aCodes) ? aCodes.map(String) : [];
  const b = Array.isArray(bCodes) ? bCodes.map(String) : [];

  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] === b[i]) continue;
    const c = a[i].localeCompare(b[i], undefined, { numeric: true, sensitivity: "base" });
    if (c !== 0) return c;
  }

  if (a.length === b.length) return 0;
  return a.length < b.length ? -1 : 1;
}
function compareValues(av, bv, { numeric = false, descending = false } = {}) {
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
    out = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
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
    return { key, descending, numeric, isIcons, isCountries, isStates };
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
        c = compareValues(a?.[k.key], b?.[k.key], { numeric: k.numeric, descending: k.descending });
      }

      if (c !== 0) return c;
    }
    return 0;
  };
}

function sortedGroups(listInfo, entities, listCtx) {
  const list = [...entities];

  // Sort (supports specs like "name" or "-size"; leading '-' means descending)
  const comparator = buildComparator(listInfo.sort, listInfo.tags);
  list.sort(comparator);

  let groups = [list];

  // Swift branches:
  // todoIcon => groupPlaces(...) (not included in your snippet; skip unless you need it)
  if (listCtx.todoIcon) {
    // twin-cities / twin-stations: group adjacent items with same `.group`
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
  } else if (["place", "country"].includes(listInfo.type)) {
    const been = list.filter(e => e.been === true);
    const todo = list.filter(e => e.been === false);
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
      a.setAttribute("href", `edit.html?list=${encodeURIComponent(pageId)}&key=${encodeURIComponent(key)}`);
    } else {
      a.setAttribute("href", a.dataset.viewHref || "#");
    }
  });

  // Toggle header buttons
  const actions = document.querySelector(".headerActions");
  if (actions) {
    const editBtn = actions.querySelector("button.pillToggle");
    const newBtn = actions.querySelector("a.newEntityBtn");
    if (editBtn) editBtn.classList.toggle("on", !!editMode);
    if (newBtn) newBtn.style.display = editMode ? "inline-block" : "none";
  }
}

function ensureAdminControls(pageId) {
  const headlineWrap = document.querySelector(".headlineWrap");
  if (!headlineWrap) return;

  let actions = headlineWrap.querySelector(".headerActions");
  if (actions) return; // already mounted

  actions = el("div", { class: "headerActions" });

  const newBtn = el(
    "a",
    { class: "newEntityBtn", href: `edit.html?list=${encodeURIComponent(pageId)}` },
    text("New")
  );
  // hidden until edit mode is on
  newBtn.style.display = "none";

  const editBtn = el(
    "button",
    { type: "button", class: "pillToggle" },
    text("Edit")
  );

  editBtn.addEventListener("click", () => {
    const key = `editMode:${pageId}`;
    const next = !(sessionStorage.getItem(key) === "1");
    sessionStorage.setItem(key, next ? "1" : "0");
    applyEditModeToDom(pageId, next);
  });

  actions.append(newBtn, editBtn);
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

  // (No admin controls here; mounted after auth)

  app.append(headlineWrap);
  
  // Map container (map.js will read #map attributes)
  if (listInfo.map && typeof listInfo.map === "object") {
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
    app.append(el("div", { class: "caption" }, text(listInfo.header)));
  }

  const listCtx = {
    tags: Array.isArray(listInfo.tags) ? listInfo.tags : [],
    flagFolder: listInfo.flagFolder || "flags",
    flagClass: listInfo.flagClass || "state",
    prefixClass: listInfo.prefixClass || null,
    todoIcon: Boolean(listInfo.todoIcon),
    // subtle grouping for twin-* pages
    groupSeparator: (listInfo.todoIcon ? "gap" : "hr"),
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
      else items.append(el("div", { class: "group-gap" }));
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
    app.append(el("div", { class: "caption" }, text(listInfo.footer)));
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

  try {
    const data = await fetchPageData(pageId);

    const info = data["--info--"] || {};
    window.pageInfo = info;

    let entities = Array.isArray(data.entities) ? data.entities : [];

    window.__isAdmin = false;
    document.body.classList.remove("admin");
    const editKey = `editMode:${pageId}`;
    const storedEditMode = (sessionStorage.getItem(editKey) === "1");
    
    // Enrich with Swift-compatible computed property when sorting by prefixDate.
    const sortSpecRaw = info.sort;
    const sortSpecStr = Array.isArray(sortSpecRaw)
      ? sortSpecRaw.map(s => String(s)).join(",")
      : String(sortSpecRaw ?? "");

    if (sortSpecStr.includes("prefixDate")) {
      entities = entities.map(e => ({
        ...e,
        prefixDate: computePrefixDate(e?.prefix)
      }));
    }

    window.places = entities;

    renderPage(info, entities, { pageId, isAdmin: false, editMode: false });
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
