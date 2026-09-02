import { useEffect, useState } from "react";
import api from "../../api";

const EMPTY_CREATE = {
  companyName: "",
  contactPersonName: "",
  contactEmail: "",
  contactPhone: "",
  country: "",
  address: "",
  billingCurrency: "usd",
  loginEmail: "",
  password: "",
};

export default function PartnerCompaniesTab() {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [editTarget, setEditTarget] = useState(null);

  const flash = (msg) => {
    setFormSuccess(msg);
    setTimeout(() => setFormSuccess(""), 4000);
  };

  const load = () => {
    api
      .get("/api/superadmin/partners")
      .then((res) => setPartners(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    setCreating(true);
    try {
      const res = await api.post("/api/superadmin/partners", createForm);
      setPartners((prev) => [res.data.partner, ...prev]);
      setCreateForm(EMPTY_CREATE);
      flash("Partner Company created.");
    } catch (err) {
      setFormError(err.response?.data?.msg || "Failed to create Partner Company.");
    }
    setCreating(false);
  };

  const toggleStatus = async (p) => {
    setBusyId(p._id);
    try {
      const res = await api.put(`/api/superadmin/partners/${p._id}/toggle-status`);
      setPartners((prev) => prev.map((x) => (x._id === p._id ? { ...x, status: res.data.status } : x)));
      flash(res.data.msg);
    } catch (err) {
      setFormError(err.response?.data?.msg || "Failed to update status.");
    }
    setBusyId(null);
  };

  const removePartner = async (p) => {
    if (!window.confirm(`Remove "${p.companyName}"? This cannot be undone.`)) return;
    setBusyId(p._id);
    try {
      await api.delete(`/api/superadmin/partners/${p._id}`);
      setPartners((prev) => prev.filter((x) => x._id !== p._id));
      flash("Partner Company removed.");
    } catch (err) {
      setFormError(err.response?.data?.msg || "Failed to remove Partner Company.");
    }
    setBusyId(null);
  };

  return (
    <>
      {editTarget && (
        <EditDialog
          partner={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(updated, msg) => {
            setPartners((prev) => prev.map((x) => (x._id === updated._id ? { ...x, ...updated } : x)));
            setEditTarget(null);
            flash(msg);
          }}
        />
      )}

      <div className="dash-section">
        <h2 className="dash-section-title">Create New Partner Company</h2>
        <form onSubmit={handleCreate} className="sa-form">
          {formError && <div className="sa-form-error">{formError}</div>}
          {formSuccess && <div className="sa-form-success">{formSuccess}</div>}
          <div className="sa-form-row">
            <Field label="Company Name *">
              <input
                required
                disabled={creating}
                value={createForm.companyName}
                onChange={(e) => setCreateForm({ ...createForm, companyName: e.target.value })}
              />
            </Field>
            <Field label="Contact Person">
              <input
                disabled={creating}
                value={createForm.contactPersonName}
                onChange={(e) => setCreateForm({ ...createForm, contactPersonName: e.target.value })}
              />
            </Field>
            <Field label="Contact Email">
              <input
                type="email"
                disabled={creating}
                value={createForm.contactEmail}
                onChange={(e) => setCreateForm({ ...createForm, contactEmail: e.target.value })}
              />
            </Field>
          </div>
          <div className="sa-form-row">
            <Field label="Contact Phone">
              <input
                disabled={creating}
                value={createForm.contactPhone}
                onChange={(e) => setCreateForm({ ...createForm, contactPhone: e.target.value })}
              />
            </Field>
            <Field label="Country">
              <input
                disabled={creating}
                value={createForm.country}
                onChange={(e) => setCreateForm({ ...createForm, country: e.target.value })}
              />
            </Field>
            <Field label="Billing Currency">
              <input
                disabled={creating}
                value={createForm.billingCurrency}
                onChange={(e) => setCreateForm({ ...createForm, billingCurrency: e.target.value })}
              />
            </Field>
          </div>
          <div className="sa-form-row">
            <Field label="Login Email *">
              <input
                type="email"
                required
                disabled={creating}
                value={createForm.loginEmail}
                onChange={(e) => setCreateForm({ ...createForm, loginEmail: e.target.value })}
              />
            </Field>
            <Field label="Login Password *">
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  disabled={creating}
                  placeholder="8+ chars, upper/lower, number, symbol"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  style={{ paddingRight: 60 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#64748b",
                    fontSize: 12,
                  }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </Field>
            <div className="sa-field" />
          </div>
          <button type="submit" className="sa-create-btn" disabled={creating}>
            {creating ? "Creating…" : "+ Create Partner Company"}
          </button>
        </form>
      </div>

      <div className="dash-section" style={{ marginTop: 24 }}>
        <h2 className="dash-section-title">All Partner Companies ({partners.length})</h2>
        {loading ? (
          <p className="dash-empty">Loading partner companies…</p>
        ) : partners.length === 0 ? (
          <p className="dash-empty">No Partner Companies yet. Create one above.</p>
        ) : (
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  {["Code", "Company", "Login Email", "Cases", "Status", "Created", "Actions"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {partners.map((p, i) => (
                  <tr key={p._id} className={i % 2 === 0 ? "" : "alt"}>
                    <td className="muted">{p.partnerCode}</td>
                    <td className="bold">{p.companyName}</td>
                    <td className="muted">{p.users?.[0]?.email || p.contactEmail || "—"}</td>
                    <td className="muted">{p.caseCount ?? 0}</td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 10px",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          background: p.status === "active" ? "#f0fdf4" : "#fef2f2",
                          color: p.status === "active" ? "#16a34a" : "#dc2626",
                        }}
                      >
                        {p.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="muted">
                      {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          className="btn-approve"
                          style={{ fontSize: 12, padding: "4px 12px" }}
                          onClick={() => setEditTarget(p)}
                        >
                          Manage
                        </button>
                        <button
                          disabled={busyId === p._id}
                          onClick={() => toggleStatus(p)}
                          style={{
                            fontSize: 12,
                            padding: "4px 12px",
                            borderRadius: 6,
                            border: "none",
                            cursor: "pointer",
                            fontWeight: 600,
                            background: p.status === "active" ? "#fff3cd" : "#f0fdf4",
                            color: p.status === "active" ? "#92400e" : "#16a34a",
                          }}
                        >
                          {p.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          className="btn-reject"
                          style={{ fontSize: 12, padding: "4px 12px" }}
                          disabled={busyId === p._id}
                          onClick={() => removePartner(p)}
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

function Field({ label, children }) {
  return (
    <div className="sa-field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function EditDialog({ partner, onClose, onSaved }) {
  const [profile, setProfile] = useState({
    companyName: partner.companyName || "",
    contactPersonName: partner.contactPersonName || "",
    contactEmail: partner.contactEmail || "",
    contactPhone: partner.contactPhone || "",
    country: partner.country || "",
    address: partner.address || "",
    billingCurrency: partner.billingCurrency || "usd",
  });
  const [login, setLogin] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const saveProfile = async () => {
    setErr("");
    setSaving(true);
    try {
      const res = await api.put(`/api/superadmin/partners/${partner._id}`, profile);
      onSaved(res.data.partner, "Partner Company updated.");
    } catch (e) {
      setErr(e.response?.data?.msg || "Failed to update company.");
      setSaving(false);
    }
  };

  const saveLogin = async () => {
    setErr("");
    setSaving(true);
    try {
      await api.put(`/api/superadmin/partners/${partner._id}/login`, login);
      onSaved({ _id: partner._id }, "Partner login updated. Existing sessions were signed out.");
    } catch (e) {
      setErr(e.response?.data?.msg || "Failed to update login.");
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "26px 30px",
          maxWidth: 520,
          width: "100%",
          maxHeight: "88vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: 17 }}>{partner.companyName}</h3>
        <p style={{ margin: "0 0 18px", fontSize: 12, color: "#64748b" }}>{partner.partnerCode}</p>
        {err && <div className="sa-form-error" style={{ marginBottom: 12 }}>{err}</div>}

        <h4 style={{ margin: "0 0 10px", fontSize: 13, color: "#374151" }}>Company profile</h4>
        {[
          ["companyName", "Company Name"],
          ["contactPersonName", "Contact Person"],
          ["contactEmail", "Contact Email"],
          ["contactPhone", "Contact Phone"],
          ["country", "Country"],
          ["address", "Address"],
          ["billingCurrency", "Billing Currency"],
        ].map(([k, label]) => (
          <div className="sa-field" key={k} style={{ marginBottom: 10 }}>
            <label>{label}</label>
            <input value={profile[k]} onChange={(e) => setProfile({ ...profile, [k]: e.target.value })} />
          </div>
        ))}
        <button className="sa-create-btn" disabled={saving} onClick={saveProfile}>
          Save company profile
        </button>

        <h4 style={{ margin: "22px 0 10px", fontSize: 13, color: "#374151" }}>Login account</h4>
        <div className="sa-field" style={{ marginBottom: 10 }}>
          <label>New display name (optional)</label>
          <input value={login.name} onChange={(e) => setLogin({ ...login, name: e.target.value })} />
        </div>
        <div className="sa-field" style={{ marginBottom: 10 }}>
          <label>New login email (optional)</label>
          <input value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} />
        </div>
        <div className="sa-field" style={{ marginBottom: 10 }}>
          <label>Reset password (optional)</label>
          <input
            type="password"
            value={login.password}
            onChange={(e) => setLogin({ ...login, password: e.target.value })}
          />
        </div>
        <button
          className="sa-create-btn"
          disabled={saving || (!login.name && !login.email && !login.password)}
          onClick={saveLogin}
        >
          Update login
        </button>

        <button
          onClick={onClose}
          style={{
            marginTop: 16,
            width: "100%",
            padding: "9px",
            borderRadius: 8,
            border: "1.5px solid #d1d5db",
            background: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
