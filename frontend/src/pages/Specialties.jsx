import React, { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import {
  Globe2,
  ArrowRight,
  Plane,
  Stethoscope,
  Brain,
  Activity,
  ClipboardPlus,
  HeartPulse,
  Venus,
  Mars,
  Baby,
  ShieldCheck,
  Pill,
  Users,
  CheckCircle2,
  ChevronRight,
  Search,
  MessageCircle,
  Clock,
  Lock,
  MapPin,
  Plus,
  Minus,
  Soup,
  Sparkles,
  HeartHandshake,
  Wind,
  Eye,
  Ear,
  Bone,
  Baby as BabyIcon,
  Scale,
  FileSearch,
  Heart,
} from "lucide-react";
import "./Specialties.css";
import SEO from "../components/Seo";
import ServiceSwitcher from "../components/ServiceSwitcher";
import FAQ from "../components/FAQ/FAQ";

const conditionIcons = {
  bone: Bone,
  check: ShieldCheck,
  heart: Heart,
  activity: Activity,
  brain: Brain,
  stethoscope: Stethoscope,
  pill: Pill,
};
// ── Hero ServiceSwitcher data ────────────────────────────────────────────────
// Each entry pairs a "virtual care request" scenario with the specialty it
// routes to — drives the ServiceSwitcher featured card, grid, and bottom bar.
const HERO_SERVICES = [
  {
    id: "pediatrics",
    icon: Stethoscope,
    category: "Pediatrics",
    title: "Pediatrics",
    eyebrow: "Pediatric consultation",
    subtitle: "Fever • Infections • Growth Concerns",
    condition: "Fever, Infections, Growth Concerns",
    need: "Child health evaluation + treatment plan",
    route: "Board-certified pediatrician",
    status: "Same-day or routine appointment",
    tags: ["Fever", "Infections"],
    path: "/child-and-family-care/pediatrics",
  },
  {
    id: "family-medicine",
    icon: Stethoscope,
    category: "Family Medicine",
    title: "Family Medicine",
    eyebrow: "Family medicine consultation",
    subtitle: "Common Illnesses • Chronic Care • Preventive Health",
    condition: "Common Illnesses, Chronic Care, Preventive Health",
    need: "Comprehensive evaluation + ongoing care plan",
    route: "Board-certified family physician",
    status: "Same-day or routine appointment",
    tags: ["Common Illnesses", "Chronic Care"],
    path: "/general-and-everyday-care/family-medicine",
  },
  {
    id: "urology",
    icon: Stethoscope,
    category: "Urology",
    title: "Urology",
    eyebrow: "Urology consultation",
    subtitle: "UTIs • Kidney Stones • Prostate Concerns",
    condition: "UTIs, Kidney Stones, Prostate Concerns",
    need: "Urologic evaluation + personalized treatment",
    route: "Board-certified urologist",
    status: "Same-day or routine appointment",
    tags: ["UTIs", "Kidney Stones"],
    path: "/mens-health/urology",
  },
  {
    id: "travel-medicine",
    icon: Stethoscope,
    category: "Travel Medicine",
    title: "Travel Medicine",
    eyebrow: "Travel medicine consultation",
    subtitle: "Travel Vaccinations • Jet Lag • Travel Illness",
    condition: "Travel Vaccinations, Jet Lag, Travel Illness",
    need: "Pre-travel assessment + health guidance",
    route: "Travel medicine specialist",
    status: "Pre-travel or same-day appointment",
    tags: ["Travel Vaccinations", "Travel Illness"],
    path: "/travel-and-global-care/travel-medicine",
  },
];

// ── Full specialties list (30) ───────────────────────────────────────────────
const specialties = [
  {
    name: "General Physician (GP)",
    icon: Stethoscope,
    description:
      "Everyday care, preventive guidance, medication support, and follow-up consultations.",
    tags: ["Cold & Flu", "Fever", "Fatigue", "Headache"],
    link: "/general-and-everyday-care/general-physician",
  },
  {
    name: "Internal Medicine",
    icon: ClipboardPlus,
    description:
      "Diagnosis and management of complex or overlapping adult health conditions.",
    tags: ["Diagnosis", "Lab Review", "Check-ups"],
    link: "/general-and-everyday-care/internal-medicine",
  },
  {
    name: "Family Medicine",
    icon: HeartHandshake,
    description:
      "Continuing care for every age and stage, from infants to grandparents.",
    tags: ["All Ages", "Preventive", "Check-ups"],
    link: "/general-and-everyday-care/family-medicine",
  },
  {
    name: "Psychiatry",
    icon: Brain,
    description:
      "Clinical assessment and medication management for mental health conditions.",
    tags: ["Anxiety", "Depression", "Medication"],
    link: "/mental-health/psychiatry",
  },
  {
    name: "Psychology / Counselling",
    icon: MessageCircle,
    description:
      "Talk therapy and coping strategies for stress, mood, and life transitions.",
    tags: ["Therapy", "Stress", "Coping Skills"],
    link: "/mental-health/psychology-counseling",
  },
  {
    name: "Behavioral Health",
    icon: Activity,
    description:
      "Support for habits, routines, and behavior patterns affecting wellbeing.",
    tags: ["Habits", "Burnout", "Routine"],
    link: "/mental-health/behavioral-health",
  },
  {
    name: "Dermatology",
    icon: HeartPulse,
    description:
      "Skin, hair, and nail concerns reviewed and treated by a specialist.",
    tags: ["Acne", "Rash", "Hair Loss"],
    link: "/skin-and-hair-care/dermatology",
  },
  {
    name: "Obstetrics & Gynaecology (OB-GYN)",
    icon: Venus,
    description:
      "Reproductive health, pregnancy guidance, and gynaecological care.",
    tags: ["Pregnancy", "Cycle Health", "PCOS"],
    link: "/women-health/obstetrics-and-gynaecology",
  },
  {
    name: "Menopause Care",
    icon: Venus,
    description:
      "Hormonal symptom management and guidance through perimenopause and beyond.",
    tags: ["Hot Flashes", "Hormones", "Sleep"],
    link: "/women-health/menopause-care",
  },
  {
    name: "Women's Mental Health",
    icon: Brain,
    description:
      "Mental health support tailored to hormonal and life-stage changes.",
    tags: ["Postpartum", "Mood", "Anxiety"],
    link: "/women-health/women-mental-health",
  },
  {
    name: "Lactation Consulting",
    icon: BabyIcon,
    description:
      "Breastfeeding guidance and support for new and expecting parents.",
    tags: ["Breastfeeding", "Latching", "Newborn"],
    link: "/women-health/lactation-consulting",
  },
  {
    name: "Men's Health",
    icon: Mars,
    description:
      "Preventive and condition-specific care focused on men's wellbeing.",
    tags: ["Hormones", "Fitness", "Screening"],
    link: "/mens-health/men-health",
  },
  {
    name: "Urology",
    icon: Activity,
    description:
      "Diagnosis and treatment of urinary tract and reproductive system issues.",
    tags: ["UTI", "Kidney Stones", "Prostate"],
    link: "/mens-health/urology",
  },
  {
    name: "Pediatrics",
    icon: Baby,
    description:
      "Growth, development, and illness care for infants, children, and teens.",
    tags: ["Growth", "Vaccines", "Fever"],
    link: "/child-and-family-care/pediatrics",
  },
  {
    name: "Adolescent Medicine",
    icon: Users,
    description:
      "Health guidance focused on the unique needs of teenage patients.",
    tags: ["Teen Health", "Puberty", "Mental Health"],
    link: "/child-and-family-care/adolescent-medicine",
  },
  {
    name: "Weight Management",
    icon: Scale,
    description:
      "Personalized plans and medical guidance for sustainable weight goals.",
    tags: ["Nutrition", "Metabolism", "Coaching"],
    link: "/weight-and-nurtrition/weight-management",
  },
  {
    name: "Nutrition & Dietetics",
    icon: Soup,
    description:
      "Dietary guidance from licensed professionals for health and recovery goals.",
    tags: ["Meal Plans", "Allergies", "Wellness"],
    link: "/weight-and-nurtrition/nutrition-and-dietetics",
  },
  {
    name: "Lifestyle Medicine",
    icon: Sparkles,
    description:
      "Evidence-based habit changes to prevent and manage chronic disease.",
    tags: ["Sleep", "Stress", "Exercise"],
    link: "/weight-and-nurtrition/lifestyle-medicine",
  },
  {
    name: "Cardiology",
    icon: HeartPulse,
    description:
      "Heart health evaluation, monitoring, and chronic condition management.",
    tags: ["Hypertension", "Cholesterol", "Heart Rate"],
    link: "/chronic-care/cardiology",
  },
  {
    name: "Endocrinology",
    icon: Activity,
    description:
      "Hormone-related conditions including thyroid and metabolic disorders.",
    tags: ["Diabetes", "Thyroid", "Hormones"],
    link: "/chronic-care/endocrinology",
  },
  {
    name: "Gastroenterology",
    icon: Soup,
    description:
      "Digestive system care, from everyday symptoms to chronic GI conditions.",
    tags: ["IBS", "Acid Reflux", "Bloating"],
    link: "/chronic-care/gastroenterology",
  },
  {
    name: "Neurology",
    icon: Brain,
    description:
      "Evaluation and care for conditions affecting the brain and nervous system.",
    tags: ["Migraine", "Dizziness", "Numbness"],
    link: "/chronic-care/neurology",
  },
  {
    name: "Pulmonology",
    icon: Wind,
    description:
      "Respiratory and lung condition diagnosis, treatment, and monitoring.",
    tags: ["Asthma", "Cough", "Breathing"],
    link: "/chronic-care/pulmonology",
  },
  {
    name: "Expert Medical Opinion",
    icon: FileSearch,
    description:
      "A second specialist review of your diagnosis, records, or treatment plan.",
    tags: ["Second Opinion", "Records Review"],
    link: "/export-medical-opinion",
  },
  {
    name: "Ophthalmology",
    icon: Eye,
    description:
      "Eye health consultations covering vision changes and common conditions.",
    tags: ["Vision", "Eye Strain", "Irritation"],
    link: "/eye-ear-bone/ophthalmology",
  },
  {
    name: "ENT (Ear, Nose & Throat)",
    icon: Ear,
    description:
      "Care for ear, nose, sinus, and throat symptoms and conditions.",
    tags: ["Sinusitis", "Sore Throat", "Hearing"],
    link: "/eye-ear-bone/ear-nose-throat",
  },
  {
    name: "Orthopedics",
    icon: Bone,
    description:
      "Bone, joint, and muscle care for pain, injury, and mobility issues.",
    tags: ["Joint Pain", "Sports Injury", "Mobility"],
    link: "/eye-ear-bone/orthopedics",
  },
  {
    name: "Sexual Health",
    icon: ShieldCheck,
    description:
      "Confidential consultations for sexual health concerns and screening.",
    tags: ["STI Screening", "Confidential"],
    link: "/sexual-health/sexual-health-and-wellness",
  },
  {
    name: "Travel Medicine",
    icon: Plane,
    description:
      "Pre-trip vaccinations and care for illness while traveling abroad.",
    tags: ["Vaccinations", "Travel Illness"],
    link: "/travel-and-global-care/travel-medicine",
  },
  {
    name: "Global / Cross-Border Care",
    icon: Globe2,
    description:
      "Coordinated medical access and continuity of care across countries.",
    tags: ["Cross-Border", "Continuity of Care"],
    link: "/travel-and-global-care/global-cross-border-care",
  },
];

// ── Stats (derived from real data so copy can't drift out of sync) ──────────
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

// ── Browse-by-condition list ────────────────────────────────────────────────
// const conditions = [
//   { name: "Arthritis", icon: Bone },
//   { name: "Cancer Second Opinion", icon: ShieldCheck },
//   { name: "Chest Pain", icon: Heart },
//   { name: "Chronic Kidney Disease", icon: Activity },
//   { name: "Chronic Migraine", icon: Brain },
//   { name: "Complex Diagnosis", icon: FileSearch },
//   { name: "Fatty Liver", icon: Soup },
//   { name: "Heart Disease", icon: Heart },
// ];

const CONDITIONS = [
  {
    slug: "arthritis",
    path: "/eye-ear-bone/orthopedics/arthritis",
    icon: "bone",
    name: "Arthritis",
  },
  {
    slug: "cancer-second-opinion",
    path: "/online-second-medical-opinion/cancer-second-opinion",
    icon: "check",
    name: "Cancer Second Opinion",
  },
  {
    slug: "chest-pain",
    path: "/chronic-care/cardiology/chest-pain",
    icon: "heart",
    name: "Chest Pain",
  },
  {
    slug: "chronic-kidney-disease",
    path: "/chronic-kidney-disease",
    icon: "activity",
    name: "Chronic Kidney Disease",
  },
  {
    slug: "chronic-migraine",
    path: "/chronic-care/neurology/chronic-migraine",
    icon: "brain",
    name: "Chronic Migraine",
  },
  {
    slug: "complex-diagnosis",
    path: "/online-second-medical-opinion/complex-diagnosis-review",
    icon: "stethoscope",
    name: "Complex Diagnosis",
  },
  {
    slug: "fatty-liver",
    path: "/chronic-care/gastroenterology/fatty-liver",
    icon: "pill",
    name: "Fatty Liver",
  },
  {
    slug: "heart-disease",
    path: "/chronic-care/cardiology/heart-disease-follow-up",
    icon: "heart",
    name: "Heart Disease",
  },
];

// ── FAQ data ──────────────────────────────────────────────────────────────
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

// JSON-LD FAQPage structured data, built from the same FAQ content above so
// the rich-result markup can never drift out of sync with what's on screen.
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
    })),
  ),
};

// ── FAQ Accordion item ───────────────────────────────────────────────────────
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
        s.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [query]);

  return (
    <>
      <SEO
        title="Online Specialist Doctor Consultation | Expert Virtual Care | Humancare Connect"
        description="Connect with an online specialist doctor at Humancare Connect. Get expert medical advice, personalized treatment support, second opinions, and secure virtual specialist consultations from home."
        keywords="online specialist doctor, specialist doctor consultation, virtual specialist consultation, online medical specialist, telehealth specialist services, second opinion online, specialist healthcare, chronic disease specialist, expert medical consultation, online healthcare provider, virtual doctor appointment, specialist care online"
        url="https://humancareconnect.co/specialties"
      />
      <Helmet>
        <title>
          Online Specialist Doctor Consultation | Expert Virtual Care |
          Humancare Connect
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

        {/* Open Graph */}
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
        {/* TODO: replace with a real, hosted OG image (1200x630) before launch */}
        <meta
          property="og:image"
          content="https://www.humancareconnect.com/og/specialists.jpg"
        />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="Online Specialist Doctor Consultation | Expert Virtual Care | Humancare Connect"
        />
        <meta
          name="twitter:description"
          content="Connect with an online specialist doctor at Humancare Connect. Get expert medical advice, personalized treatment support, second opinions, and secure virtual specialist consultations from home."
        />

        {/* FAQPage structured data for rich results */}
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>

      {/* hero */}
      <section id="top" className="sp-hero">
        <div className="sp-hero__inner">
          {/* Left column */}
          <div>
            {/* <div className="sp-hero__badge">
              <Globe2 size={14} />
              Discover Care Categories
            </div> */}

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

          {/* Right panel — service switcher */}
          <ServiceSwitcher services={HERO_SERVICES} />
        </div>
      </section>

      {/* Specialties */}
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
                <a
                  key={s.name}
                  href={s.link}
                  className="specialties__card"
                  style={{ "--delay": `${(i % 10) * 30}ms` }}
                >
                  <div className="specialties__card-head">
                    <div className="specialties__card-icon">
                      <Icon size={18} />
                    </div>
                    <span className="specialties__card-num">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="specialties__card-name">{s.name}</h3>
                  <p className="specialties__card-desc">{s.description}</p>
                  <div className="specialties__card-tags">
                    {s.tags.map((t) => (
                      <span key={t} className="specialties__card-tag">
                        {t}
                      </span>
                    ))}
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* Browse by condition */}
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

          {/* <div className="sp-conditions__grid">
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
          </div> */}
          <div className="cat-spec-grid">
            {CONDITIONS.map((sp) => {
              const ConditionIcon = conditionIcons[sp.icon];

              return (
                <Link
                  key={sp.slug}
                  to={sp.path}
                  className={`cat-spec-item${sp.featured ? " cat-spec-item--featured" : ""}`}
                >
                  <div className="cat-spec-item__icon">
                    {ConditionIcon && <ConditionIcon size={18} />}
                  </div>

                  <div className="cat-spec-item__text">
                    <div className="cat-spec-item__row">
                      <span className="cat-spec-item__name">{sp.name}</span>
                    </div>
                  </div>

                  <span className="cat-spec-item__chevron">
                    <ChevronRight size={14} />
                  </span>
                </Link>
              );
            })}
          </div>

          <a href="/conditions" className="sp-conditions__more">
            Know more Conditions <ArrowRight size={15} />
          </a>
        </div>
      </section>

      {/* B2B */}
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

      {/* FAQ */}
      <FAQ
        badge="FAQ"
        title="Frequently Asked Questions"
        description="Everything you need to know about primary care at Humancare Connect. Can't find an answer?"
        sections={faqGroups.map((group) => ({
          title: group.label,
          items: group.items.map((item) => ({
            question: item.q,
            answer: item.a,
          })),
        }))}
      />

      {/* Bottom CTA card */}
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
            <Link
              to="/appointment-booking"
              state={{ tab: "spec" }}
              className="sp-cta__btn sp-cta__btn--primary"
            >
              Book a consultation <ArrowRight size={15} />
            </Link>

          </div>
        </div>
      </section>
    </>
  );
}
