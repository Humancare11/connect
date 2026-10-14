import "./LiveChatToasts.css";
import { LIVECHAT_TAB_NAME } from "./liveChatTabs";

// In-app toasts for new chats, new messages and queue entries (demo: top-right, click to open the chat).
export default function LiveChatToasts({ toasts, onOpen }) {
  return (
    <div className="lcx-toasts" aria-live="polite">
      {toasts.map((toast) => (
        // A chat link is a plain anchor to the named Live Chat tab (always a tab, never a window). onOpen only
        // dismisses the toast, and follows the link itself when this already is the Live Chat tab.
        <a
          key={toast.id}
          href={toast.path || undefined}
          target={toast.path ? LIVECHAT_TAB_NAME : undefined}
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
