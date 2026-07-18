import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api";
// Reusing the same stylesheet as the Appointment details page so the two
// layouts stay visually identical. Adjust the path if you move this file.
import "./AdminAppointments.css";

function InfoTile({ label, value }) {
  return (
    <div className="adp-info-tile">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="adp-detail-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

// Category consultation statuses: Pending -> Assigned -> Completed / Cancelled
function statusLabel(status) {
  return status || "Pending";
}

function isDoctorAssigned(consultation) {
  return Boolean(
    consultation?.assignedDoctorId ||
    consultation?.doctorId ||
    consultation?.assignedDoctorName,
  );
}



function formatBytes(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getReportUrl(report) {
  return report?.url || report?.signedUrl || report?.s3Url || "";
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

export default function AdminCategoryConsultationDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [consultation, setConsultation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadConsultation() {
      setLoading(true);
      setError("");
      try {
        const res = await api.get(`/api/category-consultation/${id}`);
        // Support either { data: {...} } or a raw object response shape,
        // matching the pattern already used in AdminCategoryConsultations.jsx
        const payload = res.data?.data || res.data;
        if (alive) setConsultation(payload);
      } catch (err) {
        console.error("Failed to load consultation", err);
        if (alive)
          setError(err.response?.data?.msg || "Failed to load consultation.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadConsultation();
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="adp-page">
        <div className="adp-loading">
          <div className="adp-spinner" />
          <p>Loading consultation...</p>
        </div>
      </div>
    );
  }

  if (error || !consultation) {
    return (
      <div className="adp-page">
        <div className="adp-empty">
          <h3>Consultation unavailable</h3>
          <p>{error || "The consultation could not be found."}</p>
          <Link
            className="adp-view-btn"
            to="/admin-dashboard/category-consultations"
          >
            Back to Category Consultations
          </Link>
        </div>
      </div>
    );
  }

  const patient = consultation.patientId || consultation.patientDetails || {};
  const doctor = consultation.assignedDoctorId || consultation.doctorId || null;
  const doctorAssigned = isDoctorAssigned(consultation);

  const assignmentLabel = doctorAssigned ? "Alternate Doctor" : "Assign Doctor";

  const userLocation = patient.country || "-";
  const doctorLocation = doctor
    ? [doctor.city, doctor.country].filter(Boolean).join(", ")
    : "";
  const doctorPhone = doctor
    ? [doctor.countryCode, doctor.phoneNumber].filter(Boolean).join(" ")
    : "";

  const reports = Array.isArray(consultation.medicalReports)
    ? consultation.medicalReports.filter(getReportUrl)
    : [];

  return (
    <div className="adp-page">
      <div className="adp-detail-hero">
        <div className="adp-detail-actions">
          <Link
            className="adp-back-button"
            to="/admin-dashboard/category-consultations"
          >
            Back to Category Consultations
          </Link>
          <button
            type="button"
            className="adp-alt-btn"
            onClick={() =>
              navigate(
                `/admin-dashboard/category-consultations/assign-doctor/${consultation._id}`,
              )
            }
          >
            {assignmentLabel}
          </button>
        </div>
      </div>

      <div className="adp-detail-grid">
        <Section title="Consultation Details">
          <div className="adp-info-grid">
            <InfoTile label="Consultation ID" value={consultation._id} />
            <InfoTile label="Concern" value={consultation.concern} />
            <InfoTile label="Severity" value={consultation.severity} />
            <InfoTile label="Support Type" value={consultation.supportType} />
            <InfoTile label="Consultation Fee" value={formatMoney(consultation.consultationPrice)} />
            <InfoTile label="Consultation Date" value={consultation.date} />
            <InfoTile label="Time Window" value={consultation.timeWindow} />
            <InfoTile label="Slot" value={consultation.slot} />
            <InfoTile label="Status" value={statusLabel(consultation.status)} />
            <InfoTile label="Source Category" value={consultation.categoryName} />
            <InfoTile label="Source Specialty" value={consultation.specialtyName} />
            <InfoTile label="Source Condition" value={consultation.conditionName} />
            <InfoTile label="Source Service" value={consultation.serviceName} />
          </div>
        </Section>

        <Section title="User Details">
          <div className="adp-info-grid">
            <InfoTile label="User Name" value={patient.name} />
            <InfoTile label="Gender" value={patient.gender} />
            <InfoTile label="Date of Birth" value={patient.dob} />
            <InfoTile label="Location" value={userLocation} />
            <InfoTile
              label="Phone Number"
              value={patient.mobile || patient.phone}
            />
            <InfoTile label="Email ID" value={patient.email} />
          </div>
        </Section>

        {doctorAssigned && (
          <Section title="Doctor Details">
            <div className="adp-info-grid">
              <InfoTile
                label="Doctor Name"
                value={
                  doctor
                    ? `${doctor.firstName || ""} ${doctor.surname || ""}`.trim()
                    : consultation.assignedDoctorName
                }
              />
              <InfoTile
                label="Specialization"
                value={
                  doctor?.specialization || consultation.assignedDoctorSpecialty
                }
              />
              <InfoTile label="Location" value={doctorLocation} />
              <InfoTile label="Doctor Email ID" value={doctor?.email} />
              <InfoTile label="Doctor Phone Number" value={doctorPhone} />
              <InfoTile label="Qualification" value={doctor?.qualification} />
              <InfoTile
                label="Assigned At"
                value={
                  consultation.assignedAt
                    ? new Date(consultation.assignedAt).toLocaleString()
                    : "-"
                }
              />
            </div>
          </Section>
        )}
        <Section title="Medical Reports">
          {reports.length === 0 ? (
            <p className="adp-muted">No medical reports attached.</p>
          ) : (
            <div className="adp-report-grid">
              {reports.map((report, index) => (
                <a
                  key={`${getReportUrl(report)}-${index}`}
                  href={getReportUrl(report)}
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
