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

import heroImage from "../../../assets/SpecialitiesImage/behavioral-health-mental-health-counseling-session-banner.webp";
import overviewImage from "../../../assets/SpecialitiesImage/behavioral-health-therapy-patient-consultation.webp";
import BookingCard from "../../../components/SpecialityBookingCard";
import api from "../../../api";

// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "behavioral-health",
  name: "Behavioral Health",
  categoryId: "mental",
  tagline: "Supporting Mental, Emotional, and Behavioral Well-Being.",
  heroDescription:
    "Behavioral Health specialists help individuals navigate emotional challenges, behavioral concerns, life transitions, stress, and mental health conditions. Through personalized care, evidence-based treatment plans, and compassionate support, behavioral health services empower individuals to improve emotional resilience, develop healthier coping strategies, and achieve overall well-being.",
  heroImage: heroImage,
  heroAlt:
    "Behavioral health specialist providing mental health counseling and emotional wellness support during a therapy session.",
  overviewImage: overviewImage,
  overviewAlt:
    "Behavioral health therapist discussing emotional well-being and personalized treatment with a patient.",
  overviewDescription:
    "Behavioral Health focuses on the connection between thoughts, emotions, behaviors, and overall wellness. This specialty addresses emotional and behavioral challenges that can impact relationships, work performance, sleep, daily functioning, and quality of life.",
  overviewImportance:
    "Behavioral health specialists work with individuals experiencing stress, emotional difficulties, behavioral concerns, anxiety-related symptoms, life transitions, and substance use challenges. Through comprehensive evaluations and personalized care plans, patients receive support tailored to their unique needs and goals.",
  conditionsTreated:
    "Behavioral health specialists diagnose and manage adjustment difficulties, anger management concerns, sleep-related anxiety, substance use challenges, stress-related symptoms, and emotional wellness concerns.",
  whenToConsult:
    "Consider a behavioral health consultation if you are experiencing emotional distress, difficulty coping with life changes, anger concerns, anxiety symptoms, sleep issues, stress, or challenges related to substance use and behavioral health.",

  keyServices: [
    {
      Icon: FiActivity,
      title: "Behavioral Health Evaluations",
      description:
        "Comprehensive assessments to understand emotional, behavioral, and mental wellness concerns.",
    },
    {
      Icon: FiThermometer,
      title: "Stress & Life Transition Support",
      description:
        "Guidance for managing major life changes, personal challenges, and adjustment-related concerns.",
    },
    {
      Icon: MdOutlineVaccines,
      title: "Emotional Wellness Counseling",
      description:
        "Personalized strategies to improve emotional resilience, self-awareness, and coping skills.",
    },
    {
      Icon: FiDroplet,
      title: "Sleep & Anxiety Management",
      description:
        "Support for anxiety-related sleep issues, stress-related insomnia, and emotional well-being.",
    },
    {
      Icon: MdOutlineSpa,
      title: "Substance Use Support Services",
      description:
        "Compassionate care and guidance for individuals seeking support with substance-related concerns.",
    },
    {
      Icon: FiUsers,
      title: "Ongoing Behavioral Health Care",
      description:
        "Continuous monitoring and personalized treatment plans designed to support long-term wellness.",
    },
  ],

  benefits: [
    {
      Icon: FiSearch,
      title: "Improved Emotional Well-Being",
      description:
        "Develop healthier coping strategies and improve emotional resilience.",
    },
    {
      Icon: FiTrendingUp,
      title: "Better Stress Management",
      description:
        "Learn practical tools to manage everyday stress and challenging situations.",
    },
    {
      Icon: FiShield,
      title: "Stronger Relationships",
      description:
        "Improve communication skills, emotional awareness, and relationship dynamics.",
    },
    {
      Icon: FiHeart,
      title: "Enhanced Quality of Life",
      description:
        "Support overall mental wellness, personal growth, and long-term well-being.",
    },
  ],

  conditions: [
    {
      Icon: FiActivity,
      name: "Adjustment Difficulties",
      description:
        "Support for emotional challenges associated with life transitions, personal changes, and stressful events.",
    },
    {
      Icon: FiZap,
      name: "Anger Management",
      description:
        "Strategies to help manage frustration, emotional reactions, and healthy expression of emotions.",
    },
    {
      Icon: FiMoon,
      name: "Sleep-Related Anxiety",
      description:
        "Care for anxiety affecting sleep quality, bedtime worries, racing thoughts, and sleep disturbances.",
    },
    {
      Icon: FiShield,
      name: "Substance Use Support",
      description:
        "Guidance and support for individuals seeking help with substance-related concerns and recovery goals.",
    },
    {
      Icon: FiTrendingUp,
      name: "Stress Management",
      description:
        "Evaluation and treatment strategies for chronic stress, burnout, and overwhelming life demands.",
    },
    {
      Icon: FiCompass,
      name: "Emotional Regulation Challenges",
      description:
        "Support for managing intense emotions and developing healthier coping mechanisms.",
    },
    {
      Icon: FiBriefcase,
      name: "Work & Career Stress",
      description:
        "Assistance navigating workplace stress, professional burnout, and performance-related concerns.",
    },
    {
      Icon: FiUsers,
      name: "Relationship Concerns",
      description:
        "Guidance for communication challenges, interpersonal conflicts, and emotional relationship stress.",
    },
    {
      Icon: FiMap,
      name: "Life Transition Support",
      description:
        "Care for major life events including career changes, relocation, parenting, and personal transitions.",
    },
    {
      Icon: FiHeart,
      name: "Self-Esteem & Confidence Issues",
      description:
        "Support for building self-confidence, self-worth, and emotional resilience.",
    },
    {
      Icon: FiTarget,
      name: "Behavioral Wellness Coaching",
      description:
        "Personalized strategies to improve daily habits, emotional health, and overall wellness.",
    },
    {
      Icon: FiSearch,
      name: "Mental Wellness Support",
      description:
        "Comprehensive care focused on maintaining emotional balance and psychological well-being.",
    },
  ],

  faqs: [
    {
      question: "What is behavioral health?",
      answer:
        "Behavioral health focuses on emotional well-being, behaviors, habits, coping skills, and their impact on overall health.",
    },
    {
      question: "What conditions do behavioral health specialists treat?",
      answer:
        "They commonly help with adjustment difficulties, anger management, stress, sleep-related anxiety, substance use concerns, and emotional wellness challenges.",
    },
    {
      question: "How is behavioral health different from mental health?",
      answer:
        "Behavioral health includes mental health while also addressing behaviors, habits, lifestyle factors, and emotional wellness.",
    },
    {
      question: "When should I seek behavioral health support?",
      answer:
        "You should consider support if emotional or behavioral challenges are affecting your daily life, relationships, work, or overall well-being.",
    },
    {
      question: "Can behavioral health specialists help with stress?",
      answer:
        "Yes. Specialists provide strategies to manage stress, improve resilience, and reduce its impact on daily life.",
    },
    {
      question: "What are adjustment difficulties?",
      answer:
        "Adjustment difficulties occur when emotional or behavioral responses to life changes become overwhelming or difficult to manage.",
    },
    {
      question: "What is anger management?",
      answer:
        "Anger management focuses on understanding triggers, developing coping strategies, and improving emotional regulation.",
    },
    {
      question: "Can anxiety affect sleep?",
      answer:
        "Yes. Anxiety can contribute to difficulty falling asleep, staying asleep, and achieving restful sleep.",
    },
    {
      question: "What is substance use support?",
      answer:
        "Substance use support provides guidance, resources, and treatment strategies for individuals seeking help with substance-related concerns.",
    },
    {
      question: "Are behavioral health services confidential?",
      answer:
        "Yes. Behavioral health services are provided with strict privacy and confidentiality standards.",
    },
    {
      question: "Can telehealth be used for behavioral health appointments?",
      answer:
        "Yes. Many behavioral health consultations and follow-up appointments can be conducted through secure virtual visits.",
    },
    {
      question: "How can behavioral health improve quality of life?",
      answer:
        "It helps individuals build coping skills, improve emotional wellness, strengthen relationships, and manage challenges more effectively.",
    },
    {
      question: "What happens during a behavioral health evaluation?",
      answer:
        "A specialist will discuss symptoms, personal concerns, health history, goals, and recommend an appropriate care plan.",
    },
    {
      question: "Can behavioral health specialists help with burnout?",
      answer:
        "Yes. They provide support for stress, exhaustion, work-related burnout, and emotional fatigue.",
    },
    {
      question:
        "Is behavioral health care only for serious mental health conditions?",
      answer:
        "No. Behavioral health care can benefit anyone experiencing stress, emotional challenges, life transitions, or wellness concerns.",
    },
    {
      question: "How long does behavioral health treatment last?",
      answer:
        "Treatment varies depending on individual goals, symptoms, progress, and personal needs.",
    },
    {
      question: "Can behavioral health support help relationships?",
      answer:
        "Yes. Improved communication skills, emotional awareness, and coping strategies can strengthen relationships.",
    },
    {
      question:
        "How can I schedule an appointment with a behavioral health specialist?",
      answer:
        "You can book an appointment online and connect with a qualified behavioral health specialist through virtual or in-person care options.",
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
      "Receive care from experienced professionals trained in behavioral and emotional health.",
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
      "Connect securely with specialists from the comfort and privacy of your home.",
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
      "Benefit from customized treatment plans tailored to your individual needs and goals.",
  },
  {
    Icon: FiGlobe,
    title: "Nationwide Provider Network",
    description:
      "Access trusted behavioral health professionals and coordinated healthcare services.",
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
export default function BehavioralHealth({ data = SPECIALTY_DATA }) {
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
    return () => { cancelled = true; };
  }, [data.categoryId]);

  return (
    <>
      <HelmetProvider>
        <title>
          Behavioral Health Specialists | Mental Health & Emotional Wellness
          Support
        </title>
        <meta
          name="description"
          content="Connect with experienced behavioral health specialists for adjustment difficulties, anger management, sleep-related anxiety, substance use support, stress management, and emotional wellness care."
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
              <div className={`sp-hero__content-inner${heroLoaded ? " sp-hero__content-inner--loaded" : ""}`}>
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
              <div className="sp-conditions__head">
                <SectionLabel>Conditions &amp; Symptoms</SectionLabel>
                <h2>What We Treat</h2>
                <p>
                  Our {data.name.toLowerCase()} specialists provide
                  compassionate care for a wide range of emotional, behavioral,
                  and mental wellness concerns.
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
                  We combine experienced behavioral health specialists with
                  advanced technology to make mental and emotional wellness care
                  more accessible, convenient, and personalized.
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
                Take the next step toward better emotional wellness, healthier
                coping strategies, and improved quality of life. Schedule an
                appointment with a behavioral health specialist and receive
                personalized support designed around your needs.
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
