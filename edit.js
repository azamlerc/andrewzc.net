import {
  getEntity,
  createEntity,
  updateEntity,
  deleteEntityApi,
  lookupWiki,
  lookupCoords,
  lookupNearestCity,
  getPageEntities,
} from "./api.js";
import {
  renderImages,
  clearPendingThumbUrls,
  uploadImagesFlow,
} from "./images.js";

const qs = new URLSearchParams(location.search);
const LIST = qs.get("list") || "";
let KEY = qs.get("key") || "";

const elHeadline = document.getElementById("headline");
const elStatus = document.getElementById("status");
const elCard = document.getElementById("card");

const elIcons = document.getElementById("icons");
const elBadges = document.getElementById("badges");
const elName = document.getElementById("name");
const elPrefix = document.getElementById("prefix");
const elInfo = document.getElementById("info");
const elCaption = document.getElementById("caption");
const elTrips = document.getElementById("trips");
const elReference = document.getElementById("reference");
const elReferenceSuggestions = document.getElementById("referenceSuggestions");
const elLink = document.getElementById("link");
const elCoords = document.getElementById("coords");
const elCity = document.getElementById("city");
const elBeen = document.getElementById("been");
const elStrike = document.getElementById("strike");

const elSaveBtn = document.getElementById("saveBtn");
const elResetBtn = document.getElementById("resetBtn");
const elDuplicateBtn = document.getElementById("duplicateBtn");
const elDeleteBtn = document.getElementById("deleteBtn");
const elLinkAutoBtn = document.getElementById("linkAutoBtn");
const elCoordsAutoBtn = document.getElementById("coordsAutoBtn");
const elCityAutoBtn = document.getElementById("cityAutoBtn");
const elReferenceAutoBtn = document.getElementById("referenceAutoBtn");
const elOpenBtn = document.getElementById("openBtn");
const elMapBtn = document.getElementById("mapBtn");
const elCityOpenBtn = document.getElementById("cityOpenBtn");
const elUploadImagesBtn = document.getElementById("uploadImagesBtn");
const elImageInput = document.getElementById("imageInput");
const elImageGrid = document.getElementById("imageGrid");
const elImagesHelp = document.getElementById("imagesHelp");

let original = null;
let isCreateMode = false;
let referenceAutocompleteNames = [];
let dragDepth = 0;

function blankEntity() {
  return {
    list: LIST,
    key: null,
    icons: [],
    badges: [],
    name: "",
    prefix: "",
    info: "",
    caption: "",
    trips: [],
    reference: "",
    link: "",
    coords: "",
    city: "",
    images: [],
    been: false,
    strike: false
  };
}

function setStatus(text, kind) {
  elStatus.textContent = text;
  elStatus.classList.remove("error", "ok");
  if (kind === "error") elStatus.classList.add("error");
  if (kind === "ok") elStatus.classList.add("ok");
}

function syncModeButtons() {
  elSaveBtn.textContent = isCreateMode ? "Create" : "Save";
  elDuplicateBtn.style.display = isCreateMode ? "none" : "";
  elDeleteBtn.style.display = isCreateMode ? "none" : "";
}

function normalizeAutocompleteText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function updateReferenceSuggestions() {
  if (!elReferenceSuggestions) return;

  const prefix = normalizeAutocompleteText(elReference.value);
  const matches = prefix.length >= 2
    ? referenceAutocompleteNames.filter(name => normalizeAutocompleteText(name).startsWith(prefix)).slice(0, 20)
    : [];

  elReferenceSuggestions.innerHTML = "";
  for (const name of matches) {
    const option = document.createElement("option");
    option.value = name;
    elReferenceSuggestions.appendChild(option);
  }
}

async function loadReferenceAutocomplete() {
  try {
    const [cities, artists] = await Promise.all([
      getPageEntities("cities"),
      getPageEntities("artists"),
    ]);

    const names = [...(cities?.entities || []), ...(artists?.entities || [])]
      .map(entity => String(entity?.name || "").trim())
      .filter(Boolean);

    referenceAutocompleteNames = [...new Set(names)]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

    updateReferenceSuggestions();
  } catch (err) {
    console.warn("Could not load reference autocomplete data.", err);
  }
}

function iconsArrayToString(arr) {
  if (!Array.isArray(arr)) return "";
  return arr.join(" ");
}

function iconsStringToArray(str) {
  return String(str || "").trim().split(/\s+/).filter(Boolean);
}

function wordsToArray(value) {
  return String(value || "").trim().split(/\s+/).filter(Boolean);
}

function arrayToWords(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(" ");
  if (typeof value === "string") return value.trim();
  return "";
}

function tripsValue(entity) {
  if (Array.isArray(entity?.trips)) return entity.trips;
  if (typeof entity?.trips === "string") return wordsToArray(entity.trips);
  if (Array.isArray(entity?.trip)) return entity.trip;
  if (typeof entity?.trip === "string") return wordsToArray(entity.trip);
  return [];
}

function normalizeEntity(entity) {
  return {
    ...entity,
    trips: tripsValue(entity),
  };
}

function simplify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/’/g, "")
    .replace(/\./g, "")
    .replace(/,/g, "")
    .replace(/\*/g, "")
    .replace(/"/g, "")
    .replace(/</g, "")
    .replace(/>/g, "")
    .replace(/\(/g, "")
    .replace(/\)/g, "")
    .replace(/\//g, "-")
    .replace(/&/g, "-")
    .replace(/–/g, "-")
    .replace(/—/g, "-")
    .replace(/---/g, "-")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/the-/, "");
}

function getFlagEmoji(countryCode) {
  const codePoints = String(countryCode || "")
    .toUpperCase()
    .split("")
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function deriveCountriesFromIcons(iconsArr) {
  const iso = [];
  for (const icon of iconsArr) {
    const cps = Array.from(icon);
    if (cps.length !== 2) continue;

    const a = cps[0].codePointAt(0);
    const b = cps[1].codePointAt(0);

    const A = 0x1F1E6;
    const Z = 0x1F1FF;
    if (a < A || a > Z || b < A || b > Z) continue;

    const c1 = String.fromCharCode("A".charCodeAt(0) + (a - A));
    const c2 = String.fromCharCode("A".charCodeAt(0) + (b - A));
    iso.push(c1 + c2);
  }

  const uniq = [];
  for (const c of iso) if (!uniq.includes(c)) uniq.push(c);

  if (uniq.length === 0) return {};
  if (uniq.length === 1) return { country: uniq[0], countries: null };
  return { country: null, countries: uniq };
}

function setHeaderFromEntity(e) {
  const icons = iconsArrayToString(e.icons || []);
  elHeadline.textContent = `${icons ? icons + " " : ""}${e.name || "Edit"}`;
}

function setPill(el, on) {
  if (!el) return;
  el.classList.toggle("on", !!on);
  el.setAttribute("aria-pressed", on ? "true" : "false");
}

function isPillOn(el) {
  return !!el && el.classList.contains("on");
}

function togglePill(el) {
  setPill(el, !isPillOn(el));
}

function updateImageSection(entity, pendingFiles = []) {
  renderImages({
    list: LIST,
    entity,
    pendingFiles,
    imageGrid: elImageGrid,
    uploadButton: elUploadImagesBtn,
    imagesHelp: elImagesHelp,
    canUpload: !!KEY && !isCreateMode,
  });
}

async function uploadImages(files) {
  if (!KEY || isCreateMode) {
    setStatus("Save this entity before uploading images.", "error");
    return;
  }

  const picked = Array.from(files || []).filter(file => file && String(file.type || "").startsWith("image/"));
  if (picked.length === 0) return;

  try {
    elUploadImagesBtn.disabled = true;
    await uploadImagesFlow({
      list: LIST,
      key: KEY,
      files: picked,
      setStatus,
      onRenderPending(pendingFiles) {
        updateImageSection(original, pendingFiles);
      },
      onComplete(entity) {
        original = normalizeEntity(entity);
        setHeaderFromEntity(original);
        populateForm(original);
      }
    });
  } catch (err) {
    updateImageSection(original);
    if (err.status === 401) {
      setStatus("Not authenticated. Go to admin.html and sign in.", "error");
    } else {
      setStatus("Image upload failed. " + err.message, "error");
    }
  } finally {
    elUploadImagesBtn.disabled = false;
    elImageInput.value = "";
  }
}

function setDragActive(active) {
  document.body.classList.toggle("drag-active", !!active);
}

function hasDraggedFiles(event) {
  const types = Array.from(event?.dataTransfer?.types || []);
  return types.includes("Files");
}

function getDroppedImageFiles(event) {
  const files = Array.from(event?.dataTransfer?.files || []);
  return files.filter(file => String(file.type || "").startsWith("image/"));
}

function populateForm(e) {
  elIcons.value = iconsArrayToString(e.icons || []);
  elBadges.value = iconsArrayToString(e.badges || []);
  elName.value = e.name || "";
  elPrefix.value = e.prefix || "";
  elInfo.value = e.info || "";
  elCaption.value = e.caption || "";
  elTrips.value = arrayToWords(tripsValue(e));
  elReference.value = e.reference || "";
  elLink.value = e.link || "";
  elCoords.value = e.coords || "";
  elCity.value = e.city || "";
  setPill(elBeen, !!e.been);
  setPill(elStrike, !!e.strike);
  updateImageSection(e);
}

function currentFormEntity() {
  const iconsArr = iconsStringToArray(elIcons.value);
  const badgesArr = iconsStringToArray(elBadges.value);

  return {
    icons: iconsArr,
    badges: badgesArr,
    name: elName.value.trim(),
    prefix: elPrefix.value.trim(),
    info: elInfo.value.trim(),
    caption: elCaption.value.trim(),
    trips: wordsToArray(elTrips.value),
    reference: elReference.value.trim(),
    link: elLink.value.trim(),
    coords: elCoords.value.trim(),
    city: elCity.value.trim(),
    been: isPillOn(elBeen),
    strike: isPillOn(elStrike)
  };
}

function pruneCreatePayload(entity) {
  const payload = { ...entity };

  for (const [key, value] of Object.entries(payload)) {
    if (value === "") {
      delete payload[key];
      continue;
    }
    if (Array.isArray(value) && value.length === 0) {
      delete payload[key];
    }
  }

  return payload;
}

function parseDMSComponent(s) {
  s = s.trim();
  const decMatch = s.match(/^([+-]?\d+(?:\.\d+)?)°?\s*([NSEWOnsew]?)$/);
  if (decMatch) {
    let v = parseFloat(decMatch[1]);
    const dir = decMatch[2].toUpperCase();
    if (dir === "S" || dir === "W" || dir === "O") v = -v;
    return v;
  }
  const dmsMatch = s.match(/^(\d+(?:\.\d+)?)°(?:(\d+(?:\.\d+)?)[′'`])?(?:(\d+(?:\.\d+)?)[″"])?\s*([NSEWOnsew]?)$/);
  if (dmsMatch) {
    const deg = parseFloat(dmsMatch[1]) || 0;
    const min = parseFloat(dmsMatch[2]) || 0;
    const sec = parseFloat(dmsMatch[3]) || 0;
    let v = deg + min / 60 + sec / 3600;
    const dir = (dmsMatch[4] || "").toUpperCase();
    if (dir === "S" || dir === "W" || dir === "O") v = -v;
    return v;
  }
  return null;
}

function parseCoordsInput(s) {
  if (!s) return null;
  s = s.trim();

  const commaIdx = s.indexOf(",");
  if (commaIdx !== -1) {
    const lat = parseDMSComponent(s.slice(0, commaIdx));
    const lon = parseDMSComponent(s.slice(commaIdx + 1));
    if (lat != null && lon != null && !isNaN(lat) && !isNaN(lon)) return { lat, lon };
  }

  const spaceMatch = s.match(/^(\S+[NSns])\s+(\S+[EWOewo])$/);
  if (spaceMatch) {
    const lat = parseDMSComponent(spaceMatch[1]);
    const lon = parseDMSComponent(spaceMatch[2]);
    if (lat != null && lon != null && !isNaN(lat) && !isNaN(lon)) return { lat, lon };
  }

  return null;
}

function normalizeCoords(s) {
  const parsed = parseCoordsInput(s);
  if (!parsed) return null;
  const fmt = n => parseFloat(n.toFixed(8)).toString();
  return { lat: parsed.lat, lon: parsed.lon, coords: `${fmt(parsed.lat)}, ${fmt(parsed.lon)}` };
}

function diffPatch(orig, cur) {
  const patch = {};

  const fields = ["name", "prefix", "info", "caption", "reference", "link", "city", "coords", "been", "strike"];
  for (const f of fields) {
    const o = orig[f] ?? (typeof cur[f] === "boolean" ? false : "");
    const c = cur[f];
    if (o !== c) patch[f] = c;
  }

  if ("coords" in patch) {
    const parsed = parseCoordsInput(patch.coords);
    patch.location = parsed ? { type: "Point", coordinates: [parsed.lon, parsed.lat] } : null;
  }

  const oIcons = Array.isArray(orig.icons) ? orig.icons : [];
  const cIcons = Array.isArray(cur.icons) ? cur.icons : [];
  if (JSON.stringify(oIcons) !== JSON.stringify(cIcons)) {
    patch.icons = cIcons;

    const derived = deriveCountriesFromIcons(cIcons);
    if ("country" in derived) patch.country = derived.country;
    if ("countries" in derived) {
      if (derived.countries) patch.countries = derived.countries;
      else patch.countries = null;
    }
  }

  const oBadges = Array.isArray(orig.badges) ? orig.badges : [];
  const cBadges = Array.isArray(cur.badges) ? cur.badges : [];
  if (JSON.stringify(oBadges) !== JSON.stringify(cBadges)) {
    patch.badges = cBadges;
  }

  const oTrips = Array.isArray(orig.trips) ? orig.trips : [];
  const cTrips = Array.isArray(cur.trips) ? cur.trips : [];
  if (JSON.stringify(oTrips) !== JSON.stringify(cTrips)) {
    patch.trips = cTrips;
  }

  delete patch._id;
  delete patch.list;
  delete patch.key;

  return patch;
}

async function load() {
  if (!LIST) {
    setStatus("Missing ?list=...", "error");
    return;
  }

  if (!KEY) {
    isCreateMode = true;
    original = blankEntity();
    elHeadline.textContent = "✏️ New";
    populateForm(original);
    elCard.style.display = "inline-block";
    syncModeButtons();
    setStatus("New entity.", "ok");
    return;
  }

  try {
    isCreateMode = false;
    syncModeButtons();
    setStatus("Loading…");
        const entity = await getEntity(LIST, KEY);

    original = normalizeEntity(entity);
    setHeaderFromEntity(original);
    populateForm(original);

    elCard.style.display = "inline-block";
    syncModeButtons();
    setStatus("Loaded.", "ok");
  } catch (err) {
    setStatus("Load failed. " + err.message, "error");
  }
}

async function save() {
  if (!original) return;

  const cur = currentFormEntity();
  const patch = diffPatch(original, cur);

  const keys = Object.keys(patch);
  if (keys.length === 0 && !isCreateMode) {
    setStatus("No changes to save.", "ok");
    return;
  }

  elSaveBtn.disabled = true;
  setStatus("Saving…");

  try {
    let updated;

    if (isCreateMode) {
          updated = await createEntity(LIST, pruneCreatePayload(cur));

      if (updated && updated.key) {
        KEY = String(updated.key);
        isCreateMode = false;
        syncModeButtons();

        const nextUrl = new URL(location.href);
        nextUrl.searchParams.set("list", LIST);
        nextUrl.searchParams.set("key", KEY);
        history.replaceState(null, "", nextUrl.toString());
      }
    } else {
          updated = await updateEntity(LIST, KEY, patch);
    }

    original = normalizeEntity(updated);
    setHeaderFromEntity(original);
    populateForm(original);

    setStatus("Saved.", "ok");
  } catch (err) {
    if (err.status === 401) {
      setStatus("Not authenticated. Go to admin.html and sign in.", "error");
    } else {
      setStatus("Save failed. " + err.message, "error");
    }
  } finally {
    elSaveBtn.disabled = false;
  }
}

function resetForm() {
  if (!original) return;
  populateForm(original);
  setStatus("Reset.", null);
}

function duplicateEntity() {
  if (!original || isCreateMode) return;

  original = normalizeEntity({
    ...blankEntity(),
    ...currentFormEntity(),
    images: [],
  });
  KEY = "";
  isCreateMode = true;

  populateForm(original);
  elHeadline.textContent = "✏️ New";
  syncModeButtons();

  const nextUrl = new URL(location.href);
  nextUrl.searchParams.set("list", LIST);
  nextUrl.searchParams.delete("key");
  history.replaceState(null, "", nextUrl.toString());

  setStatus("Duplicated.", "ok");
}

async function deleteEntity() {
  if (!KEY || isCreateMode) return;
  if (!confirm(`Delete "${original.name}"? This cannot be undone.`)) return;

  elDeleteBtn.disabled = true;
  setStatus("Deleting…");

  try {
        await deleteEntityApi(LIST, KEY);
    setStatus("Deleted.", "ok");
    setTimeout(() => {
      location.href = `./page.html?id=${LIST}`;
    }, 800);
  } catch (err) {
    if (err.status === 401) {
      setStatus("Not authenticated. Go to admin.html and sign in.", "error");
    } else {
      setStatus("Delete failed. " + err.message, "error");
    }
    elDeleteBtn.disabled = false;
  }
}

elSaveBtn.addEventListener("click", save);
elResetBtn.addEventListener("click", resetForm);
elDuplicateBtn.addEventListener("click", duplicateEntity);
elDeleteBtn.addEventListener("click", deleteEntity);

elBeen.addEventListener("click", () => togglePill(elBeen));
elStrike.addEventListener("click", () => togglePill(elStrike));

elLinkAutoBtn.addEventListener("click", async () => {
  const name = elName.value.trim();
  if (!name) return;

  try {
    setStatus("Looking up Wikipedia…");
    const res = await lookupWiki(name);

    if (res && res.link) {
      elLink.value = res.link;
      await save();
    } else {
      setStatus("No Wikipedia result.", "error");
    }
  } catch (err) {
    setStatus("Wiki lookup failed. " + err.message, "error");
  }
});

elOpenBtn.addEventListener("click", () => {
  const url = (elLink.value || "").trim();
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
});

elCityOpenBtn.addEventListener("click", () => {
  const city = (elCity.value || "").trim();
  if (!city) return;
  const key = simplify(city);
  if (!key) return;
  window.open(`city.html?key=${encodeURIComponent(key)}`, "_blank", "noopener,noreferrer");
});

elUploadImagesBtn.addEventListener("click", () => {
  if (!KEY || isCreateMode) {
    setStatus("Save this entity before uploading images.", "error");
    return;
  }
  elImageInput.click();
});

elImageInput.addEventListener("change", (e) => {
  uploadImages(e.target.files);
});

document.addEventListener("dragenter", (event) => {
  if (!hasDraggedFiles(event)) return;
  dragDepth += 1;
  event.preventDefault();
  setDragActive(true);
});

document.addEventListener("dragover", (event) => {
  if (!hasDraggedFiles(event)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  setDragActive(true);
});

document.addEventListener("dragleave", (event) => {
  if (!hasDraggedFiles(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) setDragActive(false);
});

document.addEventListener("drop", (event) => {
  const files = getDroppedImageFiles(event);
  if (files.length === 0) return;
  event.preventDefault();
  dragDepth = 0;
  setDragActive(false);
  uploadImages(files);
});

elCoordsAutoBtn.addEventListener("click", async () => {
  const url = elLink.value.trim();
  if (!url) { setStatus("No link to look up coords from.", "error"); return; }
  if (elCoords.value.trim()) { setStatus("Coords already set.", "error"); return; }

  try {
    setStatus("Looking up coords…");
    const res = await lookupCoords(url, LIST);
    if (!res?.coords) { setStatus("No coords found for this URL.", "error"); return; }
    elCoords.value = res.coords;
    await save();
  } catch (err) {
    setStatus("Coords lookup failed. " + err.message, "error");
  }
});

elReferenceAutoBtn.addEventListener("click", async () => {
  const city = elCity.value.trim();
  if (!city) { setStatus("No city to copy to reference.", "error"); return; }
  elReference.value = city;
  await save();
});

elReference.addEventListener("focus", updateReferenceSuggestions);
elReference.addEventListener("input", updateReferenceSuggestions);

elCityAutoBtn.addEventListener("click", async () => {
  const raw = (elCoords.value || "").trim();
  if (!raw) { setStatus("No coords to look up city from.", "error"); return; }
  const [latStr, lonStr] = raw.split(",");
  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);
  if (isNaN(lat) || isNaN(lon)) { setStatus("Invalid coords format (expected: lat, lon).", "error"); return; }

  try {
    setStatus("Looking up nearest city…");
    const res = await lookupNearestCity(lat, lon);
    const city = res?.results?.[0];
    if (!city) { setStatus("No city found within 20 km.", "error"); return; }
    elCity.value = city.name;
    await save();
  } catch (err) {
    setStatus("City lookup failed. " + err.message, "error");
  }
});

elMapBtn.addEventListener("click", () => {
  const raw = (elCoords.value || "").trim();
  if (!raw) return;
  const [latStr, lonStr] = raw.split(",");
  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);
  if (isNaN(lat) || isNaN(lon)) { setStatus("Invalid coords format (expected: lat, lon).", "error"); return; }
  window.open(`https://maps.apple.com/?ll=${lat},${lon}&t=m`, "_blank", "noopener,noreferrer");
});

elCoords.addEventListener("blur", () => {
  const raw = elCoords.value.trim();
  if (!raw) return;
  const result = normalizeCoords(raw);
  if (result) {
    elCoords.value = result.coords;
  } else {
    setStatus("Could not parse coords — expected \"lat, lon\" or DMS format.", "error");
  }
});

function normalizeEmojiField(input) {
  const tokens = String(input.value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const transformed = tokens.map(t => {
    if (/^[a-z]{2}$/i.test(t)) {
      try {
        return getFlagEmoji(t);
      } catch (_) {
        return t;
      }
    }
    return t;
  });

  input.value = transformed.join(" ");
}

elIcons.addEventListener("blur", () => normalizeEmojiField(elIcons));
elBadges.addEventListener("blur", () => normalizeEmojiField(elBadges));

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    save();
  }
});

window.addEventListener("beforeunload", () => {
  clearPendingThumbUrls();
  setDragActive(false);
});

loadReferenceAutocomplete();
load();
