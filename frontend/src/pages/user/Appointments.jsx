import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import "./appointment.css";
import api from "../../api";
import socket from "../../socket";

export default function Appointments() {
  const location = useLocation();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("confirmed");
  const [focusedAppointmentId, setFocusedAppointmentId] = useState("");
  const refreshTimerRef = useRef(null);

  const loadAppointments = useCallback(async (withLoader = false) => {
    if (withLoader) setLoading(true);
    try {
      const res = await api.get("/api/appointments/mine");
      setAppointments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load appointments", err);
    } finally {
      if (withLoader) setLoading(false);
    }
  }, []);

  const queueRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      loadAppointments(false);
    }, 200);
  }, [loadAppointments]);

  const appointmentStatus = useCallback((appointment) => {
    if (appointment?.status === "assigned" && appointment?.doctorId) {
      return "confirmed";
    }
    return appointment?.status || "";
  }, []);

  // Initial load
  useEffect(() => {
    loadAppointments(true);
  }, [loadAppointments]);

  // Re-fetch on focus, visibility, and socket events
  useEffect(() => {
    const onFocus = () => queueRefresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") queueRefresh();
    };

    const socketEvents = [
      "appointment-updated",
      "new-prescription",
      "new-certificate",
    ];
    socketEvents.forEach((ev) => socket.on(ev, queueRefresh));
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      socketEvents.forEach((ev) => socket.off(ev, queueRefresh));
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [queueRefresh]);

  // Deep-link: scroll to a specific appointment from dashboard click
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const activityId = params.get("activityId");

    if (!activityId || appointments.length === 0) {
      setFocusedAppointmentId("");
      return;
    }

    const target = appointments.find((a) => a._id === activityId);
    if (!target) {
      setFocusedAppointmentId("");
      return;
    }

    setFocusedAppointmentId(activityId);
    const status = appointmentStatus(target);
    if (["requested", "upcoming", "pending"].includes(status)) {
      setActiveTab("pending");
    } else if (["confirmed", "completed", "complete"].includes(status)) {
      setActiveTab(status === "complete" ? "completed" : status);
    }

    setTimeout(() => {
      document
        .getElementById(`appt-${activityId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 40);
  }, [appointments, appointmentStatus, location.search]);

  const pendingAppointments = appointments.filter((a) =>
    ["requested", "upcoming", "pending"].includes(appointmentStatus(a)),
  );
  const confirmedAppointments = appointments.filter(
    (a) => appointmentStatus(a) === "confirmed",
  );
  const completedAppointments = appointments.filter((a) =>
    ["complete", "completed"].includes(appointmentStatus(a)),
  );

  const tabData = {
    pending: pendingAppointments,
    confirmed: confirmedAppointments,
    completed: completedAppointments,
  };
  const currentList = tabData[activeTab];

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="appt-page">
      {/* Header */}
      <div className="appt-header">
        <div className="appt-header-text">
          <p className="appt-eyebrow">Humancare connect</p>
          <h1 className="appt-title">My Appointments</h1>
          <p className="appt-subtitle">
            Track, manage and connect with your doctors
          </p>
        </div>
        <Link to="/appointment-booking" className="appt-book-btn">
          <span className="appt-book-icon">+</span>
          Book Appointment
        </Link>
      </div>

      {/* Stats Strip */}
      <div className="appt-stats">
        <div className="appt-stat-card">
          <span className="appt-stat-num">{pendingAppointments.length}</span>
          <span className="appt-stat-label">Pending</span>
          <div className="appt-stat-dot pending-dot" />
        </div>
        <div className="appt-stat-divider" />
        <div className="appt-stat-card">
          <span className="appt-stat-num">{confirmedAppointments.length}</span>
          <span className="appt-stat-label">Confirmed</span>
          <div className="appt-stat-dot confirmed-dot" />
        </div>
        <div className="appt-stat-divider" />
        <div className="appt-stat-card">
          <span className="appt-stat-num">{completedAppointments.length}</span>
          <span className="appt-stat-label">Completed</span>
          <div className="appt-stat-dot completed-dot" />
        </div>
      </div>

      {/* Tabs */}
      <div className="appt-tabs">
        {["pending", "confirmed", "completed"].map((tab) => (
          <button
            key={tab}
            className={`appt-tab ${activeTab === tab ? "active" : ""} tab-${tab}`}
            onClick={() => setActiveTab(tab)}
          >
            <span className="tab-label">
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </span>
            <span className="tab-count">{tabData[tab].length}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="appt-content">
        {loading ? (
          <div className="appt-loading">
            <div className="appt-spinner" />
            <p>Fetching your appointments…</p>
          </div>
        ) : currentList.length === 0 ? (
          <div className="appt-empty">
            <div className="appt-empty-icon">
              {activeTab === "pending"
                ? "⏳"
                : activeTab === "confirmed"
                  ? "✅"
                  : "📋"}
            </div>
            <h3>No {activeTab} appointments</h3>
            <p>
              {activeTab === "pending"
                ? "You have no appointments awaiting confirmation."
                : activeTab === "confirmed"
                  ? "No confirmed appointments right now."
                  : "Your completed consultations will appear here."}
            </p>
            {activeTab !== "completed" && (
              <Link to="/appointment-booking" className="appt-empty-cta">
                Book Appointment
              </Link>
            )}
            {activeTab === "completed" && (
              <Link to="/user/my-records" className="appt-empty-cta">
                View Medical Records
              </Link>
            )}
          </div>
        ) : (
          <div className="appt-list">
            {currentList.map((appt, i) => (
              <div
                id={`appt-${appt._id}`}
                className={`appt-card appt-card--${activeTab}`}
                key={appt._id}
                style={{ animationDelay: `${i * 60}ms` }}
                data-focused={
                  focusedAppointmentId === appt._id ? "true" : "false"
                }
              >
                {/* Card Left */}
                <div className="appt-card-left">
                  <div className="appt-avatar">
                    {appt.doctorId?.name?.charAt(0)?.toUpperCase() || "D"}
                  </div>
                  <div
                    className={`appt-status-line status-line--${activeTab}`}
                  />
                </div>

                {/* Card Body */}
                <div className="appt-card-body">
                  <div className="appt-card-top">
                    <div className="appt-doctor-info">
                      <h4 className="appt-doctor-name">
                        {appt.doctorId?.name
                          ? `Dr. ${appt.doctorId.name}`
                          : "Doctor assignment pending"}
                      </h4>
                      <p className="appt-doctor-email">
                        {appt.doctorId?.email || appt.specialty || ""}
                      </p>
                    </div>
                    <span className={`appt-badge appt-badge--${activeTab}`}>
                      {activeTab === "pending" && "⏳ Pending"}
                      {activeTab === "confirmed" && "✅ Confirmed"}
                      {activeTab === "completed" && "✔ Completed"}
                    </span>
                  </div>

                  <div className="appt-meta">
                    <div className="appt-meta-item">
                      <span className="appt-meta-icon">📅</span>
                      <span>{formatDate(appt.date)}</span>
                    </div>
                    <div className="appt-meta-item">
                      <span className="appt-meta-icon">🕐</span>
                      <span>{appt.time || "—"}</span>
                    </div>
                    {appt.problem && (
                      <div className="appt-meta-item appt-problem">
                        <span className="appt-meta-icon">📝</span>
                        <span>{appt.problem}</span>
                      </div>
                    )}
                  </div>

                  {appt.medicalReports?.length > 0 && (
                    <div className="appt-reports">
                      <p className="appt-reports-label">Medical Reports</p>
                      <div className="appt-reports-list">
                        {appt.medicalReports.map((r, idx) => (
                          <a
                            key={idx}
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="appt-report-chip"
                            title={r.name}
                          >
                            {r.type?.includes("pdf")
                              ? "📄"
                              : r.type?.startsWith("image/")
                                ? "🖼️"
                                : "📎"}
                            <span>{r.name}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="appt-card-actions">
                    {activeTab === "pending" && (
                      <span className="appt-waiting-text">
                        {["requested", "upcoming"].includes(appt.status)
                          ? "Awaiting admin review and doctor assignment"
                          : "Awaiting doctor confirmation"}
                      </span>
                    )}

                    {activeTab === "confirmed" && (
                      <Link
                        to={`/video-call/${appt._id}`}
                        className="appt-btn appt-btn--primary"
                      >
                        Join Consultation
                      </Link>
                    )}

                    {activeTab === "completed" && (
                      <div className="appt-completed-actions">
                        <span className="appt-done-text">
                          ✔ Consultation completed
                        </span>
                        <Link
                          to="/user/my-records"
                          className="appt-btn appt-btn--records"
                        >
                          📋 View Prescription &amp; Certificate
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
