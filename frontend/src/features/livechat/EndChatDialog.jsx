import { useId, useState } from "react";

// X in the header: asks before ending the chat. "Also clear this chat from this device" is for shared computers: it
// forgets the conversation, the chat session and the saved details on this device (unchecked by default).
export default function EndChatDialog({ onEnd, onCancel }) {
  const [clear, setClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  return (
    <div className="lcw-dialog-backdrop" onClick={onCancel}>
      <div className="lcw-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
        <h3 id={titleId}>End this chat?</h3>
        <label className="lcw-dialog-check">
          <input type="checkbox" checked={clear} onChange={(event) => setClear(event.target.checked)} />
          <span>Also clear this chat from this device</span>
        </label>
        <div className="lcw-dialog-actions">
          <button type="button" className="lcw-dialog-cancel" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="lcw-dialog-end"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onEnd(clear);
            }}
          >
            End chat
          </button>
        </div>
      </div>
    </div>
  );
}
