import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../api";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiArrowRight,
  FiCheckCircle,
  FiCalendar,
  FiUser,
  FiVideo,
  FiHeart,
  FiActivity,
  FiMessageSquare,
  FiShield,
  FiPhone,
  FiPlus,
  FiMinus,
  FiMapPin,
} from "react-icons/fi";
import { Helmet } from "react-helmet-async";
import "./categoriesGlobal.css";

// ─── Page Data ────────────────────────────────────────────────────────────────
// Edit ONLY this object to customise the page.
// Each specialty/condition needs a `path` → where clicking the card navigates.
// Set path: null if you don't have a destination page yet (card still renders,
// but clicking does nothing).

const cat = {
  label: "Weigtht & Nutrition Support",
  tagline: "Weigtht & Nutrition Support",
  headline: "Personalized Weigtht & Nutrition Support ",
  headlineAccent: "for a Healthier You ",
  subheadline:
    "Connect with experienced healthcare professionals for weight management, healthy eating guidance, nutritional concerns, and personalized wellness support through secure online doctor consultations.",
  bookingSpecialtyPlaceholder: "e.g.Lifestyle Medicine",

  specialties: [
    {
      name: "Lifestyle Medicine",
      desc: "Personalized support for healthy habit coaching, nutrition planning, exercise guidance, sleep improvement, stress management, weight management, preventive wellness, and long-term health optimization.",
      path: "/weight-and-nurtrition/lifestyle-medicine",
    },
    {
      name: "Nutrition & Dietetics ",
      desc: "Personalized nutrition support for diabetic diets, cholesterol management, weight loss, pregnancy nutrition, sports nutrition, food intolerance planning, healthy eating habits, and long-term wellness goals.",
      path: "/weight-and-nurtrition/nutrition-and-dietetics ",
    },
    {
      name: "Weight and Nutrition ",
      desc: " Personalized nutrition support for weight management, healthy eating habits, nutritional deficiencies, digestive wellness, chronic disease management, meal planning, and long-term health goals.",
      path: "/weight-and-nutrition",
    },
    {
      name: " Weight Management",
      desc: " Personalized support for weight loss, obesity management, binge eating concerns, GLP-1 eligibility assessments, nutrition planning, appetite control, and sustainable long-term weight management.",
      path: "/weight-and-nurtrition/weight-management",
    },
  ],

  conditions: [
    {
      name: "Healthy-Habit Coaching",
      // desc: "Lifestyle guidance for healthier living",
      path: "/weight-and-nurtrition/lifestyle-medicine/healthy-habit-coaching",
    },
    {
      name: "Diet & Exercise Planning",
      // desc: "Personalized nutrition and fitness plans",
      path: "/weight-and-nurtrition/lifestyle-medicine/diet-and-exercise-planning",
    },
    {
      name: "Sleep Hygiene",
      // desc: "Guidance for better sleep habits",
      path: "/weight-and-nurtrition/lifestyle-medicine/sleep-hygiene",
    },
    {
      name: "Diabetic Diet",
      // desc: "Nutrition plans for diabetes management",
      path: "/weight-and-nurtrition/nutrition-and-dietetics/diabetic-diet",
    },
    {
      name: "Cholesterol-Lowering Diet",
      // desc: "Heart-healthy meal planning",
      path: "/weight-and-nurtrition/nutrition-and-dietetics/cholesterol-lowering-diet",
    },
    {
      name: "Food-Intolerance Planning",
      // desc: "Diet guidance for food sensitivities",
      path: "/weight-and-nurtrition/nutrition-and-dietetics/food-intolerance-planning",
    },
    {
      name: "Pregnancy Nutrition",
      // desc: "Healthy eating during pregnancy",
      path: "/weight-and-nurtrition/nutrition-and-dietetics/pregnancy-nutrition",
    },
    {
      name: "Sports Nutrition",
      // desc: "Nutrition plans for active lifestyles",
      path: "/weight-and-nurtrition/nutrition-and-dietetics/sports-nutrition",
    },
    {
      name: "Obesity",
      // desc: "Weight management and obesity care",
      path: "/weight-and-nurtrition/weight-management/obesity",
    },
    {
      name: "Weight-Loss Planning",
      // desc: "Personalized weight loss strategies",
      path: "/weight-and-nurtrition/weight-management/weight-loss-planning",
    },
    {
      name: "Binge Eating",
      // desc: "Support for binge eating management",
      path: "/weight-and-nurtrition/weight-management/binge-eating",
    },
  ],

  treatments: [
    {
      icon: <FiVideo />,
      title: "Video Consultation",
      desc: "Consult a pediatrician or family doctor from home — no waiting rooms.",
    },
    {
      icon: <FiMapPin />,
      title: "In-Person Visit",
      desc: "Physical check-ups, vaccinations, and examinations at partner clinics.",
    },
    {
      icon: <FiActivity />,
      title: "Growth Monitoring",
      desc: "Regular tracking of your child's height, weight, and developmental progress.",
    },
    {
      icon: <FiCalendar />,
      title: "Follow-Up Care",
      desc: "Structured follow-up plans for ongoing conditions and chronic care.",
    },
    {
      icon: <FiShield />,
      title: "Vaccination Support",
      desc: "Guidance on immunization schedules and catch-up vaccine planning.",
    },
    {
      icon: <FiUser />,
      title: "Specialist Referrals",
      desc: "Warm referrals to pediatric specialists when your child needs targeted care.",
    },
  ],

  faqGroups: [
    {
      label: "Weight & Nutrition Care",
      items: [
        {
          q: "What is Weight & Nutrition care?",
          a: "Weight & Nutrition care focuses on helping individuals achieve and maintain a healthy lifestyle through personalized nutrition guidance, weight management strategies, and professional medical support.",
        },
        {
          q: "Can I get help with weight loss through an online consultation?",
          a: "Yes, healthcare professionals can evaluate your health goals, discuss factors affecting your weight, and provide personalized guidance for safe and sustainable weight management.",
        },
        {
          q: "Can virtual consultations help with weight gain concerns?",
          a: "Yes, online consultations can help identify possible causes of unintentional weight loss or difficulty gaining weight and provide recommendations to support healthy weight goals.",
        },
        {
          q: "Can I receive personalized nutrition advice online?",
          a: "Yes, healthcare professionals can provide guidance on balanced eating habits, dietary choices, meal planning, and nutrition strategies based on your individual health needs.",
        },
        {
          q: "Can nutrition affect chronic health conditions?",
          a: "Yes, proper nutrition can play an important role in managing conditions such as diabetes, high blood pressure, heart disease, and other long-term health concerns.",
        },
      ],
    },

    {
      label: "Weight Management",
      items: [
        {
          q: "Can I discuss my eating habits with a healthcare professional?",
          a: "Yes, virtual consultations provide a comfortable way to discuss eating patterns, nutritional challenges, and lifestyle habits that may affect your overall health.",
        },
        {
          q: "Can online doctors help with obesity or overweight concerns?",
          a: "Yes, healthcare professionals can discuss weight-related concerns, assess potential health risks, and create a personalized approach to support healthy weight management.",
        },
        {
          q: "Can I get guidance for healthy weight maintenance?",
          a: "Yes, professional support can help you develop sustainable habits involving nutrition, physical activity, and overall wellness to maintain a healthy weight.",
        },
        {
          q: "Can I receive a second opinion about my diet or weight management plan?",
          a: "Yes, Humancare Connect provides access to experienced healthcare professionals who can review your current approach and provide additional medical guidance.",
        },
        {
          q: "Is Weight & Nutrition care suitable for long-term wellness?",
          a: "Yes, consistent nutrition support and healthy lifestyle guidance can contribute to long-term wellness, improved energy levels, and better overall health.",
        },
      ],
    },

    {
      label: "Nutrition & Wellness",
      items: [
        {
          q: "Can I receive advice for vitamin or nutritional deficiencies?",
          a: "Yes, healthcare professionals can discuss symptoms related to possible deficiencies, recommend appropriate evaluations, and provide nutritional guidance.",
        },
        {
          q: "Can Weight & Nutrition care support digestive health?",
          a: "Yes, nutrition and eating habits can influence digestive health, and healthcare professionals can provide guidance for concerns related to food choices and overall gut wellness.",
        },
        {
          q: "Can nutrition consultations help improve overall wellness?",
          a: "Yes, personalized nutrition guidance can support energy levels, immune function, healthy aging, and overall physical well-being.",
        },
        {
          q: "Can healthcare professionals help create healthy eating plans?",
          a: "Yes, nutrition consultations may include recommendations for balanced meal planning and healthy eating habits tailored to your goals and lifestyle.",
        },
      ],
    },

    {
      label: "Patient Support & Safety",
      items: [
        {
          q: "What should I prepare before a weight and nutrition consultation?",
          a: "It is helpful to share your current weight goals, medical history, medications, dietary habits, exercise routine, and any previous health assessments.",
        },
        {
          q: "Are online Weight & Nutrition consultations private and secure?",
          a: "Yes, Humancare Connect prioritizes patient privacy and uses secure virtual healthcare technology to protect your personal health information and consultation details.",
        },
        {
          q: "What are the benefits of virtual Weight & Nutrition care?",
          a: "Virtual consultations provide convenient access to healthcare professionals, personalized nutrition support, flexible scheduling, and ongoing guidance to help you achieve your health goals.",
        },
        {
          q: "Why choose Humancare Connect for Weight & Nutrition care?",
          a: "Humancare Connect provides secure online doctor consultations with trusted healthcare professionals, delivering personalized nutrition guidance, compassionate support, and practical weight management solutions tailored to your individual needs.",
        },
      ],
    },
  ],

  ctaHeadline: "Personalized Nutrition & Weight Support for a Healthier You",

  ctaBody:
    "Connect with trusted healthcare professionals for expert nutrition guidance, healthy weight management strategies, wellness support, and personalized recommendations designed to help you achieve your long-term health goals.",
};

// ─── Booking Form ─────────────────────────────────────────────────────────────

function BookingForm({ specialtyPlaceholder, categoryCode }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    date: "",
    time: "",
    type: "",
    specialty: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const [price, setPrice] = useState(null);
  const [priceLoading, setPriceLoading] = useState(true);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const response = await api.get("/api/appointment-tree");

        const DB_CATEGORY_NAMES = {
          general: "General & Everyday Care",
          mental: "Mental Health",
          skin: "Skin & Hair",
          women: "Women's Health",
          men: "Men's Health",
          family: "Children & Family",
          weight: "Weight & Nutrition",
          chronic: "Chronic Care & Expert Opinion",
          eeb: "Eye, Ear & Bone",
          sexual: "Sexual Health",
          travel: "Travel & Global Care",
        };

        const categoryName = DB_CATEGORY_NAMES[categoryCode] || categoryCode;
        const category = response.data.find(
          (item) => item.name === categoryName,
        );

        if (category && category.price !== undefined) {
          setPrice(category.price);
        } else {
          setPrice(49);
        }
      } catch (error) {
        console.error("Failed to fetch pricing:", error);
        setPrice(49);
      } finally {
        setPriceLoading(false);
      }
    };

    fetchPrice();
  }, [categoryCode]);

  const handleSubmit = () => {
    if (!form.name || !form.phone || !form.date) return;
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  if (submitted) {
    return (
      <div className="hcc-book-card" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <div className="hcc-book-title">Appointment Requested!</div>
        <p
          style={{
            fontSize: 13,
            color: "var(--muted)",
            marginTop: 8,
            lineHeight: 1.6,
          }}
        >
          We'll confirm your slot via call or SMS within 15 minutes.
        </p>
      </div>
    );
  }

  return (
    <div className="hcc-booking-card">
      <div className="hcc-booking-badge">
        <span className="hcc-booking-badge-dot" />
        Doctors Available Now
      </div>

      <div className="hcc-booking-price-block">
        <div className="hcc-booking-price">
          {priceLoading ? (
            <span style={{ opacity: 0.5, color: "#FFF" }}>Loading...</span>
          ) : (
            `$${price ?? 49}`
          )}
        </div>
        <p className="hcc-booking-price-sub">
          One-time consultation fee · No subscription required
        </p>
      </div>

      <div className="hcc-booking-info">
        <FiShield size={15} className="hcc-booking-info-icon" />
        <p className="hcc-booking-info-text">
          No extra fee for doctor notes, prescriptions, or specialist referrals.{" "}
          <strong className="hcc-booking-info-strong">
            Everything is included.
          </strong>
        </p>
      </div>

      <div className="hcc-booking-features">
        {[
          "Board-certified physician",
          "Rx to your pharmacy",
          "Doctor's note included",
          "24hr follow-up support",
          "HIPAA secure session",
        ].map((item, i) => (
          <div
            key={item}
            className="hcc-booking-feature-row"
            style={{ animationDelay: `${0.35 + i * 0.07}s` }}
          >
            <FiCheckCircle size={15} className="hcc-booking-check" />
            <span className="hcc-booking-feature-text">{item}</span>
          </div>
        ))}
      </div>

      <Link to="/category-consultant?category=weight">
        <button className="hcc-booking-cta">Start Consultation →</button>
      </Link>
      <p className="hcc-booking-terms">
        By continuing, you agree to our{" "}
        <a href="#" className="hcc-booking-link">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="#" className="hcc-booking-link">
          Privacy Policy
        </a>
      </p>
    </div>
  );
}

// ─── Specialty Card — clickable ───────────────────────────────────────────────

function SpecialtyCard({ sp, index }) {
  const content = (
    <motion.div
      className="hcc-specialty-card"
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
    >
      <div className="hcc-specialty-name">{sp.name}</div>
      <p className="hcc-specialty-desc">{sp.desc}</p>
      {sp.path && (
        <div className="hcc-specialty-arrow">
          Learn more <FiArrowRight size={13} />
        </div>
      )}
    </motion.div>
  );

  return sp.path ? (
    <Link to={sp.path} className="hcc-specialty-link" aria-label={sp.name}>
      {content}
    </Link>
  ) : (
    content
  );
}

// ─── Condition Card — clickable ───────────────────────────────────────────────

function ConditionCard({ cond, index }) {
  const content = (
    <motion.div
      className="hcc-condition-card"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
    >
      <div className="hcc-condition-name">{cond.name}</div>
      <p className="hcc-condition-desc">{cond.desc}</p>
      {cond.path && (
        <div className="hcc-condition-expand">
          Learn more <FiArrowRight size={11} />
        </div>
      )}
    </motion.div>
  );

  return cond.path ? (
    <Link to={cond.path} className="hcc-condition-link" aria-label={cond.name}>
      {content}
    </Link>
  ) : (
    content
  );
}

// ─── FAQ Section ─────────────────────────────────────────────────────────────

function FaqSection({ faqGroups, catLabel }) {
  const [openItem, setOpenItem] = useState(null);
  const toggle = (key) => setOpenItem((prev) => (prev === key ? null : key));

  return (
    <section className="hcc-section">
      <div className="hcc-faq-layout">
        <div className="hcc-faq-sidebar">
          <span className="hcc-faq-sidebar-eyebrow">FAQ</span>
          <h2 className="hcc-faq-sidebar-title">Frequently Asked Questions</h2>
          <p className="hcc-faq-sidebar-desc">
            Everything you need to know about {catLabel} care at HumanCare
            Connect. Can't find an answer?
          </p>
          {/* <button
            className="hcc-faq-chat-btn"
            onClick={() =>
              (window.location.href = "mailto:support@humancareconnect.co")
            }
          >
            <span className="chat-icon">
              <FiMessageSquare size={10} />
            </span>
            Chat with our team
          </button> */}
          <div className="hcc-faq-trust-badges">
            <div className="hcc-faq-trust-badge">
              <span className="badge-icon">⚡</span>
              <div className="badge-content">
                <strong>Avg. response in 2 min</strong>
              </div>
            </div>
            <div className="hcc-faq-trust-badge">
              <span className="badge-icon">🔒</span>
              <div className="badge-content">
                <strong>HIPAA secure &amp; private</strong>
              </div>
            </div>
            <div className="hcc-faq-trust-badge">
              <span className="badge-icon">✓</span>
              <div className="badge-content">
                <strong>Available in all 50 states</strong>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="hcc-faq-groups">
            {faqGroups.map((group, gi) => (
              <div key={gi} className="hcc-faq-group">
                <div className="hcc-faq-group-header">
                  <span className="hcc-faq-group-dot" />
                  <span className="hcc-faq-group-label">{group.label}</span>
                </div>
                {group.items.map((faq, fi) => {
                  const key = `${gi}-${fi}`;
                  const isOpen = openItem === key;
                  return (
                    <div
                      key={fi}
                      className={`hcc-faq-item${isOpen ? " open" : ""}`}
                    >
                      <button
                        className="hcc-faq-btn"
                        onClick={() => toggle(key)}
                      >
                        <span className="hcc-faq-question">{faq.q}</span>
                        <span className="hcc-faq-toggle">
                          {isOpen ? (
                            <FiMinus size={12} />
                          ) : (
                            <FiPlus size={12} />
                          )}
                        </span>
                      </button>
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            style={{ overflow: "hidden" }}
                          >
                            <div className="hcc-faq-answer">{faq.a}</div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* <div className="hcc-faq-still">
            <div className="hcc-faq-still-text">
              <strong>Still have questions?</strong>
              Our care team is available every day, 8 AM – 10 PM.
            </div>
            <button className="hcc-faq-call-btn">
              <FiPhone size={13} /> Book a Call
            </button>
          </div> */}
        </div>
      </div>
    </section>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function WeightNutrition() {
  const navigate = useNavigate();
  const goToBooking = () =>
    navigate("/appointment-booking", { state: { categoryId: "weight" } });
  const goToContact = () => navigate("/contact");

  return (
    <div
      style={{
        fontFamily: "'Satoshi', sans-serif",
        background: "var(--bg)",
        color: "var(--navy)",
        minHeight: "100vh",
      }}
    >
      <Helmet>
        <title>
          Online Weight & Nutrition Care | Virtual Diet & Wellness Consultation
          | Humancare Connect
        </title>
        <meta
          name="description"
          content="Access online weight and nutrition care with trusted healthcare professionals. Get virtual consultations for weight management, healthy eating, personalized nutrition plans, and wellness support.
"
        />
      </Helmet>

      {/* ── Hero ── */}
      <section className="hcc-hero">
        <div className="hcc-hero-overlay" />
        <div className="hcc-hero-deco-1" />
        <div className="hcc-hero-deco-2" />
        <FiHeart
          className="hcc-hero-icon"
          style={{ top: 48, right: 420, fontSize: 48 }}
        />
        <FiShield
          className="hcc-hero-icon"
          style={{ bottom: 60, right: 500, fontSize: 36 }}
        />
        <FiActivity
          className="hcc-hero-icon"
          style={{ top: 140, right: 340, fontSize: 30 }}
        />
        <FiCheckCircle
          className="hcc-hero-icon"
          style={{ bottom: 120, right: 420, fontSize: 28 }}
        />

        <div className="hcc-inner">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <div className="hcc-badge">
              <span className="hcc-badge-dot" />
              Trusted {cat.label}
            </div>
            <h1 className="hcc-headline">
              {cat.headline}
              <br />
              <span style={{ color: "var(--blue-lt)" }}>
                {cat.headlineAccent}
              </span>
            </h1>
            <p className="hcc-subline">{cat.subheadline}</p>
            {/* <div className="hcc-cta-row">
              <button className="hcc-btn-primary" onClick={goToBooking}>
                <FiCalendar /> Book Appointment
              </button>
              <button className="hcc-btn-secondary" onClick={goToContact}>
                <FiUser size={15} /> Know More
              </button>
            </div> */}
            <div className="hcc-trust-row">
              <div className="hcc-trust-item">
                <FiCheckCircle size={14} /> Same Day Visits
              </div>
              <div className="hcc-trust-item">
                <FiShield size={14} /> Insurance Accepted
              </div>
              <div className="hcc-trust-item">
                <FiVideo size={14} /> Virtual Care
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.15 }}
          >
            <BookingForm
              specialtyPlaceholder={cat.bookingSpecialtyPlaceholder}
              categoryCode="weight"
            />
          </motion.div>
        </div>
      </section>

      {/* ── Body ── */}
      <div className="hcc-body">
        {/* Specialties */}
        {cat.specialties?.length > 0 && (
          <section className="hcc-section">
            <span className="hcc-section-eyebrow">Expertise</span>
            <h2 className="hcc-section-title">Specialties Covered</h2>
            <p className="hcc-section-sub">
              All {cat.label} specialties available on Humancare Connect.
            </p>
            <div className="hcc-specialty-grid">
              {cat.specialties.map((sp, i) => (
                <SpecialtyCard key={i} sp={sp} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* Conditions */}
        {cat.conditions?.length > 0 && (
          <section className="hcc-section">
            <span className="hcc-section-eyebrow">Conditions</span>
            <h2 className="hcc-section-title">Conditions We Treat</h2>
            <p className="hcc-section-sub">
              Click on any condition to learn more.
            </p>
            <div className="hcc-condition-grid">
              {cat.conditions.map((cond, i) => (
                <ConditionCard key={cond.name} cond={cond} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* Treatments */}
        {cat.treatments?.length > 0 && (
          <section className="hcc-section">
            <span className="hcc-section-eyebrow">Care Options</span>
            <h2 className="hcc-section-title">Treatment & Care Pathways</h2>
            <p className="hcc-section-sub">
              Multiple ways to access quality care for your child, on your
              terms.
            </p>
            <div className="hcc-treatment-grid">
              {cat.treatments.map((t, i) => (
                <motion.div
                  key={i}
                  className="hcc-treatment-card"
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                >
                  <div className="hcc-treatment-icon">{t.icon}</div>
                  <div className="hcc-treatment-title">{t.title}</div>
                  <p className="hcc-treatment-desc">{t.desc}</p>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* FAQ */}
        {cat.faqGroups?.length > 0 && (
          <FaqSection faqGroups={cat.faqGroups} catLabel={cat.label} />
        )}

        {/* CTA Banner */}
        <div className="hcc-cta-banner">
          <div className="hcc-cta-text">
            <span className="eyebrow">{cat.label}</span>
            <h2>{cat.ctaHeadline}</h2>
            <p>{cat.ctaBody}</p>
          </div>
          <div className="hcc-cta-actions">
            <button
              className="hcc-btn-primary"
              style={{
                background: "#fff",
                color: "var(--blue)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
              }}
              onClick={goToBooking}
            >
              Find Doctors <FiArrowRight />
            </button>
            <button
              className="hcc-btn-secondary"
              style={{ borderColor: "rgba(255,255,255,0.35)" }}
              onClick={goToContact}
            >
              <FiPhone size={14} /> Call Us Now
            </button>
          </div>
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="hcc-mobile-cta">
        <button
          className="hcc-btn-primary"
          style={{ flex: 1, justifyContent: "center", borderRadius: 12 }}
          onClick={goToBooking}
        >
          Book Appointment
        </button>
      </div>
    </div>
  );
}
