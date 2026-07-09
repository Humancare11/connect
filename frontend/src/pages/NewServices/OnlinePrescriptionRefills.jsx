import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import {
  FiMonitor,
  FiHome,
  FiSearch,
  FiActivity,
  FiShield,
  FiSun,
  FiLock,
  FiZap,
  FiCalendar,
  FiFileText,
  FiGlobe,
  FiCheckCircle,
  FiArrowRight,
  FiChevronDown,
  FiPlus,
  FiStar,
  FiHeart,
  FiUsers,
  FiPhone,
  FiMail,
  FiClock,
  FiTrendingUp,
  FiAward,
  FiRefreshCw,
  FiBarChart2,
  FiMapPin,
  FiCamera,
  FiDroplet,
  FiPackage,
  FiSmile,
  FiBriefcase,
  FiUserCheck,
  FiMessageSquare,
  FiCpu,
  FiAlertCircle,
  FiThumbsUp,
  FiVideo,
  FiPieChart,
  FiBookOpen,
  FiNavigation,
  FiWifi,
  FiHeadphones,
  FiUser,
} from "react-icons/fi";

import { Helmet } from "react-helmet-async";

import heroBanner from "../../assets/MedicalServices/online-prescription-digital-healthcare.webp";

const HERO_IMAGE = {
  src: heroBanner,
  alt: "Healthcare professionals providing telemedicine and virtual healthcare solutions for businesses across corporate, insurance, maritime, legal, and hospitality industries",
  width: 1920,
  height: 700,
};

/* ─────────────────────────────────────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────────────────────────────────────── */
const BG_BASE = "#FFFFFF";
const BG_SURFACE = "#F8FAFC";
const BG_ELEVATED = "#FFFFFF";
const TEXT_PRIMARY = "#0F172A";
const TEXT_BODY = "#475569";
const TEXT_DIM = "#64748B";
const BORDER = "#E2E8F0";
const BORDER_HOVER = "#CBD5E1";

/* ─────────────────────────────────────────────────────────────────────────
   BREAKPOINT HOOK
   Returns { isMobile, isTablet, isDesktop }
   isMobile  < 640px
   isTablet  640–1023px
   isDesktop ≥ 1024px
───────────────────────────────────────────────────────────────────────── */
const useBreakpoint = () => {
  const getBreakpoint = () => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1200;
    return {
      isMobile: w < 640,
      isTablet: w >= 640 && w < 1024,
      isDesktop: w >= 1024,
    };
  };
  const [bp, setBp] = useState(getBreakpoint);
  useEffect(() => {
    const handler = () => setBp(getBreakpoint());
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return bp;
};

/* ─────────────────────────────────────────────────────────────────────────
   DATA
───────────────────────────────────────────────────────────────────────── */
const SERVICES = {
  "telehealth-services": {
    slug: "telehealth-services",
    name: "ONLINE PRESCRIPTION REFILLS",
    tagline: "Fast, convenient medication renewals from anywhere.",
    intro:
      "Request online prescription refills through secure telemedicine services. Connect with a licensed healthcare provider, review your medications, and receive prescription renewal support when clinically appropriate. Stay on track with your treatment plan from the comfort of your home.",
    accentColor: "#2563EB",
    accentGlow: "#2563EB20",
    heroIcon: FiMonitor,
    heroEmoji: "🖥️",
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
    features: [
      {
        Icon: FiLock,
        title: "HIPAA-Secure Platform",
        desc: "End-to-end encrypted sessions protect every conversation and record.",
      },
      {
        Icon: FiZap,
        title: "Under 15-Min Wait",
        desc: "Our average queue time is less than 15 minutes, even at peak hours.",
      },
      {
        Icon: FiUserCheck,
        title: "Board-Certified Doctors",
        desc: "Every provider is credentialed, state-licensed, and continuously reviewed.",
      },
      {
        Icon: FiCalendar,
        title: "Flexible Scheduling",
        desc: "Book ahead or consult on demand — evenings, weekends, holidays included.",
      },
      {
        Icon: FiFileText,
        title: "Insurance Integration",
        desc: "We verify your coverage in real time and handle claims on your behalf.",
      },
      {
        Icon: FiGlobe,
        title: "Multilingual Support",
        desc: "Consultations available in 14+ languages with live interpreter access.",
      },
    ],
    stats: [
      { value: 120000, suffix: "+", label: "Patients Served" },
      { value: 2800, suffix: "+", label: "Verified Providers" },
      { value: 98, suffix: "%", label: "Satisfaction Rate" },
      { value: 14, suffix: " min", label: "Avg. Wait Time" },
    ],
    faqs: [
      {
        q: "What is an online prescription refill?",
        a: "An online prescription refill allows eligible patients to request a renewal of their ongoing medications through a secure telemedicine consultation with a licensed healthcare provider.",
      },
      {
        q: "Can I get a prescription refill online?",
        a: "Yes. Many maintenance medications may be eligible for online prescription refills following a clinical review by a healthcare provider.",
      },
      {
        q: "What medications can be refilled through telehealth?",
        a: "Prescription refill services may support medications used for chronic conditions such as high blood pressure, diabetes, asthma, thyroid disorders, allergies, and high cholesterol.",
      },
      {
        q: "Do I need an appointment for a prescription refill?",
        a: "Yes. A healthcare provider typically needs to review your health history, current medications, and treatment needs before renewing a prescription.",
      },
      {
        q: "How long does the prescription refill process take?",
        a: "Most online consultations take only a few minutes. If approved, prescriptions can often be sent electronically to your preferred pharmacy.",
      },
      {
        q: "Can I request a refill for a chronic condition medication?",
        a: "Yes. Many patients use online prescription refill services to maintain access to medications used for long term health conditions.",
      },
      {
        q: "Can I refill blood pressure medication online?",
        a: "In many cases, eligible patients may request prescription renewals for blood pressure medications through telemedicine services.",
      },
      {
        q: "Can I refill diabetes medication through telehealth?",
        a: "Patients managing diabetes may be eligible for prescription refill evaluations depending on their treatment plan and medical needs.",
      },
      {
        q: "Are online prescription refills secure?",
        a: "Yes. Humancare Connect uses secure telemedicine technology designed to protect patient privacy and healthcare information.",
      },
      {
        q: "Can a healthcare provider deny a refill request?",
        a: "Yes. A provider may determine that additional testing, a medication adjustment, or an in person evaluation is necessary before renewing a prescription.",
      },
      {
        q: "Can I choose my pharmacy?",
        a: "Yes. If your prescription refill is approved, it can typically be sent to your preferred pharmacy when permitted by applicable regulations.",
      },
      {
        q: "What information do I need for a prescription refill?",
        a: "Patients should be prepared to provide details about their current medications, medical history, symptoms, and treatment goals.",
      },
      {
        q: "Can I request multiple prescription refills during one visit?",
        a: "Depending on your healthcare needs and provider assessment, multiple medication refill requests may be reviewed during the same consultation.",
      },
      {
        q: "Are prescription refills available for travelers?",
        a: "Yes. Telehealth services can help eligible patients maintain access to ongoing medications while traveling or away from home.",
      },
      {
        q: "Does insurance cover online prescription refill services?",
        a: "Coverage varies by insurance provider and health plan. Patients should verify coverage details with their insurance carrier.",
      },
      {
        q: "What are the benefits of online prescription refills?",
        a: "Online prescription refills provide convenient access to healthcare providers, help prevent treatment interruptions, and support continuity of care.",
      },
      {
        q: "Who can benefit from prescription refill services?",
        a: "Adults managing chronic conditions, long term medications, or ongoing treatment plans may benefit from online prescription refill services.",
      },
      {
        q: "Can online prescription refills help with medication management?",
        a: "Yes. Providers can review your current medications, discuss treatment progress, and help ensure your care plan remains appropriate for your needs.",
      },
      {
        q: "Why choose Humancare Connect for online prescription refills?",
        a: "Humancare Connect offers secure telemedicine services, licensed healthcare providers, convenient online appointments, and patient focused care designed to support safe and reliable medication management.",
      },
    ],
  },
};

/* ─────────────────────────────────────────────────────────────────────────
   HOOKS & UTILS
───────────────────────────────────────────────────────────────────────── */
const useCountUp = (target, duration = 2200, start = false) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let t0 = null;
    let raf;
    const isFloat = String(target).includes(".");
    const tick = (ts) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setCount(isFloat ? +(e * target).toFixed(1) : Math.floor(e * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return count;
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      delay: i * 0.07,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
};
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

/* ─────────────────────────────────────────────────────────────────────────
   MICRO COMPONENTS
───────────────────────────────────────────────────────────────────────── */
const SLabel = ({ text, ac, center = false }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: center ? "center" : "flex-start",
      gap: 10,
      marginBottom: 14,
    }}
  >
    <div style={{ width: 24, height: 1, background: ac }} />
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: ac,
      }}
    >
      {text}
    </span>
  </div>
);

const darken = (hex, amount) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16),
    g = parseInt(h.slice(2, 4), 16),
    b = parseInt(h.slice(4, 6), 16);
  const dr = Math.round(r * (1 - amount)),
    dg = Math.round(g * (1 - amount)),
    db = Math.round(b * (1 - amount));
  return `#${[dr, dg, db].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

const Pill = ({ children, ac }) => {
  const textColor = darken(ac, 0.18);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 14px",
        borderRadius: 100,
        background: "#FFFFFF",
        color: textColor,
        border: `1px solid ${ac}30`,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        marginBottom: 22,
      }}
    >
      <span
        style={{ width: 6, height: 6, borderRadius: "50%", background: ac }}
      />
      {children}
    </div>
  );
};

const PrimaryBtn = ({ children, ac, onClick, fullWidth, type = "button" }) => (
  <button
    type={type}
    onClick={onClick}
    style={{
      padding: "13px 26px",
      borderRadius: 12,
      fontWeight: 700,
      fontSize: 14,
      color: "#fff",
      cursor: "pointer",
      border: "none",
      background: ac,
      boxShadow: `0 4px 14px ${ac}35`,
      transition: "transform 0.2s, box-shadow 0.2s, background 0.2s",
      width: fullWidth ? "100%" : "auto",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = "translateY(-2px)";
      e.currentTarget.style.boxShadow = `0 8px 20px ${ac}45`;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow = `0 4px 14px ${ac}35`;
    }}
  >
    {children}
  </button>
);

const GhostBtn = ({ children, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: "13px 22px",
      borderRadius: 12,
      fontWeight: 600,
      fontSize: 14,
      color: TEXT_PRIMARY,
      cursor: "pointer",
      background: "#fff",
      border: `1px solid ${BORDER_HOVER}`,
      transition: "background 0.2s, border-color 0.2s",
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = BG_SURFACE;
      e.currentTarget.style.borderColor = "#94A3B8";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = "#fff";
      e.currentTarget.style.borderColor = BORDER_HOVER;
    }}
  >
    {children}
  </button>
);

/* ─────────────────────────────────────────────────────────────────────────
   HERO
───────────────────────────────────────────────────────────────────────── */
const Hero = ({ s, bp }) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const op = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const words = s.name.split(" ");
  const midIdx = Math.floor(words.length / 2);
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
      {/* Background Image */}
      <img
        src={HERO_IMAGE.src}
        alt={HERO_IMAGE.alt}
        width={HERO_IMAGE.width}
        height={HERO_IMAGE.height}
        loading="eager"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: 0,
        }}
      />

      {/* Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            linear-gradient(
              to bottom,
              rgba(15, 23, 42, 0.35) 0%,
              rgba(15, 23, 42, 0.65) 50%,
              rgba(15, 23, 42, 0.95) 100%
            )
          `,
          zIndex: 1,
        }}
      />

      {/* Hero Content */}
      <motion.div
        style={{
          position: "relative",
          zIndex: 10,
          maxWidth: 1200,
          margin: "0 auto",
          padding: "100px 24px",
          width: "100%",
          opacity: op,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
        >
          <Pill ac={s.accentColor}>HumanCare Connect</Pill>
        </motion.div>

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
          {s.name.split(" ").map((w, i, arr) => (
            <span key={i}>
              {i === Math.floor(arr.length / 2) ? (
                <span style={{ color: s.accentColor }}>{w} </span>
              ) : (
                <span>{w} </span>
              )}
            </span>
          ))}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.26 }}
          style={{
            fontSize: 18,
            color: "#E5E7EB",
            fontStyle: "italic",
            marginBottom: 10,
          }}
        >
          {s.tagline}
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.32 }}
          style={{
            fontSize: 16,
            color: "#F3F4F6",
            lineHeight: 1.7,
            maxWidth: 560,
            marginBottom: 28,
          }}
        >
          {s.intro}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.38 }}
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <PrimaryBtn ac={s.accentColor}>
            <a
              href="/appointment-booking"
              style={{ color: "#fff", textDecoration: "none" }}
            >
              Book Appointment
            </a>
          </PrimaryBtn>
        </motion.div>
      </motion.div>
    </section>
  );
};

/* ─────────────────────────────────────────────────────────────────────────
   CONSULTATION FORM
───────────────────────────────────────────────────────────────────────── */
const ConsultationForm = ({ s }) => {
  const [values, setValues] = useState({ name: "", email: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field) => (e) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

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

  const labelStyle = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: TEXT_PRIMARY,
    marginBottom: 6,
  };

  const focusHandlers = {
    onFocus: (e) => {
      e.target.style.borderColor = s.accentColor;
      e.target.style.boxShadow = `0 0 0 3px ${s.accentColor}1A`;
    },
    onBlur: (e) => {
      e.target.style.borderColor = BORDER;
      e.target.style.boxShadow = "none";
    },
  };

  return (
    <div
      style={{
        borderRadius: 24,
        padding: 32,
        background: "#fff",
        border: `1px solid ${BORDER}`,
      }}
    >
      {submitted ? (
        <div style={{ textAlign: "center", padding: "32px 8px" }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              margin: "0 auto 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `${s.accentColor}12`,
            }}
          >
            <FiCheckCircle style={{ fontSize: 24, color: s.accentColor }} />
          </div>
          <h3
            style={{
              color: TEXT_PRIMARY,
              fontSize: 18,
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            Request received
          </h3>
          <p
            style={{
              color: TEXT_BODY,
              fontSize: 14,
              lineHeight: 1.6,
              marginBottom: 20,
            }}
          >
            A member of our care team will reach out to {values.email || "you"}{" "}
            shortly.
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setValues({ name: "", email: "", message: "" });
            }}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: s.accentColor,
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            Send another request
          </button>
        </div>
      ) : (
        <>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `${s.accentColor}12`,
              marginBottom: 16,
            }}
          >
            <FiMessageSquare style={{ fontSize: 20, color: s.accentColor }} />
          </div>
          <h3
            style={{
              color: TEXT_PRIMARY,
              fontSize: 19,
              fontWeight: 800,
              marginBottom: 6,
            }}
          >
            Request a Consultation
          </h3>
          <p
            style={{
              color: TEXT_DIM,
              fontSize: 13.5,
              lineHeight: 1.6,
              marginBottom: 22,
            }}
          >
            Tell us a little about what you need, and a care coordinator will
            follow up within one business day.
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle} htmlFor="consult-name">
                Full name
              </label>
              <input
                id="consult-name"
                type="text"
                required
                placeholder="Jordan Lee"
                value={values.name}
                onChange={handleChange("name")}
                style={inputStyle}
                {...focusHandlers}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle} htmlFor="consult-email">
                Email address
              </label>
              <input
                id="consult-email"
                type="email"
                required
                placeholder="jordan@email.com"
                value={values.email}
                onChange={handleChange("email")}
                style={inputStyle}
                {...focusHandlers}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle} htmlFor="consult-message">
                What can we help with?
              </label>
              <textarea
                id="consult-message"
                required
                rows={4}
                placeholder="Briefly describe your symptoms or what you'd like to discuss…"
                value={values.message}
                onChange={handleChange("message")}
                style={{
                  ...inputStyle,
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
                {...focusHandlers}
              />
            </div>
            <PrimaryBtn ac={s.accentColor} fullWidth type="submit">
              Submit Request
            </PrimaryBtn>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 14,
                color: TEXT_DIM,
                fontSize: 12,
              }}
            >
              <FiLock style={{ fontSize: 13, color: s.accentColor }} />
              Your information is encrypted and never shared without consent.
            </div>
          </form>
        </>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────
   OVERVIEW
───────────────────────────────────────────────────────────────────────── */
const Overview = ({ s, bp }) => {
  const sectionPadding = bp.isMobile ? "52px 20px" : "88px 24px";

  // Outcomes grid: 4-col desktop → 2-col tablet → 1-col mobile
  const outcomesColumns = bp.isMobile
    ? "1fr"
    : bp.isTablet
      ? "repeat(2, 1fr)"
      : "repeat(4, 1fr)";

  return (
    <section style={{ background: BG_BASE, width: "100%" }}>
      <div
        style={{ maxWidth: 1200, margin: "0 auto", padding: sectionPadding }}
      >
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          style={{
            display: "grid",
            gridTemplateColumns:
              bp.isMobile || bp.isTablet ? "1fr" : "1.1fr 0.9fr",
            gap: bp.isMobile ? 32 : 64,
            alignItems: "start",
          }}
        >
          {/* Text */}
          <div>
            <motion.div variants={fadeUp}>
              <SLabel text="Service Overview" ac={s.accentColor} />
              <h2
                style={{
                  fontSize: "clamp(26px, 3.5vw, 36px)",
                  fontWeight: 900,
                  color: TEXT_PRIMARY,
                  lineHeight: 1.15,
                  marginBottom: 20,
                }}
              >
                What Are Online Prescription Refills?
              </h2>
            </motion.div>
            <motion.p
              variants={fadeUp}
              style={{
                color: TEXT_BODY,
                lineHeight: 1.75,
                marginBottom: 20,
                fontSize: 15.5,
              }}
            >
              {s.description}
            </motion.p>
            <motion.div
              variants={fadeUp}
              style={{
                padding: "16px 18px",
                borderRadius: 14,
                marginBottom: 20,
                background: `${s.accentColor}0A`,
                border: `1px solid ${s.accentColor}25`,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: s.accentColor,
                  marginBottom: 6,
                }}
              >
                Why It Matters
              </div>
              <p
                style={{
                  color: TEXT_BODY,
                  fontSize: 14,
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                {s.whyItMatters}
              </p>
            </motion.div>
            <motion.div variants={fadeUp}>
              <div
                style={{
                  color: TEXT_PRIMARY,
                  fontWeight: 700,
                  fontSize: 14,
                  marginBottom: 12,
                }}
              >
                Who Can Benefit
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {s.whoBenefits.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      color: TEXT_BODY,
                      fontSize: 14,
                    }}
                  >
                    <FiCheckCircle
                      style={{
                        color: s.accentColor,
                        fontSize: 16,
                        marginTop: 1,
                        flexShrink: 0,
                      }}
                    />
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Form — sticky only on desktop */}
          <motion.div
            variants={fadeUp}
            style={{ position: bp.isDesktop ? "sticky" : "static", top: 96 }}
          >
            <ConsultationForm s={s} />
          </motion.div>
        </motion.div>

        {/* Outcomes strip */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          style={{
            display: "grid",
            gridTemplateColumns: outcomesColumns,
            gap: 12,
            marginTop: bp.isMobile ? 32 : 52,
          }}
        >
          {s.keyOutcomes.map((o, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              custom={i}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                padding: 16,
                borderRadius: 14,
                background: BG_ELEVATED,
                border: `1px solid ${BORDER}`,
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: s.accentColor,
                  marginTop: 5,
                  flexShrink: 0,
                }}
              />
              <p
                style={{
                  color: TEXT_BODY,
                  fontSize: 13,
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {o}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

/* ─────────────────────────────────────────────────────────────────────────
   HOW IT WORKS
───────────────────────────────────────────────────────────────────────── */
const HowItWorks = ({ s, bp }) => {
  const sectionPadding = bp.isMobile ? "52px 0" : "88px 0";

  return (
    <section
      style={{
        padding: sectionPadding,
        background: BG_SURFACE,
        borderTop: `1px solid ${BORDER}`,
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: bp.isMobile ? "0 20px" : "0 24px",
        }}
      >
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          style={{
            display: "grid",
            gridTemplateColumns: bp.isMobile || bp.isTablet ? "1fr" : "1fr 1fr",
            gap: bp.isMobile ? 32 : 64,
            alignItems: "start",
          }}
        >
          <div>
            <motion.div variants={fadeUp}>
              <SLabel text="Our Services" ac={s.accentColor} />
              <h2
                style={{
                  fontSize: "clamp(26px, 3.5vw, 36px)",
                  fontWeight: 900,
                  color: TEXT_PRIMARY,
                  lineHeight: 1.15,
                  marginBottom: 8,
                }}
              >
                Getting started is{" "}
                <span style={{ color: s.accentColor }}>simple.</span>
              </h2>
              <p
                style={{
                  color: TEXT_DIM,
                  fontSize: 15,
                  lineHeight: 1.7,
                  marginBottom: 36,
                }}
              >
                Requesting an online prescription refill through Humancare
                Connect is quick, secure, and convenient.
              </p>
            </motion.div>

            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {s.steps.map((step, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  custom={i}
                  style={{ position: "relative", display: "flex", gap: 18 }}
                >
                  {i < s.steps.length - 1 && (
                    <div
                      style={{
                        position: "absolute",
                        left: 19,
                        top: 46,
                        width: 1,
                        height: "calc(100% - 8px)",
                        background: BORDER_HOVER,
                      }}
                    />
                  )}
                  <div
                    style={{
                      position: "relative",
                      zIndex: 1,
                      flexShrink: 0,
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: s.accentColor,
                    }}
                  >
                    {React.createElement(step.Icon, {
                      style: { fontSize: 18, color: "#fff" },
                    })}
                  </div>
                  <div style={{ paddingBottom: 28, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: s.accentColor,
                        marginBottom: 4,
                      }}
                    >
                      Step {i + 1}
                    </div>
                    <div
                      style={{
                        color: TEXT_PRIMARY,
                        fontWeight: 700,
                        fontSize: 15,
                        marginBottom: 4,
                      }}
                    >
                      {step.title}
                    </div>
                    <p
                      style={{
                        color: TEXT_DIM,
                        fontSize: 14,
                        lineHeight: 1.65,
                        margin: 0,
                      }}
                    >
                      {step.body}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Sticky card — static on mobile/tablet */}
          <motion.div
            variants={fadeUp}
            style={{ position: bp.isDesktop ? "sticky" : "static", top: 96 }}
          >
            <div
              style={{
                borderRadius: 24,
                padding: bp.isMobile ? 24 : 36,
                background: "#fff",
                border: `1px solid ${BORDER}`,
              }}
            >
              {React.createElement(s.heroIcon, {
                style: { fontSize: 44, color: s.accentColor, marginBottom: 16 },
              })}
              <h3
                style={{
                  color: TEXT_PRIMARY,
                  fontSize: 20,
                  fontWeight: 800,
                  marginBottom: 8,
                }}
              >
                Ready to begin?
              </h3>
              <p
                style={{
                  color: TEXT_DIM,
                  fontSize: 14,
                  lineHeight: 1.7,
                  marginBottom: 24,
                }}
              >
                Get convenient access to online prescription refills through
                trusted telemedicine services. Most appointments take just a few
                minutes, helping you stay on track with your medications and
                ongoing care.
              </p>
              <PrimaryBtn ac={s.accentColor} fullWidth>
                <a href="/login"> Get Started Today</a>
              </PrimaryBtn>
              <div
                style={{
                  marginTop: 20,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                {[
                  [FiLock, "Secure & Private"],
                  [FiZap, "Fast Response"],
                  [FiUserCheck, "Verified Providers"],
                  [FiFileText, "Insurance Accepted"],
                ].map(([Icon, lb], i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      color: TEXT_DIM,
                      fontSize: 12,
                    }}
                  >
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
};

/* ─────────────────────────────────────────────────────────────────────────
   FEATURES & BENEFITS
───────────────────────────────────────────────────────────────────────── */
const Features = ({ s, bp }) => (
  <section
    style={{
      maxWidth: 1200,
      margin: "0 auto",
      padding: bp.isMobile ? "52px 20px" : "88px 24px",
    }}
  >
    <motion.div
      variants={stagger}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
    >
      <motion.div
        variants={fadeUp}
        style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 44px" }}
      >
       <SLabel text="Features & Benefits" ac={s.accentColor} center />
        <h2
          style={{
            fontSize: "clamp(26px, 3.5vw, 36px)",
            fontWeight: 900,
            color: TEXT_PRIMARY,
            lineHeight: 1.15,
            marginBottom: 10,
          }}
        >
          Understanding Online
          <br />
          <span style={{ color: s.accentColor }}>Prescription Refills</span>
        </h2>
        <p style={{ color: TEXT_DIM, fontSize: 15 }}>
          Every feature is designed around one goal: better outcomes for you.
        </p>
      </motion.div>

      <motion.div
        variants={fadeUp}
        style={{
          borderRadius: 24,
          background: "#fff",
          border: `1px solid ${BORDER}`,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: bp.isMobile ? 20 : 28 }}>
          <p
            style={{
              color: TEXT_BODY,
              fontSize: 15,
              lineHeight: 1.75,
              margin: "0 0 18px 0",
            }}
          >
            Online prescription refills allow eligible patients to renew ongoing
            medications through a secure telemedicine consultation with a
            licensed healthcare provider. This service is designed for
            individuals who are managing chronic health conditions, maintaining
            long term treatment plans, or requiring continued access to
            prescribed medications. Instead of scheduling an in person
            appointment for routine medication renewals, patients can connect
            with a healthcare provider remotely and receive professional
            guidance from the comfort of home.
          </p>
          <p
            style={{
              color: TEXT_BODY,
              fontSize: 15,
              lineHeight: 1.75,
              margin: "0 0 18px 0",
            }}
          >
            At Humancare Connect, our online prescription refill service helps
            simplify medication management while supporting continuity of care.
            Healthcare providers can review your medical history, current
            medications, treatment progress, and ongoing healthcare needs to
            determine whether a prescription renewal is appropriate. This
            approach helps patients stay consistent with their treatment plans
            while reducing delays that could impact their health outcomes.
          </p>
          <p
            style={{
              color: TEXT_BODY,
              fontSize: 15,
              lineHeight: 1.75,
              margin: 0,
            }}
          >
            Online prescription refills are commonly requested for conditions
            such as high blood pressure, diabetes, asthma, allergies, thyroid
            disorders, high cholesterol, migraine management, and other ongoing
            health concerns. By combining convenient access to telemedicine
            services with professional clinical oversight, Humancare Connect
            helps patients maintain their healthcare journey through secure,
            accessible, and patient centered virtual healthcare services.
          </p>
        </div>
      </motion.div>
    </motion.div>
  </section>
);

/* ─────────────────────────────────────────────────────────────────────────
   STATS / WHY US
───────────────────────────────────────────────────────────────────────── */
const StatCard = ({ value, suffix, label, ac, go }) => {
  const c = useCountUp(value, 2200, go);
  return (
    <motion.div
      variants={fadeUp}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 28,
        borderRadius: 20,
        textAlign: "center",
        background: "#fff",
        border: `1px solid ${BORDER}`,
      }}
    >
      <div
        style={{
          fontSize: 38,
          fontWeight: 900,
          letterSpacing: "-0.02em",
          color: ac,
          marginBottom: 4,
        }}
      >
        {c}
        {suffix}
      </div>
      <div
        style={{
          color: TEXT_DIM,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </motion.div>
  );
};

const whyUsItems = [
  [
    FiAward,
    "Verified Providers",
    "Every clinician is credentialed, licensed, and continuously reviewed.",
  ],
[
    FiHeart,
    "Patient-Centered Care",
    "Clinical decisions are made in partnership with you — never without your input.",
  ],
  [
    FiGlobe,
    "Nationwide Access",
    "Care without geographic limits — from metro centers to remote districts.",
  ],
  [
    FiZap,
    "Fast Scheduling",
    "From first contact to first appointment in hours, not weeks.",
  ],
  [
    FiLock,
    "Secure Platform",
    "Enterprise-grade encryption protects every record and transaction.",
  ],
  [
    FiBarChart2,
    "Outcome Accountability",
    "We track results and publicly report our care quality standards.",
  ],
];

const WhyUs = ({ s, bp }) => {
  const [inView, setInView] = useState(false);

  // "Why us" grid: 3-col desktop → 2-col tablet → 1-col mobile
  const whyColumns = bp.isMobile
    ? "1fr"
    : bp.isTablet
      ? "repeat(2, 1fr)"
      : "repeat(3, 1fr)";

  return (
    <section style={{ maxWidth: 1200, margin: "0 auto", padding: "88px 24px" }}>
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
      >
        <motion.div
          variants={fadeUp}
          style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 44px" }}
        >
          <SLabel text="Why Choose Us" ac={s.accentColor} center />
          <h2
            style={{
              fontSize: "clamp(26px, 3.5vw, 36px)",
              fontWeight: 900,
              color: TEXT_PRIMARY,
              lineHeight: 1.15,
              marginBottom: 10,
            }}
          >
            Results you can{" "}
            <span style={{ color: s.accentColor }}>measure.</span>
          </h2>
          <p style={{ color: TEXT_DIM, fontSize: 15 }}>
            Numbers that represent real patients, real outcomes.
          </p>
        </motion.div>

         <motion.div
          onViewportEnter={() => setInView(true)}
          viewport={{ once: true, amount: 0.3 }}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginBottom: 44,
          }}
        >
          {s.stats.map((st, i) => (
            <StatCard
              key={i}
              value={st.value}
              suffix={st.suffix}
              label={st.label}
              ac={s.accentColor}
              go={inView}
            />
          ))}
        </motion.div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: whyColumns,
            gap: 12,
          }}
        >
          {whyUsItems.map(([Icon, title, desc], i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              custom={i}
              style={{
                display: "flex",
                gap: 14,
                alignItems: "flex-start",
                padding: 20,
                borderRadius: 16,
                background: "#fff",
                border: `1px solid ${BORDER}`,
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: `${s.accentColor}12`,
                }}
              >
                <Icon style={{ fontSize: 18, color: s.accentColor }} />
              </div>
              <div>
                <div
                  style={{
                    color: TEXT_PRIMARY,
                    fontWeight: 700,
                    fontSize: 14,
                    marginBottom: 4,
                  }}
                >
                  {title}
                </div>
                <div style={{ color: TEXT_DIM, fontSize: 13, lineHeight: 1.6 }}>
                  {desc}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
};

/* ─────────────────────────────────────────────────────────────────────────
   FAQ
───────────────────────────────────────────────────────────────────────── */
const FAQ = ({ s, bp }) => {
  const [open, setOpen] = useState(null);
  return (
    <section
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: bp.isMobile ? "52px 20px" : "88px 24px",
      }}
    >
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        style={{
          display: "grid",
          gridTemplateColumns: bp.isMobile || bp.isTablet ? "1fr" : "1fr 1fr",
          gap: bp.isMobile ? 32 : 64,
        }}
      >
        <motion.div variants={fadeUp}>
          <SLabel text="FAQ" ac={s.accentColor} />
          <h2
            style={{
              fontSize: "clamp(26px, 3.5vw, 36px)",
              fontWeight: 900,
              color: TEXT_PRIMARY,
              lineHeight: 1.15,
              marginBottom: 14,
            }}
          >
            Questions about
            <br />
            <span style={{ color: s.accentColor }}>{s.name}?</span>
          </h2>
          <p
            style={{
              color: TEXT_DIM,
              fontSize: 15,
              lineHeight: 1.7,
              marginBottom: 24,
            }}
          >
            We've answered the most common questions below. Our care team is one
            message away if yours isn't listed.
          </p>
          {/* <button
            style={{
              padding: "11px 20px",
              borderRadius: 12,
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              background: `${s.accentColor}10`,
              color: s.accentColor,
              border: `1px solid ${s.accentColor}30`,
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = `${s.accentColor}1A`)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = `${s.accentColor}10`)
            }
          >
            <FiMessageSquare style={{ fontSize: 15 }} /> Contact Care Team
          </button> */}
        </motion.div>

        <motion.div
          variants={fadeUp}
          style={{
            padding: bp.isMobile ? 16 : 20,
            borderRadius: 22,
            background: "#fff",
            border: `1px solid ${BORDER}`,
          }}
        >
          {s.faqs.map((faq, i) => (
            <div
              key={i}
              style={{
                borderBottom:
                  i < s.faqs.length - 1 ? `1px solid ${BORDER}` : "none",
              }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 0",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    color: TEXT_PRIMARY,
                    fontWeight: 700,
                    fontSize: bp.isMobile ? 13 : 14,
                    paddingRight: 16,
                  }}
                >
                  {faq.q}
                </span>
                <div
                  style={{
                    flexShrink: 0,
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: open === i ? s.accentColor : BG_SURFACE,
                    transition: "background 0.2s, transform 0.2s",
                    transform: open === i ? "rotate(45deg)" : "none",
                  }}
                >
                  <FiPlus
                    style={{
                      fontSize: 14,
                      color: open === i ? "#fff" : TEXT_DIM,
                    }}
                  />
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
                    <div
                      style={{
                        paddingBottom: 16,
                        paddingRight: bp.isMobile ? 8 : 40,
                        color: TEXT_BODY,
                        fontSize: 14,
                        lineHeight: 1.7,
                      }}
                    >
                      {faq.a}
                    </div>
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

/* ─────────────────────────────────────────────────────────────────────────
   FINAL CTA
───────────────────────────────────────────────────────────────────────── */
const FinalCTA = ({ s, bp }) => (
  <section
    style={{
      maxWidth: 1200,
      margin: "0 auto",
      padding: bp.isMobile ? "52px 20px" : "88px 24px",
    }}
  >
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6 }}
      style={{
        position: "relative",
        borderRadius: 28,
        padding: bp.isMobile ? "44px 24px" : "72px 48px",
        textAlign: "center",
        background: `${s.accentColor}08`,
        border: `1px solid ${s.accentColor}25`,
      }}
    >
      <div>
        <Pill ac={s.accentColor}>Start Today</Pill>
        <h2
          style={{
            fontSize: bp.isMobile
              ? "clamp(28px, 8vw, 36px)"
              : "clamp(32px, 5vw, 52px)",
            fontWeight: 900,
            color: TEXT_PRIMARY,
            lineHeight: 1.1,
            marginBottom: 14,
          }}
        >
          Ready to Prioritize Your
          <br />
          <span style={{ color: s.accentColor }}>Prescription?</span>
        </h2>
        <p
          style={{
            color: TEXT_BODY,
            lineHeight: 1.7,
            maxWidth: 500,
            margin: "0 auto 36px",
            fontSize: bp.isMobile ? 15 : 16,
          }}
        >
          Stay on track with your treatment plan through secure online
          prescription refill services. Connect with a licensed healthcare
          provider, request medication renewals when clinically appropriate, and
          access convenient telehealth services from wherever you are.
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            marginBottom: 36,
            flexWrap: "wrap",
            flexDirection: bp.isMobile ? "column" : "row",
          }}
        >
          <PrimaryBtn ac={s.accentColor} fullWidth={bp.isMobile}>
            <a href="/login"> Get Started Today</a>
          </PrimaryBtn>
          <GhostBtn>
            {" "}
            <a href="/appointment-booking"> Book Appointment </a>
          </GhostBtn>
          {/* <button
            style={{
              padding: "13px 24px",
              borderRadius: 12,
              fontWeight: 600,
              fontSize: 14,
              background: "transparent",
              color: TEXT_DIM,
              border: `1px solid ${BORDER_HOVER}`,
              cursor: "pointer",
              width: bp.isMobile ? "100%" : "auto",
            }}
          >
            Contact Us
          </button> */}
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            gap: bp.isMobile ? 16 : 28,
          }}
        >
          {[
            [FiLock, "HIPAA Compliant"],
            [FiStar, "4.9/5 Rated"],
            [FiShield, "Verified Providers"],
            [FiFileText, "All Insurances"],
            [FiClock, "24/7 Access"],
          ].map(([Icon, lb], i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: TEXT_DIM,
                fontSize: 13,
              }}
            >
              <Icon style={{ fontSize: 15 }} />
              {lb}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  </section>
);

/* ─────────────────────────────────────────────────────────────────────────
   ROOT
───────────────────────────────────────────────────────────────────────── */
export default function OnlinePrescriptionRefills() {
  const [slug, setSlug] = useState("telehealth-services");
  const s = SERVICES[slug] || SERVICES["telehealth-services"];
  const handleSwitch = useCallback((newSlug) => setSlug(newSlug), []);
  const bp = useBreakpoint();

  return (
    <>
      <Helmet>
        <title>
          Online Prescription Refills | Renew Medications Online | Humancare
          Connect
        </title>
        <meta
          name="description"
          content="Need a prescription refill? Connect with licensed healthcare providers through secure telemedicine services and renew eligible medications online."
        />
      </Helmet>
      <div>
        <AnimatePresence mode="wait">
          <motion.div
            key={slug}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <Hero s={s} bp={bp} />
            <Overview s={s} bp={bp} />
            <HowItWorks s={s} bp={bp} />
            <Features s={s} bp={bp} />
            <WhyUs s={s} bp={bp} />
            <FAQ s={s} bp={bp} />
            <FinalCTA s={s} bp={bp} />
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
