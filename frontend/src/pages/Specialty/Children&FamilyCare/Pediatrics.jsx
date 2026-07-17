import { useState, useEffect, useRef } from "react";
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

import heroImage from "../../../assets/SpecialitiesImage/pediatrics-specialist-child-healthcare-banner.webp";
import overviewImage from "../../../assets/SpecialitiesImage/pediatric-specialist-child-health-checkup-consultation.webp";
import BookingCard from "../../../components/SpecialityBookingCard";
import api from "../../../api";

// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "pediatrics",
  name: "Pediatrics",
  categoryId: "family",
  tagline: "Caring for Your Child's Health from Infancy Through Adolescence.",
  heroDescription:
    "Pediatric specialists provide comprehensive healthcare for infants, children, and teenagers, focusing on growth, development, illness prevention, and treatment of common childhood conditions. From routine wellness visits and vaccinations to managing infections, feeding concerns, and skin conditions, pediatric care supports your child's healthy journey at every stage of life.",
  heroImage: heroImage,
  heroAlt:
    "Board-certified pediatric specialist providing healthcare for infants, children, and adolescents with preventive, diagnostic, and wellness care.",
  overviewImage: overviewImage,
  overviewAlt:
    "Pediatric specialist consulting with a child and parent during a routine health checkup for growth, development, and preventive care.",
  overviewDescription:
    "Pediatrics is a medical specialty dedicated to the physical, emotional, and developmental health of infants, children, and adolescents. Pediatricians diagnose, treat, and prevent a wide range of childhood illnesses while monitoring growth milestones, nutrition, behavior, and overall well-being.",
  overviewImportance:
    "Pediatric specialists provide age-appropriate medical care tailored to each child's unique needs. Through preventive screenings, early diagnosis, immunizations, and personalized treatment plans, pediatric care helps children grow into healthy adults while giving families the guidance and support they need.",
  conditionsTreated:
    "Pediatric specialists diagnose and manage common childhood illnesses and developmental concerns, including colds and flu, fever, ear infections, feeding difficulties, skin rashes, allergies, and other health conditions affecting children.",
  whenToConsult:
    "Schedule a visit with a pediatric specialist if your child experiences persistent fever, frequent infections, feeding or growth concerns, ear pain, skin changes, breathing difficulties, unusual symptoms, or requires routine checkups and preventive healthcare.",

  keyServices: [
    {
      Icon: FiActivity,
      title: "Well-Child Exams & Growth Monitoring",
      description:
        "Comprehensive pediatric checkups to track physical growth, developmental milestones, and overall health from infancy through adolescence.",
    },
    {
      Icon: FiThermometer,
      title: "Childhood Illness Diagnosis & Treatment",
      description:
        "Evaluation and treatment for common pediatric conditions, including colds, flu, infections, fever, and other acute illnesses.",
    },
    {
      Icon: MdOutlineVaccines,
      title: "Vaccinations & Preventive Care",
      description:
        "Routine immunizations, health screenings, and preventive services designed to protect children from serious illnesses.",
    },
    {
      Icon: FiDroplet,
      title: "Feeding & Nutrition Support",
      description:
        "Guidance for feeding challenges, nutrition concerns, healthy eating habits, and proper growth and development.",
    },
    {
      Icon: MdOutlineSpa,
      title: "Skin & Allergy Care",
      description:
        "Diagnosis and management of childhood skin conditions, rashes, allergic reactions, and environmental sensitivities.",
    },
    {
      Icon: FiUsers,
      title: "Parent Education & Pediatric Guidance",
      description:
        "Expert advice for parents regarding child development, safety, sleep habits, behavior, and everyday health concerns.",
    },
  ],

  benefits: [
    {
      Icon: FiSearch,
      title: "Early Detection & Intervention",
      description:
        "Identifies health concerns, developmental delays, and childhood illnesses early for timely treatment and better outcomes.",
    },
    {
      Icon: FiTrendingUp,
      title: "Healthy Growth & Development",
      description:
        "Supports children through every stage of physical, emotional, and developmental milestones.",
    },
    {
      Icon: FiShield,
      title: "Preventive Health Protection",
      description:
        "Provides vaccinations, screenings, and wellness guidance to reduce the risk of preventable illnesses.",
    },
    {
      Icon: FiHeart,
      title: "Family-Centered Care",
      description:
        "Partners with parents and caregivers to create personalized healthcare plans that support every child's unique needs.",
    },
  ],

  conditions: [
    {
      Icon: FiAlertCircle,
      name: "Ear Pain & Ear Infections",
      description:
        "Diagnosis and treatment for earaches, middle ear infections, ear pressure, and discomfort that commonly affect children.",
    },
    {
      Icon: FiDroplet,
      name: "Feeding Concerns",
      description:
        "Support for breastfeeding challenges, picky eating, poor appetite, nutritional concerns, and healthy feeding habits.",
    },
    {
      Icon: FiWind,
      name: "Pediatric Cold & Flu",
      description:
        "Treatment for cough, congestion, sore throat, viral infections, and flu symptoms to help children recover safely.",
    },
    {
      Icon: FiThermometer,
      name: "Pediatric Fever",
      description:
        "Evaluation and care for fever, infection-related symptoms, and signs requiring medical attention.",
    },
    {
      Icon: MdOutlineSpa,
      name: "Skin Rashes in Children",
      description:
        "Diagnosis and treatment for childhood rashes, eczema, allergic reactions, irritation, and common skin conditions.",
    },
    {
      Icon: FiFeather,
      name: "Allergies in Children",
      description:
        "Management of seasonal allergies, food allergies, environmental triggers, and allergy-related symptoms.",
    },
    {
      Icon: GiLungs,
      name: "Asthma & Breathing Concerns",
      description:
        "Care for wheezing, shortness of breath, chronic cough, and respiratory conditions affecting children.",
    },
    {
      Icon: FiActivity,
      name: "Childhood Infections",
      description:
        "Diagnosis and treatment of bacterial and viral infections, including throat, sinus, and other common infections.",
    },
    {
      Icon: FiTrendingUp,
      name: "Growth & Development Concerns",
      description:
        "Evaluation of delayed milestones, growth patterns, and developmental challenges.",
    },
    {
      Icon: FiClock,
      name: "Sleep Problems in Children",
      description:
        "Support for sleep difficulties, bedtime challenges, poor sleep habits, and concerns affecting a child's health.",
    },
    {
      Icon: FiBarChart2,
      name: "Digestive & Stomach Issues",
      description:
        "Care for abdominal pain, constipation, diarrhea, reflux, and other gastrointestinal concerns in children.",
    },
    {
      Icon: MdOutlineHealthAndSafety,
      name: "Preventive Pediatric Care",
      description:
        "Routine wellness visits, immunizations, health screenings, and guidance to maintain long-term childhood health.",
    },
  ],

  faqs: [
    {
      question: "What is pediatrics?",
      answer:
        "Pediatrics is the medical specialty focused on the healthcare of infants, children, and adolescents, including prevention, diagnosis, and treatment of childhood conditions.",
    },
    {
      question: "What does a pediatric specialist treat?",
      answer:
        "Pediatric specialists treat common childhood illnesses, infections, fevers, feeding concerns, skin conditions, allergies, growth concerns, and developmental issues.",
    },
    {
      question: "When should I take my child to a pediatrician?",
      answer:
        "You should seek pediatric care for fever, persistent symptoms, breathing difficulties, feeding problems, injuries, unusual behavior changes, or routine wellness visits.",
    },
    {
      question: "How often does my child need a pediatric wellness visit?",
      answer:
        "Well-child visit schedules depend on age, but regular checkups throughout childhood are essential for monitoring growth, development, and preventive care.",
    },
    {
      question: "Can pediatricians treat colds and flu?",
      answer:
        "Yes. Pediatricians diagnose and manage cold and flu symptoms, provide treatment recommendations, and monitor for complications.",
    },
    {
      question: "What should I do if my child has a fever?",
      answer:
        "Monitor symptoms and seek medical care if the fever is persistent, very high, accompanied by concerning symptoms, or your child appears seriously ill.",
    },
    {
      question: "Can pediatricians help with feeding difficulties?",
      answer:
        "Yes. Pediatric specialists evaluate feeding concerns, nutritional challenges, poor appetite, and growth-related issues.",
    },
    {
      question: "What causes ear infections in children?",
      answer:
        "Ear infections can develop from bacteria or viruses, often following colds or respiratory infections that cause fluid buildup in the middle ear.",
    },
    {
      question: "When should I worry about a skin rash on my child?",
      answer:
        "Seek medical advice if a rash is severe, spreads quickly, causes discomfort, comes with fever, or does not improve.",
    },
    {
      question: "Can pediatricians diagnose allergies?",
      answer:
        "Yes. Pediatric providers can evaluate allergy symptoms, recommend treatment options, and provide guidance on avoiding triggers.",
    },
    {
      question: "Do pediatricians provide vaccinations?",
      answer:
        "Yes. Pediatric care includes recommended childhood vaccines to help protect against preventable diseases.",
    },
    {
      question: "What developmental milestones do pediatricians monitor?",
      answer:
        "Pediatricians track physical growth, speech, movement, social skills, behavior, and age-appropriate developmental milestones.",
    },
    {
      question: "Are telehealth pediatric visits available?",
      answer:
        "Yes. Many pediatric concerns, including minor illnesses, follow-up care, and parent consultations, can be addressed through secure telehealth visits.",
    },
    {
      question: "Do I need a referral to see a pediatric specialist?",
      answer:
        "Referral requirements depend on your insurance plan and the type of pediatric specialty care needed.",
    },
    {
      question: "How can I support my child's immune health?",
      answer:
        "Healthy nutrition, adequate sleep, physical activity, vaccinations, and routine medical care all contribute to a strong immune system.",
    },
    {
      question: "What happens during a pediatric appointment?",
      answer:
        "A pediatric visit may include reviewing medical history, checking growth and development, performing an examination, discussing concerns, and creating a treatment plan.",
    },
    {
      question:
        "How can I schedule an appointment with a pediatric specialist?",
      answer:
        "You can schedule an appointment by selecting a pediatric provider online or contacting the healthcare team for assistance.",
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
      </section>

      {/* ── 3. CONDITIONS ──────────────────────────────────────────────────── */}
      <section className="sp-conditions">
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
              Give your child access to compassionate, expert pediatric care
              with convenient appointments and personalized treatment plans for
              every stage of growth and development.
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
  );
}
