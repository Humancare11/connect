import { useState } from "react";
import Modal from "../../../components/ui/Modal";
import { deleteManualEntry } from "./entriesApi";
import { formatMoney, saveErrorText } from "./entriesFormat";

// Deleting a manual entry asks first. It is a soft delete on the server (the audit trail stays) and only manual rows can
// be deleted at all: rows from real bookings have no delete.
export default function DeleteManualModal({ row, onDeleted, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await deleteManualEntry(row.id);
      onDeleted(row);
    } catch (err) {
      setError(saveErrorText(err));
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} dismissible={!busy} title="Delete this manual entry?" role="alertdialog" initialFocus=".en-keep" className="en-modal">
      <div className="en-form">
        <p className="en-modal-text">
          {row.patient?.name} · {row.doctorName || "No doctor"} · {formatMoney(row.feeChargedCents)}. Only manual entries can be deleted. Rows from
          real bookings can&rsquo;t.
        </p>
        {error && (
          <p className="en-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="hc-modal__actions">
          <button type="button" className="en-btn en-keep" onClick={onClose} disabled={busy}>
            Keep it
          </button>
          <button type="button" className="en-btn en-btn--danger" onClick={confirm} disabled={busy}>
            {busy ? "Deleting…" : "Delete entry"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
