import React, { useEffect, useRef, useState } from "react";
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
import heroBanner from "../../assets/MedicalServices/general-consultation-online.webp";

const HERO_IMAGE = {
  src: heroBanner,
  alt: "Licensed healthcare provider conducting an online general consultation with a patient through secure telemedicine services",
  width: 1920,
  height: 700,
};

/* ── DATA ── */
const SERVICES = {
  "telehealth-services": {
    slug: "general-consultation",
    name: "GENERAL CONSULTATION",
    tagline: "Trusted healthcare guidance for everyday health concerns.",
    intro:
      "Connect with a licensed healthcare provider through secure telemedicine services for personalized medical advice, symptom evaluation, and treatment recommendations. General consultations offer a convenient way to discuss non emergency health concerns and receive professional care from the comfort of home.",
    accentColor: "#2563EB",
    heroIcon: FiMonitor,
    description:
      "General consultations provide patients with convenient access to healthcare providers for a wide range of everyday medical concerns. Through Humancare Connect, patients can discuss symptoms, receive medical guidance, review treatment options, and get recommendations for appropriate next steps through secure virtual healthcare services.",
    whyItMatters:
      "Many health concerns can be addressed early through timely medical advice and evaluation. General consultations help patients better understand their symptoms, make informed healthcare decisions, and access professional support without the need for unnecessary clinic visits.",
    whoBenefits: [
      "Adults experiencing new or ongoing health concerns",
      "Individuals seeking medical advice and symptom evaluation",
      "Patients managing common illnesses or minor conditions",
      "Busy professionals looking for convenient healthcare access",
      "Anyone seeking trusted healthcare guidance from licensed providers",
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
        body: "Tell us about your symptoms, medical history, current medications, and healthcare questions through our secure intake process.",
      },
      {
        Icon: FiFileText,
        title: "Connect With a Healthcare Provider",
        body: "Meet with a licensed healthcare provider who will review your concerns and discuss your symptoms.",
      },
      {
        Icon: FiVideo,
        title: "Receive Personalized Medical Guidance",
        body: "Your provider will offer recommendations, discuss treatment options, and help determine the most appropriate next steps for your care.",
      },
      {
        Icon: FiPackage,
        title: "Follow Your Care Plan",
        body: "Receive guidance for ongoing care, symptom management, follow up recommendations, or referrals when needed.",
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
        q: "What is a general consultation?",
        a: "A general consultation is a virtual appointment with a licensed healthcare provider to discuss symptoms, health concerns, treatment options, and medical questions.",
      },
      {
        q: "What health concerns can be discussed during a general consultation?",
        a: "Patients can discuss common illnesses, minor injuries, allergies, digestive concerns, headaches, fatigue, skin conditions, medication questions, and other non emergency health issues.",
      },
      {
        q: "Can I speak with a healthcare provider online?",
        a: "Yes. Humancare Connect offers secure telemedicine services that allow patients to connect with licensed healthcare providers remotely.",
      },
      {
        q: "Are virtual general consultations effective?",
        a: "Yes. Many common health concerns can be evaluated and managed through telehealth services when clinically appropriate.",
      },
      {
        q: "Do I need an appointment for a general consultation?",
        a: "Yes. Patients can schedule an online appointment at a convenient time.",
      },
      {
        q: "Can a provider diagnose my condition during a virtual visit?",
        a: "Healthcare providers can assess symptoms, discuss concerns, and provide recommendations based on the information available during the consultation.",
      },
      {
        q: "What happens during a general consultation?",
        a: "Your provider will review your symptoms, medical history, medications, and healthcare concerns before discussing appropriate recommendations.",
      },
      {
        q: "Can I ask questions about my medications?",
        a: "Yes. General consultations are a convenient opportunity to discuss medications, side effects, and treatment plans.",
      },
      {
        q: "Is a general consultation confidential?",
        a: "Yes. Humancare Connect uses secure telemedicine technology designed to protect patient privacy and confidentiality.",
      },
      {
        q: "Can I receive treatment recommendations during a consultation?",
        a: "Yes. Healthcare providers can discuss treatment options, symptom management strategies, and next steps for care.",
      },
      {
        q: "Are general consultations suitable for preventive care?",
        a: "Yes. Patients can discuss wellness goals, preventive healthcare measures, and healthy lifestyle recommendations.",
      },
      {
        q: "Can I get a referral during a general consultation?",
        a: "When appropriate, healthcare providers may recommend referrals for additional evaluation or specialty care.",
      },
      {
        q: "What are the benefits of telemedicine consultations?",
        a: "Telemedicine services provide convenient access to healthcare providers, flexible scheduling, and care from the comfort of home.",
      },
      {
        q: "Can I discuss multiple health concerns in one appointment?",
        a: "Yes. Patients may discuss multiple non emergency healthcare concerns during a consultation.",
      },
      {
        q: "Who can benefit from a general consultation?",
        a: "Anyone seeking medical advice, symptom evaluation, treatment guidance, or healthcare support may benefit from a general consultation.",
      },
      {
        q: "Can virtual consultations help save time?",
        a: "Yes. Telehealth services eliminate travel time and provide convenient access to healthcare providers.",
      },
      {
        q: "What should I prepare before my appointment?",
        a: "Patients should be prepared to discuss symptoms, medications, medical history, and any questions they would like addressed.",
      },
      {
        q: "When should I seek emergency medical care instead?",
        a: "Emergency symptoms such as chest pain, severe breathing difficulties, stroke symptoms, or serious injuries require immediate emergency medical attention.",
      },
    ],
  },
};

/* ── WHY US ITEMS — fixed: was empty array, now populated ── */
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

/* ── ANIMATION VARIANTS ── */
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

/* ── HOOKS ── */
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

/* ── MICRO COMPONENTS ── */
const SLabel = ({ text }) => (
  <div className="sp-label">
    <div className="sp-label__line" />
    <span className="sp-label__text">{text}</span>
  </div>
);

const Pill = ({ children }) => (
  <div className="sp-pill">
    <span className="sp-pill__dot" />
    {children}
  </div>
);

const PrimaryBtn = ({
  children,
  href,
  fullWidth,
  type = "button",
  onClick,
}) => {
  const cls = ["sp-btn sp-btn--primary", fullWidth ? "sp-btn--full" : ""]
    .join(" ")
    .trim();
  if (href)
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  return (
    <button type={type} className={cls} onClick={onClick}>
      {children}
    </button>
  );
};

const GhostBtn = ({ children, href, onClick }) => {
  if (href)
    return (
      <a href={href} className="sp-btn sp-btn--ghost">
        {children}
      </a>
    );
  return (
    <button className="sp-btn sp-btn--ghost" onClick={onClick}>
      {children}
    </button>
  );
};

/* ── HERO ── */
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
      <img
        src={HERO_IMAGE.src}
        alt={HERO_IMAGE.alt}
        width={HERO_IMAGE.width}
        height={HERO_IMAGE.height}
        loading="eager"
        fetchPriority="high"
        className="sp-hero__bg"
      />
      <div className="sp-hero__overlay" />
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
              <span key={i} className="sp-hero__heading--accent">
                {w}{" "}
              </span>
            ) : (
              <span key={i}>{w} </span>
            ),
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

/* ── CONSULTATION FORM ── */
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
            A member of our care team will reach out to {values.email || "you"}{" "}
            shortly.
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
        Tell us a little about what you need, and a care coordinator will follow
        up within one business day.
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

/* ── OVERVIEW ── */
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
        <div>
          <motion.div variants={fadeUp}>
            <SLabel text="Service Overview" />
            <h2 className="sp-overview__heading">
              Your First Step Toward Better Health
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
        <motion.div variants={fadeUp} className="sp-form-sticky">
          <ConsultationForm />
        </motion.div>
      </motion.div>
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="sp-outcomes"
      >
        {s.keyOutcomes.map((o, i) => (
          <motion.div
            key={i}
            variants={fadeUp}
            custom={i}
            className="sp-outcome-card"
          >
            <div className="sp-outcome-card__dot" />
            <p className="sp-outcome-card__text">{o}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);

/* ── HOW IT WORKS ── */
const HowItWorks = ({ s }) => (
  <section className="sp-hiw">
    <div className="sp-hiw__inner">
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
            Accessing a general consultation through Humancare Connect is quick,
            secure, and designed around your healthcare needs.
          </p>
        </motion.div>
        <div className="sp-steps">
          {s.steps.map((step, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              custom={i}
              className="sp-step"
            >
              {i < s.steps.length - 1 && <div className="sp-step__connector" />}
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
            Get convenient access to professional healthcare guidance through
            trusted telemedicine services. Receive personalized support without
            leaving home.
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

/* ── FEATURES ── */
const Features = () => (
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
          Comprehensive Care for
          <br />
          <span className="sp-features__heading--accent">
            Everyday Health Concerns
          </span>
        </h2>
        <p className="sp-features__sub">
          Every feature is designed around one goal: better outcomes for you.
        </p>
      </motion.div>
      <motion.div variants={fadeUp} className="sp-features__card">
        <div className="sp-features__body">
          <p className="sp-features__para">
            General consultations are one of the most common ways patients
            access healthcare services. Whether you are experiencing new
            symptoms, managing an ongoing condition, seeking preventive health
            advice, or looking for professional medical guidance, a general
            consultation provides an opportunity to discuss your concerns with a
            licensed healthcare provider.
          </p>
          <p className="sp-features__para">
            At Humancare Connect, our virtual healthcare services make it easier
            for patients to access quality care from virtually anywhere.
            Healthcare providers can evaluate symptoms, review health history,
            discuss treatment options, and recommend appropriate next steps
            based on individual needs. This convenient approach helps patients
            receive timely support while avoiding unnecessary delays in care.
          </p>
          <p className="sp-features__para">
            General consultations may address a wide range of concerns,
            including cold and flu symptoms, allergies, minor infections,
            digestive issues, headaches, fatigue, skin concerns, medication
            questions, and overall wellness discussions. Through secure
            telehealth services, patients can access professional healthcare
            support when they need it most.
          </p>
        </div>
      </motion.div>
    </motion.div>
  </section>
);

/* ── STAT CARD ── */
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

/* ── WHY US ── */
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
          </h2>
          <p className="sp-whyus__sub">
            Connect with a licensed healthcare provider through secure
            telemedicine services and receive personalized medical guidance for
            your health concerns. Get the care and answers you need from the
            comfort of home.
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
            <motion.div
              key={i}
              variants={fadeUp}
              custom={i}
              className="sp-whyus-card"
            >
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

/* ── FAQ ── */
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
        <motion.div variants={fadeUp}>
          <SLabel text="FAQ" />
          <h2 className="sp-faq__heading">
            Questions about
            <br />
            <span className="sp-faq__heading--accent">{s.name}?</span>
          </h2>
          <p className="sp-faq__sub">
            We've answered the most common questions below. Our care team is one
            message away if yours isn't listed.
          </p>
        </motion.div>
        <motion.div variants={fadeUp} className="sp-faq__panel">
          {s.faqs.map((faq, i) => (
            <div key={i} className="sp-faq__item">
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

/* ── FINAL CTA — fixed: now accepts `s` prop, JSX is properly closed ── */
const FinalCTA = ({ s }) => (
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
        Ready to Speak With a Healthcare Provider?
        <br />
        <span className="sp-cta__heading--accent">
          Get the care and answers you need from the comfort of home.
        </span>
      </h2>
      <p className="sp-cta__body">
        Connect with a licensed healthcare provider through secure telemedicine
        services and receive personalized medical guidance for your health
        concerns.
      </p>
      <div className="sp-cta__actions">
        <PrimaryBtn href="/login">Get Started</PrimaryBtn>
        <GhostBtn href="/appointment-booking">Book Appointment</GhostBtn>
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

/* ── ROOT ── */
export default function GenralConsultation() {
  const [slug] = useState("telehealth-services");
  const s = SERVICES[slug] || SERVICES["telehealth-services"];

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
          General Consultation Online | Virtual Doctor Consultation | Humancare
          Connect
        </title>
        <meta
          name="description"
          content="Book a general consultation online with licensed healthcare providers. Get medical advice, symptom evaluation, and personalized care through secure telemedicine services."
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
            <Features />
            <WhyUs s={s} />
            <FAQ s={s} />
            <FinalCTA s={s} />
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
