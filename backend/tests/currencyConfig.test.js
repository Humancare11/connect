const { test, describe, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { Country } = require("country-state-city");

const cfg = require("../utils/currencyConfig");

const EUR_EXPECTED = [
  "AT", "BE", "BG", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES",
  "AD", "MC", "SM", "VA", "XK", "ME",
  "AL", "BA", "CZ", "DK", "HU", "IS", "LI", "MD", "MK", "NO", "PL", "RO", "RS", "SE", "CH", "UA",
];
const GBP_EXPECTED = ["GB", "JE", "GG", "IM", "GI", "FK", "SH"];

describe("country -> currency mapping", () => {
  test("the EUR list has 43 countries (21 + 6 + 16) and the GBP list has 7", () => {
    assert.equal(cfg.EUR_COUNTRIES.size, 43);
    assert.equal(cfg.GBP_COUNTRIES.size, 7);
    assert.deepEqual([...cfg.EUR_COUNTRIES].sort(), [...EUR_EXPECTED].sort());
    assert.deepEqual([...cfg.GBP_COUNTRIES].sort(), [...GBP_EXPECTED].sort());
  });

  test("no country is in both lists", () => {
    for (const code of cfg.GBP_COUNTRIES) assert.equal(cfg.EUR_COUNTRIES.has(code), false, code);
  });

  test("every listed code maps to its currency", () => {
    for (const code of EUR_EXPECTED) assert.equal(cfg.currencyForCountryCode(code), "EUR", code);
    for (const code of GBP_EXPECTED) assert.equal(cfg.currencyForCountryCode(code), "GBP", code);
  });

  test("codes are case-insensitive and padded input is tolerated", () => {
    assert.equal(cfg.currencyForCountryCode("de"), "EUR");
    assert.equal(cfg.currencyForCountryCode(" gb "), "GBP");
  });

  test("everything else is USD, including Russia, Belarus, Turkey and unknown input", () => {
    for (const code of ["US", "IN", "RU", "BY", "TR", "CA", "AU", "AE", "JP", "BR", "GE", "AM"]) {
      assert.equal(cfg.currencyForCountryCode(code), "USD", code);
    }
    for (const bad of ["", null, undefined, "ZZ", "XX", 12, {}]) {
      assert.equal(cfg.currencyForCountryCode(bad), "USD", String(bad));
    }
  });

  test("Kosovo (XK) is EUR, both by code and by name", () => {
    assert.equal(cfg.currencyForCountryCode("XK"), "EUR");
    assert.equal(cfg.currencyForCountryName("Kosovo"), "EUR");
  });

  test("every listed code exists in country-state-city (so names can be converted to codes)", () => {
    for (const code of [...EUR_EXPECTED, ...GBP_EXPECTED]) {
      assert.ok(Country.getCountryByCode(code), `${code} missing from country-state-city`);
    }
  });

  test("library names that differ from everyday names still resolve", () => {
    const cases = {
      "Czech Republic": "EUR",
      "Vatican City State (Holy See)": "EUR",
      "Man (Isle of)": "GBP",
      "Guernsey and Alderney": "GBP",
      "Saint Helena": "GBP",
      "Falkland Islands": "GBP",
      "United Kingdom": "GBP",
      Germany: "EUR",
      "United States": "USD",
      India: "USD",
      Russia: "USD",
    };
    for (const [name, currency] of Object.entries(cases)) {
      assert.equal(cfg.currencyForCountryName(name), currency, name);
    }
  });

  test("every country in the EUR/GBP lists is reachable through its library name", () => {
    for (const code of [...EUR_EXPECTED, ...GBP_EXPECTED]) {
      const name = Country.getCountryByCode(code).name;
      assert.equal(cfg.isoForCountryName(name), code, name);
    }
  });

  test("country names are matched ignoring case, accents and punctuation; unknown or empty is USD", () => {
    assert.equal(cfg.currencyForCountryName("  FRANCE "), "EUR");
    assert.equal(cfg.currencyForCountryName("Côte d'Ivoire"), "USD");
    assert.equal(cfg.currencyForCountryName("Atlantis"), "USD");
    assert.equal(cfg.currencyForCountryName(""), "USD");
    assert.equal(cfg.currencyForCountryName(null), "USD");
  });
});

describe("normalizeCurrency", () => {
  test("accepts the four currencies in any case, else USD", () => {
    assert.equal(cfg.normalizeCurrency("eur"), "EUR");
    assert.equal(cfg.normalizeCurrency(" gbp "), "GBP");
    assert.equal(cfg.normalizeCurrency("usd"), "USD");
    assert.equal(cfg.normalizeCurrency(" inr "), "INR");
    assert.equal(cfg.normalizeCurrency("JPY"), "USD");
    assert.equal(cfg.normalizeCurrency(undefined), "USD");
  });
});

describe("MULTI_CURRENCY_ENABLED", () => {
  const original = process.env.MULTI_CURRENCY_ENABLED;
  afterEach(() => {
    if (original === undefined) delete process.env.MULTI_CURRENCY_ENABLED;
    else process.env.MULTI_CURRENCY_ENABLED = original;
  });

  test("is off by default and for anything but true/1", () => {
    delete process.env.MULTI_CURRENCY_ENABLED;
    assert.equal(cfg.isMultiCurrencyEnabled(), false);
    for (const v of ["", "false", "0", "no", "off", "yes"]) {
      process.env.MULTI_CURRENCY_ENABLED = v;
      assert.equal(cfg.isMultiCurrencyEnabled(), false, v);
    }
    for (const v of ["true", "TRUE", " 1 "]) {
      process.env.MULTI_CURRENCY_ENABLED = v;
      assert.equal(cfg.isMultiCurrencyEnabled(), true, v);
    }
  });
});

describe("resolveRequestCurrency", () => {
  const original = process.env.MULTI_CURRENCY_ENABLED;
  afterEach(() => {
    if (original === undefined) delete process.env.MULTI_CURRENCY_ENABLED;
    else process.env.MULTI_CURRENCY_ENABLED = original;
  });
  const ipIn = (country) => async () => ({ country, state: "", city: "" });

  test("flag off: always USD, and the IP is never looked up", async () => {
    delete process.env.MULTI_CURRENCY_ENABLED;
    let looked = 0;
    const r = await cfg.resolveRequestCurrency({
      ip: "8.8.8.8",
      lookupLocation: async () => { looked += 1; return { country: "France" }; },
    });
    assert.deepEqual(r, { currency: "USD", country: "", source: "disabled" });
    assert.equal(looked, 0);
  });

  test("flag on: the IP's country decides - EUR, GBP, INR and USD", async () => {
    process.env.MULTI_CURRENCY_ENABLED = "true";
    process.env.RAZORPAY_KEY_ID = "rzp_test_k";
    process.env.RAZORPAY_KEY_SECRET = "s";
    try {
      const at = (country) => cfg.resolveRequestCurrency({ ip: "8.8.8.8", lookupLocation: ipIn(country) });
      assert.deepEqual(await at("France"), { currency: "EUR", country: "FR", source: "ip" });
      assert.deepEqual(await at("Germany"), { currency: "EUR", country: "DE", source: "ip" });
      assert.deepEqual(await at("United Kingdom"), { currency: "GBP", country: "GB", source: "ip" });
      assert.deepEqual(await at("India"), { currency: "INR", country: "IN", source: "ip" });
      assert.deepEqual(await at("United States"), { currency: "USD", country: "US", source: "ip" });
    } finally {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
    }
  });

  test("a profile country is not an input any more: passing one changes nothing", async () => {
    process.env.MULTI_CURRENCY_ENABLED = "true";
    const r = await cfg.resolveRequestCurrency({ userCountry: "India", ip: "8.8.8.8", lookupLocation: ipIn("France") });
    assert.deepEqual(r, { currency: "EUR", country: "FR", source: "ip" });
    assert.equal(r.source === "profile", false);
    const none = await cfg.resolveRequestCurrency({ userCountry: "Germany" });
    assert.deepEqual(none, { currency: "USD", country: "", source: "default" });
  });

  test("flag on: no IP, an IP the lookup cannot place, or an unknown country is USD with source default", async () => {
    process.env.MULTI_CURRENCY_ENABLED = "true";
    assert.deepEqual(await cfg.resolveRequestCurrency({}), { currency: "USD", country: "", source: "default" });
    assert.deepEqual(await cfg.resolveRequestCurrency({ ip: "" }), { currency: "USD", country: "", source: "default" });
    assert.deepEqual(await cfg.resolveRequestCurrency({ ip: "8.8.8.8", lookupLocation: async () => null }), { currency: "USD", country: "", source: "default" });
    assert.deepEqual(await cfg.resolveRequestCurrency({ ip: "8.8.8.8", lookupLocation: ipIn("Narnia") }), { currency: "USD", country: "", source: "default" });
  });

  test("flag on: a lookup that throws is USD with source error (never an exception)", async () => {
    process.env.MULTI_CURRENCY_ENABLED = "true";
    const thrown = await cfg.resolveRequestCurrency({ ip: "8.8.8.8", lookupLocation: async () => { throw new Error("boom"); } });
    assert.deepEqual(thrown, { currency: "USD", country: "", source: "error" });
  });
});

describe("parsePrice", () => {
  test("accepts positive numbers and numeric strings up to 100000 with 2 decimals", () => {
    assert.deepEqual(cfg.parsePrice(30), { value: 30 });
    assert.deepEqual(cfg.parsePrice("30"), { value: 30 });
    assert.deepEqual(cfg.parsePrice("19.99"), { value: 19.99 });
    assert.deepEqual(cfg.parsePrice(0.01), { value: 0.01 });
    assert.deepEqual(cfg.parsePrice(100000), { value: 100000 });
    assert.deepEqual(cfg.parsePrice(10.5), { value: 10.5 });
  });

  test("rejects zero, negatives, NaN, Infinity, empty, booleans, arrays, objects, null and undefined", () => {
    for (const bad of [0, "0", "0.00", -1, "-5", NaN, Infinity, "", "  ", true, false, [], [5], {}, null, undefined, "abc", "1e3", "1,000"]) {
      assert.ok(cfg.parsePrice(bad).error, `should reject ${JSON.stringify(bad)}`);
    }
  });

  test("rejects more than 2 decimals and anything over 100000", () => {
    assert.match(cfg.parsePrice(1.234).error, /2 decimal/);
    assert.match(cfg.parsePrice("9.999").error, /2 decimal/);
    assert.match(cfg.parsePrice(100000.01).error, /more than 100,000/);
    assert.match(cfg.parsePrice(1000000).error, /more than 100,000/);
  });
});
