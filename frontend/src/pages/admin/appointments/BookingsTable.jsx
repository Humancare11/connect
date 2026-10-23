import { Link } from "react-router-dom";
import { Country } from "country-state-city";
import StatusPill from "./StatusPill";
import {
  formatBookedOn, formatConsultation, formatFee, isClosed, originalDoctorHint, rowNumber, shortBookingId, showAssignedByColumn,
} from "./bookingFormat";

function getCountryName(value) {
  if (!value) return "";
  return Country.getCountryByCode(value)?.name || value;
}

// A button for an action that arrives with the row actions (assign, auto complete, cancel).
// Disabled until that action is wired up, and always disabled on Complete / Cancelled rows.
const PENDING_ACTION_HINT = "Available in the next update";

function DoctorCell({ row, done }) {
  if (!row.doctorName) return <strong className="adp-bk-nodoc">Not assigned</strong>;
  return (
    <div className="adp-bk-doctor" title={originalDoctorHint(row) || undefined}>
      <strong>{row.doctorName}</strong>
      <button type="button" className="adp-bk-alt" disabled title={done ? undefined : PENDING_ACTION_HINT}>
        Alternate doctor
      </button>
    </div>
  );
}

function ActionsCell({ row, done }) {
  return (
    <div className="adp-bk-actions">
      <Link className="adp-bk-btn" to={`/admin-dashboard/appointments/${row.id}`}>
        View
      </Link>
      {row.doctorName ? (
        <button type="button" className="adp-bk-btn adp-bk-btn--ok" disabled title={done ? undefined : PENDING_ACTION_HINT}>
          Auto complete
        </button>
      ) : (
        <button type="button" className="adp-bk-btn adp-bk-btn--ok" disabled title={done ? undefined : PENDING_ACTION_HINT}>
          Assign doctor
        </button>
      )}
      <button type="button" className="adp-bk-btn" disabled title={done ? undefined : PENDING_ACTION_HINT}>
        Cancel
      </button>
    </div>
  );
}

export default function BookingsTable({ rows, tab, page }) {
  const showAssignedBy = showAssignedByColumn(tab);

  return (
    <div className="adp-table-wrap adp-bk-wrap">
      <table className="adp-flow-table adp-bk">
        <thead>
          <tr>
            <th className="adp-bk-num">#</th>
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
            const done = isClosed(row.status);
            const consultation = formatConsultation(row.consultation);
            const country = getCountryName(row.patient?.country);
            return (
              <tr key={`${row.kind}:${row.id}`} className={`${row.isTesting ? "adp-bk-row--testing" : ""} ${row.status === "cancelled" ? "adp-bk-row--cancelled" : ""}`.trim()}>
                <td className="adp-sr-cell adp-bk-num" data-label="#">{rowNumber(page, index)}</td>
                <td data-label="Booking ID">
                  <span className="adp-booking-id" title={row.id}>{shortBookingId(row)}</span>
                  {row.isTesting && <span className="adp-bk-tag">TESTING</span>}
                </td>
                <td data-label="Patient">
                  <div className="adp-patient-cell">
                    <strong>{row.patient?.name || "Unknown patient"}</strong>
                    <span>{country || "—"}</span>
                  </div>
                </td>
                <td data-label="Doctor"><DoctorCell row={row} done={done} /></td>
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
                {showAssignedBy && <td data-label="Assigned by">{row.doctorName ? row.assignedBy || "—" : "—"}</td>}
                <td data-label="Actions" className="adp-bk-actions-cell"><ActionsCell row={row} done={done} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
