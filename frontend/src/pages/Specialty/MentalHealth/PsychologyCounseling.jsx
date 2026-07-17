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

import heroImage from "../../../assets/SpecialitiesImage/psychology-counseling-mental-health-support-therapy.webp";
import overviewImage from "../../../assets/SpecialitiesImage/psychology-counseling-session-emotional-wellness.webp";
// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "psychology-counseling",
  name: "Psychology Counseling",
  tagline: "Compassionate Support for Life's Emotional Challenges.",
  heroDescription:
    "Psychology counseling provides a safe, supportive space to explore thoughts, emotions, behaviors, and life experiences. Whether you're facing stress, grief, relationship difficulties, trauma, or self-esteem concerns, counseling can help you develop healthier coping strategies, improve emotional well-being, and build resilience for everyday life. Through personalized counseling and evidence-based therapeutic approaches, psychology specialists help individuals navigate challenges, strengthen emotional health, and achieve personal growth.",
  heroImage: heroImage,
  heroAlt:
    "Licensed psychology counselor providing mental health support, therapy, stress management, and emotional wellness counseling",
  overviewImage: overviewImage,
  overviewAlt:
    "Psychology counseling session helping patients with emotional wellness, stress management, trauma support, and personal growth",
  overviewDescription:
    "Psychology counseling focuses on helping individuals understand and manage emotional, behavioral, and interpersonal challenges. Licensed counselors and psychologists provide professional support for life transitions, stress, grief, relationships, trauma, self-esteem concerns, and emotional well-being.",
  overviewImportance:
    "Counseling is not only for mental health conditions. Many people seek counseling to improve coping skills, strengthen relationships, build confidence, process difficult experiences, and develop healthier ways of managing life's challenges.",
  conditionsTreated:
    "Psychology counselors help individuals manage grief and loss, low self-esteem, relationship stress, trauma, emotional distress, stress management concerns, and personal growth challenges.",
  whenToConsult:
    "Consider counseling if you're experiencing emotional difficulties, relationship challenges, overwhelming stress, low confidence, grief, trauma, or life changes that are affecting your daily well-being.",

  keyServices: [
    {
      Icon: FiActivity,
      title: "Individual Counseling",
      description:
        "One-on-one sessions focused on emotional wellness, self-discovery, and personal growth.",
    },
    {
      Icon: FiThermometer,
      title: "Stress Management Counseling",
      description:
        "Support for managing everyday stress, burnout, and overwhelming life demands.",
    },
    {
      Icon: MdOutlineVaccines,
      title: "Relationship Counseling Support",
      description:
        "Guidance for communication challenges, interpersonal conflicts, and relationship concerns.",
    },
    {
      Icon: FiDroplet,
      title: "Trauma-Informed Care",
      description:
        "Compassionate support for processing difficult experiences and emotional healing.",
    },
    {
      Icon: MdOutlineSpa,
      title: "Self-Esteem & Confidence Building",
      description:
        "Strategies to improve self-worth, confidence, resilience, and emotional well-being.",
    },
    {
      Icon: FiUsers,
      title: "Life Transition Counseling",
      description:
        "Support for navigating major life changes, career shifts, family changes, and personal challenges.",
    },
  ],

  benefits: [
    {
      Icon: FiSearch,
      title: "Improved Emotional Health",
      description:
        "Develop healthier ways to manage emotions and life's challenges.",
    },
    {
      Icon: FiTrendingUp,
      title: "Stronger Relationships",
      description:
        "Improve communication, emotional awareness, and interpersonal connections.",
    },
    {
      Icon: FiShield,
      title: "Better Stress Management",
      description:
        "Learn practical coping strategies for stress and emotional resilience.",
    },
    {
      Icon: FiHeart,
      title: "Personal Growth & Self-Confidence",
      description:
        "Build self-awareness, confidence, and skills for long-term well-being.",
    },
  ],

  conditions: [
    {
      Icon: FiHeart,
      name: "Grief and Loss",
      description:
        "Support for coping with the emotional impact of losing a loved one, major life changes, or significant personal losses.",
    },
    {
      Icon: FiTrendingUp,
      name: "Low Self-Esteem",
      description:
        "Guidance to improve self-confidence, self-worth, self-acceptance, and emotional resilience.",
    },
    {
      Icon: FiUsers,
      name: "Relationship Stress",
      description:
        "Support for communication challenges, relationship conflicts, emotional disconnection, and interpersonal difficulties.",
    },
    {
      Icon: FiZap,
      name: "Stress",
      description:
        "Strategies for managing daily stress, work-related pressures, emotional overwhelm, and burnout.",
    },
    {
      Icon: FiShield,
      name: "Trauma Support",
      description:
        "Compassionate counseling for individuals processing difficult, distressing, or traumatic experiences.",
    },
    {
      Icon: FiCompass,
      name: "Life Transitions",
      description:
        "Guidance through major life events such as career changes, relocation, divorce, or family transitions.",
    },
    {
      Icon: FiActivity,
      name: "Emotional Regulation Challenges",
      description:
        "Support for understanding and managing strong emotions in healthy ways.",
    },
    {
      Icon: FiTarget,
      name: "Confidence & Self-Worth Issues",
      description:
        "Counseling focused on building self-belief, self-respect, and positive self-image.",
    },
    {
      Icon: FiBriefcase,
      name: "Workplace Stress & Burnout",
      description:
        "Support for professional stress, emotional exhaustion, and work-life balance concerns.",
    },
    {
      Icon: FiHome,
      name: "Family Relationship Challenges",
      description:
        "Guidance for navigating family dynamics, conflicts, and communication difficulties.",
    },
    {
      Icon: FiSearch,
      name: "Personal Growth & Self-Discovery",
      description:
        "Counseling designed to help individuals gain clarity, purpose, and emotional insight.",
    },
    {
      Icon: FiLayers,
      name: "Coping Skills Development",
      description:
        "Practical strategies to improve resilience, adaptability, and emotional well-being.",
    },
  ],

  faqs: [
    {
      question: "What is psychology counseling?",
      answer:
        "Psychology counseling is a professional service that helps individuals manage emotional, behavioral, and life-related challenges.",
    },
    {
      question: "What issues can counseling help with?",
      answer:
        "Counseling can help with stress, grief, relationship concerns, trauma, self-esteem issues, life transitions, and emotional wellness.",
    },
    {
      question: "Do I need a mental health diagnosis to see a counselor?",
      answer:
        "No. Many people seek counseling for personal growth, stress management, and life challenges without having a mental health diagnosis.",
    },
    {
      question: "What is grief counseling?",
      answer:
        "Grief counseling helps individuals process loss, cope with emotions, and adapt to life after significant changes or bereavement.",
    },
    {
      question: "Can counseling improve self-esteem?",
      answer:
        "Yes. Counseling can help identify negative thought patterns and develop healthier self-confidence and self-worth.",
    },
    {
      question: "How can counseling help with stress?",
      answer:
        "Counselors provide coping strategies, emotional support, and practical tools to manage stress effectively.",
    },
    {
      question: "What is trauma-informed counseling?",
      answer:
        "Trauma-informed counseling provides compassionate care that recognizes and addresses the impact of difficult experiences.",
    },
    {
      question: "Can counseling help relationship problems?",
      answer:
        "Yes. Counseling can improve communication, conflict resolution, emotional understanding, and relationship dynamics.",
    },
    {
      question: "Is counseling confidential?",
      answer:
        "Yes. Counseling sessions follow strict privacy and confidentiality standards.",
    },
    {
      question: "How long does counseling take?",
      answer:
        "The length of counseling varies depending on individual goals, concerns, and progress.",
    },
    {
      question: "Can counseling help with life transitions?",
      answer:
        "Yes. Counselors often help individuals navigate major personal, professional, and family life changes.",
    },
    {
      question: "What happens during the first counseling session?",
      answer:
        "The counselor will discuss your concerns, goals, personal history, and determine the best approach for support.",
    },
    {
      question: "Can counseling help with workplace stress?",
      answer:
        "Yes. Counseling can provide strategies for managing stress, burnout, workplace challenges, and work-life balance.",
    },
    {
      question: "Is telehealth counseling effective?",
      answer:
        "Many individuals find virtual counseling convenient, effective, and comfortable for ongoing support.",
    },
    {
      question: "Can counseling help build confidence?",
      answer:
        "Yes. Counselors help individuals develop self-awareness, challenge negative beliefs, and improve confidence.",
    },
    {
      question: "What are healthy coping skills?",
      answer:
        "Healthy coping skills include stress management techniques, emotional regulation strategies, mindfulness, and problem-solving approaches.",
    },
    {
      question: "How often should I attend counseling sessions?",
      answer:
        "Session frequency depends on your goals, concerns, and recommendations from your counselor.",
    },
    {
      question:
        "How can I schedule an appointment with a psychology counselor?",
      answer:
        "You can book an appointment online and connect with a licensed psychology counselor through virtual or in-person care options.",
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
    title: "Licensed Mental Health Professionals",
    description:
      "Receive care from experienced counselors trained in emotional wellness and personal growth.",
  },
  {
    Icon: FiZap,
    title: "Fast Appointments",
    description:
      "Schedule counseling sessions quickly with flexible appointment options.",
  },
  {
    Icon: FiMonitor,
    title: "Telehealth Access",
    description:
      "Connect securely with counselors from the comfort and privacy of your home.",
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
      "Benefit from counseling plans tailored to your personal experiences, goals, and challenges.",
  },
  {
    Icon: FiGlobe,
    title: "Nationwide Provider Network",
    description:
      "Access trusted mental health professionals and coordinated support services.",
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
export default function PsychologyCounseling({ data = SPECIALTY_DATA }) {
  const [heroLoaded, setHeroLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <HelmetProvider>
        <title>
          Psychology Counseling Services | Stress, Trauma, Relationships &
          Emotional Support
        </title>
        <meta
          name="description"
          content="Connect with licensed psychology counselors for stress, grief and loss, trauma support, relationship challenges, self-esteem concerns, and emotional wellness counseling."
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
              <span className="sp-hero__badge">Mental Health</span>
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
                  Our {data.name.toLowerCase()} provide support for a wide range
                  of emotional, behavioral, and life-related challenges.
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
                  We combine experienced psychology counselors with advanced
                  technology to make emotional wellness support more accessible,
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
              <span className="sp-cta__eyebrow">Get Started Today</span>
              <h2 className="sp-cta__heading">
                Ready to Connect with a <span>{data.name}</span> Specialist?
              </h2>
              <p className="sp-cta__sub">
                Take the next step toward emotional wellness, personal growth,
                and healthier coping strategies. Schedule a counseling session
                and receive compassionate support designed around your unique
                needs and goals.
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
