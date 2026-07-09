import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  Globe2, ArrowRight, Plane, Stethoscope, Brain, Activity,
  ClipboardPlus, HeartPulse, Venus, Mars, Baby, ShieldCheck,
  Pill, Users, CheckCircle2, ChevronLeft, ChevronRight,
  Search, MessageCircle, Clock, Lock, MapPin, Plus, Minus,
  Soup, Sparkles, HeartHandshake, Wind, Eye, Ear,
  Bone, Baby as BabyIcon, Scale, FileSearch, Heart
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
      ["Need", "Telehealth consult + medical report"],
      ["Route", "English-speaking doctor"],
      ["Status", "Non-emergency triage"],
    ],
    tabs: [
      { name: "Primary Care", icon: Stethoscope, tags: ["Cold & Flu", "Fever"] },
      { name: "Urgent Care", icon: ClipboardPlus, tags: ["UTI", "Sore Throat"] },
      { name: "Mental Health", icon: Brain, tags: ["Anxiety", "Depression"] },
      { name: "Chronic Care", icon: Activity, tags: ["Diabetes", "Hypertension"] },
    ],
  },
  {
    icon: Stethoscope,
    cardSub: "Chronic condition management",
    cardTitle: "Ongoing care support",
    rows: [
      ["Condition", "Type 2 Diabetes"],
      ["Need", "Medication review + monitoring"],
      ["Route", "Certified chronic care physician"],
      ["Status", "Scheduled follow-up"],
    ],
    tabs: [
      { name: "Chronic Care", icon: Activity, tags: ["Diabetes", "Hypertension"] },
      { name: "Primary Care", icon: Stethoscope, tags: ["Preventive", "Check-ups"] },
      { name: "Medication Mgmt", icon: Pill, tags: ["Refill", "Side Effects"] },
      { name: "Second Opinion", icon: Users, tags: ["Lab Review", "Diagnosis"] },
    ],
  },
  {
    icon: Brain,
    cardSub: "Mental wellness session",
    cardTitle: "Confidential therapy consult",
    rows: [
      ["Condition", "Generalised Anxiety Disorder"],
      ["Need", "Behavioural health consultation"],
      ["Route", "Licensed therapist, English"],
      ["Status", "Non-emergency intake"],
    ],
    tabs: [
      { name: "Mental Health", icon: Brain, tags: ["Anxiety", "Depression"] },
      { name: "Primary Care", icon: Stethoscope, tags: ["Insomnia", "Fatigue"] },
      { name: "Chronic Care", icon: Activity, tags: ["Stress", "Burnout"] },
      { name: "Second Opinion", icon: Users, tags: ["Referral", "Clarity"] },
    ],
  },
  {
    icon: Venus,
    cardSub: "Women's health consult",
    cardTitle: "Reproductive & hormonal care",
    rows: [
      ["Condition", "PCOS — irregular cycles"],
      ["Need", "Hormone panel + birth control"],
      ["Route", "OB-GYN specialist, telehealth"],
      ["Status", "Initial consultation"],
    ],
    tabs: [
      { name: "Women's Health", icon: Venus, tags: ["PCOS", "Birth Control"] },
      { name: "Primary Care", icon: Stethoscope, tags: ["Fatigue", "Weight"] },
      { name: "Mental Health", icon: Brain, tags: ["Mood", "Stress"] },
      { name: "Medication Mgmt", icon: Pill, tags: ["Rx Refill", "Review"] },
    ],
  },
];

// ── Full specialties list (30) ───────────────────────────────────────────────
export const specialties = [
  {
    name: "General Physician (GP)",
    path: "/general-physician",
    icon: Stethoscope,
    description: "Trusted primary healthcare for common illnesses, preventive care, chronic condition management, routine checkups, and everyday medical concerns for adults and families.",
    tags: ["Body Aches","Cold & Flu", "Cough", "Fatigue", "Fever","Headache","Minor Infections","Nausea & Vomiting","Pink Eye","Sinus Infection"],
  },
  {
    name: "Internal Medicine",
    path: "/internal-medicine",
    icon: ClipboardPlus,
    description: "Expert adult healthcare for chronic conditions, preventive screenings, medication reviews, complex symptoms, and personalized care focused on long-term health and wellness.",
    tags: ["Medication Review", "Multi-System Complaints", "Preventive Screening","Undiagnosed Symptoms"],
  },
  {
    name: "Family Medicine",
    path: "/family-medicine",
    icon: HeartHandshake,
    description: "Comprehensive healthcare for individuals and families of all ages, including preventive care, routine checkups, chronic condition management, vaccinations, and everyday medical needs.",
    tags: ["Whole-Family Illnesses", "Vaccination Advice", "Routine Check-Ups"],
  },
  {
    name: "Psychiatry",
    path: "/psychiatry",
    icon: Brain,
    description: "Specialized mental healthcare for anxiety, depression, ADHD, PTSD, insomnia, mood disorders, medication management, and long-term emotional wellness support",
    tags: ["Anxiety", "Depression","ADHD Evaluation","Bipolar Disorder Follow-Up","Insomnia","OCD","Panic Attacks","PTSD"]
  },
  {
    name: "Psychology Counseling",
    path: "/psychology-counseling",
    icon: MessageCircle,
    description: "Professional counseling support for stress, grief, trauma, relationship challenges, self-esteem concerns, life transitions, and emotional well-being in a safe, confidential environment.",
    tags: ["Trauma Support", "Stress", "Relationship Stress","Low Self-Esteem","Grief and Loss"],
  },
  {
    name: "Behavioral Health",
    path: "/behavioral-health",
    icon: Activity,
    description: "Professional support for stress, anxiety-related concerns, life transitions, emotional wellness, anger management, sleep challenges, and healthier coping strategies.",
    tags: ["Adjustment Difficulties", "Anger Management", "Sleep-Related Anxiety","Substance Use Support"],
  },
  {
    name: "Dermatology",
    path: "/dermatology",
    icon: HeartPulse,
    description: "Expert care for acne, eczema, psoriasis, rosacea, hair loss, fungal skin infections, hives, nail disorders, skin rashes, and long-term skin, hair, and nail health.",
    tags: ["Acne", "Cold Sores", "Eczema","Fungal Skin Infection","Hair Loss","Hives","Mole & Skin Checks","Nail Problems","Psoriasis","Rosacea","Skin Rash","Warts"],
  },
  {
    name: "Obstetrics & Gynaecology (OB-GYN)",
    path: "/obstetrics-and-gynaecology",
    icon: Venus,
    description: "Comprehensive women's healthcare for PCOS, fertility concerns, pregnancy support, birth control consultations, menstrual health, pelvic pain, vaginal infections, hormonal balance, and reproductive wellness.",
    tags: ["Bacterial Vaginosis", "Birth Control Consultation", "Fertility Concerns","Irregular Periods","Menstrual Cramps","PCOS",
"Pelvic Pain","Prenatal Consultation","Vaginal Yeast Infection"],
  },
  {
    name: "Menopause Care",
    path: "/menopause-care",
    icon: Venus,
    description: "Hormonal symptom management and guidance through perimenopause and beyond.",
    tags: ["Hot Flashes", "Hormones", "Sleep"],
  },
  {
    name: "Women's Mental Health",
    path: "/women-mental-health",
    icon: Brain,
    description: "Compassionate support for PMDD, perinatal anxiety, postpartum depression, hormonal mood changes, parenting stress, emotional wellness, anxiety management, and women's mental health care.",
    tags: ["Postnatal Depression", "Perinatal Anxiety", "PMDD"],
  },
  {
    name: "Lactation Consulting",
    path: "/lactation-consulting",
    icon: BabyIcon,
    description: "Expert breastfeeding support for latch difficulties, low milk supply, nipple pain, pumping guidance, infant feeding concerns, weaning transitions, and postpartum feeding success.",
    tags: ["Latch Problems", "Latch Problems", "Nipple Pain","Weaning Guidance"],
  },
  {
    name: "Men's Health",
    path: "/mens-health",
    icon: Mars,
    description: "Expert care for testosterone imbalance, erectile dysfunction, prostate health, fertility concerns, hair loss, sexual wellness, and healthy aging with personalized treatment plans.",
    tags: ["Prostate Health", "Low Testosterone Symptoms", "Low Libido","Hair Loss","Erectile Dysfunction"],
  },
  {
    name: "Urology",
    path: "/urology",
    icon: Activity,
    description: "Diagnosis and treatment of urinary tract and reproductive system issues.",
    tags: ["UTI", "Kidney Stones", "Prostate"],
  },
  {
    name: "Pediatrics",
    path: "/pediatrics",
    icon: Baby,
    description: "Kids’ Care Comprehensive care for infants, children and teens, from routine wellness exams and vaccinations to illness treatment, developmental support and preventive care that promotes healthy growth.",
    tags: ["Ear Pain in Children", "Feeding Concerns", "Pediatric Cold & Flu","Pediatric Fever","Skin Rash in Children"],
  },
  {
    name: "Adolescent Medicine",
    path: "/adolescent-medicine",
    icon: Users,
    description: "Adolescent Medicine Comprehensive health care for teenagers and young adults with support for puberty, mental health, growth, nutrition, sports injuries and overall adolescent wellness",
    tags: ["Mood & Anxiety in Teens", "Puberty Concerns", "Sports Injuries"],
  },
  {
    name: "Weight Management",
    path: "/weight-management",
    icon: Scale,
    description: "Personalized support for weight loss, obesity management, binge eating concerns, GLP-1 eligibility assessments, nutrition planning, appetite control, and sustainable long-term weight management.",
    tags: ["Weight Management", "Weight-Loss Planning", "Obesity","GLP-1 Program Eligibility"],
  },
  {
    name: "Nutrition & Dietetics",
    path: "/nutrition-and-dietetics",
    icon: Soup,
    description: "Dietary guidance from licensed professionals for health and recovery goals.",
    tags: ["Nutrition & Dietetics ", "Sports Nutrition", "Pregnancy Nutrition","Food Intolerance Planning","Diabetic Diet","Cholesterol-Lowering Diet"],
  },
  {
    name: "Lifestyle Medicine",
    path: "/lifestyle-medicine",
    icon: Sparkles,
    description: "Personalized support for healthy habit coaching, nutrition planning, exercise guidance, sleep improvement, stress management, weight management, preventive wellness, and long-term health optimization.",
    tags: ["Healthy Habit Coaching", "Diet & Exercise Planning", "Sleep Hygiene"],
  },
  {
    name: "Cardiology",
    path: "/cardiology",
    icon: HeartPulse,
    description: "Expert heart and cardiovascular care for high blood pressure, cholesterol management, heart disease, palpitations, preventive screenings, and long-term heart health support.",
    tags: ["Chest Pain (Non-Emergency)", "High Cholesterol", "Heart Disease Follow-Up","High Blood Pressure","Palpitations","Pre-Op Cardiac Clearance"],
  },
  {
    name: "Endocrinology",
    path: "/endocrinology",
    icon: Activity,
    description: "Specialized care for hormone imbalances, diabetes, thyroid disorders, metabolic conditions, bone health concerns, and long-term endocrine wellness through personalized treatment plans.",
    tags: ["Type 2 Diabetes", "Thyroid", "Hormone Imbalance","Osteoporosis"],
  },
  {
    name: "Gastroenterology",
    path: "/gastroenterology",
    icon: Soup,
    description: "Digestive system care, from everyday symptoms to chronic GI conditions.",
    tags: ["IBS", "Acid Reflux", "Bloating"],
  },
  {
    name: "Neurology",
    path: "/neurology",
    icon: Brain,
    description: "Specialized care for migraines, dizziness, memory concerns, seizures, tremors, nerve disorders, and neurological conditions affecting brain and nerve health.",
    tags: ["Migraine", "Dizziness", "Numbness and Tingling","Chronic Migraine", "Seizures / Epilepsy Follow-Up", "Tremor"],
  },
  {
    name: "Pulmonology",
    path: "/pulmonology",
    icon: Wind,
    description: "Expert respiratory care for asthma, COPD, chronic cough, sleep apnea, breathing difficulties, lung conditions, and long-term respiratory health management.",
    tags: ["Asthma", "Chronic lung disease affecting breathing", "Persistent Cough","Post-COVID Concerns", "Shortness of Breath", "Sleep Apnea"],
  },
  {
    name: "Expert Medical Opinion",
    path: "/export-medical-opinion",
    icon: FileSearch,
    description: "Gain clarity and confidence with specialist reviews of diagnoses, treatment plans, surgery recommendations, cancer care options, and complex medical conditions.",
    tags: ["Cancer Second Opinion", "Complex Diagnosis Review","Second Medical Opinion","Surgery Second Opinion","Treatment Plan Review"],
  },
  {
    name: "Ophthalmology",
    path: "/ophthalmology",
    icon: Eye,
    description: "Expert eye care for dry eyes, vision changes, eye infections, redness, eye strain, and long-term vision health with personalized treatment and support.",
    tags: ["Vision Changes", "Stye", "Eye Strain","Eye Redness","Eye Irritation","Dry Eyes"],
  },
  {
    name: "ENT (Ear, Nose & Throat)",
    path: "/ent",
    icon: Ear,
    description: "Specialized care for ear infections, sinus problems, sore throats, hearing concerns, vertigo, voice disorders, and conditions affecting the ear, nose, and throat.",
    tags: ["Ear Infection", "Ear Pain", "Hoarseness","Nasal Congestion","Sore Throat","Tonsillitis","Vertigo"],
  },
  {
    name: "Orthopedics",
    path: "/orthopedics",
    icon: Bone,
    description: "Specialized care for joint pain, arthritis, back and neck pain, sports injuries, muscle strains, and musculoskeletal conditions to improve mobility and quality of life.",
    tags: ["Osteoarthritis", "Neck Pain", "Muscle Strain","Knee Pain","Back Pain","Back Pain","Arthritis"],
  },
  {
    name: "Sexual Health",
    path: "/speciality-sexual-health",
    icon: ShieldCheck,
    description: "Confidential care for STI concerns, HIV prevention, PrEP guidance, herpes, chlamydia, gonorrhea, partner exposure risks, and overall sexual wellness.",
    tags: ["STI Consultation", "Safe Sex Counseling","Partner Exposure Concerns","HIV Prevention / PrEP Guidance","Herpes","Gonorrhea","Chlamydia"],
  },
  {
    name: "Travel Medicine",
    path: "/travel-medicine",
    icon: Plane,
    description: " Expert travel health support for pre-travel consultations, vaccination guidance, malaria prevention, traveler's diarrhea, altitude sickness, post-travel illness evaluations, and destination-specific health risks.",
    tags: ["Food Poisoning While Traveling", "Altitude Sickness","Malaria Prevention","Post-Travel Symptoms","Pre-Travel Vaccination","Travel-Related Fever","Traveler’s Diarrhea",],
  },
  {
    name: "Global Cross-Border Care",
    path: "/global-cross-border-care",
    icon: Globe2,
    description: "International healthcare support for travelers, expatriates, medical tourists, medication refill assistance, specialist referrals, chronic care follow-ups, and secure telemedicine consultations across borders.",
    tags: ["Cross-Border Consultation", "International Medical Assistance","Medication Refill While Traveling","Referral Coordination Overseas"],
  },
];

// ── Stats ─────────────────────────────────────────────────────────────────────
const stats = [
  [String(specialties.length), "Specialties"],
  ["11", "Categories"],
  ["140+", "Conditions"],
];

const audiences = [
  {
    title: "Expert Medical Insights",
    desc: "Receive specialized medical guidance from experienced healthcare professionals with expertise in specific areas of healthcare.",
  },
  {
    title: "Personalized Treatment Support",
    desc: "Get personalized care recommendations based on your symptoms, medical history, diagnosis, and individual health goals.",
  },
  {
    title: "Advanced Specialist Healthcare",
    desc: "Connect with an online specialist doctor for detailed evaluations, comprehensive medical advice, and support for complex or long-term health concerns.",
  },
  {
    title: "Convenient Virtual Specialist Consultations",
    desc: "Access specialist healthcare services through secure online consultations without long waiting times or unnecessary travel.",
  },
  {
    title: "Second Opinions & Better Healthcare Decisions",
    desc: "Consult an online specialist doctor to gain additional medical insights, understand treatment options, and make informed decisions about your health.",
  },
  {
    title: "Continuous Specialist Support",
    desc: "Stay connected with healthcare specialists for ongoing follow-ups, long-term condition management, and continuous medical guidance.",
  },
];

// ── Browse-by-condition list ─────────────────────────────────────────────────
const conditions = [
  { name: "Arthritis", icon: Bone },
  { name: "Cancer Second Opinion", icon: ShieldCheck },
  { name: "Chest Pain", icon: Heart },
  { name: "Chronic Kidney Disease", icon: Activity },
  { name: "Chronic Migraine", icon: Brain },
  { name: "Complex Diagnosis", icon: FileSearch },
  { name: "Fatty Liver", icon: Soup },
  { name: "Heart Disease", icon: Heart },
];

// ── FAQ data ─────────────────────────────────────────────────────────────────
const faqGroups = [
  {
    label: "About Specialist Doctors",
    icon: Clock,
    items: [
      {
        q: "What is an online specialist doctor?",
        a: "An online specialist doctor is a qualified healthcare professional with expertise in a specific medical field who provides virtual consultations, medical advice, and treatment guidance remotely.",
      },
      {
        q: "How do I choose the right online specialist doctor?",
        a: "You can select a specialist based on your symptoms, health concerns, medical condition, or the type of expert care you need.",
      },
      {
        q: "What types of online specialist doctors are available through Humancare Connect?",
        a: "Humancare Connect provides access to a wide range of specialists, helping you connect with the right healthcare professional for your individual medical needs.",
      },
      {
        q: "Can I consult an online specialist doctor from home?",
        a: "Yes, you can connect with an online specialist doctor through secure virtual consultations and receive medical guidance from the comfort of your home.",
      },
      {
        q: "What if I am not sure which specialist I need?",
        a: "If you are uncertain, you can choose the specialty closest to your health concern, and healthcare professionals can guide you toward the most appropriate specialist.",
      },
      {
        q: "Do I need a referral to consult an online specialist doctor?",
        a: "Depending on the medical specialty and healthcare requirements, a referral may or may not be required before scheduling a virtual consultation.",
      },
    ],
  },
  {
    label: "Consultations & Treatment",
    icon: Globe2,
    items: [
      {
        q: "Can an online specialist doctor provide treatment recommendations?",
        a: "Yes, healthcare professionals can evaluate your symptoms, review your medical history, provide expert advice, and recommend suitable treatment options when appropriate.",
      },
      {
        q: "Can I receive prescriptions during an online specialist consultation?",
        a: "When medically appropriate and permitted by applicable regulations, healthcare professionals may provide prescriptions or treatment recommendations based on your health condition.",
      },
      {
        q: "What should I prepare before my online specialist doctor appointment?",
        a: "Prepare details about your symptoms, medical history, current medications, previous test results, and any questions you would like to discuss during the consultation.",
      },
      {
        q: "Can I get a second opinion from an online specialist doctor?",
        a: "Yes, virtual specialist consultations allow you to receive additional medical insights and make informed decisions regarding your diagnosis or treatment plan.",
      },
      {
        q: "Can I discuss multiple health concerns during one consultation?",
        a: "Yes, you can discuss multiple symptoms and medical concerns, allowing the specialist to understand your overall health and provide personalized recommendations.",
      },
      {
        q: "Can an online specialist doctor recommend tests or in-person care?",
        a: "Yes, if additional diagnostic tests, examinations, or in-person treatment are required, specialists can guide you on the appropriate next steps.",
      },
    ],
  },
  {
    label: "Privacy, Support & Benefits",
    icon: CheckCircle2,
    items: [
      {
        q: "Are online specialist doctor consultations private and secure?",
        a: "Yes, Humancare Connect prioritizes patient privacy and uses secure technology to protect your personal health information and maintain confidentiality.",
      },
      {
        q: "Are online specialist doctors suitable for long-term health concerns?",
        a: "Yes, specialists can provide ongoing support, follow-up care, and medical guidance for chronic conditions and long-term health management.",
      },
      {
        q: "Can an online specialist doctor help with preventive healthcare?",
        a: "Yes, specialists can provide preventive health advice, wellness recommendations, health monitoring, and early medical guidance based on your healthcare needs.",
      },
      {
        q: "How quickly can I connect with an online specialist doctor?",
        a: "Humancare Connect makes it simple to connect with trusted online specialist doctors through convenient and secure virtual consultations.",
      },
      {
        q: "What are the benefits of consulting an online specialist doctor?",
        a: "Benefits include easy access to expert medical care, personalized treatment guidance, flexible appointments, second opinions, and convenient healthcare from home.",
      },
      {
        q: "Are my medical records protected during online consultations?",
        a: "Yes, Humancare Connect follows secure practices to protect patient information and maintain confidentiality during all virtual healthcare interactions.",
      },
      {
        q: "Why choose Humancare Connect for an online specialist doctor consultation?",
        a: "Humancare Connect provides secure online specialist doctor consultations, access to experienced healthcare professionals, personalized medical support, and convenient virtual healthcare designed around your needs.",
      },
    ],
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqGroups.flatMap((group) =>
    group.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    }))
  ),
};

// ── HeroCarousel ─────────────────────────────────────────────────────────────
function HeroCarousel() {
  const [slideIndex, setSlideIndex] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState("next");
  const [isPaused, setIsPaused] = useState(false);

  const total = carouselSlides.length;
  const slide = carouselSlides[slideIndex];

  const slideIndexRef = useRef(slideIndex);
  const animatingRef = useRef(false);

  useEffect(() => {
    slideIndexRef.current = slideIndex;
  }, [slideIndex]);

  const goTo = useCallback((next, dir) => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setSlideIndex(next);
      setActiveTab(0);
      setAnimating(false);
      animatingRef.current = false;
    }, 320);
  }, []);

  const goToOffset = useCallback(
    (offset, dir) => {
      const current = slideIndexRef.current;
      goTo((current + offset + total) % total, dir);
    },
    [goTo, total]
  );

  const prev = () => goToOffset(-1, "prev");
  const next = () => goToOffset(1, "next");

  const handleDotClick = (i) => {
    if (i === slideIndex) return;
    goTo(i, i > slideIndex ? "next" : "prev");
  };

  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        goToOffset(1, "next");
      }
    }, 5000);
    return () => clearInterval(id);
  }, [isPaused, goToOffset]);

  const SlideIcon = slide.icon;
  const activeTabData = slide.tabs[activeTab];
  const ActiveTabIcon = activeTabData.icon;

  return (
    <div className="sp-hero__panel">
      <div
        className="sp-hero__card"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
      >
        <div
          className={`sp-hero__card-dark sp-carousel__slide ${
            animating
              ? `sp-carousel__slide--exit-${direction}`
              : "sp-carousel__slide--enter"
          }`}
        >
          <div className="sp-hero__card-top">
            <div>
              <p className="sp-hero__card-sub">{slide.cardSub}</p>
              <p className="sp-hero__card-title">{slide.cardTitle}</p>
            </div>
            <div className="sp-hero__card-icon">
              <SlideIcon size={18} />
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

        <div className="sp-hero__mini-grid">
          {slide.tabs.map(({ name, icon: Icon, tags }, i) => (
            <button
              key={name}
              type="button"
              className={`sp-hero__mini-card sp-hero__mini-card--btn${
                activeTab === i ? " sp-hero__mini-card--active" : ""
              }`}
              onClick={() => setActiveTab(i)}
              aria-pressed={activeTab === i}
            >
              <Icon
                size={20}
                style={{
                  color: activeTab === i ? "var(--white)" : "var(--teal)",
                }}
              />
              <div className="sp-hero__mini-name">{name}</div>
              <div className="sp-hero__mini-tags">{tags.join(" · ")}</div>
            </button>
          ))}
        </div>

        <div
          className="sp-hero__tab-preview"
          key={`${slideIndex}-${activeTab}`}
        >
          <ActiveTabIcon
            size={16}
            style={{ color: "var(--teal)", flexShrink: 0 }}
          />
          <span className="sp-hero__tab-preview-name">
            {activeTabData.name}
          </span>
          <div className="sp-hero__tab-preview-tags">
            {activeTabData.tags.map((t) => (
              <span key={t} className="sp-hero__tab-preview-tag">
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="sp-carousel__controls">
          <button
            type="button"
            className="sp-carousel__btn"
            onClick={prev}
            aria-label="Previous slide"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="sp-carousel__dots" role="tablist" aria-label="Carousel slides">
            {carouselSlides.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={slideIndex === i}
                className={`sp-carousel__dot${
                  slideIndex === i ? " sp-carousel__dot--active" : ""
                }`}
                onClick={() => handleDotClick(i)}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>

          <button
            type="button"
            className="sp-carousel__btn"
            onClick={next}
            aria-label="Next slide"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── FAQ Accordion item ────────────────────────────────────────────────────────
function FaqItem({ q, a, isOpen, onToggle }) {
  return (
    <div className={`sp-faq__item${isOpen ? " sp-faq__item--open" : ""}`}>
      <button
        type="button"
        className="sp-faq__item-head"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="sp-faq__item-q">{q}</span>
        <span className="sp-faq__item-icon">
          {isOpen ? <Minus size={13} /> : <Plus size={13} />}
        </span>
      </button>
      {isOpen && <p className="sp-faq__item-a">{a}</p>}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function Specialties() {
  const [query, setQuery] = useState("");
  const [openFaq, setOpenFaq] = useState("0-0");

  const filteredSpecialties = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return specialties;
    return specialties.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [query]);

  return (
    <>
      <Helmet>
        <title>
          Online Specialist Doctor Consultation | Expert Virtual Care | Humancare Connect
        </title>
        <meta
          name="description"
          content="Connect with an online specialist doctor at Humancare Connect. Get expert medical advice, personalized treatment support, second opinions, and secure virtual specialist consultations from home."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="canonical"
          href="https://www.humancareconnect.com/specialists"
        />
        <meta property="og:type" content="website" />
        <meta
          property="og:title"
          content="Online Specialist Doctor Consultation | Expert Virtual Care | Humancare Connect"
        />
        <meta
          property="og:description"
          content="Connect with an online specialist doctor at Humancare Connect. Get expert medical advice, personalized treatment support, second opinions, and secure virtual specialist consultations from home."
        />
        <meta
          property="og:url"
          content="https://www.humancareconnect.com/specialists"
        />
        <meta property="og:site_name" content="Humancare Connect" />
        <meta
          property="og:image"
          content="https://www.humancareconnect.com/og/specialists.jpg"
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="Online Specialist Doctor Consultation | Expert Virtual Care | Humancare Connect"
        />
        <meta
          name="twitter:description"
          content="Connect with an online specialist doctor at Humancare Connect. Get expert medical advice, personalized treatment support, second opinions, and secure virtual specialist consultations from home."
        />
        <script type="application/ld+json">
          {JSON.stringify(faqJsonLd)}
        </script>
      </Helmet>

      {/* ── Hero ── */}
      <section id="top" className="sp-hero">
        <div className="sp-hero__inner">
          <div>
            <div className="sp-hero__badge">
              <Globe2 size={14} />
              Discover Care Categories
            </div>

            <h1 className="sp-hero__title">
              Online Specialist Doctor Services for Your Unique Health Needs
            </h1>

            <p className="sp-hero__copy">
              Connect with an online specialist doctor through Humancare Connect
              and receive expert medical guidance, personalized treatment
              support, and secure virtual consultations designed around your
              specific health concerns. Our platform makes it easier to access
              experienced specialists from the comfort of your home.
            </p>

            <div className="sp-hero__stats">
              {stats.map(([num, label]) => (
                <div key={label} className="sp-hero__stat">
                  <div className="sp-hero__stat-num">{num}</div>
                  <div className="sp-hero__stat-label">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <HeroCarousel />
        </div>
      </section>

      {/* ── Specialties grid ── */}
      <section id="specialties" className="specialties">
        <div className="specialties__container">
          <div className="specialties__title-block">
            <div className="specialties__title-text">
              <span className="specialties__eyebrow">All specialties</span>
              <h2 className="specialties__heading">
                Every Specialty, One Trusted Platform
              </h2>
            </div>

            <div className="specialties__search">
              <p className="specialties__copy">
                Browse all {specialties.length} specialties below, or search to
                quickly find the right doctor for your specific health concern.
              </p>
              <Search size={16} className="specialties__search-icon" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search specialties…"
                aria-label="Search specialties"
              />
            </div>
          </div>

          <div className="specialties__grid">
            {filteredSpecialties.length === 0 && (
              <div className="specialties__empty">
                No specialties match "{query}".
              </div>
            )}

            {filteredSpecialties.map((s, i) => {
              const Icon = s.icon;
              return (
                <Link
                  key={s.name}
                  to={s.path}
                  className="specialties__card"
                  style={{ "--delay": `${(i % 10) * 30}ms` }}
                >
                  {/* Row 1: Icon + Title */}
                  <div className="specialties__card-head">
                    <div className="specialties__card-icon">
                      <Icon size={18} />
                    </div>
                    <h3 className="specialties__card-name">{s.name}</h3>
                  </div>

                  {/* Row 2: Description */}
                  <p className="specialties__card-desc">{s.description}</p>

                  {/* Row 3: Conditions count */}
                  <div className="specialties__card-conditions">
                    <span className="specialties__card-conditions-dot" />
                    {s.tags.length} condition{s.tags.length !== 1 ? "s" : ""}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Browse by condition ── */}
      <section id="conditions" className="sp-conditions">
        <div className="sp-conditions__inner">
          <div className="sp-conditions__head">
            <span className="sp-conditions__eyebrow">Browse by condition</span>
            <h2 className="sp-conditions__title">
              Find care for your condition
            </h2>
            <p className="sp-conditions__copy">
              Search by condition and get matched to the right specialist for
              your concern.
            </p>
          </div>

          <div className="sp-conditions__grid">
            {conditions.map((c, i) => {
              const Icon = c.icon;
              return (
                <a
                  key={c.name}
                  href="#book"
                  className="sp-conditions__card"
                  style={{ "--delay": `${i * 40}ms` }}
                >
                  <span className="sp-conditions__card-icon">
                    <Icon size={17} />
                  </span>
                  <span className="sp-conditions__card-name">{c.name}</span>
                  <ChevronRight
                    size={16}
                    className="sp-conditions__card-arrow"
                  />
                </a>
              );
            })}
          </div>

          <a href="/conditions" className="sp-conditions__more">
            Know more Conditions <ArrowRight size={15} />
          </a>
        </div>
      </section>

      {/* ── B2B ── */}
      <section id="businesses" className="sp-b2b">
        <div className="sp-b2b__inner">
          <div>
            <span className="sp-b2b__eyebrow">ONLINE SPECIALIST CARE</span>
            <h2 className="sp-b2b__heading">
              Expert Care from an Online Specialist Doctor
            </h2>
            <p className="sp-b2b__copy">
              Humancare Connect provides convenient access to an online
              specialist doctor who understands your unique healthcare needs.
              Whether you need expert advice for a specific condition, ongoing
              care, or a second opinion, our virtual specialist consultations
              connect you with trusted healthcare professionals.
            </p>
          </div>

          <div className="sp-b2b__grid">
            {audiences.map((item, i) => (
              <div
                key={item.title}
                className="sp-b2b__card"
                style={{ "--delay": `${i * 50}ms` }}
              >
                <div className="sp-b2b__card-name">{item.title}</div>
                <p className="sp-b2b__card-desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="sp-faq">
        <div className="sp-faq__inner">
          <div className="sp-faq__left">
            <span className="sp-faq__tag">FAQ</span>
            <h2 className="sp-faq__heading">Frequently Asked Questions</h2>
            <p className="sp-faq__copy">
              Everything you need to know about primary care at Humancare
              Connect. Can't find an answer?
            </p>
            {/* <button type="button" className="sp-faq__chat-btn">
              <MessageCircle size={16} /> Chat with our team
            </button> */}

            <div className="sp-faq__trust">
              <div className="sp-faq__trust-item">
                <Clock size={14} /> Avg. response in 2 min
              </div>
              <div className="sp-faq__trust-item">
                <Lock size={14} /> HIPAA secure &amp; private
              </div>
              <div className="sp-faq__trust-item">
                <MapPin size={14} /> Available in all 50 states
              </div>
            </div>
          </div>

          <div className="sp-faq__right">
            {faqGroups.map((group, gi) => (
              <div className="sp-faq__group" key={group.label}>
                <span className="sp-faq__group-label">
                  <span className="sp-faq__group-dot" />
                  {group.label}
                </span>
                <div className="sp-faq__card">
                  {group.items.map((item, ii) => {
                    const id = `${gi}-${ii}`;
                    return (
                      <FaqItem
                        key={id}
                        q={item.q}
                        a={item.a}
                        isOpen={openFaq === id}
                        onToggle={() =>
                          setOpenFaq(openFaq === id ? null : id)
                        }
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section id="cta" className="sp-cta">
        <div className="sp-cta__card">
          <span className="sp-cta__eyebrow">
            <span className="sp-cta__eyebrow-dot" /> Ready when you are
          </span>
          <h2 className="sp-cta__title">
            Find your specialist
            <br />
            <em>in under 2 minutes.</em>
          </h2>
          <p className="sp-cta__copy">
            Search, book, and consult with a verified physician from anywhere —
            serve any eligibility across all categories.
          </p>
          <div className="sp-cta__actions">
            <a
              href="/appointment-booking"
              className="sp-cta__btn sp-cta__btn--primary"
            >
              Book a consultation <ArrowRight size={15} />
            </a>
            <a href="/conditions" className="sp-cta__btn sp-cta__btn--secondary">
              Browse Conditions
            </a>
          </div>
        </div>
      </section>
    </>
  );
}