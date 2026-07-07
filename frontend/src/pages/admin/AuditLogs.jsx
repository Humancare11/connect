import { useState, useEffect, useCallback } from "react";
import api from "../../api";

const ACTION_LABELS = {
  LOGIN_SUCCESS:            { label: "Login Success",           color: "#16a34a", bg: "#dcfce7" },
  LOGIN_FAILED:             { label: "Login Failed",            color: "#dc2626", bg: "#fee2e2" },
  LOGOUT:                  { label: "Logout",                  color: "#6b7280", bg: "#f3f4f6" },
  REGISTER:                { label: "Registration",            color: "#2563eb", bg: "#dbeafe" },
  PASSWORD_CHANGE:         { label: "Password Change",         color: "#d97706", bg: "#fef3c7" },
  PHI_VIEW_PRESCRIPTIONS:  { label: "View Prescriptions",      color: "#7c3aed", bg: "#ede9fe" },
  PHI_VIEW_CERTIFICATES:   { label: "View Certificates",       color: "#7c3aed", bg: "#ede9fe" },
  PHI_VIEW_PATIENT_LIST:   { label: "View Patient List",       color: "#7c3aed", bg: "#ede9fe" },
  PHI_VIEW_PATIENT_HISTORY:{ label: "View Patient History",    color: "#7c3aed", bg: "#ede9fe" },
  PHI_CREATE_PRESCRIPTION: { label: "Create Prescription",     color: "#0891b2", bg: "#cffafe" },
  PHI_CREATE_CERTIFICATE:  { label: "Create Certificate",      color: "#0891b2", bg: "#cffafe" },
  ADMIN_VIEW_USER:         { label: "Admin View User",         color: "#9a3412", bg: "#ffedd5" },
  ADMIN_DELETE_USER:       { label: "Admin Delete User",       color: "#dc2626", bg: "#fee2e2" },
  ADMIN_APPROVE_DOCTOR:    { label: "Approve Doctor",          color: "#16a34a", bg: "#dcfce7" },
  ADMIN_REJECT_DOCTOR:     { label: "Reject Doctor",           color: "#dc2626", bg: "#fee2e2" },
  ADMIN_DELETE_DOCTOR:     { label: "Delete Doctor",           color: "#dc2626", bg: "#fee2e2" },
  ADMIN_VIEW_AUDIT_LOGS:   { label: "View Audit Logs",         color: "#6b7280", bg: "#f3f4f6" },
  SECURITY_EVENT:          { label: "Security Event",          color: "#dc2626", bg: "#fee2e2" },
};

const ROLE_COLORS = {
  superadmin: { color: "#7c3aed", bg: "#ede9fe" },
  admin:      { color: "#2563eb", bg: "#dbeafe" },
  doctor:     { color: "#0891b2", bg: "#cffafe" },
  user:       { color: "#16a34a", bg: "#dcfce7" },
  anonymous:  { color: "#6b7280", bg: "#f3f4f6" },
};

function ActionBadge({ action }) {
  const meta = ACTION_LABELS[action] || { label: action, color: "#6b7280", bg: "#f3f4f6" };
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 600,
      color: meta.color,
      background: meta.bg,
      whiteSpace: "nowrap",
    }}>
      {meta.label}
    </span>
  );
}

function RoleBadge({ role }) {
  const meta = ROLE_COLORS[role] || ROLE_COLORS.anonymous;
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 600,
      color: meta.color,
      background: meta.bg,
      textTransform: "capitalize",
    }}>
      {role || "anonymous"}
    </span>
  );
}

function StatusDot({ success }) {
  return (
    <span style={{
      display: "inline-block",
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: success ? "#16a34a" : "#dc2626",
      marginRight: 6,
    }} />
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      padding: "18px 22px",
      flex: 1,
      minWidth: 140,
    }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || "#111827" }}>{value ?? "—"}</div>
      <div style={{ fontSize: 13, color: "#374151", marginTop: 2, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function AuditLogs() {
  const [logs, setLogs]       = useState([]);
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expanded, setExpanded]     = useState(null);

  const [filters, setFilters] = useState({
    action:    "",
    userRole:  "",
    success:   "",
    search:    "",
    startDate: "",
    endDate:   "",
  });

  const [pendingSearch, setPendingSearch] = useState("");

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get("/api/audit-logs/stats");
      setStats(data);
    } catch { /* stats are supplementary */ }
  }, []);

  const fetchLogs = useCallback(async (currentPage = 1, currentFilters = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: currentPage, limit: 50 });
      if (currentFilters.action)    params.set("action",    currentFilters.action);
      if (currentFilters.userRole)  params.set("userRole",  currentFilters.userRole);
      if (currentFilters.success !== "") params.set("success", currentFilters.success);
      if (currentFilters.search)    params.set("search",    currentFilters.search);
      if (currentFilters.startDate) params.set("startDate", currentFilters.startDate);
      if (currentFilters.endDate)   params.set("endDate",   currentFilters.endDate);

      const { data } = await api.get(`/api/audit-logs?${params}`);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchStats();
    fetchLogs(1, filters);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = () => {
    const next = { ...filters, search: pendingSearch };
    setFilters(next);
    setPage(1);
    fetchLogs(1, next);
  };

  const clearFilters = () => {
    const clean = { action: "", userRole: "", success: "", search: "", startDate: "", endDate: "" };
    setFilters(clean);
    setPendingSearch("");
    setPage(1);
    fetchLogs(1, clean);
  };

  const goToPage = (p) => {
    setPage(p);
    fetchLogs(p, filters);
  };

  const formatTs = (ts) => {
    const d = new Date(ts);
    return d.toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  };

  return (
    <div style={{ padding: "0 2px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>HIPAA Audit Logs</h2>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4, marginBottom: 0 }}>
          Immutable record of all PHI access and system actions. Accessible to Super Admin only.
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
          <StatCard label="Total Events"        value={stats.totalLogs}      sub="all time" />
          <StatCard label="Failed Attempts"     value={stats.failedAttempts} sub="all time"  color="#dc2626" />
          <StatCard label="PHI Access Events"   value={stats.phiAccesses}    sub="all time"  color="#7c3aed" />
          <StatCard label="Admin Actions"       value={stats.adminActions}   sub="all time"  color="#2563eb" />
          <StatCard label="Today"               value={stats.logsToday}      sub="last 24 h" />
          <StatCard label="This Week"           value={stats.logsThisWeek}   sub="last 7 days" />
        </div>
      )}

      {/* Filters */}
      <div style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: "16px 20px",
        marginBottom: 20,
      }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Search</label>
            <input
              type="text"
              placeholder="Name, email, IP…"
              value={pendingSearch}
              onChange={e => setPendingSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && applyFilters()}
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Action</label>
            <select
              value={filters.action}
              onChange={e => setFilters(p => ({ ...p, action: e.target.value }))}
              style={inputStyle}
            >
              <option value="">All Actions</option>
              {Object.entries(ACTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Role</label>
            <select
              value={filters.userRole}
              onChange={e => setFilters(p => ({ ...p, userRole: e.target.value }))}
              style={inputStyle}
            >
              <option value="">All Roles</option>
              <option value="user">Patient</option>
              <option value="doctor">Doctor</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Super Admin</option>
              <option value="anonymous">Anonymous</option>
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</label>
            <select
              value={filters.success}
              onChange={e => setFilters(p => ({ ...p, success: e.target.value }))}
              style={inputStyle}
            >
              <option value="">All</option>
              <option value="true">Success</option>
              <option value="false">Failed</option>
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>From</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={e => setFilters(p => ({ ...p, startDate: e.target.value }))}
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>To</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={e => setFilters(p => ({ ...p, endDate: e.target.value }))}
              style={inputStyle}
            />
          </div>

          <button onClick={applyFilters} style={primaryBtn}>Apply</button>
          <button onClick={clearFilters} style={ghostBtn}>Clear</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
        <div style={{
          padding: "14px 20px",
          borderBottom: "1px solid #f3f4f6",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
            {loading ? "Loading…" : `${total.toLocaleString()} event${total !== 1 ? "s" : ""}`}
          </span>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>
            Page {page} of {totalPages}
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                {["Timestamp", "Status", "Action", "User", "Role", "IP Address", "Resource", "Details"].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af" }}>
                    Loading audit logs…
                  </td>
                </tr>
              )}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af" }}>
                    No audit log entries found.
                  </td>
                </tr>
              )}
              {!loading && logs.map((log) => (
                <>
                  <tr
                    key={log._id}
                    onClick={() => setExpanded(expanded === log._id ? null : log._id)}
                    style={{
                      borderTop: "1px solid #f3f4f6",
                      cursor: "pointer",
                      background: expanded === log._id ? "#fafafa" : log.success ? "#fff" : "#fff9f9",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => { if (expanded !== log._id) e.currentTarget.style.background = "#f9fafb"; }}
                    onMouseLeave={e => { if (expanded !== log._id) e.currentTarget.style.background = log.success ? "#fff" : "#fff9f9"; }}
                  >
                    <td style={tdStyle}>
                      <span style={{ fontFamily: "monospace", fontSize: 12, color: "#374151", whiteSpace: "nowrap" }}>
                        {formatTs(log.timestamp)}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <StatusDot success={log.success} />
                      <span style={{ fontSize: 11, color: log.success ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                        {log.success ? "OK" : "FAIL"}
                      </span>
                    </td>
                    <td style={tdStyle}><ActionBadge action={log.action} /></td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, color: "#111827" }}>{log.userName || "—"}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>{log.userEmail || ""}</div>
                    </td>
                    <td style={tdStyle}><RoleBadge role={log.userRole} /></td>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12, color: "#6b7280" }}>
                      {log.ipAddress || "—"}
                    </td>
                    <td style={tdStyle}>
                      {log.resource && (
                        <span style={{ color: "#374151" }}>
                          {log.resource}
                          {log.resourceId && (
                            <span style={{ color: "#9ca3af", fontSize: 11, display: "block", fontFamily: "monospace" }}>
                              {log.resourceId.slice(-8)}…
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {Object.keys(log.details || {}).length > 0 ? (
                        <span style={{ color: "#2563eb", fontSize: 12, fontWeight: 500 }}>
                          {expanded === log._id ? "▲ Hide" : "▼ Show"}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                  {expanded === log._id && (
                    <tr key={`${log._id}-exp`} style={{ background: "#f9fafb" }}>
                      <td colSpan={8} style={{ padding: "12px 20px" }}>
                        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 12 }}>
                          {log.patientId && (
                            <div>
                              <span style={{ fontWeight: 600, color: "#7c3aed" }}>Patient ID: </span>
                              <code style={{ background: "#ede9fe", padding: "1px 6px", borderRadius: 4 }}>{log.patientId}</code>
                            </div>
                          )}
                          {log.resourceId && (
                            <div>
                              <span style={{ fontWeight: 600, color: "#374151" }}>Resource ID: </span>
                              <code style={{ background: "#f3f4f6", padding: "1px 6px", borderRadius: 4 }}>{log.resourceId}</code>
                            </div>
                          )}
                          {log.userAgent && (
                            <div style={{ maxWidth: 400 }}>
                              <span style={{ fontWeight: 600, color: "#374151" }}>User Agent: </span>
                              <span style={{ color: "#6b7280" }}>{log.userAgent}</span>
                            </div>
                          )}
                          {Object.keys(log.details || {}).length > 0 && (
                            <div>
                              <span style={{ fontWeight: 600, color: "#374151" }}>Details: </span>
                              <pre style={{
                                display: "inline-block",
                                margin: 0,
                                background: "#f3f4f6",
                                padding: "4px 8px",
                                borderRadius: 6,
                                fontSize: 11,
                                color: "#374151",
                                maxWidth: 500,
                                overflowX: "auto",
                              }}>
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            padding: "14px 20px",
            borderTop: "1px solid #f3f4f6",
            display: "flex",
            gap: 8,
            justifyContent: "center",
            alignItems: "center",
          }}>
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page === 1}
              style={{ ...ghostBtn, opacity: page === 1 ? 0.4 : 1 }}
            >← Prev</button>

            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let p;
              if (totalPages <= 7) {
                p = i + 1;
              } else if (page <= 4) {
                p = i + 1;
              } else if (page >= totalPages - 3) {
                p = totalPages - 6 + i;
              } else {
                p = page - 3 + i;
              }
              return (
                <button
                  key={p}
                  onClick={() => goToPage(p)}
                  style={{
                    ...ghostBtn,
                    background: p === page ? "#2563eb" : "transparent",
                    color:      p === page ? "#fff"    : "#374151",
                    border:     p === page ? "1px solid #2563eb" : "1px solid #e5e7eb",
                    minWidth: 36,
                  }}
                >
                  {p}
                </button>
              );
            })}

            <button
              onClick={() => goToPage(page + 1)}
              disabled={page === totalPages}
              style={{ ...ghostBtn, opacity: page === totalPages ? 0.4 : 1 }}
            >Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: "7px 10px",
  fontSize: 13,
  outline: "none",
  color: "#111827",
  background: "#fff",
  minWidth: 140,
};

const primaryBtn = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "8px 18px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  alignSelf: "flex-end",
};

const ghostBtn = {
  background: "transparent",
  color: "#374151",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: "7px 14px",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  alignSelf: "flex-end",
};

const thStyle = {
  padding: "10px 16px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "11px 16px",
  verticalAlign: "top",
};
