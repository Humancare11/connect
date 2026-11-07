import { useEffect, useRef, useState } from "react";
import Modal from "../../../components/ui/Modal";
import StatusPill from "./StatusPill";
import * as bookingApi from "./bookingApi";
import { shortBookingId } from "./bookingFormat";
import { SLOT_WHY, dayLabel, groupSlots, missingFields, nextDays, timePart, zoneNote } from "./rescheduleLogic";

const DEFAULT_REASONS = ["Patient not available", "Doctor not available", "Patient requested", "Technical issue", "Other"];

// One slot as two lines: the patient's time and, beneath it, the same instant in IST.
function SlotTimes({ patient, ist, strong = false }) {
  return (
    <span className="adp-rs-times">
      <span className={strong ? "adp-rs-times__main adp-rs-times__main--strong" : "adp-rs-times__main"}>{patient || "-"}</span>
      {ist && <span className="adp-rs-times__ist">IST {ist}</span>}
    </span>
  );
}

// Admin-only. Moves a Pending / Assigned / Confirmed booking to a new free slot of the same doctor. The old time may
// already be past (a patient who never joined); only the new slot has to be in the future. The reason note is for admins:
// the doctor and the patient only learn that it was rescheduled. `onSubmit` resolves true when the server accepted it.
export default function RescheduleModal({ row, submitting, error, onSubmit, onClose }) {
  const [ctx, setCtx] = useState(null);
  const [ctxError, setCtxError] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState(null);
  const [slotsError, setSlotsError] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [touched, setTouched] = useState(false);
  const request = useRef(0);
  const [days] = useState(() => nextDays(14));

  useEffect(() => {
    let alive = true;
    bookingApi
      .getRescheduleSlots(row.id)
      .then((res) => alive && setCtx(res.data))
      .catch((err) => alive && setCtxError(err?.response?.data?.msg || "Could not load this booking. Close and try again."));
    return () => {
      alive = false;
    };
  }, [row.id]);

  const loadSlots = async (day) => {
    const mine = ++request.current;
    setSlots(null);
    setSlotsError("");
    if (!day) return;
    try {
      const res = await bookingApi.getRescheduleSlots(row.id, day);
      if (mine === request.current) setSlots(res.data.slots || []);
    } catch (err) {
      if (mine === request.current) setSlotsError(err?.response?.data?.msg || "Could not load the slots. Try again.");
    }
  };

  const pickDate = (day) => {
    setDate(day);
    setTime("");
    loadSlots(day);
  };

  const blocked = ctx && !ctx.canReschedule;
  const chosen = slots?.find((s) => s.time === time) || null;
  const missing = missingFields({ date, time, reason, note });
  const reasons = ctx?.reasons?.length ? ctx.reasons : DEFAULT_REASONS;

  const submit = async (event) => {
    event.preventDefault();
    setTouched(true);
    if (missing || submitting || blocked) return;
    const ok = await onSubmit({ date, time, reason, reasonNote: note.trim(), notify });
    // Someone took the slot, or it just passed: reload the day so the grid is right and the choice is cleared.
    if (ok === false && date) {
      setTime("");
      loadSlots(date);
    }
  };

  return (
    <Modal open onClose={onClose} dismissible={!submitting} title={`Reschedule appointment · ${shortBookingId(row)}`} className="adp-bk-modal adp-rs-modal">
      <form onSubmit={submit} className="adp-bk-modal-body" noValidate>
        <div className="adp-rs-current">
          <div>
            <span className="adp-rs-label">Patient</span>
            <strong>{row.patient?.name || "Unknown patient"}</strong>
          </div>
          <div>
            <span className="adp-rs-label">Doctor</span>
            <strong>{row.doctorName || "Not assigned"}</strong>
          </div>
          <div>
            <span className="adp-rs-label">Current slot</span>
            {ctx ? <SlotTimes patient={ctx.current.patient.label} ist={ctx.current.ist.label && timePart(ctx.current.ist.label)} strong /> : <strong>…</strong>}
          </div>
          <div>
            <span className="adp-rs-label">Status</span>
            <StatusPill status={row.status} />
          </div>
        </div>

        {ctxError && (
          <p className="adp-bk-modal-error" role="alert">
            {ctxError}
          </p>
        )}
        {blocked && (
          <p className="adp-bk-modal-warning" role="alert">
            {ctx.blockedReason}
          </p>
        )}

        {ctx && !blocked && (
          <>
            <div className="adp-rs-when">
              <label className="adp-bk-field">
                <span>New date</span>
                <select value={date} onChange={(e) => pickDate(e.target.value)} disabled={submitting}>
                  <option value="">Select a date</option>
                  {days.map((d) => (
                    <option key={d} value={d}>
                      {dayLabel(d)}
                    </option>
                  ))}
                </select>
                <small>Next 14 days, with {row.doctorName || "the doctor"}&rsquo;s free slots</small>
              </label>

              <div className="adp-bk-field">
                <span id="adp-rs-time-label">New time</span>
                {!date && <small>Pick a date to see the free slots.</small>}
                {date && !slots && !slotsError && <small>Loading slots…</small>}
                {slotsError && (
                  <small className="adp-rs-err" role="alert">
                    {slotsError}
                  </small>
                )}
                {slots && (
                  <div className="adp-rs-slots" role="group" aria-labelledby="adp-rs-time-label">
                    {groupSlots(slots).map((group) => (
                      <div key={group.name} className="adp-rs-group">
                        <span className="adp-rs-label">{group.name}</span>
                        <div className="adp-rs-chips">
                          {group.slots.map((slot) => {
                            const disabled = slot.status !== "available" || submitting;
                            return (
                              <button
                                key={slot.time}
                                type="button"
                                className={`adp-rs-chip${slot.status !== "available" ? ` adp-rs-chip--${slot.status}` : ""}`}
                                aria-pressed={time === slot.time}
                                disabled={disabled}
                                title={SLOT_WHY[slot.status] || undefined}
                                onClick={() => setTime(slot.time)}
                              >
                                <span>{slot.label}</span>
                                <small>IST {timePart(slot.ist)}</small>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <small>Crossed-out slots are booked, in the past, or the current slot. {zoneNote(ctx.timezone)}</small>
                  </div>
                )}
              </div>
            </div>

            <fieldset className="adp-rs-reasons">
              <legend>Reason</legend>
              <div className="adp-rs-reasonlist">
                {reasons.map((r) => (
                  <label key={r} className={reason === r ? "adp-rs-reason adp-rs-reason--on" : "adp-rs-reason"}>
                    <input type="radio" name="reschedule-reason" value={r} checked={reason === r} onChange={() => setReason(r)} disabled={submitting} />
                    {r}
                  </label>
                ))}
              </div>
              <textarea
                className="adp-rs-note"
                rows={2}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note (required for Other)"
                aria-label="Reason note"
                disabled={submitting}
              />
              <small>Shown to admins only. The patient and the doctor see that it was rescheduled, not the reason or the note.</small>
            </fieldset>

            {chosen && (
              <div className="adp-rs-change" aria-live="polite">
                <SlotTimes patient={ctx.current.patient.label} ist={timePart(ctx.current.ist.label)} />
                <span aria-hidden="true">→</span>
                <SlotTimes patient={`${dayLabel(date)}, ${chosen.label}`} ist={timePart(chosen.ist)} strong />
              </div>
            )}

            <label className="adp-rs-check">
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} disabled={submitting} />
              <span>Notify patient and doctor by email and in-app with the old and new time</span>
            </label>

            <p className="adp-rs-info">The previous date and time are kept in the history and cannot be edited or deleted. Payment is not changed.</p>
          </>
        )}

        {touched && missing && !blocked && (
          <p className="adp-bk-modal-error" role="alert">
            Choose {missing}.
          </p>
        )}
        {error && (
          <p className="adp-bk-modal-error" role="alert">
            {error}
          </p>
        )}

        <div className="hc-modal__actions">
          <button type="button" className="adp-bk-btn" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="adp-bk-btn adp-bk-btn--ok" disabled={submitting || !ctx || blocked}>
            {submitting ? "Rescheduling..." : "Confirm reschedule"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
