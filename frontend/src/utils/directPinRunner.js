// Drives one PIN verification / takeover request on the direct-call page so a
// transient failure never leaves the form stuck on "Verifying..." or throws
// the user's PIN away:
//   - no answer within responseTimeoutMs (socket down, server busy)  -> retry
//   - the server answered code:"server_error" (DB hiccup)            -> retry
//   - retries use backoff, then onGiveUp() hands control back to the user
// A wrong PIN / blocked / conflict is a real answer and is never retried.

export const PIN_RETRY_DELAYS_MS = [1000, 2000, 4000];
export const PIN_RESPONSE_TIMEOUT_MS = 12000;

export function createPinActionRunner({
  emit,
  onGiveUp,
  delaysMs = PIN_RETRY_DELAYS_MS,
  responseTimeoutMs = PIN_RESPONSE_TIMEOUT_MS,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let action = null;
  let attempt = 0;
  let timer = null;

  const clear = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };

  const send = () => {
    if (!action) return;
    emit(action);
    clear();
    timer = setTimer(() => {
      timer = null;
      retryOrGiveUp();
    }, responseTimeoutMs);
  };

  function retryOrGiveUp() {
    if (!action) return false;
    if (attempt >= delaysMs.length) {
      action = null;
      attempt = 0;
      clear();
      onGiveUp();
      return false;
    }
    const delay = delaysMs[attempt];
    attempt += 1;
    clear();
    timer = setTimer(() => {
      timer = null;
      send();
    }, delay);
    return true;
  }

  return {
    start(nextAction) {
      clear();
      action = nextAction;
      attempt = 0;
      send();
    },
    // The server answered "server_error": true if a retry is now scheduled
    // (keep the spinner), false if retries are exhausted (onGiveUp ran).
    serverError() {
      return retryOrGiveUp();
    },
    // Any definitive answer (ok / wrong PIN / conflict / blocked).
    done() {
      clear();
      action = null;
      attempt = 0;
    },
    get active() {
      return action !== null;
    },
  };
}
