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
  label: "Eye, Ear & Bone Care",
  tagline: "EEB",
  headline: "Expert Eye, Ear & Bone Care ",
  headlineAccent: " Designed Around Your Health",
  subheadline:
    "Connect with experienced healthcare professionals for personalized care for vision concerns, hearing issues, ear conditions, and bone and joint health providing expert medical guidance to support your comfort, mobility, and overall well-being.",
  bookingSpecialtyPlaceholder: "e.g. ENT",

  specialties: [
    {
      name: "ENT (Ear, Nose & Throat)",
      desc: "Specialized care for ear infections, sinus problems, sore throats, hearing concerns, vertigo, voice disorders, and conditions affecting the ear, nose, and throat. ",
      path: "/eye-ear-bone/ear-nose-throat",
    },
    {
      name: "Ophthalmology",
      desc: "Expert eye care for dry eyes, vision changes, eye infections, redness, eye strain, and long-term vision health with personalized treatment and support.",
      path: "/eye-ear-bone/ophthalmology",
    },
    {
      name: "Orthopedics",
      desc: "Specialized care for joint pain, arthritis, back and neck pain, sports injuries, muscle strains, and musculoskeletal conditions to improve mobility and quality of life.",
      path: "/eye-ear-bone/orthopedics",
    },
  ],

  conditions: [
    {
      name: "Ear Infection",
      // desc: "Pain, pressure, and ear discomfort",
      path: "/eye-ear-bone/ear-nose-throat/ear-infection",
    },
    {
      name: "Ear Pain",
      // desc: "Pain, pressure, and ear discomfort",
      path: "/eye-ear-bone/ear-nose-throat/ear-pain",
    },
    {
      name: "Hoarseness",
      // desc: "Relief for voice and throat changes",
      path: "/eye-ear-bone/ear-nose-throat/hoarseness",
    },
    {
      name: "Nasal Congestion",
      // desc: "Relief for a blocked nose",
      path: "/eye-ear-bone/ear-nose-throat/nasal-congestion",
    },
    {
      name: "Sore Throat",
      // desc: "Pain, irritation, or a scratchy throat",
      path: "/eye-ear-bone/ear-nose-throat/sore-throat",
    },
    {
      name: "Tonsillitis",
      // desc: "Relief for sore throat and swollen tonsils",
      path: "/eye-ear-bone/ear-nose-throat/tonsillitis",
    },
    {
      name: "Vertigo",
      // desc: "Spinning sensation and balance issues",
      path: "/eye-ear-bone/ear-nose-throat/vertigo",
    },

    {
      name: "Eye Redness",
      // desc: "Relief for voice and throat changes",
      path: "/eye-ear-bone/ophthalmology/eye-redness",
    },
    {
      name: "Dry eyes",
      // desc: "Relief for a blocked nose",
      path: "/eye-ear-bone/ophthalmology/dry-eyes",
    },
    {
      name: "Vision changes",
      // desc: "Pain, irritation, or a scratchy throat",
      path: "/eye-ear-bone/ophthalmology/vision-changes",
    },
    {
      name: "Eye irritation",
      // desc: "Relief for sore throat and swollen tonsils",
      path: "/eye-ear-bone/ophthalmology/eye-irritation",
    },
    {
      name: "Stye",
      // desc: "Spinning sensation and balance issues",
      path: "/eye-ear-bone/ophthalmology/stye",
    },
    {
      name: "Eye-strain",
      // desc: "Pain, pressure, and ear discomfort",
      path: "/eye-ear-bone/ophthalmology/eye-strain",
    },
    {
      name: "Back pain",
      // desc: "Pain, pressure, and ear discomfort",
      path: "/eye-ear-bone/orthopedics/back-pain",
    },
    {
      name: "Neck pain",
      // desc: "Relief for voice and throat changes",
      path: "/eye-ear-bone/orthopedics/neck-pain",
    },
    {
      name: "Knee pain",
      // desc: "Relief for a blocked nose",
      path: "/eye-ear-bone/orthopedics/knee-pain",
    },
    {
      name: "Muscle Strains",
      // desc: "Pain, irritation, or a scratchy throat",
      path: "/eye-ear-bone/orthopedics/muscle-strain",
    },
    {
      name: "Osteoarthritis",
      // desc: "Relief for sore throat and swollen tonsils",
      path: "/eye-ear-bone/orthopedics/osteoarthritis",
    },
    {
      name: "Arthritis Advice",
      // desc: "Spinning sensation and balance issues",
      path: "/eye-ear-bone/orthopedics/arthritis",
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
      label: "Chronic Care Management",
      items: [
        {
          q: "What is chronic care management?",
          a: "Chronic care management involves ongoing medical support for individuals living with long-term health conditions such as diabetes, high blood pressure, heart disease, asthma, arthritis, and other chronic illnesses. It focuses on monitoring symptoms, managing treatment plans, and improving overall quality of life.",
        },
        {
          q: "What conditions can be managed through virtual chronic care?",
          a: "Virtual chronic care can support a wide range of long-term conditions, including diabetes, hypertension, thyroid disorders, respiratory conditions, digestive disorders, chronic pain, and other ongoing health concerns.",
        },
        {
          q: "How can online doctor consultations help manage chronic conditions?",
          a: "Online doctor consultations provide convenient access to healthcare professionals who can review symptoms, discuss treatment options, monitor progress, and provide personalized medical guidance as part of your long-term care plan.",
        },
        {
          q: "Are online chronic care consultations effective?",
          a: "Yes, virtual chronic care can be an effective way to manage many ongoing health conditions by providing regular medical guidance, treatment follow-ups, and easier access to healthcare professionals.",
        },
        {
          q: "How often should I schedule chronic care appointments?",
          a: "The frequency of appointments depends on your specific health condition, symptoms, and your healthcare professional’s recommendations for ongoing care.",
        },
      ],
    },

    {
      label: "Expert Medical Opinions",
      items: [
        {
          q: "What is an expert medical opinion?",
          a: "An expert medical opinion allows you to consult with an experienced healthcare professional to gain additional insight about a diagnosis, treatment recommendation, or complex health concern.",
        },
        {
          q: "When should I seek a second medical opinion?",
          a: "You may consider a second medical opinion when facing a new diagnosis, considering surgery, managing a complex condition, experiencing ongoing symptoms, or wanting more confidence in your treatment decisions.",
        },
        {
          q: "Can I get a second opinion without visiting a clinic?",
          a: "Yes, virtual healthcare makes it possible to connect with qualified healthcare professionals online and receive expert medical guidance from the comfort of your home.",
        },
        {
          q: "Can I consult a specialist for a complex health condition?",
          a: "Yes, Humancare Connect provides access to experienced healthcare professionals and specialists who can offer expert insights and personalized recommendations for complex medical concerns.",
        },
      ],
    },

    {
      label: "Consultations & Treatment",
      items: [
        {
          q: "Can doctors adjust my treatment plan during an online consultation?",
          a: "Healthcare professionals can review your current treatment plan, discuss your progress, and provide recommendations or adjustments when medically appropriate and permitted by applicable regulations.",
        },
        {
          q: "What information should I prepare for a chronic care consultation?",
          a: "Before your appointment, prepare details about your medical history, current symptoms, medications, previous test results, and any questions or concerns you would like to discuss.",
        },
        {
          q: "Can virtual chronic care help prevent complications?",
          a: "Regular follow-ups and proper medical guidance can help patients better understand their condition, follow treatment recommendations, and identify potential concerns that may require further evaluation.",
        },
        {
          q: "Can I discuss multiple health concerns during one consultation?",
          a: "Yes, patients can discuss multiple symptoms or health concerns during a consultation, allowing healthcare professionals to better understand their overall health needs.",
        },
        {
          q: "What happens if my condition requires in-person treatment?",
          a: "If your healthcare professional determines that physical examinations, diagnostic tests, or emergency treatment are necessary, they will advise you to seek appropriate in-person medical care.",
        },
      ],
    },

    {
      label: "Patient Support & Benefits",
      items: [
        {
          q: "What are the benefits of online chronic care management?",
          a: "Virtual chronic care offers convenience, continuous medical support, easier access to healthcare professionals, personalized care plans, and reduced barriers to receiving regular healthcare.",
        },
        {
          q: "Can chronic care consultations include lifestyle and wellness advice?",
          a: "Yes, healthcare professionals may provide guidance related to nutrition, physical activity, sleep habits, stress management, and healthy lifestyle choices that support long-term health.",
        },
        {
          q: "Is virtual chronic care suitable for older adults?",
          a: "Yes, virtual chronic care can be a convenient option for older adults who require ongoing medical guidance, medication reviews, and routine health monitoring.",
        },
        {
          q: "How quickly can I connect with a healthcare professional for chronic care?",
          a: "Humancare Connect offers convenient access to healthcare professionals, helping patients receive timely medical guidance without unnecessary delays.",
        },
        {
          q: "Is my medical information secure during virtual consultations?",
          a: "Yes, Humancare Connect prioritizes patient privacy and uses secure virtual healthcare technology to protect your personal health information and maintain confidentiality.",
        },
        {
          q: "Why choose Humancare Connect for chronic care and expert medical opinions?",
          a: "Humancare Connect provides secure online doctor consultations, access to trusted healthcare professionals, personalized chronic condition support, and expert medical opinions to help you take control of your long-term health with confidence.",
        },
      ],
    },
  ],

  ctaHeadline: "Expert Chronic Care Support, Wherever You Are",

  ctaBody:
    "Manage long-term health conditions with confidence through continuous medical support, specialist guidance, personalized care plans, and expert medical opinions—all from the comfort of your home.",
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
  const [price, setPrice] = useState(null);
  const [priceLoading, setPriceLoading] = useState(true);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

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

      <Link to="/category-consultant?category=eeb">
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

  const content = (
    <motion.div
      className="hcc-specialty-card"
      tabIndex={sp.path ? 0 : -1}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
      onKeyDown={(e) => {
        if (!sp.path && (e.key === "Enter" || e.key === " ") && sp.path) {
          e.preventDefault();
          navigate(sp.path);
        }
      }}
      style={{ cursor: sp.path ? "pointer" : "default" }}
    >
      <div className="hcc-specialty-name">{sp.name}</div>
      <p className="hcc-specialty-desc">{sp.desc}</p>
      {sp.path && (
        <div className="hcc-specialty-footer">
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
  const navigate = useNavigate();

  const content = (
    <motion.div
      className="hcc-condition-card"
      tabIndex={cond.path ? 0 : -1}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
      onKeyDown={(e) => {
        if (!cond.path && (e.key === "Enter" || e.key === " ") && cond.path) {
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

export default function EyeEarBone() {
  const navigate = useNavigate();
  const goToBooking = () =>
    navigate("/appointment-booking", { state: { categoryId: "eeb" } });
  const goToContact = () => navigate("/contact-us");

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
          Online Chronic Care Management & Expert Medical Opinions | Humancare
          Connect
        </title>
        <meta
          name="description"
          content="Get expert online chronic care management and medical opinions from trusted healthcare professionals. Receive personalized treatment guidance, ongoing support, and virtual consultations from home."
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
            {/* <div className="hcc-cta-row"> */}
            {/* <button className="hcc-btn-primary" onClick={goToBooking}>
                <FiCalendar /> Book Appointment
              </button> */}
            {/* <button className="hcc-btn-secondary" onClick={goToContact}>
                <FiUser size={15} /> Know More
              </button> */}
            {/* </div> */}
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
              categoryCode="eeb"
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
