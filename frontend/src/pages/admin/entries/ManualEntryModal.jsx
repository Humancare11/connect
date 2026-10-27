import { useMemo, useState } from "react";
import { Country } from "country-state-city";
import Modal from "../../../components/ui/Modal";
import { createManualEntry, editManualEntry } from "./entriesApi";
import {
  CASE_STATUSES, LOCKED_WHEN_PAID, MAX_FEEDBACK, MAX_PHONE, MR_STATUSES, PAYMENT_RECEIVED, PAYMENT_TO_PROVIDER, SENT_STATUSES, SERVICE_TYPES,
  calculation, changeField, formBody, formFromRow, formProblem, newForm, saveErrorText,
} from "./entriesFormat";

let countryNames = null;
const allCountryNames = () => (countryNames ||= Country.getAllCountries().map((c) => c.name));

// Today as the date input wants it, in the browser's own time zone.
function todayInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "Add manual entry" (no `row`) and "Edit" (a manual `row`): the same big popup, seven numbered sections, laid out as in
// docs/appointment-entries-manual-form-reference.html. Once Payment to provider is Paid, the case, service provider, patient and fee
// fields are locked (the server enforces it too); the medical report, invoice, payment received and feedback stay editable.
// "Calculation (our margin)" is worked out here and never sent.
export default function ManualEntryModal({ row, onSaved, onClose }) {
  const editing = Boolean(row);
  const today = useMemo(todayInput, []);
  const [form, setForm] = useState(() => (editing ? formFromRow(row) : newForm(today)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const locked = editing && row.entry.paidStatus === "paid";
  const isLocked = (key) => locked && LOCKED_WHEN_PAID.includes(key);
  const set = (key) => (event) => setForm((f) => changeField(f, key, event.target.value, today));
  const calc = calculation(form);
  const paidToProvider = form.paymentToProvider === "paid";
  const received = form.paymentReceived !== "not_received";

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const problem = formProblem(form);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = editing ? await editManualEntry(row.id, formBody(form, row.entry.version)) : await createManualEntry(formBody(form));
      onSaved(res.data.item, { added: !editing, noop: Boolean(res.data.noop) });
    } catch (err) {
      // A row that changed meanwhile (or got marked Paid) comes back with its current state.
      if (err.response?.data?.item) onSaved(err.response.data.item, { conflict: true });
      setError(saveErrorText(err));
      setSaving(false);
    }
  };

  const text = (key, label, props = {}) => (
    <label className={props.className}>
      <span className={props.required ? "en-req" : undefined}>{label}</span>
      <input
        value={form[key]}
        onChange={set(key)}
        disabled={isLocked(key)}
        required={props.required}
        maxLength={props.maxLength}
        placeholder={props.placeholder}
        inputMode={props.inputMode}
        list={props.list}
        type={props.type}
        autoFocus={props.autoFocus}
      />
      {props.list === "en-countries" && (
        <datalist id="en-countries">
          {allCountryNames().map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      )}
    </label>
  );
  const choice = (key, label, options) => (
    <label>
      <span>{label}</span>
      <select value={form[key]} onChange={set(key)} disabled={isLocked(key)}>
        {key === "serviceType" && form.serviceType === "" && <option value="">Not set</option>}
        {options.map(([value, optionText]) => (
          <option key={value} value={value}>
            {optionText}
          </option>
        ))}
      </select>
    </label>
  );
  const section = (n, title, body) => (
    <section className="en-section">
      <h4>
        <span>{n}</span>
        {title}
      </h4>
      {body}
    </section>
  );

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      title={editing ? `Edit manual entry · ${row.shortId}` : "Add manual entry"}
      description={editing ? "Every change is recorded." : "A case that didn’t come through the website or app, for example sent by a partner company."}
      className="en-modal en-modal--wide"
    >
      <button type="button" className="en-x" onClick={onClose} disabled={saving} aria-label="Close">
        ✕
      </button>
      <form onSubmit={submit} noValidate className="en-bigform">
        <div className="en-sections">
          {locked && (
            <p className="en-lock-note" role="note">
              Payment to provider is <b>Paid</b>, so the case, service provider, patient and fee fields are locked. The medical report, invoice,
              payment received and feedback can still change. To change the rest, set Payment to provider back first.
            </p>
          )}

          {section(
            1,
            "Case",
            <div className="en-grid en-grid--3">
              {text("date", "Date", { type: "date", required: true })}
              {text("company", "Company", { maxLength: 120, placeholder: "e.g. Allianz Care" })}
              {text("caseNumber", "Case number", { maxLength: 60, placeholder: "e.g. ALZ-2026-10432" })}
              {choice("serviceType", "Type of service", SERVICE_TYPES)}
              {form.serviceType === "others" && text("otherService", "Other service", { required: true, maxLength: 120, placeholder: "Describe the service" })}
              {choice("caseStatus", "Status", CASE_STATUSES)}
            </div>,
          )}

          {section(
            2,
            "Service provider",
            <div className="en-grid en-grid--3">
              {text("serviceProvider", "Service provider", { required: true, maxLength: 120, placeholder: "Doctor or clinic name", autoFocus: !editing })}
              {text("providerNumber", "Service provider number", { maxLength: MAX_PHONE, inputMode: "tel", placeholder: "+91 98765 43210" })}
            </div>,
          )}

          {section(
            3,
            "Patient",
            <div className="en-grid en-grid--3">
              {text("patientName", "Patient name", { required: true, maxLength: 80, placeholder: "Full name" })}
              {text("country", "Patient country", { maxLength: 60, placeholder: "e.g. United Arab Emirates", list: "en-countries" })}
              {text("contactNumber", "Contact number", { maxLength: MAX_PHONE, inputMode: "tel", placeholder: "+971 50 123 4567" })}
            </div>,
          )}

          {section(
            4,
            "Fees",
            <div className="en-grid en-grid--3">
              {text("consultationFee", "Consultation fee ($)", { inputMode: "decimal", placeholder: "0.00", required: true })}
              {text("doctorFee", "Doctor’s fee ($)", { inputMode: "decimal", placeholder: "0.00" })}
              <div className="en-calc" aria-live="polite" data-testid="calculation">
                <small>Calculation (our margin)</small>
                <b className={calc.negative ? "en-neg" : undefined}>{calc.empty ? "—" : calc.text}</b>
                <span>{calc.percent ? `${calc.percent} of the consultation fee` : "Consultation fee − Doctor’s fee"}</span>
              </div>
            </div>,
          )}

          {section(
            5,
            "Medical report & invoice",
            <div className="en-grid en-grid--3">
              {choice("mrStatus", "MR status from provider", MR_STATUSES)}
              {choice("mrSentToCompany", "MR sent to the company", SENT_STATUSES)}
              {choice("invoiceSent", "Invoice sent", SENT_STATUSES)}
            </div>,
          )}

          {section(
            6,
            "Payments",
            <div className="en-pay">
              <div className="en-paybox">
                <b>From the company</b>
                {choice("paymentReceived", "Payment received", PAYMENT_RECEIVED)}
                <label>
                  <span>Payment received date</span>
                  <input type="date" value={received ? form.paymentReceivedDate : ""} onChange={set("paymentReceivedDate")} disabled={!received} />
                </label>
              </div>
              <div className="en-paybox">
                <b>To the provider</b>
                {choice("paymentToProvider", "Payment to provider", PAYMENT_TO_PROVIDER)}
                <label>
                  <span>Paid date to the provider</span>
                  <input type="date" value={paidToProvider ? form.paidDateToProvider : ""} onChange={set("paidDateToProvider")} disabled={!paidToProvider} />
                </label>
              </div>
            </div>,
          )}

          {section(
            7,
            "Feedback",
            <>
              <div className="en-grid en-grid--2">
                <label>
                  <span>Feedback message sent</span>
                  <textarea value={form.feedbackSent} onChange={set("feedbackSent")} maxLength={MAX_FEEDBACK} rows={3} placeholder="The message sent to the patient asking for feedback" />
                </label>
                <label>
                  <span>Feedback received</span>
                  <textarea value={form.feedbackReceived} onChange={set("feedbackReceived")} maxLength={MAX_FEEDBACK} rows={3} placeholder="What the patient or company replied" />
                </label>
              </div>
              <div className="en-comment">{text("comment", "Comment", { maxLength: 500, placeholder: "Optional internal note" })}</div>
            </>,
          )}
        </div>

        <div className="en-popup-foot">
          {error && (
            <p className="en-form-error" role="alert">
              {error}
            </p>
          )}
          <div className="en-popup-buttons">
            <span className="en-reqnote">Patient name and service provider are required.</span>
            <button type="button" className="en-btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="en-btn en-btn--primary" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Save entry"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
