const crypto = require("node:crypto");
const zlib = require("node:zlib");

// Calls fn(inflatedBytes) for every stream in a pdfkit PDF (undecodable
// streams are passed through raw).
function eachStream(buf, fn) {
  const raw = buf.toString("latin1");
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    let bytes;
    try {
      bytes = zlib.inflateSync(buf.subarray(start, end));
    } catch {
      bytes = null;
    }
    fn(bytes, buf.subarray(start, end));
  }
}

// Pulls the drawn text out of a pdfkit PDF using only zlib: inflate every
// stream, then decode the TJ hex strings pdfkit writes for standard fonts.
function extractText(buf) {
  let out = "";
  eachStream(buf, (bytes) => {
    if (!bytes) return;
    // Kerning splits a word across a TJ array's hex pieces; rejoin them.
    for (const arr of bytes.toString("latin1").matchAll(/\[([^\]]*)\]\s*TJ/g)) {
      for (const h of arr[1].matchAll(/<([0-9a-fA-F]*)>/g)) {
        out += Buffer.from(h[1], "hex").toString("latin1");
      }
      out += "\n";
    }
  });
  return out;
}

// SHA-256 of every inflated stream (page content, fonts, images) — i.e. the
// whole drawn document minus the Info dictionary/ID, which carry a creation
// date. Equal hashes mean the PDF is drawn identically, position for position.
function contentHash(buf) {
  const hash = crypto.createHash("sha256");
  // Only inflatable streams: the "stream" regex also trips over the xref/trailer
  // text, which carries the document ID and so differs on every build.
  eachStream(buf, (bytes) => bytes && hash.update(bytes));
  return hash.digest("hex");
}

module.exports = { extractText, contentHash };
