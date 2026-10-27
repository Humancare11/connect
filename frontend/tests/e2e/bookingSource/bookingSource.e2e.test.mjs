// Browser-level test of the booking source: the REAL Header, a REAL condition page (PCOS), the REAL booking form and the REAL
// createAppointment code, in real Chromium over a throwaway in-memory MongoDB (see apiServer.mjs). Only the payment is
// stubbed (Stripe/PayPal are replaced by stand-ins that always succeed), the picker page between the header and the
// form is a small stand-in, and there is no login.
//   npm run test:e2e:booking-source   (from frontend/)
// The test skips itself when Chromium (or Chrome/Edge) or the backend's dependencies are not installed.
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { findBrowser } from "../adminAppointments/helpers.mjs";
import { resolvePage } from "../../../src/utils/pageIdentity.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, "..", "..", "..");
const harness = (file) => path.join(here, "harness", file);
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

const PCOS_ROUTE = "/women-health/obstetrics-and-gynaecology/pcos";
const FORM_ROUTE = "/appointment-booking/women-s-health/obstetrics-and-gynaecology/pcos";
const PCOS_TITLE = resolvePage(PCOS_ROUTE).name;

// Every non-file, non-API GET gets the harness page, so BrowserRouter URLs like /women-health/... work on reload.
const spaFallback = () => ({
  name: "booking-source-spa-fallback",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = req.url || "";
      const wantsHtml = req.method === "GET" && String(req.headers.accept || "").includes("text/html");
      if (wantsHtml && !url.startsWith("/api") && !url.startsWith("/@") && !url.startsWith("/tests/") && !/\.[a-z0-9]+(\?|$)/i.test(url)) {
        req.url = "/tests/e2e/bookingSource/harness/index.html";
      }
      next();
    });
  },
});

describe("booking source in a real browser", { skip: skipReason || false }, () => {
  let api;
  let vite;
  let browser;
  let origin;
  const pageErrors = [];

  before(async () => {
    api = await startApiServer();
    vite = await createServer({
      configFile: false,
      root: frontendRoot,
      logLevel: "silent",
      plugins: [reactPlugin(), spaFallback()],
      define: {
        "import.meta.env.VITE_API_URL": JSON.stringify(""),
        "import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY": JSON.stringify("pk_test_stub"),
      },
      resolve: {
        alias: [
          { find: "@stripe/stripe-js", replacement: harness("stripe-js.js") },
          { find: "@stripe/react-stripe-js", replacement: harness("react-stripe-js.jsx") },
          { find: "@paypal/react-paypal-js", replacement: harness("paypal.jsx") },
        ],
      },
      server: {
        port: 0,
        host: "127.0.0.1",
        fs: { allow: [path.resolve(frontendRoot, "..")] },
        proxy: { "/api": { target: api.url, changeOrigin: false } },
      },
      optimizeDeps: { entries: ["tests/e2e/bookingSource/harness/index.html"] },
    });
    await vite.listen();
    origin = vite.resolvedUrls.local[0].replace(/\/$/, "");
    browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
  });

  after(async () => {
    await browser?.close();
    await vite?.close();
    await api?.close();
  });

  beforeEach(async () => {
    await fetch(`${api.url}/__reset`, { method: "POST" });
    pageErrors.length = 0;
  });

  const bookings = async () => (await fetch(`${api.url}/__bookings`)).json();

  const newPage = async ({ blockStorage = false } = {}) => {
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    if (blockStorage) {
      // localStorage that throws on every access, like a locked-down browser.
      await context.addInitScript(() => {
        Object.defineProperty(window, "localStorage", { get() { throw new DOMException("blocked", "SecurityError"); }, configurable: true });
      });
    }
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    return { page, context };
  };

  // The real form: date, time slot, problem, consent, Stripe (stub), pay.
  async function completeBooking(page) {
    const date = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    await page.locator("input.ap-date-input").fill(date);
    await page.locator(".ap-slot--available").first().click();
    await page.locator("textarea.ap-textarea").last().fill("Irregular periods for three months");
    await page.getByRole("button", { name: /Proceed to Payment/ }).click();
    await page.locator("#consent-agree").check();
    await page.locator("#consent-age").check();
    await page.getByRole("button", { name: /Confirm & Continue/ }).click();
    await page.locator(".ap-pay-method-btn").first().click();
    await page.getByTestId("stub-payment-element").waitFor();
    await page.locator("form.ap-pay-form button[type=submit]").click();
    const until = Date.now() + 15000;
    while (Date.now() < until) {
      const list = await bookings();
      if (list.length) return list;
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error("the booking was not created");
  }

  test("the condition page resolves to Condition: PCOS", () => {
    assert.deepEqual(resolvePage(PCOS_ROUTE).type, "condition");
    assert.equal(PCOS_TITLE, "PCOS");
  });

  test("header Book Appointment on a condition page: the saved booking says header / Book Appointment / on Condition: PCOS", async () => {
    const { page, context } = await newPage();
    await page.goto(origin + PCOS_ROUTE);
    await page.locator("nav.nav-menu a.nav-item", { hasText: "Book Appointment" }).click();
    await page.waitForURL("**/appointment-booking");
    await page.locator("#pick-pcos").click(); // the picker's navigate() to the form
    await page.waitForURL("**" + FORM_ROUTE);

    const saved = await completeBooking(page);
    assert.equal(saved.length, 1);
    const { source } = saved[0];
    assert.equal(source.platform, "web", "the server worked out the platform from the browser's headers");
    assert.equal(source.sourceType, "header");
    assert.equal(source.sourceName, "Book Appointment");
    assert.equal(source.clickedOnType, "condition");
    assert.equal(source.clickedOnName, PCOS_TITLE);
    assert.equal(source.pagePath, PCOS_ROUTE);
    assert.equal(source.appVersion, "");
    assert.ok(source.capturedAt);
    assert.equal(saved[0].paymentStatus, "paid");
    assert.deepEqual(pageErrors, []);
    await context.close();
  });

  test("a campaign landing is kept: utm and an outside referrer arrive on the booking", async () => {
    const { page, context } = await newPage();
    // The patient arrives by clicking an advert on another site, so the browser sets document.referrer for real.
    const landing = `${origin}${PCOS_ROUTE}?utm_source=google&utm_medium=cpc&utm_campaign=spring&gclid=abc123`;
    await page.route("http://ads.example.test/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: `<meta name="referrer" content="unsafe-url"><a id="go" href="${landing}">advert</a>` })
    );
    await page.goto("http://ads.example.test/post?q=pcos&token=abc");
    await page.locator("#go").click();
    await page.waitForURL("**" + PCOS_ROUTE + "**");
    await page.locator("nav.nav-menu a.nav-item", { hasText: "Book Appointment" }).click();
    await page.waitForURL("**/appointment-booking");
    await page.locator("#pick-pcos").click();
    await page.waitForURL("**" + FORM_ROUTE);
    const [saved] = await completeBooking(page);
    assert.deepEqual(saved.source.utm, { source: "google", medium: "cpc", campaign: "spring" });
    assert.equal(saved.source.referrer, "ads.example.test/post", "host and path only: no query string");
    assert.equal(saved.source.pagePath, PCOS_ROUTE, "the query string is not kept");
    await context.close();
  });

  test("storage blocked in the browser: the booking still goes through, with the source kept in memory", async () => {
    const { page, context } = await newPage({ blockStorage: true });
    await page.goto(origin + PCOS_ROUTE);
    await page.locator("nav.nav-menu a.nav-item", { hasText: "Book Appointment" }).click();
    await page.waitForURL("**/appointment-booking");
    await page.locator("#pick-pcos").click();
    await page.waitForURL("**" + FORM_ROUTE);
    const [saved] = await completeBooking(page);
    assert.equal(saved.source.sourceType, "header");
    assert.equal(saved.source.clickedOnName, PCOS_TITLE);
    await context.close();
  });

  test("opening the booking form directly (no click) is saved as direct, and the booking is not affected", async () => {
    const { page, context } = await newPage();
    await page.goto(origin + FORM_ROUTE);
    const [saved] = await completeBooking(page);
    assert.equal(saved.source.platform, "web");
    assert.equal(saved.source.sourceType, "direct");
    assert.equal(saved.source.sourceName, "");
    assert.equal(saved.paymentStatus, "paid");
    await context.close();
  });

  test("the click handler is attached once, however many pages the patient moves through", async () => {
    const { page, context } = await newPage();
    await page.goto(origin + PCOS_ROUTE);
    await page.evaluate(() => {
      window.__clicks = 0;
      const real = document.addEventListener.bind(document);
      document.addEventListener = (type, ...rest) => { if (type === "click") window.__clicks += 1; return real(type, ...rest); };
    });
    await page.locator("nav.nav-menu a.nav-item", { hasText: "Book Appointment" }).click();
    await page.waitForURL("**/appointment-booking");
    await page.locator("#pick-pcos").click();
    await page.waitForURL("**" + FORM_ROUTE);
    assert.equal(await page.evaluate(() => window.__clicks), 0, "no new document click listener after route changes");
    await context.close();
  });
});
