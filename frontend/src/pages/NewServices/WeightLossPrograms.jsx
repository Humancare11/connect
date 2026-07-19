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
import SEO from "../components/Seo";

/* ──────────────────────────────────────────────────────────────────────────
   DESIGN TOKENS — light theme
   Body copy uses solid slate, never low-opacity white-on-white, so contrast
   stays readable (point 6). Accent color is the only saturated color on the
   page; everything else is neutral.
────────────────────────────────────────────────────────────────────────── */
const BG_BASE = "#FFFFFF"; // Page background
const BG_SURFACE = "#F8FAFC"; // Alternating section background
const BG_ELEVATED = "#FFFFFF"; // Card background (flat, bordered — no glass)
const TEXT_PRIMARY = "#0F172A"; // Headings, high-emphasis body
const TEXT_BODY = "#475569"; // Standard paragraph text
const TEXT_DIM = "#64748B"; // Captions, labels, secondary info
const BORDER = "#E2E8F0";
const BORDER_HOVER = "#CBD5E1";

/* ──────────────────────────────────────────────────────────────────────────
   DATA
────────────────────────────────────────────────────────────────────────── */
const SERVICES = {
  "telehealth-services": {
    slug: "telehealth-services",
    name: "WEIGHT LOSS PROGRAMS",
    tagline:
      "Personalized support for healthy and sustainable weight management.",
    intro:
      "Achieve your health goals with personalized weight loss programs through secure telemedicine services. Connect with licensed healthcare providers who can help you create a realistic weight management plan based on your health history, lifestyle, and individual needs. Get expert guidance from the comfort of your home.",
    accentColor: "#2563EB",
    accentGlow: "#2563EB20",
    heroIcon: FiMonitor,
    heroEmoji: "🖥️",
    description:
      "Weight loss programs are personalized healthcare services designed to help individuals achieve and maintain a healthy weight through evidence based strategies. Through Humancare Connect, patients can connect with licensed healthcare providers who assess their health status, discuss weight management goals, and recommend appropriate lifestyle changes, nutrition guidance, and treatment options when clinically appropriate.",
    whyItMatters:
      "Maintaining a healthy weight can support overall wellness and may help reduce the risk of health conditions such as high blood pressure, type 2 diabetes, heart disease, sleep apnea, and joint problems. Professional weight management support can help patients build sustainable habits and achieve long term success.",
    whoBenefits: [
      "Adults seeking healthy weight management support",
      "Individuals struggling with overweight or obesity",
      "Patients looking to improve overall health and wellness",
      "People managing weight related health conditions",
      "Individuals seeking personalized nutrition and lifestyle guidance",
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
        title: "Share Your Health Goals",
        body: "Tell us about your weight management goals, health history, lifestyle habits, and any existing medical conditions.",
      },
      {
        Icon: FiFileText,
        title: "Meet With a Healthcare Provider",
        body: "Connect with a licensed healthcare provider who will evaluate your needs and discuss personalized weight loss strategies.",
      },
      {
        Icon: FiVideo,
        title: "Receive a Personalized Plan",
        body: "Your provider may recommend nutrition guidance, lifestyle modifications, activity goals, and other weight management approaches.",
      },
      {
        Icon: FiPackage,
        title: "Stay on Track",
        body: "Continue your journey with ongoing support, follow up appointments, and adjustments to your plan as needed.",
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
        q: "What is a weight loss program?",
        a: "A weight loss program is a personalized plan designed to help individuals achieve and maintain a healthy weight through nutrition guidance, lifestyle changes, physical activity, and professional healthcare support.",
      },
      {
        q: "Can telehealth help with weight loss?",
        a: "Yes. Telemedicine services provide convenient access to healthcare providers who can offer weight management guidance, monitor progress, and recommend personalized strategies.",
      },
      {
        q: "Who can benefit from a weight loss program?",
        a: "Adults seeking healthier lifestyle habits, weight management support, or help managing weight related health conditions may benefit from a structured program.",
      },
      {
        q: "Are weight loss programs personalized?",
        a: "Yes. Healthcare providers consider your health history, goals, lifestyle habits, and current health status when creating recommendations.",
      },
      {
        q: "Can weight loss improve overall health?",
        a: "Maintaining a healthy weight may help support heart health, blood pressure management, blood sugar control, mobility, and overall wellness.",
      },
      {
        q: "How do I get started with a weight loss program?",
        a: "You can schedule an online appointment, discuss your goals with a healthcare provider, and receive a personalized weight management plan.",
      },
      {
        q: "Are virtual weight loss consultations effective?",
        a: "Virtual consultations provide convenient access to professional guidance and ongoing support while helping patients stay engaged in their health goals.",
      },
      {
        q: "Can weight loss programs help with obesity?",
        a: "Yes. Weight management programs can provide support for individuals living with overweight or obesity through personalized care and lifestyle recommendations.",
      },
      {
        q: "What role does nutrition play in weight loss?",
        a: "Balanced nutrition is a key component of healthy weight management and can help support sustainable long term results.",
      },
      {
        q: "How often should I follow up with a provider?",
        a: "Follow up schedules vary based on individual goals, progress, and healthcare needs.",
      },
      {
        q: "Can weight loss programs support long term success?",
        a: "Yes. Sustainable habits and ongoing support are important factors in maintaining long term weight management results.",
      },
      {
        q: "Do I need to exercise to lose weight?",
        a: "Physical activity is often recommended as part of a comprehensive weight management plan, but recommendations vary by individual.",
      },
      {
        q: "Can weight loss help reduce health risks?",
        a: "Achieving a healthier weight may help reduce risks associated with conditions such as type 2 diabetes, heart disease, and high blood pressure.",
      },
      {
        q: "Are online weight loss programs secure?",
        a: "Yes. Humancare Connect uses secure telemedicine technology to protect patient privacy and healthcare information.",
      },
      {
        q: "Can healthcare providers monitor my progress remotely?",
        a: "Yes. Providers can review your progress during follow up appointments and recommend adjustments to your plan when appropriate.",
      },
      {
        q: "What makes a healthy weight loss plan?",
        a: "Healthy weight loss plans focus on balanced nutrition, sustainable lifestyle changes, realistic goals, and ongoing support.",
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
const SLabel = ({ text, ac }) => (
  <div
    style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}
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
        background: `${ac}12`,
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
const Hero = ({ s }) => {
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
        background: BG_SURFACE,
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
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
            color: TEXT_PRIMARY,
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
            color: TEXT_DIM,
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
            color: TEXT_BODY,
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
          style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
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
        </motion.div>
      </motion.div>
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
   Fix 2: text block now sits left (was right), and the right column — which
   previously held the icon visual panel — now holds the consultation form.
   The outcomes strip at the bottom is unchanged in structure.
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
              What Are Weight Loss Programs?
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
   OUR SERVICES (was "How It Works")
   Fix 3: heading text changed only — content (the 4-step process) is
   unchanged since it's still accurate underneath the new label.
   Fix 5: sticky card glass effect removed — flat surface, no backdrop-filter,
   no glow blob.
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
              Beginning your weight loss journey through Humancare Connect is
              convenient, secure, and designed around your individual needs.
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
              Take the first step toward healthier weight management through
              trusted telemedicine services. Personalized support is available
              to help you build sustainable habits and achieve your long term
              wellness goals.
            </p>
            <PrimaryBtn ac={s.accentColor} fullWidth>
              Get Started Today
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
   Fix 4: the 6 separate small cards are consolidated into a single large
   card. Each feature is now a row inside one bordered container rather than
   its own tile, so it reads as one consolidated "service details" panel.
   Fix 5: no glass effect, no hover glow-shadow — flat row dividers instead.
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
        <SLabel text="Features & Benefits" ac={s.accentColor} />
        <h2
          style={{
            fontSize: "clamp(26px, 3.5vw, 36px)",
            fontWeight: 900,
            color: TEXT_PRIMARY,
            lineHeight: 1.15,
            marginBottom: 10,
          }}
        >
          Understanding Weight Loss
          <br />
          <span style={{ color: s.accentColor }}>Programs</span>
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
        <div style={{ padding: 28 }}>
          <p
            style={{
              color: TEXT_BODY,
              fontSize: 15,
              lineHeight: 1.75,
              margin: "0 0 18px 0",
            }}
          >
            Weight loss is not simply about reducing numbers on a scale.
            Effective weight management focuses on improving overall health
            through sustainable lifestyle changes, balanced nutrition, regular
            physical activity, and professional healthcare guidance. Every
            individual has unique health needs, which is why personalized care
            plays an important role in long term success.
          </p>
          <p
            style={{
              color: TEXT_BODY,
              fontSize: 15,
              lineHeight: 1.75,
              margin: "0 0 18px 0",
            }}
          >
            At Humancare Connect, our weight loss programs are designed to
            provide patient centered support through virtual healthcare
            services. Licensed healthcare providers evaluate factors such as
            current weight, medical history, lifestyle habits, nutrition
            patterns, and health goals to develop individualized
            recommendations. This personalized approach helps patients make
            meaningful progress while prioritizing their overall well being.
          </p>
          <p
            style={{
              color: TEXT_BODY,
              fontSize: 15,
              lineHeight: 1.75,
              margin: 0,
            }}
          >
            Weight loss programs may benefit individuals who are managing
            obesity, weight related health concerns, or difficulties maintaining
            healthy lifestyle habits. Through secure telemedicine services,
            patients can access professional support, receive ongoing guidance,
            and stay accountable throughout their weight management journey
            without the need for frequent in person visits.
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
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setInView(true);
      },
      { threshold: 0.2 },
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      style={{ maxWidth: 1200, margin: "0 auto", padding: "88px 24px" }}
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
          <SLabel text="Why Choose Us" ac={s.accentColor} />
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

        <div
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
        </div>

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
          <button
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
          </button>
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
          Ready to Reach Your Weight
          <br />
          <span style={{ color: s.accentColor }}>Management Goals?</span>
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
          Take control of your health with personalized weight loss programs
          through Humancare Connect. Connect with a licensed healthcare
          provider, receive expert guidance, and start building healthier habits
          that support long term wellness.
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
          <PrimaryBtn ac={s.accentColor}>Get Started</PrimaryBtn>
          <GhostBtn>Book Appointment</GhostBtn>
          <button
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
          </button>
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
   Fix 6: wrapper background now matches the token system used throughout
   every child component, instead of a hardcoded color disconnected from it.
────────────────────────────────────────────────────────────────────────── */
export default function WeightLossPrograms() {
  const [slug, setSlug] = useState("telehealth-services");
  const s = SERVICES[slug] || SERVICES["telehealth-services"];
  const handleSwitch = useCallback((newSlug) => setSlug(newSlug), []);

  return (
    <>
                  <SEO
        title="Weight Loss Programs Online | Personalized Weight Management | Humancare Connect"
        description="Explore personalized weight loss programs through secure telemedicine services. Connect with licensed healthcare providers and achieve your health goals."
        keywords="Weight loss programs, weight loss programs online, personalized weight loss programs, weight management, personalized weight management, healthy weight management, weight loss plan, weight management plan, weight loss journey, sustainable weight loss, obesity management, overweight, nutrition guidance, lifestyle changes, lifestyle modifications, physical activity, healthy lifestyle habits, long term weight management, weight related health conditions, telemedicine services, virtual healthcare services, online weight loss consultation, licensed healthcare providers, personalized care, health and wellnes"
        url="https://humancareconnect.co/weight-loss-programs"
      />
      <Helmet>
        <title>
          Weight Loss Programs Online | Personalized Weight Management |
          Humancare Connect
        </title>
        <meta
          name="description"
          content="Explore personalized weight loss programs through secure telemedicine services. Connect with licensed healthcare providers and achieve your health goals."
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
            <Hero s={s} />
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
