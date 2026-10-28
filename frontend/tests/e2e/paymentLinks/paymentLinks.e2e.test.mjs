// Browser-level tests of the Payment Links form: the REAL page in real Chromium, talking to the REAL /api/payments code over a
// throwaway in-memory MongoDB (see apiServer.mjs), so a request really goes through the server's own validation.
//   npm run test:e2e:payment-links   (from frontend/)
// The tests skip themselves when Chromium (or Chrome/Edge) or the backend's dependencies are not installed.
//
// B2B is switched off for now (B2B_ENABLED in PaymentLinks.jsx, B2B_PAYMENT_LINKS_ENABLED in routes/payments.js): the page
// only shows the Individual (B2C) form. The B2B browser tests are kept below as test.skip — "B2B disabled for now".
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

describe("Payment Links form (Individual / B2C) in a real browser", { skip: skipReason || false }, () => {
  let api;
  let vite;
  let browser;
  let page;
  let harnessUrl;
  const pageErrors = [];

  const getJson = async (route) => (await fetch(api.url + route)).json();
  const open = async () => {
    await page.setViewportSize({ width: 1300, height: 1400 });
    await page.goto(`${harnessUrl}/tests/e2e/paymentLinks/harness/index.html`);
    await page.waitForSelector(".pl-form");
  };
  const visible = (label) => page.locator(".pl-form").getByText(label, { exact: true }).first().isVisible();
  const fill = (placeholder, value) => page.locator(`.pl-form [placeholder="${placeholder}"]`).first().fill(value);
  const clientWillPay = async () => (await page.locator(".pl-preview > strong").innerText()).trim();
  const previewText = async () => (await page.locator(".pl-invoice-preview").innerText()).replace(/\s+/g, " ");

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

  test("only the Individual (B2C) form is offered: no Customer type toggle, no business fields", async () => {
    await open();
    assert.equal(await page.locator(".pl-seg").count(), 0, "no toggle");
    assert.equal(await page.locator('input[name="customerType"]').count(), 0, "no customer type radios");
    for (const gone of ["Customer type", "Individual (B2C)", "Business (B2B)", "Bill to", "Client name *"]) {
      assert.equal(await page.getByText(gone, { exact: true }).count(), 0, `${gone} is not shown`);
    }
    for (const shown of ["Customer", "Full name *", "Email *", "Services", "+ Add Item"]) assert.ok(await visible(shown), shown);
    for (const hidden of ["Company", "Personal number", "Country", "Postal code", "Address", "Payment terms", "Due date", "Issue as", "Notes (printed on the invoice)", "Items", "Quantity"]) {
      assert.equal(await page.locator(".pl-form").getByText(hidden, { exact: true }).count(), 0, `${hidden} is hidden`);
    }
    assert.equal(await page.locator(".pl-form select").count(), 0, "no terms / issue-as selects");
    assert.equal(await page.locator('.pl-form input[type="date"]').count(), 0, "no due date");
    assert.match(await page.locator(".pl-form").innerText(), /Due on Receipt/);
    assert.ok(await visible("Note"), "the internal note stays");
    assert.equal(await page.locator('.pl-form [aria-label="Quantity"]').count(), 0, "a service has no quantity field");
    assert.equal(await page.locator(".pl-primary").innerText(), "Generate Link & Invoice");
  });

  test("Total is the sum of the services, in the form and in the Client will pay card", async () => {
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
    for (const gone of ["Due date", "Subtotal", "Tax"]) assert.ok(!preview.includes(gone), `no "${gone}" in the preview`);
    await page.locator(".pl-item-row--service .pl-item-row__remove").nth(1).click();
    assert.equal(await clientWillPay(), "$75.00");
  });

  test("submitting sends customerType b2c, name, email and services with quantity 1, then shows the invoice box", async () => {
    await open();
    await fill("Rahul Mehta", "Rahul Mehta");
    await fill("name@gmail.com", "rahul@gmail.com");
    await fill("Tele Consultation", "Tele Consultation");
    await fill("0.00", "75");
    const [request] = await Promise.all([
      page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/api/payments/admin/payment-links")),
      page.locator(".pl-primary").click(),
    ]);
    assert.deepEqual(request.postDataJSON(), {
      customerType: "b2c",
      name: "Rahul Mehta",
      email: "rahul@gmail.com",
      note: "",
      currency: "USD",
      items: [{ description: "Tele Consultation", quantity: 1, amount: 75 }],
    });
    await page.waitForSelector(".pl-result");
    const result = await page.locator(".pl-invoice-box").innerText();
    assert.match(result, /HC\d{2}-\d{4}/);
    assert.match(result, /Due/);
    assert.match(result, /Email abhi nahi bheja gaya/);
    assert.equal(await page.locator(".pl-invoice-box").getByRole("button", { name: "Download PDF" }).count(), 1);
    assert.equal(await page.locator(".pl-invoice-box").getByRole("button", { name: "Send Email" }).count(), 1);
    assert.equal((await getJson("/__mails")).length, 0, "nothing is emailed by creating a link");
  });

  // The reported bug: "Each item needs a quantity greater than zero." The steps below go through the real
  // server-side validation (parseItems), so a missing quantity on a B2C service cannot slip through again.
  test("regression: Full name + Email + service 'tele consultation' 100 + Note 'na' creates the link and a Due invoice", async () => {
    await open();
    await fill("Rahul Mehta", "Rahul Mehta");
    await fill("name@gmail.com", "rahul@gmail.com");
    await fill("Tele Consultation", "tele consultation");
    await fill("0.00", "100");
    await fill("Optional internal note", "na");
    await page.locator(".pl-primary").click();
    await page.waitForSelector(".pl-result, .pl-error");
    assert.equal(await page.locator(".pl-error").count(), 0, `no error shown, got: ${await page.locator(".pl-error").allInnerTexts()}`);
    assert.match(await page.locator(".pl-result").innerText(), /\$100\.00/);
    const invoice = (await getJson("/__invoices")).find((i) => i.items?.[0]?.description === "tele consultation");
    assert.ok(invoice, "the invoice was stored");
    assert.equal(invoice.status, "due");
    assert.equal(invoice.customerType, "b2c");
    assert.deepEqual([invoice.items[0].quantity, invoice.items[0].rate, invoice.items[0].amountCents], [1, 100, 10000]);
  });

  test("regression: the server accepts a B2C service sent with no quantity, and ignores one that is sent", async () => {
    await open();
    const post = (items) =>
      page.evaluate(
        async (items) => {
          const res = await fetch("/api/payments/admin/payment-links", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ customerType: "b2c", name: "Asha Rao", email: "asha@example.com", currency: "USD", items }),
          });
          return { status: res.status, body: await res.json() };
        },
        items,
      );
    const noQuantity = await post([{ description: "no quantity key", amount: 40 }]);
    assert.equal(noQuantity.status, 201, JSON.stringify(noQuantity.body));
    assert.equal(noQuantity.body.invoice.status, "due");
    const fiveSent = await post([{ description: "five sent", quantity: 5, amount: 40 }]);
    assert.equal(fiveSent.status, 201);
    assert.equal(fiveSent.body.amountPaise, 4000);
    const stored = (await getJson("/__invoices")).find((i) => i.items?.[0]?.description === "five sent");
    assert.deepEqual([stored.items[0].quantity, stored.items[0].amountCents], [1, 4000]);
  });

  test("the server refuses a business (b2b) payment link while B2B is disabled", async () => {
    await open();
    const res = await page.evaluate(async () => {
      const r = await fetch("/api/payments/admin/payment-links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customerType: "b2b", name: "Nova", email: "n@example.com", currency: "USD", items: [{ description: "x", quantity: 1, rate: 5 }] }),
      });
      return { status: r.status, body: await r.json() };
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.msg, "Business payment links are not enabled yet.");
  });

  // ---- B2B disabled for now: these drive the Customer type toggle, which is commented out in PaymentLinks.jsx ----
  test.skip("B2B: switching to Business (B2B) shows the unchanged business form, and back again", async () => {
    await open();
    await page.locator(".pl-seg label", { hasText: "Business (B2B)" }).click();
    for (const shown of ["Bill to", "Client name *", "Company", "Personal number", "Country", "Postal code", "Address", "Payment terms", "Due date", "Issue as", "Items", "+ Add Item"]) {
      assert.ok(await visible(shown), shown);
    }
    assert.equal(await page.locator(".pl-form select:disabled").inputValue(), "due", "Issue as stays locked on Bill");
    await page.locator(".pl-seg label", { hasText: "Individual (B2C)" }).click();
    assert.ok(await visible("Services"));
  });

  test.skip("B2B: each customer type keeps its own entries when you switch", async () => {
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
