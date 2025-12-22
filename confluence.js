document.querySelectorAll(".coords").forEach((c) => { 
  while (c.innerHTML.length < 10) c.innerHTML = ' ' + c.innerHTML; 
});