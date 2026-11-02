import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api";
import { ticketTabFromQuery } from "./adminNotificationLinks";
import useModalA11y from "../../hooks/useModalA11y";
import "./AdminDashboard.css"; // keyframes used by the resolve dialog (adp-scalein, adp-spin)
import "./SupportTickets.css";

const CATEGORY_LABELS = {
  appointment: "Appointment",
  billing:     "Billing",
  technical:   "Technical",
  medical:     "Medical",
  other:       "Other",
};

function ResolveModal({ ticket, resolveUrl, onClose, onResolved }) {
  const resolveDialogRef = useRef(null);
  useModalA11y(resolveDialogRef, true, onClose);
  const [resolution, setResolution] = useState("");
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState(false);

  const submit = async () => {
    if (!resolution.trim()) return;
    setSaving(true);
    try {
      await api.put(resolveUrl, { resolution });
      onResolved();
    } catch (err) {
      console.error("Resolve error:", err);
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = resolution.trim() && !saving;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(8, 30, 80, 0.55)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div ref={resolveDialogRef} className="st-modal-dialog" role="dialog" aria-modal="true" aria-label="Resolve ticket"
        onClick={e => e.stopPropagation()}
        style={{
          background: "#ffffff",
          borderRadius: 16,
          width: "100%", maxWidth: 560,
          boxShadow: "0 24px 60px rgba(8, 58, 176, 0.22), 0 4px 16px rgba(0,0,0,0.10)",
          overflow: "hidden",
          animation: "adp-scalein 0.2s ease",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 24px",
          borderBottom: "1.5px solid #e2e8f0",
          background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: "rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16,
            }}>✓</div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#ffffff" }}>Resolve Ticket</h3>
          </div>
          <button
            type="button"
            className="st-modal-btn"
            aria-label="Close"
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "1.5px solid rgba(255,255,255,0.35)",
              borderRadius: "50%",
              width: 34, height: 34,
              cursor: "pointer",
              fontSize: 16, color: "#ffffff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, lineHeight: 1,
              transition: "background 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.28)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "22px 24px" }}>
          {/* Ticket info box */}
          <div style={{
            background: "#eff6ff",
            border: "1.5px solid #bfdbfe",
            borderRadius: 10,
            padding: "14px 16px",
            marginBottom: 20,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: "#1d4ed8",
              textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6,
            }}>
              Ticket Details
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1e3a5f", marginBottom: 4 }}>
              {ticket.title}
            </div>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.55 }}>
              {ticket.description}
            </div>
            {ticket.createdBy?.name && (
              <div className="st-modal-meta" style={{ fontSize: 12, color: "#6b7280", marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  width: 20, height: 20, borderRadius: "50%",
                  background: "#dbeafe", color: "#1d4ed8",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                }}>
                  {ticket.createdBy.name[0]?.toUpperCase()}
                </span>
                <span>{ticket.createdBy.name}</span>
                {ticket.createdBy.email && <span className="st-modal-email" style={{ color: "#9ca3af" }}>· {ticket.createdBy.email}</span>}
              </div>
            )}
          </div>

          {/* Resolution textarea */}
          <label style={{
            display: "block",
            fontSize: 12, fontWeight: 700, color: "#374151",
            textTransform: "uppercase", letterSpacing: ".07em",
            marginBottom: 8,
          }}>
            Resolution Message <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <textarea
            className="st-modal-field"
            value={resolution}
            onChange={e => setResolution(e.target.value)}
            placeholder="Describe how the issue was resolved…"
            rows={5}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              width: "100%",
              padding: "12px 14px",
              border: focused ? "2px solid #2563eb" : "1.5px solid #d1d5db",
              borderRadius: 10,
              fontSize: 14, fontFamily: "inherit",
              resize: "vertical",
              outline: "none",
              boxSizing: "border-box",
              color: "#111827",
              background: "#ffffff",
              transition: "border-color .15s",
              lineHeight: 1.6,
            }}
          />
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6b7280" }}>
            This message will be sent to the user when the ticket is marked resolved.
          </p>
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px",
          borderTop: "1.5px solid #e2e8f0",
          background: "#f8fafc",
          display: "flex", gap: 10, justifyContent: "flex-end",
        }}>
          <button
            type="button"
            className="st-modal-btn"
            onClick={onClose}
            style={{
              padding: "9px 20px",
              borderRadius: 8,
              border: "1.5px solid #d1d5db",
              background: "#ffffff",
              color: "#374151",
              fontSize: 13, fontWeight: 600, fontFamily: "inherit",
              cursor: "pointer",
              transition: "background 0.15s, border-color 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#f3f4f6"; e.currentTarget.style.borderColor = "#9ca3af"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#ffffff"; e.currentTarget.style.borderColor = "#d1d5db"; }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="st-modal-btn"
            onClick={submit}
            disabled={!canSubmit}
            style={{
              padding: "9px 22px",
              borderRadius: 8,
              border: "none",
              background: canSubmit ? "linear-gradient(135deg, #1d4ed8, #2563eb)" : "#93c5fd",
              color: "#ffffff",
              fontSize: 13, fontWeight: 700, fontFamily: "inherit",
              cursor: canSubmit ? "pointer" : "not-allowed",
              boxShadow: canSubmit ? "0 3px 12px rgba(29,78,216,0.35)" : "none",
              display: "flex", alignItems: "center", gap: 7,
              transition: "opacity 0.15s, box-shadow 0.15s",
            }}
            onMouseEnter={e => { if (canSubmit) e.currentTarget.style.opacity = "0.88"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
          >
            {saving ? (
              <>
                <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "adp-spin 0.7s linear infinite" }} />
                Saving…
              </>
            ) : (
              <>✓ Mark Resolved</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function TicketCard({ ticket, onResolve }) {
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
            {new Date(ticket.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
          <span className={`st-badge st-badge--${ticket.status}`}>{ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}</span>
          {!isResolved && (
            <button type="button" className="st-resolve" onClick={(e) => { e.stopPropagation(); onResolve(ticket); }}>
              Resolve
            </button>
          )}
        </div>

        <span className={`st-chevron${open ? " st-chevron--open" : ""}`} aria-hidden="true">⌄</span>
      </div>

      {open && (
        <div className="st-ticket__body" id={bodyId}>
          <div className="st-label">Description</div>
          <p className="st-text">{ticket.description}</p>

          {isResolved && ticket.resolution && (
            <div className="st-resolution">
              <div className="st-label st-label--ok">✓ Resolution</div>
              <p className="st-text">{ticket.resolution}</p>
              {ticket.resolvedBy && (
                <p className="st-resolution__by">
                  Resolved by {ticket.resolvedBy.name} · {new Date(ticket.updatedAt).toLocaleDateString("en-IN")}
                </p>
              )}
            </div>
          )}
        </div>
      )}
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
  const [resolving,      setResolving]      = useState(null);
  const [resolveType,    setResolveType]    = useState(null);
  const [search,         setSearch]         = useState("");
  const [filter,         setFilter]         = useState("all");
  const [toast,          setToast]          = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [drRes, ptRes] = await Promise.all([
        api.get("/api/tickets/all"),
        api.get("/api/tickets/user/all"),
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

  const afterResolved = () => {
    setResolving(null); setResolveType(null);
    fetchAll();
    showToast("Ticket resolved successfully.");
  };

  const source = tab === "patient" ? patientTickets : doctorTickets;
  const openCount    = patientTickets.filter(t => t.status === "open").length;
  const drOpenCount  = doctorTickets.filter(t => t.status === "open").length;

  const displayed = source.filter(t => {
    const name = t.createdBy?.name || t.createdBy?.email || "";
    const matchSearch = !search.trim() || name.toLowerCase().includes(search.toLowerCase()) || t.title?.toLowerCase().includes(search.toLowerCase());
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
      {resolving && (
        <ResolveModal
          ticket={resolving}
          resolveUrl={resolveType === "patient" ? `/api/tickets/user/${resolving._id}/resolve` : `/api/tickets/${resolving._id}/resolve`}
          onClose={() => { setResolving(null); setResolveType(null); }}
          onResolved={afterResolved}
        />
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
              onResolve={(ticket) => { setResolving(ticket); setResolveType(tab); }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
