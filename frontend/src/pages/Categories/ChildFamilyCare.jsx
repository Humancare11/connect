import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  label: "Children & Family Care",
  tagline: "Caring for your little ones",
  headline: "Compassionate Children & Family Care,",
  headlineAccent: " Whenever You Need It",
  subheadline:
    "Connect with experienced healthcare professionals for personalized family healthcare, pediatric support, and everyday medical guidance, delivering convenient, compassionate care for every stage of life.",
  bookingSpecialtyPlaceholder: "e.g. Adolescent Medicine",

  specialties: [
    {
      name: "Adolescent Medicine",
      desc: "Adolescent medicine specialists provide personalized healthcare for teenagers and young adults, addressing their unique physical, emotional, and developmental needs.",
      path: "/adolescent-medicine",
    },
    {
      name: "Pediatrics",
      desc: "Pediatric specialists provide comprehensive healthcare for infants, children, and teenagers, focusing on growth, development, illness prevention, and treatment of common childhood conditions.",
      path: "/pediatrics",
    },
  ],

  conditions: [
    {
      name: "Mood & Anxiety in Teens",
      desc: "Support for teen emotional wellness",
      path: "/mood-anxiety-teens",
    },
    {
      name: "Puberty Concerns",
      desc: "Guidance through developmental changes",
      path: "/puberty-concerns",
    },
    {
      name: "Sports Injuries",
      desc: "Care for active lifestyles",
      path: "/sports-injuries",
    },
    {
      name: "Ear Pain in Children",
      desc: "Ear discomfort and irritation in kids",
      path: "/ear-pain-children",
    },
    {
      name: "Ear Infections",
      desc: "Bacterial or viral infections of the middle ear common in young children.",
      path: "/ear-infections",
    },
    {
      name: "Feeding Concerns",
      desc: "Support for healthy infant feeding",
      path: "/feeding-concerns",
    },
    {
      name: "Pediatric Cold & Flu",
      desc: "Cold and flu symptoms in children",
      path: "/pediatric-cold-flu",
    },
    {
      name: "Pediatric Fever",
      desc: "Fever and illness in children",
      path: "/pediatric-fever",
    },
    {
      name: "Skin Rash in Children",
      desc: "Red, itchy, irritated skin in kids",
      path: "/skin-rash-in-children",
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
      label: "General Care",
      items: [
        {
          q: "What is online children and family care?",
          a: "Online children and family care allows you to connect with licensed healthcare professionals through virtual doctor consultations for common illnesses, health concerns, preventive care, and general medical guidance for children and family members.",
        },
        {
          q: "What health concerns can be treated through virtual children and family care?",
          a: "Virtual children and family care can help address common concerns such as colds, flu symptoms, fever, allergies, skin conditions, minor infections, digestive issues, and other non-emergency health conditions.",
        },
        {
          q: "When should I schedule an online doctor consultation for my child?",
          a: "You should consider an online doctor consultation when your child has symptoms that need medical advice, such as a persistent fever, cough, rash, stomach discomfort, allergies, or other health concerns that are not life-threatening.",
        },
        {
          q: "Can online doctors provide treatment recommendations for children?",
          a: "Yes, healthcare professionals can evaluate symptoms, provide medical guidance, recommend appropriate treatment options, and advise whether an in-person examination is necessary.",
        },
        {
          q: "Are virtual doctor visits safe and effective for children?",
          a: "Yes, virtual healthcare provides a convenient and secure way for families to receive professional medical advice for many everyday health concerns while avoiding unnecessary travel and waiting rooms.",
        },
      ],
    },
    {
      label: "Child Wellness",
      items: [
        {
          q: "Can I speak with a doctor about my child's growth and development?",
          a: "Yes, children and family care consultations can include discussions about your child's growth, developmental milestones, nutrition, sleep habits, and overall wellness.",
        },
        {
          q: "Is children and family care available for newborns and infants?",
          a: "Healthcare professionals can provide guidance for many newborn and infant concerns, including feeding, sleep, minor illnesses, and general wellness. Emergency situations require immediate in-person medical care.",
        },
        {
          q: "Can virtual healthcare help with childhood allergies?",
          a: "Yes, online healthcare professionals can evaluate allergy symptoms, discuss possible triggers, recommend management strategies, and determine whether additional care is needed.",
        },
        {
          q: "Can I consult a doctor for my child's fever online?",
          a: "Yes, virtual consultations can help assess fever symptoms, provide care recommendations, and guide you on whether your child needs further medical attention.",
        },
        {
          q: "Can I use virtual family care for preventive health advice?",
          a: "Yes, online consultations can provide preventive health guidance, wellness advice, nutrition support, and recommendations for maintaining your family's overall health.",
        },
      ],
    },
    {
      label: "Virtual Consultations",
      items: [
        {
          q: "Can online family healthcare help with common illnesses?",
          a: "Yes, virtual family healthcare can support common conditions such as colds, seasonal illnesses, allergies, minor infections, and general health concerns for both children and adults.",
        },
        {
          q: "Do online doctors prescribe medications for children?",
          a: "When medically appropriate and permitted by applicable regulations, healthcare professionals may provide prescriptions or treatment recommendations based on the child's condition and consultation.",
        },
        {
          q: "What information should I prepare before my child's virtual appointment?",
          a: "It is helpful to have your child's symptoms, medical history, current medications, allergies, and any recent health changes ready before the consultation.",
        },
        {
          q: "Can doctors diagnose illnesses during a virtual consultation?",
          a: "Healthcare professionals can assess many common conditions through a virtual consultation. However, some situations may require physical examinations, testing, or in-person care.",
        },
        {
          q: "How quickly can my family connect with a healthcare professional?",
          a: "Humancare Connect offers convenient access to healthcare professionals, allowing families to receive timely medical guidance without long waits.",
        },
      ],
    },
    {
      label: "Family Support & Safety",
      items: [
        {
          q: "Can I get medical advice for my entire family through Humancare Connect?",
          a: "Yes, Humancare Connect provides convenient virtual healthcare services designed to support children, adults, and families with a wide range of everyday health concerns.",
        },
        {
          q: "Is my family's medical information secure during online consultations?",
          a: "Yes, Humancare Connect prioritizes patient privacy and uses secure virtual healthcare technology to protect personal health information and maintain confidentiality.",
        },
        {
          q: "What are the benefits of online children and family healthcare?",
          a: "Virtual healthcare offers convenience, easier access to healthcare professionals, personalized medical guidance, reduced travel time, and support from the comfort of your home.",
        },
        {
          q: "When should I choose in-person emergency care instead of a virtual visit?",
          a: "You should seek immediate emergency medical care for serious symptoms such as difficulty breathing, severe injuries, seizures, unconsciousness, or any other urgent medical emergency.",
        },
        {
          q: "Why choose Humancare Connect for children and family care?",
          a: "Humancare Connect provides secure online doctor consultations with trusted healthcare professionals, making it easier for families to access compassionate, personalized, and convenient healthcare whenever they need it.",
        },
      ],
    },
  ],

  ctaHeadline: "Comprehensive Family Care, Wherever You Are",
  ctaBody:
    "Connect with trusted healthcare professionals for children, infants, and the entire family. Get expert medical guidance, treatment recommendations, and preventive care from the comfort of home.",
};

// ─── Booking Form ─────────────────────────────────────────────────────────────

function BookingForm({ specialtyPlaceholder }) {
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

  // Fetch dynamic pricing for the "family" category
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const response = await api.get("/api/pricing");
        const familyPricing = response.data?.family;
        if (familyPricing) {
          setPrice(familyPricing.price);
        }
      } catch (error) {
        console.error("Failed to fetch pricing:", error);
        // Fallback to default price if API fails
        setPrice(49);
      } finally {
        setPriceLoading(false);
      }
    };
    fetchPrice();
  }, []);

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
            `$${price || 49}`
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

      <button className="hcc-booking-cta">Start Consultation →</button>
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
          Learn more <FiArrowRight size={13} />
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

export default function ChildFamilyCare() {
  const navigate = useNavigate();
  const goToBooking = () =>
    navigate("/appointment-booking", { state: { categoryId: "family" } });
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
          Online Children &amp; Family Care | Virtual Doctor Consultation |
          Humancare Connect
        </title>
        <meta
          name="description"
          content="Access online children and family care with trusted healthcare professionals. Get virtual doctor consultations, pediatric guidance, family healthcare support, and personalized medical advice from home."
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
