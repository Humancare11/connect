import { useState } from "react";
import { useToast } from "../../../components/ui/Toast";
import { useConfirm } from "../../../components/ui/ConfirmDialog";
import * as bookingApi from "./bookingApi";
import { explainActionError } from "./bookingFormat";
import { ADMIN_CONFIRM } from "./useBookingActions";
import { TESTING_ACTIONS, UNDO_TOAST_MS, bulkRefundNote, describeBulkResult, eligibleCount, summarizeBulk, testingToastText } from "./selectionLogic";

// Bulk actions on the ticked rows. The server applies the same rules as for a single row and answers per
// booking; a booking that can't be changed is reported (skipped, with the reason), never fatal to the rest.
// Whatever happens, the list and the tab counts are reloaded and the ticks are cleared.
export default function useBulkActions({ selection, reload }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null); // { type: "cancel", rows } | { type: "result", result }

  const run = async (action, rows, extra = {}) => {
    const rowsById = new Map(rows.map((r) => [r.id, r]));
    setBusy(true);
    try {
      const res = await bookingApi.bulk({ action, ids: rows.map((r) => r.id), ...extra });
      const items = (res.data.results || []).map((r) => describeBulkResult(r, rowsById));
      const cancelledRows = items.filter((i) => i.outcome === "done").map((i) => rowsById.get(i.id)).filter(Boolean);
      setDialog({
        type: "result",
        result: {
          action,
          items,
          summary: summarizeBulk(items),
          refundNote: action === "cancel" ? bulkRefundNote(cancelledRows, "cancelled") : "",
        },
      });
      selection.clear();
      reload();
      return true;
    } catch (err) {
      toast.error(explainActionError(err).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Mark / unmark testing: runs at once, answers with a toast that has Undo (the opposite action on the bookings that
  // changed). Only if some booking was skipped or failed is the result list shown as well.
  const runTesting = async (action, rows) => {
    const rowsById = new Map(rows.map((r) => [r.id, r]));
    setBusy(true);
    try {
      const res = await bookingApi.bulk({ action, ids: rows.map((r) => r.id) });
      const items = (res.data.results || []).map((r) => describeBulkResult(r, rowsById));
      const summary = summarizeBulk(items);
      const doneIds = items.filter((i) => i.outcome === "done").map((i) => i.id);
      // Undo reverses only what really changed: a booking that was already in the target state is left alone.
      const target = action === "mark-testing";
      const changedIds = doneIds.filter((id) => (rowsById.get(id)?.isTesting === true) !== target);
      if (summary.skipped || summary.failed) {
        setDialog({ type: "result", result: { action, items, summary, refundNote: "" } });
      }
      if (doneIds.length) {
        const undoAction = TESTING_ACTIONS[action];
        toast.success(testingToastText(action, doneIds.length), {
          duration: UNDO_TOAST_MS,
          action: changedIds.length === 0 ? undefined : {
            label: "Undo",
            onClick: async () => {
              try {
                await bookingApi.bulk({ action: undoAction, ids: changedIds });
                toast.info("Undone.");
              } catch (err) {
                toast.error(explainActionError(err).message);
              } finally {
                reload();
              }
            },
          },
        });
      }
      selection.clear();
      reload();
    } catch (err) {
      toast.error(explainActionError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const start = async (action) => {
    const rows = selection.selectedRows;
    if (rows.length === 0) return;

    if (action === "cancel") {
      setDialog({ type: "cancel", rows });
      return;
    }

    if (action === "auto-complete") {
      const can = eligibleCount(action, rows);
      if (can === 0) {
        toast.info("None of the selected bookings can be auto completed: only Assigned or Confirmed ones can.");
        return;
      }
      const skipped = rows.length - can;
      const ok = await confirm({
        title: `Auto complete ${can} ${can === 1 ? "appointment" : "appointments"}?`,
        message:
          `They will be marked Complete without waiting for the consultation to close.` +
          (skipped > 0 ? ` ${skipped} of the selected bookings ${skipped === 1 ? "is" : "are"} not Assigned or Confirmed and will be skipped.` : ""),
        confirmText: "Mark complete",
        className: ADMIN_CONFIRM,
      });
      if (ok) run(action, rows);
      return;
    }

    // Mark / unmark testing: any status, nothing is sent to anyone.
    runTesting(action, rows);
  };

  return {
    busy,
    dialog,
    start,
    submitCancel: (choice) => run("cancel", dialog.rows, choice),
    closeDialog: () => {
      if (!busy) setDialog(null);
    },
  };
}
