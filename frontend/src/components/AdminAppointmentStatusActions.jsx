import { useState } from "react";
import api from "../api";

const normalize = (status) => String(status || "").toLowerCase();
const isComplete = (status) => ["complete", "completed"].includes(normalize(status));
const canComplete = (status) => ["assigned", "confirmed"].includes(normalize(status));

const COPY = {
  complete: {
    path: "admin-complete",
    button: "Mark as Complete",
    question: "Mark this appointment as complete? The patient will be notified.",
    yes: "Yes, complete",
    done: "Appointment marked as complete.",
    next: "complete",
  },
  reopen: {
    path: "reopen",
    button: "Reopen Appointment",
    question:
      "Reopen this appointment? It returns to Confirmed and the patient and doctor will be notified. Existing prescriptions are kept.",
    yes: "Yes, reopen",
    done: "Appointment reopened.",
    next: "confirmed",
  },
};

// Admin/superadmin "complete" and "reopen" for an appointment or a category
// consultation (both share the /api/appointments/:id/... endpoints).
// `onChanged` receives the new canonical status ("complete" | "confirmed").
export default function AdminAppointmentStatusActions({ appointmentId, status, onChanged }) {
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const action = isComplete(status) ? "reopen" : canComplete(status) ? "complete" : null;
  if (!action && !result) return null;

  const run = async (name) => {
    const copy = COPY[name];
    setBusy(true);
    setResult(null);
    try {
      await api.put(`/api/appointments/${appointmentId}/${copy.path}`, {});
      setPending(null);
      setResult({ ok: true, text: copy.done });
      onChanged?.(copy.next);
    } catch (err) {
      setPending(null);
      setResult({ ok: false, text: err.response?.data?.msg || "Could not update the appointment." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {action && !pending && (
        <button type="button" className="adp-alt-btn" onClick={() => setPending(action)}>
          {COPY[action].button}
        </button>
      )}
      {pending && (
        <span role="alertdialog" style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ maxWidth: 340, fontSize: 13 }}>{COPY[pending].question}</span>
          <button type="button" className="adp-alt-btn" disabled={busy} onClick={() => run(pending)}>
            {busy ? "Working…" : COPY[pending].yes}
          </button>
          <button type="button" className="adp-back-button" disabled={busy} onClick={() => setPending(null)}>
            Cancel
          </button>
        </span>
      )}
      {result && (
        <span role="status" style={{ fontSize: 13, color: result.ok ? "#15803d" : "#b91c1c" }}>
          {result.text}
        </span>
      )}
    </>
  );
}
