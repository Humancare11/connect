import { useState } from "react";
import {
  Calendar, Star, Shield, ShieldCheck, Clock, Video, Pill, Heart, Activity,
  ChevronDown, ChevronRight, Phone, CheckCircle, AlertTriangle,
  Stethoscope, Brain, Zap, Users, Award, ArrowRight, MapPin,
  FileText, FlaskConical, Scan, Microscope, Thermometer, Wind,
  HeartPulse, Syringe, Eye, Bone, CircleDot, Smile, TrendingUp,
  MessageCircle, X
} from "lucide-react";
import "./primarycare.css";
import Bghero from "../../assets/primary-care-hero.jpg";

// ────────────────────────────────────────────────────────────
// DESIGN TOKENS  (matches brand CSS variables)
// ────────────────────────────────────────────────────────────
// --ink: #0A1F44  --blue: #0B57E8  --blue-3: #7CB7FF
// --blue-4: #C8DFFF  --navy: #061333  --muted: #5C7099

// ────────────────────────────────────────────────────────────
// DATA
// ────────────────────────────────────────────────────────────

const specialty = {
  badge: "Primary Care",
  heading: "Comprehensive Care For Every Stage Of Life",
  description:
    "Personalized healthcare focused on prevention, diagnosis, treatment and long-term wellness. Connect with experienced physicians dedicated to keeping you and your family healthy.",
  trustItems: [
    "Same Day Visits",
    "Insurance Accepted",
    "Virtual Care",
  ],
};

const relatedSpecialties = [
  { icon: Brain, name: "Mental Health", color: "#F4F0FF", accent: "#7C3AED" },
  { icon: Zap, name: "Urgent Care", color: "#FFF0EE", accent: "#DC2626" },
  { icon: Heart, name: "Women's Health", color: "#FFF0F3", accent: "#DB2777" },
  { icon: Smile, name: "Pediatrics", color: "#EDFCF2", accent: "#059669" },
  { icon: Brain, name: "Mental Health", color: "#F4F0FF", accent: "#7C3AED" },
  { icon: Zap, name: "Urgent Care", color: "#FFF0EE", accent: "#DC2626" },
  { icon: Heart, name: "Women's Health", color: "#FFF0F3", accent: "#DB2777" },
  { icon: Smile, name: "Pediatrics", color: "#EDFCF2", accent: "#059669" },
];


// Rich symptom data for expanded cards
const symptomData = [
  { title: "Fever",               desc: "Elevated body temperature often signals infection. See a doctor if it exceeds 103°F or lasts more than 3 days." },
  { title: "Headache",            desc: "Can range from tension headaches to migraines. Sudden, severe headaches need immediate evaluation." },
  { title: "Fatigue",             desc: "Persistent tiredness may indicate anaemia, thyroid issues, or other conditions. Don't dismiss chronic fatigue." },
  { title: "Nausea",              desc: "Often tied to GI issues, medications, or infections. Prolonged nausea warrants a medical review." },
  { title: "Dizziness",           desc: "Vertigo or lightheadedness can stem from inner ear, blood pressure, or neurological causes." },
  { title: "Cough",               desc: "A cough lasting more than 3 weeks, or producing blood or thick mucus, should be evaluated promptly." },
  { title: "Anxiety",             desc: "Persistent worry, racing thoughts, or panic attacks benefit from professional mental health support." },
  { title: "Back Pain",           desc: "Acute or chronic back pain can affect posture and mobility. Early treatment prevents long-term damage." },
  { title: "Shortness of Breath", desc: "Difficulty breathing can signal respiratory or cardiac conditions. Seek urgent care if sudden or severe." },
  { title: "Sore Throat",         desc: "Often viral, but strep throat requires antibiotics. Difficulty swallowing needs prompt attention." },
  { title: "Chest Pain",          desc: "Always take chest pain seriously. It may indicate cardiac, muscular, or gastrointestinal causes." },
  { title: "Joint Pain",          desc: "Swollen or stiff joints may indicate arthritis or injury. Early diagnosis preserves joint function." },
  { title: "Loss of Appetite",    desc: "Unexplained appetite loss can be linked to digestive, mental, or systemic health conditions." },
  { title: "Insomnia",            desc: "Chronic sleep difficulty affects mood, cognition, and immunity. CBT and medical review can help." },
  { title: "Skin Rash",           desc: "Rashes can signal allergies, infections, or autoimmune conditions. Sudden rashes need evaluation." },
];

const whyUs = [
  { icon: Award, title: "Board Certified Doctors", desc: "Every physician is credentialed and continuously trained." },
  { icon: Clock, title: "Fast Scheduling", desc: "Book an appointment in under 60 seconds." },
  { icon: Video, title: "Online Consultations", desc: "See a doctor from anywhere, anytime." },
  { icon: Shield, title: "Insurance Support", desc: "Dedicated team to help navigate your coverage." },
  { icon: FileText, title: "Personalised Plans", desc: "Care designed around your unique health profile." },
  { icon: Pill, title: "Digital Prescriptions", desc: "Sent directly to your pharmacy — no paper needed." },
];

// ────────────────────────────────────────────────────────────
// UTILITY COMPONENTS
// ────────────────────────────────────────────────────────────

const SectionLabel = ({ children, variant = "light" }) => (
  <span style={{
    display: "inline-block",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: variant === "dark" ? "#7CB7FF" : "#0B57E8",
    background: variant === "dark" ? "rgba(124,183,255,.12)" : "#EEF4FF",
    border: variant === "dark" ? "1px solid rgba(124,183,255,.22)" : "1px solid transparent",
    padding: "4px 12px",
    borderRadius: 20,
    marginBottom: 12,
  }}>
    {children}
  </span>
);

// ────────────────────────────────────────────────────────────
// HERO SECTION  
// ────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <>
     
      <section
        className="hs-root"
        style={{
          backgroundImage: `
            linear-gradient(
              105deg,
              rgba(6,19,51,.97)  0%,
              rgba(10,31,68,.90) 30%,
              rgba(10,31,68,.72) 62%,
              rgba(10,31,68,.48) 100%
            ),
            url(${Bghero})
          `,
          backgroundSize: "cover",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* ── decorative ambient glows ── */}
        <div className="hs-glow hs-glow--tr" />
        <div className="hs-glow hs-glow--bl" />

        {/* ── floating background icons (decorative only) ── */}
        <div className="hs-float-icon hs-float-icon--1">
          <HeartPulse size={44} color="#ffffff" />
        </div>
        <div className="hs-float-icon hs-float-icon--2">
          <ShieldCheck size={52} color="#ffffff" />
        </div>
        <div className="hs-float-icon hs-float-icon--3">
          <Stethoscope size={40} color="#ffffff" />
        </div>

        {/* ── content wrapper ── */}
        <div className="hs-container">
          <div className="hs-content">

            {/* badge — always at very top of content */}
            <span className="hs-badge" style={{ animation: "fadeUp .75s .00s cubic-bezier(.22,.68,0,1.2) both" }}>
              ✦ Trusted {specialty.badge}
            </span>

            <h1 className="hs-heading" style={{ animation: "fadeUp .85s .10s cubic-bezier(.22,.68,0,1.2) both" }}>
              {specialty.heading}
            </h1>

            <p className="hs-desc" style={{ animation: "fadeUp .85s .18s cubic-bezier(.22,.68,0,1.2) both" }}>
              {specialty.description}
            </p>

            {/* CTA buttons */}
            <div className="hs-btns" style={{ animation: "fadeUp .85s .26s cubic-bezier(.22,.68,0,1.2) both" }}>
              <button
                className="hs-btn hs-btn--primary"
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 20px 40px rgba(11,87,232,.60)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
              >
                <Calendar size={15} /> Book Appointment
              </button>
              <button
                className="hs-btn hs-btn--ghost"
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.16)"; e.currentTarget.style.borderColor = "rgba(255,255,255,.30)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = ""; e.currentTarget.style.borderColor = ""; }}
              >
                <Users size={15} /> Know More
              </button>
            </div>

            {/* trust items */}
            <div className="hs-trust" style={{ animation: "fadeUp .85s .34s cubic-bezier(.22,.68,0,1.2) both" }}>
              {specialty.trustItems.map((item) => (
                <div key={item} className="hs-trust-item">
                  <CheckCircle size={13} className="hs-trust-check" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

    </>
  );
}

// ────────────────────────────────────────────────────────────
// ABOUT SPECIALTY  
// ────────────────────────────────────────────────────────────

function AboutSpecialty() {
  return (
    <>
      {/* ── Glassmorphism outer card ── */}
      <div className="about-glass-card">

        {/* subtle inner grid noise/shine layer */}
        <div className="about-glass-shine" />

        <div
          className="about-grid"
        >
          {/* ── LEFT: compact quick-access panel ── */}
          <div className="about-left">
            <SectionLabel>About This Specialty</SectionLabel>
            <h2 className="about-left-heading">
              Your Health,<br />Our Priority
            </h2>

            {/* Quick Access nav card – kept dark, now feels embedded */}
            <div className="about-nav-card">
              <p className="about-nav-label">Quick Access</p>
              <div className="about-nav-list">
                {["Routine Wellness", "Acute Illness", "Chronic Conditions", "Mental Wellbeing"].map((item) => (
                  <div key={item} className="about-nav-item">
                    <ChevronRight size={13} className="about-nav-chevron" />
                    <span className="about-nav-text">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* small decorative stat pills */}
            <div className="about-stat-row">
              <div className="about-stat-pill">
                <HeartPulse size={13} />
                <span>15 K+ Patients</span>
              </div>
              <div className="about-stat-pill">
                <ShieldCheck size={13} />
                <span>98% Satisfaction</span>
              </div>
            </div>
          </div>

          {/* ── RIGHT: wide content area ── */}
          <div className="about-right">

            <div className="about-block">
              <h3 className="about-block-title">What Is Primary Care?</h3>
              <p className="about-block-body">
                Primary care is the foundation of the healthcare system — providing comprehensive,
                continuous medical care across all ages, genders, and conditions. Your primary care
                physician acts as a personal health advocate, coordinating specialist care and managing
                preventive health goals.
              </p>
            </div>

            <div className="about-block">
              <h3 className="about-block-title">Who Should Visit?</h3>
              <p className="about-block-body">
                Everyone benefits from a primary care relationship — from newborns and children to
                adults and seniors. Whether you're managing a chronic condition, recovering from illness,
                or simply maintaining your health, primary care is your starting point.
              </p>
            </div>

            <div className="about-block">
              <h3 className="about-block-title">Benefits of Regular Primary Care</h3>
              <div className="about-benefits-grid">
                {[
                  "Earlier disease detection",
                  "Lower healthcare costs",
                  "Coordinated specialist care",
                  "Better long-term outcomes",
                  "Personalised health plans",
                  "Medication management",
                ].map((b) => (
                  <div key={b} className="about-benefit-item">
                    <CheckCircle size={14} className="about-benefit-check" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

     
    </>
  );
}

// ────────────────────────────────────────────────────────────
// STICKY BOOKING CARD  (unchanged)
// ────────────────────────────────────────────────────────────
function StickyBookingCard() {
  return (
    <>
      <div className="sbc-card">
        <div className="sbc-badge">
          <span className="sbc-badge-dot" />
          Doctors Available Now
        </div>
        <div className="sbc-price-block">
          <div className="sbc-price">$49</div>
          <p className="sbc-price-sub">One-time consultation fee · No subscription required</p>
        </div>
        <div className="sbc-info-box">
          <Shield size={15} className="sbc-info-icon" />
          <p className="sbc-info-text">
            No extra fee for doctor notes, prescriptions, or specialist referrals.{" "}
            <strong>Everything is included.</strong>
          </p>
        </div>
        <div className="sbc-features">
          {[
            "Board-certified physician",
            "Rx to your pharmacy",
            "Doctor's note included",
            "24hr follow-up support",
            "HIPAA secure session",
          ].map((item, i) => (
            <div key={item} className="sbc-feature-row" style={{ animationDelay: `${0.35 + i * 0.07}s` }}>
              <div className="sbc-check-wrap"><CheckCircle size={15} className="sbc-check-icon" /></div>
              <span className="sbc-feature-text">{item}</span>
            </div>
          ))}
        </div>
        <button className="sbc-cta-btn">Start Consultation →</button>
        <p className="sbc-terms">
          By continuing, you agree to our{" "}
          <a href="#" className="sbc-link">Terms of Service</a> and{" "}
          <a href="#" className="sbc-link">Privacy Policy</a>
        </p>
      </div>

     
    </>
  );
}

// ────────────────────────────────────────────────────────────
// SYMPTOMS CHIPS — expand-on-hover cards
// ────────────────────────────────────────────────────────────
function SymptomsChips() {
  return (
    <>
      <section className="sc-section">
        <div className="sc-container">

          {/* ── header ── */}
          <div className="sc-header">
            <SectionLabel>Common Symptoms</SectionLabel>
            <h2 className="sc-heading">Recognise Your Symptoms</h2>
            <p className="sc-subtext">Hover a symptom card to learn more and find the right care.</p>
          </div>

          {/* ── cards grid ── */}
          <div className="sc-grid">
            {symptomData.map((item, i) => (
              <div
                key={item.title}
                className="sc-card"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                {/* collapsed row — always visible */}
                <div className="sc-card-top">
                  <span className="sc-icon">{item.icon}</span>
                  <span className="sc-title">{item.title}</span>
                  <span className="sc-arrow">→</span>
                </div>

                {/* expanded content — revealed on hover */}
                <div className="sc-card-body">
                  <p className="sc-desc">{item.desc}</p>
                  <span className="sc-cta">Find care →</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

    </>
  );
}

// ────────────────────────────────────────────────────────────
// RELATED SPECIALTIES 
// ────────────────────────────────────────────────────────────
function RelatedSpecialties() {
  return (
    <section style={{ background: "#F8FAFE", padding: "64px 0" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ marginBottom: 36 }}>
          <SectionLabel>Related Specialties</SectionLabel>
          <h2 style={{ fontSize: 30, fontWeight: 800, color: "#0A1F44", fontFamily: "'Georgia', serif", marginTop: 8 }}>Explore Other Specialties</h2>
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
          gap: 16,
        }}>
          {relatedSpecialties.map((s) => (
            <div key={s.name} style={{
              background: s.color, borderRadius: 16, padding: "24px 20px",
              cursor: "pointer", transition: "all 0.25s",
              display: "flex", flexDirection: "column", gap: 14,
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px -10px rgba(11,40,100,0.15)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <s.icon size={20} style={{ color: s.accent }} />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#0A1F44", marginBottom: 4 }}>{s.name}</p>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#5C7099", fontWeight: 500 }}>
                  Learn More <ArrowRight size={12} />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────
// WHY CHOOSE US  
// ────────────────────────────────────────────────────────────
function WhyChooseUs() {
  return (
    <section style={{ background: "#0A1F44", padding: "80px 0" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <SectionLabel variant="dark">Why HumanCare Connect</SectionLabel>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: "#fff", fontFamily: "'Georgia', serif", marginTop: 8 }}>The Standard of Modern Healthcare</h2>
          <p style={{ color: "#7CB7FF", fontSize: 16, marginTop: 12 }}>Built for patients who deserve better.</p>
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
          gap: 20,
        }}>
          {whyUs.map((w) => (
            <div key={w.title} style={{
              background: "rgba(255,255,255,0.06)", backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16,
              padding: "28px 24px", transition: "all 0.25s", cursor: "default",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.transform = "translateY(-4px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(11,87,232,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <w.icon size={20} style={{ color: "#7CB7FF" }} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{w.title}</p>
              <p style={{ fontSize: 13, color: "#7CB7FF", lineHeight: 1.65 }}>{w.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


// ────────────────────────────────────────────────────────────
// FAQ DATA
// ────────────────────────────────────────────────────────────
const faqData = [
  {
    category: "Appointments",
    items: [
      {
        q: "How do I book a primary care appointment?",
        a: "You can book online in under 60 seconds — just click \"Book Appointment\" at the top of the page, choose a date and time that works for you, and confirm. Same-day slots are often available. You can also call us directly or use our mobile app.",
      },
      {
        q: "Can I see a doctor the same day?",
        a: "Yes. We reserve same-day slots every morning for acute concerns. If you log in before 10 AM, you'll typically find availability for that day. For non-urgent visits, booking 1–2 days ahead gives you the widest choice of physicians.",
      },
      {
        q: "What should I bring to my first visit?",
        a: "Bring a valid photo ID, your insurance card, a list of any current medications (including supplements), and any recent lab results or specialist notes if you have them. Arriving 10 minutes early lets us complete intake paperwork before your appointment time.",
      },
    ],
  },
  {
    category: "Virtual Care",
    items: [
      {
        q: "How does an online consultation work?",
        a: "After booking, you'll receive a secure video link by email and SMS. At your appointment time, click the link — no app download required. Your doctor will join within minutes, review your concerns, and can issue prescriptions, referrals, or lab orders directly from the session.",
      },
      {
        q: "What conditions can be treated virtually?",
        a: "Most common illnesses and follow-ups are well-suited to video care — colds, infections, skin concerns, mental health check-ins, prescription renewals, and chronic disease management. Conditions requiring a physical exam (suspected fractures, chest pain, etc.) will be directed to in-person or urgent care.",
      },
    ],
  },
  {
    category: "Costs & Insurance",
    items: [
      {
        q: "Do you accept my insurance?",
        a: "We work with most major insurance plans including Aetna, Cigna, UnitedHealth, BlueCross BlueShield, Humana, and Medicare. Our billing team will verify your coverage before your appointment and let you know your estimated out-of-pocket costs upfront — no surprises.",
      },
      {
        q: "What is the consultation fee if I'm uninsured?",
        a: "Our self-pay consultation fee is $49 for a standard visit — this covers the appointment, any prescriptions written, a doctor's note if needed, and 24-hour follow-up support. There are no hidden add-on fees.",
      },
      {
        q: "Are referrals and lab orders included in the fee?",
        a: "Yes. Specialist referrals and lab test orders issued during your visit are included at no extra charge. The cost of the lab tests themselves depends on your insurance or the lab's self-pay rate, but we'll always let you know before ordering.",
      },
    ],
  },
  {
    category: "Your Health & Records",
    items: [
      {
        q: "How do I access my medical records?",
        a: "All visit notes, lab results, and prescription history are available in your secure patient portal within 24 hours of your appointment. You can download, share, or print records at any time. For records from before joining us, our team can assist with transfer requests.",
      },
      {
        q: "Can my primary care doctor manage chronic conditions like diabetes or hypertension?",
        a: "Absolutely. Chronic disease management is one of our core services. Your physician will create a personalised care plan, schedule regular monitoring visits, coordinate with any specialists you see, and adjust medications as needed — all in one continuous relationship.",
      },
    ],
  },
];
 
// ────────────────────────────────────────────────────────────
// FAQ ITEM (accordion row)
// ────────────────────────────────────────────────────────────
function FaqItem({ q, a, isOpen, onToggle, isLast }) {
  return (
    <div
      className={`border-b transition-colors duration-200 ${isLast ? "border-transparent" : "border-[#E8EFFE]"}`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-4 py-5 text-left group focus:outline-none"
      >
        {/* question */}
        <span
          className={`text-[15px] font-semibold leading-snug transition-colors duration-200 pr-2
            ${isOpen ? "text-[#0B57E8]" : "text-[#0A1F44] group-hover:text-[#0B57E8]"}`}
        >
          {q}
        </span>
 
        {/* +/− icon */}
        <span
          className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center border transition-all duration-300
            ${isOpen
              ? "bg-[#0B57E8] border-[#0B57E8] text-white rotate-45"
              : "bg-[#EEF4FF] border-[#C8DFFF] text-[#0B57E8] group-hover:bg-[#D8E9FF]"
            }`}
          style={{ fontSize: 18, lineHeight: 1, fontWeight: 300 }}
        >
          +
        </span>
      </button>
 
      {/* answer — max-height transition */}
      <div
        className="overflow-hidden transition-all"
        style={{
          maxHeight:      isOpen ? "320px"  : "0px",
          opacity:        isOpen ? 1        : 0,
          transitionDuration:      "360ms",
          transitionTimingFunction: isOpen
            ? "cubic-bezier(0.34, 1.10, 0.64, 1)"
            : "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          transitionProperty: "max-height, opacity",
        }}
      >
        <p className="pb-5 text-[14.5px] text-[#5C7099] leading-[1.78]">
          {a}
        </p>
      </div>
    </div>
  );
}
 
// ────────────────────────────────────────────────────────────
// FAQ SECTION
// ────────────────────────────────────────────────────────────
function FaqSection() {
  const [openId, setOpenId] = useState("0-0");

  const toggle = (id) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section
      style={{
        background: "#F7FAFF",
        padding: "90px 0",
      }}
    >
      <div
        style={{
          maxWidth: "1240px",
          margin: "0 auto",
          padding: "0 24px",
        }}
      >
        <div className="faq-layout">
          {/* LEFT SIDE */}
          <div className="faq-sidebar">
            <SectionLabel>FAQ</SectionLabel>

            <h2 className="faq-title">
              Frequently Asked
              <br />
              Questions
            </h2>

            <p className="faq-description">
              Everything you need to know about primary care at HumanCare
              Connect. Can't find an answer?
            </p>

            <button className="faq-chat-btn">
              <MessageCircle size={18} />
              Chat with our team
            </button>

            <div className="faq-stat">
              ⚡ Avg. response in 2 min
            </div>

            <div className="faq-stat">
              🔒 HIPAA secure & private
            </div>

            <div className="faq-stat">
              🌍 Available in all 50 states
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="faq-content">
            {faqData.map((cat, ci) => (
              <div key={cat.category} className="faq-card">
                <div className="faq-category">
                  <span className="faq-dot" />
                  {cat.category}
                </div>

                {cat.items.map((item, ii) => {
                  const id = `${ci}-${ii}`;

                  return (
                    <div key={id} className="faq-item">
                      <button
                        className="faq-question"
                        onClick={() => toggle(id)}
                      >
                        <span>{item.q}</span>

                        <div
                          className={`faq-icon ${
                            openId === id ? "active" : ""
                          }`}
                        >
                          +
                        </div>
                      </button>

                      <div
                        className={`faq-answer ${
                          openId === id ? "open" : ""
                        }`}
                      >
                        <p>{item.a}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            <div className="faq-bottom-cta">
              <div>
                <h3>Still have questions?</h3>
                <p>
                  Our care team is available every day,
                  8 AM – 10 PM.
                </p>
              </div>

              <button>
                Book a Free Call
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────
// MAIN APP
// ────────────────────────────────────────────────────────────

export default function PrimaryCare() {
  return (
    <>
      <style>{`
        .pc-layout {
          max-width: 1240px;
          margin: 0 auto;
          padding: 0 24px;
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 48px;
          align-items: stretch;   /* main col + aside grow to same height */
        }
        /* main needs to be a flex container so AboutSpecialty fills it */
        .pc-layout > main {
          display: flex;
          flex-direction: column;
        }
        .pc-layout > main > * {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        @media (max-width: 1024px) {
          .pc-layout {
            grid-template-columns: 1fr;
            align-items: start;
          }
          .pc-aside {
            padding-top: 0 !important;
          }
          /* reset flex stretch on mobile — cards size naturally */
          .pc-layout > main,
          .pc-layout > main > * {
            flex: unset;
            display: block;
          }
        }
      `}</style>

      <div style={{ fontFamily: "Satoshi, sans-serif", color: "#0A1F44", background: "#fff" }}>
        <HeroSection />

        {/* ── page background gets a subtle blue-tinted gradient so glass reads well ── */}
        <div style={{
          background: "linear-gradient(180deg, #EEF4FF 0%, #F6F9FF 60%, #ffffff 100%)",
        }}>
          <div className="pc-layout" style={{ padding: "72px 24px" }}>
            <main>
              <AboutSpecialty />
            </main>
            <aside className="pc-aside" style={{ paddingTop: 0 }}>
              <StickyBookingCard />
            </aside>
          </div>
        </div>

        <SymptomsChips />
        <RelatedSpecialties />
        <WhyChooseUs />
        <FaqSection />
      </div>
    </>
  );
}