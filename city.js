(async function main() {
  const params  = new URLSearchParams(location.search);
  const cityKey = (params.get("city") || params.get("key") || params.get("id") || params.get("name") || "").trim();

  const headlineEl = document.getElementById("headline");
  const captionEl  = document.getElementById("caption");

  if (!cityKey) {
    document.title         = "Missing city";
    headlineEl.textContent = "Missing city";
    captionEl.textContent  = "Use ?city=den-haag";
    return;
  }

  try {
    const { pages, data } = await Results.fetchPagesAndData(
      `${Results.API_BASE}/cities/${encodeURIComponent(cityKey)}`
    );

    const city = data.city || null;

    if (!city) throw new Error(`Missing city entity for ${cityKey}`);

    const cityName = city.name || UI.titleCase(cityKey.replace(/-/g, " "));
    const entities = Results.withPageIcons(data.entities || [], pages).map((entity) => ({
      ...entity,
      name: entity.name === cityName && entity.reference ? entity.reference : entity.name,
      reference: (
        entity.reference === cityName ||
        (entity.name === cityName && entity.reference)
      ) ? null : entity.reference,
    }));

    // Expose for map.js
    window.places   = entities;
    window.pageInfo = { ...city, usePageIconsOnMap: true };

    Results.renderHeader(headlineEl, captionEl, {
      name:  cityName,
      icons: city.icons,
      been:  null,
    });

    // Map
    const center = UI.parseCoords(city.coords);
    if (!center) throw new Error(`City entity is missing coords for ${cityName} (${cityKey})`);

    const mapDiv = UI.el("div", { id: "map" });
    mapDiv.setAttribute("lat",  String(UI.round(center.lat, 4)));
    mapDiv.setAttribute("lon",  String(UI.round(center.lon, 4)));
    mapDiv.setAttribute("zoom", "11");
    captionEl.appendChild(mapDiv);

    const script = document.createElement("script");
    script.src = "map.js";
    captionEl.appendChild(script);
    captionEl.appendChild(document.createTextNode("\n"));

    captionEl.appendChild(document.createTextNode(city.been === true ? "✅ Visited" : "📝 Not visited"));
    captionEl.appendChild(UI.br());

    if (city.link) {
      captionEl.appendChild(document.createTextNode("🌍 "));
      captionEl.appendChild(UI.el("a", { href: city.link, target: "_blank", rel: "noopener noreferrer" }, document.createTextNode("Wikipedia")));
      captionEl.appendChild(UI.br());
    }

    captionEl.appendChild(UI.smallSpace());

    // Entity sections
    const byList = Results.bucketByList(entities);
    const any    = Results.renderSections(captionEl, pages, byList, {
      pageName:    cityName,
      dedupeLists: new Set(["olympics", "eurovision"]),
    });

    if (!any) Results.renderEmpty(captionEl);
    await Results.enableAdminControls({ headlineEl, storageKey: `city:${cityKey}` });

  } catch (err) {
    Results.renderError(headlineEl, captionEl, err);
  }
})();
