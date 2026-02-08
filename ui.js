// ui.js
(function () {
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);

    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null) continue;
      if (k === "className") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, String(v));
    }

    for (const child of Array.isArray(children) ? children : [children]) {
      if (child == null) continue;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }

    return node;
  }

  function br() {
    return document.createElement("br");
  }

  function smallSpace() {
    const d = el("div", { className: "smallSpace" }, br());
    return d;
  }

  function flagEmojiFromCountryCode(code) {
    const cc = String(code || "").toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) return "";
    // regional indicator symbols
    const A = 0x1f1e6;
    const chars = [...cc].map(c => String.fromCodePoint(A + (c.charCodeAt(0) - 65)));
    return chars.join("");
  }

  function countryNameFromCode(code) {
    const cc = String(code || "").toUpperCase();
    try {
      // Browser-supported in modern engines
      const dn = new Intl.DisplayNames(["en"], { type: "region" });
      return dn.of(cc) || cc;
    } catch {
      return cc;
    }
  }

  // This is a *generic* “inline row” renderer that matches your site’s vibe:
  // prefix (if any) + icons + link/name, with todo + strike support.
  function renderEntityRow(entity, opts = {}) {
    const wrap = document.createDocumentFragment();

    const isTodo = entity.been === false;
    const row = el("span");

    // Prefix (years, sizes, etc.)
    if (entity.prefix) {
      row.appendChild(document.createTextNode(entity.prefix + " "));
    }

    // Icons (flags/emojis/etc)
    if (Array.isArray(entity.icons) && entity.icons.length) {
      row.appendChild(document.createTextNode(entity.icons.join(" ") + " "));
    }

    // Some records use `country` / `countries` without `icons`
    // (optional — you might not need this)
    if ((!entity.icons || entity.icons.length === 0) && entity.country) {
      row.appendChild(document.createTextNode(flagEmojiFromCountryCode(entity.country) + " "));
    }

    const label = entity.name ?? entity.key ?? "";

    // Link vs plain text
    if (entity.link) {
      const a = el("a", { href: entity.link });
      a.textContent = label;
      row.appendChild(a);
    } else {
      row.appendChild(document.createTextNode(label));
    }

    // Reference (dark, like old output)
    if (entity.reference) {
      row.appendChild(document.createTextNode(" "));
      row.appendChild(el("span", { className: "dark", text: entity.reference }));
    }

    // Strike
    if (entity.strike) {
      row.style.textDecoration = "line-through";
    }

    // Todo styling:
    // - for general pages you’ve been using <span class="todo">…</span>
    // - for twin pages you mentioned 50% opacity for flag; but countries can keep classic todo.
    if (isTodo) {
      const todo = el("span", { className: "todo" }, row);
      wrap.appendChild(todo);
    } else {
      wrap.appendChild(row);
    }

    wrap.appendChild(br());
    return wrap;
  }
  
  // Parse "52.08635, 4.29770" -> {lat, lon}
  function parseCoords(s) {
    if (!s || typeof s !== "string") return null;
    const parts = s.split(",").map(x => x.trim());
    if (parts.length < 2) return null;
    const lat = Number(parts[0]);
    const lon = Number(parts[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  };

  function round(n, digits = 2) {
    const p = Math.pow(10, digits);
    return Math.round(n * p) / p;
  };

  // Dedupe by (list,key) if present, else fall back to name+link
  function dedupeEntities(arr) {
    const seen = new Set();
    const out = [];
    for (const e of arr || []) {
      const id =
        (e?.list && e?.key) ? `${e.list}::${e.key}` :
        `${e?.name || ""}::${e?.link || ""}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(e);
    }
    return out;
  };
  
  window.UI = {
    el,
    br,
    smallSpace,
    flagEmojiFromCountryCode,
    countryNameFromCode,
    renderEntityRow,
    parseCoords,
    round,
    dedupeEntities
  };
})();