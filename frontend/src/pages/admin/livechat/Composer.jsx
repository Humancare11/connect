import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import Icon from "./lcIcons";

// The message box under a conversation (docs/live-chat-admin-ui.html "Enter message" bar). Reply to the patient or
// leave an internal note (notes never reach the patient), saved-reply chips, "Suggest a reply" (a draft the admin
// edits and sends), and reply translation for non-English chats. Enter sends, Shift+Enter starts a new line.
const Composer = forwardRef(function Composer(
  { conversation: c, notesOnly, heldByOther, mine, closed, busy, canned, language, onSend, onNote, onSuggest, onTranslateReply, onTyping, onTransError },
  ref
) {
  const [draft, setDraft] = useState("");
  const [noteMode, setNoteMode] = useState(false);
  const [englishSource, setEnglishSource] = useState(""); // the admin's English text while a translation is in the box
  const [suggesting, setSuggesting] = useState(false);
  const [replying, setReplying] = useState(false);
  const [pop, setPop] = useState("");
  const inputRef = useRef(null);
  const noting = noteMode || notesOnly;

  useImperativeHandle(ref, () => ({
    startNote() {
      setNoteMode(true);
      setPop("");
      window.setTimeout(() => inputRef.current?.focus(), 0);
    },
  }));

  // The box grows with the text, up to 150px.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, [draft]);

  useEffect(() => {
    if (!pop) return undefined;
    const close = (event) => {
      if (event.type === "keydown" ? event.key === "Escape" : !event.target.closest?.(".pop, [data-pop]")) setPop("");
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [pop]);

  const submit = async (event) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    const ok = noting ? await onNote(text) : await onSend(text, englishSource || undefined);
    if (ok) {
      setDraft("");
      setEnglishSource("");
      setPop("");
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

  // Reply translation: the admin's English text is replaced by the patient's language, editable; nothing is sent.
  const translateReply = async () => {
    const text = draft.trim();
    if (!text || replying) return;
    setReplying(true);
    onTransError("");
    const res = await onTranslateReply(text);
    setReplying(false);
    if (!res.ok) {
      onTransError(res.status === 429 ? "Too many translations, wait a moment" : "Translation unavailable right now");
      return;
    }
    setEnglishSource(text);
    setDraft(res.text);
    inputRef.current?.focus();
  };

  let placeholder = "Enter message";
  if (noting) placeholder = heldByOther ? `${c.assignee?.name} is handling this chat. Add a note for your team…` : "Write a note for your team…";

  return (
    <div className="cm">
      <div className="cm-inner">
        {!noting && (canned?.replies || []).length > 0 && (
          <div className="cm-chips">
            {canned.replies.map((r) => (
              <button
                key={r.id}
                type="button"
                className="cm-chip"
                title={r.text}
                disabled={notesOnly}
                onClick={() => {
                  setDraft(r.text.replaceAll("{agentName}", canned.agentName || "Support"));
                  inputRef.current?.focus();
                }}
              >
                {r.title}
              </button>
            ))}
          </div>
        )}
        <form className={`cm-box${noting ? " is-note" : ""}`} onSubmit={submit} autoComplete="off">
          {!noting && englishSource && (
            <div className="cm-src">
              <span>Your English: {englishSource}</span>
              <button
                type="button"
                className="wk-link"
                onClick={() => {
                  setDraft(englishSource);
                  setEnglishSource("");
                  inputRef.current?.focus();
                }}
              >
                Undo translation
              </button>
            </div>
          )}
          <textarea
            ref={inputRef}
            className="cm-text"
            rows={1}
            maxLength={2000}
            value={draft}
            placeholder={placeholder}
            aria-label={noting ? "Internal note" : "Reply to the patient"}
            onChange={(e) => {
              setDraft(e.target.value);
              if (!noting && mine && e.target.value) onTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <div className="cm-bar">
            <button type="button" className="cm-mode" data-pop onClick={() => setPop(pop === "mode" ? "" : "mode")} aria-expanded={pop === "mode"}>
              {noting ? "Note" : "Message"} <Icon name="chevD" size={16} />
            </button>
            <span className="cm-sep" aria-hidden="true" />
            {language && !noting && !closed && (
              <button
                type="button"
                className="cm-ic cm-tr"
                onClick={translateReply}
                disabled={replying || busy || !draft.trim() || Boolean(englishSource)}
                title="Type in English, translate, check, then send"
              >
                <Icon name="translate" />
                <span>{replying ? "Translating…" : `To ${language.name}`}</span>
              </button>
            )}
            <button
              type="button"
              className={`cm-ic is-ai${suggesting ? " spin" : ""}`}
              onClick={suggest}
              disabled={suggesting || busy || closed}
              title="Suggest a reply with AI"
              aria-label="Suggest a reply with AI"
            >
              <Icon name="wand" />
            </button>
            <span className="cm-hint">Enter to send · Shift+Enter for new line</span>
            <button type="submit" className="cm-send" disabled={busy || !draft.trim()}>
              {noting ? "Save note" : "Send"}
            </button>
          </div>
          {pop === "mode" && (
            <div className="pop pop--mode" role="menu">
              <button
                type="button"
                className={`pop-item${!noting ? " is-sel" : ""}`}
                disabled={notesOnly}
                onClick={() => {
                  setNoteMode(false);
                  setPop("");
                  inputRef.current?.focus();
                }}
              >
                <b>Message</b>
                <span>Visible to the patient</span>
              </button>
              <button
                type="button"
                className={`pop-item${noting ? " is-sel" : ""}`}
                onClick={() => {
                  setNoteMode(true);
                  setPop("");
                  inputRef.current?.focus();
                }}
              >
                <b>Internal note</b>
                <span>Only your team sees this</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
});

export default Composer;
