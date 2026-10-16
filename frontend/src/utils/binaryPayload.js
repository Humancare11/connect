// True for response bodies that are bytes, not JSON (file downloads requested with responseType "blob"/"arraybuffer").
// The API client rewrites upload-looking strings by rebuilding response objects key by key; doing that to a Blob
// silently turns it into `{}` and the download then fails.
export function isBinaryPayload(data) {
  if (!data || typeof data !== "object") return false;
  if (typeof Blob !== "undefined" && data instanceof Blob) return true;
  if (typeof ArrayBuffer !== "undefined" && (data instanceof ArrayBuffer || ArrayBuffer.isView(data))) return true;
  return false;
}

// Text for a failed blob request: the server's JSON { msg } when there is one, always with the HTTP status so a
// proxy page (nginx 502/413/504, an HTML 404) or a network/CORS failure can be told apart from an app error.
export async function describeBlobError(err, fallback = "Download failed. Please try again.") {
  const res = err?.response;
  if (!res) return `${fallback} (${err?.message || "no response from the server"})`;
  let msg = "";
  try {
    const raw = typeof res.data?.text === "function" ? await res.data.text() : "";
    try { msg = JSON.parse(raw)?.msg || ""; } catch { msg = ""; }
    if (!msg && raw && !/^\s*</.test(raw)) msg = raw.trim().slice(0, 160);
  } catch { /* unreadable body */ }
  const status = [res.status, res.statusText].filter(Boolean).join(" ");
  return `${msg || fallback}${status ? ` (HTTP ${status})` : ""}`;
}
