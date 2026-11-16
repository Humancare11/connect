import test from "node:test";
import assert from "node:assert/strict";
import { showsFirstViewed } from "./folderRules.js";

test("first viewed by: Received and Spam only", () => {
  assert.equal(showsFirstViewed("inbox"), true);
  assert.equal(showsFirstViewed("spam"), true);
  assert.equal(showsFirstViewed("sent"), false);
  assert.equal(showsFirstViewed("all"), false);
});
