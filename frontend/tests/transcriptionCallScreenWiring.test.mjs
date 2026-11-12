// How the live transcript is wired into the appointment call screen (VideoCall.jsx). Static checks on the source: the call screen is a
// 6600-line file that cannot be rendered in a test, so these guard the rules that matter:
//   • flag off = nothing: no request, no UI, no engine (everything hangs off `tr.active`)
//   • the engine is fed by the real events: connected call, mute, new local stream, peer joined, socket reconnected
//   • the integration stays small and isolated
// Run: node --test tests/transcriptionCallScreenWiring.test.mjs (from frontend/)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(ROOT, "src/pages/VideoCall.jsx"), "utf8").replace(/\r\n/g, "\n");
const direct = fs.readFileSync(path.join(ROOT, "src/pages/DirectVideoCall.jsx"), "utf8");
const count = (re) => (src.match(re) || []).length;

test("the config is loaded through the flag module only (no request when the build flag is off)", () => {
  assert.equal(count(/loadTranscriptionConfig\(/g), 1);
  assert.doesNotMatch(src, /\/api\/transcription\/config/);
  assert.match(src, /setTrConfig\(c\.active \? c : null\)/);
  assert.match(src, /active: Boolean\(trConfig\)/);
});

test("every piece of transcript UI is behind tr.active", () => {
  for (const component of ["<TranscriptionOverlay", "<LanguagePanel", "<TranscriptPanel"]) {
    const at = src.indexOf(component);
    assert.ok(at > 0, component);
    const before = src.slice(Math.max(0, at - 120), at);
    assert.match(before, /tr\.active/, `${component} must be guarded by tr.active`);
  }
  assert.match(src, /const transcriptBtns = tr\.active \? \(/);
  // no other use of the two buttons
  assert.equal(count(/<LanguageButton/g), 1);
  assert.equal(count(/<TranscriptButton/g), 1);
});

test("desktop bar gets the buttons, phones get them in the More drawer (and not twice)", () => {
  assert.equal(count(/\{!mobileControls && transcriptBtns\}/g), 1);
  assert.match(src, /\{notesBtn\}\n\s+\{transcriptBtns\}\n\s+<\/CallMoreMenu>/);
});

test("the engine is started when the call is connected, and fed mute, new mic, peer joined and socket reconnect", () => {
  assert.match(src, /if \(tr\.active && inCall\) trActionsRef\.current\.start\(\)/);
  assert.match(src, /trActionsRef\.current\.setMuted\(isMuted\)/);
  assert.match(src, /localStreamRef\.current = stream;\n\s+if \(pipVideoRef\.current\) pipVideoRef\.current\.srcObject = stream;\n\s+trActionsRef\.current\.swapMicStream\(stream\)/);
  assert.match(src, /const handlePeerJoined = \(payload = \{\}\) => \{\n\s+trActionsRef\.current\.onPeerJoined\(\)/);
  assert.match(src, /const handleSocketReconnect = \(\) => \{\n\s+if \(!mounted\) return;\n\s+trActionsRef\.current\.onSocketReconnected\(\)/);
});

test("the engine's requests carry the caller's login role (doctor or patient), not the ambient one", () => {
  assert.match(src, /const trAuthRole = isDoctor \? "doctor" : "user"/);
  assert.match(src, /api\.get\(url, \{ \.\.\.options, authRole: trAuthRole \}\)/);
  assert.match(src, /api\.post\(url, body, \{ \.\.\.options, authRole: trAuthRole \}\)/);
});

test("the integration stays small: the whole feature is the 6 imports plus a few short blocks", () => {
  const lines = src.split("\n");
  const mine = lines.filter((l) => /\btr[A-Z]\w*|\btr\.|Transcri|LanguagePanel|LanguageButton|swapMicStream|onPeerJoined|onSocketReconnected|setMuted/.test(l));
  assert.ok(mine.length < 90, `feature lines in VideoCall.jsx: ${mine.length}`);
});

test("the call screen never logs transcript or caption text", () => {
  const near = src.split("\n").filter((l) => /(console|logger)\./.test(l) && /(caption|transcript|subtitle)/i.test(l) && /tr\.|state\.transcript|subtitle/.test(l));
  assert.deepEqual(near, []);
});

test("the direct-booking call screen is untouched (a later step)", () => {
  assert.doesNotMatch(direct, /features\/translation/);
});
