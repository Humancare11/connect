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

import heroImage from "../../../assets/SpecialitiesImage/travel-medicine-specialist-consultation.webp";
import overviewImage from "../../../assets/SpecialitiesImage/travel-medicine-health-consultation.webp";
import BookingCard from "../../../components/SpecialityBookingCard";
import api from "../../../api";
// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "travel-medicine",
  name: "Travel Medicine",
  categoryId: "travel",
  tagline: "Stay Healthy Before, During, and After Your Journey.",
  heroDescription:
    "Travel Medicine focuses on preventing, identifying, and managing health concerns related to domestic and international travel. Whether you're planning a vacation, business trip, adventure travel, or long-term relocation, travel medicine specialists help you prepare for potential health risks and stay healthy throughout your journey.From travel vaccinations and preventive health planning to post-travel illness evaluations, our specialists provide personalized guidance based on your destination, activities, and health history.",
  heroImage: heroImage,
  heroAlt:
    "Travel medicine specialist providing pre-travel consultation, vaccination guidance, and international travel health planning",
  overviewImage: overviewImage,
  overviewAlt:
    "Travel medicine specialist discussing travel vaccinations, disease prevention, and destination-specific health advice",
  overviewDescription:
    "Travel Medicine is a healthcare specialty dedicated to helping travelers prevent and manage health risks associated with domestic and international travel. This includes vaccination recommendations, infectious disease prevention, travel-related illness management, food and water safety guidance, and post-travel health evaluations.",
  overviewImportance:
    "Travel medicine specialists help individuals understand destination-specific risks, prepare for environmental challenges, and access medical support before, during, and after travel.",
  conditionsTreated:
    "Travel medicine specialists evaluate and manage altitude sickness, traveler's diarrhea, malaria prevention needs, travel-related fever, food poisoning, post-travel symptoms, and travel vaccination requirements.",
  whenToConsult:
    "Consider a travel medicine consultation before international travel, when visiting high-risk destinations, after returning with unexplained symptoms, or if you need destination-specific vaccination and prevention guidance.",

  keyServices: [
    {
      Icon: FiActivity,
      title: "Pre-Travel Health Consultations",
      description:
        "Personalized travel health planning based on your destination, itinerary, and medical history.",
    },
    {
      Icon: FiThermometer,
      title: "Travel Vaccination Guidance",
      description:
        "Recommendations for destination-specific vaccines and preventive health measures.",
    },
    {
      Icon: MdOutlineVaccines,
      title: "Infectious Disease Prevention",
      description:
        "Strategies to reduce exposure to travel-related illnesses and infectious diseases.",
    },
    {
      Icon: FiDroplet,
      title: "Travel Illness Evaluations",
      description:
        "Assessment and treatment guidance for symptoms experienced during or after travel.",
    },
    {
      Icon: MdOutlineSpa,
      title: "Medication & Prevention Planning",
      description:
        "Travel medication recommendations and preventive healthcare support.",
    },
    {
      Icon: FiUsers,
      title: "Post-Travel Health Assessments",
      description:
        "Evaluation of symptoms and health concerns following domestic or international travel.",
    },
  ],

  benefits: [
    {
      Icon: FiSearch,
      title: "Reduced Health Risks",
      description:
        "Prepare for destination-specific health concerns before you travel.",
    },
    {
      Icon: FiShield,
      title: "Better Disease Prevention",
      description:
        "Protect yourself from travel-related infections and illnesses.",
    },
    {
      Icon: FiGlobe,
      title: "Safer Travel Experiences",
      description:
        "Receive expert guidance for healthier and more enjoyable travel.",
    },
    {
      Icon: FiHeart,
      title: "Faster Recovery Support",
      description:
        "Access professional medical advice if symptoms develop during or after travel.",
    },
  ],

  conditions: [
    {
      Icon: FiActivity,
      name: "Altitude Sickness",
      path: "/travel-and-global-care/travel-medicine/altitude-sickness",
      description:
        "Evaluation and management of symptoms caused by high-altitude travel, including headaches, nausea, and dizziness.",
    },
    {
      Icon: FiDroplet,
      name: "Food Poisoning While Traveling",
      path: "/travel-and-global-care/travel-medicine/food-poisoning-while-traveling",
      description:
        "Care for gastrointestinal symptoms caused by contaminated food or water during travel.",
    },
    {
      Icon: FiShield,
      name: "Malaria Prevention",
      path: "/travel-and-global-care/travel-medicine/malaria-prevention",
      description:
        "Risk assessments, prevention strategies, and travel health guidance for malaria-prone destinations.",
    },
    {
      Icon: FiThermometer,
      name: "Post-Travel Symptoms",
      path: "/travel-and-global-care/travel-medicine/post-travel-symptoms",
      description:
        "Evaluation of unexplained symptoms that develop after returning from travel.",
    },
    {
      Icon: MdOutlineVaccines,
      name: "Pre-Travel Vaccination",
      description:
        "Vaccination recommendations and preparation for domestic and international travel.",
    },
    {
      Icon: FiAlertCircle,
      name: "Travel-Related Fever",
      path: "/travel-and-global-care/travel-medicine/travel-related-fever",
      description:
        "Assessment of fever occurring during or after travel, including potential infectious causes.",
    },
    {
      Icon: FiTrendingUp,
      name: "Traveler's Diarrhea",
      description:
        "Treatment recommendations and prevention strategies for common travel-related digestive illnesses.",
    },
    {
      Icon: FiCompass,
      name: "Motion Sickness",
      path: "/motion-sickness",
      description:
        "Guidance for preventing and managing nausea, dizziness, and discomfort during travel.",
    },
    {
      Icon: FiUsers,
      name: "Insect Bite Prevention",
      description:
        "Strategies to reduce exposure to mosquito-borne and insect-related illnesses.",
    },
    {
      Icon: FiHeart,
      name: "Travel Medication Planning",
      description:
        "Personalized recommendations for travel medications and emergency health preparedness.",
    },
    {
      Icon: FiMap,
      name: "Destination-Specific Health Risks",
      description:
        "Guidance regarding environmental, infectious, and regional health concerns.",
    },
    {
      Icon: FiGlobe,
      name: "International Travel Health Support",
      description:
        "Comprehensive healthcare planning and support for international travelers.",
    },
  ],

  faqs: [
    {
      question: "What is travel medicine?",
      answer:
        "Travel medicine is a healthcare specialty focused on preventing and managing travel-related health concerns.",
    },
    {
      question: "When should I schedule a travel medicine appointment?",
      answer:
        "Ideally, you should schedule an appointment several weeks before your trip to allow time for vaccinations and preparation.",
    },
    {
      question: "Do I need vaccines before international travel?",
      answer:
        "Vaccine recommendations vary depending on your destination, planned activities, and medical history.",
    },
    {
      question: "What is traveler's diarrhea?",
      answer:
        "Traveler's diarrhea is a common digestive illness caused by consuming contaminated food or water while traveling.",
    },
    {
      question: "What causes altitude sickness?",
      answer:
        "Altitude sickness occurs when the body struggles to adapt to lower oxygen levels at high elevations.",
    },
    {
      question: "How can I prevent food poisoning while traveling?",
      answer:
        "Practice food and water safety, choose reputable dining options, and follow travel health recommendations.",
    },
    {
      question: "What is malaria?",
      answer:
        "Malaria is a mosquito-borne disease found in certain regions of the world and may require preventive measures.",
    },
    {
      question: "Should I see a doctor if I become sick after travel?",
      answer:
        "Yes. Any unexplained symptoms after travel should be evaluated by a healthcare professional.",
    },
    {
      question: "What are common post-travel symptoms?",
      answer:
        "Common symptoms include fever, diarrhea, fatigue, respiratory symptoms, and unexplained illness.",
    },
    {
      question: "Can telehealth be used for travel medicine consultations?",
      answer:
        "Yes. Many travel medicine consultations can be conducted through secure telehealth services.",
    },
    {
      question: "What is a pre-travel consultation?",
      answer:
        "A pre-travel consultation evaluates health risks, vaccination needs, and preventive measures before travel.",
    },
    {
      question:
        "Can travel medicine specialists help with prescription medications?",
      answer:
        "Yes. They can provide guidance regarding medication planning and travel health preparedness.",
    },
    {
      question:
        "What should I do if I develop a fever after international travel?",
      answer:
        "Seek medical advice promptly, especially if you visited areas with infectious disease risks.",
    },
    {
      question: "Are travel vaccinations mandatory?",
      answer:
        "Some destinations require specific vaccinations, while others are strongly recommended.",
    },
    {
      question: "Can travel medicine help business travelers?",
      answer:
        "Yes. Travel medicine services are valuable for leisure travelers, business travelers, students, and expatriates.",
    },
    {
      question: "What health risks vary by destination?",
      answer:
        "Risks may include infectious diseases, environmental hazards, altitude exposure, foodborne illnesses, and insect-borne diseases.",
    },
    {
      question: "How can I reduce my risk of illness while traveling?",
      answer:
        "Follow vaccination recommendations, practice hygiene, drink safe water, and follow travel health advice.",
    },
    {
      question: "How can I schedule a travel medicine appointment?",
      answer:
        "You can book an appointment online and connect with a travel medicine specialist through virtual or in-person care options.",
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
      "Receive care from experienced providers with expertise in travel-related healthcare.",
  },
  {
    Icon: FiZap,
    title: "Fast Appointments",
    description:
      "Schedule consultations quickly before departure or after returning home.",
  },
  {
    Icon: FiMonitor,
    title: "Telehealth Access",
    description:
      "Connect securely with healthcare professionals from anywhere.",
  },
  {
    Icon: FiShield,
    title: "Insurance Support",
    description:
      "Receive assistance understanding healthcare coverage and travel-related medical concerns.",
  },
  {
    Icon: FiHeart,
    title: "Personalized Care",
    description:
      "Benefit from travel health recommendations tailored to your destination and needs.",
  },
  {
    Icon: FiGlobe,
    title: "Nationwide Provider Network",
    description:
      "Access trusted healthcare professionals and coordinated specialty care services.",
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
export default function TravelMedicine({ data = SPECIALTY_DATA }) {
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
          Global Cross-Border Care | International Telemedicine & Medical
          Support
        </title>
        <meta
          name="description"
          content="Access global healthcare support through international telemedicine services, cross-border consultations, medication refill assistance, referral coordination, and medical guidance while traveling abroad."
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
                  <a
                    href="/appointment-booking"
                    className="sp-btn sp-btn--ghost"
                  >
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
              <div
                className="sp-conditions__head"
                onClick={() => navigate("/conditions")}
                style={{ cursor: "pointer" }}
              >
                <SectionLabel>Conditions &amp; Symptoms</SectionLabel>
                <h2>What We Treat</h2>
                <p>
                  Our {data.name.toLowerCase()} specialists provide expert
                  guidance and care for a wide range of travel-related health
                  concerns.
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
                  We combine experienced travel medicine specialists with
                  advanced telemedicine technology to help travelers stay
                  healthy wherever their journey takes them.
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
                Connect with a travel medicine specialist for personalized
                travel health planning, vaccination guidance, illness prevention
                strategies, and post-travel medical support. Travel confidently
                with expert healthcare guidance before, during, and after your
                journey.
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
