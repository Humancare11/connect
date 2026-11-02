process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

// Stub S3, presigning, push and auth before the routes load, so the tests exercise only the
// medical-report logic. Role comes from the x-test-role header (admin routes) / x-test-user
// header (patient routes).
const calls = { puts: [], pushes: [] };
function stub(rel, exports) {
  const file = require.resolve(path.join("..", rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}
stub("config/s3", {
  s3Client: { send: async (command) => { calls.puts.push(command.input); return {}; } },
  getBucketName: () => "test-bucket",
});
stub("utils/s3PresignedUrl", { createS3PresignedGetUrl: async (key) => ({ url: `https://signed/${key}`, expiresAt: 0 }) });
stub("utils/pushNotifications", { sendPushToUser: async (userId, payload) => { calls.pushes.push({ userId: String(userId), ...payload }); } });
stub("middleware/verifyToken", {
  verifyAdminToken: (req, res, next) => {
    req.user = { id: req.headers["x-test-admin"], role: req.headers["x-test-role"] || "admin" };
    next();
  },
  adminOnly: (req, res, next) =>
    req.user.role === "admin" || req.user.role === "superadmin" ? next() : res.status(403).json({ msg: "Access denied. Admins only." }),
  verifyUserToken: (req, res, next) => {
    if (!req.headers["x-test-user"]) return res.status(401).json({ msg: "no token" });
    req.user = { id: req.headers["x-test-user"], role: "user" };
    next();
  },
  verifyDoctorToken: (req, res, next) => next(),
});

const User = require("../models/User");
const MedicalReport = require("../models/MedicalReport");
const adminRouter = require("../routes/adminMedicalReports");
const medicalRouter = require("../routes/medical");
const { getAllUsers } = require("../controllers/adminController");

const { resolveReportPrefix } = require("../utils/medicalReportService");

describe("S3 prefix is environment-aware", () => {
  test("MEDICAL_REPORT_S3_PREFIX wins in every environment (slashes trimmed)", () => {
    for (const NODE_ENV of ["production", "development", undefined]) {
      assert.equal(resolveReportPrefix({ NODE_ENV, MEDICAL_REPORT_S3_PREFIX: "/custom/prefix/" }), "custom/prefix");
    }
  });

  test("production uses medical-reports", () => {
    assert.equal(resolveReportPrefix({ NODE_ENV: "production" }), "medical-reports");
    assert.equal(resolveReportPrefix({ NODE_ENV: "production", MEDICAL_REPORT_S3_PREFIX: "  " }), "medical-reports");
  });

  test("everything else uses medical-reports-dev", () => {
    for (const NODE_ENV of ["development", "test", "staging", "", undefined]) {
      assert.equal(resolveReportPrefix({ NODE_ENV }), "medical-reports-dev", String(NODE_ENV));
    }
  });
});

const PDF = Buffer.from("%PDF-1.4\n%test\n");

describe("admin medical reports", () => {
  let mongod, server, base, admin, patient, otherPatient, doctorUser;

  const adminCall = async (method, url, body, headers = {}) => {
    const res = await fetch(`${base}${url}`, {
      method,
      headers: { "content-type": "application/json", "x-test-admin": String(admin._id), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  };

  const upload = async ({ buffer = PDF, type = "application/pdf", filename = "r.pdf", fields = {} } = {}) => {
    const form = new FormData();
    const all = { reportType: "uploaded", patientId: String(patient._id), title: "Lab result", reportDate: "2026-10-01", ...fields };
    for (const [k, v] of Object.entries(all)) if (v !== undefined) form.append(k, v);
    if (buffer) form.append("file", new Blob([buffer], { type }), filename);
    const res = await fetch(`${base}/api/admin/medical-reports`, { method: "POST", headers: { "x-test-admin": String(admin._id) }, body: form });
    return { status: res.status, body: await res.json() };
  };

  const generated = (extra = {}) =>
    adminCall("POST", "/api/admin/medical-reports", {
      reportType: "generated",
      patientId: String(patient._id),
      title: "Annual check-up",
      reportDate: "2026-10-01",
      diagnosis: "Mild hypertension",
      treatment: "Reduce salt intake",
      ...extra,
    });

  const patientCall = async (url, userId = patient._id) => {
    const res = await fetch(`${base}/api/medical${url}`, { headers: { "x-test-user": String(userId) } });
    return { status: res.status, body: await res.json() };
  };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    admin = await User.create({ name: "Admin A", email: "a@x.com", role: "admin" });
    doctorUser = await User.create({ name: "Dr Who", email: "d@x.com", role: "doctor" });
    patient = await User.create({ name: "Jane Patient", email: "jane@x.com", role: "user" });
    otherPatient = await User.create({ name: "Other Person", email: "other@x.com", role: "user" });

    const app = express();
    app.use(express.json());
    app.use("/api/admin/medical-reports", adminRouter);
    app.use("/api/medical", medicalRouter);
    app.get("/api/admin/users", getAllUsers);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await MedicalReport.deleteMany({});
    calls.puts.length = 0;
    calls.pushes.length = 0;
  });

  describe("issuing", () => {
    test("generated report: private prefix + SSE, encrypted at rest, generic push, no storage key leaked", async () => {
      const { status, body } = await generated();
      assert.equal(status, 201);
      assert.equal(calls.puts.length, 1);
      assert.match(calls.puts[0].Key, new RegExp(`^${resolveReportPrefix()}/${patient._id}/MR-\\d{6}\\.pdf$`));
      assert.equal(calls.puts[0].ServerSideEncryption, "AES256");
      assert.equal(calls.puts[0].ContentType, "application/pdf");
      assert.equal(calls.puts[0].Body.subarray(0, 5).toString("latin1"), "%PDF-");

      const row = await MedicalReport.findById(body.report._id).lean();
      assert.ok(row.cipherText);
      assert.ok(!JSON.stringify(row).includes("Mild hypertension"), "clinical text must not be stored in plaintext");
      assert.equal(row.issuedByRole, "admin");
      assert.equal(row.doctorName, "Issued by Humancare");
      assert.ok(!("pdfKey" in body.report));

      assert.equal(calls.pushes.length, 1);
      assert.equal(calls.pushes[0].body, "A new medical report is available");
      assert.ok(!JSON.stringify(calls.pushes[0]).includes("hypertension"));
    });

    test("admin detail returns the decrypted content", async () => {
      const created = await generated({ doctorName: "Dr Smith" });
      const { body } = await adminCall("GET", `/api/admin/medical-reports/${created.body.report._id}`);
      assert.equal(body.report.content.diagnosis, "Mild hypertension");
      assert.equal(body.report.doctorName, "Dr Smith");
    });

    test("generated report needs at least one clinical section", async () => {
      const { status } = await generated({ diagnosis: "", treatment: "" });
      assert.equal(status, 400);
      assert.equal(calls.puts.length, 0);
    });

    test("only patient accounts can receive a report", async () => {
      assert.equal((await generated({ patientId: String(doctorUser._id) })).status, 404);
      assert.equal((await generated({ patientId: String(admin._id) })).status, 404);
      assert.equal((await generated({ patientId: "nope" })).status, 400);
    });

    test("non-admin roles are refused", async () => {
      const res = await adminCall("POST", "/api/admin/medical-reports", { reportType: "generated" }, { "x-test-role": "doctor" });
      assert.equal(res.status, 403);
      const list = await adminCall("GET", "/api/admin/medical-reports", null, { "x-test-role": "paymentadmin" });
      assert.equal(list.status, 403);
    });
  });

  describe("PDF upload validation", () => {
    test("accepts a real PDF and stores it unchanged", async () => {
      const { status, body } = await upload();
      assert.equal(status, 201);
      assert.equal(body.report.reportType, "uploaded");
      assert.equal(body.report.originalFilename, "r.pdf");
      assert.ok(calls.puts[0].Body.equals(PDF));
    });

    test("rejects a non-PDF mimetype", async () => {
      const { status } = await upload({ type: "image/png", filename: "x.png" });
      assert.equal(status, 400);
      assert.equal(calls.puts.length, 0);
    });

    test("rejects a file that claims to be a PDF but is not", async () => {
      const { status, body } = await upload({ buffer: Buffer.from("<script>alert(1)</script>") });
      assert.equal(status, 400);
      assert.match(body.msg, /not a valid PDF/);
      assert.equal(calls.puts.length, 0);
    });

    test("rejects a PDF over 10 MB", async () => {
      const big = Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]);
      const { status } = await upload({ buffer: big });
      assert.equal(status, 413);
      assert.equal(calls.puts.length, 0);
    });

    test("requires the file, a title and a report date", async () => {
      assert.equal((await upload({ buffer: null })).status, 400);
      assert.equal((await upload({ fields: { title: "" } })).status, 400);
      assert.equal((await upload({ fields: { reportDate: "" } })).status, 400);
      assert.equal(calls.puts.length, 0);
    });

    test("clinical fields are optional for an upload", async () => {
      assert.equal((await upload({ fields: { diagnosis: undefined } })).status, 201);
    });
  });

  describe("void flow", () => {
    test("void needs a reason, is audited on the row, and cannot repeat", async () => {
      const id = (await generated()).body.report._id;
      assert.equal((await adminCall("POST", `/api/admin/medical-reports/${id}/void`, { reason: "" })).status, 400);

      const ok = await adminCall("POST", `/api/admin/medical-reports/${id}/void`, { reason: "Wrong patient details" });
      assert.equal(ok.status, 200);
      assert.equal(ok.body.report.status, "voided");

      const row = await MedicalReport.findById(id).lean();
      assert.equal(row.voidReason, "Wrong patient details");
      assert.equal(String(row.voidedBy), String(admin._id));
      assert.ok(row.voidedAt);

      assert.equal((await adminCall("POST", `/api/admin/medical-reports/${id}/void`, { reason: "again" })).status, 409);
    });

    test("patient sees the report as voided and cannot download it; admin still can", async () => {
      const id = (await generated()).body.report._id;
      await adminCall("POST", `/api/admin/medical-reports/${id}/void`, { reason: "Issued in error" });

      const list = await patientCall("/my-reports");
      assert.equal(list.body.length, 1);
      assert.equal(list.body[0].status, "voided");
      assert.ok(!("voidReason" in list.body[0]), "void reason is internal");

      assert.equal((await patientCall(`/my-reports/${id}/download`)).status, 403);
      assert.equal((await adminCall("GET", `/api/admin/medical-reports/${id}/download`)).status, 200);
    });

    test("there is no edit endpoint", async () => {
      const id = (await generated()).body.report._id;
      for (const method of ["PUT", "PATCH"]) {
        const res = await fetch(`${base}/api/admin/medical-reports/${id}`, {
          method,
          headers: { "content-type": "application/json", "x-test-admin": String(admin._id) },
          body: JSON.stringify({ title: "changed" }),
        });
        assert.equal(res.status, 404);
      }
    });
  });

  describe("soft delete", () => {
    test("hidden from the patient and the default list, kept in the database and S3", async () => {
      const id = (await generated()).body.report._id;
      assert.equal((await patientCall("/my-reports")).body.length, 1);

      assert.equal((await adminCall("DELETE", `/api/admin/medical-reports/${id}`)).status, 200);

      assert.equal((await patientCall("/my-reports")).body.length, 0);
      assert.equal((await patientCall(`/my-reports/${id}/download`)).status, 404);
      assert.equal((await adminCall("GET", "/api/admin/medical-reports")).body.reports.length, 0);
      assert.equal((await adminCall("GET", "/api/admin/medical-reports?includeDeleted=1")).body.reports.length, 1);

      const row = await MedicalReport.findById(id).lean();
      assert.equal(row.isDeleted, true);
      assert.equal(String(row.deletedBy), String(admin._id));
      assert.ok(row.deletedAt);
      assert.ok(row.pdfKey, "storage key is kept");
      assert.equal(calls.puts.length, 1, "no S3 delete is issued");
    });

    test("a deleted report cannot be voided or deleted again", async () => {
      const id = (await generated()).body.report._id;
      await adminCall("DELETE", `/api/admin/medical-reports/${id}`);
      assert.equal((await adminCall("POST", `/api/admin/medical-reports/${id}/void`, { reason: "late" })).status, 404);
      assert.equal((await adminCall("DELETE", `/api/admin/medical-reports/${id}`)).status, 404);
    });
  });

  describe("patient access", () => {
    test("a patient sees and downloads only their own reports", async () => {
      const mine = (await generated()).body.report._id;

      const own = await patientCall("/my-reports");
      assert.deepEqual(own.body.map((r) => r._id), [mine]);
      assert.ok(!("pdfKey" in own.body[0]));
      assert.equal((await patientCall(`/my-reports/${mine}/download`)).status, 200);

      assert.equal((await patientCall("/my-reports", otherPatient._id)).body.length, 0);
      assert.equal((await patientCall(`/my-reports/${mine}/download`, otherPatient._id)).status, 404);
    });

    test("an unauthenticated request is refused", async () => {
      const res = await fetch(`${base}/api/medical/my-reports`);
      assert.equal(res.status, 401);
    });
  });

  describe("patient picker (/api/admin/users?limit=)", () => {
    test("lists patient accounts only, with server-side search and paging", async () => {
      const all = await adminCall("GET", "/api/admin/users?limit=10");
      const emails = all.body.users.map((u) => u.email).sort();
      assert.deepEqual(emails, ["jane@x.com", "other@x.com"]);
      assert.equal(all.body.total, 2);
      assert.ok(all.body.users.every((u) => !("password" in u)));

      const found = await adminCall("GET", "/api/admin/users?limit=10&q=jane");
      assert.deepEqual(found.body.users.map((u) => u.email), ["jane@x.com"]);

      const paged = await adminCall("GET", "/api/admin/users?limit=1&page=2");
      assert.equal(paged.body.users.length, 1);
      assert.equal(paged.body.totalPages, 2);

      assert.equal((await adminCall("GET", "/api/admin/users?limit=10&q=d%40x.com")).body.users.length, 0);
    });

    test("without limit the old full-array response is unchanged", async () => {
      const res = await adminCall("GET", "/api/admin/users");
      assert.ok(Array.isArray(res.body));
    });
  });
  describe("access log", () => {
    const logOf = async (id) => (await MedicalReport.findById(id).lean()).accessLog;

    test("admin and patient downloads are each logged with { userId, role, action, at }", async () => {
      const id = (await generated()).body.report._id;
      assert.deepEqual(await logOf(id), [], "issuing is not an access");

      await adminCall("GET", `/api/admin/medical-reports/${id}/download`);
      await patientCall(`/my-reports/${id}/download`);

      const log = await logOf(id);
      assert.equal(log.length, 2);
      assert.deepEqual(log.map((e) => [String(e.userId), e.role, e.action]), [
        [String(admin._id), "admin", "download"],
        [String(patient._id), "user", "download"],
      ]);
      assert.ok(log.every((e) => e.at instanceof Date));
    });

    test("refused downloads are not logged", async () => {
      const id = (await generated()).body.report._id;
      await patientCall(`/my-reports/${id}/download`, otherPatient._id); // someone else's report
      await adminCall("POST", `/api/admin/medical-reports/${id}/void`, { reason: "error" });
      await patientCall(`/my-reports/${id}/download`); // voided
      assert.deepEqual(await logOf(id), []);
    });

    test("is capped at the newest 200 entries", async () => {
      const id = (await generated()).body.report._id;
      const old = Array.from({ length: 200 }, (_, i) => ({ userId: admin._id, role: "admin", action: "download", at: new Date(2026, 0, 1, 0, 0, i) }));
      await MedicalReport.updateOne({ _id: id }, { $set: { accessLog: old } });

      await adminCall("GET", `/api/admin/medical-reports/${id}/download`);

      const log = await logOf(id);
      assert.equal(log.length, 200);
      assert.ok(log[199].at > old[199].at, "newest entry is last");
      assert.ok(log[0].at.getTime() === old[1].at.getTime(), "oldest entry was dropped");
    });

    test("admin detail shows it read-only; list and patient views never include it", async () => {
      const id = (await generated()).body.report._id;
      await patientCall(`/my-reports/${id}/download`);

      const detail = await adminCall("GET", `/api/admin/medical-reports/${id}`);
      assert.equal(detail.body.report.accessLog.length, 1);
      assert.equal(detail.body.report.accessLog[0].role, "user");

      const list = await adminCall("GET", "/api/admin/medical-reports");
      assert.ok(!("accessLog" in list.body.reports[0]));
      assert.ok(!("accessLog" in (await patientCall("/my-reports")).body[0]));

      for (const method of ["PUT", "PATCH", "POST"]) {
        const res = await fetch(`${base}/api/admin/medical-reports/${id}/access-log`, {
          method,
          headers: { "content-type": "application/json", "x-test-admin": String(admin._id) },
          body: JSON.stringify({ accessLog: [] }),
        });
        assert.equal(res.status, 404);
      }
    });
  });

  describe("GET /api/admin/users without limit is unchanged", () => {
    test("returns exactly what the original query returned: patient accounts only, same order, same fields", async () => {
      const { toAdminUser } = require("../utils/signupMethod");
      // The original implementation, verbatim.
      const expected = (await User.find({ role: "user" }).sort({ createdAt: -1 }).lean()).map(toAdminUser);

      const res = await adminCall("GET", "/api/admin/users");
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, JSON.parse(JSON.stringify(expected)));
      assert.ok(res.body.length >= 2);
      assert.ok(res.body.every((u) => u.role === "user" && !("password" in u)));
      assert.ok(!res.body.some((u) => [String(admin._id), String(doctorUser._id)].includes(u._id)), "staff accounts were never listed");
      assert.ok(res.body.every((u) => "signupMethod" in u), "full document fields are kept");
    });
  });
});
