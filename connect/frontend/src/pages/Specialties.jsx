import React, { useState, useEffect, useCallback } from "react";
import {
  Globe2, ArrowRight, Plane, Stethoscope, Brain, Activity,
  ClipboardPlus, HeartPulse, Venus, Mars, Baby, ShieldCheck,
  Pill, Users, Building2, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight
} from "lucide-react";
import "./Specialties.css";

// ── Carousel slides ──────────────────────────────────────────────────────────
const carouselSlides = [
  {
    icon: Plane,
    cardSub: "Virtual care request",
    cardTitle: "Traveler needs consult",
    rows: [
      ["Condition", "Food Poisoning While Traveling"],
      ["Need",      "Telehealth consult + medical report"],
      ["Route",     "English-speaking doctor"],
      ["Status",    "Non-emergency triage"],
    ],
    tabs: [
      { name: "Primary Care",  icon: Stethoscope,   tags: ["Cold & Flu", "Fever"] },
      { name: "Urgent Care",   icon: ClipboardPlus, tags: ["UTI", "Sore Throat"] },
      { name: "Mental Health", icon: Brain,         tags: ["Anxiety", "Depression"] },
      { name: "Chronic Care",  icon: Activity,      tags: ["Diabetes", "Hypertension"] },
    ],
  },
  {
    icon: Stethoscope,
    cardSub: "Chronic condition management",
    cardTitle: "Ongoing care support",
    rows: [
      ["Condition", "Type 2 Diabetes"],
      ["Need",      "Medication review + monitoring"],
      ["Route",     "Certified chronic care physician"],
      ["Status",    "Scheduled follow-up"],
    ],
    tabs: [
      { name: "Chronic Care",  icon: Activity,      tags: ["Diabetes", "Hypertension"] },
      { name: "Primary Care",  icon: Stethoscope,   tags: ["Preventive", "Check-ups"] },
      { name: "Medication Mgmt", icon: Pill,        tags: ["Refill", "Side Effects"] },
      { name: "Second Opinion", icon: Users,        tags: ["Lab Review", "Diagnosis"] },
    ],
  },
  {
    icon: Brain,
    cardSub: "Mental wellness session",
    cardTitle: "Confidential therapy consult",
    rows: [
      ["Condition", "Generalised Anxiety Disorder"],
      ["Need",      "Behavioural health consultation"],
      ["Route",     "Licensed therapist, English"],
      ["Status",    "Non-emergency intake"],
    ],
    tabs: [
      { name: "Mental Health",  icon: Brain,        tags: ["Anxiety", "Depression"] },
      { name: "Primary Care",   icon: Stethoscope,  tags: ["Insomnia", "Fatigue"] },
      { name: "Chronic Care",   icon: Activity,     tags: ["Stress", "Burnout"] },
      { name: "Second Opinion", icon: Users,        tags: ["Referral", "Clarity"] },
    ],
  },
  {
    icon: Venus,
    cardSub: "Women's health consult",
    cardTitle: "Reproductive & hormonal care",
    rows: [
      ["Condition", "PCOS — irregular cycles"],
      ["Need",      "Hormone panel + birth control"],
      ["Route",     "OB-GYN specialist, telehealth"],
      ["Status",    "Initial consultation"],
    ],
    tabs: [
      { name: "Women's Health", icon: Venus,        tags: ["PCOS", "Birth Control"] },
      { name: "Primary Care",   icon: Stethoscope,  tags: ["Fatigue", "Weight"] },
      { name: "Mental Health",  icon: Brain,        tags: ["Mood", "Stress"] },
      { name: "Medication Mgmt", icon: Pill,        tags: ["Rx Refill", "Review"] },
    ],
  },
];

// ── Stats & specialties data (unchanged) ─────────────────────────────────────
const stats = [
  ["12",   "Specialties"],
  ["140+", "Conditions"],
  ["6",    "B2B segments"],
];

const specialties = [
  { name: "Primary Care",          icon: Stethoscope,   summary: "Everyday care, preventive guidance, medication support, and follow-up consultations.",                                   conditions: ["Cold & Flu", "Fever", "Fatigue", "Headache", "Medication Review"] },
  { name: "Urgent Care",           icon: ClipboardPlus, summary: "Non-emergency concerns that need timely physician guidance.",                                                            conditions: ["UTI", "Sinus Infection", "Sore Throat", "Pink Eye", "Food Poisoning"] },
  { name: "Mental Health",         icon: Brain,         summary: "Confidential support for emotional wellness and behavioral health concerns.",                                            conditions: ["Anxiety", "Depression", "Insomnia", "Stress", "Panic Attacks"] },
  { name: "Dermatology",           icon: HeartPulse,    summary: "Online evaluation for common skin, hair, and rash-related concerns.",                                                   conditions: ["Acne", "Eczema", "Psoriasis", "Skin Rash", "Hair Loss"] },
  { name: "Chronic Care",          icon: Activity,      summary: "Ongoing virtual support for long-term health conditions and monitoring.",                                               conditions: ["Type 2 Diabetes", "High Blood Pressure", "High Cholesterol", "Thyroid Disorders"] },
  { name: "Travel Health",         icon: Plane,         summary: "Medical support for travelers, expats, international students, and assistance partners.",                               conditions: ["Traveler's Diarrhea", "Jet Lag", "Motion Sickness", "Travel Medical Certificate"] },
  { name: "Women's Health",        icon: Venus,         summary: "Consultations for common reproductive, hormonal, urinary, and wellness concerns.",                                      conditions: ["Birth Control", "PCOS", "Yeast Infection", "Menopause Symptoms"] },
  { name: "Men's Health",          icon: Mars,          summary: "Discreet support for men's wellness, sexual health, and urinary concerns.",                                             conditions: ["Erectile Dysfunction", "Hair Loss", "Prostate Health", "Low Testosterone Symptoms"] },
  { name: "Pediatric Care",        icon: Baby,          summary: "Virtual support for common child health concerns with parent-friendly guidance.",                                       conditions: ["Pediatric Fever", "Ear Pain", "Childhood Allergies", "Skin Rash in Children"] },
  { name: "Sexual Health",         icon: ShieldCheck,   summary: "Private consultation pathways for STI concerns, exposure questions, and prevention guidance.",                         conditions: ["STI Consultation", "Herpes", "Chlamydia", "Gonorrhea", "PrEP Guidance"] },
  { name: "Medication Management", icon: Pill,          summary: "Prescription refill requests, continuity care, and chronic medication review.",                                        conditions: ["Prescription Refill", "Lab Result Review", "Medication Side Effects", "Chronic Medication Review"] },
  { name: "Second Opinion",        icon: Users,         summary: "Remote review and guidance for patients seeking clarity on diagnosis or treatment direction.",                         conditions: ["Second Medical Opinion", "Specialist Referral", "Lab Review", "Imaging Report Discussion"] },
];

const audiences = [
  "Travel assistance companies",
  "International medical assistance providers",
  "Employers and HR teams",
  "TPAs and insurers",
  "Global mobility programs",
  "Universities and student travel programs",
];

const emergencyItems = [
  "Chest pain or heart attack symptoms",
  "Stroke-like symptoms",
  "Severe shortness of breath",
  "Loss of consciousness",
  "Severe allergic reaction",
  "Uncontrolled bleeding",
  "Suicidal thoughts or immediate danger",
];

// ── HeroCarousel component ────────────────────────────────────────────────────
function HeroCarousel() {
  const [slideIndex, setSlideIndex]   = useState(0);
  const [activeTab,  setActiveTab]    = useState(0);
  const [animating,  setAnimating]    = useState(false);
  const [direction,  setDirection]    = useState("next"); // "next" | "prev"

  const total = carouselSlides.length;
  const slide = carouselSlides[slideIndex];

  const goTo = useCallback((next, dir) => {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setSlideIndex(next);
      setActiveTab(0);
      setAnimating(false);
    }, 320);
  }, [animating]);

  const prev = () => goTo((slideIndex - 1 + total) % total, "prev");
  const next = () => goTo((slideIndex + 1) % total,         "next");

  // Auto-advance every 5 s
  useEffect(() => {
    const id = setInterval(() => {
      goTo((slideIndex + 1) % total, "next");
    }, 5000);
    return () => clearInterval(id);
  }, [slideIndex, goTo, total]);

  const SlideIcon = slide.icon;
  const activeTabData = slide.tabs[activeTab];
  const ActiveTabIcon = activeTabData.icon;

  return (
    <div className="sp-hero__panel">
      <div className="sp-hero__card">

        {/* ── Dark inner card (animated) ── */}
        <div
          className={`sp-hero__card-dark sp-carousel__slide ${animating ? `sp-carousel__slide--exit-${direction}` : "sp-carousel__slide--enter"}`}
        >
          <div className="sp-hero__card-top">
            <div>
              <p className="sp-hero__card-sub">{slide.cardSub}</p>
              <p className="sp-hero__card-title">{slide.cardTitle}</p>
            </div>
            <div className="sp-hero__card-icon">
              <SlideIcon size={22} />
            </div>
          </div>

          <div className="sp-hero__card-rows">
            {slide.rows.map(([label, value]) => (
              <div key={label} className="sp-hero__card-row">
                <span>{label}</span>
                <span>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tab mini-grid ── */}
        <div className="sp-hero__mini-grid">
          {slide.tabs.map(({ name, icon: Icon, tags }, i) => (
            <button
              key={name}
              className={`sp-hero__mini-card sp-hero__mini-card--btn${activeTab === i ? " sp-hero__mini-card--active" : ""}`}
              onClick={() => setActiveTab(i)}
              aria-pressed={activeTab === i}
            >
              <Icon size={20} style={{ color: activeTab === i ? "var(--white)" : "var(--teal)" }} />
              <div className="sp-hero__mini-name">{name}</div>
              <div className="sp-hero__mini-tags">{tags.join(" · ")}</div>
            </button>
          ))}
        </div>

        {/* ── Active tab expanded preview ── */}
        <div className="sp-hero__tab-preview" key={`${slideIndex}-${activeTab}`}>
          <ActiveTabIcon size={16} style={{ color: "var(--teal)", flexShrink: 0 }} />
          <span className="sp-hero__tab-preview-name">{activeTabData.name}</span>
          <div className="sp-hero__tab-preview-tags">
            {activeTabData.tags.map(t => (
              <span key={t} className="sp-hero__tab-preview-tag">{t}</span>
            ))}
          </div>
        </div>

        {/* ── Carousel controls ── */}
        <div className="sp-carousel__controls">
          <button className="sp-carousel__btn" onClick={prev} aria-label="Previous slide">
            <ChevronLeft size={16} />
          </button>

          <div className="sp-carousel__dots">
            {carouselSlides.map((_, i) => (
              <button
                key={i}
                className={`sp-carousel__dot${slideIndex === i ? " sp-carousel__dot--active" : ""}`}
                onClick={() => goTo(i, i > slideIndex ? "next" : "prev")}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>

          <button className="sp-carousel__btn" onClick={next} aria-label="Next slide">
            <ChevronRight size={16} />
          </button>
        </div>

      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function Specialties() {
  return (
    <>
      {/* hero */}
      <section id="top" className="sp-hero">
        <div className="sp-hero__inner">

          {/* Left column */}
          <div>
            <div className="sp-hero__badge">
              <Globe2 size={14} />
              US-facing telehealth condition directory
            </div>

            <h1 className="sp-hero__title">
              Care categories and conditions built for how US patients search.
            </h1>

            <p className="sp-hero__copy">
              A sample Humancare Connect structure with 12 high-value specialties and a searchable
              condition directory for primary care, urgent care, chronic care, travel health, and
              business partners.
            </p>

            <div className="sp-hero__stats">
              {stats.map(([num, label]) => (
                <div key={label} className="hero__stat">
                  <div className="sp-hero__stat-num">{num}</div>
                  <div className="sp-hero__stat-label">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right panel — carousel */}
          <HeroCarousel />

        </div>
      </section>

      {/* Specialties */}
      <section id="specialties" className="specialties">
        <div className="specialties__container">
          <div className="specialties__title-block">
            <span className="specialties__eyebrow">Recommended specialty count</span>
            <h2 className="specialties__heading">
              List 12 specialties, but highlight 6 on the homepage.
            </h2>
            <p className="specialties__copy">
              This keeps the site credible and focused. Conditions should carry the SEO depth;
              specialties should guide users quickly.
            </p>
          </div>

          <div className="specialties__grid">
            {specialties.map((s, i) => {
              const Icon = s.icon;
              return (
                <article
                  key={s.name}
                  className="specialties__card"
                  style={{ "--delay": `${i * 40}ms` }}
                >
                  <div className="specialties__card-head">
                    <div className="specialties__card-icon"><Icon size={22} /></div>
                    <span className="specialties__card-num">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="specialties__card-name">{s.name}</h3>
                  <p className="specialties__card-summary">{s.summary}</p>
                  <div className="specialties__card-tags">
                    {s.conditions.slice(0, 4).map((c) => (
                      <span key={c} className="specialties__card-tag">{c}</span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* B2B */}
      <section id="businesses" className="sp-b2b">
        <div className="sp-b2b__inner">
          <div>
            <span className="sp-b2b__eyebrow">B2B positioning</span>
            <h2 className="sp-b2b__heading">
              Built for partners who need medical access across borders.
            </h2>
            <p className="sp-b2b__copy">
              Humancare Connect should not look like a generic doctor directory. The strongest
              positioning is B2B telehealth support for assistance companies, insurers, TPAs,
              employers, and international travelers.
            </p>
            <a href="#safety" className="sp-b2b__cta">
              View safety language <ArrowRight size={16} />
            </a>
          </div>

          <div className="sp-b2b__grid">
            {audiences.map((name, i) => (
              <div key={name} className="sp-b2b__card" style={{ "--delay": `${i * 50}ms` }}>
                <Building2 size={22} style={{ color: "var(--teal)" }} />
                <div className="sp-b2b__card-name">{name}</div>
                <p className="sp-b2b__card-desc">
                  Virtual care routing, physician access, reports, and continuity care coordination.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Emergency */}
      <section id="safety" className="sp-emergency">
        <div className="sp-eme__inner">
          <div className="sp-eme__left">
            <AlertTriangle size={32} style={{ color: "var(--gold)" }} />
            <h2 className="sp-eme__title">Emergency disclaimer</h2>
            <p className="sp-eme__copy">
              For the US market, serious symptoms should be clearly routed to emergency services.
              This protects patients and makes the website more trustworthy.
            </p>
            <div className="sp-eme__callout">
              If you are experiencing a life-threatening emergency, call 911 or go to the nearest
              emergency room immediately.
            </div>
          </div>

          <div className="sp-eme__right">
            <h3 className="sp-eme__right-title">
              Do not market these as routine telehealth conditions
            </h3>
            <div className="sp-eme__list">
              {emergencyItems.map((item) => (
                <div key={item} className="sp-eme__item">
                  <AlertTriangle size={16} style={{ color: "var(--gold)", flexShrink: 0, marginTop: 2 }} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="sp-eme__rec">
              <div className="sp-eme__rec-head">
                <CheckCircle2 size={17} /> Recommended wording
              </div>
              <p className="sp-eme__rec-body">
                "Humancare Connect provides virtual consultations for common non-emergency medical
                concerns, continuity care, prescription refill requests, and travel health support.
                Availability depends on physician assessment, location, regulations, and clinical
                appropriateness."
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}