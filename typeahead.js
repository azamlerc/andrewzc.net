document.addEventListener("keydown", function(event) {
	if (event.key === "ArrowUp") {
    up();
  } else if (event.key === "ArrowDown") {
    down();
  } else if (event.key === "ArrowLeft") {
    left();
  } else if (event.key === "ArrowRight") {
    right();
  } else if (event.key === "Enter") {
    enter();
  } else if (event.key === "Escape") {
    escape();
  } else if (event.ctrlKey || event.metaKey) {
  	return;
	} else if (event.key >= 'a' && event.key <= 'z') {
    letter(event.key);
  } else {
    return;
  }

  event.preventDefault();
});

// gets all text links on the page
// don't cache the result, call this function each time you need it
function getLinks() {
  return Array.from(document.getElementsByTagName("a")).filter(isText);
}

// returns whether the link starts with a letter or number
function isText(link) {
  if (link.innerHTML.length == 0) return false;
  return /^[a-zA-Z0-9]+$/.test(link.innerHTML[0]);
}

let selected = -1;

function up() {
  let links = getLinks();
	if (links.length > 0) {
	  if (selected != -1) deselect(links[selected]);
	  selected = (selected - 1 + links.length) % links.length;
	  select(links[selected]);
	}
 }

function down() {
  let links = getLinks();
	if (links.length > 0) {
	  if (selected != -1) deselect(links[selected]);
	  selected = (selected + 1) % links.length;
	  select(links[selected]);
	}
}

function left() {
  escape();
}

function right() {
  enter();
}

function enter() {
  if (selected != -1) {
    let links = getLinks();
    window.location = links[selected].href;
  }
}

function escape() {
  history.back();
}

let typeahead = '';
function letter(key) {
  typeahead += key;
  selectLinkByName(typeahead);
  window.setTimeout(() => typeahead = '', 2000);
}

function selectLinkByName(text) {
  let links = getLinks();
  for (let i = 0; i < links.length; i++) {
    let link = links[i];
    if (link.innerHTML.toLowerCase().startsWith(text)) {
		  if (selected != -1) deselect(links[selected]);
      selected = i;
      select(links[selected]);
      return true;
    }
  }
  return false;
}

function select(link) {
  link.classList.add("selected");
  scrollToMiddle(link);
  console.log('Selected: ' + link.innerHTML);
}

function deselect(link) {
  link.classList.remove("selected");
}

function scrollToMiddle(link) {
  link.scrollIntoView({behavior: 'auto', block: 'center', inline: 'center'});
}

