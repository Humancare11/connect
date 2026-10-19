import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Country } from "country-state-city";
import api from "../../api";
import "./AdminAppointments.css";
import RetryButton from "../../components/ui/RetryButton";

function getCountryName(isoCode) {
  if (!isoCode) return "";
  const country = Country.getCountryByCode(isoCode);
  return country?.name || isoCode;
}

// Admin-only list cell: did a video call happen, how long, did it connect, was
// anything wrong. Links to the call report.
function CallBadge({ summary, id }) {
  if (!summary) return <span style={{ color: "#9ca3af" }}>-</span>;
  const color = summary.hasProblem ? "#b45309" : summary.connected ? "#15803d" : "#6b7280";
  return (
    <Link
      to={`/admin-dashboard/appointments/${id}/call-report`}
      title={summary.firstProblem || (summary.connected ? "Call connected" : "Joined, but never connected")}
      style={{ color, textDecoration: "none", fontSize: 12, whiteSpace: "nowrap" }}
    >
      <span aria-hidden="true">📞</span> {summary.durationLabel || "0s"}
      {summary.inProgress ? " · live" : ""}
      <br />
      {summary.connected ? "Connected" : "Not connected"}
      {summary.hasProblem && (
        <span style={{ marginLeft: 6, background: "#fef3c7", color: "#92400e", borderRadius: 8, padding: "1px 6px" }}>
          ⚠ {summary.problemCount}
        </span>
      )}
    </Link>
  );
}

const STATUS_ORDER = ["upcoming", "assigned", "pending", "confirmed", "complete", "cancelled", "all"];

const STATUS_META = {
  upcoming: { label: "Upcoming", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  requested: { label: "Upcoming", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  assigned: { label: "Assigned", bg: "#f0fdfa", color: "#0f766e", border: "#99f6e4" },
  pending: { label: "Pending", bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
  confirmed: { label: "Confirmed", bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" },
  complete: { label: "Complete", bg: "#f1f5f9", color: "#334155", border: "#cbd5e1" },
  completed: { label: "Complete", bg: "#f1f5f9", color: "#334155", border: "#cbd5e1" },
  cancelled: { label: "Cancelled", bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
};

function canonicalStatus(status) {
  if (status === "requested") return "upcoming";
  if (status === "completed") return "complete";
  return status || "upcoming";
}

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function patientCountry(appointment) {
  return appointment.patientDetails?.country || appointment.patientId?.country || "-";
}

function patientGender(appointment) {
  return appointment.patientDetails?.gender || appointment.patientId?.gender || "-";
}

function assignedBy(appointment) {
  return appointment.assignedBy?.name || appointment.assignedBy?.email || "-";
}

function doctorCountry(appointment) {
  return appointment.doctorMeta?.country || appointment.doctorId?.country || "-";
}

function hasAssignedDoctor(appointment) {
  return Boolean(appointment.doctorId?._id || appointment.doctorId);
}

function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META[canonicalStatus(status)] || STATUS_META.upcoming;
  return (
    <span
      className="adp-status-pill"
      style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}
    >
      {meta.label}
    </span>
  );
}

export default function AdminAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();

  const [attempt, setAttempt] = useState(0);
  const initialFilter = canonicalStatus(searchParams.get("tab"));
  const [filter, setFilter] = useState(STATUS_ORDER.includes(initialFilter) ? initialFilter : "upcoming");

  useEffect(() => {
    let alive = true;

    async function loadAppointments() {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("/api/appointments/admin/all");
        if (alive) setAppointments(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to load appointments", err);
        if (alive) setError(err.response?.data?.msg || "Failed to load appointments.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadAppointments();
    return () => {
      alive = false;
    };
  }, [attempt]);

  const counts = useMemo(() => {
    const base = { all: appointments.length, upcoming: 0, assigned: 0, pending: 0, confirmed: 0, complete: 0, cancelled: 0 };
    appointments.forEach((appointment) => {
      const key = canonicalStatus(appointment.status);
      if (base[key] !== undefined) base[key] += 1;
    });
    return base;
  }, [appointments]);

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    return appointments.filter((appointment) => {
      const status = canonicalStatus(appointment.status);
      const matchesFilter = filter === "all" || status === filter;
      if (!matchesFilter) return false;
      if (!q) return true;

      return [
        appointment._id,
        appointment.patientId?.name,
        appointment.patientId?.email,
        appointment.doctorId?.name,
        appointment.category,
        appointment.specialty,
        appointment.condition,
        patientGender(appointment),
        patientCountry(appointment),
        assignedBy(appointment),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [appointments, filter, search]);

  // Call column (admin call report): one batch request per 100 visible rows.
  // Best effort - the list works the same if this fails.
  const [callSummaries, setCallSummaries] = useState({});
  const displayedIdsKey = useMemo(() => displayed.map((a) => a._id).join(","), [displayed]);
  useEffect(() => {
    const ids = displayedIdsKey ? displayedIdsKey.split(",") : [];
    if (ids.length === 0) return undefined;
    let alive = true;
    const chunks = [];
    for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
    Promise.all(chunks.map((chunk) => api.post("/api/call-reports/summaries", { ids: chunk }).then((res) => res.data?.summaries || {}).catch(() => ({}))))
      .then((parts) => {
        if (alive) setCallSummaries(Object.assign({}, ...parts));
      });
    return () => {
      alive = false;
    };
  }, [displayedIdsKey]);

  const setActiveFilter = (nextFilter) => {
    setFilter(nextFilter);
    setSearchParams(nextFilter === "upcoming" ? {} : { tab: nextFilter });
  };

  return (
    <div className="adp-page">
     

      <div className="adp-stats">
        {[
          { key: "upcoming", label: "Upcoming" },
          { key: "assigned", label: "Assigned" },
          { key: "pending", label: "Pending" },
          { key: "confirmed", label: "Confirmed" },
          { key: "complete", label: "Complete" },
          { key: "all", label: "Total" },
        ].map((stat) => (
          <button
            type="button"
            key={stat.key}
            className={`adp-stat ${filter === stat.key ? "adp-stat--active" : ""}`}
            onClick={() => setActiveFilter(stat.key)}
          >
            <span className="adp-stat-value">{counts[stat.key]}</span>
            <span className="adp-stat-label">{stat.label}</span>
          </button>
        ))}
      </div>

      <section className="adp-card">
        <div className="adp-card-header">
          {/* <div className="adp-tabs" role="tablist" aria-label="Appointment status">
            {STATUS_ORDER.map((tab) => (
              <button
                type="button"
                key={tab}
                className={`adp-tab ${filter === tab ? "active" : ""}`}
                onClick={() => setActiveFilter(tab)}
              >
                {tab === "all" ? "All" : STATUS_META[tab].label}
                <span className="adp-tab-count">{counts[tab] ?? 0}</span>
              </button>
            ))}
          </div> */}
          <label className="adp-search" aria-label="Search appointments">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Search patient, doctor, country, specialty..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>

        {loading ? (
          <div className="adp-loading">
            <div className="adp-spinner" />
            <p>Loading appointments...</p>
          </div>
        ) : error ? (
          <div className="adp-empty">
            <h3>Could not load appointments</h3>
            <p>{error}</p>
            <RetryButton onRetry={() => setAttempt((n) => n + 1)} />
          </div>
        ) : displayed.length === 0 ? (
          <div className="adp-empty">
            <h3>No appointments found</h3>
            <p>No appointments match this view.</p>
          </div>
        ) : (
          <div className="adp-table-wrap">
            <table className="adp-flow-table">
              <thead>
                <tr>
                  <th>SR No</th>
                  <th>Appointment Booking ID</th>
                  <th>Patient Name</th>
                  <th>Consultation Fee</th>
                  <th>Doctor Country</th>
                  <th>Status</th>
                  <th>Assigned By</th>
                  <th>Call</th>
                  <th>View</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((appointment, index) => {
                  const assigned = hasAssignedDoctor(appointment);

                  return (
                    <tr key={appointment._id}>
                      <td className="adp-sr-cell">{index + 1}</td>
                      <td>
                        <span className="adp-booking-id">{appointment._id}</span>
                      </td>
                      <td>
                        <div className="adp-patient-cell">
                          <strong>{appointment.patientId?.name || "Unknown patient"}</strong>
                          <span>{patientGender(appointment)} - {getCountryName(patientCountry(appointment))}</span>
                        </div>
                      </td>
                      <td>{formatMoney(appointment.consultationPrice || appointment.paymentAmount / 100)}</td>
                      <td>{getCountryName(doctorCountry(appointment))}</td>
                      <td>
                        <StatusPill status={appointment.status} />
                      </td>
                      <td>{assignedBy(appointment)}</td>
                      <td>
                        <CallBadge summary={callSummaries[appointment._id]} id={appointment._id} />
                      </td>
                      <td>
                        <Link className="adp-view-btn" to={`/admin-dashboard/appointments/${appointment._id}`}>
                          View
                        </Link>
                      </td>
                      <td>
                        <div className="adp-list-actions">
                          {assigned ? (
                            <>
                              <div className="adp-assigned-doctor-mini">
                                <strong>{appointment.doctorId?.name || "Assigned doctor"}</strong>
                                <span>{appointment.category || "-"} - {getCountryName(doctorCountry(appointment))}</span>
                              </div>
                              {!["complete", "completed"].includes(appointment.status) && (
                                <Link className="adp-secondary-link" to={`/admin-dashboard/appointments/${appointment._id}/assign`}>
                                  Alternate Doctor
                                </Link>
                              )}
                            </>
                          ) : (
                            <Link className="adp-alt-btn" to={`/admin-dashboard/appointments/${appointment._id}/assign`}>
                              Assign Doctor
                            </Link>
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
      </section>
    </div>
  );
}
