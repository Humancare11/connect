import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ContactForm from "./ContactForm";
import GreetingBubble from "./GreetingBubble";
import { DEFAULT_AI_NAME } from "./aiName";
import InviteBubble from "./InviteBubble";
import QuickOptions from "./QuickOptions";
import RatingCard from "./RatingCard";
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

const sizeOf = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const initialsOf = (name) => String(name || "").trim().slice(0, 2).toUpperCase() || "HS";

// Buttons to real pages of this site (the server only sends pages from its own list). A plain click moves within the
// site (client-side routing), so the widget and the conversation stay alive on the next page.
function PageLinks({ links, onNavigate }) {
  const navigate = useNavigate();
  if (!links?.length) return null;
  return (
    <div className="lcw-links">
      {links.map((link) => (
        <a
          key={link.url}
          className="lcw-link"
          href={link.url}
          onClick={(event) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            navigate(link.url);
            onNavigate?.();
          }}
        >
          <span>{link.title}</span>
          <span aria-hidden="true">{link.url === "/appointment-booking" ? "Book →" : "Learn more & book →"}</span>
        </a>
      ))}
    </div>
  );
}

function Message({ message, aiName, onNavigate, onOpenFile }) {
  if (message.sender === "system") {
    return <div className="lcw-sys">{message.text}</div>;
  }
  if (message.sender === "patient") {
    return (
      <div className="lcw-msg lcw-msg--right">
        {message.file ? (
          <span className="lcw-file">
            <span aria-hidden="true">📄</span> {message.file.name}
            <small> · {sizeOf(message.file.size)}</small>
          </span>
        ) : (
          message.text
        )}
        <span className="lcw-meta">{timeOf(message.at)}</span>
      </div>
    );
  }
  const isAgent = message.sender === "agent";
  return (
    <div className="lcw-bot">
      <span className="lcw-av lcw-av--sm">{isAgent ? initialsOf(message.agentName) : "HC"}</span>
      <div className="lcw-bw">
        <span className="lcw-bn">{isAgent ? message.agentName || "Humancare support" : aiName}</span>
        <div className="lcw-msg lcw-msg--left">
          {message.file ? (
            <span className="lcw-file">
              <span aria-hidden="true">📄</span> {message.file.name}
              <small> · {sizeOf(message.file.size)}</small>
              {message.file.id && (
                <button type="button" className="lcw-file-open" onClick={() => onOpenFile(message.file.id)}>
                  Open
                </button>
              )}
            </span>
          ) : (
            message.text
          )}
          <span className="lcw-meta">{timeOf(message.at)}</span>
        </div>
        <PageLinks links={message.links} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

export default function LiveChatWidget({ configAiName = DEFAULT_AI_NAME, showAiNotice = false }) {
  const chat = useLiveChat();
  const { phase, conversation, open, setOpen } = chat;
  const [draft, setDraft] = useState("");
  const [photoOk, setPhotoOk] = useState(true);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  const mode = conversation?.mode;
  const waiting = mode === "queue";
  const withAgent = mode === "live";
  const ended = mode === "archived";
  const canContinue = ended && Boolean(conversation?.canContinue); // closed for inactivity: writing again continues it
  const agentName = conversation?.agent?.name || "";
  const aiName = conversation?.aiName || configAiName; // the server setting; the config answer covers the contact form
  const messageCount = conversation?.messages.length ?? 0;

  // Keep the newest message in view.
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messageCount, chat.outbox.length, chat.aiTyping, open, phase, conversation?.options?.length]);

  useEffect(() => {
    if (open && phase === "chat") inputRef.current?.focus();
  }, [open, phase]);

  // Full-screen window on phones: stop the page behind from scrolling.
  useEffect(() => {
    document.documentElement.classList.toggle("lcw-open", open);
    return () => document.documentElement.classList.remove("lcw-open");
  }, [open]);

  const submit = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || phase !== "chat" || !conversation) return;
    setDraft(""); // the message shows at once; if it is not sent it stays on screen with a retry
    inputRef.current?.focus();
    chat.send(text);
  };

  // Nothing here ever says the team is offline.
  let status = "Online";
  if (waiting) status = conversation.emailFollowUp ? "Message received" : "Connecting to our team";
  if (withAgent) status = "Live agent · Humancare support";

  // On a phone the window covers the page: after a page link it folds away so the patient can read the page.
  const afterNavigate = () => {
    if (window.matchMedia?.("(max-width: 520px)").matches) setOpen(false);
  };

  const limitReached = chat.limitReached && !conversation;
  const locked = phase !== "chat" || !conversation || (ended && !canContinue);

  return (
    <div className="lcw-root">
      {open && (
        <section className="lcw-window" role="dialog" aria-label="Humancare chat" data-lenis-prevent>
          <header className="lcw-head">
            <div className="lcw-av lcw-av--lg">
              {withAgent ? initialsOf(agentName) : "HC"}
            </div>
            <div className="lcw-who">
              <strong>{withAgent ? agentName || "Humancare support" : aiName}</strong>
              <small>
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
            {phase === "chat" && !conversation?.canRequestAgent && conversation?.canSwitchToAi && (
              <button type="button" className="lcw-live" onClick={chat.switchToAi} title="Switch back to the AI assistant">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="4" y="7" width="16" height="12" rx="3" />
                  <path d="M12 7V4M9 13h.01M15 13h.01" />
                </svg>
                <span>Switch to AI</span>
              </button>
            )}
            <button type="button" className="lcw-x" onClick={() => setOpen(false)} aria-label="Minimize chat">
              –
            </button>
            <button type="button" className="lcw-x" onClick={() => setOpen(false)} aria-label="Close chat">
              ✕
            </button>
          </header>

          <div className="lcw-body" ref={bodyRef} aria-live="polite" data-lenis-prevent>
            {phase === "form" && <ContactForm aiName={aiName} onSubmit={chat.submitContact} reply={Boolean(chat.invite)} showNotice={showAiNotice} />}
            {phase === "loading" && <div className="lcw-sys">Loading your chat…</div>}
            {phase === "chat" && !conversation && limitReached && (
              <div className="lcw-sys" role="alert">
                {chat.limitMessage}
              </div>
            )}
            {phase === "chat" && !conversation && !limitReached && <div className="lcw-sys">Starting your chat…</div>}
            {phase === "chat" && conversation && (
              <>
                {conversation.messages.map((message) => (
                  <Message key={message.id} message={message} aiName={aiName} onNavigate={afterNavigate} onOpenFile={chat.openFile} />
                ))}
                {chat.outbox.map((m) =>
                  m.status === "failed" ? (
                    <button key={m.id} type="button" className="lcw-msg lcw-msg--right lcw-msg--failed" onClick={() => chat.retrySend(m.id)}>
                      {m.text}
                      <span className="lcw-meta">Not sent – tap to retry</span>
                    </button>
                  ) : (
                    <div key={m.id} className="lcw-msg lcw-msg--right lcw-msg--sending">
                      {m.text}
                      <span className="lcw-meta">Sending…</span>
                    </div>
                  )
                )}
                <QuickOptions options={conversation.options} onPick={chat.pickOption} />
                {ended && !canContinue && <RatingCard rating={conversation.rating} canRate={conversation.canRate} onRate={chat.rate} />}
                {ended && (
                  <div className="lcw-opts">
                    <button type="button" className="lcw-opt" onClick={chat.startNew}>
                      <span className="lcw-opt-label">Start a new chat</span>
                      <span className="lcw-opt-chev" aria-hidden="true">
                        ›
                      </span>
                    </button>
                  </div>
                )}
                {chat.agentTyping && (
                  <div className="lcw-typing">
                    <span className="lcw-dots">
                      <i />
                      <i />
                      <i />
                    </span>{" "}
                    {chat.agentTyping} is typing
                  </div>
                )}
                {chat.aiTyping && (
                  <div className="lcw-typing">
                    <span className="lcw-dots">
                      <i />
                      <i />
                      <i />
                    </span>{" "}
                    {aiName} is typing
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
            {chat.uploading && <div className="lcw-note">Uploading your file…</div>}
            <form className="lcw-composer" onSubmit={submit}>
              <input
                ref={fileRef}
                type="file"
                hidden
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) await chat.uploadFile(file);
                }}
              />
              <button
                type="button"
                className="lcw-attach"
                aria-label="Attach a report (PDF, JPG or PNG, up to 10 MB)"
                title="Attach a report (PDF, JPG or PNG, up to 10 MB)"
                disabled={locked || chat.uploading}
                onClick={() => fileRef.current?.click()}
              >
                📎
              </button>
              <input
                ref={inputRef}
                type="text"
                value={draft}
                maxLength={MAX_CHARS}
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (event.target.value) chat.notifyTyping();
                }}
                placeholder={canContinue ? "Send a message to continue" : ended ? "This chat has ended" : limitReached ? "Chat is unavailable today" : locked ? "Fill in the form to start" : "Message..."}
                autoComplete="off"
                disabled={locked}
                aria-label="Your message"
              />
              <button type="submit" className="lcw-send" aria-label="Send" disabled={locked || !draft.trim()}>
                ➤
              </button>
            </form>
          </footer>
        </section>
      )}

      {!open && chat.invite && <InviteBubble agentName={chat.invite.agentName} onReply={() => setOpen(true)} onLater={chat.dismissInvite} />}

      <GreetingBubble open={open} blocked={Boolean(chat.invite)} onOpen={() => setOpen(true)} />

      {open ? (
        <button type="button" className="lcw-launcher" onClick={() => setOpen(false)} aria-expanded="true">
          ✕ Close
        </button>
      ) : (
        <button
          type="button"
          className={`lcw-launcher ${photoOk ? "lcw-launcher--logo" : "lcw-launcher--hc"}`}
          onClick={() => setOpen(true)}
          aria-label="Open chat"
          aria-expanded="false"
        >
          {photoOk ? (
            <img src="/livechat/launcher-logo.png" alt="" width="236" height="256" onError={() => setPhotoOk(false)} />
          ) : (
            <span className="lcw-launcher-hc" aria-hidden="true">
              HC
            </span>
          )}
          {chat.unread > 0 && <span className="lcw-badge">{chat.unread}</span>}
        </button>
      )}
    </div>
  );
}
