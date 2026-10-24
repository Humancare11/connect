import { useState } from "react";
import { useToast } from "../../../components/ui/Toast";
import { useConfirm } from "../../../components/ui/ConfirmDialog";
import * as bookingApi from "./bookingApi";
import { explainActionError, refundWarning, shortBookingId } from "./bookingFormat";

// The row actions: Assign / Alternate doctor and Cancel open a dialog; Confirm and Auto
// complete ask first. After any action the list and the tab counts are reloaded. A lost
// race (409) closes the dialog, says so, and reloads; any other failure is shown in the
// dialog (or as a message) and nothing is reloaded.
// Themes the shared confirmation dialog in the admin teal (see AdminAppointments.css).
export const ADMIN_CONFIRM = "adp-confirm";

export default function useBookingActions({ reload }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState("");
  const [modal, setModal] = useState(null); // { type: "assign" | "alternate" | "cancel", row }
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  const closeModal = () => {
    if (submitting) return;
    setModal(null);
    setModalError("");
  };

  // Runs one call. `inDialog` actions keep the dialog open (with the error) until they succeed.
  const perform = async (row, call, onSuccess, { inDialog = false } = {}) => {
    if (inDialog) {
      setSubmitting(true);
      setModalError("");
    } else {
      setBusyId(row.id);
    }
    try {
      const res = await call();
      onSuccess?.(res.data || {});
      if (inDialog) setModal(null);
      reload();
      return true;
    } catch (err) {
      const { message, refresh } = explainActionError(err);
      if (refresh) {
        toast.error(message);
        setModal(null);
        reload();
      } else if (inDialog) {
        setModalError(message);
      } else {
        toast.error(message);
      }
      return false;
    } finally {
      if (inDialog) setSubmitting(false);
      else setBusyId("");
    }
  };

  const label = (row) => shortBookingId(row);

  const handlers = {
    assign: (row) => {
      setModalError("");
      setModal({ type: "assign", row });
    },
    alternate: (row) => {
      setModalError("");
      setModal({ type: "alternate", row });
    },
    cancel: (row) => {
      setModalError("");
      setModal({ type: "cancel", row });
    },
    reactivate: async (row) => {
      const ok = await confirm({
        title: "Reactivate this appointment?",
        message: `Booking ${label(row)} with ${row.doctorName} goes from Complete back to Confirmed. The doctor and the patient are told it is active again, and the video call opens for both.`,
        confirmText: "Reactivate",
        className: ADMIN_CONFIRM,
      });
      if (ok) perform(row, () => bookingApi.reactivateBooking(row.id), () => toast.success(`Booking ${label(row)} reactivated.`));
    },
    autoComplete: async (row) => {
      const ok = await confirm({
        title: "Auto complete appointment?",
        message: `Booking ${label(row)} with ${row.doctorName} will be marked Complete without waiting for the consultation to close.`,
        confirmText: "Mark complete",
        className: ADMIN_CONFIRM,
      });
      if (ok) perform(row, () => bookingApi.autoCompleteBooking(row.id), () => toast.success(`Booking ${label(row)} marked Complete.`));
    },
  };

  // What the dialogs call.
  const submit = {
    assign: (row, choice) =>
      perform(row, () => bookingApi.assignDoctor(row.id, choice), () => toast.success(`Doctor assigned to booking ${label(row)}. They need to confirm it.`), { inDialog: true }),
    alternate: (row, choice) =>
      perform(row, () => bookingApi.alternateDoctor(row.id, choice), () => toast.success(`Doctor changed on booking ${label(row)}. The new doctor needs to confirm it.`), { inDialog: true }),
    revert: (row) =>
      perform(row, () => bookingApi.revertDoctor(row.id), () => toast.success(`Booking ${label(row)} is back with ${row.originalDoctorName}. They need to confirm it.`), { inDialog: true }),
    cancel: (row, choice) =>
      perform(
        row,
        () => bookingApi.cancelBooking(row.id, choice),
        (data) => {
          toast.success(`Booking ${label(row)} cancelled.`);
          if (data.paid) toast.info(refundWarning(data.booking || row));
        },
        { inDialog: true },
      ),
  };

  return { busyId, handlers, submit, modal, modalError, submitting, closeModal };
}
