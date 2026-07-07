import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./AppointmentBooking.css";
import { usePrices, usePricingMeta } from "../context/PricingContext";

// ─── Search helpers ─────────────────────────────────────────────────────────
// Plain `.includes()` matches a query ANYWHERE inside a string, including
// mid-word — e.g. searching "men" would match "Manage**men**t" or "Women's".
// matchQuery() instead matches only at word boundaries (start of a word),
// so "men" matches "Men's Health", "Mental Health", "Menstrual Cramps"
// but NOT "Weight Management" or "Women's Health".
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchQuery(text, q) {
  if (!q) return true;
  if (!text) return false;
  const re = new RegExp(`\\b${escapeRegExp(q)}`, "i");
  return re.test(text);
}

// ─── Data ────────────────────────────────────────────────────────────────────
// Only fields the pricing API does NOT own live here: id, icon, specialties
// (name, icon, live, count, conditions). Category `label`, specialty `cost`,
// and `currency` all come from the pricing API (see enrichedTree below), so
// they are intentionally NOT duplicated in this tree.
const HCC_TREE = [
  // Child and Family care
  {
    id: "general",
    icon: "🩺",
    specialties: [
      {
        name: "General Physician", icon: "🩺", live: true, count: "98 doctors",
        conditions: [["Fever", "🌡️"], ["Cold & flu", "🤧"], ["Cough & sore throat", "😷"], ["Headache", "🤕"], ["Sinus infection", "👃"], ["Body aches", "💪"], ["Fatigue", "😮‍💨"], ["Minor infections", "🩹"]],
      },
      {
        name: "Internal Medicine", icon: "🏥",
        conditions: [["Undiagnosed symptoms", "❓"], ["Multi-system complaints", "🩺"], ["Preventive screening", "🛡️"], ["Medication review", "💊"]],
      },
      {
        name: "Family Medicine", icon: "👨‍👩‍👧",
        conditions: [["Routine check-ups", "✅"], ["Whole-family illness", "👪"], ["Chronic-disease review", "📋"], ["Vaccination advice", "💉"]],
      },
    ],
  },
  {
    id: "mental",
    icon: "🧠",
    specialties: [
      {
        name: "Psychiatry", icon: "🧠", live: true, count: "76 doctors",
        conditions: [["Anxiety", "😟"], ["Depression", "💭"], ["Bipolar follow-up", "🔄"], ["OCD", "🔁"], ["PTSD", "🌀"], ["Panic attacks", "⚡"], ["Insomnia", "😴"], ["ADHD follow-up", "🎯"]],
      },
      {
        name: "Psychology / Counselling", icon: "💬",
        conditions: [["Stress", "😣"], ["Grief & loss", "🕊️"], ["Relationship issues", "💔"], ["Low self-esteem", "🪞"], ["Trauma support", "🤝"]],
      },
      {
        name: "Behavioral Health", icon: "🧩",
        conditions: [["Anger management", "🔥"], ["Adjustment difficulties", "🔀"], ["Substance-use concerns", "🚭"], ["Sleep-related anxiety", "🌙"]],
      },
    ],
  },
  // eye ear bone care
  {
    id: "skin",
    icon: "🧴",
    specialties: [
      {
        name: "Dermatology", icon: "🧴", live: true, count: "35 doctors",
        conditions: [["Acne", "🔴"], ["Eczema", "🌾"], ["Psoriasis", "🩹"], ["Skin rashes", "🌡️"], ["Hives", "🐝"], ["Rosacea", "🌹"], ["Fungal infections", "🍄"], ["Hair loss", "💈"], ["Nail problems", "💅"], ["Mole & skin checks", "🔎"]],
      },
    ],
  },
  {
    id: "women",
    icon: "🌸",
    specialties: [
      {
        name: "OB-GYN", icon: "🌸", count: "44 doctors",
        conditions: [["Irregular periods", "📅"], ["Painful periods", "😣"], ["PCOS", "🌺"], ["Contraception advice", "💊"], ["Vaginal infections", "🩺"], ["Pelvic pain", "⚡"], ["Prenatal teleconsult", "🤰"]],
      },
      { name: "Menopause Care", icon: "🌙", conditions: [["Hot flashes", "🔥"], ["Mood changes", "🎭"], ["Sleep disturbance", "😴"], ["HRT guidance", "💊"]] },
      { name: "Women's Mental Health", icon: "💗", conditions: [["Postnatal depression", "🍼"], ["Perinatal anxiety", "🤱"], ["PMDD", "📆"]] },
      { name: "Lactation Consulting", icon: "🤱", conditions: [["Low milk supply", "🍼"], ["Latch problems", "👶"], ["Nipple pain", "🩹"], ["Weaning guidance", "🥄"]] },
    ],
  },
  // Mens Health
  {
    id: "men",
    icon: "♂️",
    specialties: [
      { name: "Men's Health", icon: "♂️", count: "19 doctors", conditions: [["Erectile dysfunction", "💙"], ["Low testosterone", "📉"], ["Hair loss", "💈"], ["Prostate concerns", "🔬"], ["Low libido", "💤"]] },
      { name: "Urology", icon: "🚹", conditions: [["UTIs", "🚻"], ["Kidney stones follow-up", "🪨"], ["Blood in urine", "🩸"], ["Incontinence", "💧"], ["Bladder problems", "🚽"]] },
    ],
  },
  {
    id: "family",
    icon: "🧒",
    specialties: [
      {
        name: "Pediatrics", icon: "🧒", live: true, count: "41 doctors",
        conditions: [["Fever in children", "🌡️"], ["Cough & cold", "🤧"], ["Childhood rashes", "🌸"], ["Ear infections", "👂"], ["Feeding concerns", "🍼"], ["Growth & development", "📏"], ["Vaccination advice", "💉"]],
      },
      { name: "Adolescent Care", icon: "🧑", conditions: [["Teen acne", "🔴"], ["Puberty concerns", "🌱"], ["Teen mood & anxiety", "😟"], ["Menstrual problems", "📅"], ["Sports injuries", "🏃"]] },
    ],
  },
  // Mental Health
  {
    id: "weight",
    icon: "🥗",
    specialties: [
      { name: "Weight Management", icon: "⚖️", conditions: [["Obesity", "📊"], ["GLP-1 eligibility", "💉"], ["Metabolic syndrome", "🔬"], ["Weight-loss planning", "🎯"], ["Binge eating", "🍽️"]] },
      { name: "Nutrition & Dietetics", icon: "🥗", conditions: [["Diabetic diet", "🩸"], ["Cholesterol diet", "🫀"], ["Food-intolerance plan", "🚫"], ["Pregnancy nutrition", "🤰"], ["Sports nutrition", "🏋️"]] },
      { name: "Lifestyle Medicine", icon: "🌱", conditions: [["Healthy-habit coaching", "✅"], ["Diet & exercise plan", "🏃"], ["Sleep hygiene", "😴"], ["Stress reduction", "🧘"]] },
    ],
  },
  {
    id: "chronic",
    icon: "📋",
    specialties: [
      { name: "Cardiology", icon: "🫀", live: true, count: "48 doctors", conditions: [["High blood pressure", "💉"], ["Chest pain (non-emerg.)", "❤️"], ["Palpitations", "💓"], ["High cholesterol", "🩸"], ["Heart failure follow-up", "🫀"]] },
      { name: "Neurology", icon: "🧬", live: true, count: "32 doctors", conditions: [["Migraine & headaches", "🤕"], ["Seizures follow-up", "⚡"], ["Numbness & tingling", "🖐️"], ["Tremor", "🤲"], ["Dizziness", "💫"], ["Memory concerns", "🧠"]] },
      { name: "Endocrinology", icon: "⚕️", conditions: [["Thyroid disorders", "🦋"], ["Diabetes (Type 1 & 2)", "🩸"], ["PCOS", "🌺"], ["Hormone imbalance", "⚗️"], ["Osteoporosis", "🦴"]] },
      { name: "Gastroenterology", icon: "🍽️", conditions: [["Acid reflux / GERD", "🔥"], ["IBS", "🌀"], ["Constipation", "🚽"], ["Stomach pain", "😣"], ["Bloating", "🎈"]] },
      { name: "Pulmonology", icon: "🫁", conditions: [["Asthma", "💨"], ["COPD", "🫁"], ["Chronic cough", "😷"], ["Shortness of breath", "😮‍💨"], ["Sleep apnea screening", "😴"]] },
      { name: "Expert Medical Opinion", icon: "📑", conditions: [["Cancer second opinion", "🎗️"], ["Surgery second opinion", "🏥"], ["Complex-diagnosis review", "🔍"], ["Treatment-plan review", "📋"]] },
    ],
  },
  {
    id: "eeb",
    icon: "🦴",
    specialties: [
      { name: "Ophthalmology", icon: "👁️", live: true, count: "22 doctors", conditions: [["Red / irritated eyes", "👁️"], ["Dry eyes", "🌵"], ["Vision changes", "🔭"], ["Eye infections", "🦠"], ["Stye", "💢"]] },
      { name: "ENT", icon: "👂", conditions: [["Sinusitis", "👃"], ["Sore throat / tonsillitis", "😮"], ["Ear infections", "👂"], ["Vertigo", "💫"], ["Nasal congestion", "🤧"]] },
      { name: "Orthopedics", icon: "🦴", live: true, count: "29 doctors", conditions: [["Back pain", "🔙"], ["Neck pain", "🧍"], ["Knee & joint pain", "🦵"], ["Sprains & strains", "🤕"], ["Sports injuries", "🏃"]] },
    ],
  },
  // Sexual Health
  {
    id: "sexual",
    icon: "💗",
    specialties: [
      { name: "Sexual Health", icon: "💗", conditions: [["STI advice & testing", "🔬"], ["Contraception advice", "💊"], ["Erectile dysfunction", "💙"], ["Confidential care", "🤐"], ["Safe-sex counselling", "🤝"]] },
    ],
  },

  // Travel and Global care

  {
    id: "travel",
    icon: "✈️",
    specialties: [
      { name: "Travel Medicine", icon: "✈️", conditions: [["Pre-travel vaccination", "💉"], ["Malaria prevention", "🦟"], ["Altitude sickness", "⛰️"], ["Travel-illness advice", "🤒"], ["Post-travel symptoms", "🌡️"]] },
      { name: "Global / Cross-Border Care", icon: "🌍", conditions: [["Cross-border consult", "🌐"], ["Care continuity abroad", "🔄"], ["Referral coordination", "🗺️"], ["Travel medical assistance", "🆘"], ["Prescription continuity", "💊"]] },
    ],
  },
];

// Build flat helpers from the price-enriched tree. `label`, `cost`, and
// `currency` all originate from the API (attached in enrichedTree).
function buildFlatHelpers(tree) {
  const specialties = [];
  const conditions = [];
  tree.forEach((cat) =>
    cat.specialties.forEach((s) => {
      specialties.push({ ...s, catId: cat.id, catLabel: cat.label });
      s.conditions.forEach(([name, icon]) =>
        conditions.push({ name, icon, to: s.name, catId: cat.id, catLabel: cat.label, cost: s.cost, currency: s.currency }),
      );
    }),
  );
  return { specialties, conditions };
}

// ─── Time slots ───────────────────────────────────────────────────────────────
const ALL_TIME_SLOTS = [
  "8:00 AM",
  "8:30 AM",
  "9:00 AM",
  "9:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
  "2:30 PM",
  "3:00 PM",
  "3:30 PM",
  "4:00 PM",
  "4:30 PM",
  "5:00 PM",
  "5:30 PM",
  "6:00 PM",
  "6:30 PM",
  "7:00 PM",
  "7:30 PM",
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
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────
function Breadcrumb({ items, onNavigate }) {
  return (
    <div className="hcc-breadcrumb">
      {items.map((item, i) => (
        <span key={i} className="hcc-bc-item">
          {i > 0 && <span className="hcc-bc-sep">›</span>}
          {i < items.length - 1 ? (
            <button className="hcc-bc-link" onClick={() => onNavigate(i)}>
              {item}
            </button>
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
  const location = useLocation();
  const categoryPrices = usePrices();
  const pricingMeta = usePricingMeta();
  const [drillLevel, setDrillLevel] = useState("cat");
  const [activeCat, setActiveCat] = useState(null);
  const [activeSpec, setActiveSpec] = useState(null);
  const [browseTab, setBrowseTab] = useState(null);
  const [query, setQuery] = useState("");

  // Attach the API-owned fields — label, price, currency — onto the tree.
  // These are the single source of truth; the tree itself no longer carries them.
  const enrichedTree = useMemo(() => {
    if (!categoryPrices) return HCC_TREE;
    return HCC_TREE.map((cat) => {
      const api = categoryPrices[cat.id];
      const currency = api?.currency ?? "INR";
      return {
        ...cat,
        label: api?.label,     // category name — from API
        currency,              // currency — from API
        specialties: cat.specialties.map((specialty) => ({
          ...specialty,
          cost: api?.price,    // price — from API
          currency,
        })),
      };
    });
  }, [categoryPrices]);

  const { specialties: flatSpecialties, conditions: flatConditions } = useMemo(
    () => buildFlatHelpers(enrichedTree),
    [enrichedTree],
  );

  const tabs = [
    { id: "cat", num: "01", label: "Categories" },
    { id: "spec", num: "02", label: "Specialties" },
    { id: "cond", num: "03", label: "Conditions" },
  ];

  const activeTabId = browseTab ?? drillLevel;

  const q = query.trim().toLowerCase();

  const visibleFlatSpecialties = useMemo(
    () => flatSpecialties.filter((s) => !q || s.name.toLowerCase().includes(q)),
    [q, flatSpecialties],
  );
  const visibleFlatConditions = useMemo(
    () => flatConditions.filter((c) => !q || c.name.toLowerCase().includes(q) || c.to.toLowerCase().includes(q)),
    [q, flatConditions],
  );
  const visibleCats = useMemo(
    () => enrichedTree.filter((c) => !q || c.label?.toLowerCase().includes(q) || c.specialties.some((s) => s.name.toLowerCase().includes(q))),
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

  const handleOpenSpec = (specialty) => {
    setBrowseTab(null);
    setActiveSpec(specialty);
    setDrillLevel("cond");
    setQuery("");
  };

  const handleSelectCond = (condName, condIcon, specialty) => {
    navigate("/appointment-booking/form", {
      state: {
        selection: {
          specName: specialty.name,
          specIco: specialty.icon,               // payload key kept for the booking form contract
          live: specialty.live,
          catLabel: specialty.catLabel,
          cost: specialty.cost,
          currency: specialty.currency ?? "INR", // dynamic currency → booking form
          condName,
          condIco: condIcon,                     // payload key kept for the booking form contract
        },
      },
    });
  };

  const handleFlatCondClick = (condition) => {
    const specialty = flatSpecialties.find((s) => s.name === condition.to && s.catId === condition.catId);
    if (specialty) handleSelectCond(condition.name, condition.icon, specialty);
  };

  const handleFlatSpecClick = (specialty) => {
    const cat = enrichedTree.find((c) => c.id === specialty.catId);
    setBrowseTab(null);
    setActiveCat(cat);
    setActiveSpec(specialty);
    setDrillLevel("cond");
    setQuery("");
  };

  const handleBreadcrumb = (idx) => {
    if (idx === 0) {
      setDrillLevel("cat");
      setActiveCat(null);
      setActiveSpec(null);
    }
    if (idx === 1) {
      setDrillLevel("spec");
      setActiveSpec(null);
    }
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
    activeTabId === "cat"
      ? "Search categories…"
      : activeTabId === "spec"
        ? "Search specialties…"
        : "Search conditions / symptoms…";

  const drillConditions = activeSpec ? activeSpec.conditions : [];

  const activeCatIndex = activeCat
    ? enrichedTree.findIndex((c) => c.id === activeCat.id)
    : -1;
  const catNumLabel =
    activeCatIndex >= 0 ? String(activeCatIndex + 1).padStart(2, "0") : null;

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
            Book an online doctor appointment in minutes and access secure
            virtual healthcare services without long wait times or unnecessary
            clinic visits.
          </p>
        </div>

        <div className="top-controls">
          {/* ── NUMBERED TAB BAR ── */}
          <div className="tab-bar-wrap">
            <div className="switch">
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
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
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
        {/* ── CONTENT CARD (white rounded container) ── */}
        <div className="content-card">

          {/* ── DRILL MODE ── */}
          {!browseTab && (
            <>
              {drillLevel !== "cat" && (
                <div style={{ padding: "28px 40px 0" }}>
                  <Breadcrumb
                    items={breadcrumbItems}
                    onNavigate={handleBreadcrumb}
                  />
                </div>
              )}

              {/* ── Category grid ── */}
              {drillLevel === "cat" && (
                <div className="panel">
                  <div className="catgrid">
                    {visibleCats.length ? (
                      visibleCats.map((c) => {
                        const specialtyCount = c.specialties.length;
                        const conditionCount = c.specialties.reduce((n, s) => n + s.conditions.length, 0);
                        const sample = c.specialties.slice(0, 3).map((s) => s.name).join(", ") + (c.specialties.length > 3 ? "…" : "");
                        return (
                          <div
                            key={c.id}
                            className="catcard"
                            onClick={(e) =>
                              handleCardClick(e, () => handleOpenCat(c))
                            }
                          >
                            <div className="ic">{c.icon}</div>
                            <h3>{c.label}</h3>
                            <div className="meta">{specialtyCount} specialties · {conditionCount} conditions</div>
                            <div className="samp">{sample}</div>
                            <div className="go">Explore →</div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="empty">
                        <div className="big">🔍</div>No categories match.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Specialty list ── */}
              {drillLevel === "spec" && activeCat && (
                <div className="panel">
                  <div className="hcc-level-label">
                    {catNumLabel && <>{catNumLabel} —</>}
                    <span style={{ fontSize: 20 }}>{activeCat.icon}</span>
                    {activeCat.label}
                  </div>
                  <div className="grid">
                    {activeCat.specialties
                      .filter((s) => !q || s.name.toLowerCase().includes(q))
                      .map((s) => {
                        const specialtyWithCat = { ...s, catId: activeCat.id, catLabel: activeCat.label };
                        return (
                          <div
                            key={s.name}
                            className="spec"
                            onClick={(e) => handleCardClick(e, () => handleOpenSpec(specialtyWithCat))}
                          >
                            {s.live && <span className="live">LIVE</span>}
                            <div className="ic">{s.icon}</div>
                            <h3>{s.name}</h3>
                            <div className="count">{s.count || "Book now"}</div>
                            <div className="catref">{activeCat.label}</div>
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
                    <span style={{ fontSize: 20 }}>{activeSpec.icon}</span>
                    {activeSpec.name} — select your condition
                  </div>
                  {!activeSpec.priceAvailable && (
                    <div className="hcc-price-alert">
                      {activeSpec.priceMessage}
                    </div>
                  )}
                  <div className="condgrid">
                    {drillConditions
                      .filter(([name]) => !q || name.toLowerCase().includes(q))
                      .map(([name, icon]) => (
                        <div
                          key={name}
                          className="condcard"
                          onClick={(e) => handleCardClick(e, () => handleSelectCond(name, icon, activeSpec))}
                        >
                          <div className="condcard-ico">{icon}</div>
                          <div className="condcard-name">{name}</div>
                          <div className="condcard-go">Book →</div>
                        </div>
                      ))}
                    <div
                      className={`condcard condcard-other${!activeSpec.priceAvailable ? " condcard--disabled" : ""}`}
                      onClick={(e) =>
                        handleCardClick(e, () =>
                          handleSelectCond(
                            "General Consultation",
                            "🩺",
                            activeSpec,
                          ),
                        )
                      }
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
                {visibleFlatSpecialties.length ? (
                  visibleFlatSpecialties.map((s) => (
                    <div
                      key={s.name + s.catId}
                      className="spec"
                      onClick={(e) => handleCardClick(e, () => handleFlatSpecClick(s))}
                    >
                      {s.live && <span className="live">LIVE</span>}
                      <div className="ic">{s.icon}</div>
                      <h3>{s.name}</h3>
                      <div className="count">{s.count || "Book now"}</div>
                      <div className="catref">{s.catLabel}</div>
                    </div>
                  ))
                ) : (
                  <div className="empty">
                    <div className="big">🔍</div>No specialties found.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── FLAT BROWSE: Conditions ── (unchanged) ── */}
          {browseTab === "cond" && (
            <div className="panel">
              <div className="condgrid">
                {visibleFlatConditions.length ? (
                  visibleFlatConditions.map((c, i) => (
                    <div
                      key={i}
                      className={`condcard${!c.priceAvailable ? " condcard--disabled" : ""}`}
                      onClick={(e) =>
                        handleCardClick(e, () => handleFlatCondClick(c))
                      }
                    >
                      <div className="condcard-ico">{c.icon}</div>
                      <div className="condcard-name">{c.name}</div>
                      <div className="condcard-spec">{c.to}</div>
                      <div className="condcard-go">Book →</div>
                    </div>
                  ))
                ) : (
                  <div className="empty">
                    <div className="big">🔍</div>No conditions match.
                  </div>
                )}
              </div>
            </div>
          )}

        </div>{/* /content-card */}

      </div>
    </section>
  );
}
