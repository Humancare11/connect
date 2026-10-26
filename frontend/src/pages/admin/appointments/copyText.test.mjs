import { test } from "node:test";
import assert from "node:assert/strict";
import { copyText } from "./copyText.js";

const ID = "64b000000000000000000001";

test("copies the text with the clipboard API", async () => {
  const written = [];
  const result = await copyText(ID, { clipboard: { writeText: async (t) => written.push(t) }, select: () => assert.fail("no fallback needed") });
  assert.equal(result, "copied");
  assert.deepEqual(written, [ID]);
});

test("when the clipboard API refuses, it selects the text and tries the old copy command", async () => {
  const log = [];
  const result = await copyText(ID, {
    clipboard: { writeText: async () => { throw new Error("NotAllowedError"); } },
    select: () => log.push("select"),
    execCopy: () => { log.push("exec"); return true; },
  });
  assert.equal(result, "copied");
  assert.deepEqual(log, ["select", "exec"]);
});

test("when nothing can copy, the text is left selected and the caller is told", async () => {
  const log = [];
  assert.equal(await copyText(ID, { clipboard: undefined, select: () => log.push("select"), execCopy: () => false }), "selected");
  assert.equal(await copyText(ID, { clipboard: {}, select: () => log.push("select"), execCopy: () => { throw new Error("no"); } }), "selected");
  assert.deepEqual(log, ["select", "select"]);
});

test("with no clipboard and no helpers at all it still answers instead of throwing", async () => {
  assert.equal(await copyText(ID, { clipboard: undefined }), "selected");
});
