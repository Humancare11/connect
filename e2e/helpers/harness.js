// Shared test harness: two isolated browser contexts (doctor + patient),
// console-log capture to test-results/<test>-<role>.log, RTCPeerConnection
// tracking, and the "is remote video really flowing?" helpers.
//
// Nothing here touches app code. The peer connections are observed by an init
// script that subclasses window.RTCPeerConnection inside the TEST browser only.
import fs from "node:fs";
import path from "node:path";
import { test as base, expect } from "@playwright/test";
import { DOCTOR_STATE, PATIENT_STATE } from "../global-setup.js";

export { expect };

const RESULTS_DIR = path.resolve("test-results");

// ── RTCPeerConnection tracking ──────────────────────────────────────────────
const TRACK_PCS = () => {
  if (window.__e2e) return;
  const Orig = window.RTCPeerConnection;
  window.__e2e = { pcs: [], Orig };
  window.RTCPeerConnection = class extends Orig {
    constructor(...args) {
      super(...args);
      window.__e2e.pcs.push(this);
    }
  };
};

// ── MediaStreamTrack tracking ────────────────────────────────────────────────
// Records every track this page ever gets from getUserMedia() or .clone()s
// (e.g. an always-enabled clone kept for local level metering — see
// DirectVideoCall.jsx's setupMutedReminderMeter) — used to assert "no live
// track left anywhere on the page" after a call ends, which pc.getSenders()
// alone can't see for a clone that was never attached to the peer connection.
// Registered before any test-side getUserMedia override so composition still
// works: overrideGetUserMedia() captures "real" AFTER this init script has
// already replaced it, so its wrapper still funnels through here first.
const TRACK_MEDIA_TRACKS = () => {
  if (window.__e2eTracks) return;
  window.__e2eTracks = [];
  const origClone = MediaStreamTrack.prototype.clone;
  MediaStreamTrack.prototype.clone = function (...args) {
    const cloned = origClone.apply(this, args);
    window.__e2eTracks.push(cloned);
    return cloned;
  };
  const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (...args) => {
    const stream = await origGetUserMedia(...args);
    stream.getTracks().forEach((t) => window.__e2eTracks.push(t));
    return stream;
  };
};

// ── Console capture ─────────────────────────────────────────────────────────
function captureLogs(page) {
  const pending = [];
  const lines = [];
  const started = Date.now();
  const stamp = () => `+${((Date.now() - started) / 1000).toFixed(1)}s`;

  page.on("console", (msg) => {
    const at = stamp();
    pending.push(
      (async () => {
        const parts = [];
        for (const arg of msg.args()) {
          try {
            const v = await arg.jsonValue();
            parts.push(typeof v === "string" ? v : JSON.stringify(v));
          } catch {
            parts.push(String(arg));
          }
        }
        lines.push(`${at} [${msg.type()}] ${parts.join(" ") || msg.text()}`);
      })(),
    );
  });
  page.on("pageerror", (err) => lines.push(`${stamp()} [pageerror] ${err.message}`));

  return {
    async flush() {
      await Promise.allSettled(pending.splice(0));
    },
    async text() {
      await this.flush();
      return lines.join("\n");
    },
    async count(re) {
      await this.flush();
      return lines.filter((l) => re.test(l)).length;
    },
    async has(re) {
      return (await this.count(re)) > 0;
    },
  };
}

// ── Peer connection / video stats helpers ───────────────────────────────────
// Real (un-faked) view of the newest open pc's inbound media. Raced against a
// timeout: page.evaluate() has no timeout of its own, and on this machine a
// CDP round-trip has occasionally stalled indefinitely (observed independent
// of any particular app behaviour) — without this, one bad sample could hang
// every caller's own retry loop for the rest of the test budget.
export async function readInbound(page) {
  const evalPromise = page.evaluate(async () => {
    const pcs = (window.__e2e && window.__e2e.pcs) || [];
    let idx = -1;
    for (let i = pcs.length - 1; i >= 0; i--) {
      if (pcs[i].signalingState !== "closed") {
        idx = i;
        break;
      }
    }
    if (idx < 0) return { pcIndex: -1, pcCount: pcs.length };
    const pc = pcs[idx];
    // window.RTCPeerConnection is our tracking subclass, so read the state
    // through the ORIGINAL prototype's getter (unaffected by simulateStall).
    const realState = Object.getOwnPropertyDescriptor(
      window.__e2e.Orig.prototype,
      "connectionState",
    ).get.call(pc);
    let video = null;
    let audio = null;
    try {
      const report = await pc.getStats();
      report.forEach((s) => {
        if (s.type !== "inbound-rtp" || s.isRemote) return;
        const kind = s.kind || s.mediaType;
        if (kind === "video") {
          video = { frames: s.framesDecoded || 0, bytes: s.bytesReceived || 0 };
        } else if (kind === "audio") {
          audio = { bytes: s.bytesReceived || 0 };
        }
      });
    } catch {
      /* pc closed mid-read */
    }
    // Negotiated direction of each m-section, e.g. "video:recvonly" — makes a
    // "connected but nothing arrives" failure self-explanatory.
    const dirs = (desc) =>
      desc && desc.sdp
        ? desc.sdp
            .split(/\r?\nm=/)
            .slice(1)
            .map((sec) => {
              const kind = sec.split(" ")[0];
              const m = sec.match(/a=(sendrecv|sendonly|recvonly|inactive)/);
              return `${kind}:${m ? m[1] : "?"}`;
            })
        : null;
    return {
      pcIndex: idx,
      pcCount: pcs.length,
      state: realState,
      video,
      audio,
      localSdp: dirs(pc.localDescription),
      remoteSdp: dirs(pc.remoteDescription),
    };
  });
  let timer;
  const timedOut = Symbol("readInbound-timeout");
  const result = await Promise.race([
    evalPromise,
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(timedOut), 8_000);
    }),
  ]);
  clearTimeout(timer);
  if (result === timedOut) {
    return { pcIndex: -3, pcCount: -1, state: "evaluate_timed_out" };
  }
  return result;
}

// Waits until inbound video FRAMES are increasing on the current pc (which
// must be really connected). Frames are counted from the first sample seen on
// each pc, so a rebuilt pc (frames restart at 0) is handled.
export async function waitForVideoFlowing(page, { timeoutMs = 15_000, minFrames = 10, label = "" } = {}) {
  const baselines = new Map();
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await readInbound(page);
    if (last.pcIndex >= 0 && last.video) {
      if (!baselines.has(last.pcIndex)) baselines.set(last.pcIndex, last.video.frames);
      const gained = last.video.frames - baselines.get(last.pcIndex);
      if (last.state === "connected" && gained >= minFrames) return last;
    }
    await page.waitForTimeout(500);
  }
  throw new Error(
    `${label} inbound video did not flow within ${timeoutMs}ms (last sample: ${JSON.stringify(last)})`,
  );
}

// After a recovery, BOTH descriptions of a party's current pc must have audio
// and video negotiated sendrecv — a receive-only side shows up as a silent,
// one-way call even though the pc reads "connected".
export function assertNegotiatedSendrecv(sample, label) {
  const want = ["audio:sendrecv", "video:sendrecv"];
  for (const key of ["localSdp", "remoteSdp"]) {
    const got = [...(sample[key] || [])].sort();
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      throw new Error(`${label} ${key} is not audio+video sendrecv: ${JSON.stringify(sample[key])}`);
    }
  }
}

// Recovery check for a pair of parties: remote video frames increase on BOTH
// sides AND the negotiated SDP is sendrecv on BOTH sides.
export async function bothRecovered(a, b, timeoutMs, label = "") {
  const [sa, sb] = await Promise.all([
    waitForVideoFlowing(a.page, { timeoutMs, label: `${label} ${a.role}` }),
    waitForVideoFlowing(b.page, { timeoutMs, label: `${label} ${b.role}` }),
  ]);
  assertNegotiatedSendrecv(sa, `${label} ${a.role}`);
  assertNegotiatedSendrecv(sb, `${label} ${b.role}`);
}

// Asserts video keeps flowing for `durationMs`: never goes more than
// `maxStallMs` without the frame counter increasing.
export async function assertFramesFlowing(page, durationMs, { maxStallMs = 6_000, label = "" } = {}) {
  const end = Date.now() + durationMs;
  let lastPc = -2;
  let lastFrames = -1;
  let lastIncrease = Date.now();
  while (Date.now() < end) {
    const s = await readInbound(page);
    const frames = s.video ? s.video.frames : -1;
    if (s.pcIndex !== lastPc) {
      lastPc = s.pcIndex;
      lastFrames = frames;
      lastIncrease = Date.now();
    } else if (frames > lastFrames) {
      lastFrames = frames;
      lastIncrease = Date.now();
    }
    if (Date.now() - lastIncrease > maxStallMs) {
      throw new Error(`${label} video stalled for >${maxStallMs}ms (last sample: ${JSON.stringify(s)})`);
    }
    await page.waitForTimeout(1_000);
  }
}

// Makes the app believe THIS side's pc has dropped, so its real stall
// machinery runs and its real "Retry" button appears (~12s later). We fake the
// pc's state getters and invoke the app's own state-change handlers — the
// same code path a real ICE disconnect takes. Retry then performs a genuine
// teardown/rebuild. (A real OS-level network drop isn't practical here: see
// the README.)
// Raced against a timeout for the same reason as readInbound()'s own evalPromise
// race (see its comment): an unprotected page.evaluate() here has been observed
// to hang the CDP round-trip indefinitely on this machine, independent of app
// behavior — without this, one bad call could eat a caller's entire test budget
// (e.g. waiting on a Retry button that never appears because the stall was
// never actually applied) instead of failing fast with a clear error.
export async function simulateStall(page) {
  const evalPromise = page.evaluate(() => {
    const pcs = window.__e2e.pcs;
    const pc = [...pcs].reverse().find((p) => p.signalingState !== "closed");
    if (!pc) throw new Error("no open RTCPeerConnection to stall");
    for (const key of ["connectionState", "iceConnectionState"]) {
      Object.defineProperty(pc, key, { configurable: true, get: () => "disconnected" });
    }
    if (typeof pc.oniceconnectionstatechange === "function") pc.oniceconnectionstatechange();
    if (typeof pc.onconnectionstatechange === "function") pc.onconnectionstatechange();
  });
  let timer;
  const timedOut = Symbol("simulateStall-timeout");
  const result = await Promise.race([
    evalPromise.then(() => "ok"),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(timedOut), 8_000);
    }),
  ]);
  clearTimeout(timer);
  if (result === timedOut) {
    throw new Error("simulateStall: page.evaluate did not respond within 8000ms (CDP stall)");
  }
}

export function retryButton(page) {
  return page.locator(".hc-vc__reconnect-stalled-notice button.hc-vc__rx-btn-primary");
}

export async function waitForRetryButton(page, timeout = 40_000) {
  const btn = retryButton(page);
  await btn.waitFor({ state: "visible", timeout });
  return btn;
}

// Every getUserMedia track AND every .clone() of one (see TRACK_MEDIA_TRACKS)
// that's still readyState "live" — used to assert a call left nothing
// running: a leaked clone (e.g. a level-metering track never attached to the
// peer connection) wouldn't show up in pc.getSenders() but does show up here,
// and a real leak keeps the browser's mic/camera-in-use indicator lit.
export async function liveMediaTracks(page) {
  return page.evaluate(() => {
    const tracks = window.__e2eTracks || [];
    return tracks
      .filter((t) => t.readyState === "live")
      .map((t) => ({ kind: t.kind, id: t.id, label: t.label }));
  });
}

export { newParty, overrideGetUserMedia, setGumMode, jsHeapUsed };

// ── Fixture: a doctor + a patient, each in its own context ─────────────────
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function newParty(browser, role, storageState, baseURL, contextOptions = {}) {
  const context = await browser.newContext({
    baseURL,
    ...(storageState ? { storageState } : {}),
    permissions: ["camera", "microphone"],
    ...contextOptions,
  });
  await context.addInitScript(TRACK_PCS);
  await context.addInitScript(TRACK_MEDIA_TRACKS);
  const page = await context.newPage();
  const logs = captureLogs(page);

  // context.close() has been observed to hang indefinitely on this machine
  // — the same class of CDP round-trip stall documented on readInbound()/
  // simulateStall() above, just on the teardown call this time. Previously
  // this could eat a whole test's remaining budget from inside its own
  // `finally` block (every test in this suite calls .context.close() there).
  // Race it against a timeout so a stuck close can never block the run —
  // there's nothing more a test can do about an unresponsive browser
  // process anyway; Playwright's own process teardown between test files
  // still reaps it.
  const realClose = context.close.bind(context);
  context.close = async (...args) => {
    let timer;
    const timedOut = Symbol("context.close-timeout");
    const result = await Promise.race([
      realClose(...args).then(
        () => "ok",
        () => "ok", // a close-time error isn't actionable either — don't hang on it
      ),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(timedOut), 15_000);
      }),
    ]);
    clearTimeout(timer);
    if (result === timedOut) {
      console.warn(
        `[harness] context.close() for "${role}" did not respond within 15s (CDP stall) — abandoning it rather than blocking the test.`,
      );
    }
  };

  return { role, context, page, logs };
}

// Patches navigator.mediaDevices.getUserMedia on `page` BEFORE it navigates,
// for the permission-denied / slow-prompt scenarios. Must be called right
// after newParty() and before page.goto(). The mode is read from
// window.__e2eGumMode on every call (not baked in once), so a later
// setGumMode() can flip an already-loaded page from deny to allow — e.g. to
// simulate the user granting permission on a Retry click, with no reload.
//   { kind: "deny" }                 -> every call rejects like a real denial
//   { kind: "delay", delayMs, then } -> resolves (or rejects, if
//                                    then === "deny") after delayMs, using
//                                    the real fake device once it does
//   { kind: "allow" }                -> passes straight through (the default)
async function overrideGetUserMedia(page, mode) {
  await page.addInitScript((initialMode) => {
    window.__e2eGumMode = initialMode;
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (constraints) => {
      const m = window.__e2eGumMode || { kind: "allow" };
      if (m.kind === "deny") {
        return Promise.reject(new DOMException("Permission denied (e2e)", "NotAllowedError"));
      }
      if (m.kind === "delay") {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            if (m.then === "deny") {
              reject(new DOMException("Permission denied (e2e)", "NotAllowedError"));
            } else {
              real(constraints).then(resolve, reject);
            }
          }, m.delayMs);
        });
      }
      return real(constraints);
    };
  }, mode);
}

// Flips an already-loaded page's getUserMedia mode (see overrideGetUserMedia)
// without a reload — e.g. simulating the user granting permission on Retry.
async function setGumMode(page, mode) {
  await page.evaluate((m) => {
    window.__e2eGumMode = m;
  }, mode);
}

// Chromium exposes a coarse JS-heap size without any launch flag. Best-effort
// only — not a substitute for a real profiler, but enough to catch a gross
// per-rebuild leak over a long call.
async function jsHeapUsed(page) {
  return page.evaluate(() => (performance).memory?.usedJSHeapSize ?? null);
}

export const test = base.extend({
  // Two isolated logged-in parties (doctor + patient) for the appointment call.
  call: async ({ browser, baseURL }, use, testInfo) => {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    const doctor = await newParty(browser, "doctor", DOCTOR_STATE, baseURL);
    const patient = await newParty(browser, "patient", PATIENT_STATE, baseURL);
    const appointmentId = process.env.TEST_APPOINTMENT_ID;
    const url = `/video-call/${appointmentId}`;

    const api = {
      doctor,
      patient,
      appointmentId,
      async joinBoth({ flowTimeoutMs = 30_000 } = {}) {
        await Promise.all([doctor.page.goto(url), patient.page.goto(url)]);
        await Promise.all([
          waitForVideoFlowing(doctor.page, { timeoutMs: flowTimeoutMs, label: "doctor" }),
          waitForVideoFlowing(patient.page, { timeoutMs: flowTimeoutMs, label: "patient" }),
        ]);
      },
      async bothFlowing(timeoutMs, label = "") {
        await Promise.all([
          waitForVideoFlowing(doctor.page, { timeoutMs, label: `${label} doctor` }),
          waitForVideoFlowing(patient.page, { timeoutMs, label: `${label} patient` }),
        ]);
      },
      // Frames increasing on both sides AND sendrecv negotiated on both.
      async bothRecovered(timeoutMs, label = "") {
        await bothRecovered(doctor, patient, timeoutMs, label);
      },
    };

    try {
      await use(api);
    } finally {
      const base = path.join(RESULTS_DIR, slug(testInfo.title));
      fs.writeFileSync(`${base}-doctor.log`, await doctor.logs.text());
      fs.writeFileSync(`${base}-patient.log`, await patient.logs.text());
      await doctor.context.close();
      await patient.context.close();
    }
  },

  // Two anonymous guests for the direct (link-based) call.
  guests: async ({ browser, baseURL }, use, testInfo) => {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    const roomId = process.env.TEST_DIRECT_ROOM_ID;
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    const api = { host, guest, roomId };
    try {
      await use(api);
    } finally {
      const base = path.join(RESULTS_DIR, slug(testInfo.title));
      fs.writeFileSync(`${base}-host.log`, await host.logs.text());
      fs.writeFileSync(`${base}-guest.log`, await guest.logs.text());
      await host.context.close();
      await guest.context.close();
    }
  },
});
