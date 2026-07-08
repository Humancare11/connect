import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import api from "../../api";
import { useAdmin } from "../../context/AdminContext";

const CATEGORY_LABELS = {
  general: "General & Everyday Care",
  mental:  "Mental Health",
  skin:    "Skin & Hair",
  women:   "Women's Health",
  men:     "Men's Health",
  family:  "Children & Family",
  weight:  "Weight & Nutrition",
  chronic: "Chronic Care & Expert Opinion",
  eeb:     "Eye, Ear & Bone",
  sexual:  "Sexual Health",
  travel:  "Travel & Global Care",
};

const CATEGORY_ICONS = {
  general: "🩺", mental: "🧠", skin: "🧴", women: "🌸", men: "♂️",
  family:  "🧒", weight: "🥗", chronic: "📋", eeb: "🦴", sexual: "💗", travel: "✈️",
};

export default function PricingManagement() {
  const { admin: user, loading: authLoading, logout: contextLogout } = useAdmin();
  const navigate = useNavigate();

  const [records, setRecords]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [editing, setEditing]       = useState(null);   // categoryId being edited
  const [draftPrice, setDraftPrice] = useState("");
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState("");

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "superadmin")) {
      navigate("/adminauth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    api.get("/api/pricing/all")
      .then((res) => setRecords(res.data))
      .catch(() => setError("Failed to load pricing data."))
      .finally(() => setLoading(false));
  }, [user]);

  const handleEdit = (record) => {
    setEditing(record.categoryId);
    setDraftPrice(String(record.price));
    setError("");
    setSuccess("");
  };

  const handleCancel = () => {
    setEditing(null);
    setDraftPrice("");
  };

  const handleSave = async (categoryId) => {
    const price = Number(draftPrice);
    if (!Number.isFinite(price) || price < 0) {
      setError("Please enter a valid non-negative price.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await api.put(`/api/pricing/${categoryId}`, { price });
      setRecords((prev) =>
        prev.map((r) => r.categoryId === categoryId ? res.data.record : r),
      );
      setSuccess(`Price for "${CATEGORY_LABELS[categoryId]}" updated to $${price}.`);
      setEditing(null);
      setDraftPrice("");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to update price.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await contextLogout();
    navigate("/adminauth");
  };

  if (authLoading || !user) return null;

  return (
    <div className="dash-wrapper">
      {/* Sidebar */}
      <aside className="dash-sidebar" style={{ background: "#1e1b4b" }}>
        <div className="dash-sidebar-brand">
          <div className="dash-brand-mark" style={{ background: "#6d28d9" }}>H</div>
          <span>Humancare Connect</span>
        </div>
        <div className="dash-profile">
          <div className="dash-avatar" style={{ background: "#6d28d9" }}>{user.name?.[0]?.toUpperCase()}</div>
          <div className="dash-profile-name">{user.name}</div>
          <div className="dash-profile-email">{user.email}</div>
          <span className="dash-role-badge" style={{ background: "#6d28d9" }}>Super Admin</span>
        </div>
        <nav className="dash-nav">
          <button className="dash-nav-item" onClick={() => navigate("/superadmin-dashboard")}>Manage Admins</button>
          <button className="dash-nav-item active">Pricing Management</button>
          <button className="dash-nav-item" onClick={() => navigate("/admin-dashboard")}>Admin Dashboard</button>
        </nav>
        <button className="dash-logout" onClick={handleLogout}>Logout</button>
      </aside>

      {/* Main */}
      <main className="dash-main">
        <header className="dash-topbar" style={{ borderBottom: "1px solid #ede9fe" }}>
          <div className="dash-topbar-title" style={{ color: "#6d28d9" }}>Pricing Management</div>
          <span className="dash-topbar-user">Welcome, {user.name}</span>
        </header>

        <div className="dash-content">
          <div className="dash-section">
            <h2 className="dash-section-title">Category Prices</h2>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
              Set the consultation price for each category. All specialties and conditions under a category automatically use this price.
            </p>

            {error   && <div className="sa-form-error"   style={{ marginBottom: 16 }}>{error}</div>}
            {success && <div className="sa-form-success" style={{ marginBottom: 16 }}>{success}</div>}

            {loading ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "#6b7280" }}>Loading…</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: "#f5f3ff", borderBottom: "2px solid #ede9fe" }}>
                      <th style={thStyle}>Category</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Current Price</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Last Updated</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Updated By</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((rec) => (
                      <tr key={rec.categoryId} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 18, marginRight: 8 }}>{CATEGORY_ICONS[rec.categoryId]}</span>
                          <strong>{CATEGORY_LABELS[rec.categoryId] || rec.label}</strong>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          {editing === rec.categoryId ? (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                              <span style={{ color: "#6b7280" }}>$</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={draftPrice}
                                onChange={(e) => setDraftPrice(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSave(rec.categoryId);
                                  if (e.key === "Escape") handleCancel();
                                }}
                                autoFocus
                                style={{
                                  width: 90,
                                  padding: "6px 10px",
                                  border: "1.5px solid #6d28d9",
                                  borderRadius: 6,
                                  fontSize: 14,
                                  outline: "none",
                                  textAlign: "right",
                                }}
                              />
                            </div>
                          ) : (
                            <span style={{ fontWeight: 600, color: "#1e1b4b", fontSize: 15 }}>
                              ${rec.price.toLocaleString("en-US")}
                            </span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>
                          {rec.updatedAt
                            ? new Date(rec.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                            : "—"}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center", color: "#6b7280", fontSize: 12 }}>
                          {rec.updatedBy?.name || "—"}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          {editing === rec.categoryId ? (
                            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                              <button
                                onClick={() => handleSave(rec.categoryId)}
                                disabled={saving}
                                style={saveBtnStyle}
                              >
                                {saving ? "Saving…" : "Save"}
                              </button>
                              <button onClick={handleCancel} style={cancelBtnStyle}>Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => handleEdit(rec)} style={editBtnStyle}>
                              Edit
                            </button>
                          )}
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

const thStyle = {
  padding: "11px 16px",
  textAlign: "left",
  fontWeight: 600,
  fontSize: 12,
  color: "#4c1d95",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const tdStyle = {
  padding: "13px 16px",
  verticalAlign: "middle",
};

const editBtnStyle = {
  padding: "6px 18px",
  borderRadius: 7,
  border: "1.5px solid #6d28d9",
  background: "#fff",
  color: "#6d28d9",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const saveBtnStyle = {
  padding: "6px 18px",
  borderRadius: 7,
  border: "none",
  background: "#6d28d9",
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const cancelBtnStyle = {
  padding: "6px 14px",
  borderRadius: 7,
  border: "1.5px solid #d1d5db",
  background: "#fff",
  color: "#374151",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};
