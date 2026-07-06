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

import heroImage from "../../../assets/SpecialitiesImage/obstetrics-gynaecology-ob-gyn-womens-health-specialist-consultation.webp";
import overviewImage from "../../../assets/SpecialitiesImage/ob-gyn-womens-health-examination-reproductive-care.webp";
// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "obstetrics-and-gynaecology",
  name: "Obstetrics & Gynaecology (OB-GYN)",
  tagline: "Comprehensive Women's Healthcare for Every Stage of Life.",
  heroDescription:
    "Obstetrics & Gynaecology (OB-GYN) focuses on women's reproductive health, pregnancy care, hormonal wellness, fertility support, and gynecological conditions. From adolescence through menopause, OB-GYN specialists provide personalized healthcare designed to support physical, reproductive, and emotional well-being.Whether you're managing menstrual concerns, planning a pregnancy, exploring birth control options, addressing fertility challenges, or seeking routine gynecological care, our specialists are here to help.",
  heroImage: heroImage,
  heroAlt:
    "OB-GYN specialist providing women's healthcare consultation for pregnancy, fertility, reproductive health, and gynecological care",
  overviewImage: overviewImage,
  overviewAlt:
    "OB-GYN specialist performing a women's reproductive health examination and gynecological consultation",
  overviewDescription:
    "OB-GYN specialists provide care for menstrual disorders, PCOS, fertility concerns, pregnancy care, birth control management, pelvic pain, vaginal infections, hormonal health concerns, and reproductive wellness.",
  overviewImportance:
    "Consider an OB-GYN consultation if you're experiencing menstrual irregularities, pelvic pain, fertility concerns, vaginal symptoms, pregnancy-related questions, hormonal changes, or need preventive women's healthcare.",
  conditionsTreated:
    "Menopause care specialists help manage hot flashes, night sweats, mood changes, sleep disturbances, hormonal fluctuations, vaginal dryness, sexual health concerns, and menopause-related wellness challenges.",
  whenToConsult:
    "Consider a menopause consultation if you're experiencing symptoms that interfere with daily life, have questions about hormone therapy, or want guidance navigating hormonal changes during midlife.",
  keyServices: [
    {
      Icon: FiHeart,
      title: "Women's Wellness Exams",
      description:
        "Routine reproductive health evaluations and preventive screenings.",
    },
    {
      Icon: FiShield,
      title: "Birth Control Counseling",
      description:
        "Personalized contraceptive guidance and family planning support.",
    },
    {
      Icon: FiActivity,
      title: "Fertility Evaluations",
      description:
        "Assessment and support for fertility concerns and reproductive planning.",
    },
    {
      Icon: FiCalendar,
      title: "Pregnancy Care Support",
      description:
        "Prenatal guidance and ongoing pregnancy-related healthcare consultations.",
    },
    {
      Icon: FiSearch,
      title: "Hormonal Health Management",
      description:
        "Evaluation and support for hormonal imbalances and reproductive health concerns.",
    },
    {
      Icon: FiUsers,
      title: "Gynecological Care",
      description:
        "Comprehensive care for menstrual, vaginal, pelvic, and reproductive health conditions.",
    },
  ],

  benefits: [
    {
      Icon: FiHeart,
      title: "Reproductive Health Support",
      description:
        "Receive expert guidance for fertility, pregnancy, and gynecological wellness.",
    },
    {
      Icon: FiSearch,
      title: "Early Detection",
      description: "Identify health concerns before they become more serious.",
    },
    {
      Icon: FiUserCheck,
      title: "Personalized Care",
      description:
        "Treatment plans tailored to your age, symptoms, and health goals.",
    },
    {
      Icon: FiTrendingUp,
      title: "Lifelong Women's Health",
      description:
        "Support through adolescence, reproductive years, pregnancy, and menopause.",
    },
  ],

  conditions: [
    {
      Icon: FiShield,
      name: "Bacterial Vaginosis",
      description:
        "Diagnosis and treatment support for common vaginal bacterial infections.",
    },
    {
      Icon: FiUserCheck,
      name: "Birth Control Consultation",
      description:
        "Personalized contraceptive counseling and family planning guidance.",
    },
    {
      Icon: FiActivity,
      name: "Fertility Concerns",
      description:
        "Evaluation and support for individuals experiencing difficulty conceiving.",
    },
    {
      Icon: FiCalendar,
      name: "Irregular Periods",
      description:
        "Assessment and management of menstrual cycle irregularities and hormonal concerns.",
    },
    {
      Icon: FiWind,
      name: "Menstrual Cramps",
      description:
        "Care for painful periods and menstrual discomfort affecting daily activities.",
    },
    {
      Icon: FiHeart,
      name: "PCOS",
      description:
        "Management of polycystic ovary syndrome and related hormonal symptoms.",
    },
    {
      Icon: FiTarget,
      name: "Pelvic Pain",
      description:
        "Evaluation of pelvic discomfort, pressure, cramping, and reproductive health concerns.",
    },
    {
      Icon: FiActivity,
      name: "Prenatal Consultation",
      description:
        "Pregnancy planning, prenatal care guidance, and maternal health support.",
    },
    {
      Icon: FiShield,
      name: "Vaginal Yeast Infection",
      description:
        "Assessment and treatment support for vaginal itching, irritation, and yeast infections.",
    },
    {
      Icon: FiSearch,
      name: "Hormonal Imbalances",
      description: "Evaluation of symptoms related to changing hormone levels.",
    },
    {
      Icon: FiUsers,
      name: "Family Planning",
      description:
        "Guidance regarding reproductive goals, pregnancy planning, and contraception.",
    },
    {
      Icon: FiHeart,
      name: "Reproductive Wellness",
      description:
        "Comprehensive support for long-term gynecological and reproductive health.",
    },
  ],

  faqs: [
    {
      question: "What does an OB-GYN specialize in?",
      answer:
        "An OB-GYN specializes in women's reproductive health, pregnancy care, fertility, hormonal health, and gynecological conditions.",
    },
    {
      question: "How often should I see an OB-GYN?",
      answer:
        "Routine wellness visits are generally recommended, though frequency may vary based on age, health history, and individual needs.",
    },
    {
      question: "What causes irregular periods?",
      answer:
        "Irregular periods may be influenced by hormonal changes, stress, medical conditions, lifestyle factors, or reproductive health concerns.",
    },
    {
      question: "What is PCOS?",
      answer:
        "Polycystic Ovary Syndrome (PCOS) is a hormonal condition that can affect menstrual cycles, fertility, and overall health.",
    },
    {
      question: "When should I seek help for fertility concerns?",
      answer:
        "Many individuals seek evaluation after experiencing difficulty conceiving despite regular attempts over time.",
    },
    {
      question: "What happens during a birth control consultation?",
      answer:
        "A provider reviews your health history, goals, and preferences to discuss appropriate contraceptive options.",
    },
    {
      question: "What is bacterial vaginosis?",
      answer:
        "Bacterial vaginosis is a common vaginal condition caused by an imbalance of naturally occurring bacteria.",
    },
    {
      question: "How can an OB-GYN help with painful periods?",
      answer:
        "Specialists can evaluate underlying causes and recommend treatment options to improve symptom management.",
    },
    {
      question: "What causes pelvic pain?",
      answer:
        "Pelvic pain may be associated with reproductive, hormonal, urinary, gastrointestinal, or musculoskeletal conditions.",
    },
    {
      question: "When should I schedule a prenatal consultation?",
      answer:
        "Prenatal consultations are beneficial when planning pregnancy or after learning you are pregnant.",
    },
    {
      question: "What are common symptoms of a yeast infection?",
      answer:
        "Symptoms may include itching, irritation, discomfort, redness, and abnormal discharge.",
    },
    {
      question: "Can telehealth be used for OB-GYN consultations?",
      answer:
        "Yes. Many women's health concerns can be discussed through secure virtual healthcare services.",
    },
    {
      question: "What is family planning?",
      answer:
        "Family planning involves making informed decisions about pregnancy timing, contraception, and reproductive goals.",
    },
    {
      question: "Can hormonal imbalances affect fertility?",
      answer:
        "Hormonal changes can sometimes influence ovulation, menstrual cycles, and reproductive health.",
    },
    {
      question:
        "What women's health concerns are commonly treated through telemedicine?",
      answer:
        "Many non-emergency concerns, including menstrual issues, contraception counseling, fertility discussions, and symptom evaluations, can be addressed virtually.",
    },
    {
      question: "Can an OB-GYN help during menopause transitions?",
      answer:
        "Yes. OB-GYN specialists often provide support for hormonal changes and symptoms experienced during menopause.",
    },
    {
      question: "What should I prepare before an OB-GYN appointment?",
      answer:
        "Be ready to discuss symptoms, menstrual history, medications, reproductive goals, and any health concerns.",
    },
    {
      question: "Is preventive gynecological care important?",
      answer:
        "Yes. Preventive care supports early detection, reproductive wellness, and long-term health.",
    },
    {
      question: "Can OB-GYN specialists help with pregnancy planning?",
      answer:
        "Yes. They provide guidance regarding fertility, prenatal health, nutrition, and pregnancy preparation.",
    },
    {
      question: "How can I schedule an OB-GYN consultation?",
      answer:
        "You can book an appointment online and connect with an experienced OB-GYN specialist through secure telemedicine services.",
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
    title: "Experienced Women's Health Specialists",
    description:
      "Receive care from providers experienced in gynecology, fertility, and reproductive health.",
  },
  {
    Icon: FiClock,
    title: "Fast Appointments",
    description: "Schedule consultations quickly and conveniently.",
  },
  {
    Icon: FiMonitor,
    title: "Telehealth Access",
    description: "Access women's healthcare services securely from home.",
  },
  {
    Icon: FiShield,
    title: "Insurance Support",
    description:
      "Receive assistance understanding healthcare coverage and care options.",
  },
  {
    Icon: FiUserCheck,
    title: "Personalized Treatment Plans",
    description:
      "Every care plan is tailored to your symptoms, goals, and health history.",
  },
  {
    Icon: FiRefreshCw,
    title: "Continuity of Care",
    description:
      "Receive ongoing support through every stage of your reproductive health journey.",
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
export default function ObstetricsGynaecology({ data = SPECIALTY_DATA }) {
  const [heroLoaded, setHeroLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <HelmetProvider>
        <title>
          OB-GYN Specialists | Women's Health, Fertility, Pregnancy &
          Gynecological Care
        </title>
        <meta
          name="description"
          content="Connect with OB-GYN specialists for PCOS, fertility concerns, birth control consultations, pregnancy care, menstrual health, vaginal infections, pelvic pain, and personalized women's healthcare."
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
                  Our OB-GYN specialists provide expert care for a wide range of
                  reproductive and gynecological health concerns.
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
                  We combine experienced OB-GYN specialists with advanced
                  telemedicine technology to provide convenient, compassionate,
                  and personalized women's healthcare.
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
                Ready to Connect with an
                <span>{data.name}</span> Specialist?
              </h2>
              <p className="sp-cta__sub">
                Whether you're seeking fertility support, pregnancy guidance,
                menstrual health care, contraception counseling, or routine
                women's healthcare, our specialists are here to help you achieve
                your health goals with confidence and compassion.
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
