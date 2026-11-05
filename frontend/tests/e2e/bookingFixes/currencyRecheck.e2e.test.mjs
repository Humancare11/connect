// Bug 1, in real Chromium: the visitor's IP country changes while the tab stays open (a VPN). The currency must follow it on the next
// route change (throttled), and ALWAYS right before a payment is created; the notice says so; a failed re-check changes nothing.
//   npm run test:e2e:booking-fixes   (from frontend/)
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { startStack, skipReason, futureDate, generalSelection } from "./stack.mjs";

describe("currency follows the IP during a session (real browser)", { skip: skipReason || false }, () => {
  let stack;
  before(async () => {
    stack = await startStack();
  }, { timeout: 180000 });
  after(async () => {
    await stack?.close();
  });
  beforeEach(async () => {
    await stack.reset();
  });

  const seedPending = (page) =>
    page.evaluate(
      ([selection, date]) => {
        sessionStorage.setItem(
          "hcc_booking_pending",
          JSON.stringify({ selection, formData: { concern: "Headache", duration: "", severity: "mild", supportType: "diagnosis", urgency: "next", timeWindow: "", slot: "", date } }),
        );
      },
      [generalSelection(), futureDate()],
    );

  async function toPaymentStep(page) {
    await page.getByRole("button", { name: /Proceed to Payment/ }).click();
    await page.locator("#consent-agree").check();
    await page.locator("#consent-age").check();
    await page.getByRole("button", { name: /Confirm & Continue/ }).click();
    await page.locator(".ap-pay-method-btn").first().waitFor();
  }

  test("route change: USD, then the IP moves to the UK, and the next page shows GBP with a notice", async () => {
    const { page, context, errors } = await stack.newPage();
    await page.clock.install();
    await page.goto(`${stack.origin}/`);
    await page.locator("#home-price").getByText("$49").waitFor();
    await stack.set({ geo: "GB" });
    // inside the throttle window the route change does not ask again
    const before = (await stack.state()).geoCalls;
    await page.locator("#to-other").click();
    await page.locator("#other").waitFor();
    assert.equal((await stack.state()).geoCalls, before, "no re-check inside the 20 s window");
    assert.match(await page.locator("#other-price").innerText(), /\$49/);
    await page.clock.fastForward(25000);
    await page.locator("#to-home").click();
    await page.locator("#home-price").getByText("£39").waitFor();
    assert.match(await page.getByTestId("currency-change-notice").innerText(), /Prices updated to your current location \(£ GBP\)/);
    assert.deepEqual(errors, []);
    await context.close();
  });

  test("a failed re-check keeps the currency (no price flips to USD, no notice)", async () => {
    const { page, context } = await stack.newPage();
    await page.clock.install();
    await page.goto(`${stack.origin}/`);
    await page.locator("#home-price").getByText("$49").waitFor();
    await stack.set({ geo: "GB", geoFails: true });
    await page.clock.fastForward(25000);
    await page.locator("#to-other").click();
    await page.locator("#other").waitFor();
    await page.waitForTimeout(300);
    assert.match(await page.locator("#other-price").innerText(), /\$49/);
    assert.equal(await page.getByTestId("currency-change-notice").count(), 0);
    await context.close();
  });

  test("the tab becoming visible again re-checks (throttled)", async () => {
    const { page, context } = await stack.newPage();
    await page.clock.install();
    await page.goto(`${stack.origin}/`);
    await page.locator("#home-price").getByText("$49").waitFor();
    await stack.set({ geo: "DE" });
    await page.clock.fastForward(25000);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.locator("#home-price").getByText("€45").waitFor();
    await context.close();
  });

  test("payment step: the IP changed after the page loaded, so the intent is never created in the old currency", async () => {
    const { page, context, errors } = await stack.newPage();
    await stack.set({ loggedIn: true });
    await page.goto(`${stack.origin}/`);
    await page.locator("#home-price").getByText("$49").waitFor();
    await seedPending(page);
    await page.goto(`${stack.origin}/appointment-booking/category-confirm`);
    await toPaymentStep(page);
    assert.match(await page.locator(".ap-pay-fee-amount").innerText(), /\$49/);

    await stack.set({ geo: "GB" }); // VPN switched; no route change, no refresh
    await page.locator(".ap-pay-method-btn").first().click(); // "Credit / Debit Card"
    await page.locator(".ap-pay-fee-amount").getByText("£39").waitFor();
    assert.deepEqual((await stack.state()).intents, [], "nothing was created at the gateway for the old currency");
    assert.match(await page.getByTestId("currency-change-notice").innerText(), /£ GBP/);

    // the step started over in GBP: choosing the card now creates a GBP intent for exactly the price on screen
    await page.locator(".ap-pay-method-btn").first().click();
    await page.getByTestId("stub-payment-element").waitFor();
    const { intents } = await stack.state();
    assert.equal(intents.length, 1);
    assert.equal(intents[0].currency, "GBP");
    assert.equal(intents[0].amountCents, 3900);
    assert.match(await page.locator("form.ap-pay-form button[type=submit]").innerText(), /£39/);
    assert.deepEqual(errors, []);
    await context.close();
  });

  test("payment step: the visitor moved to India, so the card buttons are replaced by Razorpay", async () => {
    const { page, context } = await stack.newPage();
    await stack.set({ loggedIn: true });
    await page.goto(`${stack.origin}/`);
    await page.locator("#home-price").getByText("$49").waitFor();
    await seedPending(page);
    await page.goto(`${stack.origin}/appointment-booking/category-confirm`);
    await toPaymentStep(page);
    await stack.set({ geo: "IN" });
    await page.locator(".ap-pay-method-btn").first().click();
    await page.getByText(/with Razorpay/).waitFor();
    assert.deepEqual((await stack.state()).intents, []);
    await context.close();
  });

  test("payment step with the server down: the booking is not blocked and the screen keeps its currency", async () => {
    const { page, context } = await stack.newPage();
    await stack.set({ loggedIn: true });
    await page.goto(`${stack.origin}/`);
    await page.locator("#home-price").getByText("$49").waitFor();
    await seedPending(page);
    await page.goto(`${stack.origin}/appointment-booking/category-confirm`);
    await toPaymentStep(page);
    await stack.set({ geoFails: true });
    await page.locator(".ap-pay-method-btn").first().click();
    await page.getByTestId("stub-payment-element").waitFor();
    assert.equal((await stack.state()).intents[0].currency, "USD");
    await context.close();
  });
});
