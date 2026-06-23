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

// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "gastroenterology",
  name: "Gastroenterology",
  tagline: "Expert Care for a Healthier Digestive System.",
  heroDescription:
    "Gastroenterology specialists diagnose, treat, and manage conditions affecting the digestive system, including the stomach, intestines, liver, pancreas, gallbladder, and esophagus. From abdominal pain and acid reflux to chronic digestive disorders and liver conditions, gastroenterologists provide personalized care to help patients achieve better digestive health and overall well-being.",
  heroImage:
    "https://images.unsplash.com/photo-1632833239869-a37e3a5806d2?auto=format&fit=crop&w=1600&q=80",
  overviewImage:
    "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=800&q=80",
  overviewDescription:
    "Gastroenterology is a medical specialty focused on the prevention, diagnosis, and treatment of disorders affecting the digestive tract and related organs. Gastroenterologists evaluate symptoms such as abdominal pain, heartburn, bloating, constipation, diarrhea, and digestive discomfort to identify underlying causes and develop effective treatment plans.",
  overviewImportance:
    "Through advanced diagnostic evaluations, lifestyle guidance, medication management, and long-term monitoring, gastroenterology specialists help patients manage digestive conditions, improve symptom control, and maintain better gastrointestinal health.",
  conditionsTreated:
    "Gastroenterology specialists diagnose and manage digestive disorders including acid reflux, GERD, abdominal pain, bloating, constipation, irritable bowel syndrome, fatty liver disease, and other gastrointestinal conditions.",
  whenToConsult:
    "Schedule a visit with a gastroenterology specialist if you experience persistent abdominal pain, heartburn, bloating, constipation, digestive discomfort, changes in bowel habits, unexplained weight loss, or ongoing liver-related concerns.",

  keyServices: [
    {
      Icon: FiActivity,
      title: "Digestive Health Evaluations",
      description:
        "Comprehensive assessments to identify the causes of digestive symptoms and gastrointestinal disorders.",
    },
    {
      Icon: FiThermometer,
      title: "GERD & Acid Reflux Management",
      description:
        "Personalized treatment plans to reduce heartburn, acid reflux symptoms, and esophageal irritation.",
    },
    {
      Icon: MdOutlineVaccines,
      title: "IBS & Functional Digestive Care",
      description:
        "Diagnosis and management of irritable bowel syndrome and chronic digestive symptoms.",
    },
    {
      Icon: FiDroplet,
      title: "Liver Disease Monitoring",
      description:
        "Evaluation and treatment of fatty liver disease and other liver-related health concerns.",
    },
    {
      Icon: MdOutlineSpa,
      title: "Bowel Health Management",
      description:
        "Care for constipation, diarrhea, and changes in bowel habits affecting digestive wellness.",
    },
    {
      Icon: FiUsers,
      title: "Preventive Digestive Care",
      description:
        "Lifestyle guidance, nutritional counseling, and ongoing monitoring to support long-term gastrointestinal health.",
    },
  ],

  benefits: [
    {
      Icon: FiSearch,
      title: "Early Detection of Digestive Disorder",
      description:
        "Identifies gastrointestinal conditions before they progress into more serious health complications.",
    },
    {
      Icon: FiTrendingUp,
      title: "Improved Digestive Comfort",
      description:
        "Helps reduce symptoms such as abdominal pain, bloating, heartburn, and bowel irregularities.",
    },
    {
      Icon: FiShield,
      title: "Better Nutritional Health",
      description:
        "Supports healthy digestion and nutrient absorption through personalized treatment strategies.",
    },
    {
      Icon: FiHeart,
      title: "Long-Term Gastrointestinal Wellness",
      description:
        "Provides ongoing management to improve digestive function and overall quality of life.",
    },
  ],

  conditions: [
    {
      Icon: GiHeartOrgan,
      name: "Abdominal Pain",
      description:
        "Evaluation and treatment of stomach pain, cramping, digestive discomfort, and gastrointestinal symptoms.",
    },
    {
      Icon: FiHeart,
      name: "Acid Reflux / GERD",
      description:
        "Management of chronic heartburn, acid reflux, regurgitation, and esophageal irritation.",
    },
    {
      Icon: FiZap,
      name: "Bloating",
      description:
        "Care for abdominal fullness, gas, bloating, digestive discomfort, and related gastrointestinal concerns.",
    },
    {
      Icon: MdOutlineBloodtype,
      name: "Constipation",
      description:
        "Diagnosis and treatment of infrequent bowel movements, difficulty passing stool, and digestive irregularities.",
    },
    {
      Icon: FiTrendingUp,
      name: "Fatty Liver Follow-Up",
      description:
        "Ongoing monitoring and management of fatty liver disease to support long-term liver health.",
    },
    {
      Icon: FiTarget,
      name: "Irritable Bowel Syndrome (IBS)",
      description:
        "Treatment for IBS symptoms including abdominal pain, bloating, diarrhea, constipation, and bowel irregularities.",
    },
    {
      Icon: GiLungs,
      name: "Chronic Heartburn",
      description:
        "Evaluation of persistent heartburn and digestive symptoms affecting daily comfort and health.",
    },
    {
      Icon: FiShield,
      name: "Diarrhea & Digestive Upset",
      description:
        "Diagnosis and treatment of acute and chronic diarrhea, digestive infections, and gastrointestinal disturbances.",
    },
    {
      Icon: GiHeartOrgan,
      name: "Nausea & Indigestion",
      description:
        "Care for digestive discomfort, nausea, upset stomach, and difficulty digesting food.",
    },
    {
      Icon: FiHeart,
      name: "Liver Function Concerns",
      description:
        "Evaluation of abnormal liver tests, liver inflammation, and metabolic liver conditions.",
    },
    {
      Icon: FiZap,
      name: "Digestive Tract Inflammation",
      description:
        "Management of inflammation affecting the stomach, intestines, and gastrointestinal tract.",
    },
    {
      Icon: MdOutlineBloodtype,
      name: "Preventive Digestive Health",
      description:
        "Routine digestive evaluations, lifestyle counseling, and gastrointestinal wellness support.",
    },
  ],

  faqs: [
    {
      question: "What is gastroenterology?",
      answer:
        "Gastroenterology is the medical specialty focused on diagnosing and treating disorders of the digestive system, including the stomach, intestines, liver, pancreas, gallbladder, and esophagus.",
    },
    {
      question: "What conditions do gastroenterologists treat?",
      answer:
        "Gastroenterologists treat acid reflux, GERD, abdominal pain, constipation, bloating, IBS, liver disease, digestive disorders, and gastrointestinal symptoms.",
    },
    {
      question: "When should I see a gastroenterologist?",
      answer:
        "You should seek gastroenterology care for persistent digestive symptoms, abdominal pain, chronic heartburn, constipation, diarrhea, or unexplained digestive issues.",
    },
    {
      question: "What is GERD?",
      answer:
        "GERD, or gastroesophageal reflux disease, is a condition where stomach acid repeatedly flows back into the esophagus, causing heartburn and irritation.",
    },
    {
      question: "What causes bloating?",
      answer:
        "Bloating can result from gas buildup, digestive disorders, food intolerances, constipation, or gastrointestinal conditions.",
    },
    {
      question: "Can a gastroenterologist help with constipation?",
      answer:
        "Yes. Gastroenterologists diagnose underlying causes of constipation and recommend treatments to improve bowel function.",
    },
    {
      question: "What is IBS?",
      answer:
        "Irritable Bowel Syndrome (IBS) is a common digestive disorder that causes abdominal pain, bloating, diarrhea, constipation, or a combination of symptoms.",
    },
    {
      question: "What causes abdominal pain?",
      answer:
        "Abdominal pain can result from digestive disorders, infections, food sensitivities, inflammation, or gastrointestinal diseases.",
    },
    {
      question: "What is fatty liver disease?",
      answer:
        "Fatty liver disease occurs when excess fat accumulates in the liver and may lead to inflammation or liver damage if left untreated.",
    },
    {
      question: "Can digestive problems affect overall health?",
      answer:
        "Yes. Digestive disorders can impact nutrition, energy levels, weight management, and overall well-being.",
    },
    {
      question: "What tests do gastroenterologists use?",
      answer:
        "Diagnostic testing may include laboratory studies, imaging, stool testing, endoscopy, colonoscopy, and digestive health evaluations.",
    },
    {
      question: "Can stress affect digestive health?",
      answer:
        "Yes. Stress can contribute to digestive symptoms such as bloating, abdominal discomfort, IBS symptoms, and acid reflux.",
    },
    {
      question: "Are telehealth gastroenterology appointments available?",
      answer:
        "Yes. Many digestive health consultations, follow-up visits, and treatment discussions can be conducted through secure telehealth services.",
    },
    {
      question: "Can acid reflux be treated without surgery?",
      answer:
        "Many cases of acid reflux and GERD can be managed through lifestyle modifications, medications, and dietary adjustments.",
    },
    {
      question: "What foods commonly trigger digestive symptoms?",
      answer:
        "Common triggers include spicy foods, fatty foods, caffeine, alcohol, carbonated beverages, and foods that are difficult to digest.",
    },
    {
      question: "How can I improve my digestive health?",
      answer:
        "Eating a balanced diet, staying hydrated, exercising regularly, managing stress, and following medical recommendations can support digestive wellness.",
    },
    {
      question: "When should bloating become a concern?",
      answer:
        "Persistent, severe, or unexplained bloating should be evaluated by a healthcare provider to identify potential underlying conditions.",
    },
    {
      question:
        "How can I schedule an appointment with a gastroenterology specialist?",
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
      "Receive care from experienced digestive health specialists committed to evidence-based treatment.",
  },
  {
    Icon: FiZap,
    title: "Fast Appointments",
    description:
      "Schedule consultations quickly for digestive symptoms, follow-up visits, and gastrointestinal concerns.",
  },
  {
    Icon: FiMonitor,
    title: "Telehealth Access",
    description:
      "Connect securely with gastroenterology specialists through convenient virtual consultations.",
  },
  {
    Icon: FiShield,
    title: "Insurance Support",
    description:
      "Receive guidance regarding healthcare coverage, authorizations, and billing-related questions.",
  },
  {
    Icon: FiHeart,
    title: "Personalized Care",
    description:
      "Benefit from individualized treatment plans designed around your symptoms, diagnosis, and health goals.",
  },
  {
    Icon: FiGlobe,
    title: "Global Provider Network",
    description:
      "Access a broad network of digestive health specialists and coordinated healthcare services.",
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
export default function Gastroenterology({ data = SPECIALTY_DATA }) {
  const [heroLoaded, setHeroLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <HelmetProvider>
        <title>Gastroenterology Specialists | Digestive Health & GI Care</title>
        <meta
          name="description"
          content="Get expert gastroenterology care for abdominal pain, acid reflux, bloating, constipation, IBS, fatty liver disease, and digestive health concerns."
        />
      </HelmetProvider>
      <main className="sp-page">
        {/* ── 1. HERO ────────────────────────────────────────────────────────── */}
        <section className="sp-hero">
          <div className="sp-hero__bg">
            <img
              src={data.heroImage}
              alt={`${data.name} — HumanCare Connect`}
              className="sp-hero__img"
              loading="eager"
            />
            <div className="sp-hero__overlay" />
          </div>

          <div className="sp-hero__content">
            <div
              className={`sp-hero__content-inner${heroLoaded ? " sp-hero__content-inner--loaded" : ""}`}
            >
              <span className="sp-hero__badge">HumanCare Connect</span>
              <h1 className="sp-hero__title">{data.name}</h1>
              <p className="sp-hero__tagline">{data.tagline}</p>
              <p className="sp-hero__description">{data.heroDescription}</p>

              <div className="sp-hero__actions">
                <a
                  href={`/specialties/${data.slug}/doctors`}
                  className="sp-btn sp-btn--primary"
                >
                  <FiSearch size={17} />
                  Find Specialists
                </a>
                <a
                  href={`/specialties/${data.slug}/book`}
                  className="sp-btn sp-btn--ghost"
                >
                  <FiCalendar size={17} />
                  Book Appointment
                </a>
              </div>
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
                    alt={`${data.name} specialists`}
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
                  We combine experienced gastroenterology specialists with
                  advanced technology to make digestive healthcare more
                  accessible, convenient, and personalized.
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
                Get expert digestive healthcare with convenient appointments,
                personalized treatment plans, and ongoing support. Schedule an
                in-person or virtual visit with a gastroenterology specialist
                today.
              </p>
            </Reveal>

            <Reveal delay={80}>
              <div className="sp-cta__actions">
                <a
                  href={`/specialties/${data.slug}/doctors`}
                  className="sp-btn sp-btn--primary-lg"
                >
                  <FiSearch size={18} />
                  Find a Doctor
                </a>
                <a
                  href={`/specialties/${data.slug}/book`}
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

// ─────────────────────────────────────────────────────────────────────────────
// ADDITIONAL SPECIALTY DATA EXAMPLES
// ─────────────────────────────────────────────────────────────────────────────

// export const CARDIOLOGY_DATA = {
//   slug: "cardiology",
//   name: "Cardiology",
//   tagline: "Expert heart care, from prevention to advanced intervention.",
//   heroDescription:
//     "Our board-certified cardiologists provide comprehensive cardiac care — from lipid management and ECG interpretation to interventional procedures and heart failure management. Your heart health is our priority.",
//   heroImage:
//     "https://images.unsplash.com/photo-1628348068343-c6a848d2b6dd?auto=format&fit=crop&w=1600&q=80",
//   overviewImage:
//     "https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80",
//   overviewDescription:
//     "Cardiology is the branch of medicine concerned with the diagnosis and treatment of diseases of the heart and blood vessels. Cardiologists specialise in managing conditions ranging from coronary artery disease and heart failure to arrhythmias and congenital heart defects.",
//   overviewImportance:
//     "Cardiovascular disease remains the leading cause of mortality globally. Early detection, lifestyle modification, and timely intervention can significantly reduce the risk of heart attacks, strokes, and other cardiac events.",
//   conditionsTreated:
//     "Cardiologists treat coronary artery disease, heart failure, arrhythmias, valvular heart disease, hypertension, high cholesterol, pericarditis, and congenital heart defects.",
//   whenToConsult:
//     "Seek a cardiologist if you experience chest pain, shortness of breath, palpitations, fainting, leg swelling, or if you have risk factors like diabetes, hypertension, or a family history of heart disease.",
//   keyServices: [
//     {
//       Icon: FiActivity,
//       title: "ECG & Holter Monitoring",
//       description:
//         "Detect arrhythmias and electrical abnormalities with advanced cardiac monitoring.",
//     },
//     {
//       Icon: MdOutlineMonitorHeart,
//       title: "Echocardiography",
//       description: "Ultrasound imaging of heart structure and function.",
//     },
//     {
//       Icon: FiTrendingUp,
//       title: "Stress Testing",
//       description:
//         "Exercise treadmill and pharmacological stress tests to assess cardiac fitness.",
//     },
//     {
//       Icon: GiMedicines,
//       title: "Lipid Management",
//       description:
//         "Cholesterol control through diet, lifestyle, and medication.",
//     },
//     {
//       Icon: FiRefreshCw,
//       title: "Cardiac Rehabilitation",
//       description:
//         "Structured programmes to strengthen the heart after a cardiac event.",
//     },
//     {
//       Icon: FiZap,
//       title: "Pacemaker Management",
//       description:
//         "Implantation, programming, and monitoring of pacemakers and ICDs.",
//     },
//   ],
//   benefits: [
//     {
//       Icon: FiSearch,
//       title: "Early Risk Detection",
//       description: "Identify silent cardiac risks before a major event.",
//     },
//     {
//       Icon: GiMedicines,
//       title: "Medication Management",
//       description:
//         "Precision prescribing to optimise your cardiac medications.",
//     },
//     {
//       Icon: FiBriefcase,
//       title: "Procedural Expertise",
//       description:
//         "Advanced interventions by experienced interventional cardiologists.",
//     },
//     {
//       Icon: FiBarChart2,
//       title: "Ongoing Monitoring",
//       description:
//         "Long-term cardiac surveillance with remote monitoring options.",
//     },
//   ],
//   conditions: [
//     {
//       Icon: GiHeartOrgan,
//       name: "Abdominal Pain",
//       description:
//         "Evaluation and treatment of stomach pain, cramping, digestive discomfort, and gastrointestinal symptoms.",
//     },
//     {
//       Icon: FiHeart,
//       name: "Acid Reflux / GERD",
//       description:
//         "Management of chronic heartburn, acid reflux, regurgitation, and esophageal irritation.",
//     },
//     {
//       Icon: FiZap,
//       name: "Bloating",
//       description:
//         "Care for abdominal fullness, gas, bloating, digestive discomfort, and related gastrointestinal concerns.",
//     },
//     {
//       Icon: MdOutlineBloodtype,
//       name: "Constipation",
//       description:
//         "Diagnosis and treatment of infrequent bowel movements, difficulty passing stool, and digestive irregularities.",
//     },
//     {
//       Icon: FiTrendingUp,
//       name: "Fatty Liver Follow-Up",
//       description:
//         "Ongoing monitoring and management of fatty liver disease to support long-term liver health.",
//     },
//     {
//       Icon: FiTarget,
//       name: "Irritable Bowel Syndrome (IBS)",
//       description:
//         "Treatment for IBS symptoms including abdominal pain, bloating, diarrhea, constipation, and bowel irregularities.",
//     },
//     {
//       Icon: GiLungs,
//       name: "Chronic Heartburn",
//       description:
//         "Evaluation of persistent heartburn and digestive symptoms affecting daily comfort and health.",
//     },
//     {
//       Icon: FiShield,
//       name: "Diarrhea & Digestive Upset",
//       description:
//         "Diagnosis and treatment of acute and chronic diarrhea, digestive infections, and gastrointestinal disturbances.",
//     },
//     {
//       Icon: GiHeartOrgan,
//       name: "Nausea & Indigestion",
//       description:
//         "Care for digestive discomfort, nausea, upset stomach, and difficulty digesting food.",
//     },
//     {
//       Icon: FiHeart,
//       name: "Liver Function Concerns",
//       description:
//         "Evaluation of abnormal liver tests, liver inflammation, and metabolic liver conditions.",
//     },
//     {
//       Icon: FiZap,
//       name: "Digestive Tract Inflammation",
//       description:
//         "Management of inflammation affecting the stomach, intestines, and gastrointestinal tract.",
//     },
//     {
//       Icon: MdOutlineBloodtype,
//       name: "Preventive Digestive Health",
//       description:
//         "Routine digestive evaluations, lifestyle counseling, and gastrointestinal wellness support.",
//     },
//   ],
// };

// export const DERMATOLOGY_DATA = {
//   slug: "dermatology",
//   name: "Dermatology",
//   tagline: "Healthy, radiant skin backed by expert medical care.",
//   heroDescription:
//     "Our board-certified dermatologists address everything from acne and eczema to skin cancer detection and cosmetic concerns. Evidence-based treatments tailored to your skin type, tone, and health goals.",
//   heroImage:
//     "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=1600&q=80",
//   overviewImage:
//     "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=800&q=80",
//   overviewDescription:
//     "Dermatology is the medical specialty focused on the diagnosis and treatment of conditions affecting the skin, hair, and nails. The skin is the body's largest organ and a window into overall health — changes can signal systemic diseases, infections, or malignancies.",
//   overviewImportance:
//     "Skin conditions affect over 1.9 billion people globally. Early detection of skin cancer dramatically improves survival rates. Effective management of chronic conditions like psoriasis and eczema significantly improves quality of life.",
//   conditionsTreated:
//     "Dermatologists treat acne, eczema, psoriasis, rosacea, fungal infections, warts, hair loss, skin cancer, vitiligo, and cosmetic skin concerns.",
//   whenToConsult:
//     "Visit a dermatologist for persistent skin rashes, unusual moles, hair loss, nail changes, chronic itching, suspected skin infections, or when over-the-counter treatments are not working.",
//   keyServices: [
//     {
//       Icon: FiEye,
//       title: "Skin Cancer Screening",
//       description:
//         "Full-body mole mapping and dermoscopy to detect melanoma and other skin cancers early.",
//     },
//     {
//       Icon: MdOutlineSpa,
//       title: "Acne Treatment",
//       description:
//         "Medical-grade treatments including topical retinoids, antibiotics, and isotretinoin.",
//     },
//     {
//       Icon: FiFeather,
//       title: "Eczema & Psoriasis",
//       description:
//         "Personalised care plans including biologics, phototherapy, and topical therapies.",
//     },
//     {
//       Icon: FiTool,
//       title: "Minor Surgical Procedures",
//       description:
//         "Cyst removal, biopsy, and lesion excision performed in-office.",
//     },
//     {
//       Icon: GiBodySwapping,
//       title: "Hair & Scalp Treatment",
//       description:
//         "Diagnosis and management of alopecia, dandruff, and scalp conditions.",
//     },
//     {
//       Icon: FiStar,
//       title: "Cosmetic Dermatology",
//       description:
//         "Chemical peels, PRP, and evidence-based cosmetic treatments.",
//     },
//   ],
//   benefits: [
//     {
//       Icon: FiShield,
//       title: "Cancer Prevention",
//       description:
//         "Early detection saves lives. Annual screenings recommended for high-risk individuals.",
//     },
//     {
//       Icon: FiHeart,
//       title: "Improved Confidence",
//       description:
//         "Effective treatment of visible skin conditions improves mental wellbeing.",
//     },
//     {
//       Icon: FiSearch,
//       title: "Accurate Diagnosis",
//       description:
//         "Dermoscopy and biopsy ensure correct diagnosis and targeted treatment.",
//     },
//     {
//       Icon: FiClipboard,
//       title: "Long-Term Management",
//       description:
//         "Chronic condition care plans that evolve with your skin over time.",
//     },
//   ],
//   faqs: [
//     {
//       question: "How often should I have a full skin check?",
//       answer:
//         "Adults should have an annual full-body skin exam, especially if you have fair skin, a history of sunburns, a family history of skin cancer, or many moles. Those with prior skin cancer need more frequent checks.",
//     },
//     {
//       question: "Can dermatology visits be done via telehealth?",
//       answer:
//         "Many dermatology concerns can be assessed via video or photo submission, including acne, rashes, and follow-up care. Biopsies and surgical procedures require an in-person visit.",
//     },
//     {
//       question:
//         "What is the difference between a dermatologist and an aesthetician?",
//       answer:
//         "A dermatologist is a medical doctor with 6+ years of specialised training who can diagnose and treat skin diseases, prescribe medications, and perform surgery. An aesthetician provides non-medical cosmetic treatments.",
//     },
//     {
//       question: "How do I know if a mole is dangerous?",
//       answer:
//         "Use the ABCDE rule: Asymmetry, Border irregularity, Colour variation, Diameter >6mm, and Evolving. If a mole shows any of these signs, see a dermatologist promptly.",
//     },
//     {
//       question: "What treatments are available for acne scarring?",
//       answer:
//         "Options include chemical peels, microneedling, fractional laser resurfacing, dermal fillers for ice-pick scars, and PRP therapy. Your dermatologist will recommend the best combination based on your scar type and skin tone.",
//     },
//   ],
// };
