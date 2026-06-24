import React, { useRef } from "react";
import { Link } from "react-router-dom";
import "./Sa.css";
import {
  FaBrain,
  FaStethoscope,
  FaHeart,
  FaHeartbeat,
  FaPills,
  FaBalanceScale,
} from "react-icons/fa";
import {
  motion as Motion,
  useInView,
  useScroll,
  useTransform,
  useSpring,
} from "framer-motion";

/* ─────────────────────────────────────────
   Variants
───────────────────────────────────────── */
const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 36 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94], delay },
  },
});

/* ─────────────────────────────────────────
   RevealCard — scroll-triggered fade-up, entire card is a Link
───────────────────────────────────────── */
function RevealCard({ children, className, delay = 0, to }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <Motion.div
      ref={ref}
      className={`services-card-link-wrapper ${className}`}
      variants={fadeUp(delay)}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
    >
      <Link to={to} className="services-card-inner-link" tabIndex={0}>
        {children}
      </Link>
    </Motion.div>
  );
}

const D = [0, 0.08, 0.16, 0.24, 0.32, 0.40];

/* ─────────────────────────────────────────
   Component
───────────────────────────────────────── */
export default function ServicesSection() {
  /* ── Header reveal ── */
  const headerRef = useRef(null);
  const headerInView = useInView(headerRef, { once: true, margin: "-60px" });

  /* ── Container scroll effect ── */
  const wrapperRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start end", "start 0.55"],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 80,
    damping: 20,
    restDelta: 0.001,
  });

  const scale = useTransform(smoothProgress, [0, 1], [0.88, 1]);
  const opacity = useTransform(smoothProgress, [0, 0.4, 1], [0, 0.6, 1]);
  const y = useTransform(smoothProgress, [0, 1], [48, 0]);

  return (
    <Motion.section
      ref={wrapperRef}
      className="services-section-wrapper"
      style={{ scale, opacity, y }}
    >
      <div className="services-inner-container">

        {/* ── Header ── */}
        <div className="services-header-block" ref={headerRef}>
          <Motion.span
            className="services-eyebrow-label"
            variants={fadeUp(0)}
            initial="hidden"
            animate={headerInView ? "visible" : "hidden"}
          >
            SERVICES
          </Motion.span>

          <Motion.h2
            className="services-main-heading"
            variants={fadeUp(0.15)}
            initial="hidden"
            animate={headerInView ? "visible" : "hidden"}
          >
            Everything you need,
            <br />
            <span className="services-heading-highlight">
              for virtual healthcare, all in one place.
            </span>
          </Motion.h2>
        </div>

        {/* ── Bento Grid ── */}
        <div className="services-bento-grid">

          {/* ── Prescription Refills (4-col wide) ── */}
          <RevealCard
            className="services-card-item services-bento-large"
            delay={D[0]}
            to="/online-prescription-refills"
          >
            <div className="services-icon-row">
              <div className="services-icon-box">
                <FaPills />
              </div>
            </div>

            <div className="services-content-split">
              <div className="services-content-left">
                <h3 className="services-card-title">Prescription Refills</h3>
                <p className="services-card-description">
                  Need a medication refill without the wait? Connect with a licensed provider through a fast online doctor appointment and receive prescription refill support the same day through our secure virtual healthcare services.
                </p>
                <span className="services-card-cta-link">
                  Refill Prescription <span className="cta-arrow">→</span>
                </span>
              </div>

              <div className="services-content-right">
                <div className="services-stat-mini">
                  <span className="services-stat-value-text">2 hrs</span>
                  <span className="services-stat-label-text">Avg. time</span>
                </div>
                <div className="services-stat-mini">
                  <span className="services-stat-value-text">94%</span>
                  <span className="services-stat-label-text">Same-day</span>
                </div>
              </div>
            </div>
          </RevealCard>

          {/* ── Weight Loss (2-col) ── */}
          <RevealCard
            className="services-card-item services-bento-small-weightloss"
            delay={D[1]}
            to="/weight-loss-programs"
          >
            <div className="services-icon-box">
              <FaBalanceScale />
            </div>
            <h3 className="services-card-title">Weight Loss Programs</h3>
            <p className="services-card-description">
              Personalized virtual weight loss programs with licensed providers, GLP-1 treatment support, lifestyle coaching, and ongoing telehealth services designed to help you reach long-term health goals safely.
            </p>

            <div className="services-weight-stat-block">
              <span className="services-weight-stat-eyebrow">AVG. WEIGHT LOSS</span>
              <div className="services-weight-stat-row">
                <span className="services-weight-stat-number">15 lbs</span>
                <span className="services-weight-stat-period">/ 3 months</span>
              </div>
              <span className="services-card-cta-link services-weight-cta">
                Start Program <span className="cta-arrow">→</span>
              </span>
            </div>
          </RevealCard>

          {/* ── Mental Health (2-col tall) ── */}
          <RevealCard
            className="services-card-item services-bento-smal-1"
            delay={D[2]}
            to="/mental-health-support"
          >
            <div className="services-icon-box">
              <FaBrain />
            </div>
            <h3 className="services-card-title">Mental Health</h3>
            <p className="services-card-description">
              Get compassionate mental health support through secure online therapy consultations for anxiety, stress, burnout, depression, and emotional wellness from experienced online providers.
            </p>
            <span className="services-card-cta-link">
              Get support <span className="cta-arrow">→</span>
            </span>
          </RevealCard>

          {/* ── General Consultation (2-col) ── */}
          <RevealCard
            className="services-card-item services-bento-small"
            delay={D[3]}
            to="/general-consultation"
          >
            <div className="services-icon-box">
              <FaStethoscope />
            </div>
            <h3 className="services-card-title">General Consultation</h3>
            <p className="services-card-description">
              Speak with a licensed doctor for common symptoms, referrals, health advice, and follow-ups — all through a secure virtual visit without leaving home.
            </p>
            <span className="services-card-cta-link">
              See a Doctor <span className="cta-arrow">→</span>
            </span>
          </RevealCard>

          {/* ── Sexual Health (2-col) ── */}
          <RevealCard
            className="services-card-item services-bento-small-0"
            delay={D[4]}
            to="/sexual-health"
          >
            <div className="services-icon-box">
              <FaHeart />
            </div>
            <h3 className="services-card-title">Sexual Health</h3>
            <p className="services-card-description">
              Confidential online sexual health consultations for STI concerns, ED treatment, birth control guidance, prescriptions, and preventive virtual healthcare services with licensed providers.
            </p>
            <span className="services-card-cta-link">
              Learn more <span className="cta-arrow">→</span>
            </span>
          </RevealCard>

          {/* ── Chronic Care (4-col wide) ── */}
          <RevealCard
            className="services-card-item services-bento-wide"
            delay={D[5]}
            to="/chronic-care-management"
          >
            <div className="services-icon-box">
              <FaHeartbeat />
            </div>
            <h3 className="services-card-title">Chronic Care</h3>
            <p className="services-card-description">
              Ongoing chronic care management for diabetes, asthma, thyroid disorders, hypertension, cholesterol, and long-term health conditions through personalized telemedicine healthcare support.
            </p>
            <span className="services-card-cta-link">
              Manage condition <span className="cta-arrow">→</span>
            </span>
          </RevealCard>

        </div>
      </div>
    </Motion.section>
  );
}