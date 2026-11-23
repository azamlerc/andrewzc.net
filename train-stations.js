// The train-stations page selects all train routes; shared code loads and draws them.
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
  MapRoutes.showWhenReady({ mode: "train" });
})().catch(error => console.error("Could not initialize train routes", error));
