// Runs once before the tests (after Playwright has started the local stack):
//  1. local mode only — seeds the throwaway DB and exports the ids
//  2. logs in the doctor and the patient ONCE via the API and saves each
//     session's cookies, so tests reuse them (the backend rate-limits logins
//     to 10 per 15 minutes per email — logging in per test would trip it).
import fs from "node:fs";
import path from "node:path";
import { request } from "@playwright/test";
import { LOCAL_MONGO_URI, credentials, resolveEnv } from "./helpers/env.js";
import { seedLocal } from "./helpers/seed.js";

export const AUTH_DIR = path.resolve("test-results", ".auth");
export const DOCTOR_STATE = path.join(AUTH_DIR, "doctor.json");
export const PATIENT_STATE = path.join(AUTH_DIR, "patient.json");

async function login(baseURL, urlPath, body, statePath, label) {
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post(urlPath, { data: body });
  if (!res.ok()) {
    throw new Error(
      `${label} login failed: HTTP ${res.status()} ${(await res.text()).slice(0, 200)}`,
    );
  }
  await ctx.storageState({ path: statePath });
  await ctx.dispose();
}

export default async function globalSetup() {
  const { staging, baseURL } = resolveEnv();
  const creds = credentials();
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  if (!staging) {
    const ids = await seedLocal({
      mongoUri: LOCAL_MONGO_URI,
      doctor: creds.doctor,
      patient: creds.patient,
    });
    process.env.TEST_APPOINTMENT_ID = ids.appointmentId;
    process.env.TEST_DIRECT_ROOM_ID = ids.directRoomId;
    console.log(`[e2e] seeded local DB: appointment ${ids.appointmentId}`);
  }

  await login(
    baseURL,
    "/api/doctor/login",
    { email: creds.doctor.email, password: creds.doctor.password },
    DOCTOR_STATE,
    "Doctor",
  );
  await login(
    baseURL,
    "/api/auth/login",
    { email: creds.patient.email, password: creds.patient.password },
    PATIENT_STATE,
    "Patient",
  );
  console.log("[e2e] doctor + patient sessions saved");
}
