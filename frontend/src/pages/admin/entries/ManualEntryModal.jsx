import { useEffect, useState } from "react";
import { Country } from "country-state-city";
import Modal from "../../../components/ui/Modal";
import { createManualEntry, editManualEntry, listApprovedDoctors } from "./entriesApi";
import { EMPTY_FORM, createBody, doctorOptions, editBody, formFromRow, formProblem, saveErrorText } from "./entriesFormat";

let countryNames = null;
const allCountryNames = () => (countryNames ||= Country.getAllCountries().map((c) => c.name));

// "Add manual entry" (no `row`) and "Edit" (a manual `row`): the same form. Editing changes the patient, country, doctor,
// consultation date and time, and fee charged, and only while the row is not Paid (the server refuses otherwise). The doctor
// fee, status, paid-on date and comment are typed in the table, as for every row.
export default function ManualEntryModal({ row, onSaved, onClose }) {
  const editing = Boolean(row);
  const [form, setForm] = useState(() => (editing ? formFromRow(row) : { ...EMPTY_FORM, date: todayInput() }));
  const [doctors, setDoctors] = useState([]);
  const [doctorsError, setDoctorsError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    listApprovedDoctors()
      .then((res) => alive && setDoctors(doctorOptions(res.data)))
      .catch(() => alive && setDoctorsError("Couldn’t load the doctor list."));
    return () => {
      alive = false;
    };
  }, []);

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

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
      const res = editing
        ? await editManualEntry(row.id, editBody(form, row.entry.version))
        : await createManualEntry(createBody(form));
      onSaved(res.data.item, { added: !editing, noop: Boolean(res.data.noop) });
    } catch (err) {
      // A row that changed meanwhile (or got marked Paid) comes back with its current state.
      if (err.response?.data?.item) onSaved(err.response.data.item, { conflict: true });
      setError(saveErrorText(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      title={editing ? "Edit manual entry" : "Add manual entry"}
      description={
        editing
          ? "You can change these while the row is not Paid. Every change is recorded."
          : "For a consultation that wasn’t booked through the website or app, such as one arranged by phone or through a partner. It shows with a “Manual” label."
      }
      className="en-modal"
    >
      <form onSubmit={submit} noValidate className="en-form">
        <label className="en-field en-field--full">
          <span>Patient name</span>
          <input value={form.patientName} onChange={set("patientName")} maxLength={80} placeholder="e.g. Ravi Sharma" autoFocus required />
        </label>
        <label className="en-field">
          <span>Country</span>
          <input value={form.country} onChange={set("country")} maxLength={60} placeholder="India" list="en-countries" />
          <datalist id="en-countries">
            {allCountryNames().map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
        <label className="en-field">
          <span>Doctor</span>
          <select value={form.doctorId} onChange={set("doctorId")}>
            <option value="">Not assigned</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          {doctorsError && <small className="en-field-hint">{doctorsError}</small>}
        </label>
        <label className="en-field">
          <span>Consultation date</span>
          <input type="date" value={form.date} onChange={set("date")} required />
        </label>
        <label className="en-field">
          <span>Time</span>
          <input type="time" value={form.time} onChange={set("time")} />
        </label>
        <label className="en-field">
          <span>Fee charged ($)</span>
          <input value={form.feeCharged} onChange={set("feeCharged")} inputMode="decimal" placeholder="49.00" required />
        </label>
        {!editing && (
          <label className="en-field">
            <span>Doctor fee ($)</span>
            <input value={form.doctorFee} onChange={set("doctorFee")} inputMode="decimal" placeholder="optional" />
          </label>
        )}
        {!editing && (
          <label className="en-field en-field--full">
            <span>Comment</span>
            <input value={form.comment} onChange={set("comment")} maxLength={500} placeholder="e.g. Booked by phone, paid by bank transfer" />
          </label>
        )}
        {error && (
          <p className="en-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="hc-modal__actions">
          <button type="button" className="en-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="en-btn en-btn--primary" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add entry"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Today as the date input wants it, in the browser's own time zone.
function todayInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
