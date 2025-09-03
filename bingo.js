const table = document.getElementById("table");
const lists = document.getElementById("lists");

let mapPlaces = [];
const directionOrder = ["⬆️", "➡️", "⬇️", "⬅️"];

function createHeader() {
  let header = table.insertRow();
  header.insertCell();
  places.forEach(place => {
    let cell = document.createElement("th");
    let icon = place.code ? 
			`<img class="state-small" src="images/states/${place.code.toLowerCase()}.png">`:
			`<a href="countries/${place.key}.html">${place.icon}</a>`;
    cell.innerHTML = `<div class="tooltip">${icon}<span class="tooltiptext">${place.name}</span></div>`;
    header.appendChild(cell);
  });
}

async function bingoMain(type) {
  const bingoResults = [];
  for (let r = 0; r < pages.length; r++) {
    const page = pages[r];
    let row;
		if (!page.hide) {
			row = table.insertRow();
			const checkboxId = `chk-${page.key}`;
			const checkedAttr = page.hide ? "" : "checked";

			row.insertCell().innerHTML = `
			  <input class="bingo" type="checkbox" id="${checkboxId}" data-key="${page.key}" ${checkedAttr} />
			  ${page.icon} <a href="${page.key}.html">${page.name}</a>&nbsp;&nbsp;
			`;
		}
    let data = await loadData(page.key);
    let all = [];
    let byPlace = places.map((c, i) => {
      let list = Object.values(data);
      if (type == "countries") {
        list = list.filter(p => p.icons?.includes(c.icon) && (!p.reference || p.reference.includes(" km")));
      } else if (type == "states") {
        list = list.filter(p => (p.state == c.code || p.states?.includes(c.code)));
        if (page.key === "extremities") list = list.filter(p => !p.reference);
      }
      if (page.key === "extremities") list.sort((a, b) => directionOrder.indexOf(a.icons[1]) - directionOrder.indexOf(b.icons[1]));
      else if (page.key === "confluence") sortByCoords(list);
      else list.sort((a, b) => a.been !== b.been ? b.been - a.been : a.name.localeCompare(b.name));
      list.forEach(p => { if (!p.added) all.push(p); p.added = true });
      return list;
    });
		if (page.include) {
			let include = Object.values(data).filter(p => page.include.includes(p.name));
			all = all.concat(include);
		}
    if (page.sort === "been") all.sort((a, b) => b.been - a.been);
    if (page.sort === "reversePrefix") all.sort((a, b) => Number(b.prefix) - Number(a.prefix));
    if (page.sort === "prefix") all.sort((a, b) => Number(a.prefix.replace("–", "-")) - Number(b.prefix.replace("–", "-")));
    all.forEach(p => {
			p.pageIcon = page.icon;
			p.pageKey = page.key;
			p.pageName = page.name;
			p.hide = page.exclude && page.exclude.includes(p.name);
		});
    mapPlaces = mapPlaces.concat(all);
		
		addCellsToRow(page, byPlace, row);
    bingoResults.push({page, all});
  }

	createLists(bingoResults, type);

	// let output = "";
  mapPlaces.forEach(p => {
    if (p.pageIcon == "🧭") p.icons.reverse();
    else p.icons.unshift(p.pageIcon);
		// output += `[${p.coords}], // ${p.name}\n`;
  });
	// console.log(output);
	
	const checkboxes = table.querySelectorAll('input[type="checkbox"][data-key]');
	checkboxes.forEach(checkbox => {
	  checkbox.addEventListener('change', () => {
	    const enabledKeys = [...checkboxes]
	      .filter(cb => cb.checked)
	      .map(cb => cb.dataset.key);
	    applyPageKeyFilter(enabledKeys);
	  });
	});
}

function applyPageKeyFilter(enabledKeys) {
	for (let key in mapPlaces) {
		const place = mapPlaces[key];
		place.hide = place.pageKey && !enabledKeys.includes(place.pageKey);
	}
	refreshMap(mapPlaces);
}

function addCellsToRow(page, byPlace, row) {
	if (!page.hide) {
    byPlace.forEach((list, i) => {
      let visited = list.filter(p => p.been).length;
      let total = list.length;
      if (page.fixedTotal) total = page.fixedTotal;
      if (page.key == "confluence" && places[i].confluences !== undefined) total = places[i].confluences;
      let color = visited && total ? `rgba(0, 200, 0, ${visited / total})` : "rgba(255, 0, 0, 0.30)";
      let cell = row.insertCell();
      cell.className = "ratio";
      cell.style.backgroundColor = color;
      if (!total) {
        cell.style.backgroundColor = "rgba(0, 200, 0, 1.0)";
        cell.innerHTML = page.key === "lowest" ? "1" : "—";
      } else {
        cell.innerHTML = page.hideTotal || visited == total ? visited : `${visited}/${total}`;
      }
    });
	}
}

function createLists(bingoResults, type) {
  bingoResults.forEach(({page, all}) => {
    let section = document.createElement("div");
    section.innerHTML = `<div class="smallSpace"><br></div><a name="${page.key}"></a> ${page.icon} <a href="${page.key}.html" class="link">${page.name}</a><br><div id="${page.key}-list"></div>`;
    lists.appendChild(section);
    let listDiv = section.querySelector(`#${page.key}-list`);
    all.forEach(p => {
      let icons;
      if (type == "countries") {
        icons = p.icons.join(" ");
      } else if (type == "states") {
        icons = p.state ? stateFlag(p.state) : p.states.map(stateFlag).join(" ");
        if (page.key === "extremities") icons += " " + p.icons[1];
      }
      if (!p.been) icons = `<span class="todo">${icons}</span>`;
      let prefix = p.prefix ? `<span class="airport">${p.prefix}</span> ` : "";
			let name = p.name;
			if (p.link) name = `<a href="${p.link}">${name}</a>`
      listDiv.innerHTML += `${prefix} ${icons} ${name}<br>\n`;
    });
  });
}

function stateFlag(code) {
  return `<img class="state-small" src="images/states/${code.toLowerCase()}.png">`;
}

async function loadData(filename) {
  const json = await fetch(`data/${filename}.json`).then(r => r.json());
  return json;
}

function sortByCoords(list) {
  list.sort((a, b) => {
    const [latA, lonA] = a.coords.split(", ").map(Number);
    const [latB, lonB] = b.coords.split(", ").map(Number);
    return latB !== latA ? latB - latA : lonA - lonB;
  });
}
