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
    name: "WEIGHT LOSS PROGRAMS",
    tagline:
      "Personalized support for healthy and sustainable weight management.",
    intro:
      "Achieve your health goals with personalized weight loss programs through secure telemedicine services. Connect with licensed healthcare providers who can help you create a realistic weight management plan based on your health history, lifestyle, and individual needs. Get expert guidance from the comfort of your home.",
    accentColor: "#2563EB",
    accentGlow: "#2563EB20",
    heroIcon: FiMonitor,
    heroEmoji: "🖥️",
    description:
      "Weight loss programs are personalized healthcare services designed to help individuals achieve and maintain a healthy weight through evidence based strategies. Through Humancare Connect, patients can connect with licensed healthcare providers who assess their health status, discuss weight management goals, and recommend appropriate lifestyle changes, nutrition guidance, and treatment options when clinically appropriate.",
    whyItMatters:
      "Maintaining a healthy weight can support overall wellness and may help reduce the risk of health conditions such as high blood pressure, type 2 diabetes, heart disease, sleep apnea, and joint problems. Professional weight management support can help patients build sustainable habits and achieve long term success.",
    whoBenefits: [
      "Adults seeking healthy weight management support",
      "Individuals struggling with overweight or obesity",
      "Patients looking to improve overall health and wellness",
      "People managing weight related health conditions",
      "Individuals seeking personalized nutrition and lifestyle guidance",
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
        title: "Share Your Health Goals",
        body: "Tell us about your weight management goals, health history, lifestyle habits, and any existing medical conditions.",
      },
      {
        Icon: FiFileText,
        title: "Meet With a Healthcare Provider",
        body: "Connect with a licensed healthcare provider who will evaluate your needs and discuss personalized weight loss strategies.",
      },
      {
        Icon: FiVideo,
        title: "Receive a Personalized Plan",
        body: "Your provider may recommend nutrition guidance, lifestyle modifications, activity goals, and other weight management approaches.",
      },
      {
        Icon: FiPackage,
        title: "Stay on Track",
        body: "Continue your journey with ongoing support, follow up appointments, and adjustments to your plan as needed.",
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
        q: "What is a weight loss program?",
        a: "A weight loss program is a personalized plan designed to help individuals achieve and maintain a healthy weight through nutrition guidance, lifestyle changes, physical activity, and professional healthcare support.",
      },
      {
        q: "Can telehealth help with weight loss?",
        a: "Yes. Telemedicine services provide convenient access to healthcare providers who can offer weight management guidance, monitor progress, and recommend personalized strategies.",
      },
      {
        q: "Who can benefit from a weight loss program?",
        a: "Adults seeking healthier lifestyle habits, weight management support, or help managing weight related health conditions may benefit from a structured program.",
      },
      {
        q: "Are weight loss programs personalized?",
        a: "Yes. Healthcare providers consider your health history, goals, lifestyle habits, and current health status when creating recommendations.",
      },
      {
        q: "Can weight loss improve overall health?",
        a: "Maintaining a healthy weight may help support heart health, blood pressure management, blood sugar control, mobility, and overall wellness.",
      },
      {
        q: "How do I get started with a weight loss program?",
        a: "You can schedule an online appointment, discuss your goals with a healthcare provider, and receive a personalized weight management plan.",
      },
      {
        q: "Are virtual weight loss consultations effective?",
        a: "Virtual consultations provide convenient access to professional guidance and ongoing support while helping patients stay engaged in their health goals.",
      },
      {
        q: "Can weight loss programs help with obesity?",
        a: "Yes. Weight management programs can provide support for individuals living with overweight or obesity through personalized care and lifestyle recommendations.",
      },
      {
        q: "What role does nutrition play in weight loss?",
        a: "Balanced nutrition is a key component of healthy weight management and can help support sustainable long term results.",
      },
      {
        q: "How often should I follow up with a provider?",
        a: "Follow up schedules vary based on individual goals, progress, and healthcare needs.",
      },
      {
        q: "Can weight loss programs support long term success?",
        a: "Yes. Sustainable habits and ongoing support are important factors in maintaining long term weight management results.",
      },
      {
        q: "Do I need to exercise to lose weight?",
        a: "Physical activity is often recommended as part of a comprehensive weight management plan, but recommendations vary by individual.",
      },
      {
        q: "Can weight loss help reduce health risks?",
        a: "Achieving a healthier weight may help reduce risks associated with conditions such as type 2 diabetes, heart disease, and high blood pressure.",
      },
      {
        q: "Are online weight loss programs secure?",
        a: "Yes. Humancare Connect uses secure telemedicine technology to protect patient privacy and healthcare information.",
      },
      {
        q: "Can healthcare providers monitor my progress remotely?",
        a: "Yes. Providers can review your progress during follow up appointments and recommend adjustments to your plan when appropriate.",
      },
      {
        q: "What makes a healthy weight loss plan?",
        a: "Healthy weight loss plans focus on balanced nutrition, sustainable lifestyle changes, realistic goals, and ongoing support.",
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
export default function WeightLossPrograms() {
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
        className="service-page service-page--weight-loss"
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
                        What Are Weight Loss Programs?
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
                        Beginning your weight loss journey through Humancare Connect is
                        convenient, secure, and designed around your individual needs.
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
                        Take control of your health with personalized weight loss
                        programs through Humancare Connect. Connect with a licensed
                        healthcare provider and start building healthier habits today.
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
                      Understanding Weight Loss
                      <br />
                      <span className="service-accent">Programs</span>
                    </h2>
                    <p className="service-section-header__subtitle">
                      Every feature is designed around one goal: better outcomes for you.
                    </p>
                  </motion.div>

                  <motion.div variants={fadeUp} className="service-feature-card">
                    <p>
                      Weight loss is not simply about reducing numbers on a scale.
                      Effective weight management focuses on improving overall health
                      through sustainable lifestyle changes, balanced nutrition, regular
                      physical activity, and professional healthcare guidance. Every
                      individual has unique health needs, which is why personalized care
                      plays an important role in long term success.
                    </p>
                    <p>
                      At Humancare Connect, our weight loss programs are designed to
                      provide patient centered support through virtual healthcare
                      services. Licensed healthcare providers evaluate factors such as
                      current weight, medical history, lifestyle habits, nutrition
                      patterns, and health goals to develop individualized
                      recommendations. This personalized approach helps patients make
                      meaningful progress while prioritizing their overall well being.
                    </p>
                    <p>
                      Weight loss programs may benefit individuals who are managing
                      obesity, weight related health concerns, or difficulties maintaining
                      healthy lifestyle habits. Through secure telemedicine services,
                      patients can access professional support, receive ongoing guidance,
                      and stay accountable throughout their weight management journey
                      without the need for frequent in person visits.
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
                      Ready to Reach Your Weight
                      <br />
                      <span className="service-accent">Management Goals?</span>
                    </h2>
                    <p className="service-cta-desc">
                      Take control of your health with personalized weight loss programs
                      through Humancare Connect. Connect with a licensed healthcare
                      provider, receive expert guidance, and start building healthier habits
                      that support long term wellness.
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
