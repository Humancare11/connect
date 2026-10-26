import { CommentCell, FeeCell, PaidOnCell, StatusCell } from "./EntryCells";
import { caseLine, feeCharged, formatBooked, formatDay, formatMoney, idText, isManual, rowKey, rowNumber, sourceLabel, totalsText } from "./entriesFormat";

// The Appointment entries table. A full table while the window is wide; below 1360px each row becomes a card with labelled fields
// (see AdminEntries.css). The first four columns come from the booking; the green ones are typed by an admin and saved as you go.
export default function EntriesTable({ rows, page, totals, save, onEdit, onDelete }) {
  return (
    <div className="en-scroll">
      <table className="en-table">
        <colgroup>
          <col className="en-w-num" />
          <col className="en-w-id" />
          <col className="en-w-bk" />
          <col className="en-w-cd" />
          <col />
          <col />
          <col className="en-w-fee" />
          <col className="en-w-df" />
          <col className="en-w-ps" />
          <col className="en-w-po" />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th>Booking ID</th>
            <th className="en-c-bk">Booked</th>
            <th>Consultation</th>
            <th>Patient</th>
            <th>Doctor</th>
            <th className="en-r">Fee charged</th>
            <th className="en-ed en-r">Doctor fee ($)</th>
            <th className="en-ed">Paid status</th>
            <th className="en-ed">Paid on</th>
            <th className="en-ed">Comment</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <EntryRow key={rowKey(row)} row={row} number={rowNumber(page, index)} save={save} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6} className="en-lbl">
              {totalsText(totals?.rows ?? rows.length)}
            </td>
            <td className="en-r" data-l="Fee charged">
              {formatMoney(totals?.feeChargedCents)}
            </td>
            <td className="en-r" data-l="Doctor fee">
              {formatMoney(totals?.doctorFeeCents)}
            </td>
            <td colSpan={3} className="en-hint">
              Totals cover every matching row, on all pages. Saved doctor fees only: grey 75% suggestions aren&rsquo;t counted.
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function EntryRow({ row, number, save, onEdit, onDelete }) {
  const label = sourceLabel(row);
  const fee = feeCharged(row);
  const manual = isManual(row);
  const consultation = row.consultation;
  const countryText = row.patient?.countryName || row.patient?.country || "—";
  return (
    <tr data-kind={row.kind} data-id={row.id}>
      <td className="en-num">{number}</td>
      <td data-l="Booking ID">
        <span className="en-bid" title={manual ? `Manual entry ${row.shortId}` : row.id}>
          {idText(row)}
        </span>
        <span className={`en-src en-src--${label.tone}`} title={label.title}>
          {label.text}
        </span>
        {manual && (
          <span className="en-manual-acts">
            <button
              type="button"
              className="en-link"
              onClick={() => onEdit(row)}
              title={row.manual?.locked ? "Payment to provider is Paid, so most details are locked. Open it to see what can still change." : "Edit this manual entry"}
            >
              Edit
            </button>
            <button
              type="button"
              className="en-link en-link--danger"
              onClick={() => onDelete(row)}
              disabled={!row.manual?.canDelete}
              title={row.manual?.canDelete ? "Delete this manual entry" : "A Paid row can't be deleted. Change the status first."}
            >
              Delete
            </button>
          </span>
        )}
      </td>
      <td data-l="Booked" className="en-dt en-c-bk">
        {formatBooked(row.bookedAt)}
      </td>
      <td data-l="Consultation" className="en-dt">
        {consultation?.date ? (
          <>
            {formatDay(consultation.date)}
            <span>{consultation.time || ""}</span>
          </>
        ) : (
          <span>Not scheduled</span>
        )}
      </td>
      <td data-l="Patient" className="en-nm">
        <b title={row.patient?.name}>{row.patient?.name || "—"}</b>
        <span>{countryText}</span>
        {manual && caseLine(row) && (
          <span className="en-caseline" title={caseLine(row)}>
            {caseLine(row)}
          </span>
        )}
      </td>
      <td data-l="Doctor" className="en-nm">
        {row.doctorName ? <b title={row.doctorName}>{row.doctorName}</b> : <b className="en-na">Not assigned</b>}
        {row.doctorChanged && (
          <span className="en-flag" title="The doctor on this booking changed after the fee was entered">
            ⚠ Doctor changed
          </span>
        )}
      </td>
      <td data-l="Fee charged" className="en-r en-money">
        {fee.main}
        {fee.paid && <small>{fee.paid}</small>}
      </td>
      <td data-l="Doctor fee ($)" className="en-ed">
        <FeeCell row={row} save={save} disabled={manual && row.manual?.locked} />
      </td>
      <td data-l="Paid status" className="en-ed">
        <StatusCell row={row} save={save} />
      </td>
      <td data-l="Paid on" className="en-ed">
        <PaidOnCell row={row} save={save} />
      </td>
      <td data-l="Comment" className="en-ed">
        <CommentCell row={row} save={save} />
      </td>
    </tr>
  );
}
