import { useState } from "react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { GENDER_OPTIONS, DOB_MIN, todayIst, dobError, genderError } from "../../utils/patientProfile";

// Checkout step shown after login and before payment when the patient's profile has no date of birth or gender. It is asked once:
// the answers are saved to the profile (PUT /api/auth/patient-details) and never asked again.
export default function PatientDetailsStep({ onSaved, onBack }) {
  const { user, updateUser } = useAuth();
  const [dob, setDob] = useState(user?.dob || "");
  const [gender, setGender] = useState(user?.gender || "");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  const save = async () => {
    const next = { dob: dobError(dob), gender: genderError(gender) };
    setErrors(next);
    setSaveErr("");
    if (next.dob || next.gender) return;
    setSaving(true);
    try {
      const res = await api.put("/api/auth/patient-details", { dob, gender });
      updateUser({ ...user, ...res.data.user });
      onSaved?.();
    } catch (err) {
      setSaveErr(err?.response?.data?.msg || "Could not save your details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ap-form">
      {onBack && (
        <button className="ap-pay-back" type="button" onClick={onBack}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to details
        </button>
      )}
      <div className="ap-step">
        <div className="ap-step-title" style={{ fontSize: 16 }}>Complete your details</div>
        <div className="ap-step-meta" style={{ marginTop: 4 }}>
          We need this once, for your safety. Next time we won't ask again.
        </div>
      </div>

      <div className="ap-step">
        <div className="ap-step-header">
          <div className="ap-step-title">
            <label htmlFor="ap-details-dob">Date of Birth</label> <span style={{ color: "#e11d48" }}>*</span>
          </div>
        </div>
        <input
          id="ap-details-dob"
          className={`ap-date-input${errors.dob ? " ap-date-input--err" : ""}`}
          type="date"
          lang="en-US"
          value={dob}
          min={DOB_MIN}
          max={todayIst()}
          aria-invalid={errors.dob ? "true" : undefined}
          aria-describedby={errors.dob ? "ap-details-dob-error" : undefined}
          onChange={(e) => {
            setDob(e.target.value);
            setErrors((prev) => ({ ...prev, dob: "" }));
          }}
        />
        {errors.dob && <p className="ap-error" id="ap-details-dob-error" role="alert">{errors.dob}</p>}
      </div>

      <div className="ap-step" role="radiogroup" aria-labelledby="ap-details-gender-label">
        <div className="ap-step-header">
          <div className="ap-step-title" id="ap-details-gender-label">
            Gender <span style={{ color: "#e11d48" }}>*</span>
          </div>
        </div>
        <div className="ap-gender-options">
          {GENDER_OPTIONS.map((g) => (
            <label key={g} className={`ap-gender-option${gender === g ? " ap-gender-option--on" : ""}`}>
              <input
                type="radio"
                name="ap-details-gender"
                value={g}
                checked={gender === g}
                onChange={() => {
                  setGender(g);
                  setErrors((prev) => ({ ...prev, gender: "" }));
                }}
              />
              <span>{g}</span>
            </label>
          ))}
        </div>
        {errors.gender && <p className="ap-error" role="alert">{errors.gender}</p>}
      </div>

      {saveErr && <p className="ap-error" role="alert">{saveErr}</p>}

      <button className="ap-submit" type="button" disabled={saving} onClick={save}>
        {saving ? (
          <>
            <span className="ap-spinner ap-spinner--white" /> Saving…
          </>
        ) : (
          "Save & Continue to Payment →"
        )}
      </button>
    </div>
  );
}
