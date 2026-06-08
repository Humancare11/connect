import { useEffect, useMemo, useState } from "react";
import api from "../../api";
import { useDoctorAuth } from "../../context/DoctorAuthContext";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DoctorSettings() {
  const { doctor } = useDoctorAuth();
  const doctorId = doctor?._id || doctor?.id;
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");
  const [requestStatus, setRequestStatus] = useState("none");
  const [requestedAt, setRequestedAt] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    if (!doctorId) {
      setLoading(false);
      return () => { active = false; };
    }

    api.get(`/api/doctor/enrollment/${doctorId}`)
      .then((res) => {
        if (!active) return;
        const enrollment = res.data || {};
        setRequestStatus(enrollment.profileDeleteRequestStatus || "none");
        setRequestedAt(enrollment.profileDeleteRequestedAt || "");
        if (enrollment.profileDeleteReason) setReason(enrollment.profileDeleteReason);
      })
      .catch(() => {
        if (!active) return;
        setError("Unable to load account settings.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [doctorId]);

  const statusMeta = useMemo(() => {
    if (requestStatus === "pending") {
      return { label: "Delete Request Pending Admin Approval", bg: "#fef3c7", color: "#92400e" };
    }
    if (requestStatus === "rejected") {
      return { label: "Delete Request Rejected", bg: "#fee2e2", color: "#991b1b" };
    }
    if (requestStatus === "approved") {
      return { label: "Delete Request Approved", bg: "#dcfce7", color: "#166534" };
    }
    return { label: "No Active Delete Request", bg: "#f1f5f9", color: "#475569" };
  }, [requestStatus]);

  const submitDeleteRequest = async () => {
    if (!doctorId) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.post("/api/doctor/profile-delete-request", {
        reason: reason.trim(),
      });
      const enrollment = res.data?.enrollment || {};
      setRequestStatus(enrollment.profileDeleteRequestStatus || "pending");
      setRequestedAt(enrollment.profileDeleteRequestedAt || new Date().toISOString());
      setSuccess(res.data?.message || "Delete request sent to admin.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit delete request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dd-card">
      <h2 className="dd-card-title">Settings</h2>
      {loading ? (
        <p style={{ marginTop: 12, color: "#64748b" }}>Loading settings...</p>
      ) : (
        <div style={{ marginTop: 14 }}>
          <div style={{ marginBottom: 14 }}>
            <span
              style={{
                background: statusMeta.bg,
                color: statusMeta.color,
                fontSize: 12,
                fontWeight: 700,
                padding: "5px 12px",
                borderRadius: 20,
              }}
            >
              {statusMeta.label}
            </span>
            {requestedAt && (
              <p style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
                Requested on: {formatDate(requestedAt)}
              </p>
            )}
          </div>

          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fff7f7",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 15, color: "#991b1b" }}>Delete My Profile</h3>
            <p style={{ margin: "8px 0 12px", color: "#475569", fontSize: 13 }}>
              This request goes to admin for approval first. Your profile is deleted only after admin approves.
            </p>
            <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700, color: "#334155" }}>
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Tell admin why you want to delete your profile."
              style={{
                width: "100%",
                borderRadius: 8,
                border: "1px solid #fca5a5",
                padding: 10,
                resize: "vertical",
                fontSize: 13,
                fontFamily: "inherit",
                outline: "none",
                background: "#fff",
              }}
              disabled={submitting || requestStatus === "pending"}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={submitDeleteRequest}
                disabled={submitting || requestStatus === "pending"}
                style={{
                  border: "none",
                  borderRadius: 8,
                  padding: "9px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: submitting || requestStatus === "pending" ? "not-allowed" : "pointer",
                  background: submitting || requestStatus === "pending" ? "#fca5a5" : "#dc2626",
                  color: "#fff",
                }}
              >
                {submitting ? "Submitting..." : requestStatus === "pending" ? "Request Pending" : "Request Profile Deletion"}
              </button>
              {success && <span style={{ color: "#166534", fontSize: 12, fontWeight: 600 }}>{success}</span>}
              {error && <span style={{ color: "#b91c1c", fontSize: 12, fontWeight: 600 }}>{error}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
