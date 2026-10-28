// Browser-level tests of the Payment Links form: the REAL page in real Chromium, with its API calls answered by the test.
//   npm run test:e2e:payment-links   (from frontend/)
// The tests skip themselves when Chromium (or Chrome/Edge) is not installed.
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
let skipReason = "";
try {
  ({ chromium } = require("playwright-core"));
  ({ createServer } = await import("vite"));
  reactPlugin = (await import("@vitejs/plugin-react")).default;
  if (!findBrowser()) skipReason = "no Chromium found (npx playwright install chromium, or set CHROME_PATH)";
} catch (error) {
  skipReason = `missing dependency: ${String(error.message).split("\n")[0]}`;
}

describe("Payment Links form (B2C / B2B) in a real browser", { skip: skipReason || false }, () => {
  let vite;
  let browser;
  let page;
  let harnessUrl;
  let posted;
  const pageErrors = [];

  const open = async () => {
    posted = [];
    await page.route("**/api/payments/admin/payment-links", async (route) => {
      const request = route.request();
      if (request.method() === "POST") {
        const body = request.postDataJSON();
        posted.push(body);
        const total = (body.items || []).reduce((sum, i) => sum + Math.round(Number(i.amount ?? i.rate * i.quantity) * 100), 0);
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            _id: "l1", token: "tok", url: "https://app.test/pay/tok", amountPaise: total, currency: "usd", customerType: body.customerType, status: "pending",
            invoice: { _id: "i1", invoiceNumber: "HC09-2610", status: "due", customerType: body.customerType, clientName: body.name, clientEmail: body.email, emailed: false },
          }),
        });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ links: [] }) });
    });
    await page.setViewportSize({ width: 1300, height: 1400 });
    await page.goto(`${harnessUrl}/tests/e2e/paymentLinks/harness/index.html`);
    await page.waitForSelector(".pl-form");
  };
  const visible = (label) => page.locator(".pl-form").getByText(label, { exact: true }).first().isVisible();
  const fill = (placeholder, value) => page.locator(`.pl-form [placeholder="${placeholder}"]`).first().fill(value);
  const clientWillPay = async () => (await page.locator(".pl-preview > strong").innerText()).trim();
  const previewText = async () => (await page.locator(".pl-invoice-preview").innerText()).replace(/\s+/g, " ");

  before(async () => {
    vite = await createServer({
      configFile: false,
      root: frontendRoot,
      logLevel: "silent",
      plugins: [reactPlugin()],
      define: { "import.meta.env.VITE_API_URL": JSON.stringify("") },
      server: { port: 0, host: "127.0.0.1", fs: { allow: [path.resolve(frontendRoot, "..")] } },
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
    assert.deepEqual(pageErrors, [], "the page logged no errors");
  });

  test("Individual (B2C) is the default and shows only name, email and services", async () => {
    await open();
    assert.equal(await page.locator('input[name="customerType"][value="b2c"]').isChecked(), true);
    for (const shown of ["Customer", "Full name *", "Email *", "Services", "+ Add Item"]) assert.ok(await visible(shown), shown);
    for (const hidden of ["Company", "Personal number", "Country", "Postal code", "Address", "Payment terms", "Due date", "Issue as", "Notes (printed on the invoice)"]) {
      assert.equal(await page.locator(".pl-form").getByText(hidden, { exact: true }).count(), 0, `${hidden} is hidden`);
    }
    assert.match(await page.locator(".pl-form").innerText(), /Due on Receipt/);
    assert.ok(await visible("Note"), "the internal note stays");
    assert.equal(await page.locator(".pl-primary").innerText(), "Generate Link & Invoice");
  });

  test("switching to Business (B2B) shows the unchanged business form, and back again", async () => {
    await open();
    await page.locator(".pl-seg label", { hasText: "Business (B2B)" }).click();
    for (const shown of ["Bill to", "Client name *", "Company", "Personal number", "Country", "Postal code", "Address", "Payment terms", "Due date", "Issue as", "Items", "+ Add Item"]) {
      assert.ok(await visible(shown), shown);
    }
    assert.equal(await page.locator(".pl-form").getByText("Services", { exact: true }).count(), 0);
    assert.equal(await page.locator(".pl-form select:disabled").inputValue(), "due", "Issue as stays locked on Bill");
    await page.locator(".pl-seg label", { hasText: "Individual (B2C)" }).click();
    assert.ok(await visible("Services"));
    assert.equal(await page.locator(".pl-form").getByText("Company", { exact: true }).count(), 0);
  });

  test("B2C: Total is the sum of the services, in the form and in the Client will pay card", async () => {
    await open();
    assert.equal(await clientWillPay(), "$0.00");
    await fill("Tele Consultation", "Tele Consultation");
    await fill("0.00", "75");
    assert.equal(await clientWillPay(), "$75.00");
    await page.locator(".pl-items__add").click();
    assert.equal(await page.locator(".pl-item-row--service:not(.pl-item-row--head)").count(), 2);
    await page.locator('.pl-item-row--service [aria-label="Description"]').nth(1).fill("Follow-up report");
    await page.locator('.pl-item-row--service [aria-label="Amount"]').nth(1).fill("20.5");
    assert.equal(await clientWillPay(), "$95.50");
    assert.equal((await page.locator(".pl-totals__total dd").innerText()).trim(), "$95.50");
    await fill("Rahul Mehta", "Rahul Mehta");
    await fill("name@gmail.com", "rahul@gmail.com");
    const preview = await previewText();
    for (const expected of ["Invoice no. Auto (HCnn-", "Name Rahul Mehta", "Email rahul@gmail.com", "Services 2", "Total $95.50"]) {
      assert.ok(preview.includes(expected), `preview shows "${expected}" — got: ${preview}`);
    }
    for (const gone of ["Due date", "Subtotal", "Tax"]) assert.ok(!preview.includes(gone), `no "${gone}" for B2C`);
    await page.locator(".pl-item-row--service .pl-item-row__remove").nth(1).click();
    assert.equal(await clientWillPay(), "$75.00");
  });

  test("B2C submit sends only name, email and services, then shows the invoice box with Download PDF and Send Email", async () => {
    await open();
    await fill("Rahul Mehta", "Rahul Mehta");
    await fill("name@gmail.com", "rahul@gmail.com");
    await fill("Tele Consultation", "Tele Consultation");
    await fill("0.00", "75");
    await page.locator(".pl-primary").click();
    await page.waitForSelector(".pl-result");
    assert.equal(posted.length, 1);
    assert.deepEqual(posted[0], {
      customerType: "b2c",
      name: "Rahul Mehta",
      email: "rahul@gmail.com",
      note: "",
      currency: "USD",
      items: [{ description: "Tele Consultation", amount: 75 }],
    });
    const result = await page.locator(".pl-invoice-box").innerText();
    assert.match(result, /HC09-2610/);
    assert.match(result, /Due/);
    assert.match(result, /Email abhi nahi bheja gaya/);
    assert.equal(await page.locator(".pl-invoice-box").getByRole("button", { name: "Download PDF" }).count(), 1);
    assert.equal(await page.locator(".pl-invoice-box").getByRole("button", { name: "Send Email" }).count(), 1);
  });

  test("each customer type keeps its own entries when you switch", async () => {
    await open();
    await fill("Rahul Mehta", "Rahul Mehta");
    await page.locator(".pl-seg label", { hasText: "Business (B2B)" }).click();
    await fill("Nova Assistance", "Nova Assistance");
    await page.locator(".pl-seg label", { hasText: "Individual (B2C)" }).click();
    assert.equal(await page.locator('.pl-form [placeholder="Rahul Mehta"]').first().inputValue(), "Rahul Mehta");
    await page.locator(".pl-seg label", { hasText: "Business (B2B)" }).click();
    assert.equal(await page.locator('.pl-form [placeholder="Nova Assistance"]').first().inputValue(), "Nova Assistance");
  });
});
