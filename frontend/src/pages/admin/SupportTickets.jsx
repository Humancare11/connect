import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api";
import { ticketTabFromQuery } from "./adminNotificationLinks";
import { ADMIN_TIMEZONE, formatTicketClock, formatTicketDate, formatTicketDateTime, zoneLabel } from "../../utils/ticketTime";
import "./SupportTickets.css";

const CATEGORY_LABELS = {
  appointment: "Appointment",
  billing:     "Billing",
  technical:   "Technical",
  medical:     "Medical",
  payments:    "Payments",
  profile:     "Profile",
  account:     "Account",
  other:       "Other",
};

const MAX_REPLY = 2000;
const AS_ADMIN = { authRole: "admin" };

// Doctor tickets and patient tickets live in separate collections, so their routes differ by this prefix.
const base = (kind) => (kind === "patient" ? "/api/tickets/user" : "/api/tickets");

function TicketDetail({ ticket, kind, onChanged, onError }) {
  const closed = ticket.status === "resolved";
  const who = kind === "patient" ? "Patient" : "Doctor";
  const raiserName = ticket.createdBy?.name || who;
  const messages = ticket.messages || [];

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [closing, setClosing] = useState(false);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await api.post(`${base(kind)}/${ticket._id}/admin-reply`, { text: body }, AS_ADMIN);
      setText("");
      onChanged(res.data.ticket);
    } catch (err) {
      if (err.response?.status === 409) onError("This ticket was already closed.", true);
      else onError(err.response?.data?.message || "Could not send the reply.");
    } finally {
      setSending(false);
    }
  };

  const close = async () => {
    if (closing) return;
    setClosing(true);
    try {
      const res = await api.put(`${base(kind)}/${ticket._id}/close`, null, AS_ADMIN);
      setConfirming(false);
      onChanged(res.data.ticket, "Ticket closed.");
    } catch (err) {
      if (err.response?.status === 409) onError("This ticket was already closed.", true);
      else onError(err.response?.data?.message || "Could not close the ticket.");
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="st-ticket__body" id={`st-body-${ticket._id}`}>
      <div className="st-dhead">
        <span className="st-ref">
          {ticket.ref} · {messages.length} message{messages.length === 1 ? "" : "s"}
        </span>
        {!closed && (confirming ? (
          <div className="st-confirm" role="group" aria-label="Confirm closing this ticket">
            <span>Close this ticket? The {kind} won&apos;t be able to reply after this.</span>
            <button type="button" className="st-btn st-btn--danger" onClick={close} disabled={closing}>
              {closing ? "Closing…" : "Yes, close ticket"}
            </button>
            <button type="button" className="st-btn st-btn--ghost" onClick={() => setConfirming(false)} disabled={closing}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="st-btn st-btn--close" onClick={() => setConfirming(true)}>
            Close Ticket
          </button>
        ))}
      </div>

      <div className="st-ts">
        <div className="st-tsbox">
          <div className="st-tsbox__lbl">Raised · {who} time</div>
          {ticket.userTimezone ? (
            <>
              <div className="st-tsbox__val">{formatTicketDateTime(ticket.createdAt, ticket.userTimezone)}</div>
              <div className="st-tsbox__tz">{zoneLabel(ticket.createdAt, ticket.userTimezone)}</div>
            </>
          ) : (
            <div className="st-tsbox__tz">Timezone was not recorded for this ticket.</div>
          )}
        </div>
        <div className="st-tsbox">
          <div className="st-tsbox__lbl">Raised · Admin time</div>
          <div className="st-tsbox__val">{formatTicketDateTime(ticket.createdAt, ADMIN_TIMEZONE)}</div>
          <div className="st-tsbox__tz">{zoneLabel(ticket.createdAt, ADMIN_TIMEZONE)}</div>
        </div>
      </div>

      <div className="st-thread">
        {messages.map((m, i) => (
          <div key={m._id || i} className={`st-msg st-msg--${m.sender}`}>
            <div className="st-msg__by">
              {m.sender === "admin" ? "Admin" : raiserName} · {formatTicketDateTime(m.createdAt, ADMIN_TIMEZONE)}
            </div>
            <div className="st-msg__text">{m.text}</div>
          </div>
        ))}
      </div>

      {closed ? (
        <div className="st-closednote">Closed by admin on {formatTicketDateTime(ticket.closedAt, ADMIN_TIMEZONE)}</div>
      ) : (
        <div className="st-reply">
          <textarea
            aria-label={`Reply to ${raiserName}`}
            value={text}
            maxLength={MAX_REPLY}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a reply… the ticket stays open until you close it"
          />
          <button type="button" className="st-btn st-btn--primary" onClick={send} disabled={!text.trim() || sending}>
            {sending ? "Sending…" : "Send reply"}
          </button>
        </div>
      )}
    </div>
  );
}

function TicketCard({ ticket, kind, onChanged, onError }) {
  const [open, setOpen] = useState(false);
  const isResolved = ticket.status === "resolved";
  const toggle = () => setOpen((p) => !p);
  const bodyId = `st-body-${ticket._id}`;

  return (
    <div className="st-ticket">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={open ? bodyId : undefined}
        className="st-ticket__row"
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        onClick={toggle}
      >
        <div className={`st-avatar${isResolved ? " st-avatar--resolved" : ""}`}>
          {ticket.createdBy?.name?.[0]?.toUpperCase() || "?"}
        </div>

        <div className="st-ticket__main">
          <div className="st-ticket__title" title={ticket.title}>{ticket.title}</div>
          <div className="st-ticket__meta">
            {ticket.createdBy?.name && <span className="st-ticket__name">{ticket.createdBy.name}</span>}
            {ticket.createdBy?.email && <span className="st-ticket__email">{ticket.createdBy.email}</span>}
            {ticket.category && (
              <span className="st-chip">{CATEGORY_LABELS[ticket.category] || ticket.category}</span>
            )}
          </div>
        </div>

        <div className="st-ticket__side">
          <span className="st-date">
            {formatTicketDate(ticket.createdAt, ADMIN_TIMEZONE)}
            <small>{formatTicketClock(ticket.createdAt, ADMIN_TIMEZONE)} IST</small>
          </span>
          <span className={`st-badge st-badge--${ticket.status}`}>{isResolved ? "Resolved" : "Open"}</span>
        </div>

        <span className={`st-chevron${open ? " st-chevron--open" : ""}`} aria-hidden="true">⌄</span>
      </div>

      {open && <TicketDetail ticket={ticket} kind={kind} onChanged={onChanged} onError={onError} />}
    </div>
  );
}

export default function SupportTickets() {
  // Notifications open this page as /admin-dashboard/tickets?tab=doctor|patient. Only those two
  // values are honoured; there is no per-ticket route, so this selects a tab and nothing more.
  const [searchParams] = useSearchParams();
  const queryTab = ticketTabFromQuery(searchParams.get("tab"));
  const [tab,            setTab]            = useState(queryTab || "patient");
  useEffect(() => { if (queryTab) setTab(queryTab); }, [queryTab]);
  const [doctorTickets,  setDoctorTickets]  = useState([]);
  const [patientTickets, setPatientTickets] = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState("");
  const [filter,         setFilter]         = useState("all");
  const [toast,          setToast]          = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [drRes, ptRes] = await Promise.all([
        api.get("/api/tickets/all", AS_ADMIN),
        api.get("/api/tickets/user/all", AS_ADMIN),
      ]);
      setDoctorTickets(drRes.data);
      setPatientTickets(ptRes.data);
    } catch (err) {
      console.error("Failed to load tickets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000); };

  // Replace one ticket with the server's copy (after a reply or a close) without reloading the list.
  const replaceTicket = (kind) => (updated, message) => {
    const setter = kind === "patient" ? setPatientTickets : setDoctorTickets;
    setter((list) => list.map((t) => (t._id === updated._id ? updated : t)));
    if (message) showToast(message);
  };
  const failed = (message, reload) => { showToast(message, false); if (reload) fetchAll(); };

  const source = tab === "patient" ? patientTickets : doctorTickets;
  const openCount    = patientTickets.filter(t => t.status === "open").length;
  const drOpenCount  = doctorTickets.filter(t => t.status === "open").length;

  const displayed = source.filter(t => {
    const needle = search.trim().toLowerCase();
    const matchSearch = !needle
      || (t.createdBy?.name || "").toLowerCase().includes(needle)
      || (t.createdBy?.email || "").toLowerCase().includes(needle)
      || (t.title || "").toLowerCase().includes(needle);
    const matchFilter = filter === "all" || t.status === filter;
    return matchSearch && matchFilter;
  });

  const tabCounts = {
    all:      source.length,
    open:     source.filter(t => t.status === "open").length,
    resolved: source.filter(t => t.status === "resolved").length,
  };

  return (
    <div className="st-page">
      {toast && (
        <div className={`st-toast ${toast.ok ? "st-toast--ok" : "st-toast--err"}`} role="status">
          <span>{toast.ok ? "✓" : "!"}</span> {toast.msg}
        </div>
      )}

      <div className="st-header">
        <span className="st-eyebrow">Admin Panel</span>
        <h1 className="st-title">Support Tickets</h1>
        <p className="st-sub">Manage and resolve support requests from patients and doctors.</p>
      </div>

      <div className="st-card">
        <div className="st-card__head">
          <div className="st-toolbar">
            {/* Source tabs */}
            <div className="st-source">
              {[
                { key: "patient", label: "Patient Tickets", open: openCount },
                { key: "doctor",  label: "Doctor Tickets",  open: drOpenCount },
              ].map(t => (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={tab === t.key}
                  onClick={() => { setTab(t.key); setFilter("all"); setSearch(""); }}
                  className={`st-source__btn${tab === t.key ? " is-active" : ""}`}
                >
                  {t.label}
                  <span className={`st-source__count${t.open > 0 ? " has-open" : ""}`}>
                    {t.open > 0 ? `${t.open} open` : (tab === t.key ? source.length : (t.key === "patient" ? patientTickets.length : doctorTickets.length))}
                  </span>
                </button>
              ))}
            </div>

            <label className="st-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="search" aria-label="Search tickets by name or title" placeholder="Search by name or title…" value={search} onChange={e => setSearch(e.target.value)} />
            </label>
          </div>

          <div className="st-filters">
            {[
              { key: "all",      label: "All" },
              { key: "open",     label: "Open" },
              { key: "resolved", label: "Resolved" },
            ].map(f => (
              <button key={f.key} type="button" aria-pressed={filter === f.key} className={`st-filter${filter === f.key ? " active" : ""}`} onClick={() => setFilter(f.key)}>
                {f.label}
                <span className="st-filter__count">{tabCounts[f.key]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="st-list">
          {loading ? (
            <div className="st-state"><div className="st-spinner" /><p>Loading tickets…</p></div>
          ) : displayed.length === 0 ? (
            <div className="st-state st-state--empty">
              <div className="st-state__icon">🎫</div>
              <h3>No tickets found</h3>
              <p>No {tab} tickets match your filter.</p>
            </div>
          ) : displayed.map(t => (
            <TicketCard
              key={t._id}
              ticket={t}
              kind={tab}
              onChanged={replaceTicket(tab)}
              onError={failed}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
