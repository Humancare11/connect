// Test-only helper: creates a DirectVideoRoom document in an arbitrary state
// (active / expired / closed) directly in the throwaway local DB, using the
// backend's own Mongoose model — for e2e scenarios (link expiry, closed
// room) that can't be reached by just joining normally through the UI.
// Mirrors global-setup.js's seedLocal() safety rule and require() pattern.
import crypto from "node:crypto";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(here, "../../backend");

export async function createDirectRoom({
  mongoUri,
  status = "active",
  expiresInMs = 6 * 60 * 60 * 1000,
  note = "e2e",
}) {
  const host = new URL(mongoUri).hostname;
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
    throw new Error(
      `Refusing to seed: ${host} is not localhost. This helper only ever writes to the throwaway local database.`,
    );
  }

  const require = createRequire(path.join(BACKEND_DIR, "package.json"));
  const mongoose = require("mongoose");
  const DirectVideoRoom = require(path.join(BACKEND_DIR, "models/DirectVideoRoom.js"));

  // A dedicated connection (not the shared/global one) so this can run
  // concurrently with other workers/tests without racing a connect/disconnect
  // against them.
  const conn = await mongoose.createConnection(mongoUri).asPromise();
  try {
    const Model = conn.model("DirectVideoRoom", DirectVideoRoom.schema);
    const room = await Model.create({
      roomId: crypto.randomBytes(16).toString("hex"),
      createdBy: new mongoose.Types.ObjectId(),
      createdByName: "E2E Seed",
      note,
      status,
      expiresAt: new Date(Date.now() + expiresInMs),
    });
    return { roomId: room.roomId };
  } finally {
    await conn.close();
  }
}

// Test-only: a brand-new "confirmed" appointment linking the seeded doctor and
// patient (looked up by the e2e credentials). For scenarios that END an
// appointment - the shared TEST_APPOINTMENT_ID must stay joinable for every
// other test.
export async function createFreshAppointment({ mongoUri, doctorEmail, patientEmail }) {
  const host = new URL(mongoUri).hostname;
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
    throw new Error(`Refusing to seed: ${host} is not localhost. This helper only ever writes to the throwaway local database.`);
  }
  const require = createRequire(path.join(BACKEND_DIR, "package.json"));
  const mongoose = require("mongoose");
  const Doctor = require(path.join(BACKEND_DIR, "models/Doctor.js"));
  const User = require(path.join(BACKEND_DIR, "models/User.js"));
  const Appointment = require(path.join(BACKEND_DIR, "models/Appointment.js"));
  const conn = await mongoose.createConnection(mongoUri).asPromise();
  try {
    const doctor = await conn.model("Doctor", Doctor.schema).findOne({ email: doctorEmail });
    const patient = await conn.model("User", User.schema).findOne({ email: patientEmail });
    if (!doctor || !patient) throw new Error("seeded doctor/patient not found");
    const now = new Date();
    const appt = await conn.model("Appointment", Appointment.schema).create({
      patientId: patient._id,
      doctorId: doctor._id,
      category: "General",
      specialty: "General Practice",
      condition: "e2e fresh appointment",
      patientDetails: { firstName: "E2E", lastName: "Patient", email: patientEmail },
      date: now.toISOString().slice(0, 10),
      time: "10:00",
      appointmentDateTimeUtc: now,
      status: "confirmed",
      paymentStatus: "paid",
    });
    return { appointmentId: String(appt._id) };
  } finally {
    await conn.close();
  }
}
