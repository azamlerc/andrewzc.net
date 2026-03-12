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

export function renderImages({ list, entity, pendingFiles = [], imageGrid, uploadButton, imagesHelp, canUpload }) {
  imageGrid.innerHTML = "";

  const filenames = Array.isArray(entity?.images) ? entity.images : [];
  for (const filename of filenames) {
    const a = document.createElement("a");
    a.className = "thumbLink";
    a.href = imageUrl(list, filename);
    a.target = "_blank";
    a.rel = "noopener noreferrer";

    const img = document.createElement("img");
    img.src = thumbUrl(list, filename);
    img.alt = filename;

    a.appendChild(img);
    imageGrid.appendChild(a);
  }

  for (const pendingUrl of pendingFiles) {
    const a = document.createElement("a");
    a.className = "thumbLink thumbPending";
    a.href = pendingUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";

    const img = document.createElement("img");
    img.src = pendingUrl;
    img.alt = "Uploading image";

    a.appendChild(img);
    imageGrid.appendChild(a);
  }

  if (imageGrid.children.length === 0) {
    const empty = document.createElement("div");
    empty.className = "imagesHelp";
    empty.textContent = "No images yet.";
    imageGrid.appendChild(empty);
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

async function makeUploadBlobs(file) {
  const img = await fileToImageElement(file);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  if (!width || !height) {
    throw new Error(`Invalid image: ${file.name}`);
  }

  const originalCanvas = document.createElement("canvas");
  originalCanvas.width = width;
  originalCanvas.height = height;
  originalCanvas.getContext("2d").drawImage(img, 0, 0, width, height);

  const size = Math.min(width, height);
  const sx = Math.floor((width - size) / 2);
  const sy = Math.floor((height - size) / 2);

  const thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = 600;
  thumbCanvas.height = 600;
  thumbCanvas.getContext("2d").drawImage(
    img,
    sx, sy, size, size,
    0, 0, 600, 600
  );

  const [originalBlob, thumbBlob] = await Promise.all([
    canvasToJpegBlob(originalCanvas, 0.9),
    canvasToJpegBlob(thumbCanvas, 0.85),
  ]);

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
