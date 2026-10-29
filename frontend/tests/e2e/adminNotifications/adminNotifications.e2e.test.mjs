// Browser-level tests of the admin notification bell: the REAL admin layout and bell, in real Chromium, against the
// backend's REAL notification API and REAL producer routes (doctor registration/enrollment, support tickets, partner
// cases) over a throwaway in-memory MongoDB (see apiServer.mjs). Appointment and category-consultation notifications go
// through the real notifier functions the booking controllers call (createAppointment needs Stripe and a replica set).
// Emails are recorded, not sent; the direct-call half of the bell is answered "none"; no real database or .env is used.
//   npm run test:e2e:notifications   (from frontend/)
// The tests SKIP themselves (and say why) when Chromium/Chrome/Edge or a dependency is missing; they never fall back
// to a live database.
import { test, describe, before, after, beforeEach } from "node:test";
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
let PASSWORD;
let skipReason = "";
try {
  ({ chromium } = require("playwright-core"));
  ({ createServer } = await import("vite"));
  reactPlugin = (await import("@vitejs/plugin-react")).default;
  ({ startApiServer, PASSWORD } = await import("./apiServer.mjs"));
  if (!findBrowser()) skipReason = "no Chromium found (npx playwright install chromium, or set CHROME_PATH)";
} catch (error) {
  skipReason = `missing dependency: ${String(error.message).split("\n")[0]}`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Vite's live-reload client cannot open its websocket in this throwaway server; that is test-server noise, not the app.
const VITE_CLIENT_NOISE = /WebSocket connection|\[vite\]|reading 'send'/;

describe("admin notification bell in a real browser", { skip: skipReason || false }, () => {
  let api;
  let control;
  let vite;
  let browser;
  let context;
  let page;
  let harnessUrl;
  const pageErrors = [];

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
  const until = async (fn, what, ms = 8000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const value = await fn();
      if (value) return value;
      await sleep(100);
    }
    throw new Error(`timed out waiting for ${what}`);
  };
  const login = async (route, email) => {
    const res = await call("POST", route, { body: { email, password: PASSWORD } });
    assert.equal(res.status, 200, `${route} works in the test setup`);
    return res.body.accessToken;
  };
  const notified = async (count) => until(async () => { const all = await control.notifications(); return all.length === count ? all : null; }, `${count} notification(s)`);

  // ── the producers, through the real routes ──
  let seq = 0;
  const registerDoctor = async (name = "Jane Roe") => {
    const email = `new.doctor${Date.now().toString(36)}${++seq}@e2e.test`;
    await call("POST", "/api/doctor/send-register-otp", { body: { email, name } });
    const otp = [...control.mails].reverse().find((m) => m.to === email)?.code;
    const res = await call("POST", "/api/doctor/register", { body: { name, email, password: PASSWORD, confirmPassword: PASSWORD, otp } });
    assert.equal(res.status, 201, "registration succeeds");
    return { token: res.body.accessToken, doctorId: res.body.doctor.id };
  };
  const submitEnrollment = (token, doctorId) =>
    call("POST", "/api/doctor/enrollment", { token, body: { doctorId: String(doctorId), zip: "10001", firstName: "Jane", surname: "Roe", specialization: "Cardiology" } });
  const patientTicket = async () => {
    const token = await login("/api/auth/login", await control.seedPatient());
    return call("POST", "/api/tickets/user/create", { token, body: { title: "Cannot join call", description: "Test description", category: "billing" } });
  };
  const doctorTicket = async () => {
    const token = await login("/api/doctor/login", await control.seedDoctor());
    return call("POST", "/api/tickets/create", { token, body: { title: "Payout question", description: "Test description" } });
  };
  const partnerCase = async () => {
    const token = await login("/api/auth/partner-login", await control.seedPartner());
    return call("POST", "/api/partner/cases", {
      token,
      body: { serviceType: "teleconsultation", urgency: "urgent", patient: { name: "Test Patient", phone: "+10000000000", complaint: "test" }, location: { country: "Kenya", address: "Test" } },
    });
  };

  // ── the bell ──
  let adminToken;
  const open = async ({ role = "admin", token = adminToken } = {}) => {
    await page.goto(`${harnessUrl}/tests/e2e/adminNotifications/harness/index.html?role=${role}${token ? `&token=${encodeURIComponent(token)}` : ""}`);
    await page.waitForSelector(".ash-topbar-right");
  };
  const bell = () => page.locator("button.ad-bell-btn");
  const badge = async () => {
    const label = (await bell().getAttribute("aria-label")) || "";
    const m = label.match(/(\d+) unread/);
    return m ? Number(m[1]) : 0;
  };
  const unreadIs = (n) => until(async () => (await badge()) === n, `unread count ${n}`);
  const openPanel = async () => {
    await bell().click();
    await page.waitForSelector(".ad-bell-panel");
    await until(async () => !(await page.locator(".ad-bell-panel").innerText()).includes("Loading"), "the list to load");
  };
  const panelText = async () => (await page.locator(".ad-bell-panel").innerText()).replace(/\s+/g, " ");
  const landedIs = (expected) => until(async () => (await page.locator("#landed").innerText()) === expected, `to land on ${expected}`);
  const item = (title) => page.locator(".ad-bell-panel > div", { hasText: title }).first();

  before(async () => {
    api = await startApiServer();
    control = api.control;
    vite = await createServer({
      configFile: false,
      root: frontendRoot,
      logLevel: "silent",
      plugins: [stubContexts(), reactPlugin()],
      define: { "import.meta.env.VITE_API_URL": JSON.stringify("") },
      server: {
        port: 0,
        host: "127.0.0.1",
        fs: { allow: [path.resolve(frontendRoot, "..")] },
        proxy: { "/api": { target: api.url, changeOrigin: false } },
      },
      optimizeDeps: { entries: ["tests/e2e/adminNotifications/harness/index.html"] },
    });
    await vite.listen();
    harnessUrl = vite.resolvedUrls.local[0].replace(/\/$/, "");
    browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
    context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
    page = await context.newPage();
    page.on("pageerror", (error) => { if (!VITE_CLIENT_NOISE.test(String(error))) pageErrors.push(String(error)); });
    page.on("console", (message) => {
      if (message.type() === "error" && !/Failed to load resource/.test(message.text()) && !VITE_CLIENT_NOISE.test(message.text())) pageErrors.push(message.text());
    });
    adminToken = await login("/api/auth/admin-login", await control.seedAdmin("admin"));
  });

  after(async () => {
    await context?.close();
    await browser?.close();
    await vite?.close();
    await api?.close();
  });

  beforeEach(async () => {
    await control.clearNotifications();
  });

  test("a doctor registration (real /api/doctor/register) shows in the bell and links to the enrollment profile", async () => {
    await open();
    await unreadIs(0);
    await registerDoctor("Jane Roe");
    const [n] = await notified(1);
    await open();
    await unreadIs(1);
    await openPanel();
    assert.match(await panelText(), /New doctor registered/);
    assert.match(await panelText(), /Jane Roe created an account/);
    await item("New doctor registered").getByRole("link", { name: "View" }).click();
    await landedIs(n.link);
    assert.match(n.link, /^\/admin-dashboard\/doctor-profile\/[a-f0-9]{24}$/);
  });

  test("an enrollment submission (real /api/doctor/enrollment) shows in the bell", async () => {
    const { token, doctorId } = await registerDoctor("Jane Roe");
    await notified(1);
    await control.clearNotifications();
    assert.equal((await submitEnrollment(token, doctorId)).status, 201);
    const [n] = await notified(1);
    await open();
    await unreadIs(1);
    await openPanel();
    assert.match(await panelText(), /Doctor enrollment submitted/);
    assert.match(await panelText(), /Jane Roe · Cardiology submitted an application for review/);
    await item("Doctor enrollment submitted").getByRole("link", { name: "View" }).click();
    await landedIs(n.link);
    assert.match(n.link, /^\/admin-dashboard\/doctor-profile\/[a-f0-9]{24}$/);
  });

  test("appointment and category-consultation notifications (real notifier functions) show in the bell", async () => {
    assert.equal((await control.notifyAppointment("Martin Perlin")).status, "created");
    assert.equal((await control.notifyCategory()).status, "created");
    const all = await notified(2);
    await open();
    await unreadIs(2);
    await openPanel();
    const text = await panelText();
    assert.match(text, /New appointment booked/);
    assert.match(text, /Dr\. Martin Perlin · Cardiology · Heart · 2027-01-05 · 10:00 AM/);
    assert.match(text, /New appointment request/);
    assert.match(text, /No doctor assigned yet · Women's Health · Gynecology · 2027-01-06 · 05:30 PM/);
    for (const n of all) assert.match(n.link, /^\/admin-dashboard\/appointments\/[a-f0-9]{24}$/);
    await item("New appointment request").getByRole("link", { name: "View" }).click();
    await until(async () => {
      const landed = await page.locator("#landed").innerText();
      return all.some((n) => n.link === landed);
    }, "the link to open the appointment route");
  });

  test("a partner case (real /api/partner/cases) shows in the bell and links to the case", async () => {
    assert.equal((await partnerCase()).status, 201);
    const [n] = await notified(1);
    await open();
    await unreadIs(1);
    await openPanel();
    assert.match(await panelText(), /New partner case/);
    assert.match(await panelText(), /Acme Assist · Teleconsultation · urgent urgency/);
    await item("New partner case").getByRole("link", { name: "View" }).click();
    await landedIs(n.link);
    assert.match(n.link, /^\/admin-dashboard\/partner-cases\/[a-f0-9]{24}$/);
  });

  test("patient and doctor support tickets (real /api/tickets routes) show in the bell and open the right tab", async () => {
    assert.equal((await patientTicket()).status, 201);
    assert.equal((await doctorTicket()).status, 201);
    await notified(2);
    await open();
    await unreadIs(2);
    await openPanel();
    const text = await panelText();
    assert.match(text, /New patient support ticket/);
    assert.match(text, /New doctor support ticket/);
    assert.ok(!/Cannot join call|Payout question|Test description/.test(text), "ticket text is never shown");
    await item("New patient support ticket").getByRole("link", { name: "View" }).click();
    await landedIs("/admin-dashboard/tickets?tab=patient");
    await openPanel();
    await item("New doctor support ticket").getByRole("link", { name: "View" }).click();
    await landedIs("/admin-dashboard/tickets?tab=doctor");
  });

  test("the unread count follows new notifications, and mark-as-read and mark-all-as-read work", async () => {
    await open();
    await unreadIs(0);
    await control.notifyAppointment("Martin Perlin");
    await control.notifyCategory();
    await patientTicket();
    await notified(3);
    await open();
    await unreadIs(3);
    await openPanel();

    // One notification: the button lowers the count and survives a reload (stored per admin on the server).
    await item("New patient support ticket").getByRole("button", { name: "Mark as read" }).click();
    await unreadIs(2);
    await open();
    await unreadIs(2);

    // All: the shared notifications are cleared in one click and stay cleared.
    await openPanel();
    await page.getByRole("button", { name: "Mark all as read" }).click();
    await unreadIs(0);
    await open();
    await unreadIs(0);
    await openPanel();
    assert.equal(await page.getByRole("button", { name: "Mark as read" }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Mark all as read" }).count(), 0);

    // Another admin is unaffected: read state is per admin.
    const other = await login("/api/auth/admin-login", await control.seedAdmin("admin"));
    await open({ token: other });
    await unreadIs(3);

    // A new notification after all that is unread again.
    await control.notifyCategory();
    await notified(4);
    await open();
    await unreadIs(1);
  });

  test("the bell shows for admin and superadmin and is hidden for payment admin", async () => {
    await control.notifyCategory();
    await notified(1);

    await open({ role: "admin" });
    await unreadIs(1);
    assert.equal(await bell().count(), 1);

    const superToken = await login("/api/auth/admin-login", await control.seedAdmin("superadmin"));
    await open({ role: "superadmin", token: superToken });
    await unreadIs(1);
    assert.equal(await bell().count(), 1);

    // A payment admin: the top bar renders, the bell does not, and the page never asks for notifications.
    const requests = [];
    const onRequest = (req) => { if (req.url().includes("/api/admin/notifications") || req.url().includes("/api/direct-video-room/alerts")) requests.push(req.url()); };
    page.on("request", onRequest);
    await open({ role: "paymentadmin", token: "" });
    await page.waitForSelector(".ash-topbar-right .ash-role");
    await sleep(500);
    page.off("request", onRequest);
    assert.equal(await bell().count(), 0);
    assert.deepEqual(requests, []);
  });

  test("the page raised no unexpected browser errors", () => {
    assert.deepEqual(pageErrors, []);
  });
});
