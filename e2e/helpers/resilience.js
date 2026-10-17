// Fault-injection helpers for the resilience e2e specs. Everything here acts on
// the TEST browser or on the throwaway local backend/TURN processes - nothing
// in the app is modified.
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOCAL_MONGO_URI, LOCAL_PORTS } from "./env.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(here, "../../backend");

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Page-side: the app's shared socket.io client ───────────────────────────
// In dev mode Vite serves the app's own module, so importing it from the page
// returns the SAME singleton the call pages use.
const socketHandle = (page) =>
  page.evaluateHandle(async () => (await import("/src/socket.js")).default);

export async function socketState(page) {
  const h = await socketHandle(page);
  try {
    return await h.evaluate((s) => ({
      connected: s.connected,
      id: s.id || null,
      transport: s.io?.engine?.transport?.name || null,
    }));
  } finally {
    await h.dispose();
  }
}

// Server-side-looking transport close: the client sees "transport close" and
// its own reconnection logic runs.
export async function dropSocket(page) {
  const h = await socketHandle(page);
  try {
    await h.evaluate((s) => s.io?.engine?.close());
  } finally {
    await h.dispose();
  }
}

export async function waitForSocketConnected(page, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await socketState(page).catch(() => null);
    if (last?.connected) return last;
    await sleep(500);
  }
  throw new Error(`socket did not reconnect within ${timeoutMs}ms (last: ${JSON.stringify(last)})`);
}

// Makes the next `n` emits of `event` vanish and answers each with `reply`
// (as if the server had sent it). Used for "server says room_full / server_error".
export async function injectServerReply(page, event, reply, n = 1) {
  const h = await socketHandle(page);
  try {
    await h.evaluate(
      (s, { event, reply, n }) => {
        const original = s.emit.bind(s);
        let left = n;
        window.__e2eInjectRestore = () => {
          s.emit = original;
        };
        s.emit = (name, ...args) => {
          if (name === event && left > 0) {
            left -= 1;
            setTimeout(() => s.onevent({ data: reply }), 30);
            return s;
          }
          return original(name, ...args);
        };
      },
      { event, reply, n },
    );
  } finally {
    await h.dispose();
  }
}

// ── Page-side: media ───────────────────────────────────────────────────────
// Stops (ends) every live local track of `kind` the page ever captured.
export async function endLocalTracks(page, kind) {
  return page.evaluate((k) => {
    let n = 0;
    for (const t of window.__e2eTracks || []) {
      if (t.kind === k && t.readyState === "live") {
        t.stop();
        n += 1;
      }
    }
    return n;
  }, kind);
}

export async function liveLocalTracks(page, kind) {
  return page.evaluate(
    (k) => (window.__e2eTracks || []).filter((t) => t.kind === k && t.readyState === "live").length,
    kind,
  );
}

// Selected ICE candidate pair types, e.g. { local: "relay", remote: "relay" }.
export async function selectedCandidateTypes(page) {
  return page.evaluate(async () => {
    const pcs = (window.__e2e && window.__e2e.pcs) || [];
    const pc = [...pcs].reverse().find((p) => p.signalingState !== "closed");
    if (!pc) return null;
    const report = await pc.getStats();
    const byId = new Map();
    report.forEach((s) => byId.set(s.id, s));
    let out = null;
    report.forEach((s) => {
      if (s.type === "transport" && s.selectedCandidatePairId) {
        const pair = byId.get(s.selectedCandidatePairId);
        if (pair) {
          out = {
            local: byId.get(pair.localCandidateId)?.candidateType,
            remote: byId.get(pair.remoteCandidateId)?.candidateType,
          };
        }
      }
    });
    return out;
  });
}

// Total inbound bytes for audio+video of the newest open pc.
export async function inboundBytes(page) {
  return page.evaluate(async () => {
    const pcs = (window.__e2e && window.__e2e.pcs) || [];
    const pc = [...pcs].reverse().find((p) => p.signalingState !== "closed");
    if (!pc) return { audio: 0, video: 0 };
    const out = { audio: 0, video: 0 };
    (await pc.getStats()).forEach((s) => {
      if (s.type === "inbound-rtp" && !s.isRemote) out[s.kind || s.mediaType] = s.bytesReceived || 0;
    });
    return out;
  });
}

// Forces every RTCPeerConnection this context creates to use relay candidates
// only (the call must go through TURN). Add BEFORE the first navigation.
export async function forceRelayOnly(context) {
  await context.addInitScript(() => {
    const Orig = window.RTCPeerConnection;
    window.RTCPeerConnection = class extends Orig {
      constructor(config = {}, ...rest) {
        super({ ...config, iceTransportPolicy: "relay" }, ...rest);
      }
    };
  });
}

// ── Process control: backend ────────────────────────────────────────────────
function listeningPid(port) {
  const out = execFileSync("netstat", ["-ano", "-p", "tcp"], { encoding: "utf8" });
  for (const line of out.split(/\r?\n/)) {
    if (/LISTENING/.test(line) && new RegExp(`[:.]${port}\\s`).test(line)) {
      const pid = Number(line.trim().split(/\s+/).pop());
      if (pid) return pid;
    }
  }
  return null;
}

async function httpStatus(url) {
  try {
    return (await fetch(url)).status;
  } catch {
    return 0;
  }
}

let respawned = null;

export async function killBackend() {
  if (respawned && respawned.exitCode === null) {
    try {
      execFileSync("taskkill", ["/PID", String(respawned.pid), "/F", "/T"], { stdio: "ignore" });
    } catch {
      /* already gone */
    }
    respawned = null;
  }
  const pid = listeningPid(LOCAL_PORTS.backend);
  if (pid) {
    try {
      execFileSync("taskkill", ["/PID", String(pid), "/F", "/T"], { stdio: "ignore" });
    } catch {
      /* already gone */
    }
  }
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline && (await httpStatus(`http://127.0.0.1:${LOCAL_PORTS.backend}/api/rtc/ice-servers`)) !== 0) {
    await sleep(200);
  }
}

export async function startBackend() {
  respawned = spawn(process.execPath, ["server.js"], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      NODE_ENV: "development",
      PORT: String(LOCAL_PORTS.backend),
      MONGO_URI: LOCAL_MONGO_URI,
      FRONTEND_URL: `http://localhost:${LOCAL_PORTS.frontend}`,
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: "1",
      ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL || "",
    },
    stdio: "ignore",
    windowsHide: true,
  });
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if ((await httpStatus(`http://127.0.0.1:${LOCAL_PORTS.backend}/api/rtc/ice-servers`)) === 401) return;
    await sleep(300);
  }
  throw new Error("backend did not come back after restart");
}

export async function restartBackend() {
  await killBackend();
  await startBackend();
}

// ── Process control: local TURN (node-turn) ─────────────────────────────────
// node-turn is not a repo dependency; point E2E_TURN_DIR at a folder whose
// node_modules contains it (see e2e/README: "Relay / TURN scenarios").
let turnProc = null;

export function turnAvailable() {
  return Boolean(process.env.E2E_TURN_DIR);
}

export async function startTurn({ dropPercent = 0, latencyMs = 0 } = {}) {
  if (!turnAvailable()) throw new Error("E2E_TURN_DIR is not set");
  await stopTurn();
  const script = path.join(process.env.E2E_TURN_DIR, "turn-server.js");
  turnProc = spawn(process.execPath, [script], {
    cwd: process.env.E2E_TURN_DIR,
    env: {
      ...process.env,
      TURN_SECRET: process.env.TURN_STATIC_AUTH_SECRET || "e2e-turn-secret",
      DROP_PERCENT: String(dropPercent),
      LATENCY_MS: String(latencyMs),
    },
    stdio: "ignore",
    windowsHide: true,
  });
  await sleep(700);
}

export async function stopTurn() {
  if (turnProc && turnProc.exitCode === null) {
    try {
      execFileSync("taskkill", ["/PID", String(turnProc.pid), "/F", "/T"], { stdio: "ignore" });
    } catch {
      /* already gone */
    }
  }
  turnProc = null;
  await sleep(300);
}

// Resolve a module that is only installed outside the repo (E2E_TURN_DIR).
export function requireFrom(dir, name) {
  return createRequire(path.join(dir, "package.json"))(name);
}
