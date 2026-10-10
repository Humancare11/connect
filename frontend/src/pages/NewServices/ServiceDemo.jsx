import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import {
  FiMonitor,
  FiSearch,
  FiLock,
  FiZap,
  FiFileText,
  FiCheckCircle,
  FiArrowRight,
  FiStar,
  FiHeart,
  FiAward,
  FiShield,
  FiClock,
  FiGlobe,
  FiUserCheck,
  FiBarChart2,
  FiPackage,
  FiVideo,
} from "react-icons/fi";

import SEO from "../../components/Seo";
import ServiceContact from "./ServiceContact";
import CentralFAQ from "../../components/FAQ/FAQ";
import "../Specialty/SpecialtyPage.css";
import "../Categories/categoriesGlobal.css";
import "./newservices.css";

const useBreakpoint = () => {
  const getBreakpoint = () => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1200;
    return {
      isMobile: w < 640,
      isTablet: w >= 640 && w < 1024,
      isDesktop: w >= 1024,
    };
  };
  const [bp, setBp] = useState(getBreakpoint);
  useEffect(() => {
    const handler = () => setBp(getBreakpoint());
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return bp;
};

/* ──────────────────────────────────────────────────────────────────────────
   DATA
────────────────────────────────────────────────────────────────────────── */
const SERVICES = {
  "telehealth-services": {
    slug: "telehealth-services",
    name: "Telehealth Services",
    tagline: "Expert care, wherever life takes you.",
    intro:
      "Connect with board-certified physicians and specialists through secure video, phone, or chat — from your home, office, or anywhere in between.",
    accentColor: "#2563EB",
    accentGlow: "#2563EB20",
    heroIcon: FiMonitor,
    heroEmoji: "🖥️",
    description:
      "Humancare Connect's Telehealth platform eliminates the barriers between you and quality care. Whether you need a quick prescription refill, a mental health check-in, or a specialist opinion, our verified providers are available 24 × 7. No waiting rooms. No commutes. Just care that fits your life.",
    whyItMatters:
      "Delayed care leads to worsened outcomes. Telehealth bridges the access gap — especially for patients in underserved areas, those with mobility challenges, or anyone managing a packed schedule.",
    whoBenefits: [
      "Working professionals needing on-demand consultations",
      "Rural & remote patients with limited local access",
      "Parents managing children's health between busy routines",
      "Seniors preferring care from the comfort of home",
    ],
    keyOutcomes: [
      "Same-day consultations with verified physicians",
      "E-prescriptions sent directly to your pharmacy",
      "Secure, HIPAA-compliant video sessions",
      "Integrated health records across visits",
    ],
    steps: [
      {
        Icon: FiSearch,
        title: "Describe Your Need",
        body: "Tell us your symptoms through our two-minute intake form.",
      },
      {
        Icon: FiFileText,
        title: "Match With a Provider",
        body: "Smart matching connects you with the right specialist for your need.",
      },
      {
        Icon: FiVideo,
        title: "Start Your Consultation",
        body: "Join a secure video or phone session from any device — no app required.",
      },
      {
        Icon: FiPackage,
        title: "Receive Your Care Plan",
        body: "Get prescriptions, referrals, or follow-up plans delivered digitally.",
      },
    ],
    features: [
      {
        Icon: FiLock,
        title: "HIPAA-Secure Platform",
        desc: "End-to-end encrypted sessions protect every conversation and record.",
      },
      {
        Icon: FiZap,
        title: "Under 15-Min Wait",
        desc: "Our average queue time is less than 15 minutes, even at peak hours.",
      },
      {
        Icon: FiUserCheck,
        title: "Board-Certified Doctors",
        desc: "Every provider is credentialed, state-licensed, and continuously reviewed.",
      },
      {
        Icon: FiCalendar,
        title: "Flexible Scheduling",
        desc: "Book ahead or consult on demand — evenings, weekends, holidays included.",
      },
      {
        Icon: FiFileText,
        title: "Insurance Integration",
        desc: "We verify your coverage in real time and handle claims on your behalf.",
      },
      {
        Icon: FiGlobe,
        title: "Multilingual Support",
        desc: "Consultations available in 14+ languages with live interpreter access.",
      },
    ],
    faqs: [
      {
        q: "What conditions can be treated via telehealth?",
        a: "Most non-emergency conditions including colds, infections, skin issues, mental health consultations, chronic disease management, and prescription renewals.",
      },
      {
        q: "Is my data secure?",
        a: "Yes. All sessions use AES-256 encryption and are stored on HIPAA-compliant servers. Your records are never shared without explicit consent.",
      },
      {
        q: "Can I get a prescription through telehealth?",
        a: "Licensed providers can issue e-prescriptions for a wide range of medications, transmitted directly to your preferred pharmacy.",
      },
      {
        q: "Does insurance cover telehealth?",
        a: "Most major insurers now cover telehealth. We verify your benefits before your appointment so there are no billing surprises.",
      },
      {
        q: "What if I need in-person follow-up?",
        a: "Your provider will coordinate in-person referrals and share your full consultation notes with any referred specialist.",
      },
    ],
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      delay: i * 0.07,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
};

const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

const whyUsItems = [
  [
    FiAward,
    "Verified Providers",
    "Every clinician is credentialed, licensed, and continuously reviewed.",
  ],
  [
    FiHeart,
    "Patient-Centered Care",
    "Clinical decisions are made in partnership with you — never without your input.",
  ],
  [
    FiGlobe,
    "Nationwide Access",
    "Care without geographic limits — from metro centers to remote districts.",
  ],
  [
    FiZap,
    "Fast Scheduling",
    "From first contact to first appointment in hours, not weeks.",
  ],
  [
    FiLock,
    "Secure Platform",
    "Enterprise-grade encryption protects every record and transaction.",
  ],
  [
    FiBarChart2,
    "Outcome Accountability",
    "We track results and publicly report our care quality standards.",
  ],
];

/* ──────────────────────────────────────────────────────────────────────────
   ROOT APP
────────────────────────────────────────────────────────────────────────── */
export default function ServiceDemo() {
  const bp = useBreakpoint();
  const [slug, setSlug] = useState("telehealth-services");
  const s = SERVICES[slug] || SERVICES["telehealth-services"];
  const handleSwitch = useCallback((newSlug) => setSlug(newSlug), []);

  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <>
      <SEO />

      <main
        className="service-page service-page--demo"
        style={{
          "--service-accent": s.accentColor,
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={slug}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            {/* =================================================
                HERO (Clean Standalone)
                ================================================= */}
            <section ref={heroRef} className="service-hero">
              <motion.div
                style={{ opacity: heroOpacity }}
                className="service-hero__content-standalone"
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.1 }}
                >
                  <div className="service-pill">
                    <span className="service-pill__dot" />
                    Humancare Connect
                  </div>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 32 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.18 }}
                  className="service-hero__title"
                >
                  {s.name.split(" ").map((w, i, arr) => (
                    <span key={i}>
                      {i === Math.floor(arr.length / 2) ? (
                        <span className="service-accent">{w} </span>
                      ) : (
                        <span>{w} </span>
                      )}
                    </span>
                  ))}
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.26 }}
                  className="service-hero__tagline"
                >
                  {s.tagline}
                </motion.p>

                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.32 }}
                  className="service-hero__intro"
                >
                  {s.intro}
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.38 }}
                  className="service-hero__btn-group"
                >
                  <button
                    type="button"
                    className="service-btn service-btn--primary"
                  >
                    Book Appointment
                  </button>
                  <button
                    type="button"
                    className="service-btn service-btn--ghost"
                  >
                    Contact Care Team <FiArrowRight style={{ fontSize: 14 }} />
                  </button>
                </motion.div>
              </motion.div>
            </section>

            {/* =================================================
                SERVICE OVERVIEW
                ================================================= */}
            <section className="service-section service-section--white">
              <div className="service-container">
                <motion.div
                  variants={stagger}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-60px" }}
                  className="service-overview__grid"
                >
                  <div>
                    <motion.div variants={fadeUp}>
                      <div className="service-label">
                        <div className="service-label__line" />
                        <span className="service-label__text">Service Overview</span>
                      </div>
                      <h2 className="service-heading-lg">
                        What is <span className="service-accent">{s.name}?</span>
                      </h2>
                    </motion.div>

                    <motion.p variants={fadeUp} className="service-overview__description">
                      {s.description}
                    </motion.p>

                    <motion.div variants={fadeUp} className="service-why-matters">
                      <div className="service-why-matters__label">Why It Matters</div>
                      <p className="service-why-matters__text">{s.whyItMatters}</p>
                    </motion.div>

                    <motion.div variants={fadeUp}>
                      <div className="service-benefits-list__title">
                        Who Can Benefit
                      </div>
                      <div className="service-benefits-list">
                        {s.whoBenefits.map((item, i) => (
                          <div key={i} className="service-benefit-item">
                            <FiCheckCircle className="service-benefit-item__icon" />
                            {item}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </div>

                  <motion.div variants={fadeUp} className="service-overview__sticky">
                    <ServiceContact s={s} />
                  </motion.div>
                </motion.div>

                {/* Outcomes strip */}
                <motion.div
                  variants={stagger}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="service-outcomes-strip"
                >
                  {s.keyOutcomes.map((o, i) => (
                    <motion.div
                      key={i}
                      variants={fadeUp}
                      custom={i}
                      className="service-outcome-card"
                    >
                      <div className="service-outcome-card__dot" />
                      <p className="service-outcome-card__text">{o}</p>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            </section>

            {/* =================================================
                HOW IT WORKS
                ================================================= */}
            <section className="service-section service-section--surface">
              <div className="service-container">
                <motion.div
                  variants={stagger}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-60px" }}
                  className="service-how-it-works__grid"
                >
                  <div>
                    <motion.div variants={fadeUp}>
                      <div className="service-label">
                        <div className="service-label__line" />
                        <span className="service-label__text">Our Services</span>
                      </div>
                      <h2 className="service-heading-lg">
                        Getting started is{" "}
                        <span className="service-accent">simple.</span>
                      </h2>
                      <p
                        className="service-section-header__subtitle"
                        style={{ marginBottom: 36, textAlign: "left" }}
                      >
                        Every step is designed to be frictionless — because the
                        hardest part should be nothing at all.
                      </p>
                    </motion.div>

                    <motion.div
                      variants={stagger}
                      initial="hidden"
                      whileInView="visible"
                      viewport={{ once: true }}
                      className="service-step-list"
                    >
                      {s.steps.map((step, i) => (
                        <motion.div
                          key={i}
                          variants={fadeUp}
                          custom={i}
                          className="service-step-item"
                        >
                          {i < s.steps.length - 1 && (
                            <div className="service-step-item__line" />
                          )}
                          <div className="service-step-item__icon-wrap">
                            {React.createElement(step.Icon, {
                              style: { fontSize: 18, color: "#fff" },
                            })}
                          </div>
                          <div className="service-step-item__content">
                            <div className="service-step-item__badge">
                              Step {i + 1}
                            </div>
                            <div className="service-step-item__title">
                              {step.title}
                            </div>
                            <p className="service-step-item__body">
                              {step.body}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  </div>

                  <motion.div variants={fadeUp} className="service-overview__sticky">
                    <div className="service-how-it-works__card">
                      {React.createElement(s.heroIcon, {
                        className: "service-how-it-works__card-icon",
                      })}
                      <h3 className="service-how-it-works__card-title">
                        Ready to begin?
                      </h3>
                      <p className="service-how-it-works__card-text">
                        Thousands of patients have already trusted Humancare
                        Connect for {s.name.toLowerCase()}. Your first step takes
                        under two minutes.
                      </p>
                      <button
                        type="button"
                        className="service-btn service-btn--primary service-btn--full"
                      >
                        Get Started Today
                      </button>
                      <div className="service-trust-grid">
                        {[
                          [FiLock, "Secure & Private"],
                          [FiZap, "Fast Response"],
                          [FiUserCheck, "Verified Providers"],
                          [FiFileText, "No Insurance Required"],
                        ].map(([Icon, lb], i) => (
                          <div key={i} className="service-trust-item">
                            <Icon className="service-trust-item__icon" />
                            {lb}
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              </div>
            </section>

            {/* =================================================
                FEATURES & BENEFITS
                ================================================= */}
            <section className="service-section">
              <div className="service-container">
                <motion.div
                  variants={stagger}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-60px" }}
                >
                  <motion.div variants={fadeUp} className="service-section-header">
                    <div className="service-label service-label--center">
                      <div className="service-label__line" />
                      <span className="service-label__text">Features &amp; Benefits</span>
                    </div>
                    <h2 className="service-heading-lg">
                      Everything you need,
                      <br />
                      <span className="service-accent">nothing you don't.</span>
                    </h2>
                    <p className="service-section-header__subtitle">
                      Every feature is designed around one goal: better outcomes for you.
                    </p>
                  </motion.div>

                  <motion.div
                    variants={fadeUp}
                    className="service-feature-card service-feature-card--grid"
                  >
                    <div className="service-feature-grid">
                      {s.features.map((f, i) => (
                        <div key={i} className="service-feature-grid__item">
                          <div className="service-feature-grid__icon-wrap">
                            <f.Icon className="service-feature-grid__icon" />
                          </div>
                          <div>
                            <h3 className="service-feature-grid__title">
                              {f.title}
                            </h3>
                            <p className="service-feature-grid__desc">
                              {f.desc}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              </div>
            </section>

            {/* =================================================
                WHY CHOOSE US
                ================================================= */}
            <section className="service-section">
              <div className="service-container">
                <motion.div
                  variants={stagger}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-60px" }}
                >
                  <motion.div variants={fadeUp} className="service-section-header">
                    <div className="service-label service-label--center">
                      <div className="service-label__line" />
                      <span className="service-label__text">Why Choose Us</span>
                    </div>
                    <h2 className="service-heading-lg">
                      Results you can{" "}
                      <span className="service-accent">measure.</span>
                    </h2>
                    <p className="service-section-header__subtitle">
                      Numbers that represent real patients, real outcomes.
                    </p>
                  </motion.div>

                  <div className="service-why-us__grid">
                    {whyUsItems.map(([Icon, title, desc], i) => (
                      <motion.div
                        key={i}
                        variants={fadeUp}
                        custom={i}
                        className="service-why-us__card"
                      >
                        <div className="service-why-us__card-icon-wrap">
                          <Icon className="service-why-us__card-icon" />
                        </div>
                        <div>
                          <div className="service-why-us__card-title">{title}</div>
                          <div className="service-why-us__card-desc">{desc}</div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </section>

            {/* =================================================
                FAQ
                ================================================= */}
            <section className="service-faq">
              <CentralFAQ
                badge="FAQ"
                title={`Questions about ${s.name}?`}
                description="We've answered the most common questions below. Our care team is one message away if yours isn't listed."
                sections={[
                  {
                    title: "Frequently Asked",
                    items: s.faqs.map((faq) => ({
                      question: faq.q,
                      answer: faq.a,
                    })),
                  },
                ]}
              />
            </section>

            {/* =================================================
                FINAL CTA
                ================================================= */}
            <section className="service-section">
              <div className="service-container">
                <motion.div
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.6 }}
                  className="service-cta-card"
                >
                  <div>
                    <div className="service-pill">
                      <span className="service-pill__dot" />
                      Start Today
                    </div>
                    <h2 className="service-cta-title">
                      Ready to get the
                      <br />
                      <span className="service-accent">care you need?</span>
                    </h2>
                    <p className="service-cta-desc">
                      Join over 120,000 patients who trust Humancare Connect for{" "}
                      {s.name.toLowerCase()}. Start your journey in under two minutes.
                    </p>
                    <div className="service-cta-btn-group">
                      <button
                        type="button"
                        className="service-btn service-btn--primary"
                      >
                        Get Started
                      </button>
                      <button
                        type="button"
                        className="service-btn service-btn--ghost"
                      >
                        Book Appointment
                      </button>
                    </div>
                    <div className="service-cta-trust">
                      {[
                        [FiLock, "HIPAA Compliant"],
                        [FiStar, "4.9/5 Rated"],
                        [FiShield, "Verified Providers"],
                        [FiFileText, "No Insurance Required"],
                        [FiClock, "24/7 Access"],
                      ].map(([Icon, lb], i) => (
                        <div key={i} className="service-cta-trust__item">
                          <Icon className="service-cta-trust__icon" />
                          {lb}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>
            </section>
          </motion.div>
        </AnimatePresence>
      </main>
    </>
  );
}
