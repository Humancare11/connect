import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import api from "../../api";
import { useAdmin } from "../../context/AdminContext";

function EyeIcon({ open }) {
  return open ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

// ── Admin Accounts tab ────────────────────────────────────────────────────────
function AdminsTab() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "admin" });
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchAdmins = () => {
    api.get("/api/superadmin/admins")
      .then((res) => setAdmins(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAdmins(); }, []);

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

  return (
    <>
      {deleteConfirm && (
        <DeleteConfirmDialog
          name={deleteConfirm.name}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={() => handleDelete(deleteConfirm.id)}
        />
      )}

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
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="8+ chars, upper/lower, number, symbol"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  disabled={creating}
                  style={{ paddingRight: 44 }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 5, display: "flex", alignItems: "center" }}>
                  <EyeIcon open={showPassword} />
                </button>
              </div>
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
                      <button className="btn-reject" onClick={() => setDeleteConfirm({ id: a._id, name: a.name })}>
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
    </>
  );
}

// ── Employee Admins tab ───────────────────────────────────────────────────────
function EmployeeAdminsTab() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createForm, setCreateForm] = useState({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const fetchEmployees = () => {
    api.get("/api/superadmin/employee-admins")
      .then((res) => setEmployees(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchEmployees(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError(""); setFormSuccess("");
    setCreating(true);
    try {
      const res = await api.post("/api/superadmin/employee-admins", createForm);
      setEmployees((prev) => [res.data.employee, ...prev]);
      setCreateForm({ name: "", email: "", password: "" });
      setFormSuccess("Employee Admin created successfully!");
      setTimeout(() => setFormSuccess(""), 4000);
    } catch (err) {
      setFormError(err.response?.data?.msg || "Failed to create Employee Admin.");
    }
    setCreating(false);
  };

  const handleDelete = async (id) => {
    setDeleteConfirm(null);
    try {
      await api.delete(`/api/superadmin/employee-admins/${id}`);
      setEmployees((prev) => prev.filter((e) => e._id !== id));
      setFormSuccess("Employee Admin removed.");
      setTimeout(() => setFormSuccess(""), 4000);
    } catch (err) {
      setFormError(err.response?.data?.msg || "Failed to remove Employee Admin.");
    }
  };

  const handleToggleDisable = async (emp) => {
    try {
      const res = await api.put(`/api/superadmin/employee-admins/${emp._id}/toggle-disable`);
      setEmployees((prev) =>
        prev.map((e) =>
          e._id === emp._id ? { ...e, accountDisabled: res.data.accountDisabled } : e
        )
      );
      setFormSuccess(res.data.msg);
      setTimeout(() => setFormSuccess(""), 4000);
    } catch (err) {
      setFormError(err.response?.data?.msg || "Failed to update account status.");
    }
  };

  const openEdit = (emp) => {
    setEditTarget(emp);
    setEditForm({ name: emp.name, email: emp.email });
    setEditError("");
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setEditError("");
    setEditSaving(true);
    try {
      const res = await api.put(`/api/superadmin/employee-admins/${editTarget._id}`, editForm);
      setEmployees((prev) =>
        prev.map((emp) => (emp._id === editTarget._id ? res.data.employee : emp))
      );
      setEditTarget(null);
      setFormSuccess("Employee Admin updated.");
      setTimeout(() => setFormSuccess(""), 4000);
    } catch (err) {
      setEditError(err.response?.data?.msg || "Failed to update Employee Admin.");
    }
    setEditSaving(false);
  };

  return (
    <>
      {deleteConfirm && (
        <DeleteConfirmDialog
          name={deleteConfirm.name}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={() => handleDelete(deleteConfirm.id)}
        />
      )}

      {editTarget && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setEditTarget(null)}
        >
          <div
            style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", maxWidth: 440, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 20px", fontSize: 17, color: "#111827" }}>Edit Employee Admin</h3>
            {editError && <div className="sa-form-error" style={{ marginBottom: 12 }}>{editError}</div>}
            <form onSubmit={handleEdit}>
              <div className="sa-field" style={{ marginBottom: 14 }}>
                <label>Full Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                  disabled={editSaving}
                />
              </div>
              <div className="sa-field" style={{ marginBottom: 20 }}>
                <label>Email Address</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  required
                  disabled={editSaving}
                />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  style={{ padding: "9px 20px", borderRadius: 8, border: "1.5px solid #d1d5db", background: "#fff", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#0369a1", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: editSaving ? 0.7 : 1 }}
                >
                  {editSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="dash-section">
        <h2 className="dash-section-title">Create New Employee Admin</h2>
        <form onSubmit={handleCreate} className="sa-form">
          {formError && <div className="sa-form-error">{formError}</div>}
          {formSuccess && <div className="sa-form-success">{formSuccess}</div>}
          <div className="sa-form-row">
            <div className="sa-field">
              <label>Full Name</label>
              <input
                type="text"
                placeholder="e.g. Priya Nair"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                required
                disabled={creating}
              />
            </div>
            <div className="sa-field">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="employee@humancare.com"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                required
                disabled={creating}
              />
            </div>
            <div className="sa-field">
              <label>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="8+ chars, upper/lower, number, symbol"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  required
                  disabled={creating}
                  style={{ paddingRight: 44 }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 5, display: "flex", alignItems: "center" }}>
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>
          </div>
          <button type="submit" className="sa-create-btn" disabled={creating}>
            {creating ? "Creating…" : "+ Create Employee Admin"}
          </button>
        </form>
      </div>

      <div className="dash-section" style={{ marginTop: 24 }}>
        <h2 className="dash-section-title">All Employee Admins ({employees.length})</h2>
        {loading ? (
          <p className="dash-empty">Loading employee admins...</p>
        ) : employees.length === 0 ? (
          <p className="dash-empty">No Employee Admins yet. Create one above.</p>
        ) : (
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  {["Name", "Email", "Status", "Created On", "Actions"].map((h) => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, i) => (
                  <tr key={emp._id} className={i % 2 === 0 ? "" : "alt"}>
                    <td className="bold">{emp.name}</td>
                    <td className="muted">{emp.email}</td>
                    <td>
                      <span style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        background: emp.accountDisabled ? "#fef2f2" : "#f0fdf4",
                        color: emp.accountDisabled ? "#dc2626" : "#16a34a",
                      }}>
                        {emp.accountDisabled ? "Disabled" : "Active"}
                      </span>
                    </td>
                    <td className="muted">{new Date(emp.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          className="btn-approve"
                          onClick={() => openEdit(emp)}
                          style={{ fontSize: 12, padding: "4px 12px" }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleDisable(emp)}
                          style={{
                            fontSize: 12,
                            padding: "4px 12px",
                            borderRadius: 6,
                            border: "none",
                            cursor: "pointer",
                            fontWeight: 600,
                            background: emp.accountDisabled ? "#f0fdf4" : "#fff3cd",
                            color: emp.accountDisabled ? "#16a34a" : "#92400e",
                          }}
                        >
                          {emp.accountDisabled ? "Enable" : "Disable"}
                        </button>
                        <button
                          className="btn-reject"
                          onClick={() => setDeleteConfirm({ id: emp._id, name: emp.name })}
                          style={{ fontSize: 12, padding: "4px 12px" }}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ── Shared confirm dialog ─────────────────────────────────────────────────────
function DeleteConfirmDialog({ name, onCancel, onConfirm }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onCancel}
    >
      <div
        style={{ background: "#fff", borderRadius: 14, padding: "28px 32px", maxWidth: 400, width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚠</div>
        <h3 style={{ margin: "0 0 8px", fontSize: 17, color: "#111827" }}>Remove Account?</h3>
        <p style={{ margin: "0 0 6px", fontSize: 14, color: "#374151" }}>
          You are about to remove <strong>{name}</strong>.
        </p>
        <p style={{ margin: "0 0 24px", fontSize: 13, color: "#6b7280" }}>This action cannot be undone.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={onCancel} style={{ padding: "9px 20px", borderRadius: 8, border: "1.5px solid #d1d5db", background: "#fff", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Yes, Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main SuperAdminDashboard ──────────────────────────────────────────────────
export default function SuperAdminDashboard() {
  const { admin: user, loading: authLoading, logout: contextLogout } = useAdmin();
  const [activeTab, setActiveTab] = useState("admins");
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "superadmin")) {
      navigate("/adminauth");
    }
  }, [user, authLoading, navigate]);

  const handleLogout = async () => {
    await contextLogout();
    navigate("/adminauth");
  };

  if (authLoading || !user) return null;

  return (
    <div className="dash-wrapper">
      <aside className="dash-sidebar" style={{ background: "#1e1b4b" }}>
        <div className="dash-sidebar-brand">
          <div className="dash-brand-mark" style={{ background: "#6d28d9" }}>H</div>
          <span>Humancare</span>
        </div>
        <div className="dash-profile">
          <div className="dash-avatar" style={{ background: "#6d28d9" }}>{user.name?.[0]?.toUpperCase()}</div>
          <div className="dash-profile-name">{user.name}</div>
          <div className="dash-profile-email">{user.email}</div>
          <span className="dash-role-badge" style={{ background: "#6d28d9" }}>Super Admin</span>
        </div>
        <nav className="dash-nav">
          <button
            className={`dash-nav-item${activeTab === "admins" ? " active" : ""}`}
            onClick={() => setActiveTab("admins")}
          >
            Manage Admins
          </button>
          <button
            className={`dash-nav-item${activeTab === "employeeAdmins" ? " active" : ""}`}
            onClick={() => setActiveTab("employeeAdmins")}
          >
            Employee Admins
          </button>
          <button className="dash-nav-item" onClick={() => navigate("/superadmin-dashboard/healthcare-management")}>
            Healthcare Management
          </button>
          <button className="dash-nav-item" onClick={() => navigate("/admin-dashboard/payment-links")}>
            Payment Links
          </button>
          <button className="dash-nav-item" onClick={() => navigate("/admin-dashboard/payment-link-history")}>
            Payment History
          </button>
          <button className="dash-nav-item" onClick={() => navigate("/admin-dashboard")}>
            Admin Dashboard
          </button>
        </nav>
        <button className="dash-logout" onClick={handleLogout}>Logout</button>
      </aside>

      <main className="dash-main">
        <header className="dash-topbar" style={{ borderBottom: "1px solid #ede9fe" }}>
          <div className="dash-topbar-title" style={{ color: "#6d28d9" }}>Super Admin Portal</div>
          <span className="dash-topbar-user">Welcome, {user.name}</span>
        </header>

        <div className="dash-content">
          {activeTab === "admins" && <AdminsTab />}
          {activeTab === "employeeAdmins" && <EmployeeAdminsTab />}
        </div>
      </main>
    </div>
  );
}
