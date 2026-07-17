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

import heroImage from "../../../assets/SpecialitiesImage/menopause-care-specialist-womens-health-consultation.webp";
import overviewImage from "../../../assets/SpecialitiesImage/menopause-specialist-hormonal-health-patient-consultation.webp";
import BookingCard from "../../../components/SpecialityBookingCard";
import api from "../../../api";
// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "menopause-care",
  name: "Menopause Care",
  categoryId: "women",
  tagline: "Personalized Support Through Every Stage of Menopause.",
  heroDescription:
    "Menopause is a natural phase of life that brings hormonal changes affecting physical, emotional, and overall well-being. Menopause Care focuses on helping women understand, manage, and navigate these changes with confidence through personalized treatment plans and evidence-based healthcare support.Whether you're experiencing hot flashes, sleep disturbances, mood changes, or exploring hormone replacement therapy options, menopause specialists provide compassionate care designed to improve comfort, health, and quality of life.",
  heroImage: heroImage,
  heroAlt:
    "Menopause care specialist providing women's hormonal health consultation",
  overviewImage: overviewImage,
  overviewAlt:
    "Menopause specialist consulting with a patient about hormonal health and wellness",
  overviewDescription:
    "Menopause Care is a specialized area of women's healthcare focused on supporting women during perimenopause, menopause, and postmenopause. As estrogen and other hormone levels change, women may experience symptoms that affect daily life, sleep, emotional health, sexual wellness, and overall health.",
  overviewImportance:
    "Menopause specialists help patients understand their symptoms, evaluate treatment options, manage hormonal changes, and create individualized care plans that support long-term wellness and healthy aging.",
  conditionsTreated:
    "Menopause care specialists help manage hot flashes, night sweats, mood changes, sleep disturbances, hormonal fluctuations, vaginal dryness, sexual health concerns, and menopause-related wellness challenges.",
  whenToConsult:
    "Consider a menopause consultation if you're experiencing symptoms that interfere with daily life, have questions about hormone therapy, or want guidance navigating hormonal changes during midlife.",

  keyServices: [
    {
      Icon: FiActivity,
      title: "Menopause Symptom Management",
      description:
        "Comprehensive evaluation and treatment strategies for menopause-related symptoms.",
    },
    {
      Icon: FiShield,
      title: "Hormone Replacement Therapy (HRT) Guidance",
      description:
        "Personalized discussions about HRT options, benefits, risks, and suitability.",
    },
    {
      Icon: FiSearch,
      title: "Hormonal Health Assessments",
      description:
        "Evaluation of symptoms and hormone-related health concerns.",
    },
    {
      Icon: FiMoon,
      title: "Sleep & Wellness Support",
      description:
        "Strategies to improve sleep quality, energy levels, and overall well-being.",
    },
    {
      Icon: FiHeart,
      title: "Sexual Health Consultations",
      description:
        "Support for intimacy concerns, vaginal health, and sexual wellness during menopause.",
    },
    {
      Icon: FiTrendingUp,
      title: "Healthy Aging Planning",
      description:
        "Long-term wellness strategies that support bone, heart, and overall health.",
    },
  ],
  benefits: [
    {
      Icon: FiHeart,
      title: "Improved Quality of Life",
      description:
        "Reduce symptom burden and improve daily comfort and well-being.",
    },
    {
      Icon: FiActivity,
      title: "Better Symptom Control",
      description:
        "Receive personalized treatment recommendations based on your health needs.",
    },
    {
      Icon: FiSearch,
      title: "Informed Treatment Decisions",
      description:
        "Understand available options and make confident healthcare choices.",
    },
    {
      Icon: FiTrendingUp,
      title: "Long-Term Health Support",
      description:
        "Promote healthy aging and address wellness concerns beyond menopause.",
    },
  ],
  conditions: [
    {
      Icon: FiActivity,
      name: "Hot Flashes",
      description:
        "Management of sudden feelings of warmth, flushing, and temperature sensitivity.",
    },
    {
      Icon: FiShield,
      name: "HRT Guidance",
      description:
        "Personalized discussions regarding hormone replacement therapy options and considerations.",
    },
    {
      Icon: FiHeart,
      name: "Menopause Symptoms",
      description:
        "Evaluation and treatment support for common menopause-related physical and emotional changes.",
    },
    {
      Icon: FiWind,
      name: "Night Sweats",
      description:
        "Support for excessive sweating episodes that occur during sleep.",
    },
    {
      Icon: FiUserCheck,
      name: "Mood Changes",
      description:
        "Guidance for emotional fluctuations, irritability, and mood-related concerns.",
    },
    {
      Icon: FiMoon,
      name: "Sleep Disturbances",
      description:
        "Care for insomnia, disrupted sleep patterns, and menopause-related sleep issues.",
    },
    {
      Icon: FiDroplet,
      name: "Vaginal Dryness",
      description:
        "Support for vaginal discomfort, dryness, and intimacy-related concerns.",
    },
    {
      Icon: FiActivity,
      name: "Low Energy & Fatigue",
      description:
        "Assessment and management of energy-related symptoms associated with hormonal changes.",
    },
    {
      Icon: FiHeart,
      name: "Sexual Wellness Concerns",
      description:
        "Personalized care for libido changes, discomfort, and sexual health questions.",
    },
    {
      Icon: FiTrendingUp,
      name: "Perimenopause Symptoms",
      description:
        "Guidance for women experiencing early hormonal changes before menopause.",
    },
    {
      Icon: FiRefreshCw,
      name: "Postmenopause Wellness",
      description: "Long-term health planning following menopause.",
    },
    {
      Icon: FiShield,
      name: "Healthy Aging Support",
      description:
        "Preventive care focused on maintaining wellness during and after menopause.",
    },
  ],

  faqs: [
    {
      question: "What is menopause?",
      answer:
        "Menopause is a natural stage of life that marks the end of menstrual cycles and reproductive years.",
    },
    {
      question: "At what age does menopause usually occur?",
      answer:
        "Menopause commonly occurs between ages 45 and 55, although timing varies among individuals.",
    },
    {
      question: "What is perimenopause?",
      answer:
        "Perimenopause is the transitional period leading up to menopause when hormone levels begin to change.",
    },
    {
      question: "What are the most common menopause symptoms?",
      answer:
        "Common symptoms include hot flashes, night sweats, mood changes, sleep disturbances, and vaginal dryness.",
    },
    {
      question: "What causes hot flashes?",
      answer:
        "Hot flashes are believed to result from hormonal changes affecting the body's temperature regulation system.",
    },
    {
      question: "Can menopause affect sleep?",
      answer:
        "Yes. Many women experience insomnia, night sweats, or disrupted sleep during menopause.",
    },
    {
      question: "What is hormone replacement therapy (HRT)?",
      answer:
        "HRT is a treatment option that may help manage certain menopause-related symptoms for eligible individuals.",
    },
    {
      question: "Is HRT right for everyone?",
      answer:
        "No. Treatment decisions should be based on individual health history, symptoms, and personal preferences.",
    },
    {
      question: "Can menopause affect mood?",
      answer:
        "Yes. Hormonal fluctuations may contribute to mood changes, irritability, and emotional symptoms.",
    },
    {
      question: "Why does menopause affect sexual health?",
      answer:
        "Hormonal changes may influence vaginal comfort, libido, and overall sexual wellness.",
    },
    {
      question: "What is postmenopause?",
      answer:
        "Postmenopause refers to the stage after menopause has occurred and menstrual periods have permanently stopped.",
    },
    {
      question: "Can telehealth be used for menopause care?",
      answer:
        "Yes. Many menopause consultations and follow-up visits can be conducted virtually.",
    },
    {
      question: "How long do menopause symptoms last?",
      answer:
        "The duration varies significantly between individuals and symptom types.",
    },
    {
      question: "Can lifestyle changes help manage menopause symptoms?",
      answer:
        "Healthy nutrition, physical activity, stress management, and good sleep habits may support overall well-being.",
    },
    {
      question: "Is menopause a medical condition?",
      answer:
        "No. Menopause is a natural life stage, though symptoms may benefit from medical support.",
    },
    {
      question: "Can menopause affect long-term health?",
      answer:
        "Hormonal changes may influence bone health, heart health, and overall wellness over time.",
    },
    {
      question: "When should I speak with a menopause specialist?",
      answer:
        "You should consider consulting a specialist if symptoms affect your quality of life or if you have questions about treatment options.",
    },
    {
      question: "How can I schedule a menopause care consultation?",
      answer:
        "You can book an appointment online and connect with a menopause specialist through secure telemedicine services.",
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
    title: "Experienced Women's Health Providers",
    description:
      "Receive support from healthcare professionals experienced in menopause and hormonal health.",
  },
  {
    Icon: FiClock,
    title: "Fast Appointments",
    description: "Schedule consultations quickly and conveniently.",
  },
  {
    Icon: FiMonitor,
    title: "Telehealth Access",
    description:
      "Connect securely from home through virtual healthcare services.",
  },
  {
    Icon: FiUserCheck,
    title: "Personalized Treatment Plans",
    description:
      "Receive recommendations tailored to your symptoms, goals, and medical history.",
  },
  {
    Icon: FiRefreshCw,
    title: "Ongoing Care Support",
    description: "Access continued guidance as your healthcare needs evolve.",
  },
  {
    Icon: FiHeart,
    title: "Whole-Person Care",
    description:
      "Address physical, emotional, and lifestyle factors affecting menopause wellness.",
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
export default function MenopauseCare({ data = SPECIALTY_DATA }) {
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
          Menopause Care Specialists | Menopause Symptoms, HRT Guidance &
          Women's Health Support
        </title>
        <meta
          name="description"
          content="Connect with menopause care specialists for menopause symptom management, hot flashes, hormone replacement therapy guidance, hormonal health support, and personalized women's healthcare."
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
                <SectionLabel>Conditions & Symptoms</SectionLabel>
                <h2>What We Treat</h2>
                <p>
                  Our menopause care specialists provide support for a wide
                  range of menopause-related concerns and hormonal health needs.
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
              <span className="sp-cta__eyebrow">GET STARTED TODAY</span>
              <h2 className="sp-cta__heading">
                Ready to Connect with a<span>{data.name}</span> Specialist?
              </h2>
              <p className="sp-cta__sub">
                Connect with a menopause care specialist for personalized
                support, symptom management, hormonal health guidance, and
                treatment recommendations designed to help you thrive through
                every stage of menopause.
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
