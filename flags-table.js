
function getFilename(filePath) {
  let filename = filePath.split('/').pop(); // Split by '/' and get the last part
  return filename.split('.').slice(0, -1).join('.');
}

function appendCountryHeaders(countries) {
  countries.forEach(country => {
    const th = document.createElement('th');
    const tooltipDiv = document.createElement('div');
    tooltipDiv.className = 'tooltip';
    const anchor = document.createElement('a');
    anchor.href = `countries/${country.key}.html`;
    anchor.innerHTML = country.icon;
    const tooltipText = document.createElement('span');
    tooltipText.className = 'tooltiptext';
    tooltipText.textContent = country.name;
    tooltipDiv.appendChild(anchor);
    tooltipDiv.appendChild(tooltipText);
    th.appendChild(tooltipDiv);
    headerRow.appendChild(th);
  });
}

function appendCountryTotals(countries) {
  countries.forEach(country => {
    const td = document.createElement('td');
    const span = document.createElement('span');
    span.className = 'dark';
    span.innerHTML = `${country.count}`;
    td.appendChild(span);
    totalsRow.appendChild(td);
  });
}

let shortNames = {
  "Belfries of Belgium and France": "Belfries",
  "Accidentally Wes Anderson": "Wes Anderson"
}

function link(href, text) {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.innerHTML = text;
  return anchor;
}

function appendTableRows(flags, filter) {
  let tbody = table.querySelector('tbody');
  flags.pages.forEach(page => {
    if (!filter || page.group == filter) {
      const tr = document.createElement('tr');
    
      const pageCell = document.createElement('td');
      pageCell.appendChild(link(`${page.key}.html`, `${page.icon} ${shortNames[page.name] || page.name}`));
      tr.appendChild(pageCell);

      const countCell = document.createElement('td');
      const countSpan = document.createElement('span');
      countSpan.className = "dark";
      countSpan.innerHTML = `${page.count}`;
      countCell.appendChild(countSpan);
      tr.appendChild(countCell);
    
      let counts = decompressArray(flags.data[page.key].split(",").map(n => Number(n)));
      while (counts.length < flags.countries.length) counts.push(0);
      counts.forEach((count, index) => {
        const td = document.createElement('td');
        let countryKey = flags.countries[index].key;
        if (count) {
          td.appendChild(link(`countries/${countryKey}.html#${page.key}`, count));
        } else {
          td.innerHTML = "–";
        }
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  let filter = getParam("filter");
  fetch(`data/flags.json`)
    .then(response => response.json())
    .then(flags => {
      total.innerHTML = flags.totalCount;
      appendCountryHeaders(flags.countries);
      appendCountryTotals(flags.countries);
      appendTableRows(flags, filter);
    });
  });

function getParam(name, defaultValue = null) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.has(name) ? urlParams.get(name) : defaultValue;
}

function compressArray(arr) {
    let compressed = [];
    let count = 0;

    for (let i = 0; i < arr.length; i++) {
        if (arr[i] === 0) {
            count++;
        } else {
            if (count > 0) {
                compressed.push(0, count);
                count = 0;
            }
            compressed.push(arr[i]);
        }
    }

    if (count > 0) {
        compressed.push(0, count);
    }

    return compressed;
}

function decompressArray(compressed) {
    let decompressed = [];

    for (let i = 0; i < compressed.length; i++) {
        if (compressed[i] === 0 && i + 1 < compressed.length) {
            decompressed.push(...Array(compressed[i + 1]).fill(0));
            i++;
        } else {
            decompressed.push(compressed[i]);
        }
    }
  
    return decompressed;
}

