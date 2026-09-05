function queryRecentDays() {
  const params = new URLSearchParams(window.location.search);
  const days = Number(params.get("days"));
  return Number.isFinite(days) && days > 0 ? Math.floor(days) : 30;
}

function setIntro(captionEl, text) {
  captionEl.textContent = "";
  captionEl.appendChild(UI.el("div", { className: "caption pageHeader" }, text));
}

(async function main() {
  const headlineEl = document.getElementById("headline");
  const captionEl  = document.getElementById("caption");
  const days       = queryRecentDays();
  const introText  = `Places visited in the last ${days} days`;

  document.title         = "🕒 Recent";
  headlineEl.textContent = "🕒 Recent";
  setIntro(captionEl, `${introText}...`);

  try {
    const { pages, data } = await Results.fetchPagesAndData(
      `${Results.API_BASE}/entities/recent?days=${encodeURIComponent(days)}`
    );

    const entities = Results.withPageIcons(data.results || data, pages);
    const byList   = Results.bucketByList(entities);
    const mapEntities = entities.filter(e => UI.parseCoords(e.coords) || (e.location?.type === "Point" && Array.isArray(e.location.coordinates)));

    setIntro(captionEl, introText);

    if (mapEntities.length > 0) {
      window.places = mapEntities.map(e => ({ ...e, been: e.been ?? true }));
      window.pageInfo = { key: "recent", usePageIconsOnMap: true };

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
    }

    captionEl.appendChild(UI.smallSpace());

    const maxItems = byList.size === 1 ? Infinity : 10;
    const any = Results.renderSections(captionEl, pages, byList, {
      sort: "count",
      maxItems,
    });

    if (!any) Results.renderEmpty(captionEl);
    await Results.enableAdminControls({ headlineEl, storageKey: `recent:${days}` });

  } catch (err) {
    Results.renderError(headlineEl, captionEl, err);
  }
})();
