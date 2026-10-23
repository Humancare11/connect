import { useState } from "react";
import Modal from "../../../components/ui/Modal";
import { CANCEL_REASONS, refundWarning, shortBookingId } from "./bookingFormat";

// Cancelling needs one of the five reasons. A paid booking is not refunded automatically,
// so the dialog says so up front.
export default function CancelModal({ row, submitting, error, onSubmit, onClose }) {
  const [reason, setReason] = useState("");

  const submit = (event) => {
    event.preventDefault();
    if (reason && !submitting) onSubmit({ reason });
  };

  return (
    <Modal open onClose={onClose} dismissible={!submitting} title="Cancel appointment?" role="alertdialog" className="adp-bk-modal">
      <form onSubmit={submit} className="adp-bk-modal-body">
        <p className="adp-bk-modal-text">
          Booking {shortBookingId(row)} for {row.patient?.name || "the patient"} will be cancelled and the doctor&rsquo;s slot is released.
        </p>

        {row.paid && (
          <p className="adp-bk-modal-warning" role="note">
            {refundWarning(row)}
          </p>
        )}

        <label className="adp-bk-field">
          <span>Reason</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)} required autoFocus>
            <option value="">Choose a reason</option>
            {CANCEL_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <p className="adp-bk-modal-error" role="alert">
            {error}
          </p>
        )}

        <div className="hc-modal__actions">
          <button type="button" className="adp-bk-btn" onClick={onClose} disabled={submitting}>
            Go back
          </button>
          <button type="submit" className="adp-bk-btn adp-bk-btn--danger" disabled={!reason || submitting}>
            {submitting ? "Cancelling..." : "Cancel appointment"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
