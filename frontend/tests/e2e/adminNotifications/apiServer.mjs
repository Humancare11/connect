// The API for the admin notification browser tests. It mounts the backend's REAL routers over a throwaway
// in-memory MongoDB: /api/auth (real logins), /api/doctor (real registration and enrollment), /api/tickets,
// /api/partner and /api/admin/notifications (the bell's API, with the real admin token check and role guard).
// The producers run for real, so the notifications are created by the application's own code.
// Only two things are adapters: the registration OTP email is recorded (never sent), and the direct-call alerts
// half of the bell (/api/direct-video-room/alerts) answers "none". Bookings are created through the real notifier
// functions the controllers call, because createAppointment needs Stripe/PayPal and a replica-set transaction.
// Nothing here can reach a real database: the only connection is to the mongodb-memory-server started below, and it
// is refused unless its address is local. No .env file is read. The dummy keys only let the backend modules load.
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, "..", "..", "..", "..", "backend");
const requireBackend = createRequire(path.join(backendRoot, "package.json"));

process.env.JWT_SECRET ||= "e2e-placeholder-not-a-secret";
process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy_not_used";
export const PASSWORD = "Passw0rd!e2e";

export async function startApiServer() {
  const express = requireBackend("express");
  const cookieParser = requireBackend("cookie-parser");
  const mongoose = requireBackend("mongoose");
  const bcrypt = requireBackend("bcryptjs");
  const { MongoMemoryServer } = requireBackend("mongodb-memory-server");
  const load = (file) => requireBackend(path.join(backendRoot, file));

  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri)) {
    await mongod.stop();
    throw new Error("refusing to run: the test database is not local");
  }
  await mongoose.connect(uri);
  const hosts = mongoose.connection.getClient().options.hosts.map((h) => h.host);
  if (!hosts.every((h) => h === "127.0.0.1" || h === "localhost")) {
    await mongoose.disconnect();
    await mongod.stop();
    throw new Error("refusing to run: the connected database is not local");
  }

  // Never send mail: the registration OTP is recorded so the test can complete the real signup.
  const mailer = load("utils/sendEmail.js");
  const mails = [];
  mailer.sendOTPEmail = async (to, code, type) => { mails.push({ kind: type, to, code }); };

  const User = load("models/User.js");
  const Doctor = load("models/Doctor.js");
  const Partner = load("models/Partner.js");
  const AdminNotification = load("models/AdminNotification.js");
  await Doctor.init();
  await AdminNotification.init();
  const { notifyAdminAppointmentBooked, notifyAdminCategoryConsultationBooked } = load("utils/adminNotifications.js");

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.set("io", { to: () => ({ emit: () => {} }) });
  app.use("/api/auth", load("routes/auth.js"));
  app.use("/api/doctor", load("routes/doctorAuth.js"));
  app.use("/api/tickets", load("routes/tickets.js"));
  app.use("/api/partner", load("routes/partner.js"));
  app.use("/api/admin/notifications", load("routes/adminNotifications.js"));
  // Adapter: the direct-call alerts half of the bell has no alerts here.
  app.get("/api/direct-video-room/alerts/unread-count", (req, res) => res.json({ count: 0 }));
  app.get("/api/direct-video-room/alerts", (req, res) => res.json({ alerts: [] }));

  const hash = await bcrypt.hash(PASSWORD, 10);
  let seq = 0;
  const control = {
    mails,
    async seedAdmin(role = "admin") {
      const email = `${role}${++seq}@e2e.test`;
      await User.create({ name: `E2E ${role}`, email, password: hash, role });
      return email;
    },
    async seedPatient() {
      const email = `patient${++seq}@e2e.test`;
      await User.create({ name: "E2E Patient", email, password: hash, role: "user" });
      return email;
    },
    async seedDoctor() {
      const email = `doctor${++seq}@e2e.test`;
      await Doctor.create({ name: "E2E Doctor", email, password: PASSWORD });
      return email;
    },
    async seedPartner() {
      const email = `partner${++seq}@e2e.test`;
      const company = await Partner.create({
        partnerCode: `P-${String(seq).padStart(4, "0")}`, companyName: "Acme Assist", slug: `acme-assist-${seq}`,
        status: "active", createdBy: new mongoose.Types.ObjectId(),
      });
      await User.create({ name: "E2E Partner", email, password: hash, role: "partner", partner: company._id });
      return email;
    },
    // Adapters over the real notifier functions the booking controllers call after a booking is saved.
    notifyAppointment: (doctorName) =>
      notifyAdminAppointmentBooked({
        appointment: { _id: new mongoose.Types.ObjectId(), date: "2027-01-05", time: "10:00 AM", category: "Cardiology", specialty: "Heart" },
        doctor: doctorName ? { name: doctorName } : null,
      }),
    notifyCategory: () =>
      notifyAdminCategoryConsultationBooked({
        consultation: { _id: new mongoose.Types.ObjectId(), categoryName: "Women's Health", specialtyName: "Gynecology", date: "2027-01-06", urgency: "flexible", slot: "05:30 PM" },
      }),
    notifications: () => AdminNotification.find({}).sort({ createdAt: 1 }).lean(),
    clearNotifications: () => AdminNotification.deleteMany({}),
  };

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;

  return {
    url,
    control,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await mongoose.disconnect();
      await mongod.stop();
    },
  };
}
