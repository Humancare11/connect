// Browser-level tests of the Manual Invoices page (individual / B2C): the REAL page in real Chromium, talking to the REAL
// /api/admin/manual-invoices and /api/payments code over a throwaway in-memory MongoDB (see apiServer.mjs).
//   npm run test:e2e:manual-invoices   (from frontend/)
// The tests skip themselves when Chromium (or Chrome/Edge) or the backend's dependencies are not installed.
//
// B2B is switched off for now (B2B_MANUAL_INVOICES_ENABLED): the page only shows the Individual (B2C) form.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
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

describe("Manual Invoices page (Individual / B2C) in a real browser", { skip: skipReason || false }, () => {
  let api;
  let vite;
  let browser;
  let page;
  let harnessUrl;
  const pageErrors = [];

  const getJson = async (route) => (await fetch(api.url + route)).json();
  const control = (route, body = {}) =>
    fetch(`${api.url}${route}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const open = async (role = "paymentadmin", width = 1300) => {
    await page.setViewportSize({ width, height: 1400 });
    await page.goto(`${harnessUrl}/tests/e2e/paymentLinks/harness/index.html?page=manual&role=${role}`);
    await page.waitForSelector(".pl-form");
  };
  const fill = (placeholder, value) => page.locator(`.pl-form [placeholder="${placeholder}"]`).first().fill(value);
  const rows = () => page.locator(".pl-table--recent tbody tr");
  const cell = (row, col) => rows().nth(row).locator("td").nth(col);
  const postJson = (route, body) =>
    page.evaluate(
      async ([route, body]) => (await fetch(route, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json(),
      [route, body],
    );
  // Creates an invoice through the page's own form.
  const generate = async ({ name = "Rahul Mehta", email = "rahul.mehta@gmail.com", service = "tele consultation", amount = "100", issueAs } = {}) => {
    await fill("Rahul Mehta", name);
    await fill("name@gmail.com", email);
    await fill("Tele Consultation", service);
    await fill("0.00", amount);
    if (issueAs) await page.locator(".pl-form select").selectOption(issueAs);
    await page.locator(".pl-primary").click();
    await page.waitForSelector(".pl-result");
  };

  before(async () => {
    api = await startApiServer();
    vite = await createServer({
      configFile: false,
      root: frontendRoot,
      logLevel: "silent",
      plugins: [reactPlugin()],
      define: { "import.meta.env.VITE_API_URL": JSON.stringify("") },
      server: { port: 0, host: "127.0.0.1", fs: { allow: [path.resolve(frontendRoot, "..")] }, proxy: { "/api": { target: api.url, changeOrigin: false } } },
      optimizeDeps: { entries: ["tests/e2e/paymentLinks/harness/index.html"] },
    });
    await vite.listen();
    harnessUrl = vite.resolvedUrls.local[0].replace(/\/$/, "");
    browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
    page = await (await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] })).newPage();
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error" && !/Failed to load resource/.test(message.text())) pageErrors.push(message.text());
    });
  });

  after(async () => {
    await page?.context().close();
    await browser?.close();
    await vite?.close();
    await api?.close();
    assert.deepEqual(pageErrors, [], "the page logged no errors");
  });

  test("the form has only the B2C fields: name, email, services, Issue as, note", async () => {
    await control("/__reset");
    await open();
    const form = page.locator(".pl-form");
    for (const shown of ["Customer", "Full name *", "Email *", "Services", "+ Add Item", "Issue as", "Note"]) {
      assert.ok(await form.getByText(shown, { exact: true }).first().isVisible(), shown);
    }
    for (const hidden of ["Company", "Personal number", "Country", "Postal code", "Address", "Payment terms", "Due date", "Quantity", "Customer type", "Bill to", "Items"]) {
      assert.equal(await form.getByText(hidden, { exact: true }).count(), 0, `${hidden} is not shown`);
    }
    assert.deepEqual(await page.locator(".pl-form select option").allInnerTexts(), ["Due — not yet paid", "Paid — already received"]);
    assert.equal(await page.locator('.pl-form [aria-label="Quantity"]').count(), 0);
    assert.equal(await page.locator(".pl-primary").innerText(), "Generate Invoice");
    assert.match(await form.innerText(), /Email apne aap nahi jayega\. Invoice banne ke baad Send Email button se bhejiye\./);
    assert.equal(await page.getByText("payment link", { exact: false }).filter({ hasText: /Generate|Copy Link/ }).count(), 0, "no payment link UI");
  });

  test("Generate Invoice (due) sends quantity 1, creates only an invoice (no payment link), and emails nothing", async () => {
    await control("/__reset");
    await open();
    await fill("Rahul Mehta", "Rahul Mehta");
    await fill("name@gmail.com", "rahul.mehta@gmail.com");
    await fill("Tele Consultation", "tele consultation");
    await fill("0.00", "100");
    await fill("Optional internal note", "na");
    const [request] = await Promise.all([
      page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/api/admin/manual-invoices")),
      page.locator(".pl-primary").click(),
    ]);
    assert.deepEqual(request.postDataJSON(), {
      customerType: "b2c", name: "Rahul Mehta", email: "rahul.mehta@gmail.com", status: "due", note: "na", currency: "USD",
      items: [{ description: "tele consultation", quantity: 1, amount: 100 }],
    });
    await page.waitForSelector(".pl-result");
    assert.equal(await page.locator(".pl-error").count(), 0);
    const result = (await page.locator(".pl-invoice-box").innerText()).replace(/\s+/g, " ");
    assert.match(result, /HC\d{2}-\d{4}/);
    assert.match(result, /Due/);
    assert.match(result, /Email abhi nahi bheja gaya/);
    assert.equal((await getJson("/__links")).length, 0, "no payment link was created");
    assert.equal((await getJson("/__mails")).length, 0, "nothing was emailed");
    const [invoice] = await getJson("/__invoices");
    assert.deepEqual([invoice.status, invoice.source, invoice.customerType, invoice.emailedAt], ["due", "manual", "b2c", null]);
  });

  test("Issue as Paid creates a paid invoice (a receipt)", async () => {
    await control("/__reset");
    await open();
    await generate({ issueAs: "paid" });
    assert.match(await page.locator(".pl-invoice-box").innerText(), /Paid/);
    const [invoice] = await getJson("/__invoices");
    assert.equal(invoice.status, "paid");
    assert.equal(invoice.paymentMethod, "Received");
  });

  test("History: the eight columns in order, and a row's content", async () => {
    await control("/__reset");
    await open();
    await generate();
    await page.locator(".pl-history .pl-secondary", { hasText: "Refresh" }).click();
    await page.waitForSelector(".pl-table--recent tbody tr");
    const headers = await page.$$eval(".pl-table--recent thead th", (els) => els.map((e) => e.textContent));
    assert.deepEqual(headers, ["Sr No", "Case Number", "Name", "Created", "Amount", "Status", "Note", "Invoice"]);
    assert.equal((await cell(0, 0).innerText()).trim(), "1");
    assert.match((await cell(0, 1).innerText()).trim(), /^HC\d{2}-\d{4}$/);
    assert.equal((await cell(0, 2).locator(".pl-recent__name").innerText()).trim(), "Rahul Mehta");
    assert.equal((await cell(0, 2).locator(".pl-recent__email").innerText()).trim(), "rahul.mehta@gmail.com");
    assert.match((await cell(0, 3).locator("div").first().innerText()).trim(), /^\d{1,2} \w{3} \d{4}$/);
    assert.match((await cell(0, 3).locator(".pl-recent__time").innerText()).trim(), /^\d{1,2}:\d{2} [ap]m$/i);
    assert.equal((await cell(0, 4).innerText()).trim(), "$100.00");
    assert.equal((await cell(0, 5).innerText()).trim(), "Due");
    assert.equal((await cell(0, 7).innerText()).replace(/\s+/g, " ").trim(), "Email not sent Download Send Email Mark as Paid");
  });

  test("Send Email: the patient-style email goes out and the row says Email sent / Resend Email", async () => {
    await control("/__reset");
    await open();
    await generate();
    await cell(0, 7).getByRole("button", { name: "Send Email" }).click();
    await page.waitForFunction(() => document.querySelector(".pl-table--recent tbody tr")?.innerText.includes("✓ Email sent"));
    assert.equal((await cell(0, 7).innerText()).replace(/\s+/g, " ").trim(), "✓ Email sent Download Resend Email Mark as Paid");
    const mails = await getJson("/__mails");
    assert.equal(mails.length, 1);
    assert.equal(mails[0].to, "rahul.mehta@gmail.com");
    assert.equal(mails[0].status, "due");
    assert.equal(mails[0].forLinkPayer, true);
    assert.ok(!mails[0].payUrl, "no Pay now link: there is no payment link");
  });

  test("Download asks for the invoice's PDF link", async () => {
    await control("/__reset");
    await open();
    await generate();
    const [invoice] = await getJson("/__invoices");
    await page.route("**/api/admin/manual-invoices/*/download", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: "about:blank" }) }),
    );
    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().endsWith(`/api/admin/manual-invoices/${invoice._id}/download`)),
      cell(0, 7).getByRole("button", { name: "Download" }).click(),
    ]);
    assert.equal(request.method(), "GET");
  });

  test("Mark as Paid: confirm in the dialog, the row turns Paid, the button goes, and nothing is emailed by itself", async () => {
    await control("/__reset");
    await open();
    await generate();
    await cell(0, 7).getByRole("button", { name: "Mark as Paid" }).click();
    await page.getByRole("dialog").waitFor();
    assert.match(await page.getByRole("dialog").innerText(), /No email is sent/);
    await page.getByRole("button", { name: "Confirm Paid" }).click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    await page.waitForFunction(() => document.querySelector(".pl-table--recent tbody tr td:nth-child(6)")?.innerText.trim() === "Paid");
    assert.equal((await cell(0, 7).getByRole("button", { name: "Mark as Paid" }).count()), 0);
    assert.equal((await getJson("/__mails")).length, 0, "no automatic email");
    const [invoice] = await getJson("/__invoices");
    assert.equal(invoice.status, "paid");
    assert.equal(invoice.emailedAt, null);
    await cell(0, 7).getByRole("button", { name: "Send Email" }).click();
    await page.waitForFunction(() => document.querySelector(".pl-table--recent tbody tr")?.innerText.includes("✓ Email sent"));
    assert.equal((await getJson("/__mails"))[0].status, "paid");
  });

  test("a payment-link invoice shows a Payment link badge and has no Mark as Paid; an older B2B invoice is listed and downloads", async () => {
    await control("/__reset");
    await open();
    await postJson("/api/payments/admin/payment-links", {
      customerType: "b2c", name: "Sara Khan", email: "sara@example.com", currency: "USD", items: [{ description: "Report", amount: 20 }],
    });
    await control("/__legacy-invoice", { invoiceNumber: "HC01-2601" });
    await page.locator(".pl-history .pl-secondary", { hasText: "Refresh" }).click();
    await page.waitForFunction(() => document.querySelectorAll(".pl-table--recent tbody tr").length === 2);

    const linkRow = rows().filter({ hasText: "Sara Khan" });
    assert.equal(await linkRow.locator(".pl-recent__badge", { hasText: "Payment link" }).count(), 1);
    assert.equal(await linkRow.getByRole("button", { name: "Mark as Paid" }).count(), 0);

    const oldRow = rows().filter({ hasText: "HC01-2601" });
    assert.equal((await oldRow.locator(".pl-recent__name").innerText()).trim(), "Nova Assistance");
    assert.equal((await oldRow.locator("td").nth(4).innerText()).trim(), "$300.00");
    assert.equal((await oldRow.locator("td").nth(6).innerText()).trim(), "Quarterly package");
    const oldId = (await getJson("/__invoices")).find((i) => i.invoiceNumber === "HC01-2601")._id;
    await page.route("**/api/admin/manual-invoices/*/download", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: "about:blank" }) }),
    );
    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().endsWith(`/api/admin/manual-invoices/${oldId}/download`)),
      oldRow.getByRole("button", { name: "Download" }).click(),
    ]);
    assert.equal(request.method(), "GET");
  });

  test("the super admin sees the same B2C form and can create an invoice", async () => {
    await control("/__reset");
    await open("superadmin");
    assert.ok(await page.locator(".pl-form").getByText("Full name *", { exact: true }).isVisible());
    assert.equal(await page.locator(".pl-form").getByText("Company", { exact: true }).count(), 0);
    await generate();
    assert.equal(await page.locator(".pl-error").count(), 0);
    assert.equal((await getJson("/__invoices")).length, 1);
  });

  test("on a phone the page does not scroll sideways", async () => {
    await control("/__reset");
    await open("paymentadmin", 390);
    await generate();
    await page.locator(".pl-history .pl-secondary", { hasText: "Refresh" }).click();
    await page.waitForSelector(".pl-table--recent tbody tr");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, `no horizontal page scroll (${overflow}px)`);
  });
});
