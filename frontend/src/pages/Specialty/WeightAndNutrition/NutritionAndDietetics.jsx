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

import heroImage from "../../../assets/SpecialitiesImage/nutrition-and-dietetics-specialist-consultation-healthy-eating-guidance.webp";
import overviewImage from "../../../assets/SpecialitiesImage/registered-dietitian-personalized-meal-planning-consultation.webp";
import BookingCard from "../../../components/SpecialityBookingCard";
import api from "../../../api";

// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "nutrition-and-dietetics",
  name: "Nutrition & Dietetics",
  categoryId: "weight",
  tagline: "Personalized Nutrition for Better Health and Wellness.",
  heroDescription:
    "Nutrition & Dietetics focuses on helping individuals improve their health through evidence-based nutrition guidance and personalized dietary planning. Whether you're managing a chronic condition, pursuing weight goals, improving athletic performance, supporting a healthy pregnancy, or simply wanting to eat better, nutrition specialists provide expert guidance tailored to your unique needs. Good nutrition plays a critical role in overall wellness, disease prevention, energy levels, and long-term health. Through customized meal planning and lifestyle-focused support, patients can build healthier eating habits that last.",
  heroImage: heroImage,
  heroAlt:
    "Nutrition and dietetics specialist providing personalized nutrition counseling and healthy eating guidance to improve overall wellness.",
  overviewImage: overviewImage,
  overviewAlt:
    "Registered dietitian discussing personalized meal planning, balanced nutrition, and healthy lifestyle recommendations with a patient.",
  overviewDescription:
    "Nutrition & Dietetics is a healthcare specialty dedicated to understanding how food and nutrition affect health, wellness, disease prevention, and recovery. Registered dietitians and nutrition specialists help individuals make informed dietary choices that support specific health goals and medical needs.",
  overviewImportance:
    "This specialty combines nutrition science with personalized care to help patients improve eating habits, manage chronic conditions, optimize performance, and achieve long-term wellness outcomes through sustainable dietary changes.",
  conditionsTreated:
    "Nutrition specialists provide guidance for cholesterol management, diabetes nutrition, food intolerances, pregnancy nutrition, sports nutrition, weight management, and preventive wellness.",
  whenToConsult:
    "Consider a nutrition consultation if you want to improve eating habits, manage a health condition, lose weight, improve athletic performance, support a healthy pregnancy, or receive personalized nutrition guidance.",

  keyServices: [
    {
      Icon: FiActivity,
      title: "Personalized Nutrition Assessments",
      description:
        "Comprehensive evaluations of dietary habits, nutritional needs, and wellness goals.",
    },
    {
      Icon: FiShield,
      title: "Medical Nutrition Therapy",
      description:
        "Evidence-based nutrition support for chronic conditions and disease management.",
    },
    {
      Icon: FiTarget,
      title: "Meal Planning Guidance",
      description:
        "Customized nutrition strategies designed around individual health objectives.",
    },
    {
      Icon: FiTrendingUp,
      title: "Weight Management Support",
      description:
        "Healthy approaches to weight loss, maintenance, and long-term success.",
    },
    {
      Icon: FiSearch,
      title: "Preventive Nutrition Counseling",
      description:
        "Dietary recommendations focused on disease prevention and wellness promotion.",
    },
    {
      Icon: FiHeart,
      title: "Lifestyle Nutrition Coaching",
      description:
        "Ongoing support for building healthier eating habits and sustainable lifestyle changes.",
    },
  ],

  benefits: [
    {
      Icon: FiHeart,
      title: "Improved Overall Health",
      description:
        "Support better wellness through balanced nutrition and healthy eating habits.",
    },
    {
      Icon: FiShield,
      title: "Chronic Disease Management",
      description:
        "Use nutrition as a tool to manage and improve health conditions.",
    },
    {
      Icon: FiZap,
      title: "Better Energy Levels",
      description:
        "Optimize nutrition to improve physical performance, focus, and daily productivity.",
    },
    {
      Icon: FiTrendingUp,
      title: "Long-Term Wellness",
      description:
        "Develop sustainable dietary habits that support lifelong health goals.",
    },
  ],

  conditions: [
    {
      Icon: FiHeart,
      name: "Cholesterol-Lowering Diet",
      path: "/weight-and-nurtrition/nutrition-and-dietetics/cholesterol-lowering-diet",
      description:
        "Nutrition plans designed to support healthy cholesterol levels and cardiovascular wellness.",
    },
    {
      Icon: FiActivity,
      name: "Diabetic Diet",
      path: "/weight-and-nurtrition/nutrition-and-dietetics/diabetic-diet",
      description:
        "Personalized dietary guidance to help manage blood sugar levels and diabetes-related health goals.",
    },
    {
      Icon: FiShield,
      name: "Food Intolerance Planning",
      path: "/weight-and-nurtrition/nutrition-and-dietetics/food-intolerance-planning",
      description:
        "Nutrition strategies for managing food sensitivities, digestive concerns, and dietary restrictions.",
    },
    {
      Icon: FiHeart,
      name: "Pregnancy Nutrition",
      path: "/weight-and-nurtrition/nutrition-and-dietetics/pregnancy-nutrition",
      description:
        "Healthy eating guidance that supports maternal wellness and fetal development during pregnancy.",
    },
    {
      Icon: FiTrendingUp,
      name: "Sports Nutrition",
      path: "/weight-and-nurtrition/nutrition-and-dietetics/sports-nutrition",
      description:
        "Nutrition plans focused on athletic performance, recovery, endurance, and strength goals.",
    },
    {
      Icon: FiTarget,
      name: "Weight Management",
      path: "/weight-and-nurtrition/weight-management",
      description:
        "Evidence-based dietary strategies for healthy weight loss and long-term weight maintenance.",
    },
    {
      Icon: FiHeart,
      name: "Heart-Healthy Nutrition",
      description:
        "Nutrition recommendations designed to support cardiovascular health and wellness.",
    },
    {
      Icon: FiDroplet,
      name: "Digestive Health Nutrition",
      description:
        "Dietary support for bloating, digestive discomfort, and gastrointestinal wellness.",
    },
    {
      Icon: FiSearch,
      name: "Preventive Nutrition Counseling",
      description:
        "Healthy eating strategies focused on reducing future health risks.",
    },
    {
      Icon: FiActivity,
      name: "Healthy Eating Education",
      description:
        "Guidance for making informed food choices and improving daily nutrition habits.",
    },
    {
      Icon: FiZap,
      name: "Energy & Performance Nutrition",
      description:
        "Nutrition planning to support physical activity, recovery, and overall energy levels.",
    },
    {
      Icon: FiCompass,
      name: "Wellness Nutrition Programs",
      description:
        "Comprehensive nutrition support designed to promote long-term health and well-being.",
    },
  ],

  faqs: [
    {
      question: "What is nutrition and dietetics?",
      answer:
        "Nutrition and dietetics is the healthcare specialty focused on food, nutrition, wellness, and disease prevention.",
    },
    {
      question: "Who should see a nutrition specialist?",
      answer:
        "Anyone looking to improve health, manage a medical condition, achieve weight goals, or optimize nutrition can benefit.",
    },
    {
      question: "What is medical nutrition therapy?",
      answer:
        "Medical nutrition therapy uses evidence-based dietary interventions to help manage health conditions.",
    },
    {
      question: "Can nutrition help lower cholesterol?",
      answer:
        "Yes. Dietary changes can play an important role in supporting healthy cholesterol levels.",
    },
    {
      question: "How does a diabetic diet help?",
      answer:
        "A diabetic diet helps support healthy blood sugar control and overall diabetes management.",
    },
    {
      question: "What are food intolerances?",
      answer:
        "Food intolerances occur when certain foods cause digestive symptoms or discomfort without an allergic immune response.",
    },
    {
      question: "Why is nutrition important during pregnancy?",
      answer:
        "Proper nutrition supports maternal health and healthy fetal development throughout pregnancy.",
    },
    {
      question: "What is sports nutrition?",
      answer:
        "Sports nutrition focuses on fueling athletic performance, recovery, strength, and endurance.",
    },
    {
      question: "Can nutrition support weight loss?",
      answer:
        "Yes. Personalized nutrition plans can help support healthy and sustainable weight management.",
    },
    {
      question: "What happens during a nutrition consultation?",
      answer:
        "A specialist reviews your health history, eating habits, goals, and nutritional needs to create a personalized plan.",
    },
    {
      question: "Can telehealth be used for nutrition appointments?",
      answer:
        "Yes. Many nutrition consultations can be conducted through secure virtual healthcare services.",
    },
    {
      question: "How often should I meet with a nutrition specialist?",
      answer:
        "Frequency depends on your goals, health conditions, and recommended follow-up plan.",
    },
    {
      question: "Can nutrition improve energy levels?",
      answer:
        "Balanced nutrition can help support energy production, focus, and physical performance.",
    },
    {
      question: "What is preventive nutrition counseling?",
      answer:
        "Preventive nutrition focuses on reducing disease risk and promoting long-term wellness through healthy eating.",
    },
    {
      question: "Can nutrition help support heart health?",
      answer:
        "Yes. Heart-healthy dietary strategies can support cardiovascular wellness and risk reduction.",
    },
    {
      question:
        "Is nutrition counseling only for people with medical conditions?",
      answer:
        "No. Nutrition counseling can benefit anyone seeking healthier eating habits and wellness improvements.",
    },
    {
      question: "How long does it take to see results from dietary changes?",
      answer:
        "Results vary depending on goals, consistency, health status, and individual circumstances.",
    },
    {
      question: "How can I schedule a nutrition consultation?",
      answer:
        "You can book an appointment online and connect with a nutrition and dietetics specialist through virtual or in-person care options.",
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
    title: "Registered Nutrition Specialists",
    description:
      "Receive guidance from experienced professionals trained in evidence-based nutrition care.",
  },
  {
    Icon: FiZap,
    title: "Fast Appointments",
    description:
      "Schedule consultations quickly and conveniently around your lifestyle.",
  },
  {
    Icon: FiMonitor,
    title: "Telehealth Access",
    description: "Connect securely with nutrition experts from anywhere.",
  },
  {
    Icon: FiShield,
    title: "Insurance Support",
    description:
      "Receive assistance understanding healthcare coverage and nutrition-related services.",
  },
  {
    Icon: FiHeart,
    title: "Personalized Care",
    description:
      "Benefit from customized nutrition plans tailored to your goals and health needs.",
  },
  {
    Icon: FiGlobe,
    title: "Nationwide Provider Network",
    description:
      "Access trusted healthcare professionals and coordinated wellness support services.",
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
export default function NutritionAndDietetics({ data = SPECIALTY_DATA }) {
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
          Lifestyle Medicine Specialists | Healthy Habits, Nutrition & Wellness
          Care
        </title>
        <meta
          name="description"
          content="Connect with lifestyle medicine specialists for diet and exercise planning, healthy habit coaching, sleep improvement, preventive wellness care, and long-term health optimization."
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
              <div className="sp-conditions__head" onClick={() => navigate("/conditions")} style={{ cursor: "pointer" }}>
                <SectionLabel>Conditions &amp; Symptoms</SectionLabel>
                <h2>What We Treat</h2>
                <p>
                  Our {data.name.toLowerCase()} specialists provide personalized
                  nutrition support for a wide range of health and wellness
                  goals.
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
                  We combine experienced nutrition specialists with advanced
                  telemedicine technology to make expert nutrition care more
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
                Ready to Improve Your <span>{data.name}</span> Health?
              </h2>
              <p className="sp-cta__sub">
                Connect with a nutrition and dietetics specialist to receive
                personalized nutrition guidance, healthier eating strategies,
                and support for your wellness goals. Build a healthier future
                through evidence-based nutrition care.
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
