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
  label: "General & Everyday Care",
  tagline: "General & Everyday Care",
  headline: "Reliable General & Everyday Care,",
  headlineAccent: "When You Need It ",
  subheadline:
    "Connect with experienced healthcare professionals for common illnesses, routine health concerns, preventive care, and everyday medical guidance. Our convenient online doctor consultations make it easier to receive personalized, patient-centered care that fits your lifestyle.",
  bookingSpecialtyPlaceholder: "e.g. General Physician",

  specialties: [
    {
      name: "Family Medicine",
      desc: "Comprehensive healthcare for individuals and families of all ages, including preventive care, routine checkups, chronic condition management, vaccinations, and everyday medical needs. ",
      path: "/general-and-everyday-care/family-medicine",
    },
    {
      name: "General Physician (GP)",
      desc: " Trusted primary healthcare for common illnesses, preventive care, chronic condition management, routine checkups, and everyday medical concerns for adults and families. ",
      path: "/general-and-everyday-care/general-physician",
    },
    {
      name: "Internal Medicine",
      desc: "Expert adult healthcare for chronic conditions, preventive screenings, medication reviews, complex symptoms, and personalized care focused on long-term health and wellness.",
      path: "/general-and-everyday-care/internal-medicine",
    },
  ],

  conditions: [
    {
      name: "Routine Check-Ups",
      // desc: "Ongoing care for everyday health",
      path: "/general-and-everyday-care/family-medicine/routine-check-ups",
    },
    {
      name: "Vaccination Advice",
      // desc: "Guidance for recommended immunizations",
      path: "/general-and-everyday-care/family-medicine/vaccination-advice",
    },
    {
      name: "Whole-Family Illnesses",
      // desc: "Care for illnesses affecting families",
      path: "/general-and-everyday-care/family-medicine/whole-family-illnesses",
    },
    {
      name: "Fever",
      // desc: "Relief for a blocked nose",
      path: "/general-and-everyday-care/general-physician/fever",
    },
    {
      name: "Cold & flu",
      // desc: "Pain, irritation, or a scratchy throat",
      path: "/general-and-everyday-care/general-physician/cold-and-flu",
    },
    {
      name: "Cough",
      // desc: "Relief for sore throat and swollen tonsils",
      path: "/general-and-everyday-care/general-physician/cough",
    },
    {
      name: "Body aches",
      // desc: "Spinning sensation and balance issues",
      path: "/general-and-everyday-care/general-physician/body-aches",
    },

    {
      name: "Headache",
      // desc: "Fever and illness in children",
      path: "/general-and-everyday-care/general-physician/headache",
    },
    {
      name: "Sinus Infection",
      // desc: "Red, itchy, irritated skin in kids",
      path: "/general-and-everyday-care/general-physician/sinus-infection",
    },
    {
      name: "Minor Infections",
      // desc: "Pain, irritation, or a scratchy throat",
      path: "/general-and-everyday-care/general-physician/minor-infections",
    },
    {
      name: "Fatigue",
      // desc: "Relief for sore throat and swollen tonsils",
      path: "/general-and-everyday-care/general-physician/fatigue",
    },
    {
      name: "Nausea & Vomiting",
      // desc: "Spinning sensation and balance issues",
      path: "/general-and-everyday-care/general-physician/nausea-and-vomiting",
    },

    {
      name: "Pink eye",
      // desc: "Fever and illness in children",
      path: "/general-and-everyday-care/general-physician/pink-eye",
    },
    {
      name: "Undiagnosed symptoms",
      // desc: "Red, itchy, irritated skin in kids",
      path: "/general-and-everyday-care/internal-medicine/undiagnosed-symptoms",
    },
    {
      name: "Multi-system complaints",
      // desc: "Red, itchy, irritated skin in kids",
      path: "/general-and-everyday-care/internal-medicine/multi-system-complaints",
    },
    {
      name: "Preventive Screening",
      // desc: "Red, itchy, irritated skin in kids",
      path: "/general-and-everyday-care/internal-medicine/preventive-screening",
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
      label: "General Healthcare",
      items: [
        {
          q: "What is General & Everyday Care?",
          a: "General & Everyday Care provides medical support for common illnesses, routine health concerns, preventive healthcare, and everyday symptoms through convenient online doctor consultations.",
        },
        {
          q: "What conditions can be treated through General & Everyday Care?",
          a: "Healthcare professionals can provide guidance for common conditions such as colds, flu symptoms, fever, allergies, cough, sore throat, headaches, digestive concerns, skin conditions, and other non-emergency health issues.",
        },
        {
          q: "When should I book an online doctor consultation?",
          a: "You should consider a virtual consultation when you experience new symptoms, ongoing discomfort, mild illnesses, or need professional medical advice without waiting for an in-person appointment.",
        },
        {
          q: "Is virtual General & Everyday Care suitable for all ages?",
          a: "Yes, online healthcare can support many common health concerns for adults and children depending on their medical condition and individual healthcare needs.",
        },
        {
          q: "Can General & Everyday Care help with preventive health?",
          a: "Yes, healthcare professionals can provide preventive healthcare advice, wellness recommendations, and guidance to help maintain your overall health.",
        },
      ],
    },

    {
      label: "Common Conditions",
      items: [
        {
          q: "Can I consult a doctor online for cold, flu, or fever symptoms?",
          a: "Yes, online doctor consultations can help evaluate symptoms such as fever, cough, congestion, body aches, and other common seasonal illnesses.",
        },
        {
          q: "Can online healthcare help with allergies?",
          a: "Yes, healthcare professionals can assess allergy symptoms, discuss possible triggers, recommend management options, and determine whether additional medical care is required.",
        },
        {
          q: "Can I receive medical advice for headaches and body aches?",
          a: "Yes, virtual consultations can help evaluate headaches, minor pain, and everyday discomforts while providing appropriate medical guidance.",
        },
        {
          q: "Can I discuss more than one health concern during a consultation?",
          a: "Yes, you can discuss multiple symptoms or health questions during a consultation, allowing your healthcare professional to understand your overall health needs.",
        },
      ],
    },

    {
      label: "Consultations & Treatment",
      items: [
        {
          q: "Can online doctors diagnose common illnesses?",
          a: "Healthcare professionals can assess your symptoms, provide medical guidance, recommend appropriate treatment options, and advise whether further testing or in-person evaluation is needed.",
        },
        {
          q: "Can I receive prescriptions during a virtual consultation?",
          a: "When medically appropriate and permitted by applicable regulations, healthcare professionals may provide prescriptions or treatment recommendations based on your health needs.",
        },
        {
          q: "What information should I prepare before my online appointment?",
          a: "Having details about your symptoms, medical history, current medications, allergies, and previous treatments can help your healthcare professional provide better guidance.",
        },
        {
          q: "Can virtual consultations help with follow-up care?",
          a: "Yes, online consultations can support follow-up appointments by allowing healthcare professionals to review your progress, discuss recovery, and address ongoing concerns.",
        },
        {
          q: "Can I discuss medications during an online consultation?",
          a: "Yes, healthcare professionals can review your current medications, answer your questions, and provide guidance regarding your treatment plan.",
        },
        {
          q: "Can I get a doctor's note or sick note through an online consultation?",
          a: "When medically appropriate and permitted by applicable regulations, healthcare professionals may provide a doctor's note, sick note, or other necessary medical documentation based on your consultation and health condition.",
        },
      ],
    },

    {
      label: "Patient Support & Safety",
      items: [
        {
          q: "How quickly can I connect with a healthcare professional?",
          a: "Humancare Connect offers convenient access to healthcare professionals, allowing patients to receive timely medical guidance without long waiting periods.",
        },
        {
          q: "Are online doctor consultations private and secure?",
          a: "Yes, Humancare Connect prioritizes patient confidentiality and uses secure virtual healthcare technology to protect your personal health information.",
        },
        {
          q: "What are the benefits of virtual General & Everyday Care?",
          a: "Virtual healthcare provides convenience, easier access to trusted healthcare professionals, personalized medical support, and the ability to receive care from the comfort of your home.",
        },
        {
          q: "When should I seek emergency medical attention instead of a virtual visit?",
          a: "You should seek immediate emergency care for severe chest pain, difficulty breathing, serious injuries, uncontrolled bleeding, sudden weakness, or other life-threatening symptoms.",
        },
        {
          q: "Is General & Everyday Care a replacement for emergency services?",
          a: "No, virtual General & Everyday Care is intended for non-emergency health concerns and routine medical support. Emergency situations require immediate in-person medical care.",
        },
        {
          q: "Why choose Humancare Connect for General & Everyday Care?",
          a: "Humancare Connect provides secure online doctor consultations with trusted healthcare professionals, delivering convenient, compassionate, and patient-centered healthcare designed around your everyday needs.",
        },
      ],
    },
  ],

  ctaHeadline: "Everyday Healthcare Made Simple",

  ctaBody:
    "Get trusted medical guidance for common illnesses, preventive care, follow-up appointments, and everyday health concerns through secure online consultations with experienced healthcare professionals.",
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

      <Link to="/category-consultant?category=general">
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

export default function GeneralEverydayCare() {
  const navigate = useNavigate();
  const goToBooking = () =>
    navigate("/appointment-booking", { state: { categoryId: "general" } });
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
          Online General & Everyday Care | Virtual Doctor Consultation |
          Humancare Connect
        </title>
        <meta
          name="description"
          content=" Access online general and everyday care with trusted healthcare professionals. Get virtual doctor consultations for common illnesses, preventive care, symptoms, and personalized medical guidance from home.
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
              categoryCode="general"
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
