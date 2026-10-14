import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import { useAdmin } from "../../context/AdminContext";
import Button from "../../components/ui/Button";
import "./AdminDashboard.css";

// A count is only shown when the API really returned a number. While loading, and when the request fails, the
// card shows a dash and the page says what went wrong: "0" must always mean "the platform has none".
const asCount = (value) => (Number.isFinite(value) && value >= 0 ? value : null);

function describeFailure(err) {
  const status = err?.response?.status;
  if (status === 401 || status === 403) return "Your admin session was not accepted (HTTP " + status + "). Sign out and sign in again.";
  if (status) return "The server answered with an error (HTTP " + status + ").";
  return "The server could not be reached (network error, or the request was blocked).";
}

export default function AdminOverview() {
  const navigate = useNavigate();
  const { admin: user } = useAdmin();
  const [stats, setStats] = useState(null); // null until the API answers
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const [attempt, setAttempt] = useState(0); // bumped by "Try again"

  useEffect(() => {
    let active = true;
    api
      .get("/api/admin/stats")
      .then((r) => {
        if (!active) return;
        const next = {
          totalUsers: asCount(r.data?.totalUsers),
          totalDoctors: asCount(r.data?.totalDoctors),
          totalAppointments: asCount(r.data?.totalAppointments),
        };
        if (Object.values(next).some((v) => v === null)) {
          setStats(null);
          setLoadError("The server's reply did not contain the platform totals.");
        } else {
          setStats(next);
        }
      })
      .catch((err) => {
        if (!active) return;
        setStats(null);
        setLoadError(describeFailure(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = () => {
    setLoadError("");
    setLoading(true);
    setAttempt((n) => n + 1);
  };

  const show = (value) => (stats ? value : "\u2014");

  const statCards = [
    { label: "Total Users", value: show(stats?.totalUsers), icon: "👥", cls: "adp-stat--blue", path: "/admin-dashboard/manage-users" },
    { label: "Approved Doctors", value: show(stats?.totalDoctors), icon: "🩺", cls: "adp-stat--green", path: "/admin-dashboard/manage-doctors" },
    { label: "Total Appointments", value: show(stats?.totalAppointments), icon: "📅", cls: "adp-stat--amber", path: "/admin-dashboard/appointments" },
  ];

  const actions = [
    { icon: "🩺", label: "Manage Doctors", sub: "Review & approve enrollments", path: "/admin-dashboard/manage-doctors" },
    { icon: "👥", label: "Manage Users", sub: "View & manage patient accounts", path: "/admin-dashboard/manage-users" },
    { icon: "📅", label: "Appointments", sub: "Monitor all booked appointments", path: "/admin-dashboard/appointments" },
    { icon: "🎫", label: "Support Tickets", sub: "Resolve patient & doctor tickets", path: "/admin-dashboard/tickets" },
  ];

  return (
    <div>
      <div className="adp-header">
        <span className="adp-eyebrow">Humancare Admin</span>
        <h1 className="adp-title">Welcome back, {user?.name?.split(" ")[0]} 👋</h1>
        <p className="adp-sub">Here's an overview of the platform.</p>
      </div>

      {loadError && (
        <div className="adp-load-error" role="alert">
          <div>
            <strong>Couldn't load the platform totals.</strong> {loadError}
          </div>
          <Button variant="secondary" size="sm" loading={loading} onClick={retry}>
            Try again
          </Button>
        </div>
      )}

      <div className="adp-stats">
        {statCards.map(c => (
          <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => navigate(c.path))(e); } }}
            key={c.label}
            className={`adp-stat ${c.cls}`}
            style={{ cursor: "pointer" }}
            onClick={() => navigate(c.path)}
          >
            <div className="adp-stat-icon">{c.icon}</div>
            <div className="adp-stat-value">{c.value}</div>
            <div className="adp-stat-label">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="adp-card">
        <div className="adp-card-header">
          <h2 className="adp-card-title">Quick Navigation</h2>
        </div>
        <div style={{ padding: "20px 22px" }}>
          <div className="ado-grid">
            {actions.map(a => (
              <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => navigate(a.path))(e); } }} key={a.path} className="ado-action-card" onClick={() => navigate(a.path)}>
                <div className="ado-action-icon">{a.icon}</div>
                <div className="ado-action-label">{a.label}</div>
                <div className="ado-action-sub">{a.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
