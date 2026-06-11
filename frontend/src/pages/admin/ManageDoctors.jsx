import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";

const STEP_LABELS = ["Identity", "Professional", "Availability", "Payout", "Submitted"];

const STATUS_META = {
  pending: { label: "Pending", bg: "#fef3c7", color: "#92400e" },
  approved: { label: "Approved", bg: "#dcfce7", color: "#166534" },
  rejected: { label: "Rejected", bg: "#fee2e2", color: "#991b1b" },
};

const REQUEST_META = {
  none: { label: "No Active Request", bg: "#f8fafc", color: "#64748b" },
  new_enrollment: { label: "New Enrollment", bg: "#eff6ff", color: "#1d4ed8" },
  profile_update: { label: "Profile Update Request", bg: "#fef3c7", color: "#92400e" },
  profile_delete: { label: "Profile Delete Request", bg: "#fee2e2", color: "#991b1b" },
};

function inferProgress(enrollment) {
  if (!enrollment) return { completedSteps: 0, currentStep: 1 };
  if (enrollment.formCompleted) return { completedSteps: 5, currentStep: 5 };

  const hasStep4 = !!(enrollment.accountNumber || enrollment.paypalId || enrollment.payoutEmail);
  const hasStep3 = !!(enrollment.timezone || (enrollment.availability && Object.keys(enrollment.availability || {}).length > 0));
  const hasStep2 = !!(enrollment.specialization || enrollment.qualification);
  const hasStep1 = !!(enrollment.firstName || enrollment.phoneNumber);

  if (hasStep4) return { completedSteps: 4, currentStep: 5 };
  if (hasStep3) return { completedSteps: 3, currentStep: 4 };
  if (hasStep2) return { completedSteps: 2, currentStep: 3 };
  if (hasStep1) return { completedSteps: 1, currentStep: 2 };
  return { completedSteps: 0, currentStep: 1 };
}

function deriveStatus(enrollment, completedSteps) {
  if (enrollment?.approvalStatus === "approved") return "approved";
  if (enrollment?.approvalStatus === "rejected") return "rejected";
  return "pending";
}

function normalizeStatus(status, enrollment, completedSteps) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "approved") return "approved";
  if (normalized === "rejected") return "rejected";
  if (normalized === "pending") return "pending";
  return deriveStatus(enrollment, completedSteps);
}

function getProgress(enrollment) {
  const isApproved = enrollment?.approvalStatus === "approved";
  const fallback = inferProgress(enrollment);
  
  const completedSteps = isApproved ? 5 : (Number.isFinite(Number(enrollment?.completedSteps))
    ? Number(enrollment.completedSteps)
    : fallback.completedSteps);
  
  const currentStep = isApproved ? 5 : (Number.isFinite(Number(enrollment?.currentStep))
    ? Number(enrollment.currentStep)
    : fallback.currentStep);
    
  const status = normalizeStatus(enrollment?.applicationStatus, enrollment, completedSteps);

  const safeCompleted = Math.max(0, Math.min(5, completedSteps));
  const safeCurrent = Math.max(1, Math.min(5, currentStep));

  return {
    completedSteps: safeCompleted,
    currentStep: safeCurrent,
    currentStepLabel: enrollment?.currentStepLabel || STEP_LABELS[Math.max(0, Math.min(4, safeCurrent - 1))],
    status,
  };
}

function getRequestType(enrollment) {
  if (enrollment?.profileDeleteRequestStatus === "pending") return "profile_delete";
  if (enrollment?.pendingRequestType === "profile_delete") return "profile_delete";
  if (enrollment?.pendingRequestType === "profile_update") return "profile_update";
  if (enrollment?.pendingRequestType === "new_enrollment") return "new_enrollment";
  return "none";
}

function ProgressCell({ progress }) {
  const color = progress.status === "approved" ? "#0c8b7a" : progress.status === "rejected" ? "#ef4444" : "#f59e0b";
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ display: "flex", gap: 3, alignItems: "center", marginBottom: 4 }}>
        {STEP_LABELS.map((label, idx) => {
          const stepNo = idx + 1;
          const done = stepNo <= progress.completedSteps;
          const active = stepNo === progress.currentStep && !done;
          return (
            <div
              key={label}
              title={`Step ${stepNo}: ${label}`}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 4,
                background: done ? color : active ? "#fbbf24" : "#e2e8f0",
                transition: "all 0.3s ease",
              }}
            />
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b" }}>
          {progress.completedSteps}/5 COMPLETED
        </span>
        {progress.status === "pending" && (
           <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600 }}>
             @{progress.currentStepLabel}
           </span>
        )}
      </div>
    </div>
  );
}


export default function ManageDoctors() {
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState(null);

  const fetchDoctors = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get("/api/admin/doctors");
      setEnrollments(Array.isArray(res.data) ? res.data : []);
    } catch {
      if (!silent) setEnrollments([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDoctors();
    const id = setInterval(() => fetchDoctors(true), 10000);
    return () => clearInterval(id);
  }, [fetchDoctors]);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const upsertEnrollment = (enrollment) => {
    if (!enrollment) return;
    setEnrollments((prev) => prev.map((row) => (row._id === enrollment._id ? enrollment : row)));
  };

  const approveDoctor = async (id) => {
    try {
      const res = await api.put(`/api/admin/doctors/${id}/approve`, {});
      upsertEnrollment(res.data?.enrollment);
      showToast("Doctor approved successfully.");
    } catch (err) {
      showToast(err?.response?.data?.msg || "Approve action failed.", false);
    }
  };

  const rejectDoctor = async (id) => {
    try {
      const res = await api.put(`/api/admin/doctors/${id}/reject`, {});
      upsertEnrollment(res.data?.enrollment);
      showToast("Doctor rejected successfully.");
    } catch (err) {
      showToast(err?.response?.data?.msg || "Reject action failed.", false);
    }
  };

  const approveDeleteRequest = async (id) => {
    try {
      await api.put(`/api/admin/doctors/${id}/delete/approve`, {});
      setEnrollments((prev) => prev.filter((row) => row._id !== id));
      setSelected((prev) => (prev?._id === id ? null : prev));
      showToast("Doctor profile deletion approved.");
    } catch (err) {
      showToast(err?.response?.data?.msg || "Delete approval failed.", false);
    }
  };

  const rejectDeleteRequest = async (id) => {
    try {
      const res = await api.put(`/api/admin/doctors/${id}/delete/reject`, {});
      upsertEnrollment(res.data?.enrollment);
      showToast("Delete request rejected.");
    } catch (err) {
      showToast(err?.response?.data?.msg || "Delete rejection failed.", false);
    }
  };

  const counts = useMemo(() => {
    const statusOf = (row) => getProgress(row).status;
    return {
      all: enrollments.length,
      pending: enrollments.filter((row) => statusOf(row) === "pending").length,
      approved: enrollments.filter((row) => row.approvalStatus === "approved").length,
      rejected: enrollments.filter((row) => row.approvalStatus === "rejected").length,
      update_requests: enrollments.filter((row) => getRequestType(row) === "profile_update").length,
      delete_requests: enrollments.filter((row) => getRequestType(row) === "profile_delete").length,
    };
  }, [enrollments]);

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enrollments.filter((row) => {
      const name = `${row.firstName || ""} ${row.surname || ""}`.trim() || row.doctorId?.name || "";
      const email = row.email || row.doctorId?.email || "";
      const doctorNumericId = String(row.doctorId?.doctorId || "");

      const matchSearch =
        !q ||
        name.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q) ||
        doctorNumericId === q;
      if (!matchSearch) return false;

      const status = getProgress(row).status;
      const requestType = getRequestType(row);
      if (filter === "pending") return status === "pending";
      if (filter === "approved") return row.approvalStatus === "approved";
      if (filter === "rejected") return row.approvalStatus === "rejected";
      if (filter === "update_requests") return requestType === "profile_update";
      if (filter === "delete_requests") return requestType === "profile_delete";
      return true;
    });
  }, [enrollments, filter, search]);

  return (
    <div>
      {toast && (
        <div className={`adp-toast ${toast.ok ? "adp-toast--ok" : "adp-toast--err"}`}>
          <span>{toast.ok ? "OK" : "!"}</span> {toast.msg}
        </div>
      )}

      <div className="adp-header">
        <span className="adp-eyebrow">Admin Panel</span>
        <h1 className="adp-title">Manage Doctors</h1>
        <p className="adp-sub">Monitor registration progress, review update or delete requests, and control doctor onboarding.</p>
      </div>

      <div className="adp-stats" style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
        {[
          { label: "Total", value: counts.all, cls: "" },
          { label: "Pending", value: counts.pending, cls: "adp-stat--amber" },
          { label: "Approved", value: counts.approved, cls: "adp-stat--green" },
          { label: "Rejected", value: counts.rejected, cls: "" },
          { label: "Update Requests", value: counts.update_requests, cls: "" },
        ].map((card) => (
          <div key={card.label} className={`adp-stat ${card.cls}`}>
            <div className="adp-stat-value">{card.value}</div>
            <div className="adp-stat-label">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="adp-card">
        <div className="adp-card-header">
          <div className="adp-tabs">
            {[
              { key: "all", label: "All", count: counts.all },
              { key: "pending", label: "Pending", count: counts.pending },
              { key: "approved", label: "Approved", count: counts.approved },
              { key: "rejected", label: "Rejected", count: counts.rejected },
              { key: "update_requests", label: "Update Requests", count: counts.update_requests },
              { key: "delete_requests", label: "Delete Requests", count: counts.delete_requests },
            ].map((tab) => (
              <button
                key={tab.key}
                className={`adp-tab ${filter === tab.key ? "active" : ""}`}
                onClick={() => setFilter(tab.key)}
              >
                {tab.label}
                <span className="adp-tab-count">{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="adp-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Search by name, email or Doctor ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="adp-loading">
            <div className="adp-spinner" />
            <p>Loading doctors...</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="adp-empty">
            <div className="adp-empty-icon">D</div>
            <h3>No doctors found</h3>
            <p>No doctor records match your filter.</p>
          </div>
        ) : (
          <div className="adp-table-wrap">
            <table className="adp-table">
              <thead>
                <tr>
                  <th>Sr No</th>
                  <th>Doctor ID</th>
                  <th>Doctor</th>
                  <th>Request Type</th>
                  <th>Specialization</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((row, idx) => {
                  const progress = getProgress(row);
                  const statusMeta = STATUS_META[progress.status] || STATUS_META.pending;
                  const requestType = getRequestType(row);
                  const requestMeta = REQUEST_META[requestType] || REQUEST_META.none;
                  const name = `${row.firstName || ""} ${row.surname || ""}`.trim() || row.doctorId?.name || "-";
                  const email = row.email || row.doctorId?.email || "-";
                  const hasPendingProfileUpdate =
                    requestType === "profile_update" && (row.profileUpdateRequestStatus || "pending") === "pending";
                  const canApprove =
                    hasPendingProfileUpdate ||
                    (row.approvalStatus !== "approved" && (progress.completedSteps >= 4 || row.approvalStatus === "rejected"));

                  return (
                    <tr key={row._id}>
                      <td>{idx + 1}</td>
                      <td>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 13,
                            color: "#223a5e",
                            background: "#eff6ff",
                            padding: "3px 10px",
                            borderRadius: 8,
                            letterSpacing: 1,
                            border: "1px solid #bfdbfe",
                          }}
                        >
                          {row.doctorId?.doctorId || "-"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div className="adp-avatar">{name[0]?.toUpperCase() || "D"}</div>
                          <div>
                            <div style={{ fontWeight: 600, color: "#0f172a" }}>{name}</div>
                            <div style={{ fontSize: 12, color: "#94a3b8" }}>{email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            background: requestMeta.bg,
                            color: requestMeta.color,
                            padding: "3px 10px",
                            borderRadius: 50,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {requestMeta.label}
                        </span>
                      </td>
                      <td>{row.specialization || <span style={{ color: "#94a3b8" }}>-</span>}</td>
                      <td><ProgressCell progress={progress} /></td>
                      <td>
                        <span
                          style={{
                            background: statusMeta.bg,
                            color: statusMeta.color,
                            padding: "3px 10px",
                            borderRadius: 50,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {statusMeta.label}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button
                            className="adp-btn adp-btn--view"
                            onClick={() => navigate(`/admin-dashboard/doctor-profile/${row._id}`, { state: { enrollment: row, from: "manage-doctors" } })}
                          >
                            View Profile
                          </button>

                          {requestType === "profile_delete" ? (
                            <>
                              <button className="adp-btn adp-btn--approve" onClick={() => approveDeleteRequest(row._id)}>Approve Delete</button>
                              <button className="adp-btn adp-btn--reject" onClick={() => rejectDeleteRequest(row._id)}>Reject Delete</button>
                            </>
                          ) : (
                            <>
                              {canApprove && (
                                <button className="adp-btn adp-btn--approve" onClick={() => approveDoctor(row._id)}>Approve</button>
                              )}
                              {(row.approvalStatus !== "rejected" || hasPendingProfileUpdate) && (
                                <button className="adp-btn adp-btn--reject" onClick={() => rejectDoctor(row._id)}>Reject</button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
