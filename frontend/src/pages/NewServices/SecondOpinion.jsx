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
  FiActivity,
  FiCalendar,
} from "react-icons/fi";

import SEO from "../../components/Seo";
import ServiceContact from "./ServiceContact";
import CentralFAQ from "../../components/FAQ/FAQ";
import heroBanner from "../../assets/SpecialitiesImage/expert-medical-opinion-second-opinion-healthcare-specialist.webp";
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
    slug: "online-second-medical-opinion",
    name: "ONLINE SECOND MEDICAL OPINION",
    serviceName: "Online Second Medical Opinion",
    tagline:
      "Get trusted guidance before making important healthcare decisions.",
    intro:
      "Connect with qualified specialists through secure telemedicine services for a comprehensive second medical opinion. Whether you've received a new diagnosis, are considering surgery, reviewing a cancer treatment plan, or managing a complex medical condition, our specialists carefully evaluate your medical records and provide personalized recommendations to help you move forward with confidence.",
    accentColor: "#2563EB",
    accentGlow: "#2563EB20",
    heroIcon: FiMonitor,
    heroEmoji: "🖥️",
    description:
      "An online second medical opinion gives you the opportunity to have your diagnosis, treatment plan, or recommended procedure reviewed by a qualified specialist through secure telemedicine services. At Humancare Connect, our Second Medical Opinion Service helps you gain greater clarity about your health by providing an independent evaluation of your medical records, diagnostic reports, imaging, pathology findings, and treatment recommendations. Whether you're facing a new diagnosis, considering surgery, managing a complex medical condition, or exploring cancer treatment options, our specialists help you make informed healthcare decisions with confidence from wherever you are.",
    whyItMatters:
      "Making important healthcare decisions can feel overwhelming, especially when you're diagnosed with a serious or complex medical condition. A second medical opinion can help confirm your diagnosis, identify additional treatment options, and provide reassurance before moving forward with surgery, ongoing treatment, or long-term care. Having expert guidance gives you the confidence to choose the care that's right for you.",
    whoBenefits: [
      "Patients who want to confirm a diagnosis before starting treatment",
      "Individuals considering surgery or other major medical procedures",
      "Patients seeking a second opinion for cancer diagnosis or treatment plans",
      "People managing complex, rare, or chronic medical conditions",
      "Individuals looking for additional treatment options before making healthcare decisions",
      "Anyone who wants greater confidence and clarity about their medical care",
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
        q: "What is a second medical opinion?",
        a: "A second medical opinion is an independent evaluation of your diagnosis, treatment plan, or recommended procedure by another qualified specialist. It helps you better understand your condition and make informed healthcare decisions.",
      },
      {
        q: "When should I get a second medical opinion?",
        a: "You may benefit from a second medical opinion if you've received a new diagnosis, are considering surgery, have a complex medical condition, or want to explore additional treatment options.",
      },
      {
        q: "What conditions can be reviewed through this service?",
        a: "Our Second Medical Opinion Service supports patients with cancer diagnoses, chronic illnesses, neurological disorders, cardiovascular conditions, orthopedic concerns, gastrointestinal conditions, rare diseases, and other complex medical cases.",
      },
      {
        q: "Can I get a second medical opinion online?",
        a: "Yes. Humancare Connect offers secure telemedicine services, allowing you to connect with qualified specialists through virtual consultations from wherever you are.",
      },
      {
        q: "What medical records do I need to provide?",
        a: "You may be asked to upload medical records, diagnostic reports, imaging studies, pathology reports, laboratory results, physician notes, and your current treatment plan for review.",
      },
      {
        q: "Will the specialist review my treatment plan?",
        a: "Yes. Your specialist will review your diagnosis, current treatment recommendations, and available treatment options to provide personalized guidance based on your medical information.",
      },
      {
        q: "Can I request a second opinion before surgery?",
        a: "Absolutely. Many patients seek a second medical opinion before elective or major surgery to better understand the procedure, potential benefits, risks, and available alternatives.",
      },
      {
        q: "Is a second medical opinion helpful for cancer treatment?",
        a: "Yes. A second medical opinion can help confirm a cancer diagnosis, review pathology findings, evaluate treatment options, and provide additional guidance before beginning treatment.",
      },
      {
        q: "How long does the second medical opinion process take?",
        a: "The timeline depends on the complexity of your case and how quickly your medical records are available. Our team works to connect you with a qualified specialist as promptly as possible.",
      },
      {
        q: "Will I have a virtual consultation with the specialist?",
        a: "Yes. If appropriate, you'll meet with your specialist through a secure virtual consultation to discuss your diagnosis, review findings, and answer your questions.",
      },
      {
        q: "Is my personal health information secure?",
        a: "Yes. Your medical information is handled through secure telemedicine services and protected using industry-standard privacy and security practices.",
      },
      {
        q: "Can a second medical opinion confirm or change my diagnosis?",
        a: "A second medical opinion may confirm your current diagnosis or provide additional insights that help clarify your condition or identify other treatment options.",
      },
      {
        q: "Do I need a referral to request a second medical opinion?",
        a: "Requirements may vary depending on your insurance plan or healthcare provider. Many patients can request a second medical opinion directly through Humancare Connect.",
      },
      {
        q: "Will my current doctor know that I requested a second opinion?",
        a: "You decide whether to share your second medical opinion with your current healthcare provider. Many physicians support patients seeking additional guidance before making important healthcare decisions.",
      },
      {
        q: "How do I schedule a second medical opinion with Humancare Connect?",
        a: "Simply book an appointment online, securely upload your medical records, and we'll connect you with a qualified specialist for a personalized second medical opinion.",
      },
    ],
  },
};

const relatedServicesItems = [
  {
    Icon: FiActivity,
    title: "Cancer Second Opinion",
    desc: "Receive an independent review of your cancer diagnosis, pathology reports, treatment recommendations, and care plan to help you make informed decisions about your cancer treatment.",
    href: "/online-second-medical-opinion/cancer-second-opinion",
    linkLabel: "Explore More",
  },
  {
    Icon: FiSearch,
    title: "Complex Diagnosis Review",
    desc: "Get expert evaluation for difficult-to-diagnose conditions, unresolved symptoms, or rare medical disorders when you need additional clinical insight.",
    href: "/online-second-medical-opinion/complex-diagnosis-review",
    linkLabel: "Explore More",
  },
  {
    Icon: FiUserCheck,
    title: "Surgery Second Opinion",
    desc: "Understand your surgical options with an independent review of recommended procedures, potential risks, expected outcomes, and alternative treatment approaches.",
    href: "/online-second-medical-opinion/surgery-second-opinion",
    linkLabel: "Explore More",
  },
  {
    Icon: FiFileText,
    title: "Treatment Plan Review",
    desc: "Have your current treatment plan reviewed by a qualified specialist to ensure you understand your available options and next steps.",
    href: "/online-second-medical-opinion/treatment-plan-review",
    linkLabel: "Explore More",
  },
];

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
export default function SecondOpinion() {
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
        className="service-page service-page--second-opinion"
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
                        What Is an Online Second Medical Opinion?
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
                        Getting a second medical opinion is{" "}
                        <span className="service-accent">simple.</span>
                      </h2>
                      <p
                        className="service-section-header__subtitle"
                        style={{ marginBottom: 36, textAlign: "left" }}
                      >
                        Connect with a qualified specialist through Humancare Connect
                        for a secure, convenient, and personalized second medical
                        opinion from wherever you are.
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
                        Ready for a second opinion?
                      </h3>
                      <p className="service-how-it-works__card-text">
                        Get trusted guidance from qualified specialists through
                        secure telemedicine services. Whether you're reviewing a
                        diagnosis, considering surgery, or exploring treatment options,
                        we're here to help you make informed healthcare decisions with
                        confidence.
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
                      <span className="service-accent">
                        Second Medical Opinions
                      </span>
                    </h2>
                    <p className="service-section-header__subtitle">
                      Get trusted guidance before making important healthcare decisions.
                    </p>
                  </motion.div>

                  <motion.div variants={fadeUp} className="service-feature-card">
                    <p>
                      A second medical opinion gives you the opportunity to have your
                      diagnosis, treatment plan, or recommended procedure
                      independently reviewed by a qualified specialist through secure
                      telemedicine services. At Humancare Connect, our Second Medical
                      Opinion Service helps patients better understand their health by
                      providing expert guidance before moving forward with treatment,
                      surgery, or long-term care.
                    </p>
                    <p>
                      Whether you've recently been diagnosed with a serious medical
                      condition, are evaluating cancer treatment options, managing a
                      chronic illness, or considering surgery, a second medical
                      opinion can provide valuable insight and reassurance. Our
                      specialists carefully review your medical records, diagnostic
                      reports, imaging studies, pathology findings, and current
                      treatment recommendations to offer personalized guidance based on
                      your individual healthcare needs.
                    </p>
                    <p>
                      Many patients seek a second medical opinion to confirm a
                      diagnosis, explore alternative treatment options, or gain greater
                      confidence before making significant healthcare decisions.
                      Through secure virtual consultations, Humancare Connect makes it
                      convenient to connect with qualified specialists from wherever
                      you are, helping you make informed decisions with clarity,
                      confidence, and peace of mind.
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
                RELATED SERVICES
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
                      <span className="service-label__text">Related Services</span>
                    </div>
                    <h2 className="service-heading-lg">
                      Explore More{" "}
                      <span className="service-accent">
                        Second Opinion Services
                      </span>
                    </h2>
                    <p
                      className="service-section-header__subtitle"
                      style={{ maxWidth: 640 }}
                    >
                      Every healthcare decision is unique. In addition to our Second
                      Medical Opinion Service, Humancare Connect offers specialized
                      second opinion services for complex diagnoses, cancer care,
                      surgery recommendations, and treatment plan reviews. Connect
                      with qualified specialists to gain expert guidance tailored to
                      your healthcare needs.
                    </p>
                  </motion.div>

                  <div className="service-related__grid">
                    {relatedServicesItems.map(
                      ({ Icon, title, desc, href, linkLabel }, i) => (
                        <motion.a
                          key={i}
                          href={href}
                          variants={fadeUp}
                          custom={i}
                          className="service-related-card"
                        >
                          <div className="service-related-card__icon-wrap">
                            <Icon className="service-related-card__icon" />
                          </div>
                          <div className="service-related-card__title">
                            {title}
                          </div>
                          <p className="service-related-card__desc">{desc}</p>
                          <span className="service-related-card__link">
                            {linkLabel} <FiArrowRight style={{ fontSize: 14 }} />
                          </span>
                        </motion.a>
                      ),
                    )}
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
                      Get Started Today
                    </div>
                    <h2 className="service-cta-title">
                      Ready for a Trusted
                      <br />
                      <span className="service-accent">
                        Second Medical Opinion?
                      </span>
                    </h2>
                    <p className="service-cta-desc">
                      When it comes to your health, confidence matters. Connect with
                      a qualified specialist through Humancare Connect to review your
                      diagnosis, treatment plan, or recommended procedure. Get expert
                      guidance, personalized recommendations, and the clarity you need
                      to make informed healthcare decisions from the comfort of your
                      home.
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
