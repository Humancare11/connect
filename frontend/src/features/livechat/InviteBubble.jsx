// The bubble above the launcher when an admin has started a chat with a visitor who never opened the widget
// (docs/chat-demo.html .peek). It shows only the agent's name: the message text is revealed after the visitor has
// filled in the contact form and replied. "Later" hides it for this browser session, "Reply" opens the chat.
export default function InviteBubble({ agentName, onReply, onLater }) {
  const name = agentName || "Our team";
  return (
    <div className="lcw-peek" role="alertdialog" aria-label="New message from Humancare support">
      <div className="lcw-peek-head">
        <span className="lcw-av lcw-av--xs">{String(name).slice(0, 2).toUpperCase()}</span>
        <span>{name} · Humancare support</span>
      </div>
      <p>{name} from Humancare support sent you a message</p>
      <div className="lcw-peek-actions">
        <button type="button" onClick={onLater}>
          Later
        </button>
        <button type="button" className="is-go" onClick={onReply}>
          Reply
        </button>
      </div>
    </div>
  );
}
