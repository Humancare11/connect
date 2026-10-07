// Local production-like server for dist/, mirroring how Render serves the static site:
//   - redirects and rewrites are read from render.yaml (first match wins, like Render)
//   - real files win over rewrites ("Render does not apply rules to a path if a resource exists")
//   - unmatched paths get dist/404.html with a real 404 status
//   - /api and /socket.io are proxied to the backend so login, booking and payment work locally
//
//   npm run build && npm run serve:dist          (http://localhost:4173, backend on :5000)
//   PORT=8080 API_TARGET=http://localhost:5000 node scripts/serve-dist.mjs
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const port = Number(process.env.PORT || 4173);
const apiTarget = new URL(process.env.API_TARGET || "http://localhost:5000");

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon", ".woff": "font/woff",
  ".woff2": "font/woff2", ".ttf": "font/ttf", ".mp4": "video/mp4", ".pdf": "application/pdf",
};

// ---- render.yaml routes (type / source / destination triples) ---------------------------------
const yaml = fs.readFileSync(path.join(root, "render.yaml"), "utf8");
const rules = [];
for (const m of yaml.matchAll(/-\s*type:\s*(\w+)\s*\n\s*source:\s*(\S+)\s*\n\s*destination:\s*(\S+)/g)) {
  const [, type, source, destination] = m;
  const pattern = new RegExp("^" + source.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "(.*)") + "$");
  rules.push({ type, pattern, destination });
}

function fileFor(urlPath) {
  const rel = decodeURIComponent(urlPath).replace(/^\/+/, "");
  const abs = path.join(dist, rel);
  if (!abs.startsWith(dist)) return null;
  const candidates = [abs, path.join(abs, "index.html"), abs + ".html"];
  for (const c of candidates) {
    try {
      if (!fs.statSync(c).isFile()) continue;
      // Render's file system is case-sensitive; Windows/macOS are not. Match the real on-disk case.
      const real = fs.realpathSync.native(c);
      if (path.relative(dist, real) !== path.relative(dist, c)) continue;
      return c;
    } catch {
      /* next */
    }
  }
  return null;
}

function send(res, status, file, extraHeaders = {}) {
  const ext = path.extname(file).toLowerCase();
  res.writeHead(status, { "Content-Type": MIME[ext] || "application/octet-stream", ...extraHeaders });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/socket.io")) {
    const proxied = http.request(
      { host: apiTarget.hostname, port: apiTarget.port || 80, method: req.method, path: req.url, headers: { ...req.headers, host: apiTarget.host } },
      (upstream) => {
        res.writeHead(upstream.statusCode, upstream.headers);
        upstream.pipe(res);
      }
    );
    proxied.on("error", () => {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end(`Backend not reachable at ${apiTarget.origin}`);
    });
    req.pipe(proxied);
    return;
  }

  // 1. real file
  const direct = fileFor(url.pathname);
  if (direct) return send(res, 200, direct);

  // 2. redirects / rewrites in file order
  for (const rule of rules) {
    const m = rule.pattern.exec(url.pathname);
    if (!m) continue;
    if (rule.type === "redirect") {
      const target = rule.destination.replace(/\*/g, m[1] || "");
      res.writeHead(301, { Location: target + url.search });
      return res.end();
    }
    const dest = fileFor(rule.destination);
    if (dest) return send(res, 200, dest);
  }

  // 3. real 404
  const notFound = path.join(dist, "404.html");
  if (fs.existsSync(notFound)) return send(res, 404, notFound);
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

// websocket pass-through for socket.io (video call)
server.on("upgrade", (req, socket, head) => {
  const upstream = net.connect(Number(apiTarget.port || 80), apiTarget.hostname, () => {
    upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n` + Object.entries({ ...req.headers, host: apiTarget.host }).map(([k, v]) => `${k}: ${v}`).join("\r\n") + "\r\n\r\n");
    upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
});

server.listen(port, () => {
  console.log(`Serving dist/ on http://localhost:${port}  (API proxied to ${apiTarget.origin})`);
});
