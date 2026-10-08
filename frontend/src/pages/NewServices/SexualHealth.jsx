import React, { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
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
  FiCalendar,
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
    name: "SEXUAL HEALTH",
    tagline: "Confidential care for your sexual health and wellness.",
    intro:
      "Access professional sexual health support through secure telemedicine services. Connect with licensed healthcare providers to discuss sexual wellness concerns, symptoms, preventive care, testing guidance, treatment options, and reproductive health questions in a private and judgment free environment.",
    accentColor: "#2563EB",
    accentGlow: "#2563EB20",
    heroIcon: FiMonitor,
    heroEmoji: "🖥️",
    description:
      "Sexual health is an important part of overall well being. Through Humancare Connect, patients can access convenient and confidential sexual health services without the discomfort or barriers that may prevent them from seeking care. Our healthcare providers offer guidance, evaluations, and treatment recommendations for a wide range of sexual health concerns through secure virtual healthcare services.",
    whyItMatters:
      "Sexual health affects physical health, emotional well being, relationships, and quality of life. Early evaluation and professional guidance can help address concerns, reduce health risks, support preventive care, and improve confidence in managing sexual wellness.",
    whoBenefits: [
      "Adults seeking confidential sexual health guidance",
      "Individuals with sexual wellness concerns or symptoms",
      "Patients seeking STI and STD testing guidance",
      "Patients seeking STI and STD testing guidance",
      "Adults looking for preventive sexual health care and education",
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
        title: "Share Your Concerns",
        body: "Tell us about your symptoms, sexual health concerns, medical history, and wellness goals through our secure intake process.",
      },
      {
        Icon: FiFileText,
        title: "Connect With a Healthcare Provider",
        body: "Meet with a licensed healthcare provider who will discuss your concerns and evaluate your healthcare needs.",
      },
      {
        Icon: FiVideo,
        title: "Receive Personalized Guidance",
        body: "Your provider may discuss testing recommendations, treatment options, preventive care strategies, or additional follow up care when appropriate.",
      },
      {
        Icon: FiPackage,
        title: "Take Control of Your Sexual Health",
        body: "Follow your personalized care plan and access ongoing support as needed through secure telehealth services.",
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
        q: "What are sexual health services?",
        a: "Sexual health services provide education, evaluation, guidance, prevention strategies, and treatment recommendations related to sexual wellness and reproductive health.",
      },
      {
        q: "Can I discuss sexual health concerns online?",
        a: "Yes. Telemedicine services allow patients to discuss sexual health concerns privately with licensed healthcare providers.",
      },
      {
        q: "Is online sexual health care confidential?",
        a: "Yes. Humancare Connect uses secure telemedicine technology designed to protect patient privacy and confidentiality.",
      },
      {
        q: "What sexual health concerns can be discussed during a virtual appointment?",
        a: "Patients may discuss sexual wellness concerns, symptoms, STI and STD questions, reproductive health, sexual function concerns, and preventive care.",
      },
      {
        q: "Can telehealth help with STI and STD concerns?",
        a: "Yes. Healthcare providers can discuss symptoms, testing recommendations, prevention strategies, and treatment options when appropriate.",
      },
      {
        q: "Can I receive guidance about safe sexual practices?",
        a: "Yes. Providers can offer education and recommendations related to safer sexual health practices and prevention.",
      },
      {
        q: "What are the benefits of virtual sexual health services?",
        a: "Virtual care offers privacy, convenience, flexibility, and easier access to professional healthcare support.",
      },
      {
        q: "Can I discuss reproductive health concerns during a consultation?",
        a: "Yes. Providers can discuss reproductive health questions and recommend appropriate next steps when needed.",
      },
      {
        q: "Are sexual health consultations judgment free?",
        a: "Yes. Healthcare providers offer professional, respectful, and confidential care focused on patient well being.",
      },
      {
        q: "Can telehealth help with sexual wellness concerns?",
        a: "Yes. Patients can discuss a variety of concerns related to sexual health, wellness, and intimate relationships.",
      },
      {
        q: "What happens during a sexual health consultation?",
        a: "A healthcare provider will discuss your symptoms, concerns, health history, and wellness goals to better understand your needs.",
      },
      {
        q: "Can I ask questions about STI and STD prevention?",
        a: "Yes. Providers can discuss prevention strategies, risk reduction, and recommendations for maintaining sexual health.",
      },
      {
        q: "When should I seek sexual health support?",
        a: "You should seek support whenever you experience symptoms, concerns, changes in sexual health, or questions about prevention and wellness.",
      },
      {
        q: "Can virtual appointments help reduce barriers to care?",
        a: "Yes. Telehealth services make it easier to access care from a private and convenient location.",
      },
      {
        q: "Are sexual health services only for people with symptoms?",
        a: "No. Preventive care, education, and wellness discussions are important aspects of maintaining sexual health.",
      },
      {
        q: "Can I schedule follow up appointments if needed?",
        a: "Yes. Follow up consultations may be recommended based on your individual healthcare needs.",
      },
      {
        q: "Why is preventive sexual health care important?",
        a: "Preventive care can help reduce health risks, support early detection of concerns, and promote overall wellness.",
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
export default function SexualHealth() {
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
        className="service-page service-page--sexual-health"
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
                    <a href="/login">Get Started</a>
                  </button>
                  <button
                    type="button"
                    className="service-btn service-btn--ghost"
                  >
                    <Link to="/appointment-booking" state={{ tab: "spec" }}>
                      Request Your Lab Consultation Today
                    </Link>
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
                        Confidential Sexual Health Care From Anywhere
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
                        Accessing sexual health support through Humancare Connect is
                        secure, private, and designed to protect your confidentiality.
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
                        Get confidential sexual health support through trusted
                        telemedicine services and receive professional guidance from
                        licensed healthcare providers.
                      </p>
                      <button
                        type="button"
                        className="service-btn service-btn--primary service-btn--full"
                      >
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
                      Supporting Sexual Wellness
                      <br />
                      <span className="service-accent">
                        Through Virtual Healthcare
                      </span>
                    </h2>
                    <p className="service-section-header__subtitle">
                      Every feature is designed around one goal: better outcomes for you.
                    </p>
                  </motion.div>

                  <motion.div variants={fadeUp} className="service-feature-card">
                    <p>
                      Sexual health includes physical, emotional, mental, and social
                      aspects of well being related to sexuality and intimate
                      relationships. Maintaining good sexual health involves understanding
                      your body, practicing preventive care, recognizing symptoms when
                      they occur, and seeking professional guidance when concerns arise.
                      Access to timely healthcare can help individuals make informed
                      decisions about their sexual wellness.
                    </p>
                    <p>
                      At Humancare Connect, our sexual health services provide convenient
                      access to licensed healthcare providers through secure telemedicine
                      services. Patients can discuss concerns related to sexual function,
                      sexually transmitted infections, reproductive health, prevention
                      strategies, relationship concerns, and overall sexual wellness.
                      Virtual healthcare services help remove barriers that often prevent
                      people from seeking care.
                    </p>
                    <p>
                      Many sexual health concerns are common and treatable when addressed
                      early. Whether you have questions about symptoms, testing,
                      prevention, treatment options, or general sexual wellness,
                      telehealth services provide a confidential and supportive
                      environment where patients can receive professional guidance and
                      personalized recommendations.
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
                      Ready to Take Charge of
                      <br />
                      <span className="service-accent">Your Sexual Health?</span>
                    </h2>
                    <p className="service-cta-desc">
                      Connect with a licensed healthcare provider through secure
                      telemedicine services and receive confidential support for your sexual
                      wellness concerns. Get trusted guidance, personalized care, and peace
                      of mind from wherever you are.
                    </p>
                    <div className="service-cta-btn-group">
                      <button
                        type="button"
                        className="service-btn service-btn--primary"
                      >
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
