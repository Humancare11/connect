// Two logged-in parties (doctor + patient) for relay/TURN scenarios.
//
// Same shape as the shared `call` fixture, with one deliberate difference: the
// contexts are created WITHOUT the `permissions: ["camera","microphone"]` grant.
// In this Chromium build that grant stops RTCPeerConnection from reaching a
// loopback TURN server at all (no allocate packet is ever sent - verified with
// the TURN server's own trace), so relay candidates never gather. The
// --use-fake-ui-for-media-stream launch flag already auto-accepts the
// getUserMedia prompt, so the grant is not needed.
import { DOCTOR_STATE, PATIENT_STATE } from "../global-setup.js";
import { bothRecovered, newParty, waitForVideoFlowing } from "./harness.js";

export async function newRelayCall(browser, baseURL) {
  const doctor = await newParty(browser, "doctor", DOCTOR_STATE, baseURL, { permissions: [] });
  const patient = await newParty(browser, "patient", PATIENT_STATE, baseURL, { permissions: [] });
  const appointmentId = process.env.TEST_APPOINTMENT_ID;
  const url = `/video-call/${appointmentId}`;
  return {
    doctor,
    patient,
    appointmentId,
    async joinBoth({ flowTimeoutMs = 30_000 } = {}) {
      await Promise.all([
        doctor.page.goto(url, { waitUntil: "domcontentloaded" }),
        patient.page.goto(url, { waitUntil: "domcontentloaded" }),
      ]);
      await Promise.all([
        waitForVideoFlowing(doctor.page, { timeoutMs: flowTimeoutMs, label: "doctor" }),
        waitForVideoFlowing(patient.page, { timeoutMs: flowTimeoutMs, label: "patient" }),
      ]);
    },
    async bothRecovered(timeoutMs, label = "") {
      await bothRecovered(doctor, patient, timeoutMs, label);
    },
    async close() {
      await doctor.context.close();
      await patient.context.close();
    },
  };
}
