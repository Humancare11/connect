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
  label: "Trevel & Global Care",
  tagline: "Caring for your little ones",
  headline: "Global Healthcare Support ",
  headlineAccent: "for Your Journey",
  subheadline:
    "Stay connected to trusted healthcare professionals with virtual healthcare services designed for travel health concerns, international healthcare needs, and medical guidance wherever life takes you.",
  bookingSpecialtyPlaceholder: "e.g. Adolescent Medicine",

  specialties: [
    {
      name: "Travel Medicine ",
      desc: "Expert travel health support for pre-travel consultations, vaccination guidance, malaria prevention, traveler's diarrhea, altitude sickness, post-travel illness evaluations, and destination-specific health risks.",
      path: "/travel-and-global-care/travel-medicine ",
    },
    {
      name: " Global Cross-Border Care",
      desc: "International healthcare support for travelers, expatriates, medical tourists, medication refill assistance, specialist referrals, chronic care follow-ups, and secure telemedicine consultations across borders.",
      path: "/travel-and-global-care/global-cross-border-care ",
    },
  ],

  conditions: [
    {
      name: "Pre-Travel Vaccination",
      // desc: "Vaccinations before international travel",
      path: "/travel-and-global-care/travel-medicine/pre-travel-vaccination",
    },
    {
      name: "Malaria Prevention",
      // desc: "Prevention and medication guidance",
      path: "/travel-and-global-care/travel-medicine/malaria-prevention",
    },
    {
      name: "Altitude Sickness ",
      // desc: "Advice for high-altitude travel",
      path: "/travel-and-global-care/travel-medicine/altitude-sickness",
    },
    {
      name: "Post-Travel Symptoms",
      // desc: "Evaluation of symptoms after returning",
      path: "/travel-and-global-care/travel-medicine/post-travel-symptoms",
    },
    {
      name: "Traveler's Diarrhea",
      // desc: "Treatment for travel-related diarrhea",
      path: "/travel-and-global-care/travel-medicine/travelers-diarrhea",
    },
    {
      name: "Food Poisoning While Traveling",
      // desc: "Stomach illness during travel trips",
      path: "/travel-and-global-care/travel-medicine/food-poisoning-while-traveling",
    },
    {
      name: "Travel-Related Fever",
      // desc: "Assessment of fever after travel",
      path: "/travel-and-global-care/travel-medicine/travel-related-fever",
    },
    {
      name: "Cross-Border Consultation",
      // desc: "Healthcare guidance across locations",
      path: "/travel-and-global-care/global-cross-border-care/cross-border-consultation",
    },
    {
      name: "International Medical Assistance",
      // desc: "Medical support while traveling abroad",
      path: "/travel-and-global-care/global-cross-border-care/international-medical-assistance",
    },
    {
      name: "Medication Refill While Traveling",
      // desc: "Prescription refill support abroad",
      path: "/travel-and-global-care/global-cross-border-care/medication-refill-while-traveling",
    },
    {
      name: "Referral Coordination Overseas",
      // desc: "Specialist referrals across countries",
      path: "/travel-and-global-care/global-cross-border-care/referral-coordination-overseas",
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
      label: "Travel Health Services",
      items: [
        {
          q: "What is Travel & Global Care?",
          a: "Travel & Global Care provides access to virtual healthcare services for individuals who need medical guidance before, during, or after international travel and while living or working abroad.",
        },
        {
          q: "Can I consult a doctor online while traveling?",
          a: "Yes, online doctor consultations allow you to connect with healthcare professionals and receive medical advice for many non-emergency health concerns while you are away from home.",
        },
        {
          q: "What health concerns can be addressed through Travel & Global Care?",
          a: "Healthcare professionals can provide guidance for common illnesses, minor infections, allergies, digestive issues, medication questions, travel-related health concerns, and general medical advice.",
        },
        {
          q: "Can I receive medical advice before an international trip?",
          a: "Yes, virtual consultations can help you prepare for travel by discussing health risks, preventive measures, vaccinations, medications, and general travel wellness recommendations.",
        },
        {
          q: "Is virtual healthcare useful for people living abroad?",
          a: "Yes, virtual healthcare offers a convenient way for expatriates and international residents to access trusted medical guidance and maintain continuity in their healthcare journey.",
        },
      ],
    },
    {
      label: "Travel Health Support",
      items: [
        {
          q: "Can I get help with a health issue in a different country?",
          a: "Yes, online healthcare can provide medical guidance for many non-emergency concerns and help you understand the appropriate next steps for your health needs.",
        },
        {
          q: "Can I discuss my current medications during a travel consultation?",
          a: "Yes, healthcare professionals can review your medications, discuss concerns related to travel, and provide guidance on managing your health while away.",
        },
        {
          q: "Can Travel & Global Care support ongoing medical conditions while I am away?",
          a: "Yes, virtual healthcare can provide guidance for managing chronic health concerns and maintaining communication with healthcare professionals during travel.",
        },
        {
          q: "Can I get a second opinion while traveling or living abroad?",
          a: "Yes, Humancare Connect provides access to experienced healthcare professionals who can offer additional medical insights and guidance for your health concerns.",
        },
        {
          q: "Is Travel & Global Care suitable for families traveling with children?",
          a: "Yes, families can use virtual healthcare services for common child and family health concerns while traveling, helping them receive timely medical support.",
        },
      ],
    },
    {
      label: "Consultations & Treatment",
      items: [
        {
          q: "Can I get a prescription through an online travel consultation?",
          a: "When medically appropriate and permitted by applicable regulations, healthcare professionals may provide prescriptions or treatment recommendations based on your medical needs.",
        },
        {
          q: "What should I prepare before a travel health consultation?",
          a: "It is helpful to have your travel plans, symptoms, medical history, current medications, allergies, and previous medical records available during your consultation.",
        },
        {
          q: "Can online consultations help with travel-related illnesses?",
          a: "Yes, healthcare professionals can assess symptoms, provide medical guidance, recommend treatment options, and advise whether in-person medical care is necessary.",
        },
        {
          q: "Can I access healthcare support before, during, and after travel?",
          a: "Yes, Travel & Global Care supports travelers throughout their journey with preventive guidance, medical consultations, and follow-up care when needed.",
        },
      ],
    },
    {
      label: "Patient Support & Safety",
      items: [
        {
          q: "Is my health information secure during international online consultations?",
          a: "Yes, Humancare Connect uses secure virtual healthcare technology and follows strict privacy practices to protect your personal health information.",
        },
        {
          q: "What are the benefits of virtual Travel & Global Care?",
          a: "Virtual Travel & Global Care offers convenience, timely medical guidance, easier access to healthcare professionals, and peace of mind during international travel.",
        },
        {
          q: "When should I seek emergency medical attention instead of a virtual consultation?",
          a: "You should seek immediate emergency care for severe injuries, difficulty breathing, chest pain, sudden serious illness, or any life-threatening medical emergency.",
        },
        {
          q: "Why choose Humancare Connect for Travel & Global Care?",
          a: "Humancare Connect provides secure online doctor consultations with trusted healthcare professionals, delivering convenient, reliable, and personalized healthcare support across borders.",
        },
      ],
    },
  ],

  ctaHeadline: "Healthcare Support Wherever Life Takes You",
  ctaBody:
    "Stay connected to trusted healthcare professionals before, during, and after travel. Get expert medical guidance, travel health advice, medication support, and ongoing care wherever you are in the world.",
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

      <Link to="/category-consultant?category=travel">
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

export default function TravelGlobalCare() {
  const navigate = useNavigate();
  const goToBooking = () =>
    navigate("/appointment-booking", { state: { categoryId: "travel" } });
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
          Online Travel & Global Healthcare | Virtual Doctor Consultation |
          Humancare Connect
        </title>
        <meta
          name="description"
          content="Access online travel and global healthcare with trusted healthcare professionals. Get virtual doctor consultations, travel health advice, international medical guidance, and personalized care anywhere."
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
              categoryCode="travel"
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
