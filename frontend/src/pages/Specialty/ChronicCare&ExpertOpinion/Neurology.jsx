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

import heroImage from "../../../assets/SpecialitiesImage/neurology-specialist-brain-nerve-care.webp";
import overviewImage from "../../../assets/SpecialitiesImage/neurology-consultation-brain-health-specialist.webp";
import BookingCard from "../../../components/SpecialityBookingCard";
import api from "../../../api";
import SEO from "../../../components/Seo";
// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "neurology",
  name: "Neurology",
  categoryId: "chronic",
  tagline: "Expert Care for Brain, Nerve, and Neurological Health.",
  heroDescription:
    "Neurology specialists diagnose and treat conditions affecting the brain, spinal cord, nerves, and nervous system. From migraines and dizziness to memory concerns, seizures, and nerve disorders, neurologists provide comprehensive care to help patients improve neurological function, manage symptoms, and maintain a better quality of life.",
  heroImage: heroImage,
  heroAlt:
    "Board-certified neurology specialist providing expert diagnosis and treatment for brain, spinal cord, nerve, migraine, seizure, and neurological disorders.",
  overviewImage: overviewImage,
  overviewAlt:
    "Neurology specialist consulting with a patient about brain health, migraines, memory concerns, nerve disorders, and neurological treatment.",
  overviewDescription:
    "Neurology is a medical specialty focused on diagnosing, treating, and managing disorders that affect the nervous system. Neurologists evaluate symptoms related to the brain, spinal cord, peripheral nerves, and muscles, helping patients understand the underlying causes of neurological conditions and receive appropriate treatment.",
  overviewImportance:
    "Through advanced neurological evaluations, personalized treatment plans, symptom management, and ongoing monitoring, neurology specialists help patients address both acute and chronic neurological disorders while supporting long-term brain and nerve health.",
  conditionsTreated:
    "Neurology specialists diagnose and manage migraines, dizziness, memory concerns, seizures, tremors, numbness, tingling, chronic headaches, and a wide range of neurological conditions affecting the nervous system.",
  whenToConsult:
    "Schedule a visit with a neurology specialist if you experience recurring headaches, dizziness, memory changes, numbness, tingling, tremors, seizures, balance problems, weakness, or other symptoms affecting neurological function.",

  keyServices: [
    {
      Icon: FiActivity,
      title: "Comprehensive Neurological Evaluations",
      description:
        "Detailed assessments to identify neurological symptoms, diagnose conditions, and develop personalized treatment plans.",
    },
    {
      Icon: FiThermometer,
      title: "Headache & Migraine Management",
      description:
        "Specialized care for migraines, chronic headaches, and neurological pain disorders.",
    },
    {
      Icon: MdOutlineVaccines,
      title: "Memory & Cognitive Assessments",
      description:
        "Evaluation of memory concerns, cognitive changes, concentration difficulties, and neurological health.",
    },
    {
      Icon: FiDroplet,
      title: "Seizure & Epilepsy Care",
      description:
        "Diagnosis, treatment, and long-term management of seizure disorders and epilepsy.",
    },
    {
      Icon: MdOutlineSpa,
      title: "Nerve Disorder Treatment",
      description:
        "Care for numbness, tingling, neuropathy, nerve injuries, and other neurological symptoms.",
    },
    {
      Icon: FiUsers,
      title: "Movement Disorder Management",
      description:
        "Evaluation and treatment of tremors, coordination issues, and neurological movement disorders.",
    },
  ],

  benefits: [
    {
      Icon: FiSearch,
      title: "Early Detection of Neurological Conditions",
      description:
        "Identifies neurological disorders early to improve treatment outcomes and long-term management.",
    },
    {
      Icon: FiTrendingUp,
      title: "Improved Symptom Control",
      description:
        "Helps reduce the impact of headaches, seizures, nerve symptoms, and neurological complications.",
    },
    {
      Icon: FiShield,
      title: "Better Cognitive & Brain Health",
      description:
        "Supports memory, concentration, cognitive function, and overall neurological wellness.",
    },
    {
      Icon: FiHeart,
      title: "Long-Term Neurological Care",
      description:
        "Provides ongoing monitoring and treatment plans to help patients maintain independence and quality of life.",
    },
  ],

  conditions: [
    {
      Icon: GiHeartOrgan,
      name: "Migraine ",
      desc: "Evaluation for irregular heart sensations.",
      path: "/chronic-care/neurology/migraine",
    },
    {
      Icon: FiHeart,
      name: "Chronic Migraine",
      desc: "Support for healthy infant feeding",
      path: "/chronic-care/neurology/chronic-migraine",
    },
    {
      Icon: FiZap,
      name: "Seizures / Epilepsy follow-up",
      desc: "Cold and flu symptoms in children",
      path: "/chronic-care/neurology/seizures-epilepsy-follow-up",
    },
    {
      Icon: MdOutlineBloodtype,
      name: "Numbness & Tingling",
      desc: "Fever and illness in children",
      path: "/chronic-care/neurology/numbness-and-tingling",
    },
    {
      Icon: FiTrendingUp,
      name: "Tremor",
      desc: "Red, itchy, irritated skin in kids",
      path: "/chronic-care/neurology/tremor",
    },
    {
      Icon: FiTarget,
      name: "Dizziness",
      desc: "Red, itchy, irritated skin in kids",
      path: "/chronic-care/neurology/dizziness",
    },
    {
      Icon: GiLungs,
      name: "Memory concerns",
      desc: "Evaluation for irregular heart sensations.",
      path: "/chronic-care/neurology/memory-concerns",
    },

  ],

  faqs: [
    {
      question: "What is neurology?",
      answer:
        "Neurology is the medical specialty focused on diagnosing and treating disorders affecting the brain, spinal cord, nerves, and nervous system.",
    },
    {
      question: "What conditions do neurologists treat?",
      answer:
        "Neurologists treat migraines, seizures, epilepsy, dizziness, memory concerns, tremors, neuropathy, and other neurological disorders.",
    },
    {
      question: "When should I see a neurologist?",
      answer:
        "You should seek neurological care if you experience chronic headaches, dizziness, numbness, tingling, memory changes, tremors, seizures, or unexplained weakness.",
    },
    {
      question: "What causes migraines?",
      answer:
        "Migraines may be triggered by stress, hormonal changes, sleep disturbances, certain foods, environmental factors, and neurological conditions.",
    },
    {
      question: "What is the difference between a headache and a migraine?",
      answer:
        "Migraines often involve severe pain along with symptoms such as nausea, sensitivity to light, sound, or visual disturbances.",
    },
    {
      question: "What causes dizziness?",
      answer:
        "Dizziness can result from inner ear disorders, neurological conditions, blood pressure changes, medication effects, or balance problems.",
    },
    {
      question: "When should memory problems be evaluated?",
      answer:
        "Memory concerns should be evaluated when they interfere with daily activities, work performance, relationships, or overall quality of life.",
    },
    {
      question: "What causes numbness and tingling?",
      answer:
        "Numbness and tingling may result from nerve compression, neuropathy, injuries, circulation problems, or neurological disorders.",
    },
    {
      question: "What is epilepsy?",
      answer:
        "Epilepsy is a neurological disorder characterized by recurring seizures caused by abnormal electrical activity in the brain.",
    },
    {
      question: "Can seizures be treated?",
      answer:
        "Yes. Many seizure disorders can be effectively managed through medication, monitoring, and specialized neurological care.",
    },
    {
      question: "What is a tremor?",
      answer:
        "A tremor is an involuntary shaking movement that may affect the hands, head, voice, arms, or other body parts.",
    },
    {
      question: "What tests do neurologists use?",
      answer:
        "Neurologists may use neurological examinations, imaging studies, nerve conduction testing, EEGs, and cognitive assessments.",
    },
    {
      question: "Can neurological conditions affect memory?",
      answer:
        "Yes. Many neurological disorders can impact memory, concentration, thinking skills, and cognitive function.",
    },
    {
      question: "Are telehealth neurology appointments available?",
      answer:
        "Yes. Many neurological consultations, follow-up visits, medication reviews, and symptom discussions can be conducted virtually.",
    },
    {
      question: "Can stress worsen neurological symptoms?",
      answer:
        "Yes. Stress can contribute to migraines, dizziness, sleep disturbances, cognitive issues, and other neurological symptoms.",
    },
    {
      question: "What are common warning signs of neurological disorders?",
      answer:
        "Symptoms may include persistent headaches, seizures, dizziness, memory loss, numbness, weakness, balance problems, or vision changes.",
    },
    {
      question: "How can I support brain health?",
      answer:
        "Regular exercise, quality sleep, stress management, a healthy diet, cognitive activity, and routine healthcare support neurological wellness.",
    },
    {
      question:
        "How can I schedule an appointment with a neurology specialist?",
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
      "Receive care from experienced neurologists dedicated to diagnosing and managing neurological conditions.",
  },
  {
    Icon: FiZap,
    title: "Fast Appointments",
    description:
      "Schedule neurological consultations quickly with convenient appointment availability.",
  },
  {
    Icon: FiMonitor,
    title: "Telehealth Access",
    description:
      "Connect securely with neurology specialists through virtual consultations and follow-up appointments.",
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
      "Benefit from individualized neurological treatment plans based on your symptoms and health goals.",
  },
  {
    Icon: FiGlobe,
    title: "Global Provider Network",
    description:
      "Access a broad network of neurology specialists and coordinated healthcare services.",
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
export default function Neurology({ data = SPECIALTY_DATA }) {
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
        title="Neurology Specialists | Brain, Nerve & Neurological Care"
        description="Get expert neurology care for migraines, dizziness, memory concerns, tremors, seizures, numbness, tingling, and neurological disorders."
        keywords="Neurology specialist, Migraine treatment, Neurological care, Online neurology consultation"
        url="https://humancareconnect.co/neurology"
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
            <div
              className={`sp-hero__content-inner${heroLoaded ? " sp-hero__content-inner--loaded" : ""}`}
            >
              <span className="sp-hero__badge">Chronic Care</span>
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
                  a wide range of neurological disorders affecting the brain,
                  spinal cord, nerves, and muscular system.
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
                  We combine experienced neurology specialists with advanced
                  technology to make neurological care more accessible,
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
                Take control of your neurological health with expert care,
                personalized treatment plans, and convenient appointment
                options. Schedule an in-person or virtual visit with a neurology
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
