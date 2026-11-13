// The REAL video-call page (frontend/src/pages/VideoCall.jsx) with a doctor and a patient in two real Chromium browsers, against the REAL
// backend (node server.js + in-memory MongoDB + Socket.IO), with Chromium's fake camera and microphone. The call must connect
// with the transcription flags OFF (exactly as before) and ON.
// Run from frontend/:  npm run test:e2e:video-call     (E2E_SHOT_DIR=<dir> also saves screenshots; E2E_CALL_DEBUG=1 prints page logs)
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
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
let tailwind;
let startStack;
let skipReason = "";
try {
  ({ chromium } = require("playwright-core"));
  ({ createServer } = await import("vite"));
  reactPlugin = (await import("@vitejs/plugin-react")).default;
  tailwind = (await import("@tailwindcss/vite")).default;
  ({ startStack } = require("../../../../backend/tests/helpers/signalingStack.js"));
  if (!findBrowser()) skipReason = "no Chromium found (npx playwright install chromium, or set CHROME_PATH)";
} catch (error) {
  skipReason = `missing dependency: ${String(error.message).split("\n")[0]}`;
}

const freePort = () => new Promise((resolve, reject) => {
  const srv = net.createServer();
  srv.once("error", reject);
  srv.listen(0, "127.0.0.1", () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
});

function suite(label, flagOn) {
  describe(`video call connects: ${label}`, { skip: skipReason || false }, () => {
    let stack;
    let vite;
    let browser;
    let viteUrl;
    let doctorPage;
    let patientPage;
    const logs = { doctor: [], patient: [] };
    const emptyEnvDir = fs.mkdtempSync(path.join(os.tmpdir(), "hc-empty-env-")); // never read the developer's real .env files

    async function newPlayer(role) {
      const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, permissions: ["camera", "microphone"] });
      const login = role === "doctor" ? "/api/doctor/login" : "/api/auth/login";
      const res = await context.request.post(viteUrl + login, { data: stack.creds[role] });
      assert.equal(res.ok(), true, `${role} login failed: ${res.status()}`);
      const page = await context.newPage();
      page.on("pageerror", (e) => logs[role].push("PAGEERROR " + e));
      page.on("console", (m) => {
        const text = m.text();
        if (process.env.E2E_CALL_DEBUG) console.log(`[${role}] ${m.type()}: ${text.slice(0, 300)}`);
        logs[role].push(`${m.type()}: ${text}`);
      });
      return page;
    }

    before(async () => {
      const vitePort = await freePort();
      viteUrl = `http://127.0.0.1:${vitePort}`;
      stack = await startStack({
        env: {
          FRONTEND_URL: viteUrl,
          CORS_ALLOWED_ORIGINS: viteUrl,
          TRANSCRIPTION_ENABLED: flagOn ? "true" : "false",
          AZURE_SPEECH_KEY: "dummy-key-not-used",
          AZURE_SPEECH_REGION: "eastus",
        },
      });
      vite = await createServer({
        configFile: false,
        root: frontendRoot,
        envDir: emptyEnvDir,
        logLevel: "silent",
        plugins: [reactPlugin(), tailwind()],
        define: {
          "import.meta.env.VITE_API_URL": JSON.stringify(""),
          "import.meta.env.VITE_TRANSCRIPTION_ENABLED": JSON.stringify(flagOn ? "true" : "false"),
          __API_URL__: JSON.stringify(stack.baseUrl),
        },
        server: {
          port: vitePort,
          strictPort: true,
          host: "127.0.0.1",
          fs: { allow: [path.resolve(frontendRoot, "..")] },
          proxy: {
            "/api": { target: stack.baseUrl, changeOrigin: false },
            "/socket.io": { target: stack.baseUrl, changeOrigin: false, ws: true },
          },
        },
      });
      await vite.listen();
      browser = await chromium.launch({
        executablePath: findBrowser(),
        headless: true,
        args: [
          "--use-fake-ui-for-media-stream",
          "--use-fake-device-for-media-stream",
          "--autoplay-policy=no-user-gesture-required",
          "--disable-features=WebRtcHideLocalIpsWithMdns",
        ],
      });
      doctorPage = await newPlayer("doctor");
      patientPage = await newPlayer("patient");
    });

    after(async () => {
      await browser?.close();
      await vite?.close();
      await stack?.stop();
      fs.rmSync(emptyEnvDir, { recursive: true, force: true });
    });

    // The remote audio element exists only for the other person's stream: live audio there = we are connected.
    const remoteAudio = () => {
      const a = document.querySelector("audio");
      const tracks = a && a.srcObject ? a.srcObject.getAudioTracks() : [];
      return { has: tracks.length > 0, live: tracks.some((t) => t.readyState === "live"), muted: a ? a.muted : null, volume: a ? a.volume : null };
    };

    test("doctor and patient connect, hear each other, and nothing has been muted", async () => {
      const id = stack.ids.appointmentId;
      await patientPage.goto(`${viteUrl}/video-call/${id}?role=user`);
      await doctorPage.goto(`${viteUrl}/video-call/${id}?role=doctor`);
      const waitConnected = async (page, who) => {
        try {
          await page.waitForFunction(() => {
            const a = document.querySelector("audio");
            return Boolean(a && a.srcObject && a.srcObject.getAudioTracks().some((t) => t.readyState === "live"));
          }, null, { timeout: 60000 });
        } catch (error) {
          if (process.env.E2E_SHOT_DIR) {
            fs.mkdirSync(process.env.E2E_SHOT_DIR, { recursive: true });
            await page.screenshot({ path: path.join(process.env.E2E_SHOT_DIR, `call-${label.replace(/\W+/g, "-")}-${who}-FAILED.png`) });
          }
          const text = await page.evaluate(() => document.body.innerText.slice(0, 600)).catch(() => "");
          throw new Error(`${who} never got the other person's audio.\nPAGE TEXT: ${text}\nLAST LOGS:\n${logs[who].slice(-25).join("\n")}\nSERVER LOG TAIL:\n${stack.logs().slice(-1500)}`);
        }
      };
      await Promise.all([waitConnected(patientPage, "patient"), waitConnected(doctorPage, "doctor")]);
      for (const page of [patientPage, doctorPage]) {
        const a = await page.evaluate(remoteAudio);
        assert.equal(a.live, true);
        assert.equal(a.muted, false, "the other person's voice is NOT muted by default (no translation picked)");
      }
      if (process.env.E2E_SHOT_DIR) {
        fs.mkdirSync(process.env.E2E_SHOT_DIR, { recursive: true });
        await doctorPage.screenshot({ path: path.join(process.env.E2E_SHOT_DIR, `call-${label.replace(/\W+/g, "-")}-doctor.png`) });
      }
    });

    test("no page errors on either side", async () => {
      // "License expired" is thrown by a third-party library on this page in BOTH modes (it is there with the flag off too), not by the call.
      const bad = (l) => l.filter((x) => /^PAGEERROR/.test(x) && !/License expired/.test(x));
      assert.deepEqual(bad(logs.doctor), []);
      assert.deepEqual(bad(logs.patient), []);
    });

    test(flagOn ? "flag ON: the transcript controls are on the call screen, the call stays connected" : "flag OFF: no transcript controls and no transcript requests at all", async () => {
      const hasLanguage = async (page) => (await page.getByRole("button", { name: /language/i }).count()) > 0;
      if (flagOn) {
        await doctorPage.getByRole("button", { name: /language/i }).first().waitFor({ timeout: 20000 });
        assert.equal(await hasLanguage(patientPage), true);
      } else {
        assert.equal(await hasLanguage(doctorPage), false);
        assert.equal(await hasLanguage(patientPage), false);
        assert.doesNotMatch(logs.doctor.concat(logs.patient).join("\n"), /transcri/i);
      }
      const a = await doctorPage.evaluate(remoteAudio);
      assert.equal(a.live, true);
    });
  });
}

suite("transcription flags OFF (as before)", false);
suite("transcription flags ON", true);
