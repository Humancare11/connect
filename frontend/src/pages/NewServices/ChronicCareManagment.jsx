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

/* ──────────────────────────────────────────────────────────────────────────
   DATA — one entry per service slug
────────────────────────────────────────────────────────────────────────── */
const SERVICES = {
  "telehealth-services": {
    slug: "chronic-care-management",
    name: "CHRONIC CARE MANAGEMENT",
    tagline: "Ongoing support for long term health conditions.",
    intro:
      "Manage chronic health conditions with personalized telemedicine services designed to support your long term health and well being. Connect with licensed healthcare providers who can help monitor symptoms, review treatment plans, manage medications, and provide ongoing healthcare guidance from the comfort of home.",
    accentColor: "#2563EB",
    heroIcon: FiMonitor,
    description:
      "Chronic care management focuses on helping patients effectively manage ongoing medical conditions through regular monitoring, personalized treatment plans, and continuous healthcare support. Through Humancare Connect, patients can access convenient virtual healthcare services that promote better health outcomes and improved quality of life.",
    whyItMatters:
      "Chronic conditions often require ongoing medical attention and long term management. Regular follow up care, medication management, and professional guidance can help reduce complications, improve symptom control, and support overall wellness. Consistent care plays an important role in helping patients stay healthy and maintain their daily activities.",
    whoBenefits: [
      "Individuals living with chronic health conditions",
      "Patients managing diabetes or high blood pressure",
      "Adults with asthma, COPD, or respiratory conditions",
      "Individuals with heart disease or high cholesterol",
      "Patients seeking ongoing healthcare support and monitoring",
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
    stats: [
      { value: 120000, suffix: "+", label: "Patients Served" },
      { value: 2800, suffix: "+", label: "Verified Providers" },
      { value: 98, suffix: "%", label: "Satisfaction Rate" },
      { value: 14, suffix: " min", label: "Avg. Wait Time" },
    ],
    faqs: [
      {
        q: "What is chronic care management?",
        a: "Chronic care management is an ongoing healthcare service designed to help patients manage long term medical conditions through regular monitoring, treatment planning, and professional support.",
      },
      {
        q: "What conditions can be managed through chronic care services?",
        a: "Common conditions include diabetes, high blood pressure, asthma, COPD, heart disease, arthritis, high cholesterol, and other long term health concerns.",
      },
      {
        q: "Can chronic care management be provided through telehealth?",
        a: "Yes. Telemedicine services allow patients to connect with healthcare providers remotely for ongoing support and monitoring.",
      },
      {
        q: "Why is chronic care management important?",
        a: "Regular care and monitoring can help improve symptom control, reduce complications, and support better long term health outcomes.",
      },
      {
        q: "How often should I schedule follow up visits?",
        a: "The frequency of follow up appointments depends on your condition, treatment plan, and healthcare provider's recommendations.",
      },
      {
        q: "Can chronic care management help prevent complications?",
        a: "Yes. Ongoing monitoring and professional guidance can help identify potential issues early and support preventive care.",
      },
      {
        q: "What are the benefits of virtual chronic care management?",
        a: "Virtual care offers convenient access to healthcare providers, flexible scheduling, and ongoing support from home.",
      },
      {
        q: "Can healthcare providers monitor my progress remotely?",
        a: "Yes. Providers can review symptoms, treatment progress, medication adherence, and health goals during follow up visits.",
      },
      {
        q: "Is chronic care management suitable for diabetes?",
        a: "Yes. Diabetes management is one of the most common conditions supported through chronic care services.",
      },
      {
        q: "Can telehealth help manage high blood pressure?",
        a: "Yes. Healthcare providers can review blood pressure readings, discuss treatment plans, and provide ongoing support.",
      },
      {
        q: "What role does medication management play in chronic care?",
        a: "Medication management helps ensure treatments remain effective, safe, and aligned with your healthcare needs.",
      },
      {
        q: "Can chronic care services improve quality of life?",
        a: "Yes. Consistent healthcare support can help patients manage symptoms and maintain greater independence in daily life.",
      },
      {
        q: "What happens during a chronic care consultation?",
        a: "A healthcare provider reviews your symptoms, treatment plan, medications, health goals, and overall condition management.",
      },
      {
        q: "Can lifestyle changes help manage chronic conditions?",
        a: "Yes. Nutrition, physical activity, sleep habits, and stress management can play an important role in overall health.",
      },
      {
        q: "Is chronic care management only for older adults?",
        a: "No. Adults of all ages living with chronic health conditions may benefit from ongoing healthcare support.",
      },
      {
        q: "Can I discuss multiple chronic conditions during one appointment?",
        a: "Yes. Healthcare providers can review and manage multiple health concerns during a consultation.",
      },
      {
        q: "Are virtual chronic care appointments secure?",
        a: "Yes. Humancare Connect uses secure telemedicine technology designed to protect patient information and privacy.",
      },
      {
        q: "How do I get started with chronic care management?",
        a: "Schedule an appointment, discuss your condition with a healthcare provider, and receive a personalized care plan.",
      },
      {
        q: "Why choose Humancare Connect for chronic care management?",
        a: "Humancare Connect provides secure telemedicine services, licensed healthcare providers, personalized care plans, and convenient access to ongoing healthcare support.",
      },
    ],
  },
};

/* ──────────────────────────────────────────────────────────────────────────
   WHY US ITEMS (static, shared across pages)
────────────────────────────────────────────────────────────────────────── */
const WHY_US_ITEMS = [
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
   HOOKS
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

/* ──────────────────────────────────────────────────────────────────────────
   ANIMATION VARIANTS
────────────────────────────────────────────────────────────────────────── */
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

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

/* ──────────────────────────────────────────────────────────────────────────
   MICRO COMPONENTS
────────────────────────────────────────────────────────────────────────── */

/** Eyebrow label with accent line */
const SLabel = ({ text }) => (
  <div className="sp-label">
    <div className="sp-label__line" />
    <span className="sp-label__text">{text}</span>
  </div>
);

/** Accent pill badge */
const Pill = ({ children }) => (
  <div className="sp-pill">
    <span className="sp-pill__dot" />
    {children}
  </div>
);

/** Primary filled button — wraps an anchor when href is provided */
const PrimaryBtn = ({ children, href, fullWidth, type = "button", onClick }) => {
  const cls = ["sp-btn sp-btn--primary", fullWidth ? "sp-btn--full" : ""].join(" ").trim();
  if (href) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} className={cls} onClick={onClick}>
      {children}
    </button>
  );
};

/** Ghost / outlined button */
const GhostBtn = ({ children, href, onClick }) => {
  if (href) {
    return (
      <a href={href} className="sp-btn sp-btn--ghost">
        {children}
      </a>
    );
  }
  return (
    <button className="sp-btn sp-btn--ghost" onClick={onClick}>
      {children}
    </button>
  );
};

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

  const words = s.name.split(" ");
  const midIdx = Math.floor(words.length / 2);

  return (
    <section className="sp-hero" ref={ref}>
      <motion.div className="sp-hero__inner" style={{ opacity: op }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
        >
          <Pill>HumanCare Connect</Pill>
        </motion.div>

        <motion.h1
          className="sp-hero__heading"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18 }}
        >
          {words.map((w, i) =>
            i === midIdx ? (
              <span key={i} className="sp-hero__heading--accent">{w} </span>
            ) : (
              <span key={i}>{w} </span>
            )
          )}
        </motion.h1>

        <motion.p
          className="sp-hero__tagline"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.26 }}
        >
          {s.tagline}
        </motion.p>

        <motion.p
          className="sp-hero__intro"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.32 }}
        >
          {s.intro}
        </motion.p>

        <motion.div
          className="sp-hero__actions"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.38 }}
        >
          <PrimaryBtn href="/appointment-booking">Book Appointment</PrimaryBtn>
        </motion.div>
      </motion.div>
    </section>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
   CONSULTATION FORM
────────────────────────────────────────────────────────────────────────── */
const ConsultationForm = () => {
  const [values, setValues] = useState({ name: "", email: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field) => (e) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="sp-consult">
        <div className="sp-consult__success">
          <div className="sp-consult__success-icon-wrap">
            <FiCheckCircle className="sp-consult__success-icon" />
          </div>
          <h3 className="sp-consult__success-heading">Request received</h3>
          <p className="sp-consult__success-body">
            A member of our care team will reach out to{" "}
            {values.email || "you"} shortly.
          </p>
          <button
            className="sp-consult__reset-btn"
            onClick={() => {
              setSubmitted(false);
              setValues({ name: "", email: "", message: "" });
            }}
          >
            Send another request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sp-consult">
      <div className="sp-consult__icon-wrap">
        <FiMessageSquare className="sp-consult__icon" />
      </div>
      <h3 className="sp-consult__heading">Request a Consultation</h3>
      <p className="sp-consult__sub">
        Tell us a little about what you need, and a care coordinator will
        follow up within one business day.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="sp-form__group">
          <label className="sp-form__label" htmlFor="consult-name">
            Full name
          </label>
          <input
            id="consult-name"
            type="text"
            required
            placeholder="Jordan Lee"
            value={values.name}
            onChange={handleChange("name")}
            className="sp-form__input"
          />
        </div>

        <div className="sp-form__group">
          <label className="sp-form__label" htmlFor="consult-email">
            Email address
          </label>
          <input
            id="consult-email"
            type="email"
            required
            placeholder="jordan@email.com"
            value={values.email}
            onChange={handleChange("email")}
            className="sp-form__input"
          />
        </div>

        <div className="sp-form__group">
          <label className="sp-form__label" htmlFor="consult-message">
            What can we help with?
          </label>
          <textarea
            id="consult-message"
            required
            rows={4}
            placeholder="Briefly describe your symptoms or what you'd like to discuss…"
            value={values.message}
            onChange={handleChange("message")}
            className="sp-form__textarea"
          />
        </div>

        <div className="sp-form__submit-wrap">
          <PrimaryBtn type="submit" fullWidth>
            Submit Request
          </PrimaryBtn>
        </div>

        <div className="sp-form__privacy">
          <FiLock className="sp-form__privacy-icon" />
          Your information is encrypted and never shared without consent.
        </div>
      </form>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
   OVERVIEW
────────────────────────────────────────────────────────────────────────── */
const Overview = ({ s }) => (
  <section className="sp-overview">
    <div className="sp-overview__inner">
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        className="sp-overview__grid"
      >
        {/* Left: text */}
        <div>
          <motion.div variants={fadeUp}>
            <SLabel text="Service Overview" />
            <h2 className="sp-overview__heading">
              Comprehensive Care for Long Term Health Conditions
            </h2>
          </motion.div>

          <motion.p variants={fadeUp} className="sp-overview__desc">
            {s.description}
          </motion.p>

          <motion.div variants={fadeUp} className="sp-overview__why">
            <div className="sp-overview__why-label">Why It Matters</div>
            <p className="sp-overview__why-body">{s.whyItMatters}</p>
          </motion.div>

          <motion.div variants={fadeUp}>
            <div className="sp-overview__who-title">Who Can Benefit</div>
            <div className="sp-overview__who-list">
              {s.whoBenefits.map((item, i) => (
                <div key={i} className="sp-overview__who-item">
                  <FiCheckCircle className="sp-overview__who-icon" />
                  {item}
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right: consultation form (sticky) */}
        <motion.div variants={fadeUp} className="sp-form-sticky">
          <ConsultationForm s={s} />
        </motion.div>
      </motion.div>

      {/* Key outcomes strip */}
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="sp-outcomes"
      >
        {s.keyOutcomes.map((o, i) => (
          <motion.div key={i} variants={fadeUp} custom={i} className="sp-outcome-card">
            <div className="sp-outcome-card__dot" />
            <p className="sp-outcome-card__text">{o}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);

/* ──────────────────────────────────────────────────────────────────────────
   HOW IT WORKS / OUR SERVICES
────────────────────────────────────────────────────────────────────────── */
const HowItWorks = ({ s }) => (
  <section className="sp-hiw">
    <div className="sp-hiw__inner">
      {/* Left: steps */}
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
      >
        <motion.div variants={fadeUp}>
          <SLabel text="Our Services" />
          <h2 className="sp-hiw__heading">
            Getting started is{" "}
            <span className="sp-hiw__heading--accent">simple.</span>
          </h2>
          <p className="sp-hiw__sub">
            Accessing chronic care management through Humancare Connect is
            convenient, secure, and designed around your healthcare needs.
          </p>
        </motion.div>

        <div className="sp-steps">
          {s.steps.map((step, i) => (
            <motion.div key={i} variants={fadeUp} custom={i} className="sp-step">
              {i < s.steps.length - 1 && (
                <div className="sp-step__connector" />
              )}
              <div className="sp-step__icon-wrap">
                <step.Icon className="sp-step__icon" />
              </div>
              <div className="sp-step__body">
                <div className="sp-step__num">Step {i + 1}</div>
                <div className="sp-step__title">{step.title}</div>
                <p className="sp-step__desc">{step.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Right: sticky ready card */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <div className="sp-ready-card">
          <s.heroIcon className="sp-ready-card__hero-icon" />
          <h3 className="sp-ready-card__heading">Ready to begin?</h3>
          <p className="sp-ready-card__desc">
            Get convenient access to chronic care management through trusted
            telemedicine services and receive ongoing support from licensed
            healthcare providers.
          </p>
          <PrimaryBtn href="/login" fullWidth>
            Get Started Today
          </PrimaryBtn>
          <div className="sp-ready-card__badges">
            {[
              [FiLock, "Secure & Private"],
              [FiZap, "Fast Response"],
              [FiUserCheck, "Verified Providers"],
              [FiFileText, "Insurance Accepted"],
            ].map(([Icon, lb], i) => (
              <div key={i} className="sp-badge">
                <Icon className="sp-badge__icon" />
                {lb}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  </section>
);

/* ──────────────────────────────────────────────────────────────────────────
   FEATURES & BENEFITS
────────────────────────────────────────────────────────────────────────── */
const Features = ({ s }) => (
  <section className="sp-section">
    <motion.div
      variants={stagger}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
    >
      <motion.div variants={fadeUp} className="sp-features__header">
        <SLabel text="Features & Benefits" />
        <h2 className="sp-features__heading">
          Managing Chronic Conditions
          <br />
          <span className="sp-features__heading--accent">
            Through Virtual Healthcare
          </span>
        </h2>
        <p className="sp-features__sub">
          Every feature is designed around one goal: better outcomes for you.
        </p>
      </motion.div>

      <motion.div variants={fadeUp} className="sp-features__card">
        <div className="sp-features__body">
          <p className="sp-features__para">
            Chronic conditions are long term health concerns that often require
            continuous medical attention, lifestyle adjustments, and regular
            monitoring. Conditions such as diabetes, high blood pressure, heart
            disease, asthma, arthritis, and chronic respiratory disorders can
            significantly impact daily life if not properly managed. Consistent
            healthcare support helps patients maintain better control of their
            symptoms and overall health.
          </p>
          <p className="sp-features__para">
            At Humancare Connect, our chronic care management services provide
            patients with convenient access to licensed healthcare providers
            through secure telehealth services. Providers work closely with
            patients to review treatment plans, monitor symptoms, discuss
            medication management, and identify opportunities to improve health
            outcomes. Virtual healthcare services make it easier to stay
            connected with professional care while reducing the need for
            frequent in person visits.
          </p>
          <p className="sp-features__para">
            Effective chronic care management goes beyond treating symptoms. It
            focuses on helping patients understand their conditions, make
            informed healthcare decisions, maintain healthy lifestyle habits,
            and prevent complications. Through personalized care and ongoing
            support, telemedicine services help patients take a proactive
            approach to managing their long term health.
          </p>
        </div>
      </motion.div>
    </motion.div>
  </section>
);

/* ──────────────────────────────────────────────────────────────────────────
   STAT CARD
────────────────────────────────────────────────────────────────────────── */
const StatCard = ({ value, suffix, label, go }) => {
  const c = useCountUp(value, 2200, go);
  return (
    <motion.div variants={fadeUp} className="sp-stat-card">
      <div className="sp-stat-card__value">
        {c}
        {suffix}
      </div>
      <div className="sp-stat-card__label">{label}</div>
    </motion.div>
  );
};

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
            Results you can{" "}
            <span className="sp-whyus__heading--accent">measure.</span>
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
        Ready to Take Control of
        <br />
        <span className="sp-cta__heading--accent">Your Long Term Health?</span>
      </h2>
      <p className="sp-cta__body">
        Connect with a licensed healthcare provider through secure telemedicine
        services and receive personalized chronic care management designed to
        support your health goals and improve your quality of life.
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
      </div>
    </motion.div>
  </section>
);

/* ──────────────────────────────────────────────────────────────────────────
   ROOT COMPONENT
   Sets --accent CSS custom property on the root element so every
   color-mix() reference in the shared CSS resolves to the correct hue.
────────────────────────────────────────────────────────────────────────── */
export default function ChronicCareManagement() {
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
          Chronic Care Management Online | Ongoing Healthcare Support |
          Humancare Connect
        </title>
        <meta
          name="description"
          content="Manage chronic health conditions through secure telemedicine services. Connect with licensed healthcare providers for ongoing care, monitoring, and personalized support."
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