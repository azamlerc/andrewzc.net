(function ensureTripHeaderStyle() {
  if (document.getElementById("trip-header-style")) return;
  const style = document.createElement("style");
  style.id = "trip-header-style";
  style.textContent = `
    .tripHeader {
      margin: 6px 0 14px;
      line-height: 1.1;
    }

    .tripHeader > :first-child {
      margin-top: 0;
    }

    .tripHeader > :last-child {
      margin-bottom: 0;
    }
  `;
  document.head.appendChild(style);
})();

(async function main() {
  const params   = new URLSearchParams(location.search);
  const tripKey  = (params.get("id") || params.get("trip") || params.get("key") || "").trim();

  const headlineEl = document.getElementById("headline");
  const captionEl  = document.getElementById("caption");

  if (!tripKey) {
    document.title         = "Missing trip";
    headlineEl.textContent = "Missing trip";
    captionEl.textContent  = "Use ?id=europe-2022";
    return;
  }

  try {
    const { pages, data } = await Results.fetchPagesAndData(
      `${Results.API_BASE}/trips/${encodeURIComponent(tripKey)}`
    );

    const page     = data.page || null;
    const entities = data.entities || [];

    const tripName = page?.name || UI.titleCase(tripKey.replace(/-/g, " "));
    const tripIcon = page?.icon || page?.emoji || "";
    const tripMap  = page?.map && typeof page.map === "object" ? page.map : null;

    document.title         = `${tripIcon ? `${tripIcon} ` : ""}${tripName}`;
    headlineEl.textContent = document.title;

    // Expose for map.js
    window.places   = entities;
    window.pageInfo = page;

    if (tripMap?.lat != null && tripMap?.lon != null && tripMap?.zoom != null) {
      const fields = ["lat", "lon", "zoom", "cluster", "clusterLevel", "icon", "lines"];
      const mapDiv = UI.el("div", { id: "map" });
      for (const field of fields) {
        if (tripMap[field] != null) {
          mapDiv.setAttribute(field, String(tripMap[field]));
        }
      }

      captionEl.appendChild(mapDiv);

      const script = document.createElement("script");
      script.src = "map.js";
      captionEl.appendChild(script);
      captionEl.appendChild(document.createTextNode("\n"));
    }

    if (page?.header) {
      const headerWrap = UI.el("div", { className: "tripHeader" });
      headerWrap.innerHTML = page.header;
      captionEl.appendChild(headerWrap);
    } else if (tripMap) {
      captionEl.appendChild(UI.smallSpace());
    }

    const byList = Results.bucketByList(entities);
    const any    = Results.renderSections(captionEl, pages, byList, {
      pageName: tripName,
      sort: "alphabetical",
    });

    if (!any) Results.renderEmpty(captionEl);

    await Results.enableAdminControls({ headlineEl, storageKey: `trip:${tripKey}`, infoPageId: tripKey });

  } catch (err) {
    Results.renderError(headlineEl, captionEl, err);
  }
})();
