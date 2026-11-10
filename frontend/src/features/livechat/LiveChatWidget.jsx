import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ContactForm from "./ContactForm";
import DoctorGreeter from "./DoctorGreeter";
import { DEFAULT_AI_NAME } from "./aiName";
import { buildTimeline } from "./timeline";
import { COMPOSER_MAX_PX, enterSends, fitTextarea, isCoarsePointer } from "./composerBox";
import EndChatDialog from "./EndChatDialog";
import FileBubble from "./FileBubble";
import InviteBubble from "./InviteBubble";
import QuickOptions from "./QuickOptions";
import RatingCard from "./RatingCard";
import { canUseVideo, introPlayedThisLoad, introVideoKind, prefersReducedMotion, saveDataOn, shouldPlayIntro } from "./greeterConfig";
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

const initialsOf = (name) => String(name || "").trim().slice(0, 2).toUpperCase() || "HS";

// Buttons to real pages of this site (the server only sends pages from its own list). A plain click moves within the
// site (client-side routing), so the widget and the conversation stay alive on the next page.
// The server's "Talk to a live agent" link (not a page) is a button that starts the same hand-over as the header button;
// it is hidden once the chat is no longer with the AI.
const AGENT_LINK = "#talk-to-live-agent";
function PageLinks({ links, onNavigate, onAgent, canRequestAgent }) {
  const navigate = useNavigate();
  const shown = (links || []).filter((link) => link.url !== AGENT_LINK || canRequestAgent);
  if (!shown.length) return null;
  return (
    <div className="lcw-links">
      {shown.map((link) =>
        link.url === AGENT_LINK ? (
          <button key={link.url} type="button" className="lcw-link" onClick={onAgent}>
            <span>{link.title}</span>
            <span aria-hidden="true">→</span>
          </button>
        ) : (
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
          <span aria-hidden="true">{link.url.startsWith("/appointment-booking") ? "Book →" : "Learn more & book →"}</span>
        </a>
        )
      )}
    </div>
  );
}

function Message({ message, aiName, onNavigate, files, onAgent, canRequestAgent }) {
  if (message.sender === "system") {
    return <div className="lcw-sys">{message.text}</div>;
  }
  if (message.sender === "patient") {
    return (
      <div className="lcw-msg lcw-msg--right">
        {message.file ? <FileBubble file={message.file} getUrl={files.url} onOpen={files.open} onDownload={files.download} prefix="lcw" /> : message.text}
        <span className="lcw-meta">{timeOf(message.at)}</span>
      </div>
    );
  }
  const isAgent = message.sender === "agent";
  return (
    <div className="lcw-bot">
      <span className="lcw-av lcw-av--sm">{isAgent ? initialsOf(message.agentName) : "HC"}</span>
      <div className="lcw-bw">
        <span className="lcw-bn">{isAgent ? message.agentName || "Humancare Connect support" : aiName}</span>
        <div className="lcw-msg lcw-msg--left">
          {message.file ? <FileBubble file={message.file} getUrl={files.url} onOpen={files.open} onDownload={files.download} prefix="lcw" /> : message.text}
          <span className="lcw-meta">{timeOf(message.at)}</span>
        </div>
        <PageLinks links={message.links} onNavigate={onNavigate} onAgent={onAgent} canRequestAgent={canRequestAgent} />
      </div>
    </div>
  );
}

export default function LiveChatWidget({ configAiName = DEFAULT_AI_NAME, showAiNotice = false }) {
  const chat = useLiveChat();
  const { phase, conversation, open, setOpen } = chat;
  const [draft, setDraft] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false); // the "End this chat?" dialog
  // The doctor greeter: the intro plays on every page load or refresh (not on a phone, with the window open or an
  // admin invite waiting); after it, on route changes, and whenever the window closes, the compact bar shows.
  const [stage, setStage] = useState(() =>
    shouldPlayIntro({
      reduced: prefersReducedMotion(),
      saveData: saveDataOn(),
      played: introPlayedThisLoad(),
      open,
      invite: Boolean(chat.invite),
    })
      ? "intro"
      : "compact"
  );
  const [introKind] = useState(introVideoKind); // alpha | ios
  const [video] = useState(canUseVideo); // false: reduced motion or data saver, the round button is just the chat icon
  const [pill, setPill] = useState(""); // what the patient typed in the greeter's pill
  // The text typed in the pill, kept while the contact form is shown and sent as the first message once the chat starts.
  const [held, setHeld] = useState("");
  const heldRef = useRef("");
  const holdText = (value) => {
    heldRef.current = value;
    setHeld(value);
  };
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  // What a file bubble needs from the chat: a link for the thumbnail, and what Open and Download do.
  const fileActions = { url: chat.fileUrl, open: chat.openFile, download: chat.downloadFile };

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

  const openWithText = (text) => {
    setStage("compact"); // closing the window brings back the compact bar, never the intro
    setPill("");
    holdText(text);
    setOpen(true);
  };

  // An intro still playing gives way to the compact bar when a message arrives or an admin writes to the patient.
  useEffect(() => {
    if (stage === "intro" && (chat.unread > 0 || chat.invite)) setStage("compact");
  }, [stage, chat.unread, chat.invite]);

  // The message box grows with the text (up to COMPOSER_MAX_PX, then it scrolls inside). A chat that was at the bottom
  // stays at the bottom while the box grows (the list gets shorter) and when it shrinks back after sending.
  useLayoutEffect(() => {
    const box = inputRef.current;
    if (!box) return;
    const body = bodyRef.current;
    const pinned = body ? body.scrollHeight - body.scrollTop - body.clientHeight < 80 : false;
    const before = box.offsetHeight;
    fitTextarea(box, COMPOSER_MAX_PX);
    if (pinned && body && box.offsetHeight !== before) body.scrollTop = body.scrollHeight;
  }, [draft, open, phase]);

  const submit = (event) => {
    event?.preventDefault?.();
    const text = draft.trim();
    if (!text || phase !== "chat" || !conversation) return;
    setDraft(""); // the message shows at once; if it is not sent it stays on screen with a retry
    inputRef.current?.focus();
    chat.send(text);
  };

  // Nothing here ever says the team is offline.
  let status = "Online";
  if (waiting) status = conversation.emailFollowUp ? "Message received" : "Connecting to our team";
  if (withAgent) status = "Live agent · Humancare Connect support";

  // On a phone the window covers the page: after a page link it folds away so the patient can read the page.
  const afterNavigate = () => {
    if (window.matchMedia?.("(max-width: 520px)").matches) setOpen(false);
  };

  const limitReached = chat.limitReached && !conversation;
  const locked = phase !== "chat" || !conversation || (ended && !canContinue);

  // The held message: sent as the patient's first message as soon as the chat exists. If the chat cannot take it, it
  // goes into the message box; if the window closes first it goes back into the pill. Nothing is sent before the form.
  useEffect(() => {
    if (!held) return;
    if (!open) {
      setPill(held);
      holdText("");
      return;
    }
    if (phase !== "chat") return;
    if (limitReached || (conversation && locked)) {
      setDraft(heldRef.current);
      holdText("");
      return;
    }
    if (!conversation) return;
    const text = heldRef.current;
    if (!text) return;
    holdText("");
    chat.send(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held, open, phase, conversation, locked, limitReached]);

  return (
    <div className="lcw-root">
      {open && (
        <section className="lcw-window" role="dialog" aria-label="Humancare Connect chat" data-lenis-prevent>
          <header className="lcw-head">
            <div className="lcw-av lcw-av--lg">
              {withAgent ? initialsOf(agentName) : "HC"}
            </div>
            <div className="lcw-who">
              <strong>{withAgent ? agentName || "Humancare Connect support" : aiName}</strong>
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
            <button
              type="button"
              className="lcw-sound"
              onClick={chat.toggleSound}
              aria-pressed={chat.soundOn}
              aria-label={chat.soundOn ? "Mute message sound" : "Turn message sound on"}
              title={chat.soundOn ? "Sound on – click to mute" : "Sound off – click to turn on"}
            >
              {chat.soundOn ? "🔔" : "🔕"}
            </button>
            <button type="button" className="lcw-x" onClick={() => setOpen(false)} aria-label="Minimize chat">
              –
            </button>
            <button
              type="button"
              className="lcw-x"
              onClick={() => setConfirmEnd(true)}
              aria-label="End chat"
            >
              ✕
            </button>
          </header>

          <div className="lcw-body" ref={bodyRef} aria-live="polite" data-lenis-prevent>
            {phase === "form" && <ContactForm aiName={aiName} onSubmit={chat.submitContact} reply={Boolean(chat.invite)} showNotice={showAiNotice} heldText={held} />}
            {phase === "loading" && <div className="lcw-sys">Loading your chat…</div>}
            {phase === "chat" && !conversation && limitReached && (
              <div className="lcw-sys" role="alert">
                {chat.limitMessage}
              </div>
            )}
            {phase === "chat" && !conversation && !limitReached && <div className="lcw-sys">Starting your chat…</div>}
            {phase === "chat" && conversation && (
              <>
                {buildTimeline(conversation.messages, chat.outbox).map((item) => {
                  if (item.kind === "message") {
                    return <Message key={item.key} message={item.message} aiName={aiName} onNavigate={afterNavigate} files={fileActions} onAgent={chat.talkToAgent} canRequestAgent={Boolean(conversation?.canRequestAgent)} />;
                  }
                  const m = item.entry;
                  return m.status === "failed" ? (
                    <button key={item.key} type="button" className="lcw-msg lcw-msg--right lcw-msg--failed" onClick={() => chat.retrySend(m.id)}>
                      {m.text}
                      <span className="lcw-meta">Not sent – tap to retry</span>
                    </button>
                  ) : (
                    <div key={item.key} className="lcw-msg lcw-msg--right lcw-msg--sending">
                      {m.text}
                      <span className="lcw-meta">Sending…</span>
                    </div>
                  );
                })}
                <QuickOptions options={conversation.options} onPick={chat.pickOption} />
                {ended && (conversation.canRate || conversation.rating) && (
                  <RatingCard rating={conversation.rating} canRate={conversation.canRate} onRate={chat.rate} />
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
              <textarea
                ref={inputRef}
                rows={1}
                value={draft}
                maxLength={MAX_CHARS}
                data-lenis-prevent
                enterKeyHint="send"
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (event.target.value) chat.notifyTyping();
                }}
                onKeyDown={(event) => {
                  // Enter sends, Shift+Enter is a new line; on a phone Enter is a new line and the arrow sends.
                  if (!enterSends({ key: event.key, shiftKey: event.shiftKey, isComposing: event.nativeEvent?.isComposing }, isCoarsePointer())) return;
                  event.preventDefault();
                  submit();
                }}
                placeholder={ended && !canContinue ? "Chat is unavailable" : limitReached ? "Chat is unavailable today" : locked ? "Fill in the form to start" : "Type a message…"}
                autoComplete="off"
                disabled={locked}
                aria-label="Your message"
              />
              <button type="submit" className="lcw-send" aria-label="Send" disabled={locked || !draft.trim()}>
                ➤
              </button>
            </form>
          </footer>
          {confirmEnd && (
            <EndChatDialog
              onCancel={() => setConfirmEnd(false)}
              onEnd={async (clear) => {
                if (clear) holdText("");
                await chat.endChat(clear);
                setConfirmEnd(false);
              }}
            />
          )}
        </section>
      )}

      {!open && chat.invite && <InviteBubble agentName={chat.invite.agentName} onReply={() => setOpen(true)} onLater={chat.dismissInvite} />}

      {open ? (
        <button type="button" className="lcw-launcher" onClick={() => setOpen(false)} aria-expanded="true">
          ✕ Close
        </button>
      ) : (
        <DoctorGreeter
          stage={stage}
          video={video}
          introKind={introKind}
          unread={chat.unread}
          text={pill}
          setText={setPill}
          onOpen={openWithText}
          onSettled={() => setStage("compact")}
        />
      )}
    </div>
  );
}
