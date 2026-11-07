// The visitor's IP can change while a tab stays open: the currency is re-checked during the session (route change, tab visible again,
// and right before a payment is created). See createCurrencyLoader().recheck.
import test from "node:test";
import assert from "node:assert/strict";
import { createCurrencyLoader, RECHECK_MIN_INTERVAL_MS, CURRENCY_CACHE_KEY } from "./currencyLoader.js";
import { currencyChangeNotice } from "./currencyDisplay.js";

const ip = (currency) => ({ currency, country: "XX", source: "ip" });
const memoryStorage = () => {
  const data = {};
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data };
};

async function loaded(answers, opts = {}) {
  const queue = [...answers];
  const clock = { t: 1_000_000 };
  const seen = [];
  const changes = [];
  let calls = 0;
  const loader = createCurrencyLoader({
    fetchCurrency: async () => {
      calls += 1;
      const next = queue.length > 1 ? queue.shift() : queue[0];
      if (next instanceof Error) throw next;
      return next;
    },
    onChange: (s) => seen.push(s),
    onCurrencyChanged: (c) => changes.push(c),
    now: () => clock.t,
    warn: () => {},
    storage: memoryStorage(),
    identity: "ip",
    ...opts,
  });
  await loader.load();
  return { loader, seen, changes, clock, calls: () => calls, setNext: (a) => queue.splice(0, queue.length, ...a) };
}

test("route change: the IP moved from the US to the UK, the next re-check switches every price to GBP and says so once", async () => {
  const t = await loaded([ip("USD")]);
  assert.equal(t.loader.getState().currency, "USD");
  t.setNext([ip("GBP")]);
  t.clock.t += RECHECK_MIN_INTERVAL_MS + 1;
  const result = await t.loader.recheck();
  assert.equal(result.changed, true);
  assert.equal(result.currency, "GBP");
  assert.equal(t.loader.getState().currency, "GBP");
  assert.equal(t.loader.getState().loading, false);
  assert.deepEqual(t.changes, [{ from: "USD", to: "GBP" }]);
});

test("the answer remembered for the session follows the change", async () => {
  const storage = memoryStorage();
  const t = await loaded([ip("USD")], { storage });
  t.setNext([ip("EUR")]);
  t.clock.t += RECHECK_MIN_INTERVAL_MS + 1;
  await t.loader.recheck();
  assert.equal(JSON.parse(storage.data[CURRENCY_CACHE_KEY]).currency, "EUR");
});

test("routine re-checks are throttled: many route changes inside the interval ask the server once", async () => {
  const t = await loaded([ip("USD")]);
  const afterLoad = t.calls();
  t.clock.t += RECHECK_MIN_INTERVAL_MS + 1;
  await t.loader.recheck();
  await t.loader.recheck();
  t.clock.t += 5000;
  await t.loader.recheck();
  assert.equal(t.calls(), afterLoad + 1);
  t.clock.t += RECHECK_MIN_INTERVAL_MS;
  await t.loader.recheck();
  assert.equal(t.calls(), afterLoad + 2);
});

test("a re-check made while another is in flight shares it", async () => {
  const t = await loaded([ip("USD")]);
  const afterLoad = t.calls();
  t.clock.t += RECHECK_MIN_INTERVAL_MS + 1;
  const [a, b] = await Promise.all([t.loader.recheck(), t.loader.recheck({ force: true })]);
  assert.equal(t.calls(), afterLoad + 1);
  assert.equal(a.changed, b.changed);
});

test("before a payment the throttle is skipped (force), so a change a few seconds ago is still caught", async () => {
  const t = await loaded([ip("USD")]);
  t.clock.t += RECHECK_MIN_INTERVAL_MS + 1;
  await t.loader.recheck(); // routine check just done, still USD
  t.setNext([ip("INR")]);
  t.clock.t += 2000;
  assert.equal((await t.loader.recheck()).skipped, true); // throttled
  assert.equal(t.loader.getState().currency, "USD");
  const forced = await t.loader.recheck({ force: true });
  assert.equal(forced.changed, true);
  assert.equal(t.loader.getState().currency, "INR");
});

test("a failed re-check (network, 429, 5xx, source error) never changes the currency", async () => {
  const t = await loaded([ip("GBP")]);
  for (const failure of [new Error("network down"), Object.assign(new Error("429"), { response: { status: 429 } }), { currency: "USD", source: "error" }]) {
    t.setNext([failure]);
    const result = await t.loader.recheck({ force: true });
    assert.equal(result.changed, false);
    assert.equal(result.ok, false);
    assert.equal(t.loader.getState().currency, "GBP");
  }
  assert.deepEqual(t.changes, []);
});

test("a routine re-check follows a 'default' answer too (the server could not place the new IP and will charge USD), same as a payment-time check", async () => {
  const storage = memoryStorage();
  const t = await loaded([ip("GBP")], { storage });
  t.setNext([{ currency: "USD", source: "default" }]);
  t.clock.t += RECHECK_MIN_INTERVAL_MS + 1;
  const routine = await t.loader.recheck();
  assert.equal(routine.changed, true);
  assert.equal(t.loader.getState().currency, "USD");
  assert.equal(t.changes.length, 1);
  // the unplaced answer is shown but never remembered as the visitor's currency
  assert.equal(JSON.parse(storage.data[CURRENCY_CACHE_KEY]).currency, "GBP");
});

test("no re-check while the first load is still deciding, and none after dispose", async () => {
  let resolve;
  const loader = createCurrencyLoader({ fetchCurrency: () => new Promise((r) => { resolve = r; }), onChange: () => {}, warn: () => {} });
  const first = loader.load();
  assert.equal((await loader.recheck({ force: true })).skipped, true);
  resolve(ip("EUR"));
  await first;
  loader.dispose();
  assert.equal((await loader.recheck({ force: true })).skipped, true);
});

test("an unchanged answer reports no change and shows no notice", async () => {
  const t = await loaded([ip("EUR")]);
  t.clock.t += RECHECK_MIN_INTERVAL_MS + 1;
  const r = await t.loader.recheck();
  assert.equal(r.changed, false);
  assert.equal(r.ok, true);
  assert.deepEqual(t.changes, []);
});

test("the notice names the symbol and the code", () => {
  assert.equal(currencyChangeNotice("GBP"), "Prices updated to your current location (£ GBP)");
  assert.equal(currencyChangeNotice("INR"), "Prices updated to your current location (₹ INR)");
});
