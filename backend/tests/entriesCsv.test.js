const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const ManualEntry = require("../models/ManualEntry");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const adminEntries = require("../routes/adminEntries");
const { entriesViewAccess } = require("../middleware/verifyToken");
const { COLUMNS, buildEntriesCsv } = require("../utils/bookingEntryCsv");
const { listAllEntryRows } = require("../utils/bookingEntryList");
const M = require("../utils/manualEntry");

const NOW = Date.UTC(2026, 9, 26, 22, 0); // 2026-10-27 in India

// A small RFC 4180 reader, so the tests see what a spreadsheet would.
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
    else if (ch === ",") { row.push(cell); cell = ""; } else if (ch === "\r") { /* CRLF */ } else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...data] = rows;
  return { head, records: data.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]]))) };
}

describe("appointment entries: the CSV", () => {
  let mongod, server, base, patient, adminUser, doctor, enrollment;

  const fakeAuth = (req, res, next) => {
    const role = req.headers["x-test-role"];
    if (!role) return res.status(401).json({ msg: "No token provided." });
    req.user = { id: String(adminUser._id), role };
    next();
  };
  const download = async (query = "", role = "admin") => {
    const res = await fetch(`${base}/export.csv${query ? `?${query}` : ""}`, { headers: role ? { "x-test-role": role } : {} });
    return { status: res.status, headers: res.headers, text: await res.text() };
  };
  const csv = async (query) => parseCsv((await download(query)).text);
  const appt = (extra = {}) =>
    Appointment.create({
      patientId: patient._id, doctorId: doctor._id, date: "2026-11-01", time: "10:00 AM", bookedAt: new Date(Date.UTC(2026, 9, 10, 8, 5)), status: "confirmed",
      paymentStatus: "paid", paymentAmount: 9900, consultationPrice: 99, ...extra,
    });
  const manual = (form = {}, entry = {}, extra = {}) => {
    const v = M.validateManualCreate({ patientName: "Ravi Sharma", country: "India", date: "2026-11-03", serviceProvider: "Martin Perlin", consultationFee: "49", ...form }, { today: "2026-10-27" });
    const built = M.buildManualDocument(v.value, { actor: { id: adminUser._id, name: "An Admin", role: "admin" }, code: M.newCode(), now: new Date(NOW), today: "2026-10-27" });
    return ManualEntry.create({ ...built.doc, ...extra, entry: { ...built.doc.entry, ...entry } });
  };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await ManualEntry.init();
    const app = express();
    app.use(express.json());
    app.use("/api/admin/entries", adminEntries.create({ guard: [fakeAuth, entriesViewAccess], now: () => NOW }));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}/api/admin/entries`;
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([Appointment.deleteMany({}), CategoryConsultation.deleteMany({}), ManualEntry.deleteMany({}), User.deleteMany({}), Doctor.deleteMany({}), Enrollment.deleteMany({})]);
    patient = await User.create({ name: "Rachel Secemski", email: "rachel@x.co", password: "SecretPw1!", country: "US" });
    adminUser = await User.create({ name: "An Admin", email: "admin@x.co", password: "SecretPw1!" });
    doctor = await Doctor.create({ name: "Martin Perlin", email: "martin@x.co", password: "SecretPw1!" });
    enrollment = await Enrollment.create({ firstName: "Martin", surname: "Perlin", doctorId: doctor._id, email: "n@x.co", approvalStatus: "approved" });
  });

  test("it is a real download: a CSV with a dated file name, no caching, and the columns in order", async () => {
    await appt();
    const res = await download();
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /^text\/csv; charset=utf-8/);
    assert.equal(res.headers.get("content-disposition"), 'attachment; filename="entries-2026-10-27.csv"');
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.deepEqual([res.headers.get("x-export-rows"), res.headers.get("x-export-truncated")], ["1", "false"]);
    // fetch's text() drops a byte order mark, so look at the raw bytes.
    const raw = new Uint8Array(await (await fetch(`${base}/export.csv`, { headers: { "x-test-role": "admin" } })).arrayBuffer());
    assert.deepEqual([...raw.slice(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.ok(res.text.endsWith("\r\n"));
    assert.deepEqual(parseCsv(res.text).head, COLUMNS);
  });

  test("a booking line carries the source columns, the money as numbers, and only a SAVED doctor fee", async () => {
    const a = await appt({ source: { platform: "android", appVersion: "1.0.0+16", sourceType: "doctor_profile", sourceName: "Dr Rao" }, entry: { doctorFeeCents: 7425, paidStatus: "paid", paidOn: "2026-10-20", comment: "bank, ref 12", doctorAtEntry: String(doctor._id) } });
    await appt({ date: "2026-10-01" }); // no doctor fee typed: the 75% suggestion must not appear
    const { records } = await csv("sort=consultation");
    const paid = records.find((r) => r["Booking ID"] === String(a._id));
    assert.deepEqual(
      [paid.Source, paid.Platform, paid["Source page type"], paid["Source page name"], paid["Booked (UTC)"], paid["Consultation date"], paid["Consultation time"], paid.Patient, paid.Country, paid.Doctor],
      ["App", "Android (v1.0.0+16)", "Doctor profile", "Dr Rao", "2026-10-10 08:05", "2026-11-01", "10:00 AM", "Rachel Secemski", "United States", "Martin Perlin"],
    );
    assert.deepEqual(
      [paid["Doctor changed"], paid["Fee charged"], paid["Amount paid"], paid["Doctor fee"], paid["Paid status"], paid["Paid on"], paid.Comment, paid.Testing],
      ["No", "99.00", "99.00", "74.25", "Paid", "2026-10-20", "bank, ref 12", "No"],
    );
    const unsaved = records.find((r) => r["Booking ID"] !== String(a._id));
    assert.deepEqual([unsaved["Doctor fee"], unsaved["Paid status"]], ["", "Unpaid"]);
  });

  test("a manual line: Source is Manual, the id is M-XXXX, the status is Manual", async () => {
    const m = await manual({}, { doctorFeeCents: 3675, paidStatus: "on_hold" });
    const { records } = await csv();
    assert.equal(records.length, 1);
    const r = records[0];
    assert.deepEqual([r["Booking ID"], r.Source, r.Platform, r["Source page type"], r["Booking status"], r["Paid status"], r["Doctor fee"], r["Fee charged"]], [`M-${m.code}`, "Manual", "", "", "Manual", "On hold", "36.75", "49.00"]);
    assert.deepEqual([r.Patient, r.Country, r.Doctor, r["Consultation date"], r["Consultation time"]], ["Ravi Sharma", "India", "Martin Perlin", "2026-11-03", ""]);
  });

  test("a manual line carries every new field of the form as its own column, with the margin worked out", async () => {
    await manual({
      company: "Acme Assist", caseNumber: "AC-1042", serviceType: "others", otherService: "Physio at home", caseStatus: "in_progress",
      providerNumber: "+91 98765 43210", contactNumber: "(022) 5550 1234", consultationFee: "100", doctorFee: "65", mrStatus: "received",
      mrSentToCompany: "sent", invoiceSent: "sent", paymentReceived: "partly_received", paymentReceivedDate: "2026-10-20",
      feedbackSent: "Please rate" + String.fromCharCode(10) + "us", feedbackReceived: "Great, thanks", comment: "note",
    });
    const { records } = await csv();
    const r = records[0];
    assert.deepEqual(
      [r.Company, r["Case number"], r["Type of service"], r["Other service"], r["Case status"], r["Service provider number"], r["Contact number"]],
      ["Acme Assist", "AC-1042", "Others", "Physio at home", "In progress", "'+91 98765 43210", "(022) 5550 1234"],
    );
    assert.deepEqual([r["Fee charged"], r["Doctor fee"], r["Calculation (our margin)"], r["Calculation (% of consultation fee)"], r.Comment], ["100.00", "65.00", "35.00", "35.0", "note"]);
    assert.deepEqual(
      [r["MR status"], r["MR sent to company"], r["Invoice sent"], r["Payment received"], r["Payment received date"], r["Feedback message sent"], r["Feedback received"]],
      ["Received", "Sent", "Sent", "Partly received", "2026-10-20", "Please rate" + String.fromCharCode(10) + "us", "Great, thanks"],
    );
  });

  test("a negative margin comes out negative, and a booking line has the new columns empty", async () => {
    await manual({ consultationFee: "40", doctorFee: "55" });
    await appt();
    const { records } = await csv("sort=-bookedAt");
    const manualLine = records.find((r) => r.Source === "Manual");
    assert.deepEqual([manualLine["Calculation (our margin)"], manualLine["Calculation (% of consultation fee)"]], ["-15.00", "-37.5"]);
    const booking = records.find((r) => r.Source !== "Manual");
    // (Currency is the last column and is never empty: a booking row says which currency its money is in.)
    for (const column of COLUMNS.slice(COLUMNS.indexOf("Company"), COLUMNS.indexOf("Currency"))) assert.equal(booking[column], "", column);
    assert.equal(booking["Currency"], "USD");
  });

  test("it follows the list's tab, search, doctor and month filters, and leaves deleted manual rows out", async () => {
    await appt({ date: "2026-11-05" });
    await manual({ patientName: "Hold Person", date: "2026-10-12" }, { paidStatus: "on_hold" });
    const gone = await manual({ patientName: "Gone Person" });
    await ManualEntry.updateOne({ _id: gone._id }, { $set: { deletedAt: new Date() } });
    assert.equal((await csv()).records.length, 2);
    assert.deepEqual((await csv("tab=on_hold")).records.map((r) => r.Patient), ["Hold Person"]);
    assert.deepEqual((await csv("q=hold")).records.map((r) => r.Patient), ["Hold Person"]);
    assert.deepEqual((await csv("month=2026-10")).records.map((r) => r.Patient), ["Hold Person"]);
    assert.equal((await csv(`doctor=${enrollment._id}`)).records.length, 2);
    assert.equal((await csv(`doctor=${new mongoose.Types.ObjectId()}`)).records.length, 0);
    assert.equal((await csv("q=Gone")).records.length, 0);
  });

  test("there is no paging: every matching row comes, in the list's order", async () => {
    for (let i = 1; i <= 30; i += 1) await appt({ date: `2026-11-${String(i).padStart(2, "0")}` });
    for (let i = 1; i <= 5; i += 1) await manual({ patientName: `Man ${i}`, date: `2026-12-0${i}` });
    const { records } = await csv("page=2&limit=5");
    assert.equal(records.length, 35);
    const dates = records.map((r) => r["Consultation date"]);
    assert.deepEqual(dates, [...dates].sort().reverse());
  });

  test("text that could run as a spreadsheet formula is made plain, and commas, quotes and line breaks are quoted", async () => {
    await manual({ patientName: "=HYPERLINK(\"http://x\")", comment: "line one\nline \"two\", three" });
    await manual({ patientName: "+1 call", comment: "@home", country: "-" }, {}, {});
    const { records } = await csv("sort=-bookedAt");
    const names = records.map((r) => r.Patient).sort();
    assert.deepEqual(names, ["'+1 call", "'=HYPERLINK(\"http://x\")"]);
    const withBreak = records.find((r) => r.Patient.startsWith("'="));
    assert.equal(withBreak.Comment, 'line one\nline "two", three');
    assert.equal(records.find((r) => r.Patient.startsWith("'+")).Comment, "'@home");
  });

  test("a bad query is a 400; the payment admin and other roles get 403; no token is 401", async () => {
    assert.equal((await download("tab=bogus")).status, 400);
    assert.equal((await download("month=2026-13")).status, 400);
    for (const role of ["paymentadmin", "user", "doctor", "employeeadmin", "partner"]) assert.equal((await download("", role)).status, 403, role);
    assert.equal((await download("", "")).status, 401);
    assert.equal((await download("", "superadmin")).status, 200);
  });

  test("a huge result is cut at the cap and says so", async () => {
    for (let i = 1; i <= 7; i += 1) await manual({ patientName: `Man ${i}`, date: `2026-11-0${i}` });
    const cut = await listAllEntryRows({}, 4);
    assert.deepEqual([cut.rows.length, cut.total, cut.truncated], [4, 7, true]);
    const whole = await listAllEntryRows({}, 7);
    assert.deepEqual([whole.rows.length, whole.truncated], [7, false]);
    assert.equal(buildEntriesCsv([]), `﻿${COLUMNS.join(",")}\r\n`);
  });
});
