// How long the call pages wait for getUserMedia before carrying on without
// local media (receive-only) so a hung permission prompt / busy device can't
// stop the call from connecting. Real call logic — not debug-only.
export const MEDIA_ACQUIRE_TIMEOUT_MS = 8000;

// Resolves true if `promise` is still pending after `ms`, false as soon as it
// settles (fulfilled OR rejected — the caller awaits it itself for the
// outcome). Never rejects and never cancels `promise`, so a stream that
// arrives late can still be attached.
export function mediaAcquireTimedOut(promise, ms = MEDIA_ACQUIRE_TIMEOUT_MS) {
  let timer;
  return Promise.race([
    Promise.resolve(promise).then(
      () => false,
      () => false,
    ),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(true), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}
