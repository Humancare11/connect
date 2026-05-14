import { useEffect, useState } from "react";
import api from "../../api";
import "./AdminAppointments.css";
import "./AdminPayments.css";

function formatINR(paise) {
  if (!paise) return "₹0";
  return (paise / 100).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function MethodBadge({ info, loading }) {
  if (loading) return <span className="adpy-method adpy-method--loading">Loading…</span>;
  if (!info) return <span className="adpy-method adpy-method--unknown">Online</span>;

  if (info.type === "card") {
    const brand = (info.brand || "card").charAt(0).toUpperCase() + (info.brand || "card").slice(1);
    return (
      <span className="adpy-method adpy-method--card">
        💳 {brand} {info.last4 ? `•••• ${info.last4}` : ""}
      </span>
    );
  }
  return <span className="adpy-method adpy-method--unknown">{info.type}</span>;
}

export default function AdminPayments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState({});     // { [_id]: methodInfo | null }
  const [detailLoading, setDetailLoading] = useState({});     // { [_id]: bool }

  useEffect(() => {
    api.get("/api/appointments/admin/all")
      .then(r => setAppointments(r.data.filter(a => a.paymentIntentId)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const paid = appointments.filter(a => a.paymentStatus === "paid");
  const revenue = paid.reduce((s, a) => s + (a.paymentAmount || 0), 0);
  const avgFee = paid.length > 0 ? Math.round(revenue / paid.length) : 0;

  const fetchDetails = async (appt) => {
    if (details[appt._id] !== undefined) return;
    setDetailLoading(prev => ({ ...prev, [appt._id]: true }));
    try {
      const res = await api.get(`/api/payments/admin/intent/${appt.paymentIntentId}`);
      setDetails(prev => ({ ...prev, [appt._id]: res.data.methodInfo }));
    } catch {
      setDetails(prev => ({ ...prev, [appt._id]: null }));
    } finally {
      setDetailLoading(prev => ({ ...prev, [appt._id]: false }));
    }
  };

  const handleExpand = (appt) => {
    const newId = expandedId === appt._id ? null : appt._id;
    setExpandedId(newId);
    if (newId) fetchDetails(appt);
  };

  const filtered = appointments.filter(a => {
    const patient = (a.patientId?.name || "").toLowerCase();
    const doctor = (a.doctorId?.name || "").toLowerCase();
    const q = search.trim().toLowerCase();
    if (q && !patient.includes(q) && !doctor.includes(q)) return false;
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div className="adp-header">
        <span className="adp-eyebrow">Admin Panel</span>
        <h1 className="adp-title">Payments</h1>
        <p className="adp-sub">Monitor all payment transactions on the platform.</p>
      </div>

      {/* Revenue stats */}
      <div className="adp-stats">
        <div className="adp-stat adp-stat--green">
          <div className="adp-stat-value">{formatINR(revenue)}</div>
          <div className="adp-stat-label">Total Revenue</div>
        </div>
        <div className="adp-stat">
          <div className="adp-stat-value">{paid.length}</div>
          <div className="adp-stat-label">Paid Transactions</div>
        </div>
        <div className="adp-stat adp-stat--amber">
          <div className="adp-stat-value">{appointments.length - paid.length}</div>
          <div className="adp-stat-label">Unpaid / Pending</div>
        </div>
        <div className="adp-stat adp-stat--blue">
          <div className="adp-stat-value">{paid.length > 0 ? formatINR(avgFee) : "—"}</div>
          <div className="adp-stat-label">Avg. Consultation Fee</div>
        </div>
      </div>

      {/* Table card */}
      <div className="adp-card">
        <div className="adp-card-header">
          <div className="adp-tabs">
            {[
              { key: "all", label: "All Payments" },
            ].map(t => (
              <button key={t.key}
                className={`adp-tab ${t.key === "all" ? "active" : ""}`}
                onClick={() => { }}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="adp-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input placeholder="Search patient or doctor…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="adp-loading"><div className="adp-spinner" /><p>Loading payments…</p></div>
        ) : filtered.length === 0 ? (
          <div className="adp-empty">
            <div className="adp-empty-icon">💳</div>
            <h3>No payments found</h3>
            <p>No payment records match your current filter.</p>
          </div>
        ) : (
          <div className="adp-table-wrap">
            <table className="adp-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Stripe ID</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const isOpen = expandedId === a._id;
                  const d = details[a._id];
                  const dLoading = !!detailLoading[a._id];
                  return (
                    <>
                      <tr key={a._id} className={`adp-row ${isOpen ? "adp-row--open" : ""}`}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <div className="adp-avatar" style={{ background: "#ede9fe", color: "#7c3aed" }}>
                              {(a.patientId?.name || "P")[0].toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 600, color: "#0f172a" }}>{a.patientId?.name || "Unknown"}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <div className="adp-avatar" style={{ background: "#ecfdf5", color: "#059669" }}>
                              {(a.doctorId?.name || "D")[0].toUpperCase()}
                            </div>
                            <span>{a.doctorId?.name || "Unassigned"}</span>
                          </div>
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>{formatDate(a.date)}</td>
                        <td>
                          <strong style={{ color: "#059669" }}>{formatINR(a.paymentAmount)}</strong>
                        </td>
                        <td>
                          <span className={`adpy-pay-badge ${a.paymentStatus === "paid" ? "adpy-pay-badge--paid" : "adpy-pay-badge--unpaid"}`}>
                            {a.paymentStatus === "paid" ? "✓ Paid" : "Unpaid"}
                          </span>
                        </td>
                        <td>
                          <span className="adpy-pi-id" title={a.paymentIntentId}>
                            {a.paymentIntentId ? `…${a.paymentIntentId.slice(-10)}` : "—"}
                          </span>
                        </td>
                        <td>
                          <button
                            className={`adp-expand-btn ${isOpen ? "adp-expand-btn--open" : ""}`}
                            onClick={() => handleExpand(a)} title="View payment details"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr key={`${a._id}-exp`} className="adp-expand-row">
                          <td colSpan={7}>
                            <div className="adp-expand">
                              <div className="adp-expand-grid">
                                <div className="adp-exp-item">
                                  <span className="adp-exp-label">Patient email</span>
                                  <span className="adp-exp-value">{a.patientId?.email || "—"}</span>
                                </div>
                                <div className="adp-exp-item">
                                  <span className="adp-exp-label">Doctor email</span>
                                  <span className="adp-exp-value">{a.doctorId?.email || "—"}</span>
                                </div>
                                <div className="adp-exp-item">
                                  <span className="adp-exp-label">Appointment date</span>
                                  <span className="adp-exp-value">{formatDate(a.date)} at {a.time}</span>
                                </div>
                                <div className="adp-exp-item">
                                  <span className="adp-exp-label">Amount paid</span>
                                  <span className="adp-exp-value" style={{ color: "#059669", fontWeight: 700 }}>{formatINR(a.paymentAmount)}</span>
                                </div>
                                <div className="adp-exp-item">
                                  <span className="adp-exp-label">Payment method</span>
                                  <span className="adp-exp-value">
                                    <MethodBadge info={d} loading={dLoading} />
                                  </span>
                                </div>
                                <div className="adp-exp-item adp-exp-item--full">
                                  <span className="adp-exp-label">Stripe Payment Intent ID</span>
                                  <span className="adp-exp-value adpy-mono">{a.paymentIntentId}</span>
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
