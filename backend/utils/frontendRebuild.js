// Asks Render to rebuild the static frontend when blog content changes.
//
// The frontend prerenders blog posts at build time, so a published/edited/unpublished/deleted post
// only becomes a real page (or stops being one) after a rebuild. Set RENDER_FRONTEND_DEPLOY_HOOK to the
// static site's Deploy Hook URL (Render dashboard > the static site > Settings > Deploy Hook).
//
// - Does nothing (silently) when the variable is not set.
// - Debounced: the first change starts a 2-minute window; every change inside it is covered by the
//   single rebuild that fires when the window ends. State is per process.
// - Never blocks or fails the blog request: fire-and-forget, errors are only logged.
const DEBOUNCE_MS = 2 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10 * 1000;

let timer = null;
let pendingReasons = [];

async function callHook(url, reasons) {
  try {
    const res = await fetch(url, { method: "POST", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (res.ok) console.log(`[frontend-rebuild] deploy hook triggered (${res.status}) for ${reasons.length} blog change(s): ${reasons.join(", ")}`);
    else console.error(`[frontend-rebuild] deploy hook responded ${res.status}`);
  } catch (err) {
    console.error(`[frontend-rebuild] deploy hook call failed: ${err.message}`);
  }
}

function scheduleFrontendRebuild(reason = "blog change") {
  const url = process.env.RENDER_FRONTEND_DEPLOY_HOOK;
  if (!url) return;
  pendingReasons.push(reason);
  if (timer) return; // already scheduled; this change is covered by the pending rebuild
  timer = setTimeout(() => {
    const reasons = pendingReasons;
    timer = null;
    pendingReasons = [];
    callHook(url, reasons);
  }, DEBOUNCE_MS);
  timer.unref?.(); // never keep the process alive just for this
  console.log(`[frontend-rebuild] rebuild scheduled in ${DEBOUNCE_MS / 1000}s (${reason})`);
}

module.exports = { scheduleFrontendRebuild };
