import { useState } from "react";

// Right column: the patient panel (docs/chat-demo.html). Sections are collapsible and remember open/closed in this
// browser. Contact details, location and the chat itself come from the server; the page timeline is stored only
// for visitors who chat.
const KEY = "hcLiveChatPanelSections";
const defaultOpen = (key, hasName) => ({ qual: !hasName, ctx: false })[key] ?? true;

const initials = (name) =>
  String(name || "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function dur(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

function readSections() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function localTime(timeZone, now) {
  if (!timeZone) return "";
  try {
    const date = new Date(now);
    return `${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone })}, ${date.toLocaleDateString("en-US", { weekday: "short", timeZone })}`;
  } catch {
    return "";
  }
}

function Section({ id, title, badge, hasName, sections, onToggle, children }) {
  const open = sections[id] ?? defaultOpen(id, hasName);
  return (
    <details open={open} onToggle={(e) => e.currentTarget.open !== open && onToggle(id, e.currentTarget.open)}>
      <summary>
        <span>
          {title}
          {badge !== undefined && <small>{badge}</small>}
        </span>
      </summary>
      <div className="wk-dbody">{children}</div>
    </details>
  );
}

function ContactForm({ contact, onSave }) {
  const [values, setValues] = useState({ name: contact.name, phone: contact.phone, email: contact.email });
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);
  const change = (field) => (e) => {
    setSaved(false);
    setValues((v) => ({ ...v, [field]: e.target.value }));
  };
  return (
    <form
      className="wk-dbody-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const result = await onSave(values);
        setErrors(result.ok ? {} : result.errors || { form: "Could not save." });
        setSaved(result.ok);
      }}
    >
      <input placeholder="Name" value={values.name} onChange={change("name")} aria-label="Name" />
      <input placeholder="Phone" value={values.phone} onChange={change("phone")} aria-label="Phone" />
      <input placeholder="Email" type="email" value={values.email} onChange={change("email")} aria-label="Email" />
      {Object.values(errors).map((message) => (
        <span key={message} className="wk-field-error">
          {message}
        </span>
      ))}
      <button type="submit" className="wk-btn wk-btn--go">
        Save contact
      </button>
      {saved && <span className="wk-saved">Saved</span>}
    </form>
  );
}

function Tags({ tags, onSave }) {
  const [text, setText] = useState("");
  return (
    <>
      <div className="wk-tags">
        {tags.map((tag) => (
          <span key={tag} className="wk-ctag">
            {tag}
            <button type="button" aria-label={`Remove tag ${tag}`} onClick={() => onSave(tags.filter((t) => t !== tag))}>
              ×
            </button>
          </span>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const tag = text.trim();
          if (tag) onSave([...tags, tag]);
          setText("");
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="+ Add a tag (e.g. booking, refund)" maxLength={40} aria-label="Add a tag" />
      </form>
    </>
  );
}

export default function PatientPanel({ detail, now, onSaveContact, onSaveTags }) {
  const { conversation: c, panel: p } = detail;
  const [sections, setSections] = useState(readSections);
  const toggle = (id, open) =>
    setSections((current) => {
      const next = { ...current, [id]: open };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* remembering the layout is optional */
      }
      return next;
    });

  const hasName = Boolean(p.contact.name);
  const location = [p.location.city, p.location.state, p.location.country].filter(Boolean).join(", ");
  const closed = c.mode === "archived";
  const activity = !p.visit.online ? "Left the website" : c.mode === "queue" ? "Waiting for agent" : c.mode === "archived" ? "Chat ended" : "Chatting";
  const trackedPages = p.pages.length > 0;
  const startMs = new Date(p.info.liveStartedAt || p.info.startedAt).getTime();
  const endMs = closed && p.info.closedAt ? new Date(p.info.closedAt).getTime() : now;
  const sectionProps = { sections, onToggle: toggle, hasName };

  return (
    <aside className="wk-profile" aria-label="Patient">
      <div className="wk-phead">
        <span className={`wk-av wk-av--lg${hasName ? "" : " wk-av--anon"}`}>
          {hasName ? initials(p.contact.name) : "V"}
          <i className={p.visit.online ? "" : "is-gone"} />
        </span>
        <div>
          <b>{p.contact.name || c.ip || "Visitor"}</b>
          <small>{activity}</small>
        </div>
      </div>

      <ul className="wk-facts">
        <li>
          <span aria-hidden="true">✉</span>
          {p.contact.email ? <span className="wk-link">{p.contact.email}</span> : <span className="wk-add">No email yet</span>}
        </li>
        <li>
          <span aria-hidden="true">☎</span>
          {p.contact.phone ? <span className="wk-mono">{p.contact.phone}</span> : <span className="wk-add">No phone yet</span>}
        </li>
        <li>
          <span aria-hidden="true">📍</span>
          {location ? location : <span className="wk-add">Location unknown</span>}
        </li>
        {p.timeZone && (
          <li>
            <span aria-hidden="true">🕒</span>
            {localTime(p.timeZone, now)} (their time)
          </li>
        )}
      </ul>

      <div className="wk-schips">
        <span title="Chats">💬 {p.counts.chats}</span>
        <span title="Support tickets">🎫 {p.counts.tickets}</span>
        <span title="Visits">👁 {p.counts.visits}</span>
        <span className={p.returning ? "is-ret" : "is-first"}>{p.returning ? "Returning visitor" : "First visit"}</span>
      </div>

      <Section id="qual" title="Qualification" badge={hasName ? "Contact saved" : "Add contact"} {...sectionProps}>
        <ContactForm key={`${c.conversationId}:${p.contact.email}:${p.contact.name}`} contact={p.contact} onSave={onSaveContact} />
      </Section>

      <Section id="ctx" title="Customer context" {...sectionProps}>
        <dl className="wk-kv">
          <dt>Topic</dt>
          <dd>{p.context.topic || "–"}</dd>
          <dt>Source</dt>
          <dd>{p.context.source || "–"}</dd>
          <dt>Cookies</dt>
          <dd>{{ accepted: "Accepted", declined: "Declined" }[p.context.cookieChoice] || "Not answered"}</dd>
        </dl>
        <div className="wk-aisum">{p.context.summary}</div>
      </Section>

      <Section id="info" title="Chat info" {...sectionProps}>
        <dl className="wk-kv">
          <dt>Assignee</dt>
          <dd>{p.info.assignee ? p.info.assignee.name : c.mode === "ai" ? "AI agent" : "Nobody yet (queue)"}</dd>
          <dt>Chat ID</dt>
          <dd className="wk-mono">{p.info.chatId}</dd>
          <dt>{p.info.liveStartedAt ? "Live duration" : "Duration"}</dt>
          <dd className="wk-mono">{dur((endMs - startMs) / 1000)}</dd>
          {(closed || p.info.rating) && (
            <>
              <dt>Rating</dt>
              <dd>{p.info.rating ? <span className="wk-rating">{"★".repeat(p.info.rating.stars)}{"☆".repeat(5 - p.info.rating.stars)}</span> : "Not rated"}</dd>
            </>
          )}
          <dt>Started on</dt>
          <dd className="wk-link">{p.info.startedPage.path ? `…humancareconnect.co${p.info.startedPage.path}` : "–"}</dd>
        </dl>
      </Section>

      <Section id="tags" title="Chat tags" {...sectionProps}>
        <Tags tags={p.tags} onSave={onSaveTags} />
      </Section>

      <Section id="recent" title="Recent conversations" {...sectionProps}>
        {p.recent.length ? (
          <ul className="wk-pages">
            {p.recent.map((r) => (
              <li key={r.conversationId}>
                <span>
                  {r.topic || "Chat"}
                  <br />
                  <small className="wk-muted">{r.status}</small>
                </span>
                <span className="wk-mono">{new Date(r.startedAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="wk-muted">No earlier conversations</span>
        )}
      </Section>

      <Section id="pages" title="Visited pages" badge={p.pages.length} {...sectionProps}>
        {trackedPages ? (
          <ol className="wk-tl">
            {[...p.pages].reverse().map((page, i) => (
              <li key={`${page.enteredAt}-${page.path}`} className={page.current ? "is-cur" : ""}>
                <b title={page.title}>{page.title || page.path}</b>
                <span className="wk-link">humancareconnect.co{page.path === "/" ? "" : page.path}</span>
                <span className="wk-mono">{dur(page.current && i === 0 ? page.seconds + Math.max(0, (now - detail.fetchedAt) / 1000) : page.seconds)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="wk-note-line">Not tracked. This visitor has not accepted cookies, so only the chat is recorded.</div>
        )}
      </Section>

      <Section id="visit" title="Visit info" {...sectionProps}>
        <dl className="wk-kv">
          <dt>Device</dt>
          <dd>
            {p.visit.device === "Mobile" ? "📱" : "🖥"} {[p.visit.device, p.visit.os, p.visit.browser].filter(Boolean).join(" · ") || "–"}
          </dd>
          <dt>Referring page</dt>
          <dd>{p.visit.referrer || "Direct"}</dd>
          <dt>Visit duration</dt>
          <dd className="wk-mono">{p.visit.online ? dur((now - new Date(p.visit.joinedAt).getTime()) / 1000) : "–"}</dd>
          <dt>IP</dt>
          <dd className="wk-mono">{p.visit.ip || "–"}</dd>
          <dt>Location</dt>
          <dd>{location || "–"}</dd>
        </dl>
      </Section>
    </aside>
  );
}
