import DoctorPickerModal from "./DoctorPickerModal";
import CancelModal from "./CancelModal";

// The dialog for the row action in progress, if any (state comes from useBookingActions).
export default function BookingActionModals({ actions }) {
  const { modal, modalError, submitting, submit, closeModal } = actions;
  if (!modal) return null;
  const { type, row } = modal;

  if (type === "cancel") {
    return <CancelModal key={row.id} row={row} submitting={submitting} error={modalError} onSubmit={(choice) => submit.cancel(row, choice)} onClose={closeModal} />;
  }
  return (
    <DoctorPickerModal
      key={`${type}:${row.id}`}
      mode={type}
      row={row}
      submitting={submitting}
      error={modalError}
      onSubmit={(choice) => (type === "assign" ? submit.assign(row, choice) : submit.alternate(row, choice))}
      onRevert={() => submit.revert(row)}
      onClose={closeModal}
    />
  );
}
