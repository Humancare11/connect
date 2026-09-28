import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  FiMonitor, FiSearch, FiLock, FiZap, FiFileText, FiCheckCircle,
  FiStar, FiHeart, FiAward, FiShield, FiClock, FiGlobe,
  FiUserCheck, FiBarChart2, FiPackage, FiVideo,
} from "react-icons/fi";
import { Helmet } from "react-helmet-async";
import SEO from "../../components/Seo";
import heroBanner from "../../assets/MedicalServices/laboratory-diagnostic-testing-services.webp";
import ServiceBookingCard from "../../components/booking/ServiceBookingCard";
import "../Specialty/SpecialtyPage.css";
import "../Categories/categoriesGlobal.css";
import "./newservices.css";
import { useServicePrice } from "../../hooks/useServicePrice";
import ServiceContact from "./ServiceContact";
import CentralFAQ from "../../components/FAQ/FAQ";

const HERO_IMAGE = {
  src: heroBanner,
  alt: "Licensed healthcare provider conducting a virtual consultation for laboratory testing and lab requisition services",
  width: 1920,
  height: 700,
};

const useBreakpoint = () => {
  const getBreakpoint = () => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1200;
    return { isMobile: w < 640, isTablet: w >= 640 && w < 1024, isDesktop: w >= 1024 };
  };
  const [bp, setBp] = useState(getBreakpoint);
  useEffect(() => {
    const handler = () => setBp(getBreakpoint());
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return bp;
};

const SERVICES = {
  "telehealth-services": {
    slug: "lab-requisitions",
    name: "LAB REQUISITIONS",
    serviceName: "Lab Requisitions",
    tagline: "Get the testing you need without unnecessary delays.",
    intro: "Request a Lab Requisition through secure telemedicine services. Connect with a licensed healthcare provider, discuss your symptoms or health concerns, and receive laboratory testing orders when clinically appropriate to support diagnosis, treatment, and ongoing health management.",
    accentColor: "#2563EB",
    accentGlow: "#2563EB20",
    heroIcon: FiMonitor,
    heroEmoji: "🖥️",
    description: "A Lab Requisition is a medical order provided by a healthcare professional that authorizes laboratory testing. These tests can help evaluate symptoms, monitor chronic conditions, assess overall health, and provide important information for diagnosis and treatment planning. Through Humancare Connect, eligible patients can connect with a licensed healthcare provider online to discuss their healthcare needs and determine whether laboratory testing may be appropriate.",
    whyItMatters: "Laboratory testing plays an important role in identifying health concerns, monitoring treatment progress, and supporting informed healthcare decisions. Convenient access to lab requisitions can help patients take a proactive approach to managing their health without unnecessary delays.",
    whoBenefits: [
      " Individuals experiencing new or unexplained symptoms",
      "Patients monitoring chronic health conditions",
      "Adults seeking preventive health screenings",
      "Individuals requiring follow-up testing for ongoing care",
      "Patients looking for convenient healthcare access",
    ],
    keyOutcomes: [
      "Same-day consultations with verified physicians",
      "E-prescriptions sent directly to your pharmacy",
      "Secure, HIPAA-compliant video sessions",
      "Integrated health records across visits",
    ],
    steps: [
      { Icon: FiSearch, title: "Share Your Health Concerns", body: "Tell us about your symptoms, medical history, current medications, and reasons for seeking laboratory testing." },
      { Icon: FiFileText, title: "Connect With a Healthcare Provider", body: "A licensed healthcare provider will review your information and discuss whether testing may be appropriate for your healthcare needs." },
      { Icon: FiVideo, title: "Complete Your Consultation", body: "Join a secure virtual appointment from your phone, tablet, or computer and receive personalized medical guidance." },
      { Icon: FiPackage, title: "Receive Your Lab Order", body: "If clinically appropriate, your provider may issue a lab requisition that can be used to complete testing at an approved laboratory." },
    ],
    faqs: [
      { q: "What is a Lab Requisition?", a: "A Lab Requisition is a medical order from a healthcare provider that authorizes laboratory testing based on a patient's healthcare needs." },
      { q: "Can I request a Lab Requisition online?", a: "Yes. Eligible patients can discuss their healthcare concerns with a licensed provider through secure telemedicine services." },
      { q: "Why might I need laboratory testing?", a: "Laboratory testing may help evaluate symptoms, monitor chronic conditions, support preventive care, and assist with diagnosis and treatment planning." },
      { q: "What types of tests can be ordered?", a: "Testing options vary based on individual healthcare needs and provider assessment." },
      { q: "Can I get blood work ordered online?", a: "A healthcare provider may order blood tests when clinically appropriate following a consultation." },
      { q: "Do I need symptoms to request lab testing?", a: "Not always. Some patients seek laboratory testing as part of preventive healthcare or routine wellness monitoring." },
      { q: "Can lab testing help monitor chronic conditions?", a: "Yes. Laboratory testing is commonly used to monitor conditions such as diabetes, thyroid disorders, and high cholesterol." },
      { q: "What information should I provide during my consultation?", a: "You may be asked about your symptoms, medical history, medications, family history, and healthcare goals." },
      { q: "How do providers determine whether testing is needed?", a: "Providers evaluate your health concerns and clinical information before recommending laboratory testing." },
      { q: "Can a provider decline a testing request?", a: "Yes. Testing recommendations are based on clinical judgment and medical necessity." },
      { q: "How long does a virtual consultation take?", a: "Most appointments are completed within a short consultation depending on the patient's healthcare needs." },
      { q: "Can I request preventive health screening tests?", a: "Yes. Preventive testing may be discussed during your consultation based on your age, health history, and risk factors." },
      { q: "Can lab testing help identify nutrient deficiencies?", a: "Certain laboratory tests may help evaluate vitamin, mineral, and nutritional status when clinically appropriate." },
      { q: "Are online consultations secure?", a: "Yes. Humancare Connect uses secure telemedicine technology designed to protect patient privacy and healthcare information." },
      { q: "Can I discuss my lab results with a provider?", a: "Yes. Providers can review test results and discuss appropriate next steps during a follow-up consultation." },
      { q: "Can laboratory testing support medication management?", a: "Yes. Some medications require periodic laboratory monitoring to help evaluate treatment effectiveness and safety." },
      { q: "Why choose Humancare Connect for Lab Requisitions?", a: "Humancare Connect offers secure telemedicine services, licensed healthcare providers, and convenient access to healthcare support from anywhere." },
      { q: "Can I access care while traveling?", a: "Availability may depend on provider licensing requirements and your location at the time of service." },
      { q: "Are lab requisitions available for ongoing healthcare management?", a: "Yes. Many patients use laboratory testing as part of long-term healthcare monitoring and treatment plans." },
      { q: "How do I get started?", a: "Simply schedule an appointment, discuss your healthcare concerns with a licensed provider, and receive laboratory testing orders when clinically appropriate." },
    ],
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.07, ease: [0.25, 0.46, 0.45, 0.94] } }),
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

export default function LABREQUISITIONS() {
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
      <SEO
        title="Lab Requisitions Online | Laboratory Testing Orders | Humancare Connect"
        description="Need a lab requisition? Connect with licensed healthcare providers online and receive laboratory testing orders when clinically appropriate through secure telemedicine services."
        keywords="Lab requisitions online, Doctor ordered lab tests, Preventive health screening, Online doctor appointment"
        url="https://humancareconnect.co/lab-requisitions"
      />
      <Helmet>
        <title>Lab Requisitions Online | Laboratory Testing Orders | Humancare Connect</title>
        <meta name="description" content="Need a lab requisition? Connect with licensed healthcare providers online and receive laboratory testing orders when clinically appropriate through secure telemedicine services." />
      </Helmet>

      <main className="service-page service-page--lab" style={{ "--service-accent": s.accentColor }}>
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
                      <h2 className="service-heading-lg">What Are Lab Requisitions?</h2>
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
                <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="service-outcomes-strip">
                  {s.keyOutcomes.map((o, i) => (
                    <motion.div key={i} variants={fadeUp} custom={i} className="service-outcome-card">
                      <div className="service-outcome-card__dot" /><p className="service-outcome-card__text">{o}</p>
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
                      <p className="service-section-header__subtitle" style={{ marginBottom: 36, textAlign: "left" }}>Requesting a Lab Requisition through Humancare Connect is quick, secure, and designed around your healthcare needs.</p>
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
                      <p className="service-how-it-works__card-text">Access trusted telemedicine services and discuss your healthcare concerns with a licensed provider. Complete your consultation online and receive laboratory testing orders when appropriate.</p>
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
                    <h2 className="service-heading-lg">Understanding Lab Requisitions</h2>
                  </motion.div>
                  <motion.div variants={fadeUp} className="service-feature-card">
                    <p>Lab requisitions are commonly used to help evaluate symptoms, monitor chronic conditions, support preventive care, and provide healthcare providers with valuable information about a patient's overall health. Depending on your medical needs, laboratory testing may help assess factors such as blood sugar levels, cholesterol, thyroid function, vitamin deficiencies, infections, hormone levels, and other important health markers.</p>
                    <p>Through Humancare Connect, patients can access telemedicine services and discuss their healthcare concerns with a licensed healthcare provider from the comfort of home. During the consultation, providers may review symptoms, medical history, medications, family history, and treatment goals to determine whether laboratory testing may be beneficial.</p>
                    <p>Lab requisitions are often requested for wellness screenings, chronic disease management, diagnostic evaluations, medication monitoring, and preventive healthcare. By combining virtual healthcare services with professional clinical oversight, Humancare Connect helps patients access convenient healthcare support while making it easier to stay informed about their health.</p>
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
              <CentralFAQ badge="FAQ" title={`Questions about ${s.name}?`} description="We've answered the most common questions below. Our care team is one message away if yours isn't listed."
                sections={[{ title: "Frequently Asked", items: s.faqs.map((faq) => ({ question: faq.q, answer: faq.a })) }]} />
            </section>

            {/* FINAL CTA */}
            <section className="service-section">
              <div className="service-container">
                <motion.div initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.6 }} className="service-cta-card">
                  <div>
                    <div className="service-pill"><span className="service-pill__dot" />Start Today</div>
                    <h2 className="service-cta-title">Need Laboratory Testing?<br /><span className="service-accent">Start Here.</span></h2>
                    <p className="service-cta-desc">Connect with a licensed healthcare provider through secure telemedicine services and discuss whether laboratory testing may support your healthcare needs. Access convenient virtual healthcare services from home.</p>
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
