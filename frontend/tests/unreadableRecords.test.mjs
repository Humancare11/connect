// A prescription or certificate the server could not decrypt is shown as a plain message, never opened, never crashes the list.
// Run from PowerShell/cmd in frontend/: node --test tests/unreadableRecords.test.mjs
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";
import { UNREADABLE_RECORD_TEXT, isUnreadableRecord, recordTitle } from "../src/utils/unreadableRecord.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");
let m;
let outDir;

before(async () => {
  const res = await build({
    root, configFile: false, logLevel: "silent",
    plugins: [(await import("@vitejs/plugin-react")).default()],
    define: { "process.env.NODE_ENV": JSON.stringify("test") },
    ssr: { noExternal: true },
    build: { ssr: path.join(root, "tests/helpers/uiEntry.jsx"), write: false, minify: false, rollupOptions: { output: { format: "esm", entryFileNames: "ui.mjs" } } },
  });
  const out = (Array.isArray(res) ? res[0] : res).output;
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), "hc-unreadable-test-"));
  for (const o of out) if (o.type === "chunk") fs.writeFileSync(path.join(outDir, o.fileName), o.code);
  m = await import(pathToFileURL(path.join(outDir, out.find((o) => o.isEntry).fileName)).href);
});
after(() => { if (outDir) fs.rmSync(outDir, { recursive: true, force: true }); });

test("the exact message", () => {
  assert.equal(UNREADABLE_RECORD_TEXT, "This record can't be displayed right now. Please contact support.");
});

test("only unreadable === true counts; the title falls back to the diagnosis", () => {
  assert.equal(isUnreadableRecord({ unreadable: true }), true);
  for (const v of [null, undefined, {}, { unreadable: false }, { unreadable: "true" }, { unreadable: 1 }]) assert.equal(isUnreadableRecord(v), false);
  assert.equal(recordTitle({ unreadable: true, diagnosis: null }), UNREADABLE_RECORD_TEXT);
  assert.equal(recordTitle({ diagnosis: "Flu" }), "Flu");
});

test("the placeholder card shows the message with the card classes, and nothing to open or download", () => {
  const html = m.renderToStaticMarkup(m.React.createElement(m.unreadableCard.default, { className: "mr-card mr-card--rx", icon: "💊" }));
  assert.match(html, /mr-card mr-card--rx/);
  assert.match(html, /This record can&#x27;t be displayed right now\. Please contact support\./);
  assert.doesNotMatch(html, /<button/);
});

test("the three screens use it: patient My Records (both card kinds), patient dashboard, doctor's patient history", () => {
  const rec = read("src/pages/user/MyRecords.jsx");
  assert.match(rec, /if \(isUnreadableRecord\(rx\)\) return <UnreadableRecordCard className="mr-card mr-card--rx"/);
  assert.match(rec, /if \(isUnreadableRecord\(cert\)\) return <UnreadableRecordCard className="mr-card mr-card--cert"/);
  assert.match(read("src/pages/user/Dashboard.jsx"), /\{recordTitle\(rx\)\}/);
  const dp = read("src/pages/doctors/DoctorPatients.jsx");
  assert.match(dp, /history\.prescriptions\.map\(\(rx\) => isUnreadableRecord\(rx\) \? \(/);
  assert.match(dp, /history\.certificates\.map\(\(cert\) => isUnreadableRecord\(cert\) \? \(/);
  assert.equal((dp.match(/UNREADABLE_RECORD_TEXT/g) || []).length, 3); // import + two uses
});
