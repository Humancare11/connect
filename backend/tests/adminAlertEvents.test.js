const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ev = require("../services/admin/adminAlertEvents");

const tick = () => new Promise((r) => setImmediate(r));
const USER = { _id: "64b000000000000000000001", name: "Priya Sharma", email: "priya@example.com", mobile: "9999999999", country: "India" };

test.beforeEach(() => {
  delete process.env.ADMIN_REGISTRATION_VOICE_ALERT;
  ev.setAdminAlertEmitter(null);
});

test("only admin and superadmin may watch", () => {
  assert.equal(ev.canWatchAdminAlerts({ id: "1", role: "admin" }), true);
  assert.equal(ev.canWatchAdminAlerts({ id: "1", role: "superadmin" }), true);
  for (const role of ["paymentadmin", "employeeadmin", "partner", "doctor", "user", ""]) {
    assert.equal(ev.canWatchAdminAlerts({ id: "1", role }), false, role);
  }
  assert.equal(ev.canWatchAdminAlerts(null), false);
  assert.equal(ev.canWatchAdminAlerts({ role: "admin" }), false);
});

test("emits only { id, name }, after the caller returns", async () => {
  const got = [];
  ev.setAdminAlertEmitter((p) => got.push(p));
  ev.emitUserRegistered({ user: USER });
  assert.equal(got.length, 0, "not synchronous");
  await tick();
  assert.deepEqual(got, [{ id: "64b000000000000000000001", name: "Priya Sharma" }]);
});

test("name is a single capped line", async () => {
  const got = [];
  ev.setAdminAlertEmitter((p) => got.push(p));
  ev.emitUserRegistered({ user: { ...USER, name: "Eve\r\nBcc" + "z".repeat(300) } });
  await tick();
  assert.ok(!/[\r\n]/.test(got[0].name));
  assert.ok(got[0].name.length <= 80);
});

test("ADMIN_REGISTRATION_VOICE_ALERT=false sends nothing; empty means on", async () => {
  const got = [];
  ev.setAdminAlertEmitter((p) => got.push(p));
  process.env.ADMIN_REGISTRATION_VOICE_ALERT = "off";
  ev.emitUserRegistered({ user: USER });
  await tick();
  assert.equal(got.length, 0);
  process.env.ADMIN_REGISTRATION_VOICE_ALERT = "";
  ev.emitUserRegistered({ user: USER });
  await tick();
  assert.equal(got.length, 1);
});

test("never throws: no emitter, throwing emitter, missing user", async () => {
  ev.emitUserRegistered({ user: USER });
  ev.setAdminAlertEmitter(() => { throw new Error("boom"); });
  ev.emitUserRegistered({ user: USER });
  ev.emitUserRegistered({});
  ev.emitUserRegistered();
  await tick();
});

test("both registration paths call the alert once, after the user is created", () => {
  const src = fs.readFileSync(path.join(__dirname, "../controllers/authController.js"), "utf8");
  const calls = src.match(/emitAdminVoiceAlert\(\{ user \}\);/g) || [];
  assert.equal(calls.length, 2);
  const createRegister = src.indexOf("const user = await User.create({");
  const callRegister = src.indexOf("emitAdminVoiceAlert({ user });");
  assert.ok(callRegister > createRegister);
  const createGoogle = src.indexOf("user = await User.create({");
  assert.ok(src.indexOf("emitAdminVoiceAlert({ user });", callRegister + 10) > createGoogle);
});
