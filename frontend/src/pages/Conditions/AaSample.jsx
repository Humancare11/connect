import { useNavigate } from "react-router-dom";
import { useCategoryPrice } from "../../hooks/useCategoryPrice";
import "./Conditions/Condition.css";
import {
  Calendar,
  Shield,
  ShieldCheck,
  ChevronRight,
  CheckCircle,
  HeartPulse,
  Users,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────
// DATA  (swap this out per sub-page)
// ─────────────────────────────────────────────────────────────────

// CHANGES ONE TITLE AND ONE LINE DESCRIPTION
const pageData = {
  badge: "Primary Care",
  heading: "Comprehensive Care For Every Stage Of Life",
  description:
    "Personalized healthcare focused on prevention, diagnosis, treatment and long-term wellness. Connect with experienced physicians dedicated to keeping you and your family healthy.",
  trustItems: ["Same Day Visits", "No Insurance Required", "Virtual Care"],
  bgImage:
    "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=1600&q=80",
};

// ─────────────────────────────────────────────────────────────────
// ROOT EXPORT — everything inlined into one component, no sub-components
// NOTE: This is a template/sample file (no SEO component, no
// ConditionBannerImage import, generic placeholder content) used as a
// starting point when creating new condition pages — see migration report.
// ─────────────────────────────────────────────────────────────────
export default function AaSample() {
  const navigate = useNavigate();
  const price = useCategoryPrice();

  return (
    <>
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
                      {/* CHANGE 2 PARAGRAPH CONTENT */}
                      <h3 className="condition-block-title">
                        What Is Primary Care?
                      </h3>
                      <p className="condition-block-body">
                        Primary care is the foundation of the healthcare system
                        — providing comprehensive, continuous medical care
                        across all ages, genders, and conditions. Your primary
                        care physician acts as a personal health advocate,
                        coordinating specialist care and managing preventive
                        health goals.
                      </p>
                    </div>

                    <div>
                      <h3 className="condition-block-title">How?</h3>
                      {/* CHANGE */}
                      <p className="condition-block-body">
                        Everyone benefits from a primary care relationship —
                        from newborns and children to adults and seniors.
                        Whether you're managing a chronic condition, recovering
                        from illness, or simply maintaining your health, primary
                        care is your starting point.
                      </p>
                    </div>

                    <div>
                      <h3 className="condition-block-title">
                        Benefits of Regular Primary Care
                      </h3>
                      <div className="condition-benefits-grid">
                        {/* CHANGE */}
                        {[
                          "Earlier disease detection",
                          "Lower healthcare costs",
                          "Coordinated specialist care",
                          "Better long-term outcomes",
                          "Personalised health plans",
                          "Medication management",
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

                <button
                  className="condition-sbc-cta"
                  onClick={() =>
                    navigate(
                      "/category-consultant?category=general&condition=Comprehensive%20Care%20For%20Every%20Stage%20Of%20Life",
                    )
                  }
                >
                  Start Consultation →
                </button>
                <p className="condition-sbc-terms">
                  By continuing, you agree to our{" "}
                  <a href="/terms-of-service" className="condition-sbc-link">
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a href="/privacy-policy" className="condition-sbc-link">
                    Privacy Policy
                  </a>
                </p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
