import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Country } from "country-state-city";
import api from "../../api";
import { useToast } from "../../components/ui/Toast";
import "./AdminAssignDoctor.css";
import { alternateDoctor, assignDoctor, revertDoctor } from "./appointments/bookingApi";
import { toTime12, toTime24 } from "./appointments/bookingFormat";
import { buildView, doctorDisplayName, isCurrentDoctor, listUrl, rankDoctors, savedMessage } from "./appointments/assignPageLogic";

function getCountryName(isoCode) {
  if (!isoCode) return "";
  const country = Country.getCountryByCode(isoCode);
  return country?.name || isoCode;
}

function DoctorRow({ doctor, hasDoctor, assigning, selected, disabled, index, onAssign }) {
  const verb = hasDoctor ? "Reassign" : "Assign";
  return (
    <div className={`aad-doctor-row ${selected ? "aad-doctor-row--selected" : ""}`}>
      <div className="aad-cell aad-cell-sr">{index + 1}</div>
      <div className="aad-cell aad-cell-id">{doctor.doctorId || "-"}</div>
      <div className="aad-cell aad-cell-name">
        <span className="aad-name-text">{doctorDisplayName(doctor.name)}</span>
        {/* shown instead of the ID column on tablet/phone layouts */}
        <span className="aad-id-inline">ID: {doctor.doctorId || "-"}</span>
      </div>
      <div className="aad-cell-group">
        <div className="aad-cell aad-cell-specialty">{doctor.specialty || "-"}</div>
        <div className="aad-cell aad-cell-country">{getCountryName(doctor.country) || "-"}</div>
      </div>
      <div className="aad-doctor-action">
        <button
          type="button"
          aria-label={`${selected ? "Assigned" : verb} ${doctorDisplayName(doctor.name)}`}
          className={`aad-assign-btn ${selected ? "aad-assign-btn--current" : doctor.id ? "aad-assign-btn--primary" : ""}`}
          disabled={assigning || selected || disabled || !doctor.id}
          onClick={() => onAssign(doctor)}
        >
          {selected ? "Assigned" : assigning ? "Assigning…" : verb}
        </button>
      </div>
    </div>
  );
}

// The full-page Assign doctor / Alternate doctor screen, for both kinds of booking (the booking's kind decides what it
// shows). A booking with no doctor is assigned one (POST assign-doctor); a booking with a doctor is given an alternate
// (POST alternate-doctor), with "Go back to <original>" when the original doctor is stored. Either way the booking ends
// Assigned, and the doctor still has to confirm it. After saving it returns to the list, on the same tab and page.
export default function AdminAssignDoctor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const backTo = listUrl(searchParams.get("from"));

  const [view, setView] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigningDoctorId, setAssigningDoctorId] = useState("");
  const [reverting, setReverting] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  // Only for a Next Available category booking, where the admin picks the appointment time.
  const [appointmentTime, setAppointmentTime] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const [bookingRes, doctorsRes] = await Promise.all([api.get(`/api/admin/bookings/${id}`), api.get("/api/doctor/approved")]);
        const { booking, detail } = bookingRes.data;
        // A regular appointment is shown from the appointment record, as the old page did.
        const appointment = booking.kind === "appointment" ? (await api.get(`/api/appointments/${id}`)).data : null;
        if (!alive) return;
        const next = buildView(booking, appointment, detail);
        setView(next);
        setAppointmentTime(next.initialTime);
        setDoctors(Array.isArray(doctorsRes.data) ? doctorsRes.data : []);
      } catch (err) {
        if (alive) setError(err.response?.data?.msg || "Failed to load data.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadData();
    return () => {
      alive = false;
    };
  }, [id]);

  const rankedDoctors = useMemo(() => (view ? rankDoctors(doctors, view.fit, query) : []), [view, doctors, query]);

  // Runs one save; on success it goes back to the list with a toast, on failure the server's message stays on this page.
  const save = async (action, call) => {
    setError("");
    try {
      await call();
      toast.success(savedMessage(action, view.originalDoctorName));
      navigate(backTo);
    } catch (err) {
      setError(err.response?.data?.msg || "Could not save the doctor. Please try again.");
      return false;
    }
    return true;
  };

  const choose = async (doctor) => {
    if (!doctor?.id || assigningDoctorId || reverting || view.closed) return;
    if (view.needsTime && !appointmentTime.trim()) {
      setError("Enter the appointment time you're assigning before selecting a doctor.");
      return;
    }
    setAssigningDoctorId(String(doctor.id));
    const ok = await (view.hasDoctor
      ? save("alternate", () => alternateDoctor(id, { doctorId: doctor.id }))
      : save("assign", () => assignDoctor(id, { doctorId: doctor.id, ...(view.needsTime ? { appointmentTime: appointmentTime.trim() } : {}) })));
    if (!ok) setAssigningDoctorId("");
  };

  const goBackToOriginal = async () => {
    if (reverting || assigningDoctorId) return;
    setReverting(true);
    const ok = await save("revert", () => revertDoctor(id));
    if (!ok) setReverting(false);
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

  if (error && !view) {
    return (
      <div className="aad-page">
        <div className="aad-empty">
          <p>{error}</p>
          <Link to={backTo}>Back to appointments</Link>
        </div>
      </div>
    );
  }

  const isCategory = view.kind === "category";
  const busy = Boolean(assigningDoctorId) || reverting;

  return (
    <div className="aad-page">
      {/* ── Top nav ── */}
      <div className="aad-nav">
        <Link className="aad-back" to={backTo}>
          ← Back
        </Link>
        <span className="aad-nav-dot">·</span>
        <span className="aad-nav-title">{view.hasDoctor ? "Alternate Doctor" : "Assign Doctor"}</span>
      </div>

      {/* ── Booking bar – single horizontal strip ── */}
      <div className="aad-appt-bar">
        {isCategory ? (
          <>
            <div className="aad-appt-field">
              <span className="aad-appt-label">Concern</span>
              <span className="aad-appt-val">{view.concern || "—"}</span>
            </div>
            <div className="aad-appt-sep" />
            <div className="aad-appt-field">
              <span className="aad-appt-label">Severity</span>
              <span className="aad-appt-val">{view.severity || "—"}</span>
            </div>
            <div className="aad-appt-sep" />
            <div className="aad-appt-field">
              <span className="aad-appt-label">Support Type</span>
              <span className="aad-appt-val">{view.supportType || "—"}</span>
            </div>
            <div className="aad-appt-sep" />
            <div className="aad-appt-field">
              <span className="aad-appt-label">Urgency</span>
              <span className="aad-appt-val">{view.urgency || "—"}</span>
            </div>
            <div className="aad-appt-sep" />
            <div className="aad-appt-field">
              <span className="aad-appt-label">Time Window</span>
              <span className="aad-appt-val">{view.timeWindow || "—"}</span>
            </div>
            <div className="aad-appt-sep" />
            <div className="aad-appt-field">
              <span className="aad-appt-label">{view.needsTime ? "Appointment" : "Slot"}</span>
              {view.needsTime ? (
                <input
                  type="time"
                  aria-label="Appointment time"
                  className="aad-appt-val"
                  value={toTime24(appointmentTime)}
                  onChange={(e) => {
                    setAppointmentTime(toTime12(e.target.value));
                    setError("");
                  }}
                  style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "2px 8px" }}
                />
              ) : (
                <span className="aad-appt-val">{view.slotText || "—"}</span>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="aad-appt-field">
              <span className="aad-appt-label">Patient</span>
              <span className="aad-appt-val">{view.patientName || "—"}</span>
            </div>
            <div className="aad-appt-sep" />
            <div className="aad-appt-field">
              <span className="aad-appt-label">Country</span>
              <span className="aad-appt-val">{getCountryName(view.country) || "—"}</span>
            </div>
            <div className="aad-appt-sep" />
            <div className="aad-appt-field">
              <span className="aad-appt-label">Category</span>
              <span className="aad-appt-val">{view.category || "—"}</span>
            </div>
            <div className="aad-appt-sep" />
            <div className="aad-appt-field">
              <span className="aad-appt-label">Specialty</span>
              <span className="aad-appt-val">{view.specialty || "—"}</span>
            </div>
            <div className="aad-appt-sep" />
            <div className="aad-appt-field">
              <span className="aad-appt-label">Condition</span>
              <span className="aad-appt-val">{view.condition || "—"}</span>
            </div>
            <div className="aad-appt-sep" />
            <div className="aad-appt-field">
              <span className="aad-appt-label">Date</span>
              <span className="aad-appt-val">{view.date || "—"}</span>
            </div>
            <div className="aad-appt-sep" />
            <div className="aad-appt-field">
              <span className="aad-appt-label">Time</span>
              <span className="aad-appt-val">{view.time || "—"}</span>
            </div>
          </>
        )}
        <div className="aad-appt-sep" />
        <div className="aad-appt-field">
          <span className="aad-appt-label">Current Doctor</span>
          <span className="aad-appt-val aad-appt-doctor">{view.currentDoctorName || "Unassigned"}</span>
        </div>
      </div>

      {/* ── Go back to the original doctor (only when one is stored) ── */}
      {view.hasDoctor && view.originalDoctorName && !view.closed && (
        <div className="aad-original">
          <span>
            Originally with <b>{view.originalDoctorName}</b>.
          </span>
          <button type="button" className="aad-original-btn" disabled={busy} onClick={goBackToOriginal}>
            {reverting ? "Going back…" : `Go back to ${view.originalDoctorName}`}
          </button>
        </div>
      )}

      {/* ── Banner ── */}
      {(error || view.closed) && (
        <div className="aad-banner aad-banner--error" role="alert">
          {error || `A ${view.status} booking can't change doctor.`}
        </div>
      )}

      {/* ── Doctor list ── */}
      <div className="aad-list-section">
        {/* Column header + search */}
        <div className="aad-list-header">
          <div className="aad-list-title">
            <h2>Recommended doctors</h2>
            <p>Ranking uses specialty, country, license country, and clinical fit. The doctor you pick is asked to confirm the booking.</p>
          </div>
          <label className="aad-search">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              aria-label="Search doctors by name, ID, specialty or country"
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
                hasDoctor={view.hasDoctor}
                assigning={assigningDoctorId === String(doctor.id)}
                selected={isCurrentDoctor(doctor, view)}
                disabled={view.closed || reverting}
                index={index}
                onAssign={choose}
              />
            ))
          )}
        </div>

        <p className="aad-count">
          {rankedDoctors.length} of {doctors.length} approved doctors shown
        </p>
      </div>
    </div>
  );
}
