import { useEffect, useState } from "react";
import api from "../../api";

function UserModal({ user, onClose, onDelete }) {
  if (!user) return null;
  const row = (label, value) => value ? (
    <div className="adp-detail-row">
      <span className="adp-detail-label">{label}</span>
      <span className="adp-detail-value">{value}</span>
    </div>
  ) : null;

  return (
    <div className="adp-overlay" onClick={onClose}>
      <div className="adp-modal" onClick={e => e.stopPropagation()}>
        <div className="adp-modal-header">
          <h3 className="adp-modal-title">User Profile</h3>
          <button className="adp-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="adp-modal-body">
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, padding: "14px 18px", background: "#f8fafc", borderRadius: 12 }}>
            <div className="adp-avatar" style={{ width: 52, height: 52, fontSize: 20, borderRadius: 14, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff" }}>
              {user.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{user.name}</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>{user.email}</div>
              <span className="adp-badge adp-badge--approved" style={{ marginTop: 6 }}>User</span>
            </div>
          </div>
          {row("Email",          user.email)}
          {row("Mobile",         user.mobile)}
          {row("Gender",         user.gender)}
          {row("Date of Birth",  user.dob)}
          {row("Role",           user.role)}
          {row("Account Created", new Date(user.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }))}
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
    } catch (err) {
      showToast("Failed to delete user.", false);
    }
  };

  const filtered = users.filter(u =>
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
          <div className="adp-stat-value">{users.filter(u => { const d = new Date(u.createdAt); const now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length}</div>
          <div className="adp-stat-label">Joined This Month</div>
        </div>
      </div>

      <div className="adp-card">
        <div className="adp-card-header">
          <h2 className="adp-card-title">All Users ({filtered.length})</h2>
          <div className="adp-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} />
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
                  <th>Mobile</th>
                  <th>Gender</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u._id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="adp-avatar" style={{ background: "#ede9fe", color: "#7c3aed" }}>{u.name?.[0]?.toUpperCase() || "U"}</div>
                        <div>
                          <div style={{ fontWeight: 600, color: "#0f172a" }}>{u.name}</div>
                          <div style={{ fontSize: 12, color: "#94a3b8" }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{u.mobile || "—"}</td>
                    <td style={{ textTransform: "capitalize" }}>{u.gender || "—"}</td>
                    <td>{new Date(u.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
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
