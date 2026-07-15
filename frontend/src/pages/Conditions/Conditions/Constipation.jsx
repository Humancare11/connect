import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCategoryPrice } from "../../../hooks/useCategoryPrice";
import "./Condition.css";
import {
  Calendar,
  Star,
  Shield,
  ShieldCheck,
  Clock,
  Video,
  Pill,
  Heart,
  Activity,
  ChevronDown,
  ChevronRight,
  Phone,
  CheckCircle,
  AlertTriangle,
  Stethoscope,
  Brain,
  Zap,
  Users,
  Award,
  ArrowRight,
  MapPin,
  FileText,
  FlaskConical,
  Scan,
  Microscope,
  Thermometer,
  Wind,
  HeartPulse,
  Syringe,
  Eye,
  Bone,
  CircleDot,
  Smile,
  TrendingUp,
  MessageCircle,
  X,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────
// DATA  (swap this out per sub-page)
// ─────────────────────────────────────────────────────────────────
const pageData = {
  badge: "Urgent Care",
  heading: "Constipation",
  description: "Difficulty passing regular stools",
  trustItems: ["Same Day Visits", "Insurance Accepted", "Virtual Care"],
  bgImage:
    "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=1600&q=80",
};

const faqData = [
  {
    category: "Appointments",
    items: [
      {
        q: "How do I book a primary care appointment?",
        a: 'You can book online in under 60 seconds — just click "Book Appointment" at the top of the page, choose a date and time that works for you, and confirm. Same-day slots are often available.',
      },
      {
        q: "Can I see a doctor the same day?",
        a: "Yes. We reserve same-day slots every morning for acute concerns. If you log in before 10 AM, you'll typically find availability for that day.",
      },
      {
        q: "What should I bring to my first visit?",
        a: "Bring a valid photo ID, your insurance card, a list of any current medications, and any recent lab results or specialist notes if you have them.",
      },
    ],
  },
  {
    category: "Virtual Care",
    items: [
      {
        q: "How does an online consultation work?",
        a: "After booking, you'll receive a secure video link by email and SMS. At your appointment time, click the link — no app download required.",
      },
      {
        q: "What conditions can be treated virtually?",
        a: "Most common illnesses and follow-ups are well-suited to video care — colds, infections, skin concerns, mental health check-ins, and prescription renewals.",
      },
    ],
  },
  {
    category: "Costs & Insurance",
    items: [
      {
        q: "Do you accept my insurance?",
        a: "We work with most major insurance plans including Aetna, Cigna, UnitedHealth, BlueCross BlueShield, Humana, and Medicare.",
      },
      {
        q: "What is the consultation fee if I'm uninsured?",
        a: "Our self-pay consultation fee is $49 for a standard visit — this covers the appointment, any prescriptions written, a doctor's note if needed, and 24-hour follow-up support.",
      },
      {
        q: "Are referrals and lab orders included in the fee?",
        a: "Yes. Specialist referrals and lab test orders issued during your visit are included at no extra charge.",
      },
    ],
  },
  {
    category: "Your Health & Records",
    items: [
      {
        q: "How do I access my medical records?",
        a: "All visit notes, lab results, and prescription history are available in your secure patient portal within 24 hours of your appointment.",
      },
      {
        q: "Can my primary care doctor manage chronic conditions?",
        a: "Absolutely. Chronic disease management is one of our core services. Your physician will create a personalised care plan and coordinate with any specialists you see.",
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────
// ROOT EXPORT — everything inlined into one component, no sub-components
// ─────────────────────────────────────────────────────────────────
export default function Constipation() {
  const navigate = useNavigate();
  const price = useCategoryPrice();
  const [openId, setOpenId] = useState("0-0");
  const toggle = (id) => setOpenId((prev) => (prev === id ? null : id));

  return (
    <div className="condition-root">
      {/* ══════════════════════ HERO ══════════════════════ */}
      <section
        className="condition-hero"
        style={{
          backgroundImage: `
              linear-gradient(105deg, rgb(6 19 51 / 68%) 0%, rgba(10, 31, 68, 0.6) 30%, rgba(10, 31, 68, 0.57) 62%, rgba(10, 31, 68, 0.48) 100%),
              url(${pageData.bgImage})
              `,
          backgroundSize: "cover",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="condition-hero-wrap">
          <div className="condition-hero-inner">
            <span className="condition-badge-hero condition-hero-anim-badge">
              ✦ Trusted {pageData.badge}
            </span>

            <h1 className="condition-h1 condition-hero-anim-h1">
              {pageData.heading}
            </h1>

            <p className="condition-desc-hero condition-hero-anim-desc">
              {pageData.description}
            </p>

            <div className="condition-btns condition-hero-anim-btns">
              <a
                href="/appointment-booking"
                className="condition-btn condition-btn--primary"
              >
                <Calendar size={15} /> Book Appointment
              </a>
              <a href="#" className="condition-btn condition-btn--ghost">
                <Users size={15} /> Know More
              </a>
            </div>

            <div className="condition-trust condition-hero-anim-trust">
              {pageData.trustItems.map((item) => (
                <div key={item} className="condition-trust-item">
                  <CheckCircle size={13} className="condition-trust-check" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════ ABOUT + STICKY BOOKING ══════════════════════ */}
      <div className="condition-mid-section">
        <div className="condition-page-layout">
          <main>
            {/* ---- About Specialty ---- */}
            <div className="condition-glass-card">
              <div className="condition-glass-shine" />
              <div className="condition-about-grid">
                {/* LEFT */}
                <div className="condition-about-left">
                  <span className="condition-section-label condition-section-label--light">
                    About This Specialty
                  </span>
                  <h2 className="condition-about-h2">
                    Your Health,
                    <br />
                    Our Priority
                  </h2>

                  <div className="condition-nav-card">
                    <p className="condition-nav-label">Quick Access</p>
                    <div className="condition-nav-list">
                      {[
                        "Routine Wellness",
                        "Acute Illness",
                        "Chronic Conditions",
                        "Mental Wellbeing",
                      ].map((item) => (
                        <div key={item} className="condition-nav-item">
                          <ChevronRight
                            size={13}
                            className="condition-nav-chevron"
                          />
                          <span className="condition-nav-text">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="condition-stat-row">
                    <div className="condition-stat-pill">
                      <HeartPulse size={13} />
                      <span>15 K+ Patients</span>
                    </div>
                    <div className="condition-stat-pill">
                      <ShieldCheck size={13} />
                      <span>98% Satisfaction</span>
                    </div>
                  </div>
                </div>

                {/* RIGHT */}
                <div className="condition-about-right">
                  <div>
                    <h3 className="condition-block-title">
                      What is Constipation?
                    </h3>
                    <p className="condition-block-body">
                      Constipation can cause bloating, stomach discomfort, hard
                      stools, abdominal pain, and infrequent bowel movements
                      that affect your daily routine.
                    </p>
                  </div>

                  <div>
                    <h3 className="condition-block-title">How?</h3>
                    <p className="condition-block-body">
                      Humancare Connect makes it simple to get care for
                      constipation symptoms from home. Our telemedicine services
                      let you schedule an online doctor appointment with a
                      licensed provider who can help identify possible causes,
                      recommend treatment options, and provide prescriptions
                      when appropriate through our secure telemedicine platform.
                    </p>
                  </div>

                  <div>
                    <h3 className="condition-block-title">
                      Get digestive relief in 4 simple steps
                    </h3>
                    <div className="condition-benefits-grid">
                      {[
                        "Select Constipation care",
                        "Share your symptoms and health history",
                        "Connect with an online provider",
                        "Receive treatment guidance and personalized care recommendations",
                      ].map((b) => (
                        <div key={b} className="condition-benefit-item">
                          <CheckCircle
                            size={14}
                            className="condition-benefit-check"
                          />
                          <span>{b}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>

          <aside>
            {/* ---- Sticky Booking Card ---- */}
            <div className="condition-sbc">
              <div className="condition-sbc-badge">
                <span className="condition-sbc-dot" />
                Doctors Available Now
              </div>

              <div className="condition-sbc-price-block">
                <div className="condition-sbc-price">${price ?? 49}</div>
                <p className="condition-sbc-price-sub">
                  One-time consultation fee · No subscription required
                </p>
              </div>

              <div className="condition-sbc-info">
                <Shield size={15} className="condition-sbc-info-icon" />
                <p className="condition-sbc-info-text">
                  No extra fee for doctor notes, prescriptions, or specialist
                  referrals.{" "}
                  <strong className="condition-sbc-info-strong">
                    Everything is included.
                  </strong>
                </p>
              </div>

              <div className="condition-sbc-features">
                {[
                  "Board-certified physician",
                  "Rx to your pharmacy",
                  "Doctor's note included",
                  "24hr follow-up support",
                  "HIPAA secure session",
                ].map((item, i) => (
                  <div
                    key={item}
                    className="condition-sbc-row"
                    style={{ animationDelay: `${0.35 + i * 0.07}s` }}
                  >
                    <CheckCircle size={15} className="condition-sbc-check" />
                    <span className="condition-sbc-feat-text">{item}</span>
                  </div>
                ))}
              </div>

              <button className="condition-sbc-cta" onClick={() => navigate("/category-consultant?category=general&condition=Constipation")}>
                Start Consultation →
              </button>
              <p className="condition-sbc-terms">
                By continuing, you agree to our{" "}
                <a href="#" className="condition-sbc-link">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="condition-sbc-link">
                  Privacy Policy
                </a>
              </p>
            </div>
          </aside>
        </div>
      </div>

      {/* ══════════════════════ FAQ ══════════════════════ */}
      <section className="condition-section--faq">
        <div className="condition-container">
          <div className="condition-faq-layout">
            {/* Sidebar */}
            <div className="condition-faq-sidebar">
              <span className="condition-section-label condition-section-label--light">
                FAQ
              </span>
              <h2 className="condition-faq-title">
                Frequently Asked
                <br />
                Questions
              </h2>
              <p className="condition-faq-desc">
                Everything you need to know about primary care at HumanCare
                Connect. Can't find an answer?
              </p>
              <button className="condition-faq-chat">
                <MessageCircle size={18} /> Chat with our team
              </button>
              <div className="condition-faq-stat">
                ⚡ Avg. response in 2 min
              </div>
              <div className="condition-faq-stat">
                🔒 HIPAA secure &amp; private
              </div>
              <div className="condition-faq-stat">
                🌍 Available in all 50 states
              </div>
            </div>

            {/* Content */}
            <div className="condition-faq-content">
              {faqData.map((cat, ci) => (
                <div key={cat.category} className="condition-faq-card">
                  <div className="condition-faq-cat">
                    <span className="condition-faq-dot" />
                    {cat.category}
                  </div>
                  {cat.items.map((item, ii) => {
                    const id = `${ci}-${ii}`;
                    return (
                      <div key={id} className="condition-faq-item">
                        <button
                          className="condition-faq-q"
                          onClick={() => toggle(id)}
                        >
                          <span>{item.q}</span>
                          <div
                            className={`condition-faq-icon ${openId === id ? "condition-active" : ""}`}
                          >
                            +
                          </div>
                        </button>
                        <div
                          className={`condition-faq-ans ${openId === id ? "condition-open" : ""}`}
                        >
                          <p>{item.a}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              <div className="condition-faq-bottom-cta">
                <div>
                  <h3>Still have questions?</h3>
                  <p>Our care team is available every day, 8 AM – 10 PM.</p>
                </div>
                <a href="/appointment-booking">
                  <button>
                    Book a Call <ArrowRight size={18} />
                  </button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
