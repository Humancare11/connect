import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api";
import "./AdminAppointments.css";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function includesToken(source, target) {
  const a = normalize(source);
  const b = normalize(target);
  return Boolean(a && b && (a.includes(b) || b.includes(a)));
}

function scoreDoctor(doctor, appointment) {
  let score = 0;
  const reasons = [];

  if (includesToken(doctor.specialty, appointment.specialty)) {
    score += 70;
    reasons.push("Specialty match");
  }
  if (includesToken(doctor.subSpecialty, appointment.specialty)) {
    score += 40;
    reasons.push("Sub-specialty match");
  }
  if (includesToken(doctor.specialty, appointment.category) || includesToken(doctor.about, appointment.category)) {
    score += 25;
    reasons.push("Category fit");
  }
  if (includesToken(doctor.about, appointment.condition) || includesToken(doctor.subSpecialty, appointment.condition)) {
    score += 20;
    reasons.push("Condition experience");
  }
  if (Number(doctor.experience) >= 10) {
    score += 5;
    reasons.push("Senior clinician");
  }

  return { score, reasons };
}

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function DoctorCard({ doctor, appointment, assigning, selected, onAssign }) {
  const initials = (doctor.name || "D").slice(0, 1).toUpperCase();
  const location = [doctor.city, doctor.country].filter(Boolean).join(", ") || doctor.location || "-";

  return (
    <article className={`adp-doctor-match-card ${selected ? "adp-doctor-match-card--selected" : ""}`}>
      <div className="adp-doctor-match-head">
        <div className="adp-doctor-avatar">{initials}</div>
        <div>
          <span>Dr. {doctor.doctorId || "ID pending"}</span>
          <h2>{doctor.name}</h2>
          <p>{doctor.specialty || "Specialty not listed"}</p>
        </div>
      </div>

      <div className="adp-doctor-metrics">
        <div>
          <span>Experience</span>
          <strong>{doctor.experience || "-"} yrs</strong>
        </div>
        <div>
          <span>Fee</span>
          <strong>{formatMoney(doctor.price)}</strong>
        </div>
        <div>
          <span>Location</span>
          <strong>{location}</strong>
        </div>
      </div>

      <div className="adp-match-reasons">
        {(doctor.matchReasons.length ? doctor.matchReasons : ["Available approved doctor"]).slice(0, 3).map((reason) => (
          <span key={reason}>{reason}</span>
        ))}
      </div>

      <p className="adp-doctor-about">{doctor.about || "Profile summary is not available."}</p>

      <button
        type="button"
        className="adp-assign-primary"
        disabled={assigning || selected || !doctor.doctorId}
        onClick={() => onAssign(doctor)}
      >
        {selected ? "Current Doctor" : assigning ? "Assigning..." : appointment.doctorId ? "Assign Alternate" : "Assign Doctor"}
      </button>
    </article>
  );
}

export default function AdminAssignDoctor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigningDoctorId, setAssigningDoctorId] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const [appointmentRes, doctorsRes] = await Promise.all([
          api.get(`/api/appointments/${id}`),
          api.get("/api/doctor/approved"),
        ]);

        if (!alive) return;
        setAppointment(appointmentRes.data);
        setDoctors(Array.isArray(doctorsRes.data) ? doctorsRes.data : []);
      } catch (err) {
        console.error("Failed to load assignment data", err);
        if (alive) setError(err.response?.data?.msg || "Failed to load assignment data.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadData();
    return () => {
      alive = false;
    };
  }, [id]);

  const rankedDoctors = useMemo(() => {
    if (!appointment) return [];
    const q = normalize(query);

    return doctors
      .map((doctor) => {
        const match = scoreDoctor(doctor, appointment);
        return { ...doctor, matchScore: match.score, matchReasons: match.reasons };
      })
      .filter((doctor) => {
        if (!q) return true;
        return [
          doctor.name,
          doctor.doctorId,
          doctor.specialty,
          doctor.subSpecialty,
          doctor.city,
          doctor.country,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => b.matchScore - a.matchScore || String(a.name).localeCompare(String(b.name)));
  }, [appointment, doctors, query]);

  const suggestedDoctors = rankedDoctors.filter((doctor) => doctor.matchScore > 0);
  const currentDoctorMongoId = appointment?.doctorId?._id?.toString() || "";

  const assignDoctor = async (doctor) => {
    if (!doctor?.doctorId || assigningDoctorId) return;

    setAssigningDoctorId(String(doctor.doctorId));
    setError("");
    setNotice("");

    try {
      const res = await api.put(`/api/appointments/${id}/change-doctor`, {
        doctorId: doctor.doctorId,
      });
      setNotice(res.data?.msg || "Doctor assigned successfully.");
      setTimeout(() => navigate(`/admin-dashboard/appointments/${id}`), 900);
    } catch (err) {
      console.error("Doctor assignment failed", err);
      setError(err.response?.data?.msg || "Could not assign doctor.");
    } finally {
      setAssigningDoctorId("");
    }
  };

  if (loading) {
    return (
      <div className="adp-page">
        <div className="adp-loading">
          <div className="adp-spinner" />
          <p>Loading assignment workspace...</p>
        </div>
      </div>
    );
  }

  if (error && !appointment) {
    return (
      <div className="adp-page">
        <div className="adp-empty">
          <h3>Assignment unavailable</h3>
          <p>{error}</p>
          <Link className="adp-view-btn" to="/admin-dashboard/appointments">Back to appointments</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="adp-page adp-assign-page">
      <div className="adp-assign-hero">
        <div>
          <Link className="adp-back-link" to={`/admin-dashboard/appointments/${id}`}>Back to details</Link>
          <span className="adp-eyebrow">Care Team Assignment</span>
          <h1 className="adp-title">{appointment.patientId?.name || "Patient"}</h1>
          <p className="adp-sub">
            {appointment.category || "Category pending"} - {appointment.specialty || "Specialty pending"} - {appointment.condition || "Condition pending"}
          </p>
        </div>
        <div className="adp-assignment-status">
          <span>Current Doctor</span>
          <strong>{appointment.doctorId?.name || "Unassigned"}</strong>
        </div>
      </div>

      {(error || notice) && (
        <div className={`adp-assignment-banner ${error ? "adp-assignment-banner--error" : ""}`}>
          {error || notice}
        </div>
      )}

      <div className="adp-assign-layout">
        <aside className="adp-request-panel">
          <h2>Appointment Request</h2>
          <div className="adp-request-list">
            <div><span>Category</span><strong>{appointment.category || "-"}</strong></div>
            <div><span>Specialty</span><strong>{appointment.specialty || "-"}</strong></div>
            <div><span>Condition</span><strong>{appointment.condition || "-"}</strong></div>
            <div><span>Date</span><strong>{appointment.date || "-"}</strong></div>
            <div><span>Time</span><strong>{appointment.time || "-"}</strong></div>
            <div><span>Consultation</span><strong>{formatMoney(appointment.consultationPrice || appointment.paymentAmount / 100)}</strong></div>
          </div>
          <div className="adp-detail-note">
            <span>Consultation Details</span>
            <p>{appointment.problem || "No consultation details provided."}</p>
          </div>
        </aside>

        <main className="adp-doctor-workspace">
          <div className="adp-workspace-header">
            <div>
              <h2>Suggested Doctors</h2>
              <p>{suggestedDoctors.length} matched from {doctors.length} approved doctors.</p>
            </div>
            <label className="adp-search adp-search--wide">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                placeholder="Search doctor name, ID, specialty, city..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>

          {rankedDoctors.length === 0 ? (
            <div className="adp-empty">
              <h3>No doctors found</h3>
              <p>Adjust the search or approve more doctors for this specialty.</p>
            </div>
          ) : (
            <div className="adp-doctor-match-grid">
              {rankedDoctors.map((doctor) => (
                <DoctorCard
                  key={doctor.id || doctor.doctorId}
                  doctor={doctor}
                  appointment={appointment}
                  assigning={assigningDoctorId === String(doctor.doctorId)}
                  selected={doctor.mongoId?.toString() === currentDoctorMongoId}
                  onAssign={assignDoctor}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
