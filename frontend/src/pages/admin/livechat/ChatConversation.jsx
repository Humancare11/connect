import { useEffect, useRef, useState } from "react";

// Middle column: the conversation. Patient on the left, AI and agents on the right, system lines centred,
// internal notes full width (they never reach the patient). Typing shows "typing…" only, never the draft.
const timeOf = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
};

function Message({ m }) {
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
        {m.text}
        <span className="wk-meta">{timeOf(m.at)}</span>
      </div>
    );
  }
  const label = m.sender === "ai" ? "AI assistant" : m.agentName || "Agent";
  return (
    <div className={`wk-msg wk-right${m.sender === "ai" ? " wk-ai" : ""}`}>
      {m.text}
      <span className="wk-meta">
        {label} · {timeOf(m.at)}
      </span>
    </div>
  );
}

function ModeTag({ c, me }) {
  if (c.mode === "archived") return <span className="wk-tag wk-tag--done">{c.closedReason === "patient_left" ? "Left" : "Resolved"}</span>;
  if (c.mode === "queue") return <span className="wk-tag wk-tag--wait">{c.offline ? "Offline request" : "Waiting"}</span>;
  if (c.mode === "live") return <span className="wk-tag wk-tag--human">{c.assignee?.id === me ? "You" : c.assignee?.name}</span>;
  return <span className="wk-tag wk-tag--ai">AI</span>;
}

export default function ChatConversation({ detail, me, role, typing, canned, busy, error, onTakeOver, onHandBack, onResolve, onSend, onNote, onSuggest, onTyping }) {
  const { conversation: c, messages } = detail;
  const [noteMode, setNoteMode] = useState(false);
  const [draft, setDraft] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);

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

  const submit = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    const ok = noting ? await onNote(text) : await onSend(text);
    if (ok) setDraft("");
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
        </div>
      </div>

      {error && (
        <div className="wk-error" role="alert">
          {error}
        </div>
      )}

      <div className="wk-body" ref={bodyRef}>
        {messages.map((m) => (
          <Message key={m.id} m={m} />
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
      </div>
    </div>
  );
}
