import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  FiMonitor, FiSearch, FiLock, FiZap, FiFileText, FiCheckCircle,
  FiStar, FiHeart, FiAward, FiShield, FiClock, FiGlobe,
  FiUserCheck, FiBarChart2, FiPackage, FiVideo,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import SEO from "../../components/Seo";
import "../Specialty/SpecialtyPage.css";
import "../Categories/categoriesGlobal.css";
import "./newservices.css";
import ServiceContact from "./ServiceContact";
import CentralFAQ from "../../components/FAQ/FAQ";

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
    slug: "telehealth-services",
    name: "MENTAL HEALTH SUPPORT",
    serviceName: "Mental Health Support",
    tagline: "Compassionate care for your emotional well being.",
    intro: "Take care of your mental health with confidential telemedicine services designed to support emotional wellness. Connect with licensed healthcare providers who can help address anxiety, stress, depression, mood concerns, and other mental health challenges through secure virtual healthcare services from the comfort of home.",
    accentColor: "#2563EB",
    accentGlow: "#2563EB20",
    heroIcon: FiMonitor,
    heroEmoji: "🖥️",
    description: "Mental health care should be accessible, convenient, and free from unnecessary barriers. Through Humancare Connect, patients can connect with licensed healthcare providers for professional support, mental health evaluations, and personalized care recommendations through secure telehealth services. Whether you are experiencing stress, anxiety, emotional challenges, or ongoing mental health concerns, virtual care makes it easier to access the support you need.",
    whyItMatters: "Mental health plays a vital role in overall well being. Emotional and psychological challenges can affect relationships, work performance, sleep quality, physical health, and daily functioning. Early support and professional guidance can help individuals develop healthier coping strategies, improve resilience, and enhance their quality of life.",
    whoBenefits: [
      "Adults experiencing anxiety or excessive stress",
      "Individuals struggling with depression or low mood",
      "People experiencing burnout or emotional exhaustion",
      "Individuals facing major life transitions or personal challenges",
      "Adults seeking confidential and convenient mental health support",
    ],
    keyOutcomes: [
      "Same-day consultations with verified physicians",
      "E-prescriptions sent directly to your pharmacy",
      "Secure, HIPAA-compliant video sessions",
      "Integrated health records across visits",
    ],
    steps: [
      { Icon: FiSearch, title: "Share Your Concerns", body: "Tell us about your symptoms, emotional challenges, mental health history, and wellness goals through our secure intake process." },
      { Icon: FiFileText, title: "Connect With a Healthcare Provider", body: "Meet with a licensed healthcare provider who will discuss your concerns and evaluate your mental health needs." },
      { Icon: FiVideo, title: "Receive Personalized Guidance", body: "Your provider may recommend coping strategies, treatment options, lifestyle adjustments, or additional mental health resources based on your situation." },
      { Icon: FiPackage, title: "Continue Your Care Journey", body: "Schedule follow up appointments as needed to monitor progress, discuss concerns, and receive ongoing support." },
    ],
    faqs: [
      { q: "What is mental health support?", a: "Mental health support provides professional guidance and care for emotional, behavioral, and psychological concerns that may affect daily life and overall well being." },
      { q: "Can I access mental health support online?", a: "Yes. Telemedicine services allow patients to connect with licensed healthcare providers through secure virtual appointments." },
      { q: "What mental health concerns can be discussed during a telehealth visit?", a: "Patients commonly seek support for anxiety, depression, stress, burnout, mood changes, emotional difficulties, and other mental health concerns." },
      { q: "Is online mental health support confidential?", a: "Yes. Humancare Connect uses secure telemedicine technology designed to protect patient privacy and confidentiality." },
      { q: "Can telehealth help with anxiety?", a: "Yes. Healthcare providers can evaluate symptoms of anxiety, discuss treatment options, and recommend appropriate support strategies." },
      { q: "What are the benefits of virtual mental health services?", a: "Virtual mental health services provide convenient access to care, flexible scheduling, privacy, and support from the comfort of home." },
      { q: "Can I discuss depression during an online appointment?", a: "Yes. Licensed healthcare providers can assess symptoms, discuss concerns, and recommend appropriate next steps for care." },
      { q: "How do I know if I should seek mental health support?", a: "If emotional challenges are affecting your daily life, relationships, work, or overall well being, professional support may be beneficial." },
      { q: "Can stress affect my physical health?", a: "Yes. Chronic stress may contribute to fatigue, headaches, sleep difficulties, digestive concerns, and other health issues." },
      { q: "Who can benefit from mental health support?", a: "Anyone experiencing emotional, behavioral, or psychological challenges may benefit from professional guidance and support." },
      { q: "What happens during a mental health consultation?", a: "A healthcare provider will discuss your symptoms, concerns, health history, and goals to better understand your needs." },
      { q: "Can mental health support help with burnout?", a: "Yes. Healthcare providers can help identify contributing factors and recommend strategies to improve emotional wellness and reduce stress." },
      { q: "Are telehealth mental health appointments effective?", a: "Many patients find virtual appointments to be a convenient and effective way to access professional mental health support." },
      { q: "Can I schedule follow up appointments?", a: "Yes. Follow up visits may be recommended to monitor progress and provide ongoing support." },
      { q: "Is mental health care only for serious conditions?", a: "No. Many people seek support for everyday stress, emotional challenges, life transitions, and personal wellness concerns." },
      { q: "Can online mental health support improve emotional wellness?", a: "Professional guidance can help individuals develop healthier coping strategies and improve overall emotional well being." },
      { q: "Are mental health services available from home?", a: "Yes. Telehealth services allow patients to access support from home, work, or another private location." },
      { q: "Why is early mental health support important?", a: "Early intervention may help individuals address concerns before they significantly affect daily life, relationships, and overall health." },
      { q: "Why choose Humancare Connect for mental health support?", a: "Humancare Connect provides secure telemedicine services, compassionate care, convenient access to healthcare providers, and personalized support focused on emotional wellness." },
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

export default function MentalHealthSupport() {
  const bp = useBreakpoint();
  const [slug, setSlug] = useState("telehealth-services");
  const s = SERVICES[slug] || SERVICES["telehealth-services"];
  const handleSwitch = useCallback((newSlug) => setSlug(newSlug), []);

  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <>
      <SEO
        title="Mental Health Support Online | Virtual Mental Health Care | Humancare Connect"
        description="Access confidential mental health support through secure telemedicine services. Connect with licensed healthcare providers for anxiety, stress, depression, and emotional wellness care."
        keywords="Mental health support, Online therapy, Virtual counseling, Emotional wellness care"
        url="https://humancareconnect.co/mental-health-support"
      />
      <Helmet>
        <title>Mental Health Support Online | Virtual Mental Health Care | Humancare Connect</title>
        <meta name="description" content="Access confidential mental health support through secure telemedicine services. Connect with licensed healthcare providers for anxiety, stress, depression, and emotional wellness care." />
      </Helmet>

      <main className="service-page service-page--mental-health" style={{ "--service-accent": s.accentColor }}>
        <AnimatePresence mode="wait">
          <motion.div key={slug} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>

            {/* HERO (Clean Standalone) */}
            <section ref={heroRef} className="service-hero">
              <motion.div style={{ opacity: heroOpacity }} className="service-hero__content-standalone">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }}>
                  <div className="service-pill"><span className="service-pill__dot" />Humancare Connect</div>
                </motion.div>
                <motion.h1 initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.18 }} className="service-hero__title">
                  {s.name.split(" ").map((w, i, arr) => (
                    <span key={i}>{i === Math.floor(arr.length / 2) ? <span className="service-accent">{w} </span> : <span>{w} </span>}</span>
                  ))}
                </motion.h1>
                <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.26 }} className="service-hero__tagline">{s.tagline}</motion.p>
                <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.32 }} className="service-hero__intro">{s.intro}</motion.p>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.38 }} className="service-hero__btn-group">
                  <button type="button" className="service-btn service-btn--primary">
                    <a href="/login">Get Started</a>
                  </button>
                  <button type="button" className="service-btn service-btn--ghost">
                    <Link to="/appointment-booking" state={{ tab: "spec" }}>
                      Request Your Lab Consultation Today
                    </Link>
                  </button>
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
                      <h2 className="service-heading-lg">Accessible Mental Health Care</h2>
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
                      <p className="service-section-header__subtitle" style={{ marginBottom: 36, textAlign: "left" }}>Accessing mental health support through Humancare Connect is quick, secure, and designed with your privacy in mind.</p>
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
                      <p className="service-how-it-works__card-text">Take the first step toward better emotional wellness through trusted telemedicine services. Professional support is available when and where you need it most.</p>
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
                    <h2 className="service-heading-lg">Supporting Emotional Wellness <br /><span className="service-accent">Through Telehealth</span></h2>
                    <p className="service-section-header__subtitle">Every feature is designed around one goal: better outcomes for you.</p>
                  </motion.div>
                  <motion.div variants={fadeUp} className="service-feature-card">
                    <p>Mental health affects how people think, feel, behave, and respond to everyday challenges. Emotional wellness influences relationships, work performance, productivity, physical health, and overall quality of life. Seeking professional support is an important step toward understanding mental health concerns and developing effective strategies to manage them.</p>
                    <p>At Humancare Connect, our mental health support services provide convenient access to licensed healthcare providers through secure virtual healthcare services. Patients can discuss concerns such as anxiety, depression, chronic stress, burnout, mood changes, emotional difficulties, and sleep related concerns in a confidential and supportive environment. Telemedicine services remove many of the barriers that often prevent individuals from seeking care.</p>
                    <p>Mental health support is not limited to severe conditions. Many individuals benefit from professional guidance during periods of increased stress, major life changes, relationship challenges, workplace pressures, grief, or emotional difficulties. Through telehealth services, patients can receive personalized recommendations, access ongoing support, and take meaningful steps toward improving their emotional well being and overall health.</p>
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
                    <h2 className="service-cta-title">Ready to Prioritize Your<br /><span className="service-accent">Mental Wellness?</span></h2>
                    <p className="service-cta-desc">Connect with a licensed healthcare provider through secure telemedicine services and access confidential mental health support from the comfort of home. Professional guidance is available when you need it most.</p>
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
