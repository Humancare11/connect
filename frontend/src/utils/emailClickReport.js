// Email Marketing click report. A link in a marketing mail to our own site looks like
//   https://humancareconnect.co/some-page?r=AbC123xYz9
// The code carries no personal data. On page load the code is reported once to the server and removed from the
// address bar, so it is not copied around, bookmarked or reported twice by a reload. Nothing here can block or
// slow the page: the address is cleaned synchronously (one cheap call), the report is sent after the page is idle,
// and every failure is swallowed.

const CODE_RE = /^[0-9A-Za-z]{8,16}$/;

// Pure: → { code, cleanedUrl } (code "" when there is nothing to report). Other parameters and the #fragment stay.
export function extractClickCode(href) {
  try {
    const url = new URL(href, "https://x.invalid");
    const raw = url.searchParams.get("r");
    if (raw === null) return { code: "", cleanedUrl: "" };
    const code = CODE_RE.test(raw) ? raw : "";
    url.searchParams.delete("r");
    return { code, cleanedUrl: `${url.pathname}${url.search}${url.hash}` };
  } catch {
    return { code: "", cleanedUrl: "" };
  }
}

export function sendClickReport(code, { nav = typeof navigator !== "undefined" ? navigator : null, doFetch = typeof fetch === "function" ? fetch : null } = {}) {
  const path = `/api/r/${code}`;
  try {
    if (nav && typeof nav.sendBeacon === "function" && nav.sendBeacon(path)) return "beacon";
  } catch {
    /* fall through to fetch */
  }
  try {
    if (doFetch) {
      doFetch(path, { method: "POST", keepalive: true, credentials: "omit" }).catch(() => {});
      return "fetch";
    }
  } catch {
    /* ignore */
  }
  return "none";
}

// Called once, before the app renders. The router therefore never even sees the "r" parameter.
export function reportEmailClick(win = typeof window !== "undefined" ? window : null) {
  if (!win || !win.location || !win.location.search) return;
  try {
    const { code, cleanedUrl } = extractClickCode(win.location.href);
    if (!cleanedUrl) return;
    win.history.replaceState(win.history.state, "", cleanedUrl);
    if (code) {
      const run = () => sendClickReport(code);
      if (typeof win.requestIdleCallback === "function") win.requestIdleCallback(run, { timeout: 3000 });
      else win.setTimeout(run, 0);
    }
  } catch {
    /* never get in the way of the page */
  }
}
