import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
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
import heroBanner from "../../assets/MedicalServices/online-prescription-digital-healthcare.webp";
import ServiceBookingCard from "../../components/booking/ServiceBookingCard";
import "../Specialty/SpecialtyPage.css";
import "../Categories/categoriesGlobal.css";
import "./newservices.css";
import { useServicePrice } from "../../hooks/useServicePrice";

const HERO_IMAGE = {
  src: heroBanner,
  alt: "Healthcare professionals providing telemedicine and virtual healthcare solutions for businesses across corporate, insurance, maritime, legal, and hospitality industries",
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
    slug: "online-prescription-refills",
    name: "ONLINE PRESCRIPTION REFILLS",
    serviceName: "Online Prescription Refills",
    tagline: "Fast, convenient medication renewals from anywhere.",
    intro:
      "Request online prescription refills through secure telemedicine services. Connect with a licensed healthcare provider, review your medications, and receive prescription renewal support when clinically appropriate. Stay on track with your treatment plan from the comfort of your home.",
    accentColor: "#2563EB",
    accentGlow: "#2563EB20",
    heroIcon: FiMonitor,
    heroEmoji: "🖥️",
    description:
      "Online prescription refills allow eligible patients to renew ongoing medications through secure telemedicine services without an unnecessary clinic visit. Through Humancare Connect, you can connect with a licensed healthcare provider who can review your medical history, current medications, and treatment needs to determine whether a prescription renewal is appropriate. Convenient care is available from home, work, or wherever life takes you.",
    whyItMatters:
      "Missing or delaying medication can affect your health and treatment outcomes. Online prescription refills help patients maintain continuity of care, stay on track with prescribed treatment plans, and access healthcare support when they need it most.",
    whoBenefits: [
      "Patients managing chronic health conditions",
      "Busy professionals seeking convenient healthcare access",
      "Travelers who need continued access to prescribed medications",
      "Adults looking for secure and reliable telehealth services",
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
        title: "Request Your Refill",
        body: "Tell us about your medication, health history, and refill needs through our secure intake form.",
      },
      {
        Icon: FiFileText,
        title: "Connect With a Provider",
        body: "A licensed healthcare provider will review your information and discuss your treatment plan.",
      },
      {
        Icon: FiVideo,
        title: "Complete Your Consultation",
        body: "Join a secure virtual consultation from your phone, tablet, or computer at your scheduled time.",
      },
      {
        Icon: FiPackage,
        title: "Receive Your Prescription",
        body: "If medically appropriate, your prescription refill can be sent to your preferred pharmacy for pickup.",
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
        q: "What is an online prescription refill?",
        a: "An online prescription refill allows eligible patients to request a renewal of their ongoing medications through a secure telemedicine consultation with a licensed healthcare provider.",
      },
      {
        q: "Can I get a prescription refill online?",
        a: "Yes. Many maintenance medications may be eligible for online prescription refills following a clinical review by a healthcare provider.",
      },
      {
        q: "What medications can be refilled through telehealth?",
        a: "Prescription refill services may support medications used for chronic conditions such as high blood pressure, diabetes, asthma, thyroid disorders, allergies, and high cholesterol.",
      },
      {
        q: "Do I need an appointment for a prescription refill?",
        a: "Yes. A healthcare provider typically needs to review your health history, current medications, and treatment needs before renewing a prescription.",
      },
      {
        q: "How long does the prescription refill process take?",
        a: "Most online consultations take only a few minutes. If approved, prescriptions can often be sent electronically to your preferred pharmacy.",
      },
      {
        q: "Can I request a refill for a chronic condition medication?",
        a: "Yes. Many patients use online prescription refill services to maintain access to medications used for long term health conditions.",
      },
      {
        q: "Can I refill blood pressure medication online?",
        a: "In many cases, eligible patients may request prescription renewals for blood pressure medications through telemedicine services.",
      },
      {
        q: "Can I refill diabetes medication through telehealth?",
        a: "Patients managing diabetes may be eligible for prescription refill evaluations depending on their treatment plan and medical needs.",
      },
      {
        q: "Are online prescription refills secure?",
        a: "Yes. Humancare Connect uses secure telemedicine technology designed to protect patient privacy and healthcare information.",
      },
      {
        q: "Can a healthcare provider deny a refill request?",
        a: "Yes. A provider may determine that additional testing, a medication adjustment, or an in person evaluation is necessary before renewing a prescription.",
      },
      {
        q: "Can I choose my pharmacy?",
        a: "Yes. If your prescription refill is approved, it can typically be sent to your preferred pharmacy when permitted by applicable regulations.",
      },
      {
        q: "What information do I need for a prescription refill?",
        a: "Patients should be prepared to provide details about their current medications, medical history, symptoms, and treatment goals.",
      },
      {
        q: "Can I request multiple prescription refills during one visit?",
        a: "Depending on your healthcare needs and provider assessment, multiple medication refill requests may be reviewed during the same consultation.",
      },
      {
        q: "Are prescription refills available for travelers?",
        a: "Yes. Telehealth services can help eligible patients maintain access to ongoing medications while traveling or away from home.",
      },
      {
        q: "Does insurance cover online prescription refill services?",
        a: "Coverage varies by insurance provider and health plan. Patients should verify coverage details with their insurance carrier.",
      },
      {
        q: "What are the benefits of online prescription refills?",
        a: "Online prescription refills provide convenient access to healthcare providers, help prevent treatment interruptions, and support continuity of care.",
      },
      {
        q: "Who can benefit from prescription refill services?",
        a: "Adults managing chronic conditions, long term medications, or ongoing treatment plans may benefit from online prescription refill services.",
      },
      {
        q: "Can online prescription refills help with medication management?",
        a: "Yes. Providers can review your current medications, discuss treatment progress, and help ensure your care plan remains appropriate for your needs.",
      },
      {
        q: "Why choose Humancare Connect for online prescription refills?",
        a: "Humancare Connect offers secure telemedicine services, licensed healthcare providers, convenient online appointments, and patient focused care designed to support safe and reliable medication management.",
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
   ROOT APP
───────────────────────────────────────────────────────────────────────── */
export default function OnlinePrescriptionRefills() {
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
        className="service-page service-page--prescription-refills"
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
                        What Are Online Prescription Refills?
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
                        Requesting an online prescription refill through Humancare
                        Connect is quick, secure, and convenient.
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
                        Get convenient access to online prescription refills through
                        trusted telemedicine services. Most appointments take just a
                        few minutes, helping you stay on track with your medications
                        and ongoing care.
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
                      Understanding Online
                      <br />
                      <span className="service-accent">Prescription Refills</span>
                    </h2>
                    <p className="service-section-header__subtitle">
                      Every feature is designed around one goal: better outcomes for you.
                    </p>
                  </motion.div>

                  <motion.div variants={fadeUp} className="service-feature-card">
                    <p>
                      Online prescription refills allow eligible patients to renew ongoing
                      medications through a secure telemedicine consultation with a
                      licensed healthcare provider. This service is designed for
                      individuals who are managing chronic health conditions, maintaining
                      long term treatment plans, or requiring continued access to
                      prescribed medications. Instead of scheduling an in person
                      appointment for routine medication renewals, patients can connect
                      with a healthcare provider remotely and receive professional
                      guidance from the comfort of home.
                    </p>
                    <p>
                      At Humancare Connect, our online prescription refill service helps
                      simplify medication management while supporting continuity of care.
                      Healthcare providers can review your medical history, current
                      medications, treatment progress, and ongoing healthcare needs to
                      determine whether a prescription renewal is appropriate. This
                      approach helps patients stay consistent with their treatment plans
                      while reducing delays that could impact their health outcomes.
                    </p>
                    <p>
                      Online prescription refills are commonly requested for conditions
                      such as high blood pressure, diabetes, asthma, allergies, thyroid
                      disorders, high cholesterol, migraine management, and other ongoing
                      health concerns. By combining convenient access to telemedicine
                      services with professional clinical oversight, Humancare Connect
                      helps patients maintain their healthcare journey through secure,
                      accessible, and patient centered virtual healthcare services.
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
                      Ready to Prioritize Your
                      <br />
                      <span className="service-accent">Prescription?</span>
                    </h2>
                    <p className="service-cta-desc">
                      Stay on track with your treatment plan through secure online
                      prescription refill services. Connect with a licensed healthcare
                      provider, request medication renewals when clinically appropriate,
                      and access convenient telehealth services from wherever you are.
                    </p>
                    <div className="service-cta-btn-group">
                      <button
                        type="button"
                        className="service-btn service-btn--primary"
                      >
                        <a href="/login">Get Started Today</a>
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
