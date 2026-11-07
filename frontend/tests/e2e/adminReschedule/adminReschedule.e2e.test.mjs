// Browser walk of the admin reschedule: the REAL pages in real Chromium, against the REAL /api/admin/bookings code and the
// REAL appointment controller over a throwaway in-memory MongoDB (see apiServer.mjs). Walks Admin, then Doctor, then Patient.
//   npm run test:e2e:reschedule   (from frontend/)       E2E_SHOT_DIR=<folder> also saves screenshots
// The test skips itself when Chromium (or Chrome/Edge) or the backend's dependencies are not installed.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
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

const NOTE = "Patient did not join; called twice, internal remark XYZ";

describe("admin reschedule in a real browser: admin, doctor, patient", { skip: skipReason || false }, () => {
  let api;
  let vite;
  let browser;
  let page;
  let harnessUrl;
  const pageErrors = [];

  const shot = async (name) => {
    if (!process.env.E2E_SHOT_DIR) return;
    fs.mkdirSync(process.env.E2E_SHOT_DIR, { recursive: true });
    await page.waitForTimeout(450); // the dialog's fade-in
    await page.screenshot({ path: path.join(process.env.E2E_SHOT_DIR, `${name}.png`) });
  };
  const open = async (start, ready) => {
    await page.goto(`${harnessUrl}/tests/e2e/adminReschedule/harness/index.html?start=${encodeURIComponent(start)}`);
    await page.waitForSelector(ready);
  };
  // The slot button whose own time (first line) is exactly this; the IST line under it also contains digits.
  const chip = (label) => page.locator(".adp-rs-chip", { has: page.locator("span", { hasText: new RegExp(`^${label}$`) }) });
  // The calendar day button for an ISO date (moves to the next month first when needed).
  const pickDay = async (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    const label = new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
    const day = page.getByRole("button", { name: label });
    if (!(await day.count())) await page.getByRole("button", { name: "Next month" }).click();
    await day.click();
  };
  const adminRow = (id) => page.locator("table.adp-bk tbody tr", { hasText: id });

  before(async () => {
    api = await startApiServer();
    vite = await createServer({
      configFile: false,
      root: frontendRoot,
      logLevel: "silent",
      plugins: [reactPlugin()],
      define: { "import.meta.env.VITE_API_URL": JSON.stringify("") },
      server: {
        port: 0,
        host: "127.0.0.1",
        fs: { allow: [path.resolve(frontendRoot, "..")] },
        proxy: { "/api": { target: api.url, changeOrigin: false } },
      },
      optimizeDeps: { entries: ["tests/e2e/adminReschedule/harness/index.html"] },
    });
    await vite.listen();
    harnessUrl = vite.resolvedUrls.local[0].replace(/\/$/, "");
    browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
    const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
    page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error" && !/Failed to load resource|socket|WebSocket/i.test(message.text())) pageErrors.push(message.text());
    });
  });

  after(async () => {
    await browser?.close();
    await vite?.close();
    await api?.close();
  });

  test("Admin: reschedule a confirmed booking whose time has passed, see the history, and the blocked cases", async () => {
    await open("/admin-dashboard/appointments?tab=all", "table.adp-bk tbody tr");

    // Complete bookings have no Reschedule button; open ones (even without a doctor) do.
    assert.equal(await adminRow(api.ids.complete).getByRole("button", { name: "Reschedule" }).count(), 0);
    assert.equal(await adminRow(api.ids.noShow).getByRole("button", { name: "Reschedule" }).count(), 1);

    // A booking with no doctor opens the dialog with a clear message and cannot be submitted.
    await adminRow(api.ids.noDoctor).getByRole("button", { name: "Reschedule" }).click();
    await page.waitForSelector(".adp-rs-modal .adp-bk-modal-warning");
    assert.match(await page.locator(".adp-rs-modal .adp-bk-modal-warning").innerText(), /Assign a doctor before rescheduling/);
    assert.equal(await page.locator(".adp-rs-modal button[type=submit]").isDisabled(), true);
    await shot("1-admin-no-doctor");
    await page.getByRole("button", { name: "Cancel" }).click();

    // The patient never joined the confirmed booking (its time was yesterday).
    await adminRow(api.ids.noShow).getByRole("button", { name: "Reschedule" }).click();
    await page.waitForSelector(".adp-rs-modal .adp-rs-current");
    const current = await page.locator(".adp-rs-modal .adp-rs-current").innerText();
    assert.match(current, /Nobita Mestry/);
    assert.match(current, /10:30 AM/);
    assert.match(current, /Patient time zone\s*India \(IST\)/);
    assert.match(current, /Confirmed/);
    // Before a date is picked the right side says so, and Confirm is disabled with what is missing.
    assert.match(await page.locator(".adp-rs-modal").innerText(), /Pick a date in the calendar to see the time slots\./);
    assert.equal(await page.getByRole("button", { name: "Confirm reschedule" }).isDisabled(), true);
    assert.match(await page.locator(".adp-rs-foot .adp-rs-need").innerText(), /Choose date, reason to continue/);
    assert.equal(await page.getByRole("button", { name: "Previous month" }).isDisabled(), true);
    await shot("2-admin-modal-open");

    await pickDay(api.dates.tomorrow);
    await page.waitForSelector(".adp-rs-chip");
    // 11:30 is held by another patient with the same doctor.
    assert.equal(await chip("11:30 AM").isDisabled(), true);
    assert.equal(await chip("2:00 PM").isDisabled(), false);
    assert.match(await page.locator(".adp-rs-modal").innerText(), /Times are in IST, same for patient and admin\./);
    // An IST patient sees no second (IST) time under the slots: only unavailable ones carry a small reason.
    assert.equal(await page.locator(".adp-rs-chip:not(:disabled) small").count(), 0);
    assert.match(await chip("11:30 AM").innerText(), /Booked/);

    // Nothing chosen yet: it says what is missing. "Other" needs a note.
    assert.equal(await page.getByRole("button", { name: "Confirm reschedule" }).isDisabled(), true);
    assert.match(await page.locator(".adp-rs-foot .adp-rs-need").innerText(), /Choose time, reason to continue/);
    await chip("2:00 PM").click();
    assert.equal(await page.getByRole("button", { name: "Confirm reschedule" }).isDisabled(), true);
    await page.getByLabel("Other", { exact: true }).check();
    // "Other" needs a note: the box turns red and Confirm stays disabled until it is filled.
    assert.equal(await page.getByRole("button", { name: "Confirm reschedule" }).isDisabled(), true);
    assert.equal(await page.getByLabel("Reason note").getAttribute("aria-invalid"), "true");
    await page.getByLabel("Reason note").fill(NOTE);
    assert.equal(await page.getByRole("button", { name: "Confirm reschedule" }).isDisabled(), false);
    assert.match(await page.locator(".adp-rs-change").innerText(), /10:30 AM[\s\S]*2:00 PM/);
    await shot("3-admin-modal-filled");

    await page.getByRole("button", { name: "Confirm reschedule" }).click();
    await page.waitForSelector(".adp-rs-drawer .adp-rs-tl");
    const drawer = await page.locator(".adp-rs-drawer").innerText();
    assert.match(drawer, /Originally booked/);
    assert.match(drawer, /Rescheduled · current/);
    assert.match(drawer, /Reason: Other · Patient did not join/);
    assert.match(drawer, /By Test Admin/);
    assert.match(drawer, /Patient and doctor notified/);
    assert.match(drawer, /IST 2:00 PM/);
    await shot("4-admin-history-drawer");
    await page.getByRole("button", { name: "Close" }).click();

    // The list shows the tag, the new time and the same status.
    await page.waitForSelector(".adp-rs-tag");
    const rowText = (await adminRow(api.ids.noShow).innerText()).replace(/\s+/g, " ");
    assert.match(rowText, /Rescheduled ×1/);
    assert.match(rowText, /2:00 PM|14:00/);
    assert.match(rowText, /Confirmed/);
    await shot("5-admin-list-tag");

    // The slot just taken is now disabled for another booking of the same doctor.
    await adminRow(api.ids.pending).getByRole("button", { name: "Reschedule" }).click();
    await page.waitForSelector(".adp-rs-modal .adp-rs-current");
    await pickDay(api.dates.tomorrow);
    await page.waitForSelector(".adp-rs-chip");
    assert.equal(await chip("2:00 PM").isDisabled(), true);
    await page.getByRole("button", { name: "Cancel" }).click();

    // The View page shows the timeline too, and a Reschedule button.
    await open(`/admin-dashboard/appointments/${api.ids.noShow}`, ".adp-detail-section");
    await page.waitForSelector(".adp-rs-tl");
    const detail = await page.locator(".adp-detail-grid").innerText();
    assert.match(detail, /Reschedule history \(1\)/);
    assert.match(detail, /Reason: Other · Patient did not join/);
    assert.equal(await page.getByRole("button", { name: "Reschedule" }).count(), 1);
    await shot("6-admin-detail-history");

    const calls = await (await fetch(`${api.url}/__calls`)).json();
    assert.ok(calls.some((c) => c.name === "rescheduled" && c.booking === api.ids.noShow));
    const doc = await (await fetch(`${api.url}/__doc/${api.ids.noShow}`)).json();
    assert.equal(doc.status, "confirmed");
    assert.equal(doc.date, api.dates.tomorrow);
    assert.equal(doc.time, "14:00");
    assert.equal(doc.rescheduleCount, 1);
  });

  test("Doctor: sees 'Rescheduled by admin' and the old time crossed out, read-only, no reason", async () => {
    await open("/doctor-dashboard/appointments", "table tbody tr");
    const text = await page.locator("table").innerText();
    assert.match(text, /Rescheduled by admin/);
    assert.equal(await page.locator(".da-was").count() >= 2, true, "old date and old time crossed out");
    assert.equal(await page.getByRole("button", { name: /reschedule/i }).count(), 0, "no Reschedule button for a doctor");
    assert.equal(await page.getByRole("link", { name: /reschedule/i }).count(), 0);
    const label = page.locator(".da-rescheduled-note").first();
    assert.match(await label.getAttribute("title"), /Originally booked for/);
    const html = await page.content();
    assert.ok(!html.includes("internal remark"), "the admin's note is not on the doctor's page");
    assert.ok(!html.includes("Patient did not join"));
    await shot("7-doctor-appointments");
  });

  test("Patient: sees the new time and 'Rescheduled from ...', read-only, no reason", async () => {
    await open("/user-dashboard/appointments", ".appt-card, .appt-empty");
    const box = page.locator(".appt-resched").first();
    await box.waitFor();
    const text = await box.innerText();
    assert.match(text, /Your appointment was rescheduled/);
    assert.match(text, /Rescheduled from/);
    assert.match(text, /10:30/);
    assert.equal(await page.getByRole("button", { name: /reschedule/i }).count(), 0);
    const html = await page.content();
    assert.ok(!html.includes("internal remark"), "the admin's note is not on the patient's page");
    assert.ok(!html.includes("Patient did not join"));
    assert.ok(!/Reason:/.test(await page.locator(".appt-page").innerText()));
    await shot("8-patient-appointments");
  });

  test("no page errors while walking the three roles", () => {
    assert.deepEqual(pageErrors, []);
  });
});
