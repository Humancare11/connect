// Browser-level tests of the admin Appointments list: the REAL page, in real Chromium, against the REAL
// /api/admin/bookings code over a throwaway in-memory MongoDB (see apiServer.mjs). Emails and push are recorded,
// not sent; there is no login; no real database or secret is involved.
//   npm run test:e2e:appointments   (from frontend/)       E2E_SCREENSHOTS=1 also saves screenshots
// The tests skip themselves when Chromium (or Chrome/Edge) or the backend's dependencies are not installed.
import { test, describe, before, after, beforeEach } from "node:test";
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

  // A test that fails halfway can leave the page on another screen; the next one starts from the list.
  beforeEach(async () => {
    if (!h) return;
    if ((await page.locator(".adp-search input").count()) === 0 || (await page.locator(".hc-modal").count()) > 0) {
      await h.open("/admin-dashboard/appointments?tab=all");
    }
    await page.fill(".adp-search input", "");
  });

  after(async () => {
    await context?.close();
    await browser?.close();
    await vite?.close();
    await api?.close();
  });

  // ── The list itself ───────────────────────────────────────────────────────

  test("the eight tabs, in order, with the columns the spec asks for (the first header is the selection checkbox); Assigned by is hidden on Upcoming", async () => {
    assert.deepEqual((await h.tabs()).map((t) => t.replace(/\s*[\d–]+$/, "")), ["All", "Upcoming", "Assigned", "Pending", "Confirmed", "Complete", "Cancelled", "Testing"]);
    await page.click('[role="tab"]:has-text("Upcoming")');
    await h.until(async () => !(await h.headers()).includes("Assigned by") && (await h.rowsLocator().count()) > 0, "the Upcoming tab");
    await page.click('[role="tab"]:has-text("All")');
    await h.until(async () => (await h.headers()).includes("Assigned by"), "the All tab");
    assert.deepEqual(await h.headers(), ["", "Booking ID", "Patient", "Doctor", "Category", "Booking date", "Consultation date", "Fee", "Status", "Assigned by", "Actions"]);
    assert.equal(await h.rowsLocator().count(), 25);
    const text = await page.locator("table.adp-bk").innerText();
    assert.ok(text.includes("TESTING") && text.includes("Not scheduled") && text.includes("Alternate doctor") && text.includes("Not assigned"));
    await h.shot("list-all");
  });

  test("every tab lists what the server counts for it (25 at most), with the reference status colors", async () => {
    const fromApi = async (q) => (await (await fetch(`${api.url}/api/admin/bookings?${q}`)).json());
    const all = await fromApi("status=all&limit=1");
    const pill = { Upcoming: "#e0f2fe", Assigned: "#ede9fe", Pending: "#fff2d6", Confirmed: "#e3edfc", Complete: "#dcfce7", Cancelled: "#fde7e4" };
    const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
    for (const tab of ["All", "Upcoming", "Assigned", "Pending", "Confirmed", "Complete", "Cancelled", "Testing"]) {
      await page.click(`[role="tab"]:has-text("${tab}")`);
      const key = tab.toLowerCase();
      const want = Math.min(25, all.counts[key]);
      await h.until(async () => (await h.rowsLocator().count()) === want && (await h.tabCount(tab)) === all.counts[key], `${tab}: ${want} rows`);
      if (tab === "All" || tab === "Testing") continue;
      const pills = () => page.$$eval("table.adp-bk tbody .adp-status-pill", (els) => els.map((e) => [e.textContent.trim(), getComputedStyle(e).backgroundColor]));
      await h.until(async () => { const p = await pills(); return p.length > 0 && p.every(([text, bg]) => text === tab && bg === rgb(pill[tab])); }, `${tab} pills in the reference color`);
      assert.equal((await h.headers()).includes("Assigned by"), tab !== "Upcoming");
    }
    await page.click("[role=tab]:has-text(\"All\")");
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
    for (const [width, cards] of [[1500, false], [1280, false], [1040, false], [900, true], [390, true]]) {
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

  test("assign a doctor on the full page: Assigned, back to the list with a toast, tab counts refreshed, doctor and patient told", async () => {
    await h.reset();
    const id = await h.make({ status: "upcoming", name: "Anna Assign" });
    await h.search("Anna Assign");
    assert.match(await h.rowText("Anna Assign"), /Not assigned/);
    await page.click('[role="tab"]:has-text("All")');
    const [upcoming, assigned] = [await h.tabCount("Upcoming"), await h.tabCount("Assigned")];

    await h.openAssignPage("Anna Assign", "Assign doctor");
    assert.equal(await page.locator(".hc-modal").count(), 0, "no popup: it is a page");
    assert.equal((await page.locator(".aad-nav-title").innerText()).trim(), "Assign Doctor");
    const bar = (await page.locator(".aad-appt-bar").innerText()).replace(/\s+/g, " ");
    assert.match(bar, /Patient Anna Assign/i);
    assert.match(bar, /Current Doctor Unassigned/i);
    assert.deepEqual((await h.pageDoctorNames()).sort(), ["Dr. Farah Siddiqui", "Dr. Hidayat Khan", "Dr. Martin Perlin", "Dr. Nobita Mestry"]);
    assert.equal(await page.locator('input[type="time"]').count(), 0, "no time field for a regular appointment");
    assert.equal(await page.locator(".aad-original").count(), 0, "no Go back before there is an original doctor");
    await h.shot("assign-page");
    await h.chooseOnPage("Nobita Mestry");

    await h.waitForList();
    await h.until(async () => /Doctor assigned/.test(await h.toasts()), "success toast");
    await h.search("Anna Assign");
    await h.until(async () => /Assigned/.test(await h.rowText("Anna Assign")) && /Nobita Mestry/.test(await h.rowText("Anna Assign")), "row shows the new doctor");
    const saved = await h.doc(id);
    assert.equal(saved.status, "assigned");
    assert.equal(saved.sessionStarted, false);
    assert.equal(saved.assignedBy.name, "Super Admin");
    await h.until(async () => (await h.tabCount("Upcoming")) === upcoming - 1 && (await h.tabCount("Assigned")) === assigned + 1, "tab counts refreshed");
    const names = (await h.calls()).map((c) => c.name);
    assert.ok(names.includes("notifyAppointmentDoctorChanged") && names.includes("notifyPatientDoctorChanged"));
  });

  test("after saving it returns to the same tab, 'Hide testing' setting and page; Back does the same without saving", async () => {
    await h.reset();
    const target = await h.make({ status: "upcoming", name: "Page Two Target" });
    for (let i = 0; i < 26; i++) await h.make({ status: "complete", doctor: 0, name: `Filler ${i}` }); // newer, so the target falls to page 2 of All
    await h.open("/admin-dashboard/appointments?tab=all&hideTesting=1&page=2");
    await h.search("Page Two Target");
    // search resets to page 1 in the URL; go back to the page-2 list with the search cleared and find the row there
    await page.fill(".adp-search input", "");
    await h.open("/admin-dashboard/appointments?tab=all&hideTesting=1&page=2");
    await h.until(async () => (await page.locator("table.adp-bk tbody tr", { hasText: "Page Two Target" }).count()) === 1, "the target is on page 2");
    await h.openAssignPage("Page Two Target", "Assign doctor");
    await page.locator("a.aad-back").click();
    await h.waitForList();
    assert.match(await page.locator(".adp-bk-foot span").first().innerText(), /^Showing 26/, "Back returns to page 2");
    assert.equal((await h.doc(target)).status, "upcoming", "Back saves nothing");
    assert.equal(await page.locator(".adp-bk-hide").innerText(), "Showing without testing");

    await h.openAssignPage("Page Two Target", "Assign doctor");
    await h.chooseOnPage("Farah Siddiqui");
    await h.waitForList();
    assert.match(await page.locator(".adp-bk-foot span").first().innerText(), /^Showing 26/, "saving returns to page 2");
    assert.equal(await page.locator('[role="tab"].active').first().innerText().then((t) => t.replace(/\s*\d+$/, "").trim()), "All");
    assert.equal(await page.locator(".adp-bk-hide").innerText(), "Showing without testing");
    assert.equal((await h.doc(target)).status, "assigned");
  });

  test("a Next Available category booking shows the old page's fields and the time field; a doctor can't be picked without a time", async () => {
    const id = await h.make({ kind: "category", status: "upcoming", nextAvailable: true, name: "Nina Next" });
    await h.search("Nina Next");
    assert.match(await h.rowText("Nina Next"), /Not scheduled/);
    await h.openAssignPage("Nina Next", "Assign doctor");
    const bar = (await page.locator(".aad-appt-bar").innerText()).replace(/\s+/g, " ");
    for (const label of ["Concern", "Severity", "Support Type", "Urgency", "Time Window", "Appointment", "Current Doctor"]) assert.match(bar, new RegExp(label, "i"), label);
    assert.equal(await page.locator('input[type="time"]').count(), 1);

    await h.chooseOnPage("Hidayat Khan");
    assert.match(await h.pageBanner(), /Enter the appointment time you're assigning before selecting a doctor/);
    assert.equal(await page.locator(".aad-nav-title").count(), 1, "still on the page");
    assert.equal((await h.doc(id)).status, "Pending", "nothing was saved");

    await page.fill('input[type="time"]', "17:30");
    await h.shot("assign-page-time");
    await h.chooseOnPage("Hidayat Khan");
    await h.waitForList();
    await h.search("Nina Next");
    await h.until(async () => /05:30 PM/.test(await h.rowText("Nina Next")), "row shows the time");
    assert.equal((await h.doc(id)).assignedSlot, "05:30 PM");
  });

  test("a flexible category booking shows its slot and needs no time", async () => {
    const id = await h.make({ kind: "category", status: "upcoming", name: "Flex Cat", time: "04:00 PM" });
    await h.search("Flex Cat");
    await h.openAssignPage("Flex Cat", "Assign doctor");
    assert.equal(await page.locator('input[type="time"]').count(), 0);
    assert.match((await page.locator(".aad-appt-bar").innerText()).replace(/\s+/g, " "), /Slot 04:00 PM/i);
    await h.chooseOnPage("Martin Perlin");
    await h.waitForList();
    assert.match(String((await h.doc(id)).status), /^Assigned$/);
  });

  test("a busy doctor stays on the page with the message; another doctor then works", async () => {
    await h.make({ status: "confirmed", doctor: 1, name: "Busy Bee", time: "11:00 AM", date: "2030-12-01" });
    const id = await h.make({ status: "upcoming", name: "Clash Case", time: "11:00 AM", date: "2030-12-01" });
    await h.search("Clash Case");
    await h.openAssignPage("Clash Case", "Assign doctor");
    await h.chooseOnPage("Nobita Mestry");
    await h.until(async () => /already booked/.test(await h.pageBanner()), "the message on the page");
    assert.equal(await page.locator(".aad-nav-title").count(), 1, "still on the page");
    assert.equal((await h.doc(id)).status, "upcoming");
    assert.equal(/already updated, refreshing/.test(await h.toasts()), false, "a busy doctor is not a lost race");
    await h.chooseOnPage("Farah Siddiqui");
    await h.waitForList();
    await h.search("Clash Case");
    await h.until(async () => /Farah Siddiqui/.test(await h.rowText("Clash Case")), "assigned to the other doctor");
  });

  test("a booking changed by someone else meanwhile: the server's 409 message is shown on the page", async () => {
    const id = await h.make({ status: "upcoming", name: "Raced Assign" });
    await h.search("Raced Assign");
    await h.openAssignPage("Raced Assign", "Assign doctor");
    // another admin assigns it first
    assert.equal((await h.call("POST", `/api/admin/bookings/${id}/assign-doctor`, { doctorId: (await (await fetch(`${api.url}/api/doctor/approved`)).json())[0].id })).status, 200);
    await h.chooseOnPage("Hidayat Khan");
    await h.until(async () => /already has a doctor/.test(await h.pageBanner()), "the 409 message on the page");
    assert.equal(await page.locator(".aad-nav-title").count(), 1);
  });

  test("Alternate doctor opens the same page, replaces the doctor and remembers the original; Go back restores it", async () => {
    await h.reset();
    const id = await h.make({ status: "assigned", doctor: 0, name: "Alex Alt" });
    await h.search("Alex Alt");
    await h.openAssignPage("Alex Alt", "Alternate doctor");
    assert.equal((await page.locator(".aad-nav-title").innerText()).trim(), "Alternate Doctor");
    assert.match((await page.locator(".aad-appt-bar").innerText()).replace(/\s+/g, " "), /Current Doctor Martin Perlin/i);
    const current = h.pageDoctorRow("Martin Perlin").locator("button.aad-assign-btn");
    assert.equal((await current.innerText()).trim(), "Assigned");
    assert.equal(await current.isDisabled(), true, "the current doctor can't be picked again");
    assert.equal((await h.pageDoctorRow("Farah Siddiqui").locator("button.aad-assign-btn").innerText()).trim(), "Reassign");
    assert.equal(await page.locator(".aad-original").count(), 0, "no Go back yet");
    await h.chooseOnPage("Farah Siddiqui");

    await h.waitForList();
    await h.until(async () => /Doctor changed/.test(await h.toasts()), "toast");
    await h.search("Alex Alt");
    await h.until(async () => /Farah Siddiqui/.test(await h.rowText("Alex Alt")), "new doctor shown");
    assert.equal(await h.row("Alex Alt").locator(".adp-bk-doctor").getAttribute("title"), "Originally with Martin Perlin");
    assert.equal((await h.doc(id)).originalDoctorName, "Martin Perlin");
    const names = (await h.calls()).map((c) => c.name);
    assert.ok(names.includes("notifyAppointmentDoctorChanged") && names.includes("notifyPatientDoctorChanged"));

    await h.openAssignPage("Alex Alt", "Alternate doctor");
    assert.match((await page.locator(".aad-original").innerText()).replace(/\s+/g, " "), /Originally with Martin Perlin\./);
    await h.shot("alternate-page-go-back");
    await page.locator(".aad-original-btn", { hasText: "Go back to Martin Perlin" }).click();
    await h.waitForList();
    await h.until(async () => /back with Martin Perlin/.test(await h.toasts()), "toast");
    await h.search("Alex Alt");
    await h.until(async () => /Martin Perlin/.test(await h.rowText("Alex Alt")), "original restored");
    const restored = await h.doc(id);
    assert.equal(restored.originalDoctorId, null);
    assert.equal(restored.status, "assigned");
  });

  test("a second alternate keeps the very first doctor as the original", async () => {
    const id = await h.make({ status: "assigned", doctor: 2, name: "Twice Alt" });
    await h.search("Twice Alt");
    await h.openAssignPage("Twice Alt", "Alternate doctor");
    await h.chooseOnPage("Martin Perlin");
    await h.waitForList();
    await h.search("Twice Alt");
    await h.until(async () => /Martin Perlin/.test(await h.rowText("Twice Alt")), "first change");
    await h.openAssignPage("Twice Alt", "Alternate doctor");
    await h.chooseOnPage("Farah Siddiqui");
    await h.waitForList();
    await h.search("Twice Alt");
    await h.until(async () => /Farah Siddiqui/.test(await h.rowText("Twice Alt")), "second change");
    assert.equal((await h.doc(id)).originalDoctorName, "Hidayat Khan");
  });

  test("changing the doctor on a Confirmed booking (either kind) sends it back to Assigned", async () => {
    for (const kind of ["appointment", "category"]) {
      const name = `Connie ${kind}`;
      const id = await h.make({ kind, status: "confirmed", doctor: 2, name });
      await h.search(name);
      assert.match(await h.rowText(name), /Confirmed/);
      await h.openAssignPage(name, "Alternate doctor");
      if (kind === "category") assert.match((await page.locator(".aad-appt-bar").innerText()).replace(/\s+/g, " "), /Concern/i);
      await h.chooseOnPage("Martin Perlin");
      await h.waitForList();
      await h.search(name);
      await h.until(async () => /Assigned/.test(await h.rowText(name)) && !/Confirmed/.test(await h.rowText(name)), `${kind} row is Assigned`);
      assert.notEqual((await h.doc(id)).status.toLowerCase(), "confirmed");
    }
  });

  test("a Complete or Cancelled booking: the list links are disabled, and the page itself refuses", async () => {
    const id = await h.make({ status: "complete", doctor: 0, name: "Closed Page" });
    await h.search("Closed Page");
    const link = h.row("Closed Page").locator('td[data-label="Doctor"] .adp-bk-alt');
    assert.equal(await link.evaluate((el) => el.tagName), "BUTTON", "not a link");
    assert.equal(await link.isDisabled(), true);
    await page.goto(`${h.harnessUrl}/tests/e2e/adminAppointments/harness/index.html?start=${encodeURIComponent(`/admin-dashboard/appointments/${id}/assign`)}`);
    await h.onAssignPage();
    assert.match(await h.pageBanner(), /A complete booking can't change doctor/);
    const buttons = await page.locator(".aad-doctor-row:not(.aad-doctor-row--head) button.aad-assign-btn").evaluateAll((els) => els.map((e) => e.disabled));
    assert.ok(buttons.length === 4 && buttons.every(Boolean), "every Assign button is disabled");
    await h.open("/admin-dashboard/appointments?tab=all");
  });

  // ── Confirm, auto complete, cancel ────────────────────────────────────────

  test("there is no admin Confirm: no row offers it, whatever its status (only the doctor confirms)", async () => {
    await h.reset();
    for (const [status, name] of [["assigned", "Cora Confirm"], ["pending", "Penny Pending"], ["confirmed", "Nick Confirmed"], ["upcoming", "Una Upcoming"]]) {
      await h.make({ status, doctor: status === "upcoming" ? null : 0, name });
    }
    await h.search("Cora Confirm");
    assert.equal(await page.locator(".adp-bk-actions button", { hasText: /^Confirm/ }).count(), 0, "no Confirm button on an Assigned row");
    await page.fill(".adp-search input", "");
    await page.click('[role="tab"]:has-text("All")');
    await h.until(async () => (await h.rowsLocator().count()) > 0, "rows");
    assert.equal(await page.locator(".adp-bk-actions button", { hasText: /^Confirm/ }).count(), 0, "no Confirm button anywhere");
  });

  test("a testing booking is cancelled with no email and no push", async () => {
    await h.reset();
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
    const state = await h.row("Ava Auto").locator(".adp-bk-actions button, td[data-label=\"Doctor\"] button").evaluateAll((els) => els.map((e) => [e.textContent.trim(), e.disabled]));
    assert.deepEqual(state, [["Alternate doctor", true], ["Reactivate", false], ["Cancel", true]], "a Complete row offers Reactivate in place of Auto complete");

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
    assert.ok((await h.row("Cal Cancel").locator(".adp-bk-actions button, td[data-label=\"Doctor\"] button").evaluateAll((els) => els.map((e) => e.disabled))).every(Boolean), "every action on a cancelled row is disabled");

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

  // ── Selecting rows and bulk actions ───────────────────────────────────────

  const menuLabels = async () => page.locator('[role="menu"] button').allInnerTexts();
  const openMenu = async () => {
    await page.locator(".adp-bk-headcheck").click();
    await page.locator('[role="menu"]').waitFor();
  };
  const choose = async (label) => {
    await page.locator('[role="menu"] button', { hasText: label }).click();
    await page.locator('[role="menu"]').waitFor({ state: "detached" });
  };
  const selectedText = async () => (await page.locator(".adp-bk-bulk-count").innerText()).trim();
  const bulkButton = (action) => page.locator(`.adp-bk-bulk-btn[data-bulk="${action}"]`);
  const resultItems = async (section) => page.locator(`.hc-modal ul[aria-label="${section}"] li`).allInnerTexts();
  const resultTitle = async () => (await page.locator(".hc-modal h2").innerText()).trim();
  const closeResult = async () => {
    await page.locator(".hc-modal button", { hasText: "Close" }).click();
    await page.locator(".hc-modal").waitFor({ state: "detached" });
  };

  test("the header checkbox opens a menu of only the choices that make sense; it does not select by itself", async () => {
    await page.fill(".adp-search input", "");
    await page.click('[role="tab"]:has-text("All")');
    await h.until(async () => (await h.rowsLocator().count()) === 25, "25 rows");

    assert.equal(await page.locator(".adp-bk-rowcheck").count(), 0, "no row tick boxes until selecting");
    await openMenu();
    assert.deepEqual(await menuLabels(), ["Select this page", "Select one by one"]);
    assert.equal(await page.locator(".adp-bk-headcheck").isChecked(), false, "the header checkbox did not select anything");
    assert.equal(await page.locator(".adp-bk-bulk").count(), 0);
    await page.keyboard.press("Escape");
    await page.locator('[role="menu"]').waitFor({ state: "detached" });

    await openMenu();
    await choose("Select one by one");
    assert.equal(await page.locator(".adp-bk-rowcheck").count(), 25, "tick boxes appear on every row");
    assert.equal(await selectedText(), "0 selected on this page");
    assert.equal(await bulkButton("auto-complete").isDisabled(), true, "nothing to act on yet");
    await openMenu();
    assert.deepEqual(await menuLabels(), ["Select this page", "Exit selection"]);
    await page.keyboard.press("Escape");

    await page.locator(".adp-bk-rowcheck").nth(0).check();
    await page.locator(".adp-bk-rowcheck").nth(3).check();
    assert.equal(await selectedText(), "2 selected on this page");
    assert.equal(await page.locator(".adp-bk-headcheck").evaluate((el) => el.indeterminate), true, "partly selected");
    await openMenu();
    assert.deepEqual(await menuLabels(), ["Select this page", "Clear selection", "Exit selection"]);
    await choose("Select this page");
    assert.equal(await selectedText(), "25 selected on this page");
    assert.equal(await page.locator(".adp-bk-headcheck").isChecked(), true);
    await openMenu();
    assert.deepEqual(await menuLabels(), ["Clear selection", "Exit selection"]);
    await choose("Clear selection");
    assert.equal(await selectedText(), "0 selected on this page");
    assert.equal(await page.locator(".adp-bk-rowcheck").count(), 25, "selection stays on after Clear");

    await page.locator(".adp-bk-rowcheck").nth(1).check();
    await page.click('button[aria-label="Next page"]');
    await h.until(async () => (await selectedText()) === "0 selected on this page", "the selection is of one page: a new page starts again");
    await page.click('button[aria-label="Previous page"]');
    await openMenu();
    await choose("Exit selection");
    assert.equal(await page.locator(".adp-bk-bulk").count(), 0);
    assert.equal(await page.locator(".adp-bk-rowcheck").count(), 0);

    await openMenu();
    await choose("Select this page");
    await page.locator(".adp-bk-bulk-btn--done").click();
    assert.equal(await page.locator(".adp-bk-bulk").count(), 0, "Done leaves selection");
    await h.shot("selection-menu");
  });

  test("bulk auto complete on a mixed selection: allowed rows done, the rest skipped with the server's reason", async () => {
    await h.reset();
    const ids = {
      a: await h.make({ status: "assigned", doctor: 0, name: "Mix A" }),
      b: await h.make({ kind: "category", status: "confirmed", doctor: 1, name: "Mix B" }),
      t: await h.make({ status: "assigned", doctor: 2, name: "Mix T", testing: true }),
      c: await h.make({ status: "pending", doctor: 3, name: "Mix C" }),
      d: await h.make({ status: "upcoming", name: "Mix D" }),
      e: await h.make({ status: "complete", doctor: 0, name: "Mix E" }),
      gone: await h.make({ status: "assigned", doctor: 1, name: "Mix Gone" }),
    };
    await h.search("Mix ");
    await h.until(async () => (await h.rowsLocator().count()) === 7, "7 Mix rows");
    await openMenu();
    await choose("Select this page");
    assert.equal(await selectedText(), "7 selected on this page");
    await h.remove(ids.gone); // disappears while it is ticked

    await bulkButton("auto-complete").click();
    await h.confirmDialog().waitFor();
    const message = await h.confirmDialog().innerText();
    // The page counts what looks completable (the booking deleted underneath still looks Assigned); the server has the last word.
    assert.match(message, /Auto complete 4 appointments\?/);
    assert.match(message, /3 of the selected bookings are not Assigned or Confirmed and will be skipped/);
    await h.shot("bulk-auto-complete-confirm");
    await h.confirmDialog().locator("button", { hasText: "Mark complete" }).click();

    await h.modal().waitFor();
    assert.equal(await resultTitle(), "Auto complete: 3 done, 4 skipped");
    const skipped = (await resultItems("Not done")).map((t) => t.replace(/\s+/g, " "));
    assert.equal(skipped.length, 4);
    assert.ok(skipped.some((t) => /Mix C/.test(t) && /Skipped/.test(t) && /This one is pending/.test(t)), skipped.join("\n"));
    assert.ok(skipped.some((t) => /Mix D/.test(t) && /This one is upcoming/.test(t)));
    assert.ok(skipped.some((t) => /Mix E/.test(t) && /This one is complete/.test(t)));
    assert.ok(skipped.some((t) => /no longer exists/.test(t)));
    await h.shot("bulk-result");
    await closeResult();

    await h.until(async () => /Complete/.test(await h.rowText("Mix A")) && /Complete/.test(await h.rowText("Mix B")) && /Complete/.test(await h.rowText("Mix T")), "rows refreshed to Complete");
    assert.match(await h.rowText("Mix C"), /Pending/);
    assert.equal((await h.doc(ids.a)).status, "complete");
    assert.equal((await h.doc(ids.b)).status, "Completed");
    assert.equal((await h.doc(ids.c)).status, "pending");
    assert.equal(await selectedText(), "0 selected on this page", "ticks cleared after the action");
    const pushes = (await h.calls()).filter((c) => c.name === "push:Appointment completed");
    assert.equal(pushes.length, 2, "two patients told; the testing booking sends nothing");
  });

  test("bulk cancel: one required reason, the paid bookings counted before and after, notifications only for real bookings", async () => {
    await h.reset();
    const ids = {
      p1: await h.make({ status: "confirmed", doctor: 1, paid: true, gateway: "stripe", name: "Cx One" }),
      p2: await h.make({ status: "assigned", doctor: 2, paid: true, gateway: "paypal", name: "Cx Two" }),
      p3: await h.make({ status: "upcoming", name: "Cx Three" }),
      p4: await h.make({ status: "complete", doctor: 0, name: "Cx Four" }),
      p5: await h.make({ status: "assigned", doctor: 3, paid: true, gateway: "stripe", name: "Cx Five", testing: true }),
    };
    await h.search("Cx ");
    await h.until(async () => (await h.rowsLocator().count()) === 5, "5 Cx rows");
    await openMenu();
    await choose("Select this page");
    await bulkButton("cancel").click();
    await h.modal().waitFor();
    assert.equal(await resultTitle(), "Cancel 5 bookings?");
    const text = (await h.modal().innerText()).replace(/\s+/g, " ");
    assert.match(text, /1 of the selected bookings is already Complete or Cancelled and will be skipped/);
    assert.match(text, /3 of the selected bookings were paid and are not refunded automatically\. Refund them: Stripe \(2\), PayPal \(1\)\./);
    assert.equal(await h.modal().locator('button[type="submit"]').isDisabled(), true, "a reason is required");
    assert.deepEqual(await h.modal().locator("select option").allInnerTexts(), ["Choose a reason", "Patient requested", "Doctor unavailable", "Payment failed", "Duplicate booking", "Testing booking"]);
    await h.shot("bulk-cancel-dialog");
    await h.chooseReason("Duplicate booking");
    await h.modal().locator('button[type="submit"]').click();

    await h.until(async () => (await resultTitle()) === "Cancel: 4 done, 1 skipped", "result dialog");
    const resultText = (await h.modal().innerText()).replace(/\s+/g, " ");
    assert.match(resultText, /Cx Four/);
    assert.match(resultText, /A complete booking can't be cancelled/);
    assert.match(resultText, /3 of the cancelled bookings were paid and are not refunded automatically\. Refund them: Stripe \(2\), PayPal \(1\)\./);
    await closeResult();

    for (const key of ["p1", "p2", "p3", "p5"]) {
      const saved = await h.doc(ids[key]);
      assert.equal(String(saved.status).toLowerCase(), "cancelled", key);
      assert.equal(saved.cancelReason, "Duplicate booking", key);
    }
    assert.equal((await h.doc(ids.p4)).cancelReason, "");
    const names = (await h.calls()).map((c) => c.name);
    assert.equal(names.filter((n) => n === "push:Appointment cancelled").length, 3, "p1, p2, p3 (not the testing booking)");
    assert.equal(names.filter((n) => n === "notifyDoctorBookingCancelled").length, 2, "p1 and p2 had a doctor");

    // Nothing paid in the selection: no refund warning.
    await h.make({ status: "assigned", doctor: 0, name: "Cy Free" });
    await h.search("Cy Free");
    await openMenu();
    await choose("Select this page");
    await bulkButton("cancel").click();
    await h.modal().waitFor();
    assert.equal(await h.modal().getByText("refunded automatically").count(), 0);
    await h.modal().getByText("Go back").click();
    await h.modal().waitFor({ state: "detached" });
  });

  test("mark and unmark testing: any status, nothing sent, the Testing count follows", async () => {
    await h.reset();
    const ids = [
      await h.make({ status: "complete", doctor: 0, name: "Tag One" }),
      await h.make({ status: "cancelled", doctor: 1, name: "Tag Two" }),
      await h.make({ kind: "category", status: "upcoming", name: "Tag Three" }),
    ];
    await h.search("Tag ");
    await h.until(async () => (await h.rowsLocator().count()) === 3, "3 Tag rows");
    await page.click('[role="tab"]:has-text("All")');
    const testing = await h.tabCount("Testing");
    await openMenu();
    await choose("Select this page");
    await bulkButton("mark-testing").click();
    await h.until(async () => /3 bookings marked as testing\./.test(await h.toasts()), "the toast");
    assert.equal(await page.locator(".hc-modal").count(), 0, "no dialog, no confirmation: just the toast");
    await h.until(async () => (await page.locator("table.adp-bk .adp-bk-tag").count()) === 3, "TESTING tags");
    await h.until(async () => (await h.tabCount("Testing")) === testing + 3, "Testing count up by 3");
    for (const id of ids) assert.equal((await h.doc(id)).isTesting, true);
    assert.equal((await h.doc(ids[0])).testingMarkedBy.name, "Super Admin");

    await openMenu();
    await choose("Select this page");
    await bulkButton("unmark-testing").click();
    await h.until(async () => /3 bookings unmarked as testing\./.test(await h.toasts()), "the toast");
    await h.until(async () => (await page.locator("table.adp-bk .adp-bk-tag").count()) === 0, "tags gone");
    await h.until(async () => (await h.tabCount("Testing")) === testing, "Testing count back");
    for (const id of ids) assert.equal((await h.doc(id)).isTesting, false);
    assert.deepEqual(await h.calls(), [], "marking sends nothing");
  });

  test("a failed request keeps the selection and says so; there is no bulk Confirm", async () => {
    const id = await h.make({ status: "confirmed", doctor: 0, name: "Fail Case" });
    await h.search("Fail Case");
    await openMenu();
    await choose("Select this page");
    assert.equal(await page.locator(".adp-bk-bulk-btn", { hasText: /^Confirm$/ }).count(), 0, "no bulk Confirm");
    assert.deepEqual(await page.locator(".adp-bk-bulk-btn").allInnerTexts(), ["Auto complete", "Cancel", "Mark testing", "Unmark testing", "Done"]);
    await page.route("**/api/admin/bookings/bulk", (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
    await bulkButton("mark-testing").click();
    await h.until(async () => /Something went wrong/.test(await h.toasts()), "error message");
    assert.equal(await selectedText(), "1 selected on this page", "the ticks are kept so it can be retried");
    assert.equal((await h.doc(id)).isTesting, false);
    await page.unroute("**/api/admin/bookings/bulk");
    await bulkButton("mark-testing").click();
    await h.until(async () => /1 booking marked as testing\./.test(await h.toasts()), "retry works");
    assert.equal((await h.doc(id)).isTesting, true);
    await page.locator(".adp-bk-bulk-btn--done").click();
  });

  test("the testing toast has an Undo that reverses exactly the bookings that changed", async () => {
    await h.reset();
    const a = await h.make({ status: "confirmed", doctor: 0, name: "Undo One" });
    const b = await h.make({ kind: "category", status: "upcoming", name: "Undo Two" });
    const alreadyTesting = await h.make({ status: "assigned", doctor: 1, name: "Undo Three", testing: true });
    await h.search("Undo ");
    await h.until(async () => (await h.rowsLocator().count()) === 3, "3 Undo rows");
    const undoButton = () => page.locator(".hc-toast__action", { hasText: "Undo" });
    // Toasts from earlier tests may still be showing (the Undo ones stay 10 seconds): start from none.
    while ((await page.locator(".hc-toast__close").count()) > 0) await page.locator(".hc-toast__close").first().click();
    await h.until(async () => (await page.locator(".hc-toast").count()) === 0, "no toasts");

    // Mark all three as testing, then Undo: the two that changed are unmarked, the one that already was testing stays.
    await openMenu();
    await choose("Select this page");
    await bulkButton("mark-testing").click();
    await h.until(async () => (await undoButton().count()) === 1, "the Undo button");
    assert.match(await h.toasts(), /3 bookings marked as testing\./);
    await h.shot("testing-undo-toast");
    await undoButton().click();
    await h.until(async () => /Undone\./.test(await h.toasts()), "undone");
    await h.until(async () => (await h.doc(a)).isTesting === false && (await h.doc(b)).isTesting === false, "back to normal");
    assert.equal((await h.doc(alreadyTesting)).isTesting, true, "a booking that was already testing is not touched by the Undo");
    await h.until(async () => (await page.locator("table.adp-bk .adp-bk-tag").count()) === 1, "only the one that was testing before keeps its tag");
    assert.equal(await undoButton().count(), 0, "the toast is dismissed");

    // And the other way: unmark, then Undo marks them again.
    await h.until(async () => (await page.locator(".adp-bk-rowcheck").count()) === 3, "still selecting");
    await openMenu();
    await choose("Select this page");
    await bulkButton("mark-testing").click();
    await h.until(async () => (await undoButton().count()) === 1, "Undo for the mark");
    await openMenu();
    await choose("Select this page");
    await bulkButton("unmark-testing").click();
    await h.until(async () => /unmarked as testing\./.test(await h.toasts()), "unmark toast");
    await h.until(async () => (await undoButton().count()) >= 1, "Undo for the unmark");
    await undoButton().last().click();
    await h.until(async () => (await h.doc(a)).isTesting === true && (await h.doc(b)).isTesting === true, "marked again by the undo");
    assert.deepEqual(await h.calls(), [], "none of this sent anything");
    await page.locator(".adp-bk-bulk-btn--done").click();
  });

  test("on a phone-width screen the table is cards, and a Select button opens the same menu", async () => {
    await page.setViewportSize({ width: 390, height: 900 });
    await h.open("/admin-dashboard/appointments?tab=all");
    await h.until(async () => (await page.locator(".adp-bk-seltools button").count()) === 1, "the Select button");
    assert.equal(await page.locator(".adp-bk-headcheck").isVisible(), false, "the table header is hidden on cards");
    await page.locator(".adp-bk-seltools button").click();
    await page.locator('[role="menu"]').waitFor();
    assert.deepEqual(await menuLabels(), ["Select this page", "Select one by one"]);
    await choose("Select this page");
    await h.until(async () => (await selectedText()) === "25 selected on this page", "25 selected");
    assert.equal(await page.locator(".adp-bk-rowcheck").first().isVisible(), true, "each card shows its tick box");
    assert.equal(await page.locator(".adp-bk-rownum").first().isVisible(), false);
    const card = await page.evaluate(() => {
      const num = document.querySelector("td.adp-bk-num");
      const by = [...document.querySelectorAll('td[data-label="Assigned by"]')].find((td) => td.textContent.trim().length > 3);
      const id = [...document.querySelectorAll("td[data-label=\"Booking ID\"]")].find((td) => td.querySelector(".adp-bk-tag"));
      return {
        numCaption: getComputedStyle(num, "::before").display,
        assignedByWidth: Math.round(by.getBoundingClientRect().width),
        idCellChildren: id ? id.children.length : -1,
      };
    });
    assert.equal(card.numCaption, "none", "no stray # caption above the tick box");
    assert.ok(card.assignedByWidth > 150, `Assigned by is not squeezed (${card.assignedByWidth}px)`);
    assert.equal(card.idCellChildren, 1, "the TESTING tag stays with the booking id");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `sideways scroll ${overflow}px`);
    await h.shot("selection-cards");
    await page.locator(".adp-bk-bulk-btn--done").click();
    await page.setViewportSize({ width: 1500, height: 1000 });
    await h.open("/admin-dashboard/appointments?tab=all");
  });

  // ── Round 3: copy id, Assign in the Doctor column, Reactivate, Cancel for super admins, Assigned by ──

  test("clicking the booking id copies the FULL id and says so; the short id is what shows", async () => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(page.url()).origin });
    const id = await h.make({ status: "assigned", doctor: 0, name: "Copy Case" });
    await h.search("Copy Case");
    const button = h.row("Copy Case").locator(".adp-bk-idcopy");
    assert.equal(await button.getAttribute("title"), "Click to copy the booking ID");
    assert.equal(await button.evaluate((el) => getComputedStyle(el).cursor), "copy");
    assert.equal((await button.innerText()).trim(), `\u2026${id.slice(-8).toUpperCase()}`);
    await button.click();
    await h.until(async () => /Booking ID copied/.test(await h.toasts()), "the toast");
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), id, "the clipboard holds the full id, not the short one");
  });

  test("when the browser will not copy, the id is selected and the toast says to press Ctrl+C", async () => {
    const id = await h.make({ status: "assigned", doctor: 1, name: "Copy Fallback" });
    await h.search("Copy Fallback");
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("NotAllowedError")) }, configurable: true });
      document.execCommand = () => false;
    });
    await h.row("Copy Fallback").locator(".adp-bk-idcopy").click();
    await h.until(async () => /Could not copy automatically/.test(await h.toasts()), "the fallback toast");
    assert.match(await h.toasts(), new RegExp(id));
    assert.equal(await page.evaluate(() => window.getSelection().toString().trim()), id, "the full id is selected, ready for Ctrl+C");
    await h.open("/admin-dashboard/appointments?tab=all");
  });

  test("Assign doctor is a link in the Doctor column, under Not assigned, and not in the Actions column", async () => {
    await h.make({ status: "upcoming", name: "Dora Doctorcell" });
    await h.search("Dora Doctorcell");
    const doctorCell = h.row("Dora Doctorcell").locator('td[data-label="Doctor"]');
    assert.match((await doctorCell.innerText()).replace(/\s+/g, " "), /^Not assigned Assign doctor$/);
    assert.equal(await doctorCell.locator("a", { hasText: "Assign doctor" }).count(), 1, "it is a link to the page");
    assert.equal(await h.row("Dora Doctorcell").locator(".adp-bk-actions", { hasText: "Assign doctor" }).count(), 0, "not in Actions");
    assert.equal(await page.locator(".hc-modal").count(), 0);
  });

  test("a booking marked Assigned (or Confirmed, or Pending) with no doctor can be assigned one, and so can one whose doctor was deleted", async () => {
    const cases = [
      ["Old Assigned", { status: "assigned" }],
      ["Old Confirmed", { status: "confirmed" }],
      ["Old Pending", { status: "pending", kind: "category" }],
      ["Ghost Doctor", { status: "assigned", ghostDoctor: true }],
      ["Ghost Category", { status: "assigned", kind: "category", ghostDoctor: true }],
    ];
    for (const [name, spec] of cases) {
      const id = await h.make({ name, ...spec });
      await h.search(name);
      assert.match(await h.rowText(name), /Not assigned/, name);
      await h.openAssignPage(name, "Assign doctor");
      assert.equal((await page.locator(".aad-nav-title").innerText()).trim(), "Assign Doctor", `${name}: treated as having no doctor`);
      await h.chooseOnPage("Hidayat Khan");
      await h.waitForList();
      await h.search(name);
      await h.until(async () => /Hidayat Khan/.test(await h.rowText(name)), `${name} assigned`);
      assert.match(String((await h.doc(id)).status).toLowerCase(), /^assigned$/, name);
    }
    for (const [status, name] of [["complete", "Closed Complete"], ["cancelled", "Closed Cancelled"]]) {
      await h.make({ status, name });
      await h.search(name);
      assert.equal(await h.row(name).locator('td[data-label="Doctor"] button', { hasText: "Assign doctor" }).isDisabled(), true, `${name} can't be assigned`);
    }
  });

  test("Reactivate: only on Complete rows, in place of Auto complete, behind a confirmation; back to Confirmed for both kinds", async () => {
    await h.reset();
    const ids = {
      appointment: await h.make({ status: "complete", doctor: 0, name: "React Appointment" }),
      category: await h.make({ kind: "category", status: "complete", doctor: 1, name: "React Category" }),
    };
    await h.make({ status: "confirmed", doctor: 2, name: "React NotComplete" });
    await h.search("React NotComplete");
    assert.equal(await h.row("React NotComplete").locator("button", { hasText: "Reactivate" }).count(), 0);
    assert.equal(await h.row("React NotComplete").locator("button", { hasText: "Auto complete" }).count(), 1);

    for (const [kind, name] of [["appointment", "React Appointment"], ["category", "React Category"]]) {
      await h.search(name);
      const labels = await h.row(name).locator(".adp-bk-actions button, .adp-bk-actions a").allInnerTexts();
      assert.deepEqual(labels.map((t) => t.trim()), ["View", "Reactivate", "Cancel"], `${name}: Reactivate replaces Auto complete`);
      await h.row(name).locator("button", { hasText: "Reactivate" }).click();
      await h.confirmDialog().waitFor();
      assert.match(await h.confirmDialog().innerText(), /goes from Complete back to Confirmed/);
      await h.shot(`reactivate-${kind}`);
      await h.confirmDialog().locator("button", { hasText: "Cancel" }).click();
      await h.confirmDialog().waitFor({ state: "detached" });
      assert.match(String((await h.doc(ids[kind])).status), kind === "appointment" ? /^complete$/ : /^Completed$/, "dismissing changes nothing");

      await h.row(name).locator("button", { hasText: "Reactivate" }).click();
      await h.confirmDialog().locator("button", { hasText: /^Reactivate$/ }).click();
      await h.until(async () => /Confirmed/.test(await h.rowText(name)), `${name} is Confirmed again`);
      const saved = await h.doc(ids[kind]);
      assert.equal(String(saved.status).toLowerCase(), "confirmed");
      assert.equal(saved.reactivatedBy.name, "Super Admin");
      assert.ok(saved.reactivatedAt);
      assert.equal(await h.row(name).locator("button", { hasText: "Reactivate" }).count(), 0, "the button is gone once it is active");
      assert.equal(await h.row(name).locator("button", { hasText: "Auto complete" }).count(), 1);
    }
    const names = (await h.calls()).map((c) => c.name);
    assert.equal(names.filter((n) => n === "push:Appointment reopened").length >= 0, true);
  });

  test("Reactivate for a testing booking sends nothing; one with no doctor is disabled with the reason", async () => {
    await h.reset();
    const id = await h.make({ status: "complete", doctor: 3, name: "React Testing", testing: true });
    await h.search("React Testing");
    await h.row("React Testing").locator("button", { hasText: "Reactivate" }).click();
    await h.confirmDialog().locator("button", { hasText: /^Reactivate$/ }).click();
    await h.until(async () => /Confirmed/.test(await h.rowText("React Testing")), "confirmed again");
    assert.equal(String((await h.doc(id)).status).toLowerCase(), "confirmed");
    assert.deepEqual(await h.calls(), [], "no email, no push");

    await h.make({ status: "complete", name: "React NoDoctor" });
    await h.search("React NoDoctor");
    const button = h.row("React NoDoctor").locator("button", { hasText: "Reactivate" });
    assert.equal(await button.isDisabled(), true);
    assert.match(await button.getAttribute("title"), /no doctor/);
  });

  test("Cancel is for super admins: an ordinary admin sees no Cancel button on rows or in the bulk bar", async () => {
    await h.make({ status: "confirmed", doctor: 0, name: "Role Case" });
    await h.open("/admin-dashboard/appointments?tab=all", { role: "admin" });
    await h.search("Role Case");
    assert.equal(await h.row("Role Case").locator("button", { hasText: /^Cancel$/ }).count(), 0, "no row Cancel for an admin");
    assert.deepEqual(await h.row("Role Case").locator(".adp-bk-actions button, .adp-bk-actions a").allInnerTexts().then((t) => t.map((x) => x.trim())), ["View", "Auto complete"]);
    await page.locator(".adp-bk-headcheck").click();
    await page.locator('[role="menu"] button', { hasText: "Select this page" }).click();
    assert.deepEqual(await page.locator(".adp-bk-bulk-btn").allInnerTexts(), ["Auto complete", "Mark testing", "Unmark testing", "Done"], "no bulk Cancel for an admin");
    await page.locator(".adp-bk-bulk-btn--done").click();

    await h.open("/admin-dashboard/appointments?tab=all", { role: "superadmin" });
    await h.search("Role Case");
    assert.equal(await h.row("Role Case").locator("button", { hasText: /^Cancel$/ }).count(), 1, "a super admin does");
  });

  test("Assigned by: a long email is cut with an ellipsis (never broken mid-word) and shown in full on hover; old rows get an explanation", async () => {
    await page.setViewportSize({ width: 1500, height: 1000 });
    await h.open("/admin-dashboard/appointments?tab=all");
    const email = "administrator.on.duty@humancareconnect.co";
    await h.make({ status: "assigned", doctor: 0, name: "By Longemail", assignedBy: email });
    await h.make({ status: "assigned", doctor: 1, name: "By Oldrow", assignedBy: null });
    await h.make({ status: "confirmed", doctor: 2, name: "By Direct", assignedBy: null });
    await h.search("By Longemail");
    const by = h.row("By Longemail").locator(".adp-bk-by");
    assert.equal(await by.getAttribute("title"), email, "the full value on hover");
    const metrics = await by.evaluate((el) => ({
      oneLine: el.getBoundingClientRect().height < parseFloat(getComputedStyle(el).fontSize) * 2,
      overflows: el.scrollWidth > el.clientWidth,
      ellipsis: getComputedStyle(el).textOverflow,
      nowrap: getComputedStyle(el).whiteSpace,
    }));
    assert.equal(metrics.ellipsis, "ellipsis");
    assert.equal(metrics.nowrap, "nowrap");
    assert.equal(metrics.overflows, true, "it is cut, not wrapped");
    assert.ok(metrics.oneLine, `one line (${JSON.stringify(metrics)})`);
    await h.shot("assigned-by-ellipsis");

    await h.search("By Oldrow");
    const old = h.row("By Oldrow").locator(".adp-bk-by");
    assert.equal((await old.innerText()).trim(), "\u2014");
    assert.equal(await old.getAttribute("title"), "Assigned before tracking started");
    await h.search("By Direct");
    assert.match(await h.row("By Direct").locator(".adp-bk-by").getAttribute("title"), /booked directly with the doctor, or assigned before tracking started/);

    // on a phone-width card the whole email is shown (wrapped if it must), not cut
    await page.setViewportSize({ width: 390, height: 900 });
    await h.open("/admin-dashboard/appointments?tab=all");
    await h.search("By Longemail");
    const card = await h.row("By Longemail").locator(".adp-bk-by").evaluate((el) => ({ cut: el.scrollWidth > el.clientWidth + 1, text: el.textContent }));
    assert.equal(card.cut, false);
    assert.equal(card.text, email);
    await page.setViewportSize({ width: 1500, height: 1000 });
    await h.open("/admin-dashboard/appointments?tab=all");
  });

  test("old Category Consultations URLs redirect to the Appointments page, and the assign URL is a real page", async () => {
    const landed = async (start) => {
      await page.goto(`${h.harnessUrl}/tests/e2e/adminAppointments/harness/index.html?mode=routes&start=${encodeURIComponent(start)}`);
      return (await page.locator("#landed").innerText()).trim();
    };
    const id = "64b000000000000000000abc";
    assert.equal(await landed("/admin-dashboard/category-consultations"), "/admin-dashboard/appointments?tab=all");
    assert.equal(await landed(`/admin-dashboard/category-consultations/${id}`), `/admin-dashboard/appointments/${id}`);
    assert.equal(await landed(`/admin-dashboard/category-consultations/assign-doctor/${id}`), `/admin-dashboard/appointments/${id}/assign`, "the old category assign page opens the assign page");
    assert.equal(await landed(`/admin-dashboard/appointments/${id}/assign`), `/admin-dashboard/appointments/${id}/assign`, "the assign URL is a page again, not a redirect");
    await h.open("/admin-dashboard/appointments?tab=all");
  });

  test("no page errors in the whole run", () => {
    assert.deepEqual(pageErrors, []);
  });
});
