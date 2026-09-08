import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import partnerApi from "../../api/partnerApi";
import { URGENCY_META, SERVICE_META } from "./caseConstants";
import "./Submit.css";
 
const STEPS = ["When", "What", "Where", "Patient"];
 
const EMPTY = {
  urgency: "routine",
  serviceType: "teleconsultation",
  preferredDate: "",
  preferredTime: "",
  country: "",
  state: "",
  postalCode: "",
  pharmacyAddress: "",
  clinicName: "",
  address: "",
  patientName: "",
  dob: "",
  gender: "",
  phone: "",
  language: "",
  complaint: "",
};
 
/* ---- presentation-only icon maps (no logic here, just UI) ---- */
const URGENCY_ICONS = {
  routine: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  ),
  urgent: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </svg>
  ),
  emergency: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
};
const DEFAULT_URGENCY_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
  </svg>
);
 
const SERVICE_ICONS = {
  teleconsultation: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  ),
  "house-call": (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5 12 3l9 6.5" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </svg>
  ),
  "in-clinic": (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21V7l9-4 9 4v14" />
      <path d="M9 21v-6h6v6M9 12h.01M15 12h.01M12 8h.01" />
    </svg>
  ),
};
const DEFAULT_SERVICE_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2" />
  </svg>
);
 
export default function SubmitCare() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
 
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
 
  const mutation = useMutation({
    mutationFn: (payload) => partnerApi.submitCase(payload),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["partner"] });
      navigate(`/partner-dashboard/cases/${created._id}`, { replace: true });
    },
    onError: (err) => setError(err.response?.data?.msg || "Could not submit the case."),
  });
 
  const submit = () => {
    setError("");
    if (!form.patientName.trim()) {
      setStep(4);
      setError("Patient name is required.");
      return;
    }
    if (!form.complaint.trim()) {
      setStep(4);
      setError("A chief complaint is required.");
      return;
    }
    if (!form.country.trim()) {
      setStep(3);
      setError("Patient country is required.");
      return;
    }
    mutation.mutate({
      serviceType: form.serviceType,
      urgency: form.urgency,
      preferredDate: form.preferredDate,
      preferredTime: form.preferredTime,
      patient: {
        name: form.patientName,
        dob: form.dob,
        gender: form.gender,
        phone: form.phone,
        language: form.language,
        complaint: form.complaint,
      },
      location: {
        country: form.country,
        state: form.state,
        postalCode: form.postalCode,
        pharmacyAddress: form.serviceType === "teleconsultation" ? form.pharmacyAddress : "",
        clinicName: form.serviceType === "in-clinic" ? form.clinicName : "",
        address: form.serviceType === "teleconsultation" ? "" : form.address,
      },
    });
  };
 
  return (
    <div className="pt-page pt-submit-page">
      <div className="pt-page-head">
        <div>
          <span className="pt-page-eyebrow">New case</span>
          <h1 className="pt-page-title">Submit new case</h1>
          <p className="pt-page-sub">Provide the details and our team will action it</p>
        </div>
      </div>
 
      <ol className="pt-stepper" aria-label={`Step ${step} of ${STEPS.length}`}>
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = step > n;
          const current = step === n;
          return (
            <li
              key={label}
              className={`pt-stepper-item${done ? " is-done" : ""}${
                current ? " is-current" : ""
              }`}
              aria-current={current ? "step" : undefined}
            >
              <span className="pt-stepper-marker">
                {done ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  n
                )}
              </span>
              <span className="pt-stepper-label">{label}</span>
            </li>
          );
        })}
      </ol>
 
      <div className="pt-card pt-submit-card">
        {error && (
          <div className="pt-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16h.01" />
            </svg>
            <span>{error}</span>
          </div>
        )}
 
        {step === 1 && (
          <>
            <h3 className="pt-step-title">When is the service needed?</h3>
            <div className="pt-field">
              <label>Urgency level</label>
              <div className="pt-urgency-grid">
                {Object.entries(URGENCY_META).map(([key, val]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set({ urgency: key })}
                    className={`pt-urgency-card${form.urgency === key ? " selected" : ""}`}
                    style={{ "--u-color": val.color }}
                  >
                    <span className="pt-urgency-icon">{URGENCY_ICONS[key] || DEFAULT_URGENCY_ICON}</span>
                    <span className="pt-urgency-label">{val.label}</span>
                    <span className="pt-urgency-dot" />
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-grid-2">
              <div className="pt-field">
                <label>Preferred date</label>
                <input
                  type="date"
                  value={form.preferredDate}
                  onChange={(e) => set({ preferredDate: e.target.value })}
                />
              </div>
              <div className="pt-field">
                <label>Preferred time</label>
                <input
                  type="time"
                  value={form.preferredTime}
                  onChange={(e) => set({ preferredTime: e.target.value })}
                />
              </div>
            </div>
          </>
        )}
 
        {step === 2 && (
          <>
            <h3 className="pt-step-title">What type of service?</h3>
            <div className="pt-service-list">
              {Object.entries(SERVICE_META).map(([key, val]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => set({ serviceType: key })}
                  className={`pt-service-card${form.serviceType === key ? " selected" : ""}`}
                >
                  <span className="pt-service-icon">{SERVICE_ICONS[key] || DEFAULT_SERVICE_ICON}</span>
                  <span className="pt-service-text">
                    <span className="pt-service-title">{val.label}</span>
                    <span className="pt-service-desc">{val.desc}</span>
                  </span>
                  <span className="pt-service-check" aria-hidden="true">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
 
        {step === 3 && (
          <>
            <h3 className="pt-step-title">Where is the patient?</h3>
            <div className="pt-grid-3">
              <div className="pt-field">
                <label>Country *</label>
                <input value={form.country} onChange={(e) => set({ country: e.target.value })} />
              </div>
              <div className="pt-field">
                <label>State / Province</label>
                <input value={form.state} onChange={(e) => set({ state: e.target.value })} />
              </div>
              <div className="pt-field">
                <label>Pincode / ZIP code</label>
                <input
                  value={form.postalCode}
                  onChange={(e) => set({ postalCode: e.target.value })}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="e.g. 560001"
                />
              </div>
            </div>
            {form.serviceType === "teleconsultation" && (
              <div className="pt-field">
                <label>Pharmacy address (optional)</label>
                <input
                  value={form.pharmacyAddress}
                  onChange={(e) => set({ pharmacyAddress: e.target.value })}
                />
              </div>
            )}
            {form.serviceType === "in-clinic" && (
              <div className="pt-field">
                <label>Clinic / hospital name</label>
                <input value={form.clinicName} onChange={(e) => set({ clinicName: e.target.value })} />
              </div>
            )}
            {(form.serviceType === "house-call" || form.serviceType === "in-clinic") && (
              <div className="pt-field">
                <label>Full address</label>
                <input value={form.address} onChange={(e) => set({ address: e.target.value })} />
              </div>
            )}
          </>
        )}
 
        {step === 4 && (
          <>
            <h3 className="pt-step-title">Patient information</h3>
            <div className="pt-field">
              <label>Full name *</label>
              <input
                value={form.patientName}
                onChange={(e) => set({ patientName: e.target.value })}
              />
            </div>
            <div className="pt-grid-2">
              <div className="pt-field">
                <label>Date of birth</label>
                <input type="date" value={form.dob} onChange={(e) => set({ dob: e.target.value })} />
              </div>
              <div className="pt-field">
                <label>Gender</label>
                <select value={form.gender} onChange={(e) => set({ gender: e.target.value })}>
                  <option value="">Select</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="pt-field">
                <label>Phone number</label>
                <input value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
              </div>
              <div className="pt-field">
                <label>Language preference</label>
                <input value={form.language} onChange={(e) => set({ language: e.target.value })} />
              </div>
            </div>
            <div className="pt-field">
              <label>Chief complaint / symptoms *</label>
              <textarea
                rows={3}
                value={form.complaint}
                onChange={(e) => set({ complaint: e.target.value })}
              />
            </div>
          </>
        )}
 
        <div className="pt-actions">
          <button
            type="button"
            className="pt-btn pt-btn-ghost"
            disabled={step === 1 || mutation.isPending}
            onClick={() => {
              setError("");
              setStep((s) => Math.max(1, s - 1));
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          {step < 4 ? (
            <button
              type="button"
              className="pt-btn"
              onClick={() => {
                setError("");
                setStep((s) => Math.min(4, s + 1));
              }}
            >
              Next
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button type="button" className="pt-btn pt-btn-submit" disabled={mutation.isPending} onClick={submit}>
              {mutation.isPending ? "Submitting…" : "Submit case"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}