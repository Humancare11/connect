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

import heroImage from "../../../assets/SpecialitiesImage/general-physician-primary-care-consultation-banner.webp";
import overviewImage from "../../../assets/SpecialitiesImage/general-physician-patient-health-checkup.webp";
import BookingCard from "../../../components/SpecialityBookingCard";
import api from "../../../api";
// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "generalphysician",
  name: "General Physician (GP)",
  categoryId: "general",
  tagline: "Your First Point of Contact for Everyday Healthcare.",
  heroDescription:
    "General Physicians (GPs) provide comprehensive primary healthcare for common illnesses, preventive care, and ongoing health management. Whether you're experiencing a fever, cough, headache, fatigue, or other everyday health concerns, a General Physician can diagnose symptoms, recommend treatment, and guide you toward better overall health.",
  heroImage: heroImage,
  heroAlt:
    "General physician providing primary healthcare consultation for common illnesses, preventive care, and overall wellness.",
  overviewImage: overviewImage,
  overviewAlt:
    "General physician discussing symptoms and treatment options with a patient during a routine primary care consultation.",
  overviewDescription:
    "A General Physician (GP) is a primary care doctor trained to diagnose, treat, and manage a wide range of common medical conditions affecting adults and adolescents. They serve as the first point of contact for most health concerns, helping patients receive timely care, preventive services, and referrals when specialized treatment is needed.",
  overviewImportance:
    "General Physicians focus on whole-person care, addressing acute illnesses, chronic health conditions, preventive screenings, and overall wellness. By understanding your medical history and health goals, they provide personalized care that supports long-term well-being.",
  conditionsTreated:
    "General Physicians diagnose and manage common illnesses including fever, cough, cold and flu, headaches, fatigue, body aches, minor infections, sinus infections, nausea, vomiting, and other everyday health concerns.",
  whenToConsult:
    "Schedule a visit with a General Physician if you experience symptoms such as fever, persistent cough, fatigue, headaches, body aches, digestive issues, infections, or any non-emergency health concern requiring medical attention.",

  keyServices: [
    {
      Icon: FiThermometer,
      title: "Acute Illness Diagnosis & Treatment",
      description:
        "Evaluation and treatment of common illnesses such as colds, flu, infections, coughs, and fever.",
    },
    {
      Icon: FiShield,
      title: "Preventive Healthcare Services",
      description:
        "Routine health screenings, wellness assessments, vaccinations, and preventive care recommendations.",
    },
    {
      Icon: FiHeart,
      title: "Chronic Disease Monitoring",
      description:
        "Ongoing care for common chronic conditions such as hypertension, diabetes, asthma, and high cholesterol.",
    },
    {
      Icon: FiSearch,
      title: "Symptom Evaluation & Management",
      description:
        "Assessment of unexplained symptoms and development of personalized treatment plans.",
    },
    {
      Icon: FiTrendingUp,
      title: "Health Education & Lifestyle Guidance",
      description:
        "Support for nutrition, exercise, stress management, and healthy lifestyle habits.",
    },
    {
      Icon: FiUsers,
      title: "Care Coordination & Referrals",
      description:
        "Referrals to specialists and coordination of care when advanced medical evaluation is needed.",
    },
  ],

  benefits: [
    {
      Icon: FiSearch,
      title: "Early Diagnosis & Treatment",
      description:
        "Identifies health concerns quickly and helps prevent minor conditions from becoming more serious.",
    },
    {
      Icon: FiShield,
      title: "Convenient Everyday Care",
      description:
        "Provides accessible healthcare for common illnesses, routine needs, and preventive services.",
    },
    {
      Icon: FiUsers,
      title: "Continuity of Care",
      description:
        "Builds long-term relationships that support better health outcomes and personalized treatment.",
    },
    {
      Icon: FiHeart,
      title: "Whole-Person Healthcare",
      description:
        "Addresses physical health, preventive care, lifestyle factors, and overall wellness in one place.",
    },
  ],

  conditions: [
    {
      Icon: FiActivity,
      name: "Body Aches",
      path: "/general-and-everyday-care/general-physician/body-aches",
      description:
        "Evaluation and treatment of muscle pain, body soreness, aches, and discomfort associated with illness or physical strain.",
    },
    {
      Icon: FiThermometer,
      name: "Cold & Flu",
      path: "/general-and-everyday-care/general-physician/cold-and-flu",
      description:
        "Diagnosis and management of cold symptoms, influenza, congestion, sore throat, cough, and seasonal illnesses.",
    },
    {
      Icon: FiWind,
      name: "Cough",
      path: "/general-and-everyday-care/general-physician/cough",
      description:
        "Assessment and treatment of acute and persistent cough caused by infections, allergies, or respiratory conditions.",
    },
    {
      Icon: FiBatteryCharging,
      name: "Fatigue",
      path: "/general-and-everyday-care/general-physician/fatigue",
      description:
        "Evaluation of ongoing tiredness, low energy levels, weakness, and unexplained fatigue.",
    },
    {
      Icon: FiAlertCircle,
      name: "Fever",
      path: "/general-and-everyday-care/general-physician/fever",
      description:
        "Diagnosis and treatment of fever, chills, infection-related symptoms, and illness-related temperature changes.",
    },
    {
      Icon: FiTarget,
      name: "Headache",
      path: "/general-and-everyday-care/general-physician/headache",
      description:
        "Management of tension headaches, illness-related headaches, and common headache symptoms.",
    },
    {
      Icon: FiShield,
      name: "Minor Infections",
      path: "/general-and-everyday-care/general-physician/minor-infections",
      description:
        "Treatment for common bacterial and viral infections affecting the respiratory system, skin, urinary tract, and more.",
    },
    {
      Icon: FiDroplet,
      name: "Nausea & Vomiting",
      path: "/general-and-everyday-care/general-physician/nausea-and-vomiting",
      description:
        "Care for digestive symptoms, stomach discomfort, nausea, vomiting, and related health concerns.",
    },
    {
      Icon: FiEye,
      name: "Pink Eye",
      path: "/general-and-everyday-care/general-physician/pink-eye",
      description:
        "Diagnosis and treatment of conjunctivitis causing redness, irritation, discharge, and eye discomfort.",
    },
    {
      Icon: FiCloud,
      name: "Sinus Infection",
      path: "/general-and-everyday-care/general-physician/sinus-infection",
      description:
        "Evaluation and management of sinus pressure, facial pain, congestion, and sinus-related symptoms.",
    },
    {
      Icon: FiCalendar,
      name: "Seasonal Illnesses",
      description:
        "Treatment for common viral illnesses, seasonal infections, and flu-related conditions.",
    },
    {
      Icon: FiHeart,
      name: "General Health Concerns",
      description:
        "Comprehensive evaluation of everyday symptoms, wellness concerns, and non-emergency medical conditions.",
    },
  ],
  faqs: [
    {
      question: "What does a General Physician do?",
      answer:
        "A General Physician diagnoses, treats, and manages a wide range of common illnesses, chronic conditions, and preventive healthcare needs.",
    },
    {
      question: "When should I see a General Physician?",
      answer:
        "You should see a General Physician for common illnesses, routine check-ups, fever, cough, headaches, fatigue, infections, and preventive healthcare.",
    },
    {
      question: "Can a General Physician treat cold and flu symptoms?",
      answer:
        "Yes. General Physicians diagnose and treat colds, influenza, cough, congestion, sore throat, and related symptoms.",
    },
    {
      question: "Can a General Physician prescribe medications?",
      answer:
        "Yes. They can prescribe medications when appropriate for diagnosed conditions and treatment plans.",
    },
    {
      question: "What should I do if I have a persistent fever?",
      answer:
        "A persistent fever should be evaluated by a healthcare provider to determine the underlying cause and appropriate treatment.",
    },
    {
      question: "Can a General Physician treat headaches?",
      answer:
        "Yes. General Physicians evaluate common headache causes and recommend treatment based on symptoms and medical history.",
    },
    {
      question: "What causes fatigue?",
      answer:
        "Fatigue can result from illness, stress, poor sleep, nutritional deficiencies, chronic conditions, or lifestyle factors.",
    },
    {
      question: "Can a General Physician treat minor infections?",
      answer:
        "Yes. They diagnose and manage many common bacterial and viral infections.",
    },
    {
      question: "What is pink eye?",
      answer:
        "Pink eye, or conjunctivitis, is an inflammation of the eye causing redness, irritation, discharge, and discomfort.",
    },
    {
      question: "Can a General Physician help with sinus infections?",
      answer:
        "Yes. They evaluate sinus symptoms and recommend appropriate treatment options.",
    },
    {
      question: "What happens during a General Physician appointment?",
      answer:
        "Your provider will review symptoms, medical history, perform an evaluation, discuss treatment options, and recommend follow-up care if needed.",
    },
    {
      question: "Can General Physicians manage chronic diseases?",
      answer:
        "Yes. They commonly manage conditions such as diabetes, hypertension, asthma, and high cholesterol.",
    },
    {
      question: "Are telehealth appointments available?",
      answer:
        "Yes. Many consultations for common illnesses, follow-ups, and routine healthcare needs can be completed through telehealth.",
    },
    {
      question: "Can I see a General Physician for preventive care?",
      answer:
        "Absolutely. Preventive services such as wellness exams, screenings, vaccinations, and health counseling are important parts of primary care.",
    },
    {
      question: "What symptoms require immediate medical attention?",
      answer:
        "Severe chest pain, difficulty breathing, sudden weakness, loss of consciousness, or other emergency symptoms require urgent medical care.",
    },
    {
      question: "How often should I have a routine health check-up?",
      answer:
        "Most adults benefit from annual wellness visits, though recommendations may vary based on age and health status.",
    },
    {
      question: "Can a General Physician refer me to a specialist?",
      answer:
        "Yes. If specialized care is needed, your General Physician can coordinate referrals and ongoing care.",
    },
    {
      question: "How can I schedule an appointment with a General Physician?",
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
    title: "Board-Certified Providers",
    description:
      "Receive care from experienced General Physicians dedicated to evidence-based medical care.",
  },
  {
    Icon: FiClock,
    title: "Fast Appointments",
    description:
      "Get timely access to healthcare consultations for routine and urgent medical concerns.",
  },
  {
    Icon: FiMonitor,
    title: "Telehealth Access",
    description:
      "Connect securely with healthcare providers from home through convenient virtual consultations.",
  },
  {
    Icon: FiShield,
    title: "Insurance Support",
    description:
      "Receive assistance understanding coverage, benefits, authorizations, and billing questions.",
  },
  {
    Icon: FiUserCheck,
    title: "Personalized Care",
    description:
      "Benefit from treatment plans tailored to your symptoms, health history, and personal goals.",
  },
  {
    Icon: FiUsers,
    title: "Nationwide Provider Network",
    description:
      "Access a broad network of healthcare professionals and coordinated medical services.",
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
export default function GeneralPhysician({ data = SPECIALTY_DATA }) {
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
          General Physician (GP) | Primary Care & Everyday Healthcare
        </title>
        <meta
          name="description"
          content="Connect with experienced General Physicians for cold and flu, fever, cough, headaches, minor infections, fatigue, body aches, and everyday healthcare needs."
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
