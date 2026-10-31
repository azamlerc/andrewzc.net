// Directions are database routes, independent of personal travel history.
(async function () {
  if (!window.MapRoutes) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'map-routes.js?v=20261030-inline-stops';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  MapRoutes.showWhenReady({ trip: 'qibla' });
})().catch(error => console.error('Could not initialize Qibla routes', error));
