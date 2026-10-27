import { BULK_ACTIONS, selectionText } from "./selectionLogic";

// The dark bar above the table while selecting: how many are ticked, and what to do with them.
// There is deliberately no bulk Confirm: only the doctor confirms a booking. Cancel is shown to super admins only.
export default function BulkBar({ count, busy, canCancel = true, onAction, onDone }) {
  const none = count === 0 || busy;
  return (
    <div className="adp-bk-bulk" role="toolbar" aria-label="Bulk actions">
      <span className="adp-bk-bulk-count" aria-live="polite">{selectionText(count)}</span>
      {Object.entries(BULK_ACTIONS).filter(([action]) => action !== "cancel" || canCancel).map(([action, { label }]) => (
        <button key={action} type="button" className="adp-bk-bulk-btn" data-bulk={action} disabled={none} onClick={() => onAction(action)}>
          {label}
        </button>
      ))}
      <button type="button" className="adp-bk-bulk-btn adp-bk-bulk-btn--done" onClick={onDone} disabled={busy}>
        Done
      </button>
    </div>
  );
}
