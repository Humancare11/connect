import { useNavigate, Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
// import { HelmetProvider } from "react-helmet-async";
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
import { Helmet, HelmetProvider } from "react-helmet-async";

import heroImage from "../../../assets/SpecialitiesImage/endocrinology-specialist-hormone-metabolic-care.webp";
import overviewImage from "../../../assets/SpecialitiesImage/board-certified-endocrinologist-hormone-health-consultation.webp";
import BookingCard from "../../../components/SpecialityBookingCard";
import api from "../../../api";
import SEO from "../../../components/Seo";

// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "endocrinology",
  name: "Endocrinology",
  categoryId: "chronic",
  tagline: "Expert Care for Hormonal Health and Metabolic Wellness.",
  heroDescription:
    "Endocrinology specialists diagnose and treat conditions related to hormones, glands, metabolism, and the endocrine system. From managing diabetes and thyroid disorders to treating hormone imbalances and bone health concerns, endocrinologists help patients achieve better health through personalized, evidence-based care.",
  heroImage: heroImage,
  heroAlt:
    "Board-certified endocrinologist consulting with a patient about hormone disorders, diabetes, thyroid health, and metabolic care",
  overviewImage: overviewImage,
  overviewAlt:
    "Board-certified endocrinologist reviewing hormone test results and providing personalized endocrine care consultation",
  overviewDescription:
    "Endocrinology is a medical specialty focused on the endocrine system, which includes glands that produce hormones regulating metabolism, growth, reproduction, energy levels, and many other essential bodily functions. When hormone levels become imbalanced, they can affect multiple aspects of health and overall well-being.",
  overviewImportance:
    "Endocrinologists specialize in diagnosing, treating, and managing hormonal and metabolic disorders through advanced testing, lifestyle guidance, medication management, and ongoing monitoring. Their goal is to restore hormonal balance, improve symptoms, prevent complications, and support long-term health outcomes.",
  conditionsTreated:
    "Endocrinology specialists diagnose and manage hormone imbalances, thyroid disorders, diabetes, osteoporosis, metabolic conditions, and other disorders affecting the endocrine system.",
  whenToConsult:
    "Schedule a visit with an endocrinology specialist if you experience unexplained weight changes, fatigue, hormone-related symptoms, blood sugar concerns, thyroid issues, bone health problems, or have been diagnosed with an endocrine disorder requiring specialized care.",

  keyServices: [
    {
      Icon: FiActivity,
      title: "Hormone Evaluation & Management",
      description:
        "Comprehensive assessment and treatment of hormone imbalances affecting energy, metabolism, mood, growth, and reproductive health.",
    },
    {
      Icon: FiDroplet,
      title: "Diabetes Care & Monitoring",
      description:
        "Personalized treatment plans for Type 1 and Type 2 diabetes, including blood sugar management and long-term health monitoring.",
    },
    {
      Icon: FiThermometer,
      title: "Thyroid Disorder Treatment",
      description:
        "Diagnosis and management of hypothyroidism, hyperthyroidism, thyroid nodules, and other thyroid-related conditions.",
    },
    {
      Icon: MdOutlineSpa,
      title: "Osteoporosis & Bone Health Care",
      description:
        "Evaluation and treatment strategies to strengthen bones, improve bone density, and reduce fracture risk.",
    },
    {
      Icon: FiActivity,
      title: "Metabolic Health Management",
      description:
        "Support for metabolism-related disorders, weight concerns, insulin resistance, and endocrine-related health conditions.",
    },
    {
      Icon: FiUsers,
      title: "Preventive Endocrine Care",
      description:
        "Routine monitoring, risk assessments, and long-term management plans to help prevent complications from endocrine disorders.",
    },
  ],

  benefits: [
    {
      Icon: FiActivity,
      title: "Restored Hormonal Balance",
      description:
        "Helps regulate hormone levels to improve overall health, energy, mood, and quality of life.",
    },
    {
      Icon: FiHeart,
      title: "Better Disease Management",
      description:
        "Provides specialized care for chronic endocrine conditions such as diabetes and thyroid disorders.",
    },
    {
      Icon: FiShield,
      title: "Prevention of Long-Term Complications",
      description:
        "Early diagnosis and ongoing monitoring help reduce the risk of serious health complications.",
    },
    {
      Icon: FiTrendingUp,
      title: "Improved Metabolic Health",
      description:
        "Supports healthy metabolism, blood sugar control, bone strength, and long-term wellness.",
    },
  ],

  conditions: [
    {
      Icon: FiActivity,
      name: "Thyroid disorders",
      desc: "Cold and flu symptoms in children",
      path: "/chronic-care/endocrinology/thyroid-disorders",
    },
    {
      Icon: FiTrendingUp,
      name: "Diabetes Type 2",
      desc: "Fever and illness in children",
      path: "/chronic-care/endocrinology/type-2-diabetes",
    },
    {
      Icon: FiThermometer,
      name: "Hormone imbalance",
      desc: "Red, itchy, irritated skin in kids",
      path: "/chronic-care/endocrinology/chronic-care/endocrinology/hormone-imbalance",
    },
    {
      Icon: FiDroplet,
      name: "Osteoporosis",
      desc: "Red, itchy, irritated skin in kids",
      path: "/chronic-care/endocrinology/osteoporosis",
    },
  ],

  faqs: [
    {
      question: "What is endocrinology?",
      answer:
        "Endocrinology is the medical specialty focused on diagnosing and treating hormone-related and metabolic disorders affecting the endocrine system.",
    },
    {
      question: "What does an endocrinologist treat?",
      answer:
        "Endocrinologists treat diabetes, thyroid disorders, hormone imbalances, osteoporosis, adrenal disorders, PCOS, and other endocrine conditions.",
    },
    {
      question: "When should I see an endocrinologist?",
      answer:
        "You should consider seeing an endocrinologist for hormone imbalances, diabetes, thyroid issues, unexplained weight changes, or metabolic disorders.",
    },
    {
      question: "What are common symptoms of hormone imbalance?",
      answer:
        "Symptoms may include fatigue, weight changes, mood fluctuations, irregular periods, low energy, and changes in metabolism.",
    },
    {
      question: "What causes hormone imbalances?",
      answer:
        "Hormone imbalances can result from endocrine disorders, aging, stress, medical conditions, medications, or gland dysfunction.",
    },
    {
      question: "Can endocrinologists help manage diabetes?",
      answer:
        "Yes. Endocrinologists specialize in diabetes management, including blood sugar monitoring, medication adjustments, and complication prevention.",
    },
    {
      question: "What are thyroid disorders?",
      answer:
        "Thyroid disorders are conditions that affect thyroid hormone production, including hypothyroidism, hyperthyroidism, and thyroid nodules.",
    },
    {
      question: "What is osteoporosis?",
      answer:
        "Osteoporosis is a condition that weakens bones, making them more likely to fracture or break.",
    },
    {
      question: "Can endocrinologists help with weight management?",
      answer:
        "Yes. Endocrinologists evaluate hormonal and metabolic factors that may contribute to weight gain or difficulty losing weight.",
    },
    {
      question: "What is insulin resistance?",
      answer:
        "Insulin resistance occurs when the body's cells do not respond effectively to insulin, increasing the risk of Type 2 diabetes.",
    },
    {
      question: "What tests do endocrinologists perform?",
      answer:
        "Common tests include hormone panels, blood glucose testing, thyroid function tests, bone density scans, and metabolic evaluations.",
    },
    {
      question: "Is PCOS treated by an endocrinologist?",
      answer:
        "Yes. Endocrinologists often diagnose and manage PCOS, including hormone regulation and metabolic health concerns.",
    },
    {
      question: "Can hormone imbalances affect mental health?",
      answer:
        "Yes. Hormonal changes can influence mood, anxiety levels, energy, sleep, and emotional well-being.",
    },
    {
      question: "Are telehealth endocrinology appointments available?",
      answer:
        "Yes. Many consultations, follow-ups, medication reviews, and treatment discussions can be conducted through secure telehealth visits.",
    },
    {
      question: "How often should endocrine conditions be monitored?",
      answer:
        "Monitoring frequency depends on the condition, treatment plan, and individual health needs.",
    },
    {
      question: "Can endocrine disorders be cured?",
      answer:
        "Some endocrine conditions can be resolved, while others require ongoing management and long-term monitoring.",
    },
    {
      question: "What lifestyle changes support endocrine health?",
      answer:
        "A healthy diet, regular exercise, adequate sleep, stress management, and following treatment recommendations help support endocrine function.",
    },
    {
      question:
        "How can I schedule an appointment with an endocrinology specialist?",
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
      "Receive care from experienced endocrinology providers who deliver evidence-based treatment and long-term disease management.",
  },
  {
    Icon: FiZap,
    title: "Fast Appointments",
    description:
      "Schedule consultations quickly with convenient availability for both routine and urgent endocrine concerns.",
  },
  {
    Icon: FiMonitor,
    title: "Telehealth Access",
    description:
      "Connect securely with endocrinology specialists through virtual visits for consultations, follow-ups, and treatment monitoring.",
  },
  {
    Icon: FiShield,
    title: "Insurance Support",
    description:
      "Receive guidance regarding insurance coverage, authorizations, and billing-related questions.",
  },
  {
    Icon: FiHeart,
    title: "Personalized Care",
    description:
      "Benefit from individualized treatment plans tailored to your symptoms, diagnosis, health goals, and lifestyle.",
  },
  {
    Icon: FiGlobe,
    title: "Global Provider Network",
    description:
      "Access a broad network of specialists and coordinated endocrine care services wherever you need support.",
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
export default function SpecialtyPage({ data = SPECIALTY_DATA }) {
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
        title="Endocrinology Specialists | Hormone & Metabolic Health Care"
        description="Get expert endocrinology care for hormone imbalances, thyroid disorders, diabetes, osteoporosis, and metabolic conditions with personalized treatment plans."
        keywords="Endocrinology specialists, Hormone health, Online doctor appointment, Telemedicine services"
        url="https://humancareconnect.co/endocrinology"
      />
      <main className="sp-page">
        {/* ── 1. HERO ────────────────────────────────────────────────────────── */}
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
                  a wide range of hormonal, metabolic, and endocrine disorders
                  through personalized treatment and ongoing care.
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
                  We combine experienced endocrinology specialists with advanced
                  technology to make quality hormone and metabolic healthcare
                  accessible, convenient, and personalized.
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
                Take control of your hormonal and metabolic health with expert
                endocrinology care, personalized treatment plans, and convenient
                appointment options. Schedule an in-person or virtual visit with
                an endocrinology specialist today.
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
                  { Icon: FiStar, label: "4.9/5 Patient Rating" },
                  { Icon: FiCheckCircle, label: "Verified Providers" },
                  { Icon: FiShield, label: "100% Secure Platform" },
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
                <a
                  href="mailto:care@humancareconnect.co"
                  className="sp-cta__contact-link"
                >
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
