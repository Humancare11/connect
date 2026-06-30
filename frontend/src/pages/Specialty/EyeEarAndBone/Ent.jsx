import { useState, useEffect, useRef } from "react";
import { HelmetProvider } from "react-helmet-async";
import {
  FiActivity,
  FiHeart,
  FiShield,
  FiUsers,
  FiClock,
  FiGlobe,
  FiSearch,
  FiCalendar,
  FiPhone,
  FiMail,
  FiAward,
  FiZap,
  FiMonitor,
  FiDollarSign,
  FiCheckCircle,
  FiStar,
  FiLock,
  FiArrowRight,
  FiPlus,
  FiDroplet,
  FiWind,
  FiThermometer,
  FiAlertCircle,
  FiRefreshCw,
  FiTarget,
  FiTrendingUp,
  FiBarChart2,
  FiFeather,
  FiCrosshair,
  FiLayout,
  FiEye,
  FiTool,
  FiCpu,
  FiBriefcase,
  FiClipboard,
  FiVolume2,
  FiVolume,
  FiCompass,
} from "react-icons/fi";
import {
  MdOutlineVaccines,
  MdOutlineBloodtype,
  MdOutlinePsychology,
  MdOutlineHealthAndSafety,
  MdOutlineSpa,
  MdOutlineMonitorHeart,
  MdOutlineBiotech,
  MdOutlineSick,
  MdOutlineHearing,
} from "react-icons/md";
import {
  GiHeartOrgan,
  GiLungs,
  GiBrain,
  GiBoneKnife,
  GiMedicines,
  GiBodySwapping,
  GiHumanEar,
  GiNoseSide,
} from "react-icons/gi";
import "../SpecialtyPage.css";

import heroImage from "../../../assets/SpecialitiesImage/ent-ear-nose-throat-specialist-consultation-banner.webp";
import overviewImage from "../../../assets/SpecialitiesImage/ent-specialist-ear-nose-throat-examination-consultation.webp";

// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "ent",
  name: "ENT (Ear, Nose & Throat)",
  tagline: "Specialized Care for Better Ear, Nose, and Throat Health.",
  heroDescription:
    "ENT specialists diagnose and treat conditions affecting the ears, nose, throat, sinuses, voice, and balance system. From ear infections and sore throats to nasal congestion, hoarseness, and vertigo, ENT specialists provide comprehensive care to improve comfort, communication, breathing, and overall quality of life.",
  heroImage: heroImage,
  heroAlt:
    "Board-certified ENT specialist consulting with a patient for ear, nose, and throat care, including sinus, hearing, and throat disorders.",
  overviewImage: overviewImage,
  overviewAlt:
    "ENT specialist performing an ear, nose, and throat examination during a patient consultation for hearing, sinus, and throat health.",
  overviewDescription:
    "Otolaryngology, commonly known as ENT (Ear, Nose & Throat), is a medical specialty focused on diagnosing and treating conditions affecting the ears, nose, throat, sinuses, voice box, and related structures of the head and neck. ENT specialists help patients manage infections, hearing concerns, breathing difficulties, balance disorders, and throat-related conditions.",
  overviewImportance:
    "Through comprehensive evaluations, personalized treatment plans, medication management, and preventive care, ENT specialists help patients find relief from symptoms, improve daily function, and maintain long-term ear, nose, and throat health.",
  conditionsTreated:
    "ENT specialists diagnose and manage ear infections, ear pain, sore throat, tonsillitis, nasal congestion, hoarseness, vertigo, sinus conditions, and other disorders affecting the ear, nose, and throat.",
  whenToConsult:
    "Schedule a visit with an ENT specialist if you experience recurring ear infections, chronic nasal congestion, sore throat, hoarseness, dizziness, balance issues, hearing concerns, or persistent symptoms affecting the ears, nose, or throat.",

  keyServices: [
    {
      Icon: FiActivity,
      title: "Ear Health Evaluations",
      description:
        "Comprehensive assessments for ear infections, ear pain, hearing concerns, and ear-related conditions.",
    },
    {
      Icon: FiThermometer,
      title: "Nasal & Sinus Care",
      description:
        "Diagnosis and treatment of nasal congestion, sinus pressure, allergies, and breathing difficulties.",
    },
    {
      Icon: MdOutlineVaccines,
      title: "Throat & Voice Disorder Management",
      description:
        "Care for sore throat, hoarseness, voice changes, tonsillitis, and swallowing concerns.",
    },
    {
      Icon: FiDroplet,
      title: "Vertigo & Balance Assessments",
      description:
        "Evaluation and treatment of dizziness, vertigo, and balance-related disorders.",
    },
    {
      Icon: MdOutlineSpa,
      title: "Infection Diagnosis & Treatment",
      description:
        "Management of ear, nose, throat, and sinus infections affecting adults and children.",
    },
    {
      Icon: FiUsers,
      title: "Preventive ENT Care",
      description:
        "Ongoing monitoring, lifestyle guidance, and treatment plans to support long-term ENT health.",
    },
  ],

  benefits: [
    {
      Icon: FiSearch,
      title: "Improved Breathing & Comfort",
      description:
        "Helps relieve nasal congestion, sinus pressure, and airway-related symptoms.",
    },
    {
      Icon: FiTrendingUp,
      title: "Better Hearing & Ear Health",
      description:
        "Supports healthy ear function while addressing infections, pain, and hearing concerns.",
    },
    {
      Icon: FiShield,
      title: "Enhanced Voice & Throat Function",
      description:
        "Improves communication, swallowing, and vocal health through specialized treatment.",
    },
    {
      Icon: FiHeart,
      title: "Better Balance & Daily Function",
      description:
        "Addresses vertigo and dizziness symptoms that may interfere with everyday activities.",
    },
  ],

  conditions: [
    {
      Icon: GiHumanEar,
      name: "Ear Infection",
      description:
        "Diagnosis and treatment of bacterial and viral ear infections causing pain, pressure, and discomfort.",
    },
    {
      Icon: GiHumanEar,
      name: "Ear Pain",
      description:
        "Evaluation of ear discomfort, pressure, inflammation, infection, and underlying ENT conditions.",
    },
    {
      Icon: FiVolume2,
      name: "Hoarseness",
      description:
        "Management of voice changes, vocal strain, throat irritation, and vocal cord-related concerns.",
    },
    {
      Icon: GiNoseSide,
      name: "Nasal Congestion",
      description:
        "Treatment for blocked nasal passages, sinus pressure, breathing difficulties, and congestion symptoms.",
    },
    {
      Icon: FiZap,
      name: "Sore Throat",
      description:
        "Care for throat irritation, pain, inflammation, infections, and swallowing discomfort.",
    },
    {
      Icon: MdOutlineSick,
      name: "Tonsillitis",
      description:
        "Diagnosis and treatment of inflamed tonsils causing throat pain, fever, and difficulty swallowing.",
    },
    {
      Icon: FiCompass,
      name: "Vertigo",
      description:
        "Evaluation and management of dizziness, spinning sensations, balance problems, and vestibular disorders.",
    },
    {
      Icon: FiShield,
      name: "Sinus Infections",
      description:
        "Treatment for sinus inflammation, facial pressure, nasal discharge, and chronic sinus symptoms.",
    },
    {
      Icon: MdOutlineHearing,
      name: "Hearing Concerns",
      description:
        "Assessment of hearing changes, ear-related symptoms, and conditions affecting auditory health.",
    },
    {
      Icon: FiVolume,
      name: "Tinnitus",
      description:
        "Management of ringing, buzzing, or other sounds in the ears affecting daily life.",
    },
    {
      Icon: GiNoseSide,
      name: "Allergic Rhinitis",
      description:
        "Treatment for allergy-related nasal symptoms, sneezing, congestion, and sinus discomfort.",
    },
    {
      Icon: FiTrendingUp,
      name: "Swallowing Difficulties",
      description:
        "Evaluation of throat-related conditions that affect swallowing, eating, and daily comfort.",
    },
  ],

  faqs: [
    {
      question: "What is an ENT specialist?",
      answer:
        "An ENT specialist, also known as an otolaryngologist, diagnoses and treats conditions affecting the ears, nose, throat, sinuses, voice, and balance system.",
    },
    {
      question: "What conditions do ENT specialists treat?",
      answer:
        "ENT specialists treat ear infections, ear pain, sinus issues, nasal congestion, sore throat, tonsillitis, vertigo, hearing concerns, and voice disorders.",
    },
    {
      question: "When should I see an ENT specialist?",
      answer:
        "You should seek ENT care for recurring ear infections, persistent sore throat, chronic congestion, dizziness, hearing problems, or voice changes.",
    },
    {
      question: "What causes ear infections?",
      answer:
        "Ear infections are commonly caused by bacterial or viral infections that affect the middle ear and surrounding structures.",
    },
    {
      question: "Why does my ear hurt?",
      answer:
        "Ear pain may result from infection, inflammation, pressure changes, injury, sinus conditions, or throat-related issues.",
    },
    {
      question: "What causes chronic nasal congestion?",
      answer:
        "Chronic congestion may be caused by allergies, sinus infections, nasal inflammation, structural issues, or environmental irritants.",
    },
    {
      question: "What is tonsillitis?",
      answer:
        "Tonsillitis is inflammation of the tonsils, often caused by viral or bacterial infections, leading to sore throat and difficulty swallowing.",
    },
    {
      question: "When should a sore throat be evaluated?",
      answer:
        "A sore throat should be evaluated if symptoms are severe, persistent, recurrent, or accompanied by fever or swallowing difficulties.",
    },
    {
      question: "What causes hoarseness?",
      answer:
        "Hoarseness can result from voice strain, infections, allergies, acid reflux, vocal cord irritation, or other throat conditions.",
    },
    {
      question: "What is vertigo?",
      answer:
        "Vertigo is a sensation of spinning or movement often caused by inner ear or balance system disorders.",
    },
    {
      question: "Can ENT specialists treat dizziness?",
      answer:
        "Yes. ENT specialists evaluate dizziness, vertigo, and balance-related conditions affecting the inner ear.",
    },
    {
      question: "What is tinnitus?",
      answer:
        "Tinnitus is the perception of ringing, buzzing, or other sounds in the ears without an external source.",
    },
    {
      question: "Can allergies affect the ears, nose, and throat?",
      answer:
        "Yes. Allergies commonly cause congestion, sinus pressure, throat irritation, ear discomfort, and other ENT symptoms.",
    },
    {
      question: "Are telehealth ENT appointments available?",
      answer:
        "Yes. Many ENT consultations, follow-ups, and treatment discussions can be conducted through secure telehealth visits.",
    },
    {
      question: "What are common signs of sinus problems?",
      answer:
        "Facial pressure, congestion, headache, nasal discharge, reduced smell, and breathing difficulties may indicate sinus issues.",
    },
    {
      question: "How can I maintain good ENT health?",
      answer:
        "Avoid smoking, manage allergies, stay hydrated, practice good hygiene, and seek medical care for persistent symptoms.",
    },
    {
      question: "Can children see ENT specialists?",
      answer:
        "Yes. ENT specialists commonly treat ear infections, tonsillitis, hearing concerns, and other ENT conditions in children.",
    },
    {
      question: "How can I schedule an appointment with an ENT specialist?",
      answer:
        "You can schedule an appointment online, through telehealth services, or by contacting the healthcare team for assistance.",
    },
  ],
};

const TRUST_STATS = [
  { Icon: FiUsers, value: "5,000+", label: "Board-Certified Providers" },
  { Icon: FiBriefcase, value: "50+", label: "Specialties Covered" },
  { Icon: FiCalendar, value: "24 hrs", label: "Average Appointment Time" },
  { Icon: FiMonitor, value: "24/7", label: "Telehealth Support" },
];

const TRUST_CARDS = [
  {
    Icon: FiAward,
    title: "Board-Certified Specialists",
    description:
      "Receive care from experienced ENT providers dedicated to evidence-based diagnosis and treatment.",
  },
  {
    Icon: FiZap,
    title: "Fast Appointments",
    description:
      "Schedule ENT consultations quickly with convenient appointment availability.",
  },
  {
    Icon: FiMonitor,
    title: "Telehealth Access",
    description:
      "Connect securely with ENT specialists through virtual consultations and follow-up visits.",
  },
  {
    Icon: FiShield,
    title: "Insurance Support",
    description:
      "Receive assistance understanding healthcare coverage, authorizations, and billing-related questions.",
  },
  {
    Icon: FiHeart,
    title: "Personalized Care",
    description:
      "Benefit from individualized treatment plans based on your symptoms, diagnosis, and healthcare goals.",
  },
  {
    Icon: FiGlobe,
    title: "Global Provider Network",
    description:
      "Access a broad network of ENT specialists and coordinated healthcare services.",
  },
];

// ── Scroll reveal hook ────────────────────────────────────────────────────────
function useScrollReveal(threshold = 0.1) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({ children, delay = 0, className = "" }) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`sp-reveal${visible ? " sp-reveal--visible" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

// ── Counter animation hook ────────────────────────────────────────────────────
function AnimatedStat({ value, label, Icon }) {
  const { ref, visible } = useScrollReveal(0.2);
  const [displayed, setDisplayed] = useState("0");

  useEffect(() => {
    if (!visible) return;
    const numeric = parseFloat(value.replace(/[^0-9.]/g, ""));
    const suffix = value.replace(/[0-9.]/g, "");
    if (isNaN(numeric)) {
      setDisplayed(value);
      return;
    }
    let start = 0;
    const duration = 1200;
    const step = 16;
    const increment = numeric / (duration / step);
    const timer = setInterval(() => {
      start += increment;
      if (start >= numeric) {
        setDisplayed(value);
        clearInterval(timer);
      } else {
        const rounded =
          numeric < 10 ? start.toFixed(1) : Math.floor(start).toString();
        setDisplayed(rounded + suffix);
      }
    }, step);
    return () => clearInterval(timer);
  }, [visible, value]);

  return (
    <div
      ref={ref}
      className={`sp-stat-card${visible ? " sp-stat-card--visible" : ""}`}
    >
      <div className="sp-stat-card__icon-wrap">
        <Icon size={22} />
      </div>
      <p className="sp-stat-card__value">{displayed}</p>
      <p className="sp-stat-card__label">{label}</p>
    </div>
  );
}

// ── FAQ Item ──────────────────────────────────────────────────────────────────
function FAQItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`sp-faq-item${open ? " sp-faq-item--open" : ""}`}>
      <button
        className="sp-faq-item__btn"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="sp-faq-item__question">{question}</span>
        <span
          className={`sp-faq-item__icon${open ? " sp-faq-item__icon--open" : ""}`}
        >
          <FiPlus size={15} />
        </span>
      </button>
      <div
        className={`sp-faq-item__body${open ? " sp-faq-item__body--open" : ""}`}
      >
        <div className="sp-faq-item__answer">
          <p>{answer}</p>
        </div>
      </div>
    </div>
  );
}

// ── Condition Card ────────────────────────────────────────────────────────────
function ConditionCard({ Icon, name, description, delay }) {
  return (
    <Reveal delay={delay}>
      <div className="sp-condition-card">
        <div className="sp-condition-card__icon">
          <Icon size={22} />
        </div>
        <h3 className="sp-condition-card__title">{name}</h3>
        <p className="sp-condition-card__desc">{description}</p>
        <button
          className="sp-condition-card__link"
          aria-label={`Learn more about ${name}`}
        >
          Learn more <FiArrowRight size={13} />
        </button>
      </div>
    </Reveal>
  );
}

// ── Key Service Card ──────────────────────────────────────────────────────────
function ServiceCard({ Icon, title, description, delay }) {
  return (
    <Reveal delay={delay}>
      <div className="sp-service-card">
        <div className="sp-service-card__icon">
          <Icon size={22} />
        </div>
        <div>
          <h4 className="sp-service-card__title">{title}</h4>
          <p className="sp-service-card__desc">{description}</p>
        </div>
      </div>
    </Reveal>
  );
}

// ── Benefit Card ──────────────────────────────────────────────────────────────
function BenefitCard({ Icon, title, description, delay }) {
  return (
    <Reveal delay={delay}>
      <div className="sp-benefit-card">
        <div className="sp-benefit-card__icon">
          <Icon size={24} />
        </div>
        <h4 className="sp-benefit-card__title">{title}</h4>
        <p className="sp-benefit-card__desc">{description}</p>
      </div>
    </Reveal>
  );
}

// ── Trust Card ────────────────────────────────────────────────────────────────
function TrustCard({ Icon, title, description, delay }) {
  return (
    <Reveal delay={delay}>
      <div className="sp-trust-card">
        <div className="sp-trust-card__icon">
          <Icon size={24} />
        </div>
        <h3 className="sp-trust-card__title">{title}</h3>
        <p className="sp-trust-card__desc">{description}</p>
      </div>
    </Reveal>
  );
}

// ── Section Label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return <span className="sp-section-label">{children}</span>;
}

// ── Main Page Component ───────────────────────────────────────────────────────
export default function Ent({ data = SPECIALTY_DATA }) {
  const [heroLoaded, setHeroLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <HelmetProvider>
        <title>ENT Specialists | Ear, Nose & Throat Care Services</title>
        <meta
          name="description"
          content="Get expert ENT care for ear infections, ear pain, sore throat, tonsillitis, nasal congestion, hoarseness, vertigo, and other ear, nose, and throat conditions."
        />
      </HelmetProvider>
      <main className="sp-page">
        {/* ── 1. HERO ────────────────────────────────────────────────────────── */}
        <section className="sp-hero">
          <div className="sp-hero__bg">
            <img
              src={data.heroImage}
              alt={data.heroAlt}
              className="sp-hero__img"
              loading="eager"
            />
            <div className="sp-hero__overlay" />
          </div>

          <div className="sp-hero__content">
            <div
              className={`sp-hero__content-inner${heroLoaded ? " sp-hero__content-inner--loaded" : ""}`}
            >
              <span className="sp-hero__badge">HumanCare Connect</span>
              <h1 className="sp-hero__title">{data.name}</h1>
              <p className="sp-hero__tagline">{data.tagline}</p>
              <p className="sp-hero__description">{data.heroDescription}</p>

              <div className="sp-hero__actions">
                <a href="/Specialties" className="sp-btn sp-btn--primary">
                  <FiSearch size={17} />
                  Find Specialists
                </a>
                <a href="/appointment-booking" className="sp-btn sp-btn--ghost">
                  <FiCalendar size={17} />
                  Book Appointment
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. OVERVIEW ────────────────────────────────────────────────────── */}
        <section className="sp-overview">
          <div className="sp-container">
            <div className="sp-overview__grid">
              {/* Image column */}
              <Reveal>
                <div className="sp-overview__img-wrap">
                  <img
                    src={data.overviewImage}
                    alt={data.overviewAlt}
                    className="sp-overview__img"
                    loading="lazy"
                  />
                  <div className="sp-overview__badge">
                    <div className="sp-overview__badge-icon">
                      <FiCheckCircle size={20} />
                    </div>
                    <div>
                      <p className="sp-overview__badge-title">
                        Board-Certified
                      </p>
                      <p className="sp-overview__badge-sub">
                        {data.name} Specialists
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>

              {/* Text column */}
              <div className="sp-overview__text">
                <Reveal>
                  <SectionLabel>About the Specialty</SectionLabel>
                  <h2 className="sp-overview__heading">What Is {data.name}?</h2>
                  <p className="sp-overview__para">
                    {data.overviewDescription}
                  </p>
                  <p className="sp-overview__para">{data.overviewImportance}</p>
                </Reveal>

                <Reveal delay={80}>
                  <div className="sp-info-box sp-info-box--blue">
                    <h3 className="sp-info-box__heading">
                      <FiActivity size={15} color="#083EBD" />
                      Conditions Treated
                    </h3>
                    <p className="sp-info-box__text">
                      {data.conditionsTreated}
                    </p>
                  </div>
                </Reveal>

                <Reveal delay={140}>
                  <div className="sp-info-box sp-info-box--gray">
                    <h3 className="sp-info-box__heading">
                      <FiAlertCircle size={15} color="#64748b" />
                      When to Consult
                    </h3>
                    <p className="sp-info-box__text">{data.whenToConsult}</p>
                  </div>
                </Reveal>
              </div>
            </div>

            {/* Key Services */}
            <Reveal>
              <div className="sp-section-head">
                <SectionLabel>What We Offer</SectionLabel>
                <h3>Key Services</h3>
              </div>
            </Reveal>
            <div className="sp-services-grid">
              {data.keyServices.map((s, i) => (
                <ServiceCard key={i} {...s} delay={i * 55} />
              ))}
            </div>

            {/* Benefits */}
            <Reveal>
              <div className="sp-section-head">
                <SectionLabel>Why It Matters</SectionLabel>
                <h3>Benefits of {data.name}</h3>
              </div>
            </Reveal>
            <div className="sp-benefits-grid">
              {data.benefits.map((b, i) => (
                <BenefitCard key={i} {...b} delay={i * 65} />
              ))}
            </div>
          </div>
        </section>

        {/* ── 3. CONDITIONS ──────────────────────────────────────────────────── */}
        <section className="sp-conditions">
          <div className="sp-container">
            <Reveal>
              <div className="sp-conditions__head">
                <SectionLabel>Conditions &amp; Symptoms</SectionLabel>
                <h2>What We Treat</h2>
                <p>
                  Our {data.name.toLowerCase()} specialists diagnose and manage
                  a wide range of conditions affecting the ears, nose, throat,
                  sinuses, voice, and balance system.
                </p>
              </div>
            </Reveal>

            <div className="sp-conditions__grid">
              {data.conditions.map((c, i) => (
                <ConditionCard key={i} {...c} delay={Math.min(i, 7) * 45} />
              ))}
            </div>
          </div>
        </section>

        {/* ── 4. WHY HUMANCARE ───────────────────────────────────────────────── */}
        <section className="sp-trust">
          <div className="sp-container">
            <div className="sp-stats-grid">
              {TRUST_STATS.map((s, i) => (
                <AnimatedStat key={i} {...s} />
              ))}
            </div>

            <Reveal>
              <div className="sp-trust__head">
                <SectionLabel>Why HumanCare Connect</SectionLabel>
                <h2>Care You Can Trust</h2>
                <p>
                  We combine experienced ENT specialists with advanced
                  technology to make ear, nose, and throat care more accessible,
                  convenient, and personalized.
                </p>
              </div>
            </Reveal>

            <div className="sp-trust-grid">
              {TRUST_CARDS.map((c, i) => (
                <TrustCard key={i} {...c} delay={i * 55} />
              ))}
            </div>
          </div>
        </section>

        {/* ── 5. FAQ ─────────────────────────────────────────────────────────── */}
        <section className="sp-faq">
          <div className="sp-container--narrow">
            <Reveal>
              <div className="sp-faq__head">
                <SectionLabel>FAQ</SectionLabel>
                <h2>Frequently Asked Questions</h2>
                <p>
                  Everything you need to know about {data.name.toLowerCase()} at
                  HumanCare Connect.
                </p>
              </div>
            </Reveal>

            <div className="sp-faq__list">
              {data.faqs.map((faq, i) => (
                <Reveal key={i} delay={i * 45}>
                  <FAQItem question={faq.question} answer={faq.answer} />
                </Reveal>
              ))}
            </div>

            <Reveal delay={80}>
              <p className="sp-faq__footer">
                Still have questions?{" "}
                <a href="/contact">Chat with our care team →</a>
              </p>
            </Reveal>
          </div>
        </section>

        {/* ── 6. CTA ─────────────────────────────────────────────────────────── */}
        <section className="sp-cta">
          <div className="sp-cta__glow-top" aria-hidden="true" />
          <div className="sp-cta__glow-bottom" aria-hidden="true" />

          <div className="sp-cta__inner">
            <Reveal>
              <span className="sp-cta__eyebrow">Get Started Today</span>
              <h2 className="sp-cta__heading">
                Ready to Connect with a <span>{data.name}</span> Specialist?
              </h2>
              <p className="sp-cta__sub">
                Get expert ear, nose, and throat care with convenient
                appointments, personalized treatment plans, and ongoing support.
                Schedule an in-person or virtual visit with an ENT specialist
                today.
              </p>
            </Reveal>

            <Reveal delay={80}>
              <div className="sp-cta__actions">
                <a href="/login" className="sp-btn sp-btn--primary-lg">
                  <FiSearch size={18} />
                  Find a Doctor
                </a>
                <a
                  href="/appointment-booking"
                  className="sp-btn sp-btn--ghost-lg"
                >
                  <FiCalendar size={18} />
                  Book Appointment
                </a>
              </div>
            </Reveal>

            <Reveal delay={130}>
              <div className="sp-cta__badges">
                {[
                  { Icon: FiLock, label: "HIPAA Compliant" },
                  { Icon: FiStar, label: "Highly Rated Providers" },
                  { Icon: FiCheckCircle, label: "Verified Specialists" },
                  { Icon: FiShield, label: "Secure Telehealth Platform" },
                ].map((badge, i) => (
                  <div key={i} className="sp-cta__badge">
                    <badge.Icon size={15} className="sp-cta__badge-icon" />
                    <span>{badge.label}</span>
                  </div>
                ))}
              </div>
            </Reveal>

            {/* <Reveal delay={170}>
            <div className="sp-cta__contact">
              <a href="tel:+918008001234" className="sp-cta__contact-link">
                <FiPhone size={14} />
                +91 800 800 1234
              </a>
              <a href="mailto:care@humancareconnect.co" className="sp-cta__contact-link">
                <FiMail size={14} />
                care@humancareconnect.co
              </a>
              <span className="sp-cta__contact-item">
                <FiClock size={14} />
                Mon – Sun, 8 AM – 10 PM IST
              </span>
            </div>
          </Reveal> */}
          </div>
        </section>
      </main>
    </>
  );
}
