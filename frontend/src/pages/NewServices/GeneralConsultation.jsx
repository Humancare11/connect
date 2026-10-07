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
import heroBanner from "../../assets/MedicalServices/general-consultation-online.webp";
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

/* ──────────────────────────────────────────────────────────────────────────
   DATA
────────────────────────────────────────────────────────────────────────── */
const SERVICES = {
  "telehealth-services": {
    slug: "general-consultations",
    name: "GENERAL CONSULTATION",
    serviceName: "General Consultation",
    tagline: "Trusted healthcare guidance for everyday health concerns.",
    intro:
      "Connect with a licensed healthcare provider through secure telemedicine services for personalized medical advice, symptom evaluation, and treatment recommendations. General consultations offer a convenient way to discuss non emergency health concerns and receive professional care from the comfort of home.",
    accentColor: "#2563EB",
    accentGlow: "#2563EB20",
    heroIcon: FiMonitor,
    heroEmoji: "🖥️",
    description:
      "General consultations provide patients with convenient access to healthcare providers for a wide range of everyday medical concerns. Through Humancare Connect, patients can discuss symptoms, receive medical guidance, review treatment options, and get recommendations for appropriate next steps through secure virtual healthcare services.",
    whyItMatters:
      "Many health concerns can be addressed early through timely medical advice and evaluation. General consultations help patients better understand their symptoms, make informed healthcare decisions, and access professional support without the need for unnecessary clinic visits.",
    whoBenefits: [
      "Adults experiencing new or ongoing health concerns",
      "Patients managing common illnesses or minor conditions",
      "Busy professionals looking for convenient healthcare access",
      "Individuals with heart disease or high cholesterol",
      " Anyone seeking trusted healthcare guidance from licensed providers",
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
        title: "Share Your Health Concerns",
        body: "Tell us about your symptoms, medical history, current medications, and healthcare questions through our secure intake process.",
      },
      {
        Icon: FiFileText,
        title: "Connect With a Healthcare Provider",
        body: "Meet with a licensed healthcare provider who will review your concerns and discuss your symptoms.",
      },
      {
        Icon: FiVideo,
        title: "Receive Personalized Medical Guidance",
        body: "Your provider will offer recommendations, discuss treatment options, and help determine the most appropriate next steps for your care.",
      },
      {
        Icon: FiPackage,
        title: "Follow Your Care Plan",
        body: "Receive guidance for ongoing care, symptom management, follow up recommendations, or referrals when needed.",
      },
    ],
    faqs: [
      {
        q: "What is a general consultation?",
        a: "A general consultation is a virtual appointment with a licensed healthcare provider to discuss symptoms, health concerns, treatment options, and medical questions.",
      },
      {
        q: "What health concerns can be discussed during a general consultation?",
        a: "Patients can discuss common illnesses, minor injuries, allergies, digestive concerns, headaches, fatigue, skin conditions, medication questions, and other non emergency health issues.",
      },
      {
        q: "Can I speak with a healthcare provider online?",
        a: "Yes. Humancare Connect offers secure telemedicine services that allow patients to connect with licensed healthcare providers remotely.",
      },
      {
        q: "Are virtual general consultations effective?",
        a: "Yes. Many common health concerns can be evaluated and managed through telehealth services when clinically appropriate.",
      },
      {
        q: "Do I need an appointment for a general consultation?",
        a: "Yes. Patients can schedule an online appointment at a convenient time.",
      },
      {
        q: "Can a provider diagnose my condition during a virtual visit?",
        a: "Healthcare providers can assess symptoms, discuss concerns, and provide recommendations based on the information available during the consultation.",
      },
      {
        q: "What happens during a general consultation?",
        a: "Your provider will review your symptoms, medical history, medications, and healthcare concerns before discussing appropriate recommendations.",
      },
      {
        q: "Can I ask questions about my medications?",
        a: "Yes. General consultations are a convenient opportunity to discuss medications, side effects, and treatment plans.",
      },
      {
        q: "Is a general consultation confidential?",
        a: "Yes. Humancare Connect uses secure telemedicine technology designed to protect patient privacy and confidentiality.",
      },
      {
        q: "Can I receive treatment recommendations during a consultation?",
        a: "Yes. Healthcare providers can discuss treatment options, symptom management strategies, and next steps for care.",
      },
      {
        q: "Are general consultations suitable for preventive care?",
        a: "Yes. Patients can discuss wellness goals, preventive healthcare measures, and healthy lifestyle recommendations.",
      },
      {
        q: "Can I get a referral during a general consultation?",
        a: "When appropriate, healthcare providers may recommend referrals for additional evaluation or specialty care.",
      },
      {
        q: "What are the benefits of telemedicine consultations?",
        a: "Telemedicine services provide convenient access to healthcare providers, flexible scheduling, and care from the comfort of home.",
      },
      {
        q: "Can I discuss multiple health concerns in one appointment?",
        a: "Yes. Patients may discuss multiple non emergency healthcare concerns during a consultation.",
      },
      {
        q: "Who can benefit from a general consultation?",
        a: "Anyone seeking medical advice, symptom evaluation, treatment guidance, or healthcare support may benefit from a general consultation.",
      },
      {
        q: "Can virtual consultations help save time?",
        a: "Yes. Telehealth services eliminate travel time and provide convenient access to healthcare providers.",
      },
      {
        q: "What should I prepare before my appointment?",
        a: "Patients should be prepared to discuss symptoms, medications, medical history, and any questions they would like addressed.",
      },
      {
        q: "When should I seek emergency medical care instead?",
        a: "Emergency symptoms such as chest pain, severe breathing difficulties, stroke symptoms, or serious injuries require immediate emergency medical attention.",
      },
    ],
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.07, ease: [0.25, 0.46, 0.45, 0.94] },
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
   ROOT
────────────────────────────────────────────────────────────────────────── */
export default function GeneralConsultation() {
  const [slug, setSlug] = useState("telehealth-services");
  const s = SERVICES[slug] || SERVICES["telehealth-services"];
  const handleSwitch = useCallback((newSlug) => setSlug(newSlug), []);
  const bp = useBreakpoint();
  const { price, priceLoading } = useServicePrice(s.slug);

  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <>
      <SEO />

      <main className="service-page service-page--general" style={{ "--service-accent": s.accentColor }}>
        <AnimatePresence mode="wait">
          <motion.div key={slug} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>

            {/* HERO */}
            <section ref={heroRef} className="service-hero service-hero--with-image">
              <img src={HERO_IMAGE.src} alt={HERO_IMAGE.alt} width={HERO_IMAGE.width} height={HERO_IMAGE.height} loading="eager" className="service-hero__bg-img" />
              <div className="service-hero__overlay" />
              <motion.div style={{ opacity: heroOpacity }} className="service-hero__content-grid">
                <div>
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }}>
                    <div className="service-pill"><span className="service-pill__dot" />SERVICES</div>
                  </motion.div>
                  <motion.h1 initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.18 }} className="service-hero__title">
                    {s.name.split(" ").map((w, i, arr) => (
                      <span key={i}>{i === Math.floor(arr.length / 2) ? <span className="service-accent">{w} </span> : <span>{w} </span>}</span>
                    ))}
                  </motion.h1>
                  <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.26 }} className="service-hero__tagline">{s.tagline}</motion.p>
                  <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.32 }} className="service-hero__intro">{s.intro}</motion.p>
                </div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="service-hero__booking">
                  <ServiceBookingCard price={price} priceLoading={priceLoading} name={s.serviceName} slug={s.slug} />
                </motion.div>
              </motion.div>
            </section>

            {/* OVERVIEW */}
            <section className="service-section service-section--white">
              <div className="service-container">
                <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} className="service-overview__grid">
                  <div>
                    <motion.div variants={fadeUp}>
                      <div className="service-label"><div className="service-label__line" /><span className="service-label__text">Service Overview</span></div>
                      <h2 className="service-heading-lg">What Are General Consultations?</h2>
                    </motion.div>
                    <motion.p variants={fadeUp} className="service-overview__description">{s.description}</motion.p>
                    <motion.div variants={fadeUp} className="service-why-matters">
                      <div className="service-why-matters__label">WHY IT MATTERS</div>
                      <p className="service-why-matters__text">{s.whyItMatters}</p>
                    </motion.div>
                    <motion.div variants={fadeUp}>
                      <div className="service-benefits-list__title">Who Can Benefit</div>
                      <div className="service-benefits-list">
                        {s.whoBenefits.map((item, i) => (
                          <div key={i} className="service-benefit-item"><FiCheckCircle className="service-benefit-item__icon" />{item}</div>
                        ))}
                      </div>
                    </motion.div>
                  </div>
                  <motion.div variants={fadeUp} className="service-overview__sticky"><ServiceContact s={s} /></motion.div>
                </motion.div>

                {/* Outcomes */}
                <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="service-outcomes-strip">
                  {s.keyOutcomes.map((o, i) => (
                    <motion.div key={i} variants={fadeUp} custom={i} className="service-outcome-card">
                      <div className="service-outcome-card__dot" />
                      <p className="service-outcome-card__text">{o}</p>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            </section>

            {/* HOW IT WORKS */}
            <section className="service-section service-section--surface">
              <div className="service-container">
                <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} className="service-how-it-works__grid">
                  <div>
                    <motion.div variants={fadeUp}>
                      <div className="service-label"><div className="service-label__line" /><span className="service-label__text">Our Services</span></div>
                      <h2 className="service-heading-lg">Getting started is <span className="service-accent">simple.</span></h2>
                      <p className="service-section-header__subtitle" style={{ marginBottom: 36, textAlign: "left" }}>
                        Accessing a general consultation through Humancare Connect is quick, secure, and designed around your healthcare needs.
                      </p>
                    </motion.div>
                    <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="service-step-list">
                      {s.steps.map((step, i) => (
                        <motion.div key={i} variants={fadeUp} custom={i} className="service-step-item">
                          {i < s.steps.length - 1 && <div className="service-step-item__line" />}
                          <div className="service-step-item__icon-wrap">{React.createElement(step.Icon, { style: { fontSize: 18, color: "#fff" } })}</div>
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
                        Get convenient access to professional healthcare guidance through trusted telemedicine services. Receive personalized support without leaving home.
                      </p>
                      <button type="button" className="service-btn service-btn--primary service-btn--full"><a href="/login">Get Started Today</a></button>
                      <div className="service-trust-grid">
                        {[[FiLock, "Secure & Private"], [FiZap, "Fast Response"], [FiUserCheck, "Verified Providers"], [FiFileText, "No Insurance Required"]].map(([Icon, lb], i) => (
                          <div key={i} className="service-trust-item"><Icon className="service-trust-item__icon" />{lb}</div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              </div>
            </section>

            {/* FEATURES */}
            <section className="service-section">
              <div className="service-container">
                <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}>
                  <motion.div variants={fadeUp} className="service-section-header">
                    <div className="service-label service-label--center"><div className="service-label__line" /><span className="service-label__text">Features &amp; Benefits</span></div>
                    <h2 className="service-heading-lg">Comprehensive Care for <br /><span className="service-accent">Everyday Health Concerns</span></h2>
                    <p className="service-section-header__subtitle">Every feature is designed around one goal: better outcomes for you.</p>
                  </motion.div>
                  <motion.div variants={fadeUp} className="service-feature-card">
                    <p>General consultations are one of the most common ways patients access healthcare services. Whether you are experiencing new symptoms, managing an ongoing condition, seeking preventive health advice, or looking for professional medical guidance, a general consultation provides an opportunity to discuss your concerns with a licensed healthcare provider.</p>
                    <p>At Humancare Connect, our virtual healthcare services make it easier for patients to access quality care from virtually anywhere. Healthcare providers can evaluate symptoms, review health history, discuss treatment options, and recommend appropriate next steps based on individual needs. This convenient approach helps patients receive timely support while avoiding unnecessary delays in care.</p>
                    <p>General consultations may address a wide range of concerns, including cold and flu symptoms, allergies, minor infections, digestive issues, headaches, fatigue, skin concerns, medication questions, and overall wellness discussions. Through secure telehealth services, patients can access professional healthcare support when they need it most.</p>
                  </motion.div>
                </motion.div>
              </div>
            </section>

            {/* WHY US */}
            <section className="service-section">
              <div className="service-container">
                <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}>
                  <motion.div variants={fadeUp} className="service-section-header">
                    <div className="service-label service-label--center"><div className="service-label__line" /><span className="service-label__text">Why Choose Us</span></div>
                    <h2 className="service-heading-lg">Results you can <span className="service-accent">measure.</span></h2>
                    <p className="service-section-header__subtitle">Numbers that represent real patients, real outcomes.</p>
                  </motion.div>
                  <div className="service-why-us__grid">
                    {whyUsItems.map(([Icon, title, desc], i) => (
                      <motion.div key={i} variants={fadeUp} custom={i} className="service-why-us__card">
                        <div className="service-why-us__card-icon-wrap"><Icon className="service-why-us__card-icon" /></div>
                        <div><div className="service-why-us__card-title">{title}</div><div className="service-why-us__card-desc">{desc}</div></div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </section>

            {/* FAQ */}
            <section className="service-faq">
              <CentralFAQ
                badge="FAQ"
                title={`Questions about ${s.name}?`}
                description="We've answered the most common questions below. Our care team is one message away if yours isn't listed."
                sections={[{ title: "Frequently Asked", items: s.faqs.map((faq) => ({ question: faq.q, answer: faq.a })) }]}
              />
            </section>

            {/* FINAL CTA */}
            <section className="service-section">
              <div className="service-container">
                <motion.div initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.6 }} className="service-cta-card">
                  <div>
                    <div className="service-pill"><span className="service-pill__dot" />Start Today</div>
                    <h2 className="service-cta-title">Ready to Speak With a<br /><span className="service-accent">Healthcare Provider?</span></h2>
                    <p className="service-cta-desc">Connect with a licensed healthcare provider through secure telemedicine services and receive personalized medical guidance for your health concerns. Get the care and answers you need from the comfort of home.</p>
                    <div className="service-cta-btn-group">
                      <button type="button" className="service-btn service-btn--primary"><a href="/login">Get Started</a></button>
                    </div>
                    <div className="service-cta-trust">
                      {[[FiLock, "HIPAA Compliant"], [FiStar, "4.9/5 Rated"], [FiShield, "Verified Providers"], [FiFileText, "No Insurance Required"], [FiClock, "24/7 Access"]].map(([Icon, lb], i) => (
                        <div key={i} className="service-cta-trust__item"><Icon className="service-cta-trust__icon" />{lb}</div>
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
