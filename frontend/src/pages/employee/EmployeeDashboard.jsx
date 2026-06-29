import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import { useEmployeeAdmin } from "../../context/EmployeeAdminContext";
import "../admin/AdminDashboard.css";

const PLACEHOLDER_CARDS = [
  { label: "Assigned Tasks", icon: TaskIcon, color: "blue" },
  { label: "Pending Actions", icon: ClockIcon, color: "amber" },
  { label: "Completed Today", icon: CheckIcon, color: "green" },
];

function TaskIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

export default function EmployeeAdminDashboard() {
  const navigate = useNavigate();
  const { employeeAdmin } = useEmployeeAdmin();
  const [info, setInfo] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/api/employee-admin/dashboard"),
      api.get("/api/employee-admin/tasks?scope=assigned"),
    ])
      .then(([profileRes, tasksRes]) => {
        setInfo(profileRes.data);
        setTasks(tasksRes.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const memberSince = info?.memberSince
    ? new Date(info.memberSince).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div>
      <div className="adp-header">
        <span className="adp-eyebrow">Employee Admin Portal</span>
        <h1 className="adp-title">
          Welcome back, {employeeAdmin?.name?.split(" ")[0] || "Admin"}
        </h1>
        <p className="adp-sub">
          Here's an overview of your workspace. More features are on their way.
        </p>
      </div>

      <div className="adp-stats">
        {PLACEHOLDER_CARDS.map(({ label, icon: Icon, color }) => {
          const value = label === "Assigned Tasks"
            ? tasks.length
            : label === "Pending Actions"
              ? tasks.filter((task) => task.status !== "Completed").length
              : tasks.filter((task) => task.status === "Completed").length;

          return (
          <div
            key={label}
            className={`adp-stat adp-stat--${color}`}
            style={{ cursor: "pointer" }}
            onClick={() => navigate("/employee-dashboard/my-tasks")}
          >
            <div className="adp-stat-icon"><Icon /></div>
            <div className="adp-stat-value">{value}</div>
            <div className="adp-stat-label">{label}</div>
          </div>
          );
        })}
      </div>

      <div className="adp-card" style={{ marginBottom: 24 }}>
        <div className="adp-card-header">
          <h2 className="adp-card-title">Employee Admin Profile</h2>
        </div>
        {loading ? (
          <div className="adp-loading" style={{ border: "none", boxShadow: "none", borderRadius: 0 }}>
            <div className="adp-spinner" />
            <span>Loading profile...</span>
          </div>
        ) : (
          <div className="adp-table-wrap">
            <table className="adp-table">
              <tbody>
                <tr>
                  <td style={{ width: 72 }}>
                    <div className="adp-avatar"><UserIcon /></div>
                  </td>
                  <td>
                    <strong>{info?.name || employeeAdmin?.name}</strong>
                    <div style={{ color: "#6b7ca3", fontSize: 13, marginTop: 4 }}>
                      {info?.email || employeeAdmin?.email}
                    </div>
                  </td>
                  <td>
                    <span className="adp-badge adp-badge--open">Employee Admin</span>
                  </td>
                  <td style={{ color: "#6b7ca3" }}>
                    {memberSince ? `Member since ${memberSince}` : "Member since unavailable"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="adp-card">
        <div className="adp-card-header">
          <h2 className="adp-card-title">Workspace</h2>
        </div>
        <div style={{ padding: "20px 22px" }}>
          <div className="ado-grid">
            {PLACEHOLDER_CARDS.map(({ label, icon: Icon }) => (
              <div key={label} className="ado-action-card" onClick={() => navigate("/employee-dashboard/my-tasks")}>
                <div className="ado-action-icon"><Icon /></div>
                <div className="ado-action-label">{label}</div>
                <div className="ado-action-sub">Open Task Master</div>
              </div>
            ))}
            <div className="ado-action-card" onClick={() => navigate("/employee-dashboard/assign-task")}>
              <div className="ado-action-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 7h-9"/>
                  <path d="M14 17H5"/>
                  <circle cx="17" cy="17" r="3"/>
                  <circle cx="7" cy="7" r="3"/>
                </svg>
              </div>
              <div className="ado-action-label">Assign Task</div>
              <div className="ado-action-sub">Create tasks and track assigned work.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
