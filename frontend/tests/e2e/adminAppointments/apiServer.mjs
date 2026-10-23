// The API for the admin Appointments browser tests: the REAL /api/admin/bookings router (and the real model
// code) over a throwaway in-memory MongoDB. No auth (the guard is replaced), emails and push are recorded
// instead of sent, and nothing here can reach a real database: the only connection is to the
// mongodb-memory-server instance started below. The dummy keys are placeholders so the backend modules load.
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, "..", "..", "..", "..", "backend");
const requireBackend = createRequire(path.join(backendRoot, "package.json"));

process.env.JWT_SECRET ||= "e2e-placeholder-not-a-secret";
process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy_not_used";

const STORED_CATEGORY_STATUS = { upcoming: "Pending", assigned: "Assigned", pending: "Pending", confirmed: "Confirmed", complete: "Completed", cancelled: "Cancelled" };

export async function startApiServer() {
  const express = requireBackend("express");
  const mongoose = requireBackend("mongoose");
  const { MongoMemoryServer } = requireBackend("mongodb-memory-server");
  const load = (file) => requireBackend(path.join(backendRoot, file));

  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
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

  // Emails and push are recorded, never sent.
  const calls = [];
  for (const name of ["notifyAppointmentDoctorChanged", "notifyConsultationDoctorChanged", "notifyPatientDoctorChanged", "notifyDoctorBookingCancelled", "notifyDoctorBookingConfirmed"]) {
    notify[name] = async (a) => { calls.push({ name, booking: String((a.booking || a.appointment || a.consultation)?._id) }); };
  }
  push.sendPushToUser = (userId, payload) => { calls.push({ name: `push:${payload.title}` }); };

  const admin = await User.create({ name: "Super Admin", email: "sa@e2e.test", password: "Placeholder1!", role: "superadmin" });

  const docs = [];
  const people = [["Martin", "Perlin", "Cardiology", "US"], ["Nobita", "Mestry", "General Medicine", "IN"], ["Hidayat", "Khan", "Pediatrics", "AE"], ["Farah", "Siddiqui", "Dermatology", "AE"]];
  for (const [first, sur, specialization, country] of people) {
    const d = await Doctor.create({ name: `${first} ${sur}`, email: `${first}${sur}@e2e.test`.toLowerCase(), password: "Placeholder1!" });
    const e = await Enrollment.create({ firstName: first, surname: sur, doctorId: d._id, approvalStatus: "approved", specialization, country, city: "Metro", email: `${first}@enroll.e2e.test`.toLowerCase() });
    docs.push({ d, e });
  }

  const patients = new Map();
  const patientNamed = async (name) => {
    if (!patients.has(name)) patients.set(name, await User.create({ name, email: `${name.replace(/\W/g, "").toLowerCase()}@e2e.test`, password: "Placeholder1!", country: "IN" }));
    return patients.get(name);
  };

  // Every booking gets its own day unless a test says otherwise, so doctors never clash by accident.
  let dayCounter = 0;
  const nextDay = () => {
    dayCounter += 1;
    return `2027-${String(1 + Math.floor(dayCounter / 28)).padStart(2, "0")}-${String(1 + (dayCounter % 28)).padStart(2, "0")}`;
  };

  async function make({ kind = "appointment", status = "upcoming", doctor = null, paid = false, gateway = "", testing = false, nextAvailable = false, name = "Seed Patient", time = "10:00 AM", date, original = "" }) {
    const p = await patientNamed(name);
    const doc = doctor === null ? null : docs[doctor];
    const day = date || nextDay();
    const common = {
      isTesting: testing,
      paymentStatus: paid ? "paid" : "unpaid",
      ...(paid && gateway ? { paymentGateway: gateway } : {}),
      consultationPrice: 49,
      ...(original ? { originalDoctorName: original } : {}),
    };
    if (kind === "category") {
      const c = await CategoryConsultation.create({
        concern: "x", severity: "mild", supportType: "chat", urgency: nextAvailable ? "next" : "flexible",
        appointmentType: nextAvailable ? "NEXT_AVAILABLE" : "FLEXIBLE_TIME", date: day, slot: nextAvailable ? null : time,
        patientId: p._id, categoryName: "Women's Health", status: STORED_CATEGORY_STATUS[status],
        ...(doc ? { assignedDoctorId: doc.e._id, assignedDoctorName: doc.e.firstName, assignedBy: { name: "Super Admin" } } : {}),
        ...common,
      });
      return String(c._id);
    }
    const a = await Appointment.create({
      patientId: p._id, date: day, time, status, category: "General & Everyday Care", bookedAt: new Date(),
      ...(doc ? { doctorId: doc.d._id, assignedBy: { name: "Super Admin" } } : {}),
      ...common,
    });
    return String(a._id);
  }

  // Background rows, so the tabs and pages have something in them.
  for (let i = 0; i < 64; i++) {
    await make({
      kind: i % 3 === 0 ? "category" : "appointment",
      status: ["upcoming", "assigned", "pending", "confirmed", "complete", "cancelled"][i % 6],
      doctor: i % 6 === 0 ? null : i % 4,
      paid: i % 2 === 1, gateway: i % 4 === 1 ? "stripe" : "paypal",
      testing: i % 9 === 0,
      nextAvailable: i % 6 === 0, // category rows with no doctor yet: Next Available, so no consultation time
      name: `Seed ${i % 8}`,
    });
  }

  const app = express();
  app.use(express.json());
  const guard = [(req, res, next) => { req.user = { id: String(admin._id), role: "admin" }; next(); }];
  app.use("/api/admin/bookings", adminBookings.create({ guard }));
  app.get("/api/doctor/approved", async (req, res) => {
    const list = await Enrollment.find({ approvalStatus: "approved" }).lean();
    res.json(list.map((e) => ({ id: e._id, name: `Dr. ${e.firstName} ${e.surname}`, specialty: e.specialization, country: e.country, city: e.city, location: `${e.city}, ${e.country}` })));
  });

  // Control endpoints for the tests.
  app.post("/__make", async (req, res) => res.json({ id: await make(req.body) }));
  app.get("/__calls", (req, res) => res.json(calls));
  app.post("/__reset", (req, res) => { calls.length = 0; res.json({}); });
  app.get("/__doc/:id", async (req, res) => res.json((await Appointment.findById(req.params.id).lean()) || (await CategoryConsultation.findById(req.params.id).lean())));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;

  return {
    url,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await mongoose.disconnect();
      await mongod.stop();
    },
  };
}
