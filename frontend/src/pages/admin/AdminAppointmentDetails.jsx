import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api";
import "./AdminAppointments.css";

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatBytes(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getLocalTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function legacyAppointmentInstant(appointment) {
  if (!appointment?.date || !appointment?.time) return null;
  const match = String(appointment.time)
    .trim()
    .match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  const date = new Date(`${appointment.date}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCHours(hours, minutes, 0, 0);
  return date;
}

function appointmentInstant(appointment) {
  const utc = appointment?.appointmentDateTimeUtc
    ? new Date(appointment.appointmentDateTimeUtc)
    : null;
  if (utc && !Number.isNaN(utc.getTime())) return utc;
  return legacyAppointmentInstant(appointment);
}

function formatInTimezone(date, timezone) {
  if (!date) return "-";
  const timeZone = timezone || "UTC";
  const options = {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone,
    timeZoneName: "short",
  };
  try {
    return new Intl.DateTimeFormat("en-IN", options).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-IN", {
      ...options,
      timeZone: "UTC",
    }).format(date);
  }
}

function InfoTile({ label, value }) {
  return (
    <div className="adp-info-tile">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function formatPatientId(value) {
  if (value === undefined || value === null || value === "") return "";
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 99999) {
    return String(numeric).padStart(5, "0");
  }
  return String(value);
}

const FLOW = [
  { key: "upcoming", label: "Upcoming" },
  { key: "assigned", label: "Assigned" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "complete", label: "Complete" },
];

function canonicalStatus(status) {
  if (status === "requested") return "upcoming";
  if (status === "completed") return "complete";
  return status || "upcoming";
}

function statusLabel(status) {
  const key = canonicalStatus(status);
  return FLOW.find((item) => item.key === key)?.label || status || "-";
}

function Section({ title, children }) {
  return (
    <section className="adp-detail-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function AdminAppointmentDetails() {
  const { id } = useParams();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadAppointment() {
      setLoading(true);
      setError("");
      try {
        const res = await api.get(`/api/appointments/${id}`);
        if (alive) setAppointment(res.data);
      } catch (err) {
        console.error("Failed to load appointment", err);
        if (alive)
          setError(err.response?.data?.msg || "Failed to load appointment.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadAppointment();
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="adp-page">
        <div className="adp-loading">
          <div className="adp-spinner" />
          <p>Loading appointment...</p>
        </div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="adp-page">
        <div className="adp-empty">
          <h3>Appointment unavailable</h3>
          <p>{error || "The appointment could not be found."}</p>
          <Link className="adp-view-btn" to="/admin-dashboard/appointments">
            Back to appointments
          </Link>
        </div>
      </div>
    );
  }

  const patientDetails = appointment.patientDetails || {};
  const reports = Array.isArray(appointment.medicalReports)
    ? appointment.medicalReports
    : [];
  const currentStatus = canonicalStatus(appointment.status);
  const currentStepIndex = FLOW.findIndex((step) => step.key === currentStatus);
  const assignmentLabel =
    ["upcoming", "requested"].includes(appointment.status) ||
      !appointment.doctorId
      ? "Assign Doctor"
      : "Alternate Doctor";
  const instant = appointmentInstant(appointment);
  const patientTimezone = appointment.patientTimezone || "UTC";
  const doctorTimezone =
    appointment.doctorTimezone || appointment.doctorMeta?.timezone || "UTC";
  const adminTimezone = getLocalTimezone();
  const userId =
    formatPatientId(appointment.patientId?.patientId) ||
    appointment.patientId?._id ||
    appointment.patientId ||
    "-";
  const doctorId =
    appointment.doctorId?.doctorId ||
    appointment.doctorId?._id ||
    appointment.doctorId ||
    "-";
  const userLocation = [
    appointment.patientDetails?.city || appointment.patientId?.city,
    appointment.patientDetails?.country || appointment.patientId?.country,
  ]
    .filter(Boolean)
    .join(", ");
  const doctorLocation = [
    appointment.doctorMeta?.city,
    appointment.doctorMeta?.country,
  ]
    .filter(Boolean)
    .join(", ");
  const doctorPhone = [
    appointment.doctorMeta?.countryCode,
    appointment.doctorMeta?.phoneNumber,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="adp-page">
      <div className="adp-detail-hero">
        {/* <div>
          <span className="adp-eyebrow">Appointment Details</span>
          <h1 className="adp-title">Appointment Information</h1>
          <p className="adp-sub">{appointment.patientId?.name || "Patient"} - {appointment.category || "General care"} - {appointment.specialty || "Specialty pending"}</p>
        </div> */}
        <div className="adp-detail-actions">
          <Link className="adp-back-button" to="/admin-dashboard/appointments">
            Back to Appointments
          </Link>
          <Link
            className="adp-alt-btn"
            to={`/admin-dashboard/appointments/${appointment._id}/assign`}
          >
            {assignmentLabel}
          </Link>
        </div>
      </div>

      {/* <div className="adp-detail-summary">
        <InfoTile label="Status" value={statusLabel(appointment.status)} />
        <InfoTile label="UTC Appointment Time" value={instant ? instant.toISOString() : "-"} />
        <InfoTile label="Patient Timezone" value={patientTimezone} />
        <InfoTile label="Fee" value={formatMoney(appointment.consultationPrice || appointment.paymentAmount / 100)} />
      </div> */}

      <div className="adp-detail-grid">
        <Section title="Appointment Details">
          <div className="adp-info-grid">
            <InfoTile label="Patient ID" value={userId} />
            <InfoTile label="User Name" value={appointment.patientId?.name} />
            <InfoTile label="Doctor ID" value={doctorId} />
            <InfoTile label="Appointment ID" value={appointment._id} />
            <InfoTile
              label="Doctor Name"
              value={appointment.doctorId?.name || "Unassigned"}
            />
            <InfoTile
              label="Doctor Specialty"
              value={appointment.doctorMeta?.specialty || appointment.specialty}
            />
            <InfoTile
              label="Patient Problem / Condition"
              value={appointment.problem || appointment.condition}
            />
            <InfoTile
              label="User Consultation Date & Time"
              value={formatInTimezone(instant, patientTimezone)}
            />
            <InfoTile
              label="Doctor Consultation Date & Time"
              value={formatInTimezone(instant, doctorTimezone)}
            />
            <InfoTile
              label="Admin Consultation Date & Time"
              value={formatInTimezone(instant, adminTimezone)}
            />
            <InfoTile label="Status" value={statusLabel(appointment.status)} />
            <InfoTile
              label="Consultation Fee"
              value={formatMoney(
                appointment.consultationPrice ||
                appointment.paymentAmount / 100,
              )}
            />
          </div>
          {/* <div className="adp-detail-note">
            <span>Timezone Handling</span>
            <p>Appointments are stored as a UTC timestamp and rendered in the patient, doctor, and admin timezones to avoid cross-country scheduling drift.</p>
          </div> */}
        </Section>

        <Section title="User Details">
          <div className="adp-info-grid">
            <InfoTile
              label="Gender"
              value={patientDetails.gender || appointment.patientId?.gender}
            />
            <InfoTile
              label="Date of Birth"
              value={patientDetails.dob || appointment.patientId?.dob}
            />
            <InfoTile label="Location" value={userLocation} />
            <InfoTile
              label="Phone Number"
              value={appointment.patientId?.mobile || patientDetails.phone}
            />
            <InfoTile
              label="Email ID"
              value={appointment.patientId?.email || patientDetails.email}
            />
            <InfoTile label="Timezone" value={patientTimezone} />
          </div>
        </Section>

        <Section title="Doctor Details">
          <div className="adp-info-grid">
            <InfoTile
              label="Doctor Name"
              value={appointment.doctorId?.name || "Unassigned"}
            />
            <InfoTile
              label="Specialization"
              value={appointment.doctorMeta?.specialty || appointment.specialty}
            />
            <InfoTile label="Location" value={doctorLocation} />
            <InfoTile
              label="Doctor Email ID"
              value={appointment.doctorId?.email}
            />
            <InfoTile label="Doctor Phone Number" value={doctorPhone} />
            <InfoTile label="Timezone" value={doctorTimezone} />
          </div>
        </Section>

        {/* <Section title="Timeline">
          <div className="adp-timeline">
            {FLOW.map((step, index) => {
              const done = currentStepIndex >= index;
              const active = currentStepIndex === index;
              return (
                <div key={step.key} className={`adp-timeline-step ${done ? "adp-timeline-step--done" : ""} ${active ? "adp-timeline-step--active" : ""}`}>
                  <span>{index + 1}</span>
                  <strong>{step.label}</strong>
                </div>
              );
            })}
          </div>
          {appointment.assignedBy?.assignedAt && (
            <p className="adp-muted">
              Assigned by {appointment.assignedBy?.name || appointment.assignedBy?.email || "Admin"} on {new Date(appointment.assignedBy.assignedAt).toLocaleString("en-IN")}
            </p>
          )}
        </Section> */}

        <Section title="Medical Reports">
          {reports.length === 0 ? (
            <p className="adp-muted">No medical reports attached.</p>
          ) : (
            <div className="adp-report-grid">
              {reports.map((report, index) => (
                <a
                  key={`${report.url}-${index}`}
                  href={report.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="adp-report-card"
                >
                  <strong>{report.name || `Report ${index + 1}`}</strong>
                  <span>
                    {report.type || "File"} {formatBytes(report.size)}
                  </span>
                </a>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
