const API_BASE = 'https://api.andrewzc.net';
const LOGO_BASE = 'images/work/';

async function loadResume() {
  const params = new URLSearchParams(window.location.search);
  const custom = params.get('custom');

  // Use the first custom value for the API call (server handles merge),
  // then apply any remaining client-side patches for local .json overrides.
  const names = custom
    ? custom.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const apiPath = names.length > 0
    ? `${API_BASE}/resume/${names[0]}`
    : `${API_BASE}/resume`;

  const res = await fetch(apiPath);
  const { entries } = await res.json();

  // Apply any additional client-side patches (names[1], names[2], ...)
  for (const name of names.slice(1)) {
    try {
      const patchRes = await fetch(`resume/custom/${name}.json`);
      if (!patchRes.ok) { console.warn(`Patch not found: ${name}.json`); continue; }
      const patches = await patchRes.json();
      applyPatches(entries, patches);
    } catch (err) {
      console.warn(`Failed to load patch: ${name}.json`, err);
    }
  }

  render(entries);
}

// Merge patch objects into base entries, matched by company name.
// Scalar fields are replaced; bullets array is replaced wholesale if present.
function applyPatches(entries, patches) {
  for (const patch of patches) {
    const entry = entries.find(e => e.company === patch.company);
    if (!entry) {
      const clone = Object.assign({}, patch);
      if (patch.index !== undefined) {
        entries.splice(patch.index, 0, clone);
      } else {
        entries.push(clone);
      }
      continue;
    }
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'company') continue;
      entry[key] = value;
    }
  }
}

function logoCell(company, isFirst, isLast) {
  const logoFile = company.toLowerCase() + '.png';
  const imgHtml = `<img src="${LOGO_BASE}${logoFile}" alt="${company} logo"
    onerror="this.parentNode.innerHTML='<div class=logo-placeholder>${company.substring(0,3).toUpperCase()}</div>'">`;

  const lineAbove = isFirst ? '' : `<div class="line-above" style="height:calc(50% - 42px)"></div>`;
  const lineBelow = isLast  ? '' : `<div class="line-below" style="height:calc(50% - 42px)"></div>`;

  return `
    <div class="col-logo-inner">
      ${lineAbove}
      <div class="logo-wrap">${imgHtml}</div>
      ${lineBelow}
    </div>`;
}

function render(entries) {
  const container = document.getElementById('experience');

  entries.forEach((e, i) => {
    const isFirst = i === 0;
    const isLast  = i === entries.length - 1;

    const titlesHtml = e.titles.map(t => {
      const match = t.match(/^(.+?)\s+\((\d{4}[–\-]\d{4})\)$/);
      if (match) {
        return `<span class="title-item">${match[1]}<span class="title-years">${match[2]}</span></span>`;
      }
      const match2 = t.match(/^(.+?)\s+(\d{4}\s*[–\/]\s*\d{4})$/);
      if (match2) {
        return `<span class="title-item">${match2[1]}<span class="title-years">${match2[2]}</span></span>`;
      }
      return `<span class="title-item">${t}</span>`;
    }).join('');

    const bulletsHtml = e.bullets
      ? `<ul>${e.bullets.map(b => `<li>${b}</li>`).join('')}</ul>`
      : '';

    const outroHtml = e.outro
      ? `<p class="outro">${e.outro}</p>`
      : '';

    const detailsHtml = e.details
      ? e.details.map(d => `<p style="margin:0;line-height:1.5">${d}</p>`).join('')
      : '';

    const urlDisplay = e.url;
    const urlTarget = e.altUrl || e.url;
    const urlHref = urlTarget.startsWith('http') ? urlTarget : `https://${urlTarget}`;

    const yearParts = e.years.split('–');
    const yearHtml = yearParts.length === 2
      ? `${yearParts[0]}<br>${yearParts[1]}`
      : yearParts[0];

    const html = `
      <div class="entry">
        <div class="entry-header">
          <div class="col-year">${yearHtml}</div>
          <div class="col-logo" style="height:92px">${logoCell(e.company, isFirst, isLast)}</div>
          <div class="col-company">
            <div class="company-name">${e.company}</div>
            <div class="titles-row">${titlesHtml}</div>
          </div>
          <div class="col-location">
            <div class="location-text">${e.location}</div>
            <a class="url-link" href="${urlHref}" target="_blank">${urlDisplay}</a>
          </div>
        </div>
        <div class="entry-content">
          <div class="content-spacer-year"></div>
          <div class="content-spacer-logo"></div>
          <div class="content-body">
            ${e.intro ? `<p>${e.intro}</p>` : ''}
            ${bulletsHtml}
            ${outroHtml}
            ${detailsHtml}
          </div>
        </div>
      </div>`;

    container.insertAdjacentHTML('beforeend', html);
  });
}

loadResume();
