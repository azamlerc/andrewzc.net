// This program implements the Solitaire encryption algorithm
// as described in the appendix of the book Cryptonomicon by
// Neal Stephenson:

// https://www.schneier.com/academic/solitaire/

// Solitaire is a cyper that can be performed using a deck of
// playing cards. If two people each have a deck of playing
// cards in the same order, each can generate a keystream that
// can be used to encypher and decypher a message.

let queue = [];
let delay = 150;

// HELPERS

let modulo = (n) => n < 1 ? modulo(n + 26) : (n - 1) % 26 + 1;
let charValue = (n) => String.fromCharCode(modulo(n) + 64);
let numVal = (letter) => letter.charCodeAt(0) - 64;
let range = (n) => Array.from(new Array(n), (x,i) => i + 1);
let zipMap = (a, b, func) => a.map((x, i) => func(x, b[i]));
let squareMap = (a, b, func) => a.map((x) => b.map((y) => func(x, y)));
let addLetters = (a, b) => charValue(numVal(a) + numVal(b));
let subLetters = (a, b) => charValue(numVal(a) - numVal(b));
let addStrings = (a, b) => zipMap([...a], [...b], addLetters).join("");
let subStrings = (a, b) => zipMap([...a], [...b], subLetters).join("");
let xPad = (s) => (s.length % 5) ? xPad(s + "X") : s;
let pretty = (s) => xPad(s.toUpperCase().replace(/[^a-zA-Z]/g, ""));
let join = (a) => a.join("");
let blocks = (s) => s.match(/.{1,5}/g).join(" ");
let chunks = (a, n) => Array.from(Array(Math.ceil(a.length/n)), (_,i)=>a.slice(i*n,i*n+n));
let aaaaa = (n) => "A".repeat(n);
let example = (n) => "KDWUPONOWT".repeat(n / 10 + 1).substring(0, n);
let assert = (type, a, b) => console.log(`${type}: ${a === b ? "pass" :
    "fail"} (${a}${a !== b ? " / " + b : ""})`);

// DECK

let suits = ["♣️", "♦️", "♥️", "♠️"];
let jokerA = [1, "🃏"];
let jokerB = [2, "🃏"];
let newDeck = () => squareMap(suits, range(13), (a, b) => [b, a])
  .flat().concat([jokerA, jokerB]);
let deck = newDeck();

function cardNumber(card) {
  switch (card[1]) {
    case "♣️": return card[0];
    case "♦️": return card[0] + 13;
    case "♥️": return card[0] + 26;
    case "♠️": return card[0] + 39;
    default: return 53;
  }
}

function cardLetter(card) {
  switch (card[1]) {
    case "♣️":
    case "♥️": return charValue(card[0]);
    case "♦️":
    case "♠️": return charValue(card[0] + 13);
    default: return null;
  }
}

function rank(card) {
  if (card[1] == "🃏") {
    return card[0] == 1 ? "A" : "B"; 
  }
  switch (card[0]) {
    case 1: return "A";
    case 11: return "J";
    case 12: return "Q";
    case 13: return "K";
    default: return card[0];
  }
}

function cardDescription(card) {
  return rank(card) + card[1];
}

function cardDiv(card) {
  let value = (card[0] == 10 ? "" : "&nbsp;") + rank(card) + card[1];
  return '<div class="card">' + value + '</div>';
}

function moveDown(card, by) {
    let index = deck.indexOf(card);
    deck.splice(index, 1);
    let newIndex = (index + by - 1) % deck.length + 1;
    deck.splice(newIndex, 0, card);
    queue.push({status: `move ${cardDescription(card)} down by ${by}`, deck: deck.slice()});
}

function cut(count) {
    deck = [deck.slice(count, 53),
            deck.slice(0, count),
            deck.slice(53, 54)].flat();
    queue.push({status: `cut ${count}`, deck: deck.slice()});
}

function tripleCut(card1, card2) {
    let index1 = deck.indexOf(card1);
    let index2 = deck.indexOf(card2);
    if (index1 > index2) {
        [index1, index2] = [index2, index1];
    }
    deck = [deck.slice(index2 + 1, 54),
            deck.slice(index1, index2 + 1),
            deck.slice(0, index1)].flat();
    queue.push({status: `triple cut ${cardDescription(card1)} and ${cardDescription(card2)}`, deck: deck.slice()});
}

// SOLITAIRE

function encrypt() {
  queue.push({status: "encrypting", keystream: "", encrypted: ""});
  keyDeck(getFieldValue("key"));
  solitaire(pretty(getFieldValue("plaintext")), "encrypted");
}

function decrypt() {
  queue.push({status: "decrypting", keystream: "", plaintext: ""});
  keyDeck(getFieldValue("key"));
  solitaire(pretty(getFieldValue("encrypted")), "plaintext");
}

function shuffle() {
  moveDown(jokerA, 1);
  moveDown(jokerB, 2);
  tripleCut(jokerA, jokerB);
  cut(cardNumber(deck[53]));
}

function keyLetter(letter) {
  queue.push({status: `keying deck: ${letter}`, deck: deck.slice()});
  shuffle();
  cut(numVal(letter));
}

function keyDeck(phrase) {
  deck = newDeck();
  queue.push({status: "reset deck", deck: deck.slice()});
  if (phrase) [...phrase].forEach(keyLetter);
}

function solitaire(value, field) {
  let encrypt = field == "encrypted";
  let keystream = "";
  let result = ""
  
  while (keystream.length < value.length) {
    shuffle();
    let number = cardNumber(deck[0]);
    let letter = cardLetter(deck[number]);
    if (letter === null) continue;
    
    keystream += letter;
    let subvalue = value.substring(0, keystream.length);
    let operation = encrypt ? addStrings : subStrings;
    result = operation(subvalue, keystream);
    
    let event = {status: `next letter: ${letter}`, keystream: blocks(keystream)};
    event[field] = blocks(result);
    queue.push(event);
  }
  
  queue.push({status: encrypt ? "encrypted" : "decrypted"});
}

// INTERFACE

let fields = {};
let fieldNames = ["key", "source", "plaintext", "keystream", "encrypted", "status"];
let fieldDefaults = {"key": "CRYPTONOMICON", "source": "Solitaire!", "plaintext": "SOLIT AIREX"};

function getFieldValue(field) {
  return fields[field].value
}

function setFieldValue(field, value) {
  fields[field].value = value;
  setCookie(field, value);
}

function getCookie(cname) {
  var name = cname + "=";
  var decodedCookie = decodeURIComponent(document.cookie);
  var ca = decodedCookie.split(';');
  for(var i = 0; i <ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

function setCookie(cname, cvalue) {
  document.cookie = cname + "=" + cvalue + ";path=/";
}

function initFields() {
  fieldNames.forEach((field) => {
    let input = document.getElementById(field);
    fields[field] = input; 
    input.value = getCookie(field) || fieldDefaults[field] || "";
  });
}

function addEventListeners() {
  // make key uppercase
  fields["key"].addEventListener("input", (event) => {
    event.target.value = event.target.value.toUpperCase();  
  });

  // update plaintext from source
  fields["source"].addEventListener("input", (event) => {
    setFieldValue("plaintext", blocks(pretty(event.target.value)));
  });

  // set cookie on change
  fieldNames.forEach((field) => fields[field].addEventListener("input", (event) => {
    setCookie(field, event.target.value);
  }));
}

function showDeck(deck) {
  document.getElementById("deck").innerHTML = chunks(deck.map(cardDiv), 9).reduce((s, a) => s + a.join("") + "<br>", "");
}

function processEvent() {
  if (queue.length == 0) return;
  let event = queue.shift();
  fieldNames.forEach((field) => {
    let value = event[field];
    if (value !== undefined) setFieldValue(field, value);
  });
  let deck = event["deck"];
  if (deck) showDeck(deck);
}

initFields();
showDeck(deck);
addEventListeners();
setInterval(processEvent, delay);
