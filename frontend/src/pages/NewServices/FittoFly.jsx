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
import heroBanner from "../../assets/MedicalServices/fit-to-fly-medical-certificate.webp";
import ServiceBookingCard from "../../components/booking/ServiceBookingCard";
import "../Specialty/SpecialtyPage.css";
import "../Categories/categoriesGlobal.css";
import "./newservices.css";
import { useServicePrice } from "../../hooks/useServicePrice";
import ServiceContact from "./ServiceContact";
import CentralFAQ from "../../components/FAQ/FAQ";

const HERO_IMAGE = {
  src: heroBanner,
  alt: "Licensed healthcare provider conducting a virtual fit to fly certificate consultation for airline medical clearance",
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
    slug: "fit-to-fly",
    name: "FIT TO FLY CERTIFICATE",
    serviceName: "Fit to Fly Certificate",
    tagline: "Medical travel clearance for a smoother journey.",
    intro:
      "Request a Fit to Fly Certificate through secure telemedicine services. Connect with a licensed healthcare provider, discuss your travel plans and health status, and receive medical documentation when clinically appropriate to support airline travel requirements.",
    accentColor: "#2563EB",
    accentGlow: "#2563EB20",
    heroIcon: FiMonitor,
    heroEmoji: "🖥️",
    description:
      "A Fit to Fly Certificate is a medical document that may be required by airlines for passengers with certain health conditions, recent surgeries, pregnancy-related travel considerations, or ongoing medical concerns. The certificate confirms that a healthcare provider has reviewed your condition and assessed your ability to travel safely by air. Through Humancare Connect, eligible travelers can complete a virtual consultation with a licensed healthcare provider, discuss airline requirements, and obtain travel-related medical documentation when appropriate. Our telemedicine platform offers a convenient way to address travel health requirements without the need for an in-person clinic visit.",
    whyItMatters:
      "Unexpected airline documentation requirements can delay or disrupt travel plans. A Fit to Fly assessment helps travelers understand whether medical clearance may be needed before departure and provides an opportunity to address health concerns before boarding.",
    whoBenefits: [
      "Travelers recovering from surgery or hospitalization",
      "Passengers with chronic medical conditions",
      "Pregnant individuals requiring airline documentation",
      "Travelers with recent illnesses or injuries",
      "U.S. travelers needing medical travel clearance",
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
        title: "Share Your Travel & Health Information",
        body: "Tell us about your upcoming trip, airline requirements, medical history, recent treatments, and any health concerns that may impact your travel plans.",
      },
      {
        Icon: FiFileText,
        title: "Connect With a Healthcare Provider",
        body: "A licensed healthcare provider will review your information, discuss your condition, and assess any factors that could affect your ability to travel safely.",
      },
      {
        Icon: FiVideo,
        title: "Complete Your Virtual Assessment",
        body: "Join a secure online consultation from your phone, tablet, or computer and discuss your travel needs with your provider.",
      },
      {
        Icon: FiPackage,
        title: "Receive Your Travel Documentation",
        body: "If medically appropriate, your provider will issue the required travel clearance documentation or fit-to-fly certificate to help support your travel plans.",
      },
    ],
    faqs: [
      {
        q: "What is a Fit to Fly Certificate?",
        a: "A Fit to Fly Certificate is a medical document issued by a healthcare provider after assessing a traveler's health status. It may be used to confirm that a person is medically suitable for air travel based on their current condition.",
      },
      {
        q: "Why might an airline require a Fit to Fly Certificate?",
        a: "Airlines may request medical clearance for passengers recovering from illness, surgery, injury, pregnancy-related conditions, or certain ongoing health concerns that could affect travel.",
      },
      {
        q: "Who may benefit from a Fit to Fly assessment?",
        a: "Travelers with recent medical procedures, chronic health conditions, respiratory concerns, pregnancy-related travel needs, or other health issues that could require airline approval may benefit from an assessment.",
      },
      {
        q: "Can I request a Fit to Fly Certificate online?",
        a: "Yes. Eligible travelers can complete a virtual consultation with a licensed healthcare provider through secure telemedicine services and discuss their travel requirements.",
      },
      {
        q: "What health conditions commonly require travel clearance?",
        a: "Conditions involving recent surgery, cardiovascular concerns, respiratory illnesses, pregnancy, mobility limitations, or ongoing medical treatment may require additional review before travel.",
      },
      {
        q: "How soon should I arrange my Fit to Fly assessment?",
        a: "It is best to schedule your assessment several days before departure to allow sufficient time for evaluation and any necessary documentation.",
      },
      {
        q: "Can I obtain a Fit to Fly Certificate after surgery?",
        a: "Many travelers seek medical clearance after surgery. Eligibility depends on the type of procedure, recovery progress, current symptoms, and provider assessment.",
      },
      {
        q: "Is a Fit to Fly assessment available for pregnant travelers?",
        a: "Yes. Pregnant travelers may request an assessment, especially when airline policies require medical documentation during certain stages of pregnancy.",
      },
      {
        q: "Can travelers with chronic medical conditions request a certificate?",
        a: "Yes. Individuals managing stable chronic conditions may be eligible for assessment based on their medical history, current health status, and travel plans.",
      },
      {
        q: "What information should I prepare before my consultation?",
        a: "You may be asked to provide details about your medical history, medications, recent treatments, travel itinerary, airline requirements, and current symptoms.",
      },
      {
        q: "How is eligibility for a Fit to Fly Certificate determined?",
        a: "A healthcare provider reviews your medical information, travel plans, and overall condition before determining whether medical clearance is appropriate.",
      },
      {
        q: "What happens during a Fit to Fly consultation?",
        a: "During the consultation, a provider may discuss your health history, recent medical events, current symptoms, medications, and travel-related concerns.",
      },
      {
        q: "Can a healthcare provider recommend postponing travel?",
        a: "Yes. If a provider believes air travel could pose a health risk, they may recommend delaying travel or seeking additional medical evaluation.",
      },
      {
        q: "Are Fit to Fly Certificates accepted for international travel?",
        a: "Many travelers use Fit to Fly Certificates for international travel when requested by airlines or destination-specific travel requirements.",
      },
      {
        q: "Does a Fit to Fly Certificate guarantee boarding approval?",
        a: "No. Final travel decisions remain subject to airline policies, operational procedures, and any additional documentation requirements.",
      },
      {
        q: "What should I do if my health condition changes before departure?",
        a: "If you experience new symptoms or changes in your condition after receiving medical clearance, you should seek further medical advice before traveling.",
      },
      {
        q: "Can I discuss travel-related health concerns during my appointment?",
        a: "Yes. Providers can discuss travel health considerations, medication management, mobility concerns, and precautions that may help support safer travel.",
      },
      {
        q: "Are online Fit to Fly consultations secure?",
        a: "Yes. Humancare Connect uses secure telemedicine technology designed to protect patient privacy and healthcare information.",
      },
      {
        q: "Why choose Humancare Connect for a Fit to Fly assessment?",
        a: "Humancare Connect provides convenient access to licensed healthcare providers, secure virtual consultations, and professional travel health support from wherever you are.",
      },
      {
        q: "How do I get started?",
        a: "Simply schedule an appointment, share your travel details, complete your virtual consultation, and discuss your eligibility for a Fit to Fly Certificate with a healthcare provider.",
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
  [FiAward, "Verified Providers", "Every clinician is credentialed, licensed, and continuously reviewed."],
  [FiHeart, "Patient-Centered Care", "Clinical decisions are made in partnership with you — never without your input."],
  [FiGlobe, "Nationwide Access", "Care without geographic limits — from metro centers to remote districts."],
  [FiZap, "Fast Scheduling", "From first contact to first appointment in hours, not weeks."],
  [FiLock, "Secure Platform", "Enterprise-grade encryption protects every record and transaction."],
  [FiBarChart2, "Outcome Accountability", "We track results and publicly report our care quality standards."],
];

/* ──────────────────────────────────────────────────────────────────────────
   ROOT APP
────────────────────────────────────────────────────────────────────────── */
export default function FitToFly() {
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
        className="service-page service-page--fit-to-fly"
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
                        What Is a Fit to Fly Certificate?
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

                  <motion.div variants={fadeUp} className="service-overview__sticky">
                    <ServiceContact s={s} />
                  </motion.div>
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
                        Obtaining a Fit to Fly Certificate through Humancare Connect is
                        quick, secure, and designed to fit your travel schedule.
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

                  <motion.div variants={fadeUp} className="service-overview__sticky">
                    <div className="service-how-it-works__card">
                      {React.createElement(s.heroIcon, { className: "service-how-it-works__card-icon" })}
                      <h3 className="service-how-it-works__card-title">Ready to begin?</h3>
                      <p className="service-how-it-works__card-text">
                        Get professional travel health support from licensed healthcare
                        providers through secure telemedicine services. Complete your
                        assessment online and prepare for your journey with confidence.
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
                      Understanding Fit to Fly Certificates
                    </h2>
                  </motion.div>

                  <motion.div variants={fadeUp} className="service-feature-card">
                    <p>
                      A Fit to Fly Certificate is often requested when an airline requires
                      confirmation that a passenger can safely travel despite a recent
                      illness, injury, surgery, pregnancy-related concern, or ongoing
                      medical condition. The purpose of the certificate is to provide
                      medical clearance based on an assessment of the traveler's current
                      health status and travel plans.
                    </p>
                    <p>
                      Through Humancare Connect, travelers can access telemedicine
                      services to discuss their health concerns and airline requirements
                      with a licensed healthcare provider. During the consultation,
                      providers may review medical history, recent treatments,
                      medications, symptoms, recovery progress, and travel details to
                      determine whether additional precautions or documentation may be
                      necessary before travel.
                    </p>
                    <p>
                      Fit to Fly assessments are commonly requested by travelers
                      recovering from surgery, managing chronic health conditions,
                      traveling during pregnancy, or returning to travel after a recent
                      medical event. By combining convenient online doctor appointments
                      with professional medical review, Humancare Connect helps travelers
                      access virtual healthcare services that support informed travel
                      decisions and help reduce unexpected disruptions before departure.
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
                      Results you can <span className="service-accent">measure.</span>
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
                      Ready to Travel
                      <br />
                      <span className="service-accent">With Confidence?</span>
                    </h2>
                    <p className="service-cta-desc">
                      Whether you're preparing for an upcoming flight, recovering from a
                      recent medical condition, or need documentation for airline
                      requirements, Humancare Connect makes it simple to access professional
                      travel health support.
                      <br /><br />
                      Connect with a licensed healthcare provider through secure
                      telemedicine services, complete your Fit to Fly assessment online, and
                      receive medical clearance documentation when clinically appropriate.
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
