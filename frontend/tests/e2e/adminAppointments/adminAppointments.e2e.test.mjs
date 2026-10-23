// Browser-level tests of the admin Appointments list: the REAL page, in real Chromium, against the REAL
// /api/admin/bookings code over a throwaway in-memory MongoDB (see apiServer.mjs). Emails and push are recorded,
// not sent; there is no login; no real database or secret is involved.
//   npm run test:e2e:appointments   (from frontend/)       E2E_SCREENSHOTS=1 also saves screenshots
// The tests skip themselves when Chromium (or Chrome/Edge) or the backend's dependencies are not installed.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createHelpers, findBrowser } from "./helpers.mjs";

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

describe("admin Appointments list in a real browser", { skip: skipReason || false }, () => {
  let api;
  let vite;
  let browser;
  let context;
  let page;
  let h;
  const pageErrors = [];

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
      optimizeDeps: { entries: ["tests/e2e/adminAppointments/harness/index.html"] },
    });
    await vite.listen();
    const harnessUrl = vite.resolvedUrls.local[0].replace(/\/$/, "");
    browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
    context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
    page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error" && !/Failed to load resource/.test(message.text())) pageErrors.push(message.text());
    });
    h = createHelpers({ page, api, harnessUrl });
    await h.open();
  });

  after(async () => {
    await context?.close();
    await browser?.close();
    await vite?.close();
    await api?.close();
  });

  // ── The list itself ───────────────────────────────────────────────────────

  test("the eight tabs, in order, with the columns the spec asks for; Assigned by is hidden on Upcoming", async () => {
    assert.deepEqual((await h.tabs()).map((t) => t.replace(/\s*[\d–]+$/, "")), ["All", "Upcoming", "Assigned", "Pending", "Confirmed", "Complete", "Cancelled", "Testing"]);
    await page.click('[role="tab"]:has-text("Upcoming")');
    await h.until(async () => !(await h.headers()).includes("Assigned by") && (await h.rowsLocator().count()) > 0, "the Upcoming tab");
    await page.click('[role="tab"]:has-text("All")');
    await h.until(async () => (await h.headers()).includes("Assigned by"), "the All tab");
    assert.deepEqual(await h.headers(), ["#", "Booking ID", "Patient", "Doctor", "Category", "Booking date", "Consultation date", "Fee", "Status", "Assigned by", "Actions"]);
    assert.equal(await h.rowsLocator().count(), 25);
    const text = await page.locator("table.adp-bk").innerText();
    assert.ok(text.includes("TESTING") && text.includes("Not scheduled") && text.includes("Alternate doctor") && text.includes("Not assigned"));
    await h.shot("list-all");
  });

  test("tab counts come from the server and Hide testing removes exactly the testing bookings", async () => {
    const api1 = async (q) => (await (await fetch(`${api.url}/api/admin/bookings?${q}`)).json());
    const all = await api1("status=all&limit=1");
    const allHidden = await api1("status=all&hideTesting=true&limit=1");
    assert.equal(await h.tabCount("All"), all.counts.all);
    assert.equal(await h.tabCount("Testing"), all.counts.testing);

    await page.click(".adp-bk-hide");
    await h.until(async () => (await h.tabCount("All")) === allHidden.counts.all, "All count without testing");
    assert.equal(all.counts.all - allHidden.counts.all, all.counts.testing);
    assert.equal(await h.tabCount("Testing"), all.counts.testing, "the Testing count ignores Hide testing");
    assert.equal(await page.locator(".adp-bk-hide").innerText(), "Showing without testing");
    assert.equal((await page.locator("table.adp-bk").innerText()).includes("TESTING"), false);

    await page.click('[role="tab"]:has-text("Testing")');
    await h.until(async () => (await h.rowsLocator().count()) === Math.min(25, all.counts.testing), "Testing tab rows");
    assert.ok((await page.locator("table.adp-bk").innerText()).includes("TESTING"));
    await page.click(".adp-bk-hide");
    await page.click('[role="tab"]:has-text("All")');
    await h.until(async () => (await h.tabCount("All")) === all.counts.all, "All count restored");
  });

  test("25 per page with continuing row numbers, and the search narrows rows but not the counts", async () => {
    await page.click('button[aria-label="Next page"]');
    await h.until(async () => (await page.locator("table.adp-bk tbody tr:first-child td:first-child").innerText()).trim() === "26", "page 2");
    assert.match(await page.locator(".adp-bk-foot span").first().innerText(), /^Showing 26–50 of \d+$/);
    await page.click('button[aria-label="Previous page"]');

    const allBefore = await h.tabCount("All");
    await h.search("Seed 3");
    assert.equal(await h.tabCount("All"), allBefore);
    await page.fill(".adp-search input", "zzzz-nothing");
    await h.until(async () => (await page.locator(".adp-empty").innerText().catch(() => "")).includes("No appointments match your search"), "empty search result");
    await page.fill(".adp-search input", "");
    await h.until(async () => (await h.rowsLocator().count()) === 25, "rows back");
  });

  test("no sideways page scroll from phone to wide desktop; cards below about 900px, a table above", async () => {
    for (const [width, cards] of [[1500, false], [1126, false], [1040, false], [900, true], [390, true]]) {
      await page.setViewportSize({ width, height: 900 });
      await h.open("/admin-dashboard/appointments?tab=all");
      const info = await page.evaluate(() => ({
        isCards: getComputedStyle(document.querySelector("table.adp-bk")).display === "block",
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      assert.equal(info.isCards, cards, `${width}px`);
      assert.ok(info.overflow <= 1, `${width}px scrolls sideways by ${info.overflow}px`);
    }
    await page.setViewportSize({ width: 1500, height: 1000 });
    await h.open("/admin-dashboard/appointments?tab=all");
  });

  // ── Assign / alternate doctor ─────────────────────────────────────────────

  test("assign a doctor: Assigned, the row and the tab counts refresh, the doctor and patient are told", async () => {
    await h.reset();
    const id = await h.make({ status: "upcoming", name: "Anna Assign" });
    await h.search("Anna Assign");
    assert.match(await h.rowText("Anna Assign"), /Not assigned/);
    await page.click('[role="tab"]:has-text("All")');
    const [upcoming, assigned] = [await h.tabCount("Upcoming"), await h.tabCount("Assigned")];

    await h.row("Anna Assign").locator("button", { hasText: "Assign doctor" }).click();
    await h.modal().waitFor();
    assert.equal(await h.modal().locator("h2").innerText(), "Assign doctor");
    await h.until(async () => (await h.doctorNames()).length === 4, "4 approved doctors");
    assert.equal(await h.modal().locator('button[type="submit"]').isDisabled(), true, "disabled until a doctor is chosen");
    assert.equal(await page.locator('.hc-modal input[type="time"]').count(), 0, "no time field for a regular appointment");
    await h.pickDoctor("Nobita Mestry");
    await h.modal().locator('button[type="submit"]').click();
    await h.modal().waitFor({ state: "detached" });
    await h.until(async () => /Doctor assigned/.test(await h.toasts()), "success message");
    await h.until(async () => /Assigned/.test(await h.rowText("Anna Assign")) && /Nobita Mestry/.test(await h.rowText("Anna Assign")), "row refreshed");

    const saved = await h.doc(id);
    assert.equal(saved.status, "assigned");
    assert.equal(saved.sessionStarted, false);
    assert.equal(saved.assignedBy.name, "Super Admin");
    await h.until(async () => (await h.tabCount("Upcoming")) === upcoming - 1 && (await h.tabCount("Assigned")) === assigned + 1, "tab counts refreshed");
    const names = (await h.calls()).map((c) => c.name);
    assert.ok(names.includes("notifyAppointmentDoctorChanged") && names.includes("notifyPatientDoctorChanged"));
  });

  test("a Next Available category booking needs a time before it can be assigned", async () => {
    const id = await h.make({ kind: "category", status: "upcoming", nextAvailable: true, name: "Nina Next" });
    await h.search("Nina Next");
    assert.match(await h.rowText("Nina Next"), /Not scheduled/);
    await h.row("Nina Next").locator("button", { hasText: "Assign doctor" }).click();
    await h.modal().waitFor();
    await h.until(async () => (await h.doctorNames()).length === 4, "doctors");
    assert.equal(await page.locator('.hc-modal input[type="time"]').count(), 1);
    await h.pickDoctor("Hidayat Khan");
    assert.equal(await h.modal().locator('button[type="submit"]').isDisabled(), true, "disabled until a time is set");
    await page.fill('.hc-modal input[type="time"]', "17:30");
    assert.equal(await h.modal().locator('button[type="submit"]').isDisabled(), false);
    await h.shot("assign-with-time");
    await h.modal().locator('button[type="submit"]').click();
    await h.modal().waitFor({ state: "detached" });
    await h.until(async () => /05:30 PM/.test(await h.rowText("Nina Next")), "row shows the time");
    assert.equal((await h.doc(id)).assignedSlot, "05:30 PM");
  });

  test("a busy doctor keeps the dialog open with the message; another doctor then works", async () => {
    await h.make({ status: "confirmed", doctor: 1, name: "Busy Bee", time: "11:00 AM", date: "2030-12-01" });
    const id = await h.make({ status: "upcoming", name: "Clash Case", time: "11:00 AM", date: "2030-12-01" });
    await h.search("Clash Case");
    await h.row("Clash Case").locator("button", { hasText: "Assign doctor" }).click();
    await h.modal().waitFor();
    await h.until(async () => (await h.doctorNames()).length === 4, "doctors");
    await h.pickDoctor("Nobita Mestry");
    await h.modal().locator('button[type="submit"]').click();
    await h.until(async () => /already booked/.test(await h.modal().innerText()), "inline message");
    assert.equal(await h.modal().isVisible(), true);
    assert.equal((await h.doc(id)).status, "upcoming");
    assert.equal(/already updated, refreshing/.test(await h.toasts()), false, "a busy doctor is not a lost race");
    await h.pickDoctor("Farah Siddiqui");
    await h.modal().locator('button[type="submit"]').click();
    await h.modal().waitFor({ state: "detached" });
    await h.until(async () => /Farah Siddiqui/.test(await h.rowText("Clash Case")), "assigned to the other doctor");
  });

  test("alternate doctor replaces the doctor and remembers the original; Go back restores it", async () => {
    await h.reset();
    const id = await h.make({ status: "assigned", doctor: 0, name: "Alex Alt" });
    await h.search("Alex Alt");
    await h.row("Alex Alt").locator(".adp-bk-alt").click();
    await h.modal().waitFor();
    assert.equal(await h.modal().locator("h2").innerText(), "Alternate doctor");
    await h.until(async () => (await h.doctorNames()).length === 3, "the other 3 doctors");
    assert.equal((await h.doctorNames()).includes("Dr. Martin Perlin"), false, "the current doctor is not offered");
    assert.equal(await h.modal().getByText("Go back to").count(), 0);
    await h.pickDoctor("Farah Siddiqui");
    await h.modal().locator('button[type="submit"]').click();
    await h.modal().waitFor({ state: "detached" });
    await h.until(async () => /Farah Siddiqui/.test(await h.rowText("Alex Alt")), "new doctor shown");
    assert.equal(await h.row("Alex Alt").locator(".adp-bk-doctor").getAttribute("title"), "Originally with Martin Perlin");
    assert.equal((await h.doc(id)).originalDoctorName, "Martin Perlin");
    const names = (await h.calls()).map((c) => c.name);
    assert.ok(names.includes("notifyAppointmentDoctorChanged") && names.includes("notifyPatientDoctorChanged"));

    await h.row("Alex Alt").locator(".adp-bk-alt").click();
    await h.modal().waitFor();
    await h.until(async () => (await h.doctorNames()).length === 3, "doctors again");
    await h.shot("alternate-go-back");
    await h.modal().getByText("Go back to Martin Perlin").click();
    await h.modal().waitFor({ state: "detached" });
    await h.until(async () => /Martin Perlin/.test(await h.rowText("Alex Alt")), "original restored");
    const restored = await h.doc(id);
    assert.equal(restored.originalDoctorId, null);
    assert.equal(restored.status, "assigned");
  });

  test("changing the doctor on a Confirmed booking (either kind) sends it back to Assigned", async () => {
    for (const kind of ["appointment", "category"]) {
      const name = `Connie ${kind}`;
      const id = await h.make({ kind, status: "confirmed", doctor: 2, name });
      await h.search(name);
      assert.match(await h.rowText(name), /Confirmed/);
      await h.row(name).locator(".adp-bk-alt").click();
      await h.modal().waitFor();
      await h.until(async () => (await h.doctorNames()).length === 3, "doctors");
      await h.pickDoctor("Martin Perlin");
      await h.modal().locator('button[type="submit"]').click();
      await h.modal().waitFor({ state: "detached" });
      await h.until(async () => /Assigned/.test(await h.rowText(name)) && !/Confirmed/.test(await h.rowText(name)), `${kind} row is Assigned`);
      assert.notEqual((await h.doc(id)).status.toLowerCase(), "confirmed");
    }
  });

  // ── Confirm, auto complete, cancel ────────────────────────────────────────

  test("admin Confirm: only on Assigned rows, behind a confirmation, recorded as the admin, doctor and patient told", async () => {
    await h.reset();
    const id = await h.make({ kind: "category", status: "assigned", doctor: 3, name: "Cora Confirm" });
    await h.search("Cora Confirm");
    const confirmButton = () => h.row("Cora Confirm").locator("button", { hasText: /^Confirm$/ });
    await confirmButton().click();
    await h.confirmDialog().waitFor();
    assert.match(await h.confirmDialog().innerText(), /confirmed on behalf of Farah/);
    await h.shot("confirm-dialog");
    await h.confirmDialog().locator("button", { hasText: "Cancel" }).click();
    await h.confirmDialog().waitFor({ state: "detached" });
    assert.equal((await h.doc(id)).status, "Assigned", "dismissing changes nothing");

    await confirmButton().click();
    await h.confirmDialog().locator("button", { hasText: "Confirm booking" }).click();
    await h.until(async () => /Confirmed/.test(await h.rowText("Cora Confirm")), "row Confirmed");
    assert.equal(await confirmButton().count(), 0);
    const saved = await h.doc(id);
    assert.equal(saved.status, "Confirmed");
    assert.equal(saved.confirmedBy.role, "admin");
    assert.equal(saved.confirmedBy.name, "Super Admin");
    assert.ok(saved.confirmedAt);
    const names = (await h.calls()).map((c) => c.name);
    assert.ok(names.includes("notifyDoctorBookingConfirmed") && names.includes("push:Appointment confirmed"));

    for (const [status, name] of [["confirmed", "Nick Notassigned"], ["pending", "Penny Pending"], ["complete", "Carl Complete"], ["upcoming", "Una Upcoming"]]) {
      await h.make({ status, doctor: status === "upcoming" ? null : 0, name });
      await h.search(name);
      assert.equal(await h.row(name).locator("button", { hasText: /^Confirm$/ }).count(), 0, `${name} has no Confirm button`);
    }
  });

  test("a testing booking is confirmed and cancelled with no email and no push", async () => {
    await h.reset();
    const confirmId = await h.make({ status: "assigned", doctor: 3, name: "Tess Testing", testing: true });
    await h.search("Tess Testing");
    assert.match(await h.rowText("Tess Testing"), /TESTING/);
    await h.row("Tess Testing").locator("button", { hasText: /^Confirm$/ }).click();
    await h.confirmDialog().locator("button", { hasText: "Confirm booking" }).click();
    await h.until(async () => /Confirmed/.test(await h.rowText("Tess Testing")), "confirmed");
    assert.equal((await h.doc(confirmId)).status, "confirmed");
    assert.deepEqual(await h.calls(), []);

    const cancelId = await h.make({ status: "confirmed", doctor: 1, name: "Tim Testing", testing: true });
    await h.search("Tim Testing");
    await h.row("Tim Testing").locator("button", { hasText: /^Cancel$/ }).click();
    await h.modal().waitFor();
    await h.chooseReason("Testing booking");
    await h.modal().locator('button[type="submit"]').click();
    await h.modal().waitFor({ state: "detached" });
    await h.until(async () => /Cancelled/.test(await h.rowText("Tim Testing")), "cancelled");
    assert.equal((await h.doc(cancelId)).status, "cancelled");
    assert.deepEqual(await h.calls(), []);
  });

  test("auto complete asks first, completes Assigned/Confirmed only, and disables everything on a Complete row", async () => {
    const id = await h.make({ status: "confirmed", doctor: 0, name: "Ava Auto" });
    await h.search("Ava Auto");
    await h.row("Ava Auto").locator("button", { hasText: "Auto complete" }).click();
    await h.confirmDialog().waitFor();
    assert.match(await h.confirmDialog().innerText(), /will be marked Complete/);
    await h.confirmDialog().locator("button", { hasText: "Cancel" }).click();
    await h.confirmDialog().waitFor({ state: "detached" });
    assert.equal((await h.doc(id)).status, "confirmed");

    await h.row("Ava Auto").locator("button", { hasText: "Auto complete" }).click();
    await h.confirmDialog().locator("button", { hasText: "Mark complete" }).click();
    await h.until(async () => /Complete/.test(await h.rowText("Ava Auto")), "row Complete");
    assert.equal((await h.doc(id)).status, "complete");
    const disabled = await h.row("Ava Auto").locator("button").evaluateAll((els) => els.map((e) => e.disabled));
    assert.ok(disabled.length >= 3 && disabled.every(Boolean), "Alternate doctor, Auto complete and Cancel are disabled");

    await h.make({ status: "pending", doctor: 1, name: "Pam Pending" });
    await h.search("Pam Pending");
    const auto = h.row("Pam Pending").locator("button", { hasText: "Auto complete" });
    assert.equal(await auto.isDisabled(), true);
    assert.match(await auto.getAttribute("title"), /assigned or confirmed/);
  });

  test("cancel: a reason is required, a paid booking names its gateway, and the result is recorded", async () => {
    await h.reset();
    const id = await h.make({ status: "confirmed", doctor: 1, paid: true, gateway: "paypal", name: "Cal Cancel" });
    await h.search("Cal Cancel");
    await h.row("Cal Cancel").locator("button", { hasText: /^Cancel$/ }).click();
    await h.modal().waitFor();
    assert.equal(await h.modal().locator("h2").innerText(), "Cancel appointment?");
    assert.match(await h.modal().innerText(), /This booking was paid\. Refund it in PayPal\./);
    assert.equal(await h.modal().locator('button[type="submit"]').isDisabled(), true);
    assert.deepEqual(await h.modal().locator("select option").allInnerTexts(), ["Choose a reason", "Patient requested", "Doctor unavailable", "Payment failed", "Duplicate booking", "Testing booking"]);
    await h.shot("cancel-paid");
    await h.chooseReason("Payment failed");
    await h.modal().locator('button[type="submit"]').click();
    await h.modal().waitFor({ state: "detached" });
    await h.until(async () => /Cancelled/.test(await h.rowText("Cal Cancel")), "row Cancelled");
    await h.until(async () => /Refund it in PayPal/.test(await h.toasts()), "refund reminder");
    const saved = await h.doc(id);
    assert.equal(saved.status, "cancelled");
    assert.equal(saved.cancelReason, "Payment failed");
    assert.equal(saved.cancelledBy.name, "Super Admin");
    const names = (await h.calls()).map((c) => c.name);
    assert.ok(names.includes("push:Appointment cancelled") && names.includes("notifyDoctorBookingCancelled"));
    assert.ok((await h.row("Cal Cancel").locator("button").evaluateAll((els) => els.map((e) => e.disabled))).every(Boolean));

    await h.make({ status: "assigned", doctor: 2, paid: true, gateway: "stripe", name: "Stripe Sam" });
    await h.search("Stripe Sam");
    await h.row("Stripe Sam").locator("button", { hasText: /^Cancel$/ }).click();
    await h.modal().waitFor();
    assert.match(await h.modal().innerText(), /Refund it in Stripe\./);
    await h.modal().getByText("Go back").click();
    await h.modal().waitFor({ state: "detached" });

    await h.make({ status: "assigned", doctor: 2, name: "Una Paid" });
    await h.search("Una Paid");
    await h.row("Una Paid").locator("button", { hasText: /^Cancel$/ }).click();
    await h.modal().waitFor();
    assert.equal(await h.modal().getByText("Refund it").count(), 0, "no warning for an unpaid booking");
    await h.chooseReason("Duplicate booking");
    await h.modal().locator('button[type="submit"]').click();
    await h.modal().waitFor({ state: "detached" });
    await h.until(async () => /Cancelled/.test(await h.rowText("Una Paid")), "unpaid cancelled");
  });

  test("a lost race (409) says so, closes the dialog and shows the real state", async () => {
    const id = await h.make({ status: "assigned", doctor: 2, name: "Rex Race" });
    await h.search("Rex Race");
    await h.row("Rex Race").locator("button", { hasText: /^Cancel$/ }).click();
    await h.modal().waitFor();
    await h.chooseReason("Patient requested");
    // Another admin cancels it while this dialog is open.
    assert.equal((await h.call("POST", `/api/admin/bookings/${id}/cancel`, { reason: "Duplicate booking" })).status, 200);
    await h.modal().locator('button[type="submit"]').click();
    await h.modal().waitFor({ state: "detached" });
    await h.until(async () => /already updated, refreshing/.test(await h.toasts()), "the race message");
    await h.until(async () => /Cancelled/.test(await h.rowText("Rex Race")), "row shows Cancelled");
    assert.equal((await h.doc(id)).cancelReason, "Duplicate booking", "the other admin's reason is kept");
  });

  test("a server error stays inside the dialog and a retry works", async () => {
    const id = await h.make({ status: "assigned", doctor: 2, name: "Ed Error" });
    await h.search("Ed Error");
    await page.route("**/api/admin/bookings/*/cancel", (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
    await h.row("Ed Error").locator("button", { hasText: /^Cancel$/ }).click();
    await h.modal().waitFor();
    await h.chooseReason("Doctor unavailable");
    await h.modal().locator('button[type="submit"]').click();
    await h.until(async () => /Something went wrong/.test(await h.modal().innerText()), "inline error");
    assert.equal(await h.modal().isVisible(), true);
    assert.equal((await h.doc(id)).status, "assigned");
    await page.unroute("**/api/admin/bookings/*/cancel");
    await h.modal().locator('button[type="submit"]').click();
    await h.modal().waitFor({ state: "detached" });
    await h.until(async () => /Cancelled/.test(await h.rowText("Ed Error")), "retry works");
  });

  test("no page errors in the whole run", () => {
    assert.deepEqual(pageErrors, []);
  });
});
