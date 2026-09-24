// Seeds the THROWAWAY local database (never a shared one) with what the tests
// need: a doctor, a patient, a "confirmed" appointment linking them, and an
// active direct-call room. Uses the backend's own Mongoose models so the
// documents are exactly what the app expects.
//
// Hard safety rule: refuses to run unless the Mongo URI points at localhost.
import crypto from "node:crypto";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(here, "../../backend");

export async function seedLocal({ mongoUri, doctor, patient }) {
  const host = new URL(mongoUri).hostname;
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
    throw new Error(
      `Refusing to seed: ${host} is not localhost. The e2e seed only ever writes to the throwaway local database.`,
    );
  }

  // Resolve mongoose/bcrypt from the backend's node_modules so the models
  // (which require("mongoose") themselves) share the very same instance.
  const require = createRequire(path.join(BACKEND_DIR, "package.json"));
  const mongoose = require("mongoose");
  const bcrypt = require("bcryptjs");
  const Doctor = require(path.join(BACKEND_DIR, "models/Doctor.js"));
  const User = require(path.join(BACKEND_DIR, "models/User.js"));
  const Appointment = require(path.join(BACKEND_DIR, "models/Appointment.js"));
  const DirectVideoRoom = require(path.join(BACKEND_DIR, "models/DirectVideoRoom.js"));

  await mongoose.connect(mongoUri);
  try {
    // Doctor's pre-save hook hashes the password itself.
    const doctorDoc = await Doctor.create({
      name: "E2E Doctor",
      email: doctor.email,
      password: doctor.password,
      isEnrolled: true,
    });

    const patientDoc = await User.create({
      name: "E2E Patient",
      email: patient.email,
      password: await bcrypt.hash(patient.password, 10),
      role: "user",
    });

    const now = new Date();
    const appointment = await Appointment.create({
      patientId: patientDoc._id,
      doctorId: doctorDoc._id,
      category: "General",
      specialty: "General Practice",
      condition: "E2E test",
      patientDetails: {
        firstName: "E2E",
        lastName: "Patient",
        email: patient.email,
      },
      date: now.toISOString().slice(0, 10),
      time: "10:00",
      appointmentDateTimeUtc: now,
      status: "confirmed",
      paymentStatus: "paid",
    });

    const room = await DirectVideoRoom.create({
      roomId: crypto.randomBytes(16).toString("hex"),
      createdBy: patientDoc._id,
      createdByName: "E2E Patient",
      note: "e2e",
      status: "active",
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
    });

    return {
      appointmentId: String(appointment._id),
      directRoomId: room.roomId,
    };
  } finally {
    await mongoose.disconnect();
  }
}
