import { useEffect, useState } from "react";
import api from "../../api";

const CATEGORY_LABELS = {
  appointment: "Appointment",
  billing:     "Billing",
  technical:   "Technical",
  medical:     "Medical",
  other:       "Other",
};

function ResolveModal({ ticket, resolveUrl, onClose, onResolved }) {
  const [resolution, setResolution] = useState("");
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="adp-overlay" onClick={onClose}>
      <div className="adp-modal" onClick={e => e.stopPropagation()}>
        <div className="adp-modal-header">
          <h3 className="adp-modal-title">Resolve Ticket</h3>
          <button className="adp-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="adp-modal-body">
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Ticket</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{ticket.title}</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{ticket.description}</div>
          </div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
            Resolution Message <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <textarea
            value={resolution}
            onChange={e => setResolution(e.target.value)}
            placeholder="Describe how the issue was resolved…"
            rows={5}
            style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box", transition: "border-color .2s" }}
            onFocus={e => e.target.style.borderColor = "#19c9a3"}
            onBlur={e => e.target.style.borderColor = "#e2e8f0"}
          />
        </div>
        <div className="adp-modal-footer">
          <button className="adp-btn adp-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="adp-btn adp-btn--resolve" onClick={submit} disabled={!resolution.trim() || saving} style={{ opacity: (!resolution.trim() || saving) ? .6 : 1 }}>
            {saving ? "Saving…" : "✓ Mark Resolved"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TicketCard({ ticket, onResolve }) {
  const [open, setOpen] = useState(false);
  const isResolved = ticket.status === "resolved";

  return (
    <div className="adp-ticket-card">
      <div className="adp-ticket-row" onClick={() => setOpen(p => !p)}>
        <div className="adp-avatar" style={{ background: isResolved ? "#ecfdf5" : "#eff6ff", color: isResolved ? "#059669" : "#2563eb" }}>
          {ticket.createdBy?.name?.[0]?.toUpperCase() || "?"}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ticket.title}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            {ticket.createdBy?.name}
            {ticket.createdBy?.email && <span style={{ color: "#94a3b8" }}> · {ticket.createdBy.email}</span>}
            {ticket.category && (
              <span style={{ marginLeft: 8, padding: "1px 8px", background: "#f1f5f9", borderRadius: 10, fontSize: 11 }}>
                {CATEGORY_LABELS[ticket.category] || ticket.category}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            {new Date(ticket.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
          <span className={`adp-badge adp-badge--${ticket.status}`}>{ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}</span>
          {!isResolved && (
            <button className="adp-btn adp-btn--resolve" onClick={e => { e.stopPropagation(); onResolve(ticket); }}>
              Resolve
            </button>
          )}
          <span style={{ fontSize: 16, color: "#cbd5e1", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>⌄</span>
        </div>
      </div>

      {open && (
        <div className="adp-ticket-body">
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>Description</div>
          <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.65, margin: 0 }}>{ticket.description}</p>

          {isResolved && ticket.resolution && (
            <div style={{ marginTop: 14, padding: "12px 16px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>✓ Resolution</div>
              <p style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.65, margin: 0 }}>{ticket.resolution}</p>
              {ticket.resolvedBy && (
                <p style={{ fontSize: 11, color: "#94a3b8", margin: "6px 0 0" }}>
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
  const [tab,            setTab]            = useState("patient");
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
    <div>
      {toast && (
        <div className={`adp-toast ${toast.ok ? "adp-toast--ok" : "adp-toast--err"}`}>
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

      <div className="adp-header">
        <span className="adp-eyebrow">Admin Panel</span>
        <h1 className="adp-title">Support Tickets</h1>
        <p className="adp-sub">Manage and resolve support requests from patients and doctors.</p>
      </div>

      <div className="adp-stats" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <div className="adp-stat adp-stat--blue">
          <div className="adp-stat-icon">🎫</div>
          <div className="adp-stat-value">{patientTickets.length + doctorTickets.length}</div>
          <div className="adp-stat-label">Total Tickets</div>
        </div>
        <div className="adp-stat adp-stat--amber">
          <div className="adp-stat-icon">⏳</div>
          <div className="adp-stat-value">{openCount + drOpenCount}</div>
          <div className="adp-stat-label">Open Tickets</div>
        </div>
        <div className="adp-stat">
          <div className="adp-stat-icon">👤</div>
          <div className="adp-stat-value">{patientTickets.length}</div>
          <div className="adp-stat-label">Patient Tickets</div>
        </div>
        <div className="adp-stat">
          <div className="adp-stat-icon">🩺</div>
          <div className="adp-stat-value">{doctorTickets.length}</div>
          <div className="adp-stat-label">Doctor Tickets</div>
        </div>
      </div>

      <div className="adp-card">
        <div className="adp-card-header" style={{ flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: 10 }}>
            {/* Source tabs */}
            <div style={{ display: "flex", gap: 6, background: "#f8fafc", padding: 4, borderRadius: 10, border: "1px solid #e2e8f0" }}>
              {[
                { key: "patient", label: "Patient Tickets", open: openCount },
                { key: "doctor",  label: "Doctor Tickets",  open: drOpenCount },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => { setTab(t.key); setFilter("all"); setSearch(""); }}
                  style={{
                    padding: "7px 16px", borderRadius: 7, border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: 600, fontFamily: "inherit", transition: "all .15s",
                    background: tab === t.key ? "#fff" : "transparent",
                    color: tab === t.key ? "#19c9a3" : "#64748b",
                    boxShadow: tab === t.key ? "0 1px 4px rgba(15,23,42,.08)" : "none",
                    display: "flex", alignItems: "center", gap: 8,
                  }}
                >
                  {t.label}
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 20,
                    background: tab === t.key ? (t.open > 0 ? "#fef3c7" : "rgba(25,201,163,.15)") : "#e2e8f0",
                    color: tab === t.key ? (t.open > 0 ? "#d97706" : "#19c9a3") : "#64748b",
                  }}>
                    {t.open > 0 ? `${t.open} open` : (tab === t.key ? source.length : (t.key === "patient" ? patientTickets.length : doctorTickets.length))}
                  </span>
                </button>
              ))}
            </div>

            <div className="adp-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input placeholder="Search by name or title…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="adp-tabs">
            {[
              { key: "all",      label: "All" },
              { key: "open",     label: "Open" },
              { key: "resolved", label: "Resolved" },
            ].map(f => (
              <button key={f.key} className={`adp-tab ${filter === f.key ? "active" : ""}`} onClick={() => setFilter(f.key)}>
                {f.label}
                <span className="adp-tab-count">{tabCounts[f.key]}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: "16px 20px" }}>
          {loading ? (
            <div className="adp-loading"><div className="adp-spinner" /><p>Loading tickets…</p></div>
          ) : displayed.length === 0 ? (
            <div className="adp-empty">
              <div className="adp-empty-icon">🎫</div>
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
