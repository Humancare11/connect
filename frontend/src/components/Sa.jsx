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

const D = [0, 0.08, 0.16, 0.24, 0.32, 0.4];

/* ─────────────────────────────────────────
   Component
───────────────────────────────────────── */
export default function Sa() {
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
                  Need a refill but don’t want to wait? Refill prescriptions
                  online with a quick online doctor appointment with a licensed
                  telemedicine doctor. If you have a chronic condition or just
                  need to renew a prescription, get care when you need it and
                  save yourself a trip to the clinic with quick, easy
                  telemedicine appointments.
                </p>
                <span className="services-card-cta-link">
                  Refill Prescription <span className="cta-arrow">→</span>
                </span>
              </div>

              {/* <div className="services-content-right">
                <div className="services-stat-mini">
                  <span className="services-stat-value-text">2 hrs</span>
                  <span className="services-stat-label-text">Avg. time</span>
                </div>
                <div className="services-stat-mini">
                  <span className="services-stat-value-text">94%</span>
                  <span className="services-stat-label-text">Same-day</span>
                </div>
              </div> */}
            </div>
          </RevealCard>

          {/* Doctors Notes */}
          <RevealCard
            className="services-card-item services-bento-small-weightloss"
            delay={D[1]}
            to="/doctor-note-or-sick-notes"
          >
            <div className="services-icon-box">
              <FaBalanceScale />
            </div>
            <h3 className="services-card-title">Doctor Note or Sick Note</h3>
            <p className="services-card-description">
              Need a doctor’s note for work, school or daily activities? Chat
              with a licensed telemedicine doctor & receive a medical note when
              clinically indicated through a fast online doctor appointment.
              Convenient telemedicine services save you time, avoid unnecessary
              clinic visits, and provide the documentation you need.
            </p>
            <div className="services-weight-stat-block">
              <span className="services-card-cta-link services-weight-cta">
                Get Started <span className="cta-arrow">→</span>
              </span>
            </div>
          </RevealCard>

          {/* ── Mental Health (2-col tall) ── */}
          {/* <RevealCard
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
          </RevealCard> */}

          {/* Fit to Fly  */}
          <RevealCard
            className="services-card-item services-bento-smal-1"
            delay={D[2]}
            to="/fit-to-fly-certificate"
          >
            <div className="services-icon-box">
              <FaBrain />
            </div>
            <h3 className="services-card-title"> Fit to Fly Certificate</h3>
            <p className="services-card-description">
              Travel with confidence by getting a fit to fly certificate from a
              licensed telemedicine provider. If medically appropriate, obtain a
              professional fitness-to-travel assessment to meet airline
              requirements, recent surgery, pregnancy, or other health
              conditions without an unnecessary clinic visit.
            </p>
            <span className="services-card-cta-link">
              Get Certificate <span className="cta-arrow">→</span>
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
              Get expert care for everyday health concerns with a licensed
              primary care doctor through a fast online doctor appointment. From
              cold and flu symptoms to infections, headaches, minor injuries,
              and preventive healthcare, our telemedicine services make it easy
              to get timely medical advice and personalized treatment from the
              comfort of home.
            </p>
            <span className="services-card-cta-link">
              See a Doctor <span className="cta-arrow">→</span>
            </span>
          </RevealCard>

          {/* ── Sexual Health (2-col) ── */}
          {/* <RevealCard
            className="services-card-item services-bento-small-0"
            delay={D[4]}
            to="/service-sexual-health"
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
          </RevealCard> */}
          <RevealCard
            className="services-card-item services-bento-small-0"
            delay={D[4]}
            to="/lab-requisitions"
          >
            <div className="services-icon-box">
              <FaHeart />
            </div>
            <h3 className="services-card-title"> Lab Requisition</h3>
            <p className="services-card-description">
              Need lab testing for new symptoms, ongoing conditions, or routine
              health monitoring? Connect with a licensed healthcare provider to
              receive a lab requisition when medically appropriate, helping you
              take the next step toward an accurate diagnosis and personalized
              treatment.
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
              Manage chronic conditions with ongoing support from licensed
              healthcare providers through our telemedicine services. Whether
              you're living with diabetes, asthma, thyroid disorders,
              hypertension, or high cholesterol, receive personalized treatment
              plans, regular follow-ups, and continuity of care to help you stay
              healthier every day.
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
