// Reuse only the airport routes tagged for the Stopovers page.
(async function () {
  if (!window.MapRoutes) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "map-routes.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  MapRoutes.showWhenReady({ mode: "air", trip: "stopovers" });
})().catch(error => console.error("Could not initialize stopover routes", error));
