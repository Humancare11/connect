import { useEffect, useState } from "react";
import api from "../../api";

const statusOptions = ["open", "investigating", "resolved", "false_positive"];

export default function SecurityIncidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [actionForm, setActionForm] = useState({ action: "", notes: "", status: "investigating" });
  const [policies, setPolicies] = useState([]);
  const [cleanupResult, setCleanupResult] = useState("");

  const fetchIncidents = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/security-incidents");
      setIncidents(res.data.items || []);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to load security incidents.");
    } finally {
      setLoading(false);
    }
  };

  const fetchPolicies = async () => {
    try {
      const res = await api.get("/api/retention-policies");
      setPolicies(res.data || []);
    } catch {
      setPolicies([]);
    }
  };

  useEffect(() => { fetchIncidents(); fetchPolicies(); }, []);

  const submitAction = async (e) => {
    e.preventDefault();
    if (!selected || !actionForm.action.trim()) return;
    try {
      const res = await api.post(`/api/security-incidents/${selected._id}/actions`, actionForm);
      setSelected(res.data.incident);
      setIncidents((prev) => prev.map((item) => item._id === selected._id ? res.data.incident : item));
      setActionForm({ action: "", notes: "", status: "investigating" });
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to update incident.");
    }
  };

  const savePolicies = async () => {
    try {
      const res = await api.put("/api/retention-policies", { policies });
      setPolicies(res.data || []);
      setCleanupResult("Retention policies saved.");
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to save retention policies.");
    }
  };

  const runCleanup = async () => {
    try {
      const res = await api.post("/api/retention-policies/cleanup");
      setCleanupResult(`Cleanup complete: ${JSON.stringify(res.data.deleted || {})}`);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to run cleanup.");
    }
  };

  const counts = incidents.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    acc[item.severity] = (acc[item.severity] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="dash-section">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
        <div>
          <h2 className="dash-section-title">Security Incident Dashboard</h2>
          <p className="dash-empty" style={{ margin: "4px 0 0" }}>
            Breach response workflow, alerts, investigation history, and suspicious activity review.
          </p>
        </div>
        <button className="btn-approve" onClick={fetchIncidents}>Refresh</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, margin: "18px 0" }}>
        {["open", "investigating", "critical", "high"].map((key) => (
          <div key={key} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>{key.replace("_", " ")}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: key === "critical" ? "#b91c1c" : "#111827" }}>{counts[key] || 0}</div>
          </div>
        ))}
      </div>

      {error && <div className="sa-form-error">{error}</div>}
      {loading ? (
        <p className="dash-empty">Loading incidents...</p>
      ) : (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                {["Severity", "Type", "Title", "Status", "User", "Detected", "Action"].map((h) => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => (
                <tr key={incident._id}>
                  <td className="bold">{incident.severity}</td>
                  <td>{incident.type}</td>
                  <td>{incident.title}</td>
                  <td>{incident.status}</td>
                  <td className="muted">{incident.userEmail || incident.userRole || "anonymous"}</td>
                  <td className="muted">{new Date(incident.createdAt).toLocaleString()}</td>
                  <td><button className="btn-view" onClick={() => setSelected(incident)}>Investigate</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div style={{ marginTop: 22, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 18 }}>
          <h3 style={{ margin: "0 0 8px" }}>{selected.title}</h3>
          <p style={{ color: "#475569", marginTop: 0 }}>{selected.description || "No description provided."}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, fontSize: 13 }}>
            <span><strong>Type:</strong> {selected.type}</span>
            <span><strong>Severity:</strong> {selected.severity}</span>
            <span><strong>Status:</strong> {selected.status}</span>
            <span><strong>IP:</strong> {selected.ipAddress || "-"}</span>
          </div>

          <h4 style={{ margin: "18px 0 8px" }}>Investigation History</h4>
          {(selected.investigationHistory || []).length === 0 ? (
            <p className="dash-empty">No investigation actions recorded.</p>
          ) : selected.investigationHistory.map((item, idx) => (
            <div key={idx} style={{ borderTop: "1px solid #e5e7eb", padding: "10px 0", fontSize: 13 }}>
              <strong>{item.action}</strong> by {item.actorEmail || item.actorRole} · {new Date(item.createdAt).toLocaleString()}
              {item.notes && <div style={{ color: "#475569", marginTop: 4 }}>{item.notes}</div>}
            </div>
          ))}

          <form onSubmit={submitAction} style={{ display: "grid", gap: 10, marginTop: 14 }}>
            <input value={actionForm.action} onChange={(e) => setActionForm((p) => ({ ...p, action: e.target.value }))} placeholder="Action taken" required />
            <textarea value={actionForm.notes} onChange={(e) => setActionForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Investigation notes" rows={3} />
            <select value={actionForm.status} onChange={(e) => setActionForm((p) => ({ ...p, status: e.target.value }))}>
              {statusOptions.map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}
            </select>
            <button className="btn-approve" type="submit">Record Action</button>
          </form>
        </div>
      )}

      <div style={{ marginTop: 22, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 18 }}>
        <h3 style={{ margin: "0 0 8px" }}>Data Retention Policy</h3>
        <p className="dash-empty" style={{ margin: "0 0 12px" }}>
          Configure retention periods for audit logs, authentication logs, clinical chat, medical records, uploaded files, and incidents.
        </p>
        <div style={{ display: "grid", gap: 10 }}>
          {policies.map((policy, index) => (
            <label key={policy.key} style={{ display: "grid", gridTemplateColumns: "1fr 130px 90px", gap: 10, alignItems: "center", fontSize: 13 }}>
              <span>{policy.label || policy.key}</span>
              <input
                type="number"
                min="1"
                value={policy.retentionDays}
                onChange={(e) => setPolicies((prev) => prev.map((item, idx) => idx === index ? { ...item, retentionDays: Number(e.target.value) } : item))}
              />
              <span>days</span>
            </label>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button className="btn-approve" type="button" onClick={savePolicies}>Save Policies</button>
          <button className="btn-view" type="button" onClick={runCleanup}>Run Cleanup</button>
        </div>
        {cleanupResult && <p style={{ fontSize: 13, color: "#166534", marginBottom: 0 }}>{cleanupResult}</p>}
      </div>
    </div>
  );
}
