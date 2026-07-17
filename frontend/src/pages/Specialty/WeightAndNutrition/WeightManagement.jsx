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
  FiFileText,
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

import heroImage from "../../../assets/SpecialitiesImage/weight-management-specialist-consultation-healthy-weight-loss.webp";
import overviewImage from "../../../assets/SpecialitiesImage/weight-management-nutrition-counseling-lifestyle-support.webp";

// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "weight-management",
  name: "Weight Management",
  tagline: "Sustainable Weight Loss and Healthier Living Starts Here.",
  heroDescription:
    "Weight Management focuses on helping individuals achieve and maintain a healthy weight through personalized care, evidence-based treatment plans, nutrition guidance, lifestyle modifications, and ongoing support. Whether you're struggling with obesity, emotional eating, weight-related health concerns, or simply want a structured weight loss plan, our specialists can help you build a healthier future. Successful weight management goes beyond dieting. It involves understanding your health, habits, lifestyle, and personal goals to create a realistic and sustainable path toward long-term wellness. ",
  heroImage: heroImage,
  heroAlt:
    "Weight management specialist providing personalized weight loss and obesity care consultation",
  overviewImage: overviewImage,
  overviewAlt:
    "Weight management specialist discussing nutrition, healthy eating, and sustainable lifestyle changes with a patient",
  overviewDescription:
    "Weight Management is a healthcare specialty focused on helping patients reach and maintain a healthy body weight while improving overall health and reducing obesity-related risks. Specialists evaluate factors such as nutrition, physical activity, medical conditions, medications, metabolism, and behavioral patterns to create personalized treatment plans.",
  overviewImportance:
    "Through comprehensive care, patients receive support for healthy weight loss, obesity treatment, appetite control, emotional eating, and long-term lifestyle changes that promote lasting success.",
  conditionsTreated:
    "Weight management specialists help patients address obesity, excess weight gain, binge eating behaviors, weight-related health concerns, appetite management, and long-term weight maintenance.",
  whenToConsult:
    "Consider a weight management consultation if you're struggling to lose weight, experiencing weight-related health issues, interested in GLP-1 treatment options, or need professional support to achieve sustainable weight loss.",

  keyServices: [
    {
      Icon: FiActivity,
      title: "Weight Loss Planning",
      description:
        "Personalized weight loss programs designed around your health goals and lifestyle.",
    },
    {
      Icon: FiTrendingUp,
      title: "Obesity Management",
      description:
        "Comprehensive treatment strategies for obesity and weight-related health concerns.",
    },
    {
      Icon: FiShield,
      title: "GLP-1 Eligibility Assessments",
      description:
        "Professional evaluation to determine whether GLP-1 medications may be appropriate for your goals.",
    },
    {
      Icon: FiHeart,
      title: "Nutrition & Meal Planning",
      description:
        "Evidence-based dietary guidance designed to support healthy and sustainable weight loss.",
    },
    {
      Icon: MdOutlineSpa,
      title: "Behavioral Health Support",
      description:
        "Strategies to address emotional eating patterns and long-term habit formation.",
    },
    {
      Icon: FiUsers,
      title: "Long-Term Weight Maintenance",
      description:
        "Ongoing support focused on maintaining progress and preventing weight regain.",
    },
  ],

  benefits: [
    {
      Icon: FiHeart,
      title: "Improved Overall Health",
      description:
        "Healthy weight management can support cardiovascular, metabolic, and overall wellness.",
    },
    {
      Icon: FiShield,
      title: "Reduced Chronic Disease Risk",
      description:
        "Lower risk factors associated with obesity-related health conditions.",
    },
    {
      Icon: FiTrendingUp,
      title: "Increased Energy Levels",
      description:
        "Better physical performance, mobility, and day-to-day functioning.",
    },
    {
      Icon: FiSearch,
      title: "Sustainable Lifestyle Changes",
      description:
        "Build healthy habits that support long-term success rather than short-term results.",
    },
  ],

  conditions: [
    {
      Icon: FiActivity,
      name: "Binge Eating",
      description:
        "Support for managing episodes of overeating, emotional eating, and unhealthy eating behaviors.",
    },
    {
      Icon: FiShield,
      name: "GLP-1 Program Eligibility",
      description:
        "Professional assessments for patients exploring medically supervised weight management options.",
    },
    {
      Icon: FiTrendingUp,
      name: "Obesity",
      description:
        "Comprehensive care for individuals living with obesity and obesity-related health risks.",
    },
    {
      Icon: FiHeart,
      name: "Weight-Loss Planning",
      description:
        "Personalized weight reduction strategies based on health history and individual goals.",
    },
    {
      Icon: FiSearch,
      name: "Weight Gain Concerns",
      description:
        "Evaluation of factors contributing to unexpected or difficult-to-manage weight gain.",
    },
    {
      Icon: MdOutlineSpa,
      name: "Emotional Eating",
      description:
        "Support for stress-related eating patterns and behavioral challenges.",
    },
    {
      Icon: FiCompass,
      name: "Appetite Management",
      description:
        "Strategies designed to improve hunger awareness and eating habits.",
    },
    {
      Icon: FiActivity,
      name: "Metabolic Health",
      description:
        "Assessment of factors affecting metabolism and overall weight regulation.",
    },
    {
      Icon: FiUsers,
      name: "Weight Maintenance",
      description:
        "Long-term support for maintaining weight loss achievements and healthy routines.",
    },
    {
      Icon: FiMap,
      name: "Lifestyle Modification",
      description:
        "Guidance for nutrition, activity, sleep, and wellness habits that support healthy weight management.",
    },
    {
      Icon: FiDroplet,
      name: "Nutrition Counseling",
      description:
        "Personalized dietary recommendations to support healthy weight goals.",
    },
    {
      Icon: FiGlobe,
      name: "Preventive Wellness Support",
      description:
        "Comprehensive approaches to improving health through sustainable lifestyle changes.",
    },
  ],

  faqs: [
    {
      question: "What is weight management?",
      answer:
        "Weight management is a healthcare approach focused on achieving and maintaining a healthy body weight through personalized care and lifestyle changes.",
    },
    {
      question: "Who can benefit from weight management services?",
      answer:
        "Anyone looking to lose weight, maintain weight loss, improve health, or address obesity-related concerns can benefit.",
    },
    {
      question: "What causes weight gain?",
      answer:
        "Weight gain can result from diet, lifestyle habits, genetics, medical conditions, medications, stress, and hormonal factors.",
    },
    {
      question: "What is obesity?",
      answer:
        "Obesity is a complex health condition involving excess body weight that may increase the risk of certain health concerns.",
    },
    {
      question: "How does a weight management specialist help?",
      answer:
        "Specialists create personalized plans that may include nutrition guidance, activity recommendations, behavioral support, and medical evaluations.",
    },
    {
      question: "What is binge eating?",
      answer:
        "Binge eating involves consuming unusually large amounts of food while feeling a loss of control during eating episodes.",
    },
    {
      question: "What are GLP-1 medications?",
      answer:
        "GLP-1 medications are prescription treatments that may support weight management for eligible individuals.",
    },
    {
      question: "Am I eligible for a GLP-1 program?",
      answer:
        "Eligibility depends on factors such as weight, health history, medical conditions, and individual treatment goals.",
    },
    {
      question: "Can telehealth be used for weight management?",
      answer:
        "Yes. Many consultations, follow-ups, and treatment discussions can be conducted through secure virtual healthcare services.",
    },
    {
      question: "How long does healthy weight loss take?",
      answer:
        "Results vary depending on individual goals, health status, consistency, and treatment approach.",
    },
    {
      question: "Can weight management improve overall health?",
      answer:
        "Yes. Healthy weight management often supports cardiovascular health, mobility, energy levels, and overall wellness.",
    },
    {
      question: "What role does nutrition play in weight loss?",
      answer:
        "Nutrition is one of the most important factors in achieving and maintaining healthy weight goals.",
    },
    {
      question: "Can emotional eating affect weight?",
      answer:
        "Yes. Emotional eating patterns can contribute to weight gain and make weight management more challenging.",
    },
    {
      question: "Is exercise required for weight loss?",
      answer:
        "Physical activity is often an important component of a comprehensive weight management plan.",
    },
    {
      question: "What is weight maintenance?",
      answer:
        "Weight maintenance focuses on sustaining healthy habits and preventing weight regain after achieving weight loss goals.",
    },
    {
      question: "Can weight management help reduce health risks?",
      answer:
        "Yes. Healthy weight reduction may help lower risk factors associated with obesity-related health concerns.",
    },
    {
      question: "Are weight loss plans personalized?",
      answer:
        "Yes. Effective weight management programs should be tailored to each individual's needs and health goals.",
    },
    {
      question: "How can I schedule a weight management consultation?",
      answer:
        "You can book an appointment online and connect with a weight management specialist through secure telemedicine services.",
    },
    {
      question: "What makes sustainable weight loss different from dieting?",
      answer:
        "Sustainable weight loss focuses on long-term lifestyle changes rather than temporary restrictions.",
    },
    {
      question: "Can weight management support long-term wellness?",
      answer:
        "Yes. Weight management is often an important part of improving overall health, confidence, and quality of life.",
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
    title: "Board-Certified Providers",
    description:
      "Receive care from experienced professionals focused on evidence-based weight management.",
  },
  {
    Icon: FiZap,
    title: "Fast Appointments",
    description:
      "Schedule consultations quickly and conveniently around your schedule.",
  },
  {
    Icon: FiMonitor,
    title: "Telehealth Access",
    description:
      "Access personalized care securely from home through virtual healthcare services.",
  },
  {
    Icon: FiShield,
    title: "Insurance Support",
    description:
      "Receive assistance understanding healthcare coverage and treatment options.",
  },
  {
    Icon: FiHeart,
    title: "Personalized Care Plans",
    description:
      "Every treatment plan is tailored to your unique health history, goals, and lifestyle.",
  },
  {
    Icon: FiUsers,
    title: "Ongoing Support",
    description:
      "Receive continued guidance and accountability throughout your weight management journey.",
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
export default function WeightManagement({ data = SPECIALTY_DATA }) {
  const [heroLoaded, setHeroLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <HelmetProvider>
        <title>
          Weight Management Specialists | Personalized Weight Loss & Obesity
          Care
        </title>
        <meta
          name="description"
          content="Connect with weight management specialists for obesity care, weight loss planning, binge eating support, GLP-1 eligibility assessments, nutrition guidance, and long-term weight management solutions."
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
              <span className="sp-hero__badge">Weight & Nutrition</span>
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
              <div className="sp-conditions__head">
                <SectionLabel>Conditions &amp; Symptoms</SectionLabel>
                <h2>What We Treat</h2>
                <p>
                  Our {data.name.toLowerCase()} specialists provide support for
                  a variety of weight-related concerns and health goals.
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
                  We combine experienced healthcare professionals with advanced
                  telemedicine technology to make weight management support more
                  accessible, personalized, and effective.
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
                Connect with a weight management specialist to receive
                personalized guidance, sustainable weight loss support, obesity
                care, nutrition counseling, and long-term wellness strategies
                designed for lasting success.
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
