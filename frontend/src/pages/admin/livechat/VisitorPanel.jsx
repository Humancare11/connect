import { useEffect, useRef, useState } from "react";
import api from "../../../api";
import Icon from "./lcIcons";
import { ACTIVITY, avatarColor, displayName, duration, flag, initials, localTime } from "./visitorUtils";

// Right-hand panel of Real-time visitors: who the visitor is, where they are, and what they did. Live facts (pages,
// device, time on site) come from the shared connection; contact, counts and recent chats from /visitors/:id/panel.
const BASE = "/api/admin/livechat";

const WindowsLogo = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
    <path fill="#4aa3ff" d="M0 1.9 5.7 1v5.2H0zM6.5 .9 14 0v6.2H6.5zM0 7h5.7v5.2L0 11.3zM6.5 7H14v7l-7.5-1z" />
  </svg>
);
const BrowserLogo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="#e8453c" />
    <path d="M12 12 3.5 7a10 10 0 0 1 17 0z" fill="#f5c518" />
    <path d="M12 12l-4.3 7.4A10 10 0 0 1 3.5 7z" fill="#34a853" />
    <circle cx="12" cy="12" r="4.2" fill="#fff" />
    <circle cx="12" cy="12" r="3" fill="#4285f4" />
  </svg>
);

function Section({ id, title, open, onToggle, badge, children }) {
  return (
    <details open={open} onToggle={(e) => onToggle(id, e.currentTarget.open)}>
      <summary>
        <span>
          {title}
          {badge ? (
            <small className="rt-pill" style={{ marginLeft: 8 }}>
              {badge}
            </small>
          ) : null}
        </span>
      </summary>
      <div className="wk-dbody">{children}</div>
    </details>
  );
}

export default function VisitorPanel({ visitor, now, serverNow, onHide, onBlock, focusContact, onFocused, onContactSaved }) {
  const [data, setData] = useState(null);
  const [facts, setFacts] = useState(true);
  const [sections, setSections] = useState({});
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef(null);
  const visitorId = visitor?.visitorId || "";
  const hasChat = Boolean(visitor?.conversationId);

  // Reload when another visitor is picked, or when this one starts a chat (counts and recent chats change).
  useEffect(() => {
    if (!visitorId) return undefined;
    let cancelled = false;
    setData(null);
    setErrors({});
    setSaved(false);
    api
      .get(`${BASE}/visitors/${visitorId}/panel`)
      .then(({ data: body }) => {
        if (cancelled) return;
        setData(body.panel);
        setForm({ name: body.panel.contact.name, phone: body.panel.contact.phone, email: body.panel.contact.email });
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [visitorId, hasChat]);

  // The pencil in the table opens Qualification and puts the cursor in the first field.
  useEffect(() => {
    if (!focusContact || !visitorId) return;
    setSections((s) => ({ ...s, qual: true }));
    window.setTimeout(() => nameRef.current?.focus(), 30);
    onFocused();
  }, [focusContact, visitorId, onFocused]);

  const toggle = (id, open) => setSections((s) => (s[id] === open ? s : { ...s, [id]: open }));
  const isOpen = (id, fallback) => sections[id] ?? fallback;

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    setSaved(false);
    try {
      await api.put(`${BASE}/visitors/${visitorId}/contact`, form);
      setSaved(true);
      setData((d) => (d ? { ...d, contact: { ...form } } : d));
      onContactSaved?.();
    } catch (err) {
      const body = err?.response?.data || {};
      setErrors(body.errors || { form: "Could not save the contact details." });
    } finally {
      setSaving(false);
    }
  };

  const tabs = (
    <div className="rt-ptabs">
      <button type="button" className="rt-ptab is-on" aria-label="Patient details" title="Patient details">
        <Icon name="user" size={20} />
      </button>
      <span className="sp" />
      <button type="button" className="rt-ptab" onClick={onHide} aria-label="Hide patient details" title="Hide patient details">
        <Icon name="panel" size={18} />
      </button>
    </div>
  );

  if (!visitor) {
    return (
      <>
        {tabs}
        <div className="wk-empty">Pick a patient in the list</div>
      </>
    );
  }

  const geo = visitor.geo || {};
  const location = [geo.city, geo.state, geo.country].filter(Boolean).join(", ") || [data?.location.city, data?.location.state, data?.location.country].filter(Boolean).join(", ");
  const local = localTime(data?.timeZone, now);
  const contact = data?.contact || { name: visitor.name || "", email: visitor.email || "", phone: "" };
  const hasName = Boolean(contact.name || contact.email);
  const pages = visitor.pages || [];
  const device = visitor.device || "";
  const os = visitor.os || "";
  const secondsOnSite = (serverNow - visitor.joinedAt) / 1000;

  return (
    <>
      {tabs}
      <div className="rt-phead">
        <span className="wk-av wk-av--lg" style={{ background: avatarColor(visitor), color: "#fff" }}>
          {visitor.name ? initials(visitor.name) : "P"}
          <i />
        </span>
        <div className="tx">
          <b>{contact.name || displayName(visitor)}</b>
          <small>{ACTIVITY[visitor.activity] || "Browsing"}</small>
        </div>
        <button
          type="button"
          className={`rt-chev${facts ? "" : " is-closed"}`}
          onClick={() => setFacts(!facts)}
          aria-expanded={facts}
          aria-label="Show or hide basic details"
        >
          <Icon name="chevD" size={18} />
        </button>
      </div>
      {facts && (
        <ul className="wk-facts">
          <li>
            <Icon name="mail" size={16} />
            {contact.email ? <span>{contact.email}</span> : <span>No email</span>}
          </li>
          <li>
            <Icon name="phone" size={16} />
            {contact.phone ? <span className="wk-mono">{contact.phone}</span> : <span>No phone number</span>}
          </li>
          <li>
            <Icon name="pin" size={16} />
            {location ? (
              <span>
                {location} {flag(geo.countryCode || data?.location.countryCode)}
              </span>
            ) : (
              <span className="wk-add">Location unknown</span>
            )}
          </li>
          {local && (
            <li>
              <Icon name={local.night ? "moon" : "sun"} size={16} />
              <span>{local.text} (their time)</span>
            </li>
          )}
        </ul>
      )}
      <div className="wk-schips">
        <span title="Chats">
          <Icon name="chat" size={14} /> {data?.counts.chats ?? 0}
        </span>
        <span title="Support tickets">
          <Icon name="ticket" size={14} /> {data?.counts.tickets ?? 0}
        </span>
        <span title="Visits">
          <Icon name="globe" size={14} /> {data?.counts.visits ?? 1}
        </span>
        <span className={data?.returning ? "is-ret" : "is-first"}>{data?.returning ? "Returning visit" : "First visit"}</span>
      </div>

      <Section id="qual" title="Qualification" open={isOpen("qual", false)} onToggle={toggle} badge={hasName ? "Contact saved" : "Add contact"}>
        <form className="wk-dbody-form" onSubmit={save}>
          <input ref={nameRef} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Name" />
          <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} aria-label="Phone" />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            aria-label="Email"
          />
          {Object.values(errors).map((message) => (
            <span key={message} className="wk-field-error">
              {message}
            </span>
          ))}
          <button type="submit" className="wk-btn wk-btn--go" disabled={saving}>
            {saving ? "Saving…" : "Save contact"}
          </button>
          {saved && <span className="wk-saved">Saved</span>}
        </form>
      </Section>

      <Section id="pages" title="Visited pages" open={isOpen("pages", true)} onToggle={toggle} badge={String(pages.length)}>
        {pages.length === 0 ? (
          <span className="wk-muted">No pages tracked</span>
        ) : (
          [...pages].reverse().map((page, index) => (
            <div className="rt-pg" key={`${page.path}-${page.enteredAt}`}>
              <i style={index === 0 ? undefined : { background: "var(--line-2)" }} />
              <div>
                <b>{page.title || page.path}</b>
                <small className="wk-mono">
                  {duration(index === 0 ? (serverNow - page.enteredAt) / 1000 : page.seconds || 0)}
                </small>
              </div>
            </div>
          ))
        )}
      </Section>

      <Section id="recent" title="Recent conversations" open={isOpen("recent", true)} onToggle={toggle}>
        {data?.recent?.length ? (
          <ul className="wk-pages">
            {data.recent.map((chat) => (
              <li key={chat.conversationId}>
                <span>
                  {chat.topic || "Chat"}
                  <br />
                  <small className="wk-muted">{chat.status}</small>
                </span>
                <span className="wk-mono">{chat.conversationId}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="wk-muted">No recent conversations</span>
        )}
      </Section>

      <Section id="visit" title="Visit info" open={isOpen("visit", true)} onToggle={toggle}>
        <dl className="wk-kv">
          <dt>Device</dt>
          <dd className="rt-devs">
            <span className="rt-dev" title={device || "Device"}>
              <Icon name={device === "Mobile" ? "mobile" : "monitor"} size={15} />
            </span>
            <span className="rt-dev" title={os || "System"}>
              {os === "Windows" ? <WindowsLogo /> : (os || "?")[0]}
            </span>
            <span className="rt-dev" title={visitor.browser || "Browser"}>
              <BrowserLogo />
            </span>
          </dd>
          <dt>Referring page</dt>
          <dd>{!visitor.source || visitor.source === "Direct" ? "-" : visitor.source}</dd>
          <dt>Visit duration</dt>
          <dd className="wk-mono">{duration(secondsOnSite)}</dd>
          <dt>IP</dt>
          <dd className="wk-mono">{visitor.ip}</dd>
        </dl>
        <button type="button" className="wk-btn rt-danger" onClick={() => onBlock(visitor)}>
          Block IP
        </button>
      </Section>
    </>
  );
}
