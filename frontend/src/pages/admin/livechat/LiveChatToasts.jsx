import "./LiveChatToasts.css";

// In-app toasts for new chats, new messages and queue entries (demo: top-right, click to open the chat).
export default function LiveChatToasts({ toasts, onOpen }) {
  return (
    <div className="lcx-toasts" aria-live="polite">
      {toasts.map((toast) => (
        <button key={toast.id} type="button" className="lcx-toast" onClick={() => onOpen(toast)}>
          <span className="lcx-toast-av" aria-hidden="true">
            {String(toast.title || "?").slice(0, 1).toUpperCase()}
          </span>
          <span>
            <b>{toast.title}</b>
            <span>{toast.body}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
