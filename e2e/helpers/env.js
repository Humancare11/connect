// Resolves which environment the e2e run targets and the test credentials.
//
// Two modes:
//  - LOCAL STACK (default): Playwright starts a throwaway mongod, the backend
//    and the Vite dev server (see playwright.config.js), a seed step creates a
//    doctor/patient/appointment/direct room in that throwaway DB, and — since
//    it's a disposable database — any TEST_* credential you didn't provide is
//    generated randomly for this run. Nothing is hardcoded.
//  - EXISTING ENVIRONMENT: set E2E_BASE_URL (e.g. a staging URL). No servers
//    are started and nothing is seeded; you must provide all TEST_* variables
//    and TEST_APPOINTMENT_ID (plus TEST_DIRECT_ROOM_ID for the direct-call test).
import crypto from "node:crypto";

export const LOCAL_PORTS = { backend: 5000, frontend: 5173, mongo: 27018 };
export const LOCAL_MONGO_URI = `mongodb://127.0.0.1:${LOCAL_PORTS.mongo}/hcc_e2e`;

const CRED_KEYS = [
  "TEST_DOCTOR_EMAIL",
  "TEST_DOCTOR_PASSWORD",
  "TEST_PATIENT_EMAIL",
  "TEST_PATIENT_PASSWORD",
];

const rand = (n = 6) => crypto.randomBytes(n).toString("hex");

export function resolveEnv() {
  const staging = Boolean(process.env.E2E_BASE_URL);
  const baseURL = staging
    ? process.env.E2E_BASE_URL.replace(/\/+$/, "")
    : `http://localhost:${LOCAL_PORTS.frontend}`;

  if (staging) {
    const required = [...CRED_KEYS, "TEST_APPOINTMENT_ID"];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length) {
      throw new Error(
        `E2E_BASE_URL is set, so these must be provided too: ${missing.join(", ")}`,
      );
    }
  } else {
    // Throwaway local DB only — safe to generate per-run credentials.
    process.env.TEST_DOCTOR_EMAIL ||= `e2e-doctor-${rand()}@e2e.invalid`;
    process.env.TEST_PATIENT_EMAIL ||= `e2e-patient-${rand()}@e2e.invalid`;
    process.env.TEST_DOCTOR_PASSWORD ||= `${rand(10)}Aa1!`;
    process.env.TEST_PATIENT_PASSWORD ||= `${rand(10)}Aa1!`;
  }

  return { staging, baseURL };
}

export function credentials() {
  return {
    doctor: {
      email: process.env.TEST_DOCTOR_EMAIL,
      password: process.env.TEST_DOCTOR_PASSWORD,
    },
    patient: {
      email: process.env.TEST_PATIENT_EMAIL,
      password: process.env.TEST_PATIENT_PASSWORD,
    },
  };
}
