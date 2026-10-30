// After a deploy the hashed files of the old build are gone. A visitor whose page was loaded before the deploy then fails to load a lazy
// chunk ("Failed to fetch dynamically imported module"), and would stay on a half-old page. Vite reports this as "vite:preloadError":
// reload once, so the browser fetches the new HTML (which links the new files). A second failure within a short time is not retried
// (a real outage would otherwise reload forever).
export const CHUNK_RELOAD_KEY = "hc:chunk-reload";
export const CHUNK_RELOAD_COOLDOWN_MS = 30000;

// Returns true when it reloaded the page.
export function reloadOnceForNewBuild({ storage, reload, now = Date.now() }) {
  try {
    const last = Number(storage?.getItem(CHUNK_RELOAD_KEY));
    if (Number.isFinite(last) && last > 0 && now - last < CHUNK_RELOAD_COOLDOWN_MS) return false;
    storage?.setItem(CHUNK_RELOAD_KEY, String(now));
  } catch {
    // no storage: reload once per page load at most (the event only fires for a failed chunk)
  }
  reload();
  return true;
}

export function installChunkReload(win = typeof window !== "undefined" ? window : null) {
  if (!win) return;
  win.addEventListener("vite:preloadError", (event) => {
    event.preventDefault?.();
    let storage = null;
    try {
      storage = win.sessionStorage;
    } catch {
      storage = null;
    }
    reloadOnceForNewBuild({ storage, reload: () => win.location.reload() });
  });
}
