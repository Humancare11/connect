import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import {
  FiArrowRight, FiSearch, FiChevronDown, FiChevronUp, FiX,
  FiStar, FiClock, FiVideo, FiMapPin, FiFilter, FiCheckCircle,
  FiCalendar, FiUser, FiHeart, FiAlertCircle, FiBook,
  FiActivity, FiMessageSquare, FiShield
} from "react-icons/fi";

// ─── Data ────────────────────────────────────────────────────────────────────

const CATEGORY_DATA = {
  "mental-health": {
    id: "mental-health",
    label: "Mental Health",
    tagline: "Compassionate care, wherever you are",
    headline: "Compassionate Mental Health Care, Wherever You Are",
    subheadline: "Connect with licensed psychologists, psychiatrists, therapists and counselors for personalized, confidential care.",
    color: "#7B68EE",
    colorSoft: "#EEF0FF",
    colorDark: "#4A3FCB",
    icon: "🧠",
    stats: { specialists: 340, conditions: 48, doctors: 120, avgTime: "30 min", satisfaction: "97%" },
    specialties: [
      { name: "Psychiatry", icon: "🔬", desc: "Medical diagnosis and treatment of mental disorders with medication management.", doctors: 42 },
      { name: "Clinical Psychology", icon: "💬", desc: "Evidence-based psychological assessment and therapy for mental health conditions.", doctors: 38 },
      { name: "Counseling Psychology", icon: "🌱", desc: "Talk therapy focusing on emotional, social, and behavioral wellbeing.", doctors: 31 },
      { name: "Behavioral Therapy", icon: "🧩", desc: "CBT and DBT approaches to modify harmful thought and behavior patterns.", doctors: 29 },
      { name: "Child Psychology", icon: "🌟", desc: "Specialized mental health care for children and adolescents.", doctors: 24 },
      { name: "Addiction Psychiatry", icon: "🔄", desc: "Treatment of substance use disorders and co-occurring mental conditions.", doctors: 18 },
      { name: "Neuropsychology", icon: "⚡", desc: "Assessment of cognitive function, memory, and brain-behavior relationships.", doctors: 14 },
      { name: "Family Therapy", icon: "👨‍👩‍👧", desc: "Systemic therapy addressing dynamics and communication within families.", doctors: 22 },
    ],
    conditions: [
      { name: "Anxiety Disorder", desc: "Persistent, excessive worry that interferes with daily activities.", symptoms: ["Restlessness", "Racing thoughts", "Muscle tension"], specialists: ["Clinical Psychology", "Psychiatry"] },
      { name: "Depression", desc: "Persistent low mood, loss of interest, and reduced energy lasting weeks or more.", symptoms: ["Persistent sadness", "Fatigue", "Loss of interest"], specialists: ["Psychiatry", "Counseling Psychology"] },
      { name: "Panic Attacks", desc: "Sudden intense fear episodes with physical symptoms like chest pain or breathlessness.", symptoms: ["Chest tightness", "Shortness of breath", "Dizziness"], specialists: ["Psychiatry", "Behavioral Therapy"] },
      { name: "PTSD", desc: "Trauma-related disorder causing flashbacks, nightmares, and heightened alertness.", symptoms: ["Flashbacks", "Nightmares", "Hypervigilance"], specialists: ["Clinical Psychology", "Psychiatry"] },
      { name: "ADHD", desc: "Neurodevelopmental condition affecting attention, impulse control, and hyperactivity.", symptoms: ["Inattention", "Hyperactivity", "Impulsivity"], specialists: ["Child Psychology", "Psychiatry"] },
      { name: "OCD", desc: "Intrusive thoughts and compulsive behaviors that cause significant distress.", symptoms: ["Obsessive thoughts", "Repetitive behaviors", "Anxiety"], specialists: ["Behavioral Therapy", "Psychiatry"] },
      { name: "Bipolar Disorder", desc: "Extreme mood swings between mania/hypomania and depression.", symptoms: ["Mood swings", "Elevated energy", "Depressive episodes"], specialists: ["Psychiatry", "Clinical Psychology"] },
      { name: "Insomnia", desc: "Difficulty falling or staying asleep, affecting daytime functioning.", symptoms: ["Difficulty sleeping", "Early waking", "Daytime fatigue"], specialists: ["Clinical Psychology", "Psychiatry"] },
      { name: "Burnout", desc: "Chronic workplace or caregiver stress leading to physical and emotional exhaustion.", symptoms: ["Exhaustion", "Detachment", "Reduced performance"], specialists: ["Counseling Psychology", "Psychiatry"] },
      { name: "Stress Management", desc: "Support for managing overwhelming stress from life, work, or relationships.", symptoms: ["Irritability", "Headaches", "Overwhelm"], specialists: ["Counseling Psychology", "Behavioral Therapy"] },
    ],
    symptoms: ["Persistent Sadness", "Mood Swings", "Sleep Problems", "Excessive Worry", "Fatigue", "Concentration Issues", "Irritability", "Social Withdrawal", "Low Self-Esteem", "Panic Episodes"],
    treatments: [
      { icon: <FiVideo />, title: "Video Consultation", desc: "Speak with a therapist or psychiatrist from home, in complete privacy." },
      { icon: <FiMapPin />, title: "In-Person Sessions", desc: "Face-to-face consultations at partner clinics near you." },
      { icon: <FiMessageSquare />, title: "Therapy Sessions", desc: "Ongoing CBT, DBT, or talk therapy programs customized to you." },
      { icon: <FiCalendar />, title: "Follow-Up Care", desc: "Structured follow-up plans to track your progress over time." },
      { icon: <FiShield />, title: "Prescription Support", desc: "Psychiatrists who can prescribe and manage your medication safely." },
      { icon: <FiUser />, title: "Specialist Referrals", desc: "Warm handoffs to specialist care when your needs evolve." },
    ],
    doctors: [
      { name: "Dr. Priya Sharma", specialty: "Psychiatry", exp: "14 yrs", rating: 4.9, reviews: 312, langs: ["English", "Hindi"], fee: "₹1,200", avail: "Today", img: null, initials: "PS" },
      { name: "Dr. Arjun Mehta", specialty: "Clinical Psychology", exp: "11 yrs", rating: 4.8, reviews: 267, langs: ["English", "Marathi"], fee: "₹950", avail: "Tomorrow", img: null, initials: "AM" },
      { name: "Dr. Sana Qureshi", specialty: "Behavioral Therapy", exp: "9 yrs", rating: 4.9, reviews: 198, langs: ["English", "Urdu"], fee: "₹1,100", avail: "Today", img: null, initials: "SQ" },
      { name: "Dr. Rohan Das", specialty: "Counseling Psychology", exp: "8 yrs", rating: 4.7, reviews: 144, langs: ["English", "Bengali"], fee: "₹800", avail: "In 2 days", img: null, initials: "RD" },
    ],
    resources: [
      { type: "Guide", title: "Understanding Anxiety: A Complete Guide", time: "8 min read" },
      { type: "Article", title: "When Should You See a Psychiatrist vs. Therapist?", time: "5 min read" },
      { type: "FAQ", title: "Online Mental Health Consultations: What to Expect", time: "3 min read" },
      { type: "Tip", title: "5 Daily Habits That Support Mental Wellbeing", time: "4 min read" },
    ],
    faqs: [
      { q: "When should I see a mental health specialist?", a: "If your thoughts, emotions, or behaviors are consistently affecting your work, relationships, or daily functioning for two or more weeks, speaking with a specialist is a good step. Early support leads to better outcomes." },
      { q: "What symptoms require immediate attention?", a: "Thoughts of self-harm or suicide, sudden severe mood changes, hearing voices, or experiencing paranoia should be addressed immediately. Please reach out to a crisis helpline or visit your nearest emergency centre." },
      { q: "Can I book online consultations for therapy?", a: "Yes. Video consultations are available for therapy, counseling, and psychiatric assessments. Most conditions can be effectively managed remotely, with in-person referrals made when necessary." },
      { q: "Is my consultation completely confidential?", a: "Absolutely. All consultations on HumanCare Connect are bound by strict medical confidentiality. Your information is never shared without your explicit consent, except in rare legal or safety situations." },
      { q: "How long does a typical therapy session last?", a: "Initial consultations are usually 45–60 minutes. Follow-up therapy sessions typically run 30–50 minutes depending on the modality and your treatment plan." },
    ],
  },
  "general-care": {
    id: "general-care",
    label: "General & Everyday Care",
    tagline: "Your first step to feeling better",
    headline: "Fast, Reliable Everyday Medical Care",
    subheadline: "Consult experienced general physicians for common illnesses, health check-ups, and ongoing wellness management.",
    color: "#0B57E8",
    colorSoft: "#EEF4FF",
    colorDark: "#0840B5",
    icon: "🩺",
    stats: { specialists: 280, conditions: 60, doctors: 180, avgTime: "20 min", satisfaction: "96%" },
    specialties: [
      { name: "General Medicine", icon: "🩺", desc: "Diagnosis and treatment of common illnesses, infections, and chronic conditions.", doctors: 64 },
      { name: "Family Medicine", icon: "👨‍👩‍👧‍👦", desc: "Comprehensive primary care for all family members across all age groups.", doctors: 48 },
      { name: "Preventive Care", icon: "🛡️", desc: "Health screenings, vaccinations, and lifestyle guidance to prevent illness.", doctors: 32 },
      { name: "Geriatrics", icon: "🌿", desc: "Specialized care for the unique health needs of older adults.", doctors: 28 },
      { name: "Sports Medicine", icon: "⚽", desc: "Management of sports injuries, exercise physiology, and athletic health.", doctors: 22 },
      { name: "Internal Medicine", icon: "🔬", desc: "Non-surgical treatment of complex adult diseases across multiple organs.", doctors: 40 },
    ],
    conditions: [
      { name: "Common Cold & Flu", desc: "Viral upper respiratory infections with fever, cough, and body aches.", symptoms: ["Runny nose", "Sore throat", "Fever"], specialists: ["General Medicine", "Family Medicine"] },
      { name: "Fever", desc: "Elevated body temperature often indicating an underlying infection.", symptoms: ["High temperature", "Chills", "Sweating"], specialists: ["General Medicine"] },
      { name: "Hypertension", desc: "Persistently high blood pressure that increases heart disease and stroke risk.", symptoms: ["Headaches", "Dizziness", "Blurred vision"], specialists: ["Internal Medicine", "General Medicine"] },
      { name: "Diabetes Management", desc: "Ongoing monitoring and treatment of Type 1 and Type 2 diabetes.", symptoms: ["Frequent urination", "Fatigue", "Blurred vision"], specialists: ["Internal Medicine", "General Medicine"] },
      { name: "UTI", desc: "Bacterial infection of the urinary tract causing pain and discomfort.", symptoms: ["Burning urination", "Frequent urge", "Pelvic pain"], specialists: ["General Medicine"] },
      { name: "Allergies", desc: "Immune reactions to environmental triggers like pollen, food, or dust.", symptoms: ["Sneezing", "Itchy eyes", "Rash"], specialists: ["General Medicine"] },
    ],
    symptoms: ["Fever", "Cough", "Fatigue", "Headache", "Nausea", "Body Ache", "Sore Throat", "Dizziness", "Chest Pain", "Breathlessness"],
    treatments: [
      { icon: <FiVideo />, title: "Video Consultation", desc: "Quick diagnosis and prescriptions for everyday illnesses." },
      { icon: <FiMapPin />, title: "In-Person Visit", desc: "Physical examinations at clinics near you." },
      { icon: <FiActivity />, title: "Health Check-Ups", desc: "Routine wellness screenings and preventive health packages." },
      { icon: <FiCalendar />, title: "Follow-Up Care", desc: "Ongoing management for chronic and recurring conditions." },
      { icon: <FiShield />, title: "Prescription Support", desc: "Digital prescriptions delivered to your pharmacist." },
      { icon: <FiUser />, title: "Specialist Referrals", desc: "Guided referrals when your condition needs focused expertise." },
    ],
    doctors: [
      { name: "Dr. Anil Kapoor", specialty: "General Medicine", exp: "16 yrs", rating: 4.8, reviews: 420, langs: ["English", "Hindi"], fee: "₹600", avail: "Today", img: null, initials: "AK" },
      { name: "Dr. Meera Iyer", specialty: "Family Medicine", exp: "12 yrs", rating: 4.9, reviews: 388, langs: ["English", "Tamil"], fee: "₹700", avail: "Today", img: null, initials: "MI" },
      { name: "Dr. Sameer Joshi", specialty: "Internal Medicine", exp: "14 yrs", rating: 4.7, reviews: 295, langs: ["English", "Marathi"], fee: "₹750", avail: "Tomorrow", img: null, initials: "SJ" },
      { name: "Dr. Pooja Nair", specialty: "Preventive Care", exp: "9 yrs", rating: 4.8, reviews: 211, langs: ["English", "Malayalam"], fee: "₹650", avail: "In 2 days", img: null, initials: "PN" },
    ],
    resources: [
      { type: "Guide", title: "When to See a Doctor vs. Wait It Out", time: "6 min read" },
      { type: "Article", title: "Understanding Your Blood Pressure Numbers", time: "4 min read" },
      { type: "FAQ", title: "Online General Consultations: Common Questions", time: "3 min read" },
      { type: "Tip", title: "10 Preventive Health Checks Everyone Should Do", time: "5 min read" },
    ],
    faqs: [
      { q: "When should I consult a general physician?", a: "For any illness that lasts more than 2–3 days or significantly affects your daily life — including fever, persistent cough, fatigue, or unusual pain — a consultation is appropriate." },
      { q: "Can a general physician manage chronic conditions?", a: "Yes. General and internal medicine doctors routinely manage hypertension, diabetes, thyroid conditions, and other long-term health issues with monitoring and medication adjustments." },
      { q: "Is an online consultation suitable for children?", a: "Online consultations are effective for assessing common childhood illnesses. For physical examinations or emergencies, an in-person visit is recommended." },
      { q: "Will I receive a prescription after an online consultation?", a: "Yes. Doctors on HumanCare Connect can issue digital prescriptions for most non-narcotic medications, which can be shared directly with your pharmacy." },
    ],
  },
};

// Fill remaining categories with minimal data so the switcher works
const STUB = (id, label, icon, color, colorSoft, tagline) => ({
  id, label, icon, color, colorSoft, colorDark: color, tagline,
  headline: `Expert ${label} Care, Right When You Need It`,
  subheadline: `Access specialist doctors, explore conditions, and book consultations — all in one place.`,
  stats: { specialists: Math.floor(Math.random()*300+100), conditions: Math.floor(Math.random()*50+20), doctors: Math.floor(Math.random()*150+50), avgTime: "25 min", satisfaction: "96%" },
  specialties: [], conditions: [], symptoms: [], treatments: [], doctors: [], resources: [], faqs: [],
});

const ALL_CATEGORIES = {
  ...CATEGORY_DATA,
  "skin-hair": STUB("skin-hair","Skin & Hair","🌸","#E8856A","#FEF3EF","Confidence starts with healthy skin"),
  "womens-health": STUB("womens-health","Women's Health","🌺","#D05C8A","#FCEEF5","Specialized care at every stage of life"),
  "mens-health": STUB("mens-health","Men's Health","💪","#2D9CDB","#EBF7FF","Performance, vitality, and longevity"),
  "children-family": STUB("children-family","Children & Family","⭐","#F7A44A","#FFF5E9","Caring for your little ones"),
  "weight-nutrition": STUB("weight-nutrition","Weight & Nutrition","🥗","#27AE60","#EBF9F1","Science-backed wellness from within"),
  "chronic-care": STUB("chronic-care","Chronic Care & Expert Opinion","🔬","#8B5CF6","#F3EFFE","Long-term care for lasting health"),
  "eye-ear-bone": STUB("eye-ear-bone","Eye, Ear & Bone","👁️","#0EA5E9","#EBF8FF","Precision care for sensory & structural health"),
  "sexual-health": STUB("sexual-health","Sexual Health","❤️","#EF4444","#FEF2F2","Discreet, judgement-free care"),
  "travel-care": STUB("travel-care","Travel & Global Care","✈️","#10B981","#ECFDF5","Health support wherever you go"),
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Avatar = ({ initials, color }) => (
  <div style={{
    width: 52, height: 52, borderRadius: "50%",
    background: color + "22",
    border: `2px solid ${color}44`,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 16, fontWeight: 700, color, flexShrink: 0,
    fontFamily: "Satoshi, sans-serif",
  }}>{initials}</div>
);

const StarRating = ({ rating }) => (
  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
    <FiStar style={{ fill: "#F59E0B", stroke: "#F59E0B", width: 13, height: 13 }} />
    <span style={{ fontSize: 13, fontWeight: 600, color: "#0A1F44" }}>{rating}</span>
  </span>
);

const Chip = ({ label, active, onClick, color }) => (
  <button onClick={onClick} style={{
    padding: "7px 16px", borderRadius: 50, border: `1.5px solid ${active ? color : "#D0DCF5"}`,
    background: active ? color + "18" : "#F7FAFF",
    color: active ? color : "#445577", fontSize: 13, fontWeight: 500,
    cursor: "pointer", transition: "all 0.18s", whiteSpace: "nowrap",
    fontFamily: "Satoshi, sans-serif",
  }}>{label}</button>
);

const SectionHeading = ({ eyebrow, title, sub }) => (
  <div style={{ marginBottom: "2.5rem" }}>
    {eyebrow && <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#0B57E8", display: "block", marginBottom: 8 }}>{eyebrow}</span>}
    <h2 style={{ fontSize: "clamp(24px,3vw,34px)", fontWeight: 700, color: "#0A1F44", margin: 0, lineHeight: 1.2, fontFamily: "Satoshi, sans-serif" }}>{title}</h2>
    {sub && <p style={{ marginTop: 10, color: "#556080", fontSize: 16, maxWidth: 540, lineHeight: 1.65 }}>{sub}</p>}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChildMain({ categoryId = "mental-health" }) {
  const [activeCategory, setActiveCategory] = useState(categoryId);
  const [activeSymptom, setActiveSymptom] = useState(null);
  const [conditionSearch, setConditionSearch] = useState("");
  const [openFaq, setOpenFaq] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");
  const [countersVisible, setCountersVisible] = useState(false);
  const [displayedCounts, setDisplayedCounts] = useState({});

  const cat = ALL_CATEGORIES[activeCategory] || CATEGORY_DATA["mental-health"];

  const sectionRefs = {
    overview: useRef(null),
    specialties: useRef(null),
    conditions: useRef(null),
    symptoms: useRef(null),
    doctors: useRef(null),
    resources: useRef(null),
    faq: useRef(null),
  };

  const statsRef = useRef(null);

  // Animated counters
  useEffect(() => {
    if (!countersVisible) return;
    const targets = {
      specialists: cat.stats.specialists,
      conditions: cat.stats.conditions,
      doctors: cat.stats.doctors,
    };
    const duration = 1200;
    const steps = 40;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayedCounts({
        specialists: Math.round(targets.specialists * eased),
        conditions: Math.round(targets.conditions * eased),
        doctors: Math.round(targets.doctors * eased),
      });
      if (step >= steps) clearInterval(interval);
    }, duration / steps);
    return () => clearInterval(interval);
  }, [countersVisible, activeCategory]);

  // IntersectionObserver for stats counter
  useEffect(() => {
    setCountersVisible(false);
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setCountersVisible(true); }, { threshold: 0.3 });
    if (statsRef.current) obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, [activeCategory]);

  // Sticky nav highlight
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.dataset.section); });
    }, { rootMargin: "-40% 0px -40% 0px" });
    Object.entries(sectionRefs).forEach(([k, r]) => { if (r.current) { r.current.dataset.section = k; obs.observe(r.current); } });
    return () => obs.disconnect();
  }, [activeCategory]);

  const scrollTo = (key) => { sectionRefs[key]?.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  const filteredConditions = cat.conditions.filter(c => {
    const searchMatch = c.name.toLowerCase().includes(conditionSearch.toLowerCase()) || c.desc.toLowerCase().includes(conditionSearch.toLowerCase());
    const symptomMatch = !activeSymptom || c.symptoms.some(s => s.toLowerCase().includes(activeSymptom.toLowerCase()));
    return searchMatch && symptomMatch;
  });

  const navItems = [
    { key: "overview", label: "Overview" },
    { key: "specialties", label: "Specialties" },
    { key: "conditions", label: "Conditions" },
    { key: "symptoms", label: "Symptoms" },
    { key: "doctors", label: "Doctors" },
    { key: "resources", label: "Resources" },
    { key: "faq", label: "FAQ" },
  ];

  return (
    <div style={{ fontFamily: "Satoshi, -apple-system, sans-serif", background: "#F7FAFF", color: "#0A1F44", minHeight: "100vh" }}>

      {/* ── Breadcrumb ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E8EEF8", padding: "0 clamp(20px,5vw,80px)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "12px 0", display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#7A8CAB" }}>
          <span style={{ cursor: "pointer", color: "#0B57E8" }}>Home</span>
          <span>›</span>
          <span style={{ cursor: "pointer", color: "#0B57E8" }}>Categories</span>
          <span>›</span>
          <span style={{ color: "#0A1F44", fontWeight: 500 }}>{cat.label}</span>
        </div>
      </div>

      {/* ── Hero ── */}
      <section ref={sectionRefs.overview} style={{
        background: `linear-gradient(135deg, ${cat.color}12 0%, ${cat.colorSoft} 60%, #F7FAFF 100%)`,
        padding: "clamp(40px,7vw,90px) clamp(20px,5vw,80px) 0",
        position: "relative", overflow: "hidden",
      }}>
        {/* decorative circle */}
        <div style={{ position: "absolute", right: -80, top: -80, width: 500, height: 500, borderRadius: "50%", background: cat.color + "08", pointerEvents: "none" }} />
        <div style={{ position: "absolute", right: 60, top: 60, width: 280, height: 280, borderRadius: "50%", background: cat.color + "0C", pointerEvents: "none" }} />

        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 40, alignItems: "flex-end" }}>
            <div style={{ maxWidth: 720 }}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: cat.color + "18", border: `1px solid ${cat.color}30`, borderRadius: 50, padding: "6px 16px", marginBottom: 24 }}>
                  <span style={{ fontSize: 18 }}>{cat.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: cat.colorDark }}>{cat.label}</span>
                </div>
                <h1 style={{ fontSize: "clamp(28px,4.5vw,52px)", fontWeight: 800, lineHeight: 1.15, color: "#0A1F44", margin: "0 0 18px", letterSpacing: "-0.5px" }}>
                  {cat.headline}
                </h1>
                <p style={{ fontSize: "clamp(15px,1.8vw,18px)", color: "#445577", lineHeight: 1.7, marginBottom: 32, maxWidth: 580 }}>
                  {cat.subheadline}
                </p>

                {/* Search bar */}
                <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
                  <div style={{
                    flex: 1, minWidth: 280, display: "flex", alignItems: "center", gap: 12,
                    background: "#fff", border: "1.5px solid #D0DCF5", borderRadius: 50, padding: "12px 20px",
                    boxShadow: "0 2px 12px rgba(11,87,232,0.08)",
                  }}>
                    <FiSearch style={{ color: "#7A8CAB", flexShrink: 0 }} />
                    <input
                      placeholder={`Search conditions, symptoms in ${cat.label}...`}
                      style={{ border: "none", outline: "none", fontSize: 14, color: "#0A1F44", background: "transparent", width: "100%", fontFamily: "inherit" }}
                      value={conditionSearch}
                      onChange={e => setConditionSearch(e.target.value)}
                    />
                  </div>
                </div>

                {/* CTA buttons */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <button
                    onClick={() => scrollTo("doctors")}
                    style={{
                      background: cat.color, color: "#fff", border: "none", borderRadius: 50,
                      padding: "14px 28px", fontSize: 15, fontWeight: 600, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s",
                      boxShadow: `0 4px 20px ${cat.color}40`,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 8px 24px ${cat.color}55`; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `0 4px 20px ${cat.color}40`; }}
                  >
                    Find Doctors <FiArrowRight />
                  </button>
                  <button
                    onClick={() => scrollTo("conditions")}
                    style={{
                      background: "#fff", color: cat.color, border: `2px solid ${cat.color}`, borderRadius: 50,
                      padding: "12px 28px", fontSize: 15, fontWeight: 600, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = cat.color + "0A"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}
                  >
                    Explore Conditions
                  </button>
                </div>
              </motion.div>
            </div>

            {/* Category switcher pill (desktop) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignSelf: "flex-start", marginTop: 20 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#7A8CAB", marginBottom: 4 }}>Switch Category</span>
              {Object.values(ALL_CATEGORIES).slice(0, 6).map(c => (
                <button
                  key={c.id}
                  onClick={() => { setActiveCategory(c.id); setConditionSearch(""); setActiveSymptom(null); setOpenFaq(null); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: c.id === activeCategory ? c.color + "18" : "#fff",
                    border: `1.5px solid ${c.id === activeCategory ? c.color : "#E8EEF8"}`,
                    borderRadius: 50, padding: "7px 14px", cursor: "pointer",
                    fontSize: 13, fontWeight: c.id === activeCategory ? 600 : 400,
                    color: c.id === activeCategory ? c.colorDark || c.color : "#445577",
                    transition: "all 0.18s", whiteSpace: "nowrap",
                  }}
                >
                  <span>{c.icon}</span> {c.label}
                </button>
              ))}
              <button
                onClick={() => setDrawerOpen(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, background: "#F7FAFF",
                  border: "1.5px dashed #C8DFFF", borderRadius: 50, padding: "7px 14px",
                  cursor: "pointer", fontSize: 13, color: "#0B57E8", fontWeight: 500, marginTop: 2,
                }}
              >
                + View all categories
              </button>
            </div>
          </div>

          {/* Quick stat pills */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "32px 0 0" }}>
            {[
              { label: `${cat.stats.specialists}+ Specialists`, icon: <FiUser /> },
              { label: `${cat.stats.conditions}+ Conditions`, icon: <FiActivity /> },
              { label: `${cat.stats.doctors} Doctors Online`, icon: <FiCheckCircle /> },
              { label: `${cat.stats.satisfaction} Satisfaction`, icon: <FiHeart /> },
            ].map((s, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 8, background: "#fff",
                border: "1px solid #E8EEF8", borderRadius: 50, padding: "8px 18px",
                fontSize: 13, fontWeight: 500, color: "#0A1F44",
                boxShadow: "0 2px 8px rgba(11,87,232,0.06)",
              }}>
                <span style={{ color: cat.color }}>{s.icon}</span> {s.label}
              </div>
            ))}
          </div>
        </div>

        {/* Sticky nav bar */}
        <div style={{
          position: "sticky", top: 0, zIndex: 90, background: "#fff",
          borderTop: "1px solid #E8EEF8", borderBottom: "1px solid #E8EEF8",
          marginTop: 32, overflowX: "auto",
        }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,5vw,80px)", display: "flex", gap: 0 }}>
            {navItems.map(n => (
              <button
                key={n.key}
                onClick={() => scrollTo(n.key)}
                style={{
                  padding: "14px 20px", fontSize: 14, fontWeight: activeSection === n.key ? 600 : 400,
                  color: activeSection === n.key ? cat.color : "#445577",
                  background: "transparent", border: "none", cursor: "pointer",
                  borderBottom: `2.5px solid ${activeSection === n.key ? cat.color : "transparent"}`,
                  whiteSpace: "nowrap", transition: "all 0.15s",
                }}
              >
                {n.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,5vw,80px)" }}>

        {/* ── Stats Section ── */}
        <section ref={statsRef} style={{ padding: "56px 0 0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 16 }}>
            {[
              { label: "Total Specialists", value: displayedCounts.specialists ?? cat.stats.specialists, suffix: "+", icon: <FiUser />, color: cat.color },
              { label: "Conditions Covered", value: displayedCounts.conditions ?? cat.stats.conditions, suffix: "+", icon: <FiActivity />, color: "#10B981" },
              { label: "Doctors Available", value: displayedCounts.doctors ?? cat.stats.doctors, suffix: "", icon: <FiCheckCircle />, color: "#8B5CF6" },
              { label: "Avg. Consultation", value: cat.stats.avgTime, suffix: "", icon: <FiClock />, color: "#F59E0B", isString: true },
              { label: "Patient Satisfaction", value: cat.stats.satisfaction, suffix: "", icon: <FiHeart />, color: "#EF4444", isString: true },
            ].map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                animate={countersVisible ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                style={{
                  background: "#fff", border: "1px solid #E8EEF8", borderRadius: 20,
                  padding: "24px 20px", textAlign: "center",
                  boxShadow: "0 2px 12px rgba(11,87,232,0.05)",
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 14, background: s.color + "14",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 14px", fontSize: 20, color: s.color,
                }}>{s.icon}</div>
                <div style={{ fontSize: "clamp(22px,2.5vw,28px)", fontWeight: 800, color: "#0A1F44", lineHeight: 1 }}>
                  {s.isString ? s.value : s.value}{s.suffix}
                </div>
                <div style={{ fontSize: 12, color: "#7A8CAB", marginTop: 6, fontWeight: 500 }}>{s.label}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Specialties Section ── */}
        {cat.specialties.length > 0 && (
          <section ref={sectionRefs.specialties} style={{ padding: "72px 0 0" }}>
            <SectionHeading eyebrow="Expertise" title="Specialties Covered" sub={`All ${cat.label} specialties available on HumanCare Connect.`} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,280px),1fr))", gap: 20 }}>
              {cat.specialties.map((sp, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -4, boxShadow: `0 12px 32px ${cat.color}18` }}
                  style={{
                    background: "#fff", border: "1px solid #E8EEF8", borderRadius: 20,
                    padding: "24px", cursor: "pointer",
                    transition: "box-shadow 0.2s, border-color 0.2s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = cat.color + "50"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#E8EEF8"}
                >
                  <div style={{ fontSize: 28, marginBottom: 12 }}>{sp.icon}</div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0A1F44", margin: "0 0 8px" }}>{sp.name}</h3>
                  <p style={{ fontSize: 13, color: "#556080", lineHeight: 1.6, margin: "0 0 16px" }}>{sp.desc}</p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: cat.color, background: cat.color + "12", borderRadius: 50, padding: "4px 12px" }}>
                      {sp.doctors} Doctors
                    </span>
                    <FiArrowRight style={{ color: cat.color, opacity: 0.7 }} />
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ── Conditions Section ── */}
        {cat.conditions.length > 0 && (
          <section ref={sectionRefs.conditions} style={{ padding: "72px 0 0" }}>
            <SectionHeading eyebrow="Conditions" title="Conditions & Symptoms We Treat" sub="Browse by condition or use the search to find relevant care." />

            {/* Filter row */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10, background: "#fff",
                border: "1.5px solid #D0DCF5", borderRadius: 50, padding: "9px 18px", flex: 1, minWidth: 220,
              }}>
                <FiSearch style={{ color: "#7A8CAB", flexShrink: 0 }} />
                <input
                  placeholder="Filter conditions..."
                  value={conditionSearch}
                  onChange={e => setConditionSearch(e.target.value)}
                  style={{ border: "none", outline: "none", fontSize: 14, background: "transparent", width: "100%", fontFamily: "inherit", color: "#0A1F44" }}
                />
                {conditionSearch && <button onClick={() => setConditionSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#7A8CAB", padding: 0 }}><FiX /></button>}
              </div>
              {activeSymptom && (
                <button onClick={() => setActiveSymptom(null)} style={{ display: "flex", alignItems: "center", gap: 6, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 50, padding: "9px 16px", fontSize: 13, color: "#EF4444", cursor: "pointer" }}>
                  <FiX size={13} /> Clear filter: {activeSymptom}
                </button>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,300px),1fr))", gap: 20 }}>
              <AnimatePresence>
                {filteredConditions.map((cond, i) => (
                  <ConditionCard key={cond.name} cond={cond} color={cat.color} index={i} />
                ))}
              </AnimatePresence>
              {filteredConditions.length === 0 && (
                <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "48px 0", color: "#7A8CAB" }}>
                  <FiSearch size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
                  <p>No conditions match your search.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Symptoms Section ── */}
        {cat.symptoms.length > 0 && (
          <section ref={sectionRefs.symptoms} style={{ padding: "72px 0 0" }}>
            <SectionHeading eyebrow="Symptoms" title="Common Symptoms" sub="Tap a symptom to filter relevant conditions above." />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {cat.symptoms.map((s, i) => (
                <Chip
                  key={i} label={s}
                  active={activeSymptom === s}
                  color={cat.color}
                  onClick={() => { setActiveSymptom(activeSymptom === s ? null : s); scrollTo("conditions"); }}
                />
              ))}
            </div>
            {activeSymptom && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{
                marginTop: 20, background: cat.color + "10", border: `1px solid ${cat.color}30`,
                borderRadius: 14, padding: "14px 20px", display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: cat.colorDark || cat.color,
              }}>
                <FiAlertCircle /> Showing conditions related to <strong>{activeSymptom}</strong> — scroll up to see results.
              </motion.div>
            )}
          </section>
        )}

        {/* ── Treatments Section ── */}
        {cat.treatments.length > 0 && (
          <section style={{ padding: "72px 0 0" }}>
            <SectionHeading eyebrow="Care Options" title="Treatment & Care Pathways" sub="Multiple ways to access quality care, on your terms." />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,240px),1fr))", gap: 16 }}>
              {cat.treatments.map((t, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  style={{
                    background: "#fff", border: "1px solid #E8EEF8", borderRadius: 20,
                    padding: "22px 20px",
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, background: cat.color + "14",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: 14, fontSize: 18, color: cat.color,
                  }}>{t.icon}</div>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: "#0A1F44", margin: "0 0 8px" }}>{t.title}</h4>
                  <p style={{ fontSize: 13, color: "#556080", lineHeight: 1.6, margin: 0 }}>{t.desc}</p>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ── Doctors Section ── */}
        {cat.doctors.length > 0 && (
          <section ref={sectionRefs.doctors} style={{ padding: "72px 0 0" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: "2.5rem" }}>
              <SectionHeading eyebrow="Our Doctors" title="Featured Specialists" sub={`Highly rated ${cat.label} specialists available for consultation.`} />
              <button style={{
                background: "transparent", border: `2px solid ${cat.color}`, color: cat.color, borderRadius: 50,
                padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                View All Doctors <FiArrowRight />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,290px),1fr))", gap: 20 }}>
              {cat.doctors.map((doc, i) => (
                <DoctorCard key={i} doc={doc} color={cat.color} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* ── Resources Section ── */}
        {cat.resources.length > 0 && (
          <section ref={sectionRefs.resources} style={{ padding: "72px 0 0" }}>
            <SectionHeading eyebrow="Learn" title="Health Resources" sub={`Articles, guides, and tips for ${cat.label}.`} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,260px),1fr))", gap: 20 }}>
              {cat.resources.map((r, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                  whileHover={{ y: -3 }}
                  style={{
                    background: "#fff", border: "1px solid #E8EEF8", borderRadius: 20,
                    padding: "24px", cursor: "pointer",
                  }}
                >
                  <span style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                    color: cat.color, background: cat.color + "14", borderRadius: 50, padding: "4px 12px",
                    display: "inline-block", marginBottom: 14,
                  }}>{r.type}</span>
                  <h4 style={{ fontSize: 15, fontWeight: 600, color: "#0A1F44", margin: "0 0 12px", lineHeight: 1.4 }}>{r.title}</h4>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "#7A8CAB" }}><FiClock style={{ verticalAlign: -2, marginRight: 4 }} />{r.time}</span>
                    <FiArrowRight style={{ color: cat.color }} />
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ── FAQ Section ── */}
        {cat.faqs.length > 0 && (
          <section ref={sectionRefs.faq} style={{ padding: "72px 0 0" }}>
            <SectionHeading eyebrow="FAQ" title="Frequently Asked Questions" />
            <div style={{ maxWidth: 760 }}>
              {cat.faqs.map((faq, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  style={{
                    background: "#fff", border: "1px solid #E8EEF8", borderRadius: 16,
                    marginBottom: 12, overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "20px 24px", background: "none", border: "none", cursor: "pointer",
                      textAlign: "left", gap: 16,
                    }}
                  >
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#0A1F44", lineHeight: 1.4 }}>{faq.q}</span>
                    <span style={{ color: cat.color, flexShrink: 0 }}>
                      {openFaq === i ? <FiChevronUp /> : <FiChevronDown />}
                    </span>
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        style={{ overflow: "hidden" }}
                      >
                        <div style={{ padding: "0 24px 20px", fontSize: 14, color: "#556080", lineHeight: 1.7, borderTop: "1px solid #F0F4FB" }}>
                          <div style={{ paddingTop: 14 }}>{faq.a}</div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ── CTA Section ── */}
        <section style={{ padding: "72px 0 80px" }}>
          <div style={{
            background: `linear-gradient(135deg, ${cat.color} 0%, ${cat.colorDark || cat.color} 100%)`,
            borderRadius: 28, padding: "clamp(36px,5vw,64px)",
            display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", right: -60, bottom: -60, width: 300, height: 300, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", left: -40, top: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", marginBottom: 16 }}>
              {cat.label}
            </span>
            <h2 style={{ fontSize: "clamp(24px,3.5vw,40px)", fontWeight: 800, color: "#fff", margin: "0 0 16px", lineHeight: 1.2 }}>
              Get Expert Care Today
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.82)", maxWidth: 480, lineHeight: 1.7, marginBottom: 36 }}>
              Connect with experienced {cat.label} specialists — same-day appointments often available.
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
              <button style={{
                background: "#fff", color: cat.color, border: "none", borderRadius: 50,
                padding: "14px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
              }}>
                Find Doctors <FiArrowRight />
              </button>
              <button style={{
                background: "rgba(255,255,255,0.15)", color: "#fff", border: "2px solid rgba(255,255,255,0.4)", borderRadius: 50,
                padding: "12px 32px", fontSize: 15, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8, backdropFilter: "blur(8px)",
              }}>
                Book Consultation <FiCalendar />
              </button>
            </div>
          </div>
        </section>

      </div>

      {/* ── Mobile sticky CTA ── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        display: "none", // handled via media query below
        background: "#fff", borderTop: "1px solid #E8EEF8", padding: "12px 20px",
        gap: 10,
        "@media (max-width: 768px)": { display: "flex" },
      }} className="mobile-cta">
        <button style={{
          flex: 1, background: cat.color, color: "#fff", border: "none", borderRadius: 50,
          padding: "13px", fontSize: 14, fontWeight: 700, cursor: "pointer",
        }}>Book Appointment</button>
      </div>

      {/* ── All Categories Drawer ── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(10,31,68,0.4)", zIndex: 200, backdropFilter: "blur(4px)" }}
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              style={{
                position: "fixed", right: 0, top: 0, bottom: 0, width: "min(420px,95vw)",
                background: "#fff", zIndex: 201, overflowY: "auto", padding: 32,
                boxShadow: "-8px 0 40px rgba(10,31,68,0.15)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: "#0A1F44", margin: 0 }}>All Categories</h3>
                <button onClick={() => setDrawerOpen(false)} style={{ background: "#F7FAFF", border: "none", borderRadius: 50, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <FiX style={{ color: "#445577" }} />
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.values(ALL_CATEGORIES).map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setActiveCategory(c.id); setDrawerOpen(false); setConditionSearch(""); setActiveSymptom(null); setOpenFaq(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      background: c.id === activeCategory ? c.color + "12" : "#F7FAFF",
                      border: `1.5px solid ${c.id === activeCategory ? c.color : "#E8EEF8"}`,
                      borderRadius: 14, padding: "14px 18px", cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: 24, lineHeight: 1 }}>{c.icon}</span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#0A1F44" }}>{c.label}</div>
                      <div style={{ fontSize: 12, color: "#7A8CAB", marginTop: 2 }}>{c.tagline}</div>
                    </div>
                    {c.id === activeCategory && <FiCheckCircle style={{ marginLeft: "auto", color: c.color }} />}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 768px) {
          .mobile-cta { display: flex !important; }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #F7FAFF; }
        ::-webkit-scrollbar-thumb { background: #C8DFFF; border-radius: 99px; }
      `}</style>
    </div>
  );
}

// ─── Condition Card ───────────────────────────────────────────────────────────

function ConditionCard({ cond, color, index }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#fff", border: `1px solid ${hovered ? color + "40" : "#E8EEF8"}`,
        borderRadius: 20, padding: "22px", cursor: "pointer",
        transition: "border-color 0.2s, box-shadow 0.2s",
        boxShadow: hovered ? `0 8px 24px ${color}14` : "none",
      }}
    >
      <h4 style={{ fontSize: 15, fontWeight: 700, color: "#0A1F44", margin: "0 0 8px" }}>{cond.name}</h4>
      <p style={{ fontSize: 13, color: "#556080", lineHeight: 1.55, margin: "0 0 14px" }}>{cond.desc}</p>
      <AnimatePresence>
        {hovered && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
            <div style={{ borderTop: "1px solid #F0F4FB", paddingTop: 12, marginTop: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7A8CAB", marginBottom: 8 }}>Common Symptoms</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {cond.symptoms.map((s, i) => (
                  <span key={i} style={{ fontSize: 12, background: color + "10", color, borderRadius: 50, padding: "3px 10px", fontWeight: 500 }}>{s}</span>
                ))}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7A8CAB", marginBottom: 8 }}>Specialists</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {cond.specialists.map((s, i) => (
                  <span key={i} style={{ fontSize: 12, background: "#F7FAFF", border: "1px solid #E8EEF8", color: "#445577", borderRadius: 50, padding: "3px 10px" }}>{s}</span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Doctor Card ──────────────────────────────────────────────────────────────

function DoctorCard({ doc, color, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.07 }}
      style={{
        background: "#fff", border: "1px solid #E8EEF8", borderRadius: 22, padding: "24px",
        display: "flex", flexDirection: "column", gap: 0,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
        <Avatar initials={doc.initials} color={color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0A1F44" }}>{doc.name}</div>
          <div style={{ fontSize: 13, color: "#445577", marginTop: 2 }}>{doc.specialty}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
            <StarRating rating={doc.rating} />
            <span style={{ fontSize: 12, color: "#7A8CAB" }}>({doc.reviews} reviews)</span>
          </div>
        </div>
        <div style={{
          background: doc.avail === "Today" ? "#DCFCE7" : "#F7FAFF",
          color: doc.avail === "Today" ? "#16A34A" : "#445577",
          fontSize: 11, fontWeight: 700, borderRadius: 50, padding: "4px 10px", whiteSpace: "nowrap",
        }}>{doc.avail}</div>
      </div>

      {/* Details */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{ fontSize: 12, background: "#F7FAFF", border: "1px solid #E8EEF8", color: "#445577", borderRadius: 50, padding: "4px 10px" }}>
          <FiClock style={{ verticalAlign: -2, marginRight: 3, fontSize: 10 }} />{doc.exp} exp.
        </span>
        {doc.langs.map((l, i) => (
          <span key={i} style={{ fontSize: 12, background: "#F7FAFF", border: "1px solid #E8EEF8", color: "#445577", borderRadius: 50, padding: "4px 10px" }}>{l}</span>
        ))}
      </div>

      {/* Fee + Buttons */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, borderTop: "1px solid #F0F4FB" }}>
        <div>
          <div style={{ fontSize: 11, color: "#7A8CAB" }}>Consultation</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#0A1F44" }}>{doc.fee}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{
            background: "#F7FAFF", border: "1px solid #E8EEF8", color: "#0A1F44", borderRadius: 50,
            padding: "8px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer",
          }}>Profile</button>
          <button style={{
            background: color, color: "#fff", border: "none", borderRadius: 50,
            padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            boxShadow: `0 3px 12px ${color}40`,
          }}>Book</button>
        </div>
      </div>
    </motion.div>
  );
}