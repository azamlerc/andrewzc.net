function checkedBoxes(group) {
  return Array.from(document.querySelectorAll(`#${group} input[type="checkbox"]:checked`))
    .map(checkbox => checkbox.value);
}

function containsAny(string, substrings) {
  for (substring of substrings) {
    if (string.includes(substring)) {
        return true;
    }
  }
  return false;
}

function saveCheckboxState() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        localStorage.setItem(checkbox.id, checkbox.checked);
    });
}

function loadCheckboxState() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        const savedState = localStorage.getItem(checkbox.id);
        if (savedState !== null) {
            checkbox.checked = savedState === 'true';
        } else {
          checkbox.checked = checkbox.defaultChecked;
        }
    });
}

document.addEventListener('DOMContentLoaded', (event) => {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', saveCheckboxState);
    });
});

function moveRandomToFront(arr) {
  if (arr.length === 0) return arr;
  const randomIndex = Math.floor(Math.random() * arr.length);
  if (randomIndex === 0) return arr;
  const randomElement = arr[randomIndex];
  arr[randomIndex] = arr[0];
  arr[0] = randomElement;
  return arr;
}

document.addEventListener("keydown", async function(event) {
	switch (event.key) {
    case "ArrowUp": selectPrev(); break;      
    case "ArrowDown": selectNext(); break;
    case "ArrowLeft": selectPrevStyle(); break;      
    case "ArrowRight": selectNextStyle(); break;
    case "Enter": search(); break;
    case "Escape": back(); break;
		default: return;
	}
	event.preventDefault();
});

function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomObject(array) {
  if (array.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
}
