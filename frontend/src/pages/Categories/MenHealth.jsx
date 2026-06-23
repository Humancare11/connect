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
  label: "Men's Health",
  tagline: "Men's Health",
  headline: "Comprehensive Men's Health Care,",
  headlineAccent: " Designed Around Your Well-Being ",
  subheadline:
    "Connect with experienced healthcare professionals for personalized men's health services, preventive care, sexual wellness, hormonal health concerns, and everyday medical guidance through secure online doctor consultations.",
  bookingSpecialtyPlaceholder: "e.g.Men's Health",

  specialties: [
    {
      name: "Men's Health",
      desc: "Family Medicine specialists provide continuous, personalized healthcare for individuals and families of all ages.   ",
      path: "/men-health",
    },
    {
      name: "Urology",
      desc: "Urology specialists diagnose and treat conditions affecting the urinary tract, kidneys, bladder, and male reproductive system. ",
      path: "/urology",
    },
    // {
    //   name: "Internal Medicine",
    //   desc: "Internal Medicine specialists focus on the prevention, diagnosis, and treatment of adult health conditions, ranging from routine wellness care to complex medical concerns involving multiple body systems.",
    //   path: "/internal-medicine",
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
      name: "Erectile Dysfunction",
      desc: "Difficulty getting or maintaining erections",
      path: "/erectile-dysfunction",
    },
    {
      name: "Hair Loss",
      desc: "Thinning hair and excessive shedding",
      path: "/hair-loss",
    },
    {
      name: "Low Libido",
      desc: "Support for changes in sexual desire",
      path: "/low-libido",
    },
    {
      name: "Low Testosterone Symptoms",
      desc: "Low hormone levels affecting energy",
      path: "/low-testosterone-symptoms",
    },
    {
      name: "Prostate Health",
      desc: "Common concerns affecting prostate function",
      path: "/prostate-health",
    },
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
    label: "Men's Health Care",
    items: [
      {
        q: "What is men's health care?",
        a: "Men's health care focuses on preventing, diagnosing, and managing health concerns that commonly affect men, including physical health, sexual wellness, hormonal balance, and overall well-being.",
      },
      {
        q: "What men's health concerns can be discussed during an online consultation?",
        a: "Virtual consultations can address concerns such as erectile dysfunction, low testosterone symptoms, hair loss, urinary issues, sexual health concerns, stress, fatigue, and general health questions.",
      },
      {
        q: "Can I talk to a doctor online about erectile dysfunction?",
        a: "Yes, healthcare professionals can discuss erectile dysfunction symptoms, possible causes, available treatment options, and recommend the appropriate next steps based on your health needs.",
      },
      {
        q: "Can online doctors help with low testosterone concerns?",
        a: "Yes, doctors can evaluate symptoms related to hormonal changes, recommend appropriate testing when necessary, and provide medical guidance for managing testosterone-related concerns.",
      },
      {
        q: "Can I receive treatment recommendations for hair loss?",
        a: "Yes, healthcare professionals can assess hair thinning or hair loss concerns, discuss potential causes, and recommend suitable treatment options.",
      },
    ],
  },

  {
    label: "Sexual & Urinary Health",
    items: [
      {
        q: "Can I discuss urinary problems during a virtual consultation?",
        a: "Yes, online doctor consultations can help address concerns such as frequent urination, painful urination, difficulty urinating, or changes in urinary habits.",
      },
      {
        q: "Can I discuss sexual health concerns online?",
        a: "Yes, virtual consultations provide a private and comfortable environment to discuss sexual wellness concerns, performance issues, sexually transmitted infections, and other intimate health questions.",
      },
      {
        q: "Can online consultations help with stress, fatigue, and low energy?",
        a: "Yes, doctors can evaluate ongoing fatigue, stress, changes in energy levels, and related health concerns to identify possible causes and recommend appropriate care.",
      },
      {
        q: "Can I discuss healthy aging and age-related concerns?",
        a: "Yes, healthcare professionals can provide guidance on healthy aging, hormonal changes, energy levels, sexual wellness, and maintaining overall health as you age.",
      },
    ],
  },

  {
    label: "Consultations & Treatment",
    items: [
      {
        q: "Can online men's health consultations help with preventive care?",
        a: "Yes, healthcare professionals can provide preventive health guidance, wellness recommendations, health screening advice, and lifestyle support to maintain long-term health.",
      },
      {
        q: "What should I prepare before a men's health consultation?",
        a: "Prepare details about your symptoms, medical history, current medications, previous test results, and any health concerns you would like to discuss with your healthcare professional.",
      },
      {
        q: "Can I get a second opinion for a men's health condition?",
        a: "Yes, Humancare Connect provides access to experienced healthcare professionals who can offer additional medical guidance and expert opinions.",
      },
      {
        q: "Can I receive prescriptions through an online consultation?",
        a: "When medically appropriate and permitted by applicable regulations, healthcare professionals may provide prescriptions or treatment recommendations based on your condition.",
      },
      {
        q: "Are virtual men's health consultations suitable for routine health concerns?",
        a: "Yes, virtual healthcare is a convenient option for discussing everyday health concerns, preventive care, and general medical questions.",
      },
      {
        q: "How can I schedule an appointment with a men's health specialist?",
        a: "You can book an appointment online and connect with a qualified men's health specialist through virtual or in-person care options.",
      },
    ],
  },

  {
    label: "Patient Support & Privacy",
    items: [
      {
        q: "Is online men's health care private and confidential?",
        a: "Yes, Humancare Connect prioritizes patient confidentiality and uses secure virtual healthcare technology to protect personal health information.",
      },
      {
        q: "How quickly can I connect with a healthcare professional?",
        a: "Humancare Connect provides convenient access to healthcare professionals, helping patients receive timely medical guidance without unnecessary waiting.",
      },
      {
        q: "What are the benefits of virtual men's health care?",
        a: "Virtual men's health care offers convenience, privacy, personalized medical support, easier access to healthcare professionals, and quality care from the comfort of your home.",
      },
      {
        q: "Why choose Humancare Connect for men's health care?",
        a: "Humancare Connect provides secure online doctor consultations with trusted healthcare professionals, delivering confidential, compassionate, and patient-centered care designed around men's unique healthcare needs.",
      },
    ],
  },
],

ctaHeadline: "Confidential Men's Healthcare, Wherever You Are",

ctaBody:
  "Connect with experienced healthcare professionals for men's health concerns, sexual wellness, hormonal health, preventive care, healthy aging, and ongoing support through secure online consultations designed around your needs.",
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

export default function MenHealth() {
  const navigate = useNavigate();
  const goToBooking = () => navigate("/appointment-booking");

  return (
    <div style={{ fontFamily: "'Satoshi', sans-serif", background: "var(--bg)", color: "var(--navy)", minHeight: "100vh" }}>

      <Helmet>
        <title> Online Men's Health Care | Virtual Doctor Consultation | Humancare Connect

        </title>
        <meta name="description" content=" Access online men's health care with trusted healthcare professionals. Get virtual doctor consultations for sexual wellness, hormonal health, hair loss, preventive care, and personalized medical guidance.

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