// API for the visit-note panel browser test: the REAL /api/notes router (and the real doctor auth middleware with a real
// JWT + session) over a throwaway in-memory MongoDB. Nothing else is reachable and nothing leaves this machine.
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, "..", "..", "..", "..", "backend");
const requireBackend = createRequire(path.join(backendRoot, "package.json"));

process.env.JWT_SECRET ||= "e2e-placeholder-not-a-secret";
process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy_not_used";

export async function startApiServer() {
  const express = requireBackend("express");
  const cookieParser = requireBackend("cookie-parser");
  const mongoose = requireBackend("mongoose");
  const { MongoMemoryReplSet } = requireBackend("mongodb-memory-server");
  const load = (file) => requireBackend(path.join(backendRoot, file));

  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri)) throw new Error("refusing to run: the test database is not local");
  await mongoose.connect(uri);

  const Appointment = load("models/Appointment.js");
  const User = load("models/User.js");
  const Doctor = load("models/Doctor.js");
  const Session = load("models/Session.js");
  const ConsultationNote = load("models/ConsultationNote.js");
  const { signAccessToken } = load("middleware/verifyToken.js");
  const { encryptFields } = load("utils/consultationNoteFields.js");

  const patient = await User.create({ name: "Test Sujal", email: "sujal@e2e.test", password: "Placeholder1!", country: "IN" });
  const doctor = await Doctor.create({ name: "Nobita Mestry", email: "nobita@e2e.test", password: "Placeholder1!" });
  const session = await Session.create({ userId: String(doctor._id), role: "doctor", lastActivityAt: new Date(), expiresAt: new Date(Date.now() + 8 * 3600e3) });
  const token = signAccessToken({ _id: doctor._id, email: doctor.email, role: "doctor" }, session._id);

  const now = new Date();
  const make = (over) =>
    Appointment.create({
      patientId: patient._id, doctorId: doctor._id, patientTimezone: "Asia/Kolkata", category: "General & Everyday Care",
      bookedAt: now, problem: "Fever", date: now.toISOString().slice(0, 10), time: "10:00", appointmentDateTimeUtc: now, status: "confirmed", ...over,
    });
  const draft = await make({});
  const finalised = await make({ time: "11:00" });
  const fresh = await make({ time: "12:00" });
  const blank = await make({ time: "13:00" });
  const lost = await make({ time: "14:00" });
  // A note that has already been signed into a Visit Note (reportId set) and a draft with some saved text.
  await ConsultationNote.create({ appointmentId: finalised._id, appointmentModel: "Appointment", doctorId: doctor._id, patientId: patient._id, status: "final", reportId: new mongoose.Types.ObjectId(), ...encryptFields({ symptoms: "Signed symptoms", clinicalFindings: "Signed findings", plan: "Signed plan", note: "" }) });
  await ConsultationNote.create({ appointmentId: draft._id, appointmentModel: "Appointment", doctorId: doctor._id, patientId: patient._id, status: "draft", ...encryptFields({ symptoms: "Saved symptoms", clinicalFindings: "", plan: "", note: "" }) });

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/notes", load("routes/consultationNotes.js"));
  app.get("/__note/:appointmentId", async (req, res) => {
    const n = await ConsultationNote.findOne({ appointmentId: req.params.appointmentId });
    const { readFields } = load("utils/consultationNoteFields.js");
    res.json(n ? { ...readFields(n), reportId: n.reportId || null } : null);
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    token,
    ids: { draft: String(draft._id), finalised: String(finalised._id), fresh: String(fresh._id), blank: String(blank._id), lost: String(lost._id) },
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await mongoose.disconnect();
      await replSet.stop();
    },
  };
}
