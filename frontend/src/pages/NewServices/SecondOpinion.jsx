import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import ServiceContact from "./ServiceContact";

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
  FiClipboard,
} from "react-icons/fi";

import { Helmet } from "react-helmet-async";
import SEO from "../../components/Seo";

import heroBanner from "../../assets/MedicalServices/chronic-care-management-telemedicine.webp";
import ServiceBookingCard from "../../components/booking/ServiceBookingCard";
import "../Specialty/SpecialtyPage.css";
import "../Categories/categoriesGlobal.css";
import { useServicePrice } from "../../hooks/useServicePrice";

const HERO_IMAGE = {
  src: heroBanner,
  alt: "Licensed healthcare provider conducting a virtual chronic care management consultation with a patient through telemedicine.",
  width: 1920,
  height: 700,
};

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
    slug: "online-second-medical-opinion",
    name: "ONLINE SECOND MEDICAL OPINION",
    serviceName: "Online Second Medical Opinion", // must exactly match ServicePrice.name in admin
    tagline:
      "Get trusted guidance before making important healthcare decisions.",
    intro:
      "Connect with qualified specialists through secure telemedicine services for a comprehensive second medical opinion. Whether you've received a new diagnosis, are considering surgery, reviewing a cancer treatment plan, or managing a complex medical condition, our specialists carefully evaluate your medical records and provide personalized recommendations to help you move forward with confidence.",
    accentColor: "#2563EB",
    accentGlow: "#2563EB20",
    heroIcon: FiMonitor,
    heroEmoji: "🖥️",
    description:
      "An online second medical opinion gives you the opportunity to have your diagnosis, treatment plan, or recommended procedure reviewed by a qualified specialist through secure telemedicine services. At Humancare Connect, our Second Medical Opinion Service helps you gain greater clarity about your health by providing an independent evaluation of your medical records, diagnostic reports, imaging, pathology findings, and treatment recommendations. Whether you're facing a new diagnosis, considering surgery, managing a complex medical condition, or exploring cancer treatment options, our specialists help you make informed healthcare decisions with confidence from wherever you are.",
    whyItMatters:
      "Making important healthcare decisions can feel overwhelming, especially when you're diagnosed with a serious or complex medical condition. A second medical opinion can help confirm your diagnosis, identify additional treatment options, and provide reassurance before moving forward with surgery, ongoing treatment, or long-term care. Having expert guidance gives you the confidence to choose the care that's right for you.",
    whoBenefits: [
      " Patients who want to confirm a diagnosis before starting treatment",
      " Individuals considering surgery or other major medical procedures",
      "Patients seeking a second opinion for cancer diagnosis or treatment plans",
      "People managing complex, rare, or chronic medical conditions",
      "Individuals looking for additional treatment options before making healthcare decisions",
      " Anyone who wants greater confidence and clarity about their medical care",
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
        title: "Share Your Health Information",
        body: "Tell us about your condition, medical history, medications, symptoms, and healthcare goals through our secure intake process.",
      },
      {
        Icon: FiFileText,
        title: "Connect With a Healthcare Provider",
        body: "Meet with a licensed healthcare provider who will review your health status and discuss your ongoing care needs.",
      },
      {
        Icon: FiVideo,
        title: "Develop a Personalized Care Plan",
        body: "Receive recommendations for symptom management, medication adherence, lifestyle adjustments, and ongoing monitoring.",
      },
      {
        Icon: FiPackage,
        title: "Stay Connected With Ongoing Support",
        body: "Schedule follow up appointments to review progress, address concerns, and make adjustments to your care plan when needed.",
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

    // stats: [
    //   { value: 120000, suffix: "+", label: "Patients Served" },
    //   { value: 2800, suffix: "+", label: "Verified Providers" },
    //   { value: 98, suffix: "%", label: "Satisfaction Rate" },
    //   { value: 14, suffix: " min", label: "Avg. Wait Time" },
    // ],
    faqs: [
      {
        q: "What is a second medical opinion?",
        a: "A second medical opinion is an independent evaluation of your diagnosis, treatment plan, or recommended procedure by another qualified specialist. It helps you better understand your condition and make informed healthcare decisions.",
      },
      {
        q: "When should I get a second medical opinion?",
        a: "You may benefit from a second medical opinion if you've received a new diagnosis, are considering surgery, have a complex medical condition, or want to explore additional treatment options.",
      },
      {
        q: "What conditions can be reviewed through this service?",
        a: "Our Second Medical Opinion Service supports patients with cancer diagnoses, chronic illnesses, neurological disorders, cardiovascular conditions, orthopedic concerns, gastrointestinal conditions, rare diseases, and other complex medical cases.",
      },
      {
        q: "Can I get a second medical opinion online?",
        a: "Yes. Humancare Connect offers secure telemedicine services, allowing you to connect with qualified specialists through virtual consultations from wherever you are.",
      },
      {
        q: "What medical records do I need to provide?",
        a: "You may be asked to upload medical records, diagnostic reports, imaging studies, pathology reports, laboratory results, physician notes, and your current treatment plan for review.",
      },
      {
        q: "Will the specialist review my treatment plan?",
        a: "Yes. Your specialist will review your diagnosis, current treatment recommendations, and available treatment options to provide personalized guidance based on your medical information.",
      },
      {
        q: "Can I request a second opinion before surgery?",
        a: "Absolutely. Many patients seek a second medical opinion before elective or major surgery to better understand the procedure, potential benefits, risks, and available alternatives.",
      },
      {
        q: "Is a second medical opinion helpful for cancer treatment?",
        a: "Yes. A second medical opinion can help confirm a cancer diagnosis, review pathology findings, evaluate treatment options, and provide additional guidance before beginning treatment.",
      },
      {
        q: "How long does the second medical opinion process take?",
        a: "The timeline depends on the complexity of your case and how quickly your medical records are available. Our team works to connect you with a qualified specialist as promptly as possible.",
      },
      {
        q: "Will I have a virtual consultation with the specialist?",
        a: "Yes. If appropriate, you'll meet with your specialist through a secure virtual consultation to discuss your diagnosis, review findings, and answer your questions.",
      },
      {
        q: "Is my personal health information secure?",
        a: "Yes. Your medical information is handled through secure telemedicine services and protected using industry-standard privacy and security practices.",
      },
      {
        q: "Can a second medical opinion confirm or change my diagnosis?",
        a: "A second medical opinion may confirm your current diagnosis or provide additional insights that help clarify your condition or identify other treatment options.",
      },
      {
        q: "Do I need a referral to request a second medical opinion?",
        a: "Requirements may vary depending on your insurance plan or healthcare provider. Many patients can request a second medical opinion directly through Humancare Connect.",
      },
      {
        q: "Will my current doctor know that I requested a second opinion?",
        a: "You decide whether to share your second medical opinion with your current healthcare provider. Many physicians support patients seeking additional guidance before making important healthcare decisions.",
      },
      {
        q: "How do I schedule a second medical opinion with Humancare Connect?",
        a: "Simply book an appointment online, securely upload your medical records, and we'll connect you with a qualified specialist for a personalized second medical opinion.",
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
      >
        <div>
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
          ></motion.div>
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
      </motion.div>
    </section>
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
        {/* Text — left column */}
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
              What Is an Online Second Medical Opinion?
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

        {/* Form — right column */}
        <motion.div variants={fadeUp} style={{ position: "sticky", top: 96 }}>
          <ServiceContact s={s} />
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
              Getting a second medical opinion is{" "}
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
              Connect with a qualified specialist through Humancare Connect for
              a secure, convenient, and personalized second medical opinion from
              wherever you are.
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

        {/* Sticky card */}
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
              Ready for a second opinion?
            </h3>
            <p
              style={{
                color: TEXT_DIM,
                fontSize: 14,
                lineHeight: 1.7,
                marginBottom: 24,
              }}
            >
              Get trusted guidance from qualified specialists through secure
              telemedicine services. Whether you're reviewing a diagnosis,
              considering surgery, or exploring treatment options, we're here to
              help you make informed healthcare decisions with confidence.
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
                [FiFileText, "No Insurance Required"],
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
        {/* Fix: pass center so the divider+label row is actually centered
            under this centered heading block, instead of hugging the left
            edge of the 560px box (see SLabel comment above). */}
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
          <span style={{ color: s.accentColor }}>Second Medical Opinions</span>
        </h2>
        <p style={{ color: TEXT_DIM, fontSize: 15 }}>
          Get trusted guidance before making important healthcare decisions.
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
            A second medical opinion gives you the opportunity to have your
            diagnosis, treatment plan, or recommended procedure independently
            reviewed by a qualified specialist through secure telemedicine
            services. At Humancare Connect, our Second Medical Opinion Service
            helps patients better understand their health by providing expert
            guidance before moving forward with treatment, surgery, or long-term
            care.
          </p>
          <p
            style={{
              color: TEXT_BODY,
              fontSize: 15,
              lineHeight: 1.75,
              margin: "0 0 18px 0",
            }}
          >
            Whether you've recently been diagnosed with a serious medical
            condition, are evaluating cancer treatment options, managing a
            chronic illness, or considering surgery, a second medical opinion
            can provide valuable insight and reassurance. Our specialists
            carefully review your medical records, diagnostic reports, imaging
            studies, pathology findings, and current treatment recommendations
            to offer personalized guidance based on your individual healthcare
            needs.
          </p>
          <p
            style={{
              color: TEXT_BODY,
              fontSize: 15,
              lineHeight: 1.75,
              margin: 0,
            }}
          >
            Many patients seek a second medical opinion to confirm a diagnosis,
            explore alternative treatment options, or gain greater confidence
            before making significant healthcare decisions. Through secure
            virtual consultations, Humancare Connect makes it convenient to
            connect with qualified specialists from wherever you are, helping
            you make informed decisions with clarity, confidence, and peace of
            mind.
          </p>
        </div>
      </motion.div>
    </motion.div>
  </section>
);

/* ──────────────────────────────────────────────────────────────────────────
   STATS / WHY US
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
    FiUserCheck,
    "Qualified Specialists",
    "Connect with qualified specialists who carefully review your diagnosis, medical records, treatment recommendations, and healthcare concerns to provide trusted, personalized guidance.",
  ],
  [
    FiFileText,
    "Personalized Second Opinions",
    "Every second medical opinion is tailored to your medical history, current condition, diagnostic findings, and treatment goals, helping you make informed healthcare decisions.",
  ],
  [
    FiShield,
    "Secure Virtual Consultations",
    "Receive expert guidance through secure, HIPAA-compliant telemedicine services, allowing you to connect with specialists from the comfort of your home.",
  ],
  [
    FiZap,
    "Fast Appointment Scheduling",
    "Get timely access to second medical opinions when important healthcare decisions can't wait, helping you move forward with greater confidence.",
  ],
  [
    FiClipboard,
    "Comprehensive Medical Record Review",
    "Our specialists review diagnostic reports, imaging studies, pathology results, laboratory findings, and treatment plans to provide a thorough and independent evaluation.",
  ],
  [
    FiGlobe,
    "Convenient Access to Care",
    "Whether you're seeking a second opinion before surgery, reviewing a cancer diagnosis, or exploring treatment options for a complex medical condition, you can access expert guidance from anywhere through Humancare Connect.",
  ],
];

const WhyUs = ({ s }) => {
  // numbers are actually visible.
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
          {/* Fix: centered label row (see SLabel + Features fix above). */}
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
            Healthcare decisions{" "}
            <span style={{ color: s.accentColor }}>
              deserve expert guidance.
            </span>
          </h2>
          <p style={{ color: TEXT_DIM, fontSize: 15 }}>
            Trusted second medical opinions from qualified specialists,
            delivered with confidence.{" "}
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
          {/* {s.stats.map((st, i) => (
            <StatCard
              key={i}
              value={st.value}
              suffix={st.suffix}
              label={st.label}
              ac={s.accentColor}
              go={inView}
            />
          ))} */}
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
   RELATED SERVICES
────────────────────────────────────────────────────────────────────────── */
const relatedServicesItems = [
  {
    Icon: FiActivity,
    title: "Cancer Second Opinion",
    desc: "Receive an independent review of your cancer diagnosis, pathology reports, treatment recommendations, and care plan to help you make informed decisions about your cancer treatment.",
    href: "/online-second-medical-opinion/cancer-second-opinion",
    linkLabel: "Explore More",
  },
  {
    Icon: FiSearch,
    title: "Complex Diagnosis Review",
    desc: "Get expert evaluation for difficult-to-diagnose conditions, unresolved symptoms, or rare medical disorders when you need additional clinical insight.",
    href: "/online-second-medical-opinion/complex-diagnosis-review",
    linkLabel: "Explore More",
  },
  {
    Icon: FiUserCheck,
    title: "Surgery Second Opinion",
    desc: "Understand your surgical options with an independent review of recommended procedures, potential risks, expected outcomes, and alternative treatment approaches.",
    href: "/online-second-medical-opinion/surgery-second-opinion",
    linkLabel: "Explore More",
  },
  {
    Icon: FiFileText,
    title: "Treatment Plan Review",
    desc: "Have your current treatment plan reviewed by a qualified specialist to ensure you understand your available options and next steps.",
    href: "/online-second-medical-opinion/treatment-plan-review",
    linkLabel: "Explore More",
  },
];

const RelatedServices = ({ s, bp }) => {
  // Responsive column count: 1 col on phones, 2 on tablets, 4 on desktop.
  const cols = bp?.isMobile ? 1 : bp?.isTablet ? 2 : 4;

  return (
    <section
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: bp?.isMobile ? "56px 20px" : "88px 24px",
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
          style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 44px" }}
        >
          <SLabel text="Related Services" ac={s.accentColor} center />
          <h2
            style={{
              fontSize: "clamp(26px, 3.5vw, 36px)",
              fontWeight: 900,
              color: TEXT_PRIMARY,
              lineHeight: 1.15,
              marginBottom: 10,
            }}
          >
            Explore More{" "}
            <span style={{ color: s.accentColor }}>
              Second Opinion Services
            </span>
          </h2>
          <p style={{ color: TEXT_DIM, fontSize: 15, lineHeight: 1.7 }}>
            Every healthcare decision is unique. In addition to our Second
            Medical Opinion Service, Humancare Connect offers specialized second
            opinion services for complex diagnoses, cancer care, surgery
            recommendations, and treatment plan reviews. Connect with qualified
            specialists to gain expert guidance tailored to your healthcare
            needs.
          </p>
        </motion.div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: bp?.isMobile ? 14 : 16,
          }}
        >
          {relatedServicesItems.map(
            ({ Icon, title, desc, href, linkLabel }, i) => (
              <motion.a
                key={i}
                href={href}
                variants={fadeUp}
                custom={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: bp?.isMobile ? 20 : 24,
                  borderRadius: 18,
                  background: "#fff",
                  border: `1px solid ${BORDER}`,
                  transition:
                    "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
                  textDecoration: "none",
                  color: "inherit",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `${s.accentColor}55`;
                  e.currentTarget.style.boxShadow = `0 8px 24px ${s.accentColor}18`;
                  e.currentTarget.style.transform = "translateY(-3px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = BORDER;
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: `${s.accentColor}12`,
                    marginBottom: 16,
                    flexShrink: 0,
                  }}
                >
                  <Icon style={{ fontSize: 18, color: s.accentColor }} />
                </div>
                <div
                  style={{
                    color: TEXT_PRIMARY,
                    fontWeight: 700,
                    fontSize: 15,
                    marginBottom: 8,
                  }}
                >
                  {title}
                </div>
                <p
                  style={{
                    color: TEXT_DIM,
                    fontSize: 13,
                    lineHeight: 1.65,
                    marginBottom: 18,
                    flex: 1,
                  }}
                >
                  {desc}
                </p>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    color: s.accentColor,
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  {linkLabel} <FiArrowRight style={{ fontSize: 14 }} />
                </span>
              </motion.a>
            ),
          )}
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
        <Pill ac={s.accentColor}>Get Started Today</Pill>
        <h2
          style={{
            fontSize: "clamp(32px, 5vw, 52px)",
            fontWeight: 900,
            color: TEXT_PRIMARY,
            lineHeight: 1.1,
            marginBottom: 14,
          }}
        >
          Ready for a Trusted
          <br />
          <span style={{ color: s.accentColor }}>Second Medical Opinion?</span>
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
          When it comes to your health, confidence matters. Connect with a
          qualified specialist through Humancare Connect to review your
          diagnosis, treatment plan, or recommended procedure. Get expert
          guidance, personalized recommendations, and the clarity you need to
          make informed healthcare decisions from the comfort of your home.
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
            <a href="/appointment-booking">Book Your Second Medical Opinion</a>
          </GhostBtn>
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
            [FiFileText, "No Insurance Required"],
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
export default function SecondOpinion() {
  const [slug, setSlug] = useState("telehealth-services");
  const s = SERVICES[slug] || SERVICES["telehealth-services"];
  const handleSwitch = useCallback((newSlug) => setSlug(newSlug), []);
  const bp = useBreakpoint();
  const { price, priceLoading } = useServicePrice(s.slug);

  return (
    <>
      <SEO
        title="Online Second Medical Opinion | Qualified Specialists"
        description="Get a trusted online second medical opinion from qualified specialists. Review your diagnosis, treatment plan, surgery recommendations, and cancer care securely."
        // keywords="Chronic care management, Chronic health conditions, Telemedicine services, Virtual healthcare services, Telehealth services, Virtual chronic care management"
        url="https://humancareconnect.co/online-second-medical-opinion"
      />
      <Helmet>
        <title>
          Chronic Care Management Online | Ongoing Healthcare Support |
          Humancare Connect
        </title>
        <meta
          name="description"
          content="Manage chronic health conditions through secure telemedicine services. Connect with licensed healthcare providers for ongoing care, monitoring, and personalized support."
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
            <Hero s={s} price={price} priceLoading={priceLoading} />
            <Overview s={s} />
            <HowItWorks s={s} />
            <Features s={s} />
            <WhyUs s={s} />
            <RelatedServices s={s} bp={bp} />
            <FAQ s={s} />
            <FinalCTA s={s} />
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
