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

import "./newservices.css";
import DoctorsNote from "../Conditions/DoctorsNote";

/* ──────────────────────────────────────────────────────────────────────────
   DATA — one entry per service slug
────────────────────────────────────────────────────────────────────────── */
const SERVICES = {
  "telehealth-services": {
    slug: "doctor-note-or-sick-notes",
    name: "DOCTOR NOTES & SICK NOTES",
    tagline: "Get the documentation you need without leaving home.",
    intro:
      "Request a Doctor Note or Sick Note through secure telemedicine services. Connect with a licensed healthcare provider, discuss your symptoms or health concerns, and receive supporting documentation when clinically appropriate for work, school, or personal needs.",
    accentColor: "#2563EB",
    heroIcon: FiMonitor,
    description:
      "Doctor Notes and Sick Notes are medical documents that may be provided by a healthcare professional after evaluating a patient's health condition. These documents are commonly used to verify an illness, medical condition, or healthcare visit for employers, schools, universities, or other organizations. Through Humancare Connect, eligible patients can connect with a licensed healthcare provider online to discuss their symptoms and determine whether documentation may be appropriate.",
    whyItMatters:
      "Many workplaces, schools, and institutions require medical documentation when illness affects attendance or daily responsibilities. Obtaining the appropriate documentation can help support leave requests, verify absences, and provide confirmation of a medical evaluation.",
    whoBenefits: [
      " Employees requiring documentation for work absences",
      "Students needing verification for missed classes",
      "Individuals recovering from short term illnesses",
      "Individuals with heart disease or high cholesterolPeople requiring documentation following a medical consultation",
      "Adults seeking convenient healthcare support from home",
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
        title: "Tell Us About Your Symptoms",
        body: "Share information about your illness, symptoms, health concerns, and the reason documentation may be required.",
      },
      {
        Icon: FiFileText,
        title: "Connect With a Healthcare Provider",
        body: "A licensed healthcare provider will review your information and discuss your condition during a virtual consultation.",
      },
      {
        Icon: FiVideo,
        title: "Complete Your Consultation",
        body: "Join a secure online appointment from your phone, tablet, or computer and receive a professional medical evaluation.",
      },
      {
        Icon: FiPackage,
        title: "Receive Your Documentation",
        body: "If clinically appropriate, your provider may issue a Doctor Note or Sick Note that can be used for work, school, or other approved purposes.",
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
        q: "What is a Doctor Note?",
        a: "A Doctor Note is a medical document provided by a healthcare professional confirming that a patient has been evaluated during a medical consultation.",
      },
      {
        q: "What is a Sick Note?",
        a: "A Sick Note is documentation that may verify an illness, medical condition, or healthcare visit when clinically appropriate.",
      },
      {
        q: "Can I request a Doctor Note online?",
        a: "Yes. Eligible patients can complete a virtual consultation with a licensed healthcare provider through secure telemedicine services.",
      },
      {
        q: "Can I get a Sick Note for work?",
        a: "A healthcare provider may issue documentation for work-related absences when clinically appropriate following an evaluation.",
      },
      {
        q: "Can students request Sick Notes for school?",
        a: "Yes. Students may request medical documentation when illness affects school attendance or academic responsibilities.",
      },
      {
        q: "What conditions may qualify for a Doctor Note?",
        a: "Common illnesses, infections, migraines, flu symptoms, gastrointestinal concerns, and other health conditions may be evaluated during a consultation.",
      },
      {
        q: "How do healthcare providers determine eligibility for documentation?",
        a: "Providers review symptoms, medical history, and clinical information before determining whether documentation is appropriate.",
      },
      {
        q: "Can I request documentation for a previous illness?",
        a: "Documentation availability depends on the circumstances and provider assessment.",
      },
      {
        q: "How long does a virtual consultation take?",
        a: "Most appointments are completed within a short consultation, depending on the patient's needs.",
      },
      {
        q: "Can a provider refuse to issue a Doctor Note?",
        a: "Yes. Documentation is provided based on clinical judgment and may not be appropriate in every situation.",
      },
      {
        q: "Are online Doctor Notes legally valid?",
        a: "Acceptance varies depending on employer, school, institution, and local requirements.",
      },
      {
        q: "Can I use a Doctor Note for workplace leave requests?",
        a: "Many employers accept medical documentation for illness-related absences, though individual policies may vary.",
      },
      {
        q: "Can I receive documentation for short term illnesses?",
        a: "Yes. Many patients request documentation for temporary illnesses that affect daily activities.",
      },
      {
        q: "Are virtual consultations secure?",
        a: "Yes. Humancare Connect uses secure telemedicine technology designed to protect patient information.",
      },
      {
        q: "What information should I prepare before my appointment?",
        a: "Be prepared to discuss your symptoms, medical history, medications, and the reason documentation is being requested.",
      },
      {
        q: "Can I discuss return-to-work recommendations with my provider?",
        a: "Yes. Providers can discuss recovery timelines and recommendations based on your condition.",
      },
      {
        q: "Why choose Humancare Connect for Doctor Notes and Sick Notes?",
        a: "Humancare Connect offers secure telemedicine services, licensed healthcare providers, and convenient online consultations designed around your schedule.",
      },
      {
        q: "Can I access care from home?",
        a: "Yes. Virtual healthcare services allow patients to connect with providers from home, work, or while traveling.",
      },
      {
        q: "How quickly can I schedule an appointment?",
        a: "Appointment availability varies, but many patients can access care without lengthy wait times.",
      },
      {
        q: "How do I get started?",
        a: "Simply schedule an online appointment, discuss your symptoms with a healthcare provider, and receive documentation when clinically appropriate.",
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
              What Are Doctor Notes & Sick Notes?
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
            Requesting a Doctor Note or Sick Note through Humancare Connect is quick, secure, and convenient.
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
            Access trusted telemedicine services from wherever you are. Complete your consultation online and receive medical documentation when appropriate.

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
          Understanding
          <br />
          <span className="sp-features__heading--accent">
            Doctor Notes & Sick Notes
          </span>
        </h2>
        <p className="sp-features__sub">
          Every feature is designed around one goal: better outcomes for you.
        </p>
      </motion.div>

      <motion.div variants={fadeUp} className="sp-features__card">
        <div className="sp-features__body">
          <p className="sp-features__para">
            Doctor Notes and Sick Notes are commonly requested when an illness, injury, or medical condition affects an individual's ability to attend work, school, or other responsibilities. These documents help confirm that a healthcare professional has evaluated the patient's condition and may provide recommendations regarding rest, recovery, or temporary activity limitations.

          </p>
          <p className="sp-features__para">
            Through Humancare Connect, patients can access telemedicine services and connect with licensed healthcare providers from the comfort of home. During the consultation, providers may review symptoms, discuss medical history, assess the patient's condition, and determine whether medical documentation is appropriate based on clinical findings.

          </p>
          <p className="sp-features__para">
            Doctor Notes and Sick Notes are frequently requested for common illnesses such as colds, flu symptoms, infections, migraines, gastrointestinal concerns, minor injuries, and other short term health conditions. By combining virtual healthcare services with professional medical evaluation, Humancare Connect helps patients access convenient healthcare support while reducing unnecessary clinic visits.


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
        Need Medical Documentation?

        <br />
        {/* <span className="sp-cta__heading--accent">Your Long Term Health?</span> */}
      </h2>
      <p className="sp-cta__body">
        Connect with a licensed healthcare provider through secure telemedicine services and discuss your healthcare needs from the comfort of home. Receive Doctor Notes or Sick Notes when clinically appropriate and access convenient virtual healthcare services designed to fit your schedule.

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
  
────────────────────────────────────────────────────────────────────────── */
export default function DoctorNoteSockNote() {
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
          Doctor Notes & Sick Notes Online | Medical Documentation | Humancare Connect

        </title>
        <meta
          name="description"
          content="Need a Doctor Note or Sick Note? Connect with licensed healthcare providers online and receive medical documentation when clinically appropriate through secure telemedicine services."
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