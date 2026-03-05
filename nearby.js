// Extract {lat, lon} from an entity, matching the two formats map.js supports.
function entityCoords(e) {
  const loc = e.location;
  if (loc?.type === "Point" && Array.isArray(loc.coordinates)) {
    return { lat: loc.coordinates[1], lon: loc.coordinates[0] };
  }
  if (typeof e.coords === "string") {
    const [a, b] = e.coords.split(",").map(Number);
    if (isFinite(a) && isFinite(b)) return { lat: a, lon: b };
  }
  return null;
}

// Return the Leaflet zoom level that fits a bounding box in the #map div (1260×600px).
// Formula: at zoom z, one 256px tile covers 360/2^z° lon and ~170/2^z° lat (Mercator).
function fitZoom(minLat, maxLat, minLon, maxLon) {
  const pad     = 1.5;
  const lonSpan = Math.max(maxLon - minLon, 0.001);
  const latSpan = Math.max(maxLat - minLat, 0.001);
  const zLon    = Math.log2(1260 * 360 / (256 * lonSpan * pad));
  const zLat    = Math.log2(600  * 170 / (256 * latSpan * pad));
  return Math.max(2, Math.min(16, Math.floor(Math.min(zLon, zLat)) + 1));
}

(async function () {
  const headlineEl = document.getElementById("headline");
  const captionEl  = document.getElementById("caption");

  document.title         = "📍 Nearby";
  headlineEl.textContent = "📍 Nearby";

  if (!navigator.geolocation) {
    Results.renderError(headlineEl, captionEl, new Error("Geolocation is not supported by this browser."));
    return;
  }

  captionEl.textContent = "Getting your location…";

  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      const { latitude: lat, longitude: lon } = coords;

      captionEl.textContent  = "";

      try {
        const params = new URLSearchParams({ lat, lon, radius: 50, limit: 50 });
        const [pRes, eRes] = await Promise.all([
          fetch(`${Results.API_BASE}/pages`),
          fetch(`${Results.API_BASE}/entities/nearby?${params}`),
        ]);
        if (!pRes.ok) throw new Error(`/pages: ${pRes.status}`);
        if (!eRes.ok) throw new Error(`/entities/nearby: ${eRes.status}`);

        const pd = await pRes.json();
        const ed = await eRes.json();

        const pages    = pd.pages || [];
        const entities = ed.results || ed;
        const byList   = Results.bucketByList(entities);

        // Expose places for map.js; default been=false so markers pass map.js filters
        window.places   = entities.map(e => ({ ...e, been: e.been ?? false }));
        window.pageInfo = { key: "nearby" };

        // Derive map center + zoom from the bounding box of result coordinates
        const pts = entities.map(entityCoords).filter(Boolean);
        let mapLat = lat, mapLon = lon, mapZoom = 12;
        if (pts.length > 0) {
          const lats = pts.map(p => p.lat), lons = pts.map(p => p.lon);
          const minLat = Math.min(...lats), maxLat = Math.max(...lats);
          const minLon = Math.min(...lons), maxLon = Math.max(...lons);
          mapLat  = (minLat + maxLat) / 2;
          mapLon  = (minLon + maxLon) / 2;
          mapZoom = pts.length > 1 ? fitZoom(minLat, maxLat, minLon, maxLon) : 14;
        }

        const mapDiv = UI.el("div", { id: "map" });
        mapDiv.setAttribute("lat",  String(UI.round(mapLat, 4)));
        mapDiv.setAttribute("lon",  String(UI.round(mapLon, 4)));
        mapDiv.setAttribute("zoom", String(mapZoom));
        captionEl.appendChild(mapDiv);

        const mapScript = document.createElement("script");
        mapScript.src = "map.js";
        captionEl.appendChild(mapScript);

        captionEl.appendChild(UI.smallSpace());

        const maxItems = byList.size === 1 ? Infinity : 10;
        const any = Results.renderSections(captionEl, pages, byList, { sort: "count", maxItems });
        if (!any) Results.renderEmpty(captionEl);

      } catch (err) {
        Results.renderError(headlineEl, captionEl, err);
      }
    },
    err => {
      const msg = err.code === err.PERMISSION_DENIED
        ? "Location access was denied."
        : "Could not get your location.";
      Results.renderError(headlineEl, captionEl, new Error(msg));
    }
  );
})();
