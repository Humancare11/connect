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
  FiRepeat,
  FiMoon,
  FiMap,
  FiHome,
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

import heroImage from "../../../assets/SpecialitiesImage/sexual-health-specialist-consultation.webp";
import overviewImage from "../../../assets/SpecialitiesImage/sexual-health-doctor-patient-consultation.webp";
import BookingCard from "../../../components/SpecialityBookingCard";
import api from "../../../api";
import SEO from "../../../components/Seo";

// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "sexual-health-speciality",
  name: "Sexual Health",
  categoryId: "sexual",
  tagline: "Confidential Care for Your Sexual Health and Wellness.",
  heroDescription:
    "Sexual health is an important part of overall well-being. Sexual health specialists provide confidential, judgment-free care for sexually transmitted infections (STIs), HIV prevention, sexual wellness concerns, partner exposure risks, and preventive sexual healthcare. Through personalized treatment plans and evidence-based medical care, patients receive the support they need to protect their health and make informed decisions. Whether you need testing guidance, treatment support, prevention counseling, or answers to sexual health questions, our specialists are here to help.",
  heroImage: heroImage,
  heroAlt:
    "Expert medical opinion specialist reviewing patient diagnosis and treatment plans",
  overviewImage: overviewImage,
  overviewAlt:
    "Sexual health doctor consulting a patient about STI testing, HIV prevention, and sexual wellness",
  overviewDescription:
    "Sexual Health is a healthcare specialty focused on preventing, diagnosing, treating, and managing conditions related to sexual wellness and reproductive health. This includes STI evaluations, HIV prevention strategies, sexual health education, risk reduction counseling, and treatment for common sexually transmitted infections.",
  overviewImportance:
    "Regular sexual health care promotes early detection, effective treatment, healthier relationships, and improved overall wellness. Access to confidential care helps patients take proactive steps toward protecting their health and the health of their partners.",
  conditionsTreated:
    "Sexual health specialists diagnose and manage chlamydia, gonorrhea, herpes, STI-related concerns, HIV prevention needs, partner exposure concerns, and sexual wellness issues.",
  whenToConsult:
    "Schedule a sexual health consultation if you have symptoms of an STI, concerns after sexual exposure, questions about HIV prevention, sexual wellness concerns, or need confidential sexual health guidance.",

  keyServices: [
    {
      Icon: FiActivity,
      title: "STI Evaluations",
      description:
        "Assessment of symptoms, risk factors, and concerns related to sexually transmitted infections.",
    },
    {
      Icon: FiThermometer,
      title: "HIV Prevention & PrEP Guidance",
      description:
        "Personalized guidance on HIV prevention strategies, PrEP eligibility, and sexual health protection.",
    },
    {
      Icon: MdOutlineVaccines,
      title: "Sexual Wellness Consultations",
      description:
        "Confidential discussions about sexual health concerns, wellness goals, and preventive care.",
    },
    {
      Icon: FiDroplet,
      title: "Partner Exposure Counseling",
      description:
        "Support and guidance after potential exposure to sexually transmitted infections.",
    },
    {
      Icon: MdOutlineSpa,
      title: "STI Treatment Support",
      description:
        "Evidence-based treatment recommendations and follow-up care for common sexually transmitted infections.",
    },
    {
      Icon: FiUsers,
      title: "Preventive Sexual Health Care",
      description:
        "Education, screening recommendations, and risk-reduction strategies for long-term sexual wellness.",
    },
  ],

  benefits: [
    {
      Icon: FiSearch,
      title: "Early Detection",
      description:
        "Identify infections and concerns early for faster treatment and better outcomes.",
    },
    {
      Icon: FiTrendingUp,
      title: "Confidential Care",
      description:
        "Receive professional medical support in a safe, private, and judgment-free environment.",
    },
    {
      Icon: FiShield,
      title: "Reduced Health Risks",
      description:
        "Prevent complications through timely diagnosis, treatment, and prevention strategies.",
    },
    {
      Icon: FiHeart,
      title: "Better Sexual Wellness",
      description:
        "Support healthy relationships, informed decisions, and long-term sexual health.",
    },
  ],

  conditions: [
    {
      Icon: FiHeart,
      name: "Chlamydia",
      path: "/sexual-health/sexual-health-and-wellness/chlamydia",
      description:
        "Diagnosis, treatment guidance, and follow-up care for one of the most common sexually transmitted infections.",
    },
    {
      Icon: FiTrendingUp,
      name: "Gonorrhea",
      path: "/sexual-health/sexual-health-and-wellness/gonorrhea",
      description:
        "Evaluation and management of gonorrhea symptoms, testing concerns, and treatment support.",
    },
    {
      Icon: FiUsers,
      name: "Herpes",
      path: "/sexual-health/sexual-health-and-wellness/herpes",
      description:
        "Care for herpes-related symptoms, outbreak management, and sexual health education.",
    },
    {
      Icon: FiZap,
      name: "HIV Prevention & PrEP Guidance",
      description:
        "Assessment of HIV risk and personalized recommendations regarding PrEP and prevention strategies.",
    },
    {
      Icon: FiShield,
      name: "Partner Exposure Concerns",
      path: "/sexual-health/sexual-health-and-wellness/partner-exposure-concerns",
      description:
        "Support for individuals concerned about potential exposure to sexually transmitted infections.",
    },
    {
      Icon: FiCompass,
      name: "Safe Sex Counseling",
      path: "/sexual-health/sexual-health-and-wellness/safe-sex-counseling",
      description:
        "Education and practical guidance for reducing risks and maintaining sexual wellness.",
    },
    {
      Icon: FiActivity,
      name: "STI Consultation",
      path: "/sexual-health/sexual-health-and-wellness/sti-consultation",
      description:
        "Evaluation of symptoms, testing recommendations, treatment options, and prevention planning.",
    },
    {
      Icon: FiTarget,
      name: "HPV Concerns",
      description:
        "Guidance regarding HPV-related symptoms, risks, prevention, and sexual health education.",
    },
    {
      Icon: FiBriefcase,
      name: "Sexual Wellness Questions",
      description:
        "Professional support for general sexual health concerns and preventive care discussions.",
    },
    {
      Icon: FiHome,
      name: "STI Prevention Planning",
      description:
        "Personalized recommendations to reduce infection risks and support healthy sexual practices.",
    },
    {
      Icon: FiSearch,
      name: "Recurrent STI Concerns",
      description:
        "Evaluation and management strategies for individuals experiencing recurring infections.",
    },
    {
      Icon: FiLayers,
      name: "Preventive Sexual Health Screening",
      description:
        "Routine sexual health evaluations designed to support long-term wellness and early detection.",
    },
  ],

  faqs: [
    {
      question: "What is sexual health care?",
      answer:
        "Sexual health care focuses on preventing, diagnosing, and treating conditions related to sexual wellness and sexually transmitted infections.",
    },
    {
      question: "What conditions do sexual health specialists treat?",
      answer:
        "They commonly address STIs, HIV prevention concerns, herpes, chlamydia, gonorrhea, partner exposure risks, and sexual wellness issues.",
    },
    {
      question: "What is PrEP?",
      answer:
        "PrEP is a preventive medication that can significantly reduce the risk of HIV infection in eligible individuals.",
    },
    {
      question: "When should I get tested for an STI?",
      answer:
        "Testing may be recommended if you have symptoms, a new partner, potential exposure, or concerns about your sexual health.",
    },
    {
      question: "What are common STI symptoms?",
      answer:
        "Symptoms may include unusual discharge, pain during urination, sores, itching, rashes, or pelvic discomfort, although many infections have no symptoms.",
    },
    {
      question: "Is sexual health care confidential?",
      answer:
        "Yes. Sexual health services follow strict privacy and confidentiality standards.",
    },
    {
      question: "Can chlamydia be treated?",
      answer:
        "Yes. Chlamydia is typically treatable when diagnosed and managed appropriately.",
    },
    {
      question: "What is gonorrhea?",
      answer:
        "Gonorrhea is a common sexually transmitted infection that can affect multiple parts of the body.",
    },
    {
      question: "Can herpes be cured?",
      answer:
        "While herpes cannot currently be cured, symptoms can often be effectively managed with medical care.",
    },
    {
      question: "What should I do after possible STI exposure?",
      answer:
        "Seek medical guidance as soon as possible to discuss testing, prevention options, and treatment recommendations.",
    },
    {
      question: "What is safe sex counseling?",
      answer:
        "Safe sex counseling provides education and guidance to help reduce risks and support sexual wellness.",
    },
    {
      question:
        "Are telehealth appointments available for sexual health concerns?",
      answer:
        "Yes. Many sexual health consultations can be conducted securely through telehealth services.",
    },
    {
      question: "How often should I have sexual health screenings?",
      answer:
        "Screening frequency depends on your age, risk factors, sexual activity, and healthcare provider recommendations.",
    },
    {
      question: "What is HPV?",
      answer:
        "HPV is a common virus that can affect sexual health and may require monitoring or preventive care.",
    },
    {
      question: "Can I discuss sexual wellness concerns during a consultation?",
      answer:
        "Yes. Sexual health specialists provide confidential guidance on a wide range of wellness concerns.",
    },
    {
      question:
        "Can sexual health specialists help with prevention strategies?",
      answer:
        "Yes. Prevention education, risk reduction planning, and sexual wellness guidance are key parts of sexual healthcare.",
    },
    {
      question: "Why is early STI detection important?",
      answer:
        "Early diagnosis can help prevent complications, reduce transmission risks, and improve treatment outcomes.",
    },
    {
      question:
        "How can I schedule an appointment with a sexual health specialist?",
      answer:
        "You can book an appointment online and connect with a qualified sexual health specialist through virtual or in-person care options.",
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
      "Receive care from experienced healthcare providers trained in sexual health and wellness.",
  },
  {
    Icon: FiZap,
    title: "Fast Appointments",
    description:
      "Schedule consultations quickly with flexible appointment availability.",
  },
  {
    Icon: FiMonitor,
    title: "Telehealth Access",
    description:
      "Connect securely with specialists from the privacy and comfort of your home.",
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
      "Benefit from treatment plans tailored to your symptoms, concerns, and wellness goals.",
  },
  {
    Icon: FiGlobe,
    title: "Nationwide Provider Network",
    description:
      "Access trusted healthcare professionals and coordinated specialty care services.",
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
export default function SexualHealth({ data = SPECIALTY_DATA }) {
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
        title="Sexual Health Specialists | STI Care, HIV Prevention & Sexual Wellness"
        description="Connect with experienced sexual health specialists for STI consultations, HIV prevention, herpes, chlamydia, gonorrhea, partner exposure concerns, and confidential sexual wellness care."
        keywords="online sexual health consultation, STI consultation online, STI treatment, HIV prevention, PrEP consultation, herpes treatment, chlamydia treatment, gonorrhea treatment, confidential sexual health, sexual wellness, virtual sexual health clinic, telehealth STI care"
        url="https://humancareconnect.co/sexual-health-speciality"
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
                <SectionLabel>Conditions &amp; Symptoms</SectionLabel>
                <h2>What We Treat</h2>
                <p>
                  Our {data.name.toLowerCase()} specialists provide confidential
                  care for a wide range of sexual wellness and sexually
                  transmitted infection concerns.
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
                  We combine experienced sexual health specialists with advanced
                  technology to make confidential healthcare more accessible,
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
                Take control of your sexual health with confidential,
                professional care. Schedule an appointment with a sexual health
                specialist and receive personalized support for STI concerns,
                prevention strategies, and long-term wellness.
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
