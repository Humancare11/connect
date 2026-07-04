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
  label: "Women's Mental Health",
  tagline: "Compassionate Mental Health Support for Every Stage of Womanhood.",
  headline: "Compassionate Mental Health Support  ",
  headlineAccent: "for Every Stage of Womanhood. ",
  subheadline:
    "Women's Mental Health focuses on the emotional, psychological, and behavioral challenges that may occur throughout different stages of life, including menstruation, pregnancy, postpartum recovery, and hormonal transitions. Our specialists provide personalized support designed to help women navigate mental health concerns with confidence and care.",
  bookingSpecialtyPlaceholder: "e.g.Lifestyle Medicine",

  specialties: [
    {
      name: " Lactation Consulting ",
      desc: "Expert breastfeeding support for latch difficulties, low milk supply, nipple pain, pumping guidance, infant feeding concerns, weaning transitions, and postpartum feeding success.",
      path: "/lactation-consulting ",
    },
    {
      name: " Menopause Care  ",
      desc: " Personalized support for menopause symptoms, hot flashes, night sweats, hormone replacement therapy (HRT) guidance, sleep disturbances, mood changes, vaginal health, and healthy aging.",
      path: "/menopause-care ",
    },
    {
      name: "Obstetrics & Gynaecology (OB-GYN)  ",
      desc: " Comprehensive women's healthcare for PCOS, fertility concerns, pregnancy support, birth control consultations, menstrual health, pelvic pain, vaginal infections, hormonal balance, and reproductive wellness.",
      path: "/obstetrics-gynaecology",
    },
    {
      name: " Women's Health ",
      desc: " Personalized care for menstrual health, hormonal concerns, fertility support, pregnancy guidance, menopause management, reproductive wellness, birth control consultations, and preventive women's healthcare.",
      path: "/weight-management",
    },
  ],

  conditions: [
    {
      name: "Latch Problems",
      desc: "Help for successful breastfeeding",
      path: "/latch-problems",
    },
    {
      name: "Low Milk Supply",
      desc: "Support for breastfeeding concerns",
      path: "/low-milk-supply",
    },
    {
      name: "Hot Flashes",
      desc: "Relief from sudden heat episodes",
      path: "/hot-flashes",
    },
    {
      name: "HRT Guidance",
      desc: "Personalized support for hormone therapy",
      path: "/HRT-guidance",
    },
    {
      name: "Perinatal Anxiety",
      desc: "Support during pregnancy and beyond.",
      path: "/perinatal-anxiety",
    },
    {
      name: "PMDD",
      desc: "Support for severe premenstrual symptoms",
      path: "/PMDD",
    },
    // {
    //   name: "Pediatric Cold & Flu",
    //   desc: "Cold and flu symptoms in children",
    //   path: "/pediatric-cold-flu",
    // },
    // {
    //   name: "Pediatric Fever",
    //   desc: "Fever and illness in children",
    //   path: "/pediatric-fever",
    // },
    // {
    //   name: "Skin Rash in Children",
    //   desc: "Red, itchy, irritated skin in kids",
    //   path: "/skin-rash-in-children",
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
      label: "Women's Mental Health",
      items: [
        {
          q: "What is women's mental health?",
          a: "Women's mental health focuses on emotional and psychological well-being throughout different stages of a woman's life, including reproductive, hormonal, and life transitions.",
        },
        {
          q: "Can hormonal changes affect mental health?",
          a: "Yes. Hormonal fluctuations may influence mood, emotions, sleep patterns, stress levels, and overall mental well-being.",
        },
        {
          q: "When should I seek support for emotional symptoms?",
          a: "Professional support may be beneficial whenever emotional symptoms interfere with daily activities, relationships, work, or overall quality of life.",
        },
        {
          q: "Can telehealth be used for women's mental health care?",
          a: "Yes. Many mental health consultations, therapy sessions, and follow-up appointments can be conducted through secure virtual healthcare services.",
        },
      ],
    },

    {
      label: "Pregnancy & Postpartum Mental Health",
      items: [
        {
          q: "What is perinatal anxiety?",
          a: "Perinatal anxiety refers to excessive worry, fear, or anxiety experienced during pregnancy or after childbirth.",
        },
        {
          q: "Can anxiety occur during pregnancy?",
          a: "Yes. Many women experience anxiety symptoms during pregnancy and the postpartum period due to physical, emotional, and lifestyle changes.",
        },
        {
          q: "What is postpartum depression?",
          a: "Postpartum depression is a mental health condition that may develop after childbirth and affect mood, energy levels, emotional well-being, and daily functioning.",
        },
        {
          q: "What are common signs of postpartum depression?",
          a: "Symptoms may include persistent sadness, low mood, emotional distress, fatigue, loss of interest in activities, and difficulty coping with daily responsibilities.",
        },
        {
          q: "Is postpartum depression common?",
          a: "Postpartum emotional challenges affect many individuals and should be addressed with professional support whenever symptoms become difficult to manage.",
        },
      ],
    },

    {
      label: "Hormonal & Mood Concerns",
      items: [
        {
          q: "What is PMDD?",
          a: "Premenstrual Dysphoric Disorder (PMDD) is a severe form of premenstrual mood symptoms that can significantly affect emotional well-being and daily life.",
        },
        {
          q: "Is PMDD different from PMS?",
          a: "Yes. PMDD typically involves more severe emotional, psychological, and behavioral symptoms than typical Premenstrual Syndrome (PMS).",
        },
        {
          q: "Can sleep problems affect mental health?",
          a: "Yes. Poor sleep may contribute to emotional challenges, mood symptoms, anxiety, stress, and reduced overall well-being.",
        },
        {
          q: "Can parenting stress affect emotional well-being?",
          a: "Yes. Parenting responsibilities, life transitions, and daily demands can contribute to emotional stress and mental health concerns.",
        },
      ],
    },

    {
      label: "Treatment & Support",
      items: [
        {
          q: "How can therapy help with women's mental health concerns?",
          a: "Therapy can provide coping strategies, emotional support, stress management techniques, and practical tools for managing mental health symptoms.",
        },
        {
          q: "What happens during a women's mental health consultation?",
          a: "A healthcare professional reviews your symptoms, medical history, concerns, and goals to create a personalized care and support plan.",
        },
        {
          q: "How long does treatment typically last?",
          a: "Treatment duration varies based on individual symptoms, treatment goals, response to care, and personal healthcare needs.",
        },
        {
          q: "Can I receive ongoing support through virtual consultations?",
          a: "Yes. Many women benefit from ongoing virtual mental health consultations that provide consistent support, monitoring, and follow-up care.",
        },
      ],
    },
  ],

  ctaHeadline: "Compassionate Support for Every Stage of a Woman's Life",

  ctaBody:
    "Connect with trusted mental health professionals for support with anxiety, postpartum depression, PMDD, emotional wellness, hormonal changes, and life's transitions through secure and confidential online consultations.",
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
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const [price, setPrice] = useState(null);
  const [priceLoading, setPriceLoading] = useState(true);

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

export default function WomenHealth() {
  const navigate = useNavigate();
  const goToBooking = () =>
    navigate("/appointment-booking", { state: { categoryId: "women" } });
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
          Women's Mental Health Specialists | Anxiety, PMDD & Postpartum Mental
          Health Support
        </title>
        <meta
          name="description"
          content="Connect with women's mental health specialists for PMDD, perinatal anxiety, postpartum depression, hormonal mood changes, emotional wellness support, and personalized mental healthcare.
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
