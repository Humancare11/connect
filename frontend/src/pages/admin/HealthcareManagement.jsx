import { useEffect, useMemo, useState } from "react";
import api from "../../api";
import HealthcareIcon, { HEALTHCARE_ICON_OPTIONS } from "../../components/HealthcareIcon";
import "./HealthcareManagement.css";

const SECTIONS = [
  { id: "categories", label: "Categories", singular: "Category" },
  { id: "specialties", label: "Specialties", singular: "Specialty" },
  { id: "conditions", label: "Conditions", singular: "Condition" },
];

const EMPTY_FORMS = {
  categories: {
    name: "",
    icon: "",
    description: "",
    price: "0",
    isActive: true,
  },
  specialties: {
    categoryId: "",
    name: "",
    icon: "",
    description: "",
    isActive: true,
  },
  conditions: {
    categoryId: "",
    specialtyId: "",
    name: "",
    icon: "",
    description: "",
    isActive: true,
  },
};

function cloneForm(section) {
  return { ...EMPTY_FORMS[section] };
}

function relationId(value) {
  return typeof value === "object" && value ? value._id : value || "";
}

function relationName(value) {
  return typeof value === "object" && value ? value.name : "";
}

function IconPreview({ value }) {
  return (
    <span className="hcm-icon-preview">
      <HealthcareIcon name={value} size={18} fallback="-" />
    </span>
  );
}

function formatUsd(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "$0";
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function HealthcareManagement() {
  const [active, setActive] = useState("categories");
  const [categories, setCategories] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [form, setForm] = useState(cloneForm("categories"));
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const filteredSpecialties = useMemo(() => {
    if (!form.categoryId) return specialties;
    return specialties.filter((specialty) => relationId(specialty.categoryId) === form.categoryId);
  }, [form.categoryId, specialties]);

  const stats = useMemo(
    () => [
      { label: "Categories", value: categories.length, icon: "C", cls: "adp-stat--blue" },
      { label: "Specialties", value: specialties.length, icon: "S", cls: "adp-stat--green" },
      { label: "Conditions", value: conditions.length, icon: "H", cls: "adp-stat--amber" },
      {
        label: "Active Items",
        value: [...categories, ...specialties, ...conditions].filter((item) => item.isActive).length,
        icon: "A",
        cls: "adp-stat--purple",
      },
    ],
    [categories, specialties, conditions],
  );

  const loadAll = async () => {
    setLoading(true);
    setMessage({ type: "", text: "" });
    try {
      const [catRes, specRes, condRes] = await Promise.all([
        api.get("/api/superadmin/healthcare/categories"),
        api.get("/api/superadmin/healthcare/specialties"),
        api.get("/api/superadmin/healthcare/conditions"),
      ]);
      setCategories(catRes.data || []);
      setSpecialties(specRes.data || []);
      setConditions(condRes.data || []);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.msg || "Failed to load healthcare data." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const switchSection = (section) => {
    setActive(section);
    setForm(cloneForm(section));
    setEditing(null);
    setMessage({ type: "", text: "" });
  };

  const setField = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "categoryId" && active === "conditions") {
        next.specialtyId = "";
      }
      return next;
    });
  };

  const resetForm = () => {
    setForm(cloneForm(active));
    setEditing(null);
  };

  const editItem = (item) => {
    setEditing(item._id);
    setMessage({ type: "", text: "" });
    if (active === "categories") {
      setForm({
        name: item.name || "",
        icon: item.icon || "",
        description: item.description || "",
        price: String(item.price ?? 0),
        isActive: Boolean(item.isActive),
      });
      return;
    }
    if (active === "specialties") {
      setForm({
        categoryId: relationId(item.categoryId),
        name: item.name || "",
        icon: item.icon || "",
        description: item.description || "",
        isActive: Boolean(item.isActive),
      });
      return;
    }
    const specialty = item.specialtyId;
    setForm({
      categoryId: relationId(specialty?.categoryId),
      specialtyId: relationId(specialty),
      name: item.name || "",
      icon: item.icon || "",
      description: item.description || "",
      isActive: Boolean(item.isActive),
    });
  };

  const endpoint = `/api/superadmin/healthcare/${active}`;

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      const payload = { ...form };
      if (active === "conditions") delete payload.categoryId;
      const res = editing
        ? await api.put(`${endpoint}/${editing}`, payload)
        : await api.post(endpoint, payload);
      await loadAll();
      resetForm();
      setMessage({ type: "success", text: res.data?.msg || "Saved successfully." });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.msg || "Failed to save." });
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (item) => {
    const ok = window.confirm(`Delete "${item.name}"? This cannot be undone.`);
    if (!ok) return;
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      const res = await api.delete(`${endpoint}/${item._id}`);
      await loadAll();
      if (editing === item._id) resetForm();
      setMessage({ type: "success", text: res.data?.msg || "Deleted successfully." });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.msg || "Failed to delete." });
    } finally {
      setSaving(false);
    }
  };

  const rows = active === "categories" ? categories : active === "specialties" ? specialties : conditions;
  const activeSection = SECTIONS.find((section) => section.id === active);

  return (
    <div className="hcm-page">
      <div className="adp-header">
        <div className="adp-eyebrow">Super Admin</div>
        <h1 className="adp-title">Healthcare Management</h1>
        <p className="adp-sub">Manage appointment categories, specialties, and conditions for the future appointment tree API.</p>
      </div>

      <div className="adp-stats">
        {stats.map((stat) => (
          <div className={`adp-stat ${stat.cls}`} key={stat.label}>
            <div className="adp-stat-icon">{stat.icon}</div>
            <div className="adp-stat-value">{stat.value}</div>
            <div className="adp-stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="hcm-toolbar">
        <div className="hcm-tabs">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`hcm-tab${active === section.id ? " active" : ""}`}
              onClick={() => switchSection(section.id)}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {message.text && <div className={`hcm-alert ${message.type}`}>{message.text}</div>}

      {loading ? (
        <div className="adp-loading">
          <div className="adp-spinner" />
          Loading healthcare data...
        </div>
      ) : (
        <div className="hcm-grid">
          <section className="adp-card">
            <div className="adp-card-header">
              <h2 className="adp-card-title">{editing ? "Edit" : "Create"} {activeSection?.singular}</h2>
            </div>
            <form className="hcm-form" onSubmit={submit}>
              <div className="hcm-form-grid">
                {(active === "specialties" || active === "conditions") && (
                  <div className="hcm-field full">
                    <label>Category</label>
                    <select value={form.categoryId} onChange={(e) => setField("categoryId", e.target.value)} required>
                      <option value="">Select category</option>
                      {categories.map((category) => (
                        <option key={category._id} value={category._id}>{category.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {active === "conditions" && (
                  <div className="hcm-field full">
                    <label>Specialty</label>
                    <select value={form.specialtyId} onChange={(e) => setField("specialtyId", e.target.value)} required>
                      <option value="">Select specialty</option>
                      {filteredSpecialties.map((specialty) => (
                        <option key={specialty._id} value={specialty._id}>{specialty.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="hcm-field full">
                  <label>Name</label>
                  <input value={form.name} onChange={(e) => setField("name", e.target.value)} maxLength={120} required />
                </div>

                <div className="hcm-field full">
                  <label>React Icon Name</label>
                  <input
                    value={form.icon}
                    onChange={(e) => setField("icon", e.target.value)}
                    placeholder="stethoscope, brain, heart, eye..."
                    list="healthcare-icon-options"
                    maxLength={500}
                  />
                  <datalist id="healthcare-icon-options">
                    {HEALTHCARE_ICON_OPTIONS.map((icon) => (
                      <option key={icon.value} value={icon.value}>
                        {icon.label}
                      </option>
                    ))}
                  </datalist>
                </div>

                <div className="hcm-field full">
                  <label>Description</label>
                  <textarea value={form.description} onChange={(e) => setField("description", e.target.value)} maxLength={1000} />
                </div>

                {active === "categories" && (
                  <div className="hcm-field">
                    <label>Price (USD)</label>
                    <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setField("price", e.target.value)} required />
                  </div>
                )}

                <div className="hcm-field">
                  <label>Status</label>
                  <select value={String(form.isActive)} onChange={(e) => setField("isActive", e.target.value === "true")}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="hcm-actions">
                <button className="hcm-primary" type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</button>
                {editing && <button className="hcm-secondary" type="button" onClick={resetForm} disabled={saving}>Cancel</button>}
              </div>
            </form>
          </section>

          <section className="adp-card">
            <div className="adp-card-header">
              <h2 className="adp-card-title">{activeSection?.label}</h2>
            </div>
            <div className="adp-table-wrap">
              <table className="adp-table">
                <thead>
                  <tr>
                    <th>Sr. No.</th>
                    <th>Name</th>
                    {active === "categories" && <th>Price</th>}
                    {active !== "categories" && <th>Category</th>}
                    {active === "conditions" && <th>Specialty</th>}
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length ? rows.map((item, index) => (
                    <tr key={item._id}>
                      <td>{index + 1}</td>
                      <td>
                        <div className="hcm-icon-cell">
                          <IconPreview value={item.icon} />
                          <div>
                            <div className="hcm-row-title">{item.name}</div>
                            {item.description && <div className="hcm-row-sub">{item.description}</div>}
                          </div>
                        </div>
                      </td>
                      {active === "categories" && <td>{formatUsd(item.price)}</td>}
                      {active === "specialties" && <td>{relationName(item.categoryId) || "-"}</td>}
                      {active === "conditions" && <td>{relationName(item.specialtyId?.categoryId) || "-"}</td>}
                      {active === "conditions" && <td>{relationName(item.specialtyId) || "-"}</td>}
                      <td>
                        <span className={`hcm-status ${item.isActive ? "active" : "inactive"}`}>
                          {item.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="hcm-actions">
                          <button className="hcm-secondary" type="button" onClick={() => editItem(item)} disabled={saving}>Edit</button>
                          <button className="hcm-danger" type="button" onClick={() => removeItem(item)} disabled={saving}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={active === "conditions" ? 6 : 5}>
                        <div className="hcm-muted">No records found.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
