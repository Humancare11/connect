import React, { useMemo, useState } from "react";
import {
  Globe2,
  ArrowRight,
  Plane,
  Stethoscope,
  Brain,
  Activity,
  ClipboardPlus,
  Search,
  HeartPulse,
  Venus,
  Mars,
  Baby,
  ShieldCheck,
  Pill,
  Building2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import "./symptoms.css";

const previewSpecialties = [
  { name: "Primary Care", icon: Stethoscope, tags: ["Cold & Flu", "Fever"] },
  { name: "Urgent Care", icon: ClipboardPlus, tags: ["UTI", "Sore Throat"] },
  { name: "Mental Health", icon: Brain, tags: ["Anxiety", "Depression"] },
  { name: "Chronic Care", icon: Activity, tags: ["Diabetes", "Hypertension"] },
];

const heroRows = [
  ["Condition", "Food Poisoning While Traveling"],
  ["Need", "Telehealth consult + medical report"],
  ["Route", "English-speaking doctor"],
  ["Status", "Non-emergency triage"],
];

const stats = [
  ["12", "Specialties"],
  ["140+", "Conditions"],
  ["6", "B2B segments"],
];

// -----------Symptoms Conditions --------

const conditionCategories = [
  {
    category: "Everyday Urgent Care",
    icon: ClipboardPlus,
    conditions: [
      "Cold & Flu",
      "COVID-19",
      "Fever",
      "Sore Throat",
      "Strep Throat",
      "Sinus Infection",
      "Ear Infection",
      "Pink Eye",
      "Cough",
      "Bronchitis",
      "Seasonal Allergies",
      "Headache",
      "Migraine",
      "Dizziness",
      "Vertigo",
      "Nausea and Vomiting",
      "Diarrhea",
      "Food Poisoning",
      "Constipation",
      "Acid Reflux / GERD",
      "Minor Burns",
      "Insect Bites",
    ],
  },
  {
    category: "Skin Conditions",
    icon: HeartPulse,
    conditions: [
      "Acne",
      "Eczema",
      "Psoriasis",
      "Skin Rash",
      "Hives",
      "Fungal Skin Infection",
      "Ringworm",
      "Athlete's Foot",
      "Cellulitis",
      "Cold Sores",
      "Shingles",
      "Hair Loss",
      "Itchy Skin",
      "Contact Dermatitis",
      "Rosacea",
      "Warts",
    ],
  },
  {
    category: "Respiratory Health",
    icon: Activity,
    conditions: [
      "Asthma",
      "Asthma Flare-Up",
      "Allergic Rhinitis",
      "COPD",
      "Persistent Cough",
      "Shortness of Breath",
      "Wheezing",
      "Upper Respiratory Infection",
      "Pneumonia Follow-Up",
    ],
  },
  {
    category: "Digestive Health",
    icon: Stethoscope,
    conditions: [
      "Abdominal Pain",
      "Bloating",
      "Gastritis",
      "Irritable Bowel Syndrome",
      "Indigestion",
      "Hemorrhoids",
      "Traveler's Diarrhea",
      "Vomiting",
      "Dehydration",
    ],
  },
  {
    category: "Urinary & Kidney Health",
    icon: ShieldCheck,
    conditions: [
      "Urinary Tract Infection",
      "Bladder Infection",
      "Burning Urination",
      "Frequent Urination",
      "Kidney Infection",
      "Kidney Stones",
      "Urinary Incontinence",
      "Blood in Urine",
    ],
  },
  {
    category: "Chronic Care",
    icon: Activity,
    conditions: [
      "Type 2 Diabetes",
      "High Blood Pressure",
      "High Cholesterol",
      "Thyroid Disorders",
      "Obesity",
      "Arthritis",
      "Osteoarthritis",
      "Rheumatoid Arthritis",
      "Chronic Migraine",
      "Chronic Kidney Disease",
      "Heart Disease Follow-Up",
      "Sleep Apnea",
    ],
  },
  {
    category: "Women's Health",
    icon: Venus,
    conditions: [
      "Birth Control Consultation",
      "Emergency Contraception Guidance",
      "Menstrual Cramps",
      "Irregular Periods",
      "Heavy Periods",
      "PCOS",
      "Menopause Symptoms",
      "Vaginal Yeast Infection",
      "Bacterial Vaginosis",
      "Pregnancy-Related Questions",
      "Prenatal Consultation",
      "Postpartum Concerns",
    ],
  },
  {
    category: "Men's Health",
    icon: Mars,
    conditions: [
      "Erectile Dysfunction",
      "Premature Ejaculation",
      "Low Testosterone Symptoms",
      "Hair Loss",
      "Prostate Health",
      "Urinary Symptoms in Men",
      "Men's Wellness Consultation",
    ],
  },
  {
    category: "Mental & Behavioral Health",
    icon: Brain,
    conditions: [
      "Anxiety",
      "Depression",
      "Stress",
      "Burnout",
      "Panic Attacks",
      "Insomnia",
      "ADHD Evaluation",
      "PTSD",
      "Grief and Loss",
      "Relationship Stress",
      "Substance Use Support",
    ],
  },
  {
    category: "Sexual Health",
    icon: ShieldCheck,
    conditions: [
      "STI Consultation",
      "Chlamydia",
      "Gonorrhea",
      "Herpes",
      "Genital Rash",
      "Genital Itching",
      "HIV Prevention / PrEP Guidance",
      "Partner Exposure Concerns",
    ],
  },
  {
    category: "Pediatric Care",
    icon: Baby,
    conditions: [
      "Pediatric Fever",
      "Pediatric Cold & Flu",
      "Ear Pain in Children",
      "Sore Throat in Children",
      "Pink Eye in Children",
      "Skin Rash in Children",
      "Childhood Allergies",
      "Mild Asthma Symptoms",
      "Stomach Pain in Children",
      "Vomiting and Diarrhea in Children",
    ],
  },
  {
    category: "Travel Health",
    icon: Plane,
    conditions: [
      "Traveler's Diarrhea",
      "Food Poisoning While Traveling",
      "Motion Sickness",
      "Altitude Sickness",
      "Jet Lag",
      "Medication Refill While Traveling",
      "Travel-Related Fever",
      "Travel Medical Certificate",
      "Fitness-to-Travel Evaluation",
      "International Medical Assistance",
      "Emergency Teleconsultation Abroad",
    ],
  },
  {
    category: "Prescription & Continuity Care",
    icon: Pill,
    conditions: [
      "Prescription Refill",
      "Medication Review",
      "Chronic Medication Management",
      "Lab Result Review",
      "Second Medical Opinion",
      "Specialist Referral",
      "Follow-Up Consultation",
      "Medical Certificate",
      "Doctor's Note",
      "Return-to-Work Clearance",
    ],
  },
  {
    category: "Eye, Ear & Musculoskeletal",
    icon: Activity,
    conditions: [
      "Eye Redness",
      "Eye Irritation",
      "Ear Pain",
      "Ear Infection",
      "Back Pain",
      "Neck Pain",
      "Joint Pain",
      "Muscle Strain",
      "Numbness and Tingling",
      "Swollen Feet or Ankles",
    ],
  },
];

// B2B
const audiences = [
  "Travel assistance companies",
  "International medical assistance providers",
  "Employers and HR teams",
  "TPAs and insurers",
  "Global mobility programs",
  "Universities and student travel programs",
];

//
const emergencyItems = [
  "Chest pain or heart attack symptoms",
  "Stroke-like symptoms",
  "Severe shortness of breath",
  "Loss of consciousness",
  "Severe allergic reaction",
  "Uncontrolled bleeding",
  "Suicidal thoughts or immediate danger",
];

export default function Symptoms() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("All");

  const allConditions = useMemo(
    () =>
      conditionCategories.flatMap(({ category, icon, conditions }) =>
        conditions.map((condition) => ({ condition, category, icon })),
      ),
    [],
  );

  const filtered = useMemo(
    () =>
      allConditions.filter(({ condition, category }) => {
        const matchCat = active === "All" || category === active;
        const matchSearch =
          condition.toLowerCase().includes(query.toLowerCase()) ||
          category.toLowerCase().includes(query.toLowerCase());
        return matchCat && matchSearch;
      }),
    [allConditions, active, query],
  );

  const categories = ["All", ...conditionCategories.map((c) => c.category)];
  return (
    <>
      <section id="top" className="sy-hero">
        <div className="sy-hero-inner">
          {/* ── Left column ── */}
          <div>
            <div className="sy-hero-badge">
              <Globe2 size={14} />
              US-facing telehealth condition directory
            </div>

            <h1 className="sy-hero-title">
              Care categories and conditions built for how US patients search.
            </h1>

            <p className="sy-hero-copy">
              A sample Humancare Connect structure with 12 high-value
              specialties and a searchable condition directory for primary care,
              urgent care, chronic care, travel health, and business partners.
            </p>

            {/* <div className="sy-hero-ctas">
                            <a href="#specialties" className="sy-hero-btn-primary">
                                View Specialties <ArrowRight size={16} />
                            </a>
                            <a href="#conditions" className="sy-hero-btn-secondary">
                                Search Conditions
                            </a>
                        </div> */}

            <div className="sy-hero__stats">
              {stats.map(([num, label]) => (
                <div key={label} className="sy-hero__stat">
                  <div className="sy-hero__stat-num">{num}</div>
                  <div className="sy-hero__stat-label">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right panel ── */}
          <div className="sy-hero-panel">
            <div className="sy-hero__card">
              <div className="sy-hero__card-dark">
                <div className="sy-hero__card-top">
                  <div>
                    <p className="sy-hero__card-sub">Virtual care request</p>
                    <p className="sy-hero__card-title">
                      Traveler needs consult
                    </p>
                  </div>
                  <div className="sy-hero__card-icon">
                    <Plane size={22} />
                  </div>
                </div>
                <div className="sy-hero__card-rows">
                  {heroRows.map(([label, value]) => (
                    <div key={label} className="sy-hero__card-row">
                      <span>{label}</span>
                      <span>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="sy-hero__mini-grid">
                {previewSpecialties.map(({ name, icon: Icon, tags }) => (
                  <div key={name} className="sy-hero__mini-card">
                    <Icon size={20} style={{ color: "var(--blue)" }} />
                    <div className="sy-hero__mini-name">{name}</div>
                    <div className="sy-hero__mini-tags">{tags.join(" · ")}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------(Conditions / Symptoms directory)--------- */}

      <section id="sy-conditions" className="symptoms">
        <div className="symptoms__container">
          <div className="symptoms__title-block">
            <span className="symptoms__eyebrow">Conditions page</span>
            <h2 className="symptoms__heading">
              Searchable US medical condition directory
            </h2>
            <p className="symptoms__copy">
              Use patient-friendly US terminology. Avoid saying "all
              conditions"; say "Conditions we can help with" or "Common concerns
              we support."
            </p>
          </div>

          {/* Search */}
          <div className="symptoms__search-box">
            <div className="symptoms__search-row">
              <label className="symptoms__input-wrap">
                <Search className="symptoms__input-icon" size={20} />
                <input
                  className="symptoms__input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search: UTI, traveler's diarrhea, anxiety, prescription refill..."
                />
              </label>
              <div className="symptoms__count">{filtered.length} results</div>
            </div>

            <div className="symptoms__filters">
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`symptoms__filter-btn${active === cat ? " symptoms__filter-btn--active" : ""}`}
                  onClick={() => setActive(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          <div className="symptoms__grid">
            {filtered.slice(0, 96).map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={`${item.category}-${item.condition}`}
                  className="symptoms__item"
                  style={{ "--delay": `${Math.min(i, 30) * 20}ms` }}
                >
                  <div className="symptoms__item-icon">
                    <Icon size={18} />
                  </div>
                  <div>
                    <div className="symptoms__item-name">{item.condition}</div>
                    <div className="symptoms__item-cat">{item.category}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length > 96 && (
            <div className="symptoms__overflow">
              Showing the first 96 matching conditions. Narrow your search to
              see more.
            </div>
          )}
        </div>
      </section>

      {/* ===================== B2B ===================== */}
      <section id="businesses" className="sy-b2b">
        <div className="sy-b2b__inner">
          {/* LEFT */}
          <div className="sy-b2b__content">
            <span className="sy-b2b__eyebrow">B2B positioning</span>

            <h2 className="sy-b2b__heading">
              Built for partners who need medical access across borders.
            </h2>

            <p className="sy-b2b__copy">
              Humancare Connect should not look like a generic doctor directory.
              The strongest positioning is B2B telehealth support for assistance
              companies, insurers, TPAs, employers, and international travelers.
            </p>

            <a href="#safety" className="sy-b2b__cta">
              View safety language <ArrowRight size={16} />
            </a>
          </div>

          {/* RIGHT */}
          <div className="sy-b2b__grid">
            {audiences.map((name, i) => (
              <div
                key={name}
                className="sy-b2b__card"
                style={{ "--delay": `${i * 50}ms` }}
              >
                <Building2 size={22} style={{ color: "var(--blue)" }} />

                <div className="sy-b2b__card-name">{name}</div>

                <p className="sy-b2b__card-desc">
                  Virtual care routing, physician access, reports, and
                  continuity care coordination.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== EMERGENCY ===================== */}
      <section id="safety" className="sy-eme">
        <div className="sy-eme__inner">
          {/* LEFT */}
          <div className="sy-eme__left">
            <AlertTriangle size={32} style={{ color: "#7CB7FF" }} />

            <h2 className="sy-eme__title">Emergency disclaimer</h2>

            <p className="sy-eme__copy">
              For the US market, serious symptoms should be clearly routed to
              emergency services. This protects patients and makes the website
              more trustworthy.
            </p>

            <div className="sy-eme__callout">
              If you are experiencing a life-threatening emergency, call 911 or
              go to the nearest emergency room immediately.
            </div>
          </div>

          {/* RIGHT */}
          <div className="sy-eme__right">
            <h3 className="sy-eme__right-title">
              Do not market these as routine telehealth conditions
            </h3>

            <div className="sy-eme__list">
              {emergencyItems.map((item) => (
                <div key={item} className="sy-eme__item">
                  <AlertTriangle
                    size={16}
                    style={{
                      color: "#0B57E8",
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  />

                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="sy-eme__rec">
              <div className="sy-eme__rec-head">
                <CheckCircle2 size={17} />
                Recommended wording
              </div>

              <p className="sy-eme__rec-body">
                "Humancare Connect provides virtual consultations for common
                non-emergency medical concerns, continuity care, prescription
                refill requests, and travel health support. Availability depends
                on physician assessment, location, regulations, and clinical
                appropriateness."
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
