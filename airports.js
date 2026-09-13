// The airport page selects all air routes; shared code loads and draws them.
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
  MapRoutes.showWhenReady({ mode: "air" });
})().catch(error => console.error("Could not initialize airport routes", error));
