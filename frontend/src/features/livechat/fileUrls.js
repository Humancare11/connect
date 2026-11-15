// Short links to chat files. The server's links last 5 minutes, so a picture's link is reused for 4 minutes (a
// thumbnail asks once, however often the chat re-renders) and dropped when the picture fails to load.
// Pure logic with an injectable clock, so it is unit-tested without a browser.
export const URL_TTL_MS = 4 * 60 * 1000;

export function createUrlCache({ now = () => Date.now(), ttlMs = URL_TTL_MS } = {}) {
  const done = new Map(); // key -> { url, at }
  const pending = new Map(); // key -> Promise<string> (a second ask while the first is on its way shares it)
  return {
    // `load()` returns a Promise<string>; it runs only when there is no fresh link and no request on its way.
    resolve(key, load) {
      const hit = done.get(key);
      if (hit && now() - hit.at < ttlMs) return Promise.resolve(hit.url);
      if (pending.has(key)) return pending.get(key);
      const request = Promise.resolve()
        .then(load)
        .then((url) => {
          if (!url) throw new Error("no link");
          done.set(key, { url, at: now() });
          return url;
        })
        .finally(() => pending.delete(key));
      pending.set(key, request);
      return request;
    },
    // The link did not work (expired, or the picture failed): the next ask fetches a new one.
    forget(key) {
      done.delete(key);
    },
    clear() {
      done.clear();
      pending.clear();
    },
  };
}

export const IMAGE_TYPES = ["image/jpeg", "image/png"];
export const isImage = (mime) => IMAGE_TYPES.includes(mime);

export const kindLabel = (mime) => (mime === "application/pdf" ? "PDF" : mime === "image/png" ? "PNG" : mime === "image/jpeg" ? "JPG" : "File");

export const sizeLabel = (bytes) => {
  const n = Number(bytes) || 0;
  return n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
};

// One cache for the page (chat widget and admin console never share a page, and the keys are file ids).
export const fileUrlCache = createUrlCache();
