import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
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
  { name: "Primary Care", path: "/primary-care-provider", icon: Stethoscope, tags: ["Cold & Flu", "Fever"] },
  { name: "Urgent Care", path: "/urgent-care", icon: ClipboardPlus, tags: ["UTI", "Sore Throat"] },
  { name: "Mental Health", path: "/mental-health", icon: Brain, tags: ["Anxiety", "Depression"] },
  { name: "Chronic Care", path: "/chronic-care", icon: Activity, tags: ["Diabetes", "Hypertension"] },
];

const heroRows = [
  ["Condition", "Food Poisoning While Traveling"],
  ["Need", "Telehealth consult + medical report"],
  ["Route", "English-speaking doctor"],
  ["Status", "Non-emergency triage"],
];

const stats = [
  ["11", "Categories"],
  ["30", "Specialties"],
  ["160+", "Conditions"],
  
];


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
    category: "Children & Family Care",
    icon: Baby,
    conditions: [
      { name: "Childhood Allergies", path: "/childhood-allergies" },
      { name: "Ear Pain In Children", path: "/ear-pain-children" },
      { name: "Feeding Concerns", path: "/feeding-concerns" },
      { name: "Mild Asthma Symptoms", path: "/mild-asthma-symptoms" },
      { name: "Mood & Anxiety In Teens", path: "/mood-anxiety-teens" },
      { name: "Cough & Cold", path: "/pediatric-cold-flu" },
      { name: "Fever In Children", path: "/pediatric-fever" },
      { name: "Pink Eye In Children", path: "/pink-eye-children" },
      { name: "Puberty Concerns", path: "/puberty-concerns" },
      { name: "Childhood Rashes", path: "/skin-rash-children" },
      { name: "Sore Throat In Children", path: "/sore-throat-children" },
      { name: "Sports Injuries", path: "/sports-injuries" },
      { name: "Stomach Pain In Children", path: "/stomach-pain-children" },
      { name: "Growth & Development", path: "/growth-development" },
      { name: "Vomiting & Diarrhea In Children", path: "/vomiting-diarrhea-children" },
    ],
  },
  {
    category: "Chronic Care & Expert Opinion",
    icon: Activity,
    conditions: [
      { name: "Arthritis", path: "/arthritis" },
      { name: "Cancer Second Opinion", path: "/cancer-second-opinion" },
      { name: "Chest Pain (Non-Emergency)", path: "/chest-pain" },
      { name: "Chronic Kidney Disease", path: "/chronic-kidney-disease" },
      { name: "Chronic Migraine", path: "/chronic-migraine" },
      { name: "Complex Diagnosis Review", path: "/complex-diagnosis" },
      { name: "Fatty Liver", path: "/fatty-liver" },
      { name: "Heart Disease", path: "/heart-disease" },
      { name: "High Blood Pressure", path: "/high-blood-pressure" },
      { name: "High Cholesterol", path: "/high-cholesterol" },
      { name: "Hormone Imbalance", path: "/hormone-imblance" },
      { name: "Memory Concerns", path: "/memory-concerns" },
      { name: "Osteoarthritis", path: "/osteoarthritis" },
      { name: "Osteoporosis", path: "/osteoporosis" },
      { name: "Palpitations", path: "/palpitations" },
      { name: "Post-COVID Concerns", path: "/post-covid-concerns" },
      { name: "Pre-Op Cardiac Clearance", path: "/pre-op-cardiac-clearance" },
      { name: "Rheumatoid Arthritis", path: "/rheumatoid-arthritis" },
      { name: "Seizures / Epilepsy Follow-Up", path: "/seizures-epilepsy-follow-up" },
      { name: "Sleep Apnea", path: "/sleep-apnea" },
      { name: "Surgery Second Opinion", path: "/surgery-second-opinion" },
      { name: "Thyroid Disorders", path: "/thyroid-disorders" },
      { name: "Treatment Plan Review", path: "/treatment-plan-review" },
      { name: "Tremor", path: "/tremor" },
      { name: "Type 2 Diabetes", path: "/type-2-diabetes" },
      { name: "Asthma", path: "/asthma" },
      { name: "COPD", path: "/copd" },
      { name: "Kidney Stones", path: "/kidney-stones" },
      { name: "Urinary Incontinence", path: "/urinary-incontinence" },
    ],
  },
  {
    category: "Eye, Ear & Bone",
    icon: HeartPulse,
    conditions: [
      { name: "Back Pain", path: "/back-pain" },
      { name: "Dry Eyes", path: "/dry-eyes" },
      { name: "Ear Infection", path: "/ear-infection" },
      { name: "Ear Pain", path: "/ear-pain" },
      { name: "Eye Redness", path: "/eye-redness" },
      { name: "Eye Strain", path: "/eye-strain" },
      { name: "Hoarseness", path: "/hoarseness" },
      { name: "Knee Pain", path: "/knee-pain" },
      { name: "Muscle Strain", path: "/muscle-strain" },
      { name: "Nasal Congestion", path: "/nasal-congestion" },
      { name: "Neck Pain", path: "/neck-pain" },
      { name: "Numbness & Tingling", path: "/numbness-tingling" },
      { name: "Stye", path: "/stye" },
      { name: "Swollen Feet & Ankles", path: "/swollen-feet-ankles" },
      { name: "Tonsillitis", path: "/tonsillitis" },
      { name: "Joint Pain", path: "/joint-pain" },
      { name: "Vision Changes", path: "/vision-changes" },
    ],
  },
  {
    category: "General & Everyday Care",
    icon: ClipboardPlus,
    conditions: [
      { name: "Acid Reflux / GERD", path: "/acid-reflux-gerd" },
      { name: "Body Aches", path: "/body-aches" },
      { name: "Bronchitis", path: "/bronchitis" },
      { name: "Cold & Flu", path: "/cold-and-flu" },
      { name: "Constipation", path: "/constipation" },
      { name: "Cough", path: "/cough" },
      { name: "COVID-19", path: "/covid-19" },
      { name: "Diarrhea", path: "/diarrhea" },
      { name: "Dizziness", path: "/dizziness" },
      { name: "Fatigue", path: "/fatigue" },
      { name: "Fever", path: "/fever" },
      { name: "Food Poisoning", path: "/food-poisoning" },
      { name: "Headache", path: "/headache" },
      { name: "Insect Bites", path: "/insect-bite" },
      { name: "Migraines", path: "/migraines" },
      { name: "Minor Burns", path: "/minor-burns" },
      { name: "Minor Infections", path: "/minor-infections" },
      { name: "Multi-System Complaints", path: "/multi-system-complaints" },
      { name: "Nausea & Vomiting", path: "/nausea-and-vomiting" },
      { name: "Pink Eye", path: "/pink-eye" },
      { name: "Preventive Screening", path: "/preventive-screening" },
      { name: "Routine Check-Ups", path: "/routine-check-ups" },
      { name: "Seasonal Allergies", path: "/seasonal-allergies" },
      { name: "Sinus Infection", path: "/sinus-infection" },
      { name: "Sore Throat", path: "/sore-throat" },
      { name: "Strep Throat", path: "/strep-throat" },
      { name: "Undiagnosed Symptoms", path: "/undiagnosed-symptoms" },
      { name: "Vaccination Advice", path: "/vaccination-advice" },
      { name: "Whole-Family Illnesses", path: "/whole-family-illnesses" },
      { name: "Doctor's Note", path: "/doctors-note" },
      { name: "Follow-Up Consultation", path: "/follow-up-consultation" },
      { name: "Lab Results Review", path: "/lab-results-review" },
      { name: "Medical Certificate", path: "/medical-certificate" },
      { name: "Medication Review", path: "/medication-review" },
      { name: "Prescription Refill", path: "/prescription-refill" },
      { name: "Return-To-Work Clearance", path: "/return-to-work-clearance" },
      { name: "Second Medical Opinion", path: "/second-medical-opinion" },
      { name: "Specialist Referral", path: "/specialist-referral" },
      { name: "Allergic Rhinitis", path: "/allergic-rhinitis" },
      { name: "Persistent Cough", path: "/persistent-cough" },
      { name: "Pneumonia Follow-Up", path: "/pneumonia-follow-up" },
      { name: "Shortness Of Breath", path: "/shortness-of-breath" },
      { name: "Upper Respiratory Infection", path: "/upper-respiratory-infection" },
      { name: "Wheezing", path: "/wheezing" },
      { name: "Asthma Flare-Up", path: "/asthma-flare-up" },
      { name: "Bladder Infection", path: "/bladder-infection" },
      { name: "Burning Urination", path: "/burning-urination" },
      { name: "Frequent Urination", path: "/frequent-urination" },
      { name: "Urinary Tract Infection", path: "/urinary-tract-infection" },
      { name: "Blood In Urine", path: "/blood-in-urine" },
    ],
  },
  {
    category: "Men's Health",
    icon: Mars,
    conditions: [
      { name: "Bladder Problems", path: "/bladder-problems" },
      { name: "Erectile Dysfunction", path: "/erectile-dysfunction" },
      { name: "Hair Loss", path: "/hair-loss-mens-health" },
      { name: "Low Libido", path: "/low-libido" },
      { name: "Low Testosterone", path: "/low-testosterone-symptoms" },
      { name: "Men's Wellness Consultation", path: "/mens-wellness-consultation" },
      { name: "Premature Ejaculation", path: "/premature-ejaculation" },
      { name: "Prostate Health", path: "/prostate-health" },
      { name: "Urinary Symptoms In Men", path: "/urinary-symptoms-in-men" },
    ],
  },
  {
    category: "Mental Health",
    icon: Brain,
    conditions: [
      { name: "Perinatal Anxiety", path: "/perinatal-anxiety" },
      { name: "Postnatal Depression", path: "/postnatal-depression" },
      { name: "Postpartum Concerns", path: "/postpartum-concerns" },
      { name: "Sleep Hygiene", path: "/sleep-hygiene" },
    ],
  },
  {
    category: "Sexual Health",
    icon: ShieldCheck,
    conditions: [
      { name: "Chlamydia", path: "/chlamydia" },
      { name: "Genital Itching", path: "/genital-itching" },
      { name: "Genital Rash", path: "/genital-rash" },
      { name: "Gonorrhea", path: "/gonorrhea" },
      { name: "Herpes", path: "/herpes" },
      { name: "HIV Prevention Guidance", path: "/hiv-prevention-guidance" },
      { name: "Partner Exposure Concerns", path: "/partner-exposure-concerns" },
      { name: "Safe-Sex Counseling", path: "/safe-sex-counseling" },
      { name: "STI Consultation", path: "/sti-consultation" },
    ],
  },
  {
    category: "Skin & Hair Care",
    icon: HeartPulse,
    conditions: [
      { name: "Acne", path: "/acne" },
      { name: "Athlete's Foot", path: "/athletes-foot" },
      { name: "Cellulitis", path: "/cellulitis" },
      { name: "Cold Sores", path: "/cold-sores" },
      { name: "Contact Dermatitis", path: "/contact-dermatitis" },
      { name: "Eczema", path: "/eczema" },
      { name: "Fungal Skin Infection", path: "/fungal-skin-infection" },
      { name: "Hives", path: "/hives" },
      { name: "Itchy Skin", path: "/itchy-skin" },
      { name: "Mole & Skin Checks", path: "/mole-skin-checks" },
      { name: "Nail Problems", path: "/nail-problems" },
      { name: "Psoriasis", path: "/psoriasis" },
      { name: "Ringworm", path: "/ringworm" },
      { name: "Rosacea", path: "/rosacea" },
      { name: "Shingles", path: "/shingles" },
      { name: "Skin Rash", path: "/skin-rash" },
      { name: "Warts", path: "/warts" },
    ],
  },
  {
    category: "Travel & Global Care",
    icon: Plane,
    conditions: [
      { name: "Altitude Sickness", path: "/altitude-sickness" },
      { name: "Cross-Border Consultation", path: "/cross-border-consultation" },
      { name: "Emergency Teleconsultation Abroad", path: "/emergency-teleconsultation-abroad" },
      { name: "Fitness For Travel Evaluation", path: "/fitness-travel-evaluation" },
      { name: "Food Poisoning While Traveling", path: "/food-poisoning-while-traveling" },
      { name: "International Medical Assistance", path: "/international-medical-assistance" },
      { name: "Malaria Prevention", path: "/malaria-prevention" },
      { name: "Jet Lag", path: "/jet-lag" },
      { name: "Medication Refills While Traveling", path: "/medication-refills-traveling" },
      { name: "Motion Sickness", path: "/motion-sickness" },
      { name: "Post-Travel Symptoms", path: "/post-travel-symptoms" },
      { name: "Pre-Travel Vaccinations", path: "/pre-travel-vaccinations" },
      { name: "Referral Coordination Overseas", path: "/referral-coordination-overseas" },
      { name: "Travel Medical Certification", path: "/travel-medical-certification" },
      { name: "Travel-Related Fever", path: "/travel-related-fever" },
      { name: "Traveler's Diarrhea", path: "/travelers-diarrhea" },
    ],
  },
  {
    category: "Weight & Nutrition",
    icon: Activity,
    conditions: [
      { name: "Abdominal Pain", path: "/abdominal-pain" },
      { name: "Binge Eating", path: "/binge-eating" },
      { name: "Bloating", path: "/bloating" },
      { name: "Cholesterol-Lowering Diet", path: "/cholesterol-lowering-diet" },
      { name: "Dehydration", path: "/dehydration" },
      { name: "Diabetic Diet", path: "/diabetic-diet" },
      { name: "Diet & Exercise Planning", path: "/diet-exercise-planning" },
      { name: "Food-Intolerance Planning", path: "/food-intolerance-planning" },
      { name: "Gastritis", path: "/gastritis" },
      { name: "GLP-1 Program Eligibility", path: "/glp-program-eligibility" },
      { name: "Healthy-Habit Coaching", path: "/healthy-habit-coaching" },
      { name: "Hemorrhoids", path: "/hemorrhoids" },
      { name: "Indigestion", path: "/indigestion" },
      { name: "IBS", path: "/irritable-bowel-syndrome" },
      { name: "Pregnancy Nutrition", path: "/pregnancy-nutrition" },
      { name: "Sports Nutrition", path: "/sports-nutrition" },
      { name: "Metabolic Syndrome", path: "/metabolic-syndrome" },
      { name: "Vomiting", path: "/vomiting" },
      { name: "Weight-Loss Planning", path: "/weight-loss-planning" },
      { name: "Obesity", path: "/obesity" },
    ],
  },
  {
    category: "Women's Health",
    icon: Venus,
    conditions: [
      { name: "Bacterial Vaginosis", path: "/bacterial-vaginosis" },
      { name: "Birth Control Consultation", path: "/birth-control-consultation" },
      { name: "Emergency Contraception Guidance", path: "/emergency-contraception-guidance" },
      { name: "Heavy Periods", path: "/heavy-periods" },
      { name: "Irregular Periods", path: "/irregular-periods" },
      { name: "Latch Problems", path: "/latch-problems" },
      { name: "Low Milk Supply", path: "/low-milk-supply" },
      { name: "Menopause Symptoms", path: "/menopause-symptoms" },
      { name: "Menstrual Cramps", path: "/menstrual-cramps" },
      { name: "Nipple Pain", path: "/nipple-pain" },
      { name: "PCOS", path: "/pcos" },
      { name: "Pelvic Pain", path: "/pelvic-pain" },
      { name: "PMDD", path: "/pmdd" },
      { name: "Pregnancy-Related Questions", path: "/pregnancy-related-questions" },
      { name: "Prenatal Consultation", path: "/prenatal-consultation" },
      { name: "Vaginal Yeast Infection", path: "/vaginal-yeast-infection" },
      { name: "Weaning Guidance", path: "/weaning-guidance" },
    ],
  },
];


// -----------Care section --------
const careFeatures = [
  {
    title: "Symptom Based Medical Guidance",
    desc: "Understand your symptoms and receive professional medical advice to help determine the appropriate next steps for your health.",
  },
  {
    title: "Personalized Healthcare Support",
    desc: "Connect with experienced healthcare professionals who provide recommendations based on your symptoms, medical history, and individual healthcare needs.",
  },
  {
    title: "Quick Access to Medical Advice",
    desc: "Consult a doctor online for symptoms and receive timely healthcare support for new, recurring, or ongoing health concerns.",
  },
  {
    title: "Expert Evaluation & Treatment Guidance",
    desc: "Receive professional insights, treatment recommendations, and support for managing a wide range of symptoms and medical conditions.",
  },
  {
    title: "Continuous Care & Follow-Up Support",
    desc: "Stay connected with healthcare professionals for ongoing guidance, symptom monitoring, and long-term health management.",
  },
  {
    title: "Secure & Convenient Online Doctor Consultation",
    desc: "Access trusted online doctor consultations from the comfort of your home through a private, secure, and patient-centered virtual healthcare experience.",
  },
];

// -----------FAQ section --------
const faqGroups = [
  {
    group: "Consult a Doctor Online for Symptoms",
    items: [
      {
        q: "What does it mean to consult a doctor online for symptoms?",
        a: "Consulting a doctor online for symptoms allows you to discuss your health concerns with qualified healthcare professionals remotely and receive medical guidance, recommendations, and advice through secure virtual consultations.",
      },
      {
        q: "How can I consult a doctor online for symptoms?",
        a: "You can choose a virtual consultation, share your symptoms, medical history, and concerns, and healthcare professionals will guide you toward appropriate care and treatment options.",
      },
      {
        q: "What symptoms can I discuss during an online doctor consultation?",
        a: "You can discuss many non-emergency symptoms, including common illnesses, skin concerns, mental health concerns, chronic health symptoms, sexual health concerns, and other general medical issues.",
      },
      {
        q: "What if I am not sure what is causing my symptoms?",
        a: "You do not need a confirmed diagnosis before seeking care. Healthcare professionals can evaluate your symptoms and recommend appropriate next steps or additional medical evaluation if needed.",
      },
      {
        q: "Can an online doctor diagnose my symptoms?",
        a: "Healthcare professionals can assess your symptoms, review your medical history, provide medical advice, and determine whether further testing or an in-person examination may be necessary.",
      },
      {
        q: "Can I receive treatment recommendations through an online consultation?",
        a: "Yes, healthcare professionals can discuss suitable treatment options, self-care recommendations, and medical guidance when appropriate.",
      },
      {
        q: "Do I need previous medical records before consulting online?",
        a: "Medical records, test reports, and information about current medications can help healthcare professionals understand your condition, but they are not always required.",
      },
      {
        q: "Can I discuss recurring or long-term symptoms during an online consultation?",
        a: "Yes, online consultations are suitable for discussing ongoing symptoms, receiving continuous healthcare support, and monitoring long-term health concerns.",
      },
      {
        q: "Are online consultations private and secure?",
        a: "Yes, Humancare Connect prioritizes patient confidentiality and uses secure technology to protect your personal health information.",
      },
      {
        q: "Can I discuss multiple symptoms in a single consultation?",
        a: "Yes, sharing all your symptoms helps healthcare professionals gain a complete understanding of your health and provide more personalized guidance.",
      },
      {
        q: "When should I seek emergency care instead of an online consultation?",
        a: "You should seek immediate emergency medical attention for severe chest pain, difficulty breathing, serious injuries, sudden weakness, uncontrolled bleeding, or any other life-threatening symptoms.",
      },
      {
        q: "How quickly can I connect with a healthcare professional?",
        a: "Humancare Connect makes it simple to consult a doctor online for symptoms with convenient access to trusted healthcare professionals and timely medical guidance.",
      },
      {
        q: "What are the benefits of consulting a doctor online for symptoms?",
        a: "The benefits include convenience, faster access to medical support, personalized healthcare guidance, and receiving care from the comfort of your home.",
      },
      {
        q: "Can I receive prescriptions during an online consultation?",
        a: "When medically appropriate and permitted by applicable regulations, healthcare professionals may provide prescriptions or treatment recommendations based on your symptoms and condition.",
      },
      {
        q: "Can I get a second opinion for my symptoms or diagnosis?",
        a: "Yes, you can consult healthcare professionals online to receive additional medical insights about your diagnosis, treatment plan, or ongoing health concerns.",
      },
      {
        q: "Why choose Humancare Connect to consult a doctor online for symptoms?",
        a: "Humancare Connect provides secure online doctor consultations, experienced healthcare professionals, and personalized healthcare support to help you understand your symptoms and make informed healthcare decisions with confidence.",
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
  const [openFaq, setOpenFaq] = useState("0-0");
  const faqRightRef = useRef(null);

  const allConditions = useMemo(
    () =>
      conditionCategories.flatMap(({ category, icon, conditions }) =>
        conditions.map((condition) => ({
          name: condition.name,
          path: condition.path,
          category,
          icon,
        })),
      ),
    [],
  );

  const filtered = useMemo(
    () =>
      allConditions.filter(({ name, category }) => {
        const matchCat = active === "All" || category === active;
        const matchSearch =
          name.toLowerCase().includes(query.toLowerCase()) ||
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
      <Helmet>
        <title>Consult a Doctor Online for Symptoms | Virtual Healthcare | Humancare Connect</title>
        <meta
          name="description"
          content="Consult a doctor online for symptoms with Humancare Connect. Get expert medical advice, personalized treatment guidance, and secure virtual healthcare consultations from trusted professionals."
        />
      </Helmet>

      <section id="top" className="sy-hero">
        <div className="sy-hero-inner">
          {/* ── Left column ── */}
          <div>
            <div className="sy-hero-badge">
              <Globe2 size={14} />
              US-facing telehealth condition directory
            </div>

            <h1 className="sy-hero-title">
              Consult a Doctor Online for Symptoms and Get the Right Care
            </h1>

            <p className="sy-hero-copy">
              Consult a Doctor Online for Symptoms and Get the Right Care
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
                {previewSpecialties.map(({ name, path, icon: Icon, tags }, i) => (
                  <Link
                    key={name}
                    to={path}
                    className={`sy-hero__mini-card${i === current.activeIndex ? " sy-hero__mini-card--active" : ""}`}
                  >
                    <Icon size={20} />
                    <div className="sy-hero__mini-name">{name}</div>
                    <div className="sy-hero__mini-tags">{tags.join(" · ")}</div>
                  </Link>
                ))}
              </div>

              {/* Featured / active specialty footer row */}
              <Link
                to={previewSpecialties[current.activeIndex].path}
                className="sy-hero__feature-row"
              >
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
              </Link>

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
                <Link
                  key={`${item.category}-${item.name}`}
                  to={item.path}
                  className="symptoms__item"
                  style={{ "--delay": `${Math.min(i, 30) * 20}ms` }}
                >
                  <div className="symptoms__item-icon">
                    <Icon size={18} />
                  </div>
                  <div>
                    <div className="symptoms__item-name">{item.name}</div>
                    <div className="symptoms__item-cat">{item.category}</div>
                  </div>
                </Link>
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
            <span className="sy-care__eyebrow">SYMPTOM-BASED ONLINE CARE
</span>
            <h2 className="sy-care__heading">
              Consult a Doctor Online for Symptoms with Confidence

            </h2>
            <p className="sy-care__copy">
              Humancare Connect helps you consult a doctor online for symptoms through secure and convenient virtual healthcare services. Whether you are experiencing a new health concern or managing ongoing symptoms, our online consultations provide access to trusted healthcare professionals who can guide you toward appropriate care.
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
            <h2 className="sy-faq__heading">
              Consult a Doctor Online for Symptoms
            </h2>
            <p className="sy-faq__copy">
              Everything you need to know about consulting a doctor online for
              symptoms with Humancare Connect. Can't find an answer?
            </p>

            {/* <button type="button" className="sy-faq__chat-btn">
              <MessageCircle size={16} />
              Chat with our team
            </button> */}

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
                {faqGroups.length > 1 && (
                  <span className="sy-faq__group-label">{group.group}</span>
                )}
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
            Find your condition <span>in under 2 minutes.</span>
          </h2>
          <p className="sy-cta__copy">
            Search, look, and consult with a verified physician from anywhere —
            same-day appointments available across all categories.
          </p>
          <div className="sy-cta__actions">
            <a href="/book-appointment" className="sy-cta__btn-primary">
              Book a consultation
              <ArrowRight size={16} />
            </a>
            <a href="/specialties" className="sy-cta__btn-secondary">
              Browse specialties
            </a>
          </div>
        </div>
      </section>
    </>
  );
}