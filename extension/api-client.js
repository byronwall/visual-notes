const DEFAULT_CONFIG = {
  serverBaseUrl: "http://127.0.0.1:3000",
  ingestToken: "",
};

export async function getArchiveConfig() {
  const stored = await chrome.storage.local.get(DEFAULT_CONFIG);
  return { ...DEFAULT_CONFIG, ...stored };
}

export async function setArchiveConfig(next) {
  await chrome.storage.local.set(next);
}

async function request(path, init = {}) {
  const config = await getArchiveConfig();
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json");
  if (config.ingestToken) {
    headers.set("authorization", `Bearer ${config.ingestToken}`);
  }

  const response = await fetch(`${config.serverBaseUrl}${path}`, {
    ...init,
    headers,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return payload;
}

export function lookupPage(url) {
  const search = new URLSearchParams({ url });
  return request(`/api/archive/lookup?${search.toString()}`, {
    method: "GET",
    headers: {},
  });
}

export function fetchGroups() {
  return request("/api/archive/groups", {
    method: "GET",
    headers: {},
  });
}

export function sendBulkCapture(payload) {
  return request("/api/archive/bulk-capture", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function sendTargetedCapture(payload) {
  return request("/api/archive/targeted-capture", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
