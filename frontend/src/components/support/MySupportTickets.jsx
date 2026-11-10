// "My Support Tickets": raise a ticket, follow the conversation with support and reply.
// Shared by the patient (/user/raise-ticket) and doctor (/doctor-dashboard/raise-ticket) pages;
// only the endpoints and the category list differ. Times are always shown in the viewer's own
// timezone, and users can never close a ticket (only support does).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../../api";
import { browserTimeZone, formatTicketClock, formatTicketDate, formatTicketDateTime } from "../../utils/ticketTime";
import "./MySupportTickets.css";

// authRole picks the right sign-in (a browser can hold a patient, doctor and admin session at once).
const ENDPOINTS = {
  patient: { authRole: "user",   list: "/api/tickets/user/my", create: "/api/tickets/user/create", reply: (id) => `/api/tickets/user/${id}/reply` },
  doctor:  { authRole: "doctor", list: "/api/tickets/my",      create: "/api/tickets/create",      reply: (id) => `/api/tickets/${id}/reply` },
};

const MAX_REPLY = 2000;

function Thread({ ticket, endpoints, onUpdated, onError }) {
  const closed = ticket.status === "resolved";
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await api.post(endpoints.reply(ticket._id), { text: body }, { authRole: endpoints.authRole });
      setText("");
      onUpdated(res.data.ticket);
    } catch (err) {
      if (err.response?.status === 409) {
        // Support closed it while the box was open: show the closed state instead of a dead reply box.
        onError("This ticket has just been closed. Please raise a new ticket if you still need help.", true);
      } else {
        onError(err.response?.data?.message || "Could not send your message. Please try again.");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mst-detail" id={`mst-body-${ticket._id}`}>
      <div className="mst-thread">
        {ticket.messages.map((m, i) => (
          <div key={m._id || i} className={`mst-msg ${m.sender === "user" ? "mst-msg--mine" : "mst-msg--them"}`}>
            <div className="mst-msg__by">
              {m.sender === "user" ? "You" : "Humancare Support"} · {formatTicketDateTime(m.createdAt)}
            </div>
            <div className="mst-msg__text">{m.text}</div>
          </div>
        ))}
      </div>

      {closed ? (
        <div className="mst-closed">
          This ticket was closed by support on {formatTicketDateTime(ticket.closedAt)}. Raise a new ticket if you still need help.
        </div>
      ) : (
        <form className="mst-reply" onSubmit={send}>
          <textarea
            aria-label="Write a message to support"
            value={text}
            maxLength={MAX_REPLY}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message to support…"
          />
          <button className="mst-btn" type="submit" disabled={!text.trim() || sending}>
            {sending ? "Sending…" : "Send"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function MySupportTickets({ role, categories, onCreated }) {
  const endpoints = ENDPOINTS[role];
  const location = useLocation();
  const [tickets, setTickets] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(categories[categories.length - 1].value);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hint, setHint] = useState("");
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg, ok = true) => {
    setToast({ msg, ok });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const activityId = useMemo(() => new URLSearchParams(location.search).get("activityId") || "", [location.search]);

  // Which ticket to show first: the one a dashboard link points at, else the latest open one.
  const applyList = useCallback((list, pickFirst) => {
    setTickets(list);
    if (!pickFirst) return;
    const target = activityId && list.find((t) => t._id === activityId);
    const start = target || list.find((t) => t.status === "open");
    if (start) setOpenId(start._id);
  }, [activityId]);

  useEffect(() => {
    let alive = true;
    api.get(endpoints.list, { authRole: endpoints.authRole })
      .then((res) => { if (alive) applyList(Array.isArray(res.data) ? res.data : [], true); })
      .catch((err) => console.error("Failed to load tickets", err))
      .finally(() => { if (alive) setFetching(false); });
    return () => { alive = false; };
  }, [endpoints.list, endpoints.authRole, applyList]);

  // Refresh after submitting a ticket, or after support closed one while it was open on screen.
  const reload = useCallback(async () => {
    try {
      const res = await api.get(endpoints.list, { authRole: endpoints.authRole });
      applyList(Array.isArray(res.data) ? res.data : [], false);
    } catch (err) {
      console.error("Failed to load tickets", err);
    }
  }, [endpoints.list, endpoints.authRole, applyList]);

  // A link from the dashboard (?activityId=) scrolls to that ticket (it is opened by the load above).
  useEffect(() => {
    if (!activityId || !tickets.some((t) => t._id === activityId)) return;
    const timer = setTimeout(() => document.getElementById(`mst-ticket-${activityId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 40);
    return () => clearTimeout(timer);
  }, [activityId, tickets]);

  const replaceTicket = (updated) => setTickets((list) => list.map((t) => (t._id === updated._id ? updated : t)));
  const failed = (message, again) => { showToast(message, false); if (again) reload(); };

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await api.post(endpoints.create, {
        title: title.trim(),
        description: description.trim(),
        category,
        userTimezone: browserTimeZone(),
      }, { authRole: endpoints.authRole });
      const created = res.data?.ticket;
      setTitle("");
      setDescription("");
      setCategory(categories[categories.length - 1].value);
      setHint(`Ticket ${created?.ref || ""} submitted. Support will reply here.`.replace("  ", " "));
      if (created?._id) setOpenId(created._id);
      if (onCreated) onCreated(created);
      await reload();
    } catch (err) {
      showToast(err.response?.data?.message || "Something went wrong. Please try again.", false);
    } finally {
      setSubmitting(false);
    }
  };

  const labelFor = (value) => categories.find((c) => c.value === value)?.label || "Other";

  return (
    <div className="mst-root">
      {toast && (
        <div className={`mst-toast ${toast.ok ? "mst-toast--ok" : "mst-toast--err"}`} role="status">
          <span aria-hidden="true">{toast.ok ? "✓" : "!"}</span> {toast.msg}
        </div>
      )}

      <header className="mst-head">
        <span className="mst-eyebrow">Help &amp; Support</span>
        <h1 className="mst-title">My Support Tickets</h1>
        <p className="mst-sub">Raise an issue and chat with our support team until it&apos;s resolved.</p>
      </header>

      <form className="mst-new" onSubmit={submit}>
        <h2 className="mst-new__title">Raise a ticket</h2>
        <input
          aria-label="Subject"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Subject, e.g. Reports not received"
          maxLength={120}
          required
        />
        <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <textarea
          aria-label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 500))}
          placeholder="Describe your issue"
          required
        />
        <div className="mst-new__act">
          <button className="mst-btn" type="submit" disabled={submitting || !title.trim() || !description.trim()}>
            {submitting ? "Submitting…" : "Submit ticket"}
          </button>
          <span className="mst-hint" aria-live="polite">{hint || `Our support team will reply here. ${description.length}/500`}</span>
        </div>
      </form>

      <div className="mst-list">
        {fetching ? (
          <div className="mst-empty">Loading your tickets…</div>
        ) : tickets.length === 0 ? (
          <div className="mst-empty">You haven&apos;t raised any tickets yet.</div>
        ) : tickets.map((t) => {
          const open = openId === t._id;
          const closed = t.status === "resolved";
          const last = t.messages[t.messages.length - 1];
          const hasReply = !closed && last?.sender === "admin";
          const toggle = () => setOpenId(open ? null : t._id);
          return (
            <div key={t._id} id={`mst-ticket-${t._id}`} className={`mst-ticket${open ? " mst-ticket--open" : ""}`}>
              <div
                className="mst-row"
                role="button"
                tabIndex={0}
                aria-expanded={open}
                aria-controls={open ? `mst-body-${t._id}` : undefined}
                onClick={toggle}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
                }}
              >
                <div className={`mst-av${closed ? " mst-av--done" : ""}`} aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z" /><path d="M9 7v10" />
                  </svg>
                </div>
                <div className="mst-meta">
                  <div className="mst-ticket__title">{t.title}</div>
                  <div className="mst-ticket__sub">{t.ref} <span className="mst-chip">{labelFor(t.category)}</span></div>
                </div>
                <div className="mst-right">
                  {hasReply && <span className="mst-newreply">New reply</span>}
                  <span className="mst-date">
                    {formatTicketDate(t.createdAt)}
                    <small>{formatTicketClock(t.createdAt)}</small>
                  </span>
                  <span className={`mst-status mst-status--${closed ? "resolved" : "open"}`}>{closed ? "Resolved" : "Open"}</span>
                  <span className={`mst-chev${open ? " mst-chev--open" : ""}`} aria-hidden="true">⌄</span>
                </div>
              </div>
              {open && <Thread ticket={t} endpoints={endpoints} onUpdated={replaceTicket} onError={failed} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
