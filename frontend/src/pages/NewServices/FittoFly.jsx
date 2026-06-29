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
  FiActivity,
  FiShield,
  FiLock,
  FiZap,
  FiCalendar,
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
} from "react-icons/fi";
import { Helmet } from "react-helmet-async";

/* Import the shared stylesheet — same file for every service page */
import "./newservices.css";

import heroBanner from "../../assets/MedicalServices/fit-to-fly-medical-certificate.webp";

const HERO_IMAGE = {
  src: heroBanner, // ← imported path, bundler handles it
  alt: "Licensed healthcare provider conducting a virtual fit to fly certificate consultation for airline medical clearance",
  width: 1920,
  height: 700,
};

/* ──────────────────────────────────────────────────────────────────────────
   DATA — one entry per service slug
────────────────────────────────────────────────────────────────────────── */
const SERVICES = {
  "telehealth-services": {
    slug: "chronic-care-management",
    name: "FIT TO FLY CERTIFICATE",
    tagline: "Medical travel clearance for a smoother journey.",
    intro:
      "Request a Fit to Fly Certificate through secure telemedicine services. Connect with a licensed healthcare provider, discuss your travel plans and health status, and receive medical documentation when clinically appropriate to support airline travel requirements.",
    accentColor: "#2563EB",
    heroIcon: FiMonitor,
    description:
      "A Fit to Fly Certificate is a medical document that may be required by airlines for passengers with certain health conditions, recent surgeries, pregnancy-related travel considerations, or ongoing medical concerns. The certificate confirms that a healthcare provider has reviewed your condition and assessed your ability to travel safely by air.Through Humancare Connect, eligible travelers can complete a virtual consultation with a licensed healthcare provider, discuss airline requirements, and obtain travel-related medical documentation when appropriate. Our telemedicine platform offers a convenient way to address travel health requirements without the need for an in-person clinic visit.",
    whyItMatters:
      "Unexpected airline documentation requirements can delay or disrupt travel plans. A Fit to Fly assessment helps travelers understand whether medical clearance may be needed before departure and provides an opportunity to address health concerns before boarding.",
    whoBenefits: [
      "Travelers recovering from surgery or hospitalization",
      "Passengers with chronic medical conditions",
      "Pregnant individuals requiring airline documentation",
      "Travelers with recent illnesses or injuries",
      "International travelers needing medical travel clearance",
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
        title: "Share Your Travel & Health Information",
        body: "Tell us about your upcoming trip, airline requirements, medical history, recent treatments, and any health concerns that may impact your travel plans.",
      },
      {
        Icon: FiFileText,
        title: "Connect With a Healthcare Provider",
        body: "A licensed healthcare provider will review your information, discuss your condition, and assess any factors that could affect your ability to travel safely.",
      },
      {
        Icon: FiVideo,
        title: "Complete Your Virtual Assessment",
        body: "Join a secure online consultation from your phone, tablet, or computer and discuss your travel needs with your provider.",
      },
      {
        Icon: FiPackage,
        title: "Receive Your Travel Documentation",
        body: "If medically appropriate, your provider will issue the required travel clearance documentation or fit-to-fly certificate to help support your travel plans.",
      },
    ],
    features: [
      {
        Icon: FiSearch,
        title: "Share Your Travel & Health Information",
        body: "Tell us about your upcoming trip, airline requirements, medical history, recent treatments, and any health concerns that may impact your travel plans.",
      },
      {
        Icon: FiFileText,
        title: "Connect With a Healthcare Provider",
        body: "A licensed healthcare provider will review your information, discuss your condition, and assess any factors that could affect your ability to travel safely.",
      },
      {
        Icon: FiVideo,
        title: "Complete Your Virtual Assessment",
        body: "Join a secure online consultation from your phone, tablet, or computer and discuss your travel needs with your provider.",
      },
      {
        Icon: FiPackage,
        title: "Receive Your Travel Documentation",
        body: "If clinically appropriate, your provider may issue a Fit to Fly Certificate that can be shared with your airline or travel provider.",
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
        q: "What is a Fit to Fly Certificate?",
        a: "A Fit to Fly Certificate is a medical document issued by a healthcare provider after assessing a traveler's health status. It may be used to confirm that a person is medically suitable for air travel based on their current condition.",
      },
      {
        q: "Why might an airline require a Fit to Fly Certificate?",
        a: "Airlines may request medical clearance for passengers recovering from illness, surgery, injury, pregnancy-related conditions, or certain ongoing health concerns that could affect travel.",
      },
      {
        q: "Who may benefit from a Fit to Fly assessment?",
        a: "Travelers with recent medical procedures, chronic health conditions, respiratory concerns, pregnancy-related travel needs, or other health issues that could require airline approval may benefit from an assessment.",
      },
      {
        q: "Can I request a Fit to Fly Certificate online?",
        a: "Yes. Eligible travelers can complete a virtual consultation with a licensed healthcare provider through secure telemedicine services and discuss their travel requirements.",
      },
      {
        q: "What health conditions commonly require travel clearance?",
        a: "Conditions involving recent surgery, cardiovascular concerns, respiratory illnesses, pregnancy, mobility limitations, or ongoing medical treatment may require additional review before travel.",
      },
      {
        q: "How soon should I arrange my Fit to Fly assessment?",
        a: "It is best to schedule your assessment several days before departure to allow sufficient time for evaluation and any necessary documentation.",
      },
      {
        q: "Can I obtain a Fit to Fly Certificate after surgery?",
        a: "Many travelers seek medical clearance after surgery. Eligibility depends on the type of procedure, recovery progress, current symptoms, and provider assessment.",
      },
      {
        q: "Is a Fit to Fly assessment available for pregnant travelers?",
        a: "Yes. Pregnant travelers may request an assessment, especially when airline policies require medical documentation during certain stages of pregnancy.",
      },
      {
        q: "Can travelers with chronic medical conditions request a certificate?",
        a: "Yes. Individuals managing stable chronic conditions may be eligible for assessment based on their medical history, current health status, and travel plans.",
      },
      {
        q: "What information should I prepare before my consultation?",
        a: "You may be asked to provide details about your medical history, medications, recent treatments, travel itinerary, airline requirements, and current symptoms.",
      },
      {
        q: "How is eligibility for a Fit to Fly Certificate determined?",
        a: "A healthcare provider reviews your medical information, travel plans, and overall condition before determining whether medical clearance is appropriate.",
      },
      {
        q: "What happens during a Fit to Fly consultation?",
        a: "During the consultation, a provider may discuss your health history, recent medical events, current symptoms, medications, and travel-related concerns.",
      },
      {
        q: "Can a healthcare provider recommend postponing travel?",
        a: "Yes. If a provider believes air travel could pose a health risk, they may recommend delaying travel or seeking additional medical evaluation.",
      },
      {
        q: "Are Fit to Fly Certificates accepted for international travel?",
        a: "Many travelers use Fit to Fly Certificates for international travel when requested by airlines or destination-specific travel requirements.",
      },
      {
        q: "Does a Fit to Fly Certificate guarantee boarding approval?",
        a: "No. Final travel decisions remain subject to airline policies, operational procedures, and any additional documentation requirements.",
      },
      {
        q: "What should I do if my health condition changes before departure?",
        a: "If you experience new symptoms or changes in your condition after receiving medical clearance, you should seek further medical advice before traveling.",
      },
      {
        q: "Can I discuss travel-related health concerns during my appointment?",
        a: "Yes. Providers can discuss travel health considerations, medication management, mobility concerns, and precautions that may help support safer travel.",
      },
      {
        q: "Are online Fit to Fly consultations secure?",
        a: "Yes. Humancare Connect uses secure telemedicine technology designed to protect patient privacy and healthcare information.",
      },
      {
        q: "Why choose Humancare Connect for a Fit to Fly assessment?",
        a: "Humancare Connect provides convenient access to licensed healthcare providers, secure virtual consultations, and professional travel health support from wherever you are.",
      },
      {
        q: "How do I get started?",
        a: "Simply schedule an appointment, share your travel details, complete your virtual consultation, and discuss your eligibility for a Fit to Fly Certificate with a healthcare provider.",
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

const Pill = ({ children, ac, onDark = false }) => {
  const textColor = onDark ? "#ffffff" : darken(ac, 0.18);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 14px",
        borderRadius: 100,
        background: onDark ? "rgba(255,255,255,0.15)" : `${ac}12`,
        color: textColor,
        border: onDark
          ? "1px solid rgba(255,255,255,0.35)"
          : `1px solid ${ac}30`,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        marginBottom: 22,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: onDark ? "#ffffff" : ac,
        }}
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
      <img
        src={HERO_IMAGE.src}
        alt={HERO_IMAGE.alt}
        width={HERO_IMAGE.width}
        height={HERO_IMAGE.height}
        loading="eager"
        fetchPriority="high"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
          zIndex: 0,
        }}
      />

      {/* ── Layer 1: Dark overlay for text legibility ───────────────────────
              Adjust rgba alpha:
                0.40 → lighter overlay, more image visible
                0.58 → balanced (default)
                0.70 → darker, maximum text contrast
          ───────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(15, 23, 42, 0.58)",
          zIndex: 1,
        }}
      />
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
          {/* onDark=true → white pill border + text instead of accent tint */}
          <Pill ac={s.accentColor} onDark>
            HumanCare Connect
          </Pill>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18 }}
          style={{
            fontSize: "clamp(36px, 5.5vw, 60px)",
            fontWeight: 900,
            color: "#FFFFFF" /* white on dark overlay */,
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            marginBottom: 18,
            maxWidth: 760,
          }}
        >
          {s.name.split(" ").map((w, i, arr) => (
            <span key={i}>
              {i === Math.floor(arr.length / 2) ? (
                /* Keep accent color on one word — stays readable on dark bg */
                <span
                  style={{
                    color:
                      s.accentColor === "#2563EB" ? "#60A5FA" : s.accentColor,
                  }}
                >
                  {w}{" "}
                </span>
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
            color: "rgba(255,255,255,0.80)" /* was TEXT_DIM */,
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
            color: "rgba(255,255,255,0.88)" /* was TEXT_BODY */,
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
          <PrimaryBtn ac={s.accentColor}>Book Appointment</PrimaryBtn>
          {/* onDark=true → white ghost button style */}
          <GhostBtn onDark>
            Contact Care Team <FiArrowRight />
          </GhostBtn>
        </motion.div>
      </motion.div>
    </section>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
   WHY US ITEMS (static, shared across pages)
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
              What Is a Fit to Fly Certificate?
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
              Getting started is simple.{" "}
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
              Obtaining a Fit to Fly Certificate through Humancare Connect is
              quick, secure, and designed to fit your travel schedule.
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
              Get professional travel health support from licensed healthcare
              providers through secure telemedicine services. Complete your
              assessment online and prepare for your journey with confidence.
            </p>
            <PrimaryBtn ac={s.accentColor} fullWidth>
              <a href="/login">Get Started Today</a>
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
          Understanding Fit to Fly Certificates
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
            A Fit to Fly Certificate is often requested when an airline requires
            confirmation that a passenger can safely travel despite a recent
            illness, injury, surgery, pregnancy-related concern, or ongoing
            medical condition. The purpose of the certificate is to provide
            medical clearance based on an assessment of the traveler's current
            health status and travel plans.
          </p>
          <p
            style={{
              color: TEXT_BODY,
              fontSize: 15,
              lineHeight: 1.75,
              margin: "0 0 18px 0",
            }}
          >
            Through Humancare Connect, travelers can access telemedicine
            services to discuss their health concerns and airline requirements
            with a licensed healthcare provider. During the consultation,
            providers may review medical history, recent treatments,
            medications, symptoms, recovery progress, and travel details to
            determine whether additional precautions or documentation may be
            necessary before travel.
          </p>
          <p
            style={{
              color: TEXT_BODY,
              fontSize: 15,
              lineHeight: 1.75,
              margin: 0,
            }}
          >
            Fit to Fly assessments are commonly requested by travelers
            recovering from surgery, managing chronic health conditions,
            traveling during pregnancy, or returning to travel after a recent
            medical event. By combining convenient online doctor appointments
            with professional medical review, Humancare Connect helps travelers
            access virtual healthcare services that support informed travel
            decisions and help reduce unexpected disruptions before departure.
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
    "Patient-Centred Care",
    "Clinical decisions are made in partnership with you — never without your input.",
  ],
  [
    FiGlobe,
    "Nationwide Access",
    "Care without geographic limits — from metro centres to remote districts.",
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


/* ──────────────────────────────────────────────────────────────────────────
   ANIMATION VARIANTS
────────────────────────────────────────────────────────────────────────── */
// const fadeUp = {
//   hidden: { opacity: 0, y: 24 },
//   visible: (i = 0) => ({
//     opacity: 1,
//     y: 0,
//     transition: {
//       duration: 0.5,
//       delay: i * 0.07,
//       ease: [0.25, 0.46, 0.45, 0.94],
//     },
//   }),
// };



/* ──────────────────────────────────────────────────────────────────────────
   WHY US
────────────────────────────────────────────────────────────────────────── */
const WhyUs = ({ s }) => {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold: 0.2 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} className="sp-section">
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
      >
        <motion.div variants={fadeUp} className="sp-whyus__header">
          <SLabel text="Why Choose Us" />
          <h2 className="sp-whyus__heading">
            Ready to Travel With Confidence?
            {" "}
            {/* <span className="sp-whyus__heading--accent">measure.</span> */}
          </h2>
          <p className="sp-whyus__sub">
            Numbers that represent real patients, real outcomes.
          </p>
        </motion.div>

        <div className="sp-stats">
          {s.stats.map((st, i) => (
            <StatCard
              key={i}
              value={st.value}
              suffix={st.suffix}
              label={st.label}
              go={inView}
            />
          ))}
        </div>

        <div className="sp-whyus-grid">
          {WHY_US_ITEMS.map(([Icon, title, desc], i) => (
            <motion.div key={i} variants={fadeUp} custom={i} className="sp-whyus-card">
              <div className="sp-whyus-card__icon-wrap">
                <Icon className="sp-whyus-card__icon" />
              </div>
              <div>
                <div className="sp-whyus-card__title">{title}</div>
                <div className="sp-whyus-card__desc">{desc}</div>
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
────────────────────────────────────────────────────────────────────────── */
const FAQ = ({ s }) => {
  const [open, setOpen] = useState(null);

  return (
    <section className="sp-section">
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        className="sp-faq__grid"
      >
        {/* Left: intro */}
        <motion.div variants={fadeUp}>
          <SLabel text="FAQ" />
          <h2 className="sp-faq__heading">
            Questions about
            <br />
            <span className="sp-faq__heading--accent">{s.name}?</span>
          </h2>
          <p className="sp-faq__sub">
            We've answered the most common questions below. Our care team is
            one message away if yours isn't listed.
          </p>
        </motion.div>

        {/* Right: accordion */}
        <motion.div variants={fadeUp} className="sp-faq__panel">
          {s.faqs.map((faq, i) => (
            <div
              key={i}
              className="sp-faq__item"
            >
              <button
                className="sp-faq__trigger"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
              >
                <span className="sp-faq__question">{faq.q}</span>
                <div
                  className={
                    open === i
                      ? "sp-faq__toggle sp-faq__toggle--open"
                      : "sp-faq__toggle sp-faq__toggle--closed"
                  }
                >
                  <FiPlus
                    className={
                      open === i
                        ? "sp-faq__toggle-icon--open"
                        : "sp-faq__toggle-icon--closed"
                    }
                  />
                </div>
              </button>

              <AnimatePresence>
                {open === i && (
                  <motion.div
                    className="sp-faq__answer"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.26 }}
                  >
                    <div className="sp-faq__answer-body">{faq.a}</div>
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
────────────────────────────────────────────────────────────────────────── */
const FinalCTA = () => (
  <section className="sp-section">
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6 }}
      className="sp-cta"
    >
      <Pill>Start Today</Pill>
      <h2 className="sp-cta__heading">
        Ready to Travel With Confidence?

        <br />
        <span className="sp-cta__heading--accent">Travel smarter with convenient virtual healthcare services designed around your schedule.
        </span>
      </h2>
      <p className="sp-cta__body">
        Whether you're preparing for an upcoming flight, recovering from a recent medical condition, or need documentation for airline requirements, Humancare Connect makes it simple to access professional travel health support.
        Connect with a licensed healthcare provider through secure telemedicine services, complete your Fit to Fly assessment online, and receive medical clearance documentation when clinically appropriate.
      </p>

      <div className="sp-cta__actions">
        <PrimaryBtn href="/login">Get Started</PrimaryBtn>
        <GhostBtn href="/appointment-booking">Book Appointment</GhostBtn>
        {/* <a href="/contact" className="sp-btn sp-btn--muted">
          Contact Us
        </a> */}
      </div>

      <div className="sp-cta__trust">
        {[
          [FiLock, "HIPAA Compliant"],
          [FiStar, "4.9/5 Rated"],
          [FiShield, "Verified Providers"],
          [FiFileText, "All Insurances"],
          [FiClock, "24/7 Access"],
        ].map(([Icon, lb], i) => (
          <div key={i} className="sp-trust-item">
            <Icon className="sp-trust-item__icon" />
            {lb}
          </div>
        ))}
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
          Ready to Travel
          <br />
          <span style={{ color: s.accentColor }}>With Confidence?</span>
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
          Whether you're preparing for an upcoming flight, recovering from a
          recent medical condition, or need documentation for airline
          requirements, Humancare Connect makes it simple to access professional
          travel health support.
          <br />
          <br />
          Connect with a licensed healthcare provider through secure
          telemedicine services, complete your Fit to Fly assessment online, and
          receive medical clearance documentation when clinically appropriate.
          <br />
          <br />
          Travel smarter with convenient virtual healthcare services designed
          around your schedule.
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
              Book Your Fit to Fly Assessment Today
            </a>
          </GhostBtn>
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
      </div>
    </motion.div>
  </section>
);

/* ──────────────────────────────────────────────────────────────────────────
   ROOT COMPONENT
   Sets --accent CSS custom property on the root element so every
   color-mix() reference in the shared CSS resolves to the correct hue.
────────────────────────────────────────────────────────────────────────── */
export default function FittoFly() {
  const [slug] = useState("telehealth-services");
  const s = SERVICES[slug] || SERVICES["telehealth-services"];

  /* Inject the per-page accent color as a CSS variable */
  useEffect(() => {
    document.documentElement.style.setProperty("--accent", s.accentColor);
    return () => {
      document.documentElement.style.removeProperty("--accent");
    };
  }, [s.accentColor]);

  return (
    <>
      <Helmet>
        <title>
          Fit to Fly Certificate Online | Medical Clearance for Air Travel |
          Humancare Connect
        </title>
        <meta
          name="description"
          content="Need a Fit to Fly Certificate? Connect with a licensed healthcare provider online for travel health assessments and medical clearance documentation when clinically appropriate."
        />
      </Helmet>

      <div className="sp-page">
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
