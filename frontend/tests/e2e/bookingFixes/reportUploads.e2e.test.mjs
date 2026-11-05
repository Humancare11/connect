// Bug 3, in real Chromium: a file uploaded for the doctor must be listed (name, size, remove button) in BOTH booking flows - the
// "Get Help With" page (CategoryAppointmentConfirm) and the header "Book Appointment" form - and must be sent with the booking.
// The uploads go to the stand-in API's presign + PUT endpoints (real S3 is not available in tests).
//   npm run test:e2e:booking-fixes   (from frontend/)
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { startStack, skipReason, futureDate, generalSelection } from "./stack.mjs";

const FILE = { name: "blood-test.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test report") };
const SECOND = { name: "xray.png", mimeType: "image/png", buffer: Buffer.from("png-bytes") };

describe("uploaded files are listed in both booking flows (real browser)", { skip: skipReason || false }, () => {
  let stack;
  before(async () => {
    stack = await startStack();
  }, { timeout: 180000 });
  after(async () => {
    await stack?.close();
  });
  beforeEach(async () => {
    await stack.reset();
    await stack.set({ loggedIn: true });
  });

  async function openConfirm(page) {
    await page.goto(`${stack.origin}/`);
    await page.evaluate(
      ([selection, date]) => {
        sessionStorage.setItem(
          "hcc_booking_pending",
          JSON.stringify({ selection, formData: { concern: "Headache", duration: "", severity: "mild", supportType: "diagnosis", urgency: "next", timeWindow: "", slot: "", date } }),
        );
      },
      [generalSelection(), futureDate()],
    );
    await page.goto(`${stack.origin}/appointment-booking/category-confirm`);
    await page.getByRole("heading", { name: "Confirm Your Appointment" }).waitFor();
  }

  test("Get Help With flow: the uploaded file is listed with its name and size, can be removed, and goes with the booking", async () => {
    const { page, context, errors } = await stack.newPage();
    await openConfirm(page);
    await page.locator("input[type=file]").setInputFiles([FILE, SECOND]);
    const names = page.locator(".ap-report-item .ap-report-name");
    await names.first().waitFor();
    assert.deepEqual(await names.allInnerTexts(), ["blood-test.pdf", "xray.png"]);
    assert.equal((await stack.state()).uploads.length, 2, "both files reached the storage");
    assert.equal(await page.locator(".ap-report-item .ap-report-size").count(), 2);
    assert.equal(await page.locator(".ap-report-item .ap-report-uploaded").count(), 2, "each uploaded file shows the success tick");

    await page.locator(".ap-report-item .ap-report-remove").nth(1).click(); // remove xray.png
    assert.deepEqual(await names.allInnerTexts(), ["blood-test.pdf"]);

    await page.getByRole("button", { name: /Proceed to Payment/ }).click();
    await page.locator("#consent-agree").check();
    await page.locator("#consent-age").check();
    await page.getByRole("button", { name: /Confirm & Continue/ }).click();
    await page.locator(".ap-pay-method-btn").first().click();
    await page.getByTestId("stub-payment-element").waitFor();
    await page.locator("form.ap-pay-form button[type=submit]").click();
    await page.getByText("Appointment Requested!").waitFor();
    const { consultations } = await stack.state();
    assert.equal(consultations.length, 1);
    assert.equal(consultations[0].medicalReports.length, 1);
    assert.equal(consultations[0].medicalReports[0].name, "blood-test.pdf");
    assert.match(consultations[0].medicalReports[0].url, /^https:\/\/s3\.stub\/uploads\//);
    assert.deepEqual(errors, []);
    await context.close();
  });

  test("Get Help With flow: a failed upload says so on the page", async () => {
    const { page, context } = await stack.newPage();
    await openConfirm(page);
    await page.route("**/api/upload/presign", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ msg: "Could not prepare direct upload." }) }));
    await page.route("**/api/upload", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ msg: "File could not be stored." }) }));
    await page.locator("input[type=file]").setInputFiles(FILE);
    await page.getByRole("alert").getByText(/Failed to upload "blood-test.pdf"/).waitFor();
    assert.equal(await page.locator(".ap-report-item").count(), 0);
    // a good upload afterwards clears the message and lists the file
    await page.unroute("**/api/upload/presign");
    await page.locator("input[type=file]").setInputFiles(FILE);
    await page.locator(".ap-report-item .ap-report-name").getByText("blood-test.pdf").waitFor();
    assert.equal(await page.getByRole("alert").count(), 0);
    await context.close();
  });

  test("header Book Appointment flow: the chosen file is listed the same way", async () => {
    const { page, context } = await stack.newPage();
    await page.goto(`${stack.origin}/appointment-booking/women-s-health/obstetrics-and-gynaecology/pcos`);
    await page.locator("input[type=file]").setInputFiles(FILE);
    const names = page.locator(".ap-report-item .ap-report-name");
    await names.first().waitFor();
    assert.deepEqual(await names.allInnerTexts(), ["blood-test.pdf"]);
    assert.equal(await page.locator(".ap-report-item .ap-report-remove").count(), 1);
    await context.close();
  });
});
