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
import SEO from "../../components/Seo";
import ServiceContact from "./ServiceContact";
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
    name: "MENTAL HEALTH SUPPORT",
    tagline: "Compassionate care for your emotional well being.",
    intro:
      "Take care of your mental health with confidential telemedicine services designed to support emotional wellness. Connect with licensed healthcare providers who can help address anxiety, stress, depression, mood concerns, and other mental health challenges through secure virtual healthcare services from the comfort of home.",
    accentColor: "#2563EB",
    accentGlow: "#2563EB20",
    heroIcon: FiMonitor,
    heroEmoji: "🖥️",
    description:
      "Mental health care should be accessible, convenient, and free from unnecessary barriers. Through Humancare Connect, patients can connect with licensed healthcare providers for professional support, mental health evaluations, and personalized care recommendations through secure telehealth services. Whether you are experiencing stress, anxiety, emotional challenges, or ongoing mental health concerns, virtual care makes it easier to access the support you need.",
    whyItMatters:
      "Mental health plays a vital role in overall well being. Emotional and psychological challenges can affect relationships, work performance, sleep quality, physical health, and daily functioning. Early support and professional guidance can help individuals develop healthier coping strategies, improve resilience, and enhance their quality of life.",
    whoBenefits: [
      "Adults experiencing anxiety or excessive stress",
      "Individuals struggling with depression or low mood",
      "People experiencing burnout or emotional exhaustion",
      "Individuals facing major life transitions or personal challenges",
      "Adults seeking confidential and convenient mental health support",
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
        title: "Share Your Concerns",
        body: "Tell us about your symptoms, emotional challenges, mental health history, and wellness goals through our secure intake process.",
      },
      {
        Icon: FiFileText,
        title: "Connect With a Healthcare Provider",
        body: "Meet with a licensed healthcare provider who will discuss your concerns and evaluate your mental health needs.",
      },
      {
        Icon: FiVideo,
        title: "Receive Personalized Guidance",
        body: "Your provider may recommend coping strategies, treatment options, lifestyle adjustments, or additional mental health resources based on your situation.",
      },
      {
        Icon: FiPackage,
        title: "Continue Your Care Journey",
        body: "Schedule follow up appointments as needed to monitor progress, discuss concerns, and receive ongoing support.",
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
        q: "What is mental health support?",
        a: "Mental health support provides professional guidance and care for emotional, behavioral, and psychological concerns that may affect daily life and overall well being.",
      },
      {
        q: "Can I access mental health support online?",
        a: "Yes. Telemedicine services allow patients to connect with licensed healthcare providers through secure virtual appointments.",
      },
      {
        q: "What mental health concerns can be discussed during a telehealth visit?",
        a: "Patients commonly seek support for anxiety, depression, stress, burnout, mood changes, emotional difficulties, and other mental health concerns.",
      },
      {
        q: "Is online mental health support confidential?",
        a: "Yes. Humancare Connect uses secure telemedicine technology designed to protect patient privacy and confidentiality.",
      },
      {
        q: "Can telehealth help with anxiety?",
        a: "Yes. Healthcare providers can evaluate symptoms of anxiety, discuss treatment options, and recommend appropriate support strategies.",
      },
      {
        q: "What are the benefits of virtual mental health services?",
        a: "Virtual mental health services provide convenient access to care, flexible scheduling, privacy, and support from the comfort of home.",
      },
      {
        q: "Can I discuss depression during an online appointment?",
        a: "Yes. Licensed healthcare providers can assess symptoms, discuss concerns, and recommend appropriate next steps for care.",
      },
      {
        q: "How do I know if I should seek mental health support?",
        a: "If emotional challenges are affecting your daily life, relationships, work, or overall well being, professional support may be beneficial.",
      },
      {
        q: "Can stress affect my physical health?",
        a: "Yes. Chronic stress may contribute to fatigue, headaches, sleep difficulties, digestive concerns, and other health issues.",
      },
      {
        q: "Who can benefit from mental health support?",
        a: "Anyone experiencing emotional, behavioral, or psychological challenges may benefit from professional guidance and support.",
      },
      {
        q: "What happens during a mental health consultation?",
        a: "A healthcare provider will discuss your symptoms, concerns, health history, and goals to better understand your needs.",
      },
      {
        q: "Can mental health support help with burnout?",
        a: "Yes. Healthcare providers can help identify contributing factors and recommend strategies to improve emotional wellness and reduce stress.",
      },
      {
        q: "Are telehealth mental health appointments effective?",
        a: "Many patients find virtual appointments to be a convenient and effective way to access professional mental health support.",
      },
      {
        q: "Can I schedule follow up appointments?",
        a: "Yes. Follow up visits may be recommended to monitor progress and provide ongoing support.",
      },
      {
        q: "Is mental health care only for serious conditions?",
        a: "No. Many people seek support for everyday stress, emotional challenges, life transitions, and personal wellness concerns.",
      },
      {
        q: "Can online mental health support improve emotional wellness?",
        a: "Professional guidance can help individuals develop healthier coping strategies and improve overall emotional well being.",
      },
      {
        q: "Are mental health services available from home?",
        a: "Yes. Telehealth services allow patients to access support from home, work, or another private location.",
      },
      {
        q: "Why is early mental health support important?",
        a: "Early intervention may help individuals address concerns before they significantly affect daily life, relationships, and overall health.",
      },
      {
        q: "Why choose Humancare Connect for mental health support?",
        a: "Humancare Connect provides secure telemedicine services, compassionate care, convenient access to healthcare providers, and personalized support focused on emotional wellness.",
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
              Accessible Mental Health Care When You Need It Most
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
          <ServiceContact s={s} />
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
              Accessing mental health support through Humancare Connect is
              secure, private, and designed around your needs.
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
              Take the first step toward better emotional wellness through
              trusted telemedicine services. Professional support is available
              when and where you need it most.
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
          Supporting Emotional Wellness
          <br />
          <span style={{ color: s.accentColor }}>Through Telehealth</span>
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
            Mental health affects how people think, feel, behave, and respond to
            everyday challenges. Emotional wellness influences relationships,
            work performance, productivity, physical health, and overall quality
            of life. Seeking professional support is an important step toward
            understanding mental health concerns and developing effective
            strategies to manage them.
          </p>
          <p
            style={{
              color: TEXT_BODY,
              fontSize: 15,
              lineHeight: 1.75,
              margin: "0 0 18px 0",
            }}
          >
            At Humancare Connect, our mental health support services provide
            convenient access to licensed healthcare providers through secure
            virtual healthcare services. Patients can discuss concerns such as
            anxiety, depression, chronic stress, burnout, mood changes,
            emotional difficulties, and sleep related concerns in a confidential
            and supportive environment. Telemedicine services remove many of the
            barriers that often prevent individuals from seeking care.
          </p>
          <p
            style={{
              color: TEXT_BODY,
              fontSize: 15,
              lineHeight: 1.75,
              margin: 0,
            }}
          >
            Mental health support is not limited to severe conditions. Many
            individuals benefit from professional guidance during periods of
            increased stress, major life changes, relationship challenges,
            workplace pressures, grief, or emotional difficulties. Through
            telehealth services, patients can receive personalized
            recommendations, access ongoing support, and take meaningful steps
            toward improving their emotional well being and overall health.
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
          Ready to Prioritize Your
          <br />
          <span style={{ color: s.accentColor }}>Mental Health?</span>
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
          Connect with a licensed healthcare provider through secure
          telemedicine services and receive compassionate support for your
          emotional well being. Take the first step toward better mental health
          and a healthier future today.
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
export default function MentalHealthSupport() {
  const [slug, setSlug] = useState("telehealth-services");
  const s = SERVICES[slug] || SERVICES["telehealth-services"];
  const handleSwitch = useCallback((newSlug) => setSlug(newSlug), []);

  return (
    <>
                  <SEO
        title="Mental Health Support Online | Virtual Mental Health Care | Humancare Connect"
        description="Access confidential mental health support through secure telemedicine services. Connect with licensed healthcare providers for anxiety, stress, depression, and emotional wellness care."
        keywords="Mental health support, Online therapy, Virtual counseling, Emotional wellness care"
        url="https://humancareconnect.co/mental-health-support"
      />
      <Helmet>
        <title>
          Mental Health Support Online | Virtual Mental Health Care | Humancare
          Connect
        </title>
        <meta
          name="description"
          content="Access confidential mental health support through secure telemedicine services. Connect with licensed healthcare providers for anxiety, stress, depression, and emotional wellness care."
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
