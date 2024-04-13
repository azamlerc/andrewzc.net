
function getFilename(filePath) {
  let filename = filePath.split('/').pop(); // Split by '/' and get the last part
  return filename.split('.').slice(0, -1).join('.');
}

function createLinks() {
	let table = document.getElementsByClassName("flags")[0];
	let headerCells = Array.from(table.rows[0].cells);
	
	let countryLinks = headerCells.map((cell) => {
		try {
			return cell.firstChild.firstChild.href;
		} catch (error) {
			return ""
		}
	});

	for (var i = 2; i < table.rows.length; i++) {
		let row = table.rows[i];
		let fileId = getFilename(row.cells[0].firstChild.href);
		for (let j = 2; j < row.cells.length; j++) {
			let cell = row.cells[j];
			if (cell.innerHTML == "–") continue;
			cell.innerHTML = `<a href="${countryLinks[j]}#${fileId}">${cell.innerHTML}</a>`;
		}
	}
}

document.addEventListener('DOMContentLoaded', function() {
    createLinks();
});