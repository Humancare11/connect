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
// Real (un-faked) view of the newest open pc's inbound media.
export async function readInbound(page) {
  return page.evaluate(async () => {
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
export async function simulateStall(page) {
  await page.evaluate(() => {
    const pcs = window.__e2e.pcs;
    const pc = [...pcs].reverse().find((p) => p.signalingState !== "closed");
    if (!pc) throw new Error("no open RTCPeerConnection to stall");
    for (const key of ["connectionState", "iceConnectionState"]) {
      Object.defineProperty(pc, key, { configurable: true, get: () => "disconnected" });
    }
    if (typeof pc.oniceconnectionstatechange === "function") pc.oniceconnectionstatechange();
    if (typeof pc.onconnectionstatechange === "function") pc.onconnectionstatechange();
  });
}

export function retryButton(page) {
  return page.locator(".hc-vc__reconnect-stalled-notice button.hc-vc__rx-btn-primary");
}

export async function waitForRetryButton(page, timeout = 40_000) {
  const btn = retryButton(page);
  await btn.waitFor({ state: "visible", timeout });
  return btn;
}

// ── Fixture: a doctor + a patient, each in its own context ─────────────────
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function newParty(browser, role, storageState, baseURL) {
  const context = await browser.newContext({
    baseURL,
    ...(storageState ? { storageState } : {}),
    permissions: ["camera", "microphone"],
  });
  await context.addInitScript(TRACK_PCS);
  const page = await context.newPage();
  const logs = captureLogs(page);
  return { role, context, page, logs };
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
