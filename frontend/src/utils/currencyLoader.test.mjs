import test from "node:test";
import assert from "node:assert/strict";
import { createCurrencyLoader } from "./currencyLoader.js";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const flush = () => new Promise((r) => setImmediate(r));

function setup(fetches) {
  const seen = [];
  let i = 0;
  const loader = createCurrencyLoader({ fetchCurrency: () => fetches[i++].promise, onChange: (s) => seen.push(s) });
  return { loader, seen, calls: () => i };
}

test("starts loading (a skeleton), then shows the server currency", async () => {
  const a = deferred();
  const { loader, seen } = setup([a]);
  assert.equal(loader.getState().loading, true);
  loader.load();
  a.resolve({ currency: "EUR", source: "profile" });
  await flush();
  assert.deepEqual(loader.getState(), { currency: "EUR", loading: false, source: "profile" });
  assert.equal(seen.at(-1).currency, "EUR");
});

test("a failed request means USD, not an error and not a stuck skeleton", async () => {
  const a = deferred();
  const { loader } = setup([a]);
  loader.load();
  a.reject(new Error("network"));
  await flush();
  assert.deepEqual(loader.getState(), { currency: "USD", loading: false, source: "error" });
});

test("an unsupported or missing currency from the server is USD", async () => {
  for (const data of [{ currency: "INR" }, {}, null, { currency: "" }]) {
    const a = deferred();
    const { loader } = setup([a]);
    loader.load();
    a.resolve(data);
    await flush();
    assert.equal(loader.getState().currency, "USD", JSON.stringify(data));
  }
});

test("login and logout reload: no wrong-currency flash while the new currency is loading", async () => {
  const anon = deferred(), loggedIn = deferred(), loggedOut = deferred();
  const { loader, seen, calls } = setup([anon, loggedIn, loggedOut]);
  loader.load();
  anon.resolve({ currency: "USD", source: "ip" });
  await flush();
  assert.equal(loader.getState().currency, "USD");

  loader.load(); // the visitor logs in (German profile)
  assert.equal(loader.getState().loading, true, "loading again: consumers show a skeleton");
  assert.equal(calls(), 2);
  loggedIn.resolve({ currency: "EUR", source: "profile" });
  await flush();
  assert.deepEqual([loader.getState().currency, loader.getState().loading], ["EUR", false]);

  loader.load(); // and logs out again
  assert.equal(loader.getState().loading, true);
  loggedOut.resolve({ currency: "USD", source: "ip" });
  await flush();
  assert.deepEqual([loader.getState().currency, loader.getState().loading], ["USD", false]);
  // the only settled states are the three real answers; between them the state always said loading
  const finals = seen.filter((s) => !s.loading).map((s) => s.currency);
  assert.deepEqual(finals, ["USD", "EUR", "USD"]);
});

test("a slow answer for an older request never overwrites a newer one", async () => {
  const slow = deferred(), fast = deferred();
  const { loader } = setup([slow, fast]);
  loader.load(); // first
  loader.load(); // login happened before the first answer came back
  fast.resolve({ currency: "EUR" });
  await flush();
  slow.resolve({ currency: "GBP" });
  await flush();
  assert.equal(loader.getState().currency, "EUR");
});

test("after dispose nothing more is published", async () => {
  const a = deferred();
  const { loader, seen } = setup([a]);
  loader.load();
  const before = seen.length;
  loader.dispose();
  a.resolve({ currency: "GBP" });
  await flush();
  assert.equal(seen.length, before);
});
