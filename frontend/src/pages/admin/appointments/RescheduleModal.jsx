import { useEffect, useRef, useState } from "react";
import Modal from "../../../components/ui/Modal";
import StatusPill from "./StatusPill";
import RescheduleCalendar from "./RescheduleCalendar";
import * as bookingApi from "./bookingApi";
import { shortBookingId } from "./bookingFormat";
import { groupSlots, isoDay, longDay, needList, timePart, zoneChip, zoneInfo } from "./rescheduleLogic";

const DEFAULT_REASONS = ["Patient not available", "Doctor not available", "Patient requested", "Technical issue", "Other"];
const OFF_LABEL = { booked: "Booked", past: "Past", current: "Current slot" };
const NOTE_MAX = 500;
const LOCK = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

// Admin-only. Moves a Pending / Assigned / Confirmed booking to a new free slot of the same doctor. The old time may
// already be past (a patient who never joined); only the new slot has to be in the future. The reason note is for admins:
// the doctor and the patient only learn that it was rescheduled. `onSubmit` resolves true when the server accepted it.
// (Layout only: the data, the checks and the request are the same as before the redesign.)
export default function RescheduleModal({ row, submitting, error, onSubmit, onClose }) {
  const [today] = useState(() => isoDay(new Date()));
  const [ctx, setCtx] = useState(null);
  const [ctxError, setCtxError] = useState("");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState(null);
  const [slotsError, setSlotsError] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [showOff, setShowOff] = useState(true);
  const request = useRef(0);

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
      if (mine === request.current) {
        setSlots(res.data.slots || []);
      }
    } catch (err) {
      if (mine === request.current) setSlotsError(err?.response?.data?.msg || "Could not load the slots. Try again.");
    }
  };

  const pickDate = (day) => {
    setDate(day);
    setTime("");
    if (day) setMonth(day.slice(0, 7));
    loadSlots(day);
  };
  const goToday = () => {
    setMonth(today.slice(0, 7));
    pickDate(today);
  };

  const blocked = ctx && !ctx.canReschedule;
  const chosen = slots?.find((s) => s.time === time) || null;
  const need = needList({ date, time, reason, note });
  const reasons = ctx?.reasons?.length ? ctx.reasons : DEFAULT_REASONS;
  const zone = ctx ? zoneInfo(ctx.timezone) : { text: "", diff: false };
  const diff = zone.diff;
  const noteMissing = reason === "Other" && !note.trim();
  const currentLabel = ctx?.current?.patient?.label || "";
  const currentIst = ctx?.current?.ist?.label || "";
  const freeNow = slots ? slots.filter((s) => s.status === "available").length : 0;

  const submit = async (event) => {
    event.preventDefault();
    if (need.length || submitting || blocked) return;
    const ok = await onSubmit({ date, time, reason, reasonNote: note.trim(), notify });
    // Someone took the slot, or it just passed: reload the day so the grid is right and the choice is cleared.
    if (ok === false && date) {
      setTime("");
      loadSlots(date);
    }
  };

  return (
    <Modal open onClose={onClose} dismissible={!submitting} title="Reschedule appointment" className="adp-bk-modal adp-rs-modal">
      <form onSubmit={submit} className="adp-rs-form" noValidate>
        <button type="button" className="adp-rs-x" aria-label="Close" onClick={onClose} disabled={submitting}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div className="adp-rs-current">
          <div className="adp-rs-sub">
            <strong>{row.patient?.name || "Unknown patient"}</strong> with <strong>{row.doctorName || "no doctor assigned"}</strong> ·{" "}
            <span className="adp-rs-id">{shortBookingId(row)}</span>
          </div>
          <div className="adp-rs-chipsrow">
            <span className="adp-rs-pillchip">
              Current <b>{ctx ? `${currentLabel}${diff && currentIst ? ` (${timePart(currentIst)} IST)` : ""}` : "…"}</b>
            </span>
            <StatusPill status={row.status} />
            {ctx && (
              <span className="adp-rs-pillchip">
                Patient time zone <b>{zoneChip(ctx.timezone.patient)}</b>
              </span>
            )}
          </div>
        </div>

        <div className="adp-rs-body">
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
              <section className="adp-rs-step">
                <div className="adp-rs-step__head">
                  <h3>
                    <span className="adp-rs-num">1</span>New date and time
                  </h3>
                  {date && (
                    <label className="adp-rs-toggle">
                      <input type="checkbox" checked={showOff} onChange={(e) => setShowOff(e.target.checked)} /> Show unavailable
                    </label>
                  )}
                </div>
                <div className="adp-rs-pick">
                  <RescheduleCalendar
                    month={month}
                    onMonth={setMonth}
                    today={today}
                    value={date}
                    disabled={submitting}
                    onPick={pickDate}
                    onClear={() => pickDate("")}
                    onToday={goToday}
                  />
                  <div className="adp-rs-right">
                    {!date && <div className="adp-rs-empty">Pick a date in the calendar to see the time slots.</div>}
                    {date && (
                      <>
                        <div className="adp-rs-seldate">
                          Slots for <b>{longDay(date)}</b>
                          {slots ? ` · ${freeNow} free` : ""}
                        </div>
                        <div className={`adp-rs-tz${diff ? " adp-rs-tz--diff" : ""}`}>{zone.text}</div>
                        {!slots && !slotsError && <small>Loading slots…</small>}
                        {slotsError && (
                          <small className="adp-rs-err" role="alert">
                            {slotsError}
                          </small>
                        )}
                        {slots && freeNow === 0 && <div className="adp-rs-empty">No free slots on this day. Pick another date.</div>}
                        {slots && (
                          <div className="adp-rs-slots" role="group" aria-label="Time slots">
                            {groupSlots(slots).map((group) => {
                              const list = group.slots.filter((s) => showOff || s.status === "available");
                              if (!list.length) return null;
                              return (
                                <div key={group.name} className="adp-rs-group">
                                  <span className="adp-rs-label">{group.name}</span>
                                  <div className="adp-rs-chips">
                                    {list.map((slot) => {
                                      const off = slot.status !== "available";
                                      return (
                                        <button
                                          key={slot.time}
                                          type="button"
                                          className={`adp-rs-chip${off ? ` adp-rs-chip--${slot.status}` : ""}`}
                                          aria-pressed={time === slot.time}
                                          disabled={off || submitting}
                                          title={off ? OFF_LABEL[slot.status] : undefined}
                                          aria-label={`${slot.label}${diff ? `, ${timePart(slot.ist)} IST` : ""}${off ? `, ${OFF_LABEL[slot.status]}` : ""}`}
                                          onClick={() => setTime(slot.time)}
                                        >
                                          <span>{slot.label}</span>
                                          {off ? <small>{OFF_LABEL[slot.status]}</small> : diff && <small>{timePart(slot.ist)} IST</small>}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                            {showOff && (
                              <div className="adp-rs-legend">
                                <span>
                                  <i />
                                  Free
                                </span>
                                <span>
                                  <i className="adp-rs-legend__sel" />
                                  Selected
                                </span>
                                <span>
                                  <i className="adp-rs-legend__off" />
                                  Booked, past or current
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </section>

              <section className="adp-rs-step">
                <div className="adp-rs-step__head">
                  <h3>
                    <span className="adp-rs-num">2</span>Reason
                  </h3>
                </div>
                <div className="adp-rs-reasonlist" role="radiogroup" aria-label="Reason">
                  {reasons.map((r) => (
                    <label key={r} className={reason === r ? "adp-rs-reason adp-rs-reason--on" : "adp-rs-reason"}>
                      <input type="radio" name="reschedule-reason" value={r} checked={reason === r} onChange={() => setReason(r)} disabled={submitting} />
                      {r}
                    </label>
                  ))}
                </div>
                <textarea
                  className={`adp-rs-note${noteMissing ? " adp-rs-note--bad" : ""}`}
                  rows={2}
                  maxLength={NOTE_MAX}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={reason === "Other" ? "Write the reason (required)" : "Add a note (optional)"}
                  aria-label="Reason note"
                  aria-invalid={noteMissing || undefined}
                  disabled={submitting}
                />
                <div className="adp-rs-notehint">
                  <span className="adp-rs-lock">{LOCK}Admins only. Patient and doctor only see that it was rescheduled.</span>
                  <span>
                    {note.length}/{NOTE_MAX}
                  </span>
                </div>
                <div className="adp-rs-opts">
                  <label className="adp-rs-check">
                    <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} disabled={submitting} />
                    <span>Email and notify the patient and doctor with the old and new time</span>
                  </label>
                  <p className="adp-rs-fine">The old date and time stay in the history. Payment is not changed.</p>
                </div>
              </section>
            </>
          )}

          {error && (
            <p className="adp-bk-modal-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="adp-rs-foot">
          <div className="adp-rs-change" aria-live="polite">
            {chosen ? (
              <>
                <s className="adp-rs-old">{currentLabel}</s>
                <span className="adp-rs-arrow" aria-hidden="true">
                  →
                </span>
                <span className="adp-rs-new">
                  {longDay(date)}, {chosen.label}
                </span>
                {diff && <span className="adp-rs-need">({timePart(chosen.ist)} IST)</span>}
              </>
            ) : (
              <span className="adp-rs-need">{blocked || !ctx ? "" : `Choose ${need.join(", ")} to continue`}</span>
            )}
          </div>
          <div className="adp-rs-btns">
            <button type="button" className="adp-bk-btn" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="adp-bk-btn adp-bk-btn--ok" disabled={submitting || !ctx || blocked || need.length > 0}>
              {submitting ? "Rescheduling..." : "Confirm reschedule"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
