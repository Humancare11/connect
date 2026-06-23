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

// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "orthopedics",
  name: "Orthopedics",
  tagline: "Expert Care for Bones, Joints, Muscles, and Mobility.",
  heroDescription:
    "Orthopedic specialists diagnose and treat conditions affecting the bones, joints, muscles, ligaments, tendons, and spine. From arthritis and back pain to knee injuries and muscle strains, orthopedic care focuses on reducing pain, restoring mobility, improving function, and helping patients maintain an active lifestyle.",
  heroImage:
    "https://images.unsplash.com/photo-1632833239869-a37e3a5806d2?auto=format&fit=crop&w=1600&q=80",
  overviewImage:
    "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=800&q=80",
  overviewDescription:
    "Orthopedics is a medical specialty focused on the prevention, diagnosis, treatment, and rehabilitation of conditions affecting the musculoskeletal system. Orthopedic specialists care for injuries, chronic pain conditions, joint disorders, arthritis, and mobility-related concerns that impact daily activities and overall quality of life.",
  overviewImportance:
    "Through comprehensive evaluations, personalized treatment plans, rehabilitation guidance, and ongoing care, orthopedic specialists help patients improve movement, reduce discomfort, and achieve long-term musculoskeletal health.",
  conditionsTreated:
    "Orthopedic specialists diagnose and manage arthritis, osteoarthritis, back pain, knee pain, neck pain, muscle strains, joint injuries, and other conditions affecting bones, muscles, and joints.",
  whenToConsult:
    "Schedule a visit with an orthopedic specialist if you experience persistent joint pain, stiffness, swelling, limited mobility, back pain, neck pain, sports injuries, muscle strains, or musculoskeletal discomfort that affects your daily activities.",

  keyServices: [
    {
      Icon: FiActivity,
      title: "Joint Pain Evaluation & Treatment",
      description:
        "Comprehensive assessments and treatment plans for joint pain, stiffness, inflammation, and mobility concerns.",
    },
    {
      Icon: FiThermometer,
      title: "Spine & Back Pain Management",
      description:
        "Diagnosis and care for back pain, neck pain, spinal conditions, and musculoskeletal discomfort.",
    },
    {
      Icon: MdOutlineVaccines,
      title: "Arthritis & Osteoarthritis Care",
      description:
        "Long-term management strategies to reduce pain, improve joint function, and maintain mobility.",
    },
    {
      Icon: FiDroplet,
      title: "Sports & Muscle Injury Treatment",
      description:
        "Evaluation and treatment of muscle strains, soft tissue injuries, and activity-related orthopedic conditions.",
    },
    {
      Icon: MdOutlineSpa,
      title: "Mobility & Rehabilitation Support",
      description:
        "Personalized recommendations to improve movement, flexibility, strength, and overall physical function.",
    },
    {
      Icon: FiUsers,
      title: "Preventive Orthopedic Care",
      description:
        "Ongoing monitoring and lifestyle guidance to help prevent future injuries and joint complications.",
    },
  ],

  benefits: [
    {
      Icon: FiSearch,
      title: "Reduced Pain & Discomfort",
      description:
        "Helps manage chronic and acute musculoskeletal pain through personalized treatment plans.",
    },
    {
      Icon: FiTrendingUp,
      title: "Improved Mobility & Function",
      description:
        "Supports healthy movement and restores physical function for daily activities.",
    },
    {
      Icon: FiShield,
      title: "Faster Recovery from Injuries",
      description:
        "Provides targeted treatment strategies to promote healing and rehabilitation.",
    },
    {
      Icon: FiHeart,
      title: "Long-Term Joint & Bone Health",
      description:
        "Helps protect bones, joints, and muscles from future complications and degeneration.",
    },
  ],

  conditions: [
    {
      Icon: FiActivity,
      name: "Arthritis",
      description:
        "Management of joint pain, stiffness, inflammation, swelling, and reduced mobility caused by arthritis.",
    },
    {
      Icon: FiTrendingUp,
      name: "Back Pain",
      description:
        "Diagnosis and treatment of lower back pain, upper back pain, spinal discomfort, and movement-related pain.",
    },
    {
      Icon: FiShield,
      name: "Knee Pain",
      description:
        "Evaluation and care for knee injuries, arthritis-related knee pain, ligament concerns, and mobility issues.",
    },
    {
      Icon: FiZap,
      name: "Muscle Strain",
      description:
        "Treatment for muscle injuries, overuse conditions, muscle tightness, and soft tissue damage.",
    },
    {
      Icon: FiCompass,
      name: "Neck Pain",
      description:
        "Management of neck stiffness, pain, muscle tension, posture-related issues, and cervical spine conditions.",
    },
    {
      Icon: FiLayers,
      name: "Osteoarthritis",
      description:
        "Comprehensive care for joint degeneration, cartilage wear, chronic pain, and stiffness.",
    },
    {
      Icon: FiAlertCircle,
      name: "Joint Injuries",
      description:
        "Assessment and treatment of sprains, ligament injuries, and joint-related trauma.",
    },
    {
      Icon: FiTool,
      name: "Tendon Disorders",
      description:
        "Care for tendon inflammation, tendon injuries, repetitive strain conditions, and overuse injuries.",
    },
    {
      Icon: FiHeart,
      name: "Shoulder Pain",
      description:
        "Diagnosis and management of shoulder discomfort, reduced mobility, and musculoskeletal injuries.",
    },
    {
      Icon: FiMove,
      name: "Hip Pain",
      description:
        "Evaluation of hip joint pain, stiffness, arthritis, and mobility limitations.",
    },
    {
      Icon: FiTarget,
      name: "Sports Injuries",
      description:
        "Treatment for athletic injuries affecting muscles, joints, ligaments, tendons, and bones.",
    },
    {
      Icon: FiUsers,
      name: "Mobility & Movement Disorders",
      description:
        "Assessment of movement limitations, flexibility concerns, balance issues, and functional impairments.",
    },
  ],

  faqs: [
    {
      question: "What is orthopedics?",
      answer:
        "Orthopedics is the medical specialty focused on diagnosing and treating conditions affecting bones, joints, muscles, ligaments, tendons, and the spine.",
    },
    {
      question: "What conditions do orthopedic specialists treat?",
      answer:
        "Orthopedic specialists treat arthritis, osteoarthritis, back pain, neck pain, knee pain, sports injuries, muscle strains, and joint disorders.",
    },
    {
      question: "When should I see an orthopedic specialist?",
      answer:
        "You should seek orthopedic care if you experience persistent joint pain, stiffness, swelling, reduced mobility, or musculoskeletal injuries.",
    },
    {
      question: "What is arthritis?",
      answer:
        "Arthritis is a condition that causes joint inflammation, pain, stiffness, and reduced movement.",
    },
    {
      question: "What is osteoarthritis?",
      answer:
        "Osteoarthritis is a degenerative joint condition that occurs when protective cartilage gradually wears down over time.",
    },
    {
      question: "What causes back pain?",
      answer:
        "Back pain may result from muscle strain, poor posture, spinal conditions, arthritis, injuries, or repetitive movements.",
    },
    {
      question: "What causes knee pain?",
      answer:
        "Knee pain can be caused by arthritis, ligament injuries, tendon problems, cartilage damage, overuse, or trauma.",
    },
    {
      question: "What is a muscle strain?",
      answer:
        "A muscle strain occurs when muscle fibers are overstretched or torn due to overuse, improper movement, or injury.",
    },
    {
      question: "When should neck pain be evaluated?",
      answer:
        "Neck pain should be evaluated if it persists, worsens, limits movement, or is associated with numbness, weakness, or neurological symptoms.",
    },
    {
      question: "Can orthopedic specialists help with sports injuries?",
      answer:
        "Yes. Orthopedic specialists diagnose and treat injuries affecting muscles, joints, ligaments, tendons, and bones related to sports and physical activity.",
    },
    {
      question: "What treatments are commonly used in orthopedics?",
      answer:
        "Treatment may include physical therapy, medications, activity modification, rehabilitation, injections, and preventive care strategies.",
    },
    {
      question: "Can arthritis be cured?",
      answer:
        "While most forms of arthritis cannot be cured, symptoms can often be effectively managed to improve quality of life and mobility.",
    },
    {
      question: "Are telehealth orthopedic appointments available?",
      answer:
        "Yes. Many consultations, follow-up visits, treatment discussions, and rehabilitation guidance can be provided through telehealth.",
    },
    {
      question: "How can I improve joint health?",
      answer:
        "Regular exercise, maintaining a healthy weight, proper posture, stretching, and following medical recommendations can support joint health.",
    },
    {
      question: "What are common signs of joint problems?",
      answer:
        "Symptoms may include pain, swelling, stiffness, reduced mobility, weakness, instability, and difficulty performing daily activities.",
    },
    {
      question: "Can orthopedic conditions affect mobility?",
      answer:
        "Yes. Many musculoskeletal conditions can impact movement, balance, flexibility, strength, and overall physical function.",
    },
    {
      question: "How can I prevent orthopedic injuries?",
      answer:
        "Proper warm-ups, strength training, safe exercise techniques, good posture, and injury prevention strategies can reduce risk.",
    },
    {
      question:
        "How can I schedule an appointment with an orthopedic specialist?",
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
      "Receive care from experienced orthopedic providers dedicated to evidence-based musculoskeletal treatment.",
  },
  {
    Icon: FiZap,
    title: "Fast Appointments",
    description:
      "Schedule orthopedic consultations quickly with convenient appointment availability.",
  },
  {
    Icon: FiMonitor,
    title: "Telehealth Access",
    description:
      "Connect securely with orthopedic specialists through virtual consultations and follow-up visits.",
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
      "Benefit from individualized treatment plans tailored to your symptoms, activity level, and health goals.",
  },
  {
    Icon: FiGlobe,
    title: "Global Provider Network",
    description:
      "Access a broad network of orthopedic specialists and coordinated healthcare services.",
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
export default function Orthopedics({ data = SPECIALTY_DATA }) {
  const [heroLoaded, setHeroLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <HelmetProvider>
        <title>
          Ophthalmology Specialists | Eye Care & Vision Health Services
        </title>
        <meta
          name="description"
          content="Get expert ophthalmology care for dry eyes, eye irritation, eye redness, vision changes, styes, eye strain, and comprehensive vision health support."
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
                  Our {data.name.toLowerCase()} specialists diagnose and manage
                  a wide range of eye and vision conditions to help protect your
                  sight and improve overall eye health.
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
                  We combine experienced orthopedic specialists with advanced
                  technology to make musculoskeletal care more accessible,
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
                Take the next step toward better mobility, reduced pain, and
                improved musculoskeletal health. Schedule an in-person or
                virtual visit with an orthopedic specialist today and receive
                personalized care designed to keep you moving.
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
