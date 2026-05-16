import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api";
import { useCurrency } from "../../hooks/useCurrency";

const StarIcon = ({ filled }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill={filled ? "#f59e0b" : "none"} stroke="#f59e0b" strokeWidth="2">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const icons = {
  pin: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>,
  grad: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>,
  brief: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>,
  video: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>,
  share: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>,
  rx: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
  support: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" /><line x1="4.93" y1="4.93" x2="9.17" y2="9.17" /><line x1="14.83" y1="14.83" x2="19.07" y2="19.07" /><line x1="14.83" y1="9.17" x2="19.07" y2="4.93" /><line x1="4.93" y1="19.07" x2="9.17" y2="14.83" /></svg>,
  chat: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  copy: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
  check: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>,
  tag: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>,
  back: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" strokeLinecap="round" /></svg>,
};

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const card = {
  background: "#fff",
  borderRadius: 16,
  padding: "22px 24px",
  boxShadow: "0 1px 8px rgba(15,45,94,0.07)",
  border: "1px solid #e5eaf4",
};

function SectionHeader({ icon, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: "#eef4ff", border: "1px solid #c5d8f5", display: "flex", alignItems: "center", justifyContent: "center", color: "#1a4a8a" }}>
        {icon}
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#0f2d5e", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
    </div>
  );
}

function getInitials(name) {
  if (!name) return "DR";
  const parts = name.replace(/^Dr\.?\s*/i, "").trim().split(/\s+/);
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("") || "DR";
}

export default function DoctorProfileForUser() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { formatPrice } = useCurrency();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/api/doctor/${id}`)
      .then(res => setDoctor(res.data))
      .catch(() => setError("Could not load doctor profile. Please try again."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCopy = () => {
    navigator.clipboard.writeText("FIRSTCONSULT");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBook = () => {
    navigate("/book-appointment", { state: { doctor } });
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#eef2f8", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, border: "3px solid #c5d8f5", borderTopColor: "#1a4a8a", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "#4a6fa5", fontSize: 14 }}>Loading profile…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error || !doctor) {
    return (
      <div style={{ minHeight: "100vh", background: "#eef2f8", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <p style={{ fontSize: 48, marginBottom: 12 }}>⚠️</p>
          <h2 style={{ color: "#0f2d5e", marginBottom: 8 }}>Profile not found</h2>
          <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>{error || "This doctor profile could not be loaded."}</p>
          <button onClick={() => navigate("/find-a-doctor")} style={{ background: "#1a4a8a", color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Back to Doctors
          </button>
        </div>
      </div>
    );
  }

  const initials = getInitials(doctor.name);
  const price = typeof doctor.price === "number" ? doctor.price : Number(doctor.price) || 0;
  const rating = doctor.rating ?? 4.8;
  const filledStars = Math.round(rating);
  const tags = [doctor.specialty, doctor.subSpecialty].filter(Boolean);
  const locationParts = [doctor.city, doctor.state, doctor.country].filter(Boolean).join(", ");

  const aboutFull = doctor.about || "";
  const aboutShort = aboutFull.length > 200 ? aboutFull.slice(0, 200) + "…" : aboutFull;

  const educationEntries = [];
  if (doctor.medicalSchool) {
    educationEntries.push({ school: doctor.medicalSchool, degree: doctor.degree || "", years: "" });
  } else if (doctor.degree) {
    educationEntries.push({ school: "Medical School", degree: doctor.degree, years: "" });
  }

  const experienceEntries = [];
  if (doctor.clinicName) {
    experienceEntries.push({
      place: doctor.clinicName + (doctor.clinicAddress ? ` · ${doctor.clinicAddress}` : ""),
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

  const todayName = days[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const todayDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  const avail = doctor.availability;
  const hasAvailability = avail && typeof avail === "object" && Object.keys(avail).length > 0;
  const isDayAvailable = (day) => hasAvailability ? !!(avail[day]?.enabled) : true;
  const getDayTimes = (day) => {
    if (!hasAvailability || !avail[day]?.enabled) return null;
    const blocks = avail[day]?.blocks;
    if (!blocks?.length) return null;
    const fmt = (t) => {
      const [h, m] = t.split(":");
      const hh = parseInt(h, 10);
      return `${hh % 12 || 12}${m !== "00" ? `:${m}` : ""}${hh >= 12 ? "pm" : "am"}`;
    };
    return blocks.map(b => `${fmt(b.start)}–${fmt(b.end)}`).join(", ");
  };
  const isTodayAvailable = isDayAvailable(todayName);

  return (
    <div style={{ background: "#eef2f8", minHeight: "100vh", fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Syne:wght@600;700&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 16px 56px" }}>

        {/* Back link */}
        <button onClick={() => navigate(-1)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#4a6fa5", fontSize: 13, fontWeight: 600, marginBottom: 18, padding: 0 }}>
          {icons.back} Back to results
        </button>

        {/* ── HERO BANNER CARD ── */}
        <div style={{ background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 20px rgba(15,45,94,0.10)", marginBottom: 20 }}>

          <div style={{
            background: "linear-gradient(125deg, #0f2d5e 0%, #1a4a8a 60%, #1e5799 100%)",
            padding: "28px 28px",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", inset: 0, opacity: 0.06, backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "20px 20px" }} />

            {/* Verified badge */}
            {doctor.verified && (
              <div style={{ position: "absolute", top: 20, right: 24, zIndex: 2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.10)", border: "1.5px solid rgba(255,255,255,0.22)", borderRadius: 12, padding: "6px 14px", color: "#7ee8c2", fontSize: 12, fontWeight: 600 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#7ee8c2" />
                    <polyline points="9 12 11 14 15 10" stroke="#0f2d5e" strokeWidth="2" fill="none" />
                  </svg>
                  Platform Verified
                </div>
              </div>
            )}

            {/* Avatar + name */}
            <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{
                width: 90, height: 90, borderRadius: 18, flexShrink: 0,
                background: "linear-gradient(135deg, #c8d9f0, #9ab8dc)",
                border: "3.5px solid rgba(255,255,255,0.35)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 700, color: "#0f2d5e",
              }}>{initials}</div>

              <div>
                <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "-0.2px" }}>
                  Dr. {doctor.name}
                </h1>
                {locationParts && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5, color: "#93b8e0", fontSize: 13 }}>
                    {icons.pin} {locationParts}
                  </div>
                )}
                {tags.length > 0 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    {tags.map(t => (
                      <span key={t} style={{ fontSize: 12, fontWeight: 500, padding: "4px 13px", borderRadius: 20, background: "rgba(255,255,255,0.12)", color: "#cde3f7", border: "1px solid rgba(255,255,255,0.18)" }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div style={{ padding: "18px 28px 22px", borderBottom: "1px solid #edf2f7" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>

              {/* Rating */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff8ed", border: "1px solid #fde68a", borderRadius: 12, padding: "8px 16px" }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: "#92400e", fontFamily: "'Syne', sans-serif" }}>{rating}</span>
                <div>
                  <div style={{ display: "flex", gap: 2 }}>{[1, 2, 3, 4, 5].map(i => <StarIcon key={i} filled={i <= filledStars} />)}</div>
                  <div style={{ fontSize: 11, color: "#b45309", marginTop: 2 }}>Rating</div>
                </div>
              </div>

              {/* Experience */}
              {doctor.experience > 0 && (
                <div style={{ background: "#eef4ff", border: "1px solid #c5d8f5", borderRadius: 12, padding: "8px 16px" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#0f2d5e", fontFamily: "'Syne', sans-serif" }}>{doctor.experience}+</div>
                  <div style={{ fontSize: 11, color: "#4a6fa5", marginTop: 2 }}>Years Exp.</div>
                </div>
              )}

              {tags.length > 0 && <div style={{ width: 1, height: 36, background: "#e5eaf4" }} />}

              {/* Specialty tags */}
              {tags.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                  {tags.map(t => (
                    <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#f0f5ff", border: "1px solid #dce6f2", color: "#1a4a8a", fontSize: 12, padding: "5px 11px", borderRadius: 20 }}>
                      {icons.tag} {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Languages */}
            {doctor.languages?.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>Languages</span>
                {doctor.languages.map(l => (
                  <span key={l} style={{ fontSize: 12, fontWeight: 500, color: "#1a4a8a", background: "#eef4ff", border: "1px solid #c5d8f5", borderRadius: 20, padding: "3px 12px" }}>{l}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── BODY GRID ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 290px", gap: 20, alignItems: "start" }}>

          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Summary */}
            {aboutFull && (
              <div style={card}>
                <SectionHeader icon={icons.chat} label="Professional Summary" />
                <p style={{ color: "#4b5563", fontSize: 13.5, lineHeight: 1.8, margin: 0 }}>
                  {expanded ? aboutFull : aboutShort}
                </p>
                {aboutFull.length > 200 && (
                  <button onClick={() => setExpanded(!expanded)} style={{ background: "none", border: "none", cursor: "pointer", color: "#1a4a8a", fontSize: 12, fontWeight: 600, marginTop: 8, padding: 0 }}>
                    {expanded ? "Show less ↑" : "Read more ↓"}
                  </button>
                )}
              </div>
            )}

            {/* Education */}
            {educationEntries.length > 0 && (
              <div style={card}>
                <SectionHeader icon={icons.grad} label="Education" />
                {educationEntries.map((e, i, arr) => (
                  <div key={i} style={{ display: "flex", gap: 14, paddingBottom: i < arr.length - 1 ? 16 : 0 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#1a4a8a", border: "2px solid #c5d8f5", flexShrink: 0, marginTop: 4 }} />
                      {i < arr.length - 1 && <div style={{ width: 2, flex: 1, background: "#dce8f7", marginTop: 4 }} />}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "#111827" }}>{e.school}</p>
                      {e.degree && <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{e.degree}</p>}
                      {e.years && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#1a4a8a", fontWeight: 600 }}>{e.years}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Experience */}
            {experienceEntries.length > 0 && (
              <div style={card}>
                <SectionHeader icon={icons.brief} label="Experience" />
                {experienceEntries.map((e, i, arr) => (
                  <div key={i} style={{ display: "flex", gap: 14, paddingBottom: i < arr.length - 1 ? 16 : 0 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: e.active ? "#0f2d5e" : "#d1d5db", border: e.active ? "2px solid #a0bce0" : "2px solid #e5e7eb", flexShrink: 0, marginTop: 4 }} />
                      {i < arr.length - 1 && <div style={{ width: 2, flex: 1, background: "#e5e7eb", marginTop: 4 }} />}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "#111827" }}>{e.place}</p>
                      {e.period && <p style={{ margin: "3px 0 0", fontSize: 12, color: e.active ? "#1a4a8a" : "#9ca3af", fontWeight: e.active ? 600 : 400 }}>{e.period}</p>}
                      {e.active && (
                        <span style={{ display: "inline-block", marginTop: 5, fontSize: 10, fontWeight: 700, color: "#0f2d5e", background: "#dbeafe", border: "1px solid #bfd3f7", borderRadius: 20, padding: "2px 10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Current
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Availability */}
            <div style={card}>
              <SectionHeader icon={icons.video} label="Weekly Availability" />
              {doctor.timezone && (
                <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 12, marginTop: -8 }}>Timezone: {doctor.timezone}</p>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {days.map(day => {
                  const isToday = day === todayName;
                  const available = isDayAvailable(day);
                  const times = getDayTimes(day);
                  return (
                    <div key={day} style={{
                      borderRadius: 10, padding: "10px 12px",
                      background: isToday && available ? "#0f2d5e" : available ? "#f8faff" : "#f3f4f6",
                      border: isToday && available ? "1.5px solid #0f2d5e" : available ? "1px solid #e0e8f5" : "1px solid #e5e7eb",
                      opacity: available ? 1 : 0.55,
                    }}>
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: isToday && available ? "#93b8e0" : available ? "#9ca3af" : "#d1d5db" }}>{day.slice(0, 3)}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 11, fontWeight: 600, color: isToday && available ? "#fff" : available ? "#1a4a8a" : "#9ca3af" }}>
                        {available ? (times || "Available") : "Off"}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: isTodayAvailable ? "#10b981" : "#9ca3af", boxShadow: isTodayAvailable ? "0 0 0 3px rgba(16,185,129,0.18)" : "none" }} />
                <span style={{ fontSize: 12, color: isTodayAvailable ? "#059669" : "#6b7280", fontWeight: 600 }}>
                  {isTodayAvailable ? `Available Today · ${todayDate}` : `Not available today · ${todayDate}`}
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT — sticky sidebar */}
          <div style={{ position: "sticky", top: 20 }}>
            <div style={{ ...card, padding: "22px 20px" }}>
              <p style={{ margin: "0 0 16px", fontSize: 11, fontWeight: 700, color: "#0f2d5e", textTransform: "uppercase", letterSpacing: "0.09em" }}>Consultation Details</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                {[
                  { icon: icons.video, text: doctor.consultationMode ? `${doctor.consultationMode} consultation` : "Video, audio, or chat" },
                  { icon: icons.share, text: "Share reports securely" },
                  { icon: icons.rx, text: "Prescriptions & sick notes included" },
                  { icon: icons.support, text: "24/7 customer support" },
                  { icon: icons.chat, text: "Free follow-up question" },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: "#eef4ff", border: "1px solid #c5d8f5", display: "flex", alignItems: "center", justifyContent: "center", color: "#1a4a8a", flexShrink: 0 }}>
                      {item.icon}
                    </div>
                    <span style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.4 }}>{item.text}</span>
                  </div>
                ))}
              </div>

              <div style={{ height: 1, background: "#edf2f7", margin: "0 0 18px" }} />

              {/* Promo code */}
              {/* <div style={{ background: "#f5f9ff", border: "1.5px dashed #93b4e8", borderRadius: 12, padding: "12px 14px", marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#0f2d5e", textTransform: "uppercase", letterSpacing: "0.06em" }}>First Consultation</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#0f2d5e", background: "#c5d8f5", borderRadius: 20, padding: "2px 10px" }}>10% OFF</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ flex: 1, background: "#fff", border: "1px solid #bfd3f7", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: "#0f2d5e", letterSpacing: "0.1em" }}>
                    FIRSTCONSULT
                  </div>
                  <button onClick={handleCopy} style={{
                    display: "flex", alignItems: "center", gap: 5,
                    background: copied ? "#0f2d5e" : "#eef4ff",
                    border: "1px solid #bfd3f7", borderRadius: 8,
                    padding: "7px 12px", cursor: "pointer",
                    fontSize: 12, fontWeight: 600,
                    color: copied ? "#fff" : "#1a4a8a",
                    transition: "all 0.2s",
                  }}>
                    {copied ? icons.check : icons.copy}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div> */}

              {/* Fee */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: "#6b7280" }}>Consult Fee</span>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 24, fontWeight: 700, color: "#0f2d5e", fontFamily: "'Syne', sans-serif" }}>
                    {formatPrice(price, doctor.feeCurrency || "USD")}
                  </span>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>per session</div>
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={handleBook}
                style={{
                  width: "100%",
                  background: "linear-gradient(120deg, #0f2d5e 0%, #1a4a8a 100%)",
                  color: "#fff", border: "none", borderRadius: 12,
                  padding: "14px 0", fontSize: 14, fontWeight: 700,
                  fontFamily: "'Syne', sans-serif", cursor: "pointer",
                  letterSpacing: "0.03em",
                  boxShadow: "0 4px 18px rgba(15,45,94,0.28)",
                  transition: "transform 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 22px rgba(15,45,94,0.35)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 18px rgba(15,45,94,0.28)"; }}
              >
                Book Appointment
              </button>

              <p style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", margin: "10px 0 0" }}>
                No hidden charges · Instant confirmation
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
