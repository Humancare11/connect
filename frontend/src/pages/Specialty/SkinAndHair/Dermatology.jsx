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

import heroImage from "../../../assets/SpecialitiesImage/dermatology-specialist-skin-care-consultation-banner.webp";
import overviewImage from "../../../assets/SpecialitiesImage/dermatologist-patient-skin-consultation.webp";
import BookingCard from "../../../components/SpecialityBookingCard";
import api from "../../../api";

// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "dermatology",
  name: "Dermatology",
  categoryId: "skin",
  tagline: "Expert Care for Healthy Skin, Hair, and Nails.",
  heroDescription:
    "Dermatology specialists diagnose, treat, and manage conditions affecting the skin, hair, and nails. Whether you're dealing with acne, eczema, psoriasis, hair loss, skin infections, or chronic skin concerns, dermatology care helps restore skin health, improve confidence, and support overall wellness. Using evidence-based treatments and personalized care plans, dermatologists help patients manage symptoms, prevent complications, and achieve healthier skin, hair, and nails at every stage of life.",
  heroImage: heroImage,
  heroAlt:
    "Board-certified dermatologist providing skin, hair, and nail consultation for acne, eczema, psoriasis, and other dermatology conditions.",
  overviewImage: overviewImage,
  overviewAlt:
    "Dermatologist examining a patient's skin during a comprehensive dermatology consultation for skin, hair, and nail health.",
  overviewDescription:
    "Dermatology is the medical specialty focused on diagnosing and treating conditions affecting the skin, hair, nails, and related structures. Skin is the body's largest organ and plays an important role in protecting overall health, making early diagnosis and treatment essential.",
  overviewImportance:
    "Dermatology specialists evaluate both common and complex skin concerns, helping patients manage chronic conditions, treat infections, improve cosmetic concerns, and maintain long-term skin health through preventive care and personalized treatment plans.",
  conditionsTreated:
    "Dermatologists diagnose and manage acne, eczema, psoriasis, rosacea, hair loss, hives, fungal skin infections, nail disorders, cold sores, and skin growth concerns.",
  whenToConsult:
    "Schedule a dermatology consultation if you experience persistent rashes, acne breakouts, skin irritation, itching, hair thinning, nail changes, suspicious skin growths, or any skin condition affecting your quality of life.",

  keyServices: [
    {
      Icon: FiActivity,
      title: "Skin Condition Evaluations",
      description:
        "Comprehensive assessments for rashes, skin irritation, infections, and chronic skin concerns.",
    },
    {
      Icon: FiThermometer,
      title: "Acne & Scar Management",
      description:
        "Personalized treatment plans for acne breakouts, blemishes, and acne-related skin concerns.",
    },
    {
      Icon: MdOutlineVaccines,
      title: "Hair Loss Evaluations",
      description:
        "Assessment of hair thinning, scalp conditions, and hair growth concerns.",
    },
    {
      Icon: FiDroplet,
      title: "Nail Health Consultations",
      description:
        "Diagnosis and treatment recommendations for nail infections, damage, and abnormalities.",
    },
    {
      Icon: MdOutlineSpa,
      title: "Skin Lesion & Mole Assessments",
      description:
        "Evaluation of moles, skin growths, and changes in skin appearance.",
    },
    {
      Icon: FiUsers,
      title: "Chronic Skin Disease Management",
      description:
        "Ongoing care for eczema, psoriasis, rosacea, and other long-term skin conditions.",
    },
  ],

  benefits: [
    {
      Icon: FiSearch,
      title: "Healthier Skin",
      description:
        "Receive expert treatment that improves skin health, appearance, and comfort.",
    },
    {
      Icon: FiTrendingUp,
      title: "Early Detection",
      description:
        "Identify skin conditions and concerns before they become more serious.",
    },
    {
      Icon: FiShield,
      title: "Improved Confidence",
      description:
        "Address visible skin concerns that may impact self-esteem and daily life.",
    },
    {
      Icon: FiHeart,
      title: "Long-Term Skin Wellness",
      description:
        "Develop preventive strategies to maintain healthy skin, hair, and nails.",
    },
  ],

  conditions: [
    {
      Icon: FiActivity,
      name: "Acne",
      description:
        "Treatment for pimples, blackheads, whiteheads, cystic acne, and acne-related skin concerns.",
    },
    {
      Icon: FiZap,
      name: "Cold Sores",
      description:
        "Management of recurring cold sores, lip lesions, and herpes-related skin symptoms.",
    },
    {
      Icon: FiDroplet,
      name: "Eczema",
      description:
        "Care for dry, itchy, inflamed skin and chronic eczema flare-ups.",
    },
    {
      Icon: FiShield,
      name: "Fungal Skin Infection",
      description:
        "Diagnosis and treatment of fungal infections affecting the skin, scalp, or nails.",
    },
    {
      Icon: FiTrendingUp,
      name: "Hair Loss",
      description:
        "Evaluation and management of hair thinning, excessive shedding, and scalp-related hair concerns.",
    },
    {
      Icon: FiAlertCircle,
      name: "Hives",
      description:
        "Treatment for itchy, raised skin welts caused by allergic reactions and other triggers.",
    },
    {
      Icon: FiSearch,
      name: "Mole & Skin Checks",
      description:
        "Assessment of moles, skin growths, pigmentation changes, and skin abnormalities.",
    },
    {
      Icon: FiTarget,
      name: "Nail Problems",
      description:
        "Care for nail infections, discoloration, thickened nails, brittle nails, and nail injuries.",
    },
    {
      Icon: FiLayers,
      name: "Psoriasis",
      description:
        "Management of chronic inflammatory skin conditions causing scaling, redness, and irritation.",
    },
    {
      Icon: FiHeart,
      name: "Rosacea",
      description:
        "Treatment for facial redness, visible blood vessels, skin sensitivity, and rosacea flare-ups.",
    },
    {
      Icon: FiCompass,
      name: "Skin Rashes",
      description:
        "Evaluation of unexplained rashes, redness, irritation, itching, and allergic skin reactions.",
    },
    {
      Icon: FiUsers,
      name: "Sensitive Skin Concerns",
      description:
        "Support for skin sensitivity, irritation, and reactions to environmental or skincare triggers.",
    },
  ],

  faqs: [
    {
      question: "What is dermatology?",
      answer:
        "Dermatology is the medical specialty focused on diagnosing and treating conditions affecting the skin, hair, and nails.",
    },
    {
      question: "What conditions do dermatologists treat?",
      answer:
        "Dermatologists commonly treat acne, eczema, psoriasis, rosacea, fungal infections, hair loss, nail disorders, and skin growth concerns.",
    },
    {
      question: "When should I see a dermatologist?",
      answer:
        "You should seek dermatology care if you experience persistent skin symptoms, unusual skin changes, hair loss, or nail concerns.",
    },
    {
      question: "What causes acne?",
      answer:
        "Acne can be influenced by hormones, genetics, stress, skincare products, and excess oil production.",
    },
    {
      question: "What is eczema?",
      answer:
        "Eczema is a chronic skin condition that causes dry, itchy, inflamed, and irritated skin.",
    },
    {
      question: "Is psoriasis contagious?",
      answer:
        "No. Psoriasis is an immune-related skin condition and cannot be spread from person to person.",
    },
    {
      question: "What causes hair loss?",
      answer:
        "Hair loss may be related to genetics, hormonal changes, stress, nutritional factors, medical conditions, or scalp disorders.",
    },
    {
      question: "What are hives?",
      answer:
        "Hives are itchy, raised welts that may occur due to allergies, infections, medications, or other triggers.",
    },
    {
      question: "What is rosacea?",
      answer:
        "Rosacea is a chronic skin condition that commonly causes facial redness, visible blood vessels, and skin sensitivity.",
    },
    {
      question: "Should I be concerned about changing moles?",
      answer:
        "Any new or changing mole should be evaluated by a healthcare professional.",
    },
    {
      question: "Can dermatologists treat nail problems?",
      answer:
        "Yes. Dermatologists diagnose and manage a wide variety of nail conditions and infections.",
    },
    {
      question: "What causes fungal skin infections?",
      answer:
        "Fungal infections are caused by fungi that grow on the skin, scalp, or nails, often in warm and moist environments.",
    },
    {
      question: "Are telehealth dermatology appointments effective?",
      answer:
        "Many skin conditions can be evaluated through secure virtual consultations, especially for initial assessments and follow-up care.",
    },
    {
      question: "How can I keep my skin healthy?",
      answer:
        "Healthy skin habits include sun protection, hydration, proper skincare, and routine health evaluations.",
    },
    {
      question: "What is a skin check?",
      answer:
        "A skin check is an examination of the skin to identify suspicious lesions, moles, growths, or skin changes.",
    },
    {
      question: "Can dermatologists help with cosmetic skin concerns?",
      answer:
        "Yes. Many dermatologists provide guidance for acne scars, pigmentation issues, and overall skin appearance.",
    },
    {
      question: "How often should I have my skin evaluated?",
      answer:
        "The frequency depends on your age, skin type, family history, and personal risk factors.",
    },
    {
      question:
        "How can I schedule an appointment with a dermatology specialist?",
      answer:
        "You can book an appointment online and connect with a qualified dermatology specialist through virtual or in-person care options.",
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
      "Receive care from experienced providers trained in dermatology and skin health.",
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
      "Connect securely with dermatology specialists from anywhere using virtual healthcare services.",
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
      "Benefit from treatment plans tailored to your skin type, symptoms, and health goals.",
  },
  {
    Icon: FiGlobe,
    title: "Nationwide Provider Network",
    description:
      "Access trusted dermatology professionals and coordinated specialty care services.",
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
export default function Dermatology({ data = SPECIALTY_DATA }) {
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
        <title>Dermatology Specialists | Skin, Hair & Nail Care Online</title>
        <meta
          name="description"
          content="Connect with experienced dermatology specialists for acne, eczema, psoriasis, rosacea, hair loss, fungal skin infections, hives, nail problems, and personalized skin care treatment."
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
              <span className="sp-hero__badge">Skin & Hair</span>
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
                  Our {data.name.toLowerCase()} specialists provide expert care
                  for a wide range of skin, hair, and nail conditions.
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
                  We combine experienced dermatology specialists with advanced
                  technology to make skin care more accessible, convenient, and
                  personalized.
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
                Get expert care for acne, eczema, psoriasis, hair loss, skin
                infections, and other dermatology concerns. Schedule an
                appointment today and receive personalized treatment designed to
                help you look and feel your best.
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
