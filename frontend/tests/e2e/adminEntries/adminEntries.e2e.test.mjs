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

  const open = async (start = "/admin-dashboard/appointment-entries", { role = "superadmin", width = 1500, height = 1000 } = {}) => {
    await page.setViewportSize({ width, height });
    await page.goto(`${harnessUrl}/tests/e2e/adminEntries/harness/index.html?role=${role}&start=${encodeURIComponent(start)}`);
    await page.waitForSelector(".en-table tbody tr, .xs tbody tr, .en-state");
  };
  const row = (text) => page.locator(".en-table tbody tr, .xs tbody tr", { hasText: text }).first();
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
        const rows = [...document.querySelectorAll(".en-table tbody tr, .xs tbody tr")];
        return rows.length > 0 && rows.every((r) => r.textContent.includes(t));
      }, text),
      `rows for "${text}"`,
    );
    await sleep(150);
  };

  // Everything that matters about the layout at the current window width.
  const layout = (rowSelector = "tbody tr") =>
    page.evaluate((rowSelector) => {
      const visible = (el) => Boolean(el) && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0;
      const de = document.documentElement;
      const table = document.querySelector(".en-table");
      const head = (name) => [...table.querySelectorAll("th")].find((th) => th.textContent.trim() === name);
      const firstRow = table.querySelector(rowSelector);
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
        headClipped: [...table.querySelectorAll("th")].filter((th) => visible(th) && th.scrollWidth > th.clientWidth + 1).map((th) => th.textContent.trim()),
        headFee: head("Doctor fee")?.textContent.trim() || null,
        clipped,
        minInput: Math.min(...inputs),
        tableWidth: Math.round(table.getBoundingClientRect().width),
        sidebar: Math.round(document.querySelector(".ash-sidebar, aside")?.getBoundingClientRect().width || 0),
        actions: (() => {
          const cell = firstRow.querySelector("td.en-act");
          const buttons = [...firstRow.querySelectorAll(".en-abtn")];
          if (!cell || !buttons.length) return null;
          const rects = buttons.map((b) => b.getBoundingClientRect());
          const cellRect = cell.getBoundingClientRect();
          return {
            visible: visible(cell),
            oneLine: new Set(rects.map((r) => Math.round(r.top))).size === 1,
            inside: rects.every((r) => r.left >= cellRect.left - 1 && r.right <= cellRect.right + 1),
            last: cell === cells.filter((td) => visible(td)).at(-1),
            bottom: Math.round(cellRect.bottom),
            rowBottom: Math.round(firstRow.getBoundingClientRect().bottom),
            others: Math.max(...cells.filter((td) => td !== cell && visible(td)).map((td) => Math.round(td.getBoundingClientRect().bottom))),
          };
        })(),
      };
    }, rowSelector);

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
    context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
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

  test("the five tabs with the server's counts, the three boxes (super admin), the columns, 25 rows and the totals row", async () => {
    const name = unique("Totals Check");
    await make({ name, date: "2028-03-10", fee: 80, doctor: 0 });
    await open();
    await until(async () => !(await tabText()).some((t) => t.includes("–")), "the tab counts");
    assert.deepEqual((await tabText()).map((t) => t.replace(/\s*\d+$/, "")), ["All", "Unpaid", "Paid", "On hold", "Not payable"]);
    const fromApi = (await call("GET", "/api/admin/entries?limit=1&view=auto")).body;
    assert.equal(await tabCount("All"), fromApi.counts.all);
    assert.equal(await tabCount("Unpaid"), fromApi.counts.unpaid);
    assert.deepEqual(Object.keys(await summary()), ["Received from patients", "To pay providers", "Our margin"]);
    assert.deepEqual(
      await page.$$eval(".en-table thead th", (els) => els.map((e) => e.textContent.trim())),
      ["#", "Booking ID", "Booked", "Consultation", "Patient", "Doctor", "Fee charged", "Doctor fee", "Paid status", "Paid on", "Comment"],
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
    assert.equal(await feeBox(name).getAttribute("placeholder"), "0.00");
    assert.equal(await feeBox(name).getAttribute("title"), null, "no tooltip with a 75% suggestion");
    const before = await summary();
    await feeBox(name).fill("60");
    await page.locator("body").click({ position: { x: 5, y: 400 } });
    await until(async () => (await row(name).locator(".en-st--saved").count()) === 1, "the Saved badge");
    const doc = await stored("appointment", id);
    assert.equal(doc.entry.doctorFeeCents, 6000);
    assert.equal(doc.entry.history.at(-1).by.role, "superadmin");
    await until(async () => money((await summary())["To pay providers"]) === money(before["To pay providers"]) + 60, "To pay providers to include the new fee");
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
    await until(async () => money((await summary())["To pay providers"]) === money(before.sum["To pay providers"]) - 70, "To pay providers to drop by 70");
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

  test("an empty doctor fee shows a grey 0.00 placeholder on every row, saves nothing, and no 75% text is anywhere on the page", async () => {
    const np = unique("NotPayable");
    await make({ name: np, doctor: 0, date: "2028-06-01", fee: 100, entry: { paidStatus: "not_payable" } });
    const up = unique("UnpaidGrey");
    await make({ name: up, doctor: 0, date: "2028-06-02", fee: 99, paid: 99 });
    await open("/admin-dashboard/appointment-entries?month=2028-06");
    await search(np);
    assert.equal(await feeBox(np).getAttribute("placeholder"), "0.00");
    await search(up);
    assert.equal(await feeBox(up).getAttribute("placeholder"), "0.00");
    assert.equal(await feeBox(up).inputValue(), "");
    assert.equal(await feeBox(up).evaluate((el) => getComputedStyle(el, "::placeholder").color), "rgb(148, 163, 184)", "the placeholder is grey");
    assert.equal(await page.evaluate(() => /75\s*%/.test(document.body.innerText + [...document.querySelectorAll("[placeholder],[title]")].map((e) => (e.getAttribute("placeholder") || "") + (e.title || "")).join(" "))), false);
    // Still only a placeholder: nothing was saved, and Paid still needs a saved fee.
    await statusBox(up).selectOption("paid");
    await until(async () => (await toasts()).includes("doctor fee above 0"), "the Paid refusal");
  });

  // ── Filters ───────────────────────────────────────────────────────────────

  test("tabs, Month and search narrow the list, the counts and the boxes", async () => {
    const a = unique("Filter A");
    const b = unique("Filter B");
    await make({ name: a, doctor: 2, date: "2028-07-03", fee: 60, entry: { doctorFeeCents: 2000 } });
    await make({ name: b, doctor: 2, date: "2028-08-03", fee: 60, entry: { paidStatus: "on_hold" } });
    await open("/admin-dashboard/appointment-entries?month=2028-07");
    await until(async () => (await page.locator(".en-table tbody tr").count()) === 1, "one row");
    assert.ok((await row(a).innerText()).includes(a));
    assert.deepEqual(await summary(), { "Received from patients": "$60.00", "To pay providers": "$20.00", "Our margin": "$40.00" });
    await open("/admin-dashboard/appointment-entries?month=2028-08&tab=on_hold");
    await until(async () => (await page.locator(".en-table tbody tr").count()) === 1 && (await row(b).count()) === 1, "the On hold row");
    await clickTab("All");
    await until(async () => (await row(b).count()) === 1, "the All tab of that month");
    await search(b);
    assert.equal(await page.locator(".en-table tbody tr").count(), 1);
  });

  test("there is no Doctor filter any more, and search still finds rows by doctor or provider name", async () => {
    await open("/admin-dashboard/appointment-entries");
    assert.equal(await page.locator('select[aria-label="Doctor"]').count(), 0);
    assert.equal(await page.getByText("All doctors").count(), 0);
    const item = await addViaApi({ date: "2027-01-13", serviceProvider: "Quasar Home Care", patientName: unique("Provider Search") });
    await open(`${MANUAL}&month=2027-01`);
    await search("Quasar Home Care");
    assert.equal(await row(item.patient.name).count(), 1);
    await open("/admin-dashboard/appointment-entries");
    await search("Perlin");
    assert.ok((await page.locator(".en-table tbody tr").count()) >= 1);
  });

  test("the page opens on the view in its address (tab, month)", async () => {
    const name = unique("Deep Link");
    await make({ name, doctor: 1, date: "2028-09-03", fee: 60, entry: { paidStatus: "not_payable" } });
    await open("/admin-dashboard/appointment-entries?tab=not_payable&month=2028-09");
    await until(async () => (await row(name).count()) === 1, "the row");
    assert.equal(await page.locator('.en-tab[aria-selected="true"]').innerText().then((t) => t.replace(/\s*\d+$/, "")), "Not payable");
    assert.equal((await page.locator(".en-mp-label").innerText()).replace("▾", "").trim(), "September 2028");
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
    await open(`${MANUAL}&month=2027-05`);
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
    await open(`${MANUAL}&month=2027-05`);
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
    await open(`${MANUAL}&month=2027-05`);
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
    await open(`${MANUAL}&month=2027-05`);
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
    await open(`${MANUAL}&month=2027-05`);
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

  test("the popup on a phone is full screen with the sections stacked in one column, and Save stays in reach", async () => {
    await open(`${MANUAL}&month=2027-05`, { width: 390, height: 844 });
    await openAdd();
    await until(async () => Math.round((await popup().boundingBox()).y) === 0, "the popup to settle");
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
    await open(`${MANUAL}&month=2027-05`, { width: 1500, height: 1000 });
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

  // ── CSV ───────────────────────────────────────────────────────────────────

  // ── The month picker ──────────────────────────────────────────────────────

  const monthName = (m) => new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  const stepM = (m, d) => {
    const i = Number(m.slice(0, 4)) * 12 + Number(m.slice(5)) - 1 + d;
    return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
  };
  const nowMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const pickerLabel = async () => (await page.locator(".en-mp-label").innerText()).replace("▾", "").trim();
  // The page's own address (the harness records it: a memory router has no browser address).
  const labelIs = (text) => until(async () => (await pickerLabel()) === text, `the month label "${text}"`);
  const urlIs = (m) => until(async () => (await urlMonth()) === m, `the address month "${m}"`);
  const urlMonth = async () => new URLSearchParams(await page.evaluate(() => window.__loc || "")).get("month") || "";
  const tableTotal = async () => Number(/\d+/.exec(await page.locator(".en-table tfoot .en-lbl").innerText())[0]);
  const apiTotal = async (month) => (await call("GET", `/api/admin/entries?limit=1&view=auto${month ? `&month=${month}` : ""}`)).body.total;

  test("the month control is one compact control the same height as the other toolbar controls, and there is no native select for it", async () => {
    await open("/admin-dashboard/appointment-entries");
    assert.equal(await page.locator('select[aria-label="Month"]').count(), 0);
    const heights = await page.evaluate(() => ({
      mp: Math.round(document.querySelector(".en-mp-ctl").getBoundingClientRect().height),
      search: Math.round(document.querySelector(".en-search").getBoundingClientRect().height),
      btn: Math.round(document.querySelector(".en-bar .en-btn").getBoundingClientRect().height),
      mpBorder: getComputedStyle(document.querySelector(".en-mp-ctl")).borderTopWidth,
      radius: getComputedStyle(document.querySelector(".en-mp-ctl")).borderTopLeftRadius,
      searchRadius: getComputedStyle(document.querySelector(".en-search")).borderTopLeftRadius,
    }));
    assert.deepEqual([heights.mp, heights.search, heights.btn], [34, 34, 34]);
    assert.deepEqual([heights.mpBorder, heights.radius], ["1px", heights.searchRadius]);
    await labelIs("All time");
  });

  test("the arrows step one month; from All time, ‹ goes to the latest month that has entries and › is off; › stops at this month", async () => {
    const nowM = nowMonth();
    const m1 = stepM(nowM, -1);
    const m3 = stepM(nowM, -3);
    await make({ name: unique("Arrow Now"), date: `${nowM}-05`, fee: 30 });
    await make({ name: unique("Arrow M1"), date: `${m1}-05`, fee: 30 });
    await open("/admin-dashboard/appointment-entries");
    assert.equal(await page.getByRole("button", { name: "Next month" }).isDisabled(), true, "› is off on All time");
    const months = (await call("GET", "/api/admin/entries?limit=1&view=auto")).body.months.filter((m) => m <= nowM);
    const latest = months.sort().at(-1);
    await page.getByRole("button", { name: "Previous month" }).click();
    await until(async () => (await pickerLabel()) === monthName(latest), "the latest month with entries");
    await urlIs(latest);
    await until(async () => (await tableTotal()) === (await apiTotal(latest)), "the table to follow the month");
    // Step back and forward from a month.
    await open(`/admin-dashboard/appointment-entries?month=${m3}`);
    await labelIs(monthName(m3));
    await page.getByRole("button", { name: "Previous month" }).click();
    await labelIs(monthName(stepM(m3, -1)));
    await page.getByRole("button", { name: "Next month" }).click();
    await page.getByRole("button", { name: "Next month" }).click();
    await labelIs(monthName(stepM(m3, 1)));
    await open(`/admin-dashboard/appointment-entries?month=${nowM}`);
    assert.equal(await page.getByRole("button", { name: "Next month" }).isDisabled(), true, "› stops at this month");
    await page.getByRole("button", { name: "Previous month" }).click();
    await urlIs(m1);
    await open("/admin-dashboard/appointment-entries?month=2026-01");
    await page.getByRole("button", { name: "Previous month" }).click();
    await labelIs("December 2025");
  });

  test("the popover: year row, 4x3 months, selected / this month / no-entries / future states, picking closes it, the table and boxes follow", async () => {
    const nowM = nowMonth();
    const m1 = stepM(nowM, -1);
    const m3 = stepM(nowM, -3);
    const a = unique("Pick M3");
    const b = unique("Pick M1");
    await make({ name: a, date: `${m3}-06`, fee: 40, entry: { doctorFeeCents: 1500 } });
    await make({ name: b, date: `${m1}-06`, fee: 40 });
    await open(`/admin-dashboard/appointment-entries?month=${m1}`);
    await until(async () => (await row(b).count()) === 1, "the m1 row");
    await page.locator(".en-mp-label").click();
    const pop = page.locator(".en-mp-pop");
    await pop.waitFor();
    assert.equal(await pop.locator(".en-mp-year b").innerText(), m1.slice(0, 4));
    assert.deepEqual(await pop.locator(".en-mp-m").allInnerTexts(), ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
    const cols = await pop.locator(".en-mp-m").evaluateAll((els) => [...new Set(els.map((e) => Math.round(e.getBoundingClientRect().left)))].length);
    assert.equal(cols, 4);
    assert.ok((await pop.locator(`[data-month="${m1}"]`).getAttribute("class")).includes("is-selected"));
    const cs = await pop.locator(`[data-month="${m1}"]`).evaluate((el) => getComputedStyle(el).backgroundColor);
    assert.equal(cs, "rgb(15, 118, 110)", "the selected month is filled teal");
    if (nowM.slice(0, 4) === m1.slice(0, 4)) {
      assert.ok((await pop.locator(`[data-month="${nowM}"]`).getAttribute("class")).includes("is-now"));
      assert.equal(await pop.locator(`[data-month="${nowM}"]`).evaluate((el) => getComputedStyle(el).borderTopColor), "rgb(15, 118, 110)", "this month has a teal outline");
    }
    const next = stepM(nowM, 1);
    if (next.slice(0, 4) === nowM.slice(0, 4)) assert.equal(await pop.locator(`[data-month="${next}"]`).isDisabled(), true, "future months are disabled");
    assert.equal(await pop.getByRole("button", { name: "Next year" }).isDisabled(), true, "no year after this one");
    // A month with no entries is greyed but clickable.
    const withEntries = (await call("GET", "/api/admin/entries?limit=1&view=auto")).body.months;
    const empty = Array.from({ length: 12 }, (_, i) => `${nowM.slice(0, 4)}-${String(i + 1).padStart(2, "0")}`).find((m) => m <= nowM && !withEntries.includes(m));
    if (empty) {
      assert.ok((await pop.locator(`[data-month="${empty}"]`).getAttribute("class")).includes("is-empty"));
      assert.equal(await pop.locator(`[data-month="${empty}"]`).isDisabled(), false);
    }
    // Years.
    await pop.getByRole("button", { name: "Previous year" }).click();
    assert.equal(await pop.locator(".en-mp-year b").innerText(), String(Number(nowM.slice(0, 4)) - 1));
    await pop.getByRole("button", { name: "Next year" }).click();
    // Pick m3: the popover closes, the table, totals, boxes and the address follow.
    await shot("month-popover-1500");
    const before = await summary();
    await pop.locator(`[data-month="${m3}"]`).click();
    await pop.waitFor({ state: "detached" });
    await labelIs(monthName(m3));
    await urlIs(m3);
    await until(async () => (await row(a).count()) === 1 && (await row(b).count()) === 0, "the m3 rows");
    await until(async () => (await tableTotal()) === (await apiTotal(m3)), "the totals row");
    assert.notDeepEqual(await summary(), before);
    // This month / All time.
    await page.locator(".en-mp-label").click();
    await page.getByRole("button", { name: "This month" }).click();
    await labelIs(monthName(nowM));
    await urlIs(nowM);
    await page.locator(".en-mp-label").click();
    await page.getByRole("button", { name: "All time" }).click();
    await labelIs("All time");
    await urlIs("");
    await until(async () => (await tableTotal()) === (await apiTotal("")), "all rows");
  });

  test("the popover closes on Escape and on a click outside; the arrow keys move in the grid and Enter picks", async () => {
    const nowM = nowMonth();
    const m3 = stepM(nowM, -3);
    await open(`/admin-dashboard/appointment-entries?month=${nowM}`);
    const pop = page.locator(".en-mp-pop");
    await page.locator(".en-mp-label").click();
    await pop.waitFor();
    await page.keyboard.press("Escape");
    await pop.waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => document.activeElement?.className), "en-mp-label", "focus goes back to the control");
    await page.locator(".en-mp-label").click();
    await pop.waitFor();
    await page.locator(".en-head").click({ position: { x: 5, y: 5 } });
    await pop.waitFor({ state: "detached" });
    await urlIs(nowM);

    await page.locator(".en-mp-label").click();
    await pop.waitFor();
    const focused = () => page.evaluate(() => document.activeElement?.dataset?.month || "");
    await until(async () => (await focused()) === nowM, "focus on the current month");
    await page.keyboard.press("ArrowLeft");
    assert.equal(await focused(), stepM(nowM, -1));
    await page.keyboard.press("ArrowUp");
    assert.equal(await focused(), stepM(nowM, -4));
    await page.keyboard.press("ArrowDown");
    assert.equal(await focused(), stepM(nowM, -1));
    await page.keyboard.press("ArrowRight");
    assert.equal(await focused(), nowM);
    await page.keyboard.press("ArrowRight");
    assert.equal(await focused(), nowM, "it does not move into the future");
    for (let i = 0; i < 3; i += 1) await page.keyboard.press("ArrowLeft");
    assert.equal(await focused(), m3);
    await page.keyboard.press("Enter");
    await pop.waitFor({ state: "detached" });
    await labelIs(monthName(m3));
    await urlIs(m3);
  });

  test("the picked month survives a reload (it is in the address), and the CSV follows it", async () => {
    const m3 = stepM(nowMonth(), -3);
    const name = unique("Reload Month");
    await make({ name, date: `${m3}-08`, fee: 20 });
    await open(`/admin-dashboard/appointment-entries?month=${m3}`);
    await until(async () => (await row(name).count()) === 1, "the row");
    await page.reload();
    await page.waitForSelector(".en-table tbody tr");
    await labelIs(monthName(m3));
    await until(async () => (await row(name).count()) === 1, "the row after a reload");
    const [download] = await Promise.all([page.waitForEvent("download"), page.click('button:has-text("Export CSV")')]);
    const lines = fs.readFileSync(await download.path(), "utf8").replace(/^﻿/, "").trim().split("\r\n");
    assert.equal(lines.length - 1, await apiTotal(m3));
    assert.ok(lines.some((l) => l.includes(name)));
  });

  test("on a phone the month popover is as wide as the control, right under it", async () => {
    await open(`/admin-dashboard/appointment-entries?month=${stepM(nowMonth(), -1)}`, { width: 390, height: 844 });
    await page.locator(".en-mp-label").click();
    await page.locator(".en-mp-pop").waitFor();
    const m = await page.evaluate(() => {
      const c = document.querySelector(".en-mp-ctl").getBoundingClientRect();
      const p = document.querySelector(".en-mp-pop").getBoundingClientRect();
      return { cw: Math.round(c.width), pw: Math.round(p.width), left: Math.round(p.left - c.left), gap: Math.round(p.top - c.bottom), over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    assert.ok(Math.abs(m.pw - m.cw) <= 2 && Math.abs(m.left) <= 1, JSON.stringify(m));
    assert.ok(m.gap >= 0 && m.gap <= 12 && m.over <= 0, JSON.stringify(m));
    await shot("month-popover-390");
  });

  // ── Copy the booking ID ───────────────────────────────────────────────────

  test("clicking a booking ID copies the FULL id with a 'Booking ID copied' toast; the hover says Click to copy and the cursor is copy", async () => {
    const name = unique("Copy Booking");
    const id = await make({ name, doctor: 0, date: "2027-02-06", fee: 40 });
    await open("/admin-dashboard/appointment-entries?month=2027-02");
    await search(name);
    const button = row(name).locator(".en-idcopy");
    assert.equal(await button.getAttribute("title"), "Click to copy");
    assert.equal(await button.evaluate((el) => getComputedStyle(el).cursor), "copy");
    assert.ok((await button.innerText()).length < id.length, "the id is shown short");
    await button.click();
    await until(async () => (await toasts()).includes("Booking ID copied"), "the toast");
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), id);
  });

  test("if the clipboard is refused, the text is selected and the toast says to press Ctrl+C", async () => {
    const name = unique("Copy Refused");
    const id = await make({ name, doctor: 0, date: "2027-02-08", fee: 40 });
    await open("/admin-dashboard/appointment-entries?month=2027-02");
    await search(name);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("blocked")) } });
      document.execCommand = () => false;
    });
    await row(name).locator(".en-idcopy").click();
    await until(async () => (await toasts()).includes("press Ctrl+C"), "the Ctrl+C toast");
    assert.equal(await page.evaluate(() => window.getSelection().toString()), id);
  });

  // ── The Actions column ────────────────────────────────────────────────────

  // ── The two views ─────────────────────────────────────────────────────────

  const MANUAL = "/admin-dashboard/appointment-entries?view=manual";
  const viewTab = (label) => page.getByRole("tab", { name: new RegExp(`^${label}`) });
  const sheetRow = (text) => page.locator(".xs tbody tr", { hasText: text }).first();
  const sheetCell = (text, header) => sheetRow(text).locator(`td[data-l="${header}"]`);
  const urlParam = async (name) => new URLSearchParams(await page.evaluate(() => window.__loc || "")).get(name) || "";
  const manualNames = async () => page.$$eval(".xs tbody tr", (rows) => rows.map((r) => r.querySelector('td[data-l="Patient Name"]')?.textContent.trim()));
  // Adds a manual row through the API with the sheet's own fields.
  const addSheetRow = async (extra = {}) => {
    const r = await call("POST", "/api/admin/entries/manual", {
      date: "2027-06-10", company: "Nova Assistance", caseNumber: "229987", serviceType: "house_call", caseStatus: "completed", serviceProvider: "Doctor Balear",
      patientName: unique("Sheet Patient"), country: "Spain", consultationFee: "290", doctorFee: "200", mrStatus: "received", mrSentToCompany: "sent", invoiceSent: "sent",
      paymentReceived: "received", paymentReceivedDate: "2026-06-12", contactNumber: "37379777262", feedbackSent: "Yes", feedbackReceived: "All 3 Reminder Sent", ...extra,
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body.item;
  };

  test("the header has a two-button switch (Auto entries / Manual entries) with their counts, no description text, and the view is kept in the address", async () => {
    await addSheetRow({ date: "2027-02-10" });
    await open("/admin-dashboard/appointment-entries?month=2027-02");
    assert.equal(await page.getByText("The doctor fee and payout record").count(), 0, "the description is gone");
    assert.deepEqual(await page.$$eval(".vsw button", (els) => els.map((e) => e.firstChild && e.textContent.replace(/\d+$/, "").trim())), ["Auto entries", "Manual entries"]);
    const counts = (await call("GET", "/api/admin/entries?limit=1&month=2027-02")).body.views;
    await until(async () => Number(await viewTab("Auto entries").locator("i").innerText()) === counts.auto, "the Auto count");
    assert.equal(Number(await viewTab("Manual entries").locator("i").innerText()), counts.manual);
    assert.equal(await viewTab("Auto entries").getAttribute("aria-selected"), "true", "Auto is the default");
    assert.equal(await urlParam("view"), "", "the default view is left out of the address");
    await viewTab("Manual entries").click();
    await until(async () => (await page.locator(".xs").count()) === 1, "the manual sheet");
    assert.equal(await urlParam("view"), "manual");
    assert.equal(await viewTab("Manual entries").getAttribute("aria-selected"), "true");
    await viewTab("Auto entries").click();
    await until(async () => (await page.locator(".en-table").count()) === 1, "the auto table");
    assert.equal(await urlParam("view"), "");
    // A reload on the Manual view stays on it.
    await open(MANUAL);
    assert.equal(await viewTab("Manual entries").getAttribute("aria-selected"), "true");
    await page.reload();
    await page.waitForSelector(".xs, .en-state");
    assert.equal(await viewTab("Manual entries").getAttribute("aria-selected"), "true");
  });

  test("the Auto view has bookings only: no manual rows, no Add manual entry button, no Actions column, and the legend", async () => {
    const item = await addSheetRow({ date: "2027-02-11" });
    await open("/admin-dashboard/appointment-entries?month=2027-02");
    await until(async () => (await page.locator(".en-table tbody tr").count()) >= 1, "rows");
    assert.equal(await page.locator('.en-table tbody tr[data-kind="manual"]').count(), 0);
    assert.equal(await row(item.patient.name).count(), 0, "the manual row is not here");
    assert.equal(await page.getByRole("button", { name: "Add manual entry" }).count(), 0);
    assert.equal(await page.locator(".en-table th", { hasText: "Actions" }).count(), 0);
    assert.equal(await page.locator(".en-table .en-abtn").count(), 0);
    assert.match(await page.locator(".en-legend").innerText(), /Filled in automatically from the booking[\s\S]*You type here/);
    // The same page in the Manual view has the button and no legend.
    await open(`${MANUAL}&month=2027-02`);
    await until(async () => (await sheetRow(item.patient.name).count()) === 1, "the manual row");
    assert.equal(await page.getByRole("button", { name: "Add manual entry" }).count(), 1);
    assert.equal(await page.locator(".en-legend").count(), 0);
    assert.equal(await page.locator(".en-table").count(), 0);
  });

  test("the Manual view looks like the team's sheet: light blue header, a border on every cell, the columns in the exact order, the grey row numbers", async () => {
    const item = await addSheetRow({ date: "2027-02-12" });
    await open(`${MANUAL}&month=2027-02`);
    await until(async () => (await sheetRow(item.patient.name).count()) === 1, "the row");
    assert.deepEqual(await page.$$eval(".xs thead th", (els) => els.map((e) => e.textContent.trim())), [
      "#", "Date", "Company", "Case Number", "Patient Name", "Type of service", "Patient Country", "Service provider", "Status", "Consultation Fee", "Doctor's Fee",
      "MR status from provider", "MR sent status to the companies", "Invoice sent status", "Payment received", "Payment to Provider", "Payment received date",
      "Paid date to the provider", "Contact Number", "Service provider number", "Feedback Message Sent", "Feedback Received", "Calculation", "Comment", "Actions",
    ]);
    const look = await page.evaluate(() => {
      const css = (el) => getComputedStyle(el);
      const th = document.querySelector(".xs thead th:nth-child(3)");
      const td = document.querySelector(".xs tbody tr td:nth-child(6)");
      const rn = document.querySelector(".xs tbody td.rn");
      const case_ = document.querySelector('.xs tbody td[data-l="Case Number"]');
      const patient = document.querySelector('.xs tbody td[data-l="Patient Name"]');
      return {
        head: css(th).backgroundColor, headBorder: css(th).borderRightWidth, cellBorder: [css(td).borderRightWidth, css(td).borderBottomWidth], rn: css(rn).backgroundColor,
        green: [css(case_).backgroundColor, css(patient).backgroundColor], plain: css(td).backgroundColor,
      };
    });
    assert.equal(look.head, "rgb(189, 215, 238)", "light blue header");
    assert.deepEqual([look.headBorder, ...look.cellBorder], ["1px", "1px", "1px"], "a border on every cell");
    assert.deepEqual(look.green, ["rgb(213, 235, 201)", "rgb(213, 235, 201)"], "Case Number and Patient Name are light green");
    assert.equal(look.plain, "rgb(255, 255, 255)");
    // The row number is first and numbered from 1.
    assert.equal((await page.locator(".xs tbody tr").first().locator("td.rn button").innerText()).trim(), "1");
    await shot("manual-sheet-1500");
  });

  test("the sheet shows values like the sheet: MR received, MR sent, Invoice sent, Paid for a payment received, Need to pay (orange) and Paid (green), dates, Others text", async () => {
    const a = await addSheetRow({ date: "2027-02-13", serviceType: "others", otherService: "Lab report review", paymentToProvider: "unpaid" });
    const b = await addSheetRow({ date: "2027-02-14", mrStatus: "pending", mrSentToCompany: "not_sent", invoiceSent: "not_sent", paymentReceived: "not_received", paymentToProvider: "paid", doctorFee: "30" });
    await open(`${MANUAL}&month=2027-02`);
    await until(async () => (await sheetRow(b.patient.name).count()) === 1, "the rows");
    const text = async (item, header) => (await sheetCell(item.patient.name, header).innerText()).trim();
    assert.deepEqual(
      [await text(a, "MR status from provider"), await text(a, "MR sent status to the companies"), await text(a, "Invoice sent status"), await text(a, "Payment received"), await text(a, "Payment to Provider")],
      ["MR received", "MR sent", "Invoice sent", "Paid", "Need to pay"],
    );
    assert.deepEqual(
      [await text(b, "MR status from provider"), await text(b, "MR sent status to the companies"), await text(b, "Invoice sent status"), await text(b, "Payment received"), await text(b, "Payment to Provider")],
      ["MR pending", "Not sent", "Not sent", "Not received", "Paid"],
    );
    assert.equal(await text(a, "Type of service"), "Lab report review");
    assert.equal(await text(a, "Date"), "13 Feb 2027");
    assert.equal(await text(a, "Consultation Fee"), "290");
    assert.equal(await text(a, "Calculation"), "90");
    const color = (item) => sheetCell(item.patient.name, "Payment to Provider").locator("span").evaluate((el) => getComputedStyle(el).color);
    assert.equal(await color(a), "rgb(180, 83, 9)", "Need to pay is orange");
    assert.equal(await color(b), "rgb(21, 128, 61)", "Paid is green");
    const neg = await addSheetRow({ date: "2027-02-15", consultationFee: "50", doctorFee: "65" });
    await open(`${MANUAL}&month=2027-02`);
    await until(async () => (await sheetRow(neg.patient.name).count()) === 1, "the negative row");
    assert.equal(await text(neg, "Calculation"), "−15");
    assert.equal(await sheetCell(neg.patient.name, "Calculation").locator("span").evaluate((el) => getComputedStyle(el).color), "rgb(185, 28, 28)", "red when negative");
    assert.equal(await sheetCell(a.patient.name, "Calculation").locator("span").evaluate((el) => getComputedStyle(el).color), "rgb(21, 128, 61)", "green otherwise");
  });

  test("the sheet scrolls sideways INSIDE its own box (never the page); the header stays on top, Date / Company / Case Number / Patient Name stay on the left, Actions on the right", async () => {
    for (let i = 0; i < 12; i += 1) await addSheetRow({ date: `2027-03-${String(10 + i).padStart(2, "0")}`, patientName: unique("Pin Patient") });
    await open(`${MANUAL}&month=2027-03`, { width: 1280, height: 700 });
    await until(async () => (await page.locator(".xs tbody tr").count()) >= 12, "the rows");
    const box = await page.evaluate(() => {
      const wrap = document.querySelector(".xs-wrap");
      return { inner: wrap.scrollWidth > wrap.clientWidth + 50, pageOver: document.documentElement.scrollWidth - document.documentElement.clientWidth, taller: wrap.scrollHeight > wrap.clientHeight };
    });
    assert.equal(box.inner, true, "the sheet is wider than its box");
    assert.ok(box.pageOver <= 0, "the page itself does not scroll sideways");
    const rects = () =>
      page.evaluate(() => {
        const wrap = document.querySelector(".xs-wrap").getBoundingClientRect();
        const r = (sel) => {
          const b = document.querySelector(sel).getBoundingClientRect();
          return { left: Math.round(b.left - wrap.left), right: Math.round(wrap.right - b.right), top: Math.round(b.top - wrap.top) };
        };
        return {
          date: r('.xs tbody tr:first-child td[data-l="Date"]'), company: r('.xs tbody tr:first-child td[data-l="Company"]'), caseNo: r('.xs tbody tr:first-child td[data-l="Case Number"]'),
          patient: r('.xs tbody tr:first-child td[data-l="Patient Name"]'), act: r(".xs tbody tr:first-child td.act"), head: r(".xs thead th:nth-child(2)"),
          headAct: r(".xs thead th.act"), country: r('.xs tbody tr:first-child td[data-l="Patient Country"]'),
        };
      });
    const before = await rects();
    await page.locator(".xs-wrap").evaluate((el) => { el.scrollLeft = 700; el.scrollTop = 120; });
    await sleep(150);
    const after = await rects();
    for (const key of ["date", "company", "caseNo", "patient"]) assert.equal(after[key].left, before[key].left, `${key} stays pinned on the left`);
    assert.equal(after.act.right, before.act.right, "Actions stays pinned on the right");
    assert.equal(after.headAct.right, before.headAct.right);
    assert.equal(after.head.top, before.head.top, "the header row stays at the top");
    assert.notEqual(after.country.left, before.country.left, "the other columns did scroll");
    assert.ok(after.act.right <= 1 && after.patient.left >= 0);
    await shot("manual-sheet-scrolled");
  });

  test("the Total row at the bottom has the entry count and the totals of Consultation Fee, Doctor's Fee and Calculation", async () => {
    const a = await addSheetRow({ date: "2027-04-02", consultationFee: "290", doctorFee: "200" });
    await addSheetRow({ date: "2027-04-03", consultationFee: "50", doctorFee: "65" });
    await addSheetRow({ date: "2027-04-04", consultationFee: "100", doctorFee: "" });
    await open(`${MANUAL}&month=2027-04`);
    await until(async () => (await sheetRow(a.patient.name).count()) === 1, "the rows");
    const foot = await page.$$eval(".xs tfoot td", (els) => els.map((e) => e.textContent.trim()));
    assert.equal(foot[1], "Total");
    assert.equal(foot[2], "3 entries");
    assert.deepEqual(foot.slice(9, 11), ["440", "265"], "290+50+100 and 200+65");
    assert.equal(foot[foot.length - 3], "175", "the calculation total is the fees minus the doctor's fees");
    assert.equal(await page.locator(".xs tfoot td span.pos").count(), 1);
  });

  test("the row number copies the M- code on click", async () => {
    const item = await addSheetRow({ date: "2027-04-05" });
    await open(`${MANUAL}&month=2027-04`);
    await until(async () => (await sheetRow(item.patient.name).count()) === 1, "the row");
    await sheetRow(item.patient.name).locator("td.rn button").click();
    await until(async () => (await toasts()).includes("Booking ID copied"), "the toast");
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), item.shortId);
    assert.match(item.shortId, /^M-[0-9A-F]{4}$/);
  });

  // ── Inline edit ───────────────────────────────────────────────────────────

  // The row being edited has its values in inputs, so it is found by its class, not by the text in it.
  const editing = () => page.locator(".xs tr.editing");
  const ie = (_text, label) => editing().locator(`[aria-label="${label}"]`);
  const startEdit = async (item) => {
    await sheetRow(item.patient.name).getByRole("button", { name: "Edit" }).click();
    await editing().waitFor();
  };

  test("Edit turns the row into editable cells in place (light yellow, Save / Cancel), no popup; only one row can be edited at a time", async () => {
    const a = await addSheetRow({ date: "2027-05-02" });
    const b = await addSheetRow({ date: "2027-05-03" });
    await open(`${MANUAL}&month=2027-05`);
    await until(async () => (await sheetRow(b.patient.name).count()) === 1, "the rows");
    await startEdit(a);
    assert.equal(await page.locator(".hc-modal").count(), 0, "no popup");
    const state = await page.evaluate((name) => {
      const tr = document.querySelector(".xs tr.editing");
      const td = tr.querySelector("td:nth-child(7)");
      return { cls: tr.className, bg: getComputedStyle(td).backgroundColor, kinds: [...tr.querySelectorAll(".ie")].map((e) => e.tagName.toLowerCase()) };
    }, a.patient.name);
    assert.equal(state.cls, "editing");
    assert.equal(state.bg, "rgb(255, 251, 234)", "light yellow");
    assert.ok(state.kinds.includes("input") && state.kinds.includes("select") && state.kinds.includes("textarea"));
    assert.equal(await page.locator('.xs input[type="date"]').count() >= 3, true, "date inputs");
    const actions = page.locator(".xs tr.editing td.act");
    assert.deepEqual(await actions.locator("button").allInnerTexts(), ["Save", "Cancel"]);
    // The other rows' Edit buttons are off while this one is being edited.
    assert.equal(await sheetRow(b.patient.name).getByRole("button", { name: "Edit" }).isDisabled(), true);
    await actions.getByRole("button", { name: "Cancel" }).click();
    await until(async () => (await page.locator(".xs tr.editing").count()) === 0, "the editing to end");
    assert.equal(await sheetRow(b.patient.name).getByRole("button", { name: "Edit" }).isDisabled(), false);
  });

  test("inline Save sends ONE versioned update with only the changed fields; the row shows the new values; the calculation follows", async () => {
    const item = await addSheetRow({ date: "2027-05-04", company: "Old Co" });
    await open(`${MANUAL}&month=2027-05`);
    await until(async () => (await sheetRow(item.patient.name).count()) === 1, "the row");
    await startEdit(item);
    const requests = [];
    page.on("request", (r) => r.method() === "PATCH" && requests.push({ url: r.url(), body: r.postDataJSON() }));
    await ie(item.patient.name, "Company").fill("New Co");
    await ie(item.patient.name, "Consultation Fee").fill("300");
    await ie(item.patient.name, "MR status from provider").selectOption("pending");
    await ie(item.patient.name, "Comment").fill("edited inline");
    await editing().getByRole("button", { name: "Save" }).click();
    await until(async () => (await toasts()).includes("Saved 4 changes"), "the toast");
    await until(async () => (await page.locator(".xs tr.editing").count()) === 0, "the editing to end");
    page.removeAllListeners("request");
    assert.equal(requests.length, 1, "one request");
    assert.match(requests[0].url, new RegExp(`/manual/${item.id}/details$`));
    assert.deepEqual(Object.keys(requests[0].body).sort(), ["comment", "company", "consultationFee", "mrStatus", "version"]);
    assert.equal(requests[0].body.version, 0);
    const cells = async (h) => (await sheetCell(item.patient.name, h).innerText()).trim();
    assert.deepEqual([await cells("Company"), await cells("Consultation Fee"), await cells("MR status from provider"), await cells("Comment"), await cells("Calculation")], ["New Co", "300", "MR pending", "edited inline", "100"]);
    const stored = (await call("GET", "/__manual")).body.find((m) => m._id === item.id);
    assert.deepEqual([stored.company, stored.feeChargedCents, stored.mrStatus, stored.entry.comment, stored.entry.v], ["New Co", 30000, "pending", "edited inline", 1]);
  });

  test("Enter saves the row (but not in a text area); Escape cancels and throws the changes away", async () => {
    const item = await addSheetRow({ date: "2027-05-05", company: "Enter Co" });
    await open(`${MANUAL}&month=2027-05`);
    await until(async () => (await sheetRow(item.patient.name).count()) === 1, "the row");
    await startEdit(item);
    await ie(item.patient.name, "Company").fill("Discarded");
    await ie(item.patient.name, "Company").press("Escape");
    await until(async () => (await page.locator(".xs tr.editing").count()) === 0, "Escape to cancel");
    assert.equal((await sheetCell(item.patient.name, "Company").innerText()).trim(), "Enter Co");
    assert.equal((await (await call("GET", "/__manual")).body.find((m) => m._id === item.id)).company, "Enter Co");
    await startEdit(item);
    await ie(item.patient.name, "Feedback Message Sent").fill("line one");
    await ie(item.patient.name, "Feedback Message Sent").press("Enter");
    await sleep(300);
    assert.equal(await page.locator(".xs tr.editing").count(), 1, "Enter in a text area does not save");
    await ie(item.patient.name, "Company").fill("Saved By Enter");
    await ie(item.patient.name, "Company").press("Enter");
    await until(async () => (await page.locator(".xs tr.editing").count()) === 0, "Enter to save");
    await until(async () => (await sheetCell(item.patient.name, "Company").innerText()).trim() === "Saved By Enter", "the new company");
    const stored = (await call("GET", "/__manual")).body.find((m) => m._id === item.id);
    assert.match(stored.feedbackSent, /^Yes\nline one$|line one/);
  });

  test("inline validation: the bad cell is highlighted and a toast says why; nothing is saved", async () => {
    const item = await addSheetRow({ date: "2027-05-06" });
    await open(`${MANUAL}&month=2027-05`);
    await until(async () => (await sheetRow(item.patient.name).count()) === 1, "the row");
    const save = () => editing().getByRole("button", { name: "Save" }).click();
    const bad = async (label) => (await ie(item.patient.name, label).getAttribute("class")).includes("bad");
    await startEdit(item);
    await ie(item.patient.name, "Patient Name").fill("   ");
    await save();
    await until(async () => (await toasts()).includes("patient's name"), "the patient toast");
    assert.equal(await bad("Patient Name"), true);
    await ie(item.patient.name, "Patient Name").fill(item.patient.name);
    await ie(item.patient.name, "Service provider").fill("");
    await save();
    await until(async () => (await toasts()).includes("service provider"), "the provider toast");
    assert.equal(await bad("Service provider"), true);
    await ie(item.patient.name, "Service provider").fill("Doctor Balear");
    await ie(item.patient.name, "Type of service").selectOption("others");
    await save();
    await until(async () => (await toasts()).includes("other service"), "the Others toast");
    assert.equal(await bad("Other service"), true);
    await ie(item.patient.name, "Other service").fill("Physio");
    await ie(item.patient.name, "Consultation Fee").fill("1.234");
    await save();
    await until(async () => (await toasts()).includes("Consultation fee must be a number"), "the fee toast");
    assert.equal(await bad("Consultation Fee"), true);
    await ie(item.patient.name, "Consultation Fee").fill("290");
    await ie(item.patient.name, "Doctor's Fee").fill("abc");
    await save();
    await until(async () => (await toasts()).includes("Doctor's fee must be a number"), "the doctor's fee toast");
    await ie(item.patient.name, "Doctor's Fee").fill("");
    await ie(item.patient.name, "Payment to Provider").selectOption("paid");
    await save();
    await until(async () => (await toasts()).includes("doctor's fee above 0"), "the Paid toast");
    await ie(item.patient.name, "Contact Number").fill("call me");
    await ie(item.patient.name, "Doctor's Fee").fill("10");
    await save();
    await until(async () => (await toasts()).includes("contact number"), "the phone toast");
    assert.equal(await bad("Contact Number"), true);
    const stored = (await call("GET", "/__manual")).body.find((m) => m._id === item.id);
    assert.deepEqual([stored.patientName, stored.serviceType, stored.entry.v ?? 0], [item.patient.name, "house_call", 0]);
  });

  test("the payment dates fill today and clear by the same rules when saved inline", async () => {
    const item = await addSheetRow({ date: "2027-05-07", paymentReceived: "not_received", paymentReceivedDate: "", doctorFee: "50" });
    await open(`${MANUAL}&month=2027-05`);
    await until(async () => (await sheetRow(item.patient.name).count()) === 1, "the row");
    await startEdit(item);
    await ie(item.patient.name, "Payment received").selectOption("partly_received");
    await ie(item.patient.name, "Payment to Provider").selectOption("paid");
    await editing().getByRole("button", { name: "Save" }).click();
    await until(async () => (await page.locator(".xs tr.editing").count()) === 0, "the save");
    const today = new Date();
    const local = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const stored = (await call("GET", "/__manual")).body.find((m) => m._id === item.id);
    assert.equal(stored.paymentReceivedDate, local, "filled with today");
    assert.equal(stored.entry.paidOn.length, 10, "the Paid date is filled too");
    assert.equal(stored.entry.paidStatus, "paid");
    // Back to Not received: the date clears.
    await startEdit(item);
    await ie(item.patient.name, "Payment received").selectOption("not_received");
    await editing().getByRole("button", { name: "Save" }).click();
    await until(async () => (await page.locator(".xs tr.editing").count()) === 0, "the second save");
    assert.equal((await call("GET", "/__manual")).body.find((m) => m._id === item.id).paymentReceivedDate, "");
  });

  test("when Payment to Provider is Paid, the case, provider, patient and fee cells are disabled, the rest can change, and Actions says 'Paid: some fields locked'", async () => {
    const item = await addSheetRow({ date: "2027-05-08", paymentToProvider: "paid", doctorFee: "100" });
    await open(`${MANUAL}&month=2027-05`);
    await until(async () => (await sheetRow(item.patient.name).count()) === 1, "the row");
    await startEdit(item);
    const locked = ["Date", "Company", "Case Number", "Patient Name", "Type of service", "Patient Country", "Service provider", "Status", "Consultation Fee", "Doctor's Fee", "Contact Number", "Service provider number"];
    for (const label of locked) assert.equal(await ie(item.patient.name, label).isDisabled(), true, `${label} is locked`);
    for (const label of ["MR status from provider", "MR sent status to the companies", "Invoice sent status", "Payment received", "Payment received date", "Payment to Provider", "Paid date to the provider", "Feedback Message Sent", "Feedback Received", "Comment"]) {
      assert.equal(await ie(item.patient.name, label).isDisabled(), false, `${label} stays editable`);
    }
    assert.equal((await editing().locator("td.act .lk").innerText()).trim(), "Paid: some fields locked");
    await ie(item.patient.name, "MR status from provider").selectOption("pending");
    await ie(item.patient.name, "Feedback Received").fill("still editable");
    await editing().getByRole("button", { name: "Save" }).click();
    await until(async () => (await toasts()).includes("Saved 2 changes"), "the save");
    // Even a stale page cannot change a locked field: the server refuses.
    const refused = await call("PATCH", `/api/admin/entries/manual/${item.id}/details`, { version: 1, patientName: "Sneaky" });
    assert.deepEqual([refused.status, refused.body.code], [409, "locked_paid"]);
    shot("manual-locked-inline");
  });

  test("a stale save (someone else changed the row first) is refused with a message, and the row shows the latest data", async () => {
    const item = await addSheetRow({ date: "2027-05-09", company: "First Co" });
    await open(`${MANUAL}&month=2027-05`);
    await until(async () => (await sheetRow(item.patient.name).count()) === 1, "the row");
    await startEdit(item);
    await ie(item.patient.name, "Company").fill("My Co");
    // Someone else saves first.
    assert.equal((await call("PATCH", `/api/admin/entries/manual/${item.id}/details`, { version: 0, company: "Their Co" })).status, 200);
    await editing().getByRole("button", { name: "Save" }).click();
    await until(async () => (await toasts()).includes("Someone else changed this row"), "the stale message");
    await until(async () => (await page.locator(".xs tr.editing").count()) === 0, "the editing to end");
    await until(async () => (await sheetCell(item.patient.name, "Company").innerText()).trim() === "Their Co", "the latest data");
    assert.equal((await (await call("GET", "/__manual")).body.find((m) => m._id === item.id)).company, "Their Co");
  });

  // ── History ───────────────────────────────────────────────────────────────

  test("History lists every change newest first, grouped per save, with who, their role, the time in IST, and each field old (struck through) -> new", async () => {
    const item = await addSheetRow({ date: "2027-06-02", company: "Hist Co", paymentToProvider: "unpaid", doctorFee: "80" });
    await open(`${MANUAL}&month=2027-06`);
    await until(async () => (await sheetRow(item.patient.name).count()) === 1, "the row");
    assert.equal(await sheetRow(item.patient.name).getByRole("button", { name: /^History/ }).locator("i").count(), 0, "no changes yet, no count");
    // Two saves by two roles.
    await call("PATCH", `/api/admin/entries/manual/${item.id}/details`, { version: 0, company: "Hist Co 2", consultationFee: "300", mrStatus: "pending" }, { "x-test-role": "admin" });
    await call("PATCH", `/api/admin/entries/manual/${item.id}/details`, { version: 1, paymentToProvider: "paid" }, { "x-test-role": "superadmin" });
    await open(`${MANUAL}&month=2027-06`);
    await until(async () => (await sheetRow(item.patient.name).count()) === 1, "the row");
    const button = sheetRow(item.patient.name).getByRole("button", { name: /^History/ });
    await until(async () => (await button.locator("i").count()) === 1, "the change count");
    assert.equal((await button.locator("i").innerText()).trim(), "5", "3 + 2 field changes (Paid also filled its date)");
    await button.click();
    const dialog = page.locator(".en-hist");
    await dialog.waitFor();
    assert.match(await dialog.locator(".hc-modal__title").innerText(), /^History · M-[0-9A-F]{4}$/);
    const groups = dialog.locator(".hg");
    await until(async () => (await groups.count()) === 3, "the history to load");
    assert.equal(await groups.count(), 3, "two saves and the creation");
    const who = await groups.evaluateAll((els) => els.map((g) => ({ name: g.querySelector(".hw b").textContent, role: g.querySelector(".rl")?.textContent, time: g.querySelector("time").textContent, items: [...g.querySelectorAll("li")].map((li) => li.innerText.replace(/\s+/g, " ").trim()) })));
    assert.equal(who[0].role, "Super Admin", "newest first");
    assert.equal(who[1].role, "Admin");
    assert.match(who[0].time, /^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} IST$/);
    assert.ok(who[0].items.includes("Payment to Provider Need to pay → Paid"));
    assert.ok(who[1].items.includes("Company Hist Co → Hist Co 2") && who[1].items.includes("Consultation Fee 290.00 → 300.00") && who[1].items.includes("MR status from provider MR received → MR pending"), who[1].items.join(" | "));
    assert.deepEqual(who[2].items, ["Created the entry"]);
    const style = await groups.nth(1).locator("li", { hasText: "Company" }).evaluate((li) => ({
      from: getComputedStyle(li.querySelector(".ha")).textDecorationLine, fromColor: getComputedStyle(li.querySelector(".ha")).color, toColor: getComputedStyle(li.querySelector(".hb")).color,
    }));
    assert.equal(style.from, "line-through");
    assert.equal(style.fromColor, "rgb(185, 28, 28)", "old values are red");
    assert.equal(style.toColor, "rgb(21, 128, 61)", "new values are green");
    await shot("history-1500");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
  });

  test("an inline edit writes History lines under the column headers, with the editing admin's name and role", async () => {
    const item = await addSheetRow({ date: "2027-06-03", company: "Before Co" });
    await open(`${MANUAL}&month=2027-06`, { role: "admin" });
    await until(async () => (await sheetRow(item.patient.name).count()) === 1, "the row");
    await startEdit(item);
    await ie(item.patient.name, "Company").fill("After Co");
    await ie(item.patient.name, "Comment").fill("a note");
    await editing().getByRole("button", { name: "Save" }).click();
    await until(async () => (await sheetRow(item.patient.name).getByRole("button", { name: /^History/ }).locator("i").count()) === 1, "the count");
    await sheetRow(item.patient.name).getByRole("button", { name: /^History/ }).click();
    const first = page.locator(".en-hist .hg").first();
    await first.waitFor();
    assert.equal((await first.locator(".rl").evaluate((el) => el.textContent)).trim(), "Admin");
    assert.deepEqual(await first.locator("li").allInnerTexts().then((l) => l.map((t) => t.replace(/\s+/g, " ").trim())), ["Company Before Co → After Co", "Comment — → a note"]);
    const stored = (await call("GET", "/__manual")).body.find((m) => m._id === item.id);
    assert.deepEqual(stored.log.slice(1).map((l) => l.field), ["Company", "Comment"], "the log itself uses the column headers");
  });

  // ── Delete, Actions ───────────────────────────────────────────────────────

  test("Actions has Edit, History and Delete; Delete asks first (Keep it changes nothing), then the row is gone; it is disabled when Paid", async () => {
    const item = await addSheetRow({ date: "2027-07-02" });
    const paid = await addSheetRow({ date: "2027-07-03", paymentToProvider: "paid", doctorFee: "30" });
    await open(`${MANUAL}&month=2027-07`);
    await until(async () => (await sheetRow(paid.patient.name).count()) === 1, "the rows");
    const act = (it) => sheetRow(it.patient.name).locator("td.act");
    assert.deepEqual(await act(item).locator("button").evaluateAll((els) => els.map((e) => e.firstChild.textContent.trim())), ["Edit", "History", "Delete"]);
    const del = act(paid).getByRole("button", { name: "Delete" });
    assert.equal(await del.isDisabled(), true);
    assert.equal(await del.getAttribute("title"), "Change Payment to provider from Paid before deleting");
    await act(item).getByRole("button", { name: "Delete" }).click();
    await page.waitForSelector('[role="alertdialog"]');
    assert.match(await page.locator('[role="alertdialog"]').innerText(), /Delete this manual entry\?[\s\S]*Only manual entries can be deleted/);
    await page.click('[role="alertdialog"] button:has-text("Keep it")');
    await page.waitForSelector('[role="alertdialog"]', { state: "detached" });
    assert.equal(await sheetRow(item.patient.name).count(), 1);
    await act(item).getByRole("button", { name: "Delete" }).click();
    await page.click('[role="alertdialog"] button:has-text("Delete entry")');
    await until(async () => (await sheetRow(item.patient.name).count()) === 0, "the row to go");
    const gone = (await call("GET", "/__manual")).body.find((m) => m._id === item.id);
    assert.ok(gone.deletedAt && gone.log.at(-1).action === "deleted", "a soft delete: the document and its log stay");
  });

  test("Add manual entry (Manual view only): after saving, the new row is in the Manual view, even when the add started in Auto", async () => {
    await open(`${MANUAL}&month=2027-08`);
    await page.getByRole("button", { name: "Add manual entry" }).click();
    await page.locator(".en-modal--wide").waitFor();
    const name = unique("Added Here");
    await page.locator('label:has(> span:text-is("Date")) input').fill("2027-08-05");
    await page.locator('label:has(> span:text-is("Service provider")) input').fill("Dr Added");
    await page.locator('label:has(> span:text-is("Patient name")) input').fill(name);
    await page.locator('label:has(> span:text-is("Consultation fee ($)")) input').fill("75");
    await page.locator(".en-modal--wide button:has-text('Save entry')").click();
    await until(async () => (await sheetRow(name).count()) === 1, "the new row in the sheet");
    assert.ok((await toasts()).includes("Manual entry added"));
    assert.equal(await viewTab("Manual entries").getAttribute("aria-selected"), "true");
  });

  // ── The money boxes: a super admin only ───────────────────────────────────

  test("a super admin sees three boxes in both views; an admin sees none, and the server does not send the money to an admin", async () => {
    await addSheetRow({ date: "2027-09-02", consultationFee: "100", doctorFee: "60", paymentReceived: "received" });
    await make({ name: unique("Box Booking"), doctor: 0, date: "2027-09-03", fee: 80, paid: 80, entry: { doctorFeeCents: 3000 } });
    for (const [url, labels] of [
      ["/admin-dashboard/appointment-entries?month=2027-09", ["Received from patients", "To pay providers", "Our margin"]],
      [`${MANUAL}&month=2027-09`, ["Received from companies", "To pay providers", "Our margin"]],
    ]) {
      await open(url, { role: "superadmin" });
      await until(async () => (await page.locator(".en-kpi").count()) === 3, "the three boxes");
      assert.deepEqual(Object.keys(await summary()), labels);
    }
    await open(`${MANUAL}&month=2027-09`, { role: "superadmin" });
    await until(async () => (await page.locator(".en-kpi").count()) === 3, "the boxes");
    const money = await summary();
    const expected = (await call("GET", "/api/admin/entries?view=manual&month=2027-09", undefined, { "x-test-role": "superadmin" })).body.summary;
    assert.equal(money["Received from companies"], `$${(expected.receivedCents / 100).toFixed(2)}`);
    // An admin: no boxes in either view, and no money in the answer.
    for (const url of ["/admin-dashboard/appointment-entries?month=2027-09", `${MANUAL}&month=2027-09`]) {
      await open(url, { role: "admin" });
      await page.waitForSelector(".en-table tbody tr, .xs tbody tr");
      assert.equal(await page.locator(".en-kpi").count(), 0, `no boxes for an admin: ${url}`);
      assert.equal(await page.locator('[data-testid="summary"]').count(), 0);
    }
    const asAdmin = await call("GET", "/api/admin/entries?view=manual&month=2027-09", undefined, { "x-test-role": "admin" });
    assert.equal("summary" in asAdmin.body, false);
    assert.equal(/receivedCents|marginCents|toPayCents/.test(asAdmin.text), false);
  });

  test("the boxes follow the month, not the tabs or the search", async () => {
    await addSheetRow({ date: "2026-02-02", consultationFee: "100", doctorFee: "60", paymentReceived: "received" });
    await addSheetRow({ date: "2026-03-02", consultationFee: "40", doctorFee: "10", paymentReceived: "received" });
    await open(`${MANUAL}&month=2026-02`, { role: "superadmin" });
    await until(async () => (await summary())["Received from companies"] !== undefined, "the boxes");
    const october = await summary();
    await clickTab("Paid");
    await sleep(500);
    await page.fill(".en-search input", "zzzz-nothing");
    await sleep(800);
    assert.deepEqual(await summary(), october);
    await open(`${MANUAL}&month=2026-03`, { role: "superadmin" });
    await until(async () => (await summary())["Received from companies"] === "$40.00", "the other month");
  });

  test("the tabs and counts work per view, using the payout status (Payment to Provider for manual rows)", async () => {
    const held = await addSheetRow({ date: "2026-01-02", paymentToProvider: "on_hold" });
    await addSheetRow({ date: "2026-01-03", paymentToProvider: "unpaid" });
    await make({ name: unique("Tabs Booking"), doctor: 0, date: "2026-01-04", fee: 20 });
    await open(`${MANUAL}&month=2026-01`);
    await until(async () => (await sheetRow(held.patient.name).count()) === 1, "the rows");
    assert.equal(await tabCount("All"), 2);
    assert.equal(await tabCount("On hold"), 1);
    await clickTab("On hold");
    await until(async () => (await page.locator(".xs tbody tr").count()) === 1, "the On hold tab");
    assert.equal(await sheetRow(held.patient.name).count(), 1);
    await clickTab("Unpaid");
    await until(async () => (await sheetRow(held.patient.name).count()) === 0, "the Unpaid tab");
    // Switching view resets the tab to All.
    await viewTab("Auto entries").click();
    await until(async () => (await page.locator(".en-table").count()) === 1, "the auto table");
    assert.equal(await page.locator('.en-tab[aria-selected="true"]').innerText().then((t) => t.replace(/\s*\d+$/, "")), "All");
  });

  test("the CSV follows the view: the manual file has the sheet's columns in the sheet's order and words; the auto file has bookings only", async () => {
    const item = await addSheetRow({ date: "2025-12-12", company: "Csv Co", caseNumber: "C-9", paymentToProvider: "unpaid" });
    await open(`${MANUAL}&month=2025-12`);
    await until(async () => (await sheetRow(item.patient.name).count()) === 1, "the row");
    const [download] = await Promise.all([page.waitForEvent("download"), page.click('button:has-text("Export CSV")')]);
    assert.equal(download.suggestedFilename(), `entries-${istToday()}.csv`);
    const lines = fs.readFileSync(await download.path(), "utf8").replace(/^﻿/, "").trim().split("\r\n");
    assert.equal(lines[0], "Date,Company,Case Number,Patient Name,Type of service,Patient Country,Service provider,Status,Consultation Fee,Doctor's Fee,MR status from provider,MR sent status to the companies,Invoice sent status,Payment received,Payment to Provider,Payment received date,Paid date to the provider,Contact Number,Service provider number,Feedback Message Sent,Feedback Received,Calculation,Comment");
    const line = lines.find((l) => l.includes(item.patient.name));
    assert.ok(line.startsWith("2025-12-12,Csv Co,C-9,") && line.includes(",House call,Spain,Doctor Balear,Completed,290.00,200.00,MR received,MR sent,Invoice sent,Paid,Need to pay,2026-06-12,"), line);
    assert.ok(line.endsWith(",90.00,"), line);
    // Auto: bookings only.
    await make({ name: unique("Csv Auto"), doctor: 0, date: "2025-12-13", fee: 70, source: { platform: "android" } });
    await open("/admin-dashboard/appointment-entries?month=2025-12");
    await until(async () => (await page.locator(".en-table tbody tr").count()) >= 1, "the auto rows");
    const [download2] = await Promise.all([page.waitForEvent("download"), page.click('button:has-text("Export CSV")')]);
    const auto = fs.readFileSync(await download2.path(), "utf8").replace(/^﻿/, "").trim().split("\r\n");
    assert.match(auto[0], /^Booking ID,Source,Platform,/);
    assert.equal(auto[0].includes("Company"), false);
    assert.equal(auto.some((l) => l.includes(item.patient.name)), false, "no manual rows in the auto file");
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

  test("layout of the Auto view at 1920, 1440, 1366, 1280 and 390: no sideways scroll, Booked only above 1440px, one card per booking below 1360px, nothing clipped", async () => {
    const name = unique("Layout Check");
    await make({ name, country: "AE", doctor: 2, date: "2027-04-04", time: "11:30 AM", fee: 99, paid: 45, entry: { doctorFeeCents: 1234, comment: "A fairly long comment that must not widen the page" } });
    for (const [width, expected] of [
      [1920, { cards: false, booked: true }],
      [1440, { cards: false, booked: false }],
      [1366, { cards: false, booked: false }],
      [1280, { cards: true }],
      [390, { cards: true }],
    ]) {
      await open("/admin-dashboard/appointment-entries?month=2027-04", { width, height: width < 500 ? 844 : 1000 });
      await search(name);
      const m = await layout();
      const at = `${width}px ${JSON.stringify(m)}`;
      assert.equal(m.pageOverflow <= 0, true, `no sideways scroll on the page: ${at}`);
      assert.equal(m.scrollerOverflow <= 0, true, `no sideways scroll in the table: ${at}`);
      assert.equal(m.cards, expected.cards, `cards or table: ${at}`);
      assert.deepEqual(m.clipped, [], `nothing clipped: ${at}`);
      assert.equal(m.actions, null, `no Actions column in the Auto view: ${at}`);
      if (!expected.cards) {
        assert.deepEqual(m.headClipped, [], `no column header is cut off (Doctor fee in full): ${at}`);
        assert.equal(m.bookedColumn, expected.booked, `Booked column: ${at}`);
        assert.ok(m.minInput >= 60, `the editable boxes keep a usable width: ${at}`);
      } else {
        assert.ok(m.labels.includes("Patient") && m.labels.includes("Doctor fee") && m.labels.includes("Paid status") && m.labels.includes("Paid on") && m.labels.includes("Comment"), `labelled fields: ${at}`);
        assert.ok(m.labels.includes("Booked"), `Booked is a labelled field on a card: ${at}`);
        assert.ok(m.minInput >= 100, `the editable boxes stay full size on a card: ${at}`);
      }
      await shot(`layout-${width}`);
    }
  });

  test("layout of the Manual view at 1920, 1440, 1366, 1280 and 390: the page never scrolls sideways, the sheet scrolls inside its own box, the header stays and the pinned columns stay", async () => {
    const item = await addSheetRow({ date: "2027-04-06", patientName: unique("Layout Sheet"), company: "A Long Company Name Ltd", serviceProvider: "A Fairly Long Provider Name Ltd" });
    for (const width of [1920, 1440, 1366, 1280, 390]) {
      await open(`${MANUAL}&month=2027-04`, { width, height: width < 500 ? 844 : 1000 });
      await until(async () => (await sheetRow(item.patient.name).count()) === 1, "the row");
      const m = await page.evaluate(() => {
        const wrap = document.querySelector(".xs-wrap");
        const de = document.documentElement;
        const head = document.querySelector(".en-head").getBoundingClientRect();
        const bar = document.querySelector(".en-bar");
        return {
          pageOver: de.scrollWidth - de.clientWidth,
          wrapW: Math.round(wrap.getBoundingClientRect().width),
          vw: de.clientWidth,
          inner: wrap.scrollWidth - wrap.clientWidth,
          switchFits: document.querySelector(".vsw").getBoundingClientRect().right <= de.clientWidth + 1 && head.right <= de.clientWidth + 1,
          barFits: bar.scrollWidth <= bar.clientWidth + 1,
        };
      });
      const at = `${width}px ${JSON.stringify(m)}`;
      assert.ok(m.pageOver <= 0, `the page does not scroll sideways: ${at}`);
      assert.ok(m.wrapW <= m.vw, `the sheet box fits the window: ${at}`);
      assert.ok(m.inner > 0, `the sheet scrolls inside its box: ${at}`);
      assert.equal(m.switchFits && m.barFits, true, `the header area fits: ${at}`);
      if (width > 700) {
        await page.locator(".xs-wrap").evaluate((el) => { el.scrollLeft = 500; });
        await sleep(100);
        const pinned = await page.evaluate(() => {
          const wrap = document.querySelector(".xs-wrap").getBoundingClientRect();
          const l = (sel) => Math.round(document.querySelector(sel).getBoundingClientRect().left - wrap.left);
          return { date: l('.xs tbody tr td[data-l="Date"]'), patient: l('.xs tbody tr td[data-l="Patient Name"]'), act: Math.round(wrap.right - document.querySelector(".xs tbody tr td.act").getBoundingClientRect().right) };
        });
        assert.ok(pinned.date >= 30 && pinned.date <= 40, `Date stays pinned: ${at} ${JSON.stringify(pinned)}`);
        assert.ok(pinned.patient >= 0 && pinned.patient <= 420, `Patient Name stays pinned: ${at}`);
        assert.ok(pinned.act <= 1, `Actions stays pinned on the right: ${at}`);
      }
      await shot(`manual-layout-${width}`);
    }
  });

  test("on a card, every editable box works the same: type a fee, change the status", async () => {
    const name = unique("Card Edit");
    const id = await make({ name, doctor: 0, date: "2027-04-05", fee: 100 });
    await open("/admin-dashboard/appointment-entries?month=2027-04", { width: 390, height: 844 });
    await search(name);
    await feeBox(name).fill("45");
    await feeBox(name).press("Enter");
    await until(async () => (await stored("appointment", id)).entry?.doctorFeeCents === 4500, "the fee");
    await statusBox(name).selectOption("on_hold");
    await until(async () => (await stored("appointment", id)).entry?.paidStatus === "on_hold", "the status");
  });
});
