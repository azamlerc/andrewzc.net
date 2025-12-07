const PAGES_URL = "data/pages.json";
const LIST_URL = (slug) => `data/${slug}.json`;
const LIST_PAGE_URL = (slug) => `${slug}.html`;
const IMG_FULL = (listSlug, filename) =>
  `https://images.andrewzc.net/${listSlug}/${filename}`;
const IMG_THUMB = (listSlug, filename) =>
  `https://images.andrewzc.net/${listSlug}/tn/${filename}`;

const FEATURED_PROB = 0.7;
const HERO3_PROB = 0.3;  // probability of 1 big + 2 small when 3+ images

let featuredPool = [];
let nonFeaturedPool = [];
let unusedFeatured = [];
let unusedNonFeatured = [];
const usedPlaceIds = new Set();
let isLoading = false;

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function resetUnusedFeatured() {
  unusedFeatured = shuffleInPlace(featuredPool.slice());
}

function resetUnusedNonFeatured() {
  unusedNonFeatured = shuffleInPlace(nonFeaturedPool.slice());
}

function nextList() {
  if (unusedFeatured.length === 0 && featuredPool.length) resetUnusedFeatured();
  if (unusedNonFeatured.length === 0 && nonFeaturedPool.length) resetUnusedNonFeatured();

  const rollFeatured = Math.random() < FEATURED_PROB;

  if (rollFeatured && unusedFeatured.length) return { bucket: "featured", entry: unusedFeatured.pop() };
  if (!rollFeatured && unusedNonFeatured.length) return { bucket: "nonfeatured", entry: unusedNonFeatured.pop() };

  if (unusedFeatured.length) return { bucket: "featured", entry: unusedFeatured.pop() };
  if (unusedNonFeatured.length) return { bucket: "nonfeatured", entry: unusedNonFeatured.pop() };

  if (featuredPool.length) resetUnusedFeatured();
  if (nonFeaturedPool.length) resetUnusedNonFeatured();

  if (rollFeatured && unusedFeatured.length) return { bucket: "featured", entry: unusedFeatured.pop() };
  if (!rollFeatured && unusedNonFeatured.length) return { bucket: "nonfeatured", entry: unusedNonFeatured.pop() };

  if (unusedFeatured.length) return { bucket: "featured", entry: unusedFeatured.pop() };
  if (unusedNonFeatured.length) return { bucket: "nonfeatured", entry: unusedNonFeatured.pop() };

  return null;
}

function placeId(listSlug, placeSlug) {
  return `${listSlug}::${placeSlug}`;
}

const span = (text, cls) =>
  `<span${cls ? ` class="${cls}"` : ""}>${text}</span>`;

const img = (src, cls) =>
  `<img src="${src}"${cls ? ` class="${cls}"` : ""}>`;

const aTag = (href, text, cls) => {
  const hrefFinal = href || "#";
  return `<a href="${hrefFinal}"${cls ? ` class="${cls}"` : ""}>${text}</a>`;
};

function pickRandomImages(images, maxCount = 3) {
  if (!Array.isArray(images)) return [];
  if (images.length <= maxCount) return images.slice();
  const copy = images.slice();
  shuffleInPlace(copy);
  return copy.slice(0, maxCount);
}

function rowHTML(place, listMeta) {
  let prefixHTML = place.prefix || null;
  const prefixClass = (listMeta && (listMeta.prefixClass || (listMeta.info && listMeta.info.prefixClass))) || null;
  if (prefixHTML && prefixClass) prefixHTML = span(prefixHTML, prefixClass);

  const tags = (listMeta && listMeta.tags) || [];
  const referenceFirst = tags.includes("reference-first");

  let iconsHTML = (place.icons || []).join(" ");
  if (iconsHTML && place.been === false) iconsHTML = span(iconsHTML, "todo");

  const sizeForFlags = (listMeta && listMeta.size) || "large";
  const flagsHTML = place.flags
    ? place.flags.map(f => img(`images/flags/${f}.png`, `state-${sizeForFlags}`)).join(" ")
    : null;

  const referenceHTML = place.reference ? span(place.reference, "dark") : null;

  const linkHTML = aTag(
    place.link,
    place.name,
    place.strike ? "strike" : null
  );

  const badgesHTML = place.badges ? place.badges.join(" ") : null;

  const parts = [
    prefixHTML,
    iconsHTML || null,
    flagsHTML,
    (referenceFirst ? referenceHTML : null),
    linkHTML,
    (!referenceFirst ? referenceHTML : null),
    place.info || null,
    badgesHTML
  ]
    .filter(p => p != null && String(p).trim() !== "")
    .join(" ");

  return parts + "<br>\n";
}

function nextFeaturedOnly() {
  if (unusedFeatured.length === 0 && featuredPool.length) resetUnusedFeatured();
  if (unusedFeatured.length) return { bucket: "featured", entry: unusedFeatured.pop() };

  // fallback if somehow no featured lists exist
  if (unusedNonFeatured.length === 0 && nonFeaturedPool.length) resetUnusedNonFeatured();
  if (unusedNonFeatured.length) return { bucket: "nonfeatured", entry: unusedNonFeatured.pop() };

  return null;
}

function renderPlaceBlock(place, listSlug, listMeta, allowMedia) {
  if (!place) return "";

  let imagesHTML = "";
  let captionHTML = "";

  if (allowMedia) {
    const totalImages = Array.isArray(place.images) ? place.images.length : 0;

    let imagesClass = "images";
    let chosenImages = [];

    if (totalImages >= 6) {
      const doHero = Math.random() < HERO3_PROB;
      if (doHero) {
        imagesClass = "images hero3";
        chosenImages = pickRandomImages(place.images, 3);
      } else {
        imagesClass = "images sixpack";
        chosenImages = pickRandomImages(place.images, 6);
      }
    } else {
      chosenImages = pickRandomImages(place.images, 3);

      if (chosenImages.length === 1) {
        imagesClass = "images single";
      } else if (chosenImages.length === 2) {
        imagesClass = "images double";
      } else if (chosenImages.length === 3) {
        imagesClass = (Math.random() < HERO3_PROB)
          ? "images hero3"
          : "images triple";
      }
    }

    if (chosenImages.length > 0) {
      imagesHTML =
        `<div class="${imagesClass}">` +
        chosenImages.map(fn => {
          const full = IMG_FULL(listSlug, fn);
          const thumb = IMG_THUMB(listSlug, fn);
          const alt = place.name || "";
          return `<a href="${full}" target="_blank" rel="noopener"><img src="${thumb}" alt="${alt}"></a>`;
        }).join("") +
        `</div>`;
    }

    captionHTML = place.caption ? `<div class="caption">${place.caption}</div>` : "";
  }
  
  return imagesHTML + rowHTML(place, listMeta) + captionHTML;
}

function renderChunk({ listSlug, listMeta, visitedPlaces, unvisitedPlace, isFeatured }) {
  const icon = listMeta.icon || "";
  const listName = listMeta.name || listSlug;
  const listHref = LIST_PAGE_URL(listSlug);
  const sizeClass = (listMeta && listMeta.size) || "large";

  const visitedBlocks = (visitedPlaces || [])
    .map((p, i) => renderPlaceBlock(p, listSlug, listMeta, isFeatured && i === 0))
    .join("");

  const unvisitedBlock = unvisitedPlace
    ? renderPlaceBlock(unvisitedPlace, listSlug, listMeta, false)
    : "";

  return `
    <div class="chunk">
      ${icon} <a class="dark" href="${listHref}">${listName}</a><br>
      <div class="items ${sizeClass}">
        ${visitedBlocks}
        ${unvisitedBlock}
      </div>
      <hr>
    </div>
  `;
}

function pickVisitedWithImages(entries, listSlug) {
  const candidates = entries.filter(([slug, p]) =>
    p &&
    p.been === true &&
    Array.isArray(p.images) &&
    p.images.length > 0 &&
    !usedPlaceIds.has(placeId(listSlug, slug))
  );
  return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
}

function pickVisitedWithoutMedia(entries, listSlug) {
  const candidates = entries.filter(([slug, p]) =>
    p &&
    p.been === true &&
    (!p.images || p.images.length === 0) &&
    !p.caption &&
    !usedPlaceIds.has(placeId(listSlug, slug))
  );
  return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
}

function pickVisitedAny(entries, listSlug) {
  return entries.filter(([slug, p]) =>
    p && p.been === true && !usedPlaceIds.has(placeId(listSlug, slug))
  );
}

function pickUnvisited(entries, listSlug) {
  const candidates = entries.filter(([slug, p]) =>
    p && p.been === false && !usedPlaceIds.has(placeId(listSlug, slug))
  );
  return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
}

function pickNVisitedAny(entries, listSlug, n = 3) {
  const candidates = pickVisitedAny(entries, listSlug);
  if (candidates.length === 0) return [];
  shuffleInPlace(candidates);
  return candidates.slice(0, n);
}

async function appendBatch(batchSize = 8, pickerFn) {
  if (isLoading) return;
  isLoading = true;

  const contentEl = document.getElementById("content");
  contentEl.classList.remove("loading");

  let added = 0;
  let safety = (featuredPool.length + nonFeaturedPool.length) * 3;

  while (added < batchSize && safety-- > 0) {
    const pick = pickerFn ? pickerFn() : nextList();
    if (!pick) break;

    const bucket = pick.bucket;
    const entry = pick.entry;
    const listSlug = entry[0];
    const listMeta = entry[1];

    try {
      const listResp = await fetch(LIST_URL(listSlug));
      if (!listResp.ok) continue;
      const listJson = await listResp.json();

      const entries = Object.entries(listJson);

      let visitedPlaces = [];
      let unvisitedPlace = null;

      if (bucket === "featured") {
        const visitedPick1 = pickVisitedWithImages(entries, listSlug);
        if (!visitedPick1) continue;

        const vSlug1 = visitedPick1[0];
        const vPlace1 = visitedPick1[1];
        usedPlaceIds.add(placeId(listSlug, vSlug1));

        const visitedPick2 = pickVisitedWithoutMedia(entries, listSlug);
        if (!visitedPick2) continue;

        const vSlug2 = visitedPick2[0];
        const vPlace2 = visitedPick2[1];
        usedPlaceIds.add(placeId(listSlug, vSlug2));

        visitedPlaces = [vPlace1, vPlace2];

        const unvisitedPick = pickUnvisited(entries, listSlug);
        if (unvisitedPick) {
          const uSlug = unvisitedPick[0];
          const uPlace = unvisitedPick[1];
          usedPlaceIds.add(placeId(listSlug, uSlug));
          unvisitedPlace = uPlace;
        }

        contentEl.insertAdjacentHTML(
          "beforeend",
          renderChunk({
            listSlug,
            listMeta,
            visitedPlaces,
            unvisitedPlace,
            isFeatured: true
          })
        );
        added++;
        continue;
      }

      const visitedPicks = pickNVisitedAny(entries, listSlug, 3);
      if (visitedPicks.length === 0) continue;

      visitedPlaces = visitedPicks.map(([vSlug, vPlace]) => {
        usedPlaceIds.add(placeId(listSlug, vSlug));
        return vPlace;
      });

      const unvisitedPick = pickUnvisited(entries, listSlug);
      if (unvisitedPick) {
        const uSlug = unvisitedPick[0];
        const uPlace = unvisitedPick[1];
        usedPlaceIds.add(placeId(listSlug, uSlug));
        unvisitedPlace = uPlace;
      }

      contentEl.insertAdjacentHTML(
        "beforeend",
        renderChunk({
          listSlug,
          listMeta,
          visitedPlaces,
          unvisitedPlace,
          isFeatured: false
        })
      );
      added++;
    } catch (e) {}
  }

  isLoading = false;
}

function nearBottom(px = 900) {
  return window.innerHeight + window.scrollY >= document.body.offsetHeight - px;
}

function onScroll() {
  if (nearBottom() && !isLoading) appendBatch(6);
}

async function initHome() {
  const contentEl = document.getElementById("content");
  contentEl.textContent = "Loading…";

  const pagesResp = await fetch(PAGES_URL);
  const pagesJson = await pagesResp.json();

  featuredPool = Object.entries(pagesJson)
    .filter(([slug, meta]) => meta && meta.featured === true);

  nonFeaturedPool = Object.entries(pagesJson)
    .filter(([slug, meta]) => !meta || meta.featured !== true);

  resetUnusedFeatured();
  resetUnusedNonFeatured();

  contentEl.innerHTML = "";
  await appendBatch(1, nextFeaturedOnly);
  await appendBatch(9);

  window.addEventListener("scroll", onScroll, { passive: true });
}

initHome();