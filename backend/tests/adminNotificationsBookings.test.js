const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const AdminNotification = require("../models/AdminNotification");
const { notifyAdminAppointmentBooked, notifyAdminCategoryConsultationBooked } = require("../utils/adminNotifications");

// Isolated in-memory MongoDB only. createAppointment itself needs Stripe/PayPal and a
// replica-set transaction, so the controller wiring is checked statically and the
// notification logic is exercised through the wrappers the controllers call.
describe("admin notifications for patient bookings", () => {
  let mongod;
  const SECRET = {
    patientName: "Jane Patient", email: "jane.patient@example.com", phone: "+15551234567",
    problem: "chest pain since Tuesday", payment: "pi_SECRET123", report: "report-xyz.pdf",
  };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await AdminNotification.init();
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(() => AdminNotification.deleteMany({}));

  const appointment = (extra = {}) => ({
    _id: new mongoose.Types.ObjectId(),
    patientId: new mongoose.Types.ObjectId(),
    date: "2026-11-01", time: "10:00 AM", category: "Cardiology", specialty: "Heart",
    problem: SECRET.problem, paymentIntentId: SECRET.payment, medicalReports: [SECRET.report],
    patientDetails: { firstName: "Jane", email: SECRET.email, phone: SECRET.phone },
    ...extra,
  });
  const consultation = (extra = {}) => ({
    _id: new mongoose.Types.ObjectId(),
    patientId: new mongoose.Types.ObjectId(),
    categoryName: "Women's Health", specialtyName: "Gynecology", date: "2026-11-02",
    urgency: "flexible", slot: "05:30 PM", concern: SECRET.problem, paymentIntentId: SECRET.payment,
    ...extra,
  });
  const expectNoLeak = (doc) => {
    const text = JSON.stringify(doc);
    for (const v of Object.values(SECRET)) assert.ok(!text.includes(v), `leaked ${v}`);
    assert.doesNotMatch(text, /Jane/);
  };

  test("direct doctor booking creates one notification with the right fields", async () => {
    const appt = appointment();
    const res = await notifyAdminAppointmentBooked({ appointment: appt, doctor: { name: "Martin Perlin" } });
    assert.equal(res.status, "created");
    const docs = await AdminNotification.find({}).lean();
    assert.equal(docs.length, 1);
    const [n] = docs;
    assert.equal(n.type, "appointment_created");
    assert.equal(n.title, "New appointment booked");
    assert.equal(n.refType, "appointment");
    assert.equal(n.refId, String(appt._id));
    assert.equal(n.dedupeKey, `appointment_created:${appt._id}`);
    assert.equal(n.link, `/admin-dashboard/appointments/${appt._id}`);
    assert.equal(n.message, "Dr. Martin Perlin · Cardiology · Heart · 2026-11-01 · 10:00 AM");
    expectNoLeak(n);
  });

  test("appointment without a doctor is titled as a request", async () => {
    await notifyAdminAppointmentBooked({ appointment: appointment(), doctor: null });
    const n = await AdminNotification.findOne({}).lean();
    assert.equal(n.title, "New appointment request");
    assert.match(n.message, /^No doctor assigned yet/);
  });

  test("category consultation creates one notification linking to the unified detail route", async () => {
    const cc = consultation();
    const res = await notifyAdminCategoryConsultationBooked({ consultation: cc });
    assert.equal(res.status, "created");
    const docs = await AdminNotification.find({}).lean();
    assert.equal(docs.length, 1);
    const [n] = docs;
    assert.equal(n.type, "appointment_created");
    assert.equal(n.title, "New appointment request");
    assert.equal(n.refType, "appointment");
    assert.equal(n.refId, String(cc._id));
    assert.equal(n.dedupeKey, `appointment_created:category:${cc._id}`);
    assert.equal(n.link, `/admin-dashboard/appointments/${cc._id}`);
    assert.equal(n.message, "No doctor assigned yet · Women's Health · Gynecology · 2026-11-02 · 05:30 PM");
    expectNoLeak(n);
  });

  test("non-flexible category request shows Next available, not a slot", async () => {
    await notifyAdminCategoryConsultationBooked({ consultation: consultation({ urgency: "asap", slot: null }) });
    assert.match((await AdminNotification.findOne({}).lean()).message, /Next available$/);
  });

  test("repeat calls are deduplicated; appointment and category keys never collide", async () => {
    const appt = appointment();
    assert.equal((await notifyAdminAppointmentBooked({ appointment: appt })).status, "created");
    assert.equal((await notifyAdminAppointmentBooked({ appointment: appt })).status, "deduplicated");
    const cc = consultation({ _id: appt._id });
    assert.equal((await notifyAdminCategoryConsultationBooked({ consultation: cc })).status, "created");
    assert.equal((await notifyAdminCategoryConsultationBooked({ consultation: cc })).status, "deduplicated");
    assert.equal(await AdminNotification.countDocuments({}), 2);
  });

  test("database failure or bad input never throws", async () => {
    const Model = { create: async () => { throw new Error("db down"); } };
    const warn = console.warn;
    console.warn = () => {};
    try {
      assert.deepEqual(await notifyAdminAppointmentBooked({ appointment: appointment() }, { Model }), { status: "failed" });
      assert.deepEqual(await notifyAdminCategoryConsultationBooked({ consultation: consultation() }, { Model }), { status: "failed" });
      assert.deepEqual(await notifyAdminAppointmentBooked(), { status: "failed" });
      assert.deepEqual(await notifyAdminCategoryConsultationBooked({}), { status: "failed" });
    } finally {
      console.warn = warn;
    }
  });

  describe("controller wiring (static)", () => {
    const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

    test("createAppointment notifies after commit and after the 201 response, outside the transaction", () => {
      const src = read("controllers/appointmentController.js");
      const fn = src.slice(src.indexOf("const createAppointment"), src.indexOf("const resolveCategoryConsultationTime"));
      const txEnd = fn.indexOf("appointment = created[0];");
      const resp = fn.indexOf("res.status(201)");
      const call = fn.indexOf("void notifyAdminAppointmentBooked(");
      assert.ok(txEnd > 0 && resp > txEnd && call > resp, "order: commit < response < notification");
      assert.equal(fn.split("notifyAdminAppointmentBooked(").length - 1, 1);
      assert.ok(fn.indexOf("notifyAppointmentBooked({") > 0, "existing email kept");
      assert.ok(fn.includes("recordPaymentAndInvoice("), "invoice kept");
      assert.ok(fn.indexOf('emit("new-appointment"') > 0, "socket kept");
    });

    test("createCategoryConsultation notifies only after persistence and the 201 response", () => {
      const src = read("controllers/CategoryConsultationController.js");
      const created = src.indexOf("consultation = await CategoryConsultation.create(");
      const resp = src.indexOf("res.status(201)");
      const call = src.indexOf("void notifyAdminCategoryConsultationBooked(");
      assert.ok(created > 0 && resp > created && call > resp);
      assert.ok(src.includes("notifyCategoryConsultationBooked({ consultation })"), "existing email kept");
    });

    test("manual entries do not notify", () => {
      assert.doesNotMatch(read("routes/adminEntries.js"), /adminNotifications/);
    });
  });
});
