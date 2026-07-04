import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./AppointmentBooking.css";
import { usePrices } from "../context/PricingContext";

// ─── Data ────────────────────────────────────────────────────────────────────
const HCC_TREE = [
  // Child and Family care
  {
    id: "family",
    label: "Children & Family Care",
    e: "🧒",
    desc: "Expert medical guidance, pediatric support, preventive care and treatment for everyday health concerns, when you need it. Compassionate online healthcare for children & families.",
    specs: [
      {
        name: "Pediatrics",
        ico: "🧒",
        live: true,
        count: "41 doctors",
        cost: 699,
        desc: "Kids’ Care Comprehensive care for infants, children and teens, from routine wellness exams and vaccinations to illness treatment, developmental support and preventive care that promotes healthy growth.",
        conds: [
          ["Pediatric Fever", "🌡️"],
          ["Pediatric Cold & Flu", "🤧"],
          ["Skin Rash in Children", "🌸"],
          ["Ear Pain in Children", "👂"],
          ["Feeding concerns", "🍼"],
        ],
      },
      {
        name: "Adolescent Care",
        ico: "🧑",
        cost: 699,
        desc: "Adolescent Medicine Comprehensive health care for teenagers and young adults with support for puberty, mental health, growth, nutrition, sports injuries and overall adolescent wellness",
        conds: [
          ["Mood & Anxiety in Teens", "🔴"],
          ["Puberty Concerns", "😟"],
          ["Sports injuries", "🏃"],
        ],
      },
    ],
  },
  // Chronic Care & Epert Opinions
  {
    id: "chronic",
    label: "Chronic Care & Expert Opinions",
    e: "📋",
    desc: "Ongoing support for chronic health conditions with personalized treatment guidance, regular follow-ups, and expert medical opinions to help you make informed healthcare decisions.",
    specs: [
      {
        name: "Cardiology",
        ico: "🫀",
        live: true,
        count: "48 doctors",
        cost: 1799,
        desc: "Expert heart and cardiovascular care for high blood pressure, cholesterol management, heart disease, palpitations, preventive screenings, and long-term heart health support.",
        conds: [
          ["High blood pressure", "💉"],
          ["Chest Pain (Non-Emergency)", "❤️"],
          ["Palpitations", "💓"],
          ["High cholesterol", "🩸"],
          ["Heart Disease Follow-Up", "🫀"],
          ["Pre-Op Cardiac Clearance", "🫀"],
        ],
      },
      {
        name: "Neurology",
        ico: "🧬",
        live: true,
        count: "32 doctors",
        cost: 1699,
        desc: "Specialized care for migraines, dizziness, memory concerns, seizures, tremors, nerve disorders, and neurological conditions affecting brain and nerve health.",
        conds: [
          ["Migraine", "🤕"],
          ["Seizures / Epilepsy Follow-Up", "⚡"],
          ["Numbness & tingling", "🖐️"],
          ["Tremor", "🤲"],
          ["Dizziness", "💫"],
          ["Memory concerns", "🧠"],
          ["Chronic Migraine", "🤕"],
        ],
      },
      {
        name: "Endocrinology",
        ico: "⚕️",
        cost: 1499,
        desc: "Specialized care for hormone imbalances, diabetes, thyroid disorders, metabolic conditions, bone health concerns, and long-term endocrine wellness through personalized treatment plans.",
        conds: [
          ["Thyroid disorders", "🦋"],
          ["Type 2 Diabetes", "🩸"],
          ["Hormone imbalance", "⚗️"],
          ["Osteoporosis", "🦴"],
        ],
      },
      {
        name: "Gastroenterology",
        ico: "🍽️",
        cost: 1399,
        desc: "Expert digestive health care for acid reflux, abdominal pain, bloating, IBS, liver conditions, bowel concerns, and long-term gastrointestinal wellness.",
        conds: [
          ["Acid Reflux / GERD", "🔥"],
          ["Irritable Bowel Syndrome (IBS)", "🌀"],
          ["Constipation", "🚽"],
          ["Fatty Liver Follow-Up", "😣"],
          ["Bloating", "🎈"],
        ],
      },
      {
        name: "Pulmonology",
        ico: "🫁",
        cost: 1299,
        desc: "Expert respiratory care for asthma, COPD, chronic cough, sleep apnea, breathing difficulties, lung conditions, and long-term respiratory health management.",
        conds: [
          ["Asthma", "💨"],
          ["Chronic lung disease affecting breathing(COPD)", "🫁"],
          ["Persistent Cough", "😷"],
          ["Shortness of Breath", "😮‍💨"],
          ["Sleep Apnea", "😴"],
          ["Post-COVID Concerns", "😷"],
        ],
      },
      {
        name: "Expert Medical Opinion",
        ico: "📑",
        cost: 2499,
        desc: "Authoritative second opinions on cancer, surgery, complex diagnoses, and treatment plans.",
        conds: [
          ["Cancer second opinion", "🎗️"],
          ["Surgery second opinion", "🏥"],
          ["Complex-diagnosis review", "🔍"],
          ["Treatment-plan review", "📋"],
        ],
      },
    ],
  },
  // eye ear bone care
  {
    id: "eeb",
    label: "Eye, Ear & Bone Care",
    e: "🦴",
    desc: "Comprehensive care for vision concerns, hearing issues, ear conditions, joint pain, bone health, and musculoskeletal problems with expert medical guidance and support.",
    specs: [
      {
        name: "Ophthalmology",
        ico: "👀",
        live: true,
        count: "22 doctors",
        cost: 999,
        desc: "Expert eye care for dry eyes, vision changes, eye infections, redness, eye strain, and long-term vision health with personalized treatment and support.",
        conds: [
          ["Eye Irritation", "👁️"],
          ["Dry eyes", "🌵"],
          ["Vision Changes", "🔭"],
          ["Eye Strain", "🦠"],
          ["Stye", "💢"],
          ["Eye Redness", "👁️"],
        ],
      },
      {
        name: "ENT (Ear, Nose & Throat)",
        ico: "👂",
        cost: 899,
        desc: "Specialized care for ear infections, sinus problems, sore throats, hearing concerns, vertigo, voice disorders, and conditions affecting the ear, nose, and throat.",
        conds: [
          ["Nasal Congestion", "👃"],
          ["Sore Throat", "😮"],
          ["Ear Infection", "👂"],
          ["Vertigo", "💫"],
          ["Nasal congestion", "🤧"],
          ["Ear Pain", "👂"],
          ["Hoarseness", "😷"],
          ["Tonsillitis", "😮‍💨"],
        ],
      },
      {
        name: "Orthopedics",
        ico: "🦴",
        live: true,
        count: "29 doctors",
        cost: 1299,
        desc: "Specialized care for joint pain, arthritis, back and neck pain, sports injuries, muscle strains, and musculoskeletal conditions to improve mobility and quality of life.",
        conds: [
          ["Back pain", "🔙"],
          ["Neck pain", "🧍"],
          ["Knee Pain", "🦵"],
          ["Muscle Strain", "🤕"],
          ["Arthritis", "🏃"],
        ],
      },
    ],
  },
  // General & Everyday care
  {
    id: "general",
    label: "General & Everyday Care",
    e: "🩺",
    desc: "Convenient access to healthcare professionals for common illnesses, preventive care, routine health concerns, follow-up support, and personalized medical guidance whenever you need it.",

    specs: [
      {
        name: "General Physician (GP)",
        ico: "🩺",
        live: true,
        count: "98 doctors",
        cost: 100,
        desc: "Trusted primary healthcare for common illnesses, preventive care, chronic condition management, routine checkups, and everyday medical concerns for adults and families.",
        conds: [
          ["Sinus Infection", "👃"],
          ["Cold & Flu", "😷"],
          ["Pink Eye", "👁️"],
          ["Nausea & Vomiting", "🤢"],
          ["Minor Infections", "🩹"],
          ["Headache", "🤕"],
          ["Fever", "🌡️"],
          ["Fatigue", "😮‍💨"],
          ["Cough", "😷"],
          ["Body Aches", "💪"],
        ],
      },
      {
        name: "Internal Medicine",
        ico: "🏥",
        cost: 100,
        desc: "Expert adult healthcare for chronic conditions, preventive screenings, medication reviews, complex symptoms, and personalized care focused on long-term health and wellness.",
        conds: [
          ["Undiagnosed Symptoms", "❓"],
          ["Multi-System Complaints", "🩺"],
          ["Preventive Screening", "🛡️"],
          ["Medication Review", "💊"],
        ],
      },
      {
        name: "Family Medicine",
        ico: "👨‍👩‍👧",
        cost: 100,
        desc: "Comprehensive healthcare for individuals and families of all ages, including preventive care, routine checkups, chronic condition management, vaccinations, and everyday medical needs.",
        conds: [
          ["Routine Check-Ups", "✅"],
          ["Whole-Family Illnesses", "👪"],
          ["Vaccination Advice", "💉"],
        ],
      },
    ],
  },
  // Mens Health
  {
    id: "men",
    label: "Men's Health",
    e: "♂️",
    desc: "Confidential healthcare for men, including sexual wellness, hormonal health, hair loss, urinary concerns, preventive care, and personalized support for long-term well-being.",
    specs: [
      {
        name: "Men's Health",
        ico: "♂️",
        count: "19 doctors",
        cost: 100,
        desc: "Expert care for testosterone imbalance, erectile dysfunction, prostate health, fertility concerns, hair loss, sexual wellness, and healthy aging with personalized treatment plans.",
        conds: [
          ["Erectile Dysfunction", "💙"],
          ["Hair Loss", "📉"],
          ["Low Libido", "💈"],
          ["Low Testosterone Symptoms", "🔬"],
          ["Prostate Health", "💤"],
        ],
      },
      {
        name: "Urology",
        ico: "🚹",
        cost: 100,
        desc: "Specialized care for urinary tract conditions, kidney stones, bladder problems, UTIs, urinary incontinence, and male urological health with personalized treatment and support.",
        conds: [
          ["Urinary Tract Infection (UTI)", "🚻"],
          ["Urinary Incontinence", "🪨"],
          ["Kidney Stones", "🩸"],
          ["Blood in Urine", "💧"],
          ["Bladder Problems", "🚽"],
        ],
      },
    ],
  },
  // Mental Health
  {
    id: "mental",
    label: "Mental Health Support",
    e: "🧠",
    desc: "Compassionate support for anxiety, depression, stress, burnout, emotional challenges, sleep concerns, and overall mental well-being through confidential consultations.",
    specs: [
      {
        name: "Psychiatry",
        ico: "🧠",
        live: true,
        count: "76 doctors",
        cost: 1499,
        desc: "Specialized mental healthcare for anxiety, depression, ADHD, PTSD, insomnia, mood disorders, medication management, and long-term emotional wellness support",
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
        name: "Psychology Counseling",
        ico: "💬",
        cost: 1299,
        desc: "Professional counseling support for stress, grief, trauma, relationship challenges, self-esteem concerns, life transitions, and emotional well-being in a safe, confidential environment.",
        conds: [
          ["Stress", "😣"],
          ["Grief and Loss", "🕊️"],
          ["Relationship Stress", "💔"],
          ["Low Self-Esteem", "🪞"],
          ["Trauma Support", "🤝"],
        ],
      },
      {
        name: "Behavioral Health",
        ico: "🧩",
        cost: 999,
        desc: "Professional support for stress, anxiety-related concerns, life transitions, emotional wellness, anger management, sleep challenges, and healthier coping strategies.",
        conds: [
          ["Anger Management", "🔥"],
          ["Adjustment Difficulties", "🔀"],
          ["Substance Use Support", "🚭"],
          ["Sleep-Related Anxiety", "🌙"],
        ],
      },
    ],
  },
  // Sexual Health
  {
    id: "sexual",
    label: "Sexual Health",
    e: "💗",
    desc: "Confidential sexual healthcare for STI concerns, sexual wellness, contraception guidance, intimate health issues, and personalized support in a secure, judgment-free environment.",
    specs: [
      {
        name: "Sexual Health",
        ico: "💗",
        cost: 799,
        desc: "Confidential care for STI concerns, HIV prevention, PrEP guidance, herpes, chlamydia, gonorrhea, partner exposure risks, and overall sexual wellness.",
        conds: [
          ["STI Consultation", "🔬"],
          ["Safe Sex Counseling", "💊"],
          ["Partner Exposure Concerns", "💙"],
          ["HIV Prevention / PrEP Guidance", "🤐"],
          ["Herpes", "🤝"],
          ["Gonorrhea", "💊"],
          ["Chlamydia", "❤️"],
        ],
      },
    ],
  },
  // Skin & Hair Care
  {
    id: "skin",
    label: "Skin & Hair",
    e: "🧴",
    desc: "Expert support for acne, eczema, rashes, hair loss, scalp conditions, skin allergies, and healthy skin and hair care through personalized treatment guidance.",
    specs: [
      {
        name: "Dermatology",
        ico: "🧴",
        live: true,
        count: "35 doctors",
        cost: 100,
        desc: "Expert care for acne, eczema, psoriasis, rosacea, hair loss, fungal skin infections, hives, nail disorders, skin rashes, and long-term skin, hair, and nail health.",
        conds: [
          ["Acne", "😣"],
          ["Cold Sores", "💋"],
          ["Eczema", "🩹"],
          ["Fungal Skin Infection", "🍄"],
          ["Hair Loss", "🦲"],
          ["Hives", "🔴"],
          ["Mole & Skin Checks", "🔍"],
          ["Nail Problems", "💅"],
          ["Psoriasis", "🧩"],
          ["Rosacea", "🌹"],
          ["Skin Rash", "🌿"],
          ["Warts", "🟤"],
        ],
      },
    ],
  },

  // Travel and Global care

  {
    id: "travel",
    label: "Travel and Global care",
    e: "✈️",
    desc: "Expert healthcare support for international travelers, expatriates, medical tourists, cross-border healthcare needs, travel-related concerns, medication guidance, and ongoing care anywhere in the world.",
    specs: [
      {
        name: "Travel Medicine",
        ico: "✈️",
        cost: 899,
        desc: " Expert travel health support for pre-travel consultations, vaccination guidance, malaria prevention, traveler's diarrhea, altitude sickness, post-travel illness evaluations, and destination-specific health risks.",
        conds: [
          ["Food Poisoning While Traveling", "🍽️"],
          ["Altitude Sickness", "⛰️"],
          ["Malaria Prevention", "🦟"],
          ["Post-Travel Symptoms", "🧳"],
          ["Pre-Travel Vaccination", "💉"],
          ["Travel-Related Fever", "🌡️"],
          ["Traveler's Diarrhea", "🚽"],
        ],
      },
      {
        name: "Global Cross-Border Care",
        ico: "🌍",
        cost: 1999,
        desc: "International healthcare support for travelers, expatriates, medical tourists, medication refill assistance, specialist referrals, chronic care follow-ups, and secure telemedicine consultations across borders.",
        conds: [
          ["Cross-Border Consultation", "🌐"],
          ["International Medical Assistance", "🆘"],
          ["Medication Refill While Traveling", "💊"],
          ["Referral Coordination Overseas", "📋"],
        ],
      },
    ],
  },
  // Weight and Nutrition
  {
    id: "weight",
    label: "Weight & Nutrition",
    e: "🥗",
    desc: "Personalized nutrition support for weight management, healthy eating habits, nutritional deficiencies, digestive wellness, chronic disease management, meal planning, and long-term health goals.",
    specs: [
      {
        name: "Weight Management",
        ico: "⚖️",
        cost: 999,
        desc: "Personalized support for weight loss, obesity management, binge eating concerns, GLP-1 eligibility assessments, nutrition planning, appetite control, and sustainable long-term weight management.",
        conds: [
          ["Obesity", "📊"],
          ["GLP-1 Eligibility", "💉"],
          ["Weight Management", "🔬"],
          ["Weight-loss Planning", "🎯"],
          ["Binge Eating", "🍽️"],
        ],
      },
      {
        name: "Nutrition & Dietetics ",
        ico: "🥗",
        cost: 699,
        desc: "Personalized nutrition support for diabetic diets, cholesterol management, weight loss, pregnancy nutrition, sports nutrition, food intolerance planning, healthy eating habits, and long-term wellness goals.",
        conds: [
          ["Diabetic diet", "🩸"],
          ["Cholesterol-Lowering Diet", "🫀"],
          ["Food Intolerance Plan", "🚫"],
          ["Pregnancy Nutrition", "🤰"],
          ["Sports Nutrition", "🏋️"],
        ],
      },
      {
        name: "Lifestyle Medicine",
        ico: "🌱",
        cost: 599,
        desc: "Personalized support for healthy habit coaching, nutrition planning, exercise guidance, sleep improvement, stress management, weight management, preventive wellness, and long-term health optimization.",
        conds: [
          ["Healthy Habit Coaching", "✅"],
          ["Diet & exercise plan", "🏃"],
          ["Sleep hygiene", "😴"],
        ],
      },
    ],
  },

  // Women Health
  {
    id: "women",
    label: "Women's Health",
    e: "🌸",
    desc: "Personalized care for menstrual health, hormonal concerns, fertility support, pregnancy guidance, menopause management, reproductive wellness, birth control consultations, and preventive women's healthcare.",
    specs: [
      {
        name: "Obstetrics & Gynaecology (OB-GYN) ",
        ico: "🌸",
        count: "44 doctors",
        cost: 1199,
        desc: "Comprehensive women's healthcare for PCOS, fertility concerns, pregnancy support, birth control consultations, menstrual health, pelvic pain, vaginal infections, hormonal balance, and reproductive wellness.",
        conds: [
          ["Bacterial Vaginosis", "🦠"],
          ["Birth Control Consultation", "💊"],
          ["Fertility Concerns", "🌱"],
          ["Irregular Periods", "🩸"],
          ["Menstrual Cramps", "🤕"],
          ["PCOS", "⚕️"],
          ["Pelvic Pain", "🩺"],
          ["Prenatal Consultation", "🤰"],
          ["Vaginal Yeast Infection", "🍄"],
        ],
      },
      {
        name: "Menopause Care",
        ico: "🌙",
        cost: 999,
        desc: "Personalized support for menopause symptoms, hot flashes, night sweats, hormone replacement therapy (HRT) guidance, sleep disturbances, mood changes, vaginal health, and healthy aging.",
        conds: [
          ["Hot Flashes", "🔥"],
          ["Menopause Symptoms", "🚺"],
          ["HRT Guidance", "💊"],
        ],
      },
      {
        name: "Women's Mental Health",
        ico: "💗",
        cost: 1099,
        desc: "Compassionate support for PMDD, perinatal anxiety, postpartum depression, hormonal mood changes, parenting stress, emotional wellness, anxiety management, and women's mental health care.",
        conds: [
          ["Postnatal Depression", "🍼"],
          ["Perinatal Anxiety", "🤱"],
          ["PMDD", "📆"],
        ],
      },
      {
        name: "Lactation Consulting",
        ico: "🤱",
        cost: 699,
        desc: "Expert breastfeeding support for latch difficulties, low milk supply, nipple pain, pumping guidance, infant feeding concerns, weaning transitions, and postpartum feeding success.",
        conds: [
          ["Low milk supply", "🍼"],
          ["Latch Problems", "👶"],
          ["Nipple Pain", "🩹"],
          ["Weaning Guidance", "🥄"],
        ],
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
        conds.push({
          name: cn,
          ico: ci,
          to: s.name,
          catId: cat.id,
          catLabel: cat.label,
          cost: s.cost,
        }),
      );
    }),
  );
  return { specs, conds };
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

  useEffect(() => {
    moveGlider();
  }, [activeTabId]);
  useEffect(() => {
    window.addEventListener("resize", moveGlider);
    return () => window.removeEventListener("resize", moveGlider);
  }, []);

  // Handle incoming category from navigation state
  useEffect(() => {
    if (location.state?.categoryId && enrichedTree.length > 0) {
      const cat = enrichedTree.find((c) => c.id === location.state.categoryId);
      if (cat) {
        setActiveCat(cat);
        setDrillLevel("spec");
        setBrowseTab(null);
        // Clear the state after using it
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location.state, enrichedTree, navigate, location.pathname]);

  const q = query.trim().toLowerCase();

  const visibleFlatSpecs = useMemo(
    () => HCC_SPECS.filter((s) => !q || s.name.toLowerCase().includes(q)),
    [q, HCC_SPECS],
  );
  const visibleFlatConds = useMemo(
    () =>
      HCC_CONDS.filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.to.toLowerCase().includes(q),
      ),
    [q, HCC_CONDS],
  );
  const visibleCats = useMemo(
    () =>
      enrichedTree.filter(
        (c) =>
          !q ||
          c.label.toLowerCase().includes(q) ||
          c.specs.some((s) => s.name.toLowerCase().includes(q)),
      ),
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
    const spec = HCC_SPECS.find(
      (s) => s.name === cond.to && s.catId === cond.catId,
    );
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

  const drillConds = activeSpec ? activeSpec.conds : [];

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

        {/* ── CONTENT CARD ── */}
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
                        const sc = c.specs.length;
                        const cc = c.specs.reduce(
                          (n, s) => n + s.conds.length,
                          0,
                        );
                        return (
                          <div
                            key={c.id}
                            className="catcard"
                            onClick={(e) =>
                              handleCardClick(e, () => handleOpenCat(c))
                            }
                          >
                            <div className="catcard-row1">
                              <div className="ic">{c.e}</div>
                              <h3>{c.label}</h3>
                            </div>
                            {/* ── CHANGED: render custom desc instead of auto-generated samp ── */}
                            <div className="samp">{c.desc}</div>
                            <div className="catcard-row3">
                              <div className="meta">
                                {sc} specialties · {cc} conditions
                              </div>
                              <div className="go">Explore →</div>
                            </div>
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
                    <span style={{ fontSize: 20 }}>{activeCat.e}</span>
                    {activeCat.label}
                  </div>
                  <div className="grid">
                    {activeCat.specs
                      .filter((s) => !q || s.name.toLowerCase().includes(q))
                      .map((s) => {
                        const specWithCat = {
                          ...s,
                          catId: activeCat.id,
                          catLabel: activeCat.label,
                          cost: s.cost,
                        };
                        const condCount = s.conds.length;
                        return (
                          <div
                            key={s.name}
                            className="spec"
                            onClick={(e) =>
                              handleCardClick(e, () =>
                                handleOpenSpec(specWithCat),
                              )
                            }
                          >
                            {s.live && <span className="live">LIVE</span>}
                            <div className="spec-row1">
                              <div className="ic">{s.ico}</div>
                              <h3>{s.name}</h3>
                            </div>
                            {/* ── CHANGED: render custom spec desc ── */}
                            <div className="spec-desc">{s.desc}</div>
                            <div className="spec-row3">
                              <span className="count">
                                {s.count || "Book now"}
                              </span>
                              <span className="condcount">
                                {condCount} condition
                                {condCount === 1 ? "" : "s"}
                              </span>
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
                          onClick={(e) =>
                            handleCardClick(e, () =>
                              handleSelectCond(name, ico, activeSpec),
                            )
                          }
                        >
                          <div className="condcard-ico">{ico}</div>
                          <div className="condcard-body">
                            <div className="condcard-name">{name}</div>
                            <div className="condcard-desc">
                              {activeSpec.name}
                            </div>
                          </div>
                        </div>
                      ))}
                    <div
                      className="condcard condcard-other"
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
                {visibleFlatSpecs.length ? (
                  visibleFlatSpecs.map((s) => {
                    const condCount = s.conds.length;
                    return (
                      <div
                        key={s.name + s.catId}
                        className="spec"
                        onClick={(e) =>
                          handleCardClick(e, () => handleFlatSpecClick(s))
                        }
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
                          <span className="condcount">
                            {condCount} condition{condCount === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    );
                  })
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
                {visibleFlatConds.length ? (
                  visibleFlatConds.map((c, i) => (
                    <div
                      key={i}
                      className="condcard"
                      onClick={(e) =>
                        handleCardClick(e, () => handleFlatCondClick(c))
                      }
                    >
                      <div className="condcard-ico">{c.ico}</div>
                      <div className="condcard-body">
                        <div className="condcard-name">{c.name}</div>
                        <div className="condcard-desc">{c.to}</div>
                      </div>
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
        </div>
        {/* /content-card */}
      </div>
    </section>
  );
}
