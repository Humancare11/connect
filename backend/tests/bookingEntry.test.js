const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const { feeOf } = require("../utils/adminBookingList");
const E = require("../utils/bookingEntry");

const TODAY = "2026-10-24";
const SUPER = { id: "64b000000000000000000001", name: "Super Admin", email: "superadmin@humancare.com", role: "superadmin" };
const PAYMENT = { id: "64b000000000000000000002", name: "Pay Admin", email: "pay@humancare.com", role: "paymentadmin" };
const ADMIN = { id: "64b000000000000000000003", name: "An Admin", email: "admin@gmail.com", role: "admin" };
const DOCTOR = "64b0000000000000000000d1";
const ctx = (extra = {}) => ({ hasDoctor: true, doctorId: DOCTOR, today: TODAY, actor: SUPER, now: new Date("2026-10-24T10:00:00Z"), ...extra });
const edit = (field, value, entry, extra) => E.applyEntryEdit(entry, { field, value }, ctx(extra));

describe("money", () => {
  test("typed amounts become whole cents; anything that is not a plain amount is refused", () => {
    const good = [["12", 1200], ["12.5", 1250], ["12.50", 1250], [" $12.50 ", 1250], ["0", 0], ["0.01", 1], ["74.25", 7425], [74.25, 7425], [0, 0], ["1000000", 100000000], ["1000000.00", 100000000]];
    for (const [input, cents] of good) assert.equal(E.parseFeeToCents(input), cents, String(input));
    for (const empty of [null, undefined, "", "   ", "$"]) {
      // empty clears the fee; a lone "$" is not an amount
      assert.equal(E.parseFeeToCents(empty), empty === "$" ? undefined : null, JSON.stringify(empty));
    }
    for (const bad of ["-1", "-0.5", "1.234", "1,000", "12abc", "abc", "1e3", "1000000.01", "10000000", "1.", ".5", 12.345, -3, NaN, Infinity, {}, [], true]) {
      assert.equal(E.parseFeeToCents(bad), undefined, JSON.stringify(bad));
    }
  });

  test("cents print with two decimals", () => {
    assert.equal(E.centsToFixed(7425), "74.25");
    assert.equal(E.centsToFixed(0), "0.00");
    assert.equal(E.centsToFixed(5), "0.05");
    assert.equal(E.centsToFixed(null), "");
  });

  test("the automatic doctor share is the same 75% rule getDoctorPayments uses", () => {
    assert.equal(E.defaultDoctorShareCents(9900), 7425); // $99.00 -> 74.25
    assert.equal(E.defaultDoctorShareCents(500), 375);
    assert.equal(E.defaultDoctorShareCents(100), 75);
    assert.equal(E.defaultDoctorShareCents(10000), 7500);
    for (const nothing of [0, -5, NaN, null, undefined]) assert.equal(E.defaultDoctorShareCents(nothing), null);
    // The same arithmetic as the controller, over a range of amounts (it keeps Math.round(25%) and pays the rest).
    for (let cents = 1; cents <= 20000; cents += 7) {
      assert.equal(E.defaultDoctorShareCents(cents), Math.max(0, cents - Math.round(cents * 0.25)), String(cents));
    }
    // ...and it is still the rule written in the controller (this fails if that rule is changed there without here).
    const controller = fs.readFileSync(path.join(__dirname, "..", "controllers", "adminController.js"), "utf8");
    assert.match(controller, /const PLATFORM_RATE = 0\.25;/);
    assert.match(controller, /const platformFee = Math\.round\(consultationAmount \* PLATFORM_RATE\);/);
    assert.match(controller, /const baseDoctorShare = Math\.max\(0, consultationAmount - platformFee\);/);
    assert.equal(E.PLATFORM_RATE, 0.25);
  });

  test("the grey placeholder is 75% of what was PAID, with a tooltip, and nothing when nothing was paid", () => {
    assert.deepEqual(E.doctorFeePlaceholder(9900), { cents: 7425, text: "75% · 74.25", title: "75% of $99.00 paid" });
    assert.deepEqual(E.doctorFeePlaceholder(149900), { cents: 112425, text: "75% · 1124.25", title: "75% of $1,499.00 paid" });
    assert.equal(E.doctorFeePlaceholder(500).title, "75% of $5.00 paid");
    for (const nothing of [0, -1, null, undefined, NaN]) assert.equal(E.doctorFeePlaceholder(nothing), null);
    assert.equal(E.formatUsdCents(100000000), "$1,000,000.00");
  });

  test("the fee charged in cents follows the same rule as the Appointments list (price first, else payment / 100)", () => {
    assert.equal(E.dollarsToCents(feeOf({ consultationPrice: 99 })), 9900);
    assert.equal(E.dollarsToCents(feeOf({ consultationPrice: 0, paymentAmount: 500 })), 500);
    assert.equal(E.dollarsToCents(feeOf({})), 0);
    assert.equal(E.dollarsToCents(12.34), 1234);
    assert.equal(E.dollarsToCents("abc"), 0);
  });
});

describe("who can do what", () => {
  test("admin, super admin and payment admin can look; only super admin and payment admin can edit", () => {
    for (const role of ["admin", "superadmin", "paymentadmin"]) assert.equal(E.canViewEntries(role), true, role);
    for (const role of ["superadmin", "paymentadmin"]) assert.equal(E.canEditEntries(role), true, role);
    for (const role of ["admin", "employeeadmin", "partner", "doctor", "user", "", undefined]) {
      assert.equal(E.canEditEntries(role), false, String(role));
    }
    for (const role of ["employeeadmin", "partner", "doctor", "user", "", undefined]) assert.equal(E.canViewEntries(role), false, String(role));
  });

  test("an edit by an admin is refused (the server checks it too, not just the screen)", () => {
    const r = edit("comment", "hello", undefined, { actor: ADMIN });
    assert.deepEqual([r.ok, r.status, r.code], [false, 403, "forbidden"]);
    assert.equal(edit("comment", "hello", undefined, { actor: null }).status, 403);
    assert.equal(edit("comment", "hello", undefined, { actor: PAYMENT }).ok, true);
  });
});

describe("one edit", () => {
  test("the doctor fee: valid amounts are stored as cents and recorded with who and when", () => {
    const r = edit("doctorFee", "74.25", undefined);
    assert.equal(r.ok, true);
    assert.equal(r.noop, false);
    assert.deepEqual(r.changes, [{ field: "doctorFee", from: "", to: "74.25" }]);
    assert.equal(r.set["entry.doctorFeeCents"], 7425);
    assert.equal(r.set["entry.doctorAtEntry"], DOCTOR);
    assert.equal(r.set["entry.edits.doctorFee"].by.name, "Super Admin");
    assert.equal(r.set["entry.edits.doctorFee"].by.role, "superadmin");
    assert.deepEqual(r.history.map((h) => [h.field, h.from, h.to, h.by.email]), [["doctorFee", "", "74.25", "superadmin@humancare.com"]]);
    assert.equal(r.entry.doctorFeeCents, 7425);
  });

  test("an invalid fee is a 400 with a reason and writes nothing", () => {
    for (const bad of ["-1", "abc", "1.234", "99999999"]) {
      const r = edit("doctorFee", bad, undefined);
      assert.deepEqual([r.ok, r.status, r.code], [false, 400, "invalid_fee"], bad);
    }
  });

  test("clearing the fee empties it (null, not 0), unless the row is Paid", () => {
    const r = edit("doctorFee", "", { doctorFeeCents: 500, paidStatus: "unpaid" });
    assert.equal(r.ok, true);
    assert.equal(r.set["entry.doctorFeeCents"], null);
    assert.deepEqual(r.changes, [{ field: "doctorFee", from: "5.00", to: "" }]);
    const paid = edit("doctorFee", "", { doctorFeeCents: 500, paidStatus: "paid", paidOn: TODAY });
    assert.deepEqual([paid.ok, paid.status, paid.code], [false, 409, "fee_required"]);
    assert.equal(edit("doctorFee", "0", { doctorFeeCents: 500, paidStatus: "paid", paidOn: TODAY }).code, "fee_required");
    assert.equal(edit("doctorFee", "0", { doctorFeeCents: 500, paidStatus: "unpaid" }).ok, true, "0 is allowed on a row that is not Paid");
  });

  test("an unchanged value is a no-op: nothing to write, nothing in the history", () => {
    const r = edit("doctorFee", "5", { doctorFeeCents: 500 });
    assert.deepEqual([r.ok, r.noop, r.changes.length, Object.keys(r.set).length, r.history.length], [true, true, 0, 0, 0]);
    assert.equal(edit("comment", "same", { comment: "same" }).noop, true);
    assert.equal(edit("paidStatus", "unpaid", undefined).noop, true);
    assert.equal(edit("paidOn", "", undefined).noop, true);
  });

  test("Paid needs a doctor, a fee above 0, and fills today's date when Paid on is empty", () => {
    assert.deepEqual(
      (({ ok, status, code }) => [ok, status, code])(edit("paidStatus", "paid", { doctorFeeCents: 500 }, { hasDoctor: false })),
      [false, 409, "doctor_required"],
    );
    for (const entry of [undefined, { doctorFeeCents: null }, { doctorFeeCents: 0 }]) {
      const r = edit("paidStatus", "paid", entry);
      assert.deepEqual([r.ok, r.status, r.code], [false, 409, "fee_required"], JSON.stringify(entry));
    }
    const ok = edit("paidStatus", "paid", { doctorFeeCents: 7425 });
    assert.equal(ok.ok, true);
    assert.equal(ok.set["entry.paidStatus"], "paid");
    assert.equal(ok.set["entry.paidOn"], TODAY, "today is filled in");
    assert.deepEqual(ok.changes.map((c) => c.field), ["paidOn", "paidStatus"]);
    assert.equal(ok.set["entry.edits.paidOn"].by.name, "Super Admin");
    assert.equal(ok.set["entry.doctorAtEntry"], DOCTOR);
  });

  test("a Paid on that is already set is kept when the row becomes Paid", () => {
    const r = edit("paidStatus", "paid", { doctorFeeCents: 500, paidOn: "2026-10-01" });
    assert.equal(r.ok, true);
    assert.equal(r.set["entry.paidOn"], undefined);
    assert.deepEqual(r.changes.map((c) => c.field), ["paidStatus"]);
    assert.equal(r.entry.paidOn, "2026-10-01");
  });

  test("the other statuses need nothing, with or without a doctor, and keep the date", () => {
    for (const status of ["on_hold", "not_payable", "unpaid"]) {
      assert.equal(edit("paidStatus", status, undefined, { hasDoctor: false }).ok, true, status);
    }
    const back = edit("paidStatus", "on_hold", { doctorFeeCents: 500, paidStatus: "paid", paidOn: "2026-10-01" });
    assert.equal(back.ok, true);
    assert.equal(back.entry.paidOn, "2026-10-01");
    for (const bad of ["Paid", "done", "", null, undefined, 1]) assert.equal(edit("paidStatus", bad, undefined).code, "invalid_status", String(bad));
  });

  test("Paid on: a real date, in range, and a Paid row can't lose it", () => {
    assert.equal(edit("paidOn", "2026-10-20", undefined).set["entry.paidOn"], "2026-10-20");
    assert.equal(edit("paidOn", TODAY, undefined).ok, true);
    assert.equal(edit("paidOn", "2026-10-25", undefined).ok, true, "tomorrow is allowed (time zones)");
    for (const bad of ["2026-02-30", "2026-13-01", "10/18/2026", "yesterday", "2026-10-26", "1999-12-31", "2026-1-5"]) {
      assert.equal(edit("paidOn", bad, undefined).code, "invalid_date", bad);
    }
    const r = edit("paidOn", "", { doctorFeeCents: 500, paidStatus: "paid", paidOn: "2026-10-01" });
    assert.deepEqual([r.ok, r.status, r.code], [false, 409, "paid_on_required"]);
    assert.equal(edit("paidOn", "", { paidStatus: "on_hold", paidOn: "2026-10-01" }).ok, true);
  });

  test("the comment is trimmed, stripped of control characters and capped at 500", () => {
    assert.equal(edit("comment", "  Waiting for invoice  ", undefined).entry.comment, "Waiting for invoice");
    assert.equal(edit("comment", "a\u0000b\u0007c", undefined).entry.comment, "abc");
    assert.equal(edit("comment", "line one\nline two", undefined).entry.comment, "line one\nline two");
    assert.equal(edit("comment", "x".repeat(500), undefined).ok, true);
    assert.equal(edit("comment", "x".repeat(501), undefined).code, "comment_too_long");
    assert.equal(edit("comment", 5, undefined).code, "invalid_comment");
    assert.equal(edit("comment", null, { comment: "old" }).entry.comment, "", "null clears it");
  });

  test("only the four editable fields can be edited", () => {
    for (const field of ["version", "doctorFeeCents", "history", "entry", "", undefined, "isTesting"]) {
      assert.equal(E.applyEntryEdit(undefined, { field, value: 1 }, ctx()).code, "bad_field", String(field));
    }
    assert.equal(E.applyEntryEdit(undefined, undefined, ctx()).code, "bad_field");
  });

  test("a stored value that is junk reads as the defaults instead of breaking the rules", () => {
    const r = edit("paidStatus", "on_hold", { paidStatus: "weird", doctorFeeCents: "abc", comment: 5 });
    assert.equal(r.ok, true);
    assert.deepEqual(r.changes, [{ field: "paidStatus", from: "unpaid", to: "on_hold" }]);
  });

  test("the doctor the money was entered against is only remembered when there is money to remember", () => {
    assert.equal(edit("comment", "note", undefined).set["entry.doctorAtEntry"], undefined);
    assert.equal(edit("paidStatus", "on_hold", undefined).set["entry.doctorAtEntry"], undefined);
    assert.equal(edit("doctorFee", "5", undefined, { doctorId: "" }).set["entry.doctorAtEntry"], undefined);
  });
});

describe("reading an entry", () => {
  test("an old booking (no entry) reads as unpaid with nothing typed, plus the grey 75% suggestion", () => {
    const v = E.entryView(undefined, { paidCents: 9900, doctorId: DOCTOR });
    assert.deepEqual(
      { fee: v.doctorFeeCents, suggested: v.placeholder?.cents ?? null, status: v.paidStatus, on: v.paidOn, comment: v.comment, version: v.version, changed: v.doctorChanged },
      { fee: null, suggested: 7425, status: "unpaid", on: "", comment: "", version: 0, changed: false },
    );
    assert.deepEqual(v.edits, { doctorFee: null, paidStatus: null, paidOn: null, comment: null });
  });

  test("once a fee is typed the suggestion goes away (it was never stored)", () => {
    const v = E.entryView({ doctorFeeCents: 500, v: 3 }, { paidCents: 9900 });
    assert.equal(v.doctorFeeCents, 500);
    assert.equal(v.placeholder, null);
    assert.equal(v.version, 3);
    assert.equal(E.entryView({ doctorFeeCents: 0 }, { paidCents: 9900 }).placeholder, null, "0 is a typed value");
    assert.equal(E.entryView(undefined, { paidCents: 0 }).placeholder, null, "nothing paid, no placeholder");
    assert.equal(E.entryView(undefined, { paidCents: 9900 }).placeholder.title, "75% of $99.00 paid");
  });

  test("a different doctor now than when the fee was entered raises the flag", () => {
    assert.equal(E.entryView({ doctorFeeCents: 500, doctorAtEntry: DOCTOR }, { doctorId: "64b0000000000000000000d2" }).doctorChanged, true);
    assert.equal(E.entryView({ doctorFeeCents: 500, doctorAtEntry: DOCTOR }, { doctorId: DOCTOR }).doctorChanged, false);
    assert.equal(E.entryView({ doctorFeeCents: 500, doctorAtEntry: DOCTOR }, { doctorId: "" }).doctorChanged, false, "no doctor now is not a change of doctor");
    assert.equal(E.entryView({ doctorFeeCents: 500 }, { doctorId: DOCTOR }).doctorChanged, false);
  });

  test("who last changed a field is shown by name, falling back to email", () => {
    const at = new Date("2026-10-24T10:00:00Z");
    const v = E.entryView({ edits: { comment: { by: { name: "", email: "pay@humancare.com" }, at }, paidOn: { by: { name: "Super Admin" }, at } } });
    assert.deepEqual(v.edits.comment, { by: "pay@humancare.com", at });
    assert.deepEqual(v.edits.paidOn, { by: "Super Admin", at });
    assert.equal(v.edits.doctorFee, null);
  });

  test("tab filters: Unpaid also covers bookings with no entry at all", () => {
    assert.deepEqual(E.paidStatusMatch("all"), {});
    assert.deepEqual(E.paidStatusMatch("nonsense"), {});
    assert.deepEqual(E.paidStatusMatch("paid"), { "entry.paidStatus": "paid" });
    assert.deepEqual(E.paidStatusMatch("on_hold"), { "entry.paidStatus": "on_hold" });
    assert.deepEqual(E.paidStatusMatch("not_payable"), { "entry.paidStatus": "not_payable" });
    assert.equal(E.paidStatusMatch("unpaid").$or.length, 3);
    assert.deepEqual(E.ENTRY_TABS, ["all", "unpaid", "paid", "on_hold", "not_payable"]);
  });
});

describe("the fields on the two booking models", () => {
  let mongod;
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  test("both models carry the same entry fields with the same defaults", () => {
    for (const Model of [Appointment, CategoryConsultation]) {
      const entry = new Model({}).toObject().entry;
      assert.equal(entry.doctorFeeCents, null, Model.modelName);
      assert.equal(entry.paidStatus, "unpaid");
      assert.equal(entry.paidOn, "");
      assert.equal(entry.comment, "");
      assert.equal(entry.v, 0);
      assert.deepEqual(entry.history, []);
      assert.equal(entry.edits.paidStatus.at, null);
    }
  });

  test("the models refuse a bad status, a negative fee and a long comment", () => {
    for (const Model of [Appointment, CategoryConsultation]) {
      assert.ok(new Model({ entry: { paidStatus: "done" } }).validateSync()?.errors["entry.paidStatus"], Model.modelName);
      assert.ok(new Model({ entry: { doctorFeeCents: -1 } }).validateSync()?.errors["entry.doctorFeeCents"]);
      assert.ok(new Model({ entry: { comment: "x".repeat(501) } }).validateSync()?.errors["entry.comment"]);
    }
  });

  test("bookings saved before this feature (no entry in the database) are Unpaid in every tab count", async () => {
    // Raw inserts, so no defaults are applied: this is what an old document looks like.
    for (const name of ["appointments", "categoryconsultations"]) {
      await mongoose.connection.collection(name).insertMany([
        { marker: "old-1" },
        { marker: "old-2" },
        { marker: "paid", entry: { paidStatus: "paid" } },
        { marker: "hold", entry: { paidStatus: "on_hold" } },
        { marker: "new-default", entry: { paidStatus: "unpaid", doctorFeeCents: null } },
      ]);
    }
    for (const name of ["appointments", "categoryconsultations"]) {
      const count = (tab) => mongoose.connection.collection(name).countDocuments(E.paidStatusMatch(tab));
      assert.equal(await count("all"), 5, name);
      assert.equal(await count("unpaid"), 3, `${name}: two old documents and one new default are all Unpaid`);
      assert.equal(await count("paid"), 1);
      assert.equal(await count("on_hold"), 1);
      assert.equal(await count("not_payable"), 0);
    }
  });

  test("saving a booking through the model fills the entry defaults, and an edit's `set` applies cleanly to it", async () => {
    const appt = await Appointment.create({ patientId: new mongoose.Types.ObjectId(), doctorId: new mongoose.Types.ObjectId(), date: "2026-11-01", time: "10:00 AM", status: "confirmed" });
    const stored = await Appointment.findById(appt._id).lean();
    assert.equal(stored.entry.paidStatus, "unpaid");
    assert.equal(stored.entry.doctorFeeCents, null);

    const r = edit("doctorFee", "74.25", stored.entry, { doctorId: String(stored.doctorId) });
    assert.equal(r.ok, true);
    await Appointment.updateOne({ _id: appt._id }, { $set: r.set, $inc: { "entry.v": 1 }, $push: { "entry.history": { $each: r.history, $slice: -E.MAX_HISTORY } } });
    const after = await Appointment.findById(appt._id).lean();
    assert.equal(after.entry.doctorFeeCents, 7425);
    assert.equal(after.entry.v, 1);
    assert.equal(after.entry.edits.doctorFee.by.name, "Super Admin");
    assert.equal(after.entry.history.length, 1);
    assert.equal(after.entry.doctorAtEntry, String(stored.doctorId));

    // 55 further changes leave only the newest 50.
    for (let i = 0; i < 55; i += 1) {
      await Appointment.updateOne({ _id: appt._id }, { $push: { "entry.history": { $each: [{ field: "comment", from: String(i), to: String(i + 1), by: {}, at: new Date() }], $slice: -E.MAX_HISTORY } } });
    }
    const capped = await Appointment.findById(appt._id).lean();
    assert.equal(capped.entry.history.length, E.MAX_HISTORY);
    assert.equal(capped.entry.history.at(-1).to, "55");
  });
});
