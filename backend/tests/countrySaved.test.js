// The country a customer picks is the country that is stored: on signup (the real signup location validation) and on profile edit
// (the real updateProfile controller over an in-memory database). Germany, United Kingdom and India, by name and by ISO code.
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const User = require("../models/User");
const { updateProfile, resolveSignupLocation } = require("../controllers/authController");

const BROWSER = { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" } };
// the country the customer picks -> a state / province the dropdown offers for it
const PICKS = [
  { country: "Germany", state: "Bavaria" },
  { country: "United Kingdom", state: "England" },
  { country: "India", state: "Karnataka" },
];

describe("signup: the picked country is the saved country", () => {
  for (const { country, state } of PICKS) {
    test(`${country}`, () => {
      const result = resolveSignupLocation(BROWSER, { country, state, city: "Anywhere" });
      assert.equal(result.error, undefined);
      assert.equal(result.set.country, country);
      assert.equal(result.set.state, state);
      assert.equal(result.set.city, "Anywhere");
    });
  }

  test("never another country: not the first of the list, not a neighbour, whatever the phone code is", () => {
    for (const { country, state } of PICKS) {
      const saved = resolveSignupLocation(BROWSER, { country, state, mobile: "+4915123456789" }).set.country;
      assert.equal(saved, country);
      assert.notEqual(saved, "Afghanistan");
      assert.notEqual(saved, "Anguilla");
    }
  });

  test("the ISO code and any letter case resolve to the same country, by name", () => {
    assert.equal(resolveSignupLocation(BROWSER, { country: "DE", state: "Bavaria" }).set.country, "Germany");
    assert.equal(resolveSignupLocation(BROWSER, { country: "gb", state: "England" }).set.country, "United Kingdom");
    assert.equal(resolveSignupLocation(BROWSER, { country: "GERMANY", state: "Bavaria" }).set.country, "Germany");
    assert.equal(resolveSignupLocation(BROWSER, { country: " India ", state: "Karnataka" }).set.country, "India");
  });

  test("a country that is not in the list is refused, never replaced by another", () => {
    assert.equal(resolveSignupLocation(BROWSER, { country: "Atlantis", state: "x" }).error, "Select a valid country.");
    assert.equal(resolveSignupLocation(BROWSER, { country: "49", state: "x" }).error, "Select a valid country.", "a phone code is not a country");
    assert.equal(resolveSignupLocation(BROWSER, { country: "", state: "" }).error, "Country is required.");
  });
});

describe("profile edit: the picked country is the saved country", () => {
  let mongod;
  let n = 0;
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await User.deleteMany({});
  });

  const mkUser = (extra = {}) =>
    User.create({ name: "Pat", email: `pat${(n += 1)}@x.co`, role: "user", mobile: "+919876543210", country: "India", state: "Karnataka", city: "Bengaluru", ...extra });
  const edit = async (user, body) => {
    const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    await updateProfile({ user: { id: String(user._id), role: "user" }, body: { name: user.name, email: user.email, ...body }, headers: {}, ip: "127.0.0.1", socket: {} }, res);
    return res;
  };

  for (const { country, state } of PICKS) {
    test(`${country}`, async () => {
      // start somewhere else so the change is real (India itself starts from France)
      const user = await mkUser(country === "India" ? { country: "France", state: "Paris", city: "Paris" } : {});
      const res = await edit(user, { country, state, city: "Anywhere" });
      assert.equal(res.statusCode, 200, JSON.stringify(res.body));
      const saved = await User.findById(user._id).lean();
      assert.equal(saved.country, country);
      assert.equal(saved.state, state);
      assert.equal(res.body.user.country, country, "and the response says the same");
    });
  }

  test("the mobile number and its phone code are saved too, and never change the country", async () => {
    const user = await mkUser();
    const res = await edit(user, { country: "Germany", state: "Bavaria", mobile: "+4915123456789" });
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    const saved = await User.findById(user._id).lean();
    assert.deepEqual([saved.country, saved.mobile], ["Germany", "+4915123456789"]);
    // changing only the phone leaves the country alone
    const res2 = await edit(user, { mobile: "+447911123456" });
    assert.equal(res2.statusCode, 200, JSON.stringify(res2.body));
    const after2 = await User.findById(user._id).lean();
    assert.deepEqual([after2.country, after2.mobile], ["Germany", "+447911123456"]);
  });

  test("a profile saved without a country field keeps its country (a partial update never blanks or replaces it)", async () => {
    const user = await mkUser({ country: "Germany", state: "Bavaria", city: "Munich" });
    const res = await edit(user, { gender: "Male" });
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    const saved = await User.findById(user._id).lean();
    assert.deepEqual([saved.country, saved.state, saved.city], ["Germany", "Bavaria", "Munich"]);
  });

  test("an invalid country is refused and the stored one stays", async () => {
    const user = await mkUser({ country: "Germany", state: "Bavaria" });
    const res = await edit(user, { country: "Atlantis" });
    assert.equal(res.statusCode, 400);
    assert.equal((await User.findById(user._id).lean()).country, "Germany");
  });
});
