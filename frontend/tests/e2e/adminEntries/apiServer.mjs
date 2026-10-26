// The API for the Appointment entries browser tests: the REAL /api/admin/entries router (and the real model code) over a
// throwaway in-memory MongoDB. No login (the token check is replaced; the real role guard still runs, and a test can send
// an x-test-role header to try another role), nothing is emailed, and the only database connection is to the
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
  const ManualEntry = load("models/ManualEntry.js");
  const User = load("models/User.js");
  const Doctor = load("models/Doctor.js");
  const Enrollment = load("models/Enrollment.js");
  const adminEntries = load("routes/adminEntries.js");
  const { entriesViewAccess } = load("middleware/verifyToken.js");
  const { getApprovedDoctors } = load("controllers/adminController.js");
  await ManualEntry.init();

  const admin = await User.create({ name: "Test Admin", email: "admin@e2e.test", password: "Placeholder1!", role: "admin" });

  const docs = [];
  for (const [first, sur] of [["Martin", "Perlin"], ["Hidayat", "Khan"], ["Farah", "Siddiqui"]]) {
    const d = await Doctor.create({ name: `${first} ${sur}`, email: `${first}${sur}@e2e.test`.toLowerCase(), password: "Placeholder1!" });
    const e = await Enrollment.create({ firstName: first, surname: sur, doctorId: d._id, approvalStatus: "approved", specialization: "General", country: "IN", city: "Metro", email: `${first}@enroll.e2e.test`.toLowerCase() });
    docs.push({ d, e });
  }
  // Not approved: must not be offered for a manual entry.
  const pendingDoctor = await Doctor.create({ name: "Pending Person", email: "pending@e2e.test", password: "Placeholder1!" });
  await Enrollment.create({ firstName: "Pending", surname: "Person", doctorId: pendingDoctor._id, approvalStatus: "pending", specialization: "General", country: "IN", city: "Metro", email: "pending@enroll.e2e.test" });

  const patients = new Map();
  const patientNamed = async (name, country = "IN") => {
    if (!patients.has(name)) patients.set(name, await User.create({ name, email: `${name.replace(/\W/g, "").toLowerCase()}@e2e.test`, password: "Placeholder1!", country }));
    return patients.get(name);
  };

  // One booking. kind "appointment" | "category"; doctor = index into the doctors above or null; fee/paid in dollars.
  async function make({ kind = "appointment", name = "Seed Patient", country = "IN", doctor = 0, date = "2027-01-15", time = "10:00 AM", fee = 99, paid, status, bookedAt, entry, source, testing = false }) {
    const p = await patientNamed(name, country);
    const doc = doctor === null ? null : docs[doctor];
    const paidDollars = paid === undefined ? fee : paid;
    if (kind === "category") {
      const c = await CategoryConsultation.create({
        concern: "x", severity: "mild", supportType: "chat", urgency: "flexible", appointmentType: "FLEXIBLE_TIME", date, slot: time,
        patientId: p._id, categoryName: "Women's Health", status: status || "Confirmed", paymentStatus: "paid", paymentAmount: Math.round(paidDollars * 100), consultationPrice: fee,
        isTesting: testing, ...(doc ? { assignedDoctorId: doc.e._id, assignedDoctorName: doc.e.firstName } : {}), ...(entry ? { entry } : {}), ...(source ? { source } : {}),
      });
      return String(c._id);
    }
    const a = await Appointment.create({
      patientId: p._id, date, time, status: status || "confirmed", category: "General & Everyday Care", bookedAt: bookedAt ? new Date(bookedAt) : new Date(),
      paymentStatus: "paid", paymentAmount: Math.round(paidDollars * 100), consultationPrice: fee, isTesting: testing,
      ...(doc ? { doctorId: doc.d._id } : {}), ...(entry ? { entry } : {}), ...(source ? { source } : {}),
    });
    return String(a._id);
  }

  // Background rows so the tabs and the pager have something in them: 30 paid appointments spread over 2027, 4 category.
  for (let i = 0; i < 30; i += 1) {
    await make({ name: `Background ${i}`, doctor: i % 3, date: `2027-${String(1 + (i % 6)).padStart(2, "0")}-${String(1 + (i % 27)).padStart(2, "0")}`, fee: 40 + (i % 5) * 10, source: { platform: i % 2 ? "web" : "android" } });
  }
  for (let i = 0; i < 4; i += 1) await make({ kind: "category", name: `Category ${i}`, doctor: i % 3, date: `2027-0${1 + i}-20`, fee: 49 });

  const app = express();
  app.use(express.json());
  // No login: the role comes from a header (a super admin by default). The real role guard runs after it.
  const fakeAuth = (req, res, next) => {
    req.user = { id: String(admin._id), role: req.headers["x-test-role"] || "superadmin" };
    next();
  };
  app.use("/api/admin/entries", adminEntries.create({ guard: [fakeAuth, entriesViewAccess] }));
  app.get("/api/admin/approved-doctors", fakeAuth, getApprovedDoctors);
  // Everything else the admin layout asks for (counts, alerts...) gets an empty answer.
  app.use("/api", (req, res) => res.json(/unread-count/.test(req.path) ? { count: 0 } : []));

  // Control endpoints for the tests.
  const model = (kind) => ({ appointment: Appointment, category: CategoryConsultation, manual: ManualEntry })[kind];
  app.post("/__make", async (req, res) => res.json({ id: await make(req.body) }));
  app.get("/__doc/:kind/:id", async (req, res) => res.json(await model(req.params.kind).findById(req.params.id).lean()));
  app.get("/__doctors", (req, res) => res.json(docs.map(({ d, e }) => ({ doctorId: String(d._id), enrollmentId: String(e._id), name: d.name }))));
  app.get("/__manual", async (req, res) => res.json(await ManualEntry.find({}).lean()));

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
