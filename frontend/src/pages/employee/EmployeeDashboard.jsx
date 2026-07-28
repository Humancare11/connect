import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import { useEmployeeAdmin } from "../../context/EmployeeAdminContext";
import "./EmployeeDashboard.css";

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
      <div className="ead-header">
        <span className="ead-eyebrow">Employee Admin Portal</span>
        <h1 className="ead-title">
          Welcome back, {employeeAdmin?.name?.split(" ")[0] || "Admin"}
        </h1>
        <p className="ead-sub">
          Here's an overview of your workspace. More features are on their way.
        </p>
      </div>

      <div className="ead-stats">
        {PLACEHOLDER_CARDS.map(({ label, icon: Icon, color }) => {
          const value = label === "Assigned Tasks"
            ? tasks.length
            : label === "Pending Actions"
              ? tasks.filter((task) => task.status !== "Completed").length
              : tasks.filter((task) => task.status === "Completed").length;

          return (
          <div
            key={label}
            className={`ead-stat ead-stat--${color}`}
            style={{ cursor: "pointer" }}
            onClick={() => navigate("/employee-dashboard/my-tasks")}
          >
            <div className="ead-stat-icon"><Icon /></div>
            <div className="ead-stat-value">{value}</div>
            <div className="ead-stat-label">{label}</div>
          </div>
          );
        })}
      </div>

      <div className="ead-card" style={{ marginBottom: 24 }}>
        <div className="ead-card-header">
          <h2 className="ead-card-title">Employee Admin Profile</h2>
        </div>
        {loading ? (
          <div className="ead-loading" style={{ border: "none", boxShadow: "none", borderRadius: 0 }}>
            <div className="ead-spinner" />
            <span>Loading profile...</span>
          </div>
        ) : (
          <div className="ead-table-wrap">
            <table className="ead-table">
              <tbody>
                <tr>
                  <td style={{ width: 72 }}>
                    <div className="ead-avatar"><UserIcon /></div>
                  </td>
                  <td>
                    <strong>{info?.name || employeeAdmin?.name}</strong>
                    <div style={{ color: "#6b7ca3", fontSize: 13, marginTop: 4 }}>
                      {info?.email || employeeAdmin?.email}
                    </div>
                  </td>
                  <td>
                    <span className="ead-badge ead-badge--open">Employee Admin</span>
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

      <div className="ead-card">
        <div className="ead-card-header">
          <h2 className="ead-card-title">Workspace</h2>
        </div>
        <div style={{ padding: "20px 22px" }}>
          <div className="ead-grid">
            {PLACEHOLDER_CARDS.map(({ label, icon: Icon }) => (
              <div key={label} className="ead-action-card" onClick={() => navigate("/employee-dashboard/my-tasks")}>
                <div className="ead-action-icon"><Icon /></div>
                <div className="ead-action-label">{label}</div>
                <div className="ead-action-sub">Open Task Master</div>
              </div>
            ))}
            <div className="ead-action-card" onClick={() => navigate("/employee-dashboard/assign-task")}>
              <div className="ead-action-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 7h-9"/>
                  <path d="M14 17H5"/>
                  <circle cx="17" cy="17" r="3"/>
                  <circle cx="7" cy="7" r="3"/>
                </svg>
              </div>
              <div className="ead-action-label">Assign Task</div>
              <div className="ead-action-sub">Create tasks and track assigned work.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}