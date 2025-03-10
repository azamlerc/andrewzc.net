// Create a JavaScript object where the keys are the two letter country codes 
// for every country and the values are the name of the country in lowercase 
// with spaces replaced by hyphens
const artistNames = {
  "ABBA": "abba",
  "Ace of Base": "ace-of-base",
  "Air": "air",
  "Alanis Morissette": "alanis-morissette",
  "Alphabeat": "alphabeat",
  "Amanda Palmer": "amanda-palmer",
  "Amy Winehouse": "amy-winehouse",
  "Awkwafina": "awkwafina",
  "The B-52s": "b-52s",
  "Babylon Zoo": "babylon-zoo",
  "Barenaked Ladies": "barenaked-ladies",
  "Beastie Boys": "beastie-boys",
  "The Beatles": "beatles",
  "Beck": "beck",
  "Bel Canto": "bel-canto",
  "Billy Joel": "billy-joel",
  "Björk": "bjork",
  "The Black Crowes": "black-crowes",
  "Bon Jovi": "bon-jovi",
  "Cake": "cake",
  "Césaria Évora": "cesaria-evora",
  "Cheb Mami": "cheb-mami",
  "The Cranberries": "cranberries",
  "Counting Crows": "counting-crows",
  "Daft Punk": "daft-punk",
  "Dave Matthews Band": "dave-matthews-band",
  "David Bowie": "david-bowie",
  "Depeche Mode": "depeche-mode",
  "Dido": "dido",
  "Duran Duran": "duran-duran",
  "Dua Lipa": "dua-lipa",
  "Elton John": "elton-john",
  "Elvis Costello": "elvis-costello",
  "Elvis Presley": "elvis-presley",
  "EMF": "emf",
  "Enigma": "enigma",
  "Faith No More": "faith-no-more",
  "Fleetwood Mac": "fleetwood-mac",
  "Florence + the Machine": "florence-+-machine",
  "Garbage": "garbage",
  "Green Day": "green-day",
  "Guns N’ Roses": "guns-n-roses",
  "Hooverphonic": "hooverphonic",
  "INXS": "inxs",
  "Jay-Z": "jay-z",
  "Jimi Hendrix": "jimi-hendrix",
  "Joan Osborne": "joan-osborne",
  "Johnny Cash": "johnny-cash",
  "Kate Bush": "kate-bush",
  "The Killers": "killers",
  "The KLF": "klf",
  "Kraftwerk": "kraftwerk",
  "La Roux": "la-roux",
  "Lady Gaga": "lady-gaga",
  "Led Zeppelin": "led-zeppelin",
  "Leonard Cohen": "leonard-cohen",
  "Live": "live",
  "Liz Phair": "liz-phair",
  "Madonna": "madonna",
  "Massive Attack": "massive-attack",
  "Melissa Etheridge": "melissa-etheridge",
  "Metallica": "metallica",
  "Moby": "moby",
  "Morrissey": "morrissey",
	"Mötley Crüe": "motley-crue",
  "Natalie Imbruglia": "natalie-imbruglia",
  "New Order": "new-order",
  "Nina Simone": "nina-simone",
  "Nine Inch Nails": "nine-inch-nails",
  "Oasis": "oasis",
  "Paul Simon": "paul-simon",
  "Paula Cole": "paula-cole",
  "Pet Shop Boys": "pet-shop-boys",
  "Peter Gabriel": "peter-gabriel",
  "Pink Floyd": "pink-floyd",
  // "Pink": "pink",
  "Placebo": "placebo",
  "Poison": "poison",
  "The Prodigy": "prodigy",
  "R.E.M.": "rem",
  "Radiohead": "radiohead",
  "Regina Spektor": "regina-spektor",
  "Robbie Williams": "robbie-williams",
  "Roxette": "roxette",
  "Rush": "rush",
  "Sarah McLachlan": "sarah-mclachlan",
  "Scissor Sisters": "scissor-sisters",
  "Sheryl Crow": "sheryl-crow",
  "Sinéad O’Connor": "sinead-oconnor",
  "The Smashing Pumpkins": "smashing-pumpkins",
  "Sophie B. Hawkins": "sophie-b-hawkins",
  "Stereo Total": "stereo-total",
  "Sting": "sting",
  "t.A.T.u.": "tatu",
  "Tears for Fears": "tears-for-fears",
  "Tom Petty": "tom-petty",
  "Tori Amos": "tori-amos",
  "U2": "u2",
  "Véronique Sanson": "veronique-sanson",
  "The White Stripes": "white-stripes",
};

// update the replaceFlagWithLink function to work with a lookup table that can have any keys and values
// instead of searching for flagPattern, search for keys from the lookupTable
function replaceArtistNames() {
    const keysPattern = new RegExp(Object.keys(artistNames).join('|'), 'g');
    
    document.body.childNodes.forEach(node => {
        if (node.nodeType === 3) { // Process only text nodes
            const replacedText = node.nodeValue.replace(keysPattern, match => {
                const link = artistNames[match];
                return `<a href="artists/${link}.html" style="color: inherit;">${match}</a>`;
            });

            if (replacedText !== node.nodeValue) {
                const span = document.createElement('span');
                span.innerHTML = replacedText;
                node.replaceWith(span);
            }
        }
    });
    
    /* 
    const newContent = document.body.innerHTML.replace(keysPattern, function(match) {
				const link = artistNames[match];
        return `<a href="artists/${link}.html" style="color: inherit">${match}</a>`;
    });
    
    document.body.innerHTML = newContent;
    */
}

document.addEventListener('DOMContentLoaded', function() {
    replaceArtistNames();
});