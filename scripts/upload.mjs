#!/usr/bin/env node
// upload.mjs
// Usage: node upload.mjs [/path/to/folder] [--dry-run]

import { promises as fs } from "fs";
import path from "path";
import { S3Client, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";

const BUCKET = "andrewzc-imagine";
const CONCURRENCY = 5;

// Very small content-type map (extend as needed)
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
  const dirArg = args.find(a => !a.startsWith("-"));
  if (!dirArg) {
    console.error("Usage: node upload.mjs [/path/to/folder] [--dry-run]");
    process.exit(1);
  }

  const localDir = path.resolve(dirArg.replace(/\/+$/, "")); // trim trailing slash
  const folderName = path.basename(localDir);
  const prefix = `${folderName}/`;

  // Sanity checks
  const stat = await fs.stat(localDir).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    console.error(`Error: "${localDir}" is not a directory or does not exist.`);
    process.exit(1);
  }

  // Collect local files (top-level + tn/)
  const localFiles = await gatherLocalFiles(localDir);
  if (!localFiles.length) {
    console.log("No local files to consider.");
    return;
  }

  // Build a set of existing S3 keys under prefix
  const s3 = new S3Client({});
  const existing = await listAllKeys(s3, BUCKET, prefix);

  // Determine which uploads are missing
  const toUpload = localFiles.filter(f => !existing.has(f.key));
  if (!toUpload.length) {
    console.log(`All files already present in s3://${BUCKET}/${prefix}`);
    return;
  }

  if (dryRun) {
    console.log(`DRY RUN — would upload ${toUpload.length} file(s):`);
    for (const f of toUpload) console.log(`  + ${f.key}`);
    return;
  }

  console.log(`Uploading ${toUpload.length} missing file(s) to s3://${BUCKET}/${prefix} …`);

  // Upload with small concurrency
  let inFlight = 0, i = 0, uploaded = 0, failed = 0;

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

  const starters = Math.min(CONCURRENCY, toUpload.length);
  await Promise.all(Array.from({ length: starters }, () => next()));

  console.log(`Done. Uploaded: ${uploaded}, failed: ${failed}, skipped (already present): ${localFiles.length - toUpload.length}`);
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
        ext: path.extname(e.name).toLowerCase()
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
          ext: path.extname(e.name).toLowerCase()
        });
      }
    }
  }

  return files;
}

async function listAllKeys(s3, bucket, prefix) {
  const keys = new Set();
  let ContinuationToken = undefined;
  do {
    const resp = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken,
    }));
    (resp.Contents || []).forEach(o => keys.add(o.Key));
    ContinuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return keys;
}

async function uploadOne(s3, bucket, file) {
  const Body = await fs.readFile(file.absPath);
  const ContentType = CT[file.ext] || "application/octet-stream";
  const params = {
    Bucket: bucket,
    Key: file.key,
    Body,
    ContentType,
  };

  // Aggressive caching for images (safe for immutable filenames)
  if (ContentType.startsWith("image/")) {
    params.CacheControl = CACHE_IMAGES;
  }

  await s3.send(new PutObjectCommand(params));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
