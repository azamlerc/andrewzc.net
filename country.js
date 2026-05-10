(async function main() {
  const params  = new URLSearchParams(location.search);
  const code    = (params.get("code") || "").trim().toUpperCase();

  const headlineEl = document.getElementById("headline");
  const captionEl  = document.getElementById("caption");

  if (!code) {
    headlineEl.textContent = "Missing country code";
    captionEl.textContent  = "Use ?code=be";
    return;
  }

  try {
    const { pages, data } = await Results.fetchPagesAndData(
      `${Results.API_BASE}/countries/${encodeURIComponent(code)}`
    );

    const country  = data.country  || null;
    const entities = Results.withPageIcons(data.entities || [], pages);

    if (!country) throw new Error(`Missing country entity for ${code}`);

    const countryName = country.name || code;
    const countryIcon =
      (Array.isArray(country.icons) ? country.icons.join(" ") : "") ||
      country.icon ||
      country.emoji ||
      UI.flagEmojiFromCountryCode(code);

    Results.renderHeader(headlineEl, captionEl, {
      name:  countryName,
      icons: countryIcon,
      been:  null,
    });

    const mapEntities = entities.filter(e => UI.parseCoords(e.coords) || (e.location?.type === "Point" && Array.isArray(e.location.coordinates)));
    if (mapEntities.length > 0) {
      window.places = mapEntities;
      window.pageInfo = { ...country, usePageIconsOnMap: true };

      const mapDiv = UI.el("div", { id: "map" });
      mapDiv.setAttribute("lat", "20");
      mapDiv.setAttribute("lon", "0");
      mapDiv.setAttribute("zoom", "3");
      mapDiv.setAttribute("fit", "results");
      captionEl.appendChild(mapDiv);

      const script = document.createElement("script");
      script.src = "map.js";
      captionEl.appendChild(script);
      captionEl.appendChild(document.createTextNode("\n"));

      captionEl.appendChild(document.createTextNode(country.been === true ? "✅ Visited" : "📝 Not visited"));
      captionEl.appendChild(UI.br());
      captionEl.appendChild(UI.smallSpace());
    }

    // Props badges — links to the property sub-pages this country belongs to
    const pagesByKey = new Map(pages.filter(p => p?.key).map(p => [p.key, p]));
    const props      = country.props || {};

    const propertyPages = Object.keys(props)
      .map(k => pagesByKey.get(k))
      .filter(Boolean)
      .sort((a, b) => String(a.name || a.key).localeCompare(String(b.name || b.key), undefined, { numeric: true, sensitivity: "base" }));

    for (const page of propertyPages) {
      const icon = page.icon || page.emoji || "";
      const name = page.name || page.key;
      captionEl.appendChild(document.createTextNode(`${icon ? icon + " " : ""}${name}`));
      captionEl.appendChild(UI.br());
    }

    if (propertyPages.length > 0) captionEl.appendChild(UI.smallSpace());

    // Entity sections
    const byList = Results.bucketByList(entities);
    const any    = Results.renderSections(captionEl, pages, byList, {
      pageQuery: { country: code.toLowerCase() },
    });

    if (!any) Results.renderEmpty(captionEl);
    await Results.enableAdminControls({ headlineEl, storageKey: `country:${code}` });

  } catch (err) {
    Results.renderError(headlineEl, captionEl, err);
  }
})();
