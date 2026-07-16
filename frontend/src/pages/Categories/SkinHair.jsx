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
  label: "Skin & Hair",
  tagline: "Skin & Hair",
  headline: "Healthy Skin & Hair Care,",
  headlineAccent: " Personalized for You ",
  subheadline:
    "Connect with experienced healthcare professionals for skin concerns, hair health issues, scalp conditions, and personalized dermatology guidance through secure online doctor consultations.",
  bookingSpecialtyPlaceholder: "e.g. Skin Care",

  specialties: [
    {
      name: " Dermatology ",
      desc: " Expert care for acne, eczema, psoriasis, rosacea, hair loss, fungal skin infections, hives, nail disorders, skin rashes, and long-term skin, hair, and nail health. ",
      path: "/sexual-health",
    },
    // {
    //   name: "Psychiatry",
    //   desc: "Specialized mental healthcare for anxiety, depression, ADHD, PTSD, insomnia, mood disorders, medication management, and long-term emotional wellness support. ",
    //   path: "/psychiatry",
    // },
    // {
    //   name: "Psychology Counseling",
    //   desc: "Professional counseling support for stress, grief, trauma, relationship challenges, self-esteem concerns, life transitions, and emotional well-being in a safe, confidential environment.",
    //   path: "/psychology-counseling",
    // },
    // {
    //   name: "Gastroenterology",
    //   desc: "Gastroenterology specialists diagnose, treat, and manage conditions affecting the digestive system, including the stomach, intestines, liver, pancreas, gallbladder, and esophagus. ",
    //   path: "/gastroenterology",
    // },
    // {
    //   name: "Neurology",
    //   desc: "Neurology specialists diagnose and treat conditions affecting the brain, spinal cord, nerves, and nervous system. ",
    //   path: "/neurology",
    // },
    // {
    //   name: "Pulmonology",
    //   desc: "Pulmonology specialists diagnose and treat lung and respiratory conditions such as asthma, chronic cough, COPD, sleep apnea, and post-COVID breathing issues, helping improve breathing, lung function, and overall health.",
    //   path: "/pulmonology",
    // },
  ],

  conditions: [
    {
      name: "Acne",
      desc: "Clogged pores causing breakouts",
      path: "/acne",
    },
    {
      name: "Cold Sores",
      desc: "Painful blisters around the mouth",
      path: "/cold-sores",
    },
    {
      name: "Eczema",
      desc: "Dry, itchy, inflamed skin",
      path: "/eczema",
    },
    {
      name: "Fungal Skin Infection",
      desc: "Itchy, red, irritated skin patches",
      path: "/fungal-skin-infection",
    },
    {
      name: "Hair Loss",
      desc: "Thinning hair and excessive shedding",
      path: "/hair-loss",
    },
    {
      name: "Hives",
      desc: "Raised, itchy skin welts",
      path: "/hives",
    },
    {
      name: "Mole & Skin Checks",
      desc: "Early evaluation of skin changes",
      path: "/mole-skin-checks",
    },

    {
      name: "Nail Problems",
      desc: "Expert care for nail concerns",
      path: "/nail-problems",
    },
    {
      name: "Psoriasis",
      desc: "Chronic skin condition causing flare-ups",
      path: "/psoriasis",
    },
    {
      name: "Rosacea",
      desc: "Redness and facial skin irritation",
      path: "/rosacea",
    },
    {
      name: "Skin Rash",
      desc: "Red, itchy, irritated skin",
      path: "/skin-rash",
    },
    {
      name: "Warts",
      desc: "Small rough bumps on the skin",
      path: "/warts",
    },
    //  {
    //   name: "Skin Rash in Children",
    //   desc: "Red, itchy, irritated skin in kids",
    //   path: "/skin-rash-children",
    // },
    //  {
    //   name: "Skin Rash in Children",
    //   desc: "Red, itchy, irritated skin in kids",
    //   path: "/skin-rash-children",
    // },
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
      label: "Skin & Hair Care",
      items: [
        {
          q: "What is virtual skin and hair care?",
          a: "Virtual skin and hair care allows you to consult healthcare professionals online for concerns related to your skin, hair, and scalp while receiving personalized medical guidance and treatment recommendations.",
        },
        {
          q: "What skin conditions can be addressed through online consultations?",
          a: "Online consultations can help with common skin concerns such as acne, eczema, rashes, dry skin, itching, redness, allergies, infections, and other non-emergency dermatology concerns.",
        },
        {
          q: "Can I consult a doctor online for acne treatment?",
          a: "Yes, healthcare professionals can assess your acne concerns, discuss possible causes, recommend treatment options, and provide guidance on managing your skin health.",
        },
        {
          q: "Can online consultations help with hair loss?",
          a: "Yes, healthcare professionals can evaluate hair thinning, excessive shedding, and other hair loss concerns, discuss potential causes, and recommend appropriate treatment options.",
        },
        {
          q: "Can I get help for scalp problems through virtual care?",
          a: "Yes, online doctor consultations can help address scalp concerns such as dandruff, itching, irritation, dryness, and other scalp-related conditions.",
        },
      ],
    },

    {
      label: "Common Skin & Hair Concerns",
      items: [
        {
          q: "Is virtual skin and hair care suitable for all ages?",
          a: "Yes, virtual consultations can support many common skin and hair concerns affecting children, teenagers, and adults depending on their individual healthcare needs.",
        },
        {
          q: "Can I discuss changes in moles or unusual skin spots online?",
          a: "Yes, healthcare professionals can review your concerns and advise whether further in-person evaluation, testing, or specialized dermatology care is needed.",
        },
        {
          q: "Can online doctors help with skin allergies and rashes?",
          a: "Yes, doctors can evaluate symptoms, identify possible triggers, provide treatment guidance, and recommend the appropriate next steps for your condition.",
        },
        {
          q: "Can online consultations help with anti-aging skin concerns?",
          a: "Yes, healthcare professionals can provide guidance for concerns such as fine lines, wrinkles, uneven skin tone, and maintaining healthy aging skin.",
        },
        {
          q: "Can I get advice for chronic skin conditions?",
          a: "Yes, virtual consultations can support the management of ongoing skin concerns such as eczema, psoriasis, and recurring skin irritation with professional medical guidance.",
        },
      ],
    },

    {
      label: "Consultations & Treatment",
      items: [
        {
          q: "Can I receive prescriptions during a skin or hair consultation?",
          a: "When medically appropriate and permitted by applicable regulations, healthcare professionals may provide prescriptions or treatment recommendations based on your condition.",
        },
        {
          q: "What information should I prepare before my skin and hair consultation?",
          a: "It helps to share details about your symptoms, medical history, current medications, skincare or hair care products you use, and any recent changes in your condition.",
        },
        {
          q: "Can I receive guidance for skincare routines and healthy hair habits?",
          a: "Yes, healthcare professionals can recommend appropriate skincare practices, hair care routines, and lifestyle adjustments based on your individual needs.",
        },
        {
          q: "Can I get a second opinion for a skin or hair concern?",
          a: "Yes, Humancare Connect allows you to connect with experienced healthcare professionals for additional insights and expert medical opinions regarding your condition.",
        },
      ],
    },

    {
      label: "Patient Support & Safety",
      items: [
        {
          q: "Are my photos and medical information secure during a virtual consultation?",
          a: "Yes, Humancare Connect prioritizes patient privacy and uses secure virtual healthcare technology to protect your personal health information and consultation details.",
        },
        {
          q: "When should I seek emergency care for a skin condition?",
          a: "You should seek immediate medical attention for severe allergic reactions, rapidly spreading infections, severe burns, or any serious symptoms that require urgent care.",
        },
        {
          q: "What are the benefits of online skin and hair care?",
          a: "Virtual skin and hair consultations provide convenient access to healthcare professionals, personalized treatment guidance, timely medical advice, and support from the comfort of your home.",
        },
        {
          q: "Why choose Humancare Connect for skin and hair care?",
          a: "Humancare Connect provides secure online doctor consultations with trusted healthcare professionals, offering convenient, personalized, and compassionate support for your skin, hair, and scalp health.",
        },
      ],
    },
  ],
  ctaHeadline: "Healthy Skin & Hair Starts with Expert Care",

  ctaBody:
    "Connect with trusted healthcare professionals online for personalized support with acne, hair loss, scalp concerns, skin conditions, skincare guidance, and overall skin and hair wellness—all from the comfort of your home.",
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

      <Link to="/category-consultant?category=skin">
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
  const navigate = useNavigate();

  return (
    <motion.div
      className="hcc-specialty-card"
      role="button"
      tabIndex={0}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
      onClick={() => sp.path && navigate(sp.path)}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && sp.path) {
          e.preventDefault();
          navigate(sp.path);
        }
      }}
      style={{ cursor: sp.path ? "pointer" : "default" }}
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
}

// ─── Condition Card — clickable ───────────────────────────────────────────────

function ConditionCard({ cond, index }) {
  const navigate = useNavigate();

  return (
    <motion.div
      className="hcc-condition-card"
      role="button"
      tabIndex={0}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
      onClick={() => cond.path && navigate(cond.path)}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && cond.path) {
          e.preventDefault();
          navigate(cond.path);
        }
      }}
      style={{ cursor: cond.path ? "pointer" : "default" }}
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
          <button
            className="hcc-faq-chat-btn"
            onClick={() =>
              (window.location.href = "mailto:support@humancareconnect.co")
            }
          >
            <span className="chat-icon">
              <FiMessageSquare size={10} />
            </span>
            Chat with our team
          </button>
          <div className="hcc-faq-trust-badges">
            <div className="hcc-faq-trust-badge">
              <span className="badge-icon">⚡</span>
              <div>
                <strong>Avg. response in 2 min</strong>
                <div>Live chat available</div>
              </div>
            </div>
            <div className="hcc-faq-trust-badge">
              <span className="badge-icon">🏥</span>
              <div>
                <strong>HIPAA secure &amp; private</strong>
                <div>Your data is protected</div>
              </div>
            </div>
            <div className="hcc-faq-trust-badge">
              <span className="badge-dot" />
              <div>
                <strong>Available on all devices</strong>
                <div>Web, iOS &amp; Android</div>
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

export default function SkinHair() {
  const navigate = useNavigate();
  const goToBooking = () =>
    navigate("/appointment-booking", { state: { categoryId: "skin" } });
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
          Online Skin & Hair Care | Virtual Dermatology Consultation | Humancare
          Connect
        </title>
        <meta
          name="description"
          content=" Access online skin and hair care with trusted healthcare professionals. Get virtual dermatology consultations for acne, hair loss, scalp concerns, skin conditions, and personalized treatment guidance.
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
            <div className="hcc-cta-row">
              <button className="hcc-btn-primary" onClick={goToBooking}>
                <FiCalendar /> Book Appointment
              </button>
              {/* <button className="hcc-btn-secondary" onClick={goToContact}>
                <FiUser size={15} /> Know More
              </button> */}
            </div>
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
              categoryCode="skin"
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
