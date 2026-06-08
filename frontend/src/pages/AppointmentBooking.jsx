import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./AppointmentBooking.css";

// ─── Data ────────────────────────────────────────────────────────────────────
const HCC_TREE = [
  {
    id: "general",
    label: "General & Everyday Care",
    e: "🩺",
    specs: [
      {
        name: "General Physician",
        ico: "🩺",
        live: true,
        count: "98 doctors",
        cost: 499,
        conds: [
          ["Fever", "🌡️"],
          ["Cold & flu", "🤧"],
          ["Cough & sore throat", "😷"],
          ["Headache", "🤕"],
          ["Sinus infection", "👃"],
          ["Body aches", "💪"],
          ["Fatigue", "😮‍💨"],
          ["Minor infections", "🩹"],
        ],
      },
      {
        name: "Internal Medicine",
        ico: "🏥",
        cost: 799,
        conds: [
          ["Undiagnosed symptoms", "❓"],
          ["Multi-system complaints", "🩺"],
          ["Preventive screening", "🛡️"],
          ["Medication review", "💊"],
        ],
      },
      {
        name: "Family Medicine",
        ico: "👨‍👩‍👧",
        cost: 599,
        conds: [
          ["Routine check-ups", "✅"],
          ["Whole-family illness", "👪"],
          ["Chronic-disease review", "📋"],
          ["Vaccination advice", "💉"],
        ],
      },
    ],
  },
  {
    id: "mental",
    label: "Mental Health",
    e: "🧠",
    specs: [
      {
        name: "Psychiatry",
        ico: "🧠",
        live: true,
        count: "76 doctors",
        cost: 1499,
        conds: [
          ["Anxiety", "😟"],
          ["Depression", "💭"],
          ["Bipolar follow-up", "🔄"],
          ["OCD", "🔁"],
          ["PTSD", "🌀"],
          ["Panic attacks", "⚡"],
          ["Insomnia", "😴"],
          ["ADHD follow-up", "🎯"],
        ],
      },
      {
        name: "Psychology / Counselling",
        ico: "💬",
        cost: 1299,
        conds: [
          ["Stress", "😣"],
          ["Grief & loss", "🕊️"],
          ["Relationship issues", "💔"],
          ["Low self-esteem", "🪞"],
          ["Trauma support", "🤝"],
        ],
      },
      {
        name: "Behavioral Health",
        ico: "🧩",
        cost: 999,
        conds: [
          ["Anger management", "🔥"],
          ["Adjustment difficulties", "🔀"],
          ["Substance-use concerns", "🚭"],
          ["Sleep-related anxiety", "🌙"],
        ],
      },
    ],
  },
  {
    id: "skin",
    label: "Skin & Hair",
    e: "🧴",
    specs: [
      {
        name: "Dermatology",
        ico: "🧴",
        live: true,
        count: "35 doctors",
        cost: 899,
        conds: [
          ["Acne", "🔴"],
          ["Eczema", "🌾"],
          ["Psoriasis", "🩹"],
          ["Skin rashes", "🌡️"],
          ["Hives", "🐝"],
          ["Rosacea", "🌹"],
          ["Fungal infections", "🍄"],
          ["Hair loss", "💈"],
          ["Nail problems", "💅"],
          ["Mole & skin checks", "🔎"],
        ],
      },
    ],
  },
  {
    id: "women",
    label: "Women's Health",
    e: "🌸",
    specs: [
      {
        name: "OB-GYN",
        ico: "🌸",
        count: "44 doctors",
        cost: 1199,
        conds: [
          ["Irregular periods", "📅"],
          ["Painful periods", "😣"],
          ["PCOS", "🌺"],
          ["Contraception advice", "💊"],
          ["Vaginal infections", "🩺"],
          ["Pelvic pain", "⚡"],
          ["Prenatal teleconsult", "🤰"],
        ],
      },
      {
        name: "Menopause Care",
        ico: "🌙",
        cost: 999,
        conds: [
          ["Hot flashes", "🔥"],
          ["Mood changes", "🎭"],
          ["Sleep disturbance", "😴"],
          ["HRT guidance", "💊"],
        ],
      },
      {
        name: "Women's Mental Health",
        ico: "💗",
        cost: 1099,
        conds: [
          ["Postnatal depression", "🍼"],
          ["Perinatal anxiety", "🤱"],
          ["PMDD", "📆"],
        ],
      },
      {
        name: "Lactation Consulting",
        ico: "🤱",
        cost: 699,
        conds: [
          ["Low milk supply", "🍼"],
          ["Latch problems", "👶"],
          ["Nipple pain", "🩹"],
          ["Weaning guidance", "🥄"],
        ],
      },
    ],
  },
  {
    id: "men",
    label: "Men's Health",
    e: "♂️",
    specs: [
      {
        name: "Men's Health",
        ico: "♂️",
        count: "19 doctors",
        cost: 799,
        conds: [
          ["Erectile dysfunction", "💙"],
          ["Low testosterone", "📉"],
          ["Hair loss", "💈"],
          ["Prostate concerns", "🔬"],
          ["Low libido", "💤"],
        ],
      },
      {
        name: "Urology",
        ico: "🚹",
        cost: 1099,
        conds: [
          ["UTIs", "🚻"],
          ["Kidney stones follow-up", "🪨"],
          ["Blood in urine", "🩸"],
          ["Incontinence", "💧"],
          ["Bladder problems", "🚽"],
        ],
      },
    ],
  },
  {
    id: "family",
    label: "Children & Family",
    e: "🧒",
    specs: [
      {
        name: "Pediatrics",
        ico: "🧒",
        live: true,
        count: "41 doctors",
        cost: 699,
        conds: [
          ["Fever in children", "🌡️"],
          ["Cough & cold", "🤧"],
          ["Childhood rashes", "🌸"],
          ["Ear infections", "👂"],
          ["Feeding concerns", "🍼"],
          ["Growth & development", "📏"],
          ["Vaccination advice", "💉"],
        ],
      },
      {
        name: "Adolescent Care",
        ico: "🧑",
        cost: 699,
        conds: [
          ["Teen acne", "🔴"],
          ["Puberty concerns", "🌱"],
          ["Teen mood & anxiety", "😟"],
          ["Menstrual problems", "📅"],
          ["Sports injuries", "🏃"],
        ],
      },
    ],
  },
  {
    id: "weight",
    label: "Weight & Nutrition",
    e: "🥗",
    specs: [
      {
        name: "Weight Management",
        ico: "⚖️",
        cost: 999,
        conds: [
          ["Obesity", "📊"],
          ["GLP-1 eligibility", "💉"],
          ["Metabolic syndrome", "🔬"],
          ["Weight-loss planning", "🎯"],
          ["Binge eating", "🍽️"],
        ],
      },
      {
        name: "Nutrition & Dietetics",
        ico: "🥗",
        cost: 699,
        conds: [
          ["Diabetic diet", "🩸"],
          ["Cholesterol diet", "🫀"],
          ["Food-intolerance plan", "🚫"],
          ["Pregnancy nutrition", "🤰"],
          ["Sports nutrition", "🏋️"],
        ],
      },
      {
        name: "Lifestyle Medicine",
        ico: "🌱",
        cost: 599,
        conds: [
          ["Healthy-habit coaching", "✅"],
          ["Diet & exercise plan", "🏃"],
          ["Sleep hygiene", "😴"],
          ["Stress reduction", "🧘"],
        ],
      },
    ],
  },
  {
    id: "chronic",
    label: "Chronic Care & Expert Opinion",
    e: "📋",
    specs: [
      {
        name: "Cardiology",
        ico: "🫀",
        live: true,
        count: "48 doctors",
        cost: 1799,
        conds: [
          ["High blood pressure", "💉"],
          ["Chest pain (non-emerg.)", "❤️"],
          ["Palpitations", "💓"],
          ["High cholesterol", "🩸"],
          ["Heart failure follow-up", "🫀"],
        ],
      },
      {
        name: "Neurology",
        ico: "🧬",
        live: true,
        count: "32 doctors",
        cost: 1699,
        conds: [
          ["Migraine & headaches", "🤕"],
          ["Seizures follow-up", "⚡"],
          ["Numbness & tingling", "🖐️"],
          ["Tremor", "🤲"],
          ["Dizziness", "💫"],
          ["Memory concerns", "🧠"],
        ],
      },
      {
        name: "Endocrinology",
        ico: "⚕️",
        cost: 1499,
        conds: [
          ["Thyroid disorders", "🦋"],
          ["Diabetes (Type 1 & 2)", "🩸"],
          ["PCOS", "🌺"],
          ["Hormone imbalance", "⚗️"],
          ["Osteoporosis", "🦴"],
        ],
      },
      {
        name: "Gastroenterology",
        ico: "🍽️",
        cost: 1399,
        conds: [
          ["Acid reflux / GERD", "🔥"],
          ["IBS", "🌀"],
          ["Constipation", "🚽"],
          ["Stomach pain", "😣"],
          ["Bloating", "🎈"],
        ],
      },
      {
        name: "Pulmonology",
        ico: "🫁",
        cost: 1299,
        conds: [
          ["Asthma", "💨"],
          ["COPD", "🫁"],
          ["Chronic cough", "😷"],
          ["Shortness of breath", "😮‍💨"],
          ["Sleep apnea screening", "😴"],
        ],
      },
      {
        name: "Expert Medical Opinion",
        ico: "📑",
        cost: 2499,
        conds: [
          ["Cancer second opinion", "🎗️"],
          ["Surgery second opinion", "🏥"],
          ["Complex-diagnosis review", "🔍"],
          ["Treatment-plan review", "📋"],
        ],
      },
    ],
  },
  {
    id: "eeb",
    label: "Eye, Ear & Bone",
    e: "🦴",
    specs: [
      {
        name: "Ophthalmology",
        ico: "👁️",
        live: true,
        count: "22 doctors",
        cost: 999,
        conds: [
          ["Red / irritated eyes", "👁️"],
          ["Dry eyes", "🌵"],
          ["Vision changes", "🔭"],
          ["Eye infections", "🦠"],
          ["Stye", "💢"],
        ],
      },
      {
        name: "ENT",
        ico: "👂",
        cost: 899,
        conds: [
          ["Sinusitis", "👃"],
          ["Sore throat / tonsillitis", "😮"],
          ["Ear infections", "👂"],
          ["Vertigo", "💫"],
          ["Nasal congestion", "🤧"],
        ],
      },
      {
        name: "Orthopedics",
        ico: "🦴",
        live: true,
        count: "29 doctors",
        cost: 1299,
        conds: [
          ["Back pain", "🔙"],
          ["Neck pain", "🧍"],
          ["Knee & joint pain", "🦵"],
          ["Sprains & strains", "🤕"],
          ["Sports injuries", "🏃"],
        ],
      },
    ],
  },
  {
    id: "sexual",
    label: "Sexual Health",
    e: "💗",
    specs: [
      {
        name: "Sexual Health",
        ico: "💗",
        cost: 799,
        conds: [
          ["STI advice & testing", "🔬"],
          ["Contraception advice", "💊"],
          ["Erectile dysfunction", "💙"],
          ["Confidential care", "🤐"],
          ["Safe-sex counselling", "🤝"],
        ],
      },
    ],
  },
  {
    id: "travel",
    label: "Travel & Global Care",
    e: "✈️",
    specs: [
      {
        name: "Travel Medicine",
        ico: "✈️",
        cost: 899,
        conds: [
          ["Pre-travel vaccination", "💉"],
          ["Malaria prevention", "🦟"],
          ["Altitude sickness", "⛰️"],
          ["Travel-illness advice", "🤒"],
          ["Post-travel symptoms", "🌡️"],
        ],
      },
      {
        name: "Global / Cross-Border Care",
        ico: "🌍",
        cost: 1999,
        conds: [
          ["Cross-border consult", "🌐"],
          ["Care continuity abroad", "🔄"],
          ["Referral coordination", "🗺️"],
          ["Travel medical assistance", "🆘"],
          ["Prescription continuity", "💊"],
        ],
      },
    ],
  },
];

// Flatten helpers
const HCC_SPECS = [];
const HCC_CONDS = [];
HCC_TREE.forEach((cat) =>
  cat.specs.forEach((s) => {
    HCC_SPECS.push({ ...s, catId: cat.id, catLabel: cat.label });
    s.conds.forEach(([cn, ci]) =>
      HCC_CONDS.push({
        name: cn,
        ico: ci,
        to: s.name,
        catId: cat.id,
        catLabel: cat.label,
        cost: s.cost, // ← add this
      }),
    );
  }),
);

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
  const [drillLevel, setDrillLevel] = useState("cat");
  const [activeCat, setActiveCat] = useState(null);
  const [activeSpec, setActiveSpec] = useState(null);
  const [browseTab, setBrowseTab] = useState(null);
  const [query, setQuery] = useState("");

  const switchRef = useRef(null);
  const gliderRef = useRef(null);

  const tabs = [
    { id: "cat", label: "Categories", icon: "🗂️" },
    { id: "spec", label: "Specialties", icon: "🩺" },
    { id: "cond", label: "Conditions", icon: "🔍" },
  ];

  const activeTabId = browseTab ?? drillLevel;

  const moveGlider = () => {
    if (!switchRef.current || !gliderRef.current) return;
    const active = switchRef.current.querySelector("button.active");
    if (!active) return;
    gliderRef.current.style.width = active.offsetWidth + "px";
    gliderRef.current.style.transform = `translateX(${active.offsetLeft - 5}px)`;
  };

  useEffect(() => {
    moveGlider();
  }, [activeTabId]);
  useEffect(() => {
    window.addEventListener("resize", moveGlider);
    return () => window.removeEventListener("resize", moveGlider);
  }, []);

  const q = query.trim().toLowerCase();

  const visibleFlatSpecs = useMemo(
    () => HCC_SPECS.filter((s) => !q || s.name.toLowerCase().includes(q)),
    [q],
  );
  const visibleFlatConds = useMemo(
    () =>
      HCC_CONDS.filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.to.toLowerCase().includes(q),
      ),
    [q],
  );
  const visibleCats = useMemo(
    () =>
      HCC_TREE.filter(
        (c) =>
          !q ||
          c.label.toLowerCase().includes(q) ||
          c.specs.some((s) => s.name.toLowerCase().includes(q)),
      ),
    [q],
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
    const spec = HCC_SPECS.find(
      (s) => s.name === cond.to && s.catId === cond.catId,
    );
    if (spec) handleSelectCond(cond.name, cond.ico, spec);
  };

  const handleFlatSpecClick = (spec) => {
    const cat = HCC_TREE.find((c) => c.id === spec.catId);
    setBrowseTab(null);
    setActiveCat(cat);
    setActiveSpec(spec);
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

  const breadcrumbItems = ["All Categories"];
  if (activeCat) breadcrumbItems.push(activeCat.label);
  if (activeSpec) breadcrumbItems.push(activeSpec.name);

  const viewAllLabel =
    activeTabId === "cat"
      ? "View all categories →"
      : activeTabId === "spec"
        ? "View all specialties →"
        : "View all conditions →";

  const searchPlaceholder =
    activeTabId === "cat"
      ? "Search categories…"
      : activeTabId === "spec"
        ? "Search specialties…"
        : "Search conditions / symptoms…";

  const drillConds = activeSpec ? activeSpec.conds : [];

  return (
    <section className="hcc-sx">
      <div className="wrap">
        {/* Header */}
        <div className="head">
          <div>
            <span className="eyebrow">Discover Care</span>
            <h2>Care for every part of you.</h2>
            <p className="lead">
              Browse by category, by specialty, or by how you're feeling — we'll
              route you to the right doctor.
            </p>
          </div>
          <div className="switch" ref={switchRef}>
            <span className="glider" ref={gliderRef} />
            {tabs.map((t) => (
              <button
                key={t.id}
                data-tab={t.id}
                className={activeTabId === t.id ? "active" : ""}
                onClick={() => handleTabSwitch(t.id)}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Toolbar */}
        <div className="toolbar">
          <div className="search">
            <svg
              width="18"
              height="18"
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

        {/* ── DRILL MODE ── */}
        {!browseTab && (
          <>
            {drillLevel !== "cat" && (
              <Breadcrumb
                items={breadcrumbItems}
                onNavigate={handleBreadcrumb}
              />
            )}

            {drillLevel === "cat" && (
              <div className="panel on">
                <div className="catgrid">
                  {visibleCats.length ? (
                    visibleCats.map((c) => {
                      const sc = c.specs.length;
                      const cc = c.specs.reduce(
                        (n, s) => n + s.conds.length,
                        0,
                      );
                      const samp =
                        c.specs
                          .slice(0, 3)
                          .map((s) => s.name)
                          .join(", ") + (c.specs.length > 3 ? "…" : "");
                      return (
                        <div
                          key={c.id}
                          className="catcard"
                          onClick={() => handleOpenCat(c)}
                        >
                          <div className="ic">{c.e}</div>
                          <h3>{c.label}</h3>
                          <div className="meta">
                            {sc} specialties · {cc} conditions
                          </div>
                          <div className="samp">{samp}</div>
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

            {drillLevel === "spec" && activeCat && (
              <div className="panel on">
                <div className="hcc-level-label">
                  <span>{activeCat.e}</span> {activeCat.label} — choose a
                  specialty
                </div>
                <div className="grid">
                  {activeCat.specs
                    .filter((s) => !q || s.name.toLowerCase().includes(q))
                    .map((s) => {
                      const specWithCat = {
                        ...s,
                        catId: activeCat.id,
                        catLabel: activeCat.label,
                        cost: s.cost, // ← explicit, prevents any accidental override
                      };
                      return (
                        <div
                          key={s.name}
                          className="spec"
                          onClick={() => handleOpenSpec(specWithCat)}
                        >
                          {s.live && <span className="live">LIVE</span>}
                          <div className="ic">{s.ico}</div>
                          <h3>{s.name}</h3>
                          <div className="count">{s.count || "Book now"}</div>
                          <div className="catref">{activeCat.label}</div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {drillLevel === "cond" && activeSpec && (
              <div className="panel on">
                <div className="hcc-level-label">
                  <span>{activeSpec.ico}</span> {activeSpec.name} — select your
                  condition
                </div>
                <div className="condgrid">
                  {drillConds
                    .filter(([name]) => !q || name.toLowerCase().includes(q))
                    .map(([name, ico]) => (
                      <div
                        key={name}
                        className="condcard"
                        onClick={() => handleSelectCond(name, ico, activeSpec)}
                      >
                        <div className="condcard-ico">{ico}</div>
                        <div className="condcard-name">{name}</div>
                        <div className="condcard-go">Book →</div>
                      </div>
                    ))}
                  <div
                    className="condcard condcard-other"
                    onClick={() =>
                      handleSelectCond("General Consultation", "🩺", activeSpec)
                    }
                  >
                    <div className="condcard-ico">💬</div>
                    <div className="condcard-name">Other / not listed</div>
                    <div className="condcard-go">Book →</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── FLAT BROWSE: Specialties ── */}
        {browseTab === "spec" && (
          <div className="panel on">
            <div className="grid">
              {visibleFlatSpecs.length ? (
                visibleFlatSpecs.map((s) => (
                  <div
                    key={s.name + s.catId}
                    className="spec"
                    onClick={() => handleFlatSpecClick(s)}
                  >
                    {s.live && <span className="live">LIVE</span>}
                    <div className="ic">{s.ico}</div>
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

        {/* ── FLAT BROWSE: Conditions ── */}
        {browseTab === "cond" && (
          <div className="panel on">
            <div className="condgrid">
              {visibleFlatConds.length ? (
                visibleFlatConds.map((c, i) => (
                  <div
                    key={i}
                    className="condcard"
                    onClick={() => handleFlatCondClick(c)}
                  >
                    <div className="condcard-ico">{c.ico}</div>
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

        <div className="foot">
          <button className="viewall">{viewAllLabel}</button>
        </div>
      </div>

    </section>
  );
}
