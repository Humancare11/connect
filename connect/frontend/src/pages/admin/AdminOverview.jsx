import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import { useAdmin } from "../../context/AdminContext";

export default function AdminOverview() {
  const navigate = useNavigate();
  const { admin: user } = useAdmin();
  const [stats, setStats] = useState({ totalUsers: 0, totalDoctors: 0, totalAppointments: 0 });

  useEffect(() => {
    api.get("/api/admin/stats")
      .then(r => setStats({
        totalUsers: r.data.totalUsers || 0,
        totalDoctors: r.data.totalDoctors || 0,
        totalAppointments: r.data.totalAppointments || 0,
      }))
      .catch(() => { });
  }, []);

  const statCards = [
    { label: "Total Users", value: stats.totalUsers, icon: "👥", cls: "adp-stat--blue", path: "/admin-dashboard/manage-users" },
    { label: "Approved Doctors", value: stats.totalDoctors, icon: "🩺", cls: "adp-stat--green", path: "/admin-dashboard/manage-doctors" },
    { label: "Total Appointments", value: stats.totalAppointments, icon: "📅", cls: "adp-stat--amber", path: "/admin-dashboard/appointments" },
  ];

  const actions = [
    { icon: "🩺", label: "Manage Doctors", sub: "Review & approve enrollments", path: "/admin-dashboard/manage-doctors" },
    { icon: "👥", label: "Manage Users", sub: "View & manage patient accounts", path: "/admin-dashboard/manage-users" },
    { icon: "📅", label: "Appointments", sub: "Monitor all booked appointments", path: "/admin-dashboard/appointments" },
    { icon: "💬", label: "Medical Q&A", sub: "Assign questions & approve answers", path: "/admin-dashboard/qna" },
    { icon: "🎫", label: "Support Tickets", sub: "Resolve patient & doctor tickets", path: "/admin-dashboard/tickets" },
  ];

  return (
    <div>
      <div className="adp-header">
        <span className="adp-eyebrow">HumaniCare Admin</span>
        <h1 className="adp-title">Welcome back, {user?.name?.split(" ")[0]} 👋</h1>
        <p className="adp-sub">Here's an overview of the platform.</p>
      </div>

      <div className="adp-stats">
        {statCards.map(c => (
          <div
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
              <div key={a.path} className="ado-action-card" onClick={() => navigate(a.path)}>
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
