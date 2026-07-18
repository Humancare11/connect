import { useNavigate, Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { HelmetProvider } from "react-helmet-async";

import {
  FiAward,
  FiGlobe,
  FiHeart,
  FiMonitor,
  FiShield,
  FiZap,
  FiActivity,
  FiUsers,
  FiClock,
  FiSearch,
  FiCalendar,
  FiPhone,
  FiMail,
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
  FiBatteryCharging,
  FiCloud,
  FiUserCheck,
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
import heroImage from "../../../assets/SpecialitiesImage/internal-medicine-specialist-adult-healthcare-banner.webp";
import overviewImage from "../../../assets/SpecialitiesImage/internal-medicine-doctor-adult-health-consultation.webp";
import BookingCard from "../../../components/SpecialityBookingCard";
import api from "../../../api";
// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "internal-medicine",
  name: "Internal Medicine",
  categoryId: "general",

  tagline: "Comprehensive Adult Healthcare for Complex Medical Needs.",
  heroDescription:
    "Internal Medicine specialists focus on the prevention, diagnosis, and treatment of adult health conditions, ranging from routine wellness care to complex medical concerns involving multiple body systems. Internists provide comprehensive, evidence-based care designed to help adults maintain optimal health and manage both acute and chronic conditions.",
  heroImage: heroImage,
  heroAlt:
    "Internal medicine specialist providing comprehensive adult healthcare consultation for chronic disease management, preventive care, and complex medical conditions.",
  overviewImage: overviewImage,
  overviewAlt:
    "Internal medicine doctor discussing symptoms, medications, and treatment options with an adult patient during a comprehensive health evaluation.",
  overviewDescription:
    "Internal Medicine is a medical specialty dedicated to the comprehensive care of adults. Internal medicine physicians, also known as internists, are highly trained in diagnosing, treating, and preventing a broad range of medical conditions that affect adults throughout every stage of life.",
  overviewImportance:
    "Internists specialize in managing complex health issues, chronic diseases, unexplained symptoms, and conditions involving multiple organ systems. Their expertise allows them to coordinate care, interpret diagnostic findings, review medications, and provide personalized treatment plans that support long-term health and wellness.",
  conditionsTreated:
    "Internal medicine specialists evaluate chronic illnesses, complex medical conditions, unexplained symptoms, medication-related concerns, preventive health needs, and conditions affecting multiple body systems.",
  whenToConsult:
    "Schedule a visit with an internal medicine specialist if you have multiple health conditions, unexplained symptoms, chronic diseases, medication concerns, preventive care needs, or require a comprehensive adult health evaluation.",

  keyServices: [
    {
      Icon: FiClipboard,
      title: "Comprehensive Adult Health Evaluations",
      description:
        "Detailed assessments of overall health, medical history, risk factors, and ongoing healthcare needs.",
    },
    {
      Icon: FiHeart,
      title: "Chronic Disease Management",
      description:
        "Long-term care for conditions such as hypertension, diabetes, high cholesterol, thyroid disorders, and other chronic illnesses.",
    },
    {
      Icon: FiTool,
      title: "Medication Review & Optimization",
      description:
        "Evaluation of medications to ensure safety, effectiveness, and appropriate management of treatment plans.",
    },
    {
      Icon: FiShield,
      title: "Preventive Health Screenings",
      description:
        "Routine health screenings, risk assessments, and wellness services designed to prevent disease and detect health issues early.",
    },
    {
      Icon: FiSearch,
      title: "Diagnostic Evaluation of Complex Symptoms",
      description:
        "Investigation of unexplained symptoms and conditions involving multiple body systems.",
    },
    {
      Icon: FiUsers,
      title: "Coordinated Specialty Care",
      description:
        "Collaboration with specialists and healthcare providers to ensure comprehensive patient care and treatment continuity.",
    },
  ],

  benefits: [
    {
      Icon: FiUserCheck,
      title: "Expert Adult Healthcare",
      description:
        "Provides specialized medical care focused exclusively on adult health concerns.",
    },
    {
      Icon: FiHeart,
      title: "Comprehensive Disease Management",
      description:
        "Helps patients effectively manage chronic conditions and complex medical issues.",
    },
    {
      Icon: FiSearch,
      title: "Early Detection & Prevention",
      description:
        "Identifies health risks early through screenings, evaluations, and preventive care strategies.",
    },
    {
      Icon: FiUsers,
      title: "Personalized Long-Term Care",
      description:
        "Builds ongoing relationships that support better health outcomes and continuity of care.",
    },
  ],

  conditions: [
    {
      Icon: FiTool,
      name: "Medication Review",
      path: "/medication-review",
      description:
        "Comprehensive evaluation of medications to ensure safe use, identify interactions, and optimize treatment effectiveness.",
    },
    {
      Icon: FiCrosshair,
      name: "Multi-System Complaints",
      path: "/general-and-everyday-care/internal-medicine/multi-system-complaints",
      description:
        "Assessment of symptoms affecting multiple organs or body systems that require a coordinated medical evaluation.",
    },
    {
      Icon: FiSearch,
      name: "Preventive Screening",
      path: "/general-and-everyday-care/internal-medicine/preventive-screening",
      description:
        "Routine screenings and risk assessments to detect disease early and support long-term health.",
    },
    {
      Icon: FiAlertCircle,
      name: "Undiagnosed Symptoms",
      path: "/general-and-everyday-care/internal-medicine/undiagnosed-symptoms",
      description:
        "Investigation of persistent symptoms that have not yet received a clear diagnosis.",
    },
    {
      Icon: FiHeart,
      name: "Hypertension",
      description:
        "Management of high blood pressure to reduce cardiovascular risks and support overall health.",
    },
    {
      Icon: MdOutlineBloodtype,
      name: "Type 2 Diabetes",
      path: "/chronic-care/endocrinology/type-2-diabetes",
      description:
        "Long-term monitoring and treatment to maintain healthy blood sugar levels and prevent complications.",
    },
    {
      Icon: FiTrendingUp,
      name: "High Cholesterol",
      path: "/chronic-care/cardiology/high-cholesterol",
      description:
        "Evaluation and treatment of cholesterol disorders to support heart and vascular health.",
    },
    {
      Icon: MdOutlineBiotech,
      name: "Thyroid Disorders",
      path: "/chronic-care/endocrinology/thyroid-disorders",
      description:
        "Diagnosis and management of thyroid-related conditions affecting metabolism, energy levels, and overall wellness.",
    },
    {
      Icon: FiBatteryCharging,
      name: "Chronic Fatigue",
      description:
        "Assessment of persistent tiredness, low energy, and underlying medical causes.",
    },
    {
      Icon: FiActivity,
      name: "Unexplained Weight Changes",
      description:
        "Evaluation of unexpected weight gain or loss and associated medical concerns.",
    },
    {
      Icon: FiUsers,
      name: "Multiple Chronic Conditions",
      description:
        "Coordinated care for patients managing several health conditions simultaneously.",
    },
    {
      Icon: FiHeart,
      name: "General Adult Health Concerns",
      description:
        "Comprehensive care for non-emergency medical issues affecting adults across all stages of life.",
    },
  ],

  faqs: [
    {
      question: "What is internal medicine?",
      answer:
        "Internal medicine is a medical specialty focused on the prevention, diagnosis, and treatment of diseases affecting adults.",
    },
    {
      question: "What does an internal medicine specialist treat?",
      answer:
        "Internal medicine specialists treat chronic diseases, complex medical conditions, preventive health concerns, unexplained symptoms, and adult healthcare needs.",
    },
    {
      question: "How is internal medicine different from family medicine?",
      answer:
        "Internal medicine focuses exclusively on adult healthcare, while family medicine provides care for patients of all ages.",
    },
    {
      question: "When should I see an internal medicine specialist?",
      answer:
        "You should consider seeing an internist for chronic disease management, complex symptoms, preventive care, or ongoing adult healthcare needs.",
    },
    {
      question: "What is a medication review?",
      answer:
        "A medication review evaluates prescriptions, supplements, and treatment plans to ensure safety, effectiveness, and proper use.",
    },
    {
      question: "Why are preventive screenings important?",
      answer:
        "Preventive screenings help identify health conditions early, often before symptoms develop, allowing for earlier treatment and better outcomes.",
    },
    {
      question: "What are multi-system complaints?",
      answer:
        "Multi-system complaints involve symptoms affecting multiple organs or body systems and often require a comprehensive medical evaluation.",
    },
    {
      question:
        "Can internal medicine specialists diagnose unexplained symptoms?",
      answer:
        "Yes. Internists are trained to investigate complex and undiagnosed symptoms through detailed evaluations and testing.",
    },
    {
      question: "Can an internist manage diabetes?",
      answer:
        "Yes. Internal medicine specialists commonly manage diabetes and related health concerns.",
    },
    {
      question: "Do internal medicine physicians treat hypertension?",
      answer:
        "Yes. They diagnose, monitor, and manage high blood pressure and cardiovascular risk factors.",
    },
    {
      question: "Can internal medicine specialists coordinate specialist care?",
      answer:
        "Yes. Internists frequently work with specialists and coordinate treatment plans for patients with complex conditions.",
    },
    {
      question: "What happens during an internal medicine appointment?",
      answer:
        "Your provider will review your medical history, symptoms, medications, health risks, and recommend appropriate testing or treatment.",
    },
    {
      question: "Are telehealth appointments available?",
      answer:
        "Yes. Many consultations, follow-up visits, medication reviews, and chronic disease management appointments can be conducted virtually.",
    },
    {
      question: "Can internal medicine specialists treat thyroid disorders?",
      answer:
        "Yes. Internists commonly diagnose and manage hypothyroidism, hyperthyroidism, and other thyroid-related conditions.",
    },
    {
      question: "How often should adults have preventive screenings?",
      answer:
        "Screening recommendations vary based on age, health history, risk factors, and medical guidelines.",
    },
    {
      question: "Can internal medicine specialists help with chronic fatigue?",
      answer:
        "Yes. They evaluate potential medical causes of fatigue and develop personalized treatment strategies.",
    },
    {
      question: "Why is continuity of care important?",
      answer:
        "Long-term relationships with a healthcare provider help improve disease management, preventive care, and overall health outcomes.",
    },
    {
      question:
        "How can I schedule an appointment with an internal medicine specialist?",
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
      "Receive care from experienced internists dedicated to comprehensive adult healthcare.",
  },
  {
    Icon: FiClock,
    title: "Fast Appointments",
    description:
      "Schedule consultations quickly with convenient appointment availability.",
  },
  {
    Icon: FiMonitor,
    title: "Telehealth Access",
    description:
      "Connect securely with internal medicine specialists through virtual consultations and follow-up visits.",
  },
  {
    Icon: FiShield,
    title: "Insurance Support",
    description:
      "Receive assistance understanding healthcare coverage, authorizations, and billing-related questions.",
  },
  {
    Icon: FiUserCheck,
    title: "Personalized Care",
    description:
      "Benefit from individualized treatment plans based on your medical history, symptoms, and health goals.",
  },
  {
    Icon: FiUsers,
    title: "Nationwide Provider Network",
    description:
      "Access a broad network of healthcare professionals and coordinated specialty care services.",
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
export default function InternalMedicine({ data = SPECIALTY_DATA }) {
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
      <HelmetProvider>
        <title>
          Internal Medicine Specialists | Adult Health & Complex Care
        </title>
        <meta
          name="description"
          content="Get expert internal medicine care for medication reviews, preventive screenings, unexplained symptoms, chronic conditions, and complex adult health concerns."
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
            <div className="sp-hero__layout">
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
                  <a
                    href="/appointment-booking"
                    className="sp-btn sp-btn--ghost"
                  >
                    <FiCalendar size={17} />
                    Book Appointment
                  </a>
                </div>
              </div>

              <Reveal className="sp-hero__sidebar">
                <BookingCard
                  price={price}
                  priceLoading={priceLoading}
                  categoryId={data.categoryId}
                  name={data.name}
                />
              </Reveal>
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
                <SectionLabel>Conditions & Symptoms</SectionLabel>
                <h2>What We Treat</h2>
                <p>
                  Our family medicine specialists provide comprehensive care for
                  a wide range of health concerns affecting individuals and
                  families across every stage of life.
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
                  We combine experienced family medicine providers with advanced
                  technology to make primary healthcare more accessible,
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
              <span className="sp-cta__eyebrow">GET STARTED TODAY</span>
              <h2 className="sp-cta__heading">
                Ready to Connect with a<span>{data.name}</span> Specialist?
              </h2>
              <p className="sp-cta__sub">
                Take charge of your family's health with expert primary care,
                preventive services, and personalized healthcare support.
                Schedule an in-person or virtual visit with a family medicine
                specialist today.
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
