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
import emailjs from "@emailjs/browser";

import { Helmet } from "react-helmet-async";

import heroBanner from "../../assets/MedicalServices/laboratory-diagnostic-testing-services.webp";
import ServiceBookingCard from "../../components/booking/ServiceBookingCard";
import "../Specialty/SpecialtyPage.css";
import "../Categories/categoriesGlobal.css";
import { useServicePrice } from "../../hooks/useServicePrice";

const HERO_IMAGE = {
  src: heroBanner,
  alt: "Licensed healthcare provider conducting a virtual consultation for laboratory testing and lab requisition services",
  width: 1920,
  height: 700,
};

/* ──────────────────────────────────────────────────────────────────────────
   DESIGN TOKENS 
────────────────────────────────────────────────────────────────────────── */
const BG_BASE = "#FFFFFF"; // Page background
const BG_SURFACE = "#F8FAFC"; // Alternating section background
const BG_ELEVATED = "#FFFFFF"; // Card background (flat, bordered — no glass)
const TEXT_PRIMARY = "#0F172A"; // Headings, high-emphasis body
const TEXT_BODY = "#475569"; // Standard paragraph text
const TEXT_DIM = "#64748B"; // Captions, labels, secondary info
const BORDER = "#E2E8F0";
const BORDER_HOVER = "#CBD5E1";

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

/* ──────────────────────────────────────────────────────────────────────────
   DATA
────────────────────────────────────────────────────────────────────────── */
const SERVICES = {
  "telehealth-services": {
    slug: "lab-requisitions",
    name: "LAB REQUISITIONS",
    serviceName: "Lab Requisitions",
    tagline: "Get the testing you need without unnecessary delays.",
    intro:
      "Request a Lab Requisition through secure telemedicine services. Connect with a licensed healthcare provider, discuss your symptoms or health concerns, and receive laboratory testing orders when clinically appropriate to support diagnosis, treatment, and ongoing health management.",
    accentColor: "#2563EB",
    accentGlow: "#2563EB20",
    heroIcon: FiMonitor,
    heroEmoji: "🖥️",
    description:
      "A Lab Requisition is a medical order provided by a healthcare professional that authorizes laboratory testing. These tests can help evaluate symptoms, monitor chronic conditions, assess overall health, and provide important information for diagnosis and treatment planning. Through Humancare Connect, eligible patients can connect with a licensed healthcare provider online to discuss their healthcare needs and determine whether laboratory testing may be appropriate.",
    whyItMatters:
      "Laboratory testing plays an important role in identifying health concerns, monitoring treatment progress, and supporting informed healthcare decisions. Convenient access to lab requisitions can help patients take a proactive approach to managing their health without unnecessary delays.",
    whoBenefits: [
      " Individuals experiencing new or unexplained symptoms",
      "Patients monitoring chronic health conditions",
      "Adults seeking preventive health screenings",
      "Individuals requiring follow-up testing for ongoing care",
      "Patients looking for convenient healthcare access",
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
        title: "Share Your Health Concerns",
        body: "Tell us about your symptoms, medical history, current medications, and reasons for seeking laboratory testing.",
      },
      {
        Icon: FiFileText,
        title: "Connect With a Healthcare Provider",
        body: "A licensed healthcare provider will review your information and discuss whether testing may be appropriate for your healthcare needs.",
      },
      {
        Icon: FiVideo,
        title: "Complete Your Consultation",
        body: "Join a secure virtual appointment from your phone, tablet, or computer and receive personalized medical guidance.",
      },
      {
        Icon: FiPackage,
        title: "Receive Your Lab Order",
        body: "If clinically appropriate, your provider may issue a lab requisition that can be used to complete testing at an approved laboratory.",
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
        q: "What is a Lab Requisition?",
        a: "A Lab Requisition is a medical order from a healthcare provider that authorizes laboratory testing based on a patient's healthcare needs.",
      },
      {
        q: "Can I request a Lab Requisition online?",
        a: "Yes. Eligible patients can discuss their healthcare concerns with a licensed provider through secure telemedicine services.",
      },
      {
        q: "Why might I need laboratory testing?",
        a: "Laboratory testing may help evaluate symptoms, monitor chronic conditions, support preventive care, and assist with diagnosis and treatment planning.",
      },
      {
        q: "What types of tests can be ordered?",
        a: "Testing options vary based on individual healthcare needs and provider assessment.",
      },
      {
        q: "Can I get blood work ordered online?",
        a: "A healthcare provider may order blood tests when clinically appropriate following a consultation.",
      },
      {
        q: "Do I need symptoms to request lab testing?",
        a: "Not always. Some patients seek laboratory testing as part of preventive healthcare or routine wellness monitoring.",
      },
      {
        q: "Can lab testing help monitor chronic conditions?",
        a: "Yes. Laboratory testing is commonly used to monitor conditions such as diabetes, thyroid disorders, and high cholesterol.",
      },
      {
        q: "What information should I provide during my consultation?",
        a: "You may be asked about your symptoms, medical history, medications, family history, and healthcare goals.",
      },
      {
        q: "How do providers determine whether testing is needed?",
        a: "Providers evaluate your health concerns and clinical information before recommending laboratory testing.",
      },
      {
        q: "Can a provider decline a testing request?",
        a: "Yes. Testing recommendations are based on clinical judgment and medical necessity.",
      },
      {
        q: "How long does a virtual consultation take?",
        a: "Most appointments are completed within a short consultation depending on the patient's healthcare needs.",
      },
      {
        q: "Can I request preventive health screening tests?",
        a: "Yes. Preventive testing may be discussed during your consultation based on your age, health history, and risk factors.",
      },
      {
        q: "Can lab testing help identify nutrient deficiencies?",
        a: "Certain laboratory tests may help evaluate vitamin, mineral, and nutritional status when clinically appropriate.",
      },
      {
        q: "Are online consultations secure?",
        a: "Yes. Humancare Connect uses secure telemedicine technology designed to protect patient privacy and healthcare information.",
      },
      {
        q: "Can I discuss my lab results with a provider?",
        a: "Yes. Providers can review test results and discuss appropriate next steps during a follow-up consultation.",
      },
      {
        q: "Can laboratory testing support medication management?",
        a: "Yes. Some medications require periodic laboratory monitoring to help evaluate treatment effectiveness and safety.",
      },
      {
        q: "Why choose Humancare Connect for Lab Requisitions?",
        a: "Humancare Connect offers secure telemedicine services, licensed healthcare providers, and convenient access to healthcare support from anywhere.",
      },
      {
        q: "Can I access care while traveling?",
        a: "Availability may depend on provider licensing requirements and your location at the time of service.",
      },
      {
        q: "Are lab requisitions available for ongoing healthcare management?",
        a: "Yes. Many patients use laboratory testing as part of long-term healthcare monitoring and treatment plans.",
      },
      {
        q: "How do I get started?",
        a: "Simply schedule an appointment, discuss your healthcare concerns with a licensed provider, and receive laboratory testing orders when clinically appropriate.",
      },
    ],
  },
};
/* ──────────────────────────────────────────────────────────────────────────
   HOOKS & UTILS
────────────────────────────────────────────────────────────────────────── */
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

/* ──────────────────────────────────────────────────────────────────────────
   MICRO COMPONENTS
────────────────────────────────────────────────────────────────────────── */
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

// Returns a hex color darkened toward black by `amount` (0-1), used to keep
// small accent-tinted text safely above WCAG AA contrast on light tint backgrounds.
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
  const textColor = darken(ac, 0.18); // verified >7:1 contrast at this font size, vs ~4.5:1 for the raw accent
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 14px",
        borderRadius: 100,
        background: "#fff",
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

/* ──────────────────────────────────────────────────────────────────────────
   HERO
  
────────────────────────────────────────────────────────────────────────── */
const Hero = ({ s, price, priceLoading }) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const op = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

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
          maxWidth: 1381,
          margin: "0 auto",
          padding: "90px 50px 15px",
          width: "100%",
          opacity: op,
          display: "grid",
          gridTemplateColumns: "1fr 450px",
          gap: 48,
          alignItems: "center",
        }}
      ><div>
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
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <ServiceBookingCard
            price={price}
            priceLoading={priceLoading}
            name={s.serviceName}
            slug={s.slug}
          />
        </motion.div>
      </motion.div >
    </section>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
   CONSULTATION FORM — 
────────────────────────────────────────────────────────────────────────── */
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

/* ──────────────────────────────────────────────────────────────────────────
   OVERVIEW
 
────────────────────────────────────────────────────────────────────────── */
const Overview = ({ s }) => (
  <section
    style={{
      background: BG_BASE,
      width: "100%",
    }}
  >
    <div
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "88px 24px",
      }}
    >
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          gap: 64,
          alignItems: "start",
        }}
      >
        {/* Text — now the left column */}
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
              What Are Lab Requisitions?
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
              WHY IT MATTERS
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

        {/* Form — now the right column, replacing the old icon visual panel */}
        <motion.div variants={fadeUp} style={{ position: "sticky", top: 96 }}>
          <ConsultationForm s={s} />
        </motion.div>
      </motion.div>

      {/* Outcomes strip — unchanged */}
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginTop: 52,
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

/* ──────────────────────────────────────────────────────────────────────────
   OUR SERVICES 
  
────────────────────────────────────────────────────────────────────────── */
const HowItWorks = ({ s }) => (
  <section
    style={{
      padding: "88px 0",
      background: BG_SURFACE,
      borderTop: `1px solid ${BORDER}`,
      borderBottom: `1px solid ${BORDER}`,
    }}
  >
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 64,
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
              Getting started is {" "}
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
              Requesting a Lab Requisition through Humancare Connect is quick,
              secure, and convenient.
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

        {/* Sticky card — flat surface, no blur, no glow blob */}
        <motion.div variants={fadeUp} style={{ position: "sticky", top: 96 }}>
          <div
            style={{
              borderRadius: 24,
              padding: 36,
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
              Access trusted telemedicine services and discuss your healthcare
              concerns with a licensed provider. Complete your consultation
              online and receive laboratory testing orders when appropriate.
            </p>
            <PrimaryBtn ac={s.accentColor} fullWidth>
              {" "}
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

/* ──────────────────────────────────────────────────────────────────────────
   FEATURES & BENEFITS
 
────────────────────────────────────────────────────────────────────────── */
const Features = ({ s }) => (
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
          Understanding Lab Requisitions
          <br />
          {/* <span style={{ color: s.accentColor }}>
            Through Virtual Healthcare
          </span> */}
        </h2>
        {/* <p style={{ color: TEXT_DIM, fontSize: 15 }}>
          Every feature is designed around one goal: better outcomes for you.
        </p> */}
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
        <div style={{ padding: 28 }}>
          <p
            style={{
              color: TEXT_BODY,
              fontSize: 15,
              lineHeight: 1.75,
              margin: "0 0 18px 0",
            }}
          >
            Lab requisitions are commonly used to help evaluate symptoms,
            monitor chronic conditions, support preventive care, and provide
            healthcare providers with valuable information about a patient's
            overall health. Depending on your medical needs, laboratory testing
            may help assess factors such as blood sugar levels, cholesterol,
            thyroid function, vitamin deficiencies, infections, hormone levels,
            and other important health markers.
          </p>
          <p
            style={{
              color: TEXT_BODY,
              fontSize: 15,
              lineHeight: 1.75,
              margin: "0 0 18px 0",
            }}
          >
            Through Humancare Connect, patients can access telemedicine services
            and discuss their healthcare concerns with a licensed healthcare
            provider from the comfort of home. During the consultation,
            providers may review symptoms, medical history, medications, family
            history, and treatment goals to determine whether laboratory testing
            may be beneficial.
          </p>
          <p
            style={{
              color: TEXT_BODY,
              fontSize: 15,
              lineHeight: 1.75,
              margin: 0,
            }}
          >
            Lab requisitions are often requested for wellness screenings,
            chronic disease management, diagnostic evaluations, medication
            monitoring, and preventive healthcare. By combining virtual
            healthcare services with professional clinical oversight, Humancare
            Connect helps patients access convenient healthcare support while
            making it easier to stay informed about their health.
          </p>
        </div>
      </motion.div>
    </motion.div>
  </section>
);

/* ──────────────────────────────────────────────────────────────────────────
   STATS / WHY US
   Fix 5: no glass effect on stat or info cards — flat bordered surfaces.
────────────────────────────────────────────────────────────────────────── */
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

const WhyUs = ({ s }) => {
  const [inView, setInView] = useState(false);

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
            gridTemplateColumns: "repeat(3, 1fr)",
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

/* ──────────────────────────────────────────────────────────────────────────
   FAQ
   Fix 5: container is a flat bordered surface, no backdrop blur.
────────────────────────────────────────────────────────────────────────── */
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
            padding: 20,
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
                    fontSize: 14,
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
                        paddingRight: 40,
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

/* ──────────────────────────────────────────────────────────────────────────
   FINAL CTA
   Fix 5: glow blobs and translucent layered gradient removed — flat tinted
   surface instead.
────────────────────────────────────────────────────────────────────────── */
const FinalCTA = ({ s }) => (
  <section style={{ maxWidth: 1200, margin: "0 auto", padding: "88px 24px" }}>
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6 }}
      style={{
        position: "relative",
        borderRadius: 28,
        padding: "72px 48px",
        textAlign: "center",
        background: `${s.accentColor}08`,
        border: `1px solid ${s.accentColor}25`,
      }}
    >
      <div>
        <Pill ac={s.accentColor}>Start Today</Pill>
        <h2
          style={{
            fontSize: "clamp(32px, 5vw, 52px)",
            fontWeight: 900,
            color: TEXT_PRIMARY,
            lineHeight: 1.1,
            marginBottom: 14,
          }}
        >
          <br />
          <span style={{ color: s.accentColor }}>
            Take the Next Step Toward Better Health
          </span>
        </h2>
        <p
          style={{
            color: TEXT_BODY,
            lineHeight: 1.7,
            maxWidth: 500,
            margin: "0 auto 36px",
            fontSize: 16,
          }}
        >
          Whether you're monitoring an ongoing condition, investigating new
          symptoms, or staying proactive with preventive care, Humancare Connect
          makes it easy to access laboratory testing support from anywhere.
          <br />
          <br />
          Connect with a licensed healthcare provider through secure
          telemedicine services and receive lab requisitions when clinically
          appropriate to help guide your healthcare journey.
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            marginBottom: 36,
            flexWrap: "wrap",
          }}
        >
          <PrimaryBtn ac={s.accentColor}>
            <a href="/login">Get Started</a>
          </PrimaryBtn>
          <GhostBtn>
            <a href="/appointment-booking">
              {" "}
              Request Your Lab Consultation Today
            </a>
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
            gap: 28,
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

/* ──────────────────────────────────────────────────────────────────────────
   ROOT APP
  
────────────────────────────────────────────────────────────────────────── */
export default function LABREQUISITIONS() {
  const [slug, setSlug] = useState("telehealth-services");
  const s = SERVICES[slug] || SERVICES["telehealth-services"];
  const handleSwitch = useCallback((newSlug) => setSlug(newSlug), []);
  const bp = useBreakpoint();
  const { price, priceLoading } = useServicePrice(s.slug);

  return (
    <>
      <Helmet>
        <title>
          Lab Requisitions Online | Laboratory Testing Orders | Humancare
          Connect
        </title>
        <meta
          name="description"
          content="Need a lab requisition? Connect with licensed healthcare providers online and receive laboratory testing orders when clinically appropriate through secure telemedicine services."
        />
      </Helmet>
      <div
      // style={{
      //   backgroundColor: BG_BASE,
      //   minHeight: "700px",
      //   width: "100%",
      // }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={slug}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <Hero s={s} price={price} priceLoading={priceLoading} />
            <Overview s={s} />
            <HowItWorks s={s} />
            <Features s={s} />
            <WhyUs s={s} />
            <FAQ s={s} />
            <FinalCTA s={s} />
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
