import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Globe2,
  ArrowRight,
  ArrowLeft,
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
  ChevronDown,
  MessageCircle,
  Clock,
  Lock,
  MapPin,
  Sparkles,
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

// -----------Hero carousel slides --------
// Each slide pairs a "request" context (top dark card rows) with the
// 2x2 specialty grid below it, mirroring the reference design where the
// active specialty is highlighted and summarized in the footer row.
const heroSlides = [
  {
    sub: "Virtual care request",
    title: "Traveler needs consult",
    icon: Plane,
    rows: [
      ["Condition", "Food Poisoning While Traveling"],
      ["Need", "Telehealth consult + medical report"],
      ["Route", "English-speaking doctor"],
      ["Status", "Non-emergency triage"],
    ],
    activeIndex: 0,
  },
  {
    sub: "Virtual care request",
    title: "Patient needs urgent care",
    icon: ClipboardPlus,
    rows: [
      ["Condition", "UTI Symptoms Since Last Night"],
      ["Need", "Same-day telehealth consult"],
      ["Route", "Nearest available provider"],
      ["Status", "Non-emergency triage"],
    ],
    activeIndex: 1,
  },
  {
    sub: "Virtual care request",
    title: "Member needs support",
    icon: Brain,
    rows: [
      ["Condition", "Persistent Anxiety & Sleep Loss"],
      ["Need", "Mental health consult"],
      ["Route", "Licensed therapist match"],
      ["Status", "Routine triage"],
    ],
    activeIndex: 2,
  },
  {
    sub: "Virtual care request",
    title: "Patient needs refill review",
    icon: Activity,
    rows: [
      ["Condition", "Type 2 Diabetes Follow-Up"],
      ["Need", "Medication review + refill"],
      ["Route", "Chronic care specialist"],
      ["Status", "Routine triage"],
    ],
    activeIndex: 3,
  },
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

// -----------Care section --------
const careFeatures = [
  {
    title: "Personalized Medical Guidance",
    desc: "Receive healthcare support tailored to your symptoms, concerns, and individual health needs.",
  },
  {
    title: "Trusted Healthcare Professionals",
    desc: "Connect with licensed medical experts who are available across most major time zones.",
  },
  {
    title: "Convenient Online Consultations",
    desc: "Access quality healthcare from the comfort of your home with simple, flexible online scheduling.",
  },
  {
    title: "Comprehensive Healthcare Support",
    desc: "Get care for everyday concerns, specialist health needs, long-term plans, and more.",
  },
  {
    title: "Private & Secure Care Experience",
    desc: "Discuss your health confidently with secure consultations that protect your privacy and confidentiality.",
  },
  {
    title: "Continuous Care & Wellness Support",
    desc: "Stay supported with ongoing guidance that keeps your wellness goals on track at every stage.",
  },
];

// -----------FAQ section --------
const faqGroups = [
  {
    group: "Appointments",
    items: [
      {
        q: "What is an online doctor consultation?",
        a: "An online doctor consultation allows patients to connect with qualified healthcare professionals remotely through video calls for medical advice, guidance, diagnosis, and treatment recommendations.",
      },
      {
        q: "How do I choose the right online consultation service?",
        a: "Look for licensed providers, transparent pricing, available specialties, and verified patient reviews before booking an online consultation service.",
      },
      {
        q: "What types of online consultations are available through Humancare Connect?",
        a: "Humancare Connect offers primary care, urgent care, chronic care, mental health, women's and men's health, and specialist follow-up consultations.",
      },
    ],
  },
  {
    group: "Virtual Care",
    items: [
      {
        q: "Can I access healthcare services online through online consultation?",
        a: "Yes, you can access a broad range of healthcare services online, including diagnosis, treatment guidance, prescriptions, and referrals.",
      },
      {
        q: "What if I am not sure which doctor I need to consult with?",
        a: "Our intake flow routes you to the right specialty automatically based on the symptoms and concerns you describe.",
      },
      {
        q: "Are online consultations suitable for different age groups?",
        a: "Yes, we support pediatric, adult, and senior patients with care pathways tailored to each age group.",
      },
      {
        q: "Can I discuss more than one health concern during an online consultation?",
        a: "Yes, you can raise multiple concerns in a single visit and your provider will address each one or refer you onward as needed.",
      },
      {
        q: "Are online consultations private and secure?",
        a: "All consultations run on encrypted, HIPAA-compliant infrastructure to keep your medical information private.",
      },
      {
        q: "Do I need a referral for an online consultation?",
        a: "No referral is required for most consultation types; you can book directly through the platform.",
      },
      {
        q: "Can I receive prescriptions during an online consultation?",
        a: "Yes, licensed providers can issue prescriptions when clinically appropriate, sent directly to your pharmacy of choice.",
      },
    ],
  },
  {
    group: "Association Benefits & Care",
    items: [
      {
        q: "Are online consultations suitable for preventive care?",
        a: "Yes, preventive check-ins and wellness reviews are available alongside symptom-based visits.",
      },
      {
        q: "How quickly can I connect with a healthcare professional?",
        a: "Most patients connect with a provider in under two minutes during active hours.",
      },
      {
        q: "What are the benefits of online consultation?",
        a: "Online consultations save travel time, reduce wait times, and make it easier to access specialists from anywhere.",
      },
      {
        q: "Can I receive specialized medical support through online consultation?",
        a: "Yes, specialist consultations are available for chronic, behavioral, and condition-specific care needs.",
      },
      {
        q: "Why choose Humancare Connect for online consultation?",
        a: "Humancare Connect combines vetted providers, fast routing, and secure infrastructure built specifically for cross-border and US-facing care needs.",
      },
    ],
  },
];

export default function Symptoms() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("All");
  const [showAll, setShowAll] = useState(false);

  // Hero carousel state
  const [slide, setSlide] = useState(0);
  const slideCount = heroSlides.length;
  const autoplayRef = useRef(null);

  useEffect(() => {
    autoplayRef.current = setInterval(() => {
      setSlide((s) => (s + 1) % slideCount);
    }, 5000);
    return () => clearInterval(autoplayRef.current);
  }, [slideCount]);

  const goTo = (i) => {
    clearInterval(autoplayRef.current);
    setSlide(((i % slideCount) + slideCount) % slideCount);
  };
  const goPrev = () => goTo(slide - 1);
  const goNext = () => goTo(slide + 1);

  const current = heroSlides[slide];
  const CurrentCardIcon = current.icon;

  // FAQ state — track which item is open within each group (one open per group)
  const [openFaq, setOpenFaq] = useState("appt-0");
  const faqRightRef = useRef(null);

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

  // Reset the "show all" expansion whenever the result set changes
  useEffect(() => {
    setShowAll(false);
  }, [query, active]);

  const visibleConditions = showAll ? filtered : filtered.slice(0, 96);
  const remainingCount = Math.max(filtered.length - 96, 0);

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

          {/* ── Right panel: carousel ── */}
          <div className="sy-hero-panel">
            <div className="sy-hero__card">
              <div className="sy-hero__card-dark">
                <div className="sy-hero__card-top">
                  <div>
                    <p className="sy-hero__card-sub">{current.sub}</p>
                    <p className="sy-hero__card-title">{current.title}</p>
                  </div>
                  <div className="sy-hero__card-icon">
                    <CurrentCardIcon size={22} />
                  </div>
                </div>
                <div className="sy-hero__card-rows">
                  {current.rows.map(([label, value]) => (
                    <div key={label} className="sy-hero__card-row">
                      <span>{label}</span>
                      <span>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="sy-hero__mini-grid">
                {previewSpecialties.map(({ name, icon: Icon, tags }, i) => (
                  <div
                    key={name}
                    className={`sy-hero__mini-card${i === current.activeIndex ? " sy-hero__mini-card--active" : ""}`}
                  >
                    <Icon size={20} />
                    <div className="sy-hero__mini-name">{name}</div>
                    <div className="sy-hero__mini-tags">{tags.join(" · ")}</div>
                  </div>
                ))}
              </div>

              {/* Featured / active specialty footer row */}
              <div className="sy-hero__feature-row">
                <div className="sy-hero__feature-left">
                  {(() => {
                    const Icon = previewSpecialties[current.activeIndex].icon;
                    return <Icon size={16} />;
                  })()}
                  <span>{previewSpecialties[current.activeIndex].name}</span>
                </div>
                <div className="sy-hero__feature-tags">
                  {previewSpecialties[current.activeIndex].tags.map((t) => (
                    <span key={t} className="sy-hero__feature-tag">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Carousel nav: arrows + dots */}
              <div className="sy-hero__nav">
                <button
                  type="button"
                  className="sy-hero__nav-arrow"
                  onClick={goPrev}
                  aria-label="Previous"
                >
                  <ArrowLeft size={16} />
                </button>
                <div className="sy-hero__nav-dots">
                  {heroSlides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`sy-hero__nav-dot${i === slide ? " sy-hero__nav-dot--active" : ""}`}
                      onClick={() => goTo(i)}
                      aria-label={`Go to slide ${i + 1}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="sy-hero__nav-arrow"
                  onClick={goNext}
                  aria-label="Next"
                >
                  <ArrowRight size={16} />
                </button>
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
            {visibleConditions.map((item, i) => {
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

          {!showAll && remainingCount > 0 && (
            <div className="symptoms__overflow">
              <p>
                Showing the first 96 matching conditions. Narrow your search to
                see more, or view all results below.
              </p>
              <button
                type="button"
                className="symptoms__view-more"
                onClick={() => setShowAll(true)}
              >
                View {remainingCount} more conditions
              </button>
            </div>
          )}

          {showAll && filtered.length > 96 && (
            <div className="symptoms__overflow">
              <button
                type="button"
                className="symptoms__view-more symptoms__view-more--ghost"
                onClick={() => setShowAll(false)}
              >
                Show fewer conditions
              </button>
            </div>
          )}
        </div>
      </section>

      {/* --------------------(Care section)--------- */}

      <section id="sy-care" className="sy-care">
        <div className="sy-care__inner">
          <div className="sy-care__left">
            <span className="sy-care__eyebrow">Care made simple</span>
            <h2 className="sy-care__heading">
              Care Designed Around Your Health Needs
            </h2>
            <p className="sy-care__copy">
              Humancare Connect provides a comprehensive virtual healthcare
              experience that takes it easier to access trusted medical
              guidance, connect with experienced healthcare professionals, and
              receive personalized care tailored to your unique health journey.
            </p>
          </div>

          <div className="sy-care__grid">
            {careFeatures.map((f) => (
              <div key={f.title} className="sy-care__card">
                <div className="sy-care__card-name">{f.title}</div>
                <div className="sy-care__card-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------(FAQ section)--------- */}

      <section id="sy-faq" className="sy-faq">
        <div className="sy-faq__inner">
          {/* Left — sticky */}
          <div className="sy-faq__left">
            <span className="sy-faq__eyebrow">FAQ</span>
            <h2 className="sy-faq__heading">Frequently Asked Questions</h2>
            <p className="sy-faq__copy">
              Everything you need to know about primary care with Humancare
              Connect. Can't find an answer?
            </p>

            <button type="button" className="sy-faq__chat-btn">
              <MessageCircle size={16} />
              Chat with our team
            </button>

            <div className="sy-faq__meta">
              <div className="sy-faq__meta-item">
                <Clock size={14} />
                <span>Avg. response in 2 min</span>
              </div>
              <div className="sy-faq__meta-item">
                <Lock size={14} />
                <span>HIPAA secure &amp; private</span>
              </div>
              <div className="sy-faq__meta-item">
                <Globe2 size={14} />
                <span>Available in all 50 states</span>
              </div>
            </div>
          </div>

          {/* Right — scrolls within the section as the page scrolls */}
          <div className="sy-faq__right">
            {faqGroups.map((group, gi) => (
              <div key={group.group} className="sy-faq__group">
                <span className="sy-faq__group-label">{group.group}</span>
                <div className="sy-faq__list">
                  {group.items.map((item, ii) => {
                    const id = `${gi}-${ii}`;
                    const isOpen = openFaq === id;
                    return (
                      <div
                        key={id}
                        className={`sy-faq__item${isOpen ? " sy-faq__item--open" : ""}`}
                      >
                        <button
                          type="button"
                          className="sy-faq__q"
                          onClick={() => setOpenFaq(isOpen ? null : id)}
                          aria-expanded={isOpen}
                        >
                          <span>{item.q}</span>
                          <ChevronDown size={18} className="sy-faq__chev" />
                        </button>
                        {isOpen && (
                          <div className="sy-faq__a">
                            <p>{item.a}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------(CTA section)--------- */}

      <section id="sy-cta" className="sy-cta">
        <div className="sy-cta__card">
          <span className="sy-cta__eyebrow">
            <Sparkles size={12} />
            Ready when you are
          </span>
          <h2 className="sy-cta__heading">
            Find your specialist <span>in under 2 minutes.</span>
          </h2>
          <p className="sy-cta__copy">
            Search, look, and consult with a verified physician from anywhere —
            same-day appointments available across all categories.
          </p>
          <div className="sy-cta__actions">
            <a href="#sy-conditions" className="sy-cta__btn-primary">
              Book a consultation
              <ArrowRight size={16} />
            </a>
            <a href="#sy-conditions" className="sy-cta__btn-secondary">
              Browse specialties
            </a>
          </div>
        </div>
      </section>
    </>
  );
}