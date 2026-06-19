import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api";
import "./AdminAssignDoctor.css";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function includesToken(source, target) {
  const a = normalize(source);
  const b = normalize(target);
  return Boolean(a && b && (a.includes(b) || b.includes(a)));
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function doctorDisplayName(name) {
  const cleanName = String(name || "").trim();
  if (!cleanName) return "Doctor";
  return cleanName.toLowerCase().startsWith("dr.") ? cleanName : `Dr. ${cleanName}`;
}

function getAppointmentCountry(appointment) {
  return appointment?.patientId?.country || appointment?.country || "";
}

function getLicenseCountries(doctor) {
  return uniqueValues([
    doctor.licenseCountry,
    doctor.medicalLicenseCountry,
    doctor.registrationCountry,
    doctor.country,
    ...(Array.isArray(doctor.internationalLicenses) ? doctor.internationalLicenses : []),
  ]);
}

function scoreDoctor(doctor, appointment) {
  const appointmentCountry = getAppointmentCountry(appointment);
  const licenseCountries = getLicenseCountries(doctor);
  const priority = {
    specialty: includesToken(doctor.specialty, appointment.specialty),
    country: includesToken(doctor.country, appointmentCountry),
    licenseCountry: licenseCountries.some((country) => includesToken(country, appointmentCountry)),
  };
  let secondaryScore = 0;

  if (includesToken(doctor.subSpecialty, appointment.specialty)) {
    secondaryScore += 40;
  }
  if (
    includesToken(doctor.specialty, appointment.category) ||
    includesToken(doctor.about, appointment.category)
  ) {
    secondaryScore += 25;
  }
  if (
    includesToken(doctor.about, appointment.condition) ||
    includesToken(doctor.subSpecialty, appointment.condition)
  ) {
    secondaryScore += 20;
  }
  if (Number(doctor.experience) >= 10) {
    secondaryScore += 5;
  }

  const score =
    (priority.specialty ? 1000 : 0) +
    (priority.country ? 100 : 0) +
    (priority.licenseCountry ? 10 : 0) +
    secondaryScore / 100;

  return { score, priority, secondaryScore };
}

function DoctorRow({ doctor, appointment, assigning, selected, index, onAssign }) {
  return (
    <div className={`aad-doctor-row ${selected ? "aad-doctor-row--selected" : ""}`}>
      <div className="aad-cell aad-cell-sr">{index + 1}</div>
      <div className="aad-cell aad-cell-id">{doctor.doctorId || "-"}</div>
      <div className="aad-cell aad-cell-name">{doctorDisplayName(doctor.name)}</div>
      <div className="aad-cell aad-cell-specialty">{doctor.specialty || "-"}</div>
      <div className="aad-cell aad-cell-country">{doctor.country || "-"}</div>
      <div className="aad-doctor-action">
        <button
          type="button"
          className={`aad-assign-btn ${selected ? "aad-assign-btn--current" : doctor.doctorId ? "aad-assign-btn--primary" : ""}`}
          disabled={assigning || selected || !doctor.doctorId}
          onClick={() => onAssign(doctor)}
        >
          {selected ? "Assigned" : assigning ? "Assigning…" : appointment.doctorId ? "Reassign" : "Assign"}
        </button>
      </div>
    </div>
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
        if (alive) setError(err.response?.data?.msg || "Failed to load data.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadData();
    return () => { alive = false; };
  }, [id]);

  const rankedDoctors = useMemo(() => {
    if (!appointment) return [];
    const q = normalize(query);

    return doctors
      .map((doctor) => {
        const match = scoreDoctor(doctor, appointment);
        return {
          ...doctor,
          matchScore: match.score,
          matchPriority: match.priority,
          matchSecondaryScore: match.secondaryScore,
        };
      })
      .filter((doctor) => {
        if (!q) return true;
        return [
          doctor.name,
          doctor.doctorId,
          doctor.specialty,
          doctor.subSpecialty,
          doctor.city,
          doctor.state,
          doctor.country,
          ...(Array.isArray(doctor.internationalLicenses) ? doctor.internationalLicenses : []),
        ]
          .filter(Boolean).join(" ").toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const priorityCompare =
          Number(b.matchPriority?.specialty) - Number(a.matchPriority?.specialty) ||
          Number(b.matchPriority?.country) - Number(a.matchPriority?.country) ||
          Number(b.matchPriority?.licenseCountry) - Number(a.matchPriority?.licenseCountry);

        return (
          priorityCompare ||
          b.matchSecondaryScore - a.matchSecondaryScore ||
          String(a.name).localeCompare(String(b.name))
        );
      });
  }, [appointment, doctors, query]);

  const currentDoctorMongoId = appointment?.doctorId?._id?.toString() || "";

  const assignDoctor = async (doctor) => {
    if (!doctor?.doctorId || assigningDoctorId) return;
    setAssigningDoctorId(String(doctor.doctorId));
    setError("");
    setNotice("");
    try {
      const res = await api.put(`/api/appointments/${id}/change-doctor`, { doctorId: doctor.doctorId });
      setNotice(res.data?.msg || "Doctor assigned successfully.");
      setTimeout(() => navigate(`/admin-dashboard/appointments/${id}`), 900);
    } catch (err) {
      setError(err.response?.data?.msg || "Could not assign doctor.");
    } finally {
      setAssigningDoctorId("");
    }
  };

  if (loading) {
    return (
      <div className="aad-page">
        <div className="aad-loading">
          <div className="aad-spinner" />
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  if (error && !appointment) {
    return (
      <div className="aad-page">
        <div className="aad-empty">
          <p>{error}</p>
          <Link to="/admin-dashboard/appointments">Back to appointments</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="aad-page">

      {/* ── Top nav ── */}
      <div className="aad-nav">
        <Link className="aad-back" to={`/admin-dashboard/appointments/${id}`}>
          ← Back
        </Link>
        <span className="aad-nav-dot">·</span>
        <span className="aad-nav-title">Assign Doctor</span>
      </div>

      {/* ── Appointment bar – single horizontal strip ── */}
      <div className="aad-appt-bar">
        <div className="aad-appt-field">
          <span className="aad-appt-label">Patient</span>
          <span className="aad-appt-val">{appointment.patientId?.name || "—"}</span>
        </div>
        <div className="aad-appt-sep" />
        <div className="aad-appt-field">
          <span className="aad-appt-label">Country</span>
          <span className="aad-appt-val">{getAppointmentCountry(appointment) || "—"}</span>
        </div>
        <div className="aad-appt-sep" />
        <div className="aad-appt-field">
          <span className="aad-appt-label">Category</span>
          <span className="aad-appt-val">{appointment.category || "—"}</span>
        </div>
        <div className="aad-appt-sep" />
        <div className="aad-appt-field">
          <span className="aad-appt-label">Specialty</span>
          <span className="aad-appt-val">{appointment.specialty || "—"}</span>
        </div>
        <div className="aad-appt-sep" />
        <div className="aad-appt-field">
          <span className="aad-appt-label">Condition</span>
          <span className="aad-appt-val">{appointment.condition || "—"}</span>
        </div>
        <div className="aad-appt-sep" />
        <div className="aad-appt-field">
          <span className="aad-appt-label">Date</span>
          <span className="aad-appt-val">{appointment.date || "—"}</span>
        </div>
        <div className="aad-appt-sep" />
        <div className="aad-appt-field">
          <span className="aad-appt-label">Time</span>
          <span className="aad-appt-val">{appointment.time || "—"}</span>
        </div>
        <div className="aad-appt-sep" />
        <div className="aad-appt-field">
          <span className="aad-appt-label">Current Doctor</span>
          <span className="aad-appt-val aad-appt-doctor">
            {appointment.doctorId?.name || "Unassigned"}
          </span>
        </div>
      </div>

      {/* ── Banner ── */}
      {(error || notice) && (
        <div className={`aad-banner ${error ? "aad-banner--error" : "aad-banner--ok"}`}>
          {error || notice}
        </div>
      )}

      {/* ── Doctor list ── */}
      <div className="aad-list-section">

        {/* Column header + search */}
        <div className="aad-list-header">
          <div className="aad-list-title">
            <h2>Recommended doctors</h2>
            <p>Ranking uses specialty, country, license country, and clinical fit.</p>
          </div>
          <label className="aad-search">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Search by name, ID, specialty, country…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>

        {/* Rows */}
        <div className="aad-doctor-list">
          <div className="aad-doctor-row aad-doctor-row--head">
            <div className="aad-col aad-cell-sr">Sr. No.</div>
            <div className="aad-col aad-cell-id">Doctor ID</div>
            <div className="aad-col aad-cell-name">Doctor Name</div>
            <div className="aad-col aad-cell-specialty">Specialty</div>
            <div className="aad-col aad-cell-country">Country</div>
            <div className="aad-col aad-cell-assign">Assign</div>
          </div>
          {rankedDoctors.length === 0 ? (
            <div className="aad-empty-row">No doctors match. Adjust search or approve more doctors.</div>
          ) : (
            rankedDoctors.map((doctor, index) => (
              <DoctorRow
                key={doctor.id || doctor.doctorId}
                doctor={doctor}
                appointment={appointment}
                assigning={assigningDoctorId === String(doctor.doctorId)}
                selected={doctor.mongoId?.toString() === currentDoctorMongoId}
                index={index}
                onAssign={assignDoctor}
              />
            ))
          )}
        </div>

        <p className="aad-count">{rankedDoctors.length} of {doctors.length} approved doctors shown</p>
      </div>
    </div>
  );
}
