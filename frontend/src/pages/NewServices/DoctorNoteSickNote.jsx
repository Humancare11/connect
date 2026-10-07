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
import heroBanner from "../../assets/MedicalServices/sick-notes-medical-certificates.webp";
import ServiceBookingCard from "../../components/booking/ServiceBookingCard";
import "../Specialty/SpecialtyPage.css";
import "../Categories/categoriesGlobal.css";
import "./newservices.css";
import { useServicePrice } from "../../hooks/useServicePrice";
import ServiceContact from "./ServiceContact";
import CentralFAQ from "../../components/FAQ/FAQ";

const HERO_IMAGE = {
  src: heroBanner,
  alt: "Licensed healthcare provider conducting an online general consultation with a patient through secure telemedicine services",
  width: 1920,
  height: 700,
};

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

/* ─────────────────────────────────────────────────────────────────────────
   DATA
───────────────────────────────────────────────────────────────────────── */
const SERVICES = {
  "telehealth-services": {
    slug: "doctor-notes-sick-notes",
    name: "DOCTOR NOTES & SICK NOTES",
    serviceName: "Doctor Notes & Sick Notes",
    tagline: "Get the documentation you need without leaving home.",
    intro:
      "Request a Doctor Note or Sick Note through secure telemedicine services. Connect with a licensed healthcare provider, discuss your symptoms or health concerns, and receive supporting documentation when clinically appropriate for work, school, or personal needs.",
    accentColor: "#2563EB",
    accentGlow: "#2563EB20",
    heroIcon: FiMonitor,
    heroEmoji: "🖥️",
    description:
      "Doctor Notes and Sick Notes are medical documents that may be provided by a healthcare professional after evaluating a patient's health condition. These documents are commonly used to verify an illness, medical condition, or healthcare visit for employers, schools, universities, or other organizations. Through Humancare Connect, eligible patients can connect with a licensed healthcare provider online to discuss their symptoms and determine whether documentation may be appropriate.",
    whyItMatters:
      "Many workplaces, schools, and institutions require medical documentation when illness affects attendance or daily responsibilities. Obtaining the appropriate documentation can help support leave requests, verify absences, and provide confirmation of a medical evaluation.",
    whoBenefits: [
      "  Employees requiring documentation for work absences",
      "Students needing verification for missed classes",
      " Individuals recovering from short term illnesses",
      " People requiring documentation following a medical consultation",
      "Adults seeking convenient healthcare support from home",
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
        title: "Tell Us About Your Symptoms",
        body: "Share information about your illness, symptoms, health concerns, and the reason documentation may be required.",
      },
      {
        Icon: FiFileText,
        title: "Connect With a Healthcare Provider",
        body: "A licensed healthcare provider will review your information and discuss your condition during a virtual consultation.",
      },
      {
        Icon: FiVideo,
        title: "Complete Your Consultation",
        body: "Join a secure online appointment from your phone, tablet, or computer and receive a professional medical evaluation.",
      },
      {
        Icon: FiPackage,
        title: "Receive Your Documentation",
        body: "If clinically appropriate, your provider may issue a Doctor Note or Sick Note that can be used for work, school, or other approved purposes.",
      },
    ],
    faqs: [
      {
        q: "What is a Doctor Note?",
        a: "A Doctor Note is a medical document provided by a healthcare professional confirming that a patient has been evaluated during a medical consultation.",
      },
      {
        q: "What is a Sick Note?",
        a: "A Sick Note is documentation that may verify an illness, medical condition, or healthcare visit when clinically appropriate.",
      },
      {
        q: "Can I request a Doctor Note online?",
        a: "Yes. Eligible patients can complete a virtual consultation with a licensed healthcare provider through secure telemedicine services.",
      },
      {
        q: "Can I get a Sick Note for work?",
        a: "A healthcare provider may issue documentation for work-related absences when clinically appropriate following an evaluation.",
      },
      {
        q: "Can students request Sick Notes for school?",
        a: "Yes. Students may request medical documentation when illness affects school attendance or academic responsibilities.",
      },
      {
        q: "What conditions may qualify for a Doctor Note?",
        a: "Common illnesses, infections, migraines, flu symptoms, gastrointestinal concerns, and other health conditions may be evaluated during a consultation.",
      },
      {
        q: "How do healthcare providers determine eligibility for documentation?",
        a: "Providers review symptoms, medical history, and clinical information before determining whether documentation is appropriate.",
      },
      {
        q: "Can I request documentation for a previous illness?",
        a: "Documentation availability depends on the circumstances and provider assessment.",
      },
      {
        q: "How long does a virtual consultation take?",
        a: "Most appointments are completed within a short consultation, depending on the patient's needs.",
      },
      {
        q: "Can a provider refuse to issue a Doctor Note?",
        a: "Yes. Documentation is provided based on clinical judgment and may not be appropriate in every situation.",
      },
      {
        q: "Are online Doctor Notes legally valid?",
        a: "Acceptance varies depending on employer, school, institution, and local requirements.",
      },
      {
        q: "Can I use a Doctor Note for workplace leave requests?",
        a: "Many employers accept medical documentation for illness-related absences, though individual policies may vary.",
      },
      {
        q: "Can I receive documentation for short-term illnesses?",
        a: "Yes. Many patients request documentation for temporary illnesses that affect daily activities.",
      },
      {
        q: "Are virtual consultations secure?",
        a: "Yes. Humancare Connect uses secure telemedicine technology designed to protect patient information.",
      },
      {
        q: "What information should I prepare before my appointment?",
        a: "Be prepared to discuss your symptoms, medical history, medications, and the reason documentation is being requested.",
      },
      {
        q: "Can I discuss return-to-work recommendations with my provider?",
        a: "Yes. Providers can discuss recovery timelines and recommendations based on your condition.",
      },
      {
        q: "Why choose Humancare Connect for Doctor Notes and Sick Notes?",
        a: "Humancare Connect offers secure telemedicine services, licensed healthcare providers, and convenient online consultations designed around your schedule.",
      },
      {
        q: "Can I access care from home?",
        a: "Yes. Virtual healthcare services allow patients to connect with providers from home, work, or while traveling.",
      },
      {
        q: "How quickly can I schedule an appointment?",
        a: "Appointment availability varies, but many patients can access care without lengthy wait times.",
      },
      {
        q: "How do I get started?",
        a: "Simply schedule an online appointment, discuss your symptoms with a healthcare provider, and receive documentation when clinically appropriate.",
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

/* ─────────────────────────────────────────────────────────────────────────
   ROOT
───────────────────────────────────────────────────────────────────────── */
export default function DoctorNote() {
  const [slug, setSlug] = useState("telehealth-services");
  const s = SERVICES[slug] || SERVICES["telehealth-services"];
  const handleSwitch = useCallback((newSlug) => setSlug(newSlug), []);
  const bp = useBreakpoint();
  const { price, priceLoading } = useServicePrice(s.slug);

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
        className="service-page service-page--doctor-notes"
        style={{ "--service-accent": s.accentColor }}
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
                HERO
                ================================================= */}
            <section ref={heroRef} className="service-hero service-hero--with-image">
              <img
                src={HERO_IMAGE.src}
                alt={HERO_IMAGE.alt}
                width={HERO_IMAGE.width}
                height={HERO_IMAGE.height}
                loading="eager"
                fetchPriority="high"
                className="service-hero__bg-img"
              />
              <div className="service-hero__overlay" />

              <motion.div
                style={{ opacity: heroOpacity }}
                className="service-hero__content-grid"
              >
                <div>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.1 }}
                  >
                    <div className="service-pill">
                      <span className="service-pill__dot" />
                      SERVICES
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
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="service-hero__booking"
                >
                  <ServiceBookingCard
                    price={price}
                    priceLoading={priceLoading}
                    name={s.serviceName}
                    slug={s.slug}
                  />
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
                        What Are Doctor Notes &amp; Sick Notes?
                      </h2>
                    </motion.div>

                    <motion.p variants={fadeUp} className="service-overview__description">
                      {s.description}
                    </motion.p>

                    <motion.div variants={fadeUp} className="service-why-matters">
                      <div className="service-why-matters__label">WHY IT MATTERS</div>
                      <p className="service-why-matters__text">{s.whyItMatters}</p>
                    </motion.div>

                    <motion.div variants={fadeUp}>
                      <div className="service-benefits-list__title">Who Can Benefit</div>
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

                  <motion.div
                    variants={fadeUp}
                    style={{ position: bp.isDesktop ? "sticky" : "static", top: 96 }}
                  >
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
                    <motion.div key={i} variants={fadeUp} custom={i} className="service-outcome-card">
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
                      <p className="service-section-header__subtitle" style={{ marginBottom: 36, textAlign: "left" }}>
                        Requesting a Doctor Note or Sick Note through Humancare Connect is
                        quick, secure, and convenient.
                      </p>
                    </motion.div>

                    <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="service-step-list">
                      {s.steps.map((step, i) => (
                        <motion.div key={i} variants={fadeUp} custom={i} className="service-step-item">
                          {i < s.steps.length - 1 && <div className="service-step-item__line" />}
                          <div className="service-step-item__icon-wrap">
                            {React.createElement(step.Icon, { style: { fontSize: 18, color: "#fff" } })}
                          </div>
                          <div className="service-step-item__content">
                            <div className="service-step-item__badge">Step {i + 1}</div>
                            <div className="service-step-item__title">{step.title}</div>
                            <p className="service-step-item__body">{step.body}</p>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  </div>

                  <motion.div
                    variants={fadeUp}
                    style={{ position: bp.isDesktop ? "sticky" : "static", top: 96 }}
                  >
                    <div className="service-how-it-works__card">
                      {React.createElement(s.heroIcon, {
                        className: "service-how-it-works__card-icon",
                      })}
                      <h3 className="service-how-it-works__card-title">Ready to begin?</h3>
                      <p className="service-how-it-works__card-text">
                        Access trusted telemedicine services from wherever you are.
                        Complete your consultation online and receive medical
                        documentation when appropriate.
                      </p>
                      <button type="button" className="service-btn service-btn--primary service-btn--full">
                        <a href="/login">Get Started Today</a>
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
                      Understanding Doctor Notes &amp; Sick Notes
                    </h2>
                  </motion.div>

                  <motion.div variants={fadeUp} className="service-feature-card">
                    <p>
                      Doctor Notes and Sick Notes are commonly requested when an illness,
                      injury, or medical condition affects an individual's ability to
                      attend work, school, or other responsibilities. These documents help
                      confirm that a healthcare professional has evaluated the patient's
                      condition and may provide recommendations regarding rest, recovery,
                      or temporary activity limitations.
                    </p>
                    <p>
                      Through Humancare Connect, patients can access telemedicine services
                      and connect with licensed healthcare providers from the comfort of
                      home. During the consultation, providers may review symptoms,
                      discuss medical history, assess the patient's condition, and
                      determine whether medical documentation is appropriate based on
                      clinical findings.
                    </p>
                    <p>
                      Doctor Notes and Sick Notes are frequently requested for common
                      illnesses such as colds, flu symptoms, infections, migraines,
                      gastrointestinal concerns, minor injuries, and other short term
                      health conditions. By combining virtual healthcare services with
                      professional medical evaluation, Humancare Connect helps patients
                      access convenient healthcare support while reducing unnecessary
                      clinic visits.
                    </p>
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
                      <motion.div key={i} variants={fadeUp} custom={i} className="service-why-us__card">
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
                      Need Medical Documentation?
                    </h2>
                    <p className="service-cta-desc">
                      Connect with a licensed healthcare provider through secure
                      telemedicine services and discuss your healthcare needs from the
                      comfort of home. Receive Doctor Notes or Sick Notes when clinically
                      appropriate and access convenient virtual healthcare services designed
                      to fit your schedule.
                    </p>
                    <div className="service-cta-btn-group">
                      <button type="button" className="service-btn service-btn--primary">
                        <a href="/login">Get Started</a>
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
