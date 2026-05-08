import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./dashboard.css";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import socket from "../../socket";
import { USER_ACTIVITY_UPDATED_EVENT } from "../../utils/activityEvents";

export default function Dashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const refreshTimerRef = useRef(null);
  const ACTIVITY_PAGE_SIZE = 8;

  const loadDashboardData = useCallback(async (withLoader = true) => {
    if (withLoader) setLoading(true);

    try {
      const [apptRes, qnaRes, ticketRes] = await Promise.allSettled([
        api.get("/api/appointments/mine"),
        api.get("/api/qna/user-questions"),
        api.get("/api/tickets/user/my"),
      ]);

      if (apptRes.status === "fulfilled") {
        setAppointments(Array.isArray(apptRes.value.data) ? apptRes.value.data : []);
      } else {
        console.error("Dashboard appointments load error", apptRes.reason);
        setAppointments([]);
      }

      if (qnaRes.status === "fulfilled") {
        setQuestions(Array.isArray(qnaRes.value.data) ? qnaRes.value.data : []);
      } else {
        console.error("Dashboard questions load error", qnaRes.reason);
        setQuestions([]);
      }

      if (ticketRes.status === "fulfilled") {
        setTickets(Array.isArray(ticketRes.value.data) ? ticketRes.value.data : []);
      } else {
        console.error("Dashboard tickets load error", ticketRes.reason);
        setTickets([]);
      }
    } catch (err) {
      console.error("Dashboard load error", err);
    } finally {
      if (withLoader) setLoading(false);
    }
  }, []);

  const queueRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      loadDashboardData(false);
    }, 150);
  }, [loadDashboardData]);

  useEffect(() => {
    loadDashboardData(true);
  }, [loadDashboardData, location.key]);

  useEffect(() => {
    const onActivityEvent = () => queueRefresh();
    const onFocus = () => queueRefresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") queueRefresh();
    };

    const socketEvents = [
      "appointment-updated",
      "question-created",
      "question-approved",
      "ticket-created",
      "ticket-updated",
    ];

    window.addEventListener(USER_ACTIVITY_UPDATED_EVENT, onActivityEvent);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    socketEvents.forEach((eventName) => socket.on(eventName, onActivityEvent));

    return () => {
      window.removeEventListener(USER_ACTIVITY_UPDATED_EVENT, onActivityEvent);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      socketEvents.forEach((eventName) => socket.off(eventName, onActivityEvent));
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [queueRefresh]);

  const pendingCount = appointments.filter((a) => a.status === "pending").length;
  const confirmedCount = appointments.filter((a) => a.status === "confirmed").length;

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

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const allActivities = [
    ...appointments.map((a) => ({
      id: a._id,
      type: "appointment",
      icon: a.status === "confirmed" ? "✅" : a.status === "completed" ? "📋" : "⏳",
      title: `Appointment with Dr. ${a.doctorId?.name || "Unknown"}`,
      detail: `${formatDate(a.date)}${a.time ? " · " + a.time : ""}`,
      status: a.status === "completed" ? "completed" : a.status === "confirmed" ? "confirmed" : "pending",
      createdAt: new Date(a.createdAt || a.date),
    })),
    ...questions.map((q) => ({
      id: q._id,
      type: "question",
      icon: q.status === "answered" || q.status === "approved" ? "💡" : "❓",
      title: q.question?.length > 65 ? q.question.slice(0, 65) + "…" : q.question,
      detail:
        q.status === "answered" || q.status === "approved"
          ? "Answered"
          : q.status === "assigned"
            ? "Under review"
            : "Awaiting answer",
      status: q.status === "answered" || q.status === "approved" ? "completed" : "pending",
      createdAt: new Date(q.createdAt),
    })),
    ...tickets.map((t) => ({
      id: t._id,
      type: "ticket",
      icon: t.status === "resolved" ? "✅" : "🎫",
      title: t.title || "Support Request",
      detail: t.status === "resolved" ? "Resolved" : "Open",
      status: t.status === "resolved" ? "completed" : "pending",
      createdAt: new Date(t.createdAt),
    })),
  ]
    .sort((a, b) => b.createdAt - a.createdAt);

  const totalPages = Math.max(1, Math.ceil(allActivities.length / ACTIVITY_PAGE_SIZE));
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

  const handleActivityClick = (activity) => {
    const encodedId = encodeURIComponent(activity.id);

    if (activity.type === "appointment") {
      navigate(`/user/appointments?activityId=${encodedId}`);
      return;
    }
    if (activity.type === "question") {
      navigate(`/user/medical-questions?activityId=${encodedId}`);
      return;
    }
    navigate(`/user/raise-ticket?activityId=${encodedId}`);
  };

  return (
    <div className="hc-dash__page">
      <div className="hc-dash__header">
        <div className="hc-dash__header-text">
          <p className="hc-dash__eyebrow">Humanncare</p>
          <h1 className="hc-dash__title">
            {getGreeting()}, {user?.name?.split(" ")[0] || "there"} 👋
          </h1>
          <p className="hc-dash__subtitle">Here's your health overview for today</p>
        </div>
        <Link to="/find-a-doctor" className="hc-dash__book-btn">
          <span>+</span> Book Appointment
        </Link>
      </div>

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
            <span className="hc-dash__ov-icon">❓</span>
          </div>
          <div className="hc-dash__ov-right">
            <span className="hc-dash__ov-num">{questions.length}</span>
            <span className="hc-dash__ov-label">Total Questions</span>
            <span className="hc-dash__ov-sub">
              {questions.filter((q) => q.status === "answered" || q.status === "approved").length} answered
            </span>
          </div>
        </div>
        <div className="hc-dash__ov-card hc-dash__ov-card--ticket">
          <div className="hc-dash__ov-left">
            <span className="hc-dash__ov-icon">🎫</span>
          </div>
          <div className="hc-dash__ov-right">
            <span className="hc-dash__ov-num">{tickets.length}</span>
            <span className="hc-dash__ov-label">Support Tickets</span>
            <span className="hc-dash__ov-sub">{tickets.filter((t) => t.status === "open").length} open</span>
          </div>
        </div>
      </div>

      <div className="hc-dash__section">
        <div className="hc-dash__section-header">
          <div>
            <h2 className="hc-dash__section-title">Recent Activity</h2>
            <p className="hc-dash__section-sub">Your latest actions across appointments, questions &amp; tickets</p>
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
            <p>Your actions will appear here once you start using the platform.</p>
            <Link to="/find-a-doctor" className="hc-dash__empty-cta">
              Find a Doctor
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
                onClick={() => handleActivityClick(act)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleActivityClick(act);
                  }
                }}
              >
                <div className={`hc-dash__activity-dot hc-dash__activity-dot--${act.status}`} />
                <div className="hc-dash__activity-icon">{act.icon}</div>
                <div className="hc-dash__activity-body">
                  <span className="hc-dash__activity-title">{act.title}</span>
                  <span className="hc-dash__activity-meta">
                    <span className={`hc-dash__activity-tag hc-dash__activity-tag--${act.type}`}>
                      {act.type === "appointment" ? "Appointment" : act.type === "question" ? "Q&A" : "Ticket"}
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
