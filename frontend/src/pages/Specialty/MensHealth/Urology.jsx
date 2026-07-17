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

import heroImage from "../../../assets/SpecialitiesImage/urology-specialist-urinary-kidney-care.webp";
import overviewImage from "../../../assets/SpecialitiesImage/board-certified-urology-specialist-consultation.webp";
import BookingCard from "../../../components/SpecialityBookingCard";
import api from "../../../api";

// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "urology",
  name: "Urology",
  categoryId: "men",
  tagline: "Expert Care for Urinary and Reproductive Health.",
  heroDescription:
    "Urology specialists diagnose and treat conditions affecting the urinary tract, kidneys, bladder, and male reproductive system. From urinary tract infections and kidney stones to bladder concerns and urinary incontinence, urology care helps patients maintain healthy urinary function, prevent complications, and improve overall quality of life.",
  heroImage: heroImage,
  heroAlt:
    "Urology specialist providing diagnosis and treatment for kidney, bladder, urinary tract, and male reproductive health conditions",
  overviewImage: overviewImage,
  overviewAlt:
    "Board-certified urology specialist consulting with a patient about urinary and kidney health",
  overviewDescription:
    "Urology is a medical specialty focused on diagnosing, treating, and preventing conditions affecting the urinary system, including the kidneys, bladder, ureters, and urethra. Urologists also provide care for male reproductive health concerns and urinary conditions that can impact daily comfort and overall wellness.",
  overviewImportance:
    "Through comprehensive evaluations, diagnostic testing, personalized treatment plans, and preventive care, urology specialists help patients manage urinary symptoms, protect kidney health, and improve long-term urinary function.",
  conditionsTreated:
    "Urology specialists diagnose and manage bladder problems, kidney stones, urinary tract infections, urinary incontinence, blood in urine, and other urinary health conditions.",
  whenToConsult:
    "Schedule a consultation if you experience painful urination, blood in urine, urinary leakage, frequent urination, kidney stone symptoms, bladder concerns, or recurring urinary tract infections.",

  keyServices: [
    {
      Icon: FiActivity,
      title: "Urinary Health Evaluations",
      description:
        "Comprehensive assessments for urinary symptoms, bladder concerns, and kidney-related conditions.",
    },
    {
      Icon: FiThermometer,
      title: "Kidney Stone Management",
      description:
        "Diagnosis, treatment recommendations, and preventive strategies for kidney stone care.",
    },
    {
      Icon: MdOutlineVaccines,
      title: "Bladder Function Assessment",
      description:
        "Evaluation of bladder control issues, urinary frequency, urgency, and urinary retention.",
    },
    {
      Icon: FiDroplet,
      title: "UTI Diagnosis & Treatment",
      description:
        "Care for urinary tract infections and recurrent urinary symptoms.",
    },
    {
      Icon: MdOutlineSpa,
      title: "Male Urological Health Support",
      description:
        "Evaluation and management of urinary and reproductive health concerns affecting men.",
    },
    {
      Icon: FiUsers,
      title: "Preventive Urology Care",
      description:
        "Routine screenings and wellness strategies to maintain urinary tract and kidney health.",
    },
  ],

  benefits: [
    {
      Icon: FiSearch,
      title: "Early Detection",
      description:
        "Identify urinary and kidney conditions before they become more serious.",
    },
    {
      Icon: FiTrendingUp,
      title: "Improved Comfort",
      description:
        "Reduce symptoms such as pain, urgency, frequency, and urinary discomfort.",
    },
    {
      Icon: FiShield,
      title: "Better Kidney Health",
      description:
        "Protect kidney function through early diagnosis and ongoing monitoring.",
    },
    {
      Icon: FiHeart,
      title: "Enhanced Quality of Life",
      description:
        "Improve daily comfort, confidence, and overall urinary health.",
    },
  ],

  conditions: [
    {
      Icon: FiActivity,
      name: "Bladder Problems",
      description:
        "Evaluation and treatment of bladder discomfort, urgency, frequent urination, and bladder dysfunction.",
    },
    {
      Icon: FiDroplet,
      name: "Blood in Urine",
      description:
        "Assessment of visible or microscopic blood in urine to identify potential underlying causes.",
    },
    {
      Icon: FiShield,
      name: "Kidney Stones",
      description:
        "Diagnosis and management of kidney stones causing pain, urinary symptoms, and urinary tract complications.",
    },
    {
      Icon: FiTarget,
      name: "Urinary Incontinence",
      description:
        "Treatment for loss of bladder control, urinary leakage, and related quality-of-life concerns.",
    },
    {
      Icon: FiAlertCircle,
      name: "Urinary Tract Infection (UTI)",
      description:
        "Diagnosis and treatment of bacterial infections affecting the urinary tract.",
    },
    {
      Icon: FiTrendingUp,
      name: "Frequent Urination",
      description:
        "Evaluation of increased urinary frequency and underlying urinary system concerns.",
    },
    {
      Icon: FiZap,
      name: "Painful Urination",
      description:
        "Assessment of burning, discomfort, or pain while urinating.",
    },
    {
      Icon: FiCompass,
      name: "Urinary Urgency",
      description:
        "Management of sudden, difficult-to-control urges to urinate.",
    },
    {
      Icon: FiRepeat,
      name: "Recurrent UTIs",
      description:
        "Investigation and treatment planning for repeated urinary tract infections.",
    },
    {
      Icon: FiHeart,
      name: "Kidney Health Concerns",
      description:
        "Evaluation of kidney-related symptoms and conditions affecting urinary function.",
    },
    {
      Icon: FiUsers,
      name: "Male Urinary Health",
      description:
        "Assessment of urinary symptoms commonly affecting men's health and wellness.",
    },
    {
      Icon: FiSearch,
      name: "Preventive Urology Screening",
      description:
        "Routine evaluations designed to identify risks and support long-term urinary health.",
    },
  ],

  faqs: [
    {
      question: "What is urology?",
      answer:
        "Urology is the medical specialty focused on conditions affecting the urinary tract, kidneys, bladder, and male reproductive system.",
    },
    {
      question: "What conditions do urologists treat?",
      answer:
        "Urologists commonly treat kidney stones, urinary tract infections, urinary incontinence, bladder problems, blood in urine, and urinary symptoms.",
    },
    {
      question: "When should I see a urologist?",
      answer:
        "You should consult a urologist if you experience urinary symptoms, blood in urine, kidney stone symptoms, urinary leakage, or recurrent infections.",
    },
    {
      question: "What causes blood in urine?",
      answer:
        "Blood in urine can be caused by infections, kidney stones, bladder conditions, or other urinary tract disorders.",
    },
    {
      question: "What are the symptoms of kidney stones?",
      answer:
        "Symptoms may include severe side pain, nausea, blood in urine, painful urination, and urinary urgency.",
    },
    {
      question: "What is urinary incontinence?",
      answer:
        "Urinary incontinence is the loss of bladder control that may cause accidental urine leakage.",
    },
    {
      question: "What causes urinary tract infections?",
      answer:
        "UTIs are usually caused by bacteria entering the urinary tract and multiplying within the system.",
    },
    {
      question: "Are urinary tract infections common?",
      answer:
        "Yes. UTIs are among the most common urinary conditions and can affect both men and women.",
    },
    {
      question: "Why do I urinate frequently?",
      answer:
        "Frequent urination may be related to infections, bladder conditions, medications, diabetes, or other health concerns.",
    },
    {
      question: "Can kidney stones be prevented?",
      answer:
        "In many cases, hydration, dietary changes, and medical guidance can help reduce the risk of kidney stones.",
    },
    {
      question: "What causes urinary urgency?",
      answer:
        "Urinary urgency may result from infections, bladder irritation, overactive bladder, or other urinary conditions.",
    },
    {
      question: "Can urologists treat recurring UTIs?",
      answer:
        "Yes. Urologists can evaluate underlying causes and develop treatment plans to reduce recurrence.",
    },
    {
      question: "Are telehealth appointments available for urology?",
      answer:
        "Yes. Many consultations, follow-up visits, and symptom evaluations can be conducted through secure telehealth appointments.",
    },
    {
      question: "How are bladder problems diagnosed?",
      answer:
        "Diagnosis may include medical history review, symptom evaluation, physical examination, and diagnostic testing.",
    },
    {
      question: "Can urology specialists help with men's health concerns?",
      answer:
        "Yes. Urologists commonly evaluate and manage male urinary and reproductive health conditions.",
    },
    {
      question: "What are common signs of urinary problems?",
      answer:
        "Common symptoms include painful urination, urgency, frequency, blood in urine, leakage, and pelvic discomfort.",
    },
    {
      question: "How can I maintain urinary health?",
      answer:
        "Stay hydrated, practice healthy lifestyle habits, seek prompt treatment for infections, and attend regular health screenings.",
    },
    {
      question: "How can I schedule an appointment with a urology specialist?",
      answer:
        "You can book an appointment online and connect with a qualified urology specialist through virtual or in-person care options.",
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
      "Receive care from experienced providers specializing in urinary and kidney health.",
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
      "Connect securely with specialists through virtual consultations and follow-up visits.",
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
      "Benefit from individualized treatment plans tailored to your symptoms and health goals.",
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
export default function Urology({ data = SPECIALTY_DATA }) {
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
          Men's Health Specialists | Sexual Wellness, Hormone Health &
          Preventive Care
        </title>
        <meta
          name="description"
          content="Connect with experienced men's health specialists for erectile dysfunction, low testosterone, low libido, prostate health, hair loss, fertility concerns, and preventive wellness care."
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
<<<<<<< HEAD
            <div
              className={`sp-hero__content-inner${heroLoaded ? " sp-hero__content-inner--loaded" : ""}`}
            >
              <span className="sp-hero__badge">Men's Health</span>
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
=======
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
>>>>>>> 8c0363897c1995506a930504978d95507388135c
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
                  Our {data.name.toLowerCase()} specialists diagnose and manage
                  a wide range of urinary tract, kidney, bladder, and male
                  reproductive health conditions.
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
                  We combine experienced urology specialists with advanced
                  technology to make urinary healthcare more accessible,
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
                Get expert care for urinary symptoms, kidney concerns, bladder
                health, and preventive urological care. Schedule an appointment
                today and receive personalized treatment designed to improve
                your health and quality of life.
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
