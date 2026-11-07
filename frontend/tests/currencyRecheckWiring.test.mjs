// Wiring of the in-session currency re-check (the behaviour itself is in src/utils/currencyRecheck.test.mjs and the browser test
// tests/e2e/bookingFixes/currencyRecheck.e2e.test.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8").replace(/\r\n/g, "\n");

test("the route watcher is mounted once inside the router, next to the other route trackers", () => {
  const app = read("src", "App.jsx");
  assert.equal((app.match(/<CurrencyRouteWatcher \/>/g) || []).length, 1);
  assert.ok(app.includes('import { CurrencyRouteWatcher } from "./context/CurrencyContext"'));
});

test("the provider re-checks when the tab becomes visible and shows the notice for a change", () => {
  const src = read("src", "context", "CurrencyContext.jsx");
  assert.ok(src.includes('"visibilitychange"'));
  assert.ok(src.includes("currencyChangeNotice"));
  assert.ok(src.includes("recheck"));
});

test("every gateway call in the payment step asks the server for the current currency first, and checks what the server created", () => {
  const form = read("src", "pages", "AppointmentBookingForm.jsx");
  for (const call of ["/api/payments/create-intent-by-amount", "/api/paypal/create-order-by-amount", "/api/razorpay/create-order"]) {
    const at = form.indexOf(`api.post("${call}"`);
    assert.ok(at > 0, call);
    const before = form.slice(Math.max(0, at - 250), at);
    assert.ok(before.includes("currencyChangedBeforeCharge()"), `${call} is preceded by the forced re-check`);
    const after = form.slice(at, at + 250);
    assert.ok(after.includes("chargeMatchesScreen(res.data)"), `${call} result is compared with the screen`);
  }
});

test("the forced re-check skips the throttle and the routine one does not", () => {
  const form = read("src", "pages", "AppointmentBookingForm.jsx");
  assert.ok(form.includes("recheck({ force: true })"));
  const watcher = read("src", "context", "CurrencyContext.jsx");
  assert.ok(/recheck\(\);/.test(watcher));
});
