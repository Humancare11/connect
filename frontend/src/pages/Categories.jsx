import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import "./Categories.css";

/* ── react-icons ─────────────────────────────────────────── */
import {
  FiHeart,
  FiSmile,
  FiWind,
  FiEye,
  FiActivity,
  FiArrowRight,
  FiChevronRight,
  FiChevronLeft,
  FiSearch,
  FiCheckCircle,
  FiUsers,
  FiShield,
  FiClock,
  FiStar,
  FiVideo,
  FiZap,
  FiGlobe,
  FiAlertTriangle,
  FiThermometer,
  FiPlus,
  FiMinus,
  FiMessageCircle,
} from "react-icons/fi";
import {
  TbStethoscope,
  TbBone,
  TbPill,
  TbDna2,
  TbWoman,
  TbBrain,
  TbUrgent,
  TbBuilding,
} from "react-icons/tb";
import { MdChildCare, MdOutlineLocalHospital } from "react-icons/md";
import { RiMentalHealthLine } from "react-icons/ri";
import SEO from "../components/Seo";

/* ─────────────────────────────────────────────────────────────
   ICON MAP
───────────────────────────────────────────────────────────── */
const ICONS = {
  heart: FiHeart,
  brain: TbBrain,
  smile: FiSmile,
  child: MdChildCare,
  bone: TbBone,
  wind: FiWind,
  women: TbWoman,
  dna: TbDna2,
  stethoscope: TbStethoscope,
  eye: FiEye,
  activity: FiActivity,
  skin: FiActivity,
  arrowRight: FiArrowRight,
  chevronRight: FiChevronRight,
  chevronLeft: FiChevronLeft,
  search: FiSearch,
  check: FiCheckCircle,
  users: FiUsers,
  shield: FiShield,
  clock: FiClock,
  star: FiStar,
  video: FiVideo,
  zap: FiZap,
  pill: TbPill,
  globe: FiGlobe,
  urgent: TbUrgent,
  hospital: MdOutlineLocalHospital,
  mental: RiMentalHealthLine,
  chronic: FiActivity,
  alertTri: FiAlertTriangle,
  building: TbBuilding,
  thermometer: FiThermometer,
  plus: FiPlus,
  minus: FiMinus,
  chat: FiMessageCircle,
};

function Icon({ name, size = 18, style, className }) {
  const Component = ICONS[name];
  if (!Component) return null;
  return (
    <Component
      size={size}
      style={style}
      className={className}
      aria-hidden="true"
    />
  );
}

/* ────────────────────────────────────────────────────────────
   CAROUSEL DATA
───────────────────────────────────────────────────────────── */
const SLIDES = [
  {
    iconName: "globe",
    sub: "Virtual care request",
    title: "Traveler needs consult",
    rows: [
      ["Condition", "Food Poisoning While Traveling"],
      ["Need", "Telehealth consult + medical report"],
      ["Route", "English-speaking doctor"],
      ["Status", "Non-emergency triage"],
    ],
    tabs: [
      {
        icon: "stethoscope",
        name: "Primary Care",
        tags: ["Cold & Flu", "Fever"],
      },
      { icon: "urgent", name: "Urgent Care", tags: ["UTI", "Sore Throat"] },
      { icon: "brain", name: "Mental Health", tags: ["Anxiety", "Depression"] },
      {
        icon: "activity",
        name: "Chronic Care",
        tags: ["Diabetes", "Hypertension"],
      },
    ],
  },
  {
    iconName: "heart",
    sub: "Specialist referral",
    title: "Cardiac screening request",
    rows: [
      ["Condition", "Chest Pain & Shortness of Breath"],
      ["Need", "Cardiology consult + ECG review"],
      ["Route", "Board-certified cardiologist"],
      ["Status", "Priority triage"],
    ],
    tabs: [
      {
        icon: "heart",
        name: "Cardiology",
        tags: ["Arrhythmia", "Hypertension"],
      },
      { icon: "activity", name: "Chronic Care", tags: ["BP", "Diabetes"] },
      {
        icon: "stethoscope",
        name: "Primary Care",
        tags: ["Annual", "Preventive"],
      },
      { icon: "hospital", name: "Urgent Care", tags: ["Chest Pain", "Stroke"] },
    ],
  },
  {
    iconName: "mental",
    sub: "Wellness consultation",
    title: "Mental health support",
    rows: [
      ["Condition", "Anxiety & Burnout Syndrome"],
      ["Need", "Therapy session + follow-up plan"],
      ["Route", "Licensed therapist / psychiatrist"],
      ["Status", "Routine appointment"],
    ],
    tabs: [
      { icon: "mental", name: "Mental Health", tags: ["Anxiety", "PTSD"] },
      { icon: "brain", name: "Neurology", tags: ["Migraines", "Memory"] },
      { icon: "smile", name: "Wellness", tags: ["Stress", "Sleep"] },
      {
        icon: "stethoscope",
        name: "Primary Care",
        tags: ["Check-up", "Referral"],
      },
    ],
  },
];

/* ─────────────────────────────────────────────────────────────
   HERO CAROUSEL
───────────────────────────────────────────────────────────── */
function HeroCarousel() {
  const [idx, setIdx] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [animCls, setAnimCls] = useState("cat-carousel--enter-next");
  const animating = useRef(false);
  const timerRef = useRef(null);

  const goTo = useCallback(
    (next, dir) => {
      if (animating.current || next === idx) return;
      animating.current = true;
      setAnimCls(
        dir === "next" ? "cat-carousel--exit-next" : "cat-carousel--exit-prev",
      );
      setTimeout(() => {
        setIdx(next);
        setActiveTab(0);
        setAnimCls(
          dir === "next"
            ? "cat-carousel--enter-next"
            : "cat-carousel--enter-prev",
        );
        animating.current = false;
      }, 300);
    },
    [idx],
  );

  const startAuto = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setIdx((prev) => {
        const next = (prev + 1) % SLIDES.length;
        setAnimCls("cat-carousel--enter-next");
        setActiveTab(0);
        animating.current = false;
        return next;
      });
    }, 4500);
  }, []);

  useEffect(() => {
    startAuto();
    return () => clearInterval(timerRef.current);
  }, [startAuto]);

  const handlePrev = () => {
    clearInterval(timerRef.current);
    goTo((idx - 1 + SLIDES.length) % SLIDES.length, "prev");
    startAuto();
  };
  const handleNext = () => {
    clearInterval(timerRef.current);
    goTo((idx + 1) % SLIDES.length, "next");
    startAuto();
  };

  const slide = SLIDES[idx];
  const currentTab = slide.tabs[activeTab];

  return (
    <div className="cat-hero__panel">
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
            <span className="cat-carousel__tab-tags">
              {tab.tags.join(" · ")}
            </span>
          </button>
        ))}
      </div>

      <div className="cat-carousel__preview" key={`${idx}-${activeTab}`}>
        <span className="cat-carousel__preview-icon">
          <Icon name={currentTab.icon} size={16} />
        </span>
        <span className="cat-carousel__preview-name">{currentTab.name}</span>
        <div className="cat-carousel__preview-tags">
          {currentTab.tags.map((tag) => (
            <span key={tag} className="cat-carousel__preview-tag">
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="cat-carousel__controls">
        <button
          className="cat-carousel__btn"
          onClick={handlePrev}
          aria-label="Previous"
        >
          <Icon name="chevronLeft" size={14} />
        </button>
        <div className="cat-carousel__dots">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              className={`cat-carousel__dot${i === idx ? " cat-carousel__dot--active" : ""}`}
              onClick={() => {
                clearInterval(timerRef.current);
                goTo(i, i > idx ? "next" : "prev");
                startAuto();
              }}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
        <button
          className="cat-carousel__btn"
          onClick={handleNext}
          aria-label="Next"
        >
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
  {
    path: "/child-and-family-care",
    icon: "child",
    name: "Children & Family Care ",
    tagline:
      "Expert medical guidance, pediatric support, preventive care and treatment for everyday health concerns, when you need it. Compassionate online healthcare for children & families.",
    specialtyCount: 2,
    conditionsCount: 8,
    color: "#059669",
    bgTint: "rgba(5,150,105,0.07)",
    keywords: ["pediatrics", "child", "kids", "family"],
  },

  {
    path: "/chronic-care",
    icon: "activity",
    name: "Chronic Care & Expert Opinion",
    tagline:
      "Ongoing support for chronic health conditions with personalized treatment guidance, regular follow-ups, and expert medical opinions to help you make informed healthcare decisions.",
    specialtyCount: 6,
    conditionsCount: 34,
    color: "#0B57E8",
    bgTint: "rgba(11,87,232,0.07)",
    keywords: [
      "cardiology",
      "diabetes",
      "hypertension",
      "kidney",
      "arthritis",
      "cancer",
      "second opinion",
    ],
  },

  {
    path: "/eye-ear-bone",
    icon: "eye",
    name: "Eye, Ear & Bone",
    tagline:
      "Comprehensive care for vision concerns, hearing issues, ear conditions, joint pain, bone health, and musculoskeletal problems with expert medical guidance and support.",
    specialtyCount: 3,
    conditionsCount: 19,
    color: "#0EA5E9",
    bgTint: "rgba(14,165,233,0.07)",
    keywords: [
      "ophthalmology",
      "vision",
      "hearing",
      "orthopedics",
      "arthritis",
    ],
  },

  {
    path: "/general-and-everyday-care",
    icon: "stethoscope",
    name: "General & Everyday Care",
    tagline:
      "Convenient access to healthcare professionals for common illnesses, preventive care, routine health concerns, follow-up support, and personalized medical guidance whenever you need it.",
    specialtyCount: 3,
    conditionsCount: 17,
    color: "#4C5F87",
    bgTint: "rgba(76,95,135,0.07)",
    keywords: [
      "general physician",
      "gp",
      "internal medicine",
      "cold",
      "flu",
      "fever",
    ],
  },

  {
    path: "/men-health",
    icon: "activity",
    name: "Men's Health",
    tagline:
      "Confidential healthcare for men, including sexual wellness, hormonal health, hair loss, urinary concerns, preventive care, and personalized support for long-term well-being.",
    specialtyCount: 2,
    conditionsCount: 10,
    color: "#D97706",
    bgTint: "rgba(217,119,6,0.07)",
    keywords: ["urology", "testosterone", "erectile dysfunction", "prostate"],
  },

  {
    path: "/mental-health",
    icon: "mental",
    name: "Mental Health",
    tagline:
      "Compassionate support for anxiety, depression, stress, burnout, emotional challenges, sleep concerns, and overall mental well-being through confidential consultations.",
    specialtyCount: 3,
    conditionsCount: 17,
    color: "#7C3AED",
    bgTint: "rgba(124,58,237,0.07)",
    keywords: ["psychiatry", "therapy", "anxiety", "depression", "ptsd"],
  },

  {
    path: "/categories-sexual-health",
    icon: "heart",
    name: "Sexual Health",
    tagline:
      "Confidential sexual healthcare for STI concerns, sexual wellness, contraception guidance, intimate health issues, and personalized support in a secure, judgment-free environment.",
    specialtyCount: 1,
    conditionsCount: 7,
    color: "#DB2777",
    bgTint: "rgba(219,39,119,0.07)",
    keywords: ["sti", "std", "contraception"],
  },

  {
    path: "/skin-and-hair-care",
    icon: "skin",
    name: "Skin & Hair Care",
    tagline:
      "Expert support for acne, eczema, rashes, hair loss, scalp conditions, skin allergies, and healthy skin and hair care through personalized treatment guidance.",
    specialtyCount: 1,
    conditionsCount: 12,
    color: "#C026D3",
    bgTint: "rgba(192,38,211,0.07)",
    keywords: [
      "dermatology",
      "acne",
      "eczema",
      "psoriasis",
      "rash",
      "hair loss",
    ],
  },

  {
    path: "/travel-and-global-care",
    icon: "globe",
    name: "Travel & Global Care",
    tagline:
      "Expert healthcare support for international travelers, expatriates, medical tourists, cross-border healthcare needs, travel-related concerns, medication guidance, and ongoing care anywhere in the world.",
    specialtyCount: 2,
    conditionsCount: 11,
    color: "#0891B2",
    bgTint: "rgba(8,145,178,0.07)",
    keywords: ["expat", "vaccination", "abroad"],
  },

  {
    path: "/weight-and-nurtrition",
    icon: "pill",
    name: "Weight & Nutrition",
    tagline:
      "Personalized nutrition support for weight management, healthy eating habits, nutritional deficiencies, digestive wellness, chronic disease management, meal planning, and long-term health goals.",
    specialtyCount: 3,
    conditionsCount: 12,
    color: "#65A30D",
    bgTint: "rgba(101,163,13,0.07)",
    keywords: ["diet", "obesity", "fatty liver", "digestion"],
  },

  {
    path: "/women-health",
    icon: "women",
    name: "Women's Health",
    tagline:
      "Personalized care for menstrual health, hormonal concerns, fertility support, pregnancy guidance, menopause management, reproductive wellness, birth control consultations, and preventive women's healthcare.",
    specialtyCount: 4,
    conditionsCount: 19,
    color: "#E8470B",
    bgTint: "rgba(232,71,11,0.07)",
    keywords: ["gynecology", "obgyn", "pregnancy", "menopause", "fertility"],
  },
];

const SPECIALTIES = [
  {
    slug: "general-physician",
    path: "/general-physician",
    icon: "stethoscope",
    name: "General Physician (GP)",
    featured: true,
  },
  {
    slug: "internal-medicine",
    path: "/internal-medicine",
    icon: "activity",
    name: "Internal Medicine",
    featured: false,
  },
  {
    slug: "psychiatry",
    path: "/mental-health/psychiatry",
    icon: "mental",
    name: "Psychiatry",
    featured: false,
  },
  {
    slug: "dermatology",
    path: "/skin-and-hair-care/dermatology",
    icon: "skin",
    name: "Dermatology",
    featured: false,
  },
  {
    slug: "obstetrics-gynaecology-ob-gyn",
    path: "/women-health/obstetrics-and-gynaecology",
    icon: "women",
    name: "Obstetrics & Gynaecology (OB-GYN)",
    featured: false,
  },
  {
    slug: "pediatrics",
    path: "/child-and-family-care/pediatrics",
    icon: "child",
    name: "Pediatrics",
    featured: false,
  },
  {
    slug: "cardiology",
    path: "/chronic-care-and-expert-opinion/cardiology",
    icon: "heart",
    name: "Cardiology",
    featured: false,
  },
  {
    slug: "ophthalmology",
    path: "/eye-ear-bone/ophthalmology",
    icon: "eye",
    name: "Ophthalmology",
    featured: false,
  },
];

const CONDITIONS = [
  {
    slug: "arthritis",
    path: "/eye-ear-bone/orthopedics/arthritis",
    icon: "bone",
    name: "Arthritis",
  },
  {
    slug: "cancer-second-opinion",
    path: "/cancer-second-opinion",
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
    path: "/complex-diagnosis",
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
    path: "/heart-disease",
    icon: "heart",
    name: "Heart Disease",
  },
];

const HERO_STATS = [
  { n: "11", l: "Categories" },
  { n: "30", l: "Specialties" },
  { n: "140+", l: "Conditions" },
];

const CARE_CAT = [
  {
    title: "Personalized Medical Guidance",
    desc: "Receive healthcare support tailored to your symptoms, concerns, and individual wellness goals.",
  },
  {
    title: "Trusted Healthcare Professionals",
    desc: "Connect with experienced medical experts who provide compassionate, evidence-based care.",
  },
  {
    title: "Convenient Online Consultations",
    desc: "Access quality healthcare from the comfort of your home with secure and simple online doctor consultations.",
  },
  {
    title: "Comprehensive Healthcare Support",
    desc: "Find care for everyday concerns, specialized health needs, long-term wellness, and more.",
  },
  {
    title: "Private & Secure Care Experience",
    desc: "Discuss your health confidently through secure consultations that prioritize your privacy and confidentiality.",
  },
  {
    title: "Continuous Care & Wellness Support",
    desc: "Stay connected with ongoing medical guidance that supports your health at every stage of life.",
  },
];

/* ─────────────────────────────────────────────────────────────
   FAQ DATA
───────────────────────────────────────────────────────────── */
const FAQ_GROUPS = [
  {
    label: "Appointments",
    items: [
      {
        q: "What is an online doctor consultation?",
        a: "An online doctor consultation allows patients to connect with qualified healthcare professionals remotely through secure virtual platforms for medical guidance, diagnosis, and treatment recommendations.",
      },
      {
        q: "How do I choose the right online doctor consultation service?",
        a: "You can select a service based on your symptoms, wellness goals, or the type of medical support you need. Healthcare professionals can guide you toward appropriate care.",
      },
      {
        q: "What types of online doctor consultation services are available through Humancare Connect?",
        a: "Humancare Connect offers online doctor consultations for everyday health concerns, mental wellness, chronic health management, family health, preventive care, and specialized medical support.",
      },
    ],
  },
  {
    label: "Virtual Care",
    items: [
      {
        q: "Can I access healthcare services online through online doctor consultation?",
        a: "Yes, Humancare Connect connects patients with experienced healthcare professionals through secure online doctor consultations based on their healthcare needs.",
      },
      {
        q: "What if I am not sure which doctor I need to consult online?",
        a: "You can choose the service closest to your concern, and healthcare professionals can help direct you to the appropriate specialist based on your symptoms.",
      },
      {
        q: "Are online doctor consultations suitable for different age groups?",
        a: "Yes, Humancare Connect offers online healthcare support for children, adults, and individuals at different stages of life.",
      },
      {
        q: "Can I discuss more than one health concern during an online doctor consultation?",
        a: "Yes, you can discuss multiple symptoms and health questions, allowing healthcare professionals to understand your overall health needs.",
      },
      {
        q: "Are online doctor consultations private and secure?",
        a: "Yes, Humancare Connect prioritizes patient privacy and uses secure technology to protect personal health information and maintain confidentiality.",
      },
      {
        q: "Can I receive medical advice for routine and ongoing health concerns?",
        a: "Yes, online doctor consultations can provide guidance for everyday health questions, preventive care needs, and long-term health management.",
      },
      {
        q: "Do I need a referral for an online doctor consultation?",
        a: "No, you can book an online doctor consultation directly without unnecessary steps.",
      },
      {
        q: "Can I receive prescriptions during an online doctor consultation?",
        a: "When medically appropriate and permitted by applicable regulations, healthcare professionals may provide prescriptions or treatment recommendations based on your condition.",
      },
    ],
  },
  {
    label: "Consultation Benefits & Care",
    items: [
      {
        q: "Are online doctor consultations suitable for preventive care?",
        a: "Yes, online doctor consultations include preventive health guidance, wellness support, and lifestyle recommendations.",
      },
      {
        q: "How quickly can I connect with a healthcare professional online?",
        a: "Humancare Connect makes it easier to access trusted healthcare professionals through convenient online doctor consultations.",
      },
      {
        q: "What are the benefits of online doctor consultation?",
        a: "Online doctor consultation offers convenience, quick access to healthcare professionals, personalized medical guidance, and the ability to receive care from the comfort of your home.",
      },
      {
        q: " Can I receive specialized medical support through online doctor consultation?",
        a: "Yes, Humancare Connect provides access to specialists and expert medical guidance through secure online doctor consultation services.",
      },
      {
        q: "Why choose Humancare Connect for online doctor consultation?",
        a: "Humancare Connect offers secure online doctor consultations, experienced healthcare professionals, personalized care, and a patient-centered virtual healthcare experience.",
      },
    ],
  },
];

/* ─────────────────────────────────────────────────────────────
   CARE SECTION
───────────────────────────────────────────────────────────── */
function CareSection() {
  return (
    <section className="cat-b2b">
      <div className="cat-section__wrap">
        <div className="cat-b2b__grid">
          <div className="cat-b2b__left">
            <span className="cat-b2b__eyebrow">CARE MADE SIMPLE</span>
            <h2 className="cat-b2b__title">
              Care Designed Around Your Health Needs
            </h2>
            <p className="cat-b2b__copy">
              Humancare Connect provides a comprehensive virtual healthcare
              experience that makes it easier to access trusted medical
              guidance, connect with experienced healthcare professionals, and
              receive personalized care tailored to your unique health journey.
            </p>
          </div>
          <div className="cat-b2b__cards">
            {CARE_CAT.map((item, i) => (
              <div className="cat-b2b__card" key={i}>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   FAQ SECTION
───────────────────────────────────────────────────────────── */
function FaqSection() {
  const [openKey, setOpenKey] = useState("0-0");

  return (
    <section className="cat-faq">
      <div className="cat-section__wrap">
        <div className="cat-faq__grid">
          <div className="cat-faq__left">
            <span className="cat-faq__eyebrow">FAQ</span>
            <h2 className="cat-faq__title">Frequently Asked Questions</h2>
            <p className="cat-faq__copy">
              Everything you need to know about primary care at Humancare
              Connect. Can&apos;t find an answer?
            </p>
            {/* <button type="button" className="cat-faq__chat-btn">
              <Icon name="chat" size={16} />
              Chat with our team
            </button> */}
            <div className="cat-faq__info-list">
              <div className="cat-faq__info-item">
                <Icon name="clock" size={14} />
                <span>Avg. response in 2 min</span>
              </div>
              <div className="cat-faq__info-item">
                <Icon name="shield" size={14} />
                <span>HIPAA secure &amp; private</span>
              </div>
              <div className="cat-faq__info-item">
                <Icon name="globe" size={14} />
                <span>Available in all 50 states</span>
              </div>
            </div>
          </div>

          <div className="cat-faq__right">
            {FAQ_GROUPS.map((group, gi) => (
              <div className="cat-faq__group" key={group.label}>
                <span className="cat-faq__group-label">
                  <span className="cat-faq__group-dot" />
                  {group.label}
                </span>
                <div className="cat-faq__card">
                  {group.items.map((item, ii) => {
                    const key = `${gi}-${ii}`;
                    const isOpen = openKey === key;
                    return (
                      <div
                        key={key}
                        className={`cat-faq__item${isOpen ? " cat-faq__item--open" : ""}`}
                      >
                        <button
                          type="button"
                          className="cat-faq__item-head"
                          onClick={() => setOpenKey(isOpen ? null : key)}
                          aria-expanded={isOpen}
                        >
                          <span className="cat-faq__item-q">{item.q}</span>
                          <span className="cat-faq__item-icon">
                            <Icon name={isOpen ? "minus" : "plus"} size={13} />
                          </span>
                        </button>
                        {isOpen && <p className="cat-faq__item-a">{item.a}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────── */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Word-boundary + prefix match (case-insensitive).
 * Using \b before the query (not around it) means the query must start
 * a word in the target text — so "men" matches "Men's Health" / "Mental"
 * but NOT "treatment" or "management" (where "men" sits mid-word).
 * It also lets partial terms like "derma" match "dermatology".
 */
function wordMatch(text, query) {
  if (!text) return false;
  const re = new RegExp(`\\b${escapeRegExp(query)}`, "i");
  return re.test(text);
}

/**
 * Scores a category against the query so more relevant matches
 * (name match) rank above weaker ones (tagline-only match).
 * Returns null if there's no match at all.
 */
function scoreCategory(category, query) {
  if (wordMatch(category.name, query)) return 3;
  if ((category.keywords || []).some((k) => wordMatch(k, query))) return 2;
  if (wordMatch(category.tagline, query)) return 1;
  return null;
}

export default function Categories() {
  const [query, setQuery] = useState("");

  /* FIX: previously used `.includes()`, a raw substring match, which
     matched "men" inside unrelated words like "treatment" and
     "management" (false positives), and had no way to prioritize a
     direct name match over an incidental tagline mention. This now
     matches on word boundaries (so "men" only matches text where a
     word actually starts with "men") and checks category-specific
     keywords too (so "derma"/"dermatology" correctly finds Skin &
     Hair Care), then sorts by how relevant the match is. */
  const filtered = query.trim()
    ? CATEGORIES.map((c) => ({
        category: c,
        score: scoreCategory(c, query.trim()),
      }))
        .filter((r) => r.score !== null)
        .sort((a, b) => b.score - a.score)
        .map((r) => r.category)
    : CATEGORIES;

  return (
    <>
                  <SEO
        title="Online Doctor Consultation | Virtual Healthcare Services | Humancare Connect"
        description="Book secure online doctor consultations with experienced healthcare professionals. Get personalized virtual healthcare services for everyday health, specialist care, mental wellness, and more with Humancare Connect."
        keywords="Online doctor consultation, Online doctor consultation services, Virtual healthcare services, Online doctor consultations, Virtual healthcare experience, Healthcare professionals"
        url="https://humancareconnect.co/categories"
      />
      <Helmet>
        <title>
          Online Doctor Consultation | Virtual Healthcare Services | Humancare
          Connect
        </title>
        <meta
          name="description"
          content="Book secure online doctor consultations with experienced healthcare professionals. Get personalized virtual healthcare services for everyday health, specialist care, mental wellness, and more with Humancare Connect."
        />
      </Helmet>

      {/* ── Hero ── */}
      <section className="cat-hero">
        <div className="cat-hero__inner">
          <div className="cat-hero__left">
            <div className="cat-hero__eyebrow">
              <Icon name="globe" size={14} />
              Discover Care Categories
            </div>
            <h1 className="cat-hero__title">
              Explore Online Doctor Consultation Services Designed Around Your
              Needs
            </h1>
            <p className="cat-hero__copy">
              Find the right care with Humancare Connect's comprehensive range
              of virtual healthcare services. From everyday health concerns and
              mental wellness to chronic care, women's health, skin and hair
              care, and specialized medical support, our online doctor
              consultation services are designed to connect you with appropriate
              healthcare professionals and personalized care solutions.
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

      {/* ── Category Cards ── */}
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
                  Each category contains multiple specialties and hundreds of
                  verified, telehealth-ready physicians.
                </p>
              )}
              <div className="cat-search cat-search--lg">
                <span className="cat-search__icon">
                  <Icon name="search" size={17} />
                </span>
                <input
                  type="text"
                  className="cat-search__input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search categories or conditions…"
                  aria-label="Search categories"
                />
                {query && (
                  <button
                    className="cat-search__clear"
                    onClick={() => setQuery("")}
                    aria-label="Clear"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="cat-empty">
              <p className="cat-empty__text">No categories match "{query}"</p>
              <button className="cat-empty__btn" onClick={() => setQuery("")}>
                Clear search
              </button>
            </div>
          ) : (
            <div className="cat-grid">
              {filtered.map((cat, i) => (
                <Link
                  key={cat.path}
                  to={cat.path}
                  className="cat-card"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {/* ── ROW 1: Icon + Title ── */}
                  <div className="cat-card__header">
                    <div
                      className="cat-card__icon"
                      style={{ background: cat.bgTint, color: cat.color }}
                    >
                      <Icon name={cat.icon} size={20} />
                    </div>
                    <h3 className="cat-card__name">{cat.name}</h3>
                  </div>

                  {/* ── ROW 2: Description ── */}
                  <p className="cat-card__tagline">{cat.tagline}</p>

                  {/* ── ROW 3: Count + Arrow ── */}
                  <div className="cat-card__footer">
                    <span className="cat-card__count">
                      {cat.specialtyCount} Specialties · {cat.conditionsCount}{" "}
                      Conditions
                    </span>
                    <span
                      className="cat-card__arrow"
                      style={{ background: cat.bgTint, color: cat.color }}
                    >
                      <Icon name="chevronRight" size={14} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Specialties Strip ── */}
      <section className="cat-section cat-section--white">
        <div className="cat-section__wrap">
          <div className="cat-section__header--center">
            <span className="cat-eyebrow">EXPERT SPECIALTY CARE</span>
            <h2 className="cat-heading">
              Connect With the Right Healthcare Specialist
            </h2>
            <p className="cat-subtext--center">
              Find trusted healthcare professionals across a wide range of
              medical specialties. Humancare Connect makes it simple to access
              expert medical guidance, personalized treatment support, and
              specialized care through online doctor consultation services
              designed around your unique health needs.
            </p>
          </div>
          <div className="cat-spec-grid">
            {SPECIALTIES.map((sp) => (
              <Link
                key={sp.slug}
                to={sp.path}
                className={`cat-spec-item${sp.featured ? " cat-spec-item--featured" : ""}`}
              >
                <div className="cat-spec-item__icon">
                  <Icon name={sp.icon} size={18} />
                </div>
                <div className="cat-spec-item__text">
                  <div className="cat-spec-item__row">
                    <span className="cat-spec-item__name">{sp.name}</span>
                  </div>
                </div>
                <span className="cat-spec-item__chevron">
                  <Icon name="chevronRight" size={14} />
                </span>
              </Link>
            ))}
          </div>
          <div className="cat-section__footer-link">
            <Link to="/specialties" className="cat-link-more">
              Know more Specialities
              <Icon name="arrowRight" size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── CONDITIONS Strip ── */}
      <section className="cat-section cat-section--bg">
        <div className="cat-section__wrap">
          <div className="cat-section__header--center">
            <span className="cat-eyebrow">Browse by Condition</span>
            <h2 className="cat-heading">Find care for your condition</h2>
            <p className="cat-subtext--center">
              Search by condition and get matched to the right specialist for
              your concern.
            </p>
          </div>
          <div className="cat-spec-grid">
            {CONDITIONS.map((sym) => (
              <Link key={sym.slug} to={sym.path} className="cat-spec-item">
                <div className="cat-spec-item__icon">
                  <Icon name={sym.icon} size={18} />
                </div>
                <div className="cat-spec-item__text">
                  <div className="cat-spec-item__row">
                    <span className="cat-spec-item__name">{sym.name}</span>
                  </div>
                </div>
                <span className="cat-spec-item__chevron">
                  <Icon name="chevronRight" size={14} />
                </span>
              </Link>
            ))}
          </div>
          <div className="cat-section__footer-link">
            <Link to="/conditions" className="cat-link-more">
              Know more Conditions
              <Icon name="arrowRight" size={14} />
            </Link>
          </div>
        </div>
      </section>

      <CareSection />

      {/* ── FAQ ── */}
      <FaqSection />

      {/* ── CTA ── */}
      <section className="cat-cta">
        <div className="cat-cta__card">
          <div className="cat-cta__tag">
            <span className="cat-cta__tag-dot" />
            Ready when you are
          </div>
          <h2 className="cat-cta__title">
            Find your specialist
            <br />
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
            <Link to="/specialties" className="cat-btn-outline">
              Browse specialties
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
