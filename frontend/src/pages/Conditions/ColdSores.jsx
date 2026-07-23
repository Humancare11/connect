import { useNavigate } from "react-router-dom";
import { useCategoryPrice } from "../../hooks/useCategoryPrice";
import "./Conditions/Condition.css";
import SEO from "../../components/Seo";
import {
  Calendar,
  Shield,
  ShieldCheck,
  ChevronRight,
  CheckCircle,
  HeartPulse,
  Users,
} from "lucide-react";
import ConditionBannerImage from "../../assets/ConditionImages/SkinCondition/Cold-Sores.webp";

const pageData = {
  badge: "Skin Conditions",
  heading: "Cold Sores",
  description: "Painful blisters around the mouth",
  trustItems: ["Same Day Visits", "No Insurance Required", "Virtual Care"],
  bgImage: ConditionBannerImage,
};

export default function ColdSores() {
  const navigate = useNavigate();
  const price = useCategoryPrice();

  return (
    <>
      <SEO
        title="Cold Sores & HSV-1 | Care for Painful Lip Blisters"
        description="Tingling, burning, or painful blisters around the lips may signal a cold sore. Receive symptom evaluation, treatment guidance, and prescription support when appropriate."
        keywords="Cold sores, Cold sore symptoms, Herpes simplex virus (HSV-1), Telemedicine services, Online doctor appointment, Virtual healthcare services"
        url="https://humancareconnect.co/cold-sores"
      />
      <div className="condition-root">
        <section
          className="condition-hero"
          style={{
            backgroundImage: `linear-gradient(105deg, rgb(6 19 51 / 68%) 0%, rgba(10, 31, 68, 0.6) 30%, rgba(10, 31, 68, 0.57) 62%, rgba(10, 31, 68, 0.48) 100%), url(${pageData.bgImage})`,
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

        <div className="condition-mid-section">
          <div className="condition-page-layout">
            <main>
              <div className="condition-glass-card">
                <div className="condition-glass-shine" />
                <div className="condition-about-grid">
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
                  <div className="condition-about-right">
                    <div>
                      <h3 className="condition-block-title">
                        What are Cold Sores?
                      </h3>
                      <p className="condition-block-body">
                        Cold sores can cause small fluid-filled blisters,
                        burning, tingling, redness, irritation, and discomfort
                        around the lips or mouth caused by the herpes simplex
                        virus (HSV-1).
                      </p>
                    </div>
                    <div>
                      <h3 className="condition-block-title">How?</h3>
                      <p className="condition-block-body">
                        Get fast care for cold sore symptoms with Humancare
                        Connect. Our telemedicine services make it easy to
                        schedule an online doctor appointment and connect with a
                        licensed provider from home. Through our secure virtual
                        healthcare services, you can receive symptom evaluation,
                        treatment guidance, and prescriptions when appropriate
                        without the need for an in-person clinic visit.
                      </p>
                    </div>
                    <div>
                      <h3 className="condition-block-title">
                        Treat cold sores in 4 simple steps.
                      </h3>
                      <div className="condition-benefits-grid">
                        {[
                          "Choose Cold Sores care",
                          "Upload photos and share your symptoms",
                          "Connect with an online provider",
                          "Receive treatment guidance and prescription care if needed",
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
                      "/category-consultant?category=skin&condition=Cold%20Sores",
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
