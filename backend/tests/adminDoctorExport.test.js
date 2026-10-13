const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const ExcelJS = require("exceljs");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const adminDoctorExport = require("../routes/adminDoctorExport");
const { superAdminOnly } = require("../middleware/verifyToken");

describe("admin doctor export", () => {
  let mongod, server, base;

  // Stands in for verifyAdminToken: no header = unauthenticated. The REAL superAdminOnly runs after it.
  const fakeAuth = (req, res, next) => {
    const role = req.headers["x-test-role"];
    if (!role) return res.status(401).json({ msg: "No token provided." });
    req.user = { id: "admin1", role };
    next();
  };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([Doctor.init(), Enrollment.init()]);
    const app = express();
    app.use("/api/admin/doctors", adminDoctorExport.create({ guard: [fakeAuth, superAdminOnly] }));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}/api/admin/doctors/export`;
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([Doctor.deleteMany({}), Enrollment.deleteMany({})]);
    const mk = async (name, createdAt, enroll, extra = {}) => {
      const d = await Doctor.create({ name, email: `${name.toLowerCase()}@x.co`, password: "SecretPw1!", googleId: "g-secret", ...extra });
      await Doctor.collection.updateOne({ _id: d._id }, { $set: { createdAt } });
      if (enroll) {
        await Enrollment.create({
          doctorId: d._id, email: `${name.toLowerCase()}@x.co`, firstName: name, surname: "Doc",
          countryCode: "+91", phoneNumber: "9876543210", state: "Kerala", country: "IN",
          accountNumber: "ACCT-SECRET", paypalId: "paypal-secret", payoutEmail: "pay@secret.co", ...enroll,
        });
      }
      return d;
    };
    await mk("Old", new Date("2026-01-01"), { approvalStatus: "approved" });
    await mk("Newest", new Date("2026-03-01"), { approvalStatus: "approved" });
    await mk("Pending", new Date("2026-02-01"), { approvalStatus: "pending" });
    await mk("Disabled", new Date("2026-02-15"), { approvalStatus: "approved" }, { accountDisabled: true });
    await mk("Fresh", new Date("2026-02-20"), null);
  });

  const get = (qs, role = "superadmin") =>
    fetch(`${base}${qs}`, { headers: role ? { "x-test-role": role } : {} });

  async function sheet(res) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await res.arrayBuffer()));
    const ws = wb.worksheets[0];
    const rows = [];
    ws.eachRow((row) => rows.push(row.values.slice(1)));
    return { headers: rows[0], data: rows.slice(1) };
  }

  test("superadmin downloads all 3 variants as xlsx with dated filenames", async () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const [qs, name] of [
      ["?type=all&fields=full", `all_doctors_${today}.xlsx`],
      ["?type=active&fields=full", `active_doctors_full_${today}.xlsx`],
      ["?type=active&fields=basic", `active_doctors_basic_${today}.xlsx`],
    ]) {
      const res = await get(qs);
      assert.equal(res.status, 200, qs);
      assert.match(res.headers.get("content-type"), /spreadsheetml/);
      assert.ok(res.headers.get("content-disposition").includes(name), qs);
      const { data } = await sheet(res);
      assert.ok(data.length > 0);
    }
  });

  test("non-superadmin roles get 403, unauthenticated gets 401", async () => {
    for (const role of ["admin", "paymentadmin", "employeeadmin", "doctor", "user", "partner"]) {
      assert.equal((await get("?type=all&fields=full", role)).status, 403, role);
    }
    assert.equal((await get("?type=all&fields=full", null)).status, 401);
  });

  test("invalid params are rejected", async () => {
    for (const qs of ["", "?type=all", "?type=x&fields=full", "?type=active&fields=x", "?type=all&fields=basic"]) {
      assert.equal((await get(qs)).status, 400, qs);
    }
  });

  test("all export includes every account, newest first, with Enrollment Status", async () => {
    const { headers, data } = await sheet(await get("?type=all&fields=full"));
    const name = headers.indexOf("Name");
    const status = headers.indexOf("Enrollment Status");
    assert.deepEqual(data.map((r) => r[name]), ["Newest Doc", "Fresh", "Disabled Doc", "Pending Doc", "Old Doc"]);
    const byName = Object.fromEntries(data.map((r) => [r[name], r[status]]));
    assert.equal(byName.Fresh, "Not started");
    assert.equal(byName["Pending Doc"], "Pending");
    assert.equal(byName["Old Doc"], "Approved");
    const phone = headers.indexOf("Phone Number");
    assert.equal(data[0][phone], "+91 9876543210");
  });

  test("active export excludes pending, disabled and not-started doctors", async () => {
    const { headers, data } = await sheet(await get("?type=active&fields=full"));
    assert.deepEqual(data.map((r) => r[headers.indexOf("Name")]), ["Newest Doc", "Old Doc"]);
  });

  test("basic export has exactly the 4 columns", async () => {
    const { headers, data } = await sheet(await get("?type=active&fields=basic"));
    assert.deepEqual(headers, ["Name", "Phone Number", "Email", "State"]);
    assert.ok(data.every((r) => r.length === 4));
    assert.deepEqual(data[0], ["Newest Doc", "+91 9876543210", "newest@x.co", "Kerala"]);
  });

  test("no sensitive data appears in any export", async () => {
    const banned = ["secret", "SecretPw1", "$2a$", "$2b$", "password", "token", "ACCT-", "paypal", "ifsc"];
    for (const qs of ["?type=all&fields=full", "?type=active&fields=full", "?type=active&fields=basic"]) {
      const { headers, data } = await sheet(await get(qs));
      const text = JSON.stringify([headers, data]).toLowerCase();
      for (const word of banned) assert.ok(!text.includes(word.toLowerCase()), `${qs} leaked "${word}"`);
    }
  });
});
