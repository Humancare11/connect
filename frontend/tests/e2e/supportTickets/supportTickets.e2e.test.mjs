// Browser-level tests of the Support Tickets conversation: the REAL admin page and the REAL patient/doctor
// "My Support Tickets" pages, in real Chromium, against the backend's REAL tickets/auth routers over a throwaway
// in-memory MongoDB (reusing ../adminNotifications/apiServer.mjs). The admin email is recorded, never sent.
// The browser's timezone is pinned (America/New_York) so "the user's own time" is checkable.
//   npm run test:e2e:support-tickets   (from frontend/)
// SKIPS (and says why) when Chromium or a dependency is missing; never touches a live database.
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { findBrowser } from "../adminAppointments/helpers.mjs";
import stubContexts from "../../ui-baseline/stubContexts.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, "..", "..", "..");
const backendRoot = path.resolve(frontendRoot, "..", "backend");
const require = createRequire(import.meta.url);
const requireBackend = createRequire(path.join(backendRoot, "package.json"));

let chromium, createServer, reactPlugin, startApiServer, PASSWORD;
let skipReason = "";
try {
  ({ chromium } = require("playwright-core"));
  ({ createServer } = await import("vite"));
  reactPlugin = (await import("@vitejs/plugin-react")).default;
  ({ startApiServer, PASSWORD } = await import("../adminNotifications/apiServer.mjs"));
  if (!findBrowser()) skipReason = "no Chromium found (npx playwright install chromium, or set CHROME_PATH)";
} catch (error) {
  skipReason = `missing dependency: ${String(error.message).split("\n")[0]}`;
}

// SHOT_DIR=some/folder saves screenshots of the key states (for a visual check); off by default.
const shot = async (page, name) => {
  if (process.env.SHOT_DIR) await page.screenshot({ path: path.join(process.env.SHOT_DIR, `${name}.png`), fullPage: true });
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const VITE_CLIENT_NOISE = /WebSocket connection|\[vite\]|reading 'send'/;

describe("support ticket conversations in a real browser", { skip: skipReason || false }, () => {
  let api, control, vite, browser, harnessUrl;
  let sent;
  let restoreMailer;
  let tokens;
  const pageErrors = [];

  const call = async (method, route, { body, token } = {}) => {
    const res = await fetch(api.url + route, {
      method,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch { /* empty */ }
    return { status: res.status, body: json };
  };
  const until = async (fn, what, ms = 8000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const v = await fn();
      if (v) return v;
      await sleep(100);
    }
    throw new Error(`timed out waiting for ${what}`);
  };
  const login = async (route, email) => {
    const res = await call("POST", route, { body: { email, password: PASSWORD } });
    assert.equal(res.status, 200, `${route} works in the test setup`);
    return res.body.accessToken;
  };

  const openPage = async (view, { viewport = { width: 1280, height: 1000 }, timezoneId = "America/New_York" } = {}) => {
    const ctx = await browser.newContext({ viewport, timezoneId, locale: "en-GB" });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => { if (!VITE_CLIENT_NOISE.test(String(e))) pageErrors.push(String(e)); });
    page.on("console", (m) => {
      if (m.type() === "error" && !/Failed to load resource/.test(m.text()) && !VITE_CLIENT_NOISE.test(m.text())) pageErrors.push(m.text());
    });
    await page.goto(`${harnessUrl}/tests/e2e/supportTickets/harness/index.html?view=${view}&token=${encodeURIComponent(tokens[view])}`);
    return { ctx, page };
  };

  // Seed through the real create route so the model, thread and email all run for real.
  const raise = (who, body) =>
    call("POST", who === "patient" ? "/api/tickets/user/create" : "/api/tickets/create", { token: tokens[who], body });

  before(async () => {
    api = await startApiServer();
    control = api.control;
    // The admin email is recorded, not sent.
    const mailer = requireBackend(path.join(backendRoot, "utils", "sendEmail.js"));
    const original = mailer.sendBookingNotificationEmail;
    sent = [];
    mailer.sendBookingNotificationEmail = async (to, payload) => { sent.push({ to, payload }); };
    restoreMailer = () => { mailer.sendBookingNotificationEmail = original; };

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
      optimizeDeps: { entries: ["tests/e2e/supportTickets/harness/index.html"] },
    });
    await vite.listen();
    harnessUrl = vite.resolvedUrls.local[0].replace(/\/$/, "");
    browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
    tokens = {
      admin: await login("/api/auth/admin-login", await control.seedAdmin("admin")),
      patient: await login("/api/auth/login", await control.seedPatient()),
      doctor: await login("/api/doctor/login", await control.seedDoctor()),
    };
  });

  after(async () => {
    restoreMailer?.();
    await browser?.close();
    await vite?.close();
    await api?.close();
    assert.deepEqual(pageErrors, [], "no uncaught page errors");
  });

  beforeEach(() => { sent.length = 0; });

  test("patient: raises a ticket (with their timezone), admin is emailed, and the thread works end to end", async () => {
    // ── patient raises a ticket in the browser ──
    const { ctx: pctx, page: patient } = await openPage("patient");
    await patient.waitForSelector(".mst-new");
    assert.match(await patient.locator(".mst-title").innerText(), /My Support Tickets/);
    assert.equal(await patient.locator(".mst-ticket").count(), 0);
    await patient.getByLabel("Subject").fill("Reports not received");
    await patient.getByLabel("Category").selectOption("medical");
    await patient.getByLabel("Description").fill("I never got the reports after my consultation.");
    await patient.getByRole("button", { name: "Submit ticket" }).click();
    await patient.waitForSelector(".mst-ticket");
    assert.match(await patient.locator(".mst-hint").innerText(), /Ticket TCK-[0-9A-F]{6} submitted/);

    // The browser's own timezone went to the server with the ticket.
    const [ticket] = (await call("GET", "/api/tickets/user/all", { token: tokens.admin })).body;
    assert.equal(ticket.userTimezone, "America/New_York");
    assert.equal(ticket.messages.length, 1);
    assert.equal(ticket.category, "medical");

    // ── the admin email ──
    await until(() => sent.length === 1, "the admin email");
    const rows = Object.fromEntries(sent[0].payload.rows);
    assert.equal(rows["Ticket ID"], ticket.ref);
    assert.equal(rows.Title, "Reports not received");
    assert.match(rows["Raised (patient time)"], /America\/New_York \(GMT-[45]\)/);
    assert.match(rows["Raised (admin time)"], /Asia\/Kolkata \(GMT\+5:30\)/);
    assert.equal(sent[0].payload.quote, "I never got the reports after my consultation.");

    // ── admin: expanded ticket shows both times, Close Ticket, no Resolve button ──
    const { ctx: actx, page: admin } = await openPage("admin");
    await admin.waitForSelector(".st-ticket");
    assert.equal(await admin.getByRole("button", { name: /^Resolve$/ }).count(), 0, "the row Resolve button is gone");
    await admin.locator(".st-ticket__row").first().click();
    await admin.waitForSelector(".st-tsbox");
    const boxes = (await admin.locator(".st-ts").innerText()).replace(/\s+/g, " ");
    assert.match(boxes, /Raised · Patient time/i);
    assert.match(boxes, /America\/New_York \(GMT-[45]\)/);
    assert.match(boxes, /Raised · Admin time/i);
    assert.match(boxes, /Asia\/Kolkata \(GMT\+5:30\)/);
    assert.ok(await admin.getByRole("button", { name: "Close Ticket" }).isVisible());
    assert.match(await admin.locator(".st-thread").innerText(), /I never got the reports/);

    // ── admin replies: the ticket stays open ──
    await admin.getByLabel(/Reply to/).fill("We are checking with the doctor.");
    await admin.getByRole("button", { name: "Send reply" }).click();
    await admin.waitForSelector(".st-msg--admin");
    assert.match(await admin.locator(".st-thread").innerText(), /We are checking with the doctor\./);
    assert.match(await admin.locator(".st-badge").first().innerText(), /Open/);
    assert.ok(await admin.getByRole("button", { name: "Close Ticket" }).isVisible(), "still open after replying");

    await shot(admin, "admin-open-thread");

    // ── patient sees "New reply", only their own timezone, no close button ──
    await patient.reload();
    await patient.waitForSelector(".mst-ticket");
    assert.equal(await patient.locator(".mst-newreply").count(), 1);
    const pText = (await patient.locator(".mst-root").innerText()).replace(/\s+/g, " ");
    assert.match(pText, /Humancare Support/);
    assert.doesNotMatch(pText, /Asia\/Kolkata|IST/, "admin timezone is never shown to the user");
    assert.equal(await patient.getByRole("button", { name: /close/i }).count(), 0, "users cannot close");
    await shot(patient, "patient-new-reply");
    await patient.getByLabel("Write a message to support").fill("Thank you!");
    await patient.getByRole("button", { name: "Send", exact: true }).click();
    await until(async () => (await patient.locator(".mst-msg--mine").count()) === 2, "the patient's reply to appear");
    assert.equal(await patient.locator(".mst-newreply").count(), 0, "no 'New reply' once the user answered");

    // ── admin closes with the inline confirm; Cancel keeps it open ──
    await admin.reload();
    await admin.waitForSelector(".st-ticket");
    await admin.locator(".st-ticket__row").first().click();
    await admin.getByRole("button", { name: "Close Ticket" }).click();
    assert.match(await admin.locator(".st-confirm").innerText(), /Close this ticket\? The patient won't be able to reply/);
    await admin.getByRole("button", { name: "Cancel" }).click();
    assert.equal(await admin.locator(".st-confirm").count(), 0);
    assert.equal((await call("GET", "/api/tickets/user/all", { token: tokens.admin })).body[0].status, "open");
    await admin.getByRole("button", { name: "Close Ticket" }).click();
    await admin.getByRole("button", { name: "Yes, close ticket" }).click();
    await admin.waitForSelector(".st-closednote");
    assert.match(await admin.locator(".st-closednote").innerText(), /^Closed by admin on \d{1,2} \w{3} \d{4}, \d\d:\d\d [ap]m$/);
    assert.equal(await admin.getByLabel(/Reply to/).count(), 0, "no reply box on a closed ticket");
    assert.equal(await admin.getByRole("button", { name: "Close Ticket" }).count(), 0);
    await shot(admin, "admin-closed");

    // ── patient: closed note, no reply box ──
    await patient.reload();
    await patient.waitForSelector(".mst-ticket");
    if (!(await patient.locator(".mst-closed").count())) await patient.locator(".mst-row").first().click();
    await patient.waitForSelector(".mst-closed");
    assert.match(await patient.locator(".mst-closed").innerText(), /closed by support on .*Raise a new ticket if you still need help/);
    assert.equal(await patient.getByLabel("Write a message to support").count(), 0);
    assert.match(await patient.locator(".mst-status").first().innerText(), /Resolved/);
    await shot(patient, "patient-closed");

    await pctx.close();
    await actx.close();
  });

  test("a user typing a reply while support closes the ticket gets a clear message, and no reply is stored", async () => {
    const t = (await raise("patient", { title: "Race", description: "Open question", category: "other", userTimezone: "America/New_York" })).body.ticket;
    const { ctx, page } = await openPage("patient");
    await page.waitForSelector(".mst-reply");
    await page.getByLabel("Write a message to support").fill("Are you there?");
    // Support closes it while the box is on screen.
    assert.equal((await call("PUT", `/api/tickets/user/${t._id}/close`, { token: tokens.admin })).status, 200);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.waitForSelector(".mst-toast--err");
    assert.match(await page.locator(".mst-toast").innerText(), /just been closed/);
    await page.waitForSelector(".mst-closed");
    assert.equal(await page.getByLabel("Write a message to support").count(), 0);
    const saved = (await call("GET", "/api/tickets/user/my", { token: tokens.patient })).body.find((x) => x._id === t._id);
    assert.equal(saved.messages.length, 1);
    await ctx.close();
  });

  test("doctor: raises a ticket with a doctor category; admin sees it under Doctor Tickets and replies", async () => {
    const { ctx: dctx, page: doctor } = await openPage("doctor");
    await doctor.waitForSelector(".mst-new");
    const options = await doctor.getByLabel("Category").locator("option").allInnerTexts();
    assert.deepEqual(options, ["Technical", "Appointment", "Payments", "Profile", "Account", "Other"]);
    await doctor.getByLabel("Subject").fill("Payout not received");
    await doctor.getByLabel("Category").selectOption("payments");
    await doctor.getByLabel("Description").fill("My October payout is pending.");
    await doctor.getByRole("button", { name: "Submit ticket" }).click();
    await doctor.waitForSelector(".mst-ticket");
    await until(() => sent.length === 1, "the admin email");
    assert.equal(Object.fromEntries(sent[0].payload.rows)["Raised by"], "Doctor");

    const { ctx: actx, page: admin } = await openPage("admin");
    await admin.waitForSelector(".st-source");
    await admin.getByRole("button", { name: /Doctor Tickets/ }).click();
    await admin.waitForSelector(".st-ticket");
    await admin.locator(".st-ticket__row").first().click();
    assert.match((await admin.locator(".st-ts").innerText()).replace(/\s+/g, " "), /Raised · Doctor time/i);
    await admin.getByLabel(/Reply to/).fill("Processing it today.");
    await admin.getByRole("button", { name: "Send reply" }).click();
    await admin.waitForSelector(".st-msg--admin");
    await doctor.reload();
    await doctor.waitForSelector(".mst-newreply");
    await dctx.close();
    await actx.close();
  });

  test("admin list: search and filters work, and a legacy ticket without a timezone renders", async () => {
    // A ticket from before this feature: no thread, no timezone.
    const UserTicket = requireBackend(path.join(backendRoot, "models", "UserTicket.js"));
    const User = requireBackend(path.join(backendRoot, "models", "User.js"));
    const someone = await User.findOne({ role: "user" });
    await UserTicket.collection.insertOne({
      title: "Legacy invoice question", description: "Old style ticket", category: "billing", status: "resolved", resolution: "Sent by email",
      createdBy: someone._id, createdAt: new Date("2026-09-01T08:00:00Z"), updatedAt: new Date("2026-09-02T08:00:00Z"),
    });
    const { ctx, page } = await openPage("admin");
    await page.waitForSelector(".st-ticket");
    await page.getByLabel("Search tickets by name or title").fill("legacy invoice");
    await until(async () => (await page.locator(".st-ticket").count()) === 1, "search to narrow the list");
    await page.getByRole("button", { name: /^Resolved/ }).click();
    assert.equal(await page.locator(".st-ticket").count(), 1);
    await page.locator(".st-ticket__row").first().click();
    assert.match(await page.locator(".st-tsbox").first().innerText(), /Timezone was not recorded/);
    assert.match(await page.locator(".st-thread").innerText(), /Old style ticket[\s\S]*Sent by email/);
    assert.match(await page.locator(".st-closednote").innerText(), /Closed by admin on 2 Sept? 2026/);
    await ctx.close();
  });

  test("phone width: nothing overflows horizontally on any of the three pages", async () => {
    await raise("patient", { title: "A fairly long ticket title that has to wrap on a very small screen", description: "x".repeat(300), category: "technical", userTimezone: "America/New_York" });
    for (const view of ["patient", "doctor", "admin"]) {
      const { ctx, page } = await openPage(view, { viewport: { width: 375, height: 800 } });
      await page.waitForSelector(view === "admin" ? ".st-page" : ".mst-root");
      if (view === "admin") {
        await page.waitForSelector(".st-ticket");
        await page.locator(".st-ticket__row").first().click();
        await page.waitForSelector(".st-tsbox");
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 1, `${view}: ${overflow}px of horizontal overflow`);
      await shot(page, `phone-${view}`);
      await ctx.close();
    }
  });
});
