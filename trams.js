import("./transit-stats.js").then(({ renderTransitStats }) => renderTransitStats({
  page: "trams",
  stats: [
    { metric: "completed", label: "completed" },
    { metric: "size", label: "stops" },
    { metric: "countries", label: "countries" }
  ]
})).catch(console.error);
