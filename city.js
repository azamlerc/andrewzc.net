 (async function main() {
    const API_BASE = "https://api.andrewzc.net";

    const params = new URLSearchParams(location.search);
    // Support a few param names so you don't have to remember it perfectly.
    const cityKey = (params.get("city") || params.get("key") || params.get("name") || "").trim();

    const headlineEl = document.getElementById("headline");
    const captionEl = document.getElementById("caption");

    if (!cityKey) {
      document.title = "Missing city";
      headlineEl.textContent = "Missing city";
      captionEl.textContent = "Use ?city=den-haag";
      return;
    }

    try {
      // Fetch in parallel
      const [pagesRes, cityRes] = await Promise.all([
        fetch(`${API_BASE}/pages`),
        fetch(`${API_BASE}/cities/${encodeURIComponent(cityKey)}`),
      ]);

      if (!pagesRes.ok) throw new Error(`Failed /pages: ${pagesRes.status}`);
      if (!cityRes.ok) throw new Error(`Failed /cities/${cityKey}: ${cityRes.status}`);

      const pagesPayload = await pagesRes.json();
      const cityPayload = await cityRes.json();

      const pages = pagesPayload.pages || [];
      const city = cityPayload.city || null;
      const entities = cityPayload.entities || [];

      if (!city) {
        throw new Error(`Missing city entity for ${cityKey}`);
      }

      const cityName = city.name || UI.titleCase(cityKey.replace(/-/g, " "));

      // Expose for map.js (you already updated map.js to use window.entities if present)
      window.places = entities;
      window.pageInfo = city;

      const cityIcon =
        (Array.isArray(city.icons) ? city.icons.join(" ") : "") ||
        city.icon ||
        city.emoji ||
        "";

      document.title = `${cityIcon ? cityIcon + " " : ""}${cityName}`;
      headlineEl.textContent = `${cityIcon ? cityIcon + " " : ""}${cityName}`;

      const center = UI.parseCoords(city.coords);
      if (!center) {
        throw new Error(`City entity is missing coords for ${cityName} (${cityKey})`);
      }

      const mapDiv = UI.el("div", { id: "map" });
      mapDiv.setAttribute("lat", String(UI.round(center.lat, 4)));
      mapDiv.setAttribute("lon", String(UI.round(center.lon, 4)));
      mapDiv.setAttribute("zoom", "11");
      captionEl.appendChild(mapDiv);

      // Load map.js (root-relative)
      const script = document.createElement("script");
      script.src = "map.js";
      captionEl.appendChild(script);
      captionEl.appendChild(document.createTextNode("\n"));

      // Visited line (v1: if been { "✅ Visited<br>" })
      const visited = city.been === true;
      captionEl.appendChild(document.createTextNode(visited ? "✅ Visited" : "📝 Not visited"));
      captionEl.appendChild(UI.br());

      // Space after header block (v1 adds smallSpace if body.count > 0)
      captionEl.appendChild(UI.smallSpace());

      // Bucket entities by list
      const byList = new Map();
      for (const e of entities) {
        const k = e?.list;
        if (!k) continue;
        if (!byList.has(k)) byList.set(k, []);
        byList.get(k).push(e);
      }

      // Some lists got de-duped in v1 (olympics/eurovision) before slicing to 10
      const DEDUPE_LISTS = new Set(["olympics", "eurovision"]);
      const MAX = 10;

      let renderedAny = false;

      // Pages already come sorted by name in your /pages endpoint
      for (const page of pages) {
        const listKey = page?.key;
        if (!listKey) continue;

        const hitsRaw = byList.get(listKey);
        if (!hitsRaw || hitsRaw.length === 0) continue;

        let hits = hitsRaw;
        if (DEDUPE_LISTS.has(listKey)) {
          hits = UI.dedupeEntities(hitsRaw);
        }

        // Section header
        captionEl.appendChild(UI.el("a", { name: listKey }));
        captionEl.appendChild(document.createTextNode(" "));

        const pageIcon = page.icon || page.emoji || "";
        const pageName = page.name || listKey;

        // Root-relative list pages now
        const href = `${listKey}.html`;

        captionEl.appendChild(document.createTextNode(pageIcon ? `${pageIcon} ` : ""));
        const a = UI.el("a", { href, className: "link" });
        a.textContent = pageName;
        captionEl.appendChild(a);

        if (hits.length > MAX) {
          captionEl.appendChild(document.createTextNode(` (${hits.length})`));
        }

        captionEl.appendChild(UI.br());

        // First 10 entities (API already returns name-sorted, per your plan)
        for (const ent of hits.slice(0, MAX)) {
          // For city pages, v1 passed pageName: self.name (the city name) so "dark" references worked.
          captionEl.appendChild(UI.renderEntityRow(ent, { pageName: cityName }));
        }

        captionEl.appendChild(UI.smallSpace());
        renderedAny = true;
      }

      if (!renderedAny) {
        captionEl.appendChild(document.createTextNode("No matching entities found."));
        captionEl.appendChild(UI.br());
      }
    } catch (err) {
      console.error(err);
      document.title = "Error";
      headlineEl.textContent = "Error";
      captionEl.textContent = String(err?.message || err);
    }
  })();
