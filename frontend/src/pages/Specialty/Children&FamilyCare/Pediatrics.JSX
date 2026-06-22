import { useState, useEffect, useRef } from "react";
import {
  FiActivity, FiHeart, FiShield, FiUsers, FiClock, FiGlobe,
  FiSearch, FiCalendar, FiPhone, FiMail, FiAward, FiZap,
  FiMonitor, FiDollarSign, FiCheckCircle, FiStar, FiLock,
  FiArrowRight, FiPlus, FiDroplet, FiWind, FiThermometer,
  FiAlertCircle, FiRefreshCw, FiTarget, FiTrendingUp, FiBarChart2,
  FiFeather, FiCrosshair, FiLayout, FiEye, FiTool,
  FiCpu, FiBriefcase, FiClipboard,
} from "react-icons/fi";
import {
  MdOutlineVaccines, MdOutlineBloodtype, MdOutlinePsychology,
  MdOutlineHealthAndSafety, MdOutlineSpa, MdOutlineMonitorHeart,
  MdOutlineBiotech,
} from "react-icons/md";
import {
  GiHeartOrgan, GiLungs, GiBrain, GiBoneKnife,
  GiMedicines, GiBodySwapping,
} from "react-icons/gi";
import "../SpecialtyPage.css";

// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "pediatrics",
  name: "Pediatrics",
  tagline: "Caring for Your Child's Health from Infancy Through Adolescence.",
  heroDescription:
    "Pediatric specialists provide comprehensive healthcare for infants, children, and teenagers, focusing on growth, development, illness prevention, and treatment of common childhood conditions. From routine wellness visits and vaccinations to managing infections, feeding concerns, and skin conditions, pediatric care supports your child's healthy journey at every stage of life.",
  heroImage:
    "https://images.unsplash.com/photo-1632833239869-a37e3a5806d2?auto=format&fit=crop&w=1600&q=80",
  overviewImage:
    "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=800&q=80",
  overviewDescription:
    "Pediatrics is a medical specialty dedicated to the physical, emotional, and developmental health of infants, children, and adolescents. Pediatricians diagnose, treat, and prevent a wide range of childhood illnesses while monitoring growth milestones, nutrition, behavior, and overall well-being.",
  overviewImportance:
    "Pediatric specialists provide age-appropriate medical care tailored to each child's unique needs. Through preventive screenings, early diagnosis, immunizations, and personalized treatment plans, pediatric care helps children grow into healthy adults while giving families the guidance and support they need.",
  conditionsTreated:
    "Pediatric specialists diagnose and manage common childhood illnesses and developmental concerns, including colds and flu, fever, ear infections, feeding difficulties, skin rashes, allergies, and other health conditions affecting children.",
  whenToConsult:
    "Schedule a visit with a pediatric specialist if your child experiences persistent fever, frequent infections, feeding or growth concerns, ear pain, skin changes, breathing difficulties, unusual symptoms, or requires routine checkups and preventive healthcare.",

  keyServices: [
    { Icon: FiActivity, title: "Well-Child Exams & Growth Monitoring", description: "Comprehensive pediatric checkups to track physical growth, developmental milestones, and overall health from infancy through adolescence." },
    { Icon: FiThermometer, title: "Childhood Illness Diagnosis & Treatment", description: "Evaluation and treatment for common pediatric conditions, including colds, flu, infections, fever, and other acute illnesses." },
    { Icon: MdOutlineVaccines, title: "Vaccinations & Preventive Care", description: "Routine immunizations, health screenings, and preventive services designed to protect children from serious illnesses." },
    { Icon: FiDroplet, title: "Feeding & Nutrition Support", description: "Guidance for feeding challenges, nutrition concerns, healthy eating habits, and proper growth and development." },
    { Icon: MdOutlineSpa, title: "Skin & Allergy Care", description: "Diagnosis and management of childhood skin conditions, rashes, allergic reactions, and environmental sensitivities." },
    { Icon: FiUsers, title: "Parent Education & Pediatric Guidance", description: "Expert advice for parents regarding child development, safety, sleep habits, behavior, and everyday health concerns." },
  ],

  benefits: [
    { Icon: FiSearch, title: "Early Detection & Intervention", description: "Identifies health concerns, developmental delays, and childhood illnesses early for timely treatment and better outcomes." },
    { Icon: FiTrendingUp, title: "Healthy Growth & Development", description: "Supports children through every stage of physical, emotional, and developmental milestones." },
    { Icon: FiShield, title: "Preventive Health Protection", description: "Provides vaccinations, screenings, and wellness guidance to reduce the risk of preventable illnesses." },
    { Icon: FiHeart, title: "Family-Centered Care", description: "Partners with parents and caregivers to create personalized healthcare plans that support every child's unique needs." },
  ],

  conditions: [
    { Icon: FiAlertCircle, name: "Ear Pain & Ear Infections", description: "Diagnosis and treatment for earaches, middle ear infections, ear pressure, and discomfort that commonly affect children." },
    { Icon: FiDroplet, name: "Feeding Concerns", description: "Support for breastfeeding challenges, picky eating, poor appetite, nutritional concerns, and healthy feeding habits." },
    { Icon: FiWind, name: "Pediatric Cold & Flu", description: "Treatment for cough, congestion, sore throat, viral infections, and flu symptoms to help children recover safely." },
    { Icon: FiThermometer, name: "Pediatric Fever", description: "Evaluation and care for fever, infection-related symptoms, and signs requiring medical attention." },
    { Icon: MdOutlineSpa, name: "Skin Rashes in Children", description: "Diagnosis and treatment for childhood rashes, eczema, allergic reactions, irritation, and common skin conditions." },
    { Icon: FiFeather, name: "Allergies in Children", description: "Management of seasonal allergies, food allergies, environmental triggers, and allergy-related symptoms." },
    { Icon: GiLungs, name: "Asthma & Breathing Concerns", description: "Care for wheezing, shortness of breath, chronic cough, and respiratory conditions affecting children." },
    { Icon: FiActivity, name: "Childhood Infections", description: "Diagnosis and treatment of bacterial and viral infections, including throat, sinus, and other common infections." },
    { Icon: FiTrendingUp, name: "Growth & Development Concerns", description: "Evaluation of delayed milestones, growth patterns, and developmental challenges." },
    { Icon: FiClock, name: "Sleep Problems in Children", description: "Support for sleep difficulties, bedtime challenges, poor sleep habits, and concerns affecting a child's health." },
    { Icon: FiBarChart2, name: "Digestive & Stomach Issues", description: "Care for abdominal pain, constipation, diarrhea, reflux, and other gastrointestinal concerns in children." },
    { Icon: MdOutlineHealthAndSafety, name: "Preventive Pediatric Care", description: "Routine wellness visits, immunizations, health screenings, and guidance to maintain long-term childhood health." },
  ],

  faqs: [
    {
      question: "What is pediatrics?",
      answer: "Pediatrics is the medical specialty focused on the healthcare of infants, children, and adolescents, including prevention, diagnosis, and treatment of childhood conditions.",
    },
    {
      question: "What does a pediatric specialist treat?",
      answer: "Pediatric specialists treat common childhood illnesses, infections, fevers, feeding concerns, skin conditions, allergies, growth concerns, and developmental issues.",
    },
    {
      question: "When should I take my child to a pediatrician?",
      answer: "You should seek pediatric care for fever, persistent symptoms, breathing difficulties, feeding problems, injuries, unusual behavior changes, or routine wellness visits.",
    },
    {
      question: "How often does my child need a pediatric wellness visit?",
      answer: "Well-child visit schedules depend on age, but regular checkups throughout childhood are essential for monitoring growth, development, and preventive care.",
    },
    {
      question: "Can pediatricians treat colds and flu?",
      answer: "Yes. Pediatricians diagnose and manage cold and flu symptoms, provide treatment recommendations, and monitor for complications.",
    },
    {
      question: "What should I do if my child has a fever?",
      answer: "Monitor symptoms and seek medical care if the fever is persistent, very high, accompanied by concerning symptoms, or your child appears seriously ill.",
    },
    {
      question: "Can pediatricians help with feeding difficulties?",
      answer: "Yes. Pediatric specialists evaluate feeding concerns, nutritional challenges, poor appetite, and growth-related issues.",
    },
    {
      question: "What causes ear infections in children?",
      answer: "Ear infections can develop from bacteria or viruses, often following colds or respiratory infections that cause fluid buildup in the middle ear.",
    },
    {
      question: "When should I worry about a skin rash on my child?",
      answer: "Seek medical advice if a rash is severe, spreads quickly, causes discomfort, comes with fever, or does not improve.",
    },
    {
      question: "Can pediatricians diagnose allergies?",
      answer: "Yes. Pediatric providers can evaluate allergy symptoms, recommend treatment options, and provide guidance on avoiding triggers.",
    },
    {
      question: "Do pediatricians provide vaccinations?",
      answer: "Yes. Pediatric care includes recommended childhood vaccines to help protect against preventable diseases.",
    },
    {
      question: "What developmental milestones do pediatricians monitor?",
      answer: "Pediatricians track physical growth, speech, movement, social skills, behavior, and age-appropriate developmental milestones.",
    },
    {
      question: "Are telehealth pediatric visits available?",
      answer: "Yes. Many pediatric concerns, including minor illnesses, follow-up care, and parent consultations, can be addressed through secure telehealth visits.",
    },
    {
      question: "Do I need a referral to see a pediatric specialist?",
      answer: "Referral requirements depend on your insurance plan and the type of pediatric specialty care needed.",
    },
    {
      question: "How can I support my child's immune health?",
      answer: "Healthy nutrition, adequate sleep, physical activity, vaccinations, and routine medical care all contribute to a strong immune system.",
    },
    {
      question: "What happens during a pediatric appointment?",
      answer: "A pediatric visit may include reviewing medical history, checking growth and development, performing an examination, discussing concerns, and creating a treatment plan.",
    },
    {
      question: "How can I schedule an appointment with a pediatric specialist?",
      answer: "You can schedule an appointment by selecting a pediatric provider online or contacting the healthcare team for assistance.",
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
  { Icon: FiAward, title: " Board-Certified Specialists", description: "Receive care from experienced, credentialed providers who meet high standards of medical expertise and patient care." },
  { Icon: FiZap, title: "Fast Appointments", description: "Schedule appointments quickly with convenient availability, including timely care for urgent health concerns." },
  { Icon: FiMonitor, title: "Telehealth Access", description: "Connect with healthcare providers from the comfort of your home through secure, convenient virtual visits." },
  { Icon: FiShield, title: "Insurance Support", description: "Get assistance understanding insurance coverage, benefits, authorizations, and billing questions." },
  { Icon: FiHeart, title: "Personalised Care", description: "Receive customized treatment recommendations designed around your medical history, lifestyle, health needs, and goals." },
  { Icon: FiGlobe, title: "Global Provider Network", description: "Access a broad network of healthcare specialists and coordinated care services wherever you need support." },
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
      { threshold }
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
    if (isNaN(numeric)) { setDisplayed(value); return; }
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
        const rounded = numeric < 10 ? start.toFixed(1) : Math.floor(start).toString();
        setDisplayed(rounded + suffix);
      }
    }, step);
    return () => clearInterval(timer);
  }, [visible, value]);

  return (
    <div ref={ref} className={`sp-stat-card${visible ? " sp-stat-card--visible" : ""}`}>
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
        <span className={`sp-faq-item__icon${open ? " sp-faq-item__icon--open" : ""}`}>
          <FiPlus size={15} />
        </span>
      </button>
      <div className={`sp-faq-item__body${open ? " sp-faq-item__body--open" : ""}`}>
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
        <button className="sp-condition-card__link" aria-label={`Learn more about ${name}`}>
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

  return (
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
          <div className={`sp-hero__content-inner${heroLoaded ? " sp-hero__content-inner--loaded" : ""}`}>
            <span className="sp-hero__badge">HumanCare Connect</span>
            <h1 className="sp-hero__title">{data.name}</h1>
            <p className="sp-hero__tagline">{data.tagline}</p>
            <p className="sp-hero__description">{data.heroDescription}</p>

            <div className="sp-hero__actions">
              <a href={`/specialties/${data.slug}/doctors`} className="sp-btn sp-btn--primary">
                <FiSearch size={17} />
                Find Specialists
              </a>
              <a href={`/specialties/${data.slug}/book`} className="sp-btn sp-btn--ghost">
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
                    <p className="sp-overview__badge-title">Board-Certified</p>
                    <p className="sp-overview__badge-sub">{data.name} Specialists</p>
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
                Our {data.name.toLowerCase()} specialists are experienced in diagnosing and treating a wide
                range of conditions across all age groups.
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
            We combine experienced medical professionals with advanced technology to make accessing quality healthcare simpler, faster, and more personalized.
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
              <p>Everything you need to know about {data.name.toLowerCase()} at HumanCare Connect.</p>
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
              Ready to Connect with a{" "}
              <span>{data.name}</span>{" "}
              Specialist?
            </h2>
            <p className="sp-cta__sub">
              Give your child access to compassionate, expert pediatric care with convenient
              appointments and personalized treatment plans for every stage of growth and development.
            </p>
          </Reveal>

          <Reveal delay={80}>
            <div className="sp-cta__actions">
              <a href={`/specialties/${data.slug}/doctors`} className="sp-btn sp-btn--primary-lg">
                <FiSearch size={18} />
                Find a Doctor
              </a>
              <a href={`/specialties/${data.slug}/book`} className="sp-btn sp-btn--ghost-lg">
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

// ─────────────────────────────────────────────────────────────────────────────
// ADDITIONAL SPECIALTY DATA EXAMPLES
// ─────────────────────────────────────────────────────────────────────────────

export const CARDIOLOGY_DATA = {
  slug: "cardiology",
  name: "Cardiology",
  tagline: "Expert heart care, from prevention to advanced intervention.",
  heroDescription:
    "Our board-certified cardiologists provide comprehensive cardiac care — from lipid management and ECG interpretation to interventional procedures and heart failure management. Your heart health is our priority.",
  heroImage: "https://images.unsplash.com/photo-1628348068343-c6a848d2b6dd?auto=format&fit=crop&w=1600&q=80",
  overviewImage: "https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80",
  overviewDescription:
    "Cardiology is the branch of medicine concerned with the diagnosis and treatment of diseases of the heart and blood vessels. Cardiologists specialise in managing conditions ranging from coronary artery disease and heart failure to arrhythmias and congenital heart defects.",
  overviewImportance:
    "Cardiovascular disease remains the leading cause of mortality globally. Early detection, lifestyle modification, and timely intervention can significantly reduce the risk of heart attacks, strokes, and other cardiac events.",
  conditionsTreated:
    "Cardiologists treat coronary artery disease, heart failure, arrhythmias, valvular heart disease, hypertension, high cholesterol, pericarditis, and congenital heart defects.",
  whenToConsult:
    "Seek a cardiologist if you experience chest pain, shortness of breath, palpitations, fainting, leg swelling, or if you have risk factors like diabetes, hypertension, or a family history of heart disease.",
  keyServices: [
    { Icon: FiActivity, title: "ECG & Holter Monitoring", description: "Detect arrhythmias and electrical abnormalities with advanced cardiac monitoring." },
    { Icon: MdOutlineMonitorHeart, title: "Echocardiography", description: "Ultrasound imaging of heart structure and function." },
    { Icon: FiTrendingUp, title: "Stress Testing", description: "Exercise treadmill and pharmacological stress tests to assess cardiac fitness." },
    { Icon: GiMedicines, title: "Lipid Management", description: "Cholesterol control through diet, lifestyle, and medication." },
    { Icon: FiRefreshCw, title: "Cardiac Rehabilitation", description: "Structured programmes to strengthen the heart after a cardiac event." },
    { Icon: FiZap, title: "Pacemaker Management", description: "Implantation, programming, and monitoring of pacemakers and ICDs." },
  ],
  benefits: [
    { Icon: FiSearch, title: "Early Risk Detection", description: "Identify silent cardiac risks before a major event." },
    { Icon: GiMedicines, title: "Medication Management", description: "Precision prescribing to optimise your cardiac medications." },
    { Icon: FiBriefcase, title: "Procedural Expertise", description: "Advanced interventions by experienced interventional cardiologists." },
    { Icon: FiBarChart2, title: "Ongoing Monitoring", description: "Long-term cardiac surveillance with remote monitoring options." },
  ],
  conditions: [
    { Icon: GiHeartOrgan, name: "Coronary Artery Disease", description: "Diagnosis and management of plaque-narrowed coronary arteries to prevent heart attacks." },
    { Icon: FiHeart, name: "Heart Failure", description: "Comprehensive management of reduced and preserved ejection fraction heart failure." },
    { Icon: FiZap, name: "Arrhythmias", description: "AF, SVT, VT, and bradyarrhythmias diagnosed and treated with medication or ablation." },
    { Icon: MdOutlineBloodtype, name: "Hypertension", description: "Resistant and secondary hypertension evaluation and treatment." },
    { Icon: FiTrendingUp, name: "High Cholesterol", description: "Dyslipidaemia management including statin therapy and lifestyle modification." },
    { Icon: FiTarget, name: "Valvular Disease", description: "Aortic stenosis, mitral regurgitation, and other valve conditions monitored and managed." },
    { Icon: GiLungs, name: "Pulmonary Hypertension", description: "Specialist evaluation and targeted therapy for elevated pulmonary arterial pressure." },
    { Icon: FiShield, name: "Pericarditis", description: "Inflammation of the pericardium: acute, recurrent, and constrictive forms treated." },
  ],
  faqs: [
    { question: "When should I see a cardiologist?", answer: "See a cardiologist if you have chest pain, palpitations, shortness of breath, dizziness, or known cardiac risk factors such as hypertension, diabetes, or a family history of early heart disease." },
    { question: "What does a cardiologist do on a first visit?", answer: "Your first cardiology visit typically includes a detailed history, physical examination, ECG, and sometimes an echocardiogram or blood tests. The cardiologist will discuss your risk factors and create an initial management plan." },
    { question: "Is cardiology only for older adults?", answer: "No. Heart conditions can affect people of all ages, including children (congenital defects) and young adults (arrhythmias, cardiomyopathy). If you have symptoms, age is not a barrier to seeing a cardiologist." },
    { question: "Can I see a cardiologist via telehealth?", answer: "Yes. Follow-up consultations, medication reviews, and risk factor management can be handled via telehealth. Initial diagnostic visits may require in-person tests, which your cardiologist will organise." },
    { question: "What lifestyle changes reduce heart disease risk?", answer: "A heart-healthy diet low in saturated fats and sodium, regular aerobic exercise (150 minutes/week), not smoking, moderate alcohol intake, maintaining a healthy weight, and managing stress are all evidence-based strategies." },
  ],
};

export const DERMATOLOGY_DATA = {
  slug: "dermatology",
  name: "Dermatology",
  tagline: "Healthy, radiant skin backed by expert medical care.",
  heroDescription:
    "Our board-certified dermatologists address everything from acne and eczema to skin cancer detection and cosmetic concerns. Evidence-based treatments tailored to your skin type, tone, and health goals.",
  heroImage: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=1600&q=80",
  overviewImage: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=800&q=80",
  overviewDescription:
    "Dermatology is the medical specialty focused on the diagnosis and treatment of conditions affecting the skin, hair, and nails. The skin is the body's largest organ and a window into overall health — changes can signal systemic diseases, infections, or malignancies.",
  overviewImportance:
    "Skin conditions affect over 1.9 billion people globally. Early detection of skin cancer dramatically improves survival rates. Effective management of chronic conditions like psoriasis and eczema significantly improves quality of life.",
  conditionsTreated:
    "Dermatologists treat acne, eczema, psoriasis, rosacea, fungal infections, warts, hair loss, skin cancer, vitiligo, and cosmetic skin concerns.",
  whenToConsult:
    "Visit a dermatologist for persistent skin rashes, unusual moles, hair loss, nail changes, chronic itching, suspected skin infections, or when over-the-counter treatments are not working.",
  keyServices: [
    { Icon: FiEye, title: "Skin Cancer Screening", description: "Full-body mole mapping and dermoscopy to detect melanoma and other skin cancers early." },
    { Icon: MdOutlineSpa, title: "Acne Treatment", description: "Medical-grade treatments including topical retinoids, antibiotics, and isotretinoin." },
    { Icon: FiFeather, title: "Eczema & Psoriasis", description: "Personalised care plans including biologics, phototherapy, and topical therapies." },
    { Icon: FiTool, title: "Minor Surgical Procedures", description: "Cyst removal, biopsy, and lesion excision performed in-office." },
    { Icon: GiBodySwapping, title: "Hair & Scalp Treatment", description: "Diagnosis and management of alopecia, dandruff, and scalp conditions." },
    { Icon: FiStar, title: "Cosmetic Dermatology", description: "Chemical peels, PRP, and evidence-based cosmetic treatments." },
  ],
  benefits: [
    { Icon: FiShield, title: "Cancer Prevention", description: "Early detection saves lives. Annual screenings recommended for high-risk individuals." },
    { Icon: FiHeart, title: "Improved Confidence", description: "Effective treatment of visible skin conditions improves mental wellbeing." },
    { Icon: FiSearch, title: "Accurate Diagnosis", description: "Dermoscopy and biopsy ensure correct diagnosis and targeted treatment." },
    { Icon: FiClipboard, title: "Long-Term Management", description: "Chronic condition care plans that evolve with your skin over time." },
  ],
  conditions: [
    { Icon: FiAlertCircle, name: "Acne", description: "From mild comedonal acne to severe nodular cystic acne — treated effectively at every grade." },
    { Icon: FiDroplet, name: "Eczema (Atopic Dermatitis)", description: "Chronic dry, itchy, inflamed skin managed with moisturisers, steroids, and biologics." },
    { Icon: FiActivity, name: "Psoriasis", description: "Autoimmune plaques on skin and scalp managed with topical, systemic, and biologic therapies." },
    { Icon: FiStar, name: "Rosacea", description: "Facial redness, flushing, and papules treated with topical agents and laser therapy." },
    { Icon: FiCrosshair, name: "Fungal Infections", description: "Tinea, athlete's foot, ringworm, and onychomycosis diagnosed and treated." },
    { Icon: FiEye, name: "Skin Cancer", description: "Basal cell, squamous cell, and melanoma detected early and managed by our oncology team." },
    { Icon: FiLayout, name: "Vitiligo", description: "Loss of skin pigmentation treated with phototherapy, topical calcineurin inhibitors, and JAK inhibitors." },
    { Icon: GiBodySwapping, name: "Hair Loss (Alopecia)", description: "Androgenetic alopecia, alopecia areata, and telogen effluvium diagnosed and treated." },
  ],
  faqs: [
    { question: "How often should I have a full skin check?", answer: "Adults should have an annual full-body skin exam, especially if you have fair skin, a history of sunburns, a family history of skin cancer, or many moles. Those with prior skin cancer need more frequent checks." },
    { question: "Can dermatology visits be done via telehealth?", answer: "Many dermatology concerns can be assessed via video or photo submission, including acne, rashes, and follow-up care. Biopsies and surgical procedures require an in-person visit." },
    { question: "What is the difference between a dermatologist and an aesthetician?", answer: "A dermatologist is a medical doctor with 6+ years of specialised training who can diagnose and treat skin diseases, prescribe medications, and perform surgery. An aesthetician provides non-medical cosmetic treatments." },
    { question: "How do I know if a mole is dangerous?", answer: "Use the ABCDE rule: Asymmetry, Border irregularity, Colour variation, Diameter >6mm, and Evolving. If a mole shows any of these signs, see a dermatologist promptly." },
    { question: "What treatments are available for acne scarring?", answer: "Options include chemical peels, microneedling, fractional laser resurfacing, dermal fillers for ice-pick scars, and PRP therapy. Your dermatologist will recommend the best combination based on your scar type and skin tone." },
  ],
};