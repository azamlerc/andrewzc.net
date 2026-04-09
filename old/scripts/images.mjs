#!/usr/bin/env node
// images.mjs
// Usage: node images.mjs /path/to/folder

import { promises as fs } from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// ---- Config you asked to hardcode ----
const DATA_DIR = "/Users/andrew/Projects/andrewzc.net/data";

// Image extensions we treat as “images” for tn copies.
// (HEICs should be gone after conversion, but listing common ones is harmless.)
const IMAGE_EXTS_FOR_COPY = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".tif", ".tiff", ".bmp"
]);

async function main() {
  const dirArg = process.argv[2];
  if (!dirArg) {
    console.error("Error: please provide a folder path.\nExample: node images.mjs /Users/andrewzc/Downloads/awa");
    process.exit(1);
  }

  const dir = path.resolve(dirArg.replace(/\/+$/, "")); // trim trailing slash
  const folderName = path.basename(dir);
  const tnDir = path.join(dir, "tn");
  const jsonPath = path.join(DATA_DIR, `${folderName}.json`);

  // Sanity checks
  const stat = await fs.stat(dir).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    console.error(`Error: "${dir}" is not a directory or does not exist.`);
    process.exit(1);
  }

  // Normalize extensions to ".jpg" for consistency (top-level and tn/, if present)
  await normalizeNamesInDir(dir);
  await normalizeNamesInDir(tnDir, { optional: true });
	
  // ---- 1) Convert HEIC → JPG (lowercase .jpg), remove original ----
  await convertHeicToJpg(dir);

  // ---- 2) Ensure tn/ exists ----
  await fs.mkdir(tnDir, { recursive: true });

  // ---- 3) Copy each image into tn/ if not already present ----
  await copyImagesToThumbs(dir, tnDir);

  // ---- 4) Update JSON data file with image references ----
  await updateJsonWithImages({ dir, folderName, jsonPath });

  console.log("\nAll done.");
}

async function normalizeNamesInDir(directory, opts = {}) {
  const { optional = false } = opts;

  const stat = await fs.stat(directory).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    if (optional) return;
    console.warn(`Skipping name normalization: "${directory}" not found.`);
    return;
  }

  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.startsWith(".")) continue;

    const parsed = path.parse(entry.name);
    const origBase = parsed.name;           // original basename (no ext)
    const origExt  = parsed.ext;            // original extension (keep case)
    const lowerExt = origExt.toLowerCase();

    // Desired extension
    let newExt = origExt;
    if (lowerExt === ".jpeg" || lowerExt === ".jpg") {
      newExt = ".jpg";
    } else if (lowerExt === ".heic") {
      newExt = ".heic"; // keep for now; conversion happens later
    }

    // Desired basename
    const newBase = simplify(origBase);

    const src = path.join(directory, entry.name);
    const dstName = `${newBase}${newExt}`;
    const dst = path.join(directory, dstName);

    // Skip if already correct
    if (entry.name === dstName) continue;

    // If only case differs on a case-insensitive FS, do a 2-step rename
    if (src.toLowerCase() === dst.toLowerCase()) {
      const tmp = path.join(directory, `${newBase}.tmp-${Date.now()}`);
      try {
        await fs.rename(src, tmp);
        await fs.rename(tmp, dst);
        console.log(`Renamed: ${entry.name} → ${dstName}`);
      } catch (e) {
        console.warn(`Failed to normalize ${entry.name}: ${e?.message || e}`);
      }
      continue;
    }

    // If destination already exists (different file), don’t clobber
    if (await exists(dst)) {
      console.warn(`Skip rename (target exists): ${entry.name} → ${dstName}`);
      continue;
    }

    try {
      await fs.rename(src, dst);
      console.log(`Renamed: ${entry.name} → ${dstName}`);
    } catch (e) {
      console.warn(`Failed to normalize ${entry.name}: ${e?.message || e}`);
    }
  }
}

async function convertHeicToJpg(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.startsWith(".")) continue;
    if (entry.name.toLowerCase() === "tn") continue;

    const { name: base, ext } = path.parse(entry.name);
    if (ext.toLowerCase() !== ".heic") continue;

    const src = path.join(dir, entry.name);
    const out = path.join(dir, `${base}.jpg`);

    if (await exists(out)) {
      console.log(`HEIC already converted earlier: ${entry.name} -> ${base}.jpg (found existing)`);
      await safeUnlink(src); // you asked to not keep HEICs
      continue;
    }

    if (process.platform !== "darwin") {
      console.warn(`Skipping HEIC conversion (non-macOS): ${entry.name}`);
      continue;
    }

    try {
      console.log(`Converting HEIC → JPG: ${entry.name} → ${base}.jpg`);
      await execFileAsync("sips", ["-s", "format", "jpeg", src, "-o", out]);
      await safeUnlink(src);
    } catch (err) {
      console.error(`Failed to convert ${entry.name}:`, err?.stderr || err?.message || err);
    }
  }
}

async function copyImagesToThumbs(dir, tnDir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const newThumbPaths = []; // collect only the thumbnails we created this run

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.startsWith(".")) continue;
    if (entry.name.toLowerCase() === "tn") continue;

    const { ext } = path.parse(entry.name);
    const lowerExt = ext.toLowerCase();
    if (!IMAGE_EXTS_FOR_COPY.has(lowerExt)) continue;

    const src = path.join(dir, entry.name);
    const dst = path.join(tnDir, entry.name);
    if (await exists(dst)) continue;

    try {
      await fs.copyFile(src, dst);
      newThumbPaths.push(dst);
      console.log(`Copied → tn/: ${entry.name}`);
    } catch (e) {
      console.error(`Failed to copy to tn/: ${entry.name}`, e?.message || e);
    }
  }

  console.log("Open the files inside 'tn/' to crop to square and batch-resize to 600×600 in Preview.");

  // If we created any thumbnails, open them all in a single Preview window.
  if (newThumbPaths.length > 0) {
    if (process.platform === "darwin") {
      try {
        // One call opens all files together (so Preview groups them in one window).
        await execFileAsync("open", ["-a", "Preview", ...newThumbPaths]);
        console.log(`Opened ${newThumbPaths.length} new thumbnail(s) in Preview.`);
      } catch (e) {
        console.warn(`Could not open new thumbnails in Preview: ${e?.message || e}`);
      }
    } else {
      console.log(`Created ${newThumbPaths.length} new thumbnail(s). (Skipping auto-open: not macOS)`);
    }
  }
}

async function updateJsonWithImages({ dir, folderName, jsonPath }) {
  // Load JSON
  let data;
  try {
    const raw = await fs.readFile(jsonPath, "utf8");
    data = JSON.parse(raw);
  } catch (e) {
    console.error(`\nError: Could not open/parse "${jsonPath}".`);
    console.error("Make sure the file exists and is valid JSON.");
    return;
  }

  // Gather JPEG filenames in the top-level folder (ignore tn/)
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const jpgs = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((n) => n.toLowerCase().endsWith(".jpg") && !n.startsWith("."));

  // Group by “place key” (strip trailing digits from the base name)
  const byKey = new Map(); // key -> filenames[]
  for (const filename of jpgs) {
    const key = placeKeyFromFilename(filename);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(filename);
  }

  // For stable, human-friendly order: sort filenames in each key by trailing number then name
  for (const [key, list] of byKey) {
    list.sort(compareByTrailingNumber);
    byKey.set(key, list);
  }

  // Update data object
  const missingKeys = [];
  let changed = false;

  for (const [key, files] of byKey) {
    if (!(key in data)) {
      for (const f of files) {
        console.error(`No matching place key "${key}" in ${folderName}.json for file: ${f}`);
      }
      missingKeys.push(key);
      continue;
    }

    const place = data[key] ?? {};
    const hadImagesProp = Array.isArray(place.images);          // <— track if images existed
    const images = hadImagesProp ? place.images.slice() : [];

    let updated = false;
    for (const f of files) {
      if (!images.includes(f)) {
        images.push(f);
        updated = true;
      }
    }

    // If we added/created images, persist and maybe add caption:""
    if (updated) {
      place.images = images;
      // Only when we CREATE images[] (it didn't exist before), add empty caption if missing
      if (!hadImagesProp && !Object.prototype.hasOwnProperty.call(place, "caption")) {
        place.caption = "";
        console.log(`Added empty caption for "${key}"`);
      }
      data[key] = place;
      changed = true;
      console.log(`Updated key "${key}": now has images [${images.join(", ")}]`);
    }
  }

  // Save only if changed
  if (!changed) {
    console.log("\nNo changes needed in the JSON file (already up-to-date).");
    return;
  }

  // Atomic write: write to temp, then rename
  const tmpPath = `${jsonPath}.tmp`;
  const pretty = stringifyWithInlineArrays(data, 2) + "\n";
  await fs.writeFile(tmpPath, pretty, "utf8");
  await fs.rename(tmpPath, jsonPath);
  console.log(`\nSaved updates to: ${jsonPath}`);
}

function stringifyWithInlineArrays(obj, indent = 2) {
  // Start with standard pretty JSON
  let json = JSON.stringify(obj, null, indent);

  // Compress arrays of strings into a single line
  json = json.replace(
    /\[\s*\n\s*((?:"[^"]*"(?:,)?\s*\n\s*)+)\]/g,
    (match, group) => {
      const items = group
        .split(/\n/)
        .map(l => l.trim())
        .filter(Boolean);
      return `[${items.join(" ")}]`;
    }
  );

  return json;
}

function placeKeyFromFilename(filename) {
  const base = filename.replace(/\.[^.]+$/, ""); // drop extension
  // Strip trailing digits (e.g., foo1 -> foo, foo12 -> foo). If no digits, base stays.
  return base.replace(/\d+$/, "");
}

function compareByTrailingNumber(a, b) {
  const [na, nb] = [a, b].map((s) => {
    const m = s.match(/(\d+)\.[^.]+$/);
    return m ? parseInt(m[1], 10) : Number.NaN;
  });

  const aIsNum = Number.isFinite(na);
  const bIsNum = Number.isFinite(nb);

  if (aIsNum && bIsNum) return na - nb;
  if (aIsNum && !bIsNum) return 1;   // unnumbered first (e.g., foo.jpg) then numbered (foo1.jpg)
  if (!aIsNum && bIsNum) return -1;
  return a.localeCompare(b);
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function safeUnlink(p) {
  try {
    await fs.unlink(p);
  } catch (e) {
    console.warn(`Could not remove "${path.basename(p)}": ${e?.message || e}`);
  }
}

function simplify(value) {
  return value
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/’/g, "")
    .replace(/\./g, "")
    .replace(/,/g, "")
    .replace(/\*/g, "")
    .replace(/"/g, "")
    .replace(/</g, "")
    .replace(/>/g, "")
    .normalize("NFD") // decompose accents/diacritics
    .replace(/[\u0300-\u036f]/g, "") // remove diacritical marks
    .replace(/the-/, "");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
