// Local TURN server for the e2e suite (node-turn) with coturn-style "REST API"
// credentials: username = "<expiry>:<id>", password = base64(HMAC-SHA1(secret, username)).
// Optional impairment of relayed media: DROP_PERCENT, LATENCY_MS (env).
const crypto = require("node:crypto");
const dgram = require("node:dgram");

const SECRET = process.env.TURN_SECRET || "e2e-turn-secret";
const DROP = Number(process.env.DROP_PERCENT || 0) / 100;
const LATENCY = Number(process.env.LATENCY_MS || 0);
const PORT = Number(process.env.TURN_PORT || 3478);

// Impair only relayed media (ChannelData, first two bits 01; Data indication 0x0017), never STUN control.
const isMedia = (buf) => {
  if (!buf || !buf.length) return false;
  if ((buf[0] & 0xc0) === 0x40) return true;
  return buf.length >= 2 && buf[0] === 0x00 && buf[1] === 0x17;
};
if (DROP > 0 || LATENCY > 0) {
  const origCreate = dgram.createSocket;
  dgram.createSocket = function (...args) {
    const sock = origCreate.apply(this, args);
    const origSend = sock.send.bind(sock);
    sock.send = (...a) => {
      const msg = a[0];
      const buf = Buffer.isBuffer(msg) ? msg : Array.isArray(msg) ? Buffer.concat(msg.map((m) => Buffer.from(m))) : Buffer.from(msg);
      if (isMedia(buf)) {
        if (DROP > 0 && Math.random() < DROP) return;
        if (LATENCY > 0) {
          setTimeout(() => origSend(...a), LATENCY * (0.5 + Math.random()));
          return;
        }
      }
      return origSend(...a);
    };
    return sock;
  };
}

const Turn = require("node-turn");
const credentials = new Proxy({}, {
  get(_t, username) {
    if (typeof username !== "string") return undefined;
    const m = /^(\d+):/.exec(username);
    if (!m || Number(m[1]) < Math.floor(Date.now() / 1000)) return undefined;
    return crypto.createHmac("sha1", SECRET).update(username).digest("base64");
  },
  has(_t, username) {
    return typeof username === "string" && /^\d+:/.test(username);
  },
});

process.on("uncaughtException", (e) => console.log("[turn] uncaught", e && e.stack));
const server = new Turn({
  authMech: "long-term",
  credentials,
  listeningIps: ["127.0.0.1"],
  relayIps: ["127.0.0.1"],
  externalIps: { "127.0.0.1": "127.0.0.1" },
  listeningPort: PORT,
  realm: "e2e.local",
  debugLevel: process.env.TURN_DEBUG ? "TRACE" : "ERROR",
  debug: process.env.TURN_DEBUG ? (lvl, msg) => console.log("[turn:" + lvl + "]", String(msg).slice(0, 300)) : undefined,
  log: () => {},
});
server.start();
console.log(`[turn] listening on udp 127.0.0.1:${PORT} (drop=${DROP * 100}% latency=${LATENCY}ms)`);
