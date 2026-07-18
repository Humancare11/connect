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

import heroImage from "../../../assets/SpecialitiesImage/psychiatry-mental-health-specialist-consultation-banner.webp";
import overviewImage from "../../../assets/SpecialitiesImage/psychiatrist-patient-mental-health-evaluation-consultation.webp";
import BookingCard from "../../../components/SpecialityBookingCard";
import api from "../../../api";

// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "psychiatry",
  name: "Psychiatry",
  categoryId: "mental",
  tagline: "Compassionate Mental Health Care Designed Around You.",
  heroDescription:
    "Psychiatry specialists diagnose, treat, and manage mental health conditions that affect emotions, thoughts, behaviors, relationships, and overall well-being. Whether you're experiencing anxiety, depression, sleep difficulties, attention challenges, or mood disorders, psychiatric care provides personalized support to help you feel better and improve your quality of life.",
  heroImage: heroImage,
  heroAlt:
    "Board-certified psychiatrist providing a mental health consultation for anxiety, depression, ADHD, PTSD, and emotional wellness.",
  overviewImage: overviewImage,
  overviewAlt:
    "Psychiatrist discussing mental health symptoms and personalized treatment options with a patient during a behavioral health consultation.",
  overviewDescription:
    "Psychiatry is a medical specialty focused on the diagnosis, treatment, prevention, and management of mental health conditions. Psychiatrists are medical doctors trained to evaluate emotional, psychological, and behavioral concerns while providing comprehensive treatment plans tailored to individual needs.",
  overviewImportance:
    "Mental health conditions can affect every aspect of life, including work performance, relationships, sleep quality, physical health, and overall happiness. Through early intervention, ongoing support, and personalized treatment, psychiatric care helps individuals manage symptoms and improve daily functioning.",
  conditionsTreated:
    "Psychiatry specialists diagnose and manage anxiety, depression, ADHD, bipolar disorder, PTSD, insomnia, OCD, panic attacks, and other mental health conditions.",
  whenToConsult:
    "Schedule a psychiatric consultation if you experience persistent sadness, excessive worry, panic attacks, mood changes, sleep disturbances, concentration difficulties, emotional distress, or symptoms affecting daily life.",

  keyServices: [
    {
      Icon: FiActivity,
      title: "Psychiatric Evaluations",
      description:
        "Comprehensive mental health assessments to understand symptoms, concerns, and treatment needs.",
    },
    {
      Icon: FiThermometer,
      title: "Medication Management",
      description:
        "Personalized medication evaluations, adjustments, monitoring, and ongoing psychiatric care.",
    },
    {
      Icon: MdOutlineVaccines,
      title: "Anxiety & Mood Disorder Treatment",
      description:
        "Evidence-based treatment plans for anxiety, depression, bipolar disorder, and related conditions.",
    },
    {
      Icon: FiDroplet,
      title: "ADHD Assessments & Support",
      description:
        "Evaluation and treatment options for attention, focus, impulsivity, and executive functioning challenges.",
    },
    {
      Icon: MdOutlineSpa,
      title: "Sleep & Behavioral Health Support",
      description:
        "Care for insomnia, sleep-related concerns, emotional wellness, and mental health conditions.",
    },
    {
      Icon: FiUsers,
      title: "Ongoing Mental Health Care",
      description:
        "Long-term support, symptom monitoring, and personalized treatment planning.",
    },
  ],

  benefits: [
    {
      Icon: FiSearch,
      title: "Improved Emotional Well-Being",
      description:
        "Reduce symptoms and improve emotional balance, resilience, and overall wellness.",
    },
    {
      Icon: FiTrendingUp,
      title: "Better Daily Functioning",
      description:
        "Support work performance, relationships, focus, productivity, and quality of life.",
    },
    {
      Icon: FiShield,
      title: "Personalized Treatment",
      description:
        "Receive individualized care plans based on your symptoms, goals, and health history.",
    },
    {
      Icon: FiHeart,
      title: "Long-Term Mental Health Support",
      description:
        "Build sustainable strategies to manage symptoms and maintain mental wellness.",
    },
  ],

  conditions: [
    {
      Icon: FiActivity,
      name: "ADHD Evaluation",
      desc: "Attention, focus, and hyperactivity concerns",
      path: "/mental-health/psychiatry/adhd-evaluation",
    },
    {
      name: "Anxiety",
      desc: "Excessive worry, stress, and nervousness",
      path: "/mental-health/psychiatry/anxiety",
    },
    {
      Icon: FiTrendingUp,
      name: "Bipolar disorder follow-up",
      desc: "Red, itchy, irritated skin in kids",
      path: "/mental-health/psychiatry/bipolar-disorder-follow-up",
    },
    {
      Icon: FiHeart,
      name: "Depression",
      desc: "Red, itchy, irritated skin in kids",
      path: "/mental-health/psychiatry/depression",
    },
    {
      Icon: FiMoon,
      name: "PTSD",
      desc: "Red, itchy, irritated skin in kids",
      path: "/mental-health/psychiatry/ptsd",
    },
    {
      Icon: FiShield,
      ame: "OCD",
      desc: "Red, itchy, irritated skin in kids",
      path: "/mental-health/psychiatry/ocd",
    },
    {
      Icon: FiAlertCircle,
      name: "PTSD (Post-Traumatic Stress Disorder)",
      desc: "Red, itchy, irritated skin in kids",
      path: "/mental-health/psychiatry/ptsd",
    },
    {
      Icon: FiCompass,
      name: "Panic attacks",
      desc: "Red, itchy, irritated skin in kids",
      path: "/mental-health/psychiatry/panic-attacks",
    },
    {
      Icon: FiBriefcase,
      name: "Insomnia",
      desc: "Red, itchy, irritated skin in kids",
      path: "/mental-health/psychiatry/insomnia",
    },

  ],

  faqs: [
    {
      question: "What is psychiatry?",
      answer:
        "Psychiatry is the medical specialty focused on diagnosing, treating, and preventing mental health conditions.",
    },
    {
      question: "What conditions do psychiatrists treat?",
      answer:
        "Psychiatrists commonly treat anxiety, depression, ADHD, bipolar disorder, PTSD, OCD, insomnia, panic attacks, and other mental health concerns.",
    },
    {
      question: "How is a psychiatrist different from a therapist?",
      answer:
        "Psychiatrists are medical doctors who can diagnose conditions, prescribe medications, and provide treatment plans, while therapists primarily provide counseling and psychotherapy.",
    },
    {
      question: "When should I see a psychiatrist?",
      answer:
        "Consider seeing a psychiatrist if symptoms are affecting your daily life, relationships, work performance, sleep, or emotional well-being.",
    },
    {
      question: "Can psychiatrists prescribe medication?",
      answer:
        "Yes. Psychiatrists are licensed medical doctors who can prescribe and manage medications when appropriate.",
    },
    {
      question: "What is ADHD?",
      answer:
        "ADHD is a condition that can affect attention, focus, organization, impulse control, and executive functioning.",
    },
    {
      question: "What are common symptoms of anxiety?",
      answer:
        "Symptoms may include excessive worry, nervousness, racing thoughts, restlessness, and physical tension.",
    },
    {
      question: "What causes depression?",
      answer:
        "Depression can result from a combination of biological, psychological, environmental, and life-related factors.",
    },
    {
      question: "What is bipolar disorder?",
      answer:
        "Bipolar disorder is a mood condition characterized by episodes of elevated mood and periods of depression.",
    },
    {
      question: "What is PTSD?",
      answer:
        "PTSD is a condition that may develop after experiencing or witnessing a traumatic event.",
    },
    {
      question: "What are panic attacks?",
      answer:
        "Panic attacks are sudden episodes of intense fear that may cause rapid heartbeat, dizziness, sweating, and shortness of breath.",
    },
    {
      question: "Can insomnia affect mental health?",
      answer:
        "Yes. Poor sleep can significantly impact mood, concentration, stress levels, and emotional well-being.",
    },
    {
      question: "What is OCD?",
      answer:
        "Obsessive-Compulsive Disorder involves recurring unwanted thoughts and repetitive behaviors performed to reduce anxiety.",
    },
    {
      question: "Are psychiatric appointments confidential?",
      answer:
        "Yes. Psychiatric services follow strict privacy and confidentiality standards.",
    },
    {
      question: "Can telehealth be used for psychiatry appointments?",
      answer:
        "Yes. Many psychiatric evaluations, medication reviews, and follow-up visits can be conducted virtually.",
    },
    {
      question: "How long does psychiatric treatment take?",
      answer:
        "Treatment duration varies depending on individual needs, symptoms, treatment goals, and progress.",
    },
    {
      question: "Can psychiatry help improve quality of life?",
      answer:
        "Yes. Effective treatment can improve emotional wellness, relationships, productivity, and overall daily functioning.",
    },
    {
      question:
        "How can I schedule an appointment with a psychiatry specialist?",
      answer:
        "You can book an appointment online and connect with a qualified psychiatry specialist through virtual or in-person care options.",
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
      "Receive care from experienced psychiatry providers dedicated to evidence-based mental healthcare.",
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
      "Connect securely with psychiatry specialists from the comfort and privacy of your home.",
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
      "Benefit from treatment plans tailored to your symptoms, goals, and mental health needs.",
  },
  {
    Icon: FiGlobe,
    title: "Nationwide Provider Network",
    description:
      "Access trusted mental health professionals and coordinated specialty care services.",
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
export default function Psychiatry({ data = SPECIALTY_DATA }) {
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
          Psychiatry Specialists | Mental Health, Medication Management &
          Emotional Wellness
        </title>
        <meta
          name="description"
          content="Connect with experienced psychiatry specialists for anxiety, depression, ADHD, PTSD, insomnia, bipolar disorder, panic attacks, OCD, and personalized mental health care."
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
              <span className="sp-hero__badge">Mental Health</span>
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
                  Our {data.name.toLowerCase()} specialists provide expert care
                  for a wide range of mental health, emotional wellness, and
                  behavioral health concerns.
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
                  We combine experienced psychiatry specialists with advanced
                  technology to make mental healthcare more accessible,
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
                Take the first step toward better mental health and emotional
                well-being. Schedule an appointment with a psychiatry specialist
                and receive personalized care designed to support your goals,
                symptoms, and overall quality of life.
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
