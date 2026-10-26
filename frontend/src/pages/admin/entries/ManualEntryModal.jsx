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

// "Add manual entry" (no `row`) and "Edit" (a manual `row`): the same big popup, seven sections. Once Payment to provider is Paid, the
// case, service provider, patient and fee fields are locked (the server enforces it too); the medical report, invoice, payment received
// and feedback stay editable. "Calculation (our margin)" is worked out here and never sent.
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
    <label className={`en-field${props.wide ? " en-field--full" : ""}`}>
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
    <label className="en-field">
      <span>{label}</span>
      <select value={form[key]} onChange={set(key)} disabled={isLocked(key)}>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      title={editing ? `Edit manual entry · ${row.shortId}` : "Add manual entry"}
      description={
        editing
          ? "Every change is recorded."
          : "For a case that wasn’t booked through the website or app, such as a house call or teleconsultation arranged for a company. It shows with a “Manual” label."
      }
      className="en-modal en-modal--wide"
    >
      <form onSubmit={submit} noValidate className="en-bigform">
        <div className="en-sections">
          {locked && (
            <p className="en-lock-note" role="note">
              Payment to provider is <b>Paid</b>, so the case, service provider, patient and fee fields are locked. The medical report, invoice,
              payment received and feedback can still change. To change the rest, set Payment to provider back first.
            </p>
          )}

          <fieldset className="en-section">
            <legend>1 · Case</legend>
            <div className="en-grid en-grid--3">
              {text("date", "Date", { type: "date", required: true })}
              {text("company", "Company", { maxLength: 120, placeholder: "e.g. Acme Assist" })}
              {text("caseNumber", "Case number", { maxLength: 60, placeholder: "e.g. AC-1042" })}
              {choice("serviceType", "Type of service", SERVICE_TYPES)}
              {choice("caseStatus", "Status", CASE_STATUSES)}
              {form.serviceType === "others" && text("otherService", "Other service", { required: true, maxLength: 120, placeholder: "Describe the service" })}
            </div>
          </fieldset>

          <fieldset className="en-section">
            <legend>2 · Service provider</legend>
            <div className="en-grid en-grid--2">
              {text("serviceProvider", "Service provider", { required: true, maxLength: 120, placeholder: "Doctor, clinic or company", autoFocus: !editing })}
              {text("providerNumber", "Service provider number", { maxLength: MAX_PHONE, inputMode: "tel", placeholder: "+971 50 123 4567" })}
            </div>
          </fieldset>

          <fieldset className="en-section">
            <legend>3 · Patient</legend>
            <div className="en-grid en-grid--3">
              {text("patientName", "Patient name", { required: true, maxLength: 80, placeholder: "e.g. Ravi Sharma" })}
              {text("country", "Patient country", { maxLength: 60, placeholder: "India", list: "en-countries" })}
              {text("contactNumber", "Contact number", { maxLength: MAX_PHONE, inputMode: "tel", placeholder: "+91 98765 43210" })}
            </div>
          </fieldset>

          <fieldset className="en-section">
            <legend>4 · Fees</legend>
            <div className="en-grid en-grid--3">
              {text("consultationFee", "Consultation fee ($)", { inputMode: "decimal", placeholder: "49.00", required: true })}
              {text("doctorFee", "Doctor’s fee ($)", { inputMode: "decimal", placeholder: "36.75" })}
              <div className="en-field">
                <span>Calculation (our margin)</span>
                <output className={`en-calc${calc.negative ? " en-calc--neg" : ""}`} aria-live="polite" data-testid="calculation">
                  <b>{calc.text}</b>
                  {calc.percent && <small>{calc.percent} of the consultation fee</small>}
                </output>
              </div>
            </div>
          </fieldset>

          <fieldset className="en-section">
            <legend>5 · Medical report &amp; invoice</legend>
            <div className="en-grid en-grid--3">
              {choice("mrStatus", "MR status from provider", MR_STATUSES)}
              {choice("mrSentToCompany", "MR sent to the company", SENT_STATUSES)}
              {choice("invoiceSent", "Invoice sent", SENT_STATUSES)}
            </div>
            <p className="en-hint">MR = medical report.</p>
          </fieldset>

          <fieldset className="en-section">
            <legend>6 · Payments</legend>
            <div className="en-pay">
              <div className="en-paybox">
                <h4>From the company</h4>
                {choice("paymentReceived", "Payment received", PAYMENT_RECEIVED)}
                <label className="en-field">
                  <span>Payment received date</span>
                  <input type="date" value={received ? form.paymentReceivedDate : ""} onChange={set("paymentReceivedDate")} disabled={!received} />
                </label>
              </div>
              <div className="en-paybox">
                <h4>To the provider</h4>
                {choice("paymentToProvider", "Payment to provider", PAYMENT_TO_PROVIDER)}
                <label className="en-field">
                  <span>Paid date to the provider</span>
                  <input type="date" value={paidToProvider ? form.paidDateToProvider : ""} onChange={set("paidDateToProvider")} disabled={!paidToProvider} />
                </label>
              </div>
            </div>
          </fieldset>

          <fieldset className="en-section">
            <legend>7 · Feedback</legend>
            <div className="en-grid en-grid--2">
              <label className="en-field">
                <span>Feedback message sent</span>
                <textarea value={form.feedbackSent} onChange={set("feedbackSent")} maxLength={MAX_FEEDBACK} rows={4} />
                <small className="en-count">
                  {form.feedbackSent.length} / {MAX_FEEDBACK}
                </small>
              </label>
              <label className="en-field">
                <span>Feedback received</span>
                <textarea value={form.feedbackReceived} onChange={set("feedbackReceived")} maxLength={MAX_FEEDBACK} rows={4} />
                <small className="en-count">
                  {form.feedbackReceived.length} / {MAX_FEEDBACK}
                </small>
              </label>
            </div>
            {text("comment", "Comment", { wide: true, maxLength: 500, placeholder: "e.g. Booked by phone, paid by bank transfer" })}
          </fieldset>
        </div>

        <div className="en-popup-foot">
          {error && (
            <p className="en-form-error" role="alert">
              {error}
            </p>
          )}
          <div className="en-popup-buttons">
            <button type="button" className="en-btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="en-btn en-btn--primary" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add entry"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
