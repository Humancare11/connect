// Alert: a payment the gateway confirmed but that did not become a booking. Payment verification, the
// ledger and mails are stubbed (no real charge, no gateway call); the controllers, models, transaction and
// notification code are the real ones, on an isolated in-memory replica set.
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const pv = require("../utils/paymentVerification");
let verifyMode = "ok"; // "ok" | "declined"
pv.resolveCategoryFeeCents = async () => 5000;
pv.resolveServiceFeeCents = async () => 5000;
pv.verifyStripePaymentIntent = async ({ paymentIntentId }) => {
  if (verifyMode === "declined") throw new pv.PaymentVerificationError("Stripe payment not completed. Please complete payment first.", 402);
  return { ref: paymentIntentId, gateway: "stripe", amountCents: 5000 };
};
pv.verifyPaypalOrder = async ({ paypalOrderId }) => ({ ref: paypalOrderId, gateway: "paypal", amountCents: 5000 });
pv.claimPaymentOnce = async () => {};
require("../utils/billing").recordPaymentAndInvoice = async () => {};
const notify = require("../utils/bookingNotifications");
notify.notifyAppointmentBooked = () => {};
notify.notifyCategoryConsultationBooked = () => {};

const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const AdminNotification = require("../models/AdminNotification");
const { createAppointment } = require("../controllers/appointmentController");
const { createCategoryConsultation } = require("../controllers/CategoryConsultationController");

const PATIENT = "64b000000000000000000001";
let seq = 0;
const tomorrow = () => new Date(Date.now() + 36 * 3600 * 1000).toISOString().slice(0, 10);
const makeRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};
const run = async (fn, body) => {
  const res = makeRes();
  await fn({ headers: {}, body, user: { id: PATIENT }, app: { get: () => null } }, res);
  return res;
};
const appointmentBody = (ref) => ({
  date: tomorrow(), time: "10:00", problem: "Cough", category: "General Care", specialty: "GP", condition: "Cough",
  consultationPrice: 50, paymentIntentId: ref, patientDetails: { firstName: "Test" },
});
const consultationBody = (ref) => ({
  concern: "Cough", duration: "1 week", severity: "mild", supportType: "advice", urgency: "asap", date: tomorrow(),
  categoryName: "General Care", specialtyName: "GP", conditionName: "Cough", paymentIntentId: ref,
});
const settle = () => new Promise((r) => setTimeout(r, 150));
const alerts = () => AdminNotification.find({ type: "payment_needs_reconciliation" }).lean();

// Makes the booking write fail after the payment was verified.
async function withFailingWrites(fn) {
  const origA = Appointment.create;
  const origC = CategoryConsultation.create;
  const err = console.error;
  Appointment.create = async () => { throw new Error("db write failed"); };
  CategoryConsultation.create = async () => { throw new Error("db write failed"); };
  console.error = () => {};
  try { return await fn(); } finally {
    Appointment.create = origA;
    CategoryConsultation.create = origC;
    console.error = err;
  }
}
async function withBrokenNotifications(fn) {
  const original = AdminNotification.create;
  const warn = console.warn;
  AdminNotification.create = async () => { throw new Error("notification db down"); };
  console.warn = () => {};
  try { return await fn(); } finally {
    AdminNotification.create = original;
    console.warn = warn;
  }
}

let replSet;
before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  await Appointment.init();
  await CategoryConsultation.init();
  await AdminNotification.init();
});
after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});
beforeEach(async () => {
  verifyMode = "ok";
  await Promise.all([Appointment.deleteMany({}), CategoryConsultation.deleteMany({}), AdminNotification.deleteMany({})]);
});

const kinds = [
  ["appointment", createAppointment, appointmentBody],
  ["consultation", createCategoryConsultation, consultationBody],
];

for (const [kind, fn, bodyOf] of kinds) {
  describe(`payment reconciliation alert: ${kind}`, () => {
    test("a verified payment whose booking could not be written creates one safe alert", async () => {
      const ref = `pi_fail_${++seq}`;
      const res = await withFailingWrites(() => run(fn, bodyOf(ref)));
      assert.equal(res.statusCode, 500);
      assert.equal(res.body.paymentReference, ref);
      await settle();
      const rows = await alerts();
      assert.equal(rows.length, 1);
      const [n] = rows;
      assert.equal(n.title, "Payment received, booking not created");
      assert.equal(n.message, `Stripe · $50.00 payment ${ref} was received but the booking could not be completed. Reconcile or refund manually.`);
      assert.equal(n.refType, null);
      assert.equal(n.refId, ref);
      assert.equal(n.link, "/admin-dashboard/appointments");
      assert.equal(n.dedupeKey, `payment_needs_reconciliation:stripe:${ref}`);
      assert.ok(AdminNotification.isInternalAdminLink(n.link));
      assert.ok(!JSON.stringify(rows).includes(PATIENT));
    });

    test("a successful payment and booking creates no alert", async () => {
      const res = await run(fn, bodyOf(`pi_ok_${++seq}`));
      assert.equal(res.statusCode, 201);
      await settle();
      assert.equal((await alerts()).length, 0);
    });

    test("a payment that is not confirmed by the gateway (declined, incomplete or unknown) creates no alert", async () => {
      verifyMode = "declined";
      const res = await withFailingWrites(() => run(fn, bodyOf(`pi_declined_${++seq}`)));
      assert.equal(res.statusCode, 402);
      await settle();
      assert.equal((await AdminNotification.find({}).lean()).length, 0);
    });

    test("a payment reference is alerted once however many times the failure repeats", async () => {
      const ref = `pi_retry_${++seq}`;
      await withFailingWrites(async () => {
        await run(fn, bodyOf(ref));
        await run(fn, bodyOf(ref));
      });
      await settle();
      assert.equal((await alerts()).length, 1);
      const other = `pi_other_${++seq}`;
      await withFailingWrites(() => run(fn, bodyOf(other)));
      await settle();
      assert.equal((await alerts()).length, 2);
    });

    test("a notification persistence failure does not change the response", async () => {
      const ref = `pi_nf_${++seq}`;
      const res = await withBrokenNotifications(() => withFailingWrites(async () => {
        const r = await run(fn, bodyOf(ref));
        await settle();
        return r;
      }));
      assert.equal(res.statusCode, 500);
      assert.equal(res.body.paymentReference, ref);
      assert.equal((await alerts()).length, 0);
    });
  });
}

describe("payment reconciliation helper", () => {
  const { notifyAdminPaymentNeedsReconciliation } = require("../utils/adminNotifications");

  test("PayPal references use their own label and key; a missing reference is invalid", async () => {
    const res = await notifyAdminPaymentNeedsReconciliation({ gateway: "paypal", ref: "ORDER123", amountCents: 1250 });
    assert.equal(res.status, "created");
    const n = await AdminNotification.findOne({ refId: "ORDER123" }).lean();
    assert.match(n.message, /^PayPal · \$12\.50 payment ORDER123 /);
    assert.equal(n.dedupeKey, "payment_needs_reconciliation:paypal:ORDER123");
    assert.equal((await notifyAdminPaymentNeedsReconciliation({ gateway: "stripe", ref: "" })).status, "invalid");
  });
});
