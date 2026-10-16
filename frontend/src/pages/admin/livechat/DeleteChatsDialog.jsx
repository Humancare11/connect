import { useEffect, useRef, useState } from "react";

// Confirmation for Super Admin deletes: says how many chats are affected. When `requireTyping` is set (a filter-based
// delete, or more than 50 chats) the button stays disabled until DELETE is typed. The server enforces the same rule.
export default function DeleteChatsDialog({ title, count, countLabel = "", description, confirmLabel = "Delete", requireTyping = false, busy = false, error = "", onConfirm, onCancel }) {
  const [typed, setTyped] = useState("");
  const inputRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    (requireTyping ? inputRef : cancelRef).current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requireTyping, busy, onCancel]);

  const ready = !requireTyping || typed === "DELETE";
  const noun = count === 1 ? "chat" : "chats";

  return (
    <div className="dc-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div className="dc-dialog" role="alertdialog" aria-modal="true" aria-labelledby="dc-title" aria-describedby="dc-desc">
        <h2 id="dc-title">{title}</h2>
        <p className="dc-count">
          <b>{count === null ? "…" : count}</b> {noun}
          {countLabel ? ` ${countLabel}` : ""}
        </p>
        <p id="dc-desc" className="wk-muted">
          {description}
        </p>
        {requireTyping && (
          <label className="dc-type">
            <span>
              Type <b>DELETE</b> to confirm
            </span>
            <input ref={inputRef} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} aria-label="Type DELETE to confirm" />
          </label>
        )}
        {error && (
          <div className="wk-error" role="alert">
            {error}
          </div>
        )}
        <div className="dc-actions">
          <button ref={cancelRef} type="button" className="wk-btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="wk-btn dc-danger" disabled={!ready || busy || !count} onClick={() => onConfirm(typed)}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
