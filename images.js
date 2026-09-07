import { presignImages, completeImages } from "./api.js";

const IMAGE_BASE = "https://images.andrewzc.net";

let pendingThumbUrls = [];

function imageUrl(list, filename) {
  return `${IMAGE_BASE}/${list}/${filename}`;
}

function thumbUrl(list, filename) {
  return `${IMAGE_BASE}/${list}/tn/${filename}`;
}

export function clearPendingThumbUrls() {
  for (const url of pendingThumbUrls) URL.revokeObjectURL(url);
  pendingThumbUrls = [];
}

export function renderImages({ list, entity, pendingFiles = [], imageGrid, uploadButton, imagesHelp, canUpload, onRemoveImage = null }) {
  imageGrid.innerHTML = "";

  const filenames = Array.isArray(entity?.images) ? entity.images : [];
  for (const filename of filenames) {
    const wrap = document.createElement("div");
    wrap.className = "thumbItem";

    const a = document.createElement("a");
    a.className = "thumbLink";
    a.href = imageUrl(list, filename);
    a.target = "_blank";
    a.rel = "noopener noreferrer";

    const img = document.createElement("img");
    img.src = thumbUrl(list, filename);
    img.alt = filename;

    a.appendChild(img);

    wrap.appendChild(a);

    if (typeof onRemoveImage === "function") {
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "thumbRemove";
      removeBtn.setAttribute("aria-label", `Remove ${filename}`);
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onRemoveImage(filename);
      });
      wrap.appendChild(removeBtn);
    }

    imageGrid.appendChild(wrap);
  }

  for (const pendingUrl of pendingFiles) {
    const wrap = document.createElement("div");
    wrap.className = "thumbItem";

    const a = document.createElement("a");
    a.className = "thumbLink thumbPending";
    a.href = pendingUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";

    const img = document.createElement("img");
    img.src = pendingUrl;
    img.alt = "Uploading image";

    a.appendChild(img);
    wrap.appendChild(a);
    imageGrid.appendChild(wrap);
  }

  uploadButton.disabled = !canUpload;
  imagesHelp.textContent = canUpload ? "" : "Save new entities before uploading images.";
}

async function fileToImageElement(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    const loaded = new Promise((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Could not load ${file.name}`));
    });
    img.src = url;
    await loaded;
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function canvasToJpegBlob(canvas, quality = 0.9) {
  return await new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("Could not encode JPEG"));
    }, "image/jpeg", quality);
  });
}

const THUMB_SIZE = 600;

// Downscale a square source to THUMB_SIZE and return the canvas.
//
// The obvious implementation — one drawImage() straight from full resolution
// to 600px — is what this used to do, and it aliases badly. Canvas defaults to
// imageSmoothingQuality "low" (roughly bilinear), which samples too few source
// pixels when the reduction is large. That was tolerable on 12MP photos (a 5x
// reduction) and became visibly chunky at 24MP (7x), which is why thumbnails
// appeared to degrade without the code ever changing.
//
// createImageBitmap does the resize inside the browser's own image pipeline
// with a proper filter. Support for resizeWidth/resizeQuality is not universal,
// so we check what actually came back rather than trusting it, and fall back to
// halving repeatedly — each step is a 2x reduction, where bilinear is fine.
async function squareThumbCanvas(bitmap, sx, sy, size) {
  const canvas = document.createElement("canvas");
  canvas.width = THUMB_SIZE;
  canvas.height = THUMB_SIZE;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (typeof createImageBitmap === "function") {
    let resized = null;
    try {
      resized = await createImageBitmap(bitmap, sx, sy, size, size, {
        resizeWidth: THUMB_SIZE,
        resizeHeight: THUMB_SIZE,
        resizeQuality: "high",
      });
    } catch {
      resized = null;
    }
    // Some browsers accept the options and ignore them. Only trust the result
    // if it is actually the size we asked for.
    if (resized && resized.width === THUMB_SIZE && resized.height === THUMB_SIZE) {
      ctx.drawImage(resized, 0, 0);
      resized.close?.();
      return canvas;
    }
    resized?.close?.();
  }

  // Fallback: halve until within 2x of the target, then draw.
  let stepCanvas = document.createElement("canvas");
  let stepCtx = stepCanvas.getContext("2d");
  stepCanvas.width = size;
  stepCanvas.height = size;
  stepCtx.imageSmoothingEnabled = true;
  stepCtx.imageSmoothingQuality = "high";
  stepCtx.drawImage(bitmap, sx, sy, size, size, 0, 0, size, size);

  let current = size;
  while (current > THUMB_SIZE * 2) {
    const next = Math.max(THUMB_SIZE, Math.floor(current / 2));
    const half = document.createElement("canvas");
    half.width = next;
    half.height = next;
    const halfCtx = half.getContext("2d");
    halfCtx.imageSmoothingEnabled = true;
    halfCtx.imageSmoothingQuality = "high";
    halfCtx.drawImage(stepCanvas, 0, 0, current, current, 0, 0, next, next);
    stepCanvas = half;
    stepCtx = halfCtx;
    current = next;
  }

  ctx.drawImage(stepCanvas, 0, 0, current, current, 0, 0, THUMB_SIZE, THUMB_SIZE);
  return canvas;
}

async function makeUploadBlobs(file) {
  // Decode once, honouring EXIF orientation. The <img> element did this
  // implicitly; createImageBitmap does not unless asked, and getting it wrong
  // would silently rotate every portrait photo.
  let bitmap = null;
  if (typeof createImageBitmap === "function") {
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      bitmap = null;
    }
  }
  const source = bitmap || await fileToImageElement(file);

  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;
  if (!width || !height) {
    throw new Error(`Invalid image: ${file.name}`);
  }

  // Full size is drawn 1:1, so no resampling happens here and the smoothing
  // setting is irrelevant. The re-encode is kept deliberately: it normalises
  // orientation into pixels and strips EXIF, including GPS, before upload.
  const originalCanvas = document.createElement("canvas");
  originalCanvas.width = width;
  originalCanvas.height = height;
  originalCanvas.getContext("2d").drawImage(source, 0, 0, width, height);

  const size = Math.min(width, height);
  const sx = Math.floor((width - size) / 2);
  const sy = Math.floor((height - size) / 2);

  const thumbCanvas = await squareThumbCanvas(source, sx, sy, size);

  const [originalBlob, thumbBlob] = await Promise.all([
    canvasToJpegBlob(originalCanvas, 0.9),
    canvasToJpegBlob(thumbCanvas, 0.85),
  ]);

  bitmap?.close?.();

  return {
    originalBlob,
    thumbBlob,
    previewUrl: URL.createObjectURL(thumbBlob),
  };
}

async function putToS3(uploadUrl, blob) {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: blob,
  });
  if (!res.ok) throw new Error(`S3 PUT failed (${res.status})`);
}

export async function uploadImagesFlow({
  list,
  key,
  files,
  setStatus,
  onRenderPending,
  onComplete,
}) {
  const picked = Array.from(files || []).filter(Boolean);
  if (picked.length === 0) return;

  clearPendingThumbUrls();

  const prepared = [];
  try {
    setStatus("Preparing images…");
    for (let i = 0; i < picked.length; i += 1) {
      setStatus(`Preparing image ${i + 1} of ${picked.length}…`);
      prepared.push(await makeUploadBlobs(picked[i]));
    }

    pendingThumbUrls = prepared.map(item => item.previewUrl);
    onRenderPending(pendingThumbUrls);

    setStatus("Allocating upload targets…");
    const presigned = await presignImages(list, key, picked.length);
    const uploads = Array.isArray(presigned?.uploads) ? presigned.uploads : [];
    if (uploads.length !== prepared.length) {
      throw new Error("Presign response did not match selected files");
    }

    for (let i = 0; i < uploads.length; i += 1) {
      setStatus(`Uploading image ${i + 1} of ${uploads.length}…`);
      await putToS3(uploads[i].originalUploadUrl, prepared[i].originalBlob);
      await putToS3(uploads[i].thumbUploadUrl, prepared[i].thumbBlob);
    }

    setStatus("Finalizing images…");
    const completed = await completeImages(list, key, uploads.map(upload => upload.filename));
    clearPendingThumbUrls();
    onComplete(completed.entity);
    setStatus("Images uploaded.", "ok");
  } catch (err) {
    clearPendingThumbUrls();
    throw err;
  }
}
