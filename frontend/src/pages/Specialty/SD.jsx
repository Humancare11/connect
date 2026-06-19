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

// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
  slug: "primary-care",
  name: "Primary Care",
  tagline: "Your first step toward better health and preventive care.",
  heroDescription:
    "Primary care physicians are your partners in health — from routine check-ups and vaccinations to managing chronic conditions and coordinating specialist referrals. They know you, your history, and your goals.",
  heroImage:
    "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1600&q=80",
  overviewImage:
    "https://images.unsplash.com/photo-1551190822-a9333d879b1f?auto=format&fit=crop&w=800&q=80",
  overviewDescription:
    "Primary Care is the cornerstone of a healthy life. Your primary care physician (PCP) serves as your main healthcare provider for general health concerns, preventive care, and the management of ongoing conditions. They build long-term relationships with patients, providing continuity of care across all stages of life — from childhood through senior years.",
  overviewImportance:
    "Regular primary care reduces hospitalisation rates, improves chronic disease management, and catches issues before they escalate. Studies consistently show that communities with strong primary care access have better health outcomes and lower overall healthcare costs.",
  conditionsTreated:
    "Primary care physicians diagnose and treat a broad range of acute illnesses, manage long-term chronic conditions, and coordinate your care with specialists when needed.",
  whenToConsult:
    "Visit your primary care doctor for annual wellness exams, any new or worsening symptoms, chronic disease management, vaccinations, mental health concerns, and before seeing a specialist.",

  keyServices: [
    { Icon: FiActivity, title: "Annual Wellness Exams", description: "Comprehensive check-ups to track your health and catch issues early." },
    { Icon: GiMedicines, title: "Chronic Disease Management", description: "Ongoing care plans for diabetes, hypertension, asthma, and more." },
    { Icon: MdOutlineBiotech, title: "Preventive Screenings", description: "Lab work, cancer screenings, and health risk assessments." },
    { Icon: MdOutlineVaccines, title: "Vaccinations", description: "Flu shots, travel vaccines, and age-appropriate immunisations." },
    { Icon: MdOutlinePsychology, title: "Mental Health Support", description: "Initial assessment, counselling referrals, and medication management." },
    { Icon: FiClipboard, title: "Specialist Coordination", description: "Referrals and seamless communication with your care team." },
  ],

  benefits: [
    { Icon: FiSearch, title: "Early Detection", description: "Routine screenings identify risks before symptoms appear." },
    { Icon: FiUsers, title: "Continuity of Care", description: "A doctor who knows your full medical history." },
    { Icon: FiDollarSign, title: "Cost-Effective", description: "Prevention is far less expensive than emergency treatment." },
    { Icon: FiGlobe, title: "Whole-Person Approach", description: "Physical, mental, and social health addressed together." },
  ],

  conditions: [
    { Icon: GiHeartOrgan, name: "Hypertension", description: "High blood pressure management through lifestyle guidance, monitoring, and medication when needed." },
    { Icon: MdOutlineBloodtype, name: "Type 2 Diabetes", description: "Blood sugar control, dietary planning, insulin management, and complication prevention." },
    { Icon: GiLungs, name: "Respiratory Infections", description: "Flu, pneumonia, bronchitis, and COVID-19 — diagnosis, treatment, and recovery support." },
    { Icon: FiFeather, name: "Allergies", description: "Seasonal, food, and environmental allergies identified and managed with evidence-based treatments." },
    { Icon: FiWind, name: "Asthma", description: "Personalised action plans, inhaler guidance, and trigger identification for better breathing." },
    { Icon: FiThermometer, name: "Fever & Infections", description: "Rapid assessment and treatment of acute fevers, bacterial and viral infections." },
    { Icon: GiBrain, name: "Anxiety & Depression", description: "Initial diagnosis, medication management, and referral to mental health specialists." },
    { Icon: GiBoneKnife, name: "Joint & Back Pain", description: "Conservative management, physiotherapy referrals, and pain relief for musculoskeletal issues." },
    { Icon: FiBarChart2, name: "Obesity & Weight", description: "Medically supervised weight management programmes tailored to your lifestyle and goals." },
    { Icon: MdOutlineHealthAndSafety, name: "Preventive Care", description: "Screenings, lifestyle coaching, and vaccinations to keep you healthy long-term." },
    { Icon: FiTool, name: "Minor Injuries", description: "Wound care, sprains, minor fractures, and cuts treated quickly in-office." },
    { Icon: FiCpu, name: "Thyroid Disorders", description: "Hypothyroidism and hyperthyroidism diagnosed and managed with lab-guided precision." },
  ],

  faqs: [
    {
      question: "What does a primary care physician do?",
      answer: "A primary care physician (PCP) is your main healthcare provider for routine check-ups, preventive care, common illnesses, and ongoing chronic condition management. They coordinate your overall healthcare, including referrals to specialists when needed.",
    },
    {
      question: "How often should I visit a primary care doctor?",
      answer: "Adults with no chronic conditions should schedule an annual wellness exam. Those managing chronic diseases like diabetes or hypertension may need visits every 3–6 months. Your PCP will recommend a schedule based on your individual health needs.",
    },
    {
      question: "Can primary care doctors treat chronic conditions?",
      answer: "Yes. Primary care physicians are trained to manage many chronic conditions, including hypertension, diabetes, asthma, thyroid disorders, and depression. They create long-term care plans and monitor your progress over time.",
    },
    {
      question: "When should I see a specialist instead of my primary care doctor?",
      answer: "Your primary care doctor will refer you to a specialist when your condition requires advanced expertise — for example, a cardiologist for heart disease, an endocrinologist for complex diabetes, or a neurologist for seizures. Always start with your PCP for initial evaluation.",
    },
    {
      question: "Does insurance cover primary care visits?",
      answer: "Most health insurance plans, including government schemes and private plans in India, cover primary care consultations. Many plans make annual wellness exams fully covered at no cost. HumanCare Connect's support team can help you verify your specific coverage.",
    },
    {
      question: "Can I consult a primary care doctor via telehealth?",
      answer: "Absolutely. HumanCare Connect offers telehealth consultations with board-certified primary care physicians. Virtual visits are ideal for follow-ups, prescription renewals, minor illnesses, and general health questions from the comfort of your home.",
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
  { Icon: FiAward, title: "Board-Certified Specialists", description: "Every provider on HumanCare Connect is credentialed, verified, and continuously monitored for quality of care." },
  { Icon: FiZap, title: "Fast Appointments", description: "Most patients are seen within 24 hours. Urgent care slots are available same-day." },
  { Icon: FiMonitor, title: "Telehealth Access", description: "Consult from anywhere — HD video visits on mobile, tablet, or desktop with secure encrypted connections." },
  { Icon: FiShield, title: "Insurance Support", description: "Our team helps you navigate coverage, pre-authorisations, and billing so you focus on your health." },
  { Icon: FiHeart, title: "Personalised Care", description: "Treatment plans built around your unique health history, lifestyle, and goals — not a generic protocol." },
  { Icon: FiGlobe, title: "Nationwide Network", description: "Access specialists across India and beyond, with seamless care coordination wherever you are." },
];

// ── Scroll reveal hook ────────────────────────────────────────────────────────
function useScrollReveal(threshold = 0.1) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
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
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
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
    // Extract numeric part for animation
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
    <div
      ref={ref}
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        borderRadius: "20px",
        padding: "clamp(16px, 3vw, 28px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: "8px",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(16px) scale(0.96)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}
    >
      <div style={{
        width: "44px", height: "44px",
        background: "rgba(11,87,232,0.15)",
        borderRadius: "12px",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#5B9DFF",
      }}>
        <Icon size={22} />
      </div>
      <p style={{ color: "#5B9DFF", fontWeight: 800, fontSize: "clamp(22px, 4vw, 32px)", lineHeight: 1, margin: 0 }}>
        {displayed}
      </p>
      <p style={{ color: "#94a3b8", fontSize: "13px", margin: 0, lineHeight: 1.3 }}>{label}</p>
    </div>
  );
}

// ── FAQ Item ──────────────────────────────────────────────────────────────────
function FAQItem({ question, answer, index }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        border: open ? "1.5px solid #0B57E8" : "1px solid #e2e8f0",
        borderRadius: "16px",
        overflow: "hidden",
        transition: "border-color 0.25s ease, box-shadow 0.25s ease",
        boxShadow: open ? "0 4px 24px rgba(11,87,232,0.08)" : "none",
        background: "#fff",
      }}
    >
      <button
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          padding: "18px 20px",
          textAlign: "left",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          outline: "none",
        }}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span style={{ fontWeight: 600, color: "#1e293b", fontSize: "15px", lineHeight: 1.4 }}>
          {question}
        </span>
        <span
          style={{
            flexShrink: 0,
            width: "30px", height: "30px",
            borderRadius: "50%",
            background: open ? "#083EBD" : "#EFF5FF",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: open ? "#fff" : "#083EBD",
            transition: "background 0.25s ease, color 0.25s ease, transform 0.3s ease",
            transform: open ? "rotate(45deg)" : "rotate(0deg)",
          }}
        >
          <FiPlus size={15} />
        </span>
      </button>
      <div
        style={{
          maxHeight: open ? "400px" : "0",
          overflow: "hidden",
          transition: "max-height 0.35s ease",
        }}
      >
        <div style={{ padding: "0 20px 20px", borderTop: "1px solid #f1f5f9" }}>
          <p style={{ color: "#475569", fontSize: "14px", lineHeight: 1.7, margin: "14px 0 0" }}>{answer}</p>
        </div>
      </div>
    </div>
  );
}

// ── Condition Card ────────────────────────────────────────────────────────────
function ConditionCard({ Icon, name, description, delay }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Reveal delay={delay}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: "#fff",
          border: hovered ? "1.5px solid #0B57E8" : "1px solid #e2e8f0",
          borderRadius: "20px",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          height: "100%",
          boxSizing: "border-box",
          transform: hovered ? "translateY(-4px)" : "translateY(0)",
          boxShadow: hovered ? "0 12px 32px rgba(11,87,232,0.12)" : "0 1px 3px rgba(0,0,0,0.04)",
          transition: "all 0.3s ease",
          cursor: "default",
        }}
      >
        <div style={{
          width: "44px", height: "44px",
          borderRadius: "12px",
          background: hovered ? "#DCE9FF" : "#EFF5FF",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#083EBD",
          flexShrink: 0,
          transition: "background 0.25s ease",
        }}>
          <Icon size={22} />
        </div>
        <h3 style={{ fontWeight: 700, color: "#1e293b", fontSize: "15px", margin: 0 }}>{name}</h3>
        <p style={{ color: "#64748b", fontSize: "13px", lineHeight: 1.65, margin: 0, flex: 1 }}>{description}</p>
        <button
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: "#083EBD",
            fontSize: "13px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "4px",
            cursor: "pointer",
            marginTop: "auto",
            transition: "gap 0.15s ease",
          }}
          aria-label={`Learn more about ${name}`}
        >
          Learn more <FiArrowRight size={13} />
        </button>
      </div>
    </Reveal>
  );
}

// ── Key Service Card ──────────────────────────────────────────────────────────
function ServiceCard({ Icon, title, description, delay, index }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Reveal delay={delay}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: hovered ? "#EFF5FF" : "#fff",
          border: hovered ? "1.5px solid #0B57E8" : "1px solid #e2e8f0",
          borderRadius: "20px",
          padding: "20px 22px",
          display: "flex",
          gap: "16px",
          alignItems: "flex-start",
          height: "100%",
          boxSizing: "border-box",
          transform: hovered ? "translateY(-3px)" : "translateY(0)",
          boxShadow: hovered ? "0 8px 24px rgba(11,87,232,0.1)" : "none",
          transition: "all 0.3s ease",
        }}
      >
        <div style={{
          width: "44px", height: "44px",
          borderRadius: "12px",
          background: hovered ? "#DCE9FF" : "#EFF5FF",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#083EBD",
          flexShrink: 0,
          transition: "background 0.25s ease",
        }}>
          <Icon size={22} />
        </div>
        <div>
          <h4 style={{ fontWeight: 700, color: "#1e293b", fontSize: "15px", margin: "0 0 6px" }}>{title}</h4>
          <p style={{ color: "#64748b", fontSize: "13px", lineHeight: 1.6, margin: 0 }}>{description}</p>
        </div>
      </div>
    </Reveal>
  );
}

// ── Benefit Card ──────────────────────────────────────────────────────────────
function BenefitCard({ Icon, title, description, delay }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Reveal delay={delay}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          textAlign: "center",
          background: hovered ? "#fff" : "linear-gradient(160deg, #EFF5FF 0%, #fff 100%)",
          border: hovered ? "1.5px solid #0B57E8" : "1px solid #DCE9FF",
          borderRadius: "20px",
          padding: "28px 20px",
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: hovered ? "translateY(-4px)" : "translateY(0)",
          boxShadow: hovered ? "0 12px 32px rgba(11,87,232,0.12)" : "none",
          transition: "all 0.3s ease",
        }}
      >
        <div style={{
          width: "52px", height: "52px",
          borderRadius: "14px",
          background: hovered ? "#0B57E8" : "#DCE9FF",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: hovered ? "#fff" : "#083EBD",
          marginBottom: "14px",
          transition: "all 0.3s ease",
        }}>
          <Icon size={24} />
        </div>
        <h4 style={{ fontWeight: 700, color: "#1e293b", fontSize: "15px", margin: "0 0 8px" }}>{title}</h4>
        <p style={{ color: "#64748b", fontSize: "13px", lineHeight: 1.65, margin: 0 }}>{description}</p>
      </div>
    </Reveal>
  );
}

// ── Trust Card ────────────────────────────────────────────────────────────────
function TrustCard({ Icon, title, description, delay }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Reveal delay={delay}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: "#fff",
          border: hovered ? "1.5px solid #0B57E8" : "1px solid #e2e8f0",
          borderRadius: "20px",
          padding: "24px",
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          transform: hovered ? "translateY(-4px)" : "translateY(0)",
          boxShadow: hovered ? "0 12px 32px rgba(11,87,232,0.12)" : "0 1px 3px rgba(0,0,0,0.04)",
          transition: "all 0.3s ease",
        }}
      >
        <div style={{
          width: "48px", height: "48px",
          borderRadius: "13px",
          background: hovered ? "#DCE9FF" : "#EFF5FF",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#083EBD",
          marginBottom: "16px",
          transition: "background 0.25s ease",
        }}>
          <Icon size={24} />
        </div>
        <h3 style={{ fontWeight: 700, color: "#1e293b", fontSize: "15px", margin: "0 0 8px" }}>{title}</h3>
        <p style={{ color: "#64748b", fontSize: "13px", lineHeight: 1.65, margin: 0, flex: 1 }}>{description}</p>
      </div>
    </Reveal>
  );
}

// ── Section Label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <span style={{
      display: "inline-block",
      color: "#083EBD",
      fontWeight: 700,
      fontSize: "12px",
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      background: "#EFF5FF",
      border: "1px solid #BFD7FF",
      borderRadius: "100px",
      padding: "4px 14px",
      marginBottom: "12px",
    }}>
      {children}
    </span>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────
export default function SpecialtyPage({ data = SPECIALTY_DATA }) {
  const [heroLoaded, setHeroLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#fff", fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", overflowX: "hidden", WebkitFontSmoothing: "antialiased" }}>

      {/* ── 1. HERO ────────────────────────────────────────────────────────── */}
      <section style={{ position: "relative", minHeight: "clamp(320px, 46vh, 440px)", display: "flex", flexDirection: "column", justifyContent: "flex-end", overflow: "hidden", width: "100%" }}>
        {/* Background image */}
        <div style={{ position: "absolute", inset: 0 }}>
          <img
            src={data.heroImage}
            alt={`${data.name} — HumanCare Connect`}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
            loading="eager"
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(15,23,42,0.35) 0%, rgba(15,23,42,0.65) 50%, rgba(15,23,42,0.95) 100%)" }} />
        </div>

        <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "1280px", margin: "0 auto", padding: "0 clamp(16px,4vw,48px) 44px", boxSizing: "border-box", paddingTop: "88px" }}>
          <div
            style={{
              opacity: heroLoaded ? 1 : 0,
              transform: heroLoaded ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.65s ease 0.25s, transform 0.65s ease 0.25s",
            }}
          >
            <span style={{
              display: "inline-block",
              background: "#0B57E8",
              color: "#fff",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "5px 14px",
              borderRadius: "100px",
              marginBottom: "16px",
            }}>
              HumanCare Connect
            </span>
            <h1 style={{ fontSize: "clamp(28px, 4.5vw, 48px)", fontWeight: 800, color: "#fff", lineHeight: 1.1, margin: "0 0 10px", maxWidth: "720px" }}>
              {data.name}
            </h1>
            <p style={{ color: "#5B9DFF", fontSize: "clamp(15px, 2vw, 19px)", fontWeight: 600, margin: "0 0 12px", maxWidth: "600px" }}>
              {data.tagline}
            </p>
            <p style={{ color: "rgba(255,255,255,0.78)", fontSize: "clamp(13px, 1.6vw, 16px)", lineHeight: 1.65, margin: "0 0 24px", maxWidth: "560px" }}>
              {data.heroDescription}
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              <a
                href={`/specialties/${data.slug}/doctors`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "8px",
                  background: "#0B57E8", color: "#fff",
                  fontWeight: 700, fontSize: "15px",
                  padding: "13px 24px", borderRadius: "100px",
                  textDecoration: "none",
                  boxShadow: "0 8px 24px rgba(11,87,232,0.35)",
                  transition: "background 0.2s ease, transform 0.2s ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#083EBD"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#0B57E8"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                <FiSearch size={17} />
                Find Specialists
              </a>
              <a
                href={`/specialties/${data.slug}/book`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "8px",
                  background: "rgba(255,255,255,0.12)", color: "#fff",
                  fontWeight: 700, fontSize: "15px",
                  padding: "13px 24px", borderRadius: "100px",
                  border: "1.5px solid rgba(255,255,255,0.3)",
                  backdropFilter: "blur(8px)",
                  textDecoration: "none",
                  transition: "background 0.2s ease, transform 0.2s ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.22)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                <FiCalendar size={17} />
                Book Appointment
              </a>
            </div>
          </div>
        </div>

      </section>

      {/* ── 2. OVERVIEW ────────────────────────────────────────────────────── */}
      <section style={{ padding: "clamp(56px, 8vw, 96px) 0", background: "#fff", width: "100%" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 clamp(16px,4vw,48px)", boxSizing: "border-box" }}>

          {/* Two-column overview */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 440px), 1fr))",
            gap: "clamp(32px, 5vw, 64px)",
            alignItems: "center",
            marginBottom: "clamp(48px, 7vw, 80px)",
          }}>
            {/* Image */}
            <Reveal>
              <div style={{ position: "relative", borderRadius: "24px", overflow: "hidden", aspectRatio: "4/3", width: "100%" }}>
                <img
                  src={data.overviewImage}
                  alt={`${data.name} specialists`}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  loading="lazy"
                />
                {/* Floating badge */}
                <div style={{
                  position: "absolute", bottom: "16px", left: "16px",
                  background: "rgba(255,255,255,0.97)",
                  backdropFilter: "blur(8px)",
                  borderRadius: "16px",
                  padding: "12px 16px",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                  display: "flex", alignItems: "center", gap: "12px",
                }}>
                  <div style={{ width: "40px", height: "40px", background: "#0B57E8", borderRadius: "11px", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}>
                    <FiCheckCircle size={20} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, color: "#1e293b", fontSize: "13px", margin: 0 }}>Board-Certified</p>
                    <p style={{ color: "#64748b", fontSize: "12px", margin: 0 }}>{data.name} Specialists</p>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Text content */}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <Reveal>
                <SectionLabel>About the Specialty</SectionLabel>
                <h2 style={{ fontSize: "clamp(24px, 3.5vw, 40px)", fontWeight: 800, color: "#0f172a", lineHeight: 1.2, margin: "0 0 16px" }}>
                  What Is {data.name}?
                </h2>
                <p style={{ color: "#475569", lineHeight: 1.75, fontSize: "15px", margin: "0 0 14px" }}>{data.overviewDescription}</p>
                <p style={{ color: "#475569", lineHeight: 1.75, fontSize: "15px", margin: 0 }}>{data.overviewImportance}</p>
              </Reveal>

              <Reveal delay={80}>
                <div style={{ background: "#EFF5FF", border: "1px solid #BFD7FF", borderRadius: "16px", padding: "18px 20px" }}>
                  <h3 style={{ fontWeight: 700, color: "#1e293b", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px", margin: "0 0 8px" }}>
                    <FiActivity size={15} color="#083EBD" />
                    Conditions Treated
                  </h3>
                  <p style={{ color: "#475569", fontSize: "13px", lineHeight: 1.65, margin: 0 }}>{data.conditionsTreated}</p>
                </div>
              </Reveal>

              <Reveal delay={140}>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "18px 20px" }}>
                  <h3 style={{ fontWeight: 700, color: "#1e293b", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px", margin: "0 0 8px" }}>
                    <FiAlertCircle size={15} color="#64748b" />
                    When to Consult
                  </h3>
                  <p style={{ color: "#475569", fontSize: "13px", lineHeight: 1.65, margin: 0 }}>{data.whenToConsult}</p>
                </div>
              </Reveal>
            </div>
          </div>

          {/* Key Services */}
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: "clamp(28px, 4vw, 40px)" }}>
              <SectionLabel>What We Offer</SectionLabel>
              <h3 style={{ fontSize: "clamp(22px, 3vw, 34px)", fontWeight: 800, color: "#0f172a", margin: "0" }}>
                Key Services
              </h3>
            </div>
          </Reveal>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
            gap: "clamp(12px, 2vw, 18px)",
            marginBottom: "clamp(48px, 7vw, 72px)",
          }}>
            {data.keyServices.map((s, i) => (
              <ServiceCard key={i} {...s} delay={i * 55} index={i} />
            ))}
          </div>

          {/* Benefits */}
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: "clamp(28px, 4vw, 40px)" }}>
              <SectionLabel>Why It Matters</SectionLabel>
              <h3 style={{ fontSize: "clamp(22px, 3vw, 34px)", fontWeight: 800, color: "#0f172a", margin: "0" }}>
                Benefits of {data.name}
              </h3>
            </div>
          </Reveal>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
            gap: "clamp(12px, 2vw, 18px)",
          }}>
            {data.benefits.map((b, i) => (
              <BenefitCard key={i} {...b} delay={i * 65} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. CONDITIONS ──────────────────────────────────────────────────── */}
      <section style={{ padding: "clamp(56px, 8vw, 96px) 0", background: "#f8fafc", width: "100%" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 clamp(16px,4vw,48px)", boxSizing: "border-box" }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: "clamp(36px, 5vw, 56px)" }}>
              <SectionLabel>Conditions &amp; Symptoms</SectionLabel>
              <h2 style={{ fontSize: "clamp(24px, 3.5vw, 40px)", fontWeight: 800, color: "#0f172a", margin: "0 0 12px" }}>
                What We Treat
              </h2>
              <p style={{ color: "#64748b", maxWidth: "520px", margin: "0 auto", fontSize: "15px", lineHeight: 1.65 }}>
                Our {data.name.toLowerCase()} specialists are experienced in diagnosing and treating a wide range of conditions across all age groups.
              </p>
            </div>
          </Reveal>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
            gap: "clamp(12px, 2vw, 18px)",
            alignItems: "stretch",
          }}>
            {data.conditions.map((c, i) => (
              <ConditionCard key={i} {...c} delay={Math.min(i, 7) * 45} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. WHY HUMANCARE ───────────────────────────────────────────────── */}
      <section style={{ padding: "clamp(56px, 8vw, 96px) 0", background: "#fff", width: "100%" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 clamp(16px,4vw,48px)", boxSizing: "border-box" }}>

          {/* Animated stats */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
            gap: "clamp(12px, 2vw, 16px)",
            marginBottom: "clamp(48px, 7vw, 72px)",
          }}>
            {TRUST_STATS.map((s, i) => (
              <AnimatedStat key={i} {...s} />
            ))}
          </div>

          <Reveal>
            <div style={{ textAlign: "center", marginBottom: "clamp(36px, 5vw, 56px)" }}>
              <SectionLabel>Why HumanCare Connect</SectionLabel>
              <h2 style={{ fontSize: "clamp(24px, 3.5vw, 40px)", fontWeight: 800, color: "#0f172a", margin: "0 0 12px" }}>
                Care You Can Trust
              </h2>
              <p style={{ color: "#64748b", maxWidth: "520px", margin: "0 auto", fontSize: "15px", lineHeight: 1.65 }}>
                We combine the best medical talent with technology that makes accessing great care simpler, faster, and more personal.
              </p>
            </div>
          </Reveal>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
            gap: "clamp(12px, 2vw, 20px)",
          }}>
            {TRUST_CARDS.map((c, i) => (
              <TrustCard key={i} {...c} delay={i * 55} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. FAQ ─────────────────────────────────────────────────────────── */}
      <section style={{ padding: "clamp(56px, 8vw, 96px) 0", background: "#f8fafc", width: "100%" }}>
        <div style={{ maxWidth: "760px", margin: "0 auto", padding: "0 clamp(16px,4vw,48px)", boxSizing: "border-box" }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: "clamp(36px, 5vw, 56px)" }}>
              <SectionLabel>FAQ</SectionLabel>
              <h2 style={{ fontSize: "clamp(24px, 3.5vw, 40px)", fontWeight: 800, color: "#0f172a", margin: "0 0 12px" }}>
                Frequently Asked Questions
              </h2>
              <p style={{ color: "#64748b", fontSize: "15px", lineHeight: 1.65, margin: 0 }}>
                Everything you need to know about {data.name.toLowerCase()} at HumanCare Connect.
              </p>
            </div>
          </Reveal>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {data.faqs.map((faq, i) => (
              <Reveal key={i} delay={i * 45}>
                <FAQItem question={faq.question} answer={faq.answer} index={i} />
              </Reveal>
            ))}
          </div>

          <Reveal delay={80}>
            <p style={{ textAlign: "center", marginTop: "40px", color: "#64748b", fontSize: "14px" }}>
              Still have questions?{" "}
              <a href="/contact" style={{ color: "#083EBD", fontWeight: 700, textDecoration: "none" }}
                onMouseEnter={e => e.target.style.textDecoration = "underline"}
                onMouseLeave={e => e.target.style.textDecoration = "none"}
              >
                Chat with our care team →
              </a>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── 6. CTA ─────────────────────────────────────────────────────────── */}
      <section style={{ position: "relative", padding: "clamp(64px, 10vw, 112px) 0", overflow: "hidden", width: "100%", background: "#0f172a" }}>
        {/* Decorative glows */}
        <div style={{ position: "absolute", top: 0, right: 0, width: "480px", height: "480px", borderRadius: "50%", background: "radial-gradient(circle, rgba(8,62,189,0.18) 0%, transparent 65%)", transform: "translate(30%, -30%)", pointerEvents: "none" }} aria-hidden="true" />
        <div style={{ position: "absolute", bottom: 0, left: 0, width: "360px", height: "360px", borderRadius: "50%", background: "radial-gradient(circle, rgba(11,87,232,0.12) 0%, transparent 65%)", transform: "translate(-30%, 30%)", pointerEvents: "none" }} aria-hidden="true" />

        <div style={{ position: "relative", zIndex: 10, maxWidth: "900px", margin: "0 auto", padding: "0 clamp(16px,4vw,48px)", boxSizing: "border-box", textAlign: "center" }}>
          <Reveal>
            <span style={{
              display: "inline-block",
              background: "rgba(11,87,232,0.15)",
              color: "#5B9DFF",
              fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
              padding: "6px 18px", borderRadius: "100px",
              border: "1px solid rgba(11,87,232,0.3)",
              marginBottom: "24px",
            }}>
              Get Started Today
            </span>
            <h2 style={{ fontSize: "clamp(28px, 5vw, 52px)", fontWeight: 800, color: "#fff", lineHeight: 1.15, margin: "0 0 16px" }}>
              Ready to Connect with a{" "}
              <span style={{ color: "#5B9DFF" }}>{data.name}</span>{" "}
              Specialist?
            </h2>
            <p style={{ color: "#94a3b8", fontSize: "clamp(14px, 2vw, 18px)", maxWidth: "520px", margin: "0 auto 40px", lineHeight: 1.7 }}>
              Book in minutes. Same-day and next-day slots available. Telehealth options for your convenience.
            </p>
          </Reveal>

          <Reveal delay={80}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", justifyContent: "center", marginBottom: "36px" }}>
              <a
                href={`/specialties/${data.slug}/doctors`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "9px",
                  background: "#0B57E8", color: "#fff",
                  fontWeight: 700, fontSize: "15px",
                  padding: "15px 28px", borderRadius: "100px",
                  textDecoration: "none",
                  boxShadow: "0 8px 28px rgba(11,87,232,0.35)",
                  transition: "background 0.2s ease, transform 0.2s ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#083EBD"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#0B57E8"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                <FiSearch size={18} />
                Find a Doctor
              </a>
              <a
                href={`/specialties/${data.slug}/book`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "9px",
                  background: "rgba(255,255,255,0.08)", color: "#fff",
                  fontWeight: 700, fontSize: "15px",
                  padding: "15px 28px", borderRadius: "100px",
                  border: "1.5px solid rgba(255,255,255,0.2)",
                  textDecoration: "none",
                  transition: "background 0.2s ease, transform 0.2s ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.16)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                <FiCalendar size={18} />
                Book Appointment
              </a>
            </div>
          </Reveal>

          {/* Trust badges */}
          <Reveal delay={130}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "clamp(12px, 3vw, 28px)", marginBottom: "36px" }}>
              {[
                { Icon: FiLock, label: "HIPAA Compliant" },
                { Icon: FiStar, label: "4.9/5 Patient Rating" },
                { Icon: FiCheckCircle, label: "Verified Providers" },
                { Icon: FiShield, label: "100% Secure Platform" },
              ].map((badge, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "7px", color: "#94a3b8", fontSize: "13px" }}>
                  <badge.Icon size={15} color="#5B9DFF" />
                  <span>{badge.label}</span>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Contact row */}
          <Reveal delay={170}>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "28px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "clamp(12px, 3vw, 28px)" }}>
              {[
                { href: "tel:+918008001234", Icon: FiPhone, label: "+91 800 800 1234" },
                { href: "mailto:care@humancareconnect.co", Icon: FiMail, label: "care@humancareconnect.co" },
              ].map((item, i) => (
                <a
                  key={i}
                  href={item.href}
                  style={{ display: "flex", alignItems: "center", gap: "7px", color: "#94a3b8", fontSize: "13px", textDecoration: "none", transition: "color 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#5B9DFF"}
                  onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}
                >
                  <item.Icon size={14} />
                  {item.label}
                </a>
              ))}
              <span style={{ display: "flex", alignItems: "center", gap: "7px", color: "#94a3b8", fontSize: "13px" }}>
                <FiClock size={14} />
                Mon – Sun, 8 AM – 10 PM IST
              </span>
            </div>
          </Reveal>
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