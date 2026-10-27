import { useRef } from "react";
import { useToast } from "../../../components/ui/Toast";
import { copyText } from "../appointments/copyText";
import { CommentCell, FeeCell, PaidOnCell, StatusCell } from "./EntryCells";
import { feeCharged, formatBooked, formatDay, formatMoney, idText, isManual, rowKey, rowNumber, sourceLabel, totalsText } from "./entriesFormat";

// The Auto entries table (bookings from the website and app). A full table while the window is wide; below 1360px each row becomes a
// card with labelled fields (see AdminEntries.css). The first columns come from the booking; the green ones are typed by an admin and
// saved as you go. There is no Actions column: these rows cannot be edited as a whole or deleted here.
export default function EntriesTable({ rows, page, totals, save }) {
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
            <EntryRow key={rowKey(row)} row={row} number={rowNumber(page, index)} save={save} />
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
              Totals cover every matching row, on all pages. Only saved doctor fees are added up.
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function EntryRow({ row, number, save }) {
  const label = sourceLabel(row);
  const fee = feeCharged(row);
  const manual = isManual(row);
  const consultation = row.consultation;
  const countryText = row.patient?.countryName || row.patient?.country || "—";
  return (
    <tr data-kind={row.kind} data-id={row.id}>
      <td className="en-num">{number}</td>
      <td data-l="Booking ID">
        <IdCopy row={row} />
        <span className={`en-src en-src--${label.tone}`} title={label.title}>
          {label.text}
        </span>
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

// The id is shown short; clicking it copies the FULL id (for a manual entry, its M- code), like the Appointments page. If the browser
// refuses, the full text (kept in a visually hidden span) is selected so Ctrl+C works, and the toast says so.
function IdCopy({ row }) {
  const toast = useToast();
  const full = useRef(null);
  const text = isManual(row) ? row.shortId : row.id;
  const copy = async () => {
    const result = await copyText(text, {
      select: () => {
        const range = document.createRange();
        range.selectNodeContents(full.current);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      },
      execCopy: () => document.execCommand("copy"),
    });
    if (result === "copied") toast.success("Booking ID copied");
    else toast.info(`Could not copy automatically. The ID is selected, press Ctrl+C: ${text}`);
  };
  return (
    <>
      <button type="button" className="en-idcopy" title="Click to copy" aria-label={`Copy booking ID ${text}`} onClick={copy}>
        <span className="en-bid">{idText(row)}</span>
      </button>
      <span ref={full} className="en-fullid">
        {text}
      </span>
    </>
  );
}
