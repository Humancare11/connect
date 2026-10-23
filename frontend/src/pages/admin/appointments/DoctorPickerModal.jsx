import { useMemo, useState } from "react";
import Modal from "../../../components/ui/Modal";
import RetryButton from "../../../components/ui/RetryButton";
import useApprovedDoctors from "./useApprovedDoctors";
import { filterDoctors, needsAppointmentTime, shortBookingId, toTime12 } from "./bookingFormat";

// One dialog for both "Assign doctor" (booking has none) and "Alternate doctor" (replace the
// current one). The doctor picked is sent by his or her enrollment id. A Next Available
// category booking also needs the time the admin settles on.
export default function DoctorPickerModal({ mode, row, submitting, error, onSubmit, onRevert, onClose }) {
  const alternate = mode === "alternate";
  const { doctors, loading, error: loadError, retry } = useApprovedDoctors(true);
  const [query, setQuery] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [time, setTime] = useState("");

  const needsTime = !alternate && needsAppointmentTime(row);
  const shown = useMemo(() => filterDoctors(doctors, query, alternate ? row.doctorName : ""), [doctors, query, alternate, row.doctorName]);
  const ready = Boolean(doctorId) && (!needsTime || Boolean(toTime12(time)));

  const submit = (event) => {
    event.preventDefault();
    if (!ready || submitting) return;
    onSubmit({ doctorId, ...(needsTime ? { appointmentTime: toTime12(time) } : {}) });
  };

  const title = alternate ? "Alternate doctor" : "Assign doctor";

  return (
    <Modal open onClose={onClose} dismissible={!submitting} title={title} className="adp-bk-modal">
      <form onSubmit={submit} className="adp-bk-modal-body">
        {alternate ? (
          <p className="adp-bk-modal-text">
            Booking {shortBookingId(row)} is with <b>{row.doctorName}</b>. The doctor you pick replaces them on this booking, and
            the new doctor needs to confirm it.
          </p>
        ) : (
          <p className="adp-bk-modal-text">
            Booking {shortBookingId(row)} for {row.patient?.name || "the patient"}
            {row.category ? ` · ${row.category}` : ""}. The doctor you pick is asked to confirm it.
          </p>
        )}

        <label className="adp-bk-field">
          <span>Find a doctor</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, specialty, city or country" autoFocus />
        </label>

        <div className="adp-bk-doclist" role="radiogroup" aria-label="Doctors">
          {loading ? (
            <p className="adp-bk-doclist-note">Loading doctors...</p>
          ) : loadError ? (
            <p className="adp-bk-doclist-note">
              {loadError} <RetryButton onRetry={retry} />
            </p>
          ) : shown.length === 0 ? (
            <p className="adp-bk-doclist-note">No approved doctors match.</p>
          ) : (
            shown.map((doctor) => (
              <label key={doctor.id} className={`adp-bk-docitem${doctorId === doctor.id ? " is-picked" : ""}`}>
                <input type="radio" name="doctor" value={doctor.id} checked={doctorId === doctor.id} onChange={() => setDoctorId(doctor.id)} />
                <span className="adp-bk-docitem-main">
                  <b>{doctor.name}</b>
                  <small>{[doctor.specialty, doctor.location].filter(Boolean).join(" · ") || "—"}</small>
                </span>
              </label>
            ))
          )}
        </div>

        {needsTime && (
          <label className="adp-bk-field">
            <span>Appointment time</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            <small>This patient chose Next Available, so a time is needed.</small>
          </label>
        )}

        {alternate && row.originalDoctorName && (
          <button type="button" className="adp-bk-link" onClick={onRevert} disabled={submitting}>
            Go back to {row.originalDoctorName}
          </button>
        )}

        {error && (
          <p className="adp-bk-modal-error" role="alert">
            {error}
          </p>
        )}

        <div className="hc-modal__actions">
          <button type="button" className="adp-bk-btn" onClick={onClose} disabled={submitting}>
            Close
          </button>
          <button type="submit" className="adp-bk-btn adp-bk-btn--ok" disabled={!ready || submitting}>
            {submitting ? "Saving..." : alternate ? "Change doctor" : "Assign doctor"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
