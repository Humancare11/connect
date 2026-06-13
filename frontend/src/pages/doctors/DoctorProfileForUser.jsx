import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api";
import { useCurrency } from "../../hooks/useCurrency";
import { useAuth } from "../../context/AuthContext";
import "./DoctorProfile.css";

const StarIcon = ({ filled }) => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill={filled ? "#f59e0b" : "none"}
    stroke="#f59e0b"
    strokeWidth="2"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const icons = {
  pin: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  grad: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  ),
  brief: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  video: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  ),
  share: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  ),
  rx: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  support: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <line x1="4.93" y1="4.93" x2="9.17" y2="9.17" />
      <line x1="14.83" y1="14.83" x2="19.07" y2="19.07" />
      <line x1="14.83" y1="9.17" x2="19.07" y2="4.93" />
      <line x1="4.93" y1="19.07" x2="9.17" y2="14.83" />
    </svg>
  ),
  chat: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  copy: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  check: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  tag: (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
  back: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" />
    </svg>
  ),
};

const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function SectionHeader({ icon, label }) {
  return (
    <div className="dpfu-section-header">
      <div className="dpfu-section-icon">{icon}</div>
      <span className="dpfu-section-label">{label}</span>
    </div>
  );
}

function getInitials(name) {
  if (!name) return "DR";
  const parts = name
    .replace(/^Dr\.?\s*/i, "")
    .trim()
    .split(/\s+/);
  return (
    parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "DR"
  );
}

function extractDoctorId(raw) {
  if (!raw) return null;
  const match = raw.match(/^(\d{5})/);
  return match ? match[1] : null;
}

export default function DoctorProfileForUser({
  legacyId = false,
  adminView = false,
}) {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { formatPrice } = useCurrency();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setLoading(true);
    if (legacyId && id) {
      api
        .get(`/api/doctor/${id}`)
        .then((res) => setDoctor(res.data))
        .catch(() =>
          setError("Could not load doctor profile. Please try again."),
        )
        .finally(() => setLoading(false));
    } else {
      const numericId = extractDoctorId(slug);
      if (!numericId) {
        setError("Invalid profile URL.");
        setLoading(false);
        return;
      }
      api
        .get(`/api/doctor/profile/${numericId}`)
        .then((res) => setDoctor(res.data))
        .catch(() =>
          setError("Could not load doctor profile. Please try again."),
        )
        .finally(() => setLoading(false));
    }
  }, [id, slug, legacyId]);

  const handleBook = () => {
    if (!user) {
      navigate("/login", { state: { from: "/book-appointment", doctor } });
      return;
    }
    navigate("/book-appointment", { state: { doctor } });
  };

  if (loading) {
    return (
      <div className="dpfu-loading">
        <div className="dpfu-loading-inner">
          <div className="dpfu-spinner" />
          <p className="dpfu-loading-text">Loading profile…</p>
        </div>
      </div>
    );
  }

  if (error || !doctor) {
    return (
      <div className="dpfu-error">
        <div className="dpfu-error-inner">
          <p className="dpfu-error-emoji">⚠️</p>
          <h2>Profile not found</h2>
          <p>{error || "This doctor profile could not be loaded."}</p>
          <button
            onClick={() => navigate("/find-a-doctor")}
            className="dpfu-error-btn"
          >
            Back to Doctors
          </button>
        </div>
      </div>
    );
  }

  const initials = getInitials(doctor.name);
  const price =
    typeof doctor.price === "number" ? doctor.price : Number(doctor.price) || 0;
  const rating = doctor.rating ?? 4.8;
  const filledStars = Math.round(rating);
  const tags = [doctor.specialty, doctor.subSpecialty].filter(Boolean);
  const locationParts = [doctor.city, doctor.state, doctor.country]
    .filter(Boolean)
    .join(", ");

  const aboutFull = doctor.about || "";
  const aboutShort =
    aboutFull.length > 200 ? aboutFull.slice(0, 200) + "…" : aboutFull;

  const educationEntries = [];
  if (doctor.medicalSchool) {
    educationEntries.push({
      school: doctor.medicalSchool,
      degree: doctor.degree || "",
      years: "",
    });
  } else if (doctor.degree) {
    educationEntries.push({
      school: "Medical School",
      degree: doctor.degree,
      years: "",
    });
  }

  const experienceEntries = [];
  if (doctor.clinicName) {
    experienceEntries.push({
      place:
        doctor.clinicName +
        (doctor.clinicAddress ? ` · ${doctor.clinicAddress}` : ""),
      period: `${doctor.experience ? doctor.experience + "+ years" : ""}`,
      active: true,
    });
  } else if (doctor.experience) {
    experienceEntries.push({
      place: doctor.specialty || "Medical Practice",
      period: `${doctor.experience}+ years of experience`,
      active: true,
    });
  }

  const todayName =
    days[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const todayDate = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const avail = doctor.availability;
  const hasAvailability =
    avail && typeof avail === "object" && Object.keys(avail).length > 0;
  const isDayAvailable = (day) =>
    hasAvailability ? !!avail[day]?.enabled : true;
  const getDayTimes = (day) => {
    if (!hasAvailability || !avail[day]?.enabled) return null;
    const blocks = avail[day]?.blocks;
    if (!blocks?.length) return null;
    const fmt = (t) => {
      const [h, m] = t.split(":");
      const hh = parseInt(h, 10);
      return `${hh % 12 || 12}${m !== "00" ? `:${m}` : ""}${hh >= 12 ? "pm" : "am"}`;
    };
    return blocks.map((b) => `${fmt(b.start)}–${fmt(b.end)}`).join(", ");
  };
  const isTodayAvailable = isDayAvailable(todayName);

  const consultItems = [
    {
      icon: icons.video,
      text: doctor.consultationMode
        ? `${doctor.consultationMode} consultation`
        : "Video, audio, or chat",
    },
    { icon: icons.share, text: "Share reports securely" },
    { icon: icons.rx, text: "Prescriptions & sick notes included" },
    { icon: icons.support, text: "24/7 customer support" },
    { icon: icons.chat, text: "Free follow-up question" },
  ];

  return (
    <div className="dpfu-root">
      <div className="dpfu-wrapper">
        {/* Back link */}
        <button
          onClick={() =>
            adminView ? navigate("/admin-dashboard/our-doctors") : navigate(-1)
          }
          className="dpfu-back-btn"
        >
          {icons.back} {adminView ? "Back to Our Doctors" : "Back to results"}
        </button>

        {/* ── HERO BANNER CARD ── */}
        <div className="dpfu-hero-card">
          <div className="dpfu-hero-banner">
            <div className="dpfu-hero-pattern" />

            {doctor.verified && (
              <div className="dpfu-verified-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                    fill="#7ee8c2"
                  />
                  <polyline
                    points="9 12 11 14 15 10"
                    stroke="#0f2d5e"
                    strokeWidth="2"
                    fill="none"
                  />
                </svg>
                Platform Verified
              </div>
            )}

            <div className="dpfu-avatar-row">
              <div className="dpfu-avatar">{initials}</div>
              <div className="dpfu-hero-info">
                <h1>Dr. {doctor.name}</h1>
                {doctor.doctorId && (
                  <div className="dpfu-doctor-id-badge">
                    <span className="dpfu-id-label">ID</span>
                    <span className="dpfu-id-value">{doctor.doctorId}</span>
                  </div>
                )}
                {locationParts && (
                  <div className="dpfu-location">
                    {icons.pin} {locationParts}
                  </div>
                )}
                {tags.length > 0 && (
                  <div className="dpfu-hero-tags">
                    {tags.map((t) => (
                      <span key={t} className="dpfu-hero-tag">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div className="dpfu-stats-strip">
            <div className="dpfu-stats-row">
              <div className="dpfu-rating-box">
                <span className="dpfu-rating-value">{rating}</span>
                <div>
                  <div className="dpfu-stars">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <StarIcon key={i} filled={i <= filledStars} />
                    ))}
                  </div>
                  <div className="dpfu-rating-label">Rating</div>
                </div>
              </div>

              {doctor.experience > 0 && (
                <div className="dpfu-exp-box">
                  <div className="dpfu-exp-value">{doctor.experience}+</div>
                  <div className="dpfu-exp-label">Years Exp.</div>
                </div>
              )}

              {tags.length > 0 && <div className="dpfu-vdivider" />}

              {tags.length > 0 && (
                <div className="dpfu-specialty-tags">
                  {tags.map((t) => (
                    <span key={t} className="dpfu-specialty-tag">
                      {icons.tag} {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {doctor.languages?.length > 0 && (
              <div className="dpfu-languages-row">
                <span className="dpfu-lang-label">Languages</span>
                {doctor.languages.map((l) => (
                  <span key={l} className="dpfu-lang-tag">
                    {l}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── BODY GRID ── */}
        <div className="dpfu-body-grid">
          {/* LEFT */}
          <div className="dpfu-left-col">
            {/* Summary */}
            {aboutFull && (
              <div className="dpfu-card">
                <SectionHeader icon={icons.chat} label="Professional Summary" />
                <p className="dpfu-about-text">
                  {expanded ? aboutFull : aboutShort}
                </p>
                {aboutFull.length > 200 && (
                  <button
                    onClick={() => setExpanded(!expanded)}
                    className="dpfu-read-more-btn"
                  >
                    {expanded ? "Show less ↑" : "Read more ↓"}
                  </button>
                )}
              </div>
            )}

            {/* Education */}
            {educationEntries.length > 0 && (
              <div className="dpfu-card">
                <SectionHeader icon={icons.grad} label="Education" />
                {educationEntries.map((e, i, arr) => (
                  <div key={i} className="dpfu-timeline-item">
                    <div className="dpfu-timeline-track">
                      <div className="dpfu-timeline-dot" />
                      {i < arr.length - 1 && (
                        <div className="dpfu-timeline-line" />
                      )}
                    </div>
                    <div className="dpfu-timeline-content">
                      <p className="dpfu-timeline-title">{e.school}</p>
                      {e.degree && (
                        <p className="dpfu-timeline-sub">{e.degree}</p>
                      )}
                      {e.years && (
                        <p className="dpfu-timeline-years">{e.years}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Experience */}
            {experienceEntries.length > 0 && (
              <div className="dpfu-card">
                <SectionHeader icon={icons.brief} label="Experience" />
                {experienceEntries.map((e, i, arr) => (
                  <div key={i} className="dpfu-timeline-item">
                    <div className="dpfu-timeline-track">
                      <div
                        className={`dpfu-timeline-dot ${e.active ? "dpfu-timeline-dot--active" : "dpfu-timeline-dot--inactive"}`}
                      />
                      {i < arr.length - 1 && (
                        <div className="dpfu-timeline-line" />
                      )}
                    </div>
                    <div className="dpfu-timeline-content">
                      <p className="dpfu-timeline-title">{e.place}</p>
                      {e.period && (
                        <p
                          className={`dpfu-timeline-sub ${e.active ? "dpfu-timeline-sub--active" : ""}`}
                        >
                          {e.period}
                        </p>
                      )}
                      {e.active && (
                        <span className="dpfu-current-badge">Current</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Availability */}
            <div className="dpfu-card">
              <SectionHeader icon={icons.video} label="Weekly Availability" />
              {doctor.timezone && (
                <p className="dpfu-tz-note">Timezone: {doctor.timezone}</p>
              )}
              <div className="dpfu-avail-grid">
                {days.map((day) => {
                  const isToday = day === todayName;
                  const available = isDayAvailable(day);
                  const times = getDayTimes(day);
                  const dayClass =
                    isToday && available
                      ? "dpfu-avail-day--today"
                      : available
                        ? "dpfu-avail-day--available"
                        : "dpfu-avail-day--off";
                  const nameClass =
                    isToday && available
                      ? "dpfu-avail-day-name--today"
                      : available
                        ? "dpfu-avail-day-name--available"
                        : "dpfu-avail-day-name--off";
                  const timeClass =
                    isToday && available
                      ? "dpfu-avail-day-time--today"
                      : available
                        ? "dpfu-avail-day-time--available"
                        : "dpfu-avail-day-time--off";
                  return (
                    <div key={day} className={`dpfu-avail-day ${dayClass}`}>
                      <p className={`dpfu-avail-day-name ${nameClass}`}>
                        {day.slice(0, 3)}
                      </p>
                      <p className={`dpfu-avail-day-time ${timeClass}`}>
                        {available ? times || "Available" : "Off"}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="dpfu-avail-status">
                <div
                  className={`dpfu-avail-dot ${isTodayAvailable ? "dpfu-avail-dot--on" : "dpfu-avail-dot--off"}`}
                />
                <span
                  className={
                    isTodayAvailable
                      ? "dpfu-avail-status-text--on"
                      : "dpfu-avail-status-text--off"
                  }
                >
                  {isTodayAvailable
                    ? `Available Today · ${todayDate}`
                    : `Not available today · ${todayDate}`}
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT — sticky sidebar */}
          <div className="dpfu-sidebar">
            <div className="dpfu-sidebar-card">
              <p className="dpfu-sidebar-title">Consultation Details</p>

              <div className="dpfu-consult-list">
                {consultItems.map((item, i) => (
                  <div key={i} className="dpfu-consult-item">
                    <div className="dpfu-consult-icon">{item.icon}</div>
                    <span className="dpfu-consult-text">{item.text}</span>
                  </div>
                ))}
              </div>

              <div className="dpfu-sidebar-divider" />

              <div className="dpfu-fee-row">
                <span className="dpfu-fee-label">Consult Fee</span>
                <div className="dpfu-fee-value">
                  <span className="dpfu-fee-amount">
                    {formatPrice(price, doctor.feeCurrency || "USD")}
                  </span>
                  <div className="dpfu-fee-per">per session</div>
                </div>
              </div>

              <button onClick={handleBook} className="dpfu-book-btn">
                Book Appointment
              </button>

              <p className="dpfu-book-disclaimer">
                No hidden charges · Instant confirmation
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
