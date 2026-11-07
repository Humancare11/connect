// Both booking flows list the files a patient attached with the same component (the browser behaviour is in
// tests/e2e/bookingFixes/reportUploads.e2e.test.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8").replace(/\r\n/g, "\n");

test("the header form and the Get Help With confirm page both render ReportFileList, and neither keeps its own list markup", () => {
  const form = read("src", "pages", "AppointmentBookingForm.jsx");
  const confirm = read("src", "pages", "CategoryAppointmentConfirm.jsx");
  assert.ok(form.includes("<ReportFileList files={form.files} onRemove={removeFile} />"));
  assert.ok(confirm.includes("<ReportFileList files={reports} onRemove={removeReport} uploaded />"));
  for (const src of [form, confirm]) assert.equal(src.includes('className="ap-report-list"'), false);
});

test("the confirm page shows why an upload failed on the details step, not only from the payment step on", () => {
  const confirm = read("src", "pages", "CategoryAppointmentConfirm.jsx");
  assert.ok(confirm.includes("setUploadErr("));
  assert.ok(/\{uploadErr && \(\n\s+<p role="alert" className="ap-error">/.test(confirm));
});
