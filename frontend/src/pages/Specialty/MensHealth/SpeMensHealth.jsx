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
  FiLayers,
  FiMove,
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

import heroImage from "../../../assets/SpecialitiesImage/mens-health-specialist-consultation.webp";
import overviewImage from "../../../assets/SpecialitiesImage/mens-health-wellness-consultation.webp";
import BookingCard from "../../../components/SpecialityBookingCard";
import api from "../../../api";
import SEO from "../../../components/Seo";

// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "mens-health",
  name: "Men's Health",
  categoryId: "men",
  tagline: "Personalized Healthcare Designed for Men's Unique Health Needs.",
  heroDescription:
    "Men's health specialists focus on the physical, hormonal, sexual, and preventive healthcare needs of men throughout every stage of life. From managing hormone imbalances and sexual wellness concerns to supporting prostate health and healthy aging, men's health care provides personalized treatment plans that help men feel their best and maintain long-term wellness.",
  heroImage: heroImage,
  heroAlt:
    "Men's health specialist consulting with a male patient about preventive care, hormone health, and overall wellness",
  overviewImage: overviewImage,
  overviewAlt:
    "Men's health specialist providing a personalized wellness and preventive healthcare consultation",
  overviewDescription:
    "Men's Health is a specialized area of healthcare dedicated to preventing, diagnosing, and treating conditions that commonly affect men. These services focus on sexual health, hormone balance, reproductive wellness, prostate care, preventive screenings, and age-related health concerns.",
  overviewImportance:
    "Regular men's health evaluations can help identify health risks early, improve quality of life, support physical performance, and promote healthy aging. By addressing concerns proactively, men can maintain better overall health, energy levels, and long-term wellness.",
  conditionsTreated:
    "Men's health specialists diagnose and manage erectile dysfunction, low testosterone, low libido, prostate concerns, hair loss, fertility issues, urinary symptoms, and other health conditions affecting men's well-being.",
  whenToConsult:
    "Schedule a men's health consultation if you experience changes in sexual function, hormone-related symptoms, hair loss, urinary concerns, fatigue, reduced energy levels, fertility issues, or would like preventive health screening and wellness guidance.",

  keyServices: [
    {
      Icon: FiActivity,
      title: "Men's Wellness Evaluations",
      description:
        "Comprehensive health assessments focused on preventive care, risk factors, and long-term wellness.",
    },
    {
      Icon: FiThermometer,
      title: "Hormone Health & Testosterone Management",
      description:
        "Evaluation and treatment of hormonal imbalances affecting energy, mood, muscle health, and sexual wellness.",
    },
    {
      Icon: MdOutlineVaccines,
      title: "Sexual Health Support",
      description:
        "Personalized care for erectile dysfunction, low libido, performance concerns, and men's sexual health needs.",
    },
    {
      Icon: FiDroplet,
      title: "Prostate Health Monitoring",
      description:
        "Routine screenings, evaluations, and preventive care for prostate-related health concerns.",
    },
    {
      Icon: MdOutlineSpa,
      title: "Fertility & Reproductive Health Consultations",
      description:
        "Assessment of male reproductive health, fertility concerns, and family planning goals.",
    },
    {
      Icon: FiUsers,
      title: "Healthy Aging & Lifestyle Optimization",
      description:
        "Guidance on fitness, nutrition, sleep, stress management, and strategies to support healthy aging.",
    },
  ],

  benefits: [
    {
      Icon: FiSearch,
      title: "Improved Quality of Life",
      description:
        "Address common health concerns that impact confidence, energy, relationships, and overall well-being.",
    },
    {
      Icon: FiTrendingUp,
      title: "Hormonal Balance",
      description:
        "Support healthy testosterone levels and improve physical, mental, and emotional wellness.",
    },
    {
      Icon: FiShield,
      title: "Preventive Healthcare",
      description:
        "Identify health risks early through screenings, evaluations, and proactive medical care.",
    },
    {
      Icon: FiHeart,
      title: "Healthy Aging",
      description:
        "Receive personalized strategies to maintain strength, vitality, and wellness as you age.",
    },
  ],

  conditions: [
    {
      Icon: FiActivity,
      name: "Erectile Dysfunction",
      desc: "Difficulty getting or maintaining erections",
      path: "/mens-health/men-health/erectile-dysfunction",
    },
    {
      Icon: FiTrendingUp,
      name: "Low Testosterone Symptoms",
      desc: "Low hormone levels affecting energy",
      path: "/mens-health/men-health/low-testosterone-symptoms",
    },
    {
      Icon: FiHeart,
      name: "Hair Loss",
      desc: "Thinning hair and excessive shedding",
      path: "/mens-health/men-health/hair-loss",
    },
    {
      Icon: FiZap,
      name: "Low Libido",
      desc: "Support for changes in sexual desire",
      path: "/mens-health/men-health/low-libido",
    },
    {
      Icon: FiShield,
      name: "Prostate Health",
      desc: "Common concerns affecting prostate function",
      path: "/mens-health/men-health/prostate-health",
    },
  ],

  faqs: [
    {
      question: "What is men's health care?",
      answer:
        "Men's health care focuses on preventing, diagnosing, and treating health conditions that commonly affect men throughout different stages of life.",
    },
    {
      question: "What conditions do men's health specialists treat?",
      answer:
        "They commonly treat erectile dysfunction, low testosterone, low libido, prostate concerns, fertility issues, hair loss, and preventive health needs.",
    },
    {
      question: "When should I see a men's health specialist?",
      answer:
        "If you experience hormone-related symptoms, sexual health concerns, urinary issues, hair loss, or changes in energy levels, a consultation may be beneficial.",
    },
    {
      question: "What are symptoms of low testosterone?",
      answer:
        "Symptoms may include fatigue, reduced energy, low libido, mood changes, decreased muscle mass, and difficulty concentrating.",
    },
    {
      question: "Can low testosterone affect overall health?",
      answer:
        "Yes. Testosterone levels can impact energy, mood, physical performance, sexual health, and overall well-being.",
    },
    {
      question: "What causes erectile dysfunction?",
      answer:
        "Erectile dysfunction may result from medical conditions, stress, hormonal imbalances, medications, lifestyle factors, or aging.",
    },
    {
      question: "Is hair loss common in men?",
      answer:
        "Yes. Male pattern hair loss is one of the most common health concerns affecting men.",
    },
    {
      question: "Why is prostate health important?",
      answer:
        "Regular prostate evaluations can help identify concerns early and support long-term urinary and reproductive health.",
    },
    {
      question: "Can men's health specialists help with fertility concerns?",
      answer:
        "Yes. Specialists evaluate reproductive health, hormone levels, and other factors that may affect fertility.",
    },
    {
      question: "What causes low libido?",
      answer:
        "Low libido may be influenced by hormone changes, stress, relationship factors, sleep issues, or medical conditions.",
    },
    {
      question: "How often should men have preventive health screenings?",
      answer:
        "Screening recommendations vary by age, family history, and risk factors, but regular evaluations are important.",
    },
    {
      question: "Are men's health consultations confidential?",
      answer:
        "Yes. All consultations are conducted with strict privacy and confidentiality standards.",
    },
    {
      question: "Can telehealth be used for men's health appointments?",
      answer:
        "Yes. Many men's health concerns can be evaluated and managed through secure virtual consultations.",
    },
    {
      question: "What are common signs of hormone imbalance in men?",
      answer:
        "Fatigue, low libido, mood changes, weight gain, reduced muscle mass, and decreased motivation are common symptoms.",
    },
    {
      question: "Can lifestyle changes improve men's health?",
      answer:
        "Healthy nutrition, regular exercise, quality sleep, and stress management can significantly improve overall health.",
    },
    {
      question: "What is included in a men's wellness evaluation?",
      answer:
        "A wellness evaluation may include health screenings, hormone assessments, risk factor reviews, and preventive care recommendations.",
    },
    {
      question: "What is healthy aging for men?",
      answer:
        "Healthy aging focuses on maintaining physical, mental, sexual, and emotional wellness as men get older.",
    },
    {
      question:
        "How can I schedule an appointment with a men's health specialist?",
      answer:
        "You can book an appointment online and connect with a qualified men's health specialist through virtual or in-person care options.",
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
      "Receive care from experienced providers trained in men's health and wellness.",
  },
  {
    Icon: FiZap,
    title: "Fast Appointments",
    description:
      "Schedule consultations quickly with convenient appointment availability.",
  },
  {
    Icon: FiMonitor,
    title: "Telehealth Access",
    description:
      "Connect with specialists from anywhere through secure virtual healthcare visits.",
  },
  {
    Icon: FiShield,
    title: "Insurance Support",
    description:
      "Our team helps navigate coverage, authorizations, and healthcare benefits.",
  },
  {
    Icon: FiHeart,
    title: "Personalized Care",
    description:
      "Receive customized treatment plans tailored to your goals, symptoms, and health history.",
  },
  {
    Icon: FiGlobe,
    title: "Nationwide Provider Network",
    description:
      "Access trusted specialists and coordinated healthcare services through a broad provider network.",
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
export default function SpeMensHealth({ data = SPECIALTY_DATA }) {
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
        title="Men's Health Specialists | Sexual Wellness, Hormone Health & Preventive Care"
        description="Connect with experienced men's health specialists for erectile dysfunction, low testosterone, low libido, prostate health, hair loss, fertility concerns, and preventive wellness care."
        keywords="Men's health specialist, Erectile dysfunction treatment, Low testosterone, Online men's health consultation"
        url="https://humancareconnect.co/mens-health"
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
                  Our {data.name.toLowerCase()} specialists provide expert care
                  for a wide range of conditions affecting hormonal health,
                  sexual wellness, reproductive health, and overall well-being.
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
                  We combine experienced men's health specialists with advanced
                  technology to make healthcare more accessible, convenient, and
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
                Book an appointment with an experienced men's health specialist
                and receive personalized care for hormone health, sexual
                wellness, preventive care, and healthy aging. Virtual and
                in-person appointment options are available.
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
