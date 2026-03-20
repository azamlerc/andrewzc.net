const API_BASE = "https://api.andrewzc.net";

export async function api(path, opts = {}) {
  const res = await fetch(API_BASE + path, {
    ...opts,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {})
    }
  });

  let data = null;
  try { data = await res.json(); } catch (_) {}

  if (!res.ok) {
    const msg = (data && (data.message || data.error)) ? (data.message || data.error) : (`HTTP ${res.status}`);
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export function getEntity(list, key) {
  return api(`/entities/${encodeURIComponent(list)}/${encodeURIComponent(key)}`, { method: "GET" });
}

export function createEntity(list, payload) {
  return api(`/entities/${encodeURIComponent(list)}`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateEntity(list, key, patch) {
  return api(`/entities/${encodeURIComponent(list)}/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify(patch)
  });
}

export function deleteEntityApi(list, key) {
  return api(`/entities/${encodeURIComponent(list)}/${encodeURIComponent(key)}`, { method: "DELETE" });
}

export function lookupWiki(name) {
  return api(`/wiki?q=${encodeURIComponent(name)}`, { method: "GET" });
}

export function lookupCoords(url, list) {
  return api(`/coords?url=${encodeURIComponent(url)}&list=${encodeURIComponent(list)}`, { method: "GET" });
}

export function lookupNearestCity(lat, lon) {
  return api(`/entities/nearby?lat=${lat}&lon=${lon}&radius=30&list=cities&limit=1`, { method: "GET" });
}

export function presignImages(list, key, count) {
  return api(`/entities/${encodeURIComponent(list)}/${encodeURIComponent(key)}/images/presign`, {
    method: "POST",
    body: JSON.stringify({ count })
  });
}

export function completeImages(list, key, filenames) {
  return api(`/entities/${encodeURIComponent(list)}/${encodeURIComponent(key)}/images/complete`, {
    method: "POST",
    body: JSON.stringify({ filenames })
  });
}

export function getPage(key) {
  return api(`/pages/${encodeURIComponent(key)}`, { method: "GET" });
}

export function createPage(payload) {
  return api(`/pages`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updatePage(key, patch) {
  return api(`/pages/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify(patch)
  });
}
