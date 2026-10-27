// Browser-level tests of the admin Appointment entries page: the REAL page inside the REAL admin layout, in real Chromium, against
// the REAL /api/admin/entries code over a throwaway in-memory MongoDB (see apiServer.mjs). No login; no real database or secret.
//   npm run test:e2e:entries   (from frontend/)       E2E_SCREENSHOTS=1 also saves screenshots
// The tests skip themselves when Chromium (or Chrome/Edge) or the backend's dependencies are not installed.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { findBrowser } from "../adminAppointments/helpers.mjs";
import stubContexts from "../../ui-baseline/stubContexts.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, "..", "..", "..");
const shotDir = path.join(here, ".screenshots");
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Today in India, which is the date a Paid edit fills in (the server uses the Indian calendar day).
const istToday = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

describe("admin Appointment entries page in a real browser", { skip: skipReason || false }, () => {
  let api;
  let vite;
  let browser;
  let context;
  let page;
  let harnessUrl;
  let doctors;
  const pageErrors = [];
  let seq = 0;
  const unique = (label) => `${label} ${Date.now().toString(36)}${++seq}`;

  const call = async (method, route, body, headers = {}) => {
    const res = await fetch(api.url + route, { method, headers: { "content-type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, body: json, text, headers: res.headers };
  };
  const make = async (spec) => (await call("POST", "/__make", spec)).body.id;
  const stored = async (kind, id) => (await call("GET", `/__doc/${kind}/${id}`)).body;

  const until = async (fn, what, ms = 8000) => {
    const end = Date.now() + ms;
    let last;
    while (Date.now() < end) {
      try {
        last = await fn();
        if (last) return last;
      } catch (error) {
        last = error;
      }
      await sleep(100);
    }
    throw new Error(`timed out waiting for ${what}${last instanceof Error ? `: ${last.message}` : ""}`);
  };

  const open = async (start = "/admin-dashboard/appointment-entries", { role = "admin", width = 1500, height = 1000 } = {}) => {
    await page.setViewportSize({ width, height });
    await page.goto(`${harnessUrl}/tests/e2e/adminEntries/harness/index.html?role=${role}&start=${encodeURIComponent(start)}`);
    await page.waitForSelector(".en-table tbody tr, .en-state");
  };
  const row = (text) => page.locator(".en-table tbody tr", { hasText: text }).first();
  const feeBox = (text) => row(text).locator('input[aria-label="Doctor fee"]');
  const statusBox = (text) => row(text).locator('select[aria-label="Paid status"]');
  const paidOnBox = (text) => row(text).locator('input[aria-label="Paid on"]');
  const commentBox = (text) => row(text).locator('input[aria-label="Comment"]');
  const toasts = async () => (await page.locator(".hc-toasts").innerText().catch(() => "")).replace(/\s+/g, " ");
  const tabText = async () => page.$$eval(".en-tab", (els) => els.map((e) => e.textContent.replace(/\s+/g, " ").trim()));
  // Tabs are found by their exact label ("Paid" must not match "Unpaid").
  const tabButton = (label) => page.locator(".en-tab").filter({ hasText: new RegExp(`^${label}\\s*[\\d–]`) });
  const tabCount = async (label) => Number((await tabButton(label).locator("i").innerText()).trim());
  const clickTab = (label) => tabButton(label).click();
  const summary = async () => page.$$eval(".en-kpi", (els) => Object.fromEntries(els.map((e) => [e.querySelector("small").textContent, e.querySelector("b").textContent])));
  const money = (text) => Number(text.replace(/[^0-9.]/g, ""));
  const shot = async (name) => {
    if (process.env.E2E_SCREENSHOTS !== "1") return;
    fs.mkdirSync(shotDir, { recursive: true });
    await sleep(450);
    await page.screenshot({ path: path.join(shotDir, `${name}.png`) });
  };

  // Types in the page's search box and waits until the table has settled on rows that contain the text.
  const search = async (text) => {
    await page.fill(".en-search input", text);
    await until(
      () => page.evaluate((t) => {
        const rows = [...document.querySelectorAll(".en-table tbody tr")];
        return rows.length > 0 && rows.every((r) => r.textContent.includes(t));
      }, text),
      `rows for "${text}"`,
    );
    await sleep(150);
  };

  // Everything that matters about the layout at the current window width.
  const layout = () =>
    page.evaluate(() => {
      const visible = (el) => Boolean(el) && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0;
      const de = document.documentElement;
      const table = document.querySelector(".en-table");
      const head = (name) => [...table.querySelectorAll("th")].find((th) => th.textContent.trim() === name);
      const firstRow = table.querySelector("tbody tr");
      const label = (td) => getComputedStyle(td, "::before").content.replace(/^"|"$/g, "");
      const cells = [...firstRow.querySelectorAll("td")];
      // Cells that must never lose text. Names and the comment may end in an ellipsis by design.
      const clipped = cells.filter((td) => visible(td) && !td.classList.contains("en-nm") && td.scrollWidth > td.clientWidth + 1).map((td) => td.dataset.l || td.className);
      const inputs = [...firstRow.querySelectorAll(".en-cell input, .en-cell select")].map((el) => Math.round(el.getBoundingClientRect().width));
      const scroller = document.querySelector(".en-scroll");
      return {
        pageOverflow: de.scrollWidth - de.clientWidth,
        scrollerOverflow: scroller.scrollWidth - scroller.clientWidth,
        cards: getComputedStyle(table.querySelector("thead")).display === "none",
        bookedColumn: visible(head("Booked")),
        bookedCell: visible(firstRow.querySelector("td.en-c-bk")),
        labels: cells.filter((td) => td.dataset.l && visible(td)).map(label),
        clipped,
        minInput: Math.min(...inputs),
        tableWidth: Math.round(table.getBoundingClientRect().width),
        sidebar: Math.round(document.querySelector(".ash-sidebar, aside")?.getBoundingClientRect().width || 0),
      };
    });

  before(async () => {
    api = await startApiServer();
    doctors = (await call("GET", "/__doctors")).body;
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
      optimizeDeps: { entries: ["tests/e2e/adminEntries/harness/index.html"] },
    });
    await vite.listen();
    harnessUrl = vite.resolvedUrls.local[0].replace(/\/$/, "");
    browser = await chromium.launch({ executablePath: findBrowser(), headless: true, args: ["--disable-lcd-text", "--force-color-profile=srgb"] });
    context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
    page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error" && !/Failed to load resource/.test(message.text())) pageErrors.push(message.text());
    });
  });

  after(async () => {
    await context?.close();
    await browser?.close();
    await vite?.close();
    await api?.close();
    assert.deepEqual(pageErrors, [], "the page logged no errors");
  });

  // ── The page ──────────────────────────────────────────────────────────────

  test("the five tabs with the server's counts, the three boxes, the columns, 25 rows and the totals row", async () => {
    const name = unique("Totals Check");
    await make({ name, date: "2028-03-10", fee: 80, doctor: 0 });
    await open();
    assert.deepEqual((await tabText()).map((t) => t.replace(/\s*\d+$/, "")), ["All", "Unpaid", "Paid", "On hold", "Not payable"]);
    const fromApi = (await call("GET", "/api/admin/entries?limit=1")).body;
    assert.equal(await tabCount("All"), fromApi.counts.all);
    assert.equal(await tabCount("Unpaid"), fromApi.counts.unpaid);
    assert.deepEqual(Object.keys(await summary()), ["To pay doctors", "Paid to doctors", "Fee not entered"]);
    assert.deepEqual(
      await page.$$eval(".en-table thead th", (els) => els.map((e) => e.textContent.trim())),
      ["#", "Booking ID", "Booked", "Consultation", "Patient", "Doctor", "Fee charged", "Doctor fee ($)", "Paid status", "Paid on", "Comment"],
    );
    assert.equal(await page.locator(".en-table tbody tr").count(), 25);
    assert.equal((await page.locator(".en-table tfoot .en-lbl").innerText()).trim(), `Totals for ${fromApi.totals.rows} rows`);
    assert.match(await page.locator(".en-foot").innerText(), /Showing 1–25 of \d+/);
    await shot("page-1500");
  });

  test("a booking row shows its id, the Web / App label, dates, patient and country, doctor and the fee; 'paid $X' only when different", async () => {
    const name = unique("Row Check");
    const id = await make({ name, country: "AE", doctor: 1, date: "2028-03-11", time: "3:30 PM", fee: 99, paid: 45, source: { platform: "ios" } });
    await open("/admin-dashboard/appointment-entries?month=2028-03");
    await search(name);
    const text = (await row(name).innerText()).replace(/\s+/g, " ");
    assert.ok(text.includes(`…${id.slice(-8).toUpperCase()}`), text);
    assert.ok(text.includes("App") && text.includes("11 Mar 2028") && text.includes("3:30 PM") && text.includes("United Arab Emirates") && text.includes("Hidayat Khan"), text);
    assert.ok(text.includes("$99.00") && text.includes("paid $45.00"), text);
    const same = unique("Same Fee");
    await make({ name: same, doctor: 0, date: "2028-03-12", fee: 60 });
    await search(same);
    assert.ok(!(await row(same).innerText()).includes("paid $"));
  });

  // ── Typing ────────────────────────────────────────────────────────────────

  test("typing a doctor fee saves on leaving the box: Saving, Saved, the number is stored, the boxes follow", async () => {
    const name = unique("Fee Save");
    const id = await make({ name, doctor: 0, date: "2028-04-05", fee: 100 });
    await open("/admin-dashboard/appointment-entries?month=2028-04");
    await search(name);
    assert.equal(await feeBox(name).getAttribute("placeholder"), "75% · 75.00");
    const before = await summary();
    await feeBox(name).fill("60");
    await page.locator("body").click({ position: { x: 5, y: 400 } });
    await until(async () => (await row(name).locator(".en-st--saved").count()) === 1, "the Saved badge");
    const doc = await stored("appointment", id);
    assert.equal(doc.entry.doctorFeeCents, 6000);
    assert.equal(doc.entry.history.at(-1).by.role, "superadmin");
    await until(async () => money((await summary())["To pay doctors"]) === money(before["To pay doctors"]) + 60, "To pay doctors to include the new fee");
    assert.equal(await feeBox(name).inputValue(), "60.00");
    assert.equal(await feeBox(name).getAttribute("placeholder"), "0.00");
    // The totals row follows the saved fee.
    await until(async () => money(await page.locator(".en-table tfoot td").nth(2).innerText()) === 60, "the totals row");
  });

  test("a fee with more than 2 decimals is not sent: a red hint shows and nothing is saved", async () => {
    const name = unique("Fee Bad");
    const id = await make({ name, doctor: 0, date: "2028-04-06", fee: 50 });
    await open("/admin-dashboard/appointment-entries?month=2028-04");
    await search(name);
    await feeBox(name).fill("1.234");
    await feeBox(name).press("Enter");
    assert.ok(await row(name).locator(".en-st--err", { hasText: "Use a number" }).count());
    assert.equal((await stored("appointment", id)).entry?.doctorFeeCents ?? null, null);
  });

  test("Escape puts the fee box back to what is saved; leaving it unchanged sends nothing", async () => {
    const name = unique("Fee Esc");
    const id = await make({ name, doctor: 0, date: "2028-04-07", fee: 50, entry: { doctorFeeCents: 2500 } });
    await open("/admin-dashboard/appointment-entries?month=2028-04");
    await search(name);
    assert.equal(await feeBox(name).inputValue(), "25.00");
    await feeBox(name).fill("99");
    await feeBox(name).press("Escape");
    assert.equal(await feeBox(name).inputValue(), "25.00");
    await feeBox(name).focus();
    await feeBox(name).press("Enter");
    await sleep(400);
    assert.equal((await stored("appointment", id)).entry.v ?? 0, 0);
  });

  test("Paid needs a fee and a doctor: refused with the server's reason in a toast, 'Couldn't save', and the box goes back", async () => {
    const noFee = unique("Paid NoFee");
    await make({ name: noFee, doctor: 0, date: "2028-04-08", fee: 50 });
    const noDoctor = unique("Paid NoDoctor");
    await make({ name: noDoctor, doctor: null, date: "2028-04-09", fee: 50, entry: { doctorFeeCents: 3000 } });
    await open("/admin-dashboard/appointment-entries?month=2028-04");
    await search(noFee);
    await statusBox(noFee).selectOption("paid");
    await until(async () => (await toasts()).includes("doctor fee above 0"), "the fee toast");
    await until(async () => (await statusBox(noFee).inputValue()) === "unpaid", "the box to go back");
    assert.ok(await row(noFee).locator(".en-st--err", { hasText: "Couldn’t save" }).count());
    await search(noDoctor);
    await statusBox(noDoctor).selectOption("paid");
    await until(async () => (await toasts()).includes("Assign a doctor"), "the doctor toast");
    assert.equal(await statusBox(noDoctor).inputValue(), "unpaid");
  });

  test("marking Paid fills today's date, moves the row out of Unpaid, and the counts and boxes follow", async () => {
    const name = unique("Paid Flow");
    const id = await make({ name, doctor: 0, date: "2028-05-05", fee: 100, entry: { doctorFeeCents: 7000 } });
    await open("/admin-dashboard/appointment-entries?month=2028-05&tab=unpaid");
    await search(name);
    const before = { unpaid: await tabCount("Unpaid"), paid: await tabCount("Paid"), sum: await summary() };
    await statusBox(name).selectOption("paid");
    await until(async () => (await stored("appointment", id)).entry.paidStatus === "paid", "Paid to be stored");
    const doc = await stored("appointment", id);
    assert.equal(doc.entry.paidOn, istToday());
    // The quiet refresh: the row leaves the Unpaid tab, the counts and the boxes move.
    await until(async () => (await tabCount("Unpaid")) === before.unpaid - 1 && (await tabCount("Paid")) === before.paid + 1, "the counts to move");
    await until(async () => money((await summary())["Paid to doctors"]) === money(before.sum["Paid to doctors"]) + 70, "Paid to doctors to include 70");
    await clickTab("Paid");
    await search(name);
    assert.equal(await paidOnBox(name).inputValue(), istToday());
    assert.equal(await statusBox(name).inputValue(), "paid");
  });

  test("a Paid row needs its date and its fee: clearing either is refused", async () => {
    const name = unique("Paid Keep");
    await make({ name, doctor: 0, date: "2028-05-06", fee: 100, entry: { doctorFeeCents: 4000, paidStatus: "paid", paidOn: "2028-05-01", doctorAtEntry: doctors[0].doctorId } });
    await open("/admin-dashboard/appointment-entries?month=2028-05&tab=paid");
    await search(name);
    await feeBox(name).fill("");
    await feeBox(name).press("Enter");
    await until(async () => (await toasts()).includes("needs a doctor fee"), "the toast");
    assert.equal(await feeBox(name).inputValue(), "40.00");
    await paidOnBox(name).fill("");
    await until(async () => (await toasts()).includes("Paid on date"), "the date toast");
    assert.equal(await paidOnBox(name).inputValue(), "2028-05-01");
  });

  test("a fee typed and then straight to the status: both save, one after the other, with no 'someone else changed this row'", async () => {
    const name = unique("Fast Edit");
    const id = await make({ name, doctor: 0, date: "2028-05-07", fee: 100 });
    await open("/admin-dashboard/appointment-entries?month=2028-05");
    await search(name);
    await feeBox(name).fill("55");
    // Tabbing out of the fee box saves it; the status is changed straight away, before that save has come back.
    await feeBox(name).press("Tab");
    await statusBox(name).selectOption("on_hold");
    await until(async () => {
      const doc = await stored("appointment", id);
      return doc.entry?.doctorFeeCents === 5500 && doc.entry?.paidStatus === "on_hold";
    }, "both edits to be stored");
    const doc = await stored("appointment", id);
    assert.equal(doc.entry.v, 2);
    assert.ok(!(await toasts()).includes("Someone else"));
  });

  test("the comment saves on leaving the box and is trimmed; Enter saves too", async () => {
    const name = unique("Comment");
    const id = await make({ name, doctor: 0, date: "2028-05-08", fee: 100 });
    await open("/admin-dashboard/appointment-entries?month=2028-05");
    await search(name);
    await commentBox(name).fill("  paid by bank  ");
    await commentBox(name).press("Enter");
    await until(async () => (await stored("appointment", id)).entry?.comment === "paid by bank", "the comment");
    await until(async () => (await commentBox(name).inputValue()) === "paid by bank", "the trimmed text");
  });

  test("a row changed by someone else meanwhile: the save is refused, the box shows the current value, a toast says so", async () => {
    const name = unique("Stale");
    const id = await make({ name, doctor: 0, date: "2028-05-09", fee: 100 });
    await open("/admin-dashboard/appointment-entries?month=2028-05");
    await search(name);
    // Someone else saves first (straight to the API, with the version the page also has).
    assert.equal((await call("PATCH", `/api/admin/entries/appointment/${id}`, { field: "doctorFee", value: "10", version: 0 })).status, 200);
    await feeBox(name).fill("99");
    await feeBox(name).press("Enter");
    await until(async () => (await toasts()).includes("Someone else changed this row"), "the stale toast");
    await until(async () => (await feeBox(name).inputValue()) === "10.00", "the current fee");
    assert.equal((await stored("appointment", id)).entry.doctorFeeCents, 1000);
  });

  test("⚠ Doctor changed shows when the booking's doctor is not the one the fee was entered against", async () => {
    const name = unique("Doctor Changed");
    await make({ name, doctor: 1, date: "2028-05-10", fee: 100, entry: { doctorFeeCents: 3000, doctorAtEntry: doctors[0].doctorId } });
    const fine = unique("Doctor Same");
    await make({ name: fine, doctor: 0, date: "2028-05-11", fee: 100, entry: { doctorFeeCents: 3000, doctorAtEntry: doctors[0].doctorId } });
    await open("/admin-dashboard/appointment-entries?month=2028-05");
    await search(name);
    assert.ok((await row(name).innerText()).includes("⚠ Doctor changed"));
    await search(fine);
    assert.ok(!(await row(fine).innerText()).includes("Doctor changed"));
  });

  test("a Not payable row shows no 75% suggestion; an empty fee on an Unpaid row shows it in grey", async () => {
    const np = unique("NotPayable");
    await make({ name: np, doctor: 0, date: "2028-06-01", fee: 100, entry: { paidStatus: "not_payable" } });
    const up = unique("UnpaidGrey");
    await make({ name: up, doctor: 0, date: "2028-06-02", fee: 99, paid: 99 });
    await open("/admin-dashboard/appointment-entries?month=2028-06");
    await search(np);
    assert.equal(await feeBox(np).getAttribute("placeholder"), "0.00");
    await search(up);
    assert.equal(await feeBox(up).getAttribute("placeholder"), "75% · 74.25");
    assert.equal(await feeBox(up).inputValue(), "");
  });

  // ── Filters ───────────────────────────────────────────────────────────────

  test("tabs, Doctor, Month and search narrow the list, the counts and the boxes; the view is kept in the page address", async () => {
    const a = unique("Filter A");
    const b = unique("Filter B");
    await make({ name: a, doctor: 2, date: "2028-07-03", fee: 60, entry: { doctorFeeCents: 2000 } });
    await make({ name: b, doctor: 2, date: "2028-08-03", fee: 60, entry: { paidStatus: "on_hold" } });
    await open("/admin-dashboard/appointment-entries");
    await page.selectOption('select[aria-label="Doctor"]', { label: "Farah Siddiqui" });
    await page.selectOption('select[aria-label="Month"]', { label: "July 2028" });
    // Two changes in quick succession keep each other: the doctor is still chosen after the month is.
    await until(async () => (await page.locator('select[aria-label="Doctor"] option:checked').innerText()) === "Farah Siddiqui", "the doctor to stay chosen");
    await until(async () => (await page.locator(".en-table tbody tr").count()) === 1, "one row");
    assert.ok((await row(a).innerText()).includes(a));
    assert.deepEqual(await summary(), { "To pay doctors": "$20.00", "Paid to doctors": "$0.00", "Fee not entered": "0 rows" });
    await page.selectOption('select[aria-label="Month"]', { label: "All months" });
    await clickTab("On hold");
    await until(async () => (await page.locator(".en-table tbody tr").count()) === 1 && (await row(b).count()) === 1, "the On hold row");
    await clickTab("All");
    await until(async () => (await row(a).count()) === 1 && (await row(b).count()) === 1, "both rows");
    await search(a);
    assert.equal(await page.locator(".en-table tbody tr").count(), 1);
  });

  test("the page opens on the view in its address (tab, doctor, month)", async () => {
    const name = unique("Deep Link");
    await make({ name, doctor: 1, date: "2028-09-03", fee: 60, entry: { paidStatus: "not_payable" } });
    const docId = doctors[1].enrollmentId;
    await open(`/admin-dashboard/appointment-entries?tab=not_payable&doctor=${docId}&month=2028-09`);
    await until(async () => (await row(name).count()) === 1, "the row");
    assert.equal(await page.locator('.en-tab[aria-selected="true"]').innerText().then((t) => t.replace(/\s*\d+$/, "")), "Not payable");
    assert.equal(await page.locator('select[aria-label="Doctor"] option:checked').innerText(), "Hidayat Khan");
    assert.equal(await page.locator('select[aria-label="Month"] option:checked').innerText(), "September 2028");
  });

  test("25 rows a page, a pager that moves, and an empty view says so", async () => {
    await open();
    const first = await page.locator(".en-table tbody tr td.en-num").first().innerText();
    assert.equal(first, "1");
    await page.click('.en-pager button:has-text("Next")');
    await until(async () => (await page.locator(".en-table tbody tr td.en-num").first().innerText()) === "26", "page 2 to start at 26");
    await page.fill(".en-search input", "zzzz-nobody-has-this-name");
    await until(async () => (await page.locator(".en-state h3").count()) === 1, "the empty message");
    assert.match(await page.locator(".en-state").innerText(), /No entries match this view/);
  });

  // ── Manual entries (the big popup) ────────────────────────────────────────

  const popup = () => page.locator(".en-modal--wide");
  // A form field by its label text (a label that wraps a drop-down also carries the option names, so match the label's own text).
  const field = (label) => popup().locator(`label:has(> span:text-is("${label}"))`).locator("input, select, textarea");
  const doctorsFee = () => field("Doctor’s fee ($)");
  const pick = (label, option) => field(label).selectOption({ label: option });
  const openAdd = async () => {
    await page.click('button:has-text("Add manual entry")');
    await popup().waitFor();
  };
  const press = (name) => popup().locator(`button:has-text("${name}")`).click();
  const formError = async () => (await popup().locator(".en-form-error").innerText().catch(() => "")).trim();
  // The smallest valid form.
  const fillMinimum = async ({ name, provider = "Dr Rao Clinic", date = "2027-05-04", fee = "100" } = {}) => {
    await field("Date").fill(date);
    await field("Service provider").fill(provider);
    await field("Patient name").fill(name);
    await field("Consultation fee ($)").fill(fee);
  };
  // Adds a row through the API (quick), for the tests that are not about the form itself.
  const addViaApi = async (extra = {}) => {
    const r = await call("POST", "/api/admin/entries/manual", { date: "2027-06-04", serviceProvider: "Dr Rao Clinic", patientName: unique("Api Manual"), consultationFee: "50", ...extra });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body.item;
  };

  test("Add manual entry opens a large popup with the seven sections in order, and the starting values", async () => {
    await open("/admin-dashboard/appointment-entries?month=2027-05");
    await openAdd();
    assert.deepEqual(await popup().locator(".en-section h4").allTextContents(), [
      "1Case", "2Service provider", "3Patient", "4Fees", "5Medical report & invoice", "6Payments", "7Feedback",
    ]);
    await sleep(500);
    const box = await popup().boundingBox();
    assert.ok(box.width > 900 && box.width <= 1021, `a large popup: ${box.width}`);
    const today = await field("Date").inputValue();
    assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
    assert.deepEqual(
      [await field("Status").inputValue(), await field("MR status from provider").inputValue(), await field("MR sent to the company").inputValue(), await field("Invoice sent").inputValue(),
        await field("Payment received").inputValue(), await field("Payment to provider").inputValue(), await field("Type of service").inputValue()],
      ["open", "pending", "not_sent", "not_sent", "not_received", "unpaid", "teleconsultation"],
    );
    assert.deepEqual(await field("Type of service").locator("option").allInnerTexts(), ["House call", "Teleconsultation", "Others"]);
    assert.deepEqual(await field("Status").locator("option").allInnerTexts(), ["Open", "In progress", "Completed", "Cancelled"]);
    assert.deepEqual(await field("Payment received").locator("option").allInnerTexts(), ["Not received", "Partly received", "Received"]);
    assert.deepEqual(await field("Payment to provider").locator("option").allInnerTexts(), ["Unpaid", "On hold", "Paid", "Not payable"]);
    assert.equal(await field("Other service").count(), 0, "Other service only shows for Others");
    assert.equal(await field("Payment received date").isDisabled(), true);
    assert.equal(await field("Paid date to the provider").isDisabled(), true);
    assert.match(await page.getByTestId("calculation").innerText(), /calculation \(our margin\)\s+—/i);
    assert.equal(await popup().locator("textarea").count(), 2);
    await shot("popup-add");
  });

  test("Calculation (our margin) is live: consultation fee minus the doctor's fee with its percentage, red when negative, and never sent", async () => {
    await open("/admin-dashboard/appointment-entries?month=2027-05");
    await openAdd();
    const calc = page.getByTestId("calculation");
    await field("Consultation fee ($)").fill("100");
    await doctorsFee().fill("70");
    await until(async () => /\$30\.00/.test(await calc.innerText()) && /30\.0%/.test(await calc.innerText()), "the margin");
    assert.equal(await calc.evaluate((el) => getComputedStyle(el.querySelector("b")).color), "rgb(15, 118, 110)");
    await field("Consultation fee ($)").fill("50");
    await doctorsFee().fill("65");
    await until(async () => /-\$15\.00/.test(await calc.innerText()) && /-30\.0%/.test(await calc.innerText()), "the negative margin");
    assert.equal(await calc.evaluate((el) => getComputedStyle(el.querySelector("b")).color), "rgb(185, 28, 28)", "red when negative");
    await doctorsFee().fill("");
    await until(async () => (await calc.locator("b").innerText()) === "—", "empty without a doctor's fee");
    assert.equal(await calc.locator("input").count(), 0, "read-only");
  });

  test("Type of service Others shows a required 'Other service' box; the other types hide it", async () => {
    await open("/admin-dashboard/appointment-entries?month=2027-05");
    await openAdd();
    const name = unique("Others Case");
    await fillMinimum({ name });
    await pick("Type of service", "Others");
    await field("Other service").waitFor();
    await press("Save entry");
    assert.match(await formError(), /Describe the other service/);
    await field("Other service").fill("Physio at home");
    await pick("Type of service", "House call");
    assert.equal(await field("Other service").count(), 0);
    await pick("Type of service", "Others");
    assert.equal(await field("Other service").inputValue(), "Physio at home", "what was typed is still there");
    await press("Save entry");
    await until(async () => (await row(name).count()) === 1, "the new row");
    const stored = (await call("GET", "/__manual")).body.find((m) => m.patientName === name);
    assert.deepEqual([stored.serviceType, stored.otherService], ["others", "Physio at home"]);
  });

  test("the two payment dates are usable only when they apply, and default to today", async () => {
    await open("/admin-dashboard/appointment-entries?month=2027-05");
    await openAdd();
    const today = await field("Date").inputValue();
    await pick("Payment received", "Partly received");
    assert.equal(await field("Payment received date").isDisabled(), false);
    assert.equal(await field("Payment received date").inputValue(), today);
    await pick("Payment received", "Not received");
    assert.equal(await field("Payment received date").isDisabled(), true);
    assert.equal(await field("Payment received date").inputValue(), "");
    await pick("Payment received", "Received");
    assert.equal(await field("Payment received date").inputValue(), today);
    await pick("Payment to provider", "Paid");
    assert.equal(await field("Paid date to the provider").isDisabled(), false);
    assert.equal(await field("Paid date to the provider").inputValue(), today);
    await pick("Payment to provider", "On hold");
    assert.equal(await field("Paid date to the provider").isDisabled(), true);
    await pick("Payment to provider", "Unpaid");
    assert.equal(await field("Paid date to the provider").isDisabled(), true);
  });

  test("the form says what is wrong: provider, patient, phone numbers, fees, and Paid needs a doctor's fee above 0", async () => {
    await open("/admin-dashboard/appointment-entries?month=2027-05");
    await openAdd();
    await press("Save entry");
    assert.match(await formError(), /service provider/i);
    await field("Service provider").fill("Dr Rao Clinic");
    await press("Save entry");
    assert.match(await formError(), /patient/i);
    await field("Patient name").fill("Validation Case");
    await press("Save entry");
    assert.match(await formError(), /consultation fee/i);
    await field("Consultation fee ($)").fill("100");
    await field("Contact number").fill("call me");
    await press("Save entry");
    assert.match(await formError(), /contact number/i);
    await field("Contact number").fill("+971 50 123-4567");
    await field("Service provider number").fill("555-0100 ext 5");
    await press("Save entry");
    assert.match(await formError(), /service provider number/i);
    await field("Service provider number").fill("(04) 555 0100");
    await doctorsFee().fill("1.234");
    await press("Save entry");
    assert.match(await formError(), /doctor's fee must be a number/i);
    await doctorsFee().fill("");
    await pick("Payment to provider", "Paid");
    await press("Save entry");
    assert.match(await formError(), /doctor's fee above 0/i);
    assert.equal((await call("GET", "/__manual")).body.some((m) => m.patientName === "Validation Case"), false, "nothing was saved");
  });

  test("a fee of 0 is fine; the row shows no 75% suggestion", async () => {
    await open("/admin-dashboard/appointment-entries?month=2027-05");
    await openAdd();
    const name = unique("Free Visit");
    await fillMinimum({ name, fee: "0" });
    await press("Save entry");
    await until(async () => (await row(name).count()) === 1, "the new row");
    assert.ok((await row(name).innerText()).includes("$0.00"));
    assert.equal(await feeBox(name).getAttribute("placeholder"), "0.00");
  });

  test("fill the whole form, save, see the row, edit it, mark it Paid, see the locks, and export it", async () => {
    await open("/admin-dashboard/appointment-entries?month=2027-07");
    await openAdd();
    const name = unique("Full Form");
    await field("Date").fill("2027-07-08");
    await field("Company").fill("Acme Assist");
    await field("Case number").fill("AC-1042");
    await pick("Type of service", "Teleconsultation");
    await pick("Status", "In progress");
    await field("Service provider").fill("Sunrise Home Care");
    await field("Service provider number").fill("+971 4 555 0100");
    await field("Patient name").fill(name);
    await field("Patient country").fill("India");
    await field("Contact number").fill("(022) 5550 1234");
    await field("Consultation fee ($)").fill("100");
    await doctorsFee().fill("65");
    await pick("MR status from provider", "Received");
    await pick("MR sent to the company", "Sent");
    await pick("Invoice sent", "Sent");
    await pick("Payment received", "Partly received");
    await field("Payment received date").fill("2026-10-20");
    await field("Feedback message sent").fill("Please rate our service");
    await field("Feedback received").fill("Great, thank you");
    await field("Comment").fill("Booked by phone");
    await press("Save entry");
    await until(async () => (await row(name).count()) === 1, "the new row");

    // The row in the table: Manual label, M- id, Company · Case number under the patient, the provider in the Doctor column.
    const text = (await row(name).innerText()).replace(/\s+/g, " ");
    assert.match(text, /M-[0-9A-F]{4}/);
    assert.ok(text.includes("Manual") && text.includes("Acme Assist · AC-1042") && text.includes("Sunrise Home Care") && text.includes("India") && text.includes("8 Jul 2027") && text.includes("$100.00"), text);
    assert.equal(await row(name).locator(".en-caseline").innerText(), "Acme Assist · AC-1042");
    assert.ok(await row(name).locator(".en-src--manual").count());
    assert.equal(await feeBox(name).inputValue(), "65.00");
    assert.equal(await commentBox(name).inputValue(), "Booked by phone");
    let manual = (await call("GET", "/__manual")).body.find((m) => m.patientName === name);
    assert.deepEqual(
      [manual.company, manual.caseNumber, manual.serviceType, manual.caseStatus, manual.doctorName, manual.providerNumber, manual.contactNumber, manual.country, manual.feeChargedCents, manual.entry.doctorFeeCents],
      ["Acme Assist", "AC-1042", "teleconsultation", "in_progress", "Sunrise Home Care", "+971 4 555 0100", "(022) 5550 1234", "IN", 10000, 6500],
    );
    assert.deepEqual(
      [manual.mrStatus, manual.mrSentToCompany, manual.invoiceSent, manual.paymentReceived, manual.paymentReceivedDate, manual.feedbackSent, manual.feedbackReceived, manual.entry.comment],
      ["received", "sent", "sent", "partly_received", "2026-10-20", "Please rate our service", "Great, thank you", "Booked by phone"],
    );
    assert.equal(manual.log[0].action, "created");

    // Edit: the popup opens with the saved values.
    await row(name).locator('button:has-text("Edit")').click();
    await popup().waitFor();
    assert.match(await popup().locator(".hc-modal__title").innerText(), /^Edit manual entry · M-/);
    assert.deepEqual(
      [await field("Company").inputValue(), await field("Case number").inputValue(), await field("Type of service").inputValue(), await field("Status").inputValue(),
        await field("Service provider").inputValue(), await field("Patient name").inputValue(), await field("Patient country").inputValue(), await field("Consultation fee ($)").inputValue(),
        await doctorsFee().inputValue(), await field("Payment received").inputValue(), await field("Payment received date").inputValue(),
        await field("Feedback message sent").inputValue(), await field("Comment").inputValue()],
      ["Acme Assist", "AC-1042", "teleconsultation", "in_progress", "Sunrise Home Care", name, "India", "100.00", "65.00", "partly_received", "2026-10-20", "Please rate our service", "Booked by phone"],
    );
    assert.equal(await popup().locator(".en-lock-note").count(), 0);
    await field("Company").fill("Beta Assist");
    await pick("Status", "Completed");
    await doctorsFee().fill("70");
    await pick("Payment received", "Received");
    await field("Feedback received").fill("Great, thank you very much");
    await press("Save changes");
    await until(async () => (await row(name).locator(".en-caseline").innerText()) === "Beta Assist · AC-1042", "the edited row");
    assert.equal(await feeBox(name).inputValue(), "70.00");
    manual = (await call("GET", "/__manual")).body.find((m) => m.patientName === name);
    assert.equal(manual.log.slice(1).every((l) => l.action === "edited" && l.by.name === "Test Admin"), true);
    assert.deepEqual(
      ["company", "caseStatus", "doctorFee", "paymentReceived", "feedbackReceived"].map((f) => manual.log.some((l) => l.field === f)),
      [true, true, true, true, true],
    );
    assert.deepEqual([manual.company, manual.caseStatus, manual.paymentReceived, manual.entry.doctorFeeCents], ["Beta Assist", "completed", "received", 7000]);

    // Mark it Paid to the provider from the popup.
    await row(name).locator('button:has-text("Edit")').click();
    await popup().waitFor();
    await pick("Payment to provider", "Paid");
    assert.equal(await field("Paid date to the provider").isDisabled(), false);
    await field("Paid date to the provider").fill("2026-10-21");
    await press("Save changes");
    await until(async () => (await row(name).locator("select[aria-label='Paid status']").inputValue()) === "paid", "Paid");
    assert.equal(await paidOnBox(name).inputValue(), "2026-10-21");
    // Locked in the table: the doctor's fee box and Delete.
    assert.equal(await feeBox(name).isDisabled(), true);
    assert.equal(await row(name).locator('button:has-text("Delete")').isDisabled(), true);

    // Locked in the popup: case, provider, patient and fees; the rest can still change.
    await row(name).locator('button:has-text("Edit")').click();
    await popup().waitFor();
    assert.match(await popup().locator(".en-lock-note").innerText(), /Paid.*locked/);
    for (const label of ["Date", "Company", "Case number", "Type of service", "Status", "Service provider", "Service provider number", "Patient name", "Patient country", "Contact number", "Consultation fee ($)"]) {
      assert.equal(await field(label).isDisabled(), true, `${label} is locked`);
    }
    assert.equal(await doctorsFee().isDisabled(), true, "the doctor's fee is locked");
    for (const label of ["MR status from provider", "MR sent to the company", "Invoice sent", "Payment received", "Payment received date", "Payment to provider", "Paid date to the provider", "Feedback message sent", "Feedback received", "Comment"]) {
      assert.equal(await field(label).isDisabled(), false, `${label} stays editable`);
    }
    await shot("popup-locked");
    await pick("MR status from provider", "Pending");
    await field("Feedback message sent").fill("Updated message while Paid");
    await press("Save changes");
    await until(async () => (await (await call("GET", "/__manual")).body.find((m) => m.patientName === name)).feedbackSent === "Updated message while Paid", "the feedback to save");
    manual = (await call("GET", "/__manual")).body.find((m) => m.patientName === name);
    assert.deepEqual([manual.mrStatus, manual.company, manual.entry.doctorFeeCents, manual.entry.paidStatus], ["pending", "Beta Assist", 7000, "paid"]);
    // The server refuses a locked change even if a stale page sends it.
    const refused = await call("PATCH", `/api/admin/entries/manual/${manual._id}/details`, { version: manual.entry.v, patientName: "Sneaky" });
    assert.deepEqual([refused.status, refused.body.code], [409, "locked_paid"]);

    // Export it.
    const [download] = await Promise.all([page.waitForEvent("download"), page.click('button:has-text("Export CSV")')]);
    const csv = fs.readFileSync(await download.path(), "utf8").replace(/^﻿/, "");
    const lines = csv.trim().split("\r\n");
    const head = lines[0].split(",");
    for (const column of ["Company", "Case number", "Type of service", "Other service", "Case status", "Service provider number", "Contact number", "Calculation (our margin)", "Calculation (% of consultation fee)", "MR status", "MR sent to company", "Invoice sent", "Payment received", "Payment received date", "Feedback message sent", "Feedback received"]) {
      assert.ok(head.includes(column), `the CSV has a ${column} column`);
    }
    const line = lines.find((l) => l.includes(name));
    assert.ok(line.includes("Beta Assist,AC-1042,Teleconsultation,,Completed,'+971 4 555 0100,(022) 5550 1234,30.00,30.0,Pending,Sent,Sent,Received,"), line);
    assert.ok(line.includes("Updated message while Paid") && line.includes("Great, thank you very much") && line.includes("Sunrise Home Care") && line.includes(",70.00,Paid,2026-10-21,"), line);
  });

  test("the popup on a phone is full screen with the sections stacked in one column, and Save stays in reach", async () => {
    await open("/admin-dashboard/appointment-entries?month=2027-05", { width: 390, height: 844 });
    await openAdd();
    await sleep(500);
    const box = await popup().boundingBox();
    assert.deepEqual([Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)], [0, 0, 390, 844], "full screen");
    const layout = await popup().evaluate((el) => {
      const lefts = (selector) => [...el.querySelectorAll(selector)].map((n) => Math.round(n.getBoundingClientRect().left));
      const textareas = [...el.querySelectorAll("textarea")].map((n) => n.getBoundingClientRect());
      const foot = el.querySelector(".en-popup-foot").getBoundingClientRect();
      return {
        overflow: el.scrollWidth - el.clientWidth,
        sectionsOverflow: el.querySelector(".en-sections").scrollWidth - el.querySelector(".en-sections").clientWidth,
        fieldLefts: [...new Set(lefts(".en-section .en-grid > label"))],
        payLefts: [...new Set(lefts(".en-paybox"))],
        feedbackStacked: textareas[1].top > textareas[0].bottom - 1 && Math.abs(textareas[0].left - textareas[1].left) < 2,
        footBottom: Math.round(foot.bottom),
        footVisible: foot.top >= 0 && foot.bottom <= window.innerHeight + 1,
      };
    });
    assert.equal(layout.overflow <= 0 && layout.sectionsOverflow <= 0, true, JSON.stringify(layout));
    assert.equal(layout.fieldLefts.length, 1, `one column: ${JSON.stringify(layout.fieldLefts)}`);
    assert.equal(layout.payLefts.length, 1, "the two payment boxes stack");
    assert.equal(layout.feedbackStacked, true, "the two feedback boxes stack");
    assert.equal(layout.footVisible, true, "the buttons stay on screen");
    await shot("popup-390");
    // The whole form can be used on the phone.
    const name = unique("Phone Case");
    await fillMinimum({ name });
    await press("Save entry");
    await until(async () => (await row(name).count()) === 1, "the new row");
  });

  test("the popup on a big window: three columns of fields, the two payment boxes side by side, the two feedback boxes side by side", async () => {
    await open("/admin-dashboard/appointment-entries?month=2027-05", { width: 1500, height: 1000 });
    await openAdd();
    const layout = await popup().evaluate((el) => {
      const rect = (selector) => el.querySelector(selector).getBoundingClientRect();
      const boxes = [...el.querySelectorAll(".en-paybox")].map((n) => n.getBoundingClientRect());
      const tas = [...el.querySelectorAll("textarea")].map((n) => n.getBoundingClientRect());
      const caseFields = [...el.querySelectorAll(".en-section:first-of-type .en-grid > label")].slice(0, 3).map((n) => Math.round(n.getBoundingClientRect().top));
      return {
        payside: boxes[1].left > boxes[0].right - 1 && Math.abs(boxes[0].top - boxes[1].top) < 2,
        feedbackSide: tas[1].left > tas[0].right - 1 && Math.abs(tas[0].top - tas[1].top) < 2,
        threeAcross: new Set(caseFields).size === 1,
        height: Math.round(rect(".en-bigform").height),
      };
    });
    assert.deepEqual([layout.payside, layout.feedbackSide, layout.threeAcross], [true, true, true], JSON.stringify(layout));
    assert.ok((await popup().boundingBox()).height <= 1000 - 16, "the popup fits the window (its body scrolls)");
    await shot("popup-1500");
  });

  test("the Doctor filter finds a manual row by its service provider's exact name", async () => {
    const exact = await addViaApi({ date: "2027-01-09", serviceProvider: "Martin Perlin", patientName: unique("Exact Name") });
    const longer = await addViaApi({ date: "2027-01-10", serviceProvider: "Martin Perlin Clinic", patientName: unique("Longer Name") });
    await open("/admin-dashboard/appointment-entries?month=2027-01");
    await until(async () => (await row(longer.patient.name).count()) === 1 && (await row(exact.patient.name).count()) === 1, "both rows before the filter");
    await page.selectOption('select[aria-label="Doctor"]', { label: "Martin Perlin" });
    await until(async () => (await row(longer.patient.name).count()) === 0, "the longer name to drop out");
    assert.equal(await row(exact.patient.name).count(), 1);
    assert.ok((await row("Background").count()) >= 1, "the doctor's bookings are there too");
    // Service providers typed on manual rows are in the dropdown too: once each, sorted with the doctors, and picking one filters by it.
    const one = await addViaApi({ date: "2027-01-11", serviceProvider: "Zeta Home Care", patientName: unique("Zeta One") });
    await addViaApi({ date: "2027-01-12", serviceProvider: "Zeta Home Care", patientName: unique("Zeta Two") });
    await open("/admin-dashboard/appointment-entries?month=2027-01");
    const options = await page.$$eval('select[aria-label="Doctor"] option', (els) => els.map((e) => e.textContent.trim()).slice(1));
    assert.equal(options.filter((o) => o === "Zeta Home Care").length, 1);
    assert.deepEqual(options, [...options].sort((a, b) => a.localeCompare(b)));
    await page.selectOption('select[aria-label="Doctor"]', { label: "Zeta Home Care" });
    await until(async () => (await page.locator(".en-table tbody tr").count()) === 2 && (await row(one.patient.name).count()) === 1, "the two Zeta rows");
  });

  test("Delete a manual row: a confirmation first (Keep it changes nothing), then it is gone; a Paid row can't be deleted; booking rows have no Delete", async () => {
    const item = await addViaApi({ date: "2027-10-02" });
    const name = item.patient.name;
    await open("/admin-dashboard/appointment-entries?month=2027-10");
    await row(name).locator('button:has-text("Delete")').click();
    await page.waitForSelector('[role="alertdialog"]');
    assert.match(await page.locator('[role="alertdialog"]').innerText(), /Delete this manual entry\?[\s\S]*Only manual entries can be deleted/);
    await page.click('[role="alertdialog"] button:has-text("Keep it")');
    await page.waitForSelector('[role="alertdialog"]', { state: "detached" });
    assert.equal(await row(name).count(), 1);

    await row(name).locator('button:has-text("Delete")').click();
    await page.click('[role="alertdialog"] button:has-text("Delete entry")');
    await until(async () => (await row(name).count()) === 0, "the row to disappear");
    assert.ok((await toasts()).includes("Manual entry deleted"));
    const gone = (await call("GET", "/__manual")).body.find((m) => m.patientName === name);
    assert.ok(gone.deletedAt && gone.deletedBy.role === "superadmin" && gone.log.at(-1).action === "deleted", "a soft delete: the document and its log stay");

    const booking = unique("Booking Nodelete");
    await make({ name: booking, doctor: 0, date: "2027-10-03", fee: 40 });
    await search(booking);
    assert.equal(await row(booking).locator("button").count(), 0, "a booking row has no Edit or Delete");
  });

  // ── CSV ───────────────────────────────────────────────────────────────────

  test("Export CSV downloads a real file with the filtered rows, the source columns and the manual rows", async () => {
    const name = unique("Csv Booking");
    const id = await make({ name, doctor: 0, date: "2027-08-05", fee: 70, entry: { doctorFeeCents: 4000 }, source: { platform: "android", appVersion: "1.0.0+16", sourceType: "home" } });
    const manualItem = await addViaApi({ date: "2027-08-06", patientName: unique("Csv Manual"), company: "Acme", consultationFee: "15" });
    await open("/admin-dashboard/appointment-entries?month=2027-08");
    const [download] = await Promise.all([page.waitForEvent("download"), page.click('button:has-text("Export CSV")')]);
    assert.equal(download.suggestedFilename(), `entries-${istToday()}.csv`);
    const text = fs.readFileSync(await download.path(), "utf8").replace(/^﻿/, "");
    const lines = text.trim().split("\r\n");
    assert.match(lines[0], /^Booking ID,Source,Platform,Source page type,Source page name,Clicked on,Booked \(UTC\),Consultation date,/);
    assert.equal(lines.length, 3, "header + the two rows of August 2027");
    const booking = lines.find((l) => l.startsWith(id));
    assert.ok(booking.includes(",App,Android (v1.0.0+16),Home,") && booking.includes(name) && booking.includes(",40.00,"), booking);
    const manual = lines.find((l) => l.includes(manualItem.patient.name));
    assert.ok(manual.startsWith("M-") && manual.includes(",Manual,") && manual.includes(",Acme,"), manual);
    await until(async () => (await toasts()).includes("Exported 2 rows"), "the export toast");
  });

  // ── Access ────────────────────────────────────────────────────────────────

  test("the menu has 'Appointment entries' right after Appointments for admin and super admin, and not for the payment admin", async () => {
    const items = () => page.$$eval(".ash-nav-item, .ash-nav a", (els) => els.map((e) => e.textContent.replace(/\s+/g, " ").trim()).filter(Boolean));
    for (const role of ["admin", "superadmin"]) {
      await open("/admin-dashboard/appointment-entries", { role });
      const list = await items();
      const at = list.findIndex((t) => t.startsWith("Appointments"));
      assert.ok(at >= 0 && list[at + 1]?.startsWith("Appointment entries"), `${role}: ${list.join(" | ")}`);
      assert.equal(await page.locator(".ash-nav-item.active, .ash-nav-item[aria-current='page']").filter({ hasText: "Appointment entries" }).count(), 1, `${role}: the entry is highlighted on its page`);
      assert.equal(await page.locator(".ash-topbar-title").innerText(), "Appointment entries");
    }
    await open("/admin-dashboard/manual-invoices", { role: "paymentadmin" }).catch(() => {});
    await page.waitForSelector(".ash-nav-item, .ash-nav a");
    assert.ok(!(await items()).some((t) => t.includes("Appointment entries")));
  });

  test("every entries route is 403 for the payment admin and other roles, 200 for admin and super admin", async () => {
    const id = await make({ name: unique("Access"), doctor: 0, date: "2029-02-01", fee: 10 });
    const manual = (await call("POST", "/api/admin/entries/manual", { patientName: "Access Manual", date: "2027-02-02", serviceProvider: "Dr X", consultationFee: "5" })).body.item;
    const as = (role) => ({ "x-test-role": role });
    const calls = [
      ["GET", "/api/admin/entries"],
      ["GET", "/api/admin/entries/export.csv"],
      ["PATCH", `/api/admin/entries/appointment/${id}`, { field: "comment", value: "x", version: 0 }],
      ["PATCH", `/api/admin/entries/manual/${manual.id}/details`, { version: 0, patientName: "Y" }],
      ["POST", "/api/admin/entries/manual", { patientName: "Z", date: "2027-02-03", serviceProvider: "Dr X", consultationFee: "5" }],
      ["DELETE", `/api/admin/entries/manual/${manual.id}`],
    ];
    for (const role of ["paymentadmin", "user", "doctor", "employeeadmin", "partner"]) {
      for (const [method, route, body] of calls) assert.equal((await call(method, route, body, as(role))).status, 403, `${role} ${method} ${route}`);
    }
    assert.equal((await stored("appointment", id)).entry?.comment ?? "", "");
    assert.equal((await stored("manual", manual.id)).deletedAt, null);
    assert.equal((await call("GET", "/api/admin/entries", undefined, as("admin"))).status, 200);
    assert.equal((await call("GET", "/api/admin/entries", undefined, as("superadmin"))).status, 200);
    assert.equal((await call("PATCH", `/api/admin/entries/appointment/${id}`, { field: "comment", value: "by admin", version: 0 }, as("admin"))).status, 200);
  });

  // ── Layout ────────────────────────────────────────────────────────────────

  test("layout at 1920, 1440, 1366, 1280 and 390: no sideways scroll, Booked only above 1440px, one card per booking below 1360px, nothing clipped", async () => {
    const name = unique("Layout Check");
    await make({ name, country: "AE", doctor: 2, date: "2029-03-04", time: "11:30 AM", fee: 99, paid: 45, entry: { doctorFeeCents: 1234, comment: "A fairly long comment that must not widen the page" } });
    for (const [width, expected] of [
      [1920, { cards: false, booked: true }],
      [1440, { cards: false, booked: false }],
      [1366, { cards: false, booked: false }],
      [1280, { cards: true }],
      [390, { cards: true }],
    ]) {
      await open("/admin-dashboard/appointment-entries?month=2029-03", { width, height: width < 500 ? 844 : 1000 });
      await search(name);
      const m = await layout();
      const at = `${width}px ${JSON.stringify(m)}`;
      assert.equal(m.pageOverflow <= 0, true, `no sideways scroll on the page: ${at}`);
      assert.equal(m.scrollerOverflow <= 0, true, `no sideways scroll in the table: ${at}`);
      assert.equal(m.cards, expected.cards, `cards or table: ${at}`);
      assert.deepEqual(m.clipped, [], `nothing clipped: ${at}`);
      if (!expected.cards) {
        assert.equal(m.bookedColumn, expected.booked, `Booked column: ${at}`);
        assert.ok(m.minInput >= 60, `the editable boxes keep a usable width: ${at}`);
      } else {
        assert.ok(m.labels.includes("Patient") && m.labels.includes("Doctor fee ($)") && m.labels.includes("Paid status") && m.labels.includes("Paid on") && m.labels.includes("Comment"), `labelled fields: ${at}`);
        assert.ok(m.labels.includes("Booked"), `Booked is a labelled field on a card: ${at}`);
        assert.ok(m.minInput >= 100, `the editable boxes stay full size on a card: ${at}`);
      }
      await shot(`layout-${width}`);
    }
  });

  test("on a card, every editable box works the same: type a fee, change the status", async () => {
    const name = unique("Card Edit");
    const id = await make({ name, doctor: 0, date: "2029-03-05", fee: 100 });
    await open("/admin-dashboard/appointment-entries?month=2029-03", { width: 390, height: 844 });
    await search(name);
    await feeBox(name).fill("45");
    await feeBox(name).press("Enter");
    await until(async () => (await stored("appointment", id)).entry?.doctorFeeCents === 4500, "the fee");
    await statusBox(name).selectOption("on_hold");
    await until(async () => (await stored("appointment", id)).entry?.paidStatus === "on_hold", "the status");
  });
});
