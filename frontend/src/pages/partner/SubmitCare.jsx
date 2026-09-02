import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import partnerApi from "../../api/partnerApi";
import { URGENCY_META, SERVICE_META } from "./caseConstants";
import "./partner.css";

const STEPS = ["When", "What", "Where", "Patient"];

const EMPTY = {
  urgency: "routine",
  serviceType: "teleconsultation",
  preferredDate: "",
  preferredTime: "",
  country: "",
  state: "",
  pharmacyAddress: "",
  clinicName: "",
  address: "",
  patientName: "",
  dob: "",
  gender: "",
  phone: "",
  language: "",
  policyId: "",
  complaint: "",
};

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
        policyId: form.policyId,
        complaint: form.complaint,
      },
      location: {
        country: form.country,
        state: form.state,
        pharmacyAddress: form.serviceType === "teleconsultation" ? form.pharmacyAddress : "",
        clinicName: form.serviceType === "in-clinic" ? form.clinicName : "",
        address: form.serviceType === "teleconsultation" ? "" : form.address,
      },
    });
  };

  return (
    <div className="pt-page" style={{ maxWidth: 620 }}>
      <div className="pt-page-head">
        <div>
          <h1 className="pt-page-title">Submit new case</h1>
          <p className="pt-page-sub">Provide the details and our team will action it</p>
        </div>
      </div>

      <div className="pt-wizard-steps">
        {STEPS.map((label, i) => (
          <div key={label}>
            <div className={`pt-wizard-bar${step >= i + 1 ? " on" : ""}`} />
            <p className={`pt-wizard-label${step === i + 1 ? " on" : ""}`}>
              {i + 1}. {label}
            </p>
          </div>
        ))}
      </div>

      <div className="pt-card">
        {error && <div className="pt-error">{error}</div>}

        {step === 1 && (
          <>
            <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>When is the service needed?</h3>
            <div className="pt-field">
              <label>Urgency level</label>
              <div style={{ display: "flex", gap: 8 }}>
                {Object.entries(URGENCY_META).map(([key, val]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set({ urgency: key })}
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: form.urgency === key ? `2px solid ${val.color}` : "1.5px solid #e2e8f0",
                      background: form.urgency === key ? `${val.color}18` : "#fff",
                      color: form.urgency === key ? val.color : "#334155",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {val.label}
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
            <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>What type of service?</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Object.entries(SERVICE_META).map(([key, val]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => set({ serviceType: key })}
                  style={{
                    textAlign: "left",
                    padding: "12px 14px",
                    borderRadius: 9,
                    border: form.serviceType === key ? "2px solid #0ea5e9" : "1.5px solid #e2e8f0",
                    background: form.serviceType === key ? "#e0f2fe" : "#fff",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{val.label}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{val.desc}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Where is the patient?</h3>
            <div className="pt-grid-2">
              <div className="pt-field">
                <label>Country *</label>
                <input value={form.country} onChange={(e) => set({ country: e.target.value })} />
              </div>
              <div className="pt-field">
                <label>State / Province</label>
                <input value={form.state} onChange={(e) => set({ state: e.target.value })} />
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
            <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Patient information</h3>
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
              <label>Policy / insurance ID</label>
              <input value={form.policyId} onChange={(e) => set({ policyId: e.target.value })} />
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

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 18,
            paddingTop: 14,
            borderTop: "1px solid #f1f5f9",
          }}
        >
          <button
            type="button"
            className="pt-btn pt-btn-ghost"
            disabled={step === 1 || mutation.isPending}
            onClick={() => {
              setError("");
              setStep((s) => Math.max(1, s - 1));
            }}
          >
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
            </button>
          ) : (
            <button type="button" className="pt-btn" disabled={mutation.isPending} onClick={submit}>
              {mutation.isPending ? "Submitting…" : "Submit case"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
