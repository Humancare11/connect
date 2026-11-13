// The live transcript screens: pure UI logic (uiModel) and the components rendered to HTML with Vite's SSR loader.
// Run: node --test tests/transcriptionUi.test.mjs (from frontend/)
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { build } from "vite";
import * as ui from "../src/features/translation/uiModel.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let React;
let render;
let mods;
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
  const entry = out.find((o) => o.type === "chunk" && o.isEntry);
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), "hc-ui-test-"));
  for (const o of out) if (o.type === "chunk") fs.writeFileSync(path.join(outDir, o.fileName), o.code);
  const m = await import(pathToFileURL(path.join(outDir, entry.fileName)).href);
  React = m.React;
  render = (el) => m.renderToStaticMarkup(el);
  mods = { buttons: m.buttons, language: m.language, transcript: m.transcript, overlay: m.overlay };
});
after(() => { if (outDir) fs.rmSync(outDir, { recursive: true, force: true }); });

const h = (...a) => React.createElement(...a);
const noop = () => {};
const actions = { unlockAudio: noop, setReadLanguage: noop, setSubtitlesEnabled: noop, setVoiceEnabled: noop, dismissHint: noop };
const baseState = { phase: "running", readLang: "none", subtitlesEnabled: true, voiceEnabled: true, voiceBreakerTripped: false, subtitle: null, transcript: [], hint: null, peerReadLang: "none", reconnecting: false };

// ---------- uiModel ----------
test("language list: Real voice is first, also while searching, and is the selected row by default", () => {
  const all = ui.buildLanguageRows({});
  assert.equal(all.rows[0].name, "Real voice (no translation)");
  assert.equal(all.rows[0].selected, true);
  assert.ok(all.rows.length > 90);
  const s = ui.buildLanguageRows({ query: "hindi", selected: "hi" });
  assert.equal(s.rows[0].isNone, true);
  assert.equal(s.rows[0].selected, false);
  assert.ok(s.rows.some((r) => r.code === "hi" && r.selected));
  assert.equal(ui.buildLanguageRows({ query: "zzzzqq" }).noResults, true);
});

test("language rows carry the notes for languages without speech or voice", () => {
  const rows = ui.buildLanguageRows({}).rows.filter((r) => r.note);
  assert.ok(rows.some((r) => r.note === ui.NO_SPEECH_NOTE_OWN));
});

test("doctor banner only for a doctor whose patient picked a language that cannot be transcribed", () => {
  const { rows } = ui.buildLanguageRows({});
  const unsupported = rows.find((r) => r.note === ui.NO_SPEECH_NOTE_OWN).code;
  assert.equal(ui.peerUnsupportedNote("doctor", unsupported), "Patient's speech in this language cannot be transcribed.");
  assert.equal(ui.peerUnsupportedNote("patient", unsupported), "");
  assert.equal(ui.peerUnsupportedNote("doctor", "de"), "");
  assert.equal(ui.peerUnsupportedNote("doctor", "none"), "");
});

test("transcript list hides echo, unclear and unfinished lines; translation shown only when different", () => {
  const list = [
    { id: 1, final: true, text: "hello", tr: { de: "hallo" } },
    { id: 2, final: true, text: "echo", flags: { echo: true } },
    { id: 3, final: true, text: "mumble", tier: "unclear" },
    { id: 4, final: false, text: "partial" },
    { id: 5, final: true, text: "faint", tier: "low" },
  ];
  assert.deepEqual(ui.visibleTranscript(list).map((e) => e.id), [1, 5]);
  assert.equal(ui.translationFor(list[0], "de"), "hallo");
  assert.equal(ui.translationFor(list[0], "none"), "");
  assert.equal(ui.translationFor({ text: "Hi", tr: { en: "hi" } }, "none"), "");
  assert.equal(ui.translationFor({ text: "Hallo", tr: { en: "Hello" } }, "none"), "Hello");
  assert.deepEqual(ui.visibleTranscript(null), []);
});

test("badge, speaker labels and clock", () => {
  assert.equal(ui.languageBadge("none"), "");
  assert.equal(ui.languageBadge("de"), "DE");
  assert.equal(ui.speakerLabel({ who: "me" }), "You");
  assert.equal(ui.speakerLabel({ who: "peer", from: "doctor" }), "Doctor");
  assert.equal(ui.speakerLabel({ who: "peer", from: "patient" }), "Patient");
  assert.equal(ui.formatClock(NaN), "");
  assert.match(ui.formatClock(Date.now()), /^\d\d:\d\d$/);
});

// ---------- components ----------
test("buttons: label, language badge and active state", () => {
  const { LanguageButton, TranscriptButton } = mods.buttons;
  const off = render(h(LanguageButton, { language: "none" }));
  assert.match(off, /Language/);
  assert.doesNotMatch(off, /hc-vc__badge/);
  assert.doesNotMatch(off, /hc-vc__btn--active/);
  const on = render(h(LanguageButton, { language: "de" }));
  assert.match(on, /hc-vc__btn--active/);
  assert.match(on, />DE</);
  assert.match(render(h(TranscriptButton, {})), /Transcript/);
});

test("language panel: closed renders nothing; open shows Real voice first, scroll guard, toggles and the machine note", () => {
  const P = mods.language.default;
  assert.equal(render(h(P, { open: false, onClose: noop, state: baseState, actions })), "");
  const html = render(h(P, { open: true, onClose: noop, state: baseState, actions }));
  assert.ok(html.indexOf("Real voice (no translation)") < html.indexOf("Afrikaans") || !html.includes("Afrikaans"));
  assert.match(html, /data-lenis-prevent/);
  assert.match(html, /Search languages/);
  assert.match(html, /Show subtitles/);
  assert.match(html, /Hear translated voice/);
  assert.match(html, /Machine-translated, may contain errors/);
  // toggles are disabled while "Real voice" is chosen
  assert.equal((html.match(/disabled=""/g) || []).length, 2);
  const picked = render(h(P, { open: true, onClose: noop, state: { ...baseState, readLang: "de" }, actions }));
  assert.equal((picked.match(/disabled=""/g) || []).length, 0);
  const tripped = render(h(P, { open: true, onClose: noop, state: { ...baseState, readLang: "de", voiceBreakerTripped: true }, actions }));
  assert.match(tripped, /switched off because/);
});

test("transcript panel: empty text, lines with speaker, original and translation, hidden echo", () => {
  const P = mods.transcript.default;
  assert.equal(render(h(P, { open: false, onClose: noop, state: baseState })), "");
  assert.match(render(h(P, { open: true, onClose: noop, state: baseState })), /will appear here/);
  const state = { ...baseState, readLang: "de", transcript: [
    { id: "a", final: true, who: "me", text: "Good morning", at: 0, tr: { de: "Guten Morgen" } },
    { id: "b", final: true, who: "peer", from: "patient", text: "secret echo", at: 0, flags: { echo: true } },
  ] };
  const html = render(h(P, { open: true, onClose: noop, state }));
  assert.match(html, /You/);
  assert.match(html, /Good morning/);
  assert.match(html, /Guten Morgen/);
  assert.doesNotMatch(html, /secret echo/);
  assert.match(html, /data-lenis-prevent/);
});

test("overlay: nothing unless the engine is running (flag off = today's call screen)", () => {
  const O = mods.overlay.default;
  for (const phase of ["off", "idle", "starting", "stopped", undefined]) {
    assert.equal(render(h(O, { state: { ...baseState, phase }, actions, role: "doctor" })), "", String(phase));
  }
  assert.equal(render(h(O, { state: null, actions, role: "doctor" })), "");
});

test("overlay: badge and notice while running; reconnecting, banner and hint only when they apply", () => {
  const O = mods.overlay.default;
  const html = render(h(O, { state: baseState, actions, role: "patient" }));
  assert.match(html, /Transcribing/);
  assert.match(html, /This call is being transcribed\./);
  assert.match(html, /Other voices nearby may be transcribed\./);
  assert.doesNotMatch(html, /reconnecting/);
  assert.doesNotMatch(html, /cannot be transcribed/);
  assert.doesNotMatch(html, /Turn on translation/);

  const rec = render(h(O, { state: { ...baseState, reconnecting: true }, actions, role: "patient" }));
  assert.match(rec, /Subtitles unavailable, reconnecting…/);

  const unsupported = ui.buildLanguageRows({}).rows.find((r) => r.note === ui.NO_SPEECH_NOTE_OWN).code;
  const doc = render(h(O, { state: { ...baseState, peerReadLang: unsupported }, actions, role: "doctor" }));
  assert.match(doc, /Patient&#x27;s speech in this language cannot be transcribed\./);
  const pat = render(h(O, { state: { ...baseState, peerReadLang: unsupported }, actions, role: "patient" }));
  assert.doesNotMatch(pat, /Patient&#x27;s speech/);

  const hint = { code: "hi", name: "Hindi" };
  const d = render(h(O, { state: { ...baseState, hint }, actions, role: "doctor" }));
  assert.match(d, /Patient is speaking Hindi\. Turn on translation\?/);
  const p = render(h(O, { state: { ...baseState, hint }, actions, role: "patient" }));
  assert.doesNotMatch(p, /Turn on translation/);
});

test("subtitles: lighter style for unclear text, machine-translated note, nothing when empty", () => {
  const O = mods.overlay.default;
  const plain = render(h(O, { state: { ...baseState, subtitle: { text: "Hello there", final: true, lighter: false } }, actions, role: "patient" }));
  assert.match(plain, /Hello there/);
  assert.match(plain, /Machine-translated, may contain errors/);
  assert.doesNotMatch(plain, /hc-tr__subtitle--lighter/);
  const light = render(h(O, { state: { ...baseState, subtitle: { text: "maybe", final: true, lighter: true } }, actions, role: "patient" }));
  assert.match(light, /hc-tr__subtitle--lighter/);
  assert.doesNotMatch(render(h(O, { state: baseState, actions, role: "patient" })), /hc-tr__subtitles/);
});

test("the unavailable phase still shows the badge and the reconnect pill", () => {
  const O = mods.overlay.default;
  const html = render(h(O, { state: { ...baseState, phase: "unavailable", reconnecting: true }, actions, role: "patient" }));
  assert.match(html, /Transcribing/);
  assert.match(html, /reconnecting/);
});

test("overlay: the lost-sentence messages, the wrong-language hint, the translation status and the unclear subtitle", () => {
  const O = mods.overlay.default;
  const r = (patch, role = "patient") => render(h(O, { state: { ...baseState, ...patch }, actions, role }));
  assert.match(r({ listenNote: "didnt_catch" }), /Didn&#x27;t catch that - please ask them to repeat/);
  assert.doesNotMatch(r({}), /Didn&#x27;t catch that/);
  assert.match(r({ speakNote: "not_understood" }), /Not understood - please repeat/);
  assert.doesNotMatch(r({}), /Not understood/);
  assert.match(r({ readLang: "de", fellBackToDetection: true }), /You may be speaking a different language than selected/);
  assert.doesNotMatch(r({ readLang: "none", fellBackToDetection: true }), /different language than selected/);
  assert.doesNotMatch(r({ readLang: "de" }), /different language than selected/);
  assert.match(r({ translationStatus: "waiting" }), /Translating…/);
  assert.match(r({ translationStatus: "speaking" }), /Speaking the translation/);
  assert.match(r({ translationStatus: "unavailable" }), /Translation unavailable - you are hearing the original voice/);
  assert.doesNotMatch(r({ translationStatus: "ready" }), /Translating…|Translation unavailable/);
  const unclear = render(h(mods.overlay.Subtitles, { subtitle: { id: "x", text: "Gemurmel", final: true, lighter: true, unclear: true } }));
  assert.match(unclear, /\(unclear\)/);
  assert.match(unclear, /Gemurmel/);
  assert.doesNotMatch(render(h(mods.overlay.Subtitles, { subtitle: { id: "y", text: "Hallo", final: true } })), /unclear/);
});
