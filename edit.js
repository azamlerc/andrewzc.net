import {
  getEntity,
  createEntity,
  updateEntity,
  deleteEntityApi,
  lookupWiki,
  lookupCoords,
  lookupNearestCity,
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
const elName = document.getElementById("name");
const elPrefix = document.getElementById("prefix");
const elReference = document.getElementById("reference");
const elLink = document.getElementById("link");
const elCoords = document.getElementById("coords");
const elCity = document.getElementById("city");
const elBeen = document.getElementById("been");
const elStrike = document.getElementById("strike");

const elSaveBtn = document.getElementById("saveBtn");
const elResetBtn = document.getElementById("resetBtn");
const elDeleteBtn = document.getElementById("deleteBtn");
const elLinkLabel = document.getElementById("linkLabel");
const elCityLabel = document.getElementById("cityLabel");
const elCoordsLabel = document.getElementById("coordsLabel");
const elReferenceLabel = document.getElementById("referenceLabel");
const elOpenBtn = document.getElementById("openBtn");
const elMapBtn = document.getElementById("mapBtn");
const elUploadImagesBtn = document.getElementById("uploadImagesBtn");
const elImageInput = document.getElementById("imageInput");
const elImageGrid = document.getElementById("imageGrid");
const elImagesHelp = document.getElementById("imagesHelp");

let original = null;
let isCreateMode = false;
function blankEntity() {
  return {
    list: LIST,
    key: null,
    icons: [],
    name: "",
    prefix: "",
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

function iconsArrayToString(arr) {
  if (!Array.isArray(arr)) return "";
  return arr.join(" ");
}

function iconsStringToArray(str) {
  return String(str || "").trim().split(/\s+/).filter(Boolean);
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

  const picked = Array.from(files || []).filter(Boolean);
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
        original = entity;
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

function populateForm(e) {
  elIcons.value = iconsArrayToString(e.icons || []);
  elName.value = e.name || "";
  elPrefix.value = e.prefix || "";
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

  return {
    icons: iconsArr,
    name: elName.value.trim(),
    prefix: elPrefix.value.trim(),
    reference: elReference.value.trim(),
    link: elLink.value.trim(),
    coords: elCoords.value.trim(),
    city: elCity.value.trim(),
    been: isPillOn(elBeen),
    strike: isPillOn(elStrike)
  };
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

  const fields = ["name", "prefix", "reference", "link", "city", "coords", "been", "strike"];
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
    elSaveBtn.textContent = "Create";
    setStatus("New entity.", "ok");
    return;
  }

  try {
    isCreateMode = false;
    elSaveBtn.textContent = "Save";
    setStatus("Loading…");
        const entity = await getEntity(LIST, KEY);

    original = entity;
    setHeaderFromEntity(entity);
    populateForm(entity);

    elCard.style.display = "inline-block";
    elDeleteBtn.style.display = "";
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
          updated = await createEntity(LIST, cur);

      if (updated && updated.key) {
        KEY = String(updated.key);
        isCreateMode = false;
        elSaveBtn.textContent = "Save";
        elDeleteBtn.style.display = "";

        const nextUrl = new URL(location.href);
        nextUrl.searchParams.set("list", LIST);
        nextUrl.searchParams.set("key", KEY);
        history.replaceState(null, "", nextUrl.toString());
      }
    } else {
          updated = await updateEntity(LIST, KEY, patch);
    }

    original = updated;
    setHeaderFromEntity(updated);
    populateForm(updated);

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
elDeleteBtn.addEventListener("click", deleteEntity);

elBeen.addEventListener("click", () => togglePill(elBeen));
elStrike.addEventListener("click", () => togglePill(elStrike));

elLinkLabel.addEventListener("click", async () => {
  const name = elName.value.trim();
  if (!name) return;

  try {
    setStatus("Looking up Wikipedia…");
        const res = await lookupWiki(name);

    if (res && res.link) {
      elLink.value = res.link;
      setStatus("Wikipedia link found.", "ok");
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

elCoordsLabel.addEventListener("click", async () => {
  const url = elLink.value.trim();
  if (!url) { setStatus("No link to look up coords from.", "error"); return; }
  if (elCoords.value.trim()) { setStatus("Coords already set.", "error"); return; }

  try {
    setStatus("Looking up coords…");
        const res = await lookupCoords(url, LIST);
    if (!res?.coords) { setStatus("No coords found for this URL.", "error"); return; }
    elCoords.value = res.coords;
    setStatus("Coords set.", "ok");
  } catch (err) {
    setStatus("Coords lookup failed. " + err.message, "error");
  }
});

elReferenceLabel.addEventListener("click", () => {
  const city = elCity.value.trim();
  if (!city) { setStatus("No city to copy to reference.", "error"); return; }
  elReference.value = city;
  setStatus(`Reference set to "${city}".`, "ok");
});

elCityLabel.addEventListener("click", async () => {
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
    setStatus(`City set to ${city.name} (${city.distanceKm} km away).`, "ok");
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

elIcons.addEventListener("blur", () => {
  const tokens = String(elIcons.value || "")
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

  elIcons.value = transformed.join(" ");
});

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    save();
  }
});

window.addEventListener("beforeunload", () => {
  clearPendingThumbUrls();
});

load();
