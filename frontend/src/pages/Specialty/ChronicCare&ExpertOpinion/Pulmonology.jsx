import { useNavigate, Link } from "react-router-dom";
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
} from "react-icons/fi";
import {
  MdOutlineVaccines,
  MdOutlineBloodtype,
  MdOutlinePsychology,
  MdOutlineHealthAndSafety,
  MdOutlineSpa,
  MdOutlineMonitorHeart,
  MdOutlineBiotech,
} from "react-icons/md";
import {
  GiHeartOrgan,
  GiLungs,
  GiBrain,
  GiBoneKnife,
  GiMedicines,
  GiBodySwapping,
} from "react-icons/gi";
import "../SpecialtyPage.css";

import heroImage from "../../../assets/SpecialitiesImage/pulmonology-specialist-lung-respiratory-care.webp";
import overviewImage from "../../../assets/SpecialitiesImage/pulmonology-lung-health-consultation.webp";
import BookingCard from "../../../components/SpecialityBookingCard";
import api from "../../../api";
import SEO from "../../../components/Seo";

// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "pulmonology",
  name: "Pulmonology",
  categoryId: "chronic",
  tagline: "Helping You Breathe Easier with Expert Respiratory Care.",
  heroDescription:
    "Pulmonology specialists diagnose and treat conditions affecting the lungs, airways, and respiratory system. From asthma and chronic cough to COPD, sleep apnea, and post-COVID respiratory concerns, pulmonologists provide comprehensive care designed to improve breathing, lung function, and overall quality of life.",
  heroImage: heroImage,
  heroAlt:
    "Board-certified pulmonology specialist providing expert diagnosis and treatment for asthma, COPD, lung disease, sleep apnea, and respiratory disorders.",
  overviewImage: overviewImage,
  overviewAlt:
    "Pulmonology specialist consulting with a patient about lung health, breathing problems, asthma, COPD, sleep apnea, and respiratory disease treatment.",
  overviewDescription:
    "Pulmonology is a medical specialty focused on the prevention, diagnosis, and treatment of diseases affecting the lungs and respiratory system. Pulmonologists evaluate breathing difficulties, chronic respiratory symptoms, sleep-related breathing disorders, and complex lung conditions to help patients achieve better respiratory health.",
  overviewImportance:
    "Through advanced assessments, personalized treatment plans, medication management, and ongoing monitoring, pulmonology specialists help patients manage chronic lung diseases, improve breathing capacity, and reduce the impact of respiratory symptoms on daily life.",
  conditionsTreated:
    "Pulmonology specialists diagnose and manage asthma, COPD, chronic cough, sleep apnea, shortness of breath, post-COVID respiratory symptoms, and other lung-related conditions.",
  whenToConsult:
    "Schedule a visit with a pulmonology specialist if you experience persistent cough, wheezing, shortness of breath, breathing difficulties, sleep-related breathing issues, recurrent respiratory infections, or ongoing lung health concerns.",

  keyServices: [
    {
      Icon: FiActivity,
      title: "Respiratory Health Evaluations",
      description:
        "Comprehensive assessments to identify lung conditions, breathing disorders, and respiratory symptoms.",
    },
    {
      Icon: FiThermometer,
      title: "Asthma Management",
      description:
        "Personalized treatment plans to control asthma symptoms, reduce flare-ups, and improve lung function.",
    },
    {
      Icon: MdOutlineVaccines,
      title: "COPD Care & Monitoring",
      description:
        "Ongoing management of chronic obstructive pulmonary disease to support respiratory health and quality of life.",
    },
    {
      Icon: FiDroplet,
      title: "Sleep Breathing Disorder Care",
      description:
        "Evaluation and treatment of sleep apnea and other conditions affecting breathing during sleep.",
    },
    {
      Icon: MdOutlineSpa,
      title: "Chronic Cough & Breathing Symptom Management",
      description:
        "Diagnosis and treatment of persistent cough, wheezing, and respiratory discomfort.",
    },
    {
      Icon: FiUsers,
      title: "Post-COVID Respiratory Recovery",
      description:
        "Specialized support for lingering respiratory symptoms following COVID-19 infection.",
    },
  ],

  benefits: [
    {
      Icon: FiSearch,
      title: "Improved Breathing Function",
      description:
        "Helps patients breathe more comfortably and manage respiratory symptoms effectively.",
    },
    {
      Icon: FiTrendingUp,
      title: "Early Detection of Lung Conditions",
      description:
        "Identifies respiratory diseases before they progress into more serious health complications.",
    },
    {
      Icon: FiShield,
      title: "Better Sleep & Energy Levels",
      description:
        "Treating sleep-related breathing disorders can improve sleep quality and daytime functioning.",
    },
    {
      Icon: FiHeart,
      title: "Long-Term Respiratory Wellness",
      description:
        "Supports healthy lung function and ongoing management of chronic respiratory conditions.",
    },
  ],

  conditions: [
    {
      Icon: GiHeartOrgan,
      name: "Asthma",
      // desc: "Support for healthy infant feeding",
      path: "/chronic-care/pulmonology/asthma",
    },
    {
      Icon: FiHeart,
      name: "COPD",
      // desc: "Cold and flu symptoms in children",
      path: "/chronic-care/pulmonology/copd",
    },
    {
      Icon: FiZap,
      name: "Persistent cough",
      // desc: "Fever and illness in children",
      path: "/chronic-care/pulmonology/persistent-cough",
    },
    {
      Icon: MdOutlineBloodtype,
      name: "Shortness of breath",
      // desc: "Red, itchy, irritated skin in kids",
      path: "/chronic-care/pulmonology/shortness-of-breath",
    },
    {
      Icon: FiTrendingUp,
      name: "Sleep apnea screening",
      // desc: "Red, itchy, irritated skin in kids",
      path: "/chronic-care/pulmonology/sleep-apnea-screening",
    },
    {
      Icon: FiTarget,
      name: "Post-COVID concerns",
      // desc: "Red, itchy, irritated skin in kids",
      path: "post-covid-concerns",
    },
  ],

  faqs: [
    {
      question: "What is pulmonology?",
      answer:
        "Pulmonology is the medical specialty focused on diagnosing and treating conditions affecting the lungs, airways, and respiratory system.",
    },
    {
      question: "What conditions do pulmonologists treat?",
      answer:
        "Pulmonologists treat asthma, COPD, chronic cough, sleep apnea, respiratory infections, lung diseases, and breathing disorders.",
    },
    {
      question: "When should I see a pulmonologist?",
      answer:
        "You should see a pulmonologist if you experience persistent cough, shortness of breath, wheezing, sleep-related breathing issues, or ongoing respiratory symptoms.",
    },
    {
      question: "What is asthma?",
      answer:
        "Asthma is a chronic respiratory condition that causes airway inflammation, wheezing, chest tightness, coughing, and breathing difficulties.",
    },
    {
      question: "What is COPD?",
      answer:
        "COPD is a progressive lung disease that causes airflow obstruction, chronic cough, mucus production, and breathing difficulties.",
    },
    {
      question: "What causes shortness of breath?",
      answer:
        "Shortness of breath can result from asthma, COPD, lung disease, heart conditions, infections, or other medical issues.",
    },
    {
      question: "When should a chronic cough be evaluated?",
      answer:
        "A cough lasting more than several weeks or recurring frequently should be evaluated by a healthcare provider.",
    },
    {
      question: "What is sleep apnea?",
      answer:
        "Sleep apnea is a sleep disorder characterized by repeated pauses in breathing during sleep, often causing poor sleep quality and fatigue.",
    },
    {
      question: "Can pulmonologists help with post-COVID symptoms?",
      answer:
        "Yes. Pulmonologists evaluate and manage lingering respiratory symptoms, breathing difficulties, and lung health concerns after COVID-19.",
    },
    {
      question: "What tests do pulmonologists use?",
      answer:
        "Common evaluations may include pulmonary function tests, imaging studies, sleep studies, laboratory testing, and respiratory assessments.",
    },
    {
      question: "Can asthma be controlled?",
      answer:
        "Yes. Most people with asthma can effectively manage symptoms through medications, trigger avoidance, and ongoing monitoring.",
    },
    {
      question: "Is COPD curable?",
      answer:
        "COPD cannot be cured, but proper treatment can help control symptoms and improve quality of life.",
    },
    {
      question: "What causes wheezing?",
      answer:
        "Wheezing is often caused by narrowed airways due to asthma, allergies, infections, COPD, or other respiratory conditions.",
    },
    {
      question: "Can respiratory conditions affect sleep?",
      answer:
        "Yes. Conditions such as sleep apnea, asthma, and chronic breathing problems can significantly impact sleep quality.",
    },
    {
      question: "Are telehealth pulmonology appointments available?",
      answer:
        "Yes. Many respiratory consultations, follow-up visits, medication reviews, and treatment discussions can be conducted virtually.",
    },
    {
      question: "How can I improve my lung health?",
      answer:
        "Avoid smoking, stay physically active, follow treatment recommendations, manage allergies, and seek regular medical care.",
    },
    {
      question: "What are common warning signs of lung disease?",
      answer:
        "Persistent cough, shortness of breath, wheezing, chest tightness, recurring infections, and reduced exercise tolerance should be evaluated.",
    },
    {
      question:
        "How can I schedule an appointment with a pulmonology specialist?",
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
      "Receive care from experienced neurologists dedicated to diagnosing and managing neurological conditions.",
  },
  {
    Icon: FiZap,
    title: "Fast Appointments",
    description:
      "Schedule neurological consultations quickly with convenient appointment availability.",
  },
  {
    Icon: FiMonitor,
    title: "Telehealth Access",
    description:
      "Connect securely with neurology specialists through virtual consultations and follow-up appointments.",
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
      "Benefit from individualized neurological treatment plans based on your symptoms and health goals.",
  },
  {
    Icon: FiGlobe,
    title: "Global Provider Network",
    description:
      "Access a broad network of neurology specialists and coordinated healthcare services.",
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
function ConditionCard({ Icon, name, description, delay, path }) {
  const cardContent = (
    <div
      className="sp-condition-card"
      style={{ cursor: path ? "pointer" : "default", height: "100%" }}
    >
      <h3 className="sp-condition-card__title">{name}</h3>
      <p className="sp-condition-card__desc">{description}</p>
      <span
        className="sp-condition-card__link"
        aria-label={`Learn more about ${name}`}
      >
        Learn more <FiArrowRight size={13} />
      </span>
    </div>
  );

  return (
    <Reveal delay={delay}>
      {path ? (
        <Link
          to={path}
          style={{
            textDecoration: "none",
            color: "inherit",
            display: "block",
            height: "100%",
          }}
        >
          {cardContent}
        </Link>
      ) : (
        cardContent
      )}
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
export default function Pulmonology({ data = SPECIALTY_DATA }) {
  const navigate = useNavigate();
  const [heroLoaded, setHeroLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);
  const [price, setPrice] = useState(null);
  const [priceLoading, setPriceLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchPrice() {
      try {
        const res = await api.get("/api/pricing");
        if (!cancelled) {
          const record = res.data?.[data.categoryId];
          setPrice(record?.price ?? null);
        }
      } catch (err) {
        console.error("Failed to fetch category pricing:", err);
      } finally {
        if (!cancelled) setPriceLoading(false);
      }
    }
    fetchPrice();
    return () => {
      cancelled = true;
    };
  }, [data.categoryId]);

  return (
    <>
      <SEO
        title="Pulmonology Specialists | Lung & Respiratory Health Care"
        description="Get expert pulmonology care for asthma, COPD, chronic cough, shortness of breath, sleep apnea, and post-COVID respiratory concerns."
        keywords="online pulmonologist, pulmonology consultation, lung specialist online, asthma treatment, COPD management, chronic cough treatment, shortness of breath, sleep apnea care, respiratory specialist, virtual lung doctor, telehealth pulmonology, respiratory care online"
        url="https://humancareconnect.co/pulmonology"
      />
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
            <div className="sp-hero__layout">
              <div
                className={`sp-hero__content-inner${
                  heroLoaded ? " sp-hero__content-inner--loaded" : ""
                }`}
              >
                <span className="sp-hero__badge">Child & Family Care</span>
                <h1 className="sp-hero__title">{data.name}</h1>
                <p className="sp-hero__tagline">{data.tagline}</p>
                <p className="sp-hero__description">{data.heroDescription}</p>
              </div>

              <BookingCard
                price={price}
                priceLoading={priceLoading}
                title={data.name}
                specialitySlug={data.slug}
              />
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
              <div
                className="sp-conditions__head"
                onClick={() => navigate("/conditions")}
                style={{ cursor: "pointer" }}
              >
                <SectionLabel>Conditions &amp; Symptoms</SectionLabel>
                <h2>What We Treat</h2>
                <p>
                  Our {data.name.toLowerCase()} specialists diagnose and manage
                  a wide range of respiratory conditions affecting the lungs,
                  airways, and breathing function.
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
                  We combine experienced neurology specialists with advanced
                  technology to make neurological care more accessible,
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
                <a href="/contact-us">Chat with our care team →</a>
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
                Take control of your respiratory health with expert pulmonology
                care, personalized treatment plans, and convenient appointment
                options. Schedule an in-person or virtual visit with a
                pulmonology specialist today.
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
