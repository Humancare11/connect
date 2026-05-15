import { useEffect, useState, useRef } from "react";
import api from "../../api";
import "./AdminPayments.css";

/* ── Fee calculations ─────────────────────────────────────────────────────── */
const STRIPE_RATE        = 0.029;
const STRIPE_FIXED_PAISE = 200;   // ₹2
const DOCTOR_SHARE       = 0.75;  // 75%

function calcFees(paise) {
  if (!paise) return { stripe: 0, doctorFee: 0, profit: 0 };
  const stripe    = Math.round(paise * STRIPE_RATE + STRIPE_FIXED_PAISE);
  const net       = paise - stripe;
  const doctorFee = Math.round(net * DOCTOR_SHARE);
  const profit    = net - doctorFee;
  return { stripe, doctorFee, profit };
}

function formatINR(paise) {
  if (!paise && paise !== 0) return "₹0";
  return (paise / 100).toLocaleString("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  });
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

/* ── Payment method badge (dropdown only) ─────────────────────────────────── */
function MethodBadge({ info, loading }) {
  if (loading) return <span className="ap-method ap-method--loading">Loading…</span>;
  if (!info)   return <span className="ap-method ap-method--unknown">Online</span>;
  if (info.type === "card") {
    const brand = (info.brand || "card").charAt(0).toUpperCase() + (info.brand || "card").slice(1);
    return (
      <span className="ap-method ap-method--card">
        💳 {brand}{info.last4 ? ` •••• ${info.last4}` : ""}
      </span>
    );
  }
  return <span className="ap-method ap-method--unknown">{info.type}</span>;
}

/* ── Chevron svg ──────────────────────────────────────────────────────────── */
function ChevronIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/* ── Reusable filter dropdown ─────────────────────────────────────────────── */
function FilterDropdown({ label, icon, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div className="ap-fdd" ref={ref}>
      <button
        className={`ap-fdd-btn ${value !== options[0].value ? "ap-fdd-btn--active" : ""}`}
        onClick={() => setOpen(p => !p)}
      >
        <span className="ap-fdd-icon">{icon}</span>
        <span className="ap-fdd-label">{selected?.label || label}</span>
        <span className={`ap-fdd-chev ${open ? "open" : ""}`}><ChevronIcon /></span>
      </button>
      {open && (
        <div className="ap-fdd-menu">
          {options.map(o => (
            <button
              key={o.value}
              className={`ap-fdd-opt ${value === o.value ? "active" : ""}`}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              {o.label}
              {value === o.value && <span className="ap-fdd-tick">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function AdminPayments() {
  const [appointments, setAppointments]   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");
  const [expandedId, setExpandedId]       = useState(null);
  const [details, setDetails]             = useState({});
  const [detailLoading, setDetailLoading] = useState({});

  /* Filters */
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter]     = useState("all");
  const [sortBy, setSortBy]             = useState("newest");

  useEffect(() => {
    api.get("/api/appointments/admin/all")
      .then(r => setAppointments(r.data.filter(a => a.paymentIntentId)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  /* ── Summary numbers (always from full paid list) ─────────────────────── */
  const paid        = appointments.filter(a => a.paymentStatus === "paid");
  const revenue     = paid.reduce((s, a) => s + (a.paymentAmount || 0), 0);
  const totalStripe = paid.reduce((s, a) => s + calcFees(a.paymentAmount).stripe,    0);
  const totalDoc    = paid.reduce((s, a) => s + calcFees(a.paymentAmount).doctorFee, 0);
  const totalProfit = paid.reduce((s, a) => s + calcFees(a.paymentAmount).profit,    0);

  /* ── Fetch Stripe method details ──────────────────────────────────────── */
  const fetchDetails = async (appt) => {
    if (details[appt._id] !== undefined) return;
    setDetailLoading(p => ({ ...p, [appt._id]: true }));
    try {
      const res = await api.get(`/api/payments/admin/intent/${appt.paymentIntentId}`);
      setDetails(p => ({ ...p, [appt._id]: res.data.methodInfo }));
    } catch {
      setDetails(p => ({ ...p, [appt._id]: null }));
    } finally {
      setDetailLoading(p => ({ ...p, [appt._id]: false }));
    }
  };

  const handleExpand = (appt) => {
    const newId = expandedId === appt._id ? null : appt._id;
    setExpandedId(newId);
    if (newId) fetchDetails(appt);
  };

  /* ── Filter + sort ────────────────────────────────────────────────────── */
  const today    = new Date(); today.setHours(0,0,0,0);
  const weekAgo  = new Date(today); weekAgo.setDate(today.getDate() - 7);
  const monthAgo = new Date(today); monthAgo.setMonth(today.getMonth() - 1);

  const filtered = appointments
    .filter(a => {
      const q = search.trim().toLowerCase();
      if (q) {
        const p = (a.patientId?.name || "").toLowerCase();
        const d = (a.doctorId?.name  || "").toLowerCase();
        if (!p.includes(q) && !d.includes(q)) return false;
      }
      if (statusFilter === "paid"   && a.paymentStatus !== "paid")  return false;
      if (statusFilter === "unpaid" && a.paymentStatus === "paid")   return false;
      if (dateFilter !== "all" && a.date) {
        const d = new Date(a.date + "T00:00:00");
        if (dateFilter === "today" && d < today)   return false;
        if (dateFilter === "week"  && d < weekAgo)  return false;
        if (dateFilter === "month" && d < monthAgo) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "newest")  return new Date(b.date) - new Date(a.date);
      if (sortBy === "oldest")  return new Date(a.date) - new Date(b.date);
      if (sortBy === "highest") return (b.paymentAmount || 0) - (a.paymentAmount || 0);
      if (sortBy === "lowest")  return (a.paymentAmount || 0) - (b.paymentAmount || 0);
      return 0;
    });

  const activeFilters = [
    statusFilter !== "all",
    dateFilter   !== "all",
    sortBy       !== "newest",
  ].filter(Boolean).length;

  const clearAll = () => {
    setStatusFilter("all");
    setDateFilter("all");
    setSortBy("newest");
    setSearch("");
  };

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="ap-root">

      {/* Page header */}
      <div className="ap-header">
        <div>
          <p className="ap-eyebrow">Admin Panel</p>
          <h1 className="ap-title">Payments</h1>
          <p className="ap-sub">Track revenue, fees, and all payment transactions.</p>
        </div>
        <div className="ap-header-badge">
          <span className="ap-badge-num">{paid.length}</span>
          <span className="ap-badge-txt">Paid</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="ap-stats">
        {[
          { label: "Total Consultations", value: formatINR(revenue),     mod: "blue",   emoji: "💰" },
          { label: "Stripe Deductions",   value: formatINR(totalStripe), mod: "amber",  emoji: "⚡" },
          { label: "Doctor Fees Paid",    value: formatINR(totalDoc),    mod: "indigo", emoji: "🩺" },
          { label: "Net Profit",          value: formatINR(totalProfit), mod: "green",  emoji: "📈" },
        ].map(s => (
          <div key={s.label} className={`ap-stat ap-stat--${s.mod}`}>
            <div className="ap-stat-emoji">{s.emoji}</div>
            <div className="ap-stat-val">{s.value}</div>
            <div className="ap-stat-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="app-card">

        {/* Toolbar */}
        <div className="ap-toolbar">
          <div className="ap-toolbar-left">
            {/* Search */}
            <div className="ap-search">
              <svg className="ap-search-icon" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search patient or doctor…"
              />
              {search && (
                <button className="ap-search-x" onClick={() => setSearch("")}>✕</button>
              )}
            </div>

            {/* Filter dropdowns */}
            {/* <FilterDropdown
              label="Status" icon="🔘"
              options={[
                { value: "all",    label: "All Status" },
                { value: "paid",   label: "✓ Paid" },
                { value: "unpaid", label: "Unpaid" },
              ]}
              value={statusFilter} onChange={setStatusFilter}
            /> */}
            <FilterDropdown
              label="Period" icon="📅"
              options={[
                { value: "all",   label: "All Time" },
                { value: "today", label: "Today" },
                { value: "week",  label: "Last 7 Days" },
                { value: "month", label: "Last 30 Days" },
              ]}
              value={dateFilter} onChange={setDateFilter}
            />
            <FilterDropdown
              label="Sort" icon="↕"
              options={[
                { value: "newest",  label: "Newest First" },
                { value: "oldest",  label: "Oldest First" },
                { value: "highest", label: "Highest Amount" },
                { value: "lowest",  label: "Lowest Amount" },
              ]}
              value={sortBy} onChange={setSortBy}
            />

            {activeFilters > 0 && (
              <button className="ap-clear" onClick={clearAll}>
                Clear <span className="ap-clear-n">{activeFilters}</span>
              </button>
            )}
          </div>

          <div className="ap-result-pill">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* States */}
        {loading ? (
          <div className="ap-state-wrap">
            <div className="ap-spinner"/>
            <p>Loading payments…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="ap-state-wrap">
            <div className="ap-state-icon">💳</div>
            <h3>No payments found</h3>
            <p>Try adjusting your search or filters.</p>
            {(search || activeFilters > 0) && (
              <button className="ap-reset" onClick={clearAll}>Reset filters</button>
            )}
          </div>
        ) : (
          <div className="ap-table-wrap">
            <table className="ap-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Date</th>
                  <th className="ap-th-r">Consult Fee</th>
                  <th className="ap-th-r">Stripe Deduction</th>
                  <th className="ap-th-r">Doctor's Fee</th>
                  <th className="ap-th-r">Net Profit</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const isOpen = expandedId === a._id;
                  const fees   = calcFees(a.paymentAmount);
                  const d      = details[a._id];
                  const dLoad  = !!detailLoading[a._id];

                  return (
                    <>
                      <tr
                        key={a._id}
                        className={`ap-row ${isOpen ? "ap-row--open" : ""}`}
                        onClick={() => handleExpand(a)}
                      >
                        {/* Patient */}
                        <td>
                          <div className="ap-person">
                            <div className="ap-av ap-av--p">
                              {(a.patientId?.name || "P")[0].toUpperCase()}
                            </div>
                            <div className="ap-pinfo">
                              <span className="ap-pname">{a.patientId?.name || "Unknown"}</span>
                              <span className="ap-pemail">{a.patientId?.email || ""}</span>
                            </div>
                          </div>
                        </td>

                        {/* Doctor */}
                        <td>
                          <div className="ap-person">
                            <div className="ap-av ap-av--d">
                              {(a.doctorId?.name || "D")[0].toUpperCase()}
                            </div>
                            <div className="ap-pinfo">
                              <span className="ap-pname">{a.doctorId?.name || "Unassigned"}</span>
                              <span className="ap-pemail">{a.doctorId?.email || ""}</span>
                            </div>
                          </div>
                        </td>

                        {/* Date */}
                        <td>
                          <div className="ap-date-wrap">
                            <span className="ap-date">{formatDate(a.date)}</span>
                            {a.time && <span className="ap-time">{a.time}</span>}
                          </div>
                        </td>

                        {/* Amount columns */}
                        <td className="ap-td-r"><span className="ap-v-consult">{formatINR(a.paymentAmount)}</span></td>
                        <td className="ap-td-r"><span className="ap-v-stripe">−{formatINR(fees.stripe)}</span></td>
                        <td className="ap-td-r"><span className="ap-v-doctor">{formatINR(fees.doctorFee)}</span></td>
                        <td className="ap-td-r"><span className="ap-v-profit">{formatINR(fees.profit)}</span></td>

                        {/* Expand */}
                        <td onClick={e => e.stopPropagation()}>
                          <button
                            className={`ap-exp-btn ${isOpen ? "open" : ""}`}
                            onClick={() => handleExpand(a)}
                          >
                            <ChevronIcon />
                          </button>
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isOpen && (
                        <tr key={`${a._id}-exp`} className="ap-detail-row">
                          <td colSpan={8}>
                            <div className="ap-detail">

                              <div className="ap-detail-grid">
                                <div className="ap-di">
                                  <span className="ap-di-label">Patient Email</span>
                                  <span className="ap-di-val">{a.patientId?.email || "—"}</span>
                                </div>
                                <div className="ap-di">
                                  <span className="ap-di-label">Doctor Email</span>
                                  <span className="ap-di-val">{a.doctorId?.email || "—"}</span>
                                </div>
                                <div className="ap-di">
                                  <span className="ap-di-label">Appointment Date</span>
                                  <span className="ap-di-val">
                                    {formatDate(a.date)}{a.time ? ` at ${a.time}` : ""}
                                  </span>
                                </div>
                                <div className="ap-di">
                                  <span className="ap-di-label">Appointment ID</span>
                                  <span className="ap-di-val ap-mono">{a._id}</span>
                                </div>
                                <div className="ap-di">
                                  <span className="ap-di-label">Amount Paid</span>
                                  <span className="ap-di-val ap-di-green">{formatINR(a.paymentAmount)}</span>
                                </div>
                                <div className="ap-di">
                                  <span className="ap-di-label">Payment Status</span>
                                  <span className="ap-di-val">
                                    <span className={`ap-status ${a.paymentStatus === "paid" ? "paid" : "unpaid"}`}>
                                      {a.paymentStatus === "paid" ? "✓ Paid" : "Unpaid"}
                                    </span>
                                  </span>
                                </div>
                                <div className="ap-di">
                                  <span className="ap-di-label">Payment Method</span>
                                  <span className="ap-di-val">
                                    <MethodBadge info={d} loading={dLoad} />
                                  </span>
                                </div>
                                <div className="ap-di ap-di--full">
                                  <span className="ap-di-label">Stripe Payment Intent ID</span>
                                  <span className="ap-di-val ap-mono">{a.paymentIntentId || "—"}</span>
                                </div>
                              </div>

                              {/* Fee breakdown */}
                              <div className="ap-breakdown">
                                <span className="ap-bd-label">Fee Breakdown</span>
                                <div className="ap-bd-chips">
                                  <span className="ap-chip ap-chip--blue">Consult {formatINR(a.paymentAmount)}</span>
                                  <span className="ap-sep">−</span>
                                  <span className="ap-chip ap-chip--amber">Stripe {formatINR(fees.stripe)}</span>
                                  <span className="ap-sep">=</span>
                                  <span className="ap-chip ap-chip--indigo">Net {formatINR(a.paymentAmount - fees.stripe)}</span>
                                  <span className="ap-sep">→</span>
                                  <span className="ap-chip ap-chip--teal">Dr. 75% {formatINR(fees.doctorFee)}</span>
                                  <span className="ap-sep">+</span>
                                  <span className="ap-chip ap-chip--green">Profit 25% {formatINR(fees.profit)}</span>
                                </div>
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}