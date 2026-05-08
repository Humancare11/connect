import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import "./RaiseTicket.css";
import api from "../../api";
import { notifyUserActivityUpdated } from "../../utils/activityEvents";

const STATUS_META = {
  open:     { label: "Open",     cls: "urt-s-open"     },
  resolved: { label: "Resolved", cls: "urt-s-resolved" },
};

const CATEGORIES = [
  { value: "appointment", label: "Appointment Issue" },
  { value: "billing",     label: "Billing / Payment" },
  { value: "technical",   label: "Technical Problem" },
  { value: "medical",     label: "Medical Query"      },
  { value: "other",       label: "Other"              },
];

const fmt = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export default function UserRaiseTicket() {
  const location = useLocation();
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [category,    setCategory]    = useState("other");
  const [loading,     setLoading]     = useState(false);
  const [toast,       setToast]       = useState(null);
  const [tickets,     setTickets]     = useState([]);
  const [fetching,    setFetching]    = useState(true);
  const [expanded,    setExpanded]    = useState(null);
  const [filter,      setFilter]      = useState("all");
  const [focusedTicketId, setFocusedTicketId] = useState("");

  useEffect(() => { fetchTickets(); }, []);

  const showToast = (msg, ok) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchTickets = async () => {
    setFetching(true);
    try {
      const res = await api.get("/api/tickets/user/my");
      setTickets(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setLoading(true);
    try {
      const res = await api.post("/api/tickets/user/create", { title, description, category });
      showToast("Ticket submitted successfully!", true);
      setTitle("");
      setDescription("");
      setCategory("other");
      notifyUserActivityUpdated({
        source: "ticket",
        id: res.data?.ticket?._id,
      });
      fetchTickets();
    } catch (err) {
      showToast(err.response?.data?.message || "Something went wrong. Please try again.", false);
    } finally {
      setLoading(false);
    }
  };

  const TABS = ["all", "open", "resolved"];
  const counts = TABS.reduce((acc, t) => {
    acc[t] = t === "all" ? tickets.length : tickets.filter((x) => x.status === t).length;
    return acc;
  }, {});

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const activityId = params.get("activityId");

    if (!activityId || tickets.length === 0) {
      setFocusedTicketId("");
      return;
    }

    const target = tickets.find((t) => t._id === activityId);
    if (!target) {
      setFocusedTicketId("");
      return;
    }

    setFocusedTicketId(activityId);
    if (target.status) setFilter(target.status);
    setExpanded(activityId);

    setTimeout(() => {
      document.getElementById(`ticket-${activityId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 40);
  }, [tickets, location.search]);

  const displayed = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);

  return (
    <div className="urt-root">

      {/* Toast */}
      {toast && (
        <div className={`urt-toast ${toast.ok ? "urt-toast--ok" : "urt-toast--err"}`}>
          <span className="urt-toast-icon">{toast.ok ? "✓" : "!"}</span>
          {toast.msg}
        </div>
      )}

      {/* Page Header */}
      <div className="urt-page-head">
        <div>
          <span className="urt-eyebrow">Support</span>
          <h1 className="urt-page-title">Help & Support</h1>
          <p className="urt-page-sub">Submit an issue or track your existing support requests.</p>
        </div>
        <div className="urt-head-stat">
          <span className="urt-stat-num">{tickets.length}</span>
          <span className="urt-stat-label">Total tickets</span>
        </div>
      </div>

      <div className="urt-layout">

        {/* ── Left: Create Ticket ── */}
        <div className="urt-form-panel">
          <div className="urt-panel-head">
            <div className="urt-panel-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </div>
            <div>
              <h2 className="urt-panel-title">New Ticket</h2>
              <p className="urt-panel-sub">Describe your issue clearly for faster resolution.</p>
            </div>
          </div>

          <form className="urt-form" onSubmit={handleSubmit}>
            <div className="urt-field">
              <label className="urt-label">Category</label>
              <select
                className="urt-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="urt-field">
              <label className="urt-label">Title <span className="urt-req">*</span></label>
              <input
                className="urt-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Unable to join video call"
                required
                maxLength={120}
              />
            </div>

            <div className="urt-field">
              <label className="urt-label">Description <span className="urt-req">*</span></label>
              <textarea
                className="urt-input urt-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                rows={5}
                placeholder="Please describe your issue in detail — what happened, when, and any steps you already tried."
                required
              />
              <p className="urt-hint">{description.length}/500</p>
            </div>

            <button className="urt-submit-btn" type="submit" disabled={loading}>
              {loading ? (
                <><span className="urt-spin" /> Submitting…</>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                  Submit Ticket
                </>
              )}
            </button>
          </form>

          <div className="urt-tips">
            <p className="urt-tips-title">💡 Tips for faster support</p>
            <ul>
              <li>Include error messages or screenshots if possible</li>
              <li>Mention the feature or page where you faced the issue</li>
              <li>Describe steps that led to the problem</li>
            </ul>
          </div>
        </div>

        {/* ── Right: Ticket List ── */}
        <div className="urt-list-panel">
          <div className="urt-list-head">
            <h2 className="urt-panel-title">Your Tickets</h2>
            <div className="urt-tabs">
              {TABS.map((t) => (
                <button
                  key={t}
                  className={`urt-tab ${filter === t ? "urt-tab--active" : ""}`}
                  onClick={() => setFilter(t)}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                  <span className="urt-tab-count">{counts[t]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="urt-tickets">
            {fetching ? (
              <div className="urt-skeletons">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="urt-skeleton" style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            ) : displayed.length === 0 ? (
              <div className="urt-empty">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <p>{filter === "all" ? "No tickets yet. Submit one above!" : `No ${filter} tickets.`}</p>
              </div>
            ) : (
              displayed.map((ticket, i) => {
                const sm = STATUS_META[ticket.status] || STATUS_META.open;
                const isOpen = expanded === ticket._id;
                const catLabel = CATEGORIES.find((c) => c.value === ticket.category)?.label || "Other";
                return (
                  <div
                    id={`ticket-${ticket._id}`}
                    key={ticket._id}
                    className={`urt-ticket ${isOpen ? "urt-ticket--open" : ""} ${focusedTicketId === ticket._id ? "urt-ticket--focused" : ""}`}
                    style={{ animationDelay: `${i * 0.04}s` }}
                  >
                    <div
                      className="urt-ticket-top"
                      onClick={() => setExpanded(isOpen ? null : ticket._id)}
                    >
                      <div className="urt-ticket-left">
                        <div className="urt-ticket-id">#{String(i + 1).padStart(3, "0")}</div>
                        <div className="urt-ticket-info">
                          <span className="urt-ticket-title">{ticket.title}</span>
                          <span className="urt-ticket-meta">
                            {catLabel} &nbsp;·&nbsp; {fmt(ticket.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="urt-ticket-right">
                        <span className={`urt-badge ${sm.cls}`}>{sm.label}</span>
                        <svg
                          className="urt-chevron"
                          width="14" height="14"
                          viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2.5"
                          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                        >
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="urt-ticket-body">
                        <div>
                          <p className="urt-body-label">Description</p>
                          <p className="urt-body-text">{ticket.description}</p>
                        </div>
                        {ticket.status === "resolved" && ticket.resolution && (
                          <div className="urt-resolution">
                            <div className="urt-resolution-head">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                <polyline points="22 4 12 14.01 9 11.01"/>
                              </svg>
                              Resolution
                            </div>
                            <p>{ticket.resolution}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
