// Patient DOB + gender: the rules (validation, age in India time, missing fields), the 422 PROFILE_INCOMPLETE gate on the routes that
// start a payment, the checkout save endpoint, "editable but never blanked" on the Profile page, and the booking snapshot (a paid
// booking is never refused for a missing DOB or gender).
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

// Payment verification and the notification mails are stubbed (as in bookingSourceCreate.test.js); everything else is real.
const pv = require("../utils/paymentVerification");
pv.verifyCategoryPayment = async ({ paymentIntentId }) => ({ ref: paymentIntentId, gateway: "stripe", amountCents: 5000, currency: "USD" });
pv.verifyServicePayment = pv.verifyCategoryPayment;
pv.verifyStripePaymentIntent = async ({ paymentIntentId }) => ({ ref: paymentIntentId, gateway: "stripe", amountCents: 5000 });
pv.verifyPaypalOrder = async ({ paypalOrderId }) => ({ ref: paypalOrderId, gateway: "paypal", amountCents: 5000 });
pv.claimPaymentOnce = async () => {};
require("../utils/billing").recordPaymentAndInvoice = async () => {};
const notify = require("../utils/bookingNotifications");
notify.notifyAppointmentBooked = () => {};
notify.notifyCategoryConsultationBooked = () => {};

const P = require("../utils/patientProfile");
const User = require("../models/User");
const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const { createAppointment } = require("../controllers/appointmentController");
const { createCategoryConsultation } = require("../controllers/CategoryConsultationController");
const { savePatientDetails, updateProfile } = require("../controllers/authController");

const makeRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};

describe("validateDob", () => {
  const now = new Date("2026-11-24T10:00:00Z");
  test("accepts a normal date, today and 1900-01-01", () => {
    assert.equal(P.validateDob("1990-05-17", now).valid, true);
    assert.equal(P.validateDob("2026-11-24", now).valid, true);
    assert.equal(P.validateDob("1900-01-01", now).valid, true);
  });
  test("rejects empty, wrong format, impossible dates, the future and before 1900", () => {
    for (const bad of ["", "   ", undefined, null, "17-05-1990", "1990/05/17", "1990-02-30", "1990-13-01", "abc", "1899-12-31"]) {
      assert.equal(P.validateDob(bad, now).valid, false, `should reject ${bad}`);
    }
    assert.equal(P.validateDob("2026-11-26", now).valid, false);
    assert.match(P.validateDob("2999-01-01", now).msg, /future/);
  });
  test("'today' is the India date: 19:00 UTC on the 24th is already the 25th in India", () => {
    const lateUtc = new Date("2026-11-24T19:00:00Z");
    assert.equal(P.todayInIst(lateUtc), "2026-11-25");
    assert.equal(P.validateDob("2026-11-25", lateUtc).valid, true);
    assert.equal(P.validateDob("2026-11-25", now).valid, false);
  });
});

describe("ageAt (Asia/Kolkata)", () => {
  test("counts whole years and moves up exactly on the birthday", () => {
    assert.equal(P.ageAt("1990-11-24", new Date("2026-11-24T05:00:00Z")), 36);
    assert.equal(P.ageAt("1990-11-25", new Date("2026-11-24T05:00:00Z")), 35);
    assert.equal(P.ageAt("2026-11-24", new Date("2026-11-24T05:00:00Z")), 0);
  });
  test("uses the India date, not the UTC date", () => {
    // 20:00 UTC on 24 Nov is 01:30 on 25 Nov in India, so a 25 Nov birthday has already come.
    assert.equal(P.ageAt("1990-11-25", new Date("2026-11-24T20:00:00Z")), 36);
    assert.equal(P.ageAt("1990-11-25", new Date("2026-11-24T10:00:00Z")), 35);
  });
  test("a leap-day birthday turns a year older on 1 March in a common year", () => {
    assert.equal(P.ageAt("2000-02-29", new Date("2026-02-28T06:00:00Z")), 25);
    assert.equal(P.ageAt("2000-02-29", new Date("2026-03-01T06:00:00Z")), 26);
  });
  test("is null for an unusable DOB", () => {
    assert.equal(P.ageAt("", new Date()), null);
    assert.equal(P.ageAt("not a date", new Date()), null);
    assert.equal(P.ageAt("2999-01-01", new Date()), null);
  });
});

describe("profileMissing / bookingSnapshot", () => {
  test("lists exactly what is missing", () => {
    assert.deepEqual(P.profileMissing({ dob: "1990-01-01", gender: "Male" }), []);
    assert.deepEqual(P.profileMissing({ dob: "", gender: "Female" }), ["dob"]);
    assert.deepEqual(P.profileMissing({ dob: "1990-01-01", gender: "" }), ["gender"]);
    assert.deepEqual(P.profileMissing({}), ["dob", "gender"]);
    assert.deepEqual(P.profileMissing(null), ["dob", "gender"]);
    // an old value that is no longer usable counts as missing
    assert.deepEqual(P.profileMissing({ dob: "garbage", gender: "male" }), ["dob", "gender"]);
  });
  test("snapshot holds age and sex, or empty values when the profile lacks them", () => {
    const at = new Date("2026-11-24T05:00:00Z");
    assert.deepEqual(P.bookingSnapshot({ dob: "1990-01-01", gender: "Other" }, at), { patientAgeAtBooking: 36, patientSexAtBooking: "Other" });
    assert.deepEqual(P.bookingSnapshot({}, at), { patientAgeAtBooking: null, patientSexAtBooking: "" });
  });
});

let replSet;
before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  await Appointment.init();
  await CategoryConsultation.init();
  await User.init();
});
after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

let n = 0;
const makeUser = (extra = {}) => User.create({
  name: "Test Patient", email: `p${++n}@example.com`, password: "x".repeat(12), role: "user", ...extra,
});

describe("requireCompleteProfile (the gate on the routes that start a payment)", () => {
  const run = async (userId) => {
    const res = makeRes();
    let nextCalled = false;
    await P.requireCompleteProfile({ user: { id: String(userId) } }, res, () => { nextCalled = true; });
    return { res, nextCalled };
  };

  test("a profile without DOB and gender gets 422 PROFILE_INCOMPLETE listing both", async () => {
    const u = await makeUser();
    const { res, nextCalled } = await run(u._id);
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 422);
    assert.equal(res.body.code, "PROFILE_INCOMPLETE");
    assert.deepEqual(res.body.missing, ["dob", "gender"]);
    assert.ok(res.body.msg);
  });
  test("only the missing one is listed", async () => {
    const u = await makeUser({ dob: "1990-01-01" });
    const { res } = await run(u._id);
    assert.deepEqual(res.body.missing, ["gender"]);
  });
  test("a complete profile goes straight through", async () => {
    const u = await makeUser({ dob: "1990-01-01", gender: "Female" });
    const { res, nextCalled } = await run(u._id);
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
  });
  test("every route that starts a payment has the gate, and no booking-create route does", () => {
    const has = (router, method, path) => {
      const layer = router.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
      assert.ok(layer, `${method} ${path} exists`);
      return layer.route.stack.some((s) => s.handle === P.requireCompleteProfile);
    };
    const payments = require("../routes/payments");
    const paypal = require("../routes/paypal");
    const razorpay = require("../routes/razorpay");
    assert.equal(has(payments, "post", "/create-intent"), true);
    assert.equal(has(payments, "post", "/create-intent-by-amount"), true);
    assert.equal(has(paypal, "post", "/create-order"), true);
    assert.equal(has(paypal, "post", "/create-order-by-amount"), true);
    assert.equal(has(razorpay, "post", "/create-order"), true);
    // the payment is already taken at these points
    assert.equal(has(paypal, "post", "/capture-order"), false);
    assert.equal(has(require("../routes/appointments"), "post", "/"), false);
    assert.equal(has(require("../routes/categoryConsultation"), "post", "/"), false);
  });
});

describe("PUT /api/auth/patient-details (the checkout step)", () => {
  const save = async (userId, body) => {
    const res = makeRes();
    await savePatientDetails({ user: { id: String(userId) }, body }, res);
    return res;
  };
  test("saves a valid DOB and gender to the profile and returns the user", async () => {
    const u = await makeUser();
    const res = await save(u._id, { dob: "1991-03-09", gender: "Female" });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.user.dob, "1991-03-09");
    assert.equal(res.body.user.gender, "Female");
    const stored = await User.findById(u._id).lean();
    assert.equal(stored.dob, "1991-03-09");
    assert.equal(stored.gender, "Female");
  });
  test("rejects a future DOB, a bad date, an unknown gender and an empty body, saving nothing", async () => {
    const u = await makeUser();
    for (const body of [
      { dob: "2999-01-01", gender: "Male" }, { dob: "1800-01-01", gender: "Male" }, { dob: "nope", gender: "Male" },
      { dob: "1990-01-01", gender: "male" }, { dob: "1990-01-01", gender: "" }, { dob: "1990-01-01", gender: "Robot" }, {}, undefined,
    ]) {
      const res = await save(u._id, body);
      assert.equal(res.statusCode, 400, JSON.stringify(body));
    }
    const stored = await User.findById(u._id).lean();
    assert.equal(stored.dob, "");
    assert.equal(stored.gender, "");
  });
  test("writes only to the caller's own profile", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await save(a._id, { dob: "1980-01-01", gender: "Male" });
    assert.equal((await User.findById(b._id).lean()).dob, "");
  });
});

describe("Profile page: DOB and gender can be edited but not blanked once set", () => {
  const update = async (user, body) => {
    const res = makeRes();
    await updateProfile({ user: { id: String(user._id) }, body: { name: user.name, email: user.email, ...body } }, res);
    return res;
  };
  test("can change a saved DOB and gender", async () => {
    const u = await makeUser({ dob: "1990-01-01", gender: "Male" });
    const res = await update(u, { dob: "1992-02-02", gender: "Female" });
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    const stored = await User.findById(u._id).lean();
    assert.deepEqual([stored.dob, stored.gender], ["1992-02-02", "Female"]);
  });
  test("refuses to clear a saved DOB", async () => {
    const u = await makeUser({ dob: "1990-01-01", gender: "Male" });
    const res = await update(u, { dob: "" });
    assert.equal(res.statusCode, 400);
    assert.match(res.body.msg, /not removed/);
    assert.equal((await User.findById(u._id).lean()).dob, "1990-01-01");
  });
  test("refuses to clear a saved gender", async () => {
    const u = await makeUser({ dob: "1990-01-01", gender: "Male" });
    const res = await update(u, { gender: "" });
    assert.equal(res.statusCode, 400);
    assert.equal((await User.findById(u._id).lean()).gender, "Male");
  });
  test("a profile that never had them can still save with them blank (nothing to protect)", async () => {
    const u = await makeUser();
    const res = await update(u, { dob: "", gender: "" });
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  });
});

describe("booking creation: snapshot, and a paid booking is never refused", () => {
  const tomorrow = () => new Date(Date.now() + 36 * 3600 * 1000).toISOString().slice(0, 10);
  let seq = 0;
  const reqFor = (userId, body) => ({ headers: {}, body, user: { id: String(userId) }, app: { get: () => null } });
  const apptBody = (extra = {}) => ({
    date: tomorrow(), time: "10:00", problem: "Cough", category: "General Care", specialty: "GP", condition: "Cough",
    consultationPrice: 50, paymentIntentId: `pi_snap_${++seq}`, patientDetails: { firstName: "Test" }, ...extra,
  });
  const consBody = (extra = {}) => ({
    concern: "Cough", duration: "1 week", severity: "mild", supportType: "advice", urgency: "asap", date: tomorrow(),
    categoryName: "General Care", specialtyName: "GP", conditionName: "Cough", paymentIntentId: `pi_snap_${++seq}`, ...extra,
  });

  test("appointment: age and sex are stored from the profile; a different DOB sent by the browser is ignored", async () => {
    const u = await makeUser({ dob: "1990-01-01", gender: "Male" });
    const res = makeRes();
    await createAppointment(reqFor(u._id, apptBody({ patientDetails: { dob: "2015-01-01", gender: "Female" } })), res);
    assert.equal(res.statusCode, 201, JSON.stringify(res.body));
    const stored = await Appointment.findById(res.body.appointment._id).lean();
    assert.equal(stored.patientAgeAtBooking, P.ageAt("1990-01-01"));
    assert.equal(stored.patientSexAtBooking, "Male");
    assert.equal(stored.patientDetails.dob, "1990-01-01");
    assert.equal(stored.patientDetails.gender, "Male");
  });
  test("appointment: with no DOB / gender on the profile it is STILL created (payment is taken) with an empty snapshot", async () => {
    const u = await makeUser();
    const res = makeRes();
    await createAppointment(reqFor(u._id, apptBody()), res);
    assert.equal(res.statusCode, 201, JSON.stringify(res.body));
    const stored = await Appointment.findById(res.body.appointment._id).lean();
    assert.equal(stored.patientAgeAtBooking, null);
    assert.equal(stored.patientSexAtBooking, "");
  });
  test("the snapshot does not change when the profile changes later", async () => {
    const u = await makeUser({ dob: "1990-01-01", gender: "Male" });
    const res = makeRes();
    await createAppointment(reqFor(u._id, apptBody()), res);
    const before = (await Appointment.findById(res.body.appointment._id).lean()).patientAgeAtBooking;
    await User.updateOne({ _id: u._id }, { $set: { dob: "2000-06-06", gender: "Female" } });
    const after = await Appointment.findById(res.body.appointment._id).lean();
    assert.equal(after.patientAgeAtBooking, before);
    assert.equal(after.patientSexAtBooking, "Male");
  });
  test("category consultation: snapshot stored when the profile has the details", async () => {
    const u = await makeUser({ dob: "1985-07-07", gender: "Other" });
    const res = makeRes();
    await createCategoryConsultation(reqFor(u._id, consBody()), res);
    assert.equal(res.statusCode, 201, JSON.stringify(res.body));
    const stored = await CategoryConsultation.findById(res.body.data._id).lean();
    assert.equal(stored.patientAgeAtBooking, P.ageAt("1985-07-07"));
    assert.equal(stored.patientSexAtBooking, "Other");
  });
  test("category consultation: with no details it is still created, with an empty snapshot", async () => {
    const u = await makeUser();
    const res = makeRes();
    await createCategoryConsultation(reqFor(u._id, consBody()), res);
    assert.equal(res.statusCode, 201, JSON.stringify(res.body));
    const stored = await CategoryConsultation.findById(res.body.data._id).lean();
    assert.equal(stored.patientAgeAtBooking, null);
    assert.equal(stored.patientSexAtBooking, "");
  });
  test("older bookings (no snapshot fields at all) still load", async () => {
    const raw = await Appointment.collection.insertOne({ patientId: new mongoose.Types.ObjectId(), date: "2026-01-01", time: "10:00", status: "completed" });
    const doc = await Appointment.findById(raw.insertedId).lean();
    assert.equal(doc.patientAgeAtBooking, undefined);
  });
});
