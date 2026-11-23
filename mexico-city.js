// The Mexico City page selects its metro routes from the shared routes layer.
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
  MapRoutes.showWhenReady(
    { mode: "metro", trip: "mexico-city" },
    { weight: 6 }
  );
})().catch(error => console.error("Could not initialize Mexico City routes", error));
