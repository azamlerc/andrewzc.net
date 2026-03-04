(async function main() {
  const params  = new URLSearchParams(location.search);
  const cityKey = (params.get("city") || params.get("key") || params.get("name") || "").trim();

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

    const city     = data.city     || null;
    const entities = data.entities || [];

    if (!city) throw new Error(`Missing city entity for ${cityKey}`);

    const cityName = city.name || UI.titleCase(cityKey.replace(/-/g, " "));

    // Expose for map.js
    window.places   = entities;
    window.pageInfo = city;

    Results.renderHeader(headlineEl, captionEl, {
      name:  cityName,
      icons: city.icons,
      been:  city.been,
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

    captionEl.appendChild(UI.smallSpace());

    // Entity sections
    const byList = Results.bucketByList(entities);
    const any    = Results.renderSections(captionEl, pages, byList, {
      pageName:    cityName,
      dedupeLists: new Set(["olympics", "eurovision"]),
    });

    if (!any) Results.renderEmpty(captionEl);

  } catch (err) {
    Results.renderError(headlineEl, captionEl, err);
  }
})();
