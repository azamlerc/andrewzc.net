import("./transit-stats.js").then(({ renderTransitStats }) => renderTransitStats({
  page: "metros",
  stats: [
    { metric: "completed", label: "completed" },
    { metric: "size", label: "stations" },
    { metric: "countries", label: "countries" }
  ]
})).catch(console.error);
