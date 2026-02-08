 (async function main() {
     const API_BASE = "https://api.andrewzc.net";

     const params = new URLSearchParams(location.search);
     const codeRaw = params.get("code") || "";
     const code = codeRaw.trim().toUpperCase();

     const headlineEl = document.getElementById("headline");
     const captionEl = document.getElementById("caption");

     if (!code) {
       headlineEl.textContent = "Missing country code";
       captionEl.textContent = "Use ?code=be";
       return;
     }

     try {
       // Fetch in parallel
       const [pagesRes, countryRes] = await Promise.all([
         fetch(`${API_BASE}/pages`),
         fetch(`${API_BASE}/countries/${encodeURIComponent(code)}`),
       ]);

       if (!pagesRes.ok) throw new Error(`Failed /pages: ${pagesRes.status}`);
       if (!countryRes.ok) throw new Error(`Failed /countries/${code}: ${countryRes.status}`);

       const pagesPayload = await pagesRes.json();
       const countryPayload = await countryRes.json();

       const pages = pagesPayload.pages || [];
       const country = countryPayload.country || null;
       const entities = countryPayload.entities || [];

       const pagesByKey = new Map(pages.filter(p => p && p.key).map(p => [p.key, p]));

       // Bucket entities by list
       const byList = new Map();
       for (const e of entities) {
         const k = e.list;
         if (!k) continue;
         if (!byList.has(k)) byList.set(k, []);
         byList.get(k).push(e);
       }

       if (!country) {
         throw new Error(`Missing country entity for ${code}`);
       }

       const countryName = country.name || code;
       const countryIcon =
         (Array.isArray(country.icons) ? country.icons.join(" ") : "") ||
         country.icon ||
         country.emoji ||
         UI.flagEmojiFromCountryCode(code);

       document.title = `${countryIcon ? countryIcon + " " : ""}${countryName}`;
       headlineEl.textContent = `${countryIcon ? countryIcon + " " : ""}${countryName}`;

       const visited = country.been === true;

       captionEl.appendChild(document.createTextNode(visited ? "✅ Visited" : "📝 Not visited"));
       captionEl.appendChild(UI.br());

       const props = country.props || {};

       const propertyPages = Object.keys(props)
         .map(k => pagesByKey.get(k))
         .filter(Boolean)
         .sort((a, b) => {
           const an = a.name || a.title || (a.map && a.map.name) || a.key;
           const bn = b.name || b.title || (b.map && b.map.name) || b.key;
           return String(an).localeCompare(String(bn), undefined, { numeric: true, sensitivity: "base" });
         });

       for (const page of propertyPages) {
         const pageIcon =
           (Array.isArray(page.icons) ? page.icons.join(" ") : "") ||
           page.icon ||
           page.emoji ||
           "";

         const pageName =
           page.name ||
           page.title ||
           (page.map && page.map.name) ||
           page.key;

         captionEl.appendChild(document.createTextNode(`${pageIcon ? pageIcon + " " : ""}${pageName}`));
         captionEl.appendChild(UI.br());
       }

       if (propertyPages.length > 0) {
         captionEl.appendChild(UI.smallSpace());
       }

       // Pages already come sorted by name in your API
       // Iterate pages, render only those with hits
       let firstSection = true;

       for (const page of pages) {
         const listKey = page.key;
         if (!listKey) continue;

         const hits = byList.get(listKey);
         if (!hits || hits.length === 0) continue;

         if (!firstSection) captionEl.appendChild(UI.smallSpace());
         firstSection = false;

         // <a name="list-key"></a>
         captionEl.appendChild(UI.el("a", { name: listKey }));
         captionEl.appendChild(document.createTextNode(" ")); // helps keep layout consistent

         // Header line: emoji + link to page (+ count if >10)
         const pageIcon =
           page.icon ||
           page.emoji ||
           (Array.isArray(page.icons) ? page.icons.join(" ") : "") ||
           "";

         const pageName =
           page.name ||
           page.title ||
           (page.map && page.map.name) ||
           listKey;

         // Country page now lives at the site root; list pages are siblings.
         const href = `${listKey}.html`;

         captionEl.appendChild(document.createTextNode((pageIcon ? pageIcon + " " : "")));

         const a = UI.el("a", { href, className: "link" });
         a.textContent = pageName;
         captionEl.appendChild(a);

         if (hits.length > 10) {
           captionEl.appendChild(document.createTextNode(` (${hits.length})`));
         }

         captionEl.appendChild(UI.br());

         // First 10 entities, already name-sorted by backend (per your plan)
         for (const ent of hits.slice(0, 10)) {
           captionEl.appendChild(UI.renderEntityRow(ent));
         }
       }

       // If nothing matched any page, be honest about it
       if (firstSection) {
         captionEl.appendChild(UI.smallSpace());
         captionEl.appendChild(document.createTextNode("No matching entities found."));
         captionEl.appendChild(UI.br());
       }
     } catch (err) {
       console.error(err);
       headlineEl.textContent = "Error";
       captionEl.textContent = String(err?.message || err);
     }
   })();
