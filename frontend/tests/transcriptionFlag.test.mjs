// Live transcript feature flag (frontend). Run: node --test tests/transcriptionFlag.test.mjs  (from frontend/)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG_PATH, INACTIVE, isTranscriptionBuildEnabled, normalizeServerConfig, loadTranscriptionConfig } from "../src/features/translation/featureFlag.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const failingHttp = () => ({ get: async () => { throw new Error("no request was expected"); }, calls: 0 });
function http(answer) {
  const calls = [];
  return { calls, get: async (url, options) => { calls.push({ url, options }); if (answer instanceof Error) throw answer; return { data: answer }; } };
}

test("the build flag is OFF unless it is exactly 'true' (any case)", () => {
  assert.equal(isTranscriptionBuildEnabled({}), false);
  assert.equal(isTranscriptionBuildEnabled(undefined) === false || isTranscriptionBuildEnabled(undefined) === true, true, "does not throw without Vite");
  for (const v of ["", "false", "0", "1", "yes", "on", "TRUE1", " "]) assert.equal(isTranscriptionBuildEnabled({ VITE_TRANSCRIPTION_ENABLED: v }), false, JSON.stringify(v));
  for (const v of ["true", "TRUE", " True "]) assert.equal(isTranscriptionBuildEnabled({ VITE_TRANSCRIPTION_ENABLED: v }), true, JSON.stringify(v));
});

test("in plain Node (no Vite), with nothing set, the feature is off", () => {
  assert.equal(isTranscriptionBuildEnabled(), false);
});

test("build flag OFF: the answer is inactive and NO request is made", async () => {
  const h = http({ enabled: true, mode: "notice", noticeVersion: "v1" });
  const out = await loadTranscriptionConfig({ http: h, buildEnabled: false });
  assert.deepEqual(out, INACTIVE);
  assert.equal(h.calls.length, 0, "flag off = today's behaviour: not even a network call");
  assert.deepEqual(await loadTranscriptionConfig({ http: failingHttp(), buildEnabled: false }), INACTIVE);
  assert.deepEqual(await loadTranscriptionConfig({ http: failingHttp() }), INACTIVE, "default build flag is off in tests");
});

test("build flag ON and server ON: active, with the mode and wording version the server gave", async () => {
  const h = http({ enabled: true, mode: "notice", noticeVersion: "v1" });
  const out = await loadTranscriptionConfig({ http: h, buildEnabled: true });
  assert.deepEqual(out, { active: true, buildEnabled: true, serverEnabled: true, mode: "notice", noticeVersion: "v1" });
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].url, CONFIG_PATH);
  assert.equal(CONFIG_PATH, "/api/transcription/config");
  const consent = await loadTranscriptionConfig({ http: http({ enabled: true, mode: "consent", noticeVersion: "v2" }), buildEnabled: true });
  assert.deepEqual([consent.active, consent.mode, consent.noticeVersion], [true, "consent", "v2"]);
});

test("build flag ON but server OFF: inactive (the server switch wins)", async () => {
  const out = await loadTranscriptionConfig({ http: http({ enabled: false, mode: "notice", noticeVersion: "v1" }), buildEnabled: true });
  assert.equal(out.active, false);
  assert.equal(out.buildEnabled, true);
  assert.equal(out.serverEnabled, false);
});

test("only the boolean true from the server turns it on", async () => {
  for (const enabled of ["true", 1, "yes", null, undefined, {}, []]) {
    const out = await loadTranscriptionConfig({ http: http({ enabled, mode: "notice" }), buildEnabled: true });
    assert.equal(out.active, false, JSON.stringify(enabled));
  }
});

test("any problem asking the server leaves the feature off and never throws", async () => {
  for (const answer of [new Error("Network Error"), Object.assign(new Error("401"), { response: { status: 401 } }), Object.assign(new Error("429"), { response: { status: 429 } })]) {
    const out = await loadTranscriptionConfig({ http: http(answer), buildEnabled: true });
    assert.deepEqual(out, { ...INACTIVE, buildEnabled: true });
  }
  for (const garbage of [null, undefined, "yes", 7, [], [{ enabled: true }]]) {
    const out = await loadTranscriptionConfig({ http: http(garbage), buildEnabled: true });
    assert.equal(out.active, false, JSON.stringify(garbage));
  }
  assert.equal((await loadTranscriptionConfig({ buildEnabled: true })).active, false, "no client given");
  assert.equal((await loadTranscriptionConfig({ http: {}, buildEnabled: true })).active, false);
  assert.equal((await loadTranscriptionConfig()).active, false);
});

test("an unknown mode or a strange wording version falls back to the safe defaults", () => {
  assert.deepEqual(normalizeServerConfig({ enabled: true, mode: "concent", noticeVersion: "<script>" }), { serverEnabled: true, mode: "notice", noticeVersion: "v1" });
  assert.deepEqual(normalizeServerConfig({ enabled: true, mode: "consent", noticeVersion: "v3" }), { serverEnabled: true, mode: "consent", noticeVersion: "v3" });
  assert.deepEqual(normalizeServerConfig({ enabled: true, noticeVersion: "x".repeat(40) }), { serverEnabled: true, mode: "notice", noticeVersion: "v1" });
  assert.equal(normalizeServerConfig(null), null);
  assert.equal(normalizeServerConfig([]), null);
});

test("the abort signal is passed on when given", async () => {
  const h = http({ enabled: true });
  const controller = new AbortController();
  await loadTranscriptionConfig({ http: h, buildEnabled: true, signal: controller.signal });
  assert.equal(h.calls[0].options.signal, controller.signal);
});

test("static: the flag module loads nothing heavy and the repo does not turn the flag on", () => {
  const src = fs.readFileSync(path.join(root, "src/features/translation/featureFlag.js"), "utf8");
  assert.equal(/from\s+["']microsoft-cognitiveservices-speech-sdk/.test(src), false, "the speech SDK is never imported by the flag module");
  assert.equal(/import\s*\(/.test(src), false);
  assert.equal(/\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(src), false, "all requests go through the injected client");
  for (const name of ["package.json", "vite.config.js"]) {
    assert.equal(/VITE_TRANSCRIPTION_ENABLED\s*[=:]\s*["']?true/i.test(fs.readFileSync(path.join(root, name), "utf8")), false, name);
  }
  for (const name of [".env", ".env.production", ".env.local"]) {
    const p = path.join(root, name);
    if (fs.existsSync(p)) assert.equal(/^VITE_TRANSCRIPTION_ENABLED\s*=\s*true/im.test(fs.readFileSync(p, "utf8")), false, `${name} must not enable the feature`);
  }
});
