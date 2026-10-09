import { useEffect, useRef, useState } from "react";
import ContactForm from "./ContactForm";
import QuickOptions from "./QuickOptions";
import { useLiveChat } from "./useLiveChat";
import "./LiveChatWidget.css";

// The patient chat widget (docs/chat-demo.html): launcher, header, messages, composer. The server decides what
// is visible (quick-option cards, the header "Talk to live agent" button), this component only renders it.
const MAX_CHARS = 1000;

const timeOf = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
};

function Message({ message }) {
  if (message.sender === "system") {
    return <div className="lcw-sys">{message.text}</div>;
  }
  if (message.sender === "patient") {
    return (
      <div className="lcw-msg lcw-msg--right">
        {message.text}
        <span className="lcw-meta">{timeOf(message.at)}</span>
      </div>
    );
  }
  const isAgent = message.sender === "agent";
  return (
    <div className="lcw-bot">
      <span className="lcw-av lcw-av--sm">{isAgent ? "HS" : "HC"}</span>
      <div className="lcw-bw">
        <span className="lcw-bn">{isAgent ? "Humancare support" : "Humancare AI"}</span>
        <div className="lcw-msg lcw-msg--left">
          {message.text}
          <span className="lcw-meta">{timeOf(message.at)}</span>
        </div>
      </div>
    </div>
  );
}

export default function LiveChatWidget() {
  const chat = useLiveChat();
  const { phase, conversation, open, setOpen } = chat;
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);

  const mode = conversation?.mode;
  const waiting = mode === "queue";
  const withAgent = mode === "live";
  const messageCount = conversation?.messages.length ?? 0;

  // Keep the newest message in view.
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messageCount, chat.aiTyping, open, phase, conversation?.options?.length]);

  useEffect(() => {
    if (open && phase === "chat") inputRef.current?.focus();
  }, [open, phase]);

  // Full-screen window on phones: stop the page behind from scrolling.
  useEffect(() => {
    document.documentElement.classList.toggle("lcw-open", open);
    return () => document.documentElement.classList.remove("lcw-open");
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending || phase !== "chat" || !conversation) return;
    setSending(true);
    const ok = await chat.send(text);
    setSending(false);
    if (ok) setDraft("");
  };

  let status = "AI Healthcare Coordinator";
  if (waiting) status = conversation.offline ? "Team offline · we'll email you" : "Connecting you with a live agent…";
  if (withAgent) status = "Live agent · Humancare support";

  const locked = phase !== "chat" || !conversation;

  return (
    <div className="lcw-root">
      {open && (
        <section className="lcw-window" role="dialog" aria-label="Humancare chat">
          <header className="lcw-head">
            <div className="lcw-av lcw-av--lg">
              {withAgent ? "HS" : "HC"}
              <i className={waiting ? "lcw-dot lcw-dot--wait" : "lcw-dot"} />
            </div>
            <div className="lcw-who">
              <strong>{withAgent ? "Humancare support" : "Humancare AI"}</strong>
              <small>
                <i className={waiting ? "lcw-dot-sm lcw-dot-sm--wait" : "lcw-dot-sm"} />
                <span title={status}>{status}</span>
              </small>
            </div>
            {phase === "chat" && conversation?.canRequestAgent && (
              <button type="button" className="lcw-live" onClick={chat.talkToAgent} title="Talk to a live agent">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
                  <rect x="3" y="13" width="4" height="6" rx="1.5" />
                  <rect x="17" y="13" width="4" height="6" rx="1.5" />
                </svg>
                <span>Talk to live agent</span>
              </button>
            )}
            <button type="button" className="lcw-x" onClick={() => setOpen(false)} aria-label="Minimize chat">
              –
            </button>
            <button type="button" className="lcw-x" onClick={() => setOpen(false)} aria-label="Close chat">
              ✕
            </button>
          </header>

          <div className="lcw-body" ref={bodyRef} aria-live="polite">
            {phase === "form" && <ContactForm onSubmit={chat.submitContact} />}
            {phase === "loading" && <div className="lcw-sys">Loading your chat…</div>}
            {phase === "chat" && !conversation && <div className="lcw-sys">Starting your chat…</div>}
            {phase === "chat" && conversation && (
              <>
                {conversation.messages.map((message) => (
                  <Message key={message.id} message={message} />
                ))}
                <QuickOptions options={conversation.options} onPick={chat.pickOption} />
                {chat.aiTyping && (
                  <div className="lcw-typing">
                    <span className="lcw-dots">
                      <i />
                      <i />
                      <i />
                    </span>{" "}
                    Humancare AI is typing
                  </div>
                )}
              </>
            )}
          </div>

          <footer className={`lcw-foot${locked ? " lcw-foot--locked" : ""}`}>
            {chat.notice && (
              <div className="lcw-notice" role="alert">
                {chat.notice}
              </div>
            )}
            {chat.connection === "offline" && phase === "chat" && <div className="lcw-notice">Reconnecting…</div>}
            <form className="lcw-composer" onSubmit={submit}>
              <input
                ref={inputRef}
                type="text"
                value={draft}
                maxLength={MAX_CHARS}
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (event.target.value) chat.notifyTyping();
                }}
                placeholder={locked ? "Fill in the form to start" : "Message..."}
                autoComplete="off"
                disabled={locked}
                aria-label="Your message"
              />
              <button type="submit" className="lcw-send" aria-label="Send" disabled={locked || sending || !draft.trim()}>
                ➤
              </button>
            </form>
            <div className="lcw-note">AI answers are general information, not medical advice.</div>
            <div className="lcw-note">Chat messages and, with your consent, the pages you visit are used to provide support.</div>
          </footer>
        </section>
      )}

      <button type="button" className="lcw-launcher" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? "✕ Close" : "💬 Chat with us"}
        {!open && chat.unread > 0 && <span className="lcw-badge">{chat.unread}</span>}
      </button>
    </div>
  );
}
