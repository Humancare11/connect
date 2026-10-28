// The API for the doctor email change browser tests: the REAL doctor routes (login, the email-change endpoints, enrollment) and the
// REAL auth/refresh route, with the real token and session checks, over a throwaway in-memory MongoDB.
//   - The only database is the mongodb-memory-server started below; it refuses to run if that is not a local address.
//   - No email can leave: the mailer functions the routes call are replaced by recorders, and the SMTP settings are pointed at a
//     closed local port before the backend loads, so even a missed path could not reach a real server.
//   - The OTP is read from the recorded "mail" through /__otp. That endpoint exists only in this test server, never in the
//     application, so there is nothing to switch on in production.
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, "..", "..", "..", "..", "backend");
const requireBackend = createRequire(path.join(backendRoot, "package.json"));

export async function startApiServer() {
  if (process.env.NODE_ENV === "production" || process.env.HTTPS === "true") {
    throw new Error("refusing to run: NODE_ENV is production or HTTPS is on");
  }
  process.env.JWT_SECRET ||= "e2e-placeholder-not-a-secret";
  process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy_not_used";
  // Unconditional (not ||=): whatever the shell has, mail can only ever be aimed at a closed local port.
  Object.assign(process.env, { SMTP_HOST: "127.0.0.1", SMTP_PORT: "1", SMTP_USER: "e2e", SMTP_PASS: "e2e", EMAIL_USER: "e2e@e2e.test" });

  const express = requireBackend("express");
  const cookieParser = requireBackend("cookie-parser");
  const mongoose = requireBackend("mongoose");
  const { MongoMemoryServer } = requireBackend("mongodb-memory-server");
  const load = (file) => requireBackend(path.join(backendRoot, file));

  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri)) throw new Error("refusing to run: the test database is not local");
  await mongoose.connect(uri);
  const host = mongoose.connection.host;
  if (!["127.0.0.1", "localhost"].includes(host)) throw new Error("refusing to run: connected to a non-local database");

  // Install the mail recorders BEFORE the routes (and otpUtils) are loaded.
  const mails = [];
  const state = { mailFails: false };
  const mailer = load("utils/sendEmail.js");
  mailer.sendEmailChangeOTPEmail = async (to, code) => {
    if (state.mailFails) throw new Error("simulated delivery failure");
    mails.push({ kind: "email-change", to, code });
  };
  mailer.sendOTPEmail = async (to, code, type) => {
    mails.push({ kind: type, to, code });
  };

  const Doctor = load("models/Doctor.js");
  const Enrollment = load("models/Enrollment.js");
  const EmailChangeChallenge = load("models/EmailChangeChallenge.js");
  const DoctorEmailChangeAudit = load("models/DoctorEmailChangeAudit.js");
  await Doctor.init();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/doctor", load("routes/doctorAuth.js"));
  app.use("/api/auth", load("routes/auth.js"));

  // Control endpoints for the tests (this server only).
  app.post("/__seed", async (req, res) => {
    const { email, name = "Dr Test Doctor", password, approved = false } = req.body;
    const doctor = await Doctor.create({ name, email, password, ...(approved ? { isEnrolled: true } : {}) });
    const [first, ...rest] = name.split(" ");
    await Enrollment.create({
      doctorId: doctor._id, firstName: first, surname: rest.join(" "), email,
      ...(approved ? { approvalStatus: "approved", verified: true, formCompleted: true, completedSteps: 5, currentStep: 5, applicationStatus: "Approved", pendingRequestType: "none" } : {}),
    });
    res.json({ id: String(doctor._id), doctorId: doctor.doctorId });
  });
  app.get("/__otp", (req, res) => {
    const found = [...mails].reverse().find((m) => m.to === req.query.to && m.kind === (req.query.kind || "email-change"));
    res.json({ code: found?.code || null });
  });
  app.get("/__mails", (req, res) => res.json(mails.filter((m) => !req.query.to || m.to === req.query.to).map((m) => ({ kind: m.kind, to: m.to }))));
  app.post("/__mail-fail", (req, res) => { state.mailFails = Boolean(req.body.fail); res.json({}); });
  app.post("/__expire-challenge", async (req, res) => {
    await EmailChangeChallenge.updateMany({ doctorId: req.body.doctorId }, { expiresAt: new Date(Date.now() - 1000) });
    res.json({});
  });
  app.get("/__doctor/:id", async (req, res) => {
    const doctor = await Doctor.findById(req.params.id).select("-password").lean();
    const enrollment = await Enrollment.findOne({ doctorId: req.params.id }).lean();
    res.json({
      email: doctor?.email, doctorId: doctor?.doctorId, enrollmentEmail: enrollment?.email, firstName: enrollment?.firstName,
      pendingFields: (enrollment?.pendingProfileChanges || []).map((c) => c.field), count: await Doctor.countDocuments(),
    });
  });
  // Simulates the email having been changed elsewhere WITHOUT revoking this browser's session (used for the stale-form test).
  app.post("/__set-email", async (req, res) => {
    await Doctor.updateOne({ _id: req.body.id }, { $set: { email: req.body.email } });
    await Enrollment.updateOne({ doctorId: req.body.id }, { $set: { email: req.body.email } }, { overwriteImmutable: true });
    res.json({});
  });
  app.get("/__email-exists", async (req, res) => res.json({ n: await Doctor.countDocuments({ email: req.query.email }) }));
  app.get("/__audit/:id", async (req, res) => res.json(await DoctorEmailChangeAudit.find({ doctorId: req.params.id }).sort({ createdAt: 1, _id: 1 }).lean()));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;

  return {
    url,
    dbHost: host,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await mongoose.disconnect();
      await mongod.stop();
    },
  };
}
