import CancelModal from "./CancelModal";

// The dialog for the row action in progress, if any (state comes from useBookingActions). Only Cancel has a dialog:
// Assign and Alternate doctor are the full-page screen (AdminAssignDoctor).
export default function BookingActionModals({ actions }) {
  const { modal, modalError, submitting, submit, closeModal } = actions;
  if (!modal || modal.type !== "cancel") return null;
  const { row } = modal;
  return <CancelModal key={row.id} row={row} submitting={submitting} error={modalError} onSubmit={(choice) => submit.cancel(row, choice)} onClose={closeModal} />;
}
