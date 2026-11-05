// Bug 2, in real Chromium: "Get Help With" -> intake -> "Next Availability" -> sign in / sign up -> the booking page. The choice must
// still read "Next Availability" (not "—"), a chosen slot must survive too, Back must not land on the login page again, and the booking
// the server receives must be a Next Availability one.
//   npm run test:e2e:booking-fixes   (from frontend/)
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { startStack, skipReason, futureDate } from "./stack.mjs";

describe("Next Availability survives sign-in (real browser)", { skip: skipReason || false }, () => {
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

  async function fillIntake(page) {
    await page.goto(`${stack.origin}/category-consultant?category=general&condition=Acne`);
    await page.locator("#hc-concern-input").fill("Itchy rash on both arms for a week");
    await page.getByRole("radio", { name: /Mild/ }).click();
    await page.getByRole("radio", { name: /Prescription/ }).click();
    await page.getByRole("button", { name: /Continue/ }).click();
    await page.locator("#hc-date-input").fill(futureDate());
  }

  async function signIn(page) {
    await page.locator("#patient-login-email").fill("patient@e2e.test");
    await page.locator("#patient-login-password").fill("Placeholder1!");
    await page.locator("form.hc-login-form button[type=submit]").click();
  }

  const preferredTime = (page) => page.locator(".ap-pay-summary-row", { hasText: "Preferred time" }).locator("strong");

  test("Next Availability is shown on the booking page after sign-in, and Back does not return to the login page", async () => {
    const { page, context, errors } = await stack.newPage();
    await fillIntake(page);
    await page.getByRole("radio", { name: /Next Availability/ }).click();
    await page.getByRole("button", { name: "Book Appointment" }).click();
    await page.waitForURL(/\/login$/);

    await signIn(page);
    await page.waitForURL(/\/appointment-booking\/category-confirm$/);
    await page.getByRole("heading", { name: "Confirm Your Appointment" }).waitFor();
    assert.equal((await preferredTime(page).innerText()).trim(), "Next Availability");

    // Back leaves the booking page without passing through the login form
    await page.goBack();
    await page.waitForURL(/\/category-consultant/);
    assert.ok(!page.url().includes("/login"));
    assert.deepEqual(errors, []);
    await context.close();
  });

  test("a chosen time slot is kept across sign-in and shown as picked", async () => {
    const { page, context } = await stack.newPage();
    await fillIntake(page);
    await page.getByRole("radio", { name: /Flexible/ }).click();
    await page.getByRole("button", { name: /Morning/ }).click();
    await page.locator(".hc-slot:not(.is-disabled)").first().click();
    const slot = (await page.locator(".hc-slot.is-active").first().innerText()).trim();
    await page.getByRole("button", { name: "Book Appointment" }).click();
    await page.waitForURL(/\/login$/);
    await signIn(page);
    await page.waitForURL(/\/appointment-booking\/category-confirm$/);
    assert.equal((await preferredTime(page).innerText()).trim(), slot);
    await context.close();
  });

  test("the booking created for a Next Availability choice carries no slot and the date picked", async () => {
    const { page, context } = await stack.newPage();
    await fillIntake(page);
    await page.getByRole("radio", { name: /Next Availability/ }).click();
    await page.getByRole("button", { name: "Book Appointment" }).click();
    await page.waitForURL(/\/login$/);
    await signIn(page);
    await page.waitForURL(/\/appointment-booking\/category-confirm$/);
    await page.getByRole("button", { name: /Proceed to Payment/ }).click();
    await page.locator("#consent-agree").check();
    await page.locator("#consent-age").check();
    await page.getByRole("button", { name: /Confirm & Continue/ }).click();
    // the payment summary says the same thing
    await page.locator(".ap-pay-summary-row", { hasText: "Time" }).getByText("Next Availability").waitFor();
    await page.locator(".ap-pay-method-btn").first().click();
    await page.getByTestId("stub-payment-element").waitFor();
    await page.locator("form.ap-pay-form button[type=submit]").click();
    await page.getByText("Appointment Requested!").waitFor();
    const { consultations } = await stack.state();
    assert.equal(consultations.length, 1);
    assert.equal(consultations[0].urgency, "next");
    assert.equal(consultations[0].slot, "");
    assert.equal(consultations[0].date, futureDate());
    await context.close();
  });
});
