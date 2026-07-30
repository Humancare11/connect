import { useEffect, useState } from "react";
import api from "../../api";
import "./Dashboard.css";

const CATEGORY_ID = "general";
const FALLBACK_PRICE = 69;

function PrimaryCarePrice() {
  const [record, setRecord] = useState(null);
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadPrice = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/pricing/all");
      const found = Array.isArray(res.data)
        ? res.data.find((r) => r.categoryId === CATEGORY_ID)
        : null;
      setRecord(found || null);
      setPrice(found?.price ?? FALLBACK_PRICE);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to load primary care price.");
      setPrice(FALLBACK_PRICE);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrice();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const res = await api.put(`/api/pricing/${CATEGORY_ID}`, { price: Number(price) });
      setRecord(res.data.record);
      setPrice(res.data.record.price);
      setMessage("Primary Care price updated.");
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to update price.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dash-section">
      <h2 className="dash-section-title">Primary Care Price</h2>
      <p className="dash-empty" style={{ marginBottom: 16 }}>
        This is the price shown on the Primary Care Provider page. If the
        price can&apos;t be fetched, the site falls back to ${FALLBACK_PRICE}.
      </p>

      {loading ? (
        <p className="dash-empty">Loading...</p>
      ) : (
        <form onSubmit={handleSubmit} className="sa-form">
          {error && <div className="sa-form-error">{error}</div>}
          {message && <div className="sa-form-success">{message}</div>}

          <div className="sa-form-row">
            <div className="sa-field">
              <label>Price (USD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                disabled={saving}
              />
            </div>
          </div>

          {record?.updatedBy && (
            <p className="dash-empty">
              Last updated by {record.updatedBy.name || record.updatedBy.email}
              {record.updatedAt ? ` on ${new Date(record.updatedAt).toLocaleString()}` : ""}
            </p>
          )}

          <div className="sp-form-actions">
            <button type="submit" className="sa-create-btn" disabled={saving}>
              {saving ? "Saving..." : "Update Price"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default PrimaryCarePrice;
