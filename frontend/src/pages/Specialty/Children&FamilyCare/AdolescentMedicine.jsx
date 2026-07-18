import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Helmet, HelmetProvider } from "react-helmet-async";
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
import BookingCard from "../../../components/SpecialityBookingCard";
import api from "../../../api";

import heroImage from "../../../assets/SpecialitiesImage/adolescent-medicine-specialist-teen-healthcare-banner.webp";
import overviewImage from "../../../assets/SpecialitiesImage/adolescent-medicine-specialist-consultation.webp";
import SEO from "../../../components/Seo";
// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "adolescent-medicine",
  categoryId: "family",
  name: "Adolescent Medicine",
  tagline: "Supporting Teens Through Every Stage of Growth and Development.",
  heroDescription:
    "Adolescent medicine specialists provide personalized healthcare for teenagers and young adults, addressing their unique physical, emotional, and developmental needs. From puberty and mental health concerns to sports injuries and preventive wellness visits, they help adolescents build a healthy foundation for adulthood.",
  heroImage: heroImage,
  heroAlt:
    "Adolescent medicine specialist providing comprehensive healthcare and wellness support for teenagers and young adults",
  overviewImage: overviewImage,
  overviewAlt:
    "Adolescent medicine specialist consulting with a teenager and parent about growth, development, and preventive healthcare",
  overviewDescription:
    "Adolescent medicine is a specialized field of healthcare focused on the physical, emotional, and social well-being of teenagers and young adults. Adolescent medicine specialists understand the unique challenges that occur during these important developmental years, including hormonal changes, growth concerns, mental health challenges, lifestyle habits, and preventive healthcare needs.",
  overviewImportance:
    "These specialists provide comprehensive evaluations, early intervention, and personalized treatment plans for a wide range of adolescent health conditions. By offering compassionate, age-appropriate care, adolescent medicine physicians help teens navigate puberty, manage emotional and behavioral concerns, recover from injuries, and develop lifelong healthy habits.",
  conditionsTreated:
    "Adolescent medicine specialists diagnose and treat a variety of teen health concerns, including mood and anxiety disorders, puberty concerns, sports injuries, behavioral challenges, nutritional issues, and other physical or emotional conditions affecting adolescent development.",
  whenToConsult:
    "Schedule a visit if your teen is experiencing changes in mood or behavior, anxiety, depression symptoms, puberty-related concerns, growth or development issues, sports-related injuries, eating or nutritional challenges, or requires preventive healthcare and wellness guidance.",

  keyServices: [
    {
      Icon: FiActivity,
      title: "Teen Wellness Exams",
      description:
        "Comprehensive adolescent health check-ups that monitor physical growth, emotional well-being, development milestones, and overall health.",
    },
    {
      Icon: GiBrain,
      title: "Puberty & Development Support",
      description:
        "Evaluation and guidance for puberty concerns, hormonal changes, growth patterns, and healthy adolescent development.",
    },
    {
      Icon: MdOutlinePsychology,
      title: "Mental & Behavioral Health Care",
      description:
        "Support for mood changes, anxiety, stress, depression symptoms, and other emotional or behavioral health concerns affecting teenagers.",
    },
    {
      Icon: GiBoneKnife,
      title: "Sports Injury Evaluation & Care",
      description:
        "Diagnosis, treatment, and recovery guidance for sports injuries, overuse conditions, and activity-related health concerns.",
    },
    {
      Icon: MdOutlineHealthAndSafety,
      title: "Preventive Health & Lifestyle Counseling",
      description:
        "Education on nutrition, sleep, physical activity, healthy habits, risk prevention, and long-term wellness.",
    },
    {
      Icon: FiShield,
      title: "Confidential Adolescent Care",
      description:
        "A safe and supportive environment where teens can discuss sensitive health concerns and receive age-appropriate medical guidance.",
    },
  ],

  benefits: [
    {
      Icon: FiSearch,
      title: "Early Support & Prevention",
      description:
        "Identifies physical, emotional, and developmental concerns early, allowing timely treatment and healthier outcomes.",
    },
    {
      Icon: FiUsers,
      title: "Personalized Teen-Centered Care",
      description:
        "Provides healthcare tailored to the unique needs, challenges, and life stages of adolescents and young adults.",
    },
    {
      Icon: FiHeart,
      title: "Improved Mental & Physical Wellness",
      description:
        "Addresses emotional health, lifestyle habits, injuries, and medical conditions to support complete well-being.",
    },
    {
      Icon: FiTrendingUp,
      title: "Healthy Transition to Adulthood",
      description:
        "Helps teenagers build lifelong healthy habits, understand their healthcare needs, and confidently transition into adult care.",
    },
  ],

  conditions: [
    {
      Icon: GiBrain,
      name: "Mood & Anxiety in Teens",
      description:
        "Support for teen anxiety, mood changes, stress, and emotional challenges with personalized treatment plans and mental health guidance.",
    },
    {
      Icon: FiActivity,
      name: "Puberty Concerns",
      description:
        "Evaluation and care for early or delayed puberty, hormonal changes, growth concerns, and healthy adolescent development.",
    },
    {
      Icon: GiBoneKnife,
      name: "Sports Injuries",
      description:
        "Diagnosis and treatment for sprains, strains, overuse injuries, and activity-related conditions to support safe recovery and return to sports.",
    },
    {
      Icon: FiAlertCircle,
      name: "Depression in Adolescents",
      description:
        "Compassionate care for persistent sadness, low motivation, emotional struggles, and symptoms that impact daily life.",
    },
    {
      Icon: FiTool,
      name: "Behavioral & Emotional Challenges",
      description:
        "Management of behavioral concerns, anger issues, stress, and difficulties affecting school, relationships, and well-being.",
    },
    {
      Icon: FiTrendingUp,
      name: "Growth & Development Concerns",
      description:
        "Assessment of physical growth patterns, developmental milestones, and concerns related to adolescent health.",
    },
    {
      Icon: FiBarChart2,
      name: "Nutrition & Weight Concerns",
      description:
        "Support for healthy eating habits, weight management, body image concerns, and proper nutritional development.",
    },
    {
      Icon: FiFeather,
      name: "Eating Disorders",
      description:
        "Evaluation and treatment support for unhealthy eating behaviors, disordered eating patterns, and related health concerns.",
    },
    {
      Icon: FiClock,
      name: "Sleep Problems",
      description:
        "Care for insomnia, poor sleep habits, fatigue, and sleep disturbances that affect adolescent health and performance.",
    },
    {
      Icon: FiHeart,
      name: "Menstrual & Reproductive Health",
      description:
        "Support for irregular periods, menstrual symptoms, and reproductive health questions during adolescence.",
    },
    {
      Icon: MdOutlineSpa,
      name: "Acne & Skin Concerns",
      description:
        "Guidance and treatment recommendations for common teenage skin conditions affecting confidence and daily comfort.",
    },
    {
      Icon: MdOutlineHealthAndSafety,
      name: "Preventive Teen Health Care",
      description:
        "Routine wellness visits, health screenings, vaccinations, and lifestyle counseling to promote long-term well-being.",
    },
  ],

  faqs: [
    {
      question: "What is adolescent medicine?",
      answer:
        "Adolescent medicine is a specialized field of healthcare focused on the physical, emotional, behavioral, and developmental needs of teenagers and young adults.",
    },
    {
      question: "What does an adolescent medicine specialist treat?",
      answer:
        "Adolescent medicine specialists diagnose and manage concerns such as puberty changes, teen anxiety, depression, sports injuries, growth concerns, nutrition issues, and preventive health needs.",
    },
    {
      question: "What age group does adolescent medicine cover?",
      answer:
        "Adolescent medicine typically provides care for preteens, teenagers, and young adults, generally ranging from ages 10 to 21, depending on individual healthcare needs.",
    },
    {
      question: "When should my teen see an adolescent medicine specialist?",
      answer:
        "You should consider a visit if your teen experiences emotional changes, puberty concerns, growth issues, behavioral challenges, sports injuries, nutritional problems, or needs specialized preventive care.",
    },
    {
      question: "How is adolescent medicine different from pediatric care?",
      answer:
        "While pediatricians provide general healthcare for children, adolescent medicine specialists focus on the unique physical, emotional, and social challenges that occur during the teenage years.",
    },
    {
      question:
        "Can adolescent medicine specialists help with anxiety and depression?",
      answer:
        "Yes. They can evaluate mood changes, anxiety symptoms, depression concerns, and behavioral health issues while coordinating care with mental health professionals when necessary.",
    },
    {
      question: "Do adolescent medicine specialists treat sports injuries?",
      answer:
        "Yes. They evaluate and manage common sports-related injuries such as sprains, strains, overuse injuries, and help teens safely return to physical activities.",
    },
    {
      question: "Can adolescent medicine help with puberty concerns?",
      answer:
        "Yes. Specialists evaluate early or delayed puberty, hormonal changes, growth patterns, and other developmental concerns affecting adolescents.",
    },
    {
      question: "Do adolescent medicine visits include preventive care?",
      answer:
        "Yes. Preventive care includes annual wellness exams, vaccinations, health screenings, lifestyle counseling, and education to support lifelong health.",
    },
    {
      question: "Can teens discuss sensitive health concerns privately?",
      answer:
        "Yes. Adolescent medicine specialists provide a respectful and confidential environment where teens can discuss personal health concerns according to healthcare privacy guidelines.",
    },
    {
      question: "What happens during an adolescent medicine appointment?",
      answer:
        "A visit may include a medical history review, physical evaluation, discussions about emotional well-being, growth and development assessments, and personalized healthcare recommendations.",
    },
    {
      question:
        "Can adolescent medicine specialists help with eating or weight concerns?",
      answer:
        "Yes. They provide guidance for healthy nutrition, weight management, body image concerns, and eating-related health issues.",
    },
    {
      question:
        "Do I need a referral to see an adolescent medicine specialist?",
      answer:
        "Referral requirements depend on your health insurance plan and provider network. Many patients can schedule an appointment directly.",
    },
    {
      question:
        "Are telehealth appointments available for adolescent medicine?",
      answer:
        "Yes. Many adolescent health concerns can be addressed through secure virtual visits, offering convenient access to medical guidance and follow-up care.",
    },
    {
      question: "How often should teenagers have wellness checkups?",
      answer:
        "Most teenagers should have an annual wellness visit to monitor growth, development, mental health, vaccinations, and overall well-being.",
    },
    {
      question: "Can adolescent medicine specialists address sleep problems?",
      answer:
        "Yes. They evaluate sleep difficulties, fatigue, and lifestyle factors that may affect a teen's physical and emotional health.",
    },
    {
      question:
        "What are common signs that my teenager may need medical support?",
      answer:
        "Persistent mood changes, unusual stress, significant changes in eating or sleeping habits, delayed growth, puberty concerns, or recurring injuries may indicate the need for evaluation.",
    },
    {
      question:
        "How can I schedule an appointment with an adolescent medicine specialist?",
      answer:
        "You can schedule an appointment by choosing a qualified adolescent medicine provider, booking online, or contacting the healthcare team for assistance.",
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
    title: " Board-Certified Specialists",
    description:
      "Receive care from experienced, credentialed providers who meet high standards of medical expertise and patient care.",
  },
  {
    Icon: FiZap,
    title: "Fast Appointments",
    description:
      "Schedule appointments quickly with convenient availability, including timely care for urgent health concerns.",
  },
  {
    Icon: FiMonitor,
    title: "Telehealth Access",
    description:
      "Connect with healthcare providers from the comfort of your home through secure, convenient virtual visits.",
  },
  {
    Icon: FiShield,
    title: "Insurance Support",
    description:
      "Get assistance understanding insurance coverage, benefits, authorizations, and billing questions.",
  },
  {
    Icon: FiHeart,
    title: "Personalised Care",
    description:
      "Receive customized treatment recommendations designed around your medical history, lifestyle, health needs, and goals.",
  },
  {
    Icon: FiGlobe,
    title: "Global Provider Network",
    description:
      "Access a broad network of healthcare specialists and coordinated care services wherever you need support.",
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
export default function SpecialtyPage({ data = SPECIALTY_DATA }) {
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [price, setPrice] = useState(null);
  const [priceLoading, setPriceLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setHeroLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);

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
    <main className="sp-page">
      <SEO
  title="Adolescent Medicine Specialists | Teen Health & Wellness Care"
  description="Get expert adolescent medicine care for teen physical, emotional, and behavioral health, including puberty concerns, anxiety, and sports injuries."
  keywords="adolescent medicine, teen health, teen wellness, puberty concerns, adolescent health, behavioral health, emotional support, stress management, anxiety support, sports injuries, telemedicine services, virtual healthcare services, online doctor appointment, online provider, licensed providers"
  url="https://humancareconnect.co/adolescent-medicine"
/>
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

        {/* <div className="sp-hero__content">
          <div
            className={`sp-hero__content-inner${heroLoaded ? " sp-hero__content-inner--loaded" : ""}`}
          >
            <span className="sp-hero__badge">Child & Family Care </span>
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
    
<div className="sp-hero__content">
  <div className="sp-hero__layout">
    {/* RIGHT — existing hero text */}
    <div
      className={`sp-hero__content-inner${heroLoaded ? " sp-hero__content-inner--loaded" : ""}`}
    >
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
    {/* LEFT — booking card */}
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
      </section >

  {/* ── 2. OVERVIEW ────────────────────────────────────────────────────── */ }
  < section className = "sp-overview" >
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
                <p className="sp-overview__badge-title">Board-Certified</p>
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
            <p className="sp-overview__para">{data.overviewDescription}</p>
            <p className="sp-overview__para">{data.overviewImportance}</p>
          </Reveal>

          <Reveal delay={80}>
            <div className="sp-info-box sp-info-box--blue">
              <h3 className="sp-info-box__heading">
                <FiActivity size={15} color="#083EBD" />
                Conditions Treated
              </h3>
              <p className="sp-info-box__text">{data.conditionsTreated}</p>
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
      </section >

  {/* ── 3. CONDITIONS ──────────────────────────────────────────────────── */ }
  < section className = "sp-conditions" >
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
      </section >

  {/* ── 4. WHY HUMANCARE ───────────────────────────────────────────────── */ }
  < section className = "sp-trust" >
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
            We combine experienced medical professionals with advanced
            technology to make accessing quality healthcare simpler, faster,
            and more personalized.
          </p>
        </div>
      </Reveal>

      <div className="sp-trust-grid">
        {TRUST_CARDS.map((c, i) => (
          <TrustCard key={i} {...c} delay={i * 55} />
        ))}
      </div>
    </div>
      </section >

  {/* ── 5. FAQ ─────────────────────────────────────────────────────────── */ }
  < section className = "sp-faq" >
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
      </section >

  {/* ── 6. CTA ─────────────────────────────────────────────────────────── */ }
  < section className = "sp-cta" >
        <div className="sp-cta__glow-top" aria-hidden="true" />
        <div className="sp-cta__glow-bottom" aria-hidden="true" />

        <div className="sp-cta__inner">
          <Reveal>
            <span className="sp-cta__eyebrow">Get Started Today</span>
            <h2 className="sp-cta__heading">
              Ready to Connect with a <span>{data.name}</span> Specialist?
            </h2>
            <p className="sp-cta__sub">
              Get expert teen healthcare support with convenient appointments,
              compassionate care, and personalized treatment plans designed for
              every stage of adolescent development.
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
      </section >
    </main >
  );
}
