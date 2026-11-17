// Standalone spike server for Azure Live Interpreter. Local only (127.0.0.1). Not part of the app.
// The Azure key is read from the environment of THIS process only and never sent to the browser; the page gets a 10-minute token.
//   PowerShell:  $env:AZURE_SPEECH_KEY="<key>"; $env:AZURE_SPEECH_REGION="eastus"; node server.js
const http = require("http");
const fs = require("fs");
const path = require("path");

const KEY = String(process.env.AZURE_SPEECH_KEY || "").trim();
const REGION_RAW = process.env.AZURE_SPEECH_REGION || "eastus";
const REGION = /^[a-z0-9]{3,30}$/.test(REGION_RAW) ? REGION_RAW : "eastus";
const PORT = Number(process.env.PORT) || 5599;
const SDK = path.resolve(__dirname, "../../../frontend/node_modules/microsoft-cognitiveservices-speech-sdk/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle-min.js");
const LOCAL = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

if (!KEY) { console.error("Set AZURE_SPEECH_KEY first (see the comment at the top of this file)."); process.exit(1); }
if (!fs.existsSync(SDK)) { console.error("Speech SDK bundle not found. Run `npm install` in /frontend first.\n" + SDK); process.exit(1); }

http.createServer(async (req, res) => {
  if (!LOCAL.has(req.socket.remoteAddress)) { res.writeHead(403).end(); return; }
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/") return res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(fs.readFileSync(path.join(__dirname, "index.html")));
  if (url.pathname === "/sdk.js") return res.writeHead(200, { "Content-Type": "application/javascript" }).end(fs.readFileSync(SDK));
  if (url.pathname === "/token") {
    try {
      const r = await fetch(`https://${REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
        method: "POST",
        headers: { "Ocp-Apim-Subscription-Key": KEY, "Content-Length": "0" },
      });
      if (!r.ok) return res.writeHead(502, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "azure_http_" + r.status }));
      const token = (await r.text()).trim();
      return res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(JSON.stringify({ token, region: REGION }));
    } catch {
      return res.writeHead(502, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "azure_unreachable" }));
    }
  }
  res.writeHead(404).end();
}).listen(PORT, "127.0.0.1", () => console.log(`Live Interpreter spike: open http://localhost:${PORT}  (region ${REGION})`));
