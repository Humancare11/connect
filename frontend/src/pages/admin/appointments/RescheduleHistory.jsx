import { useEffect, useState } from "react";
import * as bookingApi from "./bookingApi";
import { timePart } from "./rescheduleLogic";

const stamp = (iso) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";

function Slot({ view, strike = false }) {
  const body = (
    <>
      {view.patient.label}
      {view.ist.label && <small className="adp-rs-tl__ist"> · IST {timePart(view.ist.label)}</small>}
    </>
  );
  return strike ? <s>{body}</s> : <b>{body}</b>;
}

// The reschedule timeline for one booking: the original booking first, then each change (old to new, reason, who, when).
// Used on the booking's View page and in the History drawer on the list. Admin only: it shows the admins' notes.
export default function RescheduleHistory({ id, reloadKey = 0 }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    bookingApi
      .getRescheduleHistory(id)
      .then((res) => {
        if (!alive) return;
        setError("");
        setData(res.data);
      })
      .catch((err) => alive && setError(err?.response?.data?.msg || "Could not load the reschedule history."));
    return () => {
      alive = false;
    };
  }, [id, reloadKey]);

  if (error) {
    return (
      <p className="adp-bk-modal-error" role="alert">
        {error}
      </p>
    );
  }
  if (!data) return <p className="adp-muted">Loading history…</p>;

  const zone = data.timezone;
  return (
    <div className="adp-rs-history">
      <p className="adp-rs-hint">
        {zone.assumed ? `No time zone is recorded; ${zone.patient} is assumed.` : `Patient's time zone: ${zone.patient}.`} IST is shown beside each time.
      </p>
      {data.count === 0 ? (
        <p className="adp-muted">
          Never rescheduled. Booked for <b>{data.current.patient.label}</b>.
        </p>
      ) : (
        <ol className="adp-rs-tl">
          <li className="adp-rs-tl__item adp-rs-tl__item--first">
            <span className="adp-rs-tl__title">Originally booked</span>
            <span className="adp-rs-tl__move">
              <Slot view={data.original} />
            </span>
            <span className="adp-rs-tl__meta">Booked by patient</span>
          </li>
          {data.changes.map((c, i) => (
            <li key={c.id} className={`adp-rs-tl__item${i === data.changes.length - 1 ? " adp-rs-tl__item--now" : ""}`}>
              <span className="adp-rs-tl__title">Rescheduled{i === data.changes.length - 1 ? " · current" : ""}</span>
              <span className="adp-rs-tl__move">
                <Slot view={c.from} strike /> → <Slot view={c.to} />
              </span>
              <span>
                Reason: {c.reason}
                {c.reasonNote ? ` · ${c.reasonNote}` : ""}
              </span>
              <span className="adp-rs-tl__meta">
                By {c.by} · {stamp(c.at)} · {c.notified ? "Patient and doctor notified" : "No notification sent"}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
