import {
  getPage,
  createPage,
  updatePage,
} from "./api.js";

const qs = new URLSearchParams(location.search);
let KEY = qs.get("id") || "";

const TYPE_VALUES = new Set(["place", "city", "country", "state", "entity"]);
const SIZE_VALUES = new Set(["large", "medium", "small"]);

const elHeadline = document.getElementById("headline");
const elStatus = document.getElementById("status");
const elCard = document.getElementById("card");

const elIcon = document.getElementById("icon");
const elName = document.getElementById("name");
const elType = document.getElementById("type");
const elSize = document.getElementById("size");
const elPropertyOf = document.getElementById("propertyOf");
const elTags = document.getElementById("tags");
const elSort = document.getElementById("sort");
const elMapLat = document.getElementById("mapLat");
const elMapLon = document.getElementById("mapLon");
const elMapZoom = document.getElementById("mapZoom");
const elHeader = document.getElementById("header");
const elFooter = document.getElementById("footer");
const elComplete = document.getElementById("complete");
const elNotes = document.getElementById("notes");

const elSaveBtn = document.getElementById("saveBtn");
const elResetBtn = document.getElementById("resetBtn");
const elAddNoteBtn = document.getElementById("addNoteBtn");

let original = null;
let isCreateMode = false;

function blankPage() {
  return {
    key: null,
    icon: "",
    name: "",
    type: "place",
    size: "large",
    tags: [],
    sort: null,
    map: null,
    header: "",
    footer: "",
    notes: [],
    propertyOf: "",
    complete: false,
  };
}

function setStatus(text, kind) {
  elStatus.textContent = text;
  elStatus.classList.remove("error", "ok");
  if (kind === "error") elStatus.classList.add("error");
  if (kind === "ok") elStatus.classList.add("ok");
}

function setPill(el, on) {
  el.classList.toggle("on", !!on);
  el.setAttribute("aria-pressed", on ? "true" : "false");
}

function isPillOn(el) {
  return el.classList.contains("on");
}

function togglePill(el) {
  setPill(el, !isPillOn(el));
}

function wordsToArray(value) {
  return String(value || "").trim().split(/\s+/).filter(Boolean);
}

function arrayToWords(value) {
  return Array.isArray(value) ? value.join(" ") : "";
}

function sortValueToWords(value) {
  if (Array.isArray(value)) return value.join(" ");
  if (typeof value === "string") return value;
  return "";
}

function parseSortValue(value) {
  const parts = wordsToArray(value);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return parts;
}

function normalizePage(page) {
  return {
    key: page?.key ?? null,
    icon: page?.icon ? String(page.icon) : "",
    name: page?.name ? String(page.name) : "",
    type: TYPE_VALUES.has(page?.type) ? page.type : "place",
    size: SIZE_VALUES.has(page?.size) ? page.size : "large",
    tags: Array.isArray(page?.tags) ? page.tags.map(String).filter(Boolean) : [],
    sort: Array.isArray(page?.sort)
      ? page.sort.map(String).filter(Boolean)
      : (typeof page?.sort === "string" && page.sort.trim() ? page.sort.trim() : null),
    map: (page?.map && (page.map.lat != null || page.map.lon != null || page.map.zoom != null))
      ? {
          lat: page.map.lat != null ? String(page.map.lat) : "",
          lon: page.map.lon != null ? String(page.map.lon) : "",
          zoom: page.map.zoom != null ? String(page.map.zoom) : "",
        }
      : null,
    header: page?.header ? String(page.header) : "",
    footer: page?.footer ? String(page.footer) : "",
    notes: Array.isArray(page?.notes) ? page.notes.map(String).filter(note => note.length > 0) : [],
    propertyOf: page?.propertyOf ? String(page.propertyOf) : "",
    complete: !!page?.complete,
  };
}

function setHeaderFromPage(page) {
  const title = page.name || (isCreateMode ? "New Page" : "Page Info");
  const icon = page.icon ? `${page.icon} ` : "";
  elHeadline.textContent = `${icon}${title}`;
  document.title = `${icon}${title}`.trim();
}

function makeNoteRow(value = "") {
  const row = document.createElement("div");
  row.className = "row";

  const field = document.createElement("div");
  field.className = "field";

  const header = document.createElement("div");
  header.className = "fieldHeader";

  const label = document.createElement("span");
  label.className = "label";
  label.textContent = "Note";

  const actions = document.createElement("span");
  actions.className = "fieldActions";

  const removeBtn = document.createElement("button");
  removeBtn.className = "pill";
  removeBtn.type = "button";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", () => {
    row.remove();
    renumberNotes();
  });

  actions.append(removeBtn);
  header.append(label, actions);

  const input = document.createElement("textarea");
  input.className = "textarea noteInput";
  input.spellcheck = false;
  input.value = value;

  field.append(header, input);
  row.append(field);
  return row;
}

function renumberNotes() {
  const labels = elNotes.querySelectorAll(".label");
  labels.forEach((label, index) => {
    label.textContent = `Note ${index + 1}`;
  });
}

function renderNotes(notes = []) {
  elNotes.innerHTML = "";
  for (const note of notes) {
    elNotes.append(makeNoteRow(note));
  }
  renumberNotes();
}

function getNotesFromForm() {
  return [...elNotes.querySelectorAll(".noteInput")]
    .map(el => el.value.trim())
    .filter(Boolean);
}

function populateForm(page) {
  elIcon.value = page.icon || "";
  elName.value = page.name || "";
  elType.value = page.type || "place";
  elSize.value = page.size || "large";
  elPropertyOf.value = page.propertyOf || "";
  elTags.value = arrayToWords(page.tags);
  elSort.value = sortValueToWords(page.sort);
  elMapLat.value = page.map?.lat || "";
  elMapLon.value = page.map?.lon || "";
  elMapZoom.value = page.map?.zoom || "";
  elHeader.value = page.header || "";
  elFooter.value = page.footer || "";
  setPill(elComplete, !!page.complete);
  renderNotes(page.notes || []);
}

function collectPageFromForm() {
  const name = elName.value.trim();
  if (!name) return { error: "Missing name." };

  const mapLat = elMapLat.value.trim();
  const mapLon = elMapLon.value.trim();
  const mapZoom = elMapZoom.value.trim();
  const hasAnyMap = !!(mapLat || mapLon || mapZoom);
  const hasFullMap = !!(mapLat && mapLon && mapZoom);
  if (hasAnyMap && !hasFullMap) {
    return { error: "Map requires lat, lon, and zoom." };
  }

  return {
    value: {
      key: KEY || null,
      icon: elIcon.value.trim(),
      name,
      type: TYPE_VALUES.has(elType.value) ? elType.value : "place",
      size: SIZE_VALUES.has(elSize.value) ? elSize.value : "large",
      tags: wordsToArray(elTags.value),
      sort: parseSortValue(elSort.value),
      map: hasFullMap ? { lat: mapLat, lon: mapLon, zoom: mapZoom } : null,
      header: elHeader.value.trim(),
      footer: elFooter.value.trim(),
      notes: getNotesFromForm(),
      propertyOf: elPropertyOf.value.trim(),
      complete: isPillOn(elComplete),
    }
  };
}

function comparableSort(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value) return value;
  return null;
}

function diffPatch(orig, cur) {
  const patch = {};

  for (const field of ["icon", "name", "type", "size"]) {
    if ((orig[field] || "") !== (cur[field] || "")) patch[field] = cur[field];
  }

  for (const field of ["header", "footer", "propertyOf"]) {
    const before = orig[field] || "";
    const after = cur[field] || "";
    if (before !== after) patch[field] = after || null;
  }

  const origTags = Array.isArray(orig.tags) ? orig.tags : [];
  const curTags = Array.isArray(cur.tags) ? cur.tags : [];
  if (JSON.stringify(origTags) !== JSON.stringify(curTags)) patch.tags = curTags;

  const origNotes = Array.isArray(orig.notes) ? orig.notes : [];
  const curNotes = Array.isArray(cur.notes) ? cur.notes : [];
  if (JSON.stringify(origNotes) !== JSON.stringify(curNotes)) patch.notes = curNotes;

  const origSort = comparableSort(orig.sort);
  const curSort = comparableSort(cur.sort);
  if (JSON.stringify(origSort) !== JSON.stringify(curSort)) patch.sort = curSort;

  const origMap = orig.map || null;
  const curMap = cur.map || null;
  if (JSON.stringify(origMap) !== JSON.stringify(curMap)) patch.map = curMap;

  if (!!orig.complete !== !!cur.complete) patch.complete = !!cur.complete;

  return patch;
}

function createPayload(page) {
  const payload = {
    name: page.name,
    type: page.type,
    size: page.size,
  };

  if (page.icon) payload.icon = page.icon;
  if (page.tags.length > 0) payload.tags = page.tags;
  if (page.sort) payload.sort = page.sort;
  if (page.map) payload.map = page.map;
  if (page.header) payload.header = page.header;
  if (page.footer) payload.footer = page.footer;
  if (page.notes.length > 0) payload.notes = page.notes;
  if (page.propertyOf) payload.propertyOf = page.propertyOf;
  if (page.complete) payload.complete = true;

  return payload;
}

async function load() {
  if (!KEY) {
    isCreateMode = true;
    original = blankPage();
    elSaveBtn.textContent = "Create";
    setHeaderFromPage(original);
    populateForm(original);
    elCard.style.display = "inline-block";
    setStatus("New page.", "ok");
    return;
  }

  try {
    setStatus("Loading…");
    isCreateMode = false;
    elSaveBtn.textContent = "Save";
    const page = normalizePage(await getPage(KEY));
    original = page;
    setHeaderFromPage(page);
    populateForm(page);
    elCard.style.display = "inline-block";
    setStatus("Loaded.", "ok");
  } catch (err) {
    setStatus("Load failed. " + err.message, "error");
  }
}

async function save() {
  const collected = collectPageFromForm();
  if (collected.error) {
    setStatus(collected.error, "error");
    return;
  }

  const current = collected.value;
  elSaveBtn.disabled = true;
  setStatus("Saving…");

  try {
    let saved;

    if (isCreateMode) {
      saved = normalizePage(await createPage(createPayload(current)));
      if (saved.key) {
        KEY = String(saved.key);
        isCreateMode = false;
        elSaveBtn.textContent = "Save";
        const nextUrl = new URL(location.href);
        nextUrl.searchParams.set("id", KEY);
        history.replaceState(null, "", nextUrl.toString());
      }
    } else {
      const patch = diffPatch(original, current);
      if (Object.keys(patch).length === 0) {
        setStatus("No changes to save.", "ok");
        elSaveBtn.disabled = false;
        return;
      }
      saved = normalizePage(await updatePage(KEY, patch));
    }

    original = saved;
    setHeaderFromPage(saved);
    populateForm(saved);
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

elSaveBtn.addEventListener("click", save);
elResetBtn.addEventListener("click", resetForm);
elAddNoteBtn.addEventListener("click", () => {
  elNotes.append(makeNoteRow(""));
  renumberNotes();
});
elComplete.addEventListener("click", () => togglePill(elComplete));

load();
