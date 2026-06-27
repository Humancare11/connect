import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import {
  FiMonitor,
  FiSearch,
  FiActivity,      // kept — remove if truly unused after full audit
  FiShield,
  FiLock,
  FiZap,
  FiFileText,
  FiGlobe,
  FiCheckCircle,
  FiPlus,
  FiStar,
  FiHeart,
  FiClock,
  FiAward,
  FiBarChart2,
  FiPackage,
  FiUserCheck,
  FiMessageSquare,
  FiVideo,
  FiArrowRight,    // FIX #14: was used but never imported
} from "react-icons/fi";
import { Helmet } from "react-helmet-async";
import heroBanner from "../../assets/MedicalServices/chronic-care-management-telemedicine.webp";// FIX #1: add your actual path

import "./newservices.css";

/* ─────────────────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────────────────── */
const BG_BASE      = "#FFFFFF";
const BG_SURFACE   = "#F8FAFC";
const BG_ELEVATED  = "#FFFFFF";
const TEXT_PRIMARY = "#0F172A";
const TEXT_BODY    = "#475569";
const TEXT_DIM     = "#64748B";
const BORDER       = "#E2E8F0";
const BORDER_HOVER = "#CBD5E1";

/* ─────────────────────────────────────────────────────
   HERO IMAGE CONFIG
───────────────────────────────────────────────────── */
const HERO_IMAGE = {
  src: heroBanner,
  alt: "Healthcare professionals providing telemedicine and virtual healthcare solutions for businesses across corporate, insurance, maritime, legal, and hospitality industries",
  width: 1920,
  height: 700,
};

/* ─────────────────────────────────────────────────────
   DATA
───────────────────────────────────────────────────── */
const SERVICES = {
  "telehealth-services": {
    slug: "online-prescription-refill",
    name: "ONLINE PRESCRIPTION REFILLS",
    tagline: "Fast, convenient medication renewals from anywhere.",
    intro:
      "Request online prescription refills through secure telemedicine services. Connect with a licensed healthcare provider, review your medications, and receive prescription renewal support when clinically appropriate. Stay on track with your treatment plan from the comfort of your home.",
    accentColor: "#2563EB",
    heroIcon: FiMonitor,
    description:
      "Online prescription refills allow eligible patients to renew ongoing medications through secure telemedicine services without an unnecessary clinic visit. Through Humancare Connect, you can connect with a licensed healthcare provider who can review your medical history, current medications, and treatment needs to determine whether a prescription renewal is appropriate. Convenient care is available from home, work, or wherever life takes you.",
    whyItMatters:
      "Missing or delaying medication can affect your health and treatment outcomes. Online prescription refills help patients maintain continuity of care, stay on track with prescribed treatment plans, and access healthcare support when they need it most.",
    whoBenefits: [
      "Patients managing chronic health conditions",
      "Individuals taking long term maintenance medications",
      "Busy professionals seeking convenient healthcare access",
      "Travelers who need continued access to prescribed medications",
      "Adults looking for secure and reliable telehealth services",
    ],
    keyOutcomes: [
      "Same-day consultations with verified physicians",
      "E-prescriptions sent directly to your pharmacy",
      "Secure, HIPAA-compliant video sessions",
      "Integrated health records across visits",
    ],
    steps: [
      {
        Icon: FiSearch,
        title: "Request Your Refill",
        body: "Tell us about your medication, health history, and refill needs through our secure intake form.",
      },
      {
        Icon: FiFileText,
        title: "Connect With a Provider",
        body: "A licensed healthcare provider will review your information and discuss your treatment plan.",
      },
      {
        Icon: FiVideo,
        title: "Complete Your Consultation",
        body: "Join a secure virtual consultation from your phone, tablet, or computer at your scheduled time.",
      },
      {
        Icon: FiPackage,
        title: "Receive Your Prescription",
        body: "If medically appropriate, your prescription refill can be sent to your preferred pharmacy for pickup.",
      },
    ],
    stats: [
      { value: 120000, suffix: "+",   label: "Patients Served" },
      { value: 2800,   suffix: "+",   label: "Verified Providers" },
      { value: 98,     suffix: "%",   label: "Satisfaction Rate" },
      { value: 14,     suffix: " min", label: "Avg. Wait Time" },
    ],
    faqs: [
      { q: "What is an online prescription refill?",             a: "An online prescription refill allows eligible patients to request a renewal of their ongoing medications through a secure telemedicine consultation with a licensed healthcare provider." },
      { q: "Can I get a prescription refill online?",            a: "Yes. Many maintenance medications may be eligible for online prescription refills following a clinical review by a healthcare provider." },
      { q: "What medications can be refilled through telehealth?",a: "Prescription refill services may support medications used for chronic conditions such as high blood pressure, diabetes, asthma, thyroid disorders, allergies, and high cholesterol." },
      { q: "Do I need an appointment for a prescription refill?", a: "Yes. A healthcare provider typically needs to review your health history, current medications, and treatment needs before renewing a prescription." },
      { q: "How long does the prescription refill process take?", a: "Most online consultations take only a few minutes. If approved, prescriptions can often be sent electronically to your preferred pharmacy." },
      { q: "Can I request a refill for a chronic condition medication?", a: "Yes. Many patients use online prescription refill services to maintain access to medications used for long term health conditions." },
      { q: "Can I refill blood pressure medication online?",     a: "In many cases, eligible patients may request prescription renewals for blood pressure medications through telemedicine services." },
      { q: "Can I refill diabetes medication through telehealth?",a: "Patients managing diabetes may be eligible for prescription refill evaluations depending on their treatment plan and medical needs." },
      { q: "Are online prescription refills secure?",            a: "Yes. Humancare Connect uses secure telemedicine technology designed to protect patient privacy and healthcare information." },
      { q: "Can a healthcare provider deny a refill request?",   a: "Yes. A provider may determine that additional testing, a medication adjustment, or an in person evaluation is necessary before renewing a prescription." },
      { q: "Can I choose my pharmacy?",                         a: "Yes. If your prescription refill is approved, it can typically be sent to your preferred pharmacy when permitted by applicable regulations." },
      { q: "What information do I need for a prescription refill?", a: "Patients should be prepared to provide details about their current medications, medical history, symptoms, and treatment goals." },
      { q: "Can I request multiple prescription refills during one visit?", a: "Depending on your healthcare needs and provider assessment, multiple medication refill requests may be reviewed during the same consultation." },
      { q: "Are prescription refills available for travelers?",  a: "Yes. Telehealth services can help eligible patients maintain access to ongoing medications while traveling or away from home." },
      { q: "Does insurance cover online prescription refill services?", a: "Coverage varies by insurance provider and health plan. Patients should verify coverage details with their insurance carrier." },
      { q: "What are the benefits of online prescription refills?", a: "Online prescription refills provide convenient access to healthcare providers, help prevent treatment interruptions, and support continuity of care." },
      { q: "Who can benefit from prescription refill services?", a: "Adults managing chronic conditions, long term medications, or ongoing treatment plans may benefit from online prescription refill services." },
      { q: "Can online prescription refills help with medication management?", a: "Yes. Providers can review your current medications, discuss treatment progress, and help ensure your care plan remains appropriate for your needs." },
      { q: "Why choose Humancare Connect for online prescription refills?", a: "Humancare Connect offers secure telemedicine services, licensed healthcare providers, convenient online appointments, and patient focused care designed to support safe and reliable medication management." },
    ],
  },
};

/* ─────────────────────────────────────────────────────
   WHY US ITEMS  (FIX #13: single source of truth — removed duplicate whyUsItems inside WhyUs)
───────────────────────────────────────────────────── */
const WHY_US_ITEMS = [
  [FiAward,    "Verified Providers",     "Every clinician is credentialed, licensed, and continuously reviewed."],
  [FiHeart,    "Patient-Centred Care",   "Clinical decisions are made in partnership with you — never without your input."],
  [FiGlobe,    "Nationwide Access",      "Care without geographic limits — from metro centres to remote districts."],
  [FiZap,      "Fast Scheduling",        "From first contact to first appointment in hours, not weeks."],
  [FiLock,     "Secure Platform",        "Enterprise-grade encryption protects every record and transaction."],
  [FiBarChart2,"Outcome Accountability", "We track results and publicly report our care quality standards."],
];

/* ─────────────────────────────────────────────────────
   ANIMATION VARIANTS
───────────────────────────────────────────────────── */
const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.07, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

/* ─────────────────────────────────────────────────────
   HOOK
───────────────────────────────────────────────────── */
// FIX #17: added explicit default for start param
const useCountUp = (target, duration = 2200, start = false) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let t0 = null;
    const isFloat = String(target).includes(".");
    const tick = (ts) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setCount(isFloat ? +(e * target).toFixed(1) : Math.floor(e * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration, start]);
  return count;
};

/* ─────────────────────────────────────────────────────
   MICRO COMPONENTS

   FIX #2:  Single SLabel definition (removed duplicate)
   FIX #3:  Single Pill definition (removed duplicate)
   FIX #4:  Single PrimaryBtn definition with href support
   FIX #5:  Single GhostBtn definition with href + onDark support
   FIX #15: Removed darken() — replaced with direct ac value
───────────────────────────────────────────────────── */

const SLabel = ({ text, ac = "#2563EB" }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
    <div style={{ width: 24, height: 1, background: ac }} />
    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: ac }}>
      {text}
    </span>
  </div>
);

const Pill = ({ children, ac = "#2563EB", onDark = false }) => {
  const textColor = onDark ? "#ffffff" : ac; // FIX #15: removed undefined darken()
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 14px",
      borderRadius: 100,
      background: onDark ? "rgba(255,255,255,0.15)" : `${ac}12`,
      color: textColor,
      border: onDark ? "1px solid rgba(255,255,255,0.35)" : `1px solid ${ac}30`,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      marginBottom: 22,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: onDark ? "#ffffff" : ac }} />
      {children}
    </div>
  );
};

// FIX #4: unified PrimaryBtn — supports both href (anchor) and button
const PrimaryBtn = ({ children, href, ac = "#2563EB", fullWidth = false, type = "button", onClick }) => {
  const style = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "13px 24px",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 14,
    color: "#ffffff",
    background: ac,
    border: "none",
    cursor: "pointer",
    textDecoration: "none",
    width: fullWidth ? "100%" : "auto",
    transition: "opacity 0.2s",
  };
  if (href) return <a href={href} style={style}>{children}</a>;
  return <button type={type} style={style} onClick={onClick}>{children}</button>;
};

// FIX #5: unified GhostBtn — supports href + onDark
const GhostBtn = ({ children, href, onClick, onDark = false }) => {
  const style = {
    padding: "13px 22px",
    borderRadius: 12,
    fontWeight: 600,
    fontSize: 14,
    color: onDark ? "#ffffff" : TEXT_PRIMARY,
    cursor: "pointer",
    background: onDark ? "rgba(255,255,255,0.12)" : "#fff",
    border: onDark ? "1px solid rgba(255,255,255,0.35)" : `1px solid ${BORDER_HOVER}`,
    transition: "background 0.2s, border-color 0.2s",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    textDecoration: "none",
  };
  if (href) return <a href={href} style={style}>{children}</a>;
  return (
    <button
      style={style}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.background     = onDark ? "rgba(255,255,255,0.22)" : BG_SURFACE;
        e.currentTarget.style.borderColor    = onDark ? "rgba(255,255,255,0.6)" : "#94A3B8";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background     = onDark ? "rgba(255,255,255,0.12)" : "#fff";
        e.currentTarget.style.borderColor    = onDark ? "rgba(255,255,255,0.35)" : BORDER_HOVER;
      }}
    >
      {children}
    </button>
  );
};

/* ─────────────────────────────────────────────────────
   HERO
   FIX #6:  Removed duplicate/partial JSX tree
   FIX #26: Removed double opacity transform binding
───────────────────────────────────────────────────── */
const Hero = ({ s }) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const op = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  const words   = s.name.split(" ");
  const midIdx  = Math.floor(words.length / 2);
  const accentLight = s.accentColor === "#2563EB" ? "#60A5FA" : s.accentColor;

  return (
    <section
      ref={ref}
      style={{
        position: "relative",
        minHeight: "62vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        overflow: "hidden",
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      {/* Layer 0: SEO background image */}
      <img
        src={HERO_IMAGE.src}
        alt={HERO_IMAGE.alt}
        width={HERO_IMAGE.width}
        height={HERO_IMAGE.height}
        loading="eager"
        fetchPriority="high"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", zIndex: 0 }}
      />

      {/* Layer 1: Dark overlay */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.58)", zIndex: 1 }} />

      {/* Layer 2: Content — FIX #26: opacity applied only once here */}
      <motion.div
        style={{
          position: "relative",
          zIndex: 10,
          maxWidth: 1200,
          margin: "0 auto",
          padding: "64px 24px",
          width: "100%",
          opacity: op,
        }}
      >
        <motion.h1
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18 }}
          style={{
            fontSize: "clamp(36px, 5.5vw, 60px)",
            fontWeight: 900,
            color: "#FFFFFF",
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            marginBottom: 18,
            maxWidth: 760,
          }}
        >
          {words.map((w, i) => (
            <span key={i}>
              {i === midIdx
                ? <span style={{ color: accentLight }}>{w} </span>
                : <span>{w} </span>
              }
            </span>
          ))}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.26 }}
          style={{ fontSize: 18, color: "rgba(255,255,255,0.80)", fontStyle: "italic", marginBottom: 10 }}
        >
          {s.tagline}
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.32 }}
          style={{ fontSize: 16, color: "rgba(255,255,255,0.88)", lineHeight: 1.7, maxWidth: 560, marginBottom: 28 }}
        >
          {s.intro}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.38 }}
          style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
        >
          <PrimaryBtn href="/appointment-booking" ac={s.accentColor}>Book Appointment</PrimaryBtn>
          <GhostBtn href="/contact" onDark>Contact Care Team <FiArrowRight /></GhostBtn>
        </motion.div>
      </motion.div>
    </section>
  );
};

/* ─────────────────────────────────────────────────────
   CONSULTATION FORM
   FIX #7: Removed duplicate definition; single clean component
───────────────────────────────────────────────────── */
const ConsultationForm = ({ s }) => {
  const [values, setValues]     = useState({ name: "", email: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }));
  const handleSubmit = (e) => { e.preventDefault(); setSubmitted(true); };

  const inputStyle = {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 10,
    border: `1px solid ${BORDER}`,
    background: "#fff",
    color: TEXT_PRIMARY,
    fontSize: 14,
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 6 };

  const focusHandlers = {
    onFocus: (e) => { e.target.style.borderColor = s.accentColor; e.target.style.boxShadow = `0 0 0 3px ${s.accentColor}1A`; },
    onBlur:  (e) => { e.target.style.borderColor = BORDER; e.target.style.boxShadow = "none"; },
  };

  if (submitted) {
    return (
      <div style={{ borderRadius: 24, padding: 32, background: "#fff", border: `1px solid ${BORDER}`, textAlign: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", background: `${s.accentColor}12` }}>
          <FiCheckCircle style={{ fontSize: 24, color: s.accentColor }} />
        </div>
        <h3 style={{ color: TEXT_PRIMARY, fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Request received</h3>
        <p style={{ color: TEXT_BODY, fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
          A member of our care team will reach out to {values.email || "you"} shortly.
        </p>
        <button
          onClick={() => { setSubmitted(false); setValues({ name: "", email: "", message: "" }); }}
          style={{ padding: "10px 20px", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer", background: `${s.accentColor}12`, color: s.accentColor, border: `1px solid ${s.accentColor}30` }}
        >
          Send another request
        </button>
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 24, padding: 32, background: "#fff", border: `1px solid ${BORDER}` }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: `${s.accentColor}12`, marginBottom: 16 }}>
        <FiMessageSquare style={{ fontSize: 20, color: s.accentColor }} />
      </div>
      <h3 style={{ color: TEXT_PRIMARY, fontSize: 19, fontWeight: 800, marginBottom: 6 }}>Request a Consultation</h3>
      <p style={{ color: TEXT_DIM, fontSize: 13.5, lineHeight: 1.6, marginBottom: 22 }}>
        Tell us a little about what you need, and a care coordinator will follow up within one business day.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle} htmlFor="consult-name">Full name</label>
          <input id="consult-name" type="text" required placeholder="Jordan Lee" value={values.name} onChange={handleChange("name")} style={inputStyle} {...focusHandlers} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle} htmlFor="consult-email">Email address</label>
          <input id="consult-email" type="email" required placeholder="jordan@email.com" value={values.email} onChange={handleChange("email")} style={inputStyle} {...focusHandlers} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle} htmlFor="consult-message">What can we help with?</label>
          <textarea id="consult-message" required rows={4} placeholder="Briefly describe your symptoms or what you'd like to discuss…" value={values.message} onChange={handleChange("message")} style={{ ...inputStyle, resize: "vertical" }} {...focusHandlers} />
        </div>
        <PrimaryBtn ac={s.accentColor} fullWidth type="submit">Submit Request</PrimaryBtn>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, color: TEXT_DIM, fontSize: 12 }}>
          <FiLock style={{ fontSize: 13, color: s.accentColor }} />
          Your information is encrypted and never shared without consent.
        </div>
      </form>
    </div>
  );
};

/* ─────────────────────────────────────────────────────
   OVERVIEW
   FIX #9:  Removed duplicate grid block
   FIX #19: h2 now uses s.name instead of hardcoded text
───────────────────────────────────────────────────── */
const Overview = ({ s }) => (
  <section style={{ background: BG_BASE, width: "100%" }}>
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "88px 24px" }}>
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 64, alignItems: "start" }}
      >
        {/* Left: text */}
        <div>
          <motion.div variants={fadeUp}>
            <SLabel text="Service Overview" ac={s.accentColor} />
            {/* FIX #19: was hardcoded "What Are Online Prescription Refills?" */}
            <h2 style={{ fontSize: "clamp(26px, 3.5vw, 36px)", fontWeight: 900, color: TEXT_PRIMARY, lineHeight: 1.15, marginBottom: 20 }}>
              What Are {s.name.charAt(0) + s.name.slice(1).toLowerCase()}?
            </h2>
          </motion.div>

          <motion.p variants={fadeUp} style={{ color: TEXT_BODY, lineHeight: 1.75, marginBottom: 20, fontSize: 15.5 }}>
            {s.description}
          </motion.p>

          <motion.div variants={fadeUp} style={{ padding: "16px 18px", borderRadius: 14, marginBottom: 20, background: `${s.accentColor}0A`, border: `1px solid ${s.accentColor}25` }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: s.accentColor, marginBottom: 6 }}>
              Why It Matters
            </div>
            <p style={{ color: TEXT_BODY, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{s.whyItMatters}</p>
          </motion.div>

          <motion.div variants={fadeUp}>
            <div style={{ color: TEXT_PRIMARY, fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Who Can Benefit</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {s.whoBenefits.map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, color: TEXT_BODY, fontSize: 14 }}>
                  <FiCheckCircle style={{ color: s.accentColor, fontSize: 16, marginTop: 1, flexShrink: 0 }} />
                  {item}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Key outcomes strip */}
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginTop: 32 }}
          >
            {s.keyOutcomes.map((o, i) => (
              <motion.div key={i} variants={fadeUp} custom={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: 16, borderRadius: 14, background: BG_ELEVATED, border: `1px solid ${BORDER}` }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.accentColor, marginTop: 5, flexShrink: 0 }} />
                <p style={{ color: TEXT_BODY, fontSize: 13, lineHeight: 1.6, margin: 0 }}>{o}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Right: sticky consultation form */}
        <motion.div variants={fadeUp} style={{ position: "sticky", top: 96 }}>
          <ConsultationForm s={s} />
        </motion.div>
      </motion.div>
    </div>
  </section>
);

/* ─────────────────────────────────────────────────────
   HOW IT WORKS
   FIX #8: Removed duplicate/partial JSX tree; single clean return
───────────────────────────────────────────────────── */
const HowItWorks = ({ s }) => (
  <section style={{ padding: "88px 0", background: BG_SURFACE, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "start" }}
      >
        {/* Left: steps */}
        <div>
          <motion.div variants={fadeUp}>
            <SLabel text="Our Services" ac={s.accentColor} />
            <h2 style={{ fontSize: "clamp(26px, 3.5vw, 36px)", fontWeight: 900, color: TEXT_PRIMARY, lineHeight: 1.15, marginBottom: 8 }}>
              Getting started is <span style={{ color: s.accentColor }}>simple.</span>
            </h2>
            <p style={{ color: TEXT_DIM, fontSize: 15, lineHeight: 1.7, marginBottom: 36 }}>
              Requesting an online prescription refill through Humancare Connect is quick, secure, and convenient.
            </p>
          </motion.div>

          <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            {s.steps.map((step, i) => (
              <motion.div key={i} variants={fadeUp} custom={i} style={{ position: "relative", display: "flex", gap: 18 }}>
                {i < s.steps.length - 1 && (
                  <div style={{ position: "absolute", left: 19, top: 46, width: 1, height: "calc(100% - 8px)", background: BORDER_HOVER }} />
                )}
                <div style={{ position: "relative", zIndex: 1, flexShrink: 0, width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: s.accentColor }}>
                  {React.createElement(step.Icon, { style: { fontSize: 18, color: "#fff" } })}
                </div>
                <div style={{ paddingBottom: 28, flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: s.accentColor, marginBottom: 4 }}>
                    Step {i + 1}
                  </div>
                  <div style={{ color: TEXT_PRIMARY, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{step.title}</div>
                  <p style={{ color: TEXT_DIM, fontSize: 14, lineHeight: 1.65, margin: 0 }}>{step.body}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Right: sticky ready card */}
        <motion.div variants={fadeUp} style={{ position: "sticky", top: 96 }}>
          <div style={{ borderRadius: 24, padding: 36, background: "#fff", border: `1px solid ${BORDER}` }}>
            {React.createElement(s.heroIcon, { style: { fontSize: 44, color: s.accentColor, marginBottom: 16 } })}
            <h3 style={{ color: TEXT_PRIMARY, fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
              Ready to Renew Your Prescription?
            </h3>
            <p style={{ color: TEXT_DIM, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
              Stay on track with your treatment plan through secure online prescription refill services. Connect with a licensed healthcare provider, request medication renewals when clinically appropriate, and access convenient telehealth services from wherever you are.
            </p>
            <PrimaryBtn href="/login" ac={s.accentColor} fullWidth>Get Started Today</PrimaryBtn>
            <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                [FiLock,     "Secure & Private"],
                [FiZap,      "Fast Response"],
                [FiUserCheck,"Verified Providers"],
                [FiFileText, "Insurance Accepted"],
              ].map(([Icon, lb], i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, color: TEXT_DIM, fontSize: 12 }}>
                  <Icon style={{ fontSize: 13, color: s.accentColor }} />
                  {lb}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  </section>
);

/* ─────────────────────────────────────────────────────
   FEATURES & BENEFITS
───────────────────────────────────────────────────── */
const Features = ({ s }) => (
  <section style={{ maxWidth: 1200, margin: "0 auto", padding: "88px 24px" }}>
    <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}>
      <motion.div variants={fadeUp} style={{ textAlign: "center", maxWidth: 680, margin: "0 auto 40px" }}>
        <SLabel text="Features & Benefits" ac={s.accentColor} />
        <h2 style={{ fontSize: "clamp(26px, 3.5vw, 36px)", fontWeight: 900, color: TEXT_PRIMARY, lineHeight: 1.15, marginBottom: 10 }}>
          Understanding <span style={{ color: s.accentColor }}>Online Prescription Refills</span>
        </h2>
        <p style={{ color: TEXT_DIM, fontSize: 15, lineHeight: 1.7 }}>Every feature is designed around one goal: better outcomes for you.</p>
      </motion.div>

      <motion.div variants={fadeUp} style={{ borderRadius: 20, padding: "32px 36px", background: BG_ELEVATED, border: `1px solid ${BORDER}` }}>
        {[
          "Online prescription refills allow eligible patients to renew ongoing medications through a secure telemedicine consultation with a licensed healthcare provider. This service is designed for individuals who are managing chronic health conditions, maintaining long term treatment plans, or requiring continued access to prescribed medications. Instead of scheduling an in person appointment for routine medication renewals, patients can connect with a healthcare provider remotely and receive professional guidance from the comfort of home.",
          "At Humancare Connect, our online prescription refill service helps simplify medication management while supporting continuity of care. Healthcare providers can review your medical history, current medications, treatment progress, and ongoing healthcare needs to determine whether a prescription renewal is appropriate. This approach helps patients stay consistent with their treatment plans while reducing delays that could impact their health outcomes.",
          "Online prescription refills are commonly requested for conditions such as high blood pressure, diabetes, asthma, allergies, thyroid disorders, high cholesterol, migraine management, and other ongoing health concerns. By combining convenient access to telemedicine services with professional clinical oversight, Humancare Connect helps patients maintain their healthcare journey through secure, accessible, and patient centered virtual healthcare services.",
        ].map((para, i) => (
          <p key={i} style={{ color: TEXT_BODY, lineHeight: 1.8, fontSize: 15.5, marginBottom: i < 2 ? 20 : 0 }}>{para}</p>
        ))}
      </motion.div>
    </motion.div>
  </section>
);

/* ─────────────────────────────────────────────────────
   STAT CARD
   FIX #16: ac prop is now actually used for value color
───────────────────────────────────────────────────── */
const StatCard = ({ value, suffix, label, ac = "#2563EB", go }) => {
  const c = useCountUp(value, 2200, go);
  return (
    <motion.div
      variants={fadeUp}
      style={{ textAlign: "center", padding: "24px 16px", borderRadius: 16, background: "#fff", border: `1px solid ${BORDER}` }}
    >
      <div style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 900, color: ac, letterSpacing: "-0.02em", marginBottom: 6 }}>
        {c}{suffix}
      </div>
      <div style={{ color: TEXT_DIM, fontSize: 13, fontWeight: 600 }}>{label}</div>
    </motion.div>
  );
};

/* ─────────────────────────────────────────────────────
   WHY US
   FIX #10: Removed duplicate outer wrapper
   FIX #13: Uses WHY_US_ITEMS constant (removed local duplicate)
───────────────────────────────────────────────────── */
const WhyUs = ({ s }) => {
  const ref    = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} style={{ background: BG_SURFACE, borderTop: `1px solid ${BORDER}` }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "88px 24px" }}>
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}>
          <motion.div variants={fadeUp} style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 44px" }}>
            <SLabel text="Why Choose Us" ac={s.accentColor} />
            <h2 style={{ fontSize: "clamp(26px, 3.5vw, 36px)", fontWeight: 900, color: TEXT_PRIMARY, lineHeight: 1.15, marginBottom: 10 }}>
              Results you can <span style={{ color: s.accentColor }}>measure.</span>
            </h2>
            <p style={{ color: TEXT_DIM, fontSize: 15, lineHeight: 1.7 }}>
              Connect with a licensed healthcare provider through secure telemedicine services and receive personalized medical guidance for your health concerns.
            </p>
          </motion.div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 44 }}>
            {s.stats.map((st, i) => (
              <StatCard key={i} value={st.value} suffix={st.suffix} label={st.label} ac={s.accentColor} go={inView} />
            ))}
          </div>

          {/* Why us cards — FIX #13: WHY_US_ITEMS (not duplicate whyUsItems) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {WHY_US_ITEMS.map(([Icon, title, desc], i) => (
              <motion.div key={i} variants={fadeUp} custom={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: 20, borderRadius: 16, background: "#fff", border: `1px solid ${BORDER}` }}>
                <div style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: `${s.accentColor}12` }}>
                  <Icon style={{ fontSize: 18, color: s.accentColor }} />
                </div>
                <div>
                  <div style={{ color: TEXT_PRIMARY, fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{title}</div>
                  <div style={{ color: TEXT_DIM, fontSize: 13, lineHeight: 1.6 }}>{desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

/* ─────────────────────────────────────────────────────
   FAQ
   FIX #11: Removed duplicate grid/className approach; single clean structure
───────────────────────────────────────────────────── */
const FAQ = ({ s }) => {
  const [open, setOpen] = useState(null);

  return (
    <section style={{ maxWidth: 1200, margin: "0 auto", padding: "88px 24px" }}>
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64 }}
      >
        {/* Left: intro */}
        <motion.div variants={fadeUp}>
          <SLabel text="FAQ" ac={s.accentColor} />
          <h2 style={{ fontSize: "clamp(26px, 3.5vw, 36px)", fontWeight: 900, color: TEXT_PRIMARY, lineHeight: 1.15, marginBottom: 14 }}>
            Questions about<br />
            <span style={{ color: s.accentColor }}>{s.name.charAt(0) + s.name.slice(1).toLowerCase()}?</span>
          </h2>
          <p style={{ color: TEXT_DIM, fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
            We've answered the most common questions below. Our care team is one message away if yours isn't listed.
          </p>
          <GhostBtn href="/contact">
            <FiMessageSquare style={{ fontSize: 15 }} /> Contact Care Team
          </GhostBtn>
        </motion.div>

        {/* Right: accordion */}
        <motion.div variants={fadeUp} style={{ padding: 20, borderRadius: 22, background: "#fff", border: `1px solid ${BORDER}` }}>
          {s.faqs.map((faq, i) => (
            <div key={i} style={{ borderBottom: i < s.faqs.length - 1 ? `1px solid ${BORDER}` : "none" }}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", background: "none", border: "none", cursor: "pointer", textAlign: "left", gap: 12 }}
              >
                <span style={{ color: TEXT_PRIMARY, fontWeight: 700, fontSize: 14 }}>{faq.q}</span>
                <div style={{
                  flexShrink: 0,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: open === i ? s.accentColor : `${s.accentColor}12`,
                  transition: "background 0.2s",
                }}>
                  <FiPlus style={{ fontSize: 14, color: open === i ? "#fff" : TEXT_DIM, transform: open === i ? "rotate(45deg)" : "none", transition: "transform 0.2s" }} />
                </div>
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.26 }}
                    style={{ overflow: "hidden" }}
                  >
                    <div style={{ paddingBottom: 16, paddingRight: 40, color: TEXT_BODY, fontSize: 14, lineHeight: 1.7 }}>{faq.a}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
};

/* ─────────────────────────────────────────────────────
   FINAL CTA
   FIX #12: Removed duplicate definition
   FIX #20: Corrected copy (removed lab testing reference)
   FIX #21: Corrected button text
───────────────────────────────────────────────────── */
const FinalCTA = ({ s }) => (
  <section style={{ maxWidth: 1200, margin: "0 auto", padding: "88px 24px" }}>
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6 }}
      style={{ position: "relative", borderRadius: 28, padding: "72px 48px", textAlign: "center", background: `${s.accentColor}08`, border: `1px solid ${s.accentColor}25` }}
    >
      {/* FIX #12: pass ac to Pill */}
      <Pill ac={s.accentColor}>Start Today</Pill>
      <h2 style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 900, color: TEXT_PRIMARY, lineHeight: 1.1, marginBottom: 14 }}>
        Ready to Prioritize Your<br />
        <span style={{ color: s.accentColor }}>Prescription?</span>
      </h2>
      {/* FIX #20: copy now matches this page's service */}
      <p style={{ color: TEXT_BODY, lineHeight: 1.7, maxWidth: 500, margin: "0 auto 36px", fontSize: 16 }}>
        Stay on track with your treatment plan through secure online prescription refill services. Connect with a licensed healthcare provider, request medication renewals when clinically appropriate, and access convenient telehealth services from wherever you are.
      </p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 36, flexWrap: "wrap" }}>
        <PrimaryBtn href="/login" ac={s.accentColor}>Get Started</PrimaryBtn>
        {/* FIX #21: button text updated to match service */}
        <GhostBtn href="/appointment-booking">Book Appointment</GhostBtn>
        <GhostBtn href="/contact">Contact Us</GhostBtn>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 28 }}>
        {[
          [FiLock,     "HIPAA Compliant"],
          [FiStar,     "4.9/5 Rated"],
          [FiShield,   "Verified Providers"],
          [FiFileText, "All Insurances"],
          [FiClock,    "24/7 Access"],
        ].map(([Icon, lb], i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, color: TEXT_DIM, fontSize: 13 }}>
            <Icon style={{ fontSize: 15 }} />
            {lb}
          </div>
        ))}
      </div>
    </motion.div>
  </section>
);

/* ─────────────────────────────────────────────────────
   PAGE ROOT
   FIX #18: setSlug now properly destructured
───────────────────────────────────────────────────── */
export default function OnlinePrescriptionRefills() {
  // FIX #18: destructure setter so handleSwitch actually works
  const [slug, setSlug] = useState("telehealth-services");
  const s = SERVICES[slug] || SERVICES["telehealth-services"];

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", s.accentColor);
    return () => { document.documentElement.style.removeProperty("--accent"); };
  }, [s.accentColor]);

  const handleSwitch = useCallback((newSlug) => setSlug(newSlug), []);

  return (
    <>
      <Helmet>
        <title>Online Prescription Refills | Renew Medications Online | Humancare Connect</title>
        <meta name="description" content="Need a prescription refill? Connect with licensed healthcare providers through secure telemedicine services and renew eligible medications online." />
      </Helmet>

      <div style={{ background: BG_BASE }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={slug}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <Hero      s={s} />
            <Overview  s={s} />
            <HowItWorks s={s} />
            <Features  s={s} />
            <WhyUs     s={s} />
            <FAQ       s={s} />
            <FinalCTA  s={s} />
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}