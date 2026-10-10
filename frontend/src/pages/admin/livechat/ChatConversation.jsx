import { useEffect, useRef, useState } from "react";
import { handoffLabel } from "./liveChatHub";

// Middle column: the conversation. Patient on the left, AI and agents on the right, system lines centred,
// internal notes full width (they never reach the patient). Typing shows "typing…" only, never the draft.
const timeOf = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
};

const sizeOf = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round((bytes || 0) / 1024))} KB`);

// translation: { text, from, fromName } for the English view (or null); shownOriginal: the admin switched this one
// message back to its original.
function Message({ m, onOpenFile, translation, language, shownOriginal, onToggleOriginal }) {
  if (m.sender === "system") {
    return (
      <div className="wk-sys">
        {m.text} · {timeOf(m.at)}
        {m.internal ? " · team only" : ""}
      </div>
    );
  }
  if (m.sender === "note") {
    return (
      <div className="wk-msg wk-note">
        <b>Internal note:</b> {m.text}
        <span className="wk-meta">
          Only your team sees this · {m.agentName ? `${m.agentName} · ` : ""}
          {timeOf(m.at)}
        </span>
      </div>
    );
  }
  if (m.sender === "patient") {
    return (
      <div className="wk-msg wk-left">
        {m.file ? (
          <span className="wk-file">
            <span aria-hidden="true">📄</span>
            <span className="wk-file-name">
              {m.file.name}
              <small>
                {" "}
                · {sizeOf(m.file.size)} · {m.file.mime === "application/pdf" ? "PDF" : m.file.mime === "image/png" ? "PNG" : "JPG"}
              </small>
            </span>
            <button type="button" className="wk-btn" onClick={() => onOpenFile(m.file)}>
              Open
            </button>
          </span>
        ) : (
          <TranslatedText text={m.text} translation={translation} shownOriginal={shownOriginal} onToggleOriginal={onToggleOriginal} />
        )}
        <span className="wk-meta">{timeOf(m.at)}</span>
      </div>
    );
  }
  const label = m.sender === "ai" ? "AI assistant" : m.agentName || "Agent";
  return (
    <div className={`wk-msg wk-right${m.sender === "ai" ? " wk-ai" : ""}`}>
      <TranslatedText text={m.text} translation={translation} shownOriginal={shownOriginal} onToggleOriginal={onToggleOriginal} />
      {m.sourceText ? (
        <span className="wk-source">
          Your English: {m.sourceText}
          {language ? ` (sent in ${language.name})` : ""}
        </span>
      ) : null}
      <span className="wk-meta">
        {label} · {timeOf(m.at)}
      </span>
    </div>
  );
}

// The English view of one message, with "Translated from German - show original" under it.
function TranslatedText({ text, translation, shownOriginal, onToggleOriginal }) {
  if (!translation) return text;
  const from = translation.fromName || "the original language";
  if (shownOriginal) {
    return (
      <>
        {text}
        <span className="wk-trans">
          Original ({from}) ·{" "}
          <button type="button" className="wk-link" onClick={onToggleOriginal}>
            show English
          </button>
        </span>
      </>
    );
  }
  return (
    <>
      {translation.text}
      <span className="wk-trans">
        Translated from {from} ·{" "}
        <button type="button" className="wk-link" onClick={onToggleOriginal}>
          show original
        </button>
      </span>
    </>
  );
}

function ModeTag({ c, me }) {
  if (c.mode === "archived") {
    const label = { patient_left: "Left", blocked: "Blocked" }[c.closedReason] || "Resolved";
    return <span className="wk-tag wk-tag--done">{label}</span>;
  }
  if (c.mode === "queue") {
    if (c.emailStatus === "failed") return <span className="wk-tag wk-tag--wait" title="The follow-up email could not be sent">Email failed</span>;
    return <span className="wk-tag wk-tag--wait">{c.emailFollowUp ? "Email follow-up" : "Waiting"}</span>;
  }
  if (c.mode === "live") return <span className="wk-tag wk-tag--human">{c.assignee?.id === me ? "You" : c.assignee?.name}</span>;
  return <span className="wk-tag wk-tag--ai">AI</span>;
}

export default function ChatConversation({ detail, me, role, typing, canned, busy, error, onTakeOver, onHandBack, onResolve, onSend, onNote, onSuggest, onTyping, onOpenFile, onBlockIp, onTranslate, onTranslateReply, onSetView }) {
  const { conversation: c, messages } = detail;
  const [noteMode, setNoteMode] = useState(false);
  const [draft, setDraft] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);

  // Translation (this admin only; the patient never sees any of it)
  const language = c.language || null; // { code, name } for non-English chats
  const [view, setView] = useState(detail.view === "en" ? "en" : "original");
  const [translations, setTranslations] = useState({}); // messageId -> { text, from, fromName }
  const [originals, setOriginals] = useState(() => new Set()); // messages switched back to the original
  const [translating, setTranslating] = useState(false);
  const [transError, setTransError] = useState("");
  const asked = useRef(new Set()); // message ids already sent for translation
  const mounted = useRef(true);
  const [englishSource, setEnglishSource] = useState(""); // the admin's English text while a translation is in the box
  const [replying, setReplying] = useState(false);

  const closed = c.mode === "archived";
  const mine = c.assignee?.id === me;
  const heldByOther = c.mode === "live" && !mine;
  const superadmin = role === "superadmin";
  const canTakeOver = !closed && (c.mode === "ai" || c.mode === "queue" || (heldByOther && superadmin));
  const canHandBack = c.mode === "live" && (mine || superadmin);
  const canResolve = !closed && (!heldByOther || superadmin);
  // Only the assignee replies; everyone else (and everyone on a closed chat) can still leave internal notes.
  const notesOnly = closed || heldByOther;
  const noting = noteMode || notesOnly;

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, typing, c.conversationId]);

  const englishView = Boolean(language) && view === "en";
  // English view: translate what is not translated yet, and every new patient message as it arrives.
  useEffect(() => {
    if (!englishView) return undefined;
    const wanted = messages.filter(
      (m) => ["patient", "ai", "agent"].includes(m.sender) && !m.internal && !m.file && m.text && !m.translation && !asked.current.has(m.id)
    );
    if (!wanted.length) return undefined;
    wanted.forEach((m) => asked.current.add(m.id));
    // Results are merged by message id, so a result that arrives after newer messages is still useful: it is only
    // dropped when this chat is no longer on screen.
    Promise.resolve().then(() => setTranslating(true));
    onTranslate(wanted.map((m) => m.id)).then((res) => {
      if (!mounted.current) return;
      setTranslating(false);
      if (!res.ok) {
        wanted.forEach((m) => asked.current.delete(m.id));
        setTransError("Translation unavailable right now");
        return;
      }
      setTransError("");
      setTranslations((t) => ({ ...t, ...res.data.translations }));
    });
    return undefined;
  }, [englishView, messages, onTranslate]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const chooseView = (next) => {
    setView(next);
    setTransError("");
    onSetView(next);
  };
  const translationOf = (m) => (englishView ? translations[m.id] || m.translation || null : null);
  const toggleOriginal = (id) =>
    setOriginals((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Reply translation: the admin's English text is replaced by the patient's language, editable; nothing is sent.
  const translateReply = async () => {
    const text = draft.trim();
    if (!text || replying) return;
    setReplying(true);
    setTransError("");
    const res = await onTranslateReply(text);
    setReplying(false);
    if (!res.ok) {
      setTransError(res.status === 429 ? "Too many translations, wait a moment" : "Translation unavailable right now");
      return;
    }
    setEnglishSource(text);
    setDraft(res.text);
    inputRef.current?.focus();
  };
  const undoTranslation = () => {
    setDraft(englishSource);
    setEnglishSource("");
    inputRef.current?.focus();
  };

  const submit = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    const ok = noting ? await onNote(text) : await onSend(text, englishSource || undefined);
    if (ok) {
      setDraft("");
      setEnglishSource("");
    }
  };

  const suggest = async () => {
    setSuggesting(true);
    const text = await onSuggest();
    setSuggesting(false);
    if (text) {
      setNoteMode(false);
      setDraft(text);
      inputRef.current?.focus();
    }
  };

  let placeholder = "Typing here takes over the chat…";
  if (noting) placeholder = heldByOther ? `${c.assignee?.name} is handling this chat. Add a note for your team…` : "Note for your team…";
  else if (c.mode === "live") placeholder = "Type a reply…";

  return (
    <div className="wk-chat">
      <div className="wk-head">
        <div className="wk-head-t">
          <strong>{c.name || c.ip || "Visitor"}</strong>
          <ModeTag c={c} me={me} />
          {(c.mode === "queue" || c.mode === "live") && handoffLabel(c.handoffReason) && (
            <span className="wk-tag wk-tag--lang" title="Why this chat was handed to a person">{handoffLabel(c.handoffReason)}</span>
          )}
          {language && (
            <span className="wk-tag wk-tag--lang" title={`The patient writes in ${language.name}`}>
              {language.name}
            </span>
          )}
          {c.invited && <span className="wk-tag wk-tag--ai" title="You started this chat; the visitor has not replied yet">Invited</span>}
          {c.rating ? (
            <span className="wk-rating" title={`Patient rating: ${c.rating} of 5`}>
              {"★".repeat(c.rating)}
            </span>
          ) : null}
          {heldByOther && <span className="wk-small wk-muted">held by {c.assignee?.name}</span>}
        </div>
        <div className="wk-actions">
          {canTakeOver && (
            <button type="button" className="wk-btn wk-btn--go" onClick={onTakeOver} disabled={busy}>
              {heldByOther ? `Take over from ${c.assignee?.name}` : "Take over chat"}
            </button>
          )}
          {canHandBack && (
            <button type="button" className="wk-btn wk-btn--ai" onClick={onHandBack} disabled={busy}>
              Hand back to AI
            </button>
          )}
          {canResolve && (
            <button type="button" className="wk-btn" onClick={onResolve} disabled={busy}>
              Resolve
            </button>
          )}
          {c.ip && (
            <button type="button" className="wk-btn wk-btn--danger" onClick={onBlockIp} disabled={busy} title={`Block IP ${c.ip}`}>
              Block IP
            </button>
          )}
        </div>
      </div>

      {language && (
        <div className="wk-viewbar">
          <div className="wk-seg" role="group" aria-label="Message language">
            <button type="button" aria-pressed={view === "original"} onClick={() => chooseView("original")}>
              Original ({language.name})
            </button>
            <button type="button" aria-pressed={view === "en"} onClick={() => chooseView("en")}>
              English
            </button>
          </div>
          {translating && <span className="wk-small wk-muted">Translating…</span>}
          <span className="wk-small wk-muted">Only your team sees this. The patient always sees the original.</span>
        </div>
      )}

      {(error || transError) && (
        <div className="wk-error" role="alert">
          {error || transError}
        </div>
      )}

      <div className="wk-body" ref={bodyRef}>
        {messages.map((m) => (
          <Message key={m.id} m={m} onOpenFile={onOpenFile} translation={translationOf(m)} language={language} shownOriginal={originals.has(m.id)} onToggleOriginal={() => toggleOriginal(m.id)} />
        ))}
        {typing && (
          <div className="wk-typing">
            <span className="wk-dots">
              <i />
              <i />
              <i />
            </span>{" "}
            {c.name || "Visitor"} is typing…
          </div>
        )}
      </div>

      <div className={`wk-foot${noting ? " is-note" : ""}`}>
        <div className="wk-row wk-wrap">
          <div className="wk-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={!noting} disabled={notesOnly} onClick={() => setNoteMode(false)}>
              Reply to patient
            </button>
            <button type="button" role="tab" aria-selected={noting} onClick={() => setNoteMode(true)}>
              Internal note
            </button>
          </div>
          <button type="button" className="wk-btn wk-btn--ai" onClick={suggest} disabled={suggesting || busy || closed}>
            {suggesting ? "Thinking…" : "✨ Suggest a reply"}
          </button>
        </div>
        <div className="wk-chips">
          {(canned?.replies || []).map((r) => (
            <button
              key={r.id}
              type="button"
              className="wk-chip"
              disabled={notesOnly}
              onClick={() => {
                setNoteMode(false);
                setDraft(r.text.replaceAll("{agentName}", canned.agentName || "Support"));
                inputRef.current?.focus();
              }}
            >
              {r.title}
            </button>
          ))}
        </div>
        {!noting && englishSource && (
          <div className="wk-source wk-source--box">
            Your English: {englishSource}{" "}
            <button type="button" className="wk-link" onClick={undoTranslation}>
              Undo translation
            </button>
          </div>
        )}
        <form className="wk-composer" onSubmit={submit}>
          <input
            ref={inputRef}
            type="text"
            value={draft}
            maxLength={2000}
            autoComplete="off"
            placeholder={placeholder}
            aria-label={noting ? "Internal note" : "Reply to the patient"}
            onChange={(e) => {
              setDraft(e.target.value);
              if (!noting && mine && e.target.value) onTyping();
            }}
          />
          <button type="submit" className="wk-send" disabled={busy || !draft.trim()}>
            {noting ? "Save note" : "Send"}
          </button>
        </form>
        {language && !noting && !closed && (
          <div className="wk-row wk-wrap">
            <button type="button" className="wk-btn" onClick={translateReply} disabled={replying || busy || !draft.trim() || Boolean(englishSource)}>
              {replying ? "Translating…" : `Translate to ${language.name}`}
            </button>
            <span className="wk-small wk-muted">Type in English, translate, check the text, then Send. Nothing is sent automatically.</span>
          </div>
        )}
      </div>
    </div>
  );
}
