// The API for the country-save browser test: the REAL /api/locations routes (the lists the dropdowns are built from), the REAL
// updateProfile controller and User model over a throwaway in-memory MongoDB, and the REAL signup location validation.
// Signup itself stops at the controller's door: the register request the browser sends is recorded (and then run through the
// real resolveSignupLocation), because the real register needs a mailed OTP. Nothing here can reach a real database: the only
// connection is to the mongodb-memory-server instance started below, and it refuses to start unless that address is local.
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

  const User = load("models/User.js");
  const { updateProfile, resolveSignupLocation } = load("controllers/authController.js");
  const locations = load("routes/locations.js");

  const patient = await User.create({
    name: "Test Patient", email: "patient@e2e.test", password: "Placeholder1!", role: "user",
    mobile: "+919876543210", country: "India", state: "Karnataka", city: "Bengaluru",
  });

  const registers = [];
  const app = express();
  app.use(express.json());
  app.use("/api/locations", locations);
  app.get("/api/geo/currency", (_req, res) => res.json({ currency: "USD", country: "", source: "default" }));
  app.get("/api/pricing", (_req, res) => res.json({}));
  app.get("/api/auth/me", (req, res) => res.status(401).json({ msg: "Not logged in." }));
  // signup: record what the browser sends; the OTP step is answered so the form can move on, the register call is recorded
  app.post("/api/auth/send-register-otp", (req, res) => res.json({ msg: "OTP sent." }));
  app.post("/api/auth/register", (req, res) => {
    const location = resolveSignupLocation(req, { country: req.body.country, state: req.body.state, city: req.body.city });
    registers.push({ body: req.body, saved: location.set, error: location.error || null });
    res.status(400).json({ msg: "stop (test): the request was recorded" });
  });
  // profile edit: the real controller, one fixed patient
  app.put("/api/auth/update-profile", (req, res, next) => {
    req.user = { id: String(patient._id), role: "user" };
    return updateProfile(req, res, next);
  });
  app.get("/__user", async (_req, res) => res.json(await User.findById(patient._id).select("country state city mobile").lean()));
  app.get("/__registers", (_req, res) => res.json(registers));
  app.post("/__reset", async (_req, res) => {
    registers.length = 0;
    await User.updateOne({ _id: patient._id }, { $set: { country: "India", state: "Karnataka", city: "Bengaluru", mobile: "+919876543210" } });
    res.json({ ok: true });
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await mongoose.disconnect();
      await mongod.stop();
    },
  };
}
