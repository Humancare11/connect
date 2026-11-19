const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const { verifyToken, signAccessToken, validateDecodedSession } = require("../middleware/verifyToken");
const Session = require("../models/Session");

// Pins the behaviour of the app-wide verifyToken: which identity wins, and when it answers 401.
describe("verifyToken identity selection (unchanged behaviour)", () => {
  let mongod;
  const ids = {};
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    for (const k of ["admin", "doctor", "user", "partner", "emp"]) ids[k] = new mongoose.Types.ObjectId();
    await mongoose.connection.collection("users").insertMany([{ _id: ids.admin }, { _id: ids.user }, { _id: ids.partner }, { _id: ids.emp }]);
    await mongoose.connection.collection("doctors").insertOne({ _id: ids.doctor });
  });
  after(async () => { await mongoose.disconnect(); await mongod.stop(); });

  async function tok(id, role, { revoked = false, stale = false } = {}) {
    const sid = new mongoose.Types.ObjectId();
    await Session.collection.insertOne({
      _id: sid, userId: String(id), role,
      lastActivityAt: new Date(Date.now() - (stale ? 3600e3 : 0)), expiresAt: new Date(Date.now() + 3600e3),
      ...(revoked ? { revokedAt: new Date() } : {}),
    });
    return signAccessToken({ _id: id, email: "x@e.co", role }, sid);
  }
  async function run(req) {
    const out = {};
    const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } };
    await verifyToken({ headers: {}, originalUrl: "/x", get() {}, ip: "1.1.1.1", ...req }, res, () => { out.next = true; });
    return out;
  }
  const who = (req) => run(req).then((o) => (o.next ? null : o));

  test("priority: admin > doctor > user > employeeadmin > partner > bearer", async () => {
    const a = await tok(ids.admin, "admin"), d = await tok(ids.doctor, "doctor"), u = await tok(ids.user, "user");
    const e = await tok(ids.emp, "employeeadmin"), p = await tok(ids.partner, "partner");
    const pick = async (cookies, headers = {}) => { const req = { cookies, headers }; let got; const res = { status() { return this; }, json() { return this; } }; await verifyToken(req, res, () => { got = req.user; }); return got && got.role; };
    assert.equal(await pick({ adminToken: a, doctorToken: d, userToken: u }), "admin");
    assert.equal(await pick({ doctorToken: d, userToken: u }), "doctor");
    assert.equal(await pick({ userToken: u, employeeAdminToken: e, partnerToken: p }), "user");
    assert.equal(await pick({ employeeAdminToken: e, partnerToken: p }), "employeeadmin");
    assert.equal(await pick({ partnerToken: p }), "partner");
    assert.equal(await pick({}, { authorization: `Bearer ${u}` }), "user");
  });

  test("a bad higher-priority cookie falls through to the next valid one (as before)", async () => {
    const u = await tok(ids.user, "user");
    const badDoctor = await tok(ids.doctor, "doctor", { revoked: true });
    let got; const req = { cookies: { doctorToken: badDoctor, userToken: u }, headers: {} };
    await verifyToken(req, { status() { return this; }, json() { return this; } }, () => { got = req.user; });
    assert.equal(got.role, "user");
  });

  test("401 behaviour: no token, forged, revoked, inactive, wrong secret", async () => {
    assert.equal((await who({ cookies: {} })).status, 401);
    assert.match((await who({ cookies: {} })).body.msg, /No token provided/);
    const forged = jwt.sign({ id: String(ids.user), role: "user", sid: "x" }, "other");
    assert.equal((await who({ cookies: { userToken: forged } })).status, 401);
    assert.equal((await who({ cookies: { userToken: await tok(ids.user, "user", { revoked: true }) } })).status, 401);
    assert.equal((await who({ cookies: { userToken: await tok(ids.user, "user", { stale: true }) } })).status, 401);
    const refresh = jwt.sign({ id: String(ids.user), role: "user", sid: "x", type: "refresh" }, process.env.JWT_SECRET);
    assert.match((await who({ cookies: { userToken: refresh } })).body.msg, /Invalid, expired/);
  });

  test("validateDecodedSession is the same function verifyToken uses", async () => {
    assert.equal(typeof validateDecodedSession, "function");
    assert.equal(await validateDecodedSession({ id: String(ids.user), role: "user", sid: String(new mongoose.Types.ObjectId()) }), false);
  });
});
