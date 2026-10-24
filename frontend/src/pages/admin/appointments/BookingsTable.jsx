import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Country } from "country-state-city";
import { useToast } from "../../../components/ui/Toast";
import StatusPill from "./StatusPill";
import SelectionMenu from "./SelectionMenu";
import BulkBar from "./BulkBar";
import { copyText } from "./copyText";
import {
  AUTO_COMPLETE_HINT, assignedByHint, canAlternate, canAssign, canAutoComplete, canCancel, canReactivate, formatBookedOn, formatConsultation,
  formatFee, isClosed, originalDoctorHint, rowNumber, shortBookingId, showAssignedByColumn,
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

function DoctorCell({ row, actions, busy }) {
  if (!row.doctorName) {
    return (
      <div className="adp-bk-doctor">
        <strong className="adp-bk-nodoc">Not assigned</strong>
        <button type="button" className="adp-bk-alt adp-bk-assign" disabled={busy || !canAssign(row)} onClick={() => actions.handlers.assign(row)}>
          Assign doctor
        </button>
      </div>
    );
  }
  return (
    <div className="adp-bk-doctor" title={originalDoctorHint(row) || undefined}>
      <strong>{row.doctorName}</strong>
      <button type="button" className="adp-bk-alt" disabled={busy || !canAlternate(row)} onClick={() => actions.handlers.alternate(row)}>
        Alternate doctor
      </button>
    </div>
  );
}

function AssignedByCell({ row }) {
  if (!row.doctorName) return "—";
  if (row.assignedBy) {
    return (
      <span className="adp-bk-by" title={row.assignedBy}>
        {row.assignedBy}
      </span>
    );
  }
  return (
    <span className="adp-bk-by" title={assignedByHint(row)}>
      —
    </span>
  );
}

// View, then Reactivate (a Complete booking) or Auto complete, then Cancel (super admins only).
function ActionsCell({ row, actions, busy, isSuperAdmin }) {
  const { handlers } = actions;
  const complete = row.status === "complete";
  return (
    <div className="adp-bk-actions">
      <Link className="adp-bk-btn" to={`/admin-dashboard/appointments/${row.id}`}>
        View
      </Link>
      {complete ? (
        <button
          type="button"
          className="adp-bk-btn adp-bk-btn--ok"
          disabled={busy || !canReactivate(row)}
          title={canReactivate(row) ? "Move this booking back to Confirmed" : "A booking with no doctor can't be reactivated"}
          onClick={() => handlers.reactivate(row)}
        >
          Reactivate
        </button>
      ) : (
        <button
          type="button"
          className="adp-bk-btn adp-bk-btn--ok"
          disabled={busy || !canAutoComplete(row)}
          title={!canAutoComplete(row) && !isClosed(row.status) ? AUTO_COMPLETE_HINT : undefined}
          onClick={() => handlers.autoComplete(row)}
        >
          Auto complete
        </button>
      )}
      {isSuperAdmin && (
        <button type="button" className="adp-bk-btn" disabled={busy || !canCancel(row)} onClick={() => handlers.cancel(row)}>
          Cancel
        </button>
      )}
    </div>
  );
}

// True while the table area is narrow enough that the rows are shown as cards (the table header, and with it the
// header checkbox, is hidden then). Same width the stylesheet switches layout at.
function useIsNarrow(ref, max = 900) {
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

export default function BookingsTable({ rows, tab, page, actions, selection, bulk, isSuperAdmin = false }) {
  const showAssignedBy = showAssignedByColumn(tab);
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
          <thead>
            <tr>
              <th className="adp-bk-num adp-bk-headcell">
                <SelectionMenu selection={selection} pageCount={rows.length} />
              </th>
              <th>Booking ID</th>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Category</th>
              <th>Booking date</th>
              <th>Consultation date</th>
              <th className="adp-bk-fee">Fee</th>
              <th>Status</th>
              {showAssignedBy && <th>Assigned by</th>}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const busy = actions.busyId === row.id;
              const consultation = formatConsultation(row.consultation);
              const country = getCountryName(row.patient?.country);
              const classes = [selection.isSelected(row.id) && "adp-bk-row--selected", row.isTesting && "adp-bk-row--testing", row.status === "cancelled" && "adp-bk-row--cancelled", busy && "adp-bk-row--busy"].filter(Boolean).join(" ");
              return (
                <tr key={`${row.kind}:${row.id}`} className={classes || undefined} aria-busy={busy || undefined}>
                  <td className="adp-sr-cell adp-bk-num" data-label="#">
                    {selection.selecting && (
                      <input
                        type="checkbox"
                        className="adp-bk-rowcheck"
                        checked={selection.isSelected(row.id)}
                        onChange={() => selection.toggle(row.id)}
                        aria-label={`Select booking ${shortBookingId(row)}`}
                      />
                    )}
                    <span className="adp-bk-rownum">{rowNumber(page, index)}</span>
                  </td>
                  <td data-label="Booking ID"><BookingIdCell row={row} /></td>
                  <td data-label="Patient">
                    <div className="adp-patient-cell">
                      <strong>{row.patient?.name || "Unknown patient"}</strong>
                      <span>{country || "—"}</span>
                    </div>
                  </td>
                  <td data-label="Doctor"><DoctorCell row={row} actions={actions} busy={busy} /></td>
                  <td data-label="Category">{row.category || "—"}</td>
                  <td data-label="Booking date" className="adp-bk-nowrap">{formatBookedOn(row.bookedAt)}</td>
                  <td data-label="Consultation date" className="adp-bk-nowrap">
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
                  <td data-label="Status"><StatusPill status={row.status} /></td>
                  {showAssignedBy && <td data-label="Assigned by" className="adp-bk-bycell"><AssignedByCell row={row} /></td>}
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
