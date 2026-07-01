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
  label: "Sexual Health",
  tagline: "Sexual Health",
  headline: "Confidential Sexual Health Care, ",
  headlineAccent: " Designed Around Your Needs",
  subheadline:
    "Connect with experienced healthcare professionals for personalized sexual health support, intimate health concerns, preventive care, and medical guidance through secure online doctor consultations.",
  bookingSpecialtyPlaceholder: "e.g. Sexual Health",

  specialties: [
    {
      name: " Sexual Health",
      desc: " Confidential care for STI concerns, HIV prevention, PrEP guidance, herpes, chlamydia, gonorrhea, partner exposure risks, and overall sexual wellness. ",
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
      name: "Chlamydia",
      desc: "Common sexually transmitted bacterial infection",
      path: "/chlamydia",
    },
    {
      name: "Gonorrhea",
      desc: "Common bacterial sexually transmitted infection",
      path: "/gonorrhea",
    },
    {
      name: "Herpes",
      desc: "Viral infection causing painful sores",
      path: "/herpes",
    },
    {
      name: "HIV Prevention / PrEP Guidance",
      desc: "Preventive care for HIV protection",
      path: "/HIV-prevention",
    },
    {
      name: "Partner Exposure Concerns",
      desc: "Concerns after sexual exposure",
      path: "/partner-exposure-concerns",
    },
    {
      name: "Safe Sex Counseling",
      desc: "Guidance for healthier intimate relationships",
      path: "/safe-sex-counseling",
    },
    {
      name: "STI Consultation",
      desc: "Testing, treatment, and sexual health support",
      path: "/STI-consultation",
    },

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
  label: "Sexual Health",
  items: [
    {
      q: "What is sexual health care?",
      a: "Sexual health care focuses on maintaining physical, emotional, and reproductive well-being related to sexuality. It includes prevention, diagnosis, treatment guidance, and support for a wide range of sexual health concerns.",
    },
    {
      q: "What sexual health concerns can be discussed during an online consultation?",
      a: "Virtual consultations can help address concerns such as sexually transmitted infections (STIs), changes in sexual function, discomfort during intimacy, reproductive health questions, and other sexual wellness concerns.",
    },
    {
      q: "Can I talk to a doctor online about sexually transmitted infections (STIs)?",
      a: "Yes, healthcare professionals can discuss STI symptoms, risk factors, testing recommendations, treatment options, and steps to protect your sexual health.",
    },
    {
      q: "Is online sexual health care private and confidential?",
      a: "Yes, Humancare Connect prioritizes patient confidentiality and uses secure virtual healthcare technology to protect your personal health information.",
    },
    {
      q: "Can I receive treatment recommendations for sexual health concerns?",
      a: "Yes, healthcare professionals can evaluate symptoms, provide medical guidance, and recommend appropriate treatment options when necessary.",
    },
    {
      q: "Can I discuss concerns about sexual performance or desire?",
      a: "Yes, online consultations provide a private, judgment-free space to discuss concerns related to sexual desire, performance, satisfaction, and overall sexual wellness.",
    },
    {
      q: "Can virtual consultations help with erectile dysfunction or other sexual function concerns?",
      a: "Yes, healthcare professionals can assess symptoms, discuss possible causes, and recommend appropriate treatment options or next steps for sexual function concerns.",
    },
    {
      q: "Can I get advice about safe sex and sexual wellness?",
      a: "Yes, healthcare professionals can provide education on safe sexual practices, contraception, STI prevention, and maintaining healthy sexual relationships.",
    },
    {
      q: "What should I prepare before a sexual health consultation?",
      a: "Be ready to discuss your symptoms, medical history, medications, sexual health concerns, and any questions you want to ask your healthcare professional.",
    },
    {
      q: "Can I discuss birth control or contraception during an online consultation?",
      a: "Yes, healthcare professionals can guide you on birth control methods, contraception options, and help determine what may be suitable for your needs.",
    },
    {
      q: "Can online consultations help with pain or discomfort during intimacy?",
      a: "Yes, doctors can evaluate symptoms, identify possible causes, and recommend appropriate care or further medical evaluation if needed.",
    },
    {
      q: "Can I receive prescriptions through an online sexual health consultation?",
      a: "When medically appropriate and permitted by applicable regulations, healthcare professionals may provide prescriptions or treatment recommendations based on your condition.",
    },
    {
      q: "How often should I get sexual health checkups?",
      a: "The frequency of sexual health screenings depends on your age, medical history, sexual activity, and individual risk factors as advised by your healthcare professional.",
    },
    {
      q: "Can I seek a second opinion for a sexual health condition?",
      a: "Yes, Humancare Connect allows you to connect with experienced healthcare professionals for additional medical guidance and expert opinions.",
    },
    {
      q: "Are sexual health concerns common?",
      a: "Yes, sexual health concerns are common and can affect people of different ages. Consulting a healthcare professional can help you understand symptoms and treatment options.",
    },
    {
      q: "What are the benefits of virtual sexual health care?",
      a: "Virtual sexual health consultations provide privacy, convenience, easy access to healthcare professionals, and a comfortable environment to discuss sensitive concerns.",
    },
    {
      q: "When should I seek immediate medical attention instead of an online consultation?",
      a: "You should seek urgent in-person medical care for severe pain, heavy bleeding, serious injuries, or any symptoms that require emergency evaluation.",
    },
    {
      q: "Why choose Humancare Connect for sexual health care?",
      a: "Humancare Connect provides secure online consultations with trusted healthcare professionals, offering confidential, compassionate, and personalized sexual healthcare support.",
    },
  ],
}
],

ctaHeadline: "Care That Supports Your Mind & Body",

ctaBody:
  "Get trusted online support for everyday healthcare needs and mental wellness through secure consultations with experienced healthcare professionals. Whether it's physical symptoms or emotional well-being, we're here to help you feel better, every day.",

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

export default function  SexualHealth() {
  const navigate = useNavigate();
  const goToBooking = () => navigate("/appointment-booking");
  const goToContact = () => navigate("/contact");

  return (
    <div style={{ fontFamily: "'Satoshi', sans-serif", background: "var(--bg)", color: "var(--navy)", minHeight: "100vh" }}>

      <Helmet>
        <title>Online Sexual Health Care | Confidential Doctor Consultation | Humancare Connect

        </title>
        <meta name="description" content=" Online Sexual Health Care | Confidential Doctor Consultation | Humancare Connect " />
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
              <button className="hcc-btn-secondary" onClick={goToContact}><FiUser size={15} /> Know More</button>
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
            <button className="hcc-btn-secondary" style={{ borderColor: "rgba(255,255,255,0.35)" }} onClick={goToContact}>
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