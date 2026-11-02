// Static check: the direct-call alerts bell is rendered only for admin and superadmin, never paymentadmin.
// Run: node --test tests/  (from frontend/). Reads source files only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const layout = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "pages", "admin", "AdminLayout.jsx"),
  "utf8",
);

test("DirectCallAlertsBell is gated to admin and superadmin", () => {
  const uses = layout.match(/<DirectCallAlertsBell\b/g) || [];
  assert.equal(uses.length, 1);
  assert.match(layout, /\["admin", "superadmin"\]\.includes\(user\.role\) && <DirectCallAlertsBell \/>/);
  assert.doesNotMatch(layout, /"paymentadmin"[^\n]*<DirectCallAlertsBell/);
});
