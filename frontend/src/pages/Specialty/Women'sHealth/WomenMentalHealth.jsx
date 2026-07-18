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
  FiMoon,
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

import heroImage from "../../../assets/SpecialitiesImage/womens-mental-health-specialists-telehealth-support.webp";
import overviewImage from "../../../assets/SpecialitiesImage/womens-mental-health-consultation-emotional-wellness.webp";
import BookingCard from "../../../components/SpecialityBookingCard";
import api from "../../../api";
// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "women-mental-health",
  name: "Women's Mental Health",
  categoryId: "women",
  tagline: "Compassionate Mental Health Support for Every Stage of Womanhood.",
  heroDescription:
    "Women's Mental Health focuses on the emotional, psychological, and behavioral challenges that may occur throughout different stages of life, including menstruation, pregnancy, postpartum recovery, and hormonal transitions. Our specialists provide personalized support designed to help women navigate mental health concerns with confidence and care.Whether you're experiencing anxiety during pregnancy, mood changes related to hormonal fluctuations, or emotional challenges after childbirth, expert support can help improve your well-being and quality of life.",
  heroImage: heroImage,
  heroAlt:
    "Women's mental health specialist providing compassionate telehealth support for anxiety, postpartum depression, PMDD, and emotional wellness",
  overviewImage: overviewImage,
  overviewAlt:
    "Women's mental health consultation focused on emotional wellness, hormonal mood changes, pregnancy, and postpartum mental health",
  overviewDescription:
    "Women's Mental Health is a specialized area of healthcare focused on understanding and treating mental health concerns that may be influenced by hormonal, reproductive, social, and life-stage-related factors. Women may experience unique emotional challenges during pregnancy, postpartum recovery, menstrual cycles, fertility treatments, menopause, and other significant life transitions.",
  overviewImportance:
    "Specialists provide evidence-based care to support emotional resilience, mental wellness, healthy coping strategies, and overall psychological well-being.",
  conditionsTreated:
    "Women's mental health specialists commonly help with perinatal anxiety, PMDD, postpartum depression, mood changes, stress, emotional wellness concerns, and life-transition-related mental health challenges.",
  whenToConsult:
    "Consider seeking support if emotional symptoms interfere with daily life, relationships, parenting, work performance, sleep quality, or overall well-being.",

  keyServices: [
    {
      Icon: FiSearch,
      title: "Mental Health Evaluations",
      description:
        "Comprehensive assessments focused on emotional wellness and psychological health.",
    },
    {
      Icon: FiHeart,
      title: "Pregnancy & Postpartum Support",
      description:
        "Specialized care for mental health concerns before and after childbirth.",
    },
    {
      Icon: FiActivity,
      title: "Hormonal Mood Health Assessments",
      description:
        "Evaluation of emotional symptoms related to menstrual cycles and hormonal changes.",
    },
    {
      Icon: FiAlertCircle,
      title: "Anxiety Management Support",
      description:
        "Personalized strategies to manage worry, stress, and emotional overwhelm.",
    },
    {
      Icon: FiUsers,
      title: "Emotional Wellness Counseling",
      description:
        "Support for building resilience, coping skills, and long-term mental wellness.",
    },
    {
      Icon: FiRefreshCw,
      title: "Ongoing Mental Health Care",
      description:
        "Continued guidance and treatment planning tailored to your needs.",
    },
  ],
  benefits: [
    {
      Icon: FiHeart,
      title: "Improved Emotional Well-Being",
      description:
        "Receive support that helps improve mood, confidence, and daily functioning.",
    },
    {
      Icon: FiActivity,
      title: "Better Symptom Management",
      description:
        "Learn strategies to manage anxiety, mood changes, and emotional challenges.",
    },
    {
      Icon: FiUsers,
      title: "Stronger Support Systems",
      description:
        "Access professional guidance during important life transitions.",
    },
    {
      Icon: FiTrendingUp,
      title: "Healthier Quality of Life",
      description:
        "Improve relationships, self-care, and overall wellness through mental health support.",
    },
  ],
  conditions: [
    {
      Icon: FiAlertCircle,
      name: "Perinatal Anxiety",
      desc: "Support for anxiety during and after pregnancy",
      path: "/women-health/women-mental-health/perinatal-anxiety",
    },
    {
      Icon: FiActivity,
      name: "PMDD",
      desc: "Care for premenstrual dysphoric disorder",
      path: "/women-health/women-mental-health/pmdd",
    },
    {
      Icon: FiHeart,
      name: "Postnatal Depression",
      desc: "Support for depression after childbirth",
      path: "/women-health/women-mental-health/postnatal-depression",
    },

  ],
  faqs: [
    {
      question: "What is women's mental health?",
      answer:
        "Women's mental health focuses on emotional and psychological well-being throughout different stages of a woman's life.",
    },
    {
      question: "What is perinatal anxiety?",
      answer:
        "Perinatal anxiety refers to excessive worry, fear, or anxiety experienced during pregnancy or after childbirth.",
    },
    {
      question: "What is postpartum depression?",
      answer:
        "Postpartum depression is a mental health condition that may develop after childbirth and affect mood, energy, and emotional well-being.",
    },
    {
      question: "What is PMDD?",
      answer:
        "Premenstrual Dysphoric Disorder (PMDD) is a severe form of premenstrual mood symptoms that can significantly affect daily life.",
    },
    {
      question: "Can hormonal changes affect mental health?",
      answer:
        "Yes. Hormonal fluctuations may influence mood, emotions, sleep, and overall mental well-being.",
    },
    {
      question: "When should I seek support for emotional symptoms?",
      answer:
        "Support may be helpful whenever emotional symptoms interfere with daily functioning, relationships, work, or overall quality of life.",
    },
    {
      question: "Can anxiety occur during pregnancy?",
      answer:
        "Yes. Many women experience anxiety symptoms during pregnancy and the postpartum period.",
    },
    {
      question: "What are common signs of postpartum depression?",
      answer:
        "Symptoms may include persistent sadness, low mood, emotional distress, fatigue, and difficulty coping with daily activities.",
    },
    {
      question: "Is PMDD different from PMS?",
      answer:
        "Yes. PMDD generally involves more severe emotional and psychological symptoms than typical PMS.",
    },
    {
      question: "Can telehealth be used for women's mental health care?",
      answer:
        "Yes. Many mental health consultations and follow-up appointments can be conducted through secure virtual healthcare services.",
    },
    {
      question: "How can therapy help with women's mental health concerns?",
      answer:
        "Therapy can provide coping strategies, emotional support, and practical tools for managing symptoms.",
    },
    {
      question: "Can sleep problems affect mental health?",
      answer:
        "Yes. Poor sleep may contribute to emotional challenges, mood symptoms, and stress.",
    },
    {
      question: "Is postpartum depression common?",
      answer:
        "Postpartum emotional challenges affect many individuals and should be addressed with professional support when needed.",
    },
    {
      question: "Can parenting stress affect emotional well-being?",
      answer:
        "Yes. Parenting responsibilities and life changes can contribute to emotional stress and mental health concerns.",
    },
    {
      question: "What happens during a women's mental health consultation?",
      answer:
        "A provider reviews your symptoms, history, concerns, and goals to develop a personalized care plan.",
    },
    {
      question: "How long does treatment typically last?",
      answer:
        "Treatment duration varies based on symptoms, goals, and individual needs.",
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
    title: "Experienced Mental Health Specialists",
    description:
      "Connect with professionals experienced in women's emotional and psychological wellness.",
  },
  {
    Icon: FiClock,
    title: "Fast Appointments",
    description: "Access support quickly when you need it most.",
  },
  {
    Icon: FiMonitor,
    title: "Telehealth Access",
    description: "Receive care securely from the comfort and privacy of home.",
  },
  {
    Icon: FiUserCheck,
    title: "Personalized Treatment Plans",
    description:
      "Every care plan is designed around your symptoms, goals, and personal experiences.",
  },
  {
    Icon: FiRefreshCw,
    title: "Ongoing Support",
    description:
      "Receive continued guidance throughout your mental health journey.",
  },
  {
    Icon: FiHeart,
    title: "Whole-Person Care",
    description:
      "We focus on emotional, psychological, physical, and lifestyle factors that affect well-being.",
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
export default function WomenMentalHealth({ data = SPECIALTY_DATA }) {
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
          Women's Mental Health Specialists | Anxiety, PMDD & Postpartum Mental
          Health Support
        </title>
        <meta
          name="description"
          content="Connect with women's mental health specialists for PMDD, perinatal anxiety, postpartum depression, hormonal mood changes, emotional wellness support, and personalized mental healthcare."
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
              <span className="sp-hero__badge">Women's Health</span>
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
                <h3>Benefits of {data.name} Care</h3>
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
                <SectionLabel>Conditions & Symptoms</SectionLabel>
                <h2>What We Treat</h2>
                <p>
                  Our women's mental health specialists provide compassionate
                  care for a variety of emotional and psychological concerns.
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
                  We combine experienced mental health professionals with secure
                  telemedicine technology to make compassionate care accessible,
                  private, and convenient.
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
                Ready to Prioritize Your
                <span>{data.name}</span>Being?
              </h2>
              <p className="sp-cta__sub">
                Connect with a women's mental health specialist for
                compassionate support, personalized treatment recommendations,
                and expert guidance designed to help you feel supported,
                understood, and empowered.
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
