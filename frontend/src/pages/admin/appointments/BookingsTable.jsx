import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Country } from "country-state-city";
import { useToast } from "../../../components/ui/Toast";
import StatusPill from "./StatusPill";
import SelectionMenu from "./SelectionMenu";
import BulkBar from "./BulkBar";
import { copyText } from "./copyText";
import { assignUrl } from "./assignPageLogic";
import {
  CARD_BELOW, assignedByHint, canAlternate, canAssign, formatBookedOn, formatConsultation, formatFee, originalDoctorHint, rowActions, rowNumber,
  shortBookingId,
} from "./bookingFormat";

function getCountryName(value) {
  if (!value) return "";
  return Country.getCountryByCode(value)?.name || value;
}

// The booking id is shown short; clicking it copies the FULL id. If the browser refuses, the full id (kept in a
// visually hidden span) is selected so Ctrl+C works, and the toast says so.
function BookingIdCell({ row }) {
  const toast = useToast();
  const fullId = useRef(null);

  const copy = async () => {
    const result = await copyText(row.id, {
      select: () => {
        const range = document.createRange();
        range.selectNodeContents(fullId.current);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      },
      execCopy: () => document.execCommand("copy"),
    });
    if (result === "copied") toast.success("Booking ID copied");
    else toast.info(`Could not copy automatically. The ID is selected, press Ctrl+C: ${row.id}`);
  };

  return (
    <div className="adp-bk-idcell">
      <button type="button" className="adp-bk-idcopy" title="Click to copy the booking ID" aria-label={`Copy booking ID ${row.id}`} onClick={copy}>
        <span className="adp-booking-id">{shortBookingId(row)}</span>
      </button>
      <span ref={fullId} className="adp-bk-fullid">{row.id}</span>
      {row.isTesting && <span className="adp-bk-tag">TESTING</span>}
    </div>
  );
}

// "Assign doctor" and "Alternate doctor" open the full-page assign screen (the same page for both), which brings the
// admin back to this tab and page after saving.
function DoctorLink({ row, allowed, busy, className, children }) {
  const [searchParams] = useSearchParams();
  if (busy || !allowed) {
    return (
      <button type="button" className={className} disabled>
        {children}
      </button>
    );
  }
  return (
    <Link className={className} to={assignUrl(row.id, searchParams.toString())}>
      {children}
    </Link>
  );
}

function DoctorCell({ row, busy }) {
  if (!row.doctorName) {
    return (
      <div className="adp-bk-doctor">
        <strong className="adp-bk-nodoc">Not assigned</strong>
        <DoctorLink row={row} busy={busy} allowed={canAssign(row)} className="adp-bk-alt adp-bk-assign">
          Assign doctor
        </DoctorLink>
      </div>
    );
  }
  return (
    <div className="adp-bk-doctor" title={originalDoctorHint(row) || undefined}>
      <strong title={row.doctorName}>{row.doctorName}</strong>
      <DoctorLink row={row} busy={busy} allowed={canAlternate(row)} className="adp-bk-alt">
        Alternate doctor
      </DoctorLink>
    </div>
  );
}

// The status pill, and under it who assigned the doctor (only once the booking has a doctor). Bookings assigned
// before the assigner was recorded show "by —" with the reason on hover.
function StatusCell({ row }) {
  return (
    <div className="adp-bk-statusbox">
      <StatusPill status={row.status} />
      {row.doctorName && (
        <span className={`adp-bk-by${row.assignedBy ? "" : " adp-bk-by--none"}`} title={row.assignedBy ? `Assigned by ${row.assignedBy}` : assignedByHint(row)}>
          by {row.assignedBy || "—"}
        </span>
      )}
    </div>
  );
}

// Only the buttons that work for this row (see rowActions): View, then Auto complete or Reactivate, then Cancel (super
// admins only).
function ActionsCell({ row, actions, busy, isSuperAdmin }) {
  const { handlers } = actions;
  const shown = rowActions(row, { isSuperAdmin });
  return (
    <div className="adp-bk-actions">
      {shown.includes("view") && (
        <Link className="adp-bk-btn" to={`/admin-dashboard/appointments/${row.id}`}>
          View
        </Link>
      )}
      {shown.includes("autoComplete") && (
        <button type="button" className="adp-bk-btn adp-bk-btn--ok" disabled={busy} onClick={() => handlers.autoComplete(row)}>
          Auto complete
        </button>
      )}
      {shown.includes("reactivate") && (
        <button
          type="button"
          className="adp-bk-btn adp-bk-btn--ok"
          disabled={busy}
          title="Move this booking back to Confirmed"
          onClick={() => handlers.reactivate(row)}
        >
          Reactivate
        </button>
      )}
      {shown.includes("cancel") && (
        <button type="button" className="adp-bk-btn adp-bk-btn--cancel" disabled={busy} onClick={() => handlers.cancel(row)}>
          Cancel
        </button>
      )}
    </div>
  );
}

// True while the table area is narrow enough that the rows are shown as cards (the table header, and with it the
// header checkbox, is hidden then). The stylesheet switches layout at the same width (CARD_BELOW).
function useIsNarrow(ref, max = CARD_BELOW) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < max));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, max]);
  return narrow;
}

export default function BookingsTable({ rows, page, actions, selection, bulk, isSuperAdmin = false }) {
  const block = useRef(null);
  const narrow = useIsNarrow(block);

  return (
    <div ref={block} className="adp-bk-block">
      {narrow && (
        <div className="adp-bk-seltools">
          <SelectionMenu selection={selection} pageCount={rows.length} variant="button" />
        </div>
      )}
      {selection.selecting && (
        <BulkBar count={selection.count} busy={bulk.busy} canCancel={isSuperAdmin} onAction={bulk.start} onDone={selection.exit} />
      )}
      <div className="adp-table-wrap adp-bk-wrap">
        <table className={`adp-flow-table adp-bk${selection.selecting ? " adp-bk--selecting" : ""}`}>
          {/* Fixed widths for the small columns; Patient, Doctor and Category have none and share the rest equally. */}
          <colgroup>
            <col className="adp-bk-col-num" />
            <col className="adp-bk-col-id" />
            <col />
            <col />
            <col className="adp-bk-c-cat" />
            <col className="adp-bk-col-booked" />
            <col className="adp-bk-col-consult" />
            <col className="adp-bk-col-fee" />
            <col className="adp-bk-col-status" />
            <col className="adp-bk-col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th className="adp-bk-num adp-bk-headcell">
                <SelectionMenu selection={selection} pageCount={rows.length} />
              </th>
              <th>Booking ID</th>
              <th>Patient</th>
              <th>Doctor</th>
              <th className="adp-bk-c-cat">Category</th>
              <th>Booked</th>
              <th>Consultation</th>
              <th className="adp-bk-fee">Fee</th>
              <th className="adp-bk-status">Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const busy = actions.busyId === row.id;
              const consultation = formatConsultation(row.consultation);
              const country = getCountryName(row.patient?.country);
              const patientName = row.patient?.name || "Unknown patient";
              const classes = [selection.isSelected(row.id) && "adp-bk-row--selected", row.isTesting && "adp-bk-row--testing", row.status === "cancelled" && "adp-bk-row--cancelled", busy && "adp-bk-row--busy"].filter(Boolean).join(" ");
              return (
                <tr key={`${row.kind}:${row.id}`} className={classes || undefined} aria-busy={busy || undefined}>
                  <td className="adp-sr-cell adp-bk-num" data-label="#">
                    {selection.selecting ? (
                      <input
                        type="checkbox"
                        className="adp-bk-rowcheck"
                        checked={selection.isSelected(row.id)}
                        onChange={() => selection.toggle(row.id)}
                        aria-label={`Select booking ${shortBookingId(row)}`}
                      />
                    ) : (
                      <span className="adp-bk-rownum">{rowNumber(page, index)}</span>
                    )}
                  </td>
                  <td data-label="Booking ID"><BookingIdCell row={row} /></td>
                  <td data-label="Patient" className="adp-bk-cut">
                    <div className="adp-patient-cell">
                      <strong title={patientName}>{patientName}</strong>
                      <span>{country || "—"}</span>
                    </div>
                  </td>
                  <td data-label="Doctor" className="adp-bk-cut"><DoctorCell row={row} busy={busy} /></td>
                  <td data-label="Category" className="adp-bk-cut adp-bk-c-cat">
                    <span className="adp-bk-cat" title={row.category || undefined}>{row.category || "—"}</span>
                  </td>
                  <td data-label="Booked" className="adp-bk-nowrap adp-bk-date">{formatBookedOn(row.bookedAt)}</td>
                  <td data-label="Consultation" className="adp-bk-nowrap adp-bk-date">
                    {consultation ? (
                      <span className="adp-bk-when">
                        {consultation.day}
                        {consultation.time && <span className="adp-bk-time">{consultation.time}</span>}
                      </span>
                    ) : (
                      <span className="adp-bk-muted">Not scheduled</span>
                    )}
                  </td>
                  <td data-label="Fee" className="adp-bk-fee">{formatFee(row.fee)}</td>
                  <td data-label="Status" className="adp-bk-status"><StatusCell row={row} /></td>
                  <td data-label="Actions" className="adp-bk-actions-cell"><ActionsCell row={row} actions={actions} busy={busy} isSuperAdmin={isSuperAdmin} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
