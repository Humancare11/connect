// The saved transcript in the doctor's and the admin's dashboards: what is shown, the marks, the delete rules, and where it is mounted.
// Run (from PowerShell/cmd, in frontend/): node --test tests/transcriptionViewer.test.mjs
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";
import * as vm from "../src/features/translation/transcriptViewModel.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8").replace(/\r\n/g, "\n");
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
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), "hc-viewer-test-"));
  for (const o of out) if (o.type === "chunk") fs.writeFileSync(path.join(outDir, o.fileName), o.code);
  m = await import(pathToFileURL(path.join(outDir, out.find((o) => o.isEntry).fileName)).href);
});
after(() => { if (outDir) fs.rmSync(outDir, { recursive: true, force: true }); });

const line = (o = {}) => ({ id: "l" + Math.random(), kind: "line", speakerRole: "patient", spokeAt: "2026-11-12T10:00:00.000Z", sourceLang: "hi-IN", languageSource: "declared", confidenceTier: "high", flags: {}, hidden: false, noticePending: false, lateUpload: false, unreadable: false, original: "namaste", translations: { en: "hello" }, ...o });
const gap = (o = {}) => ({ id: "g" + Math.random(), kind: "gap", speakerRole: "doctor", spokeAt: "2026-11-12T10:01:00.000Z", reason: "muted", ...o });
const answer = (segments, extra = {}) => ({ appointmentId: "a", notice: { bothShown: true, patient: {}, doctor: {} }, summary: { lines: 1, gaps: 0, hidden: 0, noticePending: 0, lateUpload: 0 }, truncated: false, segments, ...extra });

// ---------- view model ----------
test("every mark the dashboards must show: unclear, echo, noticePending, lateUpload, language not supported, unreadable", () => {
  const keys = (o) => vm.lineMarks(line(o)).map((x) => x.key);
  assert.deepEqual(keys({}), []);
  assert.ok(keys({ confidenceTier: "unclear" }).includes("unclear"));
  assert.ok(keys({ confidenceTier: "low" }).includes("low"));
  assert.ok(keys({ flags: { suspectedEcho: true } }).includes("echo"));
  assert.ok(keys({ flags: { languageNotInList: true } }).includes("language"));
  assert.ok(keys({ noticePending: true }).includes("noticePending"));
  assert.ok(keys({ lateUpload: true }).includes("lateUpload"));
  assert.ok(keys({ unreadable: true, original: null }).includes("unreadable"));
  assert.ok(keys({ languageSource: "auto" }).includes("auto"));
});

test("hidden lines (unclear, echo) are LISTED in the record, marked, not dropped", () => {
  const v = vm.buildTranscriptView(answer([line({ id: "1" }), line({ id: "2", hidden: true, confidenceTier: "unclear" }), line({ id: "3", hidden: true, flags: { suspectedEcho: true } })], { summary: { lines: 3, hidden: 2 } }));
  assert.equal(v.items.length, 3);
  assert.equal(v.items.filter((i) => i.hidden).length, 2);
});

test("gaps are shown with a reason in words", () => {
  const v = vm.buildTranscriptView(answer([gap({ reason: "muted" }), gap({ reason: "recognizer_down" }), gap({ reason: "whatever" })]));
  assert.deepEqual(v.items.map((i) => i.label), ["Microphone muted", "Speech recognition was unavailable", "Not recorded"]);
  assert.equal(v.items[0].speaker, "Doctor");
});

test("English record shown only when it adds something; language shown by name", () => {
  assert.equal(vm.buildTranscriptView(answer([line()])).items[0].english, "hello");
  assert.equal(vm.buildTranscriptView(answer([line({ sourceLang: "en-US", original: "Hello", translations: { en: "hello" } })])).items[0].english, "");
  assert.equal(vm.buildTranscriptView(answer([line()])).items[0].language, "Hindi");
});

test("summary notes warn about: notice not confirmed, pending lines, hidden lines, gaps, late lines, truncation", () => {
  const v = vm.buildTranscriptView(answer([line()], { notice: { bothShown: false }, summary: { lines: 1, gaps: 2, hidden: 3, noticePending: 1, lateUpload: 4 }, truncated: true }));
  const text = vm.summaryNotes(v).join(" | ");
  for (const needle of ["not confirmed on both sides", "1 line recorded before the notice", "3 unclear or echo lines are included", "2 periods when speech was not recorded", "4 lines uploaded after the call", "Only the first part"]) assert.ok(text.includes(needle), needle);
  assert.deepEqual(vm.summaryNotes(vm.buildTranscriptView(answer([line()]))), []);
});

test("garbage answers never throw", () => {
  for (const bad of [null, undefined, 5, "x", [], { segments: "no" }]) assert.equal(vm.buildTranscriptView(bad).isEmpty, true);
});

test("delete reason rules: 3 to 300 characters after trimming", () => {
  assert.ok(vm.reasonError(""));
  assert.ok(vm.reasonError("  a "));
  assert.equal(vm.reasonError("ok!"), "");
  assert.equal(vm.reasonError("x".repeat(300)), "");
  assert.ok(vm.reasonError("x".repeat(301)));
});

// ---------- the two requests ----------
test("fetchTranscript reads GET /api/appointments/:id/transcript and explains failures without the server's text", async () => {
  const calls = [];
  const ok = await vm.fetchTranscript({ get: async (u) => { calls.push(u); return { data: answer([line()]) }; } }, "abc");
  assert.deepEqual(calls, ["/api/appointments/abc/transcript"]);
  assert.equal(ok.view.items.length, 1);
  const err = (status) => ({ get: async () => { const e = new Error("secret detail"); e.response = { status, data: { msg: "secret detail" } }; throw e; } });
  assert.match((await vm.fetchTranscript(err(403), "a")).error, /do not have access/);
  assert.match((await vm.fetchTranscript(err(503), "a")).error, /try again/);
  assert.match((await vm.fetchTranscript(err(429), "a")).error, /Too many/);
  assert.equal((await vm.fetchTranscript(err(500), "a")).error, "Could not load the transcript.");
  assert.doesNotMatch(JSON.stringify(await vm.fetchTranscript(err(500), "a")), /secret/);
});

test("deleteTranscript: no request without a good reason; sends the cleaned reason; reports the count and failures", async () => {
  const calls = [];
  const http = { delete: async (u, o) => { calls.push([u, o]); return { data: { deleted: 7 } }; } };
  assert.ok((await vm.deleteTranscript(http, "abc", "  ")).error);
  assert.equal(calls.length, 0);
  const r = await vm.deleteTranscript(http, "abc", "  patient   asked   for removal ");
  assert.deepEqual(r, { deleted: 7 });
  assert.deepEqual(calls, [["/api/appointments/abc/transcript", { data: { reason: "patient asked for removal" } }]]);
  const failing = { delete: async () => { const e = new Error("x"); e.response = { status: 503 }; throw e; } };
  assert.match((await vm.deleteTranscript(failing, "a", "good reason")).error, /try again/);
  const denied = { delete: async () => { const e = new Error("x"); e.response = { status: 403 }; throw e; } };
  assert.match((await vm.deleteTranscript(denied, "a", "good reason")).error, /access/);
});

// ---------- components ----------
test("the transcript body shows speaker, original, English record, marks and gaps; an empty record says so", () => {
  const view = vm.buildTranscriptView(answer([line({ flags: { suspectedEcho: true }, hidden: true }), gap()], { summary: { lines: 1, gaps: 1, hidden: 1 } }));
  const html = m.renderToStaticMarkup(m.React.createElement(m.viewer.TranscriptBody, { view }));
  for (const needle of ["Patient", "namaste", "hello", "Possible echo of the other voice", "Microphone muted", "Hindi", "data-lenis-prevent"]) assert.ok(html.includes(needle), needle);
  const empty = m.renderToStaticMarkup(m.React.createElement(m.viewer.TranscriptBody, { view: vm.buildTranscriptView({}) }));
  assert.match(empty, /no saved transcript/);
});

test("nothing is requested or drawn until the button is pressed (closed = one button)", () => {
  const html = m.renderToStaticMarkup(m.React.createElement(m.viewer.default, { appointmentId: "a", http: { get() { throw new Error("must not be called"); } }, canDelete: true }));
  assert.match(html, /<button/);
  assert.doesNotMatch(html, /dialog/);
  assert.doesNotMatch(html, /Delete transcript/);
});

// ---------- where it is mounted ----------
test("doctor dashboard: only with the build flag, only for a started or finished appointment, with the doctor's own login, no delete", () => {
  const src = read("src/pages/doctors/DoctorAppointments.jsx");
  assert.match(src, /const SHOW_TRANSCRIPT = isTranscriptionBuildEnabled\(\)/);
  assert.match(src, /authRole: "doctor"/);
  assert.match(src, /SHOW_TRANSCRIPT && \["confirmed", "complete", "completed"\]\.includes\(appt\.status\) && \(\n\s+<TranscriptViewer key="transcript" appointmentId=\{appt\._id\} http=\{TRANSCRIPT_HTTP\} \/>/);
  assert.doesNotMatch(src, /canDelete/);
  assert.doesNotMatch(src, /TRANSCRIPT_HTTP = \{[^}]*delete/);
});

test("admin dashboard: only with the build flag and an admin login; can delete", () => {
  const src = read("src/pages/admin/AdminAppointmentDetails.jsx");
  assert.match(src, /isTranscriptionBuildEnabled\(\) && \(admin\?\.role === "admin" \|\| admin\?\.role === "superadmin"\) && \(\n\s+<TranscriptViewer appointmentId=\{appointment\._id\} http=\{api\} canDelete \/>/);
});

test("the patient screens do not use the viewer", () => {
  const dir = path.join(root, "src");
  const hits = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.jsx?$/.test(e.name) && read(path.relative(root, p)).includes("TranscriptViewer")) hits.push(path.relative(dir, p).replace(/\\/g, "/")); } };
  walk(dir);
  assert.deepEqual(hits.sort(), ["features/translation/TranscriptViewer.jsx", "pages/admin/AdminAppointmentDetails.jsx", "pages/doctors/DoctorAppointments.jsx"]);
});

test("the Delete button exists only for admins (canDelete) and only while there is something to delete; it needs a second confirmation with a reason", () => {
  const src = read("src/features/translation/TranscriptViewer.jsx");
  assert.match(src, /\{canDelete && view && !view\.isEmpty && deletedCount === null && !confirming && \(/);
  assert.equal((src.match(/Delete transcript…/g) || []).length, 1);
  assert.match(src, /role="alertdialog"/);
  assert.match(src, /Reason \(required\)/);
  // the confirm button is the only caller of the request
  assert.equal((src.match(/deleteTranscript\(/g) || []).length, 1);
});
