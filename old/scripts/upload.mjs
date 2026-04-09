#!/usr/bin/env node
// upload.mjs
// Usage:
//   node upload.mjs [/path/to/folder] [--dry-run] [--force]
//
// Behavior:
// - Uses local folder name as s3 prefix: s3://andrewzc-imagine/<folder>/...
// - Uploads only missing keys by default; --force uploads everything
// - For tn/ files being uploaded, resizes & saves locally to 600×600 before upload

import { promises as fs } from "fs";
import path from "path";
import { S3Client, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

const BUCKET = "andrewzc-imagine";
const CONCURRENCY = 5;
const THUMB_SIZE = 600;

const CT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

const CACHE_IMAGES = "public, max-age=31536000, immutable";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");
  const dirArg = args.find(a => !a.startsWith("-"));

  if (!dirArg) {
    console.error("Usage: node upload.mjs [/path/to/folder] [--dry-run] [--force]");
    process.exit(1);
  }

  const localDir = path.resolve(dirArg.replace(/\/+$/, "")); // trim trailing slash
  const folderName = path.basename(localDir);
  const prefix = `${folderName}/`;

  const stat = await fs.stat(localDir).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    console.error(`Error: "${localDir}" is not a directory or does not exist.`);
    process.exit(1);
  }

  const localFiles = await gatherLocalFiles(localDir); // marks tn files with isThumb
  if (!localFiles.length) {
    console.log("No local files to consider.");
    return;
  }

  const s3 = new S3Client({}); // picks up region/creds from env or shared config

  // Build set of existing keys unless --force
  const existing = force ? new Set() : await listAllKeys(s3, BUCKET, prefix);

  // Choose what to upload
  const toUpload = force ? localFiles : localFiles.filter(f => !existing.has(f.key));
  if (!toUpload.length) {
    console.log(`All files already present in s3://${BUCKET}/${prefix}`);
    return;
  }

  if (dryRun) {
    console.log(`DRY RUN — would upload ${toUpload.length} file(s):`);
    for (const f of toUpload) {
      const note = f.isThumb && shouldResize(f.ext) ? " (resize local tn → 600×600)" : "";
      console.log(`  + ${f.key}${note}`);
    }
    return;
  }

  if (force) {
    console.log(`--force enabled: uploading ${toUpload.length} file(s) regardless of presence on S3.`);
  } else {
    console.log(`Uploading ${toUpload.length} missing file(s) to s3://${BUCKET}/${prefix} …`);
  }

  let i = 0, inFlight = 0, uploaded = 0, failed = 0;
  const next = async () => {
    if (i >= toUpload.length) return;
    const file = toUpload[i++];
    inFlight++;
    try {
      await uploadOne(s3, BUCKET, file);
      uploaded++;
      process.stdout.write(`✔ ${file.key}\n`);
    } catch (e) {
      failed++;
      console.error(`✖ ${file.key}: ${e?.message || e}`);
    } finally {
      inFlight--;
      await next();
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, toUpload.length) }, () => next()));
  console.log(`Done. Uploaded: ${uploaded}, failed: ${failed}, skipped: ${localFiles.length - toUpload.length}`);
}

async function gatherLocalFiles(baseDir) {
  const files = [];

  // top-level files
  const top = await fs.readdir(baseDir, { withFileTypes: true });
  for (const e of top) {
    if (e.isFile() && !e.name.startsWith(".")) {
      files.push({
        absPath: path.join(baseDir, e.name),
        key: `${path.basename(baseDir)}/${e.name}`,
        ext: path.extname(e.name).toLowerCase(),
        isThumb: false,
      });
    }
  }

  // tn/ files
  const tnDir = path.join(baseDir, "tn");
  const tnStat = await fs.stat(tnDir).catch(() => null);
  if (tnStat?.isDirectory()) {
    const tn = await fs.readdir(tnDir, { withFileTypes: true });
    for (const e of tn) {
      if (e.isFile() && !e.name.startsWith(".")) {
        files.push({
          absPath: path.join(tnDir, e.name),
          key: `${path.basename(baseDir)}/tn/${e.name}`,
          ext: path.extname(e.name).toLowerCase(),
          isThumb: true,
        });
      }
    }
  }
  return files;
}

async function listAllKeys(s3, bucket, prefix) {
  const keys = new Set();
  let ContinuationToken;
  do {
    const resp = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken
    }));
    (resp.Contents || []).forEach(o => keys.add(o.Key));
    ContinuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return keys;
}

function shouldResize(ext) {
  // Only formats we can safely write back; skip GIF/SVG/etc.
  return ext === ".jpg" || ext === ".jpeg" || ext === ".png" || ext === ".webp";
}

async function ensureLocalThumb600(filePath, ext) {
  try {
    // If already 600×600, skip (rotate honors EXIF orientation)
    const meta = await sharp(filePath).rotate().metadata();
    if (meta?.width === THUMB_SIZE && meta?.height === THUMB_SIZE) {
      return false; // no change needed
    }

    // Resize to exactly 600×600. Assumes input is already square (your manual crop).
    // Use "cover" to guarantee exact dimensions if something slips through.
    let pipeline = sharp(filePath).rotate().resize(THUMB_SIZE, THUMB_SIZE, {
      fit: "cover",
      withoutEnlargement: false,
    });

    const tmpPath = `${filePath}.tmp`;
    if (ext === ".png")       await pipeline.png().toFile(tmpPath);
    else if (ext === ".webp") await pipeline.webp({ quality: 90 }).toFile(tmpPath);
    else                      await pipeline.jpeg({ quality: 85, mozjpeg: true }).toFile(tmpPath);

    await fs.rename(tmpPath, filePath); // atomic-ish swap
    return true;
  } catch (e) {
    console.warn(`Could not resize ${path.basename(filePath)}: ${e?.message || e}`);
    return false;
  }
}

async function uploadOne(s3, bucket, file) {
  // NEW: if this is a tn file and it's being uploaded, first ensure local 600×600
  if (file.isThumb && shouldResize(file.ext)) {
    const changed = await ensureLocalThumb600(file.absPath, file.ext);
    if (changed) {
      process.stdout.write(`↺ resized ${path.basename(file.absPath)} to ${THUMB_SIZE}×${THUMB_SIZE}\n`);
    }
  }

  // Read (possibly updated) file
  const Body = await fs.readFile(file.absPath);
  const ContentType = CT[file.ext] || "application/octet-stream";

  const params = {
    Bucket: bucket,
    Key: file.key,
    Body,
    ContentType,
  };
  if (ContentType.startsWith("image/")) {
    params.CacheControl = CACHE_IMAGES;
  }
  await s3.send(new PutObjectCommand(params));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
