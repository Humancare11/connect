import { test } from "node:test";
import assert from "node:assert/strict";
import { IMAGE_TYPES, MAX_UPLOAD_BYTES, SIGNATURES_KEY, imageFileProblem, messageOf, startsTicked } from "./signatureUtils.js";

test("the query key is shared by the page and the compose boxes", () => {
  assert.deepEqual(SIGNATURES_KEY, ["email", "signatures"]);
});

test("the message is the whole box, trimmed: nothing is ever inserted into it", () => {
  assert.equal(messageOf("  Dear client,\nThank you. \n"), "Dear client,\nThank you.");
  assert.equal(messageOf(""), "");
  assert.equal(messageOf(null), "");
  assert.equal(messageOf("-- \nAnita"), "-- \nAnita");
});

test("'Add my signature' starts ticked only with an image and the automatic switch on", () => {
  const image = { width: 600, height: 150, bytes: 1000 };
  assert.equal(startsTicked({ image, autoAdd: true }), true);
  assert.equal(startsTicked({ image }), true);
  assert.equal(startsTicked({ image, autoAdd: false }), false);
  assert.equal(startsTicked({ image: null, autoAdd: true }), false);
  assert.equal(startsTicked(null), false);
  assert.equal(startsTicked(undefined), false);
});

test("a chosen file is checked before upload: PNG or JPG, up to 5 MB", () => {
  assert.deepEqual(IMAGE_TYPES, ["image/png", "image/jpeg"]);
  assert.equal(imageFileProblem({ type: "image/png", size: 1000 }), "");
  assert.equal(imageFileProblem({ type: "image/jpeg", size: MAX_UPLOAD_BYTES }), "");
  assert.match(imageFileProblem({ type: "image/svg+xml", size: 10 }), /PNG or JPG/);
  assert.match(imageFileProblem({ type: "image/gif", size: 10 }), /PNG or JPG/);
  assert.match(imageFileProblem({ type: "application/pdf", size: 10 }), /PNG or JPG/);
  assert.match(imageFileProblem({ type: "image/png", size: MAX_UPLOAD_BYTES + 1 }), /5 MB/);
  assert.match(imageFileProblem(null), /Choose/);
});
