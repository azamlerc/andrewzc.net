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

// -----------------------------
// Port of Entity.rowHTML() (entity.swift)
// -----------------------------
const FRACTIONS = new Set(["½", "¼", "¾", "⅛", "⅜", "⅝", "⅞"]);

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

  // link
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

function buildComparator(sortSpec) {
  // Examples: "name", "-size", "section,name", "-size,name"
  // Leading '-' means descending.
  const spec = (sortSpec || "").trim();
  const parts = spec ? spec.split(",").map(s => s.trim()).filter(Boolean) : [];

  // Default sort if none supplied
  if (parts.length === 0) {
    parts.push("name");
  }

  const keys = parts.map(p => {
    const descending = p.startsWith("-");
    const key = descending ? p.slice(1) : p;
    const numeric = ["size", "distance", "lat", "lon", "zoom", "clusterLevel"].includes(key);
    return { key, descending, numeric };
  });

  return (a, b) => {
    for (const k of keys) {
      const c = compareValues(a?.[k.key], b?.[k.key], { numeric: k.numeric, descending: k.descending });
      if (c !== 0) return c;
    }
    return 0;
  };
}

function sortedGroups(listInfo, entities, listCtx) {
  const list = [...entities];

  // Sort (supports specs like "name" or "-size"; leading '-' means descending)
  const comparator = buildComparator(listInfo.sort);
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
    const prefixDate = (e) => {
      const p = e.prefix ?? "20??";
      if (p.length === 4) return p + "-13-32";
      if (p.length === 7) return p + "-32";
      return p;
    };
    const future = list.filter(e => prefixDate(e) > today);
    const past = list.filter(e => prefixDate(e) <= today);
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

function renderPage(listInfo, entities) {
  const app = document.getElementById("app");
  clear(app);

  const icon = listInfo.icon || "❓";
  const name = listInfo.name || "Untitled";

  // Title
  document.title = `${icon} ${name}`;

  // Tags meta
  const tags = Array.isArray(listInfo.tags) ? [...listInfo.tags].sort() : [];
  const meta = ensureMeta("andrewzc");
  if (tags.length) meta.setAttribute("content", tags.join(", "));
  else meta.removeAttribute("content");

  // Headline(s)
  const headlineLines = (Array.isArray(listInfo.headlines) && listInfo.headlines.length > 0)
    ? listInfo.headlines
    : [name];

  const headline = el("div", { class: "headline" });
  headlineLines.forEach((h, i) => {
    if (i) headline.append(br());
    headline.append(text(`${icon} ${h}`));
  });
  app.append(headline);

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
    script: listInfo.script || null
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

// -----------------------------
// Boot: fetch JSON -> render full HTML
// -----------------------------
(async function main() {
  const app = document.getElementById("app");
  const pageId = getPageId();

  try {
    const data = await fetchPageData(pageId);

    // Your API response shape:
    // { "--info--": {...}, "entities": [...] }
    const info = data["--info--"] || {};
    window.pageInfo = info;
    const entities = Array.isArray(data.entities) ? data.entities : [];
    window.places = entities;
      
    renderPage(info, entities);
  } catch (err) {
    console.error(err);
    const app = document.getElementById("app");
    clear(app);
    app.append(
      el("div", { class: "headline" }, text("⚠️ Error")),
      el("div", { class: "items large" }, el("pre", { style: "white-space:pre-wrap" }, text(String(err?.stack || err))))
    );
    document.title = "Error";
  }
})();

function commented(text) {
  return document.createComment(text ?? "");
}
