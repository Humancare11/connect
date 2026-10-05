import { useEffect, useRef, useState } from "react";
import api from "../api";

const DANGER = "#c0392b";
const DANGER_BG = "#fcedec";
const FONT = "'Plus Jakarta Sans', sans-serif";
const REASON_MAX = 500;

// Same wording as the mobile app's Delete Account screen, apart from the last
// bullet: the backend now emails the patient when the request is received and
// again when it has been processed.
const WARNING =
  "Deleting your account is permanent. Once processed, you will lose access to your appointment history, medical records, and any saved details in your account.";
const NEXT_STEPS = [
  "Submitting this form sends a deletion request to our support team — it is not instant.",
  "We will delete your personal data, except where we are required to retain records (e.g. medical or billing history) to comply with the law.",
  "We will email you when your request is received and again once it has been processed.",
];

const FOCUSABLE = 'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), a[href]';

/**
 * Confirmation modal for "Delete my account". Submits a deletion REQUEST
 * (POST /api/auth/account-delete-request) that an admin approves or rejects;
 * the account stays active and the user stays signed in meanwhile.
 *
 * Props: onClose(), onSubmitted(user) — `user` is the server's updated copy.
 */
export default function DeleteAccountModal({ onClose, onSubmitted }) {
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef(null);
  const reasonRef = useRef(null);
  const doneRef = useRef(null);

  // Lock page scroll while open, and put focus inside.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    reasonRef.current?.focus();
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => {
    if (submitted) doneRef.current?.focus();
  }, [submitted]);

  const requestClose = () => {
    if (!submitting) onClose();
  };

  // Esc closes (not mid-request); Tab stays inside the dialog.
  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      requestClose();
      return;
    }
    if (e.key !== "Tab") return;
    const nodes = dialogRef.current?.querySelectorAll(FOCUSABLE);
    if (!nodes || nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!acknowledged || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await api.post(
        "/api/auth/account-delete-request",
        { reason: reason.trim() },
        { authRole: "user" },
      );
      setSubmitted(true);
      onSubmitted?.(res.data?.user);
    } catch (err) {
      const status = err?.response?.status;
      if (!err?.response) {
        setError("We couldn't reach the server. Check your connection and try again.");
      } else if (status === 400 && /already pending/i.test(err.response.data?.msg || "")) {
        // Someone (this tab, the app, another tab) already asked — show the
        // pending state instead of leaving the user stuck on a form.
        setSubmitted(true);
        onSubmitted?.(null, { alreadyPending: true });
      } else {
        setError(
          err.response.data?.msg ||
            "Unable to submit your request right now. Please try again, or email support@humancareconnect.co.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose(); }}
      onKeyDown={onKeyDown}
      style={{
        position: "fixed", inset: 0, zIndex: 1000, background: "rgba(11,4,67,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
        fontFamily: FONT,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dam-title"
        style={{
          background: "#fff", borderRadius: "20px", width: "100%", maxWidth: "520px",
          maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(11,4,67,0.28)",
          boxSizing: "border-box", padding: "26px 26px 22px",
        }}
      >
        {submitted ? (
          <div style={{ textAlign: "center", padding: "10px 4px 2px" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#eaedf9", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }} aria-hidden="true">✉️</div>
            <h2 id="dam-title" style={{ fontSize: 19, fontWeight: 800, color: "#0b0443", margin: "0 0 10px" }}>
              Request submitted
            </h2>
            <p style={{ fontSize: 14, color: "#6b7ca3", lineHeight: 1.6, margin: "0 0 8px" }}>
              We've received your account deletion request. Our support team will review it and email you once it has been processed.
            </p>
            <p style={{ fontSize: 13.5, color: "#6b7ca3", lineHeight: 1.6, margin: "0 0 20px" }}>
              Your account stays active until then, and you can cancel the request from Profile Settings at any time.
            </p>
            <button
              ref={doneRef}
              type="button"
              onClick={onClose}
              style={{ padding: "11px 30px", borderRadius: 12, border: "1.5px solid #083ab0", background: "#fff", color: "#083ab0", fontFamily: FONT, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <h2 id="dam-title" style={{ fontSize: 19, fontWeight: 800, color: "#0b0443", margin: "0 0 14px" }}>
              Delete your account
            </h2>

            <div role="alert" style={{ display: "flex", gap: 10, background: DANGER_BG, color: DANGER, borderRadius: 12, padding: "13px 14px", fontSize: 13.5, lineHeight: 1.5, marginBottom: 18 }}>
              <span aria-hidden="true">⚠️</span>
              <span>{WARNING}</span>
            </div>

            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#0b0443", margin: "0 0 8px" }}>What happens next</h3>
            <ul style={{ margin: "0 0 20px", paddingLeft: 18, color: "#6b7ca3", fontSize: 13, lineHeight: 1.55 }}>
              {NEXT_STEPS.map((text) => (
                <li key={text} style={{ marginBottom: 5 }}>{text}</li>
              ))}
            </ul>

            <label htmlFor="dam-reason" style={{ display: "block", fontSize: 13, fontWeight: 800, color: "#0b0443", marginBottom: 8 }}>
              Reason (optional)
            </label>
            <textarea
              id="dam-reason"
              ref={reasonRef}
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
              rows={4}
              maxLength={REASON_MAX}
              placeholder="Let us know why you're leaving — it helps us improve."
              style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12, border: "1.5px solid rgba(203,213,225,0.9)", fontFamily: FONT, fontSize: 14, color: "#0b0443", resize: "vertical", outline: "none" }}
            />
            <div style={{ textAlign: "right", fontSize: 11.5, color: "#94a3b8", margin: "4px 0 12px" }}>
              {reason.length}/{REASON_MAX}
            </div>

            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", fontSize: 13.5, color: "#0b0443", lineHeight: 1.5, marginBottom: 16 }}>
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 2, accentColor: DANGER, flexShrink: 0 }}
              />
              <span>I understand this action is permanent and I want to request deletion of my account and data.</span>
            </label>

            {error && (
              <div role="alert" style={{ background: DANGER_BG, color: DANGER, borderRadius: 10, padding: "10px 12px", fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={requestClose}
                disabled={submitting}
                style={{ padding: "11px 22px", borderRadius: 12, border: "1.5px solid rgba(203,213,225,0.9)", background: "#fff", color: "#6b7ca3", fontFamily: FONT, fontSize: 14, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer" }}
              >
                Keep my account
              </button>
              <button
                type="submit"
                disabled={!acknowledged || submitting}
                style={{ padding: "11px 24px", borderRadius: 12, border: "none", background: DANGER, color: "#fff", fontFamily: FONT, fontSize: 14, fontWeight: 700, cursor: !acknowledged || submitting ? "not-allowed" : "pointer", opacity: !acknowledged || submitting ? 0.45 : 1 }}
              >
                {submitting ? "Submitting…" : "Submit deletion request"}
              </button>
            </div>

            <p style={{ textAlign: "center", fontSize: 12.5, color: "#6b7ca3", margin: "16px 0 0" }}>
              Prefer email?{" "}
              <a href="mailto:support@humancareconnect.co?subject=Account%20Deletion%20Request" style={{ color: "#083ab0", fontWeight: 700 }}>
                support@humancareconnect.co
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
