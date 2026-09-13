import("./transit-stats.js").then(({ renderTransitStats }) => renderTransitStats({
  page: "light-rail",
  stats: [
    { metric: "completed", label: "completed" },
    { metric: "size", label: "stations" },
    { metric: "countries", label: "countries" }
  ]
})).catch(console.error);
