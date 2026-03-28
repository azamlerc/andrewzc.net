const table = document.getElementById("table");
const lists = document.getElementById("lists");
const directionOrder = ["⬆️", "➡️", "⬇️", "⬅️"];

let mapPlaces = [];

if (table) table.style.visibility = "hidden";

function placeCode(place, type) {
  return type === "states"
    ? String(place.code || "").toUpperCase()
    : (UI.countryCodeFromFlagEmoji(place.icon) || "").toUpperCase();
}

function createHeader(type) {
  const header = table.insertRow();
  header.appendChild(document.createElement("td"));

  places.forEach((place) => {
    const cell = document.createElement("th");
    const tooltip = UI.el("div", { className: "tooltip" });
    const iconNode = type === "states"
      ? UI.el("img", {
          className: "state",
          src: `images/flags/${place.code.toLowerCase()}.png`,
          alt: place.name,
        })
      : UI.el("a", { href: `countries/${place.key}.html` }, place.icon);

    tooltip.appendChild(iconNode);
    tooltip.appendChild(UI.el("span", { className: "tooltiptext" }, place.name));
    cell.appendChild(tooltip);
    header.appendChild(cell);
  });
}

async function fetchIncludedEntities(page) {
  if (!Array.isArray(page.include) || page.include.length === 0) return [];

  const res = await fetch(`${Results.API_BASE}/pages/${encodeURIComponent(page.key)}/entities`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Failed /pages/${page.key}/entities: ${res.status}`);

  const payload = await res.json();
  return (payload.entities || [])
    .filter((entity) => page.include.includes(entity.name))
    .map((entity) => ({
      ...entity,
      list: page.key,
      sourceList: entity.list || page.key,
      matchedPlaces: [],
    }));
}

function sortByCoords(list) {
  list.sort((a, b) => {
    const coordsA = UI.parseCoords(a.coords);
    const coordsB = UI.parseCoords(b.coords);
    if (!coordsA || !coordsB) return String(a.name || "").localeCompare(String(b.name || ""));
    return coordsB.lat !== coordsA.lat ? coordsB.lat - coordsA.lat : coordsA.lon - coordsB.lon;
  });
}

function sortPageEntities(page, list) {
  if (page.key === "extremities") {
    list.sort((a, b) => directionOrder.indexOf(a.icons?.[1]) - directionOrder.indexOf(b.icons?.[1]));
    return;
  }

  if (page.key === "confluence") {
    sortByCoords(list);
    return;
  }

  list.sort((a, b) => {
    const beenA = a.been === true ? 1 : 0;
    const beenB = b.been === true ? 1 : 0;
    return beenA !== beenB ? beenB - beenA : String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function applyEntityFilters(list, page, place, type, bingoFilter) {
  let filtered = list.filter((entity) => entity.matchedPlaces?.includes(placeCode(place, type)));

  if (type === "countries") {
    filtered = filtered.filter((entity) => !entity.reference || entity.reference.includes(" km"));
    if (typeof bingoFilter === "function") filtered = filtered.filter(bingoFilter);
  } else if (type === "states" && page.key === "extremities") {
    filtered = filtered.filter((entity) => !entity.reference);
  }

  sortPageEntities(page, filtered);
  return filtered;
}

function finalizeAllEntities(page, byPlace, included) {
  const all = UI.dedupeEntities([
    ...byPlace.flat(),
    ...included,
  ]);

  if (page.sort === "been") all.sort((a, b) => (b.been === true ? 1 : 0) - (a.been === true ? 1 : 0));
  if (page.sort === "reversePrefix") all.sort((a, b) => Number(b.prefix) - Number(a.prefix));
  if (page.sort === "prefix") all.sort((a, b) => Number(a.prefix) - Number(b.prefix));

  return all.map((entity) => ({
    ...entity,
    pageIcon: page.icon,
    pageKey: page.key,
    pageName: page.name,
    hide: Array.isArray(page.exclude) && page.exclude.includes(entity.name),
  }));
}

function addCellsToRow(page, byPlace, row) {
  if (page.hide) return;

  byPlace.forEach((list, i) => {
    const visited = list.filter((entity) => entity.been).length;
    let total = list.length;
    if (page.fixedTotal) total = page.fixedTotal;
    if (page.key === "confluence" && places[i].confluences !== undefined) total = places[i].confluences;

    const color = visited && total ? `rgba(0, 200, 0, ${visited / total})` : "rgba(255, 0, 0, 0.30)";
    const cell = row.insertCell();
    cell.className = "ratio";
    cell.style.backgroundColor = color;

    if (!total) {
      cell.style.backgroundColor = "rgba(0, 200, 0, 1.0)";
      cell.textContent = page.key === "lowest" ? "1" : "—";
      return;
    }

    cell.textContent = page.hideTotal || visited === total ? String(visited) : `${visited}/${total}`;
  });
}

function stateFlagNode(code) {
  return UI.el("img", {
    className: "state",
    src: `images/flags/${String(code || "").toLowerCase()}.png`,
    alt: code,
  });
}

function renderStateEntityRow(entity, page) {
  const row = UI.el("span");

  if (entity.prefix) {
    row.appendChild(UI.el("span", { className: "fixed" }, `${entity.prefix} `));
  }

  const iconNodes = [];
  if (entity.state) iconNodes.push(stateFlagNode(entity.state));
  else if (Array.isArray(entity.states)) {
    entity.states.forEach((code, index) => {
      if (index > 0) iconNodes.push(document.createTextNode(" "));
      iconNodes.push(stateFlagNode(code));
    });
  }
  if (page.key === "extremities" && entity.icons?.[1]) {
    if (iconNodes.length > 0) iconNodes.push(document.createTextNode(" "));
    iconNodes.push(document.createTextNode(entity.icons[1]));
  }

  if (iconNodes.length > 0) {
    const iconWrap = entity.been === false ? UI.el("span", { className: "todo" }, iconNodes) : UI.el("span", {}, iconNodes);
    row.appendChild(iconWrap);
    row.appendChild(document.createTextNode(" "));
  }

  if (entity.link) {
    row.appendChild(UI.el("a", { href: entity.link }, entity.name || entity.key || ""));
  } else {
    row.appendChild(document.createTextNode(entity.name || entity.key || ""));
  }

  if (entity.reference) {
    row.appendChild(document.createTextNode(" "));
    row.appendChild(UI.el("span", { className: "dark" }, entity.reference));
  }

  if (entity.strike) row.style.textDecoration = "line-through";
  return row;
}

function renderCountryEntityRow(entity) {
  const row = UI.el("span");

  if (entity.prefix) {
    row.appendChild(UI.el("span", { className: "fixed" }, `${entity.prefix} `));
  }

  const iconText = Array.isArray(entity.icons) ? entity.icons.join(" ") : "";
  if (iconText) {
    const iconWrap = entity.been === false ? UI.el("span", { className: "todo" }, iconText) : document.createTextNode(iconText);
    row.appendChild(iconWrap);
    row.appendChild(document.createTextNode(" "));
  }

  if (entity.link) {
    row.appendChild(UI.el("a", { href: entity.link }, entity.name || entity.key || ""));
  } else {
    row.appendChild(document.createTextNode(entity.name || entity.key || ""));
  }

  if (entity.strike) row.style.textDecoration = "line-through";
  return row;
}

function createLists(bingoResults, type) {
  bingoResults.forEach(({ page, all }) => {
    const section = UI.el("div");
    section.appendChild(UI.smallSpace());
    section.appendChild(UI.el("a", { name: page.key, id: page.key }));
    section.appendChild(document.createTextNode(page.icon ? `${page.icon} ` : ""));
    section.appendChild(UI.el("a", { href: `${page.key}.html`, className: "link" }, page.name));
    section.appendChild(UI.br());

    all.forEach((entity) => {
      if (entity.hide) return;
      if (type === "states") {
        section.appendChild(renderStateEntityRow(entity, page));
        section.appendChild(UI.br());
      } else {
        section.appendChild(renderCountryEntityRow(entity));
        section.appendChild(UI.br());
      }
    });

    lists.appendChild(section);
  });

  Results.scrollToHashAnchor();
}

function applyPageKeyFilter(enabledKeys) {
  mapPlaces.forEach((place) => {
    place.hide = !!place.pageKey && !enabledKeys.includes(place.pageKey);
  });
  refreshMap(mapPlaces);
}

function attachCheckboxFilters() {
  const checkboxes = table.querySelectorAll('input[type="checkbox"][data-key]');
  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const enabledKeys = [...checkboxes]
        .filter((cb) => cb.checked)
        .map((cb) => cb.dataset.key);
      applyPageKeyFilter(enabledKeys);
    });
  });
}

function buildMapPlaces(bingoResults) {
  return bingoResults.flatMap(({ all }) => all).map((entity) => {
    const mapped = {
      ...entity,
      icons: Array.isArray(entity.icons) ? [...entity.icons] : [],
    };

    if (mapped.pageIcon === "🧭") mapped.icons.reverse();
    else if (mapped.icons.length > 0) mapped.icons.unshift(mapped.pageIcon);

    return mapped;
  });
}

async function bingoMain(type, bingoFilter) {
  const requestBody = {
    pages: pages.map((page) => page.key),
    [type]: places.map((place) => placeCode(place, type)).filter(Boolean),
  };

  const [{ pages: allPages, data: bingoPayload }, includeEntries] = await Promise.all([
    Results.fetchPagesAndJson(`${Results.API_BASE}/entities/bingo`, {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
    Promise.all(pages.map(async (page) => [page.key, await fetchIncludedEntities(page)])),
  ]);

  const pageMetaByKey = new Map((allPages || []).map((page) => [page.key, page]));
  const includeByPage = new Map(includeEntries);
  const mergedPages = pages.map((page) => ({
    ...(pageMetaByKey.get(page.key) || {}),
    ...page,
  }));
  const byList = Results.bucketByList(Results.withPageIcons(bingoPayload.entities || [], mergedPages));
  const bingoResults = [];

  mergedPages.forEach((page) => {
    let row = null;
    if (!page.hide) {
      row = table.insertRow();
      const labelCell = row.insertCell();
      const checkbox = UI.el("input", {
        className: "bingo",
        type: "checkbox",
        id: `chk-${page.key}`,
        "data-key": page.key,
        checked: "checked",
      });
      labelCell.appendChild(checkbox);
      labelCell.appendChild(document.createTextNode(` ${page.icon} `));
      labelCell.appendChild(UI.el("a", { href: `${page.key}.html` }, page.name));
      labelCell.appendChild(document.createTextNode("\u00a0\u00a0"));
    }

    const pageEntities = byList.get(page.key) || [];
    const byPlace = places.map((place) => applyEntityFilters(pageEntities, page, place, type, bingoFilter));
    const included = Results.withPageIcons(includeByPage.get(page.key) || [], mergedPages);
    const all = finalizeAllEntities(page, byPlace, included);

    addCellsToRow(page, byPlace, row);
    bingoResults.push({ page, all });
  });

  createLists(bingoResults, type);
  mapPlaces = buildMapPlaces(bingoResults);
  attachCheckboxFilters();
  table.style.visibility = "visible";
}
