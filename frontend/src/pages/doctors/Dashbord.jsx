import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../user/dashboard.css";
import api from "../../api";
import { useDoctorAuth } from "../../context/DoctorAuthContext";

export default function DoctorDashboard() {
  const { doctor = {} } = useDoctorAuth();
  const navigate = useNavigate();

  const [appointments, setAppointments] = useState([]);
  const [questions,    setQuestions]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [currentPage,  setCurrentPage]  = useState(1);
  const refreshTimerRef = useRef(null);
  const ACTIVITY_PAGE_SIZE = 8;

  const loadData = useCallback(async (withLoader = true) => {
    if (withLoader) setLoading(true);
    try {
      const [apptRes, qnaRes] = await Promise.allSettled([
        api.get("/api/appointments/doctor"),
        api.get("/api/qna/doctor/assigned"),
      ]);
      setAppointments(apptRes.status === "fulfilled" && Array.isArray(apptRes.value.data) ? apptRes.value.data : []);
      setQuestions(qnaRes.status === "fulfilled" && Array.isArray(qnaRes.value.data) ? qnaRes.value.data : []);
    } catch {
      /* silent */
    } finally {
      if (withLoader) setLoading(false);
    }
  }, []);

  const queueRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      loadData(false);
    }, 150);
  }, [loadData]);

  useEffect(() => { loadData(true); }, [loadData]);

  useEffect(() => {
    const onFocus      = () => queueRefresh();
    const onVisibility = () => { if (document.visibilityState === "visible") queueRefresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [queueRefresh]);

  const pendingCount   = appointments.filter((a) => a.status === "pending").length;
  const confirmedCount = appointments.filter((a) => a.status === "confirmed").length;
  const answeredCount  = questions.filter((q) => q.status === "answered" || q.status === "approved").length;

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const timeAgo = (date) => {
    const stamp = new Date(date).getTime();
    if (Number.isNaN(stamp)) return "—";
    const diff = Date.now() - stamp;
    const m = Math.floor(diff / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return d < 30 ? `${d}d ago` : formatDate(date);
  };

  const allActivities = [
    ...appointments.map((a) => ({
      id:        a._id,
      type:      "appointment",
      icon:      a.status === "confirmed" ? "✅" : (a.status === "completed" || a.status === "done") ? "📋" : "⏳",
      title:     `Patient: ${a.patientId?.name || "Unknown"}`,
      detail:    `${formatDate(a.date)}${a.time ? " · " + a.time : ""}`,
      status:    (a.status === "completed" || a.status === "done") ? "completed" : a.status === "confirmed" ? "confirmed" : "pending",
      createdAt: new Date(a.createdAt || a.date),
      path:      `/doctor-dashboard/appointments?activityId=${a._id}`,
    })),
    ...questions.map((q) => ({
      id:        q._id,
      type:      "question",
      icon:      (q.status === "answered" || q.status === "approved") ? "💡" : "❓",
      title:     q.question?.length > 65 ? q.question.slice(0, 65) + "…" : q.question,
      detail:    (q.status === "answered" || q.status === "approved") ? "Answered" : "Awaiting your answer",
      status:    (q.status === "answered" || q.status === "approved") ? "completed" : "pending",
      createdAt: new Date(q.createdAt),
      path:      `/doctor-dashboard/qna?activityId=${q._id}`,
    })),
  ].sort((a, b) => b.createdAt - a.createdAt);

  const totalPages      = Math.max(1, Math.ceil(allActivities.length / ACTIVITY_PAGE_SIZE));
  const pagedActivities = allActivities.slice(
    (currentPage - 1) * ACTIVITY_PAGE_SIZE,
    currentPage * ACTIVITY_PAGE_SIZE
  );

  useEffect(() => {
    setCurrentPage((prev) => {
      if (prev > totalPages) return totalPages;
      if (prev < 1) return 1;
      return prev;
    });
  }, [totalPages]);

  return (
    <div className="hc-dash__page">

      {/* ── Header ── */}
      <div className="hc-dash__header">
        <div className="hc-dash__header-text">
          <p className="hc-dash__eyebrow">HumaniCare</p>
          <h1 className="hc-dash__title">
            {getGreeting()}, Dr. {doctor.name?.split(" ")[0] || "Doctor"} 👋
          </h1>
          <p className="hc-dash__subtitle">Here's your practice overview for today</p>
        </div>
        <Link to="/doctor-dashboard/appointments" className="hc-dash__book-btn">
          <span>📅</span> View Appointments
        </Link>
      </div>

      {/* ── Overview cards ── */}
      <div className="hc-dash__overview">
        <div className="hc-dash__ov-card hc-dash__ov-card--appt">
          <div className="hc-dash__ov-left">
            <span className="hc-dash__ov-icon">🗓️</span>
          </div>
          <div className="hc-dash__ov-right">
            <span className="hc-dash__ov-num">{appointments.length}</span>
            <span className="hc-dash__ov-label">Total Appointments</span>
            <span className="hc-dash__ov-sub">
              {pendingCount} pending · {confirmedCount} confirmed
            </span>
          </div>
        </div>

        <div className="hc-dash__ov-card hc-dash__ov-card--qna">
          <div className="hc-dash__ov-left">
            <span className="hc-dash__ov-icon">⏳</span>
          </div>
          <div className="hc-dash__ov-right">
            <span className="hc-dash__ov-num">{pendingCount}</span>
            <span className="hc-dash__ov-label">Pending Approval</span>
            <span className="hc-dash__ov-sub">awaiting confirmation</span>
          </div>
        </div>

        <div className="hc-dash__ov-card hc-dash__ov-card--ticket">
          <div className="hc-dash__ov-left">
            <span className="hc-dash__ov-icon">❓</span>
          </div>
          <div className="hc-dash__ov-right">
            <span className="hc-dash__ov-num">{questions.length}</span>
            <span className="hc-dash__ov-label">Assigned Questions</span>
            <span className="hc-dash__ov-sub">{answeredCount} answered</span>
          </div>
        </div>
      </div>

      {/* ── Recent Activity ── */}
      <div className="hc-dash__section">
        <div className="hc-dash__section-header">
          <div>
            <h2 className="hc-dash__section-title">Recent Activity</h2>
            <p className="hc-dash__section-sub">Your latest appointments and assigned questions</p>
          </div>
        </div>

        {loading ? (
          <div className="hc-dash__loading">
            <div className="hc-dash__spinner" />
            <p>Loading activity…</p>
          </div>
        ) : allActivities.length === 0 ? (
          <div className="hc-dash__empty">
            <div className="hc-dash__empty-icon">📋</div>
            <h3>No activity yet</h3>
            <p>Your appointments and assigned questions will appear here.</p>
            <Link to="/doctor-dashboard/appointments" className="hc-dash__empty-cta">
              View Appointments
            </Link>
          </div>
        ) : (
          <ul className="hc-dash__activity-list">
            {pagedActivities.map((act) => (
              <li
                key={`${act.type}-${act.id}`}
                className="hc-dash__activity-item hc-dash__activity-item--clickable"
                role="button"
                tabIndex={0}
                onClick={() => navigate(act.path)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(act.path);
                  }
                }}
              >
                <div className={`hc-dash__activity-dot hc-dash__activity-dot--${act.status}`} />
                <div className="hc-dash__activity-icon">{act.icon}</div>
                <div className="hc-dash__activity-body">
                  <span className="hc-dash__activity-title">{act.title}</span>
                  <span className="hc-dash__activity-meta">
                    <span className={`hc-dash__activity-tag hc-dash__activity-tag--${act.type}`}>
                      {act.type === "appointment" ? "Appointment" : "Q&A"}
                    </span>
                    &nbsp;· {act.detail}
                  </span>
                </div>
                <span className="hc-dash__activity-time">{timeAgo(act.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}

        {!loading && allActivities.length > 0 && (
          <div className="hc-dash__pagination">
            <button
              type="button"
              className="hc-dash__page-btn"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <div className="hc-dash__page-numbers">
              {Array.from({ length: totalPages }, (_, idx) => {
                const page = idx + 1;
                return (
                  <button
                    key={page}
                    type="button"
                    className={`hc-dash__page-btn hc-dash__page-btn--num ${currentPage === page ? "hc-dash__page-btn--active" : ""}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="hc-dash__page-btn"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
