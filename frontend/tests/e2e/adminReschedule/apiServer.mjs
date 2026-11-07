// The API for the reschedule browser test: the REAL /api/admin/bookings router and the REAL appointment controller
// (doctor's, patient's and admin's own views) over a throwaway in-memory MongoDB replica set (rescheduling uses a
// transaction). No login (each route is given a fixed person), emails and push are recorded instead of sent, and the only
// database connection is to the mongodb-memory-server instance started below.
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, "..", "..", "..", "..", "backend");
const requireBackend = createRequire(path.join(backendRoot, "package.json"));

process.env.JWT_SECRET ||= "e2e-placeholder-not-a-secret";
process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy_not_used";

const iso = (offsetDays) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

export async function startApiServer() {
  const express = requireBackend("express");
  const mongoose = requireBackend("mongoose");
  const { MongoMemoryReplSet } = requireBackend("mongodb-memory-server");
  const load = (file) => requireBackend(path.join(backendRoot, file));

  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri)) throw new Error("refusing to run: the test database is not local");
  await mongoose.connect(uri);

  const Appointment = load("models/Appointment.js");
  const CategoryConsultation = load("models/CategoryConsultation.js");
  const User = load("models/User.js");
  const Doctor = load("models/Doctor.js");
  const Enrollment = load("models/Enrollment.js");
  const notify = load("utils/bookingNotifications.js");
  const push = load("utils/pushNotifications.js");
  const adminBookings = load("routes/adminBookings.js");
  const controller = load("controllers/appointmentController.js");

  const calls = [];
  notify.notifyBookingRescheduled = async (a) => { calls.push({ name: "rescheduled", booking: String(a.booking._id) }); };
  push.sendPushToUser = (userId, payload) => { calls.push({ name: `push:${payload.title}`, userId: String(userId) }); };

  const admin = await User.create({ name: "Test Admin", email: "admin@e2e.test", password: "Placeholder1!", role: "admin" });
  const patient = await User.create({ name: "Test Sujal", email: "sujal@e2e.test", password: "Placeholder1!", country: "IN" });
  const other = await User.create({ name: "Riya Kapoor", email: "riya@e2e.test", password: "Placeholder1!", country: "IN" });

  const makeDoctor = async (first, sur) => {
    const d = await Doctor.create({ name: `${first} ${sur}`, email: `${first}@e2e.test`.toLowerCase(), password: "Placeholder1!" });
    const e = await Enrollment.create({ firstName: first, surname: sur, doctorId: d._id, approvalStatus: "approved", timezone: "Asia/Kolkata", email: `${first}@enroll.e2e.test`.toLowerCase() });
    return { d, e };
  };
  const mestry = await makeDoctor("Nobita", "Mestry");

  const PAST = iso(-1);
  const TOMORROW = iso(1);
  const utc = (date, hhmm) => new Date(`${date}T${hhmm}:00+05:30`);
  const make = (over) =>
    Appointment.create({
      patientId: patient._id, doctorId: mestry.d._id, patientTimezone: "Asia/Kolkata", category: "General & Everyday Care",
      bookedAt: new Date(), problem: "Fever and sore throat", ...over,
    });

  // The patient did not join: confirmed, with a time that has already passed.
  const noShow = await make({ date: PAST, time: "10:30", appointmentDateTimeUtc: utc(PAST, "10:30"), status: "confirmed", sessionStarted: true });
  // Another patient already holds tomorrow 11:30 with the same doctor.
  await make({ patientId: other._id, date: TOMORROW, time: "11:30", appointmentDateTimeUtc: utc(TOMORROW, "11:30"), status: "confirmed", problem: "Skin rash" });
  const pending = await make({ date: iso(5), time: "17:30", appointmentDateTimeUtc: utc(iso(5), "17:30"), status: "pending", problem: "Back pain" });
  const complete = await make({ date: iso(-6), time: "12:30", appointmentDateTimeUtc: utc(iso(-6), "12:30"), status: "complete", problem: "Checkup" });
  const noDoctor = await make({ doctorId: null, date: iso(4), time: "09:00", appointmentDateTimeUtc: utc(iso(4), "09:00"), status: "upcoming", problem: "Headache" });

  const app = express();
  app.use(express.json());
  app.set("io", { to: () => ({ emit: () => {} }) });
  const as = (user) => (req, res, next) => { req.user = user; next(); };
  const adminUser = { id: String(admin._id), role: "admin" };
  const guard = [as(adminUser)];
  app.use("/api/admin/bookings", adminBookings.create({ guard, superGuard: guard }));
  app.get("/api/doctor/approved", async (req, res) => res.json([]));
  app.get("/api/appointments/doctor", as({ id: String(mestry.d._id), role: "doctor" }), controller.getDoctorAppointments);
  app.get("/api/appointments/mine", as({ id: String(patient._id), role: "user" }), controller.getPatientAppointments);
  app.get("/api/appointments/:id", as(adminUser), controller.getAppointmentById);
  app.get("/api/doctor/me", (req, res) => res.json({ doctor: { _id: String(mestry.d._id), name: "Nobita Mestry", email: "nobita@e2e.test" } }));
  app.post("/api/call-reports/summaries", (req, res) => res.json({ summaries: {} }));
  app.use("/api/medical", (req, res) => res.status(404).json({}));
  app.get("/__calls", (req, res) => res.json(calls));
  app.get("/__doc/:id", async (req, res) => res.json(await Appointment.findById(req.params.id).lean()));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    ids: { noShow: String(noShow._id), pending: String(pending._id), complete: String(complete._id), noDoctor: String(noDoctor._id) },
    dates: { past: PAST, tomorrow: TOMORROW },
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await mongoose.disconnect();
      await replSet.stop();
    },
  };
}
