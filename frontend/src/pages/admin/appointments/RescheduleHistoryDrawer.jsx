import Modal from "../../../components/ui/Modal";
import StatusPill from "./StatusPill";
import RescheduleHistory from "./RescheduleHistory";
import { shortBookingId, canReschedule } from "./bookingFormat";

// A right-hand drawer (the shared Modal, styled as a side panel) with one booking's reschedule history.
export default function RescheduleHistoryDrawer({ row, onReschedule, onClose }) {
  return (
    <Modal open onClose={onClose} title={`Reschedule history · ${shortBookingId(row)}`} className="adp-rs-drawer">
      <div className="adp-rs-drawer__who">
        <strong>{row.patient?.name || "Unknown patient"}</strong>
        <span>{row.doctorName || "Not assigned"}</span>
        <StatusPill status={row.status} />
      </div>
      <RescheduleHistory id={row.id} />
      <p className="adp-rs-info">History is permanent. Each change keeps the old date and time.</p>
      <div className="hc-modal__actions">
        <button type="button" className="adp-bk-btn" onClick={onClose}>
          Close
        </button>
        {onReschedule && canReschedule(row) && (
          <button type="button" className="adp-bk-btn adp-bk-btn--ok" onClick={() => onReschedule(row)}>
            Reschedule again
          </button>
        )}
      </div>
    </Modal>
  );
}
