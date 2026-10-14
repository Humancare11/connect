import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Icon from "./lcIcons";
import Composer from "./Composer";
import LanguageSwitch from "./LanguageSwitch";
import DeleteChatsDialog from "./DeleteChatsDialog";
import { dayWord, sizeOf, stamp, timeOf } from "./chatUtils";
import { initials } from "./visitorUtils";
import { DEFAULT_AI_NAME } from "../../../features/livechat/aiName";

// Middle column: the conversation (docs/live-chat-admin-ui.html). The patient is on the left; the AI and agents are on
// the right with their name above a run of messages; system lines sit at the right edge; internal notes are full width
// and never reach the patient. Typing shows "typing…" only, never the draft.
const fileKind = (mime) => (mime === "application/pdf" ? "PDF" : mime === "image/png" ? "PNG" : mime === "image/jpeg" ? "JPG" : "File");

// Messages from the same sender in a row share one label and avatar.
const groupKey = (m) => (!m ? "" : m.sender === "patient" ? "p" : m.sender === "ai" ? "ai" : m.sender === "agent" ? `a:${m.agentName || ""}` : "");

// translation: { text, from, fromName } for the English view (or null); shownOriginal: the admin switched this one
// message back to its original.
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
            Show English
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
          Show original
        </button>
      </span>
    </>
  );
}

function FileLine({ file, onOpenFile }) {
  return (
    <span className="wk-file">
      <Icon name="file" size={18} />
      <span className="wk-file-name">
        {file.name}
        <small>
          {" "}
          · {sizeOf(file.size)} · {fileKind(file.mime)}
        </small>
      </span>
      <button type="button" className="wk-btn" onClick={() => onOpenFile(file)}>
        Open
      </button>
    </span>
  );
}

function Message({ m, first, c, aiName, onOpenFile, translation, shownOriginal, onToggleOriginal }) {
  if (m.sender === "system") {
    return (
      <div className="mrow sysrow">
        <div className="wk-sys">
          <TranslatedText text={m.text} translation={translation} shownOriginal={shownOriginal} onToggleOriginal={onToggleOriginal} /> · {timeOf(m.at)}
          {m.internal ? " · team only" : ""}
        </div>
      </div>
    );
  }
  if (m.sender === "note") {
    return (
      <div className="mrow is-first">
        <div className="wk-msg wk-note">
          <span className="wk-txt">
            <b>Internal note:</b> {m.text}
          </span>
          <span className="wk-meta">
            Team only · {m.agentName ? `${m.agentName} · ` : ""}
            {timeOf(m.at)}
          </span>
        </div>
      </div>
    );
  }
  const body = m.file ? (
    <FileLine file={m.file} onOpenFile={onOpenFile} />
  ) : (
    <TranslatedText text={m.text} translation={translation} shownOriginal={shownOriginal} onToggleOriginal={onToggleOriginal} />
  );
  if (m.sender === "patient") {
    const name = c.name || c.ip || "Patient";
    return (
      <div className={`mrow${first ? " is-first" : ""}`}>
        {first ? <span className={`wk-av sm${c.name ? "" : " wk-av--anon"}`}>{c.name ? initials(c.name) : "P"}</span> : <span className="mg-sp" />}
        <div className="mcol">
          {first && <span className="mlabel">{name}</span>}
          <div className="wk-msg wk-left">
            <span className="wk-txt">{body}</span>
            <span className="wk-meta">{stamp(m.at)}</span>
          </div>
        </div>
      </div>
    );
  }
  const ai = m.sender === "ai";
  const label = ai ? aiName : m.agentName || "Agent";
  return (
    <div className={`mrow right${first ? " is-first" : ""}`}>
      <div className="mcol">
        {first && <span className="mlabel">{label}</span>}
        <div className={`wk-msg wk-right${ai ? " wk-ai" : ""}`}>
          <span className="wk-txt">
            {body}
            {m.sourceText ? (
              <span className="wk-source">
                Your English: {m.sourceText}
                {c.language ? ` (sent in ${c.language.name})` : ""}
              </span>
            ) : null}
          </span>
          <span className="wk-meta">{stamp(m.at)}</span>
        </div>
      </div>
      {first ? <span className={`wk-av sm ${ai ? "ai" : "me"}`}>{ai ? "AI" : initials(m.agentName || "Agent")}</span> : <span className="mg-sp" />}
    </div>
  );
}

export default function ChatConversation({
  readOnly = false, // the Archive page: no reply, note, take over, hand back, resolve or block
  detail,
  me,
  role,
  typing,
  canned,
  busy,
  error,
  panelOpen,
  onTogglePanel,
  onTakeOver,
  onHandBack,
  onResolve,
  onSend,
  onNote,
  onSuggest,
  onTyping,
  onOpenFile,
  onBlockIp,
  onDetect, // retry the language detection: async, returns { language, reason }
  onDelete, // Super Admin: delete an archived chat (to Trash); async, returns { ok, error }
  onDownload,
  onSendFile,
  onTranslate,
  onTranslateReply,
  onSetView,
}) {
  const { conversation: c, messages } = detail;
  const bodyRef = useRef(null);
  const composerRef = useRef(null);
  const [menu, setMenu] = useState(""); // "" or "more"
  const [info, setInfo] = useState("");

  // Translation (this admin only; the patient never sees any of it)
  const [detected, setDetected] = useState(null); // a language found by the "Detect language" link
  const language = c.language || detected || null; // { code, name } for non-English chats
  // Only for a chat whose language is really unknown (the server says so: nothing stored, and non-English-looking text).
  const canDetect = !language && c.languageUnknown === true;
  const runDetect = async () => {
    const res = onDetect ? await onDetect() : null;
    if (res?.language) setDetected(res.language);
    return res || { language: null, reason: "failed" };
  };
  const [view, setView] = useState(detail.view === "en" ? "en" : "original");
  const [translations, setTranslations] = useState({}); // messageId -> { text, from, fromName }
  const [originals, setOriginals] = useState(() => new Set()); // messages switched back to the original
  const [translating, setTranslating] = useState(false);
  const [transError, setTransError] = useState("");
  const asked = useRef(new Set()); // message ids already sent for translation
  const mounted = useRef(true);

  const archived = c.mode === "archived";
  // An archived chat that went there from the Queue today can still be joined or replied to from Archive temp.
  const closed = archived && !c.joinable;
  const mine = c.assignee?.id === me;
  const heldByOther = c.mode === "live" && !mine;
  const superadmin = role === "superadmin";
  const canDelete = superadmin && archived && typeof onDelete === "function";
  const showMore = (Boolean(c.ip) && !readOnly) || canDelete;
  const [deleting, setDeleting] = useState(null); // null, or { busy, error }
  const canTakeOver = !readOnly && !closed && (c.mode === "ai" || c.mode === "queue" || archived || (heldByOther && superadmin));
  const canHandBack = !readOnly && c.mode === "live" && (mine || superadmin);
  const canResolve = !readOnly && !closed && !archived && (!heldByOther || superadmin);
  // Only the assignee replies; everyone else (and everyone on a closed chat) can still leave internal notes.
  const notesOnly = closed || heldByOther;

  // New messages scroll into view only while the admin is at the bottom (within 80px), after they send something, or
  // when the chat opens. While they read older messages the view stays put and "New messages" offers a jump.
  const atBottom = useRef(true);
  const forceBottom = useRef(true); // true on open: the first render goes to the newest message
  const seenCount = useRef(0);
  const [unseen, setUnseen] = useState(0);
  const onBodyScroll = () => {
    const el = bodyRef.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottom.current) setUnseen(0);
  };
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const added = Math.max(0, messages.length - seenCount.current);
    seenCount.current = messages.length;
    if (forceBottom.current || atBottom.current) {
      el.scrollTop = el.scrollHeight;
      forceBottom.current = false;
      atBottom.current = true;
      if (added) Promise.resolve().then(() => setUnseen(0));
    } else if (added) {
      Promise.resolve().then(() => setUnseen((n) => n + added));
    }
  }, [messages.length, typing]);
  const jumpToNewest = () => {
    const el = bodyRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setUnseen(0);
  };
  // Whatever the admin sends, they want to see.
  const andScroll = (fn) => async (...args) => {
    forceBottom.current = true;
    const ok = await fn(...args);
    if (!ok) forceBottom.current = false;
    return ok;
  };

  // The more menu closes on an outside click or Escape.
  useEffect(() => {
    if (!menu) return undefined;
    const close = (event) => {
      if (event.type === "keydown" ? event.key === "Escape" : !event.target.closest?.(".pop, [data-more]")) setMenu("");
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);

  const englishView = Boolean(language) && view === "en";
  // English view: translate what is not translated yet, and every new patient message as it arrives.
  useEffect(() => {
    if (!englishView) return undefined;
    const wanted = messages.filter(
      (m) => ["patient", "ai", "agent", "system"].includes(m.sender) && !m.internal && !m.file && m.text && !m.translation && !asked.current.has(m.id)
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
      (res.data.failed || []).forEach((id) => asked.current.delete(id)); // asked again the next time
      setTransError(res.data.failed?.length ? "Some messages could not be translated right now" : "");
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

  // The link opens this chat in the Live Chat tab for anyone signed in as an admin.
  const copyLink = async () => {
    const url = `${window.location.origin}/admin-dashboard/live-chat/${c.everLive ? "agent-chats" : "ai-chats"}/${c.conversationId}`;
    try {
      await navigator.clipboard.writeText(url);
      setInfo("Chat link copied");
    } catch {
      setInfo(`Chat link: ${url}`);
    }
  };

  const startedAt = detail.panel?.info?.startedAt || c.startedAt;
  const heading = c.name || c.ip || "Visitor";

  return (
    <div className="wk-chat">
      <div className="wk-head">
        <div className="wk-head-t">
          <strong>{heading}</strong>
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
          {!readOnly && (
            <button type="button" className="hic" onClick={() => composerRef.current?.startNote()} title="Add an internal note" aria-label="Add an internal note">
              <Icon name="note" />
            </button>
          )}
          <button type="button" className="hic" onClick={onDownload} title="Download transcript" aria-label="Download transcript">
            <Icon name="download" />
          </button>
          <button type="button" className="hic" onClick={copyLink} title="Copy chat link" aria-label="Copy chat link">
            <Icon name="link" />
          </button>
          <button type="button" className="hic pn" onClick={onTogglePanel} aria-pressed={panelOpen} title="Show or hide patient details" aria-label="Toggle patient details">
            <Icon name="panel" />
          </button>
          {showMore && (
            <button type="button" className="hic" data-more onClick={() => setMenu(menu === "more" ? "" : "more")} title="More" aria-label="More actions" aria-expanded={menu === "more"}>
              <Icon name="dots" />
            </button>
          )}
          {menu === "more" && showMore && (
            <div className="pop pop--more" role="menu">
              {c.ip && !readOnly && (
                <button
                  type="button"
                  className="pop-item danger"
                  disabled={busy}
                  onClick={() => {
                    setMenu("");
                    onBlockIp();
                  }}
                >
                  <b>Block IP {c.ip}</b>
                  <span>Closes its chats</span>
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  className="pop-item danger"
                  onClick={() => {
                    setMenu("");
                    setDeleting({ busy: false, error: "" });
                  }}
                >
                  <b>Delete chat</b>
                  <span>Moves it to Trash for 30 days</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {error || transError ? (
        <div className="wk-error" role="alert">
          {error || transError}
        </div>
      ) : info ? (
        <div className="wk-info" role="status">
          {info}
        </div>
      ) : null}

      <div className="wk-bodywrap">
      <div className="wk-body" ref={bodyRef} onScroll={onBodyScroll} data-lenis-prevent>
        <div className="divider">
          <span>
            Started · {dayWord(startedAt)} {timeOf(startedAt)}
          </span>
        </div>
        {messages.map((m, i) => (
          <Message
            key={m.id}
            m={m}
            first={!groupKey(m) || groupKey(m) !== groupKey(messages[i - 1])}
            c={c}
            aiName={detail.aiName || DEFAULT_AI_NAME}
            onOpenFile={onOpenFile}
            translation={translationOf(m)}
            shownOriginal={originals.has(m.id)}
            onToggleOriginal={() => toggleOriginal(m.id)}
          />
        ))}
        {typing && (
          <div className="wk-typing">
            <span className="wk-dots">
              <i />
              <i />
              <i />
            </span>{" "}
            {heading} is typing…
          </div>
        )}
      </div>
      {unseen > 0 && (
        <button type="button" className="wk-jump" onClick={jumpToNewest}>
          ↓ New messages
        </button>
      )}
      </div>

      {readOnly ? (
        <div className="wk-readonly">
          <span>Read-only: this chat is in the Archive.</span>
          {language && <LanguageSwitch view={view} onChoose={chooseView} translating={translating} />}
        </div>
      ) : (
      <Composer
        ref={composerRef}
        conversation={c}
        notesOnly={notesOnly}
        heldByOther={heldByOther}
        mine={mine}
        closed={closed}
        busy={busy}
        canned={canned}
        language={language}
        canDetect={canDetect}
        onDetect={onDetect ? runDetect : undefined}
        view={view}
        onChooseView={chooseView}
        translating={translating}
        onSend={andScroll(onSend)}
        onNote={andScroll(onNote)}
        onSuggest={onSuggest}
        onTranslateReply={onTranslateReply}
        onAttach={andScroll(onSendFile)}
        onTyping={onTyping}
        onNotice={setTransError}
      />
      )}
      {deleting && (
        <DeleteChatsDialog
          title="Delete chat"
          count={1}
          countLabel="will be moved to Trash"
          description="It disappears from the lists, Archive and reports, and the patient cannot reopen it. You can restore it from Trash for 30 days."
          confirmLabel="Move to Trash"
          busy={deleting.busy}
          error={deleting.error}
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            setDeleting({ busy: true, error: "" });
            const r = await onDelete();
            if (mounted.current && r && r.ok === false) setDeleting({ busy: false, error: r.error || "Could not delete this chat." });
          }}
        />
      )}
    </div>
  );
}
