import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  headlineAccent: " When You Need It ",
  subheadline:
    "Connect with experienced healthcare professionals for common illnesses, routine health concerns, preventive care, and everyday medical guidance. Our convenient online doctor consultations make it easier to receive personalized, patient-centered care that fits your lifestyle.",
  bookingSpecialtyPlaceholder: "e.g. General Physician",

  specialties: [
    {
      name: "Family Medicine",
      desc: "Family Medicine specialists provide continuous, personalized healthcare for individuals and families of all ages.   ",
      path: "/family-medicine",
    },
    {
      name: "General Physician (GP)",
      desc: "General Physicians (GPs) provide comprehensive primary healthcare for common illnesses, preventive care, and ongoing health management. ",
      path: "/general-physician",
    },
    {
      name: "Internal Medicine",
      desc: "Internal Medicine specialists focus on the prevention, diagnosis, and treatment of adult health conditions, ranging from routine wellness care to complex medical concerns involving multiple body systems.",
      path: "/internal-medicine",
    },
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
      name: "Routine Check-Ups",
      desc: "Ongoing care for everyday health",
      path: "/routine-check-ups",
    },
    {
      name: "Vaccination Advice",
      desc: "Guidance for recommended immunizations",
      path: "/vaccination-advice",
    },
    {
      name: "Whole-Family Illnesses",
      desc: "Care for illnesses affecting families",
      path: "/whole-family-illnesses",
    },
    // {
    //   name: "Nasal Congestion",
    //   desc: "Relief for a blocked nose",
    //   path: "/nasal-congestion",
    // },
    // {
    //   name: "Sore Throat",
    //   desc: "Pain, irritation, or a scratchy throat",
    //   path: "/sore-throat",
    // },
    // {
    //   name: "Tonsillitis",
    //   desc: "Relief for sore throat and swollen tonsils",
    //   path: "/tonsillitis",
    // },
    // {
    //   name: "Vertigo",
    //   desc: "Spinning sensation and balance issues",
    //   path: "/vertigo",
    // },

    // {
    //   name: "Pediatric Fever",
    //   desc: "Fever and illness in children",
    //   path: "/pediatric-fever",
    // },
    // {
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

function BookingForm({ specialtyPlaceholder }) {
  const [form, setForm] = useState({
    name: "", phone: "", date: "", time: "", type: "", specialty: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

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
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8, lineHeight: 1.6 }}>
          We'll confirm your slot via call or SMS within 15 minutes.
        </p>
      </div>
    );
  }

  return (
    <div className="hcc-book-card">
      <div className="hcc-book-title">Book an Appointment</div>
      <p className="hcc-book-sub">Same-day slots often available</p>
      <div className="hcc-form-group">
        <label className="hcc-form-label">Full Name</label>
        <input className="hcc-form-input" placeholder="Your full name" value={form.name} onChange={(e) => set("name", e.target.value)} />
      </div>
      <div className="hcc-form-group">
        <label className="hcc-form-label">Phone Number</label>
        <input className="hcc-form-input" placeholder="+91 98765 43210" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
      </div>
      <div className="hcc-form-row">
        <div className="hcc-form-group">
          <label className="hcc-form-label">Date</label>
          <input className="hcc-form-input" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
        </div>
        <div className="hcc-form-group">
          <label className="hcc-form-label">Time</label>
          <div className="hcc-select-wrap">
            <select className="hcc-form-select" value={form.time} onChange={(e) => set("time", e.target.value)}>
              <option value="">Select</option>
              <option>Morning (9–12)</option>
              <option>Afternoon (12–4)</option>
              <option>Evening (4–8)</option>
            </select>
          </div>
        </div>
      </div>
      <div className="hcc-form-group">
        <label className="hcc-form-label">Consultation Type</label>
        <div className="hcc-select-wrap">
          <select className="hcc-form-select" value={form.type} onChange={(e) => set("type", e.target.value)}>
            <option value="">Select type</option>
            <option>Video Consultation</option>
            <option>In-Person Visit</option>
          </select>
        </div>
      </div>
      <div className="hcc-form-group">
        <label className="hcc-form-label">Specialty (optional)</label>
        <input className="hcc-form-input" placeholder={specialtyPlaceholder || "e.g. Specialist"} value={form.specialty} onChange={(e) => set("specialty", e.target.value)} />
      </div>
      <button className="hcc-book-submit" onClick={handleSubmit}>
        <FiCalendar /> Confirm Appointment
      </button>
      <p className="hcc-book-note">
        <FiShield size={11} /> Free cancellation up to 2 hours before
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
            Everything you need to know about {catLabel} care at HumanCare Connect. Can't find an answer?
          </p>
          <button className="hcc-faq-chat-btn">
            <span className="chat-icon"><FiMessageSquare size={10} /></span>
            Chat with our team
          </button>
          <div className="hcc-faq-trust-badges">
            <div className="hcc-faq-trust-badge">
              <span className="badge-icon">⚡</span>
              <div><strong>Avg. response in 2 min</strong><div>Live chat available</div></div>
            </div>
            <div className="hcc-faq-trust-badge">
              <span className="badge-icon">🏥</span>
              <div><strong>HIPAA secure &amp; private</strong><div>Your data is protected</div></div>
            </div>
            <div className="hcc-faq-trust-badge">
              <span className="badge-dot" />
              <div><strong>Available on all devices</strong><div>Web, iOS &amp; Android</div></div>
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
                    <div key={fi} className={`hcc-faq-item${isOpen ? " open" : ""}`}>
                      <button className="hcc-faq-btn" onClick={() => toggle(key)}>
                        <span className="hcc-faq-question">{faq.q}</span>
                        <span className="hcc-faq-toggle">
                          {isOpen ? <FiMinus size={12} /> : <FiPlus size={12} />}
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

          <div className="hcc-faq-still">
            <div className="hcc-faq-still-text">
              <strong>Still have questions?</strong>
              Our care team is available every day, 8 AM – 10 PM.
            </div>
            <button className="hcc-faq-call-btn">
              <FiPhone size={13} /> Book a Call
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function GeneralEverydayCare() {
  const navigate = useNavigate();
  const goToBooking = () => navigate("/appointment-booking");

  return (
    <div style={{ fontFamily: "'Satoshi', sans-serif", background: "var(--bg)", color: "var(--navy)", minHeight: "100vh" }}>

      <Helmet>
        <title>Online General & Everyday Care | Virtual Doctor Consultation | Humancare Connect
        </title>
        <meta name="description" content=" Access online general and everyday care with trusted healthcare professionals. Get virtual doctor consultations for common illnesses, preventive care, symptoms, and personalized medical guidance from home.
" />
      </Helmet>

      {/* ── Hero ── */}
      <section className="hcc-hero">
        <div className="hcc-hero-overlay" />
        <div className="hcc-hero-deco-1" />
        <div className="hcc-hero-deco-2" />
        <FiHeart className="hcc-hero-icon" style={{ top: 48, right: 420, fontSize: 48 }} />
        <FiShield className="hcc-hero-icon" style={{ bottom: 60, right: 500, fontSize: 36 }} />
        <FiActivity className="hcc-hero-icon" style={{ top: 140, right: 340, fontSize: 30 }} />
        <FiCheckCircle className="hcc-hero-icon" style={{ bottom: 120, right: 420, fontSize: 28 }} />

        <div className="hcc-inner">
          <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <div className="hcc-badge">
              <span className="hcc-badge-dot" />
              Trusted {cat.label}
            </div>
            <h1 className="hcc-headline">
              {cat.headline}
              <br />
              <span style={{ color: "var(--blue-lt)" }}>{cat.headlineAccent}</span>
            </h1>
            <p className="hcc-subline">{cat.subheadline}</p>
            <div className="hcc-cta-row">
              <button className="hcc-btn-primary" onClick={goToBooking}><FiCalendar /> Book Appointment</button>
              <button className="hcc-btn-secondary" onClick={goToBooking}><FiUser size={15} /> Know More</button>
            </div>
            <div className="hcc-trust-row">
              <div className="hcc-trust-item"><FiCheckCircle size={14} /> Same Day Visits</div>
              <div className="hcc-trust-item"><FiShield size={14} /> Insurance Accepted</div>
              <div className="hcc-trust-item"><FiVideo size={14} /> Virtual Care</div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.15 }}>
            <BookingForm specialtyPlaceholder={cat.bookingSpecialtyPlaceholder} />
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
            <p className="hcc-section-sub">All {cat.label} specialties available on Humancare Connect.</p>
            <div className="hcc-specialty-grid">
              {cat.specialties.map((sp, i) => <SpecialtyCard key={i} sp={sp} index={i} />)}
            </div>
          </section>
        )}

        {/* Conditions */}
        {cat.conditions?.length > 0 && (
          <section className="hcc-section">
            <span className="hcc-section-eyebrow">Conditions</span>
            <h2 className="hcc-section-title">Conditions We Treat</h2>
            <p className="hcc-section-sub">Click on any condition to learn more.</p>
            <div className="hcc-condition-grid">
              {cat.conditions.map((cond, i) => <ConditionCard key={cond.name} cond={cond} index={i} />)}
            </div>
          </section>
        )}

        {/* Treatments */}
        {cat.treatments?.length > 0 && (
          <section className="hcc-section">
            <span className="hcc-section-eyebrow">Care Options</span>
            <h2 className="hcc-section-title">Treatment & Care Pathways</h2>
            <p className="hcc-section-sub">Multiple ways to access quality care for your child, on your terms.</p>
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
            <button className="hcc-btn-primary" style={{ background: "#fff", color: "var(--blue)", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }} onClick={goToBooking}>
              Find Doctors <FiArrowRight />
            </button>
            <button className="hcc-btn-secondary" style={{ borderColor: "rgba(255,255,255,0.35)" }} onClick={goToBooking}>
              <FiPhone size={14} /> Call Us Now
            </button>
          </div>
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="hcc-mobile-cta">
        <button className="hcc-btn-primary" style={{ flex: 1, justifyContent: "center", borderRadius: 12 }} onClick={goToBooking}>
          Book Appointment
        </button>
      </div>

    </div>
  );
}