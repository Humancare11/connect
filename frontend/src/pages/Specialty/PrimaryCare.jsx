import { useState } from "react";
import {
  Calendar, Star, Shield, ShieldCheck, Clock, Video, Pill, Heart, Activity,
  ChevronDown, ChevronRight, Phone, CheckCircle, AlertTriangle,
  Stethoscope, Brain, Zap, Users, Award, ArrowRight, MapPin,
  FileText, FlaskConical, Scan, Microscope, Thermometer, Wind,
  HeartPulse, Syringe, Eye, Bone, CircleDot, Smile, TrendingUp,
  MessageCircle, X
} from "lucide-react";
import Bghero from "../../assets/primary-care-hero.jpg";

// ────────────────────────────────────────────────────────────
// DATA
// ────────────────────────────────────────────────────────────

const specialty = {
  badge: "Primary Care",
  heading: "Comprehensive Care For Every Stage Of Life",
  description:
    "Personalized healthcare focused on prevention, diagnosis, treatment and long-term wellness. Connect with experienced physicians dedicated to keeping you and your family healthy through every stage of life.",
  stats: [
    { value: "15K+", label: "Patients Served" },
    { value: "250+", label: "Specialists" },
    { value: "98%", label: "Patient Satisfaction" },
    { value: "24/7", label: "Support Available" },
  ],
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
];

const symptoms = [
  "Fever", "Headache", "Fatigue", "Nausea", "Dizziness",
  "Cough", "Anxiety", "Back Pain", "Shortness of Breath",
  "Sore Throat", "Chest Pain", "Joint Pain", "Loss of Appetite",
  "Insomnia", "Skin Rash",
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

const Stars = ({ rating }) => (
  <span style={{ display: "flex", gap: 2 }}>
    {[...Array(5)].map((_, i) => (
      <Star key={i} size={14} style={{ fill: i < rating ? "#F59E0B" : "none", color: i < rating ? "#F59E0B" : "#D1D5DB" }} />
    ))}
  </span>
);

// ────────────────────────────────────────────────────────────
// HERO SECTION
// ────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <>
      <section
        className="hero-section"
        style={{
          position: "relative",
          height: "clamp(520px, 70vh, 680px)",
          padding: "40px 0 30px",
          overflow: "hidden",
          backgroundImage: `
            linear-gradient(
              90deg,
              rgba(6,19,51,.95) 0%,
              rgba(10,31,68,.88) 35%,
              rgba(10,31,68,.70) 65%,
              rgba(10,31,68,.55) 100%
            ),
            url(${Bghero})
          `,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div style={{
          position: "absolute", top: "8%", right: "8%",
          width: "clamp(180px, 25vw, 320px)", height: "clamp(180px, 25vw, 320px)",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(11,87,232,.35) 0%, transparent 70%)",
          filter: "blur(50px)",
          animation: "floatGlow 8s ease-in-out infinite",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: "0%", left: "5%",
          width: "clamp(150px, 22vw, 280px)", height: "clamp(150px, 22vw, 280px)",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(124,183,255,.20) 0%, transparent 70%)",
          filter: "blur(50px)",
          animation: "floatGlow 10s ease-in-out infinite",
          pointerEvents: "none",
        }} />

        <div style={{ position: "absolute", top: "18%", right: "18%", animation: "floatIcon 5s ease-in-out infinite", opacity: 0.15 }}>
          <HeartPulse size={46} color="#ffffff" />
        </div>
        <div style={{ position: "absolute", bottom: "22%", right: "10%", animation: "floatIcon 7s ease-in-out infinite", opacity: 0.12 }}>
          <ShieldCheck size={54} color="#ffffff" />
        </div>
        <div style={{ position: "absolute", top: "50%", right: "30%", animation: "floatIcon 6s ease-in-out infinite", opacity: 0.1 }}>
          <Stethoscope size={46} color="#ffffff" />
        </div>

        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "40px 24px", width: "100%", position: "relative", zIndex: 5 }}>
          <div style={{ maxWidth: "680px", animation: "fadeUp .85s cubic-bezier(.22,.68,0,1.2) both" }}>

            <span style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              padding: "7px 14px", borderRadius: "999px",
              background: "rgba(255,255,255,.08)", backdropFilter: "blur(15px)",
              border: "1px solid rgba(255,255,255,.15)", color: "#7CB7FF",
              fontSize: "12px", fontWeight: 700, marginBottom: "16px", letterSpacing: ".04em",
            }}>
              ✦ Trusted {specialty.badge}
            </span>

            <h1 style={{
              fontSize: "clamp(28px, 3.8vw, 48px)", lineHeight: 1.08, fontWeight: 900,
              color: "#ffffff", marginBottom: "16px", letterSpacing: "-1.5px",
              textShadow: "0 2px 24px rgba(11,87,232,.25)",
              animation: "fadeUp .85s .1s cubic-bezier(.22,.68,0,1.2) both",
            }}>
              {specialty.heading}
            </h1>

            <p style={{
              fontSize: "clamp(13px, 1.4vw, 15px)", lineHeight: 1.65, color: "#D8E6FF",
              maxWidth: "560px", marginBottom: "28px",
              animation: "fadeUp .85s .18s cubic-bezier(.22,.68,0,1.2) both",
            }}>
              {specialty.description}
            </p>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "28px", animation: "fadeUp .85s .26s cubic-bezier(.22,.68,0,1.2) both" }}>
              <button style={{
                background: "linear-gradient(135deg,#0B57E8,#256DFF)", color: "#fff",
                border: "none", borderRadius: "12px", padding: "13px 24px",
                fontSize: "13px", fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", gap: "8px",
                boxShadow: "0 12px 28px rgba(11,87,232,.40)", transition: "transform .2s, box-shadow .2s",
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 18px 36px rgba(11,87,232,.55)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 12px 28px rgba(11,87,232,.40)"; }}
              >
                <Calendar size={15} /> Book Appointment
              </button>
              <button style={{
                background: "rgba(255,255,255,.08)", backdropFilter: "blur(15px)",
                color: "#fff", border: "1px solid rgba(255,255,255,.15)",
                borderRadius: "12px", padding: "13px 24px", fontSize: "13px",
                fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
                transition: "background .2s, border-color .2s",
              }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.14)"; e.currentTarget.style.borderColor = "rgba(255,255,255,.28)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,.08)"; e.currentTarget.style.borderColor = "rgba(255,255,255,.15)"; }}
              >
                <Users size={15} /> Find Doctors
              </button>
            </div>

            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "32px", animation: "fadeUp .85s .34s cubic-bezier(.22,.68,0,1.2) both" }}>
              {specialty.trustItems.map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <CheckCircle size={14} style={{ color: "#38D39F" }} />
                  <span style={{ color: "#D8E6FF", fontSize: "12px", fontWeight: 500 }}>{item}</span>
                </div>
              ))}
            </div>

            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "12px", maxWidth: "720px",
              animation: "fadeUp .85s .42s cubic-bezier(.22,.68,0,1.2) both",
            }}>
              {specialty.stats.map((item) => (
                <div key={item.label} style={{
                  background: "rgba(255,255,255,.08)", backdropFilter: "blur(18px)",
                  border: "1px solid rgba(255,255,255,.12)", borderRadius: "16px",
                  padding: "16px 18px", transition: "transform .25s, background .25s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.background = "rgba(255,255,255,.13)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.background = "rgba(255,255,255,.08)"; }}
                >
                  <h3 style={{ fontSize: "clamp(22px, 2.4vw, 28px)", fontWeight: 800, color: "#ffffff", margin: "0 0 4px 0" }}>{item.value}</h3>
                  <p style={{ color: "#C8DFFF", fontSize: "11px", margin: 0, lineHeight: 1.4 }}>{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes floatGlow {
          0%   { transform: translateY(0px) scale(1); }
          50%  { transform: translateY(-28px) scale(1.06); }
          100% { transform: translateY(0px) scale(1); }
        }
        @keyframes floatIcon {
          0%   { transform: translateY(0px) rotate(0deg); }
          50%  { transform: translateY(-14px) rotate(4deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 768px) {
          .hero-section {
            height: auto !important;
            min-height: 520px !important;
          }
        }
        @media (max-width: 480px) {
          .hero-section {
            min-height: 480px !important;
          }
        }
      `}</style>
    </>
  );
}

// ────────────────────────────────────────────────────────────
// ABOUT SPECIALTY
// ────────────────────────────────────────────────────────────

function AboutSpecialty() {
  return (

    <div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
        gap: "clamp(32px, 5vw, 64px)",
        alignItems: "start",
      }}>
        <div>
          <SectionLabel>About This Specialty</SectionLabel>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 800, color: "#0A1F44", lineHeight: 1.2, fontFamily: "'Georgia', serif" }}>
            Your Health, Our Priority
          </h2>
          <div style={{ marginTop: 24, background: "linear-gradient(135deg, #0A1F44 0%, #08308E 100%)", borderRadius: 16, padding: 28 }}>
            <p style={{ color: "#7CB7FF", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Quick Access</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {["Routine Wellness", "Acute Illness", "Chronic Conditions", "Mental Wellbeing"].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <ChevronRight size={14} style={{ color: "#0B57E8" }} />
                  <span style={{ color: "#C8DFFF", fontSize: 14 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0A1F44", marginBottom: 10 }}>What Is Primary Care?</h3>
            <p style={{ color: "#5C7099", lineHeight: 1.8, fontSize: 15 }}>
              Primary care is the foundation of the healthcare system — providing comprehensive, continuous medical care across all ages, genders, and conditions. Your primary care physician acts as a personal health advocate, coordinating specialist care and managing preventive health goals.
            </p>
          </div>
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0A1F44", marginBottom: 10 }}>Who Should Visit?</h3>
            <p style={{ color: "#5C7099", lineHeight: 1.8, fontSize: 15 }}>
              Everyone benefits from a primary care relationship — from newborns and children to adults and seniors. Whether you're managing a chronic condition, recovering from illness, or simply maintaining your health, primary care is your starting point.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0A1F44", marginBottom: 12 }}>Benefits of Regular Primary Care</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: 10 }}>
              {["Earlier disease detection", "Lower healthcare costs", "Coordinated specialist care", "Better long-term outcomes", "Personalised health plans", "Medication management"].map((b) => (
                <div key={b} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle size={15} style={{ color: "#0F9A88", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#2A3F66" }}>{b}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// STICKY BOOKING CARD
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

      <style>{`
        .sbc-card {
          position: sticky;
          top: 120px;
          border: 1px solid #D8E6FF;
  background:
    linear-gradient(
      180deg,
      rgba(255,255,255,1) 0%,
      rgba(248,251,255,1) 100%
    );
          border-radius: 22px;
          padding: clamp(20px, 3.5vw, 28px);
          box-shadow: 0 4px 6px rgba(11,40,100,.04), 0 20px 50px -12px rgba(11,40,100,.14);
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          animation: sbcFadeUp .65s cubic-bezier(.22,.68,0,1.2) both;
          max-width: 360px;
          width: 100%;
          margin: 0 auto;
        }
        .sbc-badge {
          display: inline-flex; align-items: center; gap: 7px;
          background: #EEF4FF;
  color: #0B57E8;
  border: 1px solid #C5DEFF;
          border-radius: 999px; padding: 5px 13px; font-size: 12px;
          font-weight: 700; margin-bottom: 18px; letter-spacing: .02em;
          animation: sbcFadeUp .6s .05s cubic-bezier(.22,.68,0,1.2) both;
        }
        .sbc-badge-dot {
          width: 7px; height: 7px; border-radius: 50%;  background: #0B57E8;
  box-shadow: 0 0 12px rgba(11, 87, 232, 0.5);
          animation: sbcPulse 2s ease-in-out infinite; flex-shrink: 0;
        }
        .sbc-price-block { margin-bottom: 16px; animation: sbcFadeUp .6s .1s cubic-bezier(.22,.68,0,1.2) both; }
        .sbc-price {
          font-size: clamp(48px, 10vw, 64px); font-weight: 900; color: #0A1F44;
          line-height: 1; letter-spacing: -2px; font-family: 'Georgia', serif;
        }
        .sbc-price-sub { font-size: 12.5px; color: #7A90B8; margin: 8px 0 0; line-height: 1.5; }
        .sbc-info-box {
          display: flex; align-items: flex-start; gap: 10px;
          background: #EEF6FF; border: 1px solid #C5DEFF; border-radius: 12px;
          padding: 13px 14px; margin-bottom: 20px; text-align: left;
          animation: sbcFadeUp .6s .16s cubic-bezier(.22,.68,0,1.2) both;
        }
        .sbc-info-icon { color: #0B57E8; flex-shrink: 0; margin-top: 1px; }
        .sbc-info-text { font-size: 12.5px; color: #2255AA; line-height: 1.6; margin: 0; }
        .sbc-info-text strong { color: #0A1F44; font-weight: 700; }
        .sbc-features { width: 100%; display: flex; flex-direction: column; gap: 0; margin-bottom: 22px; }
        .sbc-feature-row {
          display: flex; align-items: center; gap: 10px; padding: 9px 0;
          border-bottom: 1px solid #F0F5FD;
          animation: sbcFadeUp .55s cubic-bezier(.22,.68,0,1.2) both;
          transition: background .18s;
        }
        .sbc-feature-row:last-child { border-bottom: none; }
        .sbc-feature-row:hover { background: #F8FAFF; border-radius: 8px; padding-left: 6px; }
        .sbc-check-wrap { flex-shrink: 0; }
        .sbc-check-icon { color: #1E6BFF; display: block; }
        .sbc-feature-text { font-size: 13px; color: #2A3F66; font-weight: 500; text-align: left; }
        .sbc-cta-btn {
          width: 100%;
          background: linear-gradient(
  135deg,
  #0B57E8 0%,
  #1E6BFF 50%,
  #4D8DFF 100%
);

box-shadow:
  0 8px 24px rgba(11, 87, 232, 0.30),
  0 2px 4px rgba(11, 87, 232, 0.15);
          color: #fff; border: none; border-radius: 50px; padding: 16px 24px;
          font-size: clamp(14px, 2.5vw, 15px); font-weight: 700; cursor: pointer;
          margin-bottom: 12px;
          transition: transform .2s, box-shadow .2s, filter .2s; letter-spacing: .02em;
          animation: sbcFadeUp .6s .55s cubic-bezier(.22,.68,0,1.2) both;
        }
        .sbc-cta-btn:hover {transform: translateY(-2px);  box-shadow: 0 14px 32px rgba(11, 87, 232, 0.38),  0 4px 8px rgba(11, 87, 232, 0.18);  filter: brightness(1.05);
}
        .sbc-cta-btn:active {
  box-shadow: 0 6px 16px rgba(11, 87, 232, 0.25);
}
        .sbc-terms { font-size: 11.5px; color: #9AAAC5; text-align: center; line-height: 1.6; margin: 0; animation: sbcFadeUp .6s .62s cubic-bezier(.22,.68,0,1.2) both; }
        .sbc-link { color: #0B57E8; text-decoration: underline; text-underline-offset: 2px; }
        .sbc-link:hover { color: #0A2FA0; }
        @keyframes sbcFadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sbcPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%       { transform: scale(1.4); opacity: .7; }
        }
        @media (max-width: 1024px) {
          .sbc-card { position: relative; top: auto; max-width: 100%; }
        }
        @media (max-width: 480px) {
          .sbc-card { border-radius: 18px; padding: 20px 18px; }
          .sbc-price { font-size: 52px; }
        }
      `}</style>
    </>
  );
}

// ────────────────────────────────────────────────────────────
// SYMPTOMS CHIPS
// ────────────────────────────────────────────────────────────
function SymptomsChips() {
  return (
    <section style={{ background: "#fff", padding: "64px 0" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ marginBottom: 32 }}>
          <SectionLabel>Common Symptoms</SectionLabel>
          <h2 style={{ fontSize: 30, fontWeight: 800, color: "#0A1F44", fontFamily: "'Georgia', serif", marginTop: 8 }}>Recognise Your Symptoms</h2>
          <p style={{ color: "#5C7099", marginTop: 10, fontSize: 15 }}>Click a symptom to learn more and find the right care.</p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {symptoms.map((s) => (
            <button key={s} style={{
              background: "#F0F5FF", border: "1px solid #C8DFFF", borderRadius: 24,
              padding: "10px 20px", fontSize: 14, fontWeight: 500, color: "#2A3F66",
              cursor: "pointer", transition: "all 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "#0B57E8"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#0B57E8"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#F0F5FF"; e.currentTarget.style.color = "#2A3F66"; e.currentTarget.style.borderColor = "#C8DFFF"; }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </section>
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
    <section style={{ background: "linear-gradient(135deg, #0A1F44 0%, #08308E 100%)", padding: "80px 0" }}>
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
          align-items: start;
        }
        @media (max-width: 1024px) {
          .pc-layout {
            grid-template-columns: 1fr;
          }
          .pc-aside {
            padding-top: 0 !important;
          }
        }
      `}</style>

      <div style={{ fontFamily: "Satoshi, sans-serif", color: "#0A1F44", background: "#fff" }}>
        <HeroSection />

        <div className="pc-layout" style={{ padding: "80px 24px" }}>
          <main>
            <AboutSpecialty />
          </main>
          <aside className="pc-aside" style={{ paddingTop: 0 }}>
            <StickyBookingCard />
          </aside>
        </div>

        <SymptomsChips />
        <RelatedSpecialties />
        <WhyChooseUs />
      </div>
    </>
  );
}