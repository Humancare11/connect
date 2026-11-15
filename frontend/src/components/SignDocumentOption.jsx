import { useEffect, useRef, useState } from "react";
import SignaturePanel from "./SignaturePanel";
import "./SignaturePanel.css";

/**
 * "Sign this document" control for the Prescription and Medical Certificate forms (and, compact, the video-call panel).
 *
 *   sig            hooks/useDoctorSignature()
 *   sign           whether the document will be signed (state lives in the form)
 *   onSignChange   (boolean) => void
 *   noun           "prescription" | "certificate"
 *   compact        video call: checkbox only, never a panel; no saved signature = short message with a link
 *
 * ON by default once a saved signature is known (until the doctor touches the box). With no saved signature the
 * doctor is prompted to upload or draw one, but can still issue unsigned: this never blocks the form.
 */
export default function SignDocumentOption({ sig, sign, onSignChange, noun = "document", compact = false, profilePath = "/doctor-dashboard/profile" }) {
  const touched = useRef(false);
  const [changing, setChanging] = useState(false);

  // Default ON as soon as a saved signature exists (also right after the doctor saves their first one here).
  useEffect(() => {
    if (!touched.current && sig.hasSignature) onSignChange(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig.hasSignature]);

  // Never leave "sign" ticked when there is nothing to sign with.
  useEffect(() => {
    if (!sig.loading && !sig.hasSignature && sign) onSignChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig.loading, sig.hasSignature, sign]);

  const toggle = (checked) => {
    touched.current = true;
    onSignChange(checked);
  };

  if (sig.loading) return null;

  if (compact) {
    return sig.hasSignature ? (
      <label className="sgp-check">
        <input type="checkbox" checked={sign} onChange={(e) => toggle(e.target.checked)} />
        <span>Sign with saved signature</span>
      </label>
    ) : (
      <p className="sgp-muted">
        No saved signature, so this {noun} will be issued unsigned.{" "}
        <a href={profilePath} target="_blank" rel="noreferrer">Add a signature</a> (opens in a new tab; your call continues).
      </p>
    );
  }

  return (
    <div className="sgp-option">
      {sig.hasSignature ? (
        <>
          <label className="sgp-check">
            <input type="checkbox" checked={sign} onChange={(e) => toggle(e.target.checked)} />
            <span>Sign this {noun}</span>
          </label>
          {sign && sig.imageUrl && <div className="sgp-img-box"><img src={sig.imageUrl} alt="Your saved signature" /></div>}
          {sign && <p className="sgp-muted">Once issued, a signed {noun} cannot be edited.</p>}
          <button type="button" className="sgp-btn sgp-btn--link" onClick={() => setChanging((v) => !v)}>
            {changing ? "Hide signature options" : "Change signature"}
          </button>
          {changing && <SignaturePanel sig={sig} onSaved={() => setChanging(false)} />}
        </>
      ) : (
        <SignaturePanel
          sig={sig}
          prompt={`You have no saved signature. Upload or draw one to sign this ${noun}, or leave it and issue the ${noun} unsigned.`}
        />
      )}
    </div>
  );
}
