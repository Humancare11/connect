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
              What Is a Fit to Fly Certificate?

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
            Obtaining a Fit to Fly Certificate through Humancare Connect is quick, secure, and designed to fit your travel schedule.

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
            Get professional travel health support from licensed healthcare providers through secure telemedicine services. Complete your assessment online and prepare for your journey with confidence.
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
            Fit to Fly Certificates
          </span>
        </h2>
        <p className="sp-features__sub">
          Every feature is designed around one goal: better outcomes for you.
        </p>
      </motion.div>

      <motion.div variants={fadeUp} className="sp-features__card">
        <div className="sp-features__body">
          <p className="sp-features__para">
            A Fit to Fly Certificate is often requested when an airline requires confirmation that a passenger can safely travel despite a recent illness, injury, surgery, pregnancy-related concern, or ongoing medical condition. The purpose of the certificate is to provide medical clearance based on an assessment of the traveler's current health status and travel plans.

          </p>
          <p className="sp-features__para">
            Through Humancare Connect, travelers can access telemedicine services to discuss their health concerns and airline requirements with a licensed healthcare provider. During the consultation, providers may review medical history, recent treatments, medications, symptoms, recovery progress, and travel details to determine whether additional precautions or documentation may be necessary before travel.

          </p>
          <p className="sp-features__para">
            Fit to Fly assessments are commonly requested by travelers recovering from surgery, managing chronic health conditions, traveling during pregnancy, or returning to travel after a recent medical event. By combining convenient online doctor appointments with professional medical review, Humancare Connect helps travelers access virtual healthcare services that support informed travel decisions and help reduce unexpected disruptions before departure.

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
          Fit to Fly Certificate Online | Medical Clearance for Air Travel | Humancare Connect

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