// Sends this person's own transcript rows (lines and gaps) to the server: POST /api/appointments/:id/transcript.
//
// The transcript is our proof, so the rules are all about NOT losing rows:
//   • rows wait in memory and go out in batches of at most 25 (the server's limit), every couple of seconds;
//   • every row has a clientId, so sending it again after a failure is harmless (the server stores it once);
//   • network trouble, 5xx, 401 and 429 are retried for as long as the page is open, with exponential backoff (and Retry-After);
//   • 413 (body too big) halves the batch and retries at once, down to one row;
//   • a row the server refuses one by one (`rejected`) can never succeed, so only those are dropped, and counted;
//   • 403 / 404 (not allowed, feature off, unknown booking) stop the uploading: rows are kept, nothing is hammered;
//   • flush() is called when the person leaves, and sends everything that is left;
//   • the age of a row (ageMs) is measured by this browser's own stopwatch at the moment of sending, so a wrong clock cannot move a row.
// Nothing here writes to a log, and rows are never stored in the browser (no localStorage): the words only live in memory.
import { backoffDelay, statusOf, retryAfterMs } from "./backoff.js";

export const MAX_BATCH = 25;
export const FLUSH_INTERVAL_MS = 2000;
export const MAX_QUEUE = 5000;
const STOP_STATUSES = new Set([403, 404]);

export function createTranscriptUploader({
  post, // async (items, { final }) => response with .data = { accepted, duplicates, rejected: [{ index, clientId, reason }] }
  nowPerf = () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
  random = Math.random,
  makeId = defaultId,
  flushIntervalMs = FLUSH_INTERVAL_MS,
  onStopped = () => {},
} = {}) {
  const queue = []; // { clientId, kind, fields, createdPerf }
  let timer = null;
  let sending = false;
  let batchSize = MAX_BATCH;
  let failures = 0;
  let stopped = null; // reason once uploading is stopped by a permanent answer
  let closed = false;
  const stats = { added: 0, accepted: 0, duplicates: 0, rejected: 0, rejectedReasons: {}, overflowDropped: 0, failedAttempts: 0 };

  function enqueue(row) {
    if (closed) return null;
    queue.push(row);
    stats.added += 1;
    if (queue.length > MAX_QUEUE) { queue.shift(); stats.overflowDropped += 1; }
    schedule(flushIntervalMs);
    return row.clientId;
  }

  function schedule(delayMs) {
    if (closed || stopped || timer !== null || queue.length === 0) return;
    timer = setTimer(() => { timer = null; drain().catch(() => {}); }, delayMs);
  }

  function toItem(row) {
    if (row.kind === "gap") return { type: "gap", clientId: row.clientId, reason: row.fields.reason, durationMs: row.fields.durationMs, ageMs: Math.max(0, Math.round(nowPerf() - (row.fields.startedPerf ?? row.createdPerf))) };
    return { type: "line", clientId: row.clientId, ...row.fields, ageMs: Math.max(0, Math.round(nowPerf() - row.createdPerf)) };
  }

  // Sends one batch from the front of the queue. Returns true if it went through (or was settled for good), false if it must be retried.
  async function sendOne(final) {
    const batch = queue.slice(0, batchSize);
    let res;
    try {
      res = await post(batch.map(toItem), { final: Boolean(final) });
    } catch (error) {
      stats.failedAttempts += 1;
      const status = statusOf(error);
      if (status === 413 && batchSize > 1) { batchSize = Math.max(1, Math.floor(batchSize / 2)); return "retry-now"; }
      if (STOP_STATUSES.has(status)) { stopped = `status_${status}`; onStopped({ status }); return "stopped"; }
      if (status === 400) {
        // The server will never accept this exact batch. Drop only these rows (counted), so one bad batch cannot block everything.
        queue.splice(0, batch.length);
        stats.rejected += batch.length;
        stats.rejectedReasons.bad_batch = (stats.rejectedReasons.bad_batch || 0) + batch.length;
        return "ok";
      }
      return { backoff: retryAfterMs(error) ?? backoffDelay(failures, { random }) };
    }
    const data = (res && res.data) || {};
    const rejected = Array.isArray(data.rejected) ? data.rejected : [];
    for (const r of rejected) {
      stats.rejected += 1;
      const why = typeof r.reason === "string" ? r.reason.slice(0, 40) : "unknown";
      stats.rejectedReasons[why] = (stats.rejectedReasons[why] || 0) + 1;
    }
    stats.accepted += Number(data.accepted) || 0;
    stats.duplicates += Number(data.duplicates) || 0;
    queue.splice(0, batch.length);
    failures = 0;
    if (batchSize < MAX_BATCH) batchSize = Math.min(MAX_BATCH, batchSize * 2);
    return "ok";
  }

  async function drain(final = false) {
    if (sending || stopped) return;
    sending = true;
    try {
      while (queue.length > 0 && !stopped) {
        const outcome = await sendOne(final);
        if (outcome === "ok" || outcome === "retry-now") continue;
        if (outcome === "stopped") return;
        failures += 1;
        if (final) return; // leaving: no time to wait, whatever is left stays unsent
        timer = setTimer(() => { timer = null; drain().catch(() => {}); }, outcome.backoff);
        return;
      }
    } finally {
      sending = false;
      if (queue.length > 0 && timer === null && !stopped && !closed) schedule(flushIntervalMs);
    }
  }

  return {
    addLine({ original, translations, sourceLang, languageSource, confidence, flags }) {
      return enqueue({ clientId: makeId(), kind: "line", createdPerf: nowPerf(), fields: { original, translations, sourceLang, languageSource, confidence, flags } });
    },
    // startedPerf: the stopwatch reading when the gap began.
    addGap({ reason, startedPerf, durationMs }) {
      return enqueue({ clientId: makeId(), kind: "gap", createdPerf: nowPerf(), fields: { reason, startedPerf, durationMs: Math.max(0, Math.round(durationMs || 0)) } });
    },
    // Called when the person leaves the call: tries to send everything that is left, once.
    async flush() {
      clearTimer(timer);
      timer = null;
      await drain(true);
      return { remaining: queue.length, stopped };
    },
    // Stops for good (the page is closing); whatever is left stays unsent.
    close() { closed = true; clearTimer(timer); timer = null; },
    pending: () => queue.length,
    stoppedReason: () => stopped,
    batchSize: () => batchSize,
    stats: () => ({ ...stats, rejectedReasons: { ...stats.rejectedReasons }, queued: queue.length, batchSize, stopped }),
  };
}

let counter = 0;
function defaultId() {
  counter += 1;
  const rand = typeof crypto !== "undefined" && crypto.getRandomValues ? Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join("") : Math.random().toString(16).slice(2, 14);
  return `r${Date.now().toString(36)}-${counter.toString(36)}-${rand}`.slice(0, 64);
}
