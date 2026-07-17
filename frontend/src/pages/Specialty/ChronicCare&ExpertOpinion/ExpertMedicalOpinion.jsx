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

import heroImage from "../../../assets/SpecialitiesImage/expert-medical-opinion-second-opinion-healthcare-specialist.webp";
import overviewImage from "../../../assets/SpecialitiesImage/expert-medical-opinion-consultation-review-medical-records.webp";
import BookingCard from "../../../components/SpecialityBookingCard";
import api from "../../../api";

// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "export-medical-opinion",
  name: "Expert Medical Opinion",
  categoryId: "chronic",
  tagline: "Confidence in Every Healthcare Decision.",
  heroDescription:
    "Expert Medical Opinion services provide patients with access to experienced specialists who review diagnoses, treatment recommendations, and complex medical conditions. Whether you're facing a new diagnosis, considering surgery, evaluating cancer treatment options, or seeking reassurance about your care plan, expert medical opinions can help you make informed healthcare decisions with greater confidence.",
  heroImage: heroImage,
  heroAlt:
    "Expert medical opinion specialist reviewing patient diagnosis and treatment plans",
  overviewImage: overviewImage,
  overviewAlt:
    "Expert medical opinion consultation with specialist reviewing medical records and treatment options",
  overviewDescription:
    "Expert Medical Opinion is a specialized healthcare service that provides independent reviews of medical diagnoses, treatment recommendations, surgical plans, and complex health conditions. Patients often seek a second opinion to confirm a diagnosis, explore alternative treatment options, or better understand their healthcare choices before making important medical decisions.",
  overviewImportance:
    "By reviewing medical records, diagnostic reports, imaging studies, pathology findings, and treatment plans, experienced specialists offer objective recommendations that help patients gain clarity, confidence, and peace of mind. Expert medical opinions can improve decision-making and ensure patients receive the most appropriate care for their unique situation.",
  conditionsTreated:
    "Expert Medical Opinion services support patients seeking additional guidance for cancer diagnoses, complex medical conditions, treatment plans, surgery recommendations, chronic illnesses, and uncertain diagnoses.",
  whenToConsult:
    "Consider an expert medical opinion if you've received a new diagnosis, are facing major surgery, have a complex medical condition, want to confirm a treatment recommendation, or are seeking additional clarity before making important healthcare decisions.",

  keyServices: [
    {
      Icon: FiActivity,
      title: "Second Medical Opinions",
      description:
        "Independent reviews of diagnoses and treatment recommendations to help patients make informed healthcare decisions.",
    },
    {
      Icon: FiThermometer,
      title: "Cancer Case Reviews",
      description:
        "Specialist evaluation of cancer diagnoses, pathology reports, treatment options, and ongoing cancer care plans.",
    },
    {
      Icon: MdOutlineVaccines,
      title: "Complex Diagnosis Evaluation",
      description:
        "Expert assessment of difficult, rare, or unresolved medical conditions requiring specialized review.",
    },
    {
      Icon: FiDroplet,
      title: "Surgery Recommendation Review",
      description:
        "Independent evaluation of proposed surgical procedures, risks, benefits, and alternative treatment options.",
    },
    {
      Icon: MdOutlineSpa,
      title: "Treatment Plan Assessments",
      description:
        "Comprehensive reviews of current treatment strategies to ensure patients understand available options and expected outcomes.",
    },
    {
      Icon: FiUsers,
      title: "Medical Record Analysis",
      description:
        "Detailed review of laboratory results, imaging studies, pathology reports, and clinical documentation.",
    },
  ],

  benefits: [
    {
      Icon: FiSearch,
      title: "Greater Confidence in Care Decisions",
      description:
        "Gain reassurance and clarity before proceeding with major healthcare decisions.",
    },
    {
      Icon: FiTrendingUp,
      title: "Access to Specialized Expertise",
      description:
        "Receive guidance from experienced specialists with expertise in specific medical conditions.",
    },
    {
      Icon: FiShield,
      title: "Improved Treatment Understanding",
      description:
        "Better understand diagnoses, treatment options, expected outcomes, and potential alternatives.",
    },
    {
      Icon: FiHeart,
      title: "Personalized Healthcare Guidance",
      description:
        "Receive recommendations tailored to your individual medical history, condition, and healthcare goals.",
    },
  ],

  conditions: [
    {
      Icon: FiAlertCircle,
      name: "Cancer Second Opinion",
      description:
        "Independent review of cancer diagnoses, pathology reports, treatment recommendations, and care plans.",
    },
    {
      Icon: FiDroplet,
      name: "Complex Diagnosis Review",
      description:
        "Expert evaluation of difficult-to-diagnose conditions, unresolved symptoms, and rare medical disorders.",
    },
    {
      Icon: FiWind,
      name: "Second Medical Opinion",
      description:
        "Comprehensive assessment of diagnoses and treatment recommendations from an experienced specialist.",
    },
    {
      Icon: FiThermometer,
      name: "Surgery Second Opinion",
      description:
        "Independent review of proposed surgical procedures, treatment options, and expected outcomes.",
    },
    {
      Icon: MdOutlineSpa,
      name: "Treatment Plan Review",
      description:
        "Evaluation of current treatment strategies to ensure patients understand all available options.",
    },
    {
      Icon: FiFeather,
      name: "Chronic Disease Management Reviews",
      description:
        "Assessment of treatment approaches for long-term conditions requiring ongoing medical care.",
    },
    {
      Icon: GiLungs,
      name: "Rare Disease Evaluations",
      description:
        "Specialized review of uncommon conditions requiring expert interpretation and recommendations.",
    },
    {
      Icon: FiActivity,
      name: "Neurological Condition Reviews",
      description:
        "Second opinions for neurological diagnoses, symptoms, treatment plans, and specialist recommendations.",
    },
    {
      Icon: FiTrendingUp,
      name: "Cardiovascular Condition Reviews",
      description:
        "Independent assessment of heart-related diagnoses, procedures, and cardiovascular treatment options.",
    },
    {
      Icon: FiClock,
      name: "Orthopedic Treatment Reviews",
      description:
        "Evaluation of musculoskeletal diagnoses, surgery recommendations, and rehabilitation plans.",
    },
    {
      Icon: FiBarChart2,
      name: "Gastrointestinal Disorder Reviews",
      description:
        "Expert review of digestive health diagnoses, testing results, and treatment recommendations.",
    },
    {
      Icon: MdOutlineHealthAndSafety,
      name: "Complex Multispecialty Cases",
      description:
        "Comprehensive review of medical conditions involving multiple specialists and treatment approaches.",
    },
  ],

  faqs: [
    {
      question: "What is an expert medical opinion?",
      answer:
        "An expert medical opinion is an independent review of a diagnosis, treatment plan, or medical condition provided by a qualified specialist.",
    },
    {
      question: "Why should I seek a second medical opinion?",
      answer:
        "A second opinion can help confirm a diagnosis, explore alternative treatments, and provide confidence before making important healthcare decisions.",
    },
    {
      question:
        "What conditions can be reviewed through an expert medical opinion?",
      answer:
        "Cancer diagnoses, surgical recommendations, chronic illnesses, complex conditions, rare diseases, and treatment plans can all be reviewed.",
    },
    {
      question: "Is seeking a second opinion common?",
      answer:
        "Yes. Many patients seek second opinions to better understand their condition and ensure they are receiving appropriate care.",
    },
    {
      question: "Can an expert medical opinion change my diagnosis?",
      answer:
        "In some cases, additional review may confirm, refine, or identify alternative explanations for a diagnosis.",
    },
    {
      question: "What information is needed for a medical review?",
      answer:
        "Medical records, imaging reports, pathology reports, laboratory results, treatment plans, and physician notes are often required.",
    },
    {
      question: "Can cancer diagnoses be reviewed?",
      answer:
        "Yes. Cancer second opinions commonly include pathology review, treatment recommendations, and care planning.",
    },
    {
      question: "Are surgery second opinions helpful?",
      answer:
        "Yes. They can help patients understand the necessity of surgery, alternative treatments, potential risks, and expected outcomes.",
    },
    {
      question: "What is a treatment plan review?",
      answer:
        "A treatment plan review evaluates whether the recommended care aligns with current medical standards and patient needs.",
    },
    {
      question: "Can expert opinions help with rare diseases?",
      answer:
        "Yes. Specialists can provide valuable insights into uncommon conditions and complex diagnoses.",
    },
    {
      question: "How long does an expert medical opinion take?",
      answer:
        "Timelines vary depending on the complexity of the case and the records being reviewed.",
    },
    {
      question: "Are expert medical opinions available through telehealth?",
      answer:
        "Yes. Many expert reviews and consultations can be conducted securely through virtual appointments.",
    },
    {
      question:
        "Will my current doctor be offended if I seek a second opinion?",
      answer:
        "Most healthcare providers understand and support patients who want additional information before making important decisions.",
    },
    {
      question: "Is an expert medical opinion confidential?",
      answer:
        "Yes. Medical information is reviewed securely and handled according to privacy and healthcare regulations.",
    },
    {
      question:
        "Can expert medical opinions help avoid unnecessary treatments?",
      answer:
        "In some cases, an independent review may identify alternative treatment options or confirm the most appropriate care path.",
    },
    {
      question: "How much does a second medical opinion cost?",
      answer:
        "Costs vary depending on the complexity of the case, specialist involvement, and healthcare coverage.",
    },
    {
      question: "Can I get a second opinion before surgery?",
      answer:
        "Yes. Many patients seek expert guidance before undergoing major or elective surgical procedures.",
    },
    {
      question: "How can I schedule an expert medical opinion consultation?",
      answer:
        "You can schedule an appointment online or contact the healthcare team to begin the review process and connect with an appropriate specialist.",
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
      "Receive reviews from experienced, credentialed specialists with expertise across multiple medical disciplines.",
  },
  {
    Icon: FiZap,
    title: "Fast Appointments",
    description:
      "Access expert medical reviews quickly when important healthcare decisions cannot wait.",
  },
  {
    Icon: FiMonitor,
    title: "Telehealth Access",
    description:
      "Connect securely with specialists through virtual consultations from anywhere.",
  },
  {
    Icon: FiShield,
    title: "Insurance Support",
    description:
      "Receive assistance understanding healthcare coverage, authorizations, and medical documentation requirements.",
  },
  {
    Icon: FiHeart,
    title: "Personalized Care",
    description:
      "Benefit from recommendations tailored to your medical history, diagnosis, and treatment goals.",
  },
  {
    Icon: FiGlobe,
    title: "Global Provider Network",
    description:
      "Access a broad network of specialists and multidisciplinary expertise across numerous healthcare specialties.",
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
export default function ExpertMedicalOpinion({ data = SPECIALTY_DATA }) {
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
          Expert Medical Opinion Services | Trusted Healthcare Guidance
        </title>
        <meta
          name="description"
          content="Get expert medical opinions for complex diagnoses, cancer treatment plans, surgery recommendations, and healthcare decisions from experienced specialists."
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
                  Our {data.name.toLowerCase()} specialists are experienced in
                  diagnosing and treating a wide range of conditions across all
                  age groups.
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
                  We combine experienced medical specialists with advanced
                  technology to provide reliable, accessible, and personalized
                  expert healthcare guidance.
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
                Gain clarity, confidence, and peace of mind before making
                important healthcare decisions. Schedule an expert medical
                opinion consultation today and receive trusted guidance from
                experienced specialists.
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
