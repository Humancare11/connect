import { useEffect, useState } from "react";
import api from "../../api";
import "./Dashboard.css";

function ServicesPrices() {
  const emptyForm = { name: "", price: "", icon: "", description: "" };
  const [services, setServices] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadServices = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/services");
      setServices(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to load services.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId("");
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      name: form.name.trim(),
      price: Number(form.price),
      icon: form.icon.trim(),
      description: form.description.trim(),
    };

    try {
      const res = editingId
        ? await api.put(`/api/services/${editingId}`, payload)
        : await api.post("/api/services", payload);

      const saved = res.data.service;
      setServices((prev) => {
        if (editingId) {
          return prev.map((service) => (service._id === saved._id ? saved : service));
        }
        return [...prev, saved].sort((a, b) => a.name.localeCompare(b.name));
      });
      setMessage(editingId ? "Service updated." : "Service created.");
      resetForm();
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to save service.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (service) => {
    setEditingId(service._id);
    setForm({
      name: service.name || "",
      price: service.price ?? "",
      icon: service.icon || "",
      description: service.description || "",
    });
    setError("");
    setMessage("");
  };

  const handleDelete = async (service) => {
    if (!window.confirm(`Delete ${service.name}?`)) return;

    setError("");
    setMessage("");
    try {
      await api.delete(`/api/services/${service._id}`);
      setServices((prev) => prev.filter((item) => item._id !== service._id));
      if (editingId === service._id) resetForm();
      setMessage("Service deleted.");
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to delete service.");
    }
  };

  const renderIcon = (icon) => {
    const value = String(icon || "").trim();
    if (/^(https?:)?\/\//.test(value) || value.startsWith("/") || value.startsWith("data:image/")) {
      return <img className="sp-icon-img" src={value} alt="" />;
    }
    return <span className="sp-icon-text">{value}</span>;
  };

  return (
    <>
      <div className="dash-section">
        <h2 className="dash-section-title">
          {editingId ? "Edit Service" : "Create New Service"}
        </h2>

        <form onSubmit={handleSubmit} className="sa-form">
          {error && <div className="sa-form-error">{error}</div>}
          {message && <div className="sa-form-success">{message}</div>}

          <div className="sa-form-row">
            <div className="sa-field">
              <label>Service Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Online Doctor Consultation"
                required
                disabled={saving}
              />
            </div>
            <div className="sa-field">
              <label>Price</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="25"
                required
                disabled={saving}
              />
            </div>
            <div className="sa-field">
              <label>Icon</label>
              <input
                type="text"
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                placeholder="stethoscope or /icon.png"
                required
                disabled={saving}
              />
            </div>
          </div>

          <div className="sa-field">
            <label>Description</label>
            <textarea
              className="sp-textarea"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Short service description"
              required
              disabled={saving}
            />
          </div>

          <div className="sp-form-actions">
            <button type="submit" className="sa-create-btn" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update Service" : "+ Create Service"}
            </button>
            {editingId && (
              <button type="button" className="sp-cancel-btn" onClick={resetForm} disabled={saving}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="dash-section" style={{ marginTop: 24 }}>
        <h2 className="dash-section-title">All Services ({services.length})</h2>

        {loading ? (
          <p className="dash-empty">Loading services...</p>
        ) : services.length === 0 ? (
          <p className="dash-empty">No services yet. Create one above.</p>
        ) : (
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Icon</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Price</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service, index) => (
                  <tr key={service._id} className={index % 2 === 0 ? "" : "alt"}>
                    <td>{renderIcon(service.icon)}</td>
                    <td className="bold">{service.name}</td>
                    <td className="muted">{service.description}</td>
                    <td className="muted">${Number(service.price || 0).toFixed(2)}</td>
                    <td>
                      <div className="actions-cell">
                        <button className="btn-approve" type="button" onClick={() => handleEdit(service)}>
                          Edit
                        </button>
                        <button className="btn-reject" type="button" onClick={() => handleDelete(service)}>
                          Delete
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

export default ServicesPrices;
