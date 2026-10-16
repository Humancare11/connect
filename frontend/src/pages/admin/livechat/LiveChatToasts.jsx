import "./LiveChatToasts.css";

// In-app toasts for new chats, new messages and queue entries (demo: top-right, click to open the chat).
export default function LiveChatToasts({ toasts, onOpen }) {
  return (
    <div className="lcx-toasts" aria-live="polite">
      {toasts.map((toast) => (
        // A chat link is a plain anchor that opens a new tab. onOpen dismisses the toast, and follows the link in
        // place when this already is the Live Chat tab.
        <a
          key={toast.id}
          href={toast.path || undefined}
          target={toast.path ? "_blank" : undefined}
          rel={toast.path ? "noopener" : undefined}
          className="lcx-toast"
          onClick={(event) => onOpen(toast, event)}
        >
          <span className="lcx-toast-av" aria-hidden="true">
            {String(toast.title || "?").slice(0, 1).toUpperCase()}
          </span>
          <span>
            <b>{toast.title}</b>
            <span>{toast.body}</span>
          </span>
        </a>
      ))}
    </div>
  );
}
