import React, { useRef } from "react";
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
  motion,
  useInView,
  useMotionValue,
  useTransform,
  useSpring,
} from "framer-motion";

/* ─────────────────────────────────────────
   Variants
───────────────────────────────────────── */
const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94], delay },
  },
});

const iconPop = (delay = 0) => ({
  hidden: { opacity: 0, scale: 0.5 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 260, damping: 18, delay },
  },
});

const statSlide = (delay = 0) => ({
  hidden: { opacity: 0, scale: 0.88, y: 16 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut", delay },
  },
});

const weightSlide = (delay = 0) => ({
  hidden: { opacity: 0, x: -30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94], delay },
  },
});

const ctaFade = (delay = 0) => ({
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut", delay },
  },
});

/* ─────────────────────────────────────────
   TiltCard — scroll reveal + mouse tilt
───────────────────────────────────────── */
function TiltCard({ children, className, delay = 0 }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [4, -4]), {
    stiffness: 200,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-4, 4]), {
    stiffness: 200,
    damping: 20,
  });

  const handleMouseMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleMouseLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={fadeUp(delay)}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformPerspective: 800 }}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────
   AnimateOnView — generic scroll-triggered wrapper
───────────────────────────────────────── */
function AnimateOnView({ children, variants, as = "div", style, className }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const Tag = motion[as] || motion.div;
  return (
    <Tag
      ref={ref}
      className={className}
      style={style}
      variants={variants}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
    >
      {children}
    </Tag>
  );
}

/* ─────────────────────────────────────────
   Card stagger delays
───────────────────────────────────────── */
const D = [0, 0.1, 0.2, 0.3, 0.4, 0.5];

/* ─────────────────────────────────────────
   Component
───────────────────────────────────────── */
export default function ServicesSection() {
  const headerRef = useRef(null);
  const headerInView = useInView(headerRef, { once: true, margin: "-60px" });

  return (
    <section className="services-section-wrapper">
      <div className="services-inner-container">
        {/* ── Header ── */}
        <div className="services-header-block" ref={headerRef}>
          <motion.span
            className="services-eyebrow-label"
            variants={fadeUp(0)}
            initial="hidden"
            animate={headerInView ? "visible" : "hidden"}
          >
            — SERVICES
          </motion.span>

          <motion.h2
            className="services-main-heading"
            variants={fadeUp(0.15)}
            initial="hidden"
            animate={headerInView ? "visible" : "hidden"}
          >
            Everything you need,
            <br />
            <span className="services-heading-highlight">
              all in one place.
            </span>
          </motion.h2>
        </div>

        {/* ── Bento Grid ── */}
        <div className="services-bento-grid">
          {/* Prescription Refills */}
          <TiltCard
            className="services-card-item services-bento-large"
            delay={D[0]}
          >
            <div className="services-icon-box">
              <FaPills />
              <span className="services-feature-badge">MOST REQUESTED</span>
            </div>
            <div className="services-content-split">
              <div className="services-content-left">
                <h3 className="services-card-title">Prescription Refills</h3>
                <p className="services-card-description">
                  Running low on medication? Fast-track refill from a licensed
                  provider — often within the same day. No appointment required.
                  Works even if you're between doctors.
                </p>
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
            <a href="#" className="services-card-cta-link">
              Request refill →
            </a>
          </TiltCard>

          {/* Weight Loss */}
          <TiltCard
            className="services-card-item services-bento-small-weightloss"
            delay={D[1]}
          >
            <div className="services-icon-box">
              <FaBalanceScale />
            </div>
            <h3 className="services-card-title">Weight Loss Programs</h3>
            <p className="services-card-description">
              Personalized plans including GLP-1 medications (Ozempic, Wegovy),
              lifestyle coaching, and monthly monitoring.
            </p>
            <div className="services-weight-stat-block">
              <span className="services-weight-stat-eyebrow">
                AVG. WEIGHT LOSS
              </span>
              <div className="services-weight-stat-row">
                <span className="services-weight-stat-number">15 lbs</span>
                <span className="services-weight-stat-period">/ 3 months</span>
                <a href="#" className="services-card-cta-link">
                  Start program →
                </a>
              </div>
            </div>
          </TiltCard>

          {/* Mental Health */}
          <TiltCard
            className="services-card-item services-bento-smal-1"
            delay={D[2]}
          >
            <div className="services-icon-box">
              <FaBrain />
            </div>
            <h3 className="services-card-title">Mental Health</h3>
            <p className="services-card-description">
              Professional therapy, psychiatry, and counseling for anxiety,
              depression, and stress management.
            </p>
            <a href="#" className="services-card-cta-link">
              Get support →
            </a>
          </TiltCard>

          {/* General Consultation */}
          <TiltCard
            className="services-card-item services-bento-small"
            delay={D[3]}
          >
            <div className="services-icon-box">
              <FaStethoscope />
            </div>
            <h3 className="services-card-title">General Consultation</h3>
            <p className="services-card-description">
              Sick visits, wellness checks, infections, minor injuries. Same-day
              access to a doctor.
            </p>
            <a href="#" className="services-card-cta-link">
              See a doctor →
            </a>
          </TiltCard>

          {/* Sexual Health */}
          <TiltCard
            className="services-card-item services-bento-small-0"
            delay={D[4]}
          >
            <div className="services-icon-box">
              <FaHeart />
            </div>
            <h3 className="services-card-title">Sexual Health</h3>
            <p className="services-card-description">
              Confidential, judgment-free care for STI testing, ED, birth
              control, and more.
            </p>
            <a href="#" className="services-card-cta-link">
              Learn more →
            </a>
          </TiltCard>

          {/* Chronic Care */}
          <TiltCard
            className="services-card-item services-bento-wide"
            delay={D[5]}
          >
            <div className="services-icon-box">
              <FaHeartbeat />
            </div>
            <h3 className="services-card-title">Chronic Care</h3>
            <p className="services-card-description">
              Ongoing support for diabetes, hypertension, thyroid, and asthma
              with a dedicated care team.
            </p>
            <a href="#" className="services-card-cta-link">
              Manage condition →
            </a>
          </TiltCard>
        </div>
      </div>
    </section>
  );
}
