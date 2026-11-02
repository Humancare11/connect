import { useState } from "react";
import api, { clearUserAuthToken } from "../api";
import { clearClientSession } from "../utils/session";

// The two doctor pages that show this panel (the enrollment wizard and the dashboard profile editor) style their
// buttons and inputs with their own classes, so those are passed in. The default is the wizard's.
const SUCCESS_MESSAGE = "Your email has been updated successfully. Please log in using your new email address.";
const REDIRECT_DELAY_MS = 2500;

const WIZARD_CLASSES = {
  input: "field-input",
  primary: "btn btn-primary",
  secondary: "btn btn-secondary",
  error: "field-error",
  info: "",
};

// Changes the doctor's LOGIN email: the OTP goes to the new address, and only after it is verified does the backend swap
// the email and revoke every session. On success this clears the browser's own sign-in state (the same cleanup a normal
// sign-out does; it does not itself invalidate any token, the server already did) and sends the doctor to the login page.
export default function ChangeEmailPanel({ classes = WIZARD_CLASSES, note = "" }) {
  const cls = { ...WIZARD_CLASSES, ...classes };
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [done, setDone] = useState(false);

  const reset = () => {
    setOpen(false);
    setNewEmail("");
    setOtp("");
    setOtpSent(false);
    setError("");
    setInfo("");
  };

  const sendOtp = async () => {
    setError("");
    setInfo("");
    if (!/^\S+@\S+\.\S+$/.test(newEmail.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post("/api/doctor/profile/email-change/request", {
        newEmail: newEmail.trim(),
      });
      setOtpSent(true);
      setInfo(res.data?.message || "An OTP has been sent to your new email address.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not send the OTP. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    setError("");
    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Enter the 6-digit OTP.");
      return;
    }
    if (done) return;
    setBusy(true);
    try {
      await api.post("/api/doctor/profile/email-change/verify", {
        newEmail: newEmail.trim(),
        otp: otp.trim(),
      });
      // Only reached once the backend has confirmed the change. The panel stays locked (busy) until the redirect.
      setDone(true);
      setInfo("");
      // Every server session was revoked; drop this browser's sign-in state and reload at the login page.
      clearUserAuthToken();
      clearClientSession();
      setTimeout(() => window.location.assign("/doctor-login"), REDIRECT_DELAY_MS);
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed. Please try again.");
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        className={cls.secondary}
        style={{ marginTop: 8, alignSelf: "flex-start" }}
        onClick={() => setOpen(true)}
      >
        Change Email
      </button>
    );
  }

  return (
    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
      {note && <div style={{ fontSize: 12, color: "#64748b" }}>{note}</div>}
      <input
        className={cls.input}
        type="email"
        placeholder="New email address"
        value={newEmail}
        disabled={otpSent || busy}
        onChange={(e) => setNewEmail(e.target.value)}
      />
      {otpSent && (
        <input
          className={cls.input}
          inputMode="numeric"
          maxLength={6}
          placeholder="6-digit OTP"
          value={otp}
          disabled={busy}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
        />
      )}
      {done && (
        <div
          role="status"
          aria-live="polite"
          style={{ fontSize: 13, color: "#166534", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "8px 10px" }}
        >
          {SUCCESS_MESSAGE}
        </div>
      )}
      {info && <div style={{ fontSize: 12, color: "#475569" }}>{info}</div>}
      {error && (
        <div className={cls.error} style={cls.error === "field-error" ? undefined : { fontSize: 12, color: "#dc2626" }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {otpSent ? (
          <>
            <button type="button" className={cls.primary} disabled={busy} onClick={verifyOtp}>
              Verify
            </button>
            <button type="button" className={cls.secondary} disabled={busy} onClick={sendOtp}>
              Resend OTP
            </button>
          </>
        ) : (
          <button type="button" className={cls.primary} disabled={busy} onClick={sendOtp}>
            Send OTP
          </button>
        )}
        <button type="button" className={cls.secondary} disabled={busy} onClick={reset}>
          Cancel
        </button>
      </div>
    </div>
  );
}
