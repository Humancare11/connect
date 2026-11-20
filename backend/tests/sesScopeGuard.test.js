// Guard: Amazon SES is only for Email Marketing. System mail (OTP, invoices, notifications) stays on SMTP,
// and the Email module stays on the Gmail API. This fails if SES shows up anywhere else in the backend source.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FORBIDDEN = [/@aws-sdk\/client-sesv2/i, /@aws-sdk\/client-ses\b/i, /amazonses/i, /email-smtp\./i];

// Paths (relative to backend/, forward slashes) where SES is allowed.
const ALLOWED_PREFIXES = ["services/marketing/"];
const ALLOWED_FILES = new Set([
  "routes/adminEmailMarketing.js",
  "routes/publicSesEvents.js",
  "server.js", // wiring only
  ".env.example",
  "package.json",
  "package-lock.json",
]);
const SKIP_DIRS = new Set(["node_modules", "tests", "coverage", "uploads", ".git"]);
const SCAN_EXT = new Set([".js", ".cjs", ".mjs", ".json", ".example", ".sh", ".yml", ".yaml"]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), out);
    } else if (SCAN_EXT.has(path.extname(entry.name)) || entry.name === ".env.example") {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

const isAllowed = (rel) => ALLOWED_FILES.has(rel) || ALLOWED_PREFIXES.some((p) => rel.startsWith(p));

test("Amazon SES is referenced only by the Email Marketing code", () => {
  const files = walk(ROOT);
  assert.ok(files.length > 50, "the scan should see the backend source files");
  const offenders = [];
  for (const file of files) {
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    if (isAllowed(rel)) continue;
    const text = fs.readFileSync(file, "utf8");
    if (FORBIDDEN.some((re) => re.test(text))) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], `SES must stay inside Email Marketing, but found it in: ${offenders.join(", ")}`);
});

test("the guard itself works: the marketing sender is the one place that uses the SES client", () => {
  const sender = fs.readFileSync(path.join(ROOT, "services/marketing/sesSender.js"), "utf8");
  assert.ok(FORBIDDEN.some((re) => re.test(sender)));
});
