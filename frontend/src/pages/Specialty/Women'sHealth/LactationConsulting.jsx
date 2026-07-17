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

import heroImage from "../../../assets/SpecialitiesImage/lactation-consulting-breastfeeding-support.webp";
import overviewImage from "../../../assets/SpecialitiesImage/lactation-consant-breastfeeding-consultation.webp";
import BookingCard from "../../../components/SpecialityBookingCard";
import api from "../../../api";
// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "lactation-consulting",
  name: "Lactation Consulting",
  categoryId: "women",
  tagline: "Expert Breastfeeding Support for Parents and Babies.",
  heroDescription:
    "Lactation Consulting provides professional support for breastfeeding, infant feeding, milk supply concerns, and feeding challenges experienced during the postpartum period. Whether you're a first-time parent or have previous breastfeeding experience, lactation specialists help you navigate feeding concerns with confidence and personalized care. From improving latch techniques to addressing milk supply concerns and planning weaning transitions, lactation consultants provide evidence-based guidance designed to support both parent and baby.",
  heroImage: heroImage,
  heroAlt:
    "Lactation consultant providing breastfeeding support and infant feeding guidance to a new mother",
  overviewImage: overviewImage,
  overviewAlt:
    "Lactation consultant assisting a mother with breastfeeding techniques during a consultation",
  overviewDescription:
    "Lactation Consulting is a specialized healthcare service focused on supporting breastfeeding families through education, assessment, and personalized feeding guidance. Lactation consultants help parents overcome common breastfeeding challenges, improve feeding experiences, and ensure babies receive adequate nutrition during early development.",
  overviewImportance:
    "Support may include breastfeeding assessments, feeding technique guidance, milk supply evaluations, pumping recommendations, and assistance with transitioning between feeding stages.",
  conditionsTreated:
    "Lactation consultants commonly help with latch difficulties, low milk supply concerns, nipple discomfort, breastfeeding challenges, pumping support, infant feeding questions, and weaning transitions.",
  whenToConsult:
    "Consider a lactation consultation if breastfeeding is painful, your baby has difficulty feeding, you are concerned about milk supply, experiencing nipple pain, or need guidance with pumping or weaning.",

  keyServices: [
    {
      Icon: FiHeart,
      title: "Breastfeeding Assessments",
      description:
        "Comprehensive evaluations of breastfeeding techniques, feeding effectiveness, and infant feeding patterns.",
    },
    {
      Icon: FiTarget,
      title: "Latch Support",
      description:
        "Personalized guidance to improve infant latch and feeding comfort.",
    },
    {
      Icon: FiActivity,
      title: "Milk Supply Evaluations",
      description:
        "Assessment of milk production concerns and strategies to support healthy breastfeeding.",
    },
    {
      Icon: FiTool,
      title: "Pumping Guidance",
      description:
        "Recommendations for breast pump use, milk storage, and feeding schedules.",
    },
    {
      Icon: FiRefreshCw,
      title: "Weaning Support",
      description:
        "Step-by-step guidance for transitioning from breastfeeding to other feeding methods.",
    },
    {
      Icon: MdOutlineSpa,
      title: "Postpartum Feeding Education",
      description:
        "Practical education and support for breastfeeding success during the postpartum period.",
    },
  ],

  benefits: [
    {
      Icon: FiHeart,
      title: "Improved Feeding Success",
      description:
        "Receive expert support that promotes effective feeding and infant nutrition.",
    },
    {
      Icon: FiUserCheck,
      title: "Increased Parent Confidence",
      description:
        "Gain reassurance and practical strategies for common breastfeeding concerns.",
    },
    {
      Icon: FiShield,
      title: "Enhanced Comfort",
      description:
        "Address pain, discomfort, and feeding challenges more effectively.",
    },
    {
      Icon: FiUsers,
      title: "Personalized Support",
      description:
        "Receive guidance tailored to your baby's needs and feeding goals.",
    },
  ],

  conditions: [
    {
      Icon: FiTarget,
      name: "Latch Problems",
      description:
        "Help for babies experiencing difficulty attaching properly during breastfeeding.",
    },
    {
      Icon: FiActivity,
      name: "Low Milk Supply",
      description:
        "Evaluation and support for concerns about breast milk production and feeding adequacy.",
    },
    {
      Icon: FiShield,
      name: "Nipple Pain",
      description:
        "Guidance for breastfeeding discomfort, nipple soreness, cracking, and feeding-related pain.",
    },
    {
      Icon: FiRefreshCw,
      name: "Weaning Guidance",
      description:
        "Support for transitioning from breastfeeding to formula feeding, solid foods, or other feeding plans.",
    },
    {
      Icon: FiUsers,
      name: "Breastfeeding Challenges",
      description:
        "Assessment and support for common feeding difficulties experienced by parents and infants.",
    },
    {
      Icon: FiTool,
      name: "Pumping Concerns",
      description:
        "Guidance regarding pumping schedules, milk expression, and storage recommendations.",
    },
    {
      Icon: FiCalendar,
      name: "Feeding Schedule Questions",
      description:
        "Support creating feeding routines that fit your baby's developmental needs.",
    },
    {
      Icon: FiHeart,
      name: "Infant Feeding Difficulties",
      description:
        "Evaluation of feeding patterns, feeding efficiency, and nutrition concerns.",
    },
    {
      Icon: FiUserCheck,
      name: "Breastfeeding Positioning",
      description:
        "Recommendations for comfortable feeding positions that support successful nursing.",
    },
    {
      Icon: FiBriefcase,
      name: "Returning to Work While Breastfeeding",
      description:
        "Planning support for pumping, milk storage, and maintaining feeding goals.",
    },
    {
      Icon: FiGlobe,
      name: "Combination Feeding Support",
      description:
        "Guidance for families using both breastfeeding and supplemental feeding methods.",
    },
    {
      Icon: MdOutlineSpa,
      name: "Postpartum Feeding Education",
      description:
        "Comprehensive support during the early weeks and months after delivery.",
    },
  ],

  faqs: [
    {
      question: "What is a lactation consultant?",
      answer:
        "A lactation consultant is a healthcare professional who specializes in breastfeeding and infant feeding support.",
    },
    {
      question: "When should I schedule a lactation consultation?",
      answer:
        "You can seek support during pregnancy, immediately after birth, or anytime breastfeeding concerns arise.",
    },
    {
      question: "What causes latch problems?",
      answer:
        "Latch difficulties can occur for various reasons involving feeding technique, infant positioning, or feeding coordination.",
    },
    {
      question: "How can I tell if my baby is feeding effectively?",
      answer:
        "A lactation consultant can evaluate feeding patterns, weight gain, and feeding efficiency.",
    },
    {
      question: "What causes low milk supply?",
      answer:
        "Milk supply concerns can be influenced by feeding frequency, health factors, hydration, stress, and other variables.",
    },
    {
      question: "Is nipple pain normal during breastfeeding?",
      answer:
        "Some discomfort may occur initially, but persistent pain should be evaluated by a professional.",
    },
    {
      question: "Can telehealth be used for lactation support?",
      answer:
        "Yes. Many breastfeeding concerns can be effectively addressed through virtual consultations.",
    },
    {
      question: "What is weaning?",
      answer:
        "Weaning is the gradual transition from breastfeeding to alternative feeding methods.",
    },
    {
      question: "Can lactation consultants help with pumping?",
      answer:
        "Yes. Consultants can provide guidance regarding pumping schedules, techniques, and milk storage.",
    },
    {
      question: "What is combination feeding?",
      answer:
        "Combination feeding involves using breastfeeding alongside formula feeding or other supplemental feeding methods.",
    },
    {
      question: "Can I breastfeed after returning to work?",
      answer:
        "Many parents successfully continue breastfeeding while working with proper planning and support.",
    },
    {
      question: "How often should newborns feed?",
      answer:
        "Feeding frequency varies depending on age, growth needs, and individual circumstances.",
    },
    {
      question: "Can stress affect milk supply?",
      answer:
        "Stress may influence breastfeeding experiences and should be discussed during consultations.",
    },
    {
      question: "What should I do if breastfeeding becomes painful?",
      answer:
        "Persistent discomfort should be evaluated to identify and address potential causes.",
    },
    {
      question: "Is lactation support only for first-time parents?",
      answer:
        "No. Parents at any stage of their breastfeeding journey may benefit from professional support.",
    },
    {
      question: "Can lactation consultants help with feeding transitions?",
      answer:
        "Yes. They provide guidance for weaning and other feeding transitions.",
    },
    {
      question: "What should I bring to a lactation consultation?",
      answer:
        "Be prepared to discuss feeding patterns, concerns, health history, and your feeding goals.",
    },
    {
      question: "How can I schedule a lactation consultation?",
      answer:
        "You can book an appointment online and connect with a lactation specialist through secure telemedicine services.",
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
    title: "Experienced Lactation Specialists",
    description:
      "Receive guidance from professionals trained in breastfeeding and infant feeding support.",
  },
  {
    Icon: FiClock,
    title: "Fast Appointments",
    description:
      "Schedule consultations quickly during critical feeding stages.",
  },
  {
    Icon: FiMonitor,
    title: "Telehealth Access",
    description:
      "Connect securely from home for convenient breastfeeding support.",
  },
  {
    Icon: FiHeart,
    title: "Family-Centered Care",
    description:
      "Receive care designed around the needs of both parent and baby.",
  },
  {
    Icon: FiUserCheck,
    title: "Personalized Feeding Plans",
    description:
      "Every recommendation is tailored to your feeding goals and circumstances.",
  },
  {
    Icon: FiRefreshCw,
    title: "Ongoing Support",
    description:
      "Access continued guidance throughout your breastfeeding and weaning journey.",
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
export default function LactationConsulting({ data = SPECIALTY_DATA }) {
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
          Lactation Consulting Specialists | Breastfeeding Support & Infant
          Feeding Guidance
        </title>
        <meta
          name="description"
          content="Connect with lactation consultants for breastfeeding support, latch problems, low milk supply concerns, nipple pain management, weaning guidance, and personalized infant feeding support."
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
                  Our lactation consultants provide support for a wide range of
                  breastfeeding and infant feeding concerns.
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
                Ready to Connect with a<span>{data.name}</span> Specialist?
              </h2>
              <p className="sp-cta__sub">
                Connect with a lactation consultant for personalized
                breastfeeding guidance, milk supply support, latch assessments,
                pumping recommendations, and weaning assistance. Get expert help
                to support a healthy feeding journey for you and your baby.
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
