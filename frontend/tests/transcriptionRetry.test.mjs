// Backoff, token refresh, notice sender and transcript uploader. Run: node --test tests/transcriptionRetry.test.mjs (from frontend/)
import test from "node:test";
import assert from "node:assert/strict";
import { backoffDelay, statusOf, retryAfterMs } from "../src/features/translation/backoff.js";
import { createTokenManager, REFRESH_BEFORE_MS } from "../src/features/translation/tokenManager.js";
import { createNoticeSender } from "../src/features/translation/noticeSender.js";
import { createTranscriptUploader, MAX_BATCH, MAX_QUEUE } from "../src/features/translation/transcriptUploader.js";
import { createClock, settle, httpError, networkError } from "./helpers/fakeClock.mjs";

const noJitter = () => 0.5; // random() = 0.5 -> exactly the middle of the +-jitter range

// ---------------------------------------------------------------------------------------------------------------- backoff
test("backoff doubles from about a second up to a ceiling, with jitter inside +-20 %", () => {
  const d = (n) => backoffDelay(n, { random: noJitter });
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(d), [1000, 2000, 4000, 8000, 16000, 32000, 60000, 60000]);
  for (let i = 0; i < 200; i++) { const v = backoffDelay(3); assert.ok(v >= 6400 && v <= 9600, String(v)); }
  assert.equal(backoffDelay(-5, { random: noJitter }), 1000);
  assert.equal(backoffDelay(NaN, { random: noJitter }), 1000);
  assert.equal(backoffDelay(500, { random: noJitter }), 60000, "huge attempt numbers cannot overflow");
});

test("statusOf and retryAfterMs read axios-style errors", () => {
  assert.equal(statusOf(httpError(503)), 503);
  assert.equal(statusOf(networkError()), 0);
  assert.equal(statusOf(null), 0);
  assert.equal(retryAfterMs(httpError(429, {}, { "retry-after": "7" })), 7000);
  assert.equal(retryAfterMs(httpError(429, {}, { "Retry-After": "2" })), 2000);
  assert.equal(retryAfterMs(httpError(429, {}, { "retry-after": "99999" })), 600000, "capped at 10 minutes");
  for (const h of [undefined, {}, { "retry-after": "abc" }, { "retry-after": "-3" }]) assert.equal(retryAfterMs(httpError(429, {}, h)), null);
});

// ---------------------------------------------------------------------------------------------------------------- tokens
function tokenSetup(over = {}) {
  const clock = createClock();
  const calls = { fetch: 0, tokens: [], permanent: [] };
  const answers = over.answers || [];
  const fetchToken = async () => {
    calls.fetch += 1;
    const a = answers.length ? answers.shift() : { token: "tok-" + calls.fetch, region: "eastus", expiresInSeconds: 600 };
    if (a instanceof Error) throw a;
    return a;
  };
  const mgr = createTokenManager({ fetchToken, onToken: (t) => calls.tokens.push(t.token), onPermanentFailure: (x) => calls.permanent.push(x.status), now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer, random: noJitter });
  return { clock, calls, mgr };
}

test("a token is fetched once, shared, and refreshed 60 seconds BEFORE it runs out (not on a fixed 9 minute timer)", async () => {
  const { clock, calls, mgr } = tokenSetup({ answers: [{ token: "A", region: "eastus", expiresInSeconds: 600 }, { token: "B", region: "eastus", expiresInSeconds: 360 }, { token: "C", region: "eastus", expiresInSeconds: 600 }] });
  assert.equal((await mgr.getToken()).token, "A");
  assert.equal((await mgr.getToken()).token, "A");
  assert.equal(calls.fetch, 1, "asked once, then shared");
  await clock.advance(600 * 1000 - REFRESH_BEFORE_MS - 1000);
  assert.equal(calls.fetch, 1, "not refreshed early");
  await clock.advance(1500);
  assert.equal(calls.fetch, 2, "refreshed about a minute before expiry");
  assert.deepEqual(calls.tokens, ["A", "B"]);
  await clock.advance(360 * 1000 - REFRESH_BEFORE_MS + 500);
  assert.equal(calls.fetch, 3, "a token with only 6 minutes left is refreshed after 5, following expiresInSeconds");
  mgr.stop();
});

test("simultaneous callers cause one request", async () => {
  const { calls, mgr } = tokenSetup();
  const all = await Promise.all([mgr.getToken(), mgr.getToken(), mgr.getToken(), mgr.getToken()]);
  assert.equal(calls.fetch, 1);
  assert.ok(all.every((t) => t.token === "tok-1"));
  mgr.stop();
});

test("a failed refresh is retried with backoff and the call keeps its good token meanwhile", async () => {
  const { clock, calls, mgr } = tokenSetup({ answers: [{ token: "A", region: "eastus", expiresInSeconds: 120 }, networkError(), httpError(503), { token: "B", region: "eastus", expiresInSeconds: 600 }] });
  await mgr.getToken();
  await clock.advance(120 * 1000 - REFRESH_BEFORE_MS + 100); // refresh time: fails
  assert.equal(calls.fetch, 2);
  assert.equal((await mgr.getToken()).token, "A", "the old token is still good");
  await clock.advance(1000);
  assert.equal(calls.fetch, 3, "retried after about 1 second");
  await clock.advance(2000);
  assert.equal(calls.fetch, 4, "then after about 2 seconds");
  assert.deepEqual(calls.tokens, ["A", "B"]);
  mgr.stop();
});

test("permanent refusals stop the retrying: 403, 404, and the per-appointment cap", async () => {
  for (const [error, status] of [[httpError(403), 403], [httpError(404), 404], [httpError(429, { code: "appointment_cap" }), 429]]) {
    const { clock, calls, mgr } = tokenSetup({ answers: [error] });
    await assert.rejects(mgr.getToken());
    assert.deepEqual(calls.permanent, [status]);
    assert.equal(mgr.isPermanentlyFailed(), true);
    await clock.advance(10 * 60 * 1000);
    assert.equal(calls.fetch, 1, "no further attempts");
    assert.equal(clock.pending(), 0);
  }
  const { clock, calls, mgr } = tokenSetup({ answers: [httpError(429, {}, { "retry-after": "20" }), { token: "Z", region: "eastus", expiresInSeconds: 600 }] });
  await assert.rejects(mgr.getToken());
  assert.equal(mgr.isPermanentlyFailed(), false, "an ordinary 429 is not permanent");
  await clock.advance(19000);
  assert.equal(calls.fetch, 1);
  await clock.advance(1500);
  assert.equal(calls.fetch, 2, "waited the 20 seconds the server asked for");
  mgr.stop();
});

test("a nonsense answer is treated as a failure, never as a token", async () => {
  for (const bad of [{}, { token: "", expiresInSeconds: 600 }, { token: "x", expiresInSeconds: 0 }, { token: "x", expiresInSeconds: "soon" }, null]) {
    const { mgr } = tokenSetup({ answers: [bad] });
    await assert.rejects(mgr.getToken());
    assert.equal(mgr.peek(), null);
    mgr.stop();
  }
});

test("after stop() nothing is fetched or scheduled", async () => {
  const { clock, calls, mgr } = tokenSetup();
  await mgr.getToken();
  mgr.stop();
  await clock.advance(20 * 60 * 1000);
  assert.equal(calls.fetch, 1);
  await assert.rejects(mgr.refresh());
});

// ---------------------------------------------------------------------------------------------------------------- notice
function noticeSetup(results) {
  const clock = createClock(Date.parse("2026-11-12T10:00:00Z"));
  const bodies = [];
  const events = { recorded: [], stopped: [] };
  const queue = [...results];
  const sender = createNoticeSender({
    version: "v1",
    post: async (body) => { bodies.push(body); const r = queue.shift(); if (r instanceof Error) throw r; return { data: r || { recorded: true } }; },
    now: clock.nowDate, setTimer: clock.setTimer, clearTimer: clock.clearTimer, random: noJitter,
    onRecorded: (d) => events.recorded.push(d), onStopped: (x) => events.stopped.push(x.status),
  });
  return { clock, bodies, events, sender };
}

test("the notice is sent at once, with the version and when it was shown (the browser's own claim)", async () => {
  const { bodies, events, sender } = noticeSetup([{ recorded: true, bothShown: false }]);
  sender.start();
  await settle();
  assert.deepEqual(bodies, [{ version: "v1", clientShownAt: "2026-11-12T10:00:00.000Z" }]);
  assert.equal(sender.state(), "done");
  assert.deepEqual(events.recorded, [{ recorded: true, bothShown: false }]);
});

test("a network blip or a server error is retried with backoff until it works, and the claimed time stays the ORIGINAL time", async () => {
  const { clock, bodies, events, sender } = noticeSetup([networkError(), httpError(503), httpError(500), { recorded: true }]);
  sender.start();
  await settle();
  assert.equal(bodies.length, 1);
  await clock.advance(1000); assert.equal(bodies.length, 2);
  await clock.advance(2000); assert.equal(bodies.length, 3);
  await clock.advance(4000); assert.equal(bodies.length, 4);
  assert.equal(sender.state(), "done");
  assert.equal(events.recorded.length, 1);
  assert.ok(bodies.every((b) => b.clientShownAt === "2026-11-12T10:00:00.000Z"), "every retry reports when the notice first appeared");
  await clock.advance(10 * 60 * 1000);
  assert.equal(bodies.length, 4, "no more calls once recorded");
});

test("it keeps trying for as long as the page is open, never giving up on a flaky network", async () => {
  const { clock, bodies, sender } = noticeSetup(Array.from({ length: 30 }, () => networkError()));
  sender.start();
  await settle();
  for (let i = 0; i < 12; i++) await clock.advance(61000);
  assert.ok(bodies.length >= 13, "still trying: " + bodies.length);
  assert.equal(sender.state(), "sending");
  sender.stop();
  const n = bodies.length;
  await clock.advance(5 * 60 * 1000);
  assert.equal(bodies.length, n, "stop() ends it");
});

test("permanent answers stop it: 403, 404 (feature off), 400, 401", async () => {
  for (const status of [403, 404, 400, 401]) {
    const { clock, bodies, events, sender } = noticeSetup([httpError(status)]);
    sender.start();
    await settle();
    assert.equal(sender.state(), "stopped", String(status));
    assert.deepEqual(events.stopped, [status]);
    await clock.advance(10 * 60 * 1000);
    assert.equal(bodies.length, 1, "no retries after " + status);
  }
});

test("429 obeys Retry-After; starting twice sends once", async () => {
  const { clock, bodies, sender } = noticeSetup([httpError(429, {}, { "retry-after": "9" }), { recorded: true }]);
  sender.start(); sender.start();
  await settle();
  assert.equal(bodies.length, 1);
  await clock.advance(8000); assert.equal(bodies.length, 1);
  await clock.advance(1500); assert.equal(bodies.length, 2);
});

// ---------------------------------------------------------------------------------------------------------------- uploader
function uploaderSetup(script = []) {
  const clock = createClock();
  const sent = []; // each call: the items
  const finals = [];
  const steps = [...script];
  let n = 0;
  const up = createTranscriptUploader({
    post: async (items, { final }) => {
      sent.push(items); finals.push(final);
      const step = steps.length ? steps.shift() : "ok";
      if (step instanceof Error) throw step;
      if (typeof step === "function") return step(items);
      return { data: { accepted: items.length, duplicates: 0, rejected: [] } };
    },
    nowPerf: clock.perf, setTimer: clock.setTimer, clearTimer: clock.clearTimer, random: noJitter, makeId: () => "row-" + String(++n).padStart(6, "0"),
    onStopped: () => {},
  });
  return { clock, sent, finals, up };
}
const addLines = (up, count, extra = {}) => { for (let i = 0; i < count; i++) up.addLine({ original: "line " + i, translations: { en: "en " + i }, sourceLang: "de-DE", languageSource: "auto", confidence: 0.9, flags: {}, ...extra }); };

test("rows go out after a short wait, in order, with their age measured by the browser's own stopwatch", async () => {
  const { clock, sent, up } = uploaderSetup();
  addLines(up, 2);
  await clock.advance(1000);
  await clock.advance(1000); // the 2 s flush timer fires
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].map((i) => i.original), ["line 0", "line 1"]);
  assert.deepEqual(sent[0].map((i) => i.clientId), ["row-000001", "row-000002"]);
  assert.ok(sent[0].every((i) => i.type === "line" && i.ageMs >= 2000 && i.ageMs <= 2100), JSON.stringify(sent[0].map((i) => i.ageMs)));
  assert.equal(up.pending(), 0);
});

test("a gap row carries its reason, its length and the age of its START", async () => {
  const { clock, sent, up } = uploaderSetup();
  const startedPerf = clock.perf();
  await clock.advance(5000);
  up.addGap({ reason: "muted", startedPerf, durationMs: 5000.4 });
  await clock.advance(2000);
  assert.deepEqual(sent[0][0], { type: "gap", clientId: "row-000001", reason: "muted", durationMs: 5000, ageMs: 7000 });
});

test("never more than 25 rows in one request; the rest follow straight after", async () => {
  const { clock, sent, up } = uploaderSetup();
  addLines(up, 60);
  await clock.advance(2000);
  assert.deepEqual(sent.map((b) => b.length), [25, 25, 10]);
  assert.equal(MAX_BATCH, 25);
  assert.equal(up.pending(), 0);
});

test("413 halves the batch and retries at once, down to a single row, and the size recovers afterwards", async () => {
  const { clock, sent, up } = uploaderSetup([httpError(413), httpError(413), httpError(413)]);
  addLines(up, 25);
  await clock.advance(2000);
  assert.deepEqual(sent.slice(0, 4).map((b) => b.length), [25, 12, 6, 3], "25 -> 12 -> 6 -> 3");
  assert.equal(up.pending(), 0);
  assert.ok(up.batchSize() > 3, "batch size grows back after successes: " + up.batchSize());

  const one = uploaderSetup(Array.from({ length: 12 }, () => httpError(413)));
  addLines(one.up, 2);
  await one.clock.advance(2000);
  assert.ok(one.sent.some((b) => b.length === 1), "goes down to one row");
});

test("network trouble and 5xx: the same rows are sent again with backoff, nothing is lost, the ids stay the same", async () => {
  const { clock, sent, up } = uploaderSetup([networkError(), httpError(502), httpError(503)]);
  addLines(up, 3);
  await clock.advance(2000);
  assert.equal(sent.length, 1);
  await clock.advance(1000); assert.equal(sent.length, 2);
  await clock.advance(2000); assert.equal(sent.length, 3);
  await clock.advance(4000); assert.equal(sent.length, 4);
  assert.equal(up.pending(), 0);
  const ids = sent.map((b) => b.map((i) => i.clientId).join());
  assert.equal(new Set(ids).size, 1, "every retry sends the very same rows with the very same ids");
  assert.equal(up.stats().accepted, 3);
});

test("rows keep being retried for as long as the page is open", async () => {
  const { clock, sent, up } = uploaderSetup(Array.from({ length: 40 }, () => networkError()));
  addLines(up, 2);
  await clock.advance(2000);
  for (let i = 0; i < 15; i++) await clock.advance(61000);
  assert.ok(sent.length >= 15);
  assert.equal(up.pending(), 2, "still held, nothing dropped");
});

test("401 and 429 are retried (429 after the time the server asked for)", async () => {
  const { clock, sent, up } = uploaderSetup([httpError(401), httpError(429, {}, { "retry-after": "12" })]);
  addLines(up, 1);
  await clock.advance(2000);
  await clock.advance(1100); assert.equal(sent.length, 2);
  await clock.advance(11000); assert.equal(sent.length, 2);
  await clock.advance(1500); assert.equal(sent.length, 3);
  assert.equal(up.pending(), 0);
});

test("403 / 404 stop the uploading: rows are kept, nothing is sent again, the app is told", async () => {
  for (const status of [403, 404]) {
    const stopped = [];
    const clock = createClock();
    let calls = 0;
    const up = createTranscriptUploader({ post: async () => { calls++; throw httpError(status); }, nowPerf: clock.perf, setTimer: clock.setTimer, clearTimer: clock.clearTimer, onStopped: (x) => stopped.push(x.status) });
    addLines(up, 3);
    await clock.advance(2000);
    await clock.advance(10 * 60 * 1000);
    assert.equal(calls, 1);
    assert.deepEqual(stopped, [status]);
    assert.equal(up.pending(), 3);
    assert.equal(up.stoppedReason(), `status_${status}`);
  }
});

test("rows the server refuses one by one are dropped and counted, the good ones are kept", async () => {
  const { clock, up } = uploaderSetup([() => ({ data: { accepted: 1, duplicates: 1, rejected: [{ index: 0, clientId: "row-000001", reason: "empty_text" }] } })]);
  addLines(up, 3);
  await clock.advance(2000);
  const s = up.stats();
  assert.deepEqual([s.accepted, s.duplicates, s.rejected], [1, 1, 1]);
  assert.deepEqual(s.rejectedReasons, { empty_text: 1 });
  assert.equal(up.pending(), 0);
});

test("a 400 drops only that batch (it can never succeed) so it cannot block everything behind it", async () => {
  const { clock, sent, up } = uploaderSetup([httpError(400)]);
  addLines(up, 25);
  addLines(up, 5);
  await clock.advance(2000);
  assert.equal(up.stats().rejectedReasons.bad_batch, 25);
  assert.equal(sent.length >= 2, true);
  assert.equal(up.pending(), 0);
});

test("flush() on leave sends everything left right away, marked final", async () => {
  const { clock, sent, finals, up } = uploaderSetup();
  addLines(up, 30);
  const out = await up.flush();
  assert.deepEqual(sent.map((b) => b.length), [25, 5]);
  assert.deepEqual(finals, [true, true]);
  assert.deepEqual(out, { remaining: 0, stopped: null });
  assert.equal(clock.pending(), 0, "no timer left behind");
});

test("flush() while the network is down does not hang: it returns what is left", async () => {
  const { up } = uploaderSetup(Array.from({ length: 5 }, () => networkError()));
  addLines(up, 4);
  const out = await up.flush();
  assert.equal(out.remaining, 4);
});

test("close() ends everything: no timers, no sends, new rows are ignored", async () => {
  const { clock, sent, up } = uploaderSetup();
  addLines(up, 2);
  up.close();
  addLines(up, 2);
  await clock.advance(60000);
  assert.equal(sent.length, 0);
  assert.equal(clock.pending(), 0);
});

test("the queue is bounded: the oldest rows are dropped (and counted) rather than growing without end", async () => {
  const clock = createClock();
  const up = createTranscriptUploader({ post: async () => { throw networkError(); }, nowPerf: clock.perf, setTimer: clock.setTimer, clearTimer: clock.clearTimer });
  addLines(up, MAX_QUEUE + 10);
  assert.equal(up.pending(), MAX_QUEUE);
  assert.equal(up.stats().overflowDropped, 10);
  up.close();
});

test("static: the uploader never touches browser storage or logs", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "src", "features", "translation");
  for (const file of ["transcriptUploader.js", "noticeSender.js", "tokenManager.js", "backoff.js"]) {
    // code only: comments are allowed to mention the words
    const src = fs.readFileSync(path.join(root, file), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    assert.equal(/localStorage|sessionStorage|indexedDB|document\.cookie/.test(src), false, file + " must not store anything in the browser");
    assert.equal(/\bconsole\s*\./.test(src), false, file + " must not log");
  }
});
