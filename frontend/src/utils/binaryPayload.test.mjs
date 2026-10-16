import { test } from "node:test";
import assert from "node:assert/strict";
import { describeBlobError, isBinaryPayload } from "./binaryPayload.js";

test("blobs and buffers are binary, JSON values are not", () => {
  assert.equal(isBinaryPayload(new Blob(["x"])), true);
  assert.equal(isBinaryPayload(new ArrayBuffer(2)), true);
  assert.equal(isBinaryPayload(new Uint8Array(2)), true);
  assert.equal(isBinaryPayload({ a: 1 }), false);
  assert.equal(isBinaryPayload([1]), false);
  assert.equal(isBinaryPayload("text"), false);
  assert.equal(isBinaryPayload(null), false);
});

const blobErr = (status, statusText, body) => ({ response: { status, statusText, data: new Blob([body]) } });

test("shows the server message and the HTTP status", async () => {
  assert.equal(await describeBlobError(blobErr(403, "Forbidden", JSON.stringify({ msg: "Access denied. Super Admin only." }))), "Access denied. Super Admin only. (HTTP 403 Forbidden)");
});

test("an HTML proxy page falls back to the generic text plus the status", async () => {
  assert.equal(await describeBlobError(blobErr(502, "Bad Gateway", "<html>502</html>")), "Download failed. Please try again. (HTTP 502 Bad Gateway)");
});

test("no response (network / CORS) says so", async () => {
  assert.equal(await describeBlobError({ message: "Network Error" }), "Download failed. Please try again. (Network Error)");
});
