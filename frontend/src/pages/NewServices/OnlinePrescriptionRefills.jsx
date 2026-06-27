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
             What Are Online Prescription Refills?

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
            Requesting an online prescription refill through Humancare Connect is quick, secure, and convenient.
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
          <h3 className="sp-ready-card__heading">Ready to Renew Your Prescription?
</h3>
          <p className="sp-ready-card__desc">
           Stay on track with your treatment plan through secure online prescription refill services. Connect with a licensed healthcare provider, request medication renewals when clinically appropriate, and access convenient telehealth services from wherever you are.

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
          Online Prescription Refills
          </span>
        </h2>
        <p className="sp-features__sub">
          Every feature is designed around one goal: better outcomes for you.
        </p>
      </motion.div>

      <motion.div variants={fadeUp} className="sp-features__card">
        <div className="sp-features__body">
          <p className="sp-features__para">
           Online prescription refills allow eligible patients to renew ongoing medications through a secure telemedicine consultation with a licensed healthcare provider. This service is designed for individuals who are managing chronic health conditions, maintaining long term treatment plans, or requiring continued access to prescribed medications. Instead of scheduling an in person appointment for routine medication renewals, patients can connect with a healthcare provider remotely and receive professional guidance from the comfort of home.

          </p>
          <p className="sp-features__para">
            At Humancare Connect, our online prescription refill service helps simplify medication management while supporting continuity of care. Healthcare providers can review your medical history, current medications, treatment progress, and ongoing healthcare needs to determine whether a prescription renewal is appropriate. This approach helps patients stay consistent with their treatment plans while reducing delays that could impact their health outcomes.
          </p>
          <p className="sp-features__para">
         Online prescription refills are commonly requested for conditions such as high blood pressure, diabetes, asthma, allergies, thyroid disorders, high cholesterol, migraine management, and other ongoing health concerns. By combining convenient access to telemedicine services with professional clinical oversight, Humancare Connect helps patients maintain their healthcare journey through secure, accessible, and patient centered virtual healthcare services.



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
            Ready to Speak With a Healthcare Provider?

            {" "}
            {/* <span className="sp-whyus__heading--accent">measure.</span> */}
          </h2>
          <p className="sp-whyus__sub">
            Connect with a licensed healthcare provider through secure telemedicine services and receive personalized medical guidance for your health concerns. Get the care and answers you need from the comfort of home.

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
        Take the Next Step Toward Better Health

        <br />
        {/* <span className="sp-cta__heading--accent">Travel smarter with convenient virtual healthcare services designed around your schedule.
        </span> */}
      </h2>
      <p className="sp-cta__body">
        Whether you're monitoring an ongoing condition, investigating new symptoms, or staying proactive with preventive care, Humancare Connect makes it easy to access laboratory testing support from anywhere.

        Connect with a licensed healthcare provider through secure telemedicine services and receive lab requisitions when clinically appropriate to help guide your healthcare journey.

      </p>

      <div className="sp-cta__actions">
        <PrimaryBtn href="/login">Get Started</PrimaryBtn>
        <GhostBtn href="/appointment-booking">Request Your Lab Consultation Today</GhostBtn>
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
export default function OnlinePrescriptionRefills() {
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
         Online Prescription Refills | Renew Medications Online | Humancare Connect
        </title>
        <meta
          name="description"
          content=" Need a prescription refill? Connect with licensed healthcare providers through secure telemedicine services and renew eligible medications online."
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