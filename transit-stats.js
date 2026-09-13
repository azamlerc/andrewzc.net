// Shared by the transit pages; the page scripts choose the labels and metrics.
export function completedStats(entities) {
  const done = entities.filter(entity => entity.section === "done");
  const countries = new Set();
  let size = 0;

  for (const entity of done) {
    const value = Number(entity.size);
    if (Number.isFinite(value)) size += value;

    const codes = Array.isArray(entity.countries) ? entity.countries : [entity.country];
    for (const code of codes) {
      if (typeof code === "string" && code.trim()) countries.add(code.trim().toUpperCase());
    }
  }

  return { completed: done.length, size, countries: countries.size };
}

export async function renderTransitStats({ page, stats }) {
  let entities = window.places || [];
  const url = new URL(window.location.href);

  // Keep these lifetime totals intact when the entity list is filtered.
  if (url.searchParams.get("q") || url.searchParams.get("country")) {
    const base = (url.searchParams.get("api") || "https://api.andrewzc.net").replace(/\/+$/, "");
    const response = await fetch(`${base}/pages/${encodeURIComponent(page)}/entities`, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error(`Transit stats: API ${response.status}`);
    entities = (await response.json()).entities;
  }

  const items = document.querySelector("#app > .items");
  if (!items) return;

  const totals = completedStats(entities);
  const cards = document.createElement("dl");
  cards.className = "transit-stats";
  cards.setAttribute("aria-label", "Completed systems");
  const numberFormat = new Intl.NumberFormat("en");

  for (const { metric, label } of stats) {
    const card = document.createElement("div");
    card.className = "transit-stat";
    const term = document.createElement("dt");
    term.textContent = label;
    const value = document.createElement("dd");
    value.textContent = numberFormat.format(totals[metric]);
    card.append(term, value);
    cards.append(card);
  }

  document.querySelector("#app > .transit-stats")?.remove();
  items.before(cards);
}
