// Pure helpers for the Visit Note editor's load / local-backup logic (kept out of the component so they can be unit tested).

const PREFIX = "hc-vne-draft-";
// Scoped per signed-in doctor (id from the access token) and per appointment, so a shared browser never shows or saves
// one doctor's unsaved text in another doctor's note.
export function backupOwner(token) {
  try {
    const part = String(token || "").split(".")[1];
    if (!part) return "anon";
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return String(json.id || "anon");
  } catch {
    return "anon";
  }
}
const KEY = (owner, appointmentId) => `${PREFIX}${owner}-${appointmentId}`;

// Sign Out: remove every unsaved-note backup of this browser tab.
export function clearAllBackups(storage = globalThis.sessionStorage) {
  try {
    const keys = [];
    for (let i = 0; i < (storage?.length || 0); i += 1) keys.push(storage.key(i));
    keys.filter((k) => k && k.startsWith(PREFIX)).forEach((k) => storage.removeItem(k));
  } catch {
    /* nothing to clear */
  }
}

export function clearBackup(owner, appointmentId, storage = globalThis.sessionStorage) {
  try {
    storage?.removeItem(KEY(owner, appointmentId));
  } catch {
    /* ignore */
  }
}

/**
 * Merge a freshly loaded server note with what the doctor already typed (before the load finished) and with the
 * local backup of text that never reached the server (e.g. the connection dropped). Nothing typed is ever dropped:
 * when the server has newer, different text in the same field, both are kept (server text first).
 *
 * @param server   fields as stored on the server
 * @param typed    fields currently in the form
 * @param touched  Set of keys the doctor edited before the load finished
 * @param backup   { base: {key: serverValueWhenBackedUp}, value: {key: unsavedText} } or null
 */
export function mergeLoaded(server, typed, touched = new Set(), backup = null) {
  const out = { ...server };
  for (const key of Object.keys(server)) {
    const candidates = [];
    if (backup?.value && typeof backup.value[key] === "string" && backup.value[key] !== server[key]) {
      const sameBase = (backup.base?.[key] ?? "") === server[key];
      candidates.push({ text: backup.value[key], replaces: sameBase });
    }
    if (touched.has(key) && typeof typed?.[key] === "string" && typed[key] !== server[key]) {
      candidates.push({ text: typed[key], replaces: false });
    }
    let merged = server[key];
    for (const c of candidates) {
      if (!c.text.trim() || merged.includes(c.text)) continue;
      merged = c.replaces && merged === server[key] ? c.text : merged ? `${merged}\n${c.text}` : c.text;
    }
    out[key] = merged;
  }
  return out;
}

// Which keys differ between the form and what the server has.
export function diffFields(current, saved) {
  const diff = {};
  for (const key of Object.keys(saved)) if (current[key] !== saved[key]) diff[key] = current[key];
  return diff;
}

export function readBackup(owner, appointmentId, storage = globalThis.sessionStorage) {
  try {
    const raw = storage?.getItem(KEY(owner, appointmentId));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" && parsed.value ? parsed : null;
  } catch {
    return null;
  }
}

// Remember the unsaved fields (and the server text they were typed on top of); clear it when everything is saved.
export function writeBackup(owner, appointmentId, saved, current, storage = globalThis.sessionStorage) {
  try {
    const diff = diffFields(current, saved);
    const keys = Object.keys(diff);
    if (!keys.length) {
      storage?.removeItem(KEY(owner, appointmentId));
      return;
    }
    const base = {};
    for (const k of keys) base[k] = saved[k];
    storage?.setItem(KEY(owner, appointmentId), JSON.stringify({ base, value: diff, at: Date.now() }));
  } catch {
    /* storage unavailable (private mode / quota): the in-memory text and the unmount flush still apply */
  }
}

// A load error that will not fix itself (wrong doctor, no such appointment): do not retry forever.
export const isPermanentLoadError = (err) => {
  const status = err?.response?.status;
  return status >= 400 && status < 500 && ![401, 408, 429].includes(status);
};

// Only a note that is already part of a signed Visit Note is locked; a version conflict is just retried.
export const isFinalisedLockError = (err) =>
  err?.response?.status === 409 && /finalised|visit note/i.test(String(err?.response?.data?.msg || ""));
