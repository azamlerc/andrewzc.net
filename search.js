(function () {
  const headlineEl = document.getElementById("headline");
  const captionEl  = document.getElementById("caption");
  const inputEl    = document.getElementById("search-input");

  let pages  = [];
  let byList = null;
  let sort   = "count";
  let query  = "";
  let tool   = "";
  let icon   = "";

  const STORAGE_KEY = "search-history";
  const DEFAULT_HISTORY = [
    { query: "skyscrapers",                 icon: "🗼" },
    { query: "canals in belgium",           icon: "🚢" },
    { query: "amusement parks",             icon: "🎢" },
    { query: "historic underground trains", icon: "🚇" },
  ];

  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [...DEFAULT_HISTORY];
  }

  function saveToHistory(q, ic) {
    const hist = loadHistory().filter(h => h.query !== q);
    hist.unshift({ query: q, icon: ic });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(hist.slice(0, 20))); } catch {}
  }

  function removeFromHistory(q) {
    const hist = loadHistory().filter(h => h.query !== q);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(hist)); } catch {}
    captionEl.textContent = "";
    renderHistory();
  }

  function renderHistory() {
    const hist = loadHistory();
    if (!hist.length) return;
    captionEl.appendChild(UI.smallSpace());
    const div = UI.el("div", { className: "items large" });
    for (const { query: q, icon: ic } of hist) {
      const display = q.replace(/\b\w/g, c => c.toUpperCase());
      const row = UI.el("span", { className: "history-item" });
      const a = UI.el("a", {
        href: `?q=${encodeURIComponent(q)}`,
        onclick: e => { e.preventDefault(); inputEl.value = q; runSearch(q); },
      });
      a.textContent = ic ? `${ic} ${display}` : display;
      const del = UI.el("span", {
        className: "history-remove",
        onclick: e => { e.stopPropagation(); removeFromHistory(q); },
      });
      del.textContent = "×";
      row.appendChild(a);
      row.appendChild(del);
      div.appendChild(row);
    }
    captionEl.appendChild(div);
  }

  document.title         = "🔍 Search";
  headlineEl.textContent = "🔍 Search";
  renderHistory();

  inputEl.focus();

  const q0 = (new URLSearchParams(location.search).get("q") || "").trim();
  if (q0) { inputEl.value = q0; runSearch(q0); }

  inputEl.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
  inputEl.addEventListener("input", () => {
    if (!inputEl.value) {
      document.title         = "🔍 Search";
      headlineEl.textContent = "🔍 Search";
      captionEl.textContent  = "";
      renderHistory();
      const url = new URL(location.href);
      url.searchParams.delete("q");
      history.pushState({}, "", url);
    }
  });
  window.addEventListener("popstate", () => {
    const q = (new URLSearchParams(location.search).get("q") || "").trim();
    if (q) {
      inputEl.value = q;
      runSearch(q);
    } else {
      inputEl.value          = "";
      document.title         = "🔍 Search";
      headlineEl.textContent = "🔍 Search";
      captionEl.textContent  = "";
      renderHistory();
    }
  });

  function submit() {
    const q = inputEl.value.trim();
    if (q) runSearch(q);
  }

  async function runSearch(q) {
    query = q;
    headlineEl.textContent = "…";
    captionEl.textContent  = "";

    const url = new URL(location.href);
    url.searchParams.set("q", q);
    history.pushState({}, "", url);

    try {
      const [pRes, sRes] = await Promise.all([
        fetch(`${Results.API_BASE}/pages`),
        fetch(`${Results.API_BASE}/search`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ query: q, limit: 50 }),
        }),
      ]);
      if (!pRes.ok) throw new Error(`/pages: ${pRes.status}`);
      if (!sRes.ok) throw new Error(`/search: ${sRes.status}`);

      const pd = await pRes.json();
      const sd = await sRes.json();

      pages  = pd.pages || [];
      byList = Results.bucketByList(sd.results || []);
      tool   = Array.isArray(sd.tool) ? sd.tool.join(", ") : (sd.tool || "");
      icon   = sd.icon || "";

      render();
    } catch (err) {
      Results.renderError(headlineEl, captionEl, err);
    }
  }

  function render() {
    saveToHistory(query, icon);

    const displayQuery = query.replace(/\b\w/g, c => c.toUpperCase());
    const displayTitle = icon ? `${icon} ${displayQuery}` : displayQuery;
    document.title         = displayTitle;
    headlineEl.textContent = displayTitle;
    captionEl.textContent  = "";

    if (tool) {
      captionEl.appendChild(document.createTextNode(`🛠 ${tool}`));
      captionEl.appendChild(UI.br());
    }

    captionEl.appendChild(UI.smallSpace());

    const maxItems = byList.size === 1 ? Infinity : 10;
    const any = Results.renderSections(captionEl, pages, byList, { sort, maxItems });
    if (!any) Results.renderEmpty(captionEl);
  }
})();
