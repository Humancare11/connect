import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { SIGNATURE_CHANGED_EVENT } from "../hooks/useDoctorSignature";
import "./SignaturePanel.css";

export const SIGNATURE_BANNER_DISMISS_KEY = "hc-doctor-signature-banner-dismissed";

const readDismissed = () => {
  try {
    return sessionStorage.getItem(SIGNATURE_BANNER_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * Heads-up on every doctor dashboard page until the doctor has saved a signature (it is required to issue
 * prescriptions, certificates and visit notes). Dismissible for this browser session only: the key is cleared on
 * logout, so it comes back next login. Hides itself when a signature is saved anywhere (SIGNATURE_CHANGED_EVENT),
 * and never shows if the check fails. (Visit Notes always need a signature, so it also shows when the server's
 * REQUIRE_DOCTOR_SIGNATURE switch has made signing optional on prescriptions/certificates.)
 */
export default function DoctorSignatureBanner() {
  const [missing, setMissing] = useState(false);
  const [dismissed, setDismissed] = useState(readDismissed);

  const check = useCallback(() => {
    api
      .get("/api/doctor/signature", { authRole: "doctor" })
      .then(({ data }) => setMissing(!data?.hasSignature))
      .catch(() => setMissing(false));
  }, []);

  useEffect(() => {
    check();
    window.addEventListener(SIGNATURE_CHANGED_EVENT, check);
    return () => window.removeEventListener(SIGNATURE_CHANGED_EVENT, check);
  }, [check]);

  if (!missing || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(SIGNATURE_BANNER_DISMISS_KEY, "1");
    } catch {
      // Non-fatal: it just comes back on the next page.
    }
  };

  return (
    <div className="sgp-banner" role="status">
      <span>
        <strong>Add your signature.</strong> It is required to issue prescriptions, medical certificates and visit notes.{" "}
        <Link to="/doctor-dashboard/profile">Add it in My Signature</Link>
      </span>
      <button type="button" className="sgp-banner__x" onClick={dismiss} aria-label="Dismiss for this session">✕</button>
    </div>
  );
}
