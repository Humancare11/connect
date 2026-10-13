import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import Icon from "./lcIcons";

// The message box under a conversation (docs/live-chat-admin-ui.html "Enter message" bar).
//   Message / Internal note   notes are for the team and never reach the patient
//   To <language>             on a non-English chat: type in English, translate into the patient's language, check it, send
//   Saved replies (#)         click the # button, or type # in the box and keep typing to filter; Super Admin manages them
//   Suggest a reply (AI)      puts a draft in the box; nothing is sent until the admin edits and sends it
//   Emoji, Attach a file      PDF, JPG or PNG up to 10 MB, sent to the patient
// Enter sends, Shift+Enter starts a new line.
const EMOJIS = ["👋", "🙂", "😊", "🙏", "👍", "✅", "🎉", "❤️", "😅", "🤝", "📎", "⏳", "💳", "📅", "🩺", "💊", "📞", "✉️", "🔄", "⭐", "👌", "😉", "🙌"];
const FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const FILE_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

// "#gre" typed at the caret (at the start or after a space): the filter text, or null when not typing a # command.
const hashAt = (text, caret) => {
  const m = /(^|\s)#([^\s#]*)$/.exec(text.slice(0, caret));
  return m ? { filter: m[2].toLowerCase(), start: caret - m[2].length - 1 } : null;
};

const Composer = forwardRef(function Composer(
  { conversation: c, notesOnly, heldByOther, mine, closed, busy, canned, language, onSend, onNote, onSuggest, onTranslateReply, onAttach, onTyping, onNotice },
  ref
) {
  const [draft, setDraft] = useState("");
  const [caret, setCaret] = useState(0);
  const [noteMode, setNoteMode] = useState(false);
  const [englishSource, setEnglishSource] = useState(""); // the admin's English text while a translation is in the box
  const [suggesting, setSuggesting] = useState(false);
  const [replying, setReplying] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [pop, setPop] = useState("");
  const [active, setActive] = useState(0); // highlighted saved reply while typing #
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const noting = noteMode || notesOnly;
  const replies = useMemo(() => canned?.replies || [], [canned]);

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

  // Popovers close on an outside click or Escape.
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

  // Typing # opens the saved replies, filtered by what follows.
  const hash = noting || notesOnly ? null : hashAt(draft, caret);
  const shown = useMemo(() => {
    if (!hash) return replies;
    return replies.filter((r) => !hash.filter || `${r.title} ${r.text}`.toLowerCase().includes(hash.filter));
  }, [hash, replies]);
  const hashOpen = Boolean(hash) && replies.length > 0;
  const repliesOpen = hashOpen || pop === "canned";

  const focusAt = (position) => {
    window.setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(position, position);
      setCaret(position);
    }, 0);
  };

  // Inserts text at the caret (or replaces the #command being typed).
  const insert = (text, { from = caret, to = caret } = {}) => {
    const next = draft.slice(0, from) + text + draft.slice(to);
    setDraft(next);
    focusAt(from + text.length);
  };

  const pickReply = (reply) => {
    const text = reply.text.replaceAll("{agentName}", canned.agentName || "Support");
    if (!notesOnly) setNoteMode(false);
    if (hash) insert(text, { from: hash.start, to: caret });
    else if (!draft.trim()) {
      setDraft(text);
      focusAt(text.length);
    } else insert(text);
    setPop("");
    setActive(0);
  };

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
      focusAt(text.length);
    }
  };

  // Reply translation: the admin's English text is replaced by the other language, editable; nothing is sent.
  const translate = async () => {
    const text = draft.trim();
    if (!text || replying || !language) return;
    setReplying(true);
    onNotice("");
    const res = await onTranslateReply(text);
    setReplying(false);
    if (!res.ok) {
      onNotice(res.status === 429 ? "Too many translations, wait a moment" : "Translation unavailable right now");
      return;
    }
    setEnglishSource(text);
    setDraft(res.text);
    focusAt(res.text.length);
  };

  const attach = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const extension = String(file.name).split(".").pop().toLowerCase();
    if (!FILE_EXTENSIONS.includes(extension) || (file.type && !FILE_TYPES.includes(file.type))) return onNotice("Only PDF, JPG or PNG files can be sent.");
    if (file.size > MAX_FILE_BYTES) return onNotice("That file is over 10 MB.");
    if (file.size === 0) return onNotice("That file is empty.");
    onNotice("");
    setAttaching(true);
    await onAttach(file);
    setAttaching(false);
    return undefined;
  };

  const onKeyDown = (e) => {
    if (hashOpen && shown.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length);
        return;
      }
      if ((e.key === "Enter" || e.key === "Tab") && !e.shiftKey) {
        e.preventDefault();
        pickReply(shown[Math.min(active, shown.length - 1)]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDraft(draft.slice(0, hash.start) + draft.slice(caret)); // drop the "#..." that was being typed
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  let placeholder = "Enter message";
  if (noting) placeholder = heldByOther ? `${c.assignee?.name} is handling this chat. Add a note for your team…` : "Write a note for your team…";

  return (
    <div className="cm">
      <div className="cm-inner">
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
                  focusAt(englishSource.length);
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
            data-lenis-prevent
            onChange={(e) => {
              setDraft(e.target.value);
              setCaret(e.target.selectionStart);
              setActive(0);
              if (!noting && mine && e.target.value) onTyping();
            }}
            onSelect={(e) => setCaret(e.target.selectionStart)}
            onKeyDown={onKeyDown}
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
                disabled={replying || busy || !draft.trim() || Boolean(englishSource)}
                title="Type in English, translate, check, then send"
                onClick={translate}
              >
                <Icon name="translate" />
                <span>{replying ? "Translating…" : `To ${language.name}`}</span>
              </button>
            )}
            <button
              type="button"
              className="cm-ic"
              data-pop
              disabled={notesOnly}
              aria-expanded={repliesOpen}
              title="Saved replies (type # in the box)"
              aria-label="Saved replies"
              onClick={() => setPop(pop === "canned" ? "" : "canned")}
            >
              <Icon name="hash" />
            </button>
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
            <button type="button" className="cm-ic" data-pop onClick={() => setPop(pop === "emoji" ? "" : "emoji")} aria-expanded={pop === "emoji"} title="Emoji" aria-label="Emoji">
              <Icon name="smile" />
            </button>
            <button
              type="button"
              className={`cm-ic${attaching ? " spin" : ""}`}
              disabled={notesOnly || busy || attaching}
              onClick={() => fileRef.current?.click()}
              title="Attach a file (PDF, JPG or PNG, up to 10 MB)"
              aria-label="Attach a file"
            >
              <Icon name="plus" />
            </button>
            <input ref={fileRef} type="file" hidden accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={attach} />
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
          {repliesOpen && (
            <div className="pop pop--canned" role="menu" aria-label="Saved replies" data-lenis-prevent>
              {replies.length === 0 && (
                <div className="pop-item" style={{ pointerEvents: "none" }}>
                  <b>No saved replies yet</b>
                  <span>A Super Admin adds them in AI agent settings.</span>
                </div>
              )}
              {replies.length > 0 && shown.length === 0 && (
                <div className="pop-item" style={{ pointerEvents: "none" }}>
                  <b>No saved reply matches “{hash?.filter}”</b>
                </div>
              )}
              {shown.map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  className={`pop-item${hashOpen && i === Math.min(active, shown.length - 1) ? " is-sel" : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickReply(r)}
                >
                  <b>{r.title}</b>
                  <span>{r.text.replaceAll("{agentName}", canned.agentName || "Support")}</span>
                </button>
              ))}
            </div>
          )}
          {pop === "emoji" && (
            <div className="pop pop--emoji">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="pop-em"
                  aria-label={`Insert ${emoji}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    insert(emoji);
                    setPop("");
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </form>
      </div>
    </div>
  );
});

export default Composer;
