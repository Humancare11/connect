import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import api from "../../api";
import { useAdmin } from "../../context/AdminContext";

export default function SuperAdminDashboard() {
  const { admin: user, loading: authLoading, logout: contextLogout } = useAdmin();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "admin" });
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "superadmin")) {
      navigate("/adminauth");
    }
  }, [user, authLoading, navigate]);

  const fetchAdmins = () => {
    api.get("/api/superadmin/admins")
      .then((res) => setAdmins(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) fetchAdmins();
  }, [user]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError(""); setFormSuccess("");
    setCreating(true);
    try {
      const res = await api.post("/api/superadmin/admins", form);
      setAdmins((prev) => [res.data.admin, ...prev]);
      setForm({ name: "", email: "", password: "", role: "admin" });
      setFormSuccess(form.role === "paymentadmin" ? "Payment Admin created successfully!" : "Admin created successfully!");
      setTimeout(() => setFormSuccess(""), 4000);
    } catch (err) {
      setFormError(err.response?.data?.msg || "Failed to create admin.");
    }
    setCreating(false);
  };

  const handleDelete = async (id) => {
    setDeleteConfirm(null);
    try {
      await api.delete(`/api/superadmin/admins/${id}`);
      setAdmins((prev) => prev.filter((a) => a._id !== id));
      setFormSuccess("Admin removed successfully.");
      setTimeout(() => setFormSuccess(""), 4000);
    } catch (err) {
      setFormError(err.response?.data?.msg || "Failed to remove admin.");
    }
  };

  const handleLogout = async () => {
    await contextLogout();
    navigate("/adminauth");
  };

  if (authLoading || !user) return null;

  return (
    <div className="dash-wrapper">
      {deleteConfirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.4)", display: "flex",
          alignItems: "center", justifyContent: "center", padding: 16,
        }} onClick={() => setDeleteConfirm(null)}>
          <div style={{
            background: "#fff", borderRadius: 14, padding: "28px 32px",
            maxWidth: 400, width: "100%", textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 17, color: "#111827" }}>Remove Admin?</h3>
            <p style={{ margin: "0 0 6px", fontSize: 14, color: "#374151" }}>
              You are about to remove <strong>{deleteConfirm.name}</strong>.
            </p>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: "#6b7280" }}>This action cannot be undone.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{ padding: "9px 20px", borderRadius: 8, border: "1.5px solid #d1d5db", background: "#fff", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >Cancel</button>
              <button
                onClick={() => handleDelete(deleteConfirm.id)}
                style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >Yes, Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="dash-sidebar" style={{ background: "#1e1b4b" }}>
        <div className="dash-sidebar-brand">
          <div className="dash-brand-mark" style={{ background: "#6d28d9" }}>H</div>
          <span>HumaniCare</span>
        </div>
        <div className="dash-profile">
          <div className="dash-avatar" style={{ background: "#6d28d9" }}>{user.name?.[0]?.toUpperCase()}</div>
          <div className="dash-profile-name">{user.name}</div>
          <div className="dash-profile-email">{user.email}</div>
          <span className="dash-role-badge" style={{ background: "#6d28d9" }}>Super Admin</span>
        </div>
        <nav className="dash-nav">
          <button className="dash-nav-item active">Manage Admins</button>
          <button className="dash-nav-item" onClick={() => navigate("/admin-dashboard")}>Admin Dashboard</button>
        </nav>
        <button className="dash-logout" onClick={handleLogout}>Logout</button>
      </aside>

      {/* Main */}
      <main className="dash-main">
        <header className="dash-topbar" style={{ borderBottom: "1px solid #ede9fe" }}>
          <div className="dash-topbar-title" style={{ color: "#6d28d9" }}>Super Admin Portal</div>
          <span className="dash-topbar-user">Welcome, {user.name}</span>
        </header>

        <div className="dash-content">
          {/* Create Admin form */}
          <div className="dash-section">
            <h2 className="dash-section-title">Create New Admin</h2>
            <form onSubmit={handleCreate} className="sa-form">
              {formError && <div className="sa-form-error">{formError}</div>}
              {formSuccess && <div className="sa-form-success">{formSuccess}</div>}
              <div className="sa-form-row">
                <div className="sa-field">
                  <label>Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Riya Sharma"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    disabled={creating}
                  />
                </div>
                <div className="sa-field">
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="admin@humancare.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    disabled={creating}
                  />
                </div>
                <div className="sa-field">
                  <label>Password</label>
                  <input
                    type="password"
                    placeholder="8+ chars, upper/lower, number, symbol"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    disabled={creating}
                  />
                </div>
                <div className="sa-field">
                  <label>Role</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    disabled={creating}
                  >
                    <option value="admin">Admin</option>
                    <option value="paymentadmin">Payment Admin</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="sa-create-btn" disabled={creating}>
                {creating ? "Creating…" : "+ Create Admin"}
              </button>
            </form>
          </div>

          {/* Admin list */}
          <div className="dash-section" style={{ marginTop: 24 }}>
            <h2 className="dash-section-title">All Admins ({admins.length})</h2>
            {loading ? (
              <p className="dash-empty">Loading admins...</p>
            ) : admins.length === 0 ? (
              <p className="dash-empty">No admins yet. Create one above.</p>
            ) : (
              <div className="dash-table-wrap">
                <table className="dash-table">
                  <thead>
                    <tr>
                      {["Name", "Email", "Role", "Created On", "Action"].map((h) => <th key={h}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((a, i) => (
                      <tr key={a._id} className={i % 2 === 0 ? "" : "alt"}>
                        <td className="bold">{a.name}</td>
                        <td className="muted">{a.email}</td>
                        <td className="muted">{a.role === "paymentadmin" ? "Payment Admin" : "Admin"}</td>
                        <td className="muted">{new Date(a.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                        <td>
                          <button
                            className="btn-reject"
                            onClick={() => setDeleteConfirm({ id: a._id, name: a.name })}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
