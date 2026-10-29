// Phase D3 (display only): the Appointment entries list, its money boxes and totals, its CSV and the Appointments list carry the
// currency of each booking, and amounts in different currencies are never added together.
// Manual entries are USD-only and are counted in the USD bucket.
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const ManualEntry = require("../models/ManualEntry");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const { listBookingEntries, listAllEntryRows } = require("../utils/bookingEntryList");
const { listAdminBookings, loadAdminBookingRowById } = require("../utils/adminBookingList");
const { COLUMNS, AUTO_COLUMNS, MANUAL_COLUMNS, buildEntriesCsv } = require("../utils/bookingEntryCsv");
const { doctorFeePlaceholder, formatMoneyCents } = require("../utils/bookingEntry");

// A minimal CSV reader (quoted fields, doubled quotes).
function parseCsv(text) {
  const body = text.replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; } else if (ch === "\r") { /* skip */ } else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...records] = rows;
  return { head, records: records.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]]))) };
}

describe("entries and bookings lists carry each booking's currency", () => {
  let mongod, patient, doctor;

  const day = (n) => new Date(Date.UTC(2026, 9, n, 10));
  // A paid appointment. `price` is in currency units (consultationPrice), `paid` in minor units (paymentAmount).
  const appt = (n, currency, price, extra = {}) =>
    Appointment.create({
      patientId: patient._id, doctorId: doctor._id, date: "2026-11-01", time: "10:00 AM", bookedAt: day(n), status: "confirmed",
      paymentStatus: "paid", paymentAmount: Math.round(price * 100), consultationPrice: price,
      ...(currency ? { paymentCurrency: currency } : {}), ...extra,
    });
  const cat = async (n, currency, price, extra = {}) => {
    const doc = await CategoryConsultation.create({
      concern: "x", severity: "mild", supportType: "chat", urgency: "flexible", date: "2026-11-02", slot: "05:30 PM",
      patientId: patient._id, categoryName: "Women's Health", status: "Confirmed", paymentStatus: "paid",
      paymentAmount: Math.round(price * 100), consultationPrice: price, paymentCurrency: currency, ...extra,
    });
    await CategoryConsultation.collection.updateOne({ _id: doc._id }, { $set: { createdAt: day(n) } });
    return doc;
  };
  const manual = (code, feeCents, doctorFeeCents) =>
    ManualEntry.create({
      code, date: "2026-11-03", patientName: "Manual Patient", feeChargedCents: feeCents, company: "Acme", caseNumber: code,
      entry: { doctorFeeCents, paidStatus: "unpaid" },
    });

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([Appointment.deleteMany({}), CategoryConsultation.deleteMany({}), ManualEntry.deleteMany({}), User.deleteMany({}), Doctor.deleteMany({})]);
    patient = await User.create({ name: "Rachel", email: "rachel@x.co", password: "SecretPw1!", country: "DE" });
    doctor = await Doctor.create({ name: "Martin Perlin", email: "martin@x.co", password: "SecretPw1!" });
  });

  describe("rows", () => {
    test("each row says which currency it is in; a booking with none stored is USD; manual entries are USD", async () => {
      await appt(1, undefined, 10); // an old booking: no paymentCurrency stored in the document
      await Appointment.collection.updateMany({}, { $unset: { paymentCurrency: "" } });
      await appt(2, "eur", 30);
      await appt(3, "gbp", 25);
      await cat(4, "eur", 30);
      await manual("M-1", 5000, 1000);

      const body = await listBookingEntries({ limit: "100" }, { role: "superadmin" });
      const byAmount = (cur, fee) => body.items.find((r) => r.currency === cur && r.feeChargedCents === fee);
      assert.ok(byAmount("usd", 1000), "the old booking is USD");
      assert.ok(byAmount("eur", 3000), "EUR appointment");
      assert.ok(byAmount("gbp", 2500), "GBP appointment");
      assert.equal(body.items.filter((r) => r.currency === "eur").length, 2, "EUR appointment + EUR category consultation");
      assert.equal(body.items.find((r) => r.kind === "manual").currency, "usd");
      assert.ok(body.items.every((r) => ["usd", "eur", "gbp"].includes(r.currency)));
    });

    test("the grey 75% hint names the booking's own currency", async () => {
      await appt(1, "eur", 30);
      await appt(2, "gbp", 30);
      await appt(3, "usd", 30);
      const body = await listBookingEntries({ limit: "100" });
      const title = (cur) => body.items.find((r) => r.currency === cur).placeholder.title;
      assert.equal(title("eur"), "75% of €30.00 paid");
      assert.equal(title("gbp"), "75% of £30.00 paid");
      assert.equal(title("usd"), "75% of $30.00 paid");
      assert.equal(doctorFeePlaceholder(3000).title, "75% of $30.00 paid"); // default stays USD
      assert.equal(formatMoneyCents(2550, "gbp"), "£25.50");
      assert.equal(formatMoneyCents(2550, "inr"), "$25.50"); // anything else is shown as USD
    });
  });

  describe("totals and the money boxes are per currency and never added across currencies", () => {
    beforeEach(async () => {
      await appt(1, "usd", 10, { entry: { doctorFeeCents: 750 } }); // $10, doctor $7.50 (unpaid)
      await appt(2, "eur", 30, { entry: { doctorFeeCents: 2250 } }); // EUR 30, doctor 22.50
      await cat(3, "eur", 30); // EUR 30, no doctor fee saved yet
      await appt(4, "gbp", 25, { entry: { doctorFeeCents: 1800, paidStatus: "paid" } }); // GBP 25, doctor 18.00 (paid)
      await manual("M-1", 5000, 4000); // $50, doctor $40 (USD only)
    });

    test("totals: fee charged and doctor fee per currency, rows as a count", async () => {
      const { totals } = await listBookingEntries({ limit: "100" }, { role: "superadmin" });
      assert.equal(totals.rows, 5);
      assert.deepEqual(totals.byCurrency, {
        usd: { feeChargedCents: 1000 + 5000, doctorFeeCents: 750 + 4000 },
        eur: { feeChargedCents: 3000 + 3000, doctorFeeCents: 2250 },
        gbp: { feeChargedCents: 2500, doctorFeeCents: 1800 },
      });
      // Nothing carries a mixed number: no bucket equals the sum of the others.
      const all = Object.values(totals.byCurrency).reduce((sum, b) => sum + b.feeChargedCents, 0);
      for (const bucket of Object.values(totals.byCurrency)) assert.notEqual(bucket.feeChargedCents, all);
      // Old readers keep working: the flat fields are still there and hold the USD amounts (never a mixed total).
      assert.deepEqual(Object.keys(totals).sort(), ["byCurrency", "doctorFeeCents", "feeChargedCents", "rows"]);
      assert.equal(totals.feeChargedCents, totals.byCurrency.usd.feeChargedCents);
      assert.equal(totals.doctorFeeCents, totals.byCurrency.usd.doctorFeeCents);
      assert.notEqual(totals.feeChargedCents, all, "the flat total is USD only, not a mix");
    });

    test("the money boxes: received, to pay, paid and margin per currency (super admin only)", async () => {
      const { summary, counts } = await listBookingEntries({ limit: "100" }, { role: "superadmin" });
      assert.deepEqual(summary.byCurrency.usd, { toPayCents: 750 + 4000, paidCents: 0, receivedCents: 1000, marginCents: 6000 - 4750 }); // received = what the booking paid ($10); a manual entry counts only once its company payment is received; margin = billed $60 - doctor fees $47.50
      assert.deepEqual(summary.byCurrency.eur, { toPayCents: 2250, paidCents: 0, receivedCents: 6000, marginCents: 6000 - 2250 });
      assert.deepEqual(summary.byCurrency.gbp, { toPayCents: 0, paidCents: 1800, receivedCents: 2500, marginCents: 2500 - 1800 });
      assert.equal(summary.feeNotEnteredCount, 1, "the EUR category consultation has no doctor fee yet");
      assert.deepEqual(Object.keys(summary).sort(), ["byCurrency", "feeNotEnteredCount", "marginCents", "paidCents", "receivedCents", "toPayCents"]);
      for (const k of ["toPayCents", "paidCents", "receivedCents", "marginCents"]) assert.equal(summary[k], summary.byCurrency.usd[k], k + " is the USD amount");
      assert.equal(counts.all, 5, "tab counts are plain row counts");

      const asAdmin = await listBookingEntries({ limit: "100" }, { role: "admin" });
      assert.equal("summary" in asAdmin, false);
    });

    test("the totals follow the tab and the filters, still per currency", async () => {
      const paid = await listBookingEntries({ tab: "paid", limit: "100" });
      assert.equal(paid.totals.rows, 1);
      assert.deepEqual(paid.totals.byCurrency.gbp, { feeChargedCents: 2500, doctorFeeCents: 1800 });
      assert.deepEqual(paid.totals.byCurrency.eur, { feeChargedCents: 0, doctorFeeCents: 0 });
      const autoOnly = await listBookingEntries({ view: "auto", limit: "100" }, { role: "superadmin" });
      assert.deepEqual(autoOnly.totals.byCurrency.usd, { feeChargedCents: 1000, doctorFeeCents: 750 });
    });

    test("the USD bucket is always there (zeros when there is nothing), so a USD-only screen is unchanged", async () => {
      await Promise.all([Appointment.deleteMany({}), CategoryConsultation.deleteMany({}), ManualEntry.deleteMany({})]);
      const { totals, summary } = await listBookingEntries({ limit: "100" }, { role: "superadmin" });
      assert.deepEqual(totals.byCurrency.usd, { feeChargedCents: 0, doctorFeeCents: 0 });
      assert.deepEqual(summary.byCurrency.usd, { toPayCents: 0, paidCents: 0, receivedCents: 0, marginCents: 0 });
    });
  });

  describe("CSV", () => {
    test("Currency is the LAST column of the full export, and no existing column moved", () => {
      assert.equal(COLUMNS[COLUMNS.length - 1], "Currency");
      assert.equal(COLUMNS[COLUMNS.length - 2], "Feedback received");
      assert.equal(COLUMNS.indexOf("Fee charged"), 13);
      assert.equal(COLUMNS.indexOf("Amount paid"), 14);
      assert.equal(COLUMNS.indexOf("Doctor fee"), 15);
      assert.equal(COLUMNS.indexOf("Testing"), 20);
      assert.equal(COLUMNS.indexOf("Company"), 21);
      assert.equal(COLUMNS.length, 38); // the 37 that existed + Currency
    });

    test("the Auto export ends with Currency too, and the manual sheet export is unchanged", () => {
      assert.equal(AUTO_COLUMNS[AUTO_COLUMNS.length - 1], "Currency");
      assert.equal(AUTO_COLUMNS[AUTO_COLUMNS.length - 2], "Testing");
      assert.equal(AUTO_COLUMNS.indexOf("Fee charged"), 13);
      assert.equal(MANUAL_COLUMNS.includes("Currency"), false);
    });

    test("each line names its currency; money stays plain numbers", async () => {
      await appt(1, "eur", 30, { entry: { doctorFeeCents: 2250 } });
      await appt(2, "gbp", 25);
      await appt(3, "usd", 10);
      await manual("M-9", 5000, 4000);

      const all = parseCsv(buildEntriesCsv((await listAllEntryRows({})).rows));
      const eur = all.records.find((r) => r["Currency"] === "EUR");
      assert.deepEqual([eur["Fee charged"], eur["Amount paid"], eur["Doctor fee"]], ["30.00", "30.00", "22.50"]);
      assert.equal(all.records.find((r) => r["Currency"] === "GBP")["Fee charged"], "25.00");
      assert.equal(all.records.filter((r) => r["Currency"] === "USD").length, 2, "the USD booking and the manual entry");
      assert.equal(all.head[all.head.length - 1], "Currency");

      const auto = parseCsv(buildEntriesCsv((await listAllEntryRows({ view: "auto" })).rows, "auto"));
      assert.equal(auto.head[auto.head.length - 1], "Currency");
      assert.equal(auto.records.find((r) => r["Currency"] === "EUR")["Fee charged"], "30.00");
    });
  });

  describe("Appointments list", () => {
    test("rows carry the currency, and so does a single row loaded after an action", async () => {
      const a = await appt(1, "gbp", 25);
      await appt(2, "eur", 30);
      await appt(3, undefined, 10);
      await Appointment.collection.updateMany({ consultationPrice: 10 }, { $unset: { paymentCurrency: "" } });

      const { items } = await listAdminBookings({ limit: "50" });
      assert.deepEqual(items.map((r) => [r.fee, r.currency]).sort(), [[10, "usd"], [25, "gbp"], [30, "eur"]]);
      assert.equal((await loadAdminBookingRowById(a._id)).currency, "gbp");
    });
  });
});
