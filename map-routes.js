// Shared database-backed route layer for airport and trip maps.
(function () {
  if (window.MapRoutes) return;
  let selection = null;
  let geodesicPromise;
  const rendered = new WeakMap();

  function style(route) {
    return {
      color: route.been === true ? "#228b22" : "#dc2626",
      weight: 2.5,
      opacity: 0.8,
      dashArray: route.mode === "rail" ? "14,10" : route.mode === "road" ? "1,8" : null,
      lineCap: "round",
    };
  }

  async function draw(map, { routes = [], entities = [] }) {
    const byRef = new Map(entities.map(entity => [JSON.stringify([entity.list, entity.key]), entity]));
    const layer = L.layerGroup().addTo(map);
    let geodesicAvailable = true;
    if (routes.some(route => route.path?.kind === "great-circle")) {
      try {
        geodesicPromise ||= loadScript("https://unpkg.com/leaflet.geodesic@2.7.2/dist/leaflet.geodesic.umd.min.js");
        await geodesicPromise;
      } catch (err) {
        geodesicAvailable = false;
        console.error("Could not load great-circle renderer", err);
      }
    }
    for (const route of routes) {
      const stops = Array.isArray(route.stops) ? route.stops : [];
      const points = stops.map(stop => getLatLong(byRef.get(JSON.stringify([stop?.list, stop?.key]))));
      // Never join across a missing intermediate stop and invent a connection.
      if (points.length < 2 || points.some(point => !point)) {
        console.warn("Route has missing endpoint coordinates:", route.key);
        continue;
      }
      const greatCircle = route.path?.kind === "great-circle";
      if (greatCircle && !geodesicAvailable) continue;
      if (route.path?.kind && !["straight", "great-circle"].includes(route.path.kind)) {
        console.warn("Unsupported route path:", route.key, route.path.kind);
        continue;
      }
      const line = greatCircle
        ? L.geodesic([points], { ...style(route), wrap: true, steps: 4 })
        : L.polyline(points, style(route));
      const label = document.createElement("span");
      label.textContent = `${route.name || route.key} · ${route.been === true ? "Travelled" : "Planned"}`;
      line.bindTooltip(label).addTo(layer);
    }
    return layer;
  }

  async function show(context) {
    if (!selection || !context?.map) return;
    const query = new URLSearchParams(selection).toString();
    if (rendered.get(context.map) === query) return;
    rendered.set(context.map, query);
    try {
      const base = (new URL(location.href).searchParams.get("api") || "https://api.andrewzc.net").replace(/\/+$/, "");
      const response = await fetch(`${base}/routes?${query}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Routes request failed (${response.status})`);
      await draw(context.map, await response.json());
    } catch (err) {
      rendered.delete(context.map);
      console.error("Could not display map routes", err);
      const notice = document.createElement("div");
      notice.className = "small";
      notice.textContent = "Routes could not be loaded. Refresh to try again.";
      context.map.getContainer().after(notice);
    }
  }

  window.MapRoutes = {
    style, draw,
    showWhenReady(filter) {
      selection = filter;
      void show(window.__ANDREWZC_MAP_CONTEXT__);
    },
  };
  document.addEventListener("mapReady", event => { void show(event.detail); });
})();
