import { useEffect, useState } from "react";
import api from "../../api";
import "./Dashboard.css";
import "./HealthcareManagement.css";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import {
  PRICE_CURRENCIES,
  MAX_PRICE,
  MAX_PRICE_INR,
  formatMoney,
  isMissingForeignPrice,
  checkCategoryPrices,
} from "./healthcarePrices";

const isSet = (value) => value !== null && value !== undefined;
const text = (value) => (isSet(value) ? String(value) : "");

function ServicesPrices() {
  const confirm = useConfirm();
  const emptyForm = {
    name: "",
    price: "",
    priceEur: "",
    priceGbp: "",
    priceInr: "",
    // Whether a EUR / GBP / INR price was already set when the service was opened: once set it can be changed but not cleared.
    priceEurLocked: false,
    priceGbpLocked: false,
    priceInrLocked: false,
    icon: "",
    description: "",
    slug: "",
  };
  const [services, setServices] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  // The table shows one currency at a time (USD by default); "Not set" where a service has no price in it yet.
  const [priceTab, setPriceTab] = useState("USD");
  const [missingOnly, setMissingOnly] = useState(false);

  const loadServices = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/services/admin");
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
    setError("");
    setMessage("");

    // The same rules as the server (which is the real check): all four prices on create, nothing cleared once set on edit.
    const problem = checkCategoryPrices(form, !editingId);
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      price: Number(form.price),
      icon: form.icon.trim(),
      description: form.description.trim(),
      // Only send slug when editing an existing service and the admin
      // explicitly changed it. On create, omit it so the backend derives
      // one from the name automatically.
      ...(editingId && form.slug.trim() ? { slug: form.slug.trim() } : {}),
    };
    // EUR / GBP / INR are sent when filled in; a service that was never priced in one may stay without it (shown as "Not set").
    for (const { field } of PRICE_CURRENCIES) {
      if (field !== "price" && String(form[field]).trim()) payload[field] = Number(form[field]);
    }

    try {
      const res = editingId
        ? await api.put(`/api/services/${editingId}`, payload)
        : await api.post("/api/services", payload);

      const saved = res.data.service;
      const shown = { ...saved, priceEur: saved.priceEur ?? null, priceGbp: saved.priceGbp ?? null, priceInr: saved.priceInr ?? null };
      setServices((prev) => {
        if (editingId) {
          return prev.map((service) => (service._id === shown._id ? shown : service));
        }
        return [...prev, shown].sort((a, b) => a.name.localeCompare(b.name));
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
      price: text(service.price),
      priceEur: text(service.priceEur),
      priceGbp: text(service.priceGbp),
      priceInr: text(service.priceInr),
      priceEurLocked: isSet(service.priceEur),
      priceGbpLocked: isSet(service.priceGbp),
      priceInrLocked: isSet(service.priceInr),
      icon: service.icon || "",
      description: service.description || "",
      slug: service.slug || "",
    });
    setError("");
    setMessage("");
  };

  const handleDelete = async (service) => {
    const ok = await confirm({
      title: "Delete service",
      message: `Delete ${service.name}?`,
      confirmText: "Delete",
      tone: "danger",
    });
    if (!ok) return;

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
      return <img decoding="async" className="sp-icon-img" src={value} alt="" />;
    }
    return <span className="sp-icon-text">{value}</span>;
  };

  const copySlug = async (slug) => {
    try {
      await navigator.clipboard.writeText(slug);
      setMessage(`Copied slug "${slug}" to clipboard.`);
    } catch {
      // Clipboard API can fail (permissions/insecure context) — not critical,
      // the slug is still visible in the table for manual copying.
    }
  };

  const tabField = PRICE_CURRENCIES.find((c) => c.code === priceTab).field;
  const missingCount = services.filter(isMissingForeignPrice).length;
  const visibleServices = missingOnly ? services.filter(isMissingForeignPrice) : services;

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
            <p className="hcm-price-help">
              {editingId
                ? "Enter each price by hand - nothing is converted. A price that is already set can be changed but not cleared; EUR / GBP / INR that show as empty can be filled in later."
                : "All four prices are required (more than 0, at most 2 decimals; at least 0.01, or 1 for INR; up to 100,000, and up to 10,00,000 for INR). Enter each by hand - nothing is converted. INR is what customers in India pay, through Razorpay."}
            </p>
          </div>

          <div className="sa-form-row">
            {PRICE_CURRENCIES.map(({ code, symbol, field, lockField }) => {
              const required = !editingId || field === "price" || Boolean(lockField && form[lockField]);
              return (
                <div className="sa-field" key={field}>
                  <label htmlFor={`sp-${field}`}>
                    Price ({code}) {symbol}
                    {!required && <span className="hcm-optional"> - not set</span>}
                  </label>
                  <input
                    id={`sp-${field}`}
                    type="number"
                    min={code === "INR" ? "1" : "0.01"}
                    max={code === "INR" ? MAX_PRICE_INR : MAX_PRICE}
                    step="0.01"
                    inputMode="decimal"
                    value={form[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    placeholder={code === "INR" ? "1499" : "25"}
                    required={required}
                    disabled={saving}
                  />
                </div>
              );
            })}
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

          {editingId && (
            <div className="sa-field">
              <label>
                Slug (used by the website to look up this service's price
                &mdash; changing it will break any page still using the old
                slug)
              </label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="auto-generated-from-name"
                disabled={saving}
              />
            </div>
          )}

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
        <h2 className="dash-section-title">All Services ({visibleServices.length})</h2>

        <div className="hcm-tabs hcm-price-tabs" role="tablist" aria-label="Price currency">
          {PRICE_CURRENCIES.map(({ code }) => (
            <button
              key={code}
              type="button"
              role="tab"
              aria-selected={priceTab === code}
              className={`hcm-tab${priceTab === code ? " active" : ""}`}
              onClick={() => setPriceTab(code)}
            >
              {code}
            </button>
          ))}
        </div>

        {missingCount > 0 && (
          <div className="hcm-banner" role="status">
            <span>
              <strong>{missingCount}</strong> {missingCount === 1 ? "service is" : "services are"} missing EUR/GBP/INR prices.
            </span>
            <button type="button" className="hcm-banner-btn" onClick={() => setMissingOnly((v) => !v)}>
              {missingOnly ? "Show all services" : "Show only these"}
            </button>
          </div>
        )}

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
                  <th>Slug</th>
                  <th>Description</th>
                  <th>Price ({priceTab})</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleServices.map((service, index) => (
                  <tr key={service._id} className={index % 2 === 0 ? "" : "alt"}>
                    <td>{renderIcon(service.icon)}</td>
                    <td className="bold">{service.name}</td>
                    <td className="muted">
                      <code
                        style={{ cursor: "pointer" }}
                        title="Click to copy"
                        onClick={() => copySlug(service.slug)}
                      >
                        {service.slug}
                      </code>
                    </td>
                    <td className="muted">{service.description}</td>
                    <td className="muted">
                      {formatMoney(service[tabField], priceTab) || <span className="hcm-not-set">Not set</span>}
                    </td>
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
