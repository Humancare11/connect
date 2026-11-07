import CancelModal from "./CancelModal";
import RescheduleModal from "./RescheduleModal";
import RescheduleHistoryDrawer from "./RescheduleHistoryDrawer";

// The dialog for the row action in progress, if any (state comes from useBookingActions). Assign and Alternate doctor
// are the full-page screen (AdminAssignDoctor), so they have no dialog here.
export default function BookingActionModals({ actions }) {
  const { modal, modalError, submitting, submit, closeModal, handlers } = actions;
  if (!modal) return null;
  const { row } = modal;
  if (modal.type === "cancel") {
    return <CancelModal key={row.id} row={row} submitting={submitting} error={modalError} onSubmit={(choice) => submit.cancel(row, choice)} onClose={closeModal} />;
  }
  if (modal.type === "reschedule") {
    return <RescheduleModal key={row.id} row={row} submitting={submitting} error={modalError} onSubmit={(body) => submit.reschedule(row, body)} onClose={closeModal} />;
  }
  if (modal.type === "history") {
    return <RescheduleHistoryDrawer key={row.id} row={row} onReschedule={handlers.reschedule} onClose={closeModal} />;
  }
  return null;
}
