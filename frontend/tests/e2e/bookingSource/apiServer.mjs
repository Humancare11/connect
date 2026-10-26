// The API for the booking-source browser test: the REAL createAppointment controller (and the real Appointment model, the
// real transaction and the real booking-source code) over a throwaway in-memory MongoDB replica set (createAppointment
// uses a transaction). Payment is stubbed: verifying a payment with Stripe is replaced by "the reference the browser sends
// is a succeeded $50 payment", and the invoice ledger and the notification mails are recorded, not sent. There is no login
// (every call is one fixed patient). Nothing here can reach a real database: the only connection is to the
// mongodb-memory-server instance started below, and it refuses to start unless that address is local.
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, "..", "..", "..", "..", "backend");
const requireBackend = createRequire(path.join(backendRoot, "package.json"));

process.env.JWT_SECRET ||= "e2e-placeholder-not-a-secret";
process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy_not_used";

// The booking tree the form resolves its URL against: Women's Health > Obstetrics and Gynaecology > PCOS.
const TREE = [
  {
    _id: "cat-women",
    name: "Women's Health",
    icon: "venus",
    price: 50,
    currency: "USD",
    specialties: [
      { _id: "spec-obgyn", name: "Obstetrics and Gynaecology", icon: "stethoscope", conditions: [{ _id: "cond-pcos", name: "PCOS", icon: "stethoscope" }] },
    ],
  },
];

export async function startApiServer() {
  const express = requireBackend("express");
  const mongoose = requireBackend("mongoose");
  const { MongoMemoryReplSet } = requireBackend("mongodb-memory-server");
  const load = (file) => requireBackend(path.join(backendRoot, file));

  // Stubs go onto the real modules' exports BEFORE the controller is loaded (it destructures them at require time).
  const pv = load("utils/paymentVerification.js");
  pv.resolveCategoryFeeCents = async () => 5000;
  pv.verifyStripePaymentIntent = async ({ paymentIntentId }) => ({ ref: paymentIntentId, gateway: "stripe", amountCents: 5000 });
  pv.verifyPaypalOrder = async ({ paypalOrderId }) => ({ ref: paypalOrderId, gateway: "paypal", amountCents: 5000 });
  pv.claimPaymentOnce = async () => {};
  const sideEffects = [];
  load("utils/billing.js").recordPaymentAndInvoice = async (args) => { sideEffects.push({ name: "invoice", booking: String(args.appointmentId) }); };
  const notify = load("utils/bookingNotifications.js");
  notify.notifyAppointmentBooked = ({ appointment }) => { sideEffects.push({ name: "notify", booking: String(appointment._id) }); };

  const mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = mongod.getUri();
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri)) throw new Error("refusing to run: the test database is not local");
  await mongoose.connect(uri);

  const Appointment = load("models/Appointment.js");
  const User = load("models/User.js");
  await Appointment.init();
  const patient = await User.create({ name: "Test Patient", email: "patient@e2e.test", password: "Placeholder1!", role: "user", country: "IN" });
  const { createAppointment } = load("controllers/appointmentController.js");

  const app = express();
  app.use(express.json());
  const asPatient = (req, res, next) => { req.user = { id: String(patient._id), role: "user" }; next(); };

  app.get("/api/auth/me", asPatient, (req, res) => res.json({ user: { _id: String(patient._id), name: patient.name, email: patient.email } }));
  app.get("/api/appointment-tree", (req, res) => res.json(TREE));
  app.post("/api/payments/create-intent-by-amount", asPatient, (req, res) => res.json({ clientSecret: "pi_e2e_secret_stub", id: "pi_e2e", amount: 5000 }));
  app.post("/api/appointments", asPatient, createAppointment);

  // Control endpoints for the tests.
  app.get("/__bookings", async (req, res) => res.json(await Appointment.find().sort({ createdAt: 1 }).lean()));
  app.post("/__reset", async (req, res) => { await Appointment.deleteMany({}); sideEffects.length = 0; res.json({}); });
  app.get("/__side-effects", (req, res) => res.json(sideEffects));
  app.use("/api", (req, res) => res.status(404).json({ msg: "not part of this test" }));

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
