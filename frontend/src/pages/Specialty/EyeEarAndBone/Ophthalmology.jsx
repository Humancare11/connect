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
  FiVolume2,
  FiVolume,
  FiCompass,
  FiSun,
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
  MdOutlineVisibility,
  MdOutlineRemoveRedEye,
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

import heroImage from "../../../assets/SpecialitiesImage/ophthalmology-eye-specialist-vision-care-banner.webp";
import overviewImage from "../../../assets/SpecialitiesImage/ophthalmologist-comprehensive-eye-examination-consultation.webp";
import BookingCard from "../../../components/SpecialityBookingCard";
import api from "../../../api";

// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "ophthalmology",
  name: "Ophthalmology",
  categoryId: "eeb",
  tagline: "Protecting Your Vision with Expert Eye Care.",
  heroDescription:
    "Ophthalmology specialists diagnose, treat, and manage conditions affecting the eyes, vision, and overall eye health. From dry eyes and eye irritation to vision changes and eye infections, ophthalmologists provide comprehensive care designed to protect sight, relieve discomfort, and support long-term visual wellness.",
  heroImage: heroImage,
  heroAlt:
    "Board-certified ophthalmologist providing comprehensive eye examination and vision care for patients with eye health and vision concerns.",
  overviewImage: overviewImage,
  overviewAlt:
    "Ophthalmologist performing a comprehensive eye examination during a patient consultation for vision assessment and long-term eye health.",
  overviewDescription:
    "Ophthalmology is a medical specialty focused on the diagnosis, treatment, prevention, and management of eye diseases and vision-related conditions. Ophthalmologists are trained to evaluate a wide range of eye concerns, from common irritations and infections to more complex vision disorders affecting daily life.",
  overviewImportance:
    "Through comprehensive eye evaluations, personalized treatment plans, preventive care, and ongoing monitoring, ophthalmology specialists help patients maintain healthy vision, identify eye conditions early, and protect long-term eye health.",
  conditionsTreated:
    "Ophthalmology specialists diagnose and manage dry eyes, eye irritation, eye redness, vision changes, styes, eye strain, and a wide range of eye and vision-related conditions.",
  whenToConsult:
    "Schedule a visit with an ophthalmology specialist if you experience persistent eye discomfort, blurry vision, redness, dryness, irritation, sensitivity to light, eye pain, or sudden changes in vision.",

  keyServices: [
    {
      Icon: FiActivity,
      title: "Comprehensive Eye Evaluations",
      description:
        "Thorough eye examinations to assess vision, eye health, and identify potential eye conditions.",
    },
    {
      Icon: FiThermometer,
      title: "Dry Eye Treatment",
      description:
        "Personalized care for chronic dry eyes, eye discomfort, irritation, and tear production issues.",
    },
    {
      Icon: MdOutlineVaccines,
      title: "Vision Change Assessments",
      description:
        "Evaluation of blurry vision, difficulty focusing, and other visual disturbances affecting daily activities.",
    },
    {
      Icon: FiDroplet,
      title: "Eye Infection & Inflammation Care",
      description:
        "Diagnosis and treatment of eye infections, redness, styes, and inflammatory eye conditions.",
    },
    {
      Icon: MdOutlineSpa,
      title: "Digital Eye Strain Management",
      description:
        "Support for screen-related eye fatigue, discomfort, headaches, and vision strain.",
    },
    {
      Icon: FiUsers,
      title: "Preventive Eye Health Care",
      description:
        "Routine eye health monitoring and preventive strategies to protect long-term vision.",
    },
  ],

  benefits: [
    {
      Icon: FiSearch,
      title: "Early Detection of Eye Conditions",
      description:
        "Identifies vision and eye health concerns before they affect long-term eyesight.",
    },
    {
      Icon: FiTrendingUp,
      title: "Improved Visual Comfort",
      description:
        "Helps reduce eye irritation, dryness, redness, and vision-related discomfort.",
    },
    {
      Icon: FiShield,
      title: "Better Vision & Daily Function",
      description:
        "Supports clearer vision and improved performance in everyday activities.",
    },
    {
      Icon: FiHeart,
      title: "Long-Term Eye Health Protection",
      description:
        "Provides ongoing monitoring and preventive care to preserve healthy eyesight.",
    },
  ],

  conditions: [
    {
      Icon: FiDroplet,
      name: "Eye Redness",
      // desc: "Relief for voice and throat changes",
      path: "/eye-ear-bone/ophthalmology/eye-redness",
    },
    {
      Icon: FiEye,
      name: "Dry eyes",
      // desc: "Relief for a blocked nose",
      path: "/eye-ear-bone/ophthalmology/dry-eyes",
    },
    {
      Icon: FiAlertCircle,
      name: "Vision changes",
      // desc: "Pain, irritation, or a scratchy throat",
      path: "/eye-ear-bone/ophthalmology/vision-changes",
    },
    {
      Icon: FiMonitor,
      name: "Eye irritation",
      // desc: "Relief for sore throat and swollen tonsils",
      path: "/eye-ear-bone/ophthalmology/eye-irritation",
    },
    {
      Icon: MdOutlineVisibility,
      name: "Stye",
      // desc: "Spinning sensation and balance issues",
      path: "/eye-ear-bone/ophthalmology/stye",
    },
    {
      Icon: FiEye,
      name: "Eye-strain",
      // desc: "Pain, pressure, and ear discomfort",
      path: "/eye-ear-bone/ophthalmology/eye-strain",
    },

  ],

  faqs: [
    {
      question: "What is ophthalmology?",
      answer:
        "Ophthalmology is the medical specialty focused on diagnosing, treating, and preventing eye diseases and vision-related conditions.",
    },
    {
      question: "What conditions do ophthalmologists treat?",
      answer:
        "Ophthalmologists treat dry eyes, eye irritation, eye redness, vision changes, styes, eye infections, and many other eye health concerns.",
    },
    {
      question: "When should I see an ophthalmologist?",
      answer:
        "You should seek eye care if you experience vision changes, eye pain, redness, irritation, dryness, sensitivity to light, or other persistent eye symptoms.",
    },
    {
      question: "What causes dry eyes?",
      answer:
        "Dry eyes may result from reduced tear production, aging, environmental factors, screen use, medications, or underlying medical conditions.",
    },
    {
      question: "Why are my eyes red?",
      answer:
        "Eye redness can be caused by irritation, allergies, infections, dryness, inflammation, or eye strain.",
    },
    {
      question: "What is eye strain?",
      answer:
        "Eye strain occurs when the eyes become tired due to prolonged screen time, reading, driving, or focusing on visual tasks.",
    },
    {
      question: "Can digital screens affect eye health?",
      answer:
        "Extended screen use can contribute to eye strain, dryness, blurred vision, headaches, and visual fatigue.",
    },
    {
      question: "What is a stye?",
      answer:
        "A stye is a painful bump on the eyelid caused by a blocked or infected oil gland.",
    },
    {
      question: "Are sudden vision changes serious?",
      answer:
        "Yes. Sudden vision changes should be evaluated promptly by an eye specialist to determine the underlying cause.",
    },
    {
      question: "What causes blurry vision?",
      answer:
        "Blurry vision may result from refractive errors, dry eyes, eye strain, infections, or more serious eye conditions.",
    },
    {
      question: "How often should I have an eye examination?",
      answer:
        "Eye examination frequency depends on age, risk factors, vision needs, and existing eye health conditions.",
    },
    {
      question: "Can allergies affect my eyes?",
      answer:
        "Yes. Allergies commonly cause itching, redness, watering, irritation, and eye discomfort.",
    },
    {
      question: "What are common symptoms of eye infections?",
      answer:
        "Symptoms may include redness, pain, discharge, swelling, irritation, and sensitivity to light.",
    },
    {
      question: "Are telehealth ophthalmology appointments available?",
      answer:
        "Yes. Certain eye concerns, consultations, follow-up appointments, and treatment discussions may be available through telehealth.",
    },
    {
      question: "How can I reduce eye strain?",
      answer:
        "Taking regular screen breaks, adjusting lighting, staying hydrated, and following healthy eye habits can help reduce eye strain.",
    },
    {
      question: "What are signs of a serious eye problem?",
      answer:
        "Severe eye pain, sudden vision loss, flashes of light, significant redness, or sudden visual changes require immediate medical attention.",
    },
    {
      question: "Can dry eyes affect vision?",
      answer:
        "Yes. Chronic dry eyes can cause blurry vision, irritation, discomfort, and reduced visual quality.",
    },
    {
      question:
        "How can I schedule an appointment with an ophthalmology specialist?",
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
      "Receive care from experienced eye specialists dedicated to protecting and improving vision health.",
  },
  {
    Icon: FiZap,
    title: "Fast Appointments",
    description:
      "Schedule eye care consultations quickly with convenient appointment availability.",
  },
  {
    Icon: FiMonitor,
    title: "Telehealth Access",
    description:
      "Connect securely with ophthalmology specialists through virtual consultations and follow-up visits.",
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
      "Benefit from individualized eye care treatment plans based on your symptoms and vision needs.",
  },
  {
    Icon: FiGlobe,
    title: "Global Provider Network",
    description:
      "Access a broad network of ophthalmology specialists and coordinated eye care services.",
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
        <Link to={path} style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}>
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
export default function Ophthalmology({ data = SPECIALTY_DATA }) {
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
          Ophthalmology Specialists | Eye Care & Vision Health Services
        </title>
        <meta
          name="description"
          content="Get expert ophthalmology care for dry eyes, eye irritation, eye redness, vision changes, styes, eye strain, and comprehensive vision health support."
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
              <span className="sp-hero__badge">Eye Ear & Bone</span>
              <h1 className="sp-hero__title">{data.name}</h1>
              <p className="sp-hero__tagline">{data.tagline}</p>
              <p className="sp-hero__description">{data.heroDescription}</p>

              {/* <div className="sp-hero__actions">
                <a href="/Specialties" className="sp-btn sp-btn--primary">
                  <FiSearch size={17} />
                  Find Specialists
                </a>
                <a href="/appointment-booking" className="sp-btn sp-btn--ghost">
                  <FiCalendar size={17} />
                  Book Appointment
                </a>
              </div> */}
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
              <div className="sp-conditions__head" onClick={() => navigate("/conditions")} style={{ cursor: "pointer" }}>
                <SectionLabel>Conditions &amp; Symptoms</SectionLabel>
                <h2>What We Treat</h2>
                <p>
                  Our {data.name.toLowerCase()} specialists diagnose and manage
                  a wide range of eye and vision conditions to help protect your
                  sight and improve overall eye health.
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
                  We combine experienced ophthalmology specialists with advanced
                  technology to make eye care more accessible, convenient, and
                  personalized.
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
                Protect your vision with expert eye care, personalized treatment
                plans, and convenient appointment options. Schedule an in-person
                or virtual visit with an ophthalmology specialist today.
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
