// ui.js
(function () {
  (function ensureResultsMediaStyle() {
    if (document.getElementById("results-media-style")) return;
    const style = document.createElement("style");
    style.id = "results-media-style";
    style.textContent = `
      .resultsEntityMedia {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin: 10px 0 6px 0;
      }

      .resultsEntityMedia a {
        display: inline-block;
        width: 100px;
        height: 100px;
        border-radius: 18px;
        overflow: hidden;
        box-shadow: 0px 3px 8px rgba(0,0,0,0.2);
        background: #f5f5f5;
      }

      .resultsEntityMedia img {
        width: 100px;
        height: 100px;
        object-fit: cover;
        display: block;
      }

      .resultsEntityCaption {
        font: 16pt Avenir;
        color: #999;
        line-height: 1.25;
        margin: 0 0 20px 0;
      }

      .resultsEntityCaption a {
        color: #444;
      }

      body.edit-mode .resultsEntityLabel[data-entity-key][data-entity-list] {
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  })();

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

  function countryCodeFromFlagEmoji(icon) {
    const cps = Array.from(String(icon || ""));
    if (cps.length !== 2) return null;

    const a = cps[0].codePointAt(0);
    const b = cps[1].codePointAt(0);
    const A = 0x1f1e6;
    const Z = 0x1f1ff;
    if (a < A || a > Z || b < A || b > Z) return null;

    return String.fromCharCode(
      "A".charCodeAt(0) + (a - A),
      "A".charCodeAt(0) + (b - A)
    );
  }

  function htmlFragment(html) {
    const template = document.createElement("template");
    template.innerHTML = String(html ?? "");
    return template.content.cloneNode(true);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[ch]));
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function renderRichTextHtml(value) {
    return String(value ?? "")
      .replace(/\[\[([^[\]]+)\]\]/g, (_, rawKey) => {
        const key = String(rawKey || "").trim();
        if (!key) return _;
        return `<a href="./${escapeAttr(key)}" class="dark">${escapeHtml(key)}</a>`;
      })
      .replace(/(^|[^\[])\[([^\]]+)\]\(([^)\s]+)\)/g, (_, prefix, label, href) => {
        const display = String(label || "").trim();
        const url = String(href || "").trim();
        if (!display || !url) return _;
        return `${prefix}<a href="${escapeAttr(url)}" class="dark">${escapeHtml(display)}</a>`;
      });
  }

  function highlightDistanceCaption(node) {
    if (node.querySelector("*")) return;
    const distanceRe = /\b(?:\d+(?:[.,]\d+)?\skm|\d+m|exact)\b/gi;
    const raw = node.textContent || "";
    const escaped = escapeHtml(raw);
    const matches = [...escaped.matchAll(distanceRe)];
    if (matches.length === 0) return;

    const lastMatch = matches[matches.length - 1];
    node.innerHTML =
      escaped.slice(0, lastMatch.index) +
      `<span class="dark">${lastMatch[0]}</span>` +
      escaped.slice(lastMatch.index + lastMatch[0].length);
  }

  function fullImageUrl(listId, filename) {
    const raw = `https://images.andrewzc.net/${listId}/${filename}`;
    return raw.includes(".pdf.") ? raw.slice(0, raw.indexOf(".pdf.") + 4) : raw;
  }

  function thumbImageUrl(listId, filename) {
    return `https://images.andrewzc.net/${listId}/tn/${filename}`;
  }

  // This is a *generic* “inline row” renderer that matches your site’s vibe:
  // prefix (if any) + icons + link/name, with todo + strike support.
  function renderEntityRow(entity, opts = {}) {
    const wrap = document.createDocumentFragment();

    const isTodo = entity.been === false && opts.suppressTodoIcons !== true;
    const row = el("span");

    // Prefix (years, sizes, etc.)
    if (entity.prefix) {
      row.appendChild(el("span", { className: "fixed", text: entity.prefix }));
      row.appendChild(document.createTextNode(" "));
    }

    // Icons (flags/emojis/etc)
    if (Array.isArray(entity.icons) && entity.icons.length) {
      const sectionKey = opts.sectionKey || entity.list || "";
      const iconNodes = entity.icons.flatMap((icon, idx) => {
        const code = countryCodeFromFlagEmoji(icon);
        const hash = sectionKey ? `#${encodeURIComponent(sectionKey)}` : "";
        const node = code
          ? el("a", { href: `country.html?code=${encodeURIComponent(code.toLowerCase())}${hash}` }, icon)
          : document.createTextNode(icon);
        return idx ? [document.createTextNode(" "), node] : [node];
      });
      const iconWrap = isTodo ? el("span", { className: "todo" }, iconNodes) : el("span", {}, iconNodes);
      row.appendChild(iconWrap);
      row.appendChild(document.createTextNode(" "));
    }

    // Some records use `country` / `countries` without `icons`
    // (optional — you might not need this)
    if ((!entity.icons || entity.icons.length === 0) && entity.country) {
      const flagText = document.createTextNode(flagEmojiFromCountryCode(entity.country));
      if (isTodo) {
        row.appendChild(el("span", { className: "todo" }, flagText));
        row.appendChild(document.createTextNode(" "));
      } else {
        row.appendChild(document.createTextNode(flagEmojiFromCountryCode(entity.country) + " "));
      }
    }

    const label = entity.name ?? entity.key ?? "";

    // Link vs plain text
    if (entity.link) {
      const a = el("a", {
        href: entity.link,
        id: entity.key || null,
        className: "resultsEntityLabel",
        "data-entity-key": entity.key || null,
        "data-entity-list": entity.list || null,
      });
      a.textContent = label;
      row.appendChild(a);
    } else {
      row.appendChild(el("span", {
        className: "resultsEntityLabel",
        "data-entity-key": entity.key || null,
        "data-entity-list": entity.list || null,
        text: label,
      }));
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

    const imageListId = entity?.list || opts.sectionKey || "";
    const images = Array.isArray(entity?.images) ? entity.images.filter(Boolean).slice(0, 3) : [];
    if (imageListId && images.length > 0) {
      const media = el("div", { className: "resultsEntityMedia" });
      images.forEach((filename) => {
        media.appendChild(
          el(
            "a",
            { href: fullImageUrl(imageListId, filename), target: "_blank", rel: "noopener" },
            el("img", { src: thumbImageUrl(imageListId, filename), alt: entity.name || "image", loading: "lazy" })
          )
        );
      });
      wrap.appendChild(media);
    }

    wrap.appendChild(row);
    wrap.appendChild(br());

    if (entity.caption) {
      const caption = el("div", { className: "resultsEntityCaption" });
      caption.appendChild(htmlFragment(renderRichTextHtml(entity.caption)));
      highlightDistanceCaption(caption);
      wrap.appendChild(caption);
    }
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
    dedupeEntities,
    countryCodeFromFlagEmoji
  };
})();
