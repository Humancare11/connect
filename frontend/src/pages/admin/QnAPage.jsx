import { useState, useEffect, useCallback } from "react";
import api from "../../api";

const STATUS_META = {
  pending:  { label: "Pending",       color: "#d97706", bg: "#fef3c7", border: "#fcd34d" },
  assigned: { label: "Assigned",      color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  answered: { label: "Under Review",  color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  approved: { label: "Approved",      color: "#059669", bg: "#ecfdf5", border: "#6ee7b7" },
};

const CATEGORY_META = {
  General: { bg: "#EEF2FF", text: "#4338CA" },
  Heart:   { bg: "#FEF2F2", text: "#DC2626" },
  Skin:    { bg: "#FFF7ED", text: "#C2410C" },
  Neuro:   { bg: "#F5F3FF", text: "#7C3AED" },
  Ortho:   { bg: "#F0FDF4", text: "#16A34A" },
  Dental:  { bg: "#ECFDF5", text: "#059669" },
  Eyes:    { bg: "#EFF6FF", text: "#2563EB" },
  Dizzy:   { bg: "#FEF9C3", text: "#B45309" },
  Mental:  { bg: "#FDF4FF", text: "#A21CAF" },
  Gut:     { bg: "#F0FDF4", text: "#15803D" },
};

const fmt = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/* ── field label input reused in modals ── */
function ModalField({ label, required, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 7 }}>
        {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 14px", border: "1.5px solid #e2e8f0",
  borderRadius: 10, fontSize: 14, fontFamily: "inherit", outline: "none",
  background: "#fff", color: "#0f172a", boxSizing: "border-box",
};

/* ── Assign Modal ── */
function AssignModal({ question, onClose, onAssigned }) {
  const [doctors,    setDoctors]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [doctorId,   setDoctorId]   = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [doctorSpec, setDoctorSpec] = useState("");
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");

  useEffect(() => {
    api.get("/api/admin/doctors")
      .then(res => setDoctors(res.data.filter(d => d.approvalStatus === "approved")))
      .catch(() => setDoctors([]))
      .finally(() => setLoading(false));
  }, []);

  const selectDoctor = (e) => {
    const enrollmentId = e.target.value;
    if (!enrollmentId) { setDoctorId(""); setDoctorName(""); setDoctorSpec(""); return; }
    const d = doctors.find(d => d._id === enrollmentId);
    if (d) {
      setDoctorId(d.doctorId?._id || d._id);
      setDoctorName(`${d.firstName || ""} ${d.surname || ""}`.trim() || d.doctorId?.name || "");
      setDoctorSpec(d.specialization || "");
    }
  };

  const submit = async () => {
    if (!doctorName.trim()) { setError("Doctor name is required."); return; }
    setSaving(true); setError("");
    try {
      const res = await api.put(`/api/qna/${question._id}/assign`, {
        doctorId: doctorId || null, doctorName, doctorSpec,
      });
      onAssigned(res.data);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to assign.");
      setSaving(false);
    }
  };

  return (
    <div className="adp-overlay" onClick={onClose}>
      <div className="adp-modal" onClick={e => e.stopPropagation()}>
        <div className="adp-modal-header">
          <h3 className="adp-modal-title">Assign to Doctor</h3>
          <button className="adp-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="adp-modal-body">
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Question</div>
            <div style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.6 }}>
              "{question.question.slice(0, 120)}{question.question.length > 120 ? "…" : ""}"
            </div>
          </div>

          {error && (
            <div style={{ padding: "9px 13px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, color: "#dc2626", fontSize: 13, marginBottom: 14 }}>
              {error}
            </div>
          )}

          <ModalField label="Select Enrolled Doctor">
            {loading ? (
              <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Loading doctors…</p>
            ) : (
              <select
                value={doctors.find(d => (d.doctorId?._id || d._id) === doctorId)?._id || ""}
                onChange={selectDoctor}
                style={{ ...inputStyle }}
              >
                <option value="">— Pick from enrolled doctors —</option>
                {doctors.map(d => {
                  const name = `${d.firstName || ""} ${d.surname || ""}`.trim() || d.doctorId?.name || "Unknown";
                  return <option key={d._id} value={d._id}>{name}{d.specialization ? ` (${d.specialization})` : ""}</option>;
                })}
              </select>
            )}
          </ModalField>

          <ModalField label="Doctor Name" required>
            <input style={inputStyle} value={doctorName} onChange={e => setDoctorName(e.target.value)} placeholder="e.g. Dr. Priya Mehta" />
          </ModalField>

          <ModalField label="Specialization">
            <input style={inputStyle} value={doctorSpec} onChange={e => setDoctorSpec(e.target.value)} placeholder="e.g. Cardiologist" />
          </ModalField>
        </div>
        <div className="adp-modal-footer">
          <button className="adp-btn adp-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="adp-btn adp-btn--resolve" onClick={submit} disabled={saving} style={{ opacity: saving ? .6 : 1 }}>
            {saving ? "Assigning…" : "Assign Doctor"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Approve Modal ── */
function ApproveModal({ question, onClose, onApproved }) {
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const submit = async () => {
    setSaving(true); setError("");
    try {
      const res = await api.put(`/api/qna/${question._id}/approve`, {});
      onApproved(res.data);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to approve.");
      setSaving(false);
    }
  };

  return (
    <div className="adp-overlay" onClick={onClose}>
      <div className="adp-modal" onClick={e => e.stopPropagation()}>
        <div className="adp-modal-header">
          <h3 className="adp-modal-title">Approve &amp; Publish Answer</h3>
          <button className="adp-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="adp-modal-body">
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Question</div>
            <div style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.6 }}>
              "{question.question.slice(0, 120)}{question.question.length > 120 ? "…" : ""}"
            </div>
          </div>

          {question.assignedDoctorName && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#2563eb", flexShrink: 0 }}>
                {(question.assignedDoctorName[0] || "D").toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{question.assignedDoctorName}</div>
                {question.assignedDoctorSpec && <div style={{ fontSize: 12, color: "#64748b" }}>{question.assignedDoctorSpec}</div>}
              </div>
            </div>
          )}

          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>Doctor's Answer</div>
            <p style={{ fontSize: 14, color: "#1e293b", lineHeight: 1.7, margin: 0 }}>{question.answer}</p>
          </div>

          {error && (
            <div style={{ padding: "9px 13px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, color: "#dc2626", fontSize: 13, marginBottom: 12 }}>
              {error}
            </div>
          )}

          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
            Approving will publish this answer publicly and notify the patient.
          </p>
        </div>
        <div className="adp-modal-footer">
          <button className="adp-btn adp-btn--ghost" onClick={onClose}>Cancel</button>
          <button
            className="adp-btn adp-btn--approve"
            onClick={submit}
            disabled={saving}
            style={{ opacity: saving ? .6 : 1, padding: "8px 20px", fontSize: 13 }}
          >
            {saving ? "Publishing…" : "✓ Approve & Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main ── */
const FILTERS = ["all", "pending", "assigned", "answered", "approved"];

export default function QnAPage() {
  const [questions,  setQuestions]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState("all");
  const [search,     setSearch]     = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [assignFor,  setAssignFor]  = useState(null);
  const [approveFor, setApproveFor] = useState(null);
  const [toast,      setToast]      = useState(null);

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000); };

  const fetchQuestions = useCallback(() => {
    setLoading(true);
    api.get("/api/qna/admin/all")
      .then(res => setQuestions(res.data))
      .catch(err => console.error("fetch error:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const updateQ = (updated) => setQuestions(prev => prev.map(q => q._id === updated._id ? updated : q));

  const handleAssigned = (updated) => {
    updateQ(updated);
    setAssignFor(null);
    showToast(`Question assigned to ${updated.assignedDoctorName}.`);
  };

  const handleApproved = (updated) => {
    updateQ(updated);
    setApproveFor(null);
    showToast("Answer approved and published!");
  };

  const counts = FILTERS.reduce((acc, f) => {
    acc[f] = f === "all" ? questions.length : questions.filter(q => q.status === f).length;
    return acc;
  }, {});

  const filtered = questions.filter(q => {
    const matchFilter = filter === "all" || q.status === filter;
    const matchSearch = !search.trim() ||
      q.question.toLowerCase().includes(search.toLowerCase()) ||
      (q.user?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      q.category.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const statCards = [
    { label: "Total",        value: counts.all,      cls: "",                filterKey: "all",      icon: "💬" },
    { label: "Pending",      value: counts.pending,  cls: "adp-stat--amber", filterKey: "pending",  icon: "⏳" },
    { label: "Assigned",     value: counts.assigned, cls: "adp-stat--blue",  filterKey: "assigned", icon: "👨‍⚕️" },
    { label: "Under Review", value: counts.answered, cls: "adp-stat--purple",filterKey: "answered", icon: "🔍" },
    { label: "Live",         value: counts.approved, cls: "adp-stat--green", filterKey: "approved", icon: "🌐" },
  ];

  return (
    <div>
      {toast && (
        <div className={`adp-toast ${toast.ok ? "adp-toast--ok" : "adp-toast--err"}`}>
          <span>{toast.ok ? "✓" : "!"}</span> {toast.msg}
        </div>
      )}

      <div className="adp-header">
        <span className="adp-eyebrow">Admin Panel</span>
        <h1 className="adp-title">Medical Q&amp;A</h1>
        <p className="adp-sub">Manage patient questions through the full pipeline: assign → answer → approve.</p>
      </div>

      <div className="adp-stats">
        {statCards.map(s => (
          <div
            key={s.label}
            className={`adp-stat ${s.cls}`}
            style={{ cursor: "pointer" }}
            onClick={() => setFilter(s.filterKey)}
          >
            <div className="adp-stat-icon">{s.icon}</div>
            <div className="adp-stat-value">{s.value}</div>
            <div className="adp-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="adp-card">
        <div className="adp-card-header" style={{ flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: 10 }}>
            <h2 className="adp-card-title">Questions ({filtered.length})</h2>
            <div className="adp-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                placeholder="Search questions, users, categories…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="adp-tabs">
            {FILTERS.map(f => (
              <button key={f} className={`adp-tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "answered" ? "Under Review" : f.charAt(0).toUpperCase() + f.slice(1)}
                <span className="adp-tab-count">{counts[f]}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: "16px 20px" }}>
          {loading ? (
            <div className="adp-loading"><div className="adp-spinner" /><p>Loading questions…</p></div>
          ) : filtered.length === 0 ? (
            <div className="adp-empty">
              <div className="adp-empty-icon">📭</div>
              <h3>No questions found</h3>
              <p>No questions match your current filter.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filtered.map(q => {
                const col = CATEGORY_META[q.category] || CATEGORY_META.General;
                const sm  = STATUS_META[q.status]    || STATUS_META.pending;
                const isEx = expandedId === q._id;

                return (
                  <div
                    key={q._id}
                    style={{
                      background: "#fff",
                      border: "1.5px solid #e2e8f0",
                      borderLeft: `4px solid ${sm.color}`,
                      borderRadius: 12,
                      padding: "18px 20px",
                    }}
                  >
                    {/* Header row */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: col.bg, color: col.text }}>{q.category}</span>
                        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: sm.bg, color: sm.color, border: `1px solid ${sm.border}` }}>{sm.label}</span>
                        {q.user?.name && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#64748b" }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/></svg>
                            {q.user.name}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>{fmt(q.createdAt)}</span>
                    </div>

                    {/* Question text */}
                    <div
                      style={{ fontSize: 14, lineHeight: 1.75, color: "#1e293b", marginBottom: 12, cursor: q.question.length > 200 ? "pointer" : "default" }}
                      onClick={() => q.question.length > 200 && setExpandedId(isEx ? null : q._id)}
                    >
                      {isEx ? q.question : q.question.slice(0, 200) + (q.question.length > 200 ? "…" : "")}
                      {q.question.length > 200 && (
                        <span style={{ color: "#19c9a3", fontWeight: 700, fontSize: 12, marginLeft: 6 }}>
                          {isEx ? "Show less" : "Read more"}
                        </span>
                      )}
                    </div>

                    {/* Assigned doctor chip */}
                    {q.assignedDoctorName && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                        <span style={{ fontSize: 15 }}>👨‍⚕️</span>
                        <span style={{ fontWeight: 600, color: "#1d4ed8" }}>{q.assignedDoctorName}</span>
                        {q.assignedDoctorSpec && <span style={{ color: "#64748b" }}>— {q.assignedDoctorSpec}</span>}
                      </div>
                    )}

                    {/* Answer block */}
                    {q.answer && (
                      <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "12px 16px", marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>
                          Doctor's Answer
                        </div>
                        <p style={{ fontSize: 13.5, color: "#1e293b", lineHeight: 1.7, margin: 0 }}>{q.answer}</p>
                      </div>
                    )}

                    {/* Action row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 12, borderTop: "1px solid #f1f5f9", flexWrap: "wrap" }}>
                      {q.status === "pending" && (
                        <button className="adp-btn adp-btn--resolve" onClick={() => setAssignFor(q)}>
                          👨‍⚕️ Assign to Doctor
                        </button>
                      )}
                      {q.status === "assigned" && (
                        <button className="adp-btn adp-btn--ghost" onClick={() => setAssignFor(q)}>
                          ↺ Re-assign Doctor
                        </button>
                      )}
                      {q.status === "answered" && (
                        <>
                          <button
                            className="adp-btn adp-btn--approve"
                            onClick={() => setApproveFor(q)}
                            style={{ padding: "7px 16px", fontSize: 12.5 }}
                          >
                            ✓ Approve &amp; Publish
                          </button>
                          <button className="adp-btn adp-btn--ghost" onClick={() => setAssignFor(q)}>
                            ↺ Re-assign
                          </button>
                        </>
                      )}
                      {q.status === "approved" && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          fontSize: 12, fontWeight: 700, color: "#059669",
                          background: "#ecfdf5", border: "1px solid #6ee7b7",
                          padding: "5px 14px", borderRadius: 20,
                        }}>
                          🌐 Live — visible to users
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {assignFor  && <AssignModal  question={assignFor}  onClose={() => setAssignFor(null)}  onAssigned={handleAssigned} />}
      {approveFor && <ApproveModal question={approveFor} onClose={() => setApproveFor(null)} onApproved={handleApproved} />}
    </div>
  );
}
