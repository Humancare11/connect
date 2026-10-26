import { useState } from "react";
import Modal from "../../../components/ui/Modal";
import { CANCEL_REASONS } from "./bookingFormat";
import { bulkRefundNote, eligibleCount } from "./selectionLogic";

// Cancel every selected booking with one reason (required, one of the five). Paid bookings are not
// refunded automatically, so the dialog counts them up front. Bookings that can't be cancelled
// (Complete / Cancelled) are skipped by the server and listed in the result.
export default function BulkCancelModal({ rows, submitting, onSubmit, onClose }) {
  const [reason, setReason] = useState("");
  const cancellable = eligibleCount("cancel", rows);
  const skipped = rows.length - cancellable;
  const refund = bulkRefundNote(rows.filter((r) => r.paid), "selected");

  const submit = (event) => {
    event.preventDefault();
    if (reason && !submitting) onSubmit({ reason });
  };

  return (
    <Modal open onClose={onClose} dismissible={!submitting} title={`Cancel ${rows.length} ${rows.length === 1 ? "booking" : "bookings"}?`} role="alertdialog" className="adp-bk-modal">
      <form onSubmit={submit} className="adp-bk-modal-body">
        <p className="adp-bk-modal-text">
          The doctors&rsquo; slots are released.
          {skipped > 0 && ` ${skipped} of the selected bookings ${skipped === 1 ? "is" : "are"} already Complete or Cancelled and will be skipped.`}
        </p>

        {refund && (
          <p className="adp-bk-modal-warning" role="note">
            {refund}
          </p>
        )}

        <label className="adp-bk-field">
          <span>Reason (applies to all)</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)} required autoFocus>
            <option value="">Choose a reason</option>
            {CANCEL_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <div className="hc-modal__actions">
          <button type="button" className="adp-bk-btn" onClick={onClose} disabled={submitting}>
            Go back
          </button>
          <button type="submit" className="adp-bk-btn adp-bk-btn--danger" disabled={!reason || submitting}>
            {submitting ? "Cancelling..." : "Cancel appointments"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
