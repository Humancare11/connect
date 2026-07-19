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

import heroImage from "../../../assets/SpecialitiesImage/aglobal-cross-border-care-telemedicine-consultation.webp";
import overviewImage from "../../../assets/SpecialitiesImage/global-cross-border-healthcare-support-specialists.webp";
import BookingCard from "../../../components/SpecialityBookingCard";
import api from "../../../api";
import SEO from "../../../components/Seo";

// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "global-cross-border-care",
  name: "Global Cross-Border Care",
  categoryId: "travel",
  tagline: "Healthcare Support Wherever Life Takes You.",
  heroDescription:
    "Global Cross-Border Care helps patients access trusted medical guidance, specialist consultations, medication support, and healthcare coordination across countries and regions. Whether you're traveling, living abroad, relocating internationally, or seeking medical guidance from another country, our healthcare professionals provide convenient access to quality care through secure telemedicine services. With personalized support and international care coordination, patients can stay connected to healthcare providers no matter where they are in the world.",
  heroImage: heroImage,
  heroAlt:
    "Global Cross-Border Care telemedicine consultation with international healthcare specialists",
  overviewImage: overviewImage,
  overviewAlt:
    "Healthcare specialists providing global cross-border medical support and virtual care",
  overviewDescription:
    "Global Cross-Border Care is designed to support individuals who need healthcare access while traveling internationally, living overseas, relocating to a new country, or managing healthcare needs across multiple locations. Through virtual healthcare services and telemedicine consultations, patients can receive medical guidance, treatment recommendations, medication assistance, and referral support from experienced providers.",
  overviewImportance:
    "This specialty helps bridge healthcare gaps by making medical expertise more accessible regardless of geographic location, ensuring continuity of care and peace of mind wherever you may be.",
  conditionsTreated:
    "Providers offer support for general medical concerns, medication management, travel-related health needs, chronic condition follow-ups, referral coordination, and healthcare navigation while abroad.",
  whenToConsult:
    "Consider a cross-border consultation if you need medical advice while traveling, require medication support overseas, need specialist referrals, or want continuity of care across different countries.",

  keyServices: [
    {
      Icon: FiActivity,
      title: "Cross-Border Medical Consultations",
      description:
        "Virtual consultations with healthcare providers while traveling or living internationally.",
    },
    {
      Icon: FiThermometer,
      title: "International Medical Assistance",
      description:
        "Medical guidance and healthcare navigation support for patients abroad.",
    },
    {
      Icon: MdOutlineVaccines,
      title: "Medication Refill Assistance",
      description:
        "Help with ongoing medication management and refill planning during international travel.",
    },
    {
      Icon: FiDroplet,
      title: "Referral Coordination Services",
      description:
        "Support connecting with specialists, healthcare facilities, and medical resources across regions.",
    },
    {
      Icon: MdOutlineSpa,
      title: "Chronic Care Continuity",
      description:
        "Ongoing monitoring and support for chronic health conditions while away from home.",
    },
    {
      Icon: FiUsers,
      title: "Travel Health Guidance",
      description:
        "Personalized healthcare recommendations related to international travel and wellness.",
    },
  ],

  benefits: [
    {
      Icon: FiSearch,
      title: "Continuity of Care",
      description:
        "Maintain access to trusted healthcare support regardless of location.",
    },
    {
      Icon: FiTrendingUp,
      title: "Convenient Access",
      description:
        "Receive professional medical guidance without geographic limitations.",
    },
    {
      Icon: FiShield,
      title: "Better Healthcare Navigation",
      description:
        "Get assistance understanding healthcare systems and resources abroad.",
    },
    {
      Icon: FiHeart,
      title: "Peace of Mind",
      description:
        "Travel and live internationally with confidence knowing healthcare support is available.",
    },
  ],

  conditions: [
    {
      Icon: FiActivity,
      name: "Referral Coordination Overseas",
      desc: "Specialist referrals across countries",
      path: "/travel-and-global-care/global-cross-border-care/referral-coordination-overseas",
    },
    {
      Icon: FiGlobe,
      name: "Medication Refill While Traveling",
      desc: "Prescription refill support abroad",
      path: "/travel-and-global-care/global-cross-border-care/medication-refill-while-traveling",
    },
    {
      Icon: FiDroplet,
      name: "International Medical Assistance",
      desc: "Medical support while traveling abroad",
      path: "/travel-and-global-care/global-cross-border-care/international-medical-assistance",
    },
    {
      Icon: FiCompass,
      name: "Cross-Border Consultation",
      desc: "Healthcare guidance across locations",
      path: "/travel-and-global-care/global-cross-border-care/cross-border-consultation",
    },
  ],

  faqs: [
    {
      question: "What is Global Cross-Border Care?",
      answer:
        "Global Cross-Border Care provides healthcare support for individuals traveling, living, or receiving care across different countries.",
    },
    {
      question: "Can I speak with a doctor while traveling internationally?",
      answer:
        "Yes. Telemedicine consultations allow patients to connect with healthcare providers from many locations worldwide.",
    },
    {
      question: "What is a cross-border consultation?",
      answer:
        "A cross-border consultation is a virtual healthcare appointment designed for patients seeking medical guidance from another country or region.",
    },
    {
      question: "Can I get medical advice while living abroad?",
      answer:
        "Yes. Healthcare professionals can provide guidance, follow-up care, and continuity-of-care support remotely.",
    },
    {
      question: "Can I receive help with medication refills while traveling?",
      answer:
        "Providers can assist with medication management, refill planning, and treatment continuity discussions.",
    },
    {
      question: "What is international medical assistance?",
      answer:
        "International medical assistance helps patients navigate healthcare concerns, treatment needs, and healthcare systems while abroad.",
    },
    {
      question: "Can I get a second medical opinion internationally?",
      answer:
        "Yes. Virtual consultations can provide additional medical perspectives and guidance.",
    },
    {
      question: "How does referral coordination work?",
      answer:
        "Healthcare providers can help connect patients with specialists, healthcare facilities, and appropriate medical resources.",
    },
    {
      question: "Is telemedicine useful for travelers?",
      answer:
        "Yes. Telemedicine offers convenient access to healthcare support without requiring in-person visits.",
    },
    {
      question: "Can I manage chronic conditions while overseas?",
      answer:
        "Yes. Ongoing follow-up care and chronic disease monitoring can often be supported through telehealth services.",
    },
    {
      question: "What types of health concerns can be discussed?",
      answer:
        "Patients can discuss many non-emergency medical concerns, ongoing treatments, wellness questions, and healthcare planning needs.",
    },
    {
      question: "Can providers review my medical records?",
      answer:
        "Yes. Medical documentation can often be reviewed to support continuity of care and treatment planning.",
    },
    {
      question: "Is Global Cross-Border Care confidential?",
      answer:
        "Yes. All consultations follow strict privacy and security standards.",
    },
    {
      question: "Can I use these services before relocating internationally?",
      answer:
        "Yes. Healthcare professionals can provide guidance and preparation support before relocation.",
    },
    {
      question:
        "How does telehealth improve healthcare access internationally?",
      answer:
        "Telehealth removes geographic barriers and helps patients stay connected with healthcare professionals from virtually anywhere.",
    },
    {
      question: "Can I access care from different time zones?",
      answer:
        "Appointment availability may vary, but flexible scheduling options are often available.",
    },
    {
      question: "Is Global Cross-Border Care appropriate for emergencies?",
      answer:
        "No. Medical emergencies should always be addressed through local emergency services immediately.",
    },
    {
      question: "How can I schedule a Global Cross-Border Care appointment?",
      answer:
        "You can book an appointment online and connect with an experienced healthcare provider through secure telemedicine services.",
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
      "Connect with experienced healthcare professionals dedicated to quality patient care.",
  },
  {
    Icon: FiZap,
    title: "Fast Appointments",
    description: "Schedule consultations quickly regardless of your location.",
  },
  {
    Icon: FiMonitor,
    title: "Secure Telehealth Access",
    description:
      "Access healthcare services through secure, encrypted virtual consultations.",
  },
  {
    Icon: FiShield,
    title: "Care Coordination Support",
    description:
      "Receive assistance with referrals, records, treatment planning, and healthcare navigation.",
  },
  {
    Icon: FiHeart,
    title: "Personalized Healthcare",
    description:
      "Benefit from treatment recommendations tailored to your health history and needs.",
  },
  {
    Icon: FiGlobe,
    title: "Global Accessibility",
    description:
      "Stay connected to professional healthcare support wherever you are in the world.",
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
        <Link
          to={path}
          style={{
            textDecoration: "none",
            color: "inherit",
            display: "block",
            height: "100%",
          }}
        >
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
export default function GlobalCrossBorderCare({ data = SPECIALTY_DATA }) {
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
      <main className="sp-page">
        <SEO
          title="Global Cross-Border Care | International Telemedicine & Medical Support"
          description="Access global healthcare support through international telemedicine services, cross-border consultations, medication refill assistance, referral coordination, and medical guidance while traveling abroad."
          keywords="Global cross-border care, International telemedicine, Cross-border consultation, Online doctor appointment"
          url="https://humancareconnect.co/global-cross-border-care"
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

          <div className="sp-hero__content">
            <div className="sp-hero__layout">
              <div
                className={`sp-hero__content-inner${
                  heroLoaded ? " sp-hero__content-inner--loaded" : ""
                }`}
              >
                <span className="sp-hero__badge">Child & Family Care</span>
                <h1 className="sp-hero__title">{data.name}</h1>
                <p className="sp-hero__tagline">{data.tagline}</p>
                <p className="sp-hero__description">{data.heroDescription}</p>
              </div>

              <BookingCard
                price={price}
                priceLoading={priceLoading}
                title={data.name}
                specialitySlug={data.slug}
              />
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
              <div
                className="sp-conditions__head"
                onClick={() => navigate("/conditions")}
                style={{ cursor: "pointer" }}
              >
                <SectionLabel>Conditions &amp; Symptoms</SectionLabel>
                <h2>What We Treat</h2>
                <p>
                  Our {data.name.toLowerCase()} specialists support a wide range
                  of international healthcare and continuity-of-care needs.
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
                  telemedicine technology to provide seamless global healthcare
                  access and personalized medical support.
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
                Connect with experienced healthcare professionals for
                international medical assistance, cross-border consultations,
                medication support, and healthcare coordination. Receive trusted
                medical guidance wherever life takes you.
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
