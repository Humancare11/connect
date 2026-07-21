import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import "./AdminDashboard.css";

function slugifyDoctorName(name) {
  return (
    (name || "")
      .replace(/^Dr\.?\s*/i, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "doctor"
  );
}

/* ── Main Page ──────────────────────────────────────────────────────────────── */
export default function OurDoctors() {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [workflowStats, setWorkflowStats] = useState({
    totalDoctors: 0,
    profileUpdateRequests: 0,
    profileDeleteRequests: 0,
  });

  useEffect(() => {
    Promise.all([
      api.get("/api/admin/approved-doctors"),
      api.get("/api/admin/doctor-workflow-stats"),
    ])
      .then(([doctorRes, statsRes]) => {
        setDoctors(doctorRes.data || []);
        setWorkflowStats({
          totalDoctors: Number(statsRes?.data?.totalDoctors || 0),
          profileUpdateRequests: Number(
            statsRes?.data?.profileUpdateRequests || 0,
          ),
          profileDeleteRequests: Number(
            statsRes?.data?.profileDeleteRequests || 0,
          ),
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const specializations = [
    ...new Set(doctors.map((d) => d.specialization).filter(Boolean)),
  ].sort();

  const displayed = doctors.filter((d) => {
    const name =
      `${d.firstName || ""} ${d.surname || ""}`.trim() ||
      d.doctorId?.name ||
      "";
    const email = d.email || d.doctorId?.email || "";
    const id = String(d.doctorId?.doctorId || "");
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      name.toLowerCase().includes(q) ||
      email.toLowerCase().includes(q) ||
      id.includes(q);
    const matchFilter = filter === "all" || d.specialization === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div>
      {/* Header */}
      <div className="adp-header">
        <span className="adp-eyebrow">Admin Panel</span>
        <h1 className="adp-title">Our Doctors</h1>
        <p className="adp-sub">
          All approved and active doctors on the platform.
        </p>
      </div>

      {/* Stats */}
      <div
        className="adp-stats"
        style={{ gridTemplateColumns: "repeat(3,1fr)" }}
      >
        {[
          {
            label: "Total Doctors",
            value: workflowStats.totalDoctors || doctors.length,
          },
          {
            label: "Profile Update Requests",
            value: workflowStats.profileUpdateRequests,
          },
          {
            label: "Profile Delete Requests",
            value: workflowStats.profileDeleteRequests,
          },
        ].map((s) => (
          <div key={s.label} className="adp-stat">
            <div className="adp-stat-value">{s.value}</div>
            <div className="adp-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="adp-card">
        <div className="adp-card-header">
          {/* Specialization tabs */}
          <div className="adp-tabs" style={{ flexWrap: "wrap" }}>
            <button
              className={`adp-tab ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All <span className="adp-tab-count">{doctors.length}</span>
            </button>
            {specializations.slice(0, 5).map((sp) => (
              <button
                key={sp}
                className={`adp-tab ${filter === sp ? "active" : ""}`}
                onClick={() => setFilter(sp)}
              >
                {sp}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="adp-search">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Search by name, email or Doctor ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="adp-loading">
            <div className="adp-spinner" />
            <p>Loading doctors…</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="adp-empty">
            <div className="adp-empty-icon">🩺</div>
            <h3>No approved doctors found</h3>
            <p>
              {search || filter !== "all"
                ? "Try adjusting your search or filter."
                : "No doctors have been approved yet."}
            </p>
          </div>
        ) : (
          <div className="adp-table-wrap">
            <table className="adp-table">
              <thead>
                <tr>
                  <th>Sr No</th>
                  <th>Doctor ID</th>
                  <th>Doctor</th>
                  <th>Specialization</th>
                  <th>Fees</th>
                  <th>Mobile Number</th>
                  <th>Action</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((d, idx) => {
                  const name =
                    `${d.firstName || ""} ${d.surname || ""}`.trim() ||
                    d.doctorId?.name ||
                    "—";
                  const email = d.email || d.doctorId?.email || "";
                  const phone = [d.countryCode, d.phoneNumber]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <tr key={d._id}>
                      <td>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#64748b",
                          }}
                        >
                          {idx + 1}
                        </span>
                      </td>
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
                          {d.doctorId?.doctorId || "—"}
                        </span>
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div className="adp-avatar">
                            {name[0]?.toUpperCase() || "D"}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: "#0f172a" }}>
                              Dr. {name}
                            </div>
                            <div style={{ fontSize: 12, color: "#94a3b8" }}>
                              {email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {d.specialization ? (
                          <span
                            style={{
                              background: "#f0fdf4",
                              color: "#166534",
                              padding: "3px 10px",
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {d.specialization}
                          </span>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                      <td>
                        {d.consultantFees ? (
                          <span style={{ fontWeight: 700, color: "#0c8b7a" }}>
                            ${d.consultantFees}
                          </span>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                      <td>
                        {phone ? (
                          <span
                            style={{ fontFamily: "monospace", fontSize: 13 }}
                          >
                            {phone}
                          </span>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="adp-btn adp-btn--view"
                          onClick={() =>
                            navigate(
                              `/admin-dashboard/doctor-profile/${d._id}`,
                              { state: { enrollment: d, from: "our-doctors" } },
                            )
                          }
                        >
                          View Profile
                        </button>
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            color: d.isOnline ? "#166534" : "#991b1b",
                            background: d.isOnline ? "#f0fdf4" : "#fef2f2",
                            border: `1px solid ${d.isOnline ? "#bbf7d0" : "#fecaca"}`,
                            padding: "3px 10px",
                            borderRadius: 999,
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: d.isOnline ? "#22c55e" : "#ef4444",
                              display: "inline-block",
                            }}
                          />
                          {d.isOnline ? "Online" : "Offline"}
                        </span>
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
