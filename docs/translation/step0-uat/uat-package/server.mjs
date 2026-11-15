// TEMPORARY Azure Speech test server (step 0). Standalone: it does NOT use or touch the Humancare Connect app code.
// Zero npm dependencies. Needs Node 18 or newer (uses the built-in fetch).
//
//   cd /opt/hc-step0-test && node server.mjs        (reads ./.env, see .env.example)
//
// It listens on 127.0.0.1 only. nginx proxies one secret path to it. It exits by itself after STEP0_TTL_HOURS (default 6).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

// Minimal .env reader. Only these names are read, so pointing STEP0_ENV_FILE at a bigger .env file loads nothing else.
const WANTED = new Set(["AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION", "STEP0_TTL_HOURS", "STEP0_PORT"]);
try {
  const file = process.env.STEP0_ENV_FILE || path.join(dir, ".env");
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith("#") || !WANTED.has(m[1])) continue;
    let v = m[2];
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
} catch { /* no .env file: rely on real environment variables */ }

const KEY = process.env.AZURE_SPEECH_KEY;
const REGION = process.env.AZURE_SPEECH_REGION || "eastus";
const PORT = Number(process.env.STEP0_PORT || 8787);
const TTL_HOURS = Number(process.env.STEP0_TTL_HOURS || 6);
if (!KEY) { console.error("AZURE_SPEECH_KEY is not set (.env or environment)."); process.exit(1); }

const startedAt = Date.now();
setTimeout(() => { console.log("TTL reached, exiting."); process.exit(0); }, TTL_HOURS * 3600 * 1000);

// very small per-IP rate limit (nginx sends the real address in X-Forwarded-For)
const hits = new Map();
function limited(req, bucket, max) {
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  const k = bucket + "|" + ip, now = Date.now();
  const arr = (hits.get(k) || []).filter((t) => now - t < 5 * 60 * 1000);
  arr.push(now); hits.set(k, arr);
  return arr.length > max;
}

const read = (name) => fs.readFileSync(path.join(dir, name));
const SAMPLES = {
  de: ["de-DE", "de-DE-KatjaNeural", "Guten Tag, ich habe seit drei Tagen starke Kopfschmerzen und mir ist schwindelig. Ich nehme keine Medikamente."],
  en: ["en-US", "en-US-JennyNeural", "Hello, I have had a severe headache for three days and I feel dizzy. I am not taking any medication."],
  es: ["es-ES", "es-ES-ElviraNeural", "Buenos días, tengo un fuerte dolor de cabeza desde hace tres días y me siento mareada."],
};
const cache = new Map();

async function issueToken() {
  const r = await fetch(`https://${REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
    method: "POST", headers: { "Ocp-Apim-Subscription-Key": KEY, "Content-Length": "0" },
  });
  return { status: r.status, body: r.ok ? await r.text() : "" };
}
async function tts(text, voice, lang) {
  const r = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": KEY, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "riff-16khz-16bit-mono-pcm", "User-Agent": "hc-step0" },
    body: `<speak version='1.0' xml:lang='${lang}'><voice name='${voice}'>${text}</voice></speak>`,
  });
  if (!r.ok) throw new Error("TTS " + r.status);
  return Buffer.from(await r.arrayBuffer());
}

// ---- Caption relay (stands in for the real Socket.IO events in the spike) -------------------------------------------------
// In memory only. The message bodies are NEVER logged or stored; only forwarded to the other clients in the same room.
const rooms = new Map(); // room -> Map(clientId -> { res, sentThisSecond, secondStart })
const SAFE = /^[A-Za-z0-9-]{3,32}$/;
function broadcast(room, exceptClient, obj) {
  const r = rooms.get(room); if (!r) return;
  const line = "data: " + JSON.stringify(obj) + "\n\n";
  for (const [id, c] of r) if (id !== exceptClient) { try { c.res.write(line); } catch { /* closed */ } }
}
setInterval(() => { for (const r of rooms.values()) for (const c of r.values()) { try { c.res.write(": ping\n\n"); } catch { /* closed */ } } }, 15000);

function relayStream(req, res, room, client) {
  let r = rooms.get(room);
  if (!r) { r = new Map(); rooms.set(room, r); }
  if (!r.has(client) && r.size >= 4) { res.statusCode = 429; return res.end("room full"); }
  res.writeHead(200, {
    "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive",
    "X-Accel-Buffering": "no", // tells nginx not to buffer this stream
    "X-Robots-Tag": "noindex, nofollow",
  });
  res.write(": open\n\n");
  r.set(client, { res, n: 0, t: Date.now() });
  res.write("data: " + JSON.stringify({ t: "sys", ev: "hello", clients: [...r.keys()] }) + "\n\n");
  broadcast(room, client, { t: "sys", ev: "joined", client });
  req.on("close", () => {
    const cur = rooms.get(room);
    if (cur && cur.get(client)?.res === res) { cur.delete(client); broadcast(room, client, { t: "sys", ev: "left", client }); if (!cur.size) rooms.delete(room); }
  });
}
function relaySend(req, res, room, client) {
  const r = rooms.get(room);
  if (!r || !r.has(client)) { res.statusCode = 409; return res.end("not connected"); }
  const me = r.get(client), now = Date.now();
  if (now - me.t > 1000) { me.t = now; me.n = 0; }
  if (++me.n > 40) { res.statusCode = 429; return res.end("slow down"); }
  let size = 0; const chunks = [];
  req.on("data", (d) => { size += d.length; if (size > 8192) { res.statusCode = 413; res.end("too big"); req.destroy(); } else chunks.push(d); });
  req.on("end", () => {
    if (res.writableEnded) return;
    try {
      const msg = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!msg || typeof msg !== "object" || typeof msg.t !== "string") throw new Error("bad");
      msg.from = client; msg.srvAt = Date.now();
      broadcast(room, client, msg);
      res.statusCode = 204; res.end();
    } catch { res.statusCode = 400; res.end("bad message"); } // never echo the body back or into logs
  });
}

http.createServer(async (req, res) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    const u = new URL(req.url, "http://x");
    if (u.pathname === "/relay/stream" || u.pathname === "/relay/send") {
      const room = u.searchParams.get("room") || "", client = u.searchParams.get("client") || "";
      if (!SAFE.test(room) || !SAFE.test(client)) { res.statusCode = 400; return res.end("bad ids"); }
      return u.pathname === "/relay/stream" ? relayStream(req, res, room, client) : relaySend(req, res, room, client);
    }
    if (u.pathname === "/relay/time") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ now: Date.now() })); }
    if (u.pathname === "/speaker.html") { res.setHeader("content-type", "text/html; charset=utf-8"); return res.end(read("speaker.html")); }
    if (u.pathname === "/" || u.pathname === "/index.html") { res.setHeader("content-type", "text/html; charset=utf-8"); return res.end(read("test.html")); }
    if (u.pathname === "/echo.html") { res.setHeader("content-type", "text/html; charset=utf-8"); return res.end(read("echo.html")); }
    if (u.pathname === "/sdk.js") { res.setHeader("content-type", "text/javascript"); res.setHeader("Cache-Control", "public, max-age=3600"); return res.end(read("sdk.js")); }
    if (u.pathname === "/status") {
      const t = await issueToken();
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ ok: t.status === 200, azureTokenHttp: t.status, region: REGION, minutesLeftBeforeAutoExit: Math.round((TTL_HOURS * 3600 * 1000 - (Date.now() - startedAt)) / 60000), node: process.version }));
    }
    if (u.pathname === "/token") {
      if (limited(req, "token", 40)) { res.statusCode = 429; return res.end("slow down"); }
      const t = await issueToken();
      if (!t.body) { res.statusCode = 502; return res.end("token " + t.status); }
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ token: t.body, region: REGION }));
    }
    if (u.pathname === "/sample") {
      if (limited(req, "sample", 40)) { res.statusCode = 429; return res.end("slow down"); }
      const k = SAMPLES[u.searchParams.get("lang")] ? u.searchParams.get("lang") : "de";
      if (!cache.has(k)) cache.set(k, await tts(SAMPLES[k][2], SAMPLES[k][1], SAMPLES[k][0]));
      res.setHeader("content-type", "audio/wav");
      return res.end(cache.get(k));
    }
    res.statusCode = 404; res.end("not found");
  } catch (e) { res.statusCode = 500; res.end("error: " + e.message); }
}).listen(PORT, "127.0.0.1", () => console.log(`step0 test server on 127.0.0.1:${PORT} (region ${REGION}), auto-exit in ${TTL_HOURS}h`));
