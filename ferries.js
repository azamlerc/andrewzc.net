// The ferries page selects all sea routes; shared code loads and draws them.
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
  MapRoutes.showWhenReady({ mode: "sea" }, { lineType: "dashed" });
})().catch(error => console.error("Could not initialize ferry routes", error));
