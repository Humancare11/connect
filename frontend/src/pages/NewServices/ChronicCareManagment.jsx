import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import ServiceContact from "./ServiceContact";
import CentralFAQ from "../../components/FAQ/FAQ";

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

import { Helmet } from "react-helmet-async";
import SEO from "../../components/Seo";

import heroBanner from "../../assets/MedicalServices/chronic-care-management-telemedicine.webp";
import ServiceBookingCard from "../../components/booking/ServiceBookingCard";
import "../Specialty/SpecialtyPage.css";
import "../Categories/categoriesGlobal.css";
import "./newservices.css";
import { useServicePrice } from "../../hooks/useServicePrice";

const HERO_IMAGE = {
  src: heroBanner,
  alt: "Licensed healthcare provider conducting a virtual chronic care management consultation with a patient through telemedicine.",
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

/* ──────────────────────────────────────────────────────────────────────────
   DATA
────────────────────────────────────────────────────────────────────────── */
const SERVICES = {
  "telehealth-services": {
    slug: "chronic-care-management",
    name: "CHRONIC CARE MANAGEMENT",
    serviceName: "Chronic Care Management", // must exactly match ServicePrice.name in admin
    tagline: "Ongoing support for long term health conditions.",
    intro:
      "Manage chronic health conditions with personalized telemedicine services designed to support your long term health and well being. Connect with licensed healthcare providers who can help monitor symptoms, review treatment plans, manage medications, and provide ongoing healthcare guidance from the comfort of home.",
    accentColor: "#2563EB",
    accentGlow: "#2563EB20",
    heroIcon: FiMonitor,
    heroEmoji: "🖥️",
    description:
      "Chronic care management focuses on helping patients effectively manage ongoing medical conditions through regular monitoring, personalized treatment plans, and continuous healthcare support. Through Humancare Connect, patients can access convenient virtual healthcare services that promote better health outcomes and improved quality of life.",
    whyItMatters:
      "Chronic conditions often require ongoing medical attention and long term management. Regular follow up care, medication management, and professional guidance can help reduce complications, improve symptom control, and support overall wellness. Consistent care plays an important role in helping patients stay healthy and maintain their daily activities.",
    whoBenefits: [
      "Individuals living with chronic health conditions",
      "Patients managing diabetes or high blood pressure",
      "Adults with asthma, COPD, or respiratory conditions",
      "Individuals with heart disease or high cholesterol",
      "Patients seeking ongoing healthcare support and monitoring",
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
        title: "Share Your Health Information",
        body: "Tell us about your condition, medical history, medications, symptoms, and healthcare goals through our secure intake process.",
      },
      {
        Icon: FiFileText,
        title: "Connect With a Healthcare Provider",
        body: "Meet with a licensed healthcare provider who will review your health status and discuss your ongoing care needs.",
      },
      {
        Icon: FiVideo,
        title: "Develop a Personalized Care Plan",
        body: "Receive recommendations for symptom management, medication adherence, lifestyle adjustments, and ongoing monitoring.",
      },
      {
        Icon: FiPackage,
        title: "Stay Connected With Ongoing Support",
        body: "Schedule follow up appointments to review progress, address concerns, and make adjustments to your care plan when needed.",
      },
    ],
    faqs: [
      {
        q: "What is chronic care management?",
        a: "Chronic care management is an ongoing healthcare service designed to help patients manage long term medical conditions through regular monitoring, treatment planning, and professional support.",
      },
      {
        q: "What conditions can be managed through chronic care services?",
        a: "Common conditions include diabetes, high blood pressure, asthma, COPD, heart disease, arthritis, high cholesterol, and other long term health concerns.",
      },
      {
        q: "Can chronic care management be provided through telehealth?",
        a: "Yes. Telemedicine services allow patients to connect with healthcare providers remotely for ongoing support and monitoring.",
      },
      {
        q: "Why is chronic care management important?",
        a: "Regular care and monitoring can help improve symptom control, reduce complications, and support better long term health outcomes.",
      },
      {
        q: "How often should I schedule follow up visits?",
        a: "The frequency of follow up appointments depends on your condition, treatment plan, and healthcare provider's recommendations.",
      },
      {
        q: "Can chronic care management help prevent complications?",
        a: "Yes. Ongoing monitoring and professional guidance can help identify potential issues early and support preventive care.",
      },
      {
        q: "What are the benefits of virtual chronic care management?",
        a: "Virtual care offers convenient access to healthcare providers, flexible scheduling, and ongoing support from home.",
      },
      {
        q: "Can healthcare providers monitor my progress remotely?",
        a: "Yes. Providers can review symptoms, treatment progress, medication adherence, and health goals during follow up visits.",
      },
      {
        q: "Is chronic care management suitable for diabetes?",
        a: "Yes. Diabetes management is one of the most common conditions supported through chronic care services.",
      },
      {
        q: "Can telehealth help manage high blood pressure?",
        a: "Yes. Healthcare providers can review blood pressure readings, discuss treatment plans, and provide ongoing support.",
      },
      {
        q: "What role does medication management play in chronic care?",
        a: "Medication management helps ensure treatments remain effective, safe, and aligned with your healthcare needs.",
      },
      {
        q: "Can chronic care services improve quality of life?",
        a: "Yes. Consistent healthcare support can help patients manage symptoms and maintain greater independence in daily life.",
      },
      {
        q: "What happens during a chronic care consultation?",
        a: "A healthcare provider reviews your symptoms, treatment plan, medications, health goals, and overall condition management.",
      },
      {
        q: "Can lifestyle changes help manage chronic conditions?",
        a: "Yes. Nutrition, physical activity, sleep habits, and stress management can play an important role in overall health.",
      },
      {
        q: "Is chronic care management only for older adults?",
        a: "No. Adults of all ages living with chronic health conditions may benefit from ongoing healthcare support.",
      },
      {
        q: "Can I discuss multiple chronic conditions during one appointment?",
        a: "Yes. Healthcare providers can review and manage multiple health concerns during a consultation.",
      },
      {
        q: "Are virtual chronic care appointments secure?",
        a: "Yes. Humancare Connect uses secure telemedicine technology designed to protect patient information and privacy.",
      },
      {
        q: "How do I get started with chronic care management?",
        a: "Schedule an appointment, discuss your condition with a healthcare provider, and receive a personalized care plan.",
      },
      {
        q: "Why choose Humancare Connect for chronic care management?",
        a: "Humancare Connect provides secure telemedicine services, licensed healthcare providers, personalized care plans, and convenient access to ongoing healthcare support.",
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
export default function ChronicCareManagement() {
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
      <SEO
        title="Chronic Care Management Online | Ongoing Healthcare Support | Humancare Connect"
        description="Manage chronic health conditions through secure telemedicine services. Connect with licensed healthcare providers for ongoing care, monitoring, and personalized support."
        keywords="Chronic care management, Chronic health conditions, Telemedicine services, Virtual healthcare services, Telehealth services, Virtual chronic care management"
        url="https://humancareconnect.co/chronic-care-management"
      />
      <Helmet>
        <title>
          Chronic Care Management Online | Ongoing Healthcare Support |
          Humancare Connect
        </title>
        <meta
          name="description"
          content="Manage chronic health conditions through secure telemedicine services. Connect with licensed healthcare providers for ongoing care, monitoring, and personalized support."
        />
      </Helmet>

      <main
        className="service-page service-page--chronic-care"
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
                HERO
                ================================================= */}
            <section ref={heroRef} className="service-hero service-hero--with-image">
              <img
                src={HERO_IMAGE.src}
                alt={HERO_IMAGE.alt}
                width={HERO_IMAGE.width}
                height={HERO_IMAGE.height}
                loading="eager"
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
                        Comprehensive Care for Long Term Health Conditions
                      </h2>
                    </motion.div>

                    <motion.p variants={fadeUp} className="service-overview__description">
                      {s.description}
                    </motion.p>

                    <motion.div variants={fadeUp} className="service-why-matters">
                      <div className="service-why-matters__label">
                        Why It Matters
                      </div>
                      <p className="service-why-matters__text">
                        {s.whyItMatters}
                      </p>
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
                      <p className="service-outcome-card__text">
                        {o}
                      </p>
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
                        Accessing chronic care management through Humancare Connect is
                        convenient, secure, and designed around your healthcare needs.
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
                        Get convenient access to chronic care management through trusted
                        telemedicine services and receive ongoing support from licensed
                        healthcare providers.
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
                      <span className="service-label__text">Features & Benefits</span>
                    </div>
                    <h2 className="service-heading-lg">
                      Managing Chronic Conditions
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
                      Chronic conditions are long term health concerns that often require
                      continuous medical attention, lifestyle adjustments, and regular
                      monitoring. Conditions such as diabetes, high blood pressure, heart
                      disease, asthma, arthritis, and chronic respiratory disorders can
                      significantly impact daily life if not properly managed. Consistent
                      healthcare support helps patients maintain better control of their
                      symptoms and overall health.
                    </p>
                    <p>
                      At Humancare Connect, our chronic care management services provide
                      patients with convenient access to licensed healthcare providers
                      through secure telehealth services. Providers work closely with
                      patients to review treatment plans, monitor symptoms, discuss
                      medication management, and identify opportunities to improve health
                      outcomes. Virtual healthcare services make it easier to stay
                      connected with professional care while reducing the need for
                      frequent in person visits.
                    </p>
                    <p>
                      Effective chronic care management goes beyond treating symptoms. It
                      focuses on helping patients understand their conditions, make
                      informed healthcare decisions, maintain healthy lifestyle habits,
                      and prevent complications. Through personalized care and ongoing
                      support, telemedicine services help patients take a proactive
                      approach to managing their long term health.
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
                          <div className="service-why-us__card-title">
                            {title}
                          </div>
                          <div className="service-why-us__card-desc">
                            {desc}
                          </div>
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
                      Ready to Take Control of
                      <br />
                      <span className="service-accent">Your Long Term Health?</span>
                    </h2>
                    <p className="service-cta-desc">
                      Connect with a licensed healthcare provider through secure
                      telemedicine services and receive personalized chronic care management
                      designed to support your health goals and improve your quality of
                      life.
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
