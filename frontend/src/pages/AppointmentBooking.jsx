import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./AppointmentBooking.css";
import { usePrices } from "../context/PricingContext";

// ─── Data ────────────────────────────────────────────────────────────────────
const HCC_TREE = [
  {
    id: "general",
    label: "General & Everyday Care",
    e: "🩺",
    desc: "Quick consultations for common illnesses, routine check-ups, and everyday health concerns — no clinic visit needed.",
    specs: [
      {
        name: "General Physician", ico: "🩺", live: true, count: "98 doctors", cost: 100,
        desc: "Your first stop for fevers, infections, and everyday ailments. Get a diagnosis and prescription fast.",
        conds: [["Fever", "🌡️"], ["Cold & flu", "🤧"], ["Cough & sore throat", "😷"], ["Headache", "🤕"], ["Sinus infection", "👃"], ["Body aches", "💪"], ["Fatigue", "😮‍💨"], ["Minor infections", "🩹"]],
      },
      {
        name: "Internal Medicine", ico: "🏥", cost: 100,
        desc: "Expert evaluation of complex or multi-system symptoms when you need more than a quick consult.",
        conds: [["Undiagnosed symptoms", "❓"], ["Multi-system complaints", "🩺"], ["Preventive screening", "🛡️"], ["Medication review", "💊"]],
      },
      {
        name: "Family Medicine", ico: "👨‍👩‍👧", cost: 100,
        desc: "Ongoing care for every member of the family — from toddlers to seniors — under one trusted doctor.",
        conds: [["Routine check-ups", "✅"], ["Whole-family illness", "👪"], ["Chronic-disease review", "📋"], ["Vaccination advice", "💉"]],
      },
    ],
  },
  {
    id: "mental",
    label: "Mental Health",
    e: "🧠",
    desc: "Confidential support for anxiety, depression, and emotional wellbeing from licensed psychiatrists and therapists.",
    specs: [
      {
        name: "Psychiatry", ico: "🧠", live: true, count: "76 doctors", cost: 1499,
        desc: "Diagnosis and medication management for anxiety, depression, ADHD, and other psychiatric conditions.",
        conds: [["Anxiety", "😟"], ["Depression", "💭"], ["Bipolar follow-up", "🔄"], ["OCD", "🔁"], ["PTSD", "🌀"], ["Panic attacks", "⚡"], ["Insomnia", "😴"], ["ADHD follow-up", "🎯"]],
      },
      {
        name: "Psychology / Counselling", ico: "💬", cost: 1299,
        desc: "Talk therapy for stress, grief, relationship issues, and personal growth with qualified psychologists.",
        conds: [["Stress", "😣"], ["Grief & loss", "🕊️"], ["Relationship issues", "💔"], ["Low self-esteem", "🪞"], ["Trauma support", "🤝"]],
      },
      {
        name: "Behavioral Health", ico: "🧩", cost: 999,
        desc: "Practical strategies to change habits, manage anger, and address substance-use or sleep concerns.",
        conds: [["Anger management", "🔥"], ["Adjustment difficulties", "🔀"], ["Substance-use concerns", "🚭"], ["Sleep-related anxiety", "🌙"]],
      },
    ],
  },
  {
    id: "skin",
    label: "Skin & Hair",
    e: "🧴",
    desc: "Dermatologist-reviewed care for acne, eczema, hair loss, rashes, and all things skin — from the comfort of home.",
    specs: [
      {
        name: "Dermatology", ico: "🧴", live: true, count: "35 doctors", cost: 100,
        desc: "Board-certified dermatologists for acne, eczema, psoriasis, hair loss, and skin checks.",
        conds: [["Acne", "🔴"], ["Eczema", "🌾"], ["Psoriasis", "🩹"], ["Skin rashes", "🌡️"], ["Hives", "🐝"], ["Rosacea", "🌹"], ["Fungal infections", "🍄"], ["Hair loss", "💈"], ["Nail problems", "💅"], ["Mole & skin checks", "🔎"]],
      },
    ],
  },
  {
    id: "women",
    label: "Women's Health",
    e: "🌸",
    desc: "Holistic care for every stage of a woman's life — periods, pregnancy, menopause, and mental wellbeing.",
    specs: [
      {
        name: "OB-GYN", ico: "🌸", count: "44 doctors", cost: 1199,
        desc: "Specialist care for periods, PCOS, contraception, vaginal health, and prenatal consultations.",
        conds: [["Irregular periods", "📅"], ["Painful periods", "😣"], ["PCOS", "🌺"], ["Contraception advice", "💊"], ["Vaginal infections", "🩺"], ["Pelvic pain", "⚡"], ["Prenatal teleconsult", "🤰"]],
      },
      {
        name: "Menopause Care", ico: "🌙", cost: 999,
        desc: "Evidence-based guidance on hot flashes, mood changes, sleep, and hormone replacement therapy.",
        conds: [["Hot flashes", "🔥"], ["Mood changes", "🎭"], ["Sleep disturbance", "😴"], ["HRT guidance", "💊"]],
      },
      {
        name: "Women's Mental Health", ico: "💗", cost: 1099,
        desc: "Sensitive support for postnatal depression, perinatal anxiety, and PMDD from specialist clinicians.",
        conds: [["Postnatal depression", "🍼"], ["Perinatal anxiety", "🤱"], ["PMDD", "📆"]],
      },
      {
        name: "Lactation Consulting", ico: "🤱", cost: 699,
        desc: "Expert guidance on breastfeeding, latch issues, milk supply, and comfortable weaning.",
        conds: [["Low milk supply", "🍼"], ["Latch problems", "👶"], ["Nipple pain", "🩹"], ["Weaning guidance", "🥄"]],
      },
    ],
  },
  {
    id: "men",
    label: "Men's Health",
    e: "♂️",
    desc: "Private, judgment-free consultations for men's unique health concerns — from hormones to urological issues.",
    specs: [
      {
        name: "Men's Health", ico: "♂️", count: "19 doctors", cost: 100,
        desc: "Discreet care for erectile dysfunction, low testosterone, hair loss, and prostate health.",
        conds: [["Erectile dysfunction", "💙"], ["Low testosterone", "📉"], ["Hair loss", "💈"], ["Prostate concerns", "🔬"], ["Low libido", "💤"]],
      },
      {
        name: "Urology", ico: "🚹", cost: 100,
        desc: "Specialist advice for UTIs, kidney stones, bladder issues, and urinary incontinence.",
        conds: [["UTIs", "🚻"], ["Kidney stones follow-up", "🪨"], ["Blood in urine", "🩸"], ["Incontinence", "💧"], ["Bladder problems", "🚽"]],
      },
    ],
  },
  {
    id: "family",
    label: "Children & Family Care",
    e: "🧒",
    desc: "Trusted paediatric and adolescent care — from baby fevers and rashes to teen health and development.",
    specs: [
      {
        name: "Pediatrics", ico: "🧒", live: true, count: "41 doctors", cost: 699,
        desc: "Child-specialist doctors for fevers, infections, rashes, feeding concerns, and growth milestones.",
        conds: [["Fever in children", "🌡️"], ["Cough & cold", "🤧"], ["Childhood rashes", "🌸"], ["Ear infections", "👂"], ["Feeding concerns", "🍼"], ["Growth & development", "📏"], ["Vaccination advice", "💉"]],
      },
      {
        name: "Adolescent Care", ico: "🧑", cost: 699,
        desc: "Compassionate support for teens navigating acne, puberty, anxiety, and sports injuries.",
        conds: [["Teen acne", "🔴"], ["Puberty concerns", "🌱"], ["Teen mood & anxiety", "😟"], ["Menstrual problems", "📅"], ["Sports injuries", "🏃"]],
      },
    ],
  },
  {
    id: "weight",
    label: "Weight & Nutrition",
    e: "🥗",
    desc: "Personalised plans for healthy weight management, balanced nutrition, and sustainable lifestyle change.",
    specs: [
      {
        name: "Weight Management", ico: "⚖️", cost: 999,
        desc: "Medical weight-loss guidance including GLP-1 eligibility assessment and metabolic health reviews.",
        conds: [["Obesity", "📊"], ["GLP-1 eligibility", "💉"], ["Metabolic syndrome", "🔬"], ["Weight-loss planning", "🎯"], ["Binge eating", "🍽️"]],
      },
      {
        name: "Nutrition & Dietetics", ico: "🥗", cost: 699,
        desc: "Registered dietitians creating meal plans for diabetes, cholesterol, food intolerances, and more.",
        conds: [["Diabetic diet", "🩸"], ["Cholesterol diet", "🫀"], ["Food-intolerance plan", "🚫"], ["Pregnancy nutrition", "🤰"], ["Sports nutrition", "🏋️"]],
      },
      {
        name: "Lifestyle Medicine", ico: "🌱", cost: 599,
        desc: "Holistic coaching on diet, exercise, sleep hygiene, and stress reduction for long-term wellness.",
        conds: [["Healthy-habit coaching", "✅"], ["Diet & exercise plan", "🏃"], ["Sleep hygiene", "😴"], ["Stress reduction", "🧘"]],
      },
    ],
  },
  {
    id: "chronic",
    label: "Chronic Care & Expert Opinion",
    e: "📋",
    desc: "Specialist management of long-term conditions and authoritative second opinions on complex diagnoses.",
    specs: [
      {
        name: "Cardiology", ico: "🫀", live: true, count: "48 doctors", cost: 1799,
        desc: "Heart specialists for blood pressure, chest pain, palpitations, high cholesterol, and follow-up care.",
        conds: [["High blood pressure", "💉"], ["Chest pain (non-emerg.)", "❤️"], ["Palpitations", "💓"], ["High cholesterol", "🩸"], ["Heart failure follow-up", "🫀"]],
      },
      {
        name: "Neurology", ico: "🧬", live: true, count: "32 doctors", cost: 1699,
        desc: "Neurologists for migraines, seizure follow-up, numbness, tremor, dizziness, and memory concerns.",
        conds: [["Migraine & headaches", "🤕"], ["Seizures follow-up", "⚡"], ["Numbness & tingling", "🖐️"], ["Tremor", "🤲"], ["Dizziness", "💫"], ["Memory concerns", "🧠"]],
      },
      {
        name: "Endocrinology", ico: "⚕️", cost: 1499,
        desc: "Expert management of thyroid disorders, diabetes, PCOS, hormone imbalance, and osteoporosis.",
        conds: [["Thyroid disorders", "🦋"], ["Diabetes (Type 1 & 2)", "🩸"], ["PCOS", "🌺"], ["Hormone imbalance", "⚗️"], ["Osteoporosis", "🦴"]],
      },
      {
        name: "Gastroenterology", ico: "🍽️", cost: 1399,
        desc: "Gut specialists for acid reflux, IBS, constipation, stomach pain, and persistent bloating.",
        conds: [["Acid reflux / GERD", "🔥"], ["IBS", "🌀"], ["Constipation", "🚽"], ["Stomach pain", "😣"], ["Bloating", "🎈"]],
      },
      {
        name: "Pulmonology", ico: "🫁", cost: 1299,
        desc: "Lung specialists for asthma, COPD, chronic cough, breathlessness, and sleep apnea screening.",
        conds: [["Asthma", "💨"], ["COPD", "🫁"], ["Chronic cough", "😷"], ["Shortness of breath", "😮‍💨"], ["Sleep apnea screening", "😴"]],
      },
      {
        name: "Expert Medical Opinion", ico: "📑", cost: 2499,
        desc: "Authoritative second opinions on cancer, surgery, complex diagnoses, and treatment plans.",
        conds: [["Cancer second opinion", "🎗️"], ["Surgery second opinion", "🏥"], ["Complex-diagnosis review", "🔍"], ["Treatment-plan review", "📋"]],
      },
    ],
  },
  {
    id: "eeb",
    label: "Eye, Ear & Bone",
    e: "🦴",
    desc: "Specialist care for vision problems, ear and sinus conditions, and musculoskeletal pain and injuries.",
    specs: [
      {
        name: "Ophthalmology", ico: "👁️", live: true, count: "22 doctors", cost: 999,
        desc: "Eye specialists for red or irritated eyes, dry eyes, vision changes, infections, and styes.",
        conds: [["Red / irritated eyes", "👁️"], ["Dry eyes", "🌵"], ["Vision changes", "🔭"], ["Eye infections", "🦠"], ["Stye", "💢"]],
      },
      {
        name: "ENT", ico: "👂", cost: 899,
        desc: "Ear, nose, and throat specialists for sinusitis, sore throats, ear infections, and vertigo.",
        conds: [["Sinusitis", "👃"], ["Sore throat / tonsillitis", "😮"], ["Ear infections", "👂"], ["Vertigo", "💫"], ["Nasal congestion", "🤧"]],
      },
      {
        name: "Orthopedics", ico: "🦴", live: true, count: "29 doctors", cost: 1299,
        desc: "Bone and joint specialists for back pain, neck pain, knee pain, sprains, and sports injuries.",
        conds: [["Back pain", "🔙"], ["Neck pain", "🧍"], ["Knee & joint pain", "🦵"], ["Sprains & strains", "🤕"], ["Sports injuries", "🏃"]],
      },
    ],
  },
  {
    id: "sexual",
    label: "Sexual Health",
    e: "💗",
    desc: "Private, non-judgmental consultations for STIs, contraception, and sexual wellbeing concerns.",
    specs: [
      {
        name: "Sexual Health", ico: "💗", cost: 799,
        desc: "Confidential advice on STI testing, contraception, erectile dysfunction, and safe-sex practices.",
        conds: [["STI advice & testing", "🔬"], ["Contraception advice", "💊"], ["Erectile dysfunction", "💙"], ["Confidential care", "🤐"], ["Safe-sex counselling", "🤝"]],
      },
    ],
  },
  {
    id: "travel",
    label: "Travel & Global Care",
    e: "✈️",
    desc: "Pre-travel health planning, malaria prevention, and cross-border care continuity for international travellers.",
    specs: [
      {
        name: "Travel Medicine", ico: "✈️", cost: 899,
        desc: "Pre-travel vaccination advice, malaria prevention, altitude sickness, and post-travel illness guidance.",
        conds: [["Pre-travel vaccination", "💉"], ["Malaria prevention", "🦟"], ["Altitude sickness", "⛰️"], ["Travel-illness advice", "🤒"], ["Post-travel symptoms", "🌡️"]],
      },
      {
        name: "Global / Cross-Border Care", ico: "🌍", cost: 1999,
        desc: "Seamless care continuity, referral coordination, and prescription support for patients living abroad.",
        conds: [["Cross-border consult", "🌐"], ["Care continuity abroad", "🔄"], ["Referral coordination", "🗺️"], ["Travel medical assistance", "🆘"], ["Prescription continuity", "💊"]],
      },
    ],
  },
];

// Build flat helpers from a (possibly price-enriched) tree
function buildFlatHelpers(tree) {
  const specs = [];
  const conds = [];
  tree.forEach((cat) =>
    cat.specs.forEach((s) => {
      specs.push({ ...s, catId: cat.id, catLabel: cat.label });
      s.conds.forEach(([cn, ci]) =>
        conds.push({ name: cn, ico: ci, to: s.name, catId: cat.id, catLabel: cat.label, cost: s.cost }),
      );
    }),
  );
  return { specs, conds };
}

// ─── Time slots ───────────────────────────────────────────────────────────────
const ALL_TIME_SLOTS = [
  "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM",
  "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM",
  "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM",
];

function isSlotPassed(dateStr, slot) {
  const today = new Date().toISOString().split("T")[0];
  if (dateStr !== today) return false;
  const now = new Date();
  const [time, ampm] = slot.split(" ");
  let [h, m] = time.split(":").map(Number);
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────
function Breadcrumb({ items, onNavigate }) {
  return (
    <div className="hcc-breadcrumb">
      {items.map((item, i) => (
        <span key={i} className="hcc-bc-item">
          {i > 0 && <span className="hcc-bc-sep">›</span>}
          {i < items.length - 1 ? (
            <button className="hcc-bc-link" onClick={() => onNavigate(i)}>{item}</button>
          ) : (
            <span className="hcc-bc-current">{item}</span>
          )}
        </span>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AppointmentBooking() {
  const navigate = useNavigate();
  const categoryPrices = usePrices();
  const [drillLevel, setDrillLevel] = useState("cat");
  const [activeCat, setActiveCat] = useState(null);
  const [activeSpec, setActiveSpec] = useState(null);
  const [browseTab, setBrowseTab] = useState(null);
  const [query, setQuery] = useState("");

  // Apply Super Admin category prices to all specialties in each category
  const enrichedTree = useMemo(() => {
    if (!categoryPrices) return HCC_TREE;
    return HCC_TREE.map((cat) => ({
      ...cat,
      specs: cat.specs.map((spec) => ({
        ...spec,
        cost: categoryPrices[cat.id]?.price ?? spec.cost,
      })),
    }));
  }, [categoryPrices]);

  const { specs: HCC_SPECS, conds: HCC_CONDS } = useMemo(
    () => buildFlatHelpers(enrichedTree),
    [enrichedTree],
  );

  const switchRef = useRef(null);
  const gliderRef = useRef(null);

  const tabs = [
    { id: "cat", num: "01", label: "Categories" },
    { id: "spec", num: "02", label: "Specialties" },
    { id: "cond", num: "03", label: "Conditions" },
  ];

  const activeTabId = browseTab ?? drillLevel;

  const moveGlider = () => {
    if (!switchRef.current || !gliderRef.current) return;
    const active = switchRef.current.querySelector("button.active");
    if (!active) return;
    gliderRef.current.style.width = active.offsetWidth + "px";
    gliderRef.current.style.transform = `translateX(${active.offsetLeft - 5}px)`;
  };

  useEffect(() => { moveGlider(); }, [activeTabId]);
  useEffect(() => {
    window.addEventListener("resize", moveGlider);
    return () => window.removeEventListener("resize", moveGlider);
  }, []);

  const q = query.trim().toLowerCase();

  const visibleFlatSpecs = useMemo(
    () => HCC_SPECS.filter((s) => !q || s.name.toLowerCase().includes(q)),
    [q, HCC_SPECS],
  );
  const visibleFlatConds = useMemo(
    () => HCC_CONDS.filter((c) => !q || c.name.toLowerCase().includes(q) || c.to.toLowerCase().includes(q)),
    [q, HCC_CONDS],
  );
  const visibleCats = useMemo(
    () => enrichedTree.filter((c) => !q || c.label.toLowerCase().includes(q) || c.specs.some((s) => s.name.toLowerCase().includes(q))),
    [q, enrichedTree],
  );

  const handleTabSwitch = (tabId) => {
    if (tabId === "cat") {
      setBrowseTab(null);
      setDrillLevel("cat");
      setActiveCat(null);
      setActiveSpec(null);
    } else if (tabId === "spec") {
      setBrowseTab("spec");
    } else {
      setBrowseTab("cond");
    }
    setQuery("");
  };

  const handleOpenCat = (cat) => {
    setBrowseTab(null);
    setActiveCat(cat);
    setDrillLevel("spec");
    setQuery("");
  };

  const handleOpenSpec = (spec) => {
    setBrowseTab(null);
    setActiveSpec(spec);
    setDrillLevel("cond");
    setQuery("");
  };

  const handleSelectCond = (condName, condIco, spec) => {
    navigate("/appointment-booking/form", {
      state: {
        selection: {
          specName: spec.name,
          specIco: spec.ico,
          live: spec.live,
          catLabel: spec.catLabel,
          cost: spec.cost,
          condName,
          condIco,
        },
      },
    });
  };

  const handleFlatCondClick = (cond) => {
    const spec = HCC_SPECS.find((s) => s.name === cond.to && s.catId === cond.catId);
    if (spec) handleSelectCond(cond.name, cond.ico, spec);
  };

  const handleFlatSpecClick = (spec) => {
    const cat = enrichedTree.find((c) => c.id === spec.catId);
    setBrowseTab(null);
    setActiveCat(cat);
    setActiveSpec(spec);
    setDrillLevel("cond");
    setQuery("");
  };

  const handleBreadcrumb = (idx) => {
    if (idx === 0) { setDrillLevel("cat"); setActiveCat(null); setActiveSpec(null); }
    if (idx === 1) { setDrillLevel("spec"); setActiveSpec(null); }
  };

  const handleCardClick = (e, action) => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return;
    }
    action();
  };

  const breadcrumbItems = ["All Categories"];
  if (activeCat) breadcrumbItems.push(activeCat.label);
  if (activeSpec) breadcrumbItems.push(activeSpec.name);

  const searchPlaceholder =
    activeTabId === "cat" ? "Search categories…" :
      activeTabId === "spec" ? "Search specialties…" :
        "Search conditions / symptoms…";

  const drillConds = activeSpec ? activeSpec.conds : [];

  const activeCatIndex = activeCat
    ? enrichedTree.findIndex((c) => c.id === activeCat.id)
    : -1;
  const catNumLabel = activeCatIndex >= 0
    ? String(activeCatIndex + 1).padStart(2, "0")
    : null;

  return (
    <section className="hcc-sx">
      <div className="wrap">

        {/* ── CENTERED HERO ── */}
        <div className="head">
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            Discover Care
          </span>

          <h2>Find the right online doctor for your needs.</h2>

          <p className="lead">
            Book an online doctor appointment in minutes and access secure virtual healthcare services without long wait times or unnecessary clinic visits.
          </p>
        </div>

        <div className="top-controls">
          {/* ── NUMBERED TAB BAR ── */}
          <div className="tab-bar-wrap">
            <div className="switch" ref={switchRef}>
              <span className="glider" ref={gliderRef} />
              {tabs.map((t) => (
                <button
                  key={t.id}
                  data-tab={t.id}
                  className={activeTabId === t.id ? "active" : ""}
                  onClick={() => handleTabSwitch(t.id)}
                >
                  <span className="tab-num">{t.num}</span>
                  <span className="tab-label">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── SEARCH TOOLBAR ── */}
          <div className="toolbar">
            <div className="search">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                autoComplete="off"
              />
            </div>
          </div>
        </div>

        {/* ── CONTENT CARD ── */}
        <div className="content-card">

          {/* ── DRILL MODE ── */}
          {!browseTab && (
            <>
              {drillLevel !== "cat" && (
                <div style={{ padding: "28px 40px 0" }}>
                  <Breadcrumb items={breadcrumbItems} onNavigate={handleBreadcrumb} />
                </div>
              )}

              {/* ── Category grid ── */}
              {drillLevel === "cat" && (
                <div className="panel">
                  <div className="catgrid">
                    {visibleCats.length ? (
                      visibleCats.map((c) => {
                        const sc = c.specs.length;
                        const cc = c.specs.reduce((n, s) => n + s.conds.length, 0);
                        return (
                          <div
                            key={c.id}
                            className="catcard"
                            onClick={(e) => handleCardClick(e, () => handleOpenCat(c))}
                          >
                            <div className="catcard-row1">
                              <div className="ic">{c.e}</div>
                              <h3>{c.label}</h3>
                            </div>
                            {/* ── CHANGED: render custom desc instead of auto-generated samp ── */}
                            <div className="samp">{c.desc}</div>
                            <div className="catcard-row3">
                              <div className="meta">{sc} specialties · {cc} conditions</div>
                              <div className="go">Explore →</div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="empty"><div className="big">🔍</div>No categories match.</div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Specialty list ── */}
              {drillLevel === "spec" && activeCat && (
                <div className="panel">
                  <div className="hcc-level-label">
                    {catNumLabel && <>{catNumLabel} —</>}
                    <span style={{ fontSize: 20 }}>{activeCat.e}</span>
                    {activeCat.label}
                  </div>
                  <div className="grid">
                    {activeCat.specs
                      .filter((s) => !q || s.name.toLowerCase().includes(q))
                      .map((s) => {
                        const specWithCat = { ...s, catId: activeCat.id, catLabel: activeCat.label, cost: s.cost };
                        const condCount = s.conds.length;
                        return (
                          <div
                            key={s.name}
                            className="spec"
                            onClick={(e) => handleCardClick(e, () => handleOpenSpec(specWithCat))}
                          >
                            {s.live && <span className="live">LIVE</span>}
                            <div className="spec-row1">
                              <div className="ic">{s.ico}</div>
                              <h3>{s.name}</h3>
                            </div>
                            {/* ── CHANGED: render custom spec desc ── */}
                            <div className="spec-desc">{s.desc}</div>
                            <div className="spec-row3">
                              <span className="count">{s.count || "Book now"}</span>
                              <span className="condcount">{condCount} condition{condCount === 1 ? "" : "s"}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* ── Condition list ── (unchanged) ── */}
              {drillLevel === "cond" && activeSpec && (
                <div className="panel">
                  <div className="hcc-level-label">
                    <span style={{ fontSize: 20 }}>{activeSpec.ico}</span>
                    {activeSpec.name} — select your condition
                  </div>
                  <div className="condgrid">
                    {drillConds
                      .filter(([name]) => !q || name.toLowerCase().includes(q))
                      .map(([name, ico]) => (
                        <div
                          key={name}
                          className="condcard"
                          onClick={(e) => handleCardClick(e, () => handleSelectCond(name, ico, activeSpec))}
                        >
                          <div className="condcard-ico">{ico}</div>
                          <div className="condcard-body">
                            <div className="condcard-name">{name}</div>
                            <div className="condcard-desc">{activeSpec.name}</div>
                          </div>
                        </div>
                      ))}
                    <div
                      className="condcard condcard-other"
                      onClick={(e) => handleCardClick(e, () => handleSelectCond("General Consultation", "🩺", activeSpec))}
                    >
                      <div className="condcard-ico">💬</div>
                      <div className="condcard-body">
                        <div className="condcard-name">Other / not listed</div>
                        <div className="condcard-desc">{activeSpec.name}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── FLAT BROWSE: Specialties ── */}
          {browseTab === "spec" && (
            <div className="panel">
              <div className="grid">
                {visibleFlatSpecs.length ? (
                  visibleFlatSpecs.map((s) => {
                    const condCount = s.conds.length;
                    return (
                      <div
                        key={s.name + s.catId}
                        className="spec"
                        onClick={(e) => handleCardClick(e, () => handleFlatSpecClick(s))}
                      >
                        {s.live && <span className="live">LIVE</span>}
                        <div className="spec-row1">
                          <div className="ic">{s.ico}</div>
                          <h3>{s.name}</h3>
                        </div>
                        {/* ── CHANGED: render custom spec desc in flat browse too ── */}
                        <div className="spec-desc">{s.desc}</div>
                        <div className="spec-row3">
                          <span className="count">{s.count || "Book now"}</span>
                          <span className="condcount">{condCount} condition{condCount === 1 ? "" : "s"}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty"><div className="big">🔍</div>No specialties found.</div>
                )}
              </div>
            </div>
          )}

          {/* ── FLAT BROWSE: Conditions ── (unchanged) ── */}
          {browseTab === "cond" && (
            <div className="panel">
              <div className="condgrid">
                {visibleFlatConds.length ? (
                  visibleFlatConds.map((c, i) => (
                    <div
                      key={i}
                      className="condcard"
                      onClick={(e) => handleCardClick(e, () => handleFlatCondClick(c))}
                    >
                      <div className="condcard-ico">{c.ico}</div>
                      <div className="condcard-body">
                        <div className="condcard-name">{c.name}</div>
                        <div className="condcard-desc">{c.to}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty"><div className="big">🔍</div>No conditions match.</div>
                )}
              </div>
            </div>
          )}

        </div>{/* /content-card */}

      </div>
    </section>
  );
}