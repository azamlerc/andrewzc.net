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

const FILTER_SORT_OPTIONS = [
  { value: "", label: "Default" },
  { value: "name", label: "Name" },
  { value: "reference", label: "Reference" },
  { value: "distance", label: "Distance" },
  { value: "countries", label: "Country" },
  { value: "states", label: "State" },
];

function hasEntityFilters() {
  const u = new URL(window.location.href);
  return !!(u.searchParams.get("q") || u.searchParams.get("country") || u.searchParams.get("sort"));
}

function getEntityFilterState() {
  const u = new URL(window.location.href);
  const q = (u.searchParams.get("q") || "").trim();
  const countries = (u.searchParams.get("country") || "")
    .split(",")
    .map(code => code.trim().toUpperCase())
    .filter(Boolean);
  const sortParts = getSortOverride();
  const firstSort = sortParts[0] || "";
  const reverse = firstSort.startsWith("-");
  const normalizedSort = firstSort.replace(/^[-+]/, "");
  const supportedSorts = new Set(FILTER_SORT_OPTIONS.map(option => option.value).filter(Boolean));
  const sort = supportedSorts.has(normalizedSort) ? normalizedSort : "";

  return {
    q,
    countries: Array.from(new Set(countries)),
    sort,
    reverse: sort ? reverse : false,
  };
}

function getApiBase() {
  // optional override: ?api=https://api.andrewzc.net
  const u = new URL(window.location.href);
  return u.searchParams.get("api") || "https://api.andrewzc.net";
}

async function fetchPageData(pageId) {
  const pageUrl = new URL(window.location.href);
  const base = getApiBase().replace(/\/+$/, "");
  const apiUrl = new URL(`${base}/pages/${encodeURIComponent(pageId)}/entities`);

  const q = pageUrl.searchParams.get("q");
  const country = pageUrl.searchParams.get("country");
  if (q) apiUrl.searchParams.set("q", q);
  if (country) apiUrl.searchParams.set("country", country);

  const url = apiUrl.toString();
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return await res.json();
}

async function fetchPageCountries(pageId) {
  const base = getApiBase().replace(/\/+$/, "");
  const url = `${base}/pages/${encodeURIComponent(pageId)}/countries`;
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

function htmlFragment(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html ?? "");
  return template.content.cloneNode(true);
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

(function ensureFilterOverlayStyle() {
  if (document.getElementById("filter-overlay-style")) return;
  const style = document.createElement("style");
  style.id = "filter-overlay-style";
  style.textContent = `
    .pillToggle.filterToggle.active {
      background: rgba(47,116,208,0.92);
      color: white;
      border-color: transparent;
    }

    .filterBackdrop {
      position: fixed;
      inset: 0;
      background: rgba(255,255,255,0.72);
      backdrop-filter: blur(10px);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 72px 24px 32px;
      z-index: 1000;
      box-sizing: border-box;
    }

    .filterPanel {
      width: min(760px, calc(100vw - 48px));
      max-height: calc(100vh - 104px);
      overflow: auto;
      background: rgba(255,255,255,0.97);
      border: 1px solid rgba(0,0,0,0.08);
      border-radius: 34px;
      box-shadow: 0 28px 80px rgba(0,0,0,0.15);
      padding: 28px 30px 30px;
      box-sizing: border-box;
    }

    .filterPanelHeader {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 26px;
    }

    .filterPanelTitle {
      font: 28pt Avenir;
      color: black;
    }

    .filterPanelSubtitle {
      font: 14pt Avenir;
      color: #8a8a8a;
    }

    .filterClose {
      font: 16pt Avenir;
      padding: 8px 18px;
      border-radius: 999px;
      border: 1px solid rgba(0,0,0,0.12);
      background: transparent;
      cursor: pointer;
      color: #666;
    }

    .filterHeaderMain {
      min-width: 0;
      flex: 1;
    }

    .filterField {
      margin-bottom: 24px;
    }

    .filterLabel {
      display: block;
      margin-bottom: 10px;
      font: 14pt Avenir;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #777;
    }

    .filterSearchInput {
      width: 100%;
      font: 20pt Avenir;
      color: black;
      padding: 16px 20px;
      border-radius: 22px;
      border: 1px solid rgba(0,0,0,0.12);
      background: rgba(247,247,247,0.95);
      box-sizing: border-box;
      outline: none;
    }

    .filterSearchInput:focus {
      border-color: rgba(47,116,208,0.4);
      box-shadow: 0 0 0 4px rgba(47,116,208,0.08);
      background: white;
    }

    .filterSortRow {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }

    .filterSortSelect {
      min-width: 220px;
      font: 18pt Avenir;
      color: black;
      padding: 12px 18px;
      border-radius: 18px;
      border: 1px solid rgba(0,0,0,0.12);
      background: rgba(247,247,247,0.95);
      box-sizing: border-box;
      outline: none;
    }

    .filterSortSelect:focus {
      border-color: rgba(47,116,208,0.4);
      box-shadow: 0 0 0 4px rgba(47,116,208,0.08);
      background: white;
    }

    .filterCheckbox {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font: 15pt Avenir;
      color: #555;
      padding: 12px 16px;
      border-radius: 18px;
      border: 1px solid rgba(0,0,0,0.08);
      background: rgba(249,249,249,0.92);
      cursor: pointer;
    }

    .filterCheckbox input {
      width: 18px;
      height: 18px;
      margin: 0;
      accent-color: rgba(47,116,208,0.94);
    }

    .filterCountryGrid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px;
      margin-top: 12px;
    }

    .filterCountryOption {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 20px;
      border: 1px solid rgba(0,0,0,0.08);
      background: rgba(249,249,249,0.92);
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
    }

    .filterCountryOption:hover {
      transform: translateY(-1px);
      border-color: rgba(0,0,0,0.14);
      background: white;
    }

    .filterCountryOption.selected {
      background: rgba(47,116,208,0.1);
      border-color: rgba(47,116,208,0.28);
    }

    .filterCountryOption input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }

    .filterCountryIcon {
      font-size: 24pt;
      line-height: 1;
    }

    .filterCountryMeta {
      min-width: 0;
      flex: 1;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .filterCountryName {
      font: 15pt Avenir;
      color: black;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    }

    .filterCountryCount {
      font: 12pt "SF Mono", Menlo;
      color: #7a7a7a;
      margin-left: auto;
      white-space: nowrap;
    }

    .filterPanelFooter {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-top: 28px;
      padding-top: 18px;
      border-top: 1px solid rgba(0,0,0,0.07);
    }

    .filterSummary {
      font: 14pt Avenir;
      color: #8a8a8a;
      margin-top: 6px;
    }

    .filterActions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .filterAction {
      font: 16pt Avenir;
      padding: 10px 22px;
      min-width: 92px;
      border-radius: 999px;
      border: 1px solid rgba(0,0,0,0.12);
      background: transparent;
      cursor: pointer;
      color: #555;
    }

    .filterAction.primary {
      background: rgba(47,116,208,0.94);
      border-color: rgba(47,116,208,0.94);
      color: white;
    }

    .filterStatus {
      font: 16pt Avenir;
      color: #888;
      padding: 10px 2px;
    }

    @media (max-width: 700px) {
      .filterBackdrop {
        padding: 18px 14px 14px;
        align-items: stretch;
      }

      .filterPanel {
        width: 100%;
        max-height: 100%;
        border-radius: 26px;
        padding: 22px 18px 24px;
      }

      .filterPanelHeader,
      .filterPanelFooter {
        display: block;
      }

      .filterActions {
        margin-top: 16px;
        justify-content: stretch;
      }

      .filterAction,
      .filterClose,
      .filterSortSelect {
        width: 100%;
      }

      .filterCheckbox {
        width: 100%;
        box-sizing: border-box;
      }
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

function countryCodeFromFlagEmoji(icon) {
  const cps = Array.from(String(icon || ""));
  if (cps.length !== 2) return null;

  const a = cps[0].codePointAt(0);
  const b = cps[1].codePointAt(0);
  const A = 0x1F1E6;
  const Z = 0x1F1FF;
  if (a < A || a > Z || b < A || b > Z) return null;

  return String.fromCharCode(
    "A".charCodeAt(0) + (a - A),
    "A".charCodeAt(0) + (b - A)
  );
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

function effectiveSortSpec(sortSpec, sortOverride, tags = []) {
  const base = normalizeSortParts(sortSpec, tags);
  if (!Array.isArray(sortOverride) || sortOverride.length === 0) return base;
  return [...sortOverride, ...base];
}

function sortSpecIncludes(sortSpec, key, tags = []) {
  return effectiveSortSpec(sortSpec, [], tags).some(part => part.replace(/^[-+]/, "") === key);
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
  const icons = Array.isArray(entity.icons) ? entity.icons : [];

  // Swift behavior: if flags present and flagClass == "icon", suppress icons.
  const flags = entity.flags;
  if (Array.isArray(flags) && flags.length > 0 && listCtx.flagClass === "icon") {
    return [commented(icons.join(" "))];
  }

  if (icons.length === 0) return [];

  const iconNodes = icons.flatMap((icon, idx) => {
    const code = countryCodeFromFlagEmoji(icon);
    const sectionHash = listCtx.listId ? `#${encodeURIComponent(listCtx.listId)}` : "";
    const node = code
      ? el("a", { href: `country.html?code=${encodeURIComponent(code.toLowerCase())}${sectionHash}` }, text(icon))
      : text(icon);
    return idx ? [text(" "), node] : [node];
  });

  if (listCtx.todoIcon && entity.been === false) {
    return [el("span", { class: "todo" }, iconNodes)];
  }

  return iconNodes;
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

function fullImageUrl(listId, filename) {
  const raw = `https://images.andrewzc.net/${listId}/${filename}`;
  return raw.includes(".pdf.") ? raw.slice(0, raw.indexOf(".pdf.") + 4) : raw;
}

function thumbImageUrl(listId, filename) {
  return `https://images.andrewzc.net/${listId}/tn/${filename}`;
}

function shuffleCopy(arr, rng = Math.random) {
  const copy = Array.isArray(arr) ? arr.slice() : [];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickRandom(arr, count, rng = Math.random) {
  if (!Array.isArray(arr) || count <= 0) return [];
  if (arr.length <= count) return arr.slice();
  return shuffleCopy(arr, rng).slice(0, count);
}

function pickRowImages(entity, listCtx) {
  const images = Array.isArray(entity?.images) ? entity.images.filter(Boolean) : [];
  if (images.length === 0) return [];

  if (listCtx.listId === "metros") {
    const [first, ...rest] = images;
    return first ? [first, ...pickRandom(rest, 2)] : [];
  }

  return pickRandom(images, 3);
}

function buildRowRenderState(entity, listCtx) {
  const chosenImages = pickRowImages(entity, listCtx);
  return {
    chosenImages,
    hasCaption: Boolean(entity?.caption),
  };
}

function highlightDistanceCaption(el) {
  const escapeHTML = s =>
    s.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));

  const DIST_RE = /\b(?:\d+(?:[.,]\d+)?\skm|\d+m|exact)\b/gi;
  const raw = el.textContent || "";
  const escaped = escapeHTML(raw);
  const matches = [...escaped.matchAll(DIST_RE)];
  if (matches.length === 0) return;

  const lastMatch = matches[matches.length - 1];
  el.innerHTML =
    escaped.slice(0, lastMatch.index) +
    `<span class="dark">${lastMatch[0]}</span>` +
    escaped.slice(lastMatch.index + lastMatch[0].length);
}

function simplifyForReference(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/’/g, "")
    .replace(/\./g, "")
    .replace(/,/g, "")
    .replace(/\*/g, "")
    .replace(/"/g, "")
    .replace(/</g, "")
    .replace(/>/g, "")
    .replace(/\(/g, "")
    .replace(/\)/g, "")
    .replace(/\//g, "-")
    .replace(/&/g, "-")
    .replace(/–/g, "-")
    .replace(/—/g, "-")
    .replace(/---/g, "-")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/the-/, "");
}

function renderReference(reference, listCtx) {
  const value = String(reference || "");
  if (!value) return null;

  if (listCtx.tags.includes("city-reference")) {
    return el("a", { href: `city.html?city=${encodeURIComponent(simplifyForReference(value))}`, class: "dark" }, text(value));
  }

  if (listCtx.tags.includes("artist-reference")) {
    return el("a", { href: `artist.html?id=${encodeURIComponent(simplifyForReference(value))}`, class: "dark" }, text(value));
  }

  return el("span", { class: "dark" }, text(value));
}

function renderRow(entity, listCtx, renderState = null) {
  const frag = document.createDocumentFragment();
  const state = renderState || buildRowRenderState(entity, listCtx);
  const chosenImages = state.chosenImages;
  const entityHref = listCtx.listId === "cities"
    ? `city.html?city=${encodeURIComponent(entity.key || "")}`
    : listCtx.listId === "countries"
      ? `country.html?code=${encodeURIComponent(entity.country || "")}`
      : (entity.link || "#");

  if (chosenImages.length) {
    const imagesDiv = el("div", { class: "images" });
    chosenImages.forEach((filename) => {
      const full = fullImageUrl(listCtx.listId, filename);
      const thumb = thumbImageUrl(listCtx.listId, filename);
      imagesDiv.append(
        el(
          "a",
          { href: full, target: "_blank", rel: "noopener" },
          el("img", { src: thumb, alt: entity.name || "image" })
        )
      );
    });
    frag.append(imagesDiv);
  }

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
    frag.append(renderReference(entity.reference, listCtx), text(" "));
  }

  // link (always view link; edit link will be swapped in DOM if needed)
  frag.append(
    el(
      "a",
      {
        href: entityHref,
        id: entity.key || null,
        class: [entity.strike ? "strike" : null, chosenImages.length ? "withImages" : null].filter(Boolean).join(" ") || null
      },
      text(entity.name || "untitled")
    )
  );

  if (entity.reference && !referenceFirst && !noReference) {
    frag.append(text(" "), renderReference(entity.reference, listCtx));
  }

  if (entity.info) {
    frag.append(text(" "), htmlFragment(entity.info));
  }

  const badges = renderBadges(entity, listCtx);
  if (badges.length) {
    frag.append(text(" "), ...badges);
  }

  frag.append(br(), text("\n"));

  if (state.hasCaption) {
    const caption = el("div", { class: "caption" }, text(entity.caption));
    highlightDistanceCaption(caption);
    if (entity.challenge != null) {
      const CIRCLED = ["\u24EA", "\u2460", "\u2461", "\u2462", "\u2463", "\u2464", "\u2465"];
      const glyph = CIRCLED[Math.min(Math.max(Math.round(entity.challenge), 0), 6)] ?? "";
      if (glyph) caption.append(text(" " + glyph));
    }
    frag.append(caption);
  }

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

function compareIconCount(a, b) {
  const aCount = Array.isArray(a) ? a.length : 0;
  const bCount = Array.isArray(b) ? b.length : 0;
  if (aCount === bCount) return 0;
  return aCount < bCount ? -1 : 1;
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

const FILTER_COUNTRY_NAME_OVERRIDES = {
  "United States": "USA",
  "United Kingdom": "UK",
  "Bosnia and Herzegovina": "Bosnia",
  "North Macedonia": "Macedonia",
};

function countrySortKey(code) {
  return COUNTRY_SORT_OVERRIDES[code] ?? code;
}

function shortFilterCountryName(name) {
  const value = String(name || "");
  return FILTER_COUNTRY_NAME_OVERRIDES[value] || value;
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

function compareCoords(aEntity, bEntity, descending = false) {
  const a = entityCoords(aEntity);
  const b = entityCoords(bEntity);

  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const latCompare = compareValues(a.lat, b.lat, { numeric: true, descending: true });
  if (latCompare !== 0) return descending ? -latCompare : latCompare;

  const lonCompare = compareValues(a.lon, b.lon, { numeric: true, descending: false });
  if (lonCompare !== 0) return descending ? -lonCompare : lonCompare;

  return 0;
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
    const key = p.replace(/^[-+]/, "");
    const descending = p.startsWith("-") || (!/^[+-]/.test(p) && key === "iconCount");
    const numeric = ["size", "distance", "lat", "lon", "zoom", "clusterLevel"].includes(key);
    const isIcons = (key === "icons");
    const isIconCount = (key === "iconCount");
    const isCountries = (key === "countries");
    const isStates = (key === "states");
    const isCoords = (key === "coords");
    const valueKey = (key === "distance") ? "locationDistance" : key;
    return { key, valueKey, descending, numeric, isIcons, isIconCount, isCountries, isStates, isCoords };
  });

  return (a, b) => {
    for (const k of keys) {
      let c = 0;

      if (k.isIcons) {
        c = compareIcons(a?.icons, b?.icons);
        if (k.descending) c = -c;
      } else if (k.isIconCount) {
        c = compareIconCount(a?.icons, b?.icons);
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
      } else if (k.isCoords) {
        c = compareCoords(a, b, k.descending);
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
    const ungrouped = list.filter(e => e.section == null || !sections.includes(e.section));
    const ungroupedBeen = ungrouped.filter(e => e.been === true);
    const sectionGroups = sections.map(section => list.filter(e => e.section === section));
    const ungroupedTodo = ungrouped.filter(e => e.been === false || e.been == null);
    groups = [ungroupedBeen, ...sectionGroups, ungroupedTodo];
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
  } else if (["place", "country", "city"].includes(listInfo.type)) {
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

function getBasePageUrl(pageId) {
  const url = new URL(window.location.href);
  url.searchParams.delete("q");
  url.searchParams.delete("country");
  url.searchParams.delete("sort");

  if (url.searchParams.get("id")) {
    url.searchParams.set("id", pageId);
  }

  return url;
}

function buildFilteredPageUrl(pageId, filters) {
  const url = getBasePageUrl(pageId);
  const q = String(filters?.q || "").trim();
  const countries = Array.from(new Set(
    (Array.isArray(filters?.countries) ? filters.countries : [])
      .map(code => String(code || "").trim().toUpperCase())
      .filter(Boolean)
  ));
  const sort = String(filters?.sort || "").trim();
  const reverse = !!filters?.reverse;

  if (q) url.searchParams.set("q", q);
  if (countries.length > 0) url.searchParams.set("country", countries.join(",").toLowerCase());
  if (sort) url.searchParams.set("sort", `${reverse ? "-" : ""}${sort}`);

  return url;
}

function describeFilterState(filters) {
  const q = String(filters?.q || "").trim();
  const countries = Array.isArray(filters?.countries) ? filters.countries.filter(Boolean) : [];
  const sort = String(filters?.sort || "").trim();
  const reverse = !!filters?.reverse;
  const parts = [];

  if (q) parts.push(`query "${q}"`);
  if (sort) {
    const option = FILTER_SORT_OPTIONS.find(item => item.value === sort);
    const label = option ? option.label.toLowerCase() : sort;
    parts.push(reverse ? `${label} reversed` : `sorted by ${label}`);
  }
  if (countries.length === 1) parts.push("1 country");
  else if (countries.length > 1) parts.push(`${countries.length} countries`);

  return parts.length > 0 ? parts.join(" and ") : "No filters applied";
}

function ensureHeaderActions(pageId) {
  const headlineWrap = document.querySelector(".headlineWrap");
  if (!headlineWrap) return;

  let actions = headlineWrap.querySelector(".headerActions");
  if (actions) return actions;

  actions = el("div", { class: "headerActions" });
  const filterBtn = el(
    "button",
    { type: "button", class: "pillToggle filterToggle" },
    text("Filter")
  );

  filterBtn.addEventListener("click", () => {
    openFilterOverlay(pageId);
  });

  actions.append(filterBtn);
  headlineWrap.append(actions);
  syncFilterButtonState(actions);
  return actions;
}

function ensureAdminControls(pageId) {
  const actions = ensureHeaderActions(pageId);
  if (!actions) return;

  if (actions.querySelector(".pageInfoBtn")) {
    const stored = (sessionStorage.getItem(`editMode:${pageId}`) === "1");
    applyEditModeToDom(pageId, stored);
    return;
  }

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

  // Apply stored state (if any)
  const stored = (sessionStorage.getItem(`editMode:${pageId}`) === "1");
  applyEditModeToDom(pageId, stored);
}

function syncFilterButtonState(scope = document) {
  const btn = scope.querySelector ? scope.querySelector(".filterToggle") : null;
  if (!btn) return;

  const active = hasEntityFilters();
  btn.classList.toggle("active", active);
  btn.textContent = "Filter";
}

function buildCountryOption(country, selectedCodes) {
  const code = String(country?.country || "").toUpperCase();
  const checked = selectedCodes.has(code);
  const label = el("label", {
    class: `filterCountryOption${checked ? " selected" : ""}`,
    dataset: { code }
  });
  const input = el("input", {
    type: "checkbox",
    value: code,
    checked: checked ? "checked" : null
  });
  const icon = el("span", { class: "filterCountryIcon" }, text(country?.icon || " "));
  const meta = el(
    "span",
    { class: "filterCountryMeta" },
    el("span", { class: "filterCountryName" }, text(shortFilterCountryName(country?.name || code))),
    el("span", { class: "filterCountryCount" }, text(String(country?.count || 0)))
  );

  label.append(input, icon, meta);
  input.addEventListener("change", () => {
    label.classList.toggle("selected", input.checked);
  });
  return label;
}

function openFilterOverlay(pageId) {
  if (document.querySelector(".filterBackdrop")) return;

  const currentFilters = getEntityFilterState();
  const selectedCodes = new Set(currentFilters.countries);
  const backdrop = el("div", { class: "filterBackdrop" });
  const panel = el("div", {
    class: "filterPanel",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "Filter entities"
  });
  const summary = el("div", { class: "filterSummary" }, text(describeFilterState(currentFilters)));
  const clearBtn = el("button", { type: "button", class: "filterAction" }, text("Clear"));
  const applyBtn = el("button", { type: "button", class: "filterAction primary" }, text("OK"));
  const header = el(
    "div",
    { class: "filterPanelHeader" },
    el(
      "div",
      { class: "filterHeaderMain" },
      el("div", { class: "filterPanelTitle" }, text("Filter & Sort")),
      summary
    ),
    el("div", { class: "filterActions" }, clearBtn, applyBtn)
  );

  const searchInput = el("input", {
    id: "filter-search-input",
    class: "filterSearchInput",
    type: "text",
    placeholder: "name",
    value: currentFilters.q || ""
  });
  const searchField = el(
    "div",
    { class: "filterField" },
    el("label", { class: "filterLabel", for: "filter-search-input" }, text("Search")),
    searchInput
  );

  const sortSelect = el(
    "select",
    { id: "filter-sort-select", class: "filterSortSelect" },
    FILTER_SORT_OPTIONS.map(option =>
      el(
        "option",
        {
          value: option.value,
          selected: currentFilters.sort === option.value ? "selected" : null
        },
        text(option.label)
      )
    )
  );
  const reverseInput = el("input", {
    type: "checkbox",
    checked: currentFilters.sort && currentFilters.reverse ? "checked" : null
  });
  const reverseLabel = el(
    "label",
    { class: "filterCheckbox" },
    reverseInput,
    el("span", null, text("Reverse"))
  );
  reverseInput.disabled = !currentFilters.sort;
  const sortField = el(
    "div",
    { class: "filterField" },
    el("label", { class: "filterLabel", for: "filter-sort-select" }, text("Sort")),
    el("div", { class: "filterSortRow" }, sortSelect, reverseLabel)
  );

  const countryContent = el("div", { class: "filterStatus" }, text("Loading countries…"));
  const countryField = el(
    "div",
    { class: "filterField" },
    el("div", { class: "filterLabel" }, text("Countries")),
    countryContent
  );

  panel.append(header, searchField, sortField, countryField);
  backdrop.append(panel);

  function closeOverlay() {
    document.removeEventListener("keydown", onKeyDown);
    backdrop.remove();
  }

  function readOverlayFilters() {
    const q = searchInput.value.trim();
    const countries = [...panel.querySelectorAll('.filterCountryOption input[type="checkbox"]:checked')]
      .map(input => String(input.value || "").toUpperCase())
      .filter(Boolean);
    const sort = sortSelect.value || "";
    return { q, countries, sort, reverse: !!(sort && reverseInput.checked) };
  }

  function updateSummary() {
    summary.textContent = describeFilterState(readOverlayFilters());
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeOverlay();
    }
  }

  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeOverlay();
  });
  document.addEventListener("keydown", onKeyDown);
  searchInput.addEventListener("input", updateSummary);
  sortSelect.addEventListener("change", () => {
    reverseInput.disabled = !sortSelect.value;
    if (!sortSelect.value) reverseInput.checked = false;
    updateSummary();
  });
  reverseInput.addEventListener("change", updateSummary);

  clearBtn.addEventListener("click", () => {
    window.location.assign(getBasePageUrl(pageId).toString());
  });

  applyBtn.addEventListener("click", () => {
    window.location.assign(buildFilteredPageUrl(pageId, readOverlayFilters()).toString());
  });

  document.body.append(backdrop);
  searchInput.focus();
  updateSummary();

  fetchPageCountries(pageId).then((data) => {
    const countries = Array.isArray(data?.countries) ? data.countries : [];
    clear(countryContent);

    if (countries.length === 0) {
      countryContent.append(el("div", { class: "filterStatus" }, text("No country filters are available for this page yet.")));
      return;
    }

    const grid = el("div", { class: "filterCountryGrid" });
    countries.forEach((country) => {
      const option = buildCountryOption(country, selectedCodes);
      const input = option.querySelector("input");
      input.addEventListener("change", updateSummary);
      grid.append(option);
    });
    countryContent.append(grid);
    updateSummary();
  }).catch((err) => {
    console.error(err);
    clear(countryContent);
    countryContent.append(el("div", { class: "filterStatus" }, text("Could not load country filters.")));
  });
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

  app.append(headlineWrap);
  ensureHeaderActions(pageId);

  // Map container (map.js will read #map attributes)
  if (hasMap) {
    const fields = ["lat", "lon", "zoom", "cluster", "clusterLevel", "icon", "lines"];
    const attrs = { id: "map" };
    for (const f of fields) {
      if (listInfo.map[f] != null) attrs[f] = listInfo.map[f];
    }
    if (hasEntityFilters()) attrs.fit = "results";
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

    let prevState = null;
    for (const e of group) {
      const state = buildRowRenderState(e, listCtx);
      if (prevState && (prevState.hasCaption || state.chosenImages.length > 0)) {
        items.append(smallSpace());
      }
      items.append(renderRow(e, listCtx, state));
      prevState = state;
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
    const effectiveSort = effectiveSortSpec(info.sort, sortOverride, info.tags);
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

    if (sortSpecIncludes(effectiveSort, "distance", info.tags)) {
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
    syncFilterButtonState(document);

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
