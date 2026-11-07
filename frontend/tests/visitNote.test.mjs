// Visit Note helpers. Run from frontend/:  node --test tests/visitNote.test.mjs
import test from "node:test";
import assert from "node:assert/strict";

import { validateSignatureFile, missingRequired, pickFields, MAX_SIGNATURE_BYTES } from "../src/utils/visitNote.js";

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const png = (name = "sig.png", type = "image/png", extra = 20) =>
  new File([new Uint8Array([...PNG_HEAD, ...new Array(extra).fill(0)])], name, { type });

test("accepts a PNG with the right type, extension and magic bytes", async () => {
  assert.equal(await validateSignatureFile(png()), "");
});

test("rejects a missing file, wrong MIME, wrong extension", async () => {
  assert.match(await validateSignatureFile(null), /choose/i);
  assert.match(await validateSignatureFile(png("sig.png", "image/jpeg")), /PNG/);
  assert.match(await validateSignatureFile(png("sig.jpg")), /\.png/);
});

test("rejects a file that claims to be PNG but has other bytes", async () => {
  const fake = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6])], "sig.png", { type: "image/png" });
  assert.match(await validateSignatureFile(fake), /not a valid PNG/);
});

test("rejects more than 1 MB", async () => {
  const big = new File([new Uint8Array(MAX_SIGNATURE_BYTES + 1)], "sig.png", { type: "image/png" });
  assert.match(await validateSignatureFile(big), /1 MB/);
});

test("required fields are Symptoms, Clinical Findings and Plan; Note is optional", () => {
  assert.deepEqual(missingRequired({ symptoms: "a", clinicalFindings: " ", plan: "", note: "" }), ["clinicalFindings", "plan"]);
  assert.deepEqual(missingRequired({ symptoms: "a", clinicalFindings: "b", plan: "c", note: "" }), []);
  assert.deepEqual(pickFields(null), { symptoms: "", clinicalFindings: "", plan: "", note: "" });
});
