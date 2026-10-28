// Confirms the doctor enrollment wizard NO LONGER offers Change Email (it lives on the dashboard profile; see
// doctorProfileEmailChange.e2e.test.mjs). Mounts the REAL enrollment wizard in real Chromium, against the REAL doctor routes,
// token checks and refresh route over a throwaway in-memory MongoDB (see apiServer.mjs). Nothing is emailed, nothing leaves the machine
// and no remote database or secret is used.
//   node --test tests/e2e/doctorEmailChange/doctorEmailChange.e2e.test.mjs   (from frontend/)
// The tests skip themselves when Chromium (or Chrome/Edge) or the backend's dependencies are not installed.
// What this does NOT prove: that a real SMTP server delivers the OTP, or that production's MongoDB behaves the same.
// Secrets (OTPs, passwords, cookies, tokens) are never put in an assertion message, so a failure cannot print them.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { findBrowser } from "../adminAppointments/helpers.mjs";
import stubContexts from "../../ui-baseline/stubContexts.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, "..", "..", "..");
const require = createRequire(import.meta.url);

let chromium;
let createServer;
let reactPlugin;
let startApiServer;
let skipReason = "";
try {
  ({ chromium } = require("playwright-core"));
  ({ createServer } = await import("vite"));
  reactPlugin = (await import("@vitejs/plugin-react")).default;
  ({ startApiServer } = await import("./apiServer.mjs"));
  if (!findBrowser()) skipReason = "no Chromium found (npx playwright install chromium, or set CHROME_PATH)";
} catch (error) {
  skipReason = `missing dependency: ${String(error.message).split("\n")[0]}`;
}

const PASSWORD = "Passw0rd!e2e";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe("doctor Change Email in a real browser", { skip: skipReason || false }, () => {
  let api;
  let vite;
  let browser;
  let harnessUrl;
  const pageErrors = [];
  let seq = 0;
  const unique = (label) => `${label}-${Date.now().toString(36)}${++seq}@e2e.test`;

  const call = async (method, route, { body, token } = {}) => {
    const res = await fetch(api.url + route, {
      method,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch { /* empty body */ }
    return { status: res.status, body: json };
  };
  const otpFor = async (to) => (await call("GET", `/__otp?to=${encodeURIComponent(to)}`)).body.code;
  const mailsTo = async (to) => (await call("GET", `/__mails?to=${encodeURIComponent(to)}`)).body;
  const login = (email) => call("POST", "/api/doctor/login", { body: { email, password: PASSWORD } });

  // A disposable doctor, signed in inside a fresh browser context, with the wizard open on step 1.
  async function openAsDoctor() {
    const email = unique("old");
    const seeded = (await call("POST", "/__seed", { body: { email, password: PASSWORD } })).body;
    const context = await browser.newContext({ viewport: { width: 1300, height: 1000 } });
    // The real doctor-login page is not part of this harness; a stand-in answers that URL so the redirect can be observed.
    await context.route("**/doctor-login", (route) =>
      route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Doctor login</title><h1>Doctor login</h1>" }),
    );
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error" && !/Failed to load resource/.test(message.text())) pageErrors.push(message.text());
    });
    // Real login through the browser context's own cookie jar (HttpOnly cookies, as in the app).
    const res = await context.request.post(`${harnessUrl}/api/doctor/login`, { data: { email, password: PASSWORD } });
    assert.equal(res.status(), 200, "the test doctor can sign in");
    const tokens = await res.json();
    await page.goto(`${harnessUrl}/tests/e2e/doctorEmailChange/harness/index.html?doctorId=${seeded.id}`);
    await page.getByText("Verified via OTP").waitFor();
    return { context, page, email, id: seeded.id, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  const panel = (page) => ({
    open: () => page.getByRole("button", { name: "Change Email", exact: true }).click(),
    newEmail: page.getByPlaceholder("New email address"),
    otp: page.getByPlaceholder("6-digit OTP"),
    send: page.getByRole("button", { name: "Send OTP", exact: true }),
    resend: page.getByRole("button", { name: "Resend OTP", exact: true }),
    verify: page.getByRole("button", { name: "Verify", exact: true }),
    text: (re) => page.getByText(re).first(),
  });

  // Requests the OTP through the UI for `newEmail`, leaving the panel waiting for the code.
  async function requestOtp(page, newEmail) {
    const p = panel(page);
    await p.open();
    await p.newEmail.fill(newEmail);
    await p.send.click();
    await p.text(/An OTP has been sent to your new email address/).waitFor();
    return p;
  }

  before(async () => {
    api = await startApiServer();
    assert.ok(["127.0.0.1", "localhost"].includes(api.dbHost), "the test database is the local in-memory one");
    vite = await createServer({
      configFile: false,
      root: frontendRoot,
      logLevel: "silent",
      plugins: [stubContexts(), reactPlugin()],
      define: { "import.meta.env.VITE_API_URL": JSON.stringify("") },
      server: {
        port: 0,
        host: "127.0.0.1",
        hmr: false, // no live-reload socket in tests (its port-0 websocket is blocked by Chromium and floods the console)
        fs: { allow: [path.resolve(frontendRoot, "..")] },
        proxy: { "/api": { target: api.url, changeOrigin: false } },
      },
      optimizeDeps: { entries: ["tests/e2e/doctorEmailChange/harness/index.html"] },
    });
    await vite.listen();
    harnessUrl = vite.resolvedUrls.local[0].replace(/\/$/, "");
    browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
  });

  after(async () => {
    await browser?.close();
    await vite?.close();
    await api?.close();
    assert.deepEqual(pageErrors, [], "the page logged no errors");
  });

  test("the enrollment wizard has no Change Email action; the email is shown read-only", async () => {
    const d = await openAsDoctor();
    assert.equal(await d.page.getByRole("button", { name: /Change Email/ }).count(), 0, "no Change Email button");
    assert.equal(await d.page.getByPlaceholder("New email address").count(), 0, "no new-email input");
    assert.equal(await d.page.getByPlaceholder("6-digit OTP").count(), 0, "no OTP input");
    const box = d.page.locator('input[type="email"][readonly]').first();
    assert.equal(await box.inputValue(), d.email, "the verified email is still displayed");
    assert.ok(await box.isDisabled(), "and stays disabled");
    await d.context.close();
  });
});
