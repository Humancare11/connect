import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import "./Categories.css";

/* ── react-icons ─────────────────────────────────────────── */
import {
  FiHeart, FiSmile, FiWind, FiEye, FiActivity,
  FiArrowRight, FiChevronRight, FiChevronLeft,
  FiSearch, FiCheckCircle, FiUsers, FiShield,
  FiClock, FiStar, FiVideo, FiZap, FiGlobe,
  FiAlertTriangle, FiThermometer,
} from "react-icons/fi";
import {
  TbStethoscope, TbBone, TbPill, TbDna2,
  TbWoman, TbBrain, TbUrgent, TbBuilding,
} from "react-icons/tb";
import { MdChildCare, MdOutlineLocalHospital } from "react-icons/md";
import { RiMentalHealthLine } from "react-icons/ri";

/* ─────────────────────────────────────────────────────────────
   ICON MAP
───────────────────────────────────────────────────────────── */
const ICONS = {
  heart:        FiHeart,
  brain:        TbBrain,
  smile:        FiSmile,
  child:        MdChildCare,
  bone:         TbBone,
  wind:         FiWind,
  women:        TbWoman,
  dna:          TbDna2,
  stethoscope:  TbStethoscope,
  eye:          FiEye,
  activity:     FiActivity,
  skin:         FiActivity,
  arrowRight:   FiArrowRight,
  chevronRight: FiChevronRight,
  chevronLeft:  FiChevronLeft,
  search:       FiSearch,
  check:        FiCheckCircle,
  users:        FiUsers,
  shield:       FiShield,
  clock:        FiClock,
  star:         FiStar,
  video:        FiVideo,
  zap:          FiZap,
  pill:         TbPill,
  globe:        FiGlobe,
  urgent:       TbUrgent,
  hospital:     MdOutlineLocalHospital,
  mental:       RiMentalHealthLine,
  chronic:      FiActivity,
  alertTri:     FiAlertTriangle,
  building:     TbBuilding,
  thermometer:  FiThermometer,
};

function Icon({ name, size = 18, style, className }) {
  const Component = ICONS[name];
  if (!Component) return null;
  return <Component size={size} style={style} className={className} aria-hidden="true" />;
}

/* ─────────────────────────────────────────────────────────────
   CAROUSEL DATA
───────────────────────────────────────────────────────────── */
const SLIDES = [
  {
    iconName: "globe",
    sub:   "Virtual care request",
    title: "Traveler needs consult",
    rows: [
      ["Condition", "Food Poisoning While Traveling"],
      ["Need",      "Telehealth consult + medical report"],
      ["Route",     "English-speaking doctor"],
      ["Status",    "Non-emergency triage"],
    ],
    tabs: [
      { icon: "stethoscope", name: "Primary Care",  tags: ["Cold & Flu", "Fever"]          },
      { icon: "urgent",      name: "Urgent Care",   tags: ["UTI", "Sore Throat"]            },
      { icon: "brain",       name: "Mental Health", tags: ["Anxiety", "Depression"]         },
      { icon: "activity",    name: "Chronic Care",  tags: ["Diabetes", "Hypertension"]      },
    ],
  },
  {
    iconName: "heart",
    sub:   "Specialist referral",
    title: "Cardiac screening request",
    rows: [
      ["Condition", "Chest Pain & Shortness of Breath"],
      ["Need",      "Cardiology consult + ECG review"],
      ["Route",     "Board-certified cardiologist"],
      ["Status",    "Priority triage"],
    ],
    tabs: [
      { icon: "heart",       name: "Cardiology",   tags: ["Arrhythmia", "Hypertension"]    },
      { icon: "activity",    name: "Chronic Care", tags: ["BP", "Diabetes"]                },
      { icon: "stethoscope", name: "Primary Care", tags: ["Annual", "Preventive"]          },
      { icon: "hospital",    name: "Urgent Care",  tags: ["Chest Pain", "Stroke"]          },
    ],
  },
  {
    iconName: "mental",
    sub:   "Wellness consultation",
    title: "Mental health support",
    rows: [
      ["Condition", "Anxiety & Burnout Syndrome"],
      ["Need",      "Therapy session + follow-up plan"],
      ["Route",     "Licensed therapist / psychiatrist"],
      ["Status",    "Routine appointment"],
    ],
    tabs: [
      { icon: "mental",      name: "Mental Health", tags: ["Anxiety", "PTSD"]              },
      { icon: "brain",       name: "Neurology",     tags: ["Migraines", "Memory"]          },
      { icon: "smile",       name: "Wellness",      tags: ["Stress", "Sleep"]              },
      { icon: "stethoscope", name: "Primary Care",  tags: ["Check-up", "Referral"]         },
    ],
  },
];

/* ─────────────────────────────────────────────────────────────
   HERO CAROUSEL  — tabs now clickable, preview strip added
───────────────────────────────────────────────────────────── */
function HeroCarousel() {
  const [idx,       setIdx]       = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [animCls,   setAnimCls]   = useState("cat-carousel--enter-next");
  const animating = useRef(false);
  const timerRef  = useRef(null);

  const goTo = useCallback((next, dir) => {
    if (animating.current || next === idx) return;
    animating.current = true;
    setAnimCls(dir === "next" ? "cat-carousel--exit-next" : "cat-carousel--exit-prev");
    setTimeout(() => {
      setIdx(next);
      setActiveTab(0);          /* reset tab on slide change */
      setAnimCls(dir === "next" ? "cat-carousel--enter-next" : "cat-carousel--enter-prev");
      animating.current = false;
    }, 300);
  }, [idx]);

  const startAuto = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setIdx(prev => {
        const next = (prev + 1) % SLIDES.length;
        setAnimCls("cat-carousel--enter-next");
        setActiveTab(0);
        animating.current = false;
        return next;
      });
    }, 4500);
  }, []);

  useEffect(() => { startAuto(); return () => clearInterval(timerRef.current); }, [startAuto]);

  const handlePrev = () => { clearInterval(timerRef.current); goTo((idx - 1 + SLIDES.length) % SLIDES.length, "prev"); startAuto(); };
  const handleNext = () => { clearInterval(timerRef.current); goTo((idx + 1) % SLIDES.length, "next");  startAuto(); };

  const slide      = SLIDES[idx];
  const currentTab = slide.tabs[activeTab];

  return (
    <div className="cat-hero__panel">

      {/* Dark info card */}
      <div className={`cat-carousel__card ${animCls}`}>
        <div className="cat-carousel__card-header">
          <div>
            <p className="cat-carousel__card-sub">{slide.sub}</p>
            <p className="cat-carousel__card-title">{slide.title}</p>
          </div>
          <div className="cat-carousel__icon-btn">
            <Icon name={slide.iconName} size={18} />
          </div>
        </div>
        <div className="cat-carousel__rows">
          {slide.rows.map(([label, value]) => (
            <div key={label} className="cat-carousel__row">
              <span className="cat-carousel__row-label">{label}</span>
              <span className="cat-carousel__row-value">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2×2 clickable mini-tab grid */}
      <div className="cat-carousel__tabs cat-carousel__tab-fade" key={idx}>
        {slide.tabs.map((tab, i) => (
          <button
            key={tab.name}
            className={`cat-carousel__tab${i === activeTab ? " cat-carousel__tab--active" : ""}`}
            onClick={() => setActiveTab(i)}
            aria-pressed={i === activeTab}
          >
            <span className="cat-carousel__tab-icon">
              <Icon name={tab.icon} size={20} />
            </span>
            <span className="cat-carousel__tab-name">{tab.name}</span>
            <span className="cat-carousel__tab-tags">{tab.tags.join(" · ")}</span>
          </button>
        ))}
      </div>

      {/* ── Preview strip (highlighted in image 1) ── */}
      <div className="cat-carousel__preview" key={`${idx}-${activeTab}`}>
        <span className="cat-carousel__preview-icon">
          <Icon name={currentTab.icon} size={16} />
        </span>
        <span className="cat-carousel__preview-name">{currentTab.name}</span>
        <div className="cat-carousel__preview-tags">
          {currentTab.tags.map(tag => (
            <span key={tag} className="cat-carousel__preview-tag">{tag}</span>
          ))}
        </div>
      </div>

      {/* Prev / dots / next */}
      <div className="cat-carousel__controls">
        <button className="cat-carousel__btn" onClick={handlePrev} aria-label="Previous">
          <Icon name="chevronLeft" size={14} />
        </button>
        <div className="cat-carousel__dots">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              className={`cat-carousel__dot${i === idx ? " cat-carousel__dot--active" : ""}`}
              onClick={() => { clearInterval(timerRef.current); goTo(i, i > idx ? "next" : "prev"); startAuto(); }}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
        <button className="cat-carousel__btn" onClick={handleNext} aria-label="Next">
          <Icon name="chevronRight" size={14} />
        </button>
      </div>

    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   STATIC DATA
───────────────────────────────────────────────────────────── */
const CATEGORIES = [
  { slug: "heart-vascular",  icon: "heart",  name: "Heart & Vascular",  tagline: "Cardiology, hypertension & circulatory health",    doctorCount: 52, conditions: ["Hypertension", "Arrhythmia", "Chest pain", "Heart failure"],        color: "#E8470B", bgTint: "rgba(232,71,11,0.07)"   },
  { slug: "brain-nerves",    icon: "brain",  name: "Brain & Nerves",    tagline: "Neurology, cognition & nervous system care",        doctorCount: 36, conditions: ["Migraines", "Epilepsy", "Memory issues", "Neuropathy"],             color: "#7C3AED", bgTint: "rgba(124,58,237,0.07)"  },
  { slug: "mental-wellness", icon: "smile",  name: "Mental Wellness",   tagline: "Psychiatry, therapy & emotional health",            doctorCount: 76, conditions: ["Anxiety", "Depression", "PTSD", "Sleep disorders"],                 color: "#0B57E8", bgTint: "rgba(11,87,232,0.07)"   },
  { slug: "child-health",    icon: "child",  name: "Child Health",      tagline: "Pediatrics, development & adolescent care",         doctorCount: 41, conditions: ["Vaccinations", "Growth checks", "Fever", "Allergies"],              color: "#059669", bgTint: "rgba(5,150,105,0.07)"   },
  { slug: "bones-joints",    icon: "bone",   name: "Bones & Joints",    tagline: "Orthopedics, rheumatology & musculoskeletal",       doctorCount: 29, conditions: ["Back pain", "Arthritis", "Fractures", "Sports injuries"],          color: "#D97706", bgTint: "rgba(217,119,6,0.07)"   },
  { slug: "respiratory",     icon: "wind",   name: "Respiratory",       tagline: "Pulmonology, asthma & lung health",                 doctorCount: 33, conditions: ["Asthma", "COPD", "Pneumonia", "Sleep apnoea"],                     color: "#0891B2", bgTint: "rgba(8,145,178,0.07)"   },
  { slug: "womens-health",   icon: "women",  name: "Women's Health",    tagline: "Gynaecology, obstetrics & reproductive care",       doctorCount: 44, conditions: ["Prenatal care", "PCOS", "Menopause", "Fertility"],                 color: "#DB2777", bgTint: "rgba(219,39,119,0.07)"  },
  { slug: "genetics-labs",   icon: "dna",    name: "Genetics & Labs",   tagline: "Diagnostics, genomics & lab interpretation",        doctorCount: 18, conditions: ["Genetic screening", "Lab review", "Hereditary risk", "Biomarkers"],color: "#4C5F87", bgTint: "rgba(76,95,135,0.07)"   },
];

const SPECIALTIES = [
  { slug: "primary-care",  icon: "stethoscope", name: "Primary Care",  count: 98, featured: true  },
  { slug: "cardiology",    icon: "heart",       name: "Cardiology",    count: 48, featured: false },
  { slug: "mental-health", icon: "smile",       name: "Mental Health", count: 76, featured: false },
  { slug: "dermatology",   icon: "skin",        name: "Dermatology",   count: 35, featured: false },
  { slug: "pediatrics",    icon: "child",       name: "Pediatrics",    count: 41, featured: false },
  { slug: "orthopedics",   icon: "bone",        name: "Orthopedics",   count: 29, featured: false },
  { slug: "neurology",     icon: "brain",       name: "Neurology",     count: 32, featured: false },
  { slug: "ophthalmology", icon: "eye",         name: "Ophthalmology", count: 22, featured: false },
];

/* NEW — Symptoms data */
const SYMPTOMS = [
  { slug: "fever",       icon: "thermometer", name: "Fever",        count: "120 doctors" },
  { slug: "headache",    icon: "brain",       name: "Headache",     count: "95 doctors"  },
  { slug: "cold-cough",  icon: "wind",        name: "Cold & Cough", count: "110 doctors" },
  { slug: "chest-pain",  icon: "heart",       name: "Chest Pain",   count: "60 doctors"  },
  { slug: "joint-pain",  icon: "bone",        name: "Joint Pain",   count: "70 doctors"  },
  { slug: "eye-problems",icon: "eye",         name: "Eye Problems", count: "40 doctors"  },
  { slug: "stress",      icon: "mental",      name: "Stress",       count: "85 doctors"  },
  { slug: "skin-issues", icon: "skin",        name: "Skin Issues",  count: "55 doctors"  },
];

/* NEW — B2B audiences */
const B2B_AUDIENCES = [
  { name: "Travel assistance companies",          desc: "Virtual care routing, physician access, reports, and continuity care coordination." },
  { name: "International medical assistance providers", desc: "Virtual care routing, physician access, reports, and continuity care coordination." },
  { name: "Employers and HR teams",               desc: "Virtual care routing, physician access, reports, and continuity care coordination." },
  { name: "TPAs and insurers",                    desc: "Virtual care routing, physician access, reports, and continuity care coordination." },
  { name: "Global mobility programs",             desc: "Virtual care routing, physician access, reports, and continuity care coordination." },
  { name: "Universities and student travel programs", desc: "Virtual care routing, physician access, reports, and continuity care coordination." },
];

/* NEW — Emergency items */
const EMERGENCY_ITEMS = [
  "Chest pain or heart attack symptoms",
  "Stroke-like symptoms",
  "Severe shortness of breath",
  "Loss of consciousness",
  "Severe allergic reaction",
  "Uncontrolled bleeding",
  "Suicidal thoughts or immediate danger",
];

const HERO_STATS = [
  { n: "12",   l: "Specialties"  },
  { n: "140+", l: "Conditions"   },
  { n: "6",    l: "B2B Segments" },
];

/* ─────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────── */
export default function Categories() {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? CATEGORIES.filter(c =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.tagline.toLowerCase().includes(query.toLowerCase()) ||
        c.conditions.some(cond => cond.toLowerCase().includes(query.toLowerCase()))
      )
    : CATEGORIES;

  return (
    <>
      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="cat-hero">
        <div className="cat-hero__inner">

          <div className="cat-hero__left">
            <div className="cat-hero__eyebrow">
              <Icon name="globe" size={14} />
              US-facing telehealth condition directory
            </div>
            <h1 className="cat-hero__title">
              Care categories and conditions built for how US patients search.
            </h1>
            <p className="cat-hero__copy">
              A sample Humancare Connect structure with 12 high-value specialties
              and a searchable condition directory for primary care, urgent care,
              chronic care, travel health, and business partners.
            </p>
            <div className="cat-hero-stats">
              {HERO_STATS.map(({ n, l }) => (
                <div key={l} className="cat-hero-stat">
                  <span className="cat-hero-stat__num">{n}</span>
                  <span className="cat-hero-stat__label">{l}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="cat-hero__right">
            <HeroCarousel />
          </div>

        </div>
      </section>

      {/* ── Category Cards ──────────────────────────────────── */}
      <section className="cat-section cat-section--bg">
        <div className="cat-section__wrap">
          <div className="cat-section__header">
            <div>
              <span className="cat-eyebrow">Browse by Category</span>
              <h2 className="cat-heading">
                {query
                  ? `${filtered.length} result${filtered.length !== 1 ? "s" : ""} for "${query}"`
                  : "All care categories"}
              </h2>
            </div>
            <div className="cat-section__header-right">
              {!query && (
                <p className="cat-subtext">
                  Each category contains multiple specialties and hundreds of verified,
                  telehealth-ready physicians.
                </p>
              )}
              <div className="cat-search">
                <span className="cat-search__icon"><Icon name="search" size={15} /></span>
                <input
                  type="text"
                  className="cat-search__input"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search categories or conditions…"
                  aria-label="Search categories"
                />
                {query && (
                  <button className="cat-search__clear" onClick={() => setQuery("")} aria-label="Clear">✕</button>
                )}
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="cat-empty">
              <p className="cat-empty__text">No categories match "{query}"</p>
              <button className="cat-empty__btn" onClick={() => setQuery("")}>Clear search</button>
            </div>
          ) : (
            <div className="cat-grid">
              {filtered.map((cat, i) => (
                <Link key={cat.slug} to={`/categories/${cat.slug}`} className="cat-card" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="cat-card__icon" style={{ background: cat.bgTint, color: cat.color }}>
                    <Icon name={cat.icon} size={22} />
                  </div>
                  <h3 className="cat-card__name">{cat.name}</h3>
                  <p className="cat-card__tagline">{cat.tagline}</p>
                  <div className="cat-card__chips">
                    {cat.conditions.slice(0, 3).map(cond => (
                      <span key={cond} className="cat-card__chip" style={{ background: cat.bgTint, color: cat.color }}>{cond}</span>
                    ))}
                    {cat.conditions.length > 3 && (
                      <span className="cat-card__chip" style={{ background: "#F7FAFF", color: "#5C7099" }}>+{cat.conditions.length - 3} more</span>
                    )}
                  </div>
                  <div className="cat-card__footer">
                    <span className="cat-card__count">{cat.doctorCount} doctors</span>
                    <span className="cat-card__arrow" style={{ background: cat.bgTint, color: cat.color }}>
                      <Icon name="chevronRight" size={14} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Specialties Strip ───────────────────────────────── */}
      <section className="cat-section cat-section--white">
        <div className="cat-section__wrap">
          <div className="cat-section__header--center">
            <span className="cat-eyebrow">Top Specialties</span>
            <h2 className="cat-heading">Most-booked specialties</h2>
            <p className="cat-subtext--center">
              Jump straight to a specialty for detailed condition lists, doctor profiles,
              and same-day booking.
            </p>
          </div>
          <div className="cat-spec-grid">
            {SPECIALTIES.map(sp => (
              <Link
                key={sp.slug}
                to={sp.slug === "primary-care" ? "/specialty/primary-care" : `/specialty/${sp.slug}`}
                className={`cat-spec-item${sp.featured ? " cat-spec-item--featured" : ""}`}
              >
                <div className="cat-spec-item__icon"><Icon name={sp.icon} size={18} /></div>
                <div className="cat-spec-item__text">
                  <div className="cat-spec-item__row">
                    <span className="cat-spec-item__name">{sp.name}</span>
                    {sp.featured && <span className="cat-spec-item__badge">Top</span>}
                  </div>
                  <span className="cat-spec-item__count">{sp.count} doctors</span>
                </div>
                <span className="cat-spec-item__chevron"><Icon name="chevronRight" size={14} /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── NEW: Symptoms Strip ─────────────────────────────── */}
      <section className="cat-section cat-section--bg">
        <div className="cat-section__wrap">
          <div className="cat-section__header--center">
            <span className="cat-eyebrow">Browse by Symptom</span>
            <h2 className="cat-heading">Find care by what you feel</h2>
            <p className="cat-subtext--center">
              Search by symptom and get matched to the right specialist for your concern.
            </p>
          </div>
          <div className="cat-spec-grid">
            {SYMPTOMS.map(sym => (
              <Link key={sym.slug} to={`/symptoms/${sym.slug}`} className="cat-spec-item">
                <div className="cat-spec-item__icon"><Icon name={sym.icon} size={18} /></div>
                <div className="cat-spec-item__text">
                  <div className="cat-spec-item__row">
                    <span className="cat-spec-item__name">{sym.name}</span>
                  </div>
                  <span className="cat-spec-item__count">{sym.count}</span>
                </div>
                <span className="cat-spec-item__chevron"><Icon name="chevronRight" size={14} /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── NEW: B2B Section ────────────────────────────────── */}
      <section className="cat-section cat-section--white cat-b2b" id="b2b">
        <div className="cat-section__wrap">
          <div className="cat-b2b__inner">

            {/* Left */}
            <div className="cat-b2b__left">
              <span className="cat-eyebrow">B2B Positioning</span>
              <h2 className="cat-b2b__title">
                Built for partners who need medical access across borders.
              </h2>
              <p className="cat-b2b__copy">
                Humancare Connect should not look like a generic doctor directory.
                The strongest positioning is B2B telehealth support for assistance
                companies, insurers, TPAs, employers, and international travelers.
              </p>
              <Link to="#emergency" className="cat-b2b__cta">
                View safety language
                <Icon name="arrowRight" size={15} />
              </Link>
            </div>

            {/* Right — 3×2 audience grid */}
            <div className="cat-b2b__grid">
              {B2B_AUDIENCES.map((a, i) => (
                <div key={a.name} className="cat-b2b__card" style={{ animationDelay: `${i * 60}ms` }}>
                  <span className="cat-b2b__card-icon">
                    <Icon name="building" size={20} />
                  </span>
                  <h4 className="cat-b2b__card-name">{a.name}</h4>
                  <p className="cat-b2b__card-desc">{a.desc}</p>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── NEW: Emergency Section ──────────────────────────── */}
      <section className="cat-emergency" id="emergency">
        <div className="cat-section__wrap">
          <div className="cat-emergency__inner">

            {/* Left — disclaimer card */}
            <div className="cat-emergency__left">
              <span className="cat-emergency__warn-icon">
                <Icon name="alertTri" size={28} />
              </span>
              <h2 className="cat-emergency__title">Emergency disclaimer</h2>
              <p className="cat-emergency__copy">
                For the US market, serious symptoms should be clearly routed to
                emergency services. This protects patients and makes the website
                more trustworthy.
              </p>
              <div className="cat-emergency__callout">
                If you are experiencing a life-threatening emergency, call <strong>911</strong> or
                go to the nearest emergency room immediately.
              </div>
            </div>

            {/* Right — white card */}
            <div className="cat-emergency__right">
              <h3 className="cat-emergency__right-title">
                Do not market these as routine telehealth conditions
              </h3>
              <div className="cat-emergency__list">
                {EMERGENCY_ITEMS.map(item => (
                  <div key={item} className="cat-emergency__item">
                    <span className="cat-emergency__item-icon">
                      <Icon name="alertTri" size={14} />
                    </span>
                    <span className="cat-emergency__item-text">{item}</span>
                  </div>
                ))}
              </div>
              <div className="cat-emergency__rec">
                <div className="cat-emergency__rec-head">
                  <Icon name="check" size={16} />
                  Recommended wording
                </div>
                <p className="cat-emergency__rec-body">
                  "Humancare Connect provides virtual consultations for common non-emergency
                  medical concerns, continuity care, prescription refill requests, and travel
                  health support. Availability depends on physician assessment, location,
                  regulations, and clinical appropriateness."
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="cat-cta">
        <div className="cat-cta__card">
          <div className="cat-cta__tag">
            <span className="cat-cta__tag-dot" />
            Ready when you are
          </div>
          <h2 className="cat-cta__title">
            Find your specialist<br />
            <em>in under 2 minutes.</em>
          </h2>
          <p className="cat-cta__copy">
            Search, book, and consult with a verified physician from anywhere —
            same-day appointments available across all categories.
          </p>
          <div className="cat-cta__actions">
            <Link to="/appointment-booking" className="cat-btn-primary">
              Book a consultation
              <Icon name="arrowRight" size={16} />
            </Link>
            <Link to="/specialty" className="cat-btn-outline">
              Browse specialties
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}