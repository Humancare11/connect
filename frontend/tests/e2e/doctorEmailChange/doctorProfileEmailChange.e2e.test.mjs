// Browser-level tests of Change Email inside the REAL doctor dashboard profile page (DoctorProfile) for an APPROVED doctor, and of
// what happens next on the REAL doctor login page (DoctorLogin). Both run under the real DoctorAuthProvider, against the real doctor
// routes and token checks over a throwaway in-memory MongoDB (apiServer.mjs). Nothing is emailed; no remote database or secret.
//   node --test tests/e2e/doctorEmailChange/doctorProfileEmailChange.e2e.test.mjs   (from frontend/)
// Not mounted: the dashboard layout/sidebar around the profile page, and the dashboard itself after sign-in (a one-line stand-in
// is shown). Not proven: real SMTP delivery, production MongoDB. Secrets are never put in assertion messages.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { findBrowser } from "../adminAppointments/helpers.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, "..", "..", "..");
const require = createRequire(import.meta.url);
const HARNESS = "/tests/e2e/doctorEmailChange/harness";

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Vite's live-reload client cannot open its websocket in this throwaway server; that is test-server noise, not the app.
const VITE_CLIENT_NOISE = /WebSocket connection|\[vite\]|reading 'send'/;
const PASSWORD = "Passw0rd!e2e";

describe("Change Email from the doctor dashboard profile", { skip: skipReason || false }, () => {
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
  const stored = async (id) => (await call("GET", `/__doctor/${id}`)).body;

  // An approved doctor signed in inside a fresh browser context, with the real profile page open and the real login page
  // (not a placeholder) served at /doctor-login.
  async function openProfile() {
    const email = unique("old");
    const seeded = (await call("POST", "/__seed", { body: { email, password: PASSWORD, approved: true } })).body;
    const context = await browser.newContext({ viewport: { width: 1300, height: 1100 } });
    await context.route("https://accounts.google.com/**", (route) => route.abort());
    await context.route("**/doctor-login", async (route) => {
      const html = await (await fetch(`${harnessUrl}${HARNESS}/login.html`)).text();
      await route.fulfill({ contentType: "text/html", body: html.replace("<head>", `<head><base href="${HARNESS}/">`) });
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => { if (!VITE_CLIENT_NOISE.test(String(error))) pageErrors.push(String(error)); });
    page.on("console", (message) => {
      if (message.type() === "error" && !/Failed to load resource|accounts\.google\.com/.test(message.text()) && !VITE_CLIENT_NOISE.test(message.text())) pageErrors.push(message.text());
    });
    const res = await context.request.post(`${harnessUrl}/api/doctor/login`, { data: { email, password: PASSWORD } });
    assert.equal(res.status(), 200, "the test doctor can sign in");
    await page.goto(`${harnessUrl}${HARNESS}/profile.html`);
    await page.getByRole("button", { name: "Edit Profile", exact: true }).waitFor();
    return { context, page, email, id: seeded.id };
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
  // Profile page open in edit mode, ready for the Change Email panel.
  async function openProfileEditor() {
    const d = await openProfile();
    await d.page.getByRole("button", { name: "Edit Profile", exact: true }).click();
    await d.page.getByRole("button", { name: "Change Email", exact: true }).waitFor();
    return d;
  }
  const login = (email) => call("POST", "/api/doctor/login", { body: { email, password: PASSWORD } });
  async function requestOtp(page, newEmail) {
    const p = panel(page);
    await p.open();
    await p.newEmail.fill(newEmail);
    await p.send.click();
    await p.text(/An OTP has been sent to your new email address/).waitFor();
    return p;
  }
  const emailBox = (page) => page.locator('.drprofile__field:has(label:text-is("Email")) input[type="email"]').first();

  before(async () => {
    api = await startApiServer();
    assert.ok(["127.0.0.1", "localhost"].includes(api.dbHost), "the test database is the local in-memory one");
    vite = await createServer({
      configFile: false,
      root: frontendRoot,
      logLevel: "silent",
      plugins: [reactPlugin()],
      define: { "import.meta.env.VITE_API_URL": JSON.stringify("") },
      server: {
        port: 0,
        host: "127.0.0.1",
        hmr: false, // no live-reload socket in tests (its port-0 websocket is blocked by Chromium and floods the console)
        fs: { allow: [path.resolve(frontendRoot, "..")] },
        proxy: { "/api": { target: api.url, changeOrigin: false } },
      },
      // Bundle both pages up front so the first navigation in a test is not spent compiling them.
      warmup: { clientFiles: [`./tests/e2e/doctorEmailChange/harness/profileMain.jsx`, `./tests/e2e/doctorEmailChange/harness/loginMain.jsx`] },
      optimizeDeps: { entries: [`tests/e2e/doctorEmailChange/harness/profile.html`, `tests/e2e/doctorEmailChange/harness/login.html`] },
    });
    await vite.listen();
    harnessUrl = vite.resolvedUrls.local[0].replace(/\/$/, "");
    browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
  });

  after(async () => {
    await browser?.close();
    await vite?.close();
    await api?.close();
    assert.deepEqual(pageErrors, [], "the pages logged no errors");
  });

  test("an approved doctor reaches Change Email from the profile editor; the email box cannot be edited", async () => {
    const d = await openProfile();
    await d.page.getByRole("button", { name: "Edit Profile", exact: true }).click();
    const box = emailBox(d.page);
    assert.equal(await box.inputValue(), d.email, "the current email is shown");
    assert.equal(await box.getAttribute("readonly"), "", "the email box is read-only");
    await box.click();
    await d.page.keyboard.type("typed@e2e.test");
    assert.equal(await box.inputValue(), d.email, "typing does not change it");
    await d.page.getByRole("button", { name: "Change Email", exact: true }).waitFor();
    await d.context.close();
  });

  test("saving other fields works, never sends the email, and a stale form cannot restore the old email", async () => {
    const d = await openProfile();
    await d.page.getByRole("button", { name: "Edit Profile", exact: true }).click();
    const firstName = d.page.locator('.drprofile__field:has(label:text-is("First Name")) input').first();
    await firstName.fill("Renamed");

    // The email changes elsewhere while this form (holding the OLD email) is still open; the session stays valid.
    const newEmail = unique("new");
    await call("POST", "/__set-email", { body: { id: d.id, email: newEmail } });

    const [request, response] = await Promise.all([
      d.page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/api/doctor/enrollment")),
      d.page.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith("/api/doctor/enrollment")),
      d.page.getByRole("button", { name: "Save Changes", exact: true }).click(),
    ]);
    assert.ok(!("email" in JSON.parse(request.postData())), "the save request carries no email");
    assert.ok([200, 201].includes(response.status()), "the save succeeded");
    const after = await stored(d.id);
    assert.equal(after.email, newEmail, "the canonical email was not overwritten");
    assert.equal(after.enrollmentEmail, newEmail, "neither was the enrollment copy");
    assert.ok(after.pendingFields.includes("firstName"), "the other edit was saved (as an approved doctor's update request)");
    assert.ok(!after.pendingFields.includes("email"), "no email change was staged");
    await d.context.close();
  });

  test("OTP flow from the profile: the right endpoints, validation and errors, then cleanup, redirect and the real login page", async () => {
    const d = await openProfile();
    const newEmail = unique("new");
    const posts = [];
    d.page.on("request", (r) => { if (r.method() === "POST") posts.push(new URL(r.url()).pathname); });
    // Browser storage: a doctor-specific key must go, an unrelated display preference must stay.
    await d.page.evaluate((id) => {
      localStorage.setItem(`profile-status-seen-${id}`, "x");
      localStorage.setItem("hc-livechat-theme", "dark");
    }, d.id);

    await d.page.getByRole("button", { name: "Edit Profile", exact: true }).click();
    const p = panel(d.page);
    await p.open();

    await p.newEmail.fill("not-an-email");
    await p.send.click();
    await p.text(/Enter a valid email address\./).waitFor();
    assert.ok(!posts.some((u) => u.includes("email-change")), "invalid input never reaches the server");

    await p.newEmail.fill(d.email);
    await p.send.click();
    await p.text(/must be different from your current email/).waitFor();

    await p.newEmail.fill(newEmail);
    await p.send.click();
    await p.text(/An OTP has been sent to your new email address/).waitFor();
    assert.ok(posts.includes("/api/doctor/profile/email-change/request"));
    assert.equal((await mailsTo(newEmail)).length, 1);
    assert.equal((await mailsTo(d.email)).length, 0);

    await p.resend.click();
    await p.text(/Please wait before requesting another OTP/).waitFor();

    await p.otp.fill("12ab34");
    assert.equal(await p.otp.inputValue(), "1234", "non-digits are filtered out");
    await p.verify.click();
    await p.text(/Enter the 6-digit OTP\./).waitFor();

    const code = await otpFor(newEmail);
    await p.otp.fill(code === "000000" ? "999999" : "000000");
    await p.verify.click();
    await p.text(/Invalid OTP/).waitFor();
    assert.equal((await stored(d.id)).email, d.email, "a wrong OTP changes nothing");

    await p.otp.fill(code);
    await p.verify.click();
    assert.equal(await d.page.getByRole("status").count(), 0, "no success message before the change");
    await d.page.getByRole("status").filter({ hasText: "Your email has been updated successfully. Please log in using your new email address." }).waitFor();
    assert.ok(!/doctor-login/.test(d.page.url()), "the confirmation is visible before the redirect");
    assert.ok(posts.includes("/api/doctor/profile/email-change/verify"));
    await d.page.waitForURL("**/doctor-login", { timeout: 20000, waitUntil: "commit" });

    // Client cleanup ran (the same cleanup as a normal sign-out) and kept the unrelated preference.
    const keys = await d.page.evaluate(() => ({ seen: Object.keys(localStorage).filter((k) => k.startsWith("profile-status-seen-")), theme: localStorage.getItem("hc-livechat-theme") }));
    assert.deepEqual(keys.seen, [], "doctor-specific browser data was cleared");
    assert.equal(keys.theme, "dark", "an unrelated display preference was kept");

    // The REAL login page is showing, with none of the old signed-in profile UI.
    await d.page.locator("#doctor-login-email").waitFor({ timeout: 60000 }); // first load of this page may be bundled on demand
    assert.equal(await d.page.locator(".drprofile").count(), 0, "the old profile UI is gone");

    // The old email is refused by the real form; the new one signs in (the real page then goes to /doctor-dashboard).
    await d.page.locator("#doctor-login-email").fill(d.email);
    await d.page.locator("#doctor-login-password").fill(PASSWORD);
    await d.page.locator('form:has(#doctor-login-email) button[type="submit"]').click();
    await d.page.locator("#doctor-login-error").waitFor();
    await d.page.locator("#doctor-login-email").fill(newEmail);
    await d.page.locator("#doctor-login-password").fill(PASSWORD);
    await d.page.locator('form:has(#doctor-login-email) button[type="submit"]').click();
    await d.page.getByTestId("dashboard-standin").waitFor();
    const final = await stored(d.id);
    assert.equal(final.email, newEmail);
    assert.equal(final.enrollmentEmail, newEmail);
    await d.context.close();
  });

  test("an address that belongs to another doctor is refused from the profile too", async () => {
    const other = unique("other");
    await call("POST", "/__seed", { body: { email: other, password: PASSWORD, name: "Dr Someone Else" } });
    const d = await openProfile();
    await d.page.getByRole("button", { name: "Edit Profile", exact: true }).click();
    const p = panel(d.page);
    await p.open();
    await p.newEmail.fill(other);
    await p.send.click();
    await p.text(/can't be used/).waitFor();
    assert.equal(await d.page.getByText(/Someone Else/).count(), 0);
    assert.equal((await mailsTo(other)).length, 0);
    await d.context.close();
  });

  test("an expired OTP is refused and the email is unchanged", async () => {
    const d = await openProfileEditor();
    const newEmail = unique("new");
    const p = await requestOtp(d.page, newEmail);
    const code = await otpFor(newEmail);
    await call("POST", "/__expire-challenge", { body: { doctorId: d.id } });
    await p.otp.fill(code);
    await p.verify.click();
    await p.text(/OTP has expired/).waitFor();
    assert.equal((await call("GET", `/__doctor/${d.id}`)).body.email, d.email);
    await d.context.close();
  });

  test("an OTP cannot be reused after a successful change", async () => {
    const d = await openProfileEditor();
    const newEmail = unique("new");
    const p = await requestOtp(d.page, newEmail);
    const code = await otpFor(newEmail);
    await p.otp.fill(code);
    await p.verify.click();
    await d.page.waitForURL("**/doctor-login", { timeout: 10000 });
    // Replay from a fresh session (the old one is gone): the challenge has been consumed.
    const fresh = (await login(newEmail)).body.accessToken;
    const replay = await call("POST", "/api/doctor/profile/email-change/verify", { token: fresh, body: { newEmail, otp: code } });
    assert.equal(replay.status, 400);
    await d.context.close();
  });

  test("a failed email delivery is reported as a failure, never as sent", async () => {
    const d = await openProfileEditor();
    const newEmail = unique("new");
    await call("POST", "/__mail-fail", { body: { fail: true } });
    try {
      const p = panel(d.page);
      await p.open();
      await p.newEmail.fill(newEmail);
      await p.send.click();
      await p.text(/couldn't send the OTP/).waitFor();
      assert.equal(await d.page.getByText(/has been sent/).count(), 0);
      assert.equal(await p.otp.count(), 0);
    } finally {
      await call("POST", "/__mail-fail", { body: { fail: false } });
    }
    assert.equal((await call("GET", `/__doctor/${d.id}`)).body.email, d.email);
    await d.context.close();
  });

  test("repeated wrong OTPs lock the code: even the right one is then refused", async () => {
    const d = await openProfileEditor();
    const newEmail = unique("new");
    const p = await requestOtp(d.page, newEmail);
    const code = await otpFor(newEmail);
    const wrong = code === "000000" ? "999999" : "000000";
    for (let i = 0; i < 5; i += 1) {
      await p.otp.fill(wrong);
      await p.verify.click();
      await p.text(/Invalid OTP/).waitFor();
      await sleep(50); // let the busy state clear before the next click
    }
    await p.otp.fill(code);
    await p.verify.click();
    await p.text(/Too many incorrect attempts/).waitFor();
    assert.equal((await call("GET", `/__doctor/${d.id}`)).body.email, d.email);
    await d.context.close();
  });
});
