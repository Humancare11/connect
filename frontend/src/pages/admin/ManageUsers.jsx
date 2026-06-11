import { useEffect, useState } from "react";
import api from "../../api";
import "./ManageUsers.css";

function InfoSection({ title, children }) {
  return (
    <div style={{
      background: "rgba(248,250,252,0.8)",
      border: "1px solid rgba(255,255,255,0.75)",
      borderRadius: 12,
      padding: "14px 18px",
      marginBottom: 12,
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "#0e6ceb",
        marginBottom: 12,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ icon, label, value, noBorder }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
      padding: "8px 0",
      borderBottom: noBorder ? "none" : "1px solid rgba(255,255,255,0.6)",
    }}>
      <span style={{ fontSize: 15, width: 22, textAlign: "center", flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7ca3", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: value ? "#0b0443" : "#94a3b8" }}>
          {value || "Not provided"}
        </div>
      </div>
    </div>
  );
}

function formatPatientId(value) {
  if (value === undefined || value === null || value === "") return "—";
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 99999) {
    return String(numeric).padStart(5, "0");
  }
  return String(value);
}

function UserModal({ user, onClose, onDelete }) {
  if (!user) return null;

  const initials = user.name
    ? user.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  const joinedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
    : "—";

  return (
    <div className="adp-overlay" onClick={onClose}>
      <div className="adp-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>

        {/* Header */}
        <div className="adp-modal-header">
          <h3 className="adp-modal-title">User Profile</h3>
          <button className="adp-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="adp-modal-body" style={{ padding: "20px 22px" }}>

          {/* Hero / Identity */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "18px 20px",
            background: "linear-gradient(135deg, #0b0443 0%, #083ab0 100%)",
            borderRadius: 14,
            marginBottom: 14,
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: -30, right: -30,
              width: 120, height: 120,
              background: "rgba(255,255,255,0.06)",
              borderRadius: "50%",
              pointerEvents: "none",
            }} />
            <div style={{
              width: 60, height: 60, borderRadius: 16, flexShrink: 0,
              background: "rgba(255,255,255,0.15)",
              border: "2px solid rgba(255,255,255,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 800, color: "#fff",
              backdropFilter: "blur(8px)",
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.name}
              </div>
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.7)", marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.email}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)",
                  borderRadius: 20, padding: "3px 10px",
                  fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "capitalize",
                }}>
                  👤 {user.role || "User"}
                </span>
                {user.country && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 20, padding: "3px 10px",
                    fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)",
                  }}>
                    🌍 {user.country}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <InfoSection title="Personal Information">
            <InfoRow icon="📱" label="Mobile" value={user.mobile} />
            <InfoRow icon="⚧" label="Gender" value={user.gender} />
            <InfoRow icon="🎂" label="Date of Birth" value={user.dob} />
            <InfoRow icon="🌍" label="Country" value={user.country} noBorder />
          </InfoSection>

          {/* Account Information */}
          <InfoSection title="Account Information">
            <InfoRow icon="🆔" label="Patient ID" value={formatPatientId(user.patientId)} />
            <InfoRow icon="🔑" label="Role" value={user.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : "User"} />
            <InfoRow icon="📅" label="Member Since" value={joinedDate} />
            <InfoRow icon="🌐" label="Registration IP" value={user.registrationIp || "—"} noBorder />
          </InfoSection>

        </div>

        <div className="adp-modal-footer">
          <button className="adp-btn adp-btn--ghost" onClick={onClose}>Close</button>
          <button className="adp-btn adp-btn--reject" onClick={() => onDelete(user._id, user.name)}>Delete User</button>
        </div>
      </div>
    </div>
  );
}

export default function ManageUsers() {
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [search,   setSearch]   = useState("");
  const [toast,    setToast]    = useState(null);

  useEffect(() => {
    api.get("/api/admin/users")
      .then(r => setUsers(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000); };

  const handleDelete = async (userId, userName) => {
    if (!window.confirm(`Delete user "${userName}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/admin/users/${userId}`);
      setUsers(prev => prev.filter(u => u._id !== userId));
      setSelected(null);
      showToast("User deleted.");
    } catch {
      showToast("Failed to delete user.", false);
    }
  };

  const filtered = users.filter(u =>
    String(u.patientId || "").toLowerCase().includes(search.toLowerCase()) ||
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {toast && (
        <div className={`adp-toast ${toast.ok ? "adp-toast--ok" : "adp-toast--err"}`}>
          <span>{toast.ok ? "✓" : "!"}</span> {toast.msg}
        </div>
      )}
      {selected && <UserModal user={selected} onClose={() => setSelected(null)} onDelete={handleDelete} />}

      <div className="adp-header">
        <span className="adp-eyebrow">Admin Panel</span>
        <h1 className="adp-title">Manage Users</h1>
        <p className="adp-sub">View and manage all registered patient accounts.</p>
      </div>

      <div className="adp-stats" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        <div className="adp-stat adp-stat--blue">
          <div className="adp-stat-icon">👥</div>
          <div className="adp-stat-value">{users.length}</div>
          <div className="adp-stat-label">Total Users</div>
        </div>
        <div className="adp-stat adp-stat--green">
          <div className="adp-stat-icon">✅</div>
          <div className="adp-stat-value">{users.filter(u => u.role === "user").length}</div>
          <div className="adp-stat-label">Patients</div>
        </div>
        <div className="adp-stat adp-stat--purple">
          <div className="adp-stat-icon">🗓</div>
          <div className="adp-stat-value">{users.filter(u => {
            const d = new Date(u.createdAt); const now = new Date();
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          }).length}</div>
          <div className="adp-stat-label">Joined This Month</div>
        </div>
      </div>

      <div className="adp-card">
        <div className="adp-card-header">
          <h2 className="adp-card-title">All Users ({filtered.length})</h2>
          <div className="adp-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input placeholder="Search by patient ID, name or email…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="adp-loading"><div className="adp-spinner" /><p>Loading users…</p></div>
        ) : filtered.length === 0 ? (
          <div className="adp-empty">
            <div className="adp-empty-icon">👥</div>
            <h3>No users found</h3>
            <p>{search ? "Try a different search." : "No users have registered yet."}</p>
          </div>
        ) : (
          <div className="adp-table-wrap">
            <table className="adp-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Patient ID</th>
                  <th>Mobile</th>
                  <th>Gender</th>
                  <th>Country</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u._id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="adp-avatar" style={{ background: "#ede9fe", color: "#7c3aed" }}>
                          {u.name ? u.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() : "U"}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "#0f172a" }}>{u.name}</div>
                          <div style={{ fontSize: 12, color: "#94a3b8" }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", color: "#475569" }}>
                      {formatPatientId(u.patientId)}
                    </td>
                    <td>{u.mobile || "—"}</td>
                    <td style={{ textTransform: "capitalize" }}>{u.gender || "—"}</td>
                    <td>{u.country || "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="adp-btn adp-btn--view" onClick={() => setSelected(u)}>View</button>
                        <button className="adp-btn adp-btn--reject" onClick={() => handleDelete(u._id, u.name)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
