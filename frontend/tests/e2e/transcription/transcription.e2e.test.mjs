// The live transcript in real Chromium: two browser tabs (doctor and patient) with Chrome's fake microphone, the real hook, engine and
// screens, a fake Azure SDK, and a fake call socket between the tabs. What it proves:
//   • flag off = nothing: no request, no audio, no screen element
//   • notice shown and recorded on both sides
//   • the doctor picks German, the patient's recognizer starts translating into German, the doctor reads the German subtitle and sees it in the
//     transcript panel; the saved lines carry the English record
//   • muting stops the audio going to Azure and records a gap
//   • a page reload of one side: the other side tells it its language again
//   • Azure unreachable: the call goes on, the badge stays, the notice is still recorded, no crash
// Run from frontend/ (PowerShell or cmd):  npm run test:e2e:transcription
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { findBrowser } from "../adminAppointments/helpers.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, "..", "..", "..");
const require = createRequire(import.meta.url);

let chromium;
let createServer;
let reactPlugin;
let skipReason = "";
try {
  ({ chromium } = require("playwright-core"));
  ({ createServer } = await import("vite"));
  reactPlugin = (await import("@vitejs/plugin-react")).default;
  if (!findBrowser()) skipReason = "no Chromium found (npx playwright install chromium, or set CHROME_PATH)";
} catch (error) {
  skipReason = `missing dependency: ${String(error.message).split("\n")[0]}`;
}

const APPT = "64b7f0c2a1b2c3d4e5f60718";

describe("live transcript in two real browser tabs", { skip: skipReason || false }, () => {
  let vite;
  let browser;
  let base;
  let seq = 0;
  const pageErrors = [];

  const url = (role, extra = "") => `${base}/tests/e2e/transcription/harness/index.html?role=${role}&appt=${APPT}${extra}`;

  // A new browser context per test = a new "call": the tabs of one test share a BroadcastChannel, other tests cannot hear them.
  const newCall = async () => {
    const context = await browser.newContext({ permissions: ["microphone"], viewport: { width: 1280, height: 720 } });
    const open = async (role, extra = "") => {
      const page = await context.newPage();
      page.on("pageerror", (e) => pageErrors.push(`${role}: ${e}`));
      await page.goto(url(role, `${extra}&n=${++seq}`));
      return page;
    };
    return { context, open };
  };

  const liveRecognizer = (page) =>
    page.waitForFunction(() => (window.__sdk?.log.recognizers || []).some((r) => r.started && !r.closed)).then(() =>
      page.evaluateHandle(() => window.__sdk.log.recognizers.filter((r) => r.started && !r.closed).at(-1)));
  const hc = (page, fn) => page.evaluate(fn);
  const bodyText = (page) => page.locator("body").innerText();
  const posts = (page, needle) => hc(page, `window.__hc.requests.filter((r) => r.method === "POST" && r.url.includes(${JSON.stringify(needle)}))`);

  before(async () => {
    vite = await createServer({
      configFile: false,
      root: frontendRoot,
      logLevel: "silent",
      plugins: [reactPlugin()],
      resolve: { alias: { "microsoft-cognitiveservices-speech-sdk": path.join(here, "harness", "fakeSpeechSdk.mjs") } },
      define: { "import.meta.env.VITE_API_URL": JSON.stringify("") },
      server: { port: 0, host: "127.0.0.1", fs: { allow: [path.resolve(frontendRoot, "..")] } },
      optimizeDeps: { entries: ["tests/e2e/transcription/harness/index.html"] },
    });
    await vite.listen();
    base = vite.resolvedUrls.local[0].replace(/\/$/, "");
    browser = await chromium.launch({
      executablePath: findBrowser(),
      headless: true,
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
    });
  });

  after(async () => {
    await browser?.close();
    await vite?.close();
  });

  test("flag off: no request, no audio, no element, no message to the other side", async () => {
    const { context, open } = await newCall();
    const page = await open("doctor", "&flag=off");
    await page.waitForFunction(() => window.__hc.gum >= 1);
    await page.waitForTimeout(800);
    const seen = await hc(page, "({ requests: window.__hc.requests.length, audio: window.__hc.audioContexts, bus: window.__hc.busMessages, sdk: Boolean(window.__sdk) })");
    assert.deepEqual(seen, { requests: 0, audio: 0, bus: 0, sdk: false });
    assert.doesNotMatch(await bodyText(page), /Transcribing|Language|Transcript/);
    assert.equal(await page.locator(".hc-tr__badge").count(), 0);
    await context.close();
  });

  test("both sides see the notice and the server gets one notice record from each", async () => {
    const { context, open } = await newCall();
    const doctor = await open("doctor");
    const patient = await open("patient");
    for (const page of [doctor, patient]) {
      await page.getByText("This call is being transcribed.").waitFor();
      await page.getByText("Transcribing", { exact: true }).waitFor();
      await page.waitForFunction(() => window.__hc.requests.some((r) => r.url.includes("transcript-notice")));
    }
    assert.equal((await posts(doctor, "transcript-notice")).length, 1);
    assert.equal((await posts(patient, "transcript-notice")).length, 1);
    // the notice can be closed; the badge stays
    await doctor.getByRole("button", { name: "Close this notice" }).click();
    assert.equal(await doctor.getByText("This call is being transcribed.").count(), 0);
    assert.equal(await doctor.getByText("Transcribing", { exact: true }).count(), 1);
    await context.close();
  });

  test("doctor reads German: the patient's recognizer translates into German, the doctor sees the German subtitle, the English record is saved", async () => {
    const { context, open } = await newCall();
    const doctor = await open("doctor", "&lang=de-DE");
    const patient = await open("patient", "&lang=hi-IN");
    await liveRecognizer(patient);

    // default = Real voice (no translation)
    await doctor.getByRole("button", { name: /Language/ }).click();
    const realVoice = doctor.getByRole("radio", { name: /Real voice \(no translation\)/ });
    assert.equal(await realVoice.getAttribute("aria-checked"), "true");
    await doctor.getByRole("radio", { name: /^German/ }).click();
    await doctor.waitForFunction(() => window.__hc.state().readLang === "de");

    // the patient's side learns it and adds German to the RUNNING recognizer
    await patient.waitForFunction(() => window.__hc.state().peerReadLang === "de");
    await patient.waitForFunction(() => window.__sdk.log.recognizers.some((r) => r.targetLanguages.includes("de")));

    // the patient speaks Hindi; Azure (fake) returns the Hindi text with English and German translations
    const rec = await liveRecognizer(patient);
    await rec.evaluate((r) => r.finish("मुझे सिरदर्द है", { en: "I have a headache", de: "Ich habe Kopfschmerzen" }, { lang: "hi-IN", conf: 0.92, durationMs: 1800 }));

    await doctor.getByText("Ich habe Kopfschmerzen").first().waitFor();
    assert.match(await bodyText(doctor), /Machine-translated, may contain errors/);

    // the doctor's transcript panel lists it with who said it
    await doctor.getByRole("button", { name: /Transcript/ }).click();
    const panel = doctor.getByRole("dialog", { name: "Live transcript" });
    await panel.getByText("मुझे सिरदर्द है").waitFor();
    await panel.getByText("Ich habe Kopfschmerzen").waitFor();
    assert.match(await panel.innerText(), /Patient/);

    // what the patient's browser saved: the original and the ENGLISH record (not German)
    await patient.waitForFunction(() => window.__hc.requests.some((r) => r.url.endsWith("/transcript") && r.method === "POST"), null, { timeout: 15000 });
    const lines = (await posts(patient, "/transcript")).filter((r) => !r.url.includes("notice")).flatMap((r) => r.body.items);
    const line = lines.find((l) => l.type === "line");
    assert.ok(line, "a line was uploaded");
    assert.equal(line.original, "मुझे सिरदर्द है");
    assert.equal(line.translations.en, "I have a headache");
    assert.equal(line.translations.de, "Ich habe Kopfschmerzen"); // the reader's language is kept next to the English record
    await context.close();
  });

  test("muting stops the audio going to Azure and records a gap; unmuting resumes", async () => {
    const { context, open } = await newCall();
    const patient = await open("patient");
    await open("doctor");
    await liveRecognizer(patient);
    const sent = () => patient.evaluate("window.__sdk.log.pushes.reduce((n, p) => n + p.written.length, 0)");
    await patient.waitForTimeout(600);
    const flowing1 = await sent();
    await patient.waitForTimeout(600);
    assert.ok((await sent()) > flowing1, "audio flows to the recognizer while not muted");

    await patient.locator("#mute").click();
    await patient.waitForFunction(() => window.__hc.state().muted === true);
    await patient.waitForTimeout(400);
    const frozen = await sent();
    await patient.waitForTimeout(800);
    assert.equal(await sent(), frozen, "no audio is sent while muted");

    await patient.locator("#mute").click();
    await patient.waitForFunction(() => window.__hc.state().muted === false);
    await patient.waitForTimeout(800);
    assert.ok((await sent()) > frozen, "audio resumes after unmuting");

    await patient.waitForFunction(() => window.__hc.requests.some((r) => r.url.endsWith("/transcript") && r.body.items.some((i) => i.type === "gap")), null, { timeout: 20000 });
    const items = (await posts(patient, "/transcript")).filter((r) => !r.url.includes("notice")).flatMap((r) => r.body.items);
    assert.equal(items.find((i) => i.type === "gap").reason, "muted");
    await context.close();
  });

  test("a reloaded tab is told the other side's language again", async () => {
    const { context, open } = await newCall();
    const doctor = await open("doctor");
    const patient = await open("patient");
    await patient.getByRole("button", { name: /Language/ }).click();
    await patient.getByRole("radio", { name: /^Hindi/ }).click();
    await doctor.waitForFunction(() => window.__hc.state().peerReadLang === "hi");
    await doctor.reload();
    await doctor.waitForFunction(() => window.__hc.state().phase === "running");
    await doctor.waitForFunction(() => window.__hc.state().peerReadLang === "hi", null, { timeout: 15000 });
    await context.close();
  });

  test("Azure unreachable: the call goes on, the badge and the notice stay, the notice is still recorded, no page error", async () => {
    const before = pageErrors.length;
    const { context, open } = await newCall();
    const doctor = await open("doctor", "&sdk=down");
    await doctor.waitForFunction(() => window.__hc.state().phase === "unavailable");
    assert.match(await bodyText(doctor), /Transcribing/);
    await doctor.waitForFunction(() => window.__hc.requests.some((r) => r.url.includes("transcript-notice")));
    assert.equal(pageErrors.length, before, pageErrors.slice(before).join("\n"));
    await context.close();
  });

  test("no page error in any test", () => {
    assert.deepEqual(pageErrors, []);
  });
});
