import { useState, useEffect, useRef } from "react";
import {
    FiActivity, FiHeart, FiShield, FiUsers, FiClock, FiGlobe,
    FiSearch, FiCalendar, FiPhone, FiMail, FiAward, FiZap,
    FiMonitor, FiDollarSign, FiCheckCircle, FiStar, FiLock,
    FiArrowRight, FiPlus, FiDroplet, FiWind, FiThermometer,
    FiAlertCircle, FiRefreshCw, FiTarget, FiTrendingUp, FiBarChart2,
    FiFeather, FiCrosshair, FiLayout, FiEye, FiTool,
    FiCpu, FiBriefcase, FiClipboard,
} from "react-icons/fi";
import {
    MdOutlineVaccines, MdOutlineBloodtype, MdOutlinePsychology,
    MdOutlineHealthAndSafety, MdOutlineSpa, MdOutlineMonitorHeart,
    MdOutlineBiotech,
} from "react-icons/md";
import {
    GiHeartOrgan, GiLungs, GiBrain, GiBoneKnife,
    GiMedicines, GiBodySwapping,
} from "react-icons/gi";
import "../SpecialtyPage.css";

// ─────────────────────────────────────────────────────────────────────────────
// ★  EDIT THIS OBJECT TO CREATE A NEW SPECIALTY PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALTY_DATA = {
    slug: "cardiology",
    name: "Cardiology",
    tagline: "Protecting Your Heart with Expert Cardiovascular Care.",
    heroDescription:
        "Cardiology specialists provide comprehensive care for the heart and blood vessels, helping patients prevent, diagnose, and manage cardiovascular conditions. From routine heart screenings and blood pressure management to treating heart disease, chest pain, and irregular heart rhythms, cardiologists are dedicated to supporting lifelong heart health.",
    heroImage:
        "https://images.unsplash.com/photo-1628348068343-c6a848d2b6dd?auto=format&fit=crop&w=1600&q=80",
    overviewImage:
        "https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80",
    overviewDescription:
        "Cardiology is a medical specialty focused on the diagnosis, treatment, and prevention of conditions affecting the heart and circulatory system. Cardiologists use advanced evaluations, diagnostic testing, and personalized treatment plans to manage heart-related conditions and reduce the risk of serious cardiovascular complications.",
    overviewImportance:
        "Through preventive heart care, lifestyle guidance, medication management, and ongoing monitoring, cardiology specialists help patients maintain optimal heart function, improve their quality of life, and achieve long-term cardiovascular wellness.",
    conditionsTreated:
        "Cardiology specialists diagnose and treat a wide range of heart and vascular conditions, including high blood pressure, high cholesterol, heart disease, chest pain, palpitations, heart rhythm disorders, and other cardiovascular concerns.",
    whenToConsult:
        "Schedule a visit with a cardiology specialist if you experience chest discomfort, shortness of breath, heart palpitations, elevated blood pressure, abnormal cholesterol levels, a family history of heart disease, or need a heart health evaluation before surgery.",

    keyServices: [
        { Icon: FiActivity, title: "Comprehensive Heart Evaluations", description: "Detailed cardiovascular assessments, heart screenings, and diagnostic testing to evaluate heart function and identify potential concerns." },
        { Icon: FiTarget, title: "Blood Pressure Management", description: "Personalized care plans to monitor and control high blood pressure through medication, lifestyle changes, and regular follow-up care." },
        { Icon: MdOutlineBloodtype, title: "Cholesterol & Lipid Management", description: "Evaluation and treatment of high cholesterol and other lipid disorders to reduce the risk of heart attack and stroke." },
        { Icon: GiHeartOrgan, title: "Heart Disease Monitoring & Treatment", description: "Ongoing management of coronary artery disease, heart failure, and other chronic heart conditions to improve cardiovascular health." },
        { Icon: FiZap, title: "Heart Rhythm Evaluation", description: "Assessment and treatment of palpitations, irregular heartbeats, and other cardiac rhythm concerns." },
        { Icon: FiShield, title: "Preventive Cardiac Care", description: "Heart health education, risk assessment, lifestyle counseling, and screenings designed to prevent future cardiovascular disease." },
    ],

    benefits: [
        { Icon: FiSearch, title: "Early Detection of Heart Conditions", description: "Identifies cardiovascular risks and heart problems before they progress into serious complications." },
        { Icon: FiHeart, title: "Improved Heart Health Management", description: "Provides personalized treatment plans that help control heart disease risk factors and support better heart function." },
        { Icon: FiShield, title: "Reduced Risk of Cardiac Emergencies", description: "Proactive monitoring and preventive care help lower the chances of heart attacks, strokes, and other serious cardiovascular events." },
        { Icon: FiTrendingUp, title: "Long-Term Cardiovascular Wellness", description: "Supports lifelong heart health through ongoing care, healthy lifestyle recommendations, and regular monitoring." },
    ],

    conditions: [
        { Icon: FiAlertCircle, name: "Chest Pain (Non-Emergency)", description: "Evaluation of ongoing or recurring chest discomfort to identify possible heart-related causes and provide appropriate treatment." },
        { Icon: GiHeartOrgan, name: "Heart Disease Follow-Up", description: "Continuous monitoring and management of existing heart conditions to support better heart function and long-term health." },
        { Icon: FiActivity, name: "High Blood Pressure", description: "Diagnosis and treatment of hypertension through lifestyle modifications, medication management, and routine monitoring." },
        { Icon: MdOutlineBloodtype, name: "High Cholesterol", description: "Care for elevated cholesterol levels and lipid disorders to reduce the risk of cardiovascular disease and stroke." },
        { Icon: FiZap, name: "Palpitations", description: "Evaluation of irregular, rapid, or pounding heartbeats to determine the cause and provide appropriate cardiac care." },
        { Icon: FiClipboard, name: "Pre-Operative Cardiac Clearance", description: "Heart evaluations before surgery to assess cardiovascular risk and ensure safe surgical planning." },
        { Icon: FiTarget, name: "Coronary Artery Disease", description: "Management of narrowed or blocked heart arteries that may cause chest pain, heart attacks, or reduced blood flow." },
        { Icon: FiRefreshCw, name: "Heart Rhythm Disorders", description: "Diagnosis and treatment of arrhythmias, including abnormal heart rhythms that affect heart performance." },
        { Icon: FiHeart, name: "Heart Failure Management", description: "Comprehensive care for weakened heart function, including symptom management and long-term treatment strategies." },
        { Icon: FiWind, name: "Shortness of Breath & Exercise Intolerance", description: "Assessment of breathing difficulties, fatigue, and reduced physical capacity that may be related to heart conditions." },
        { Icon: FiBarChart2, name: "Preventive Heart Screenings", description: "Routine cardiovascular evaluations to detect risk factors such as hypertension, cholesterol abnormalities, and inherited heart conditions." },
        { Icon: FiEye, name: "Cardiovascular Risk Assessment", description: "Evaluation of personal and family health history, lifestyle factors, and medical conditions that may increase heart disease risk." },
    ],

    faqs: [
        {
            question: "What is cardiology?",
            answer: "Cardiology is the medical specialty focused on the prevention, diagnosis, and treatment of diseases affecting the heart and blood vessels.",
        },
        {
            question: "What conditions do cardiologists treat?",
            answer: "Cardiologists treat high blood pressure, high cholesterol, heart disease, arrhythmias, chest pain, heart failure, and other cardiovascular conditions.",
        },
        {
            question: "When should I see a cardiologist?",
            answer: "You should see a cardiologist if you have chest pain, shortness of breath, heart palpitations, abnormal blood pressure, high cholesterol, or a family history of heart disease.",
        },
        {
            question: "What happens during a cardiology appointment?",
            answer: "A cardiology visit may include reviewing your medical history, assessing symptoms, performing a physical examination, and recommending heart tests or treatments.",
        },
        {
            question: "Do cardiologists treat high blood pressure?",
            answer: "Yes. Cardiologists diagnose and manage hypertension using medications, lifestyle recommendations, and ongoing monitoring.",
        },
        {
            question: "Is high cholesterol dangerous?",
            answer: "Yes. High cholesterol can increase the risk of heart attack, stroke, and other cardiovascular complications if left untreated.",
        },
        {
            question: "What causes chest pain related to the heart?",
            answer: "Heart-related chest pain may result from reduced blood flow to the heart muscle, coronary artery disease, or other cardiovascular problems.",
        },
        {
            question: "Are heart palpitations always serious?",
            answer: "Not always. Some palpitations are harmless, but persistent, frequent, or concerning episodes should be evaluated by a cardiologist.",
        },
        {
            question: "What tests do cardiologists use to diagnose heart conditions?",
            answer: "Common tests include electrocardiograms (ECG), echocardiograms, stress tests, blood tests, and heart monitoring devices.",
        },
        {
            question: "Can heart disease be prevented?",
            answer: "Many heart diseases can be prevented or delayed through healthy lifestyle choices, regular screenings, and proper management of risk factors.",
        },
        {
            question: "What is the difference between a heart attack and heart disease?",
            answer: "Heart disease refers to various conditions affecting the heart, while a heart attack is a medical emergency caused by blocked blood flow to the heart muscle.",
        },
        {
            question: "Do I need a referral to see a cardiologist?",
            answer: "Referral requirements depend on your insurance plan and healthcare provider policies.",
        },
        {
            question: "Are virtual cardiology appointments available?",
            answer: "Yes. Telehealth visits may be available for consultations, medication reviews, follow-up care, and certain heart health concerns.",
        },
        {
            question: "How often should I have my heart checked?",
            answer: "The frequency of heart evaluations depends on your age, medical history, risk factors, and your healthcare provider's recommendations.",
        },
        {
            question: "What lifestyle changes improve heart health?",
            answer: "Regular exercise, a heart-healthy diet, maintaining a healthy weight, managing stress, avoiding tobacco, and controlling blood pressure and cholesterol support cardiovascular wellness.",
        },
        {
            question: "What are the warning signs of a heart problem?",
            answer: "Symptoms may include chest pain, shortness of breath, dizziness, unusual fatigue, swelling in the legs, or irregular heartbeats.",
        },
        {
            question: "How can I schedule an appointment with a cardiology specialist?",
            answer: "You can schedule a cardiology appointment online, through telehealth services, or by contacting the healthcare team for personalized assistance.",
        },
    ],
};

const TRUST_STATS = [
    { Icon: FiUsers, value: "5,000+", label: "Board-Certified Providers" },
    { Icon: FiBriefcase, value: "50+", label: "Specialties Covered" },
    { Icon: FiCalendar, value: "24 hrs", label: "Average Appointment Time" },
    { Icon: FiMonitor, value: "24/7", label: "Telehealth Support" },
];

const TRUST_CARDS = [
  { Icon: FiAward, title: " Board-Certified Specialists", description: "Receive care from experienced, credentialed providers who meet high standards of medical expertise and patient care." },
  { Icon: FiZap, title: "Fast Appointments", description: "Schedule appointments quickly with convenient availability, including timely care for urgent health concerns." },
  { Icon: FiMonitor, title: "Telehealth Access", description: "Connect with healthcare providers from the comfort of your home through secure, convenient virtual visits." },
  { Icon: FiShield, title: "Insurance Support", description: "Get assistance understanding insurance coverage, benefits, authorizations, and billing questions." },
  { Icon: FiHeart, title: "Personalised Care", description: "Receive customized treatment recommendations designed around your medical history, lifestyle, health needs, and goals." },
  { Icon: FiGlobe, title: "Global Provider Network", description: "Access a broad network of healthcare specialists and coordinated care services wherever you need support." },
];

// ── Scroll reveal hook ────────────────────────────────────────────────────────
function useScrollReveal(threshold = 0.1) {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    observer.disconnect();
                }
            },
            { threshold }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [threshold]);
    return { ref, visible };
}

function Reveal({ children, delay = 0, className = "" }) {
    const { ref, visible } = useScrollReveal();
    return (
        <div
            ref={ref}
            className={`sp-reveal${visible ? " sp-reveal--visible" : ""} ${className}`}
            style={delay ? { transitionDelay: `${delay}ms` } : undefined}
        >
            {children}
        </div>
    );
}

// ── Counter animation hook ────────────────────────────────────────────────────
function AnimatedStat({ value, label, Icon }) {
    const { ref, visible } = useScrollReveal(0.2);
    const [displayed, setDisplayed] = useState("0");

    useEffect(() => {
        if (!visible) return;
        const numeric = parseFloat(value.replace(/[^0-9.]/g, ""));
        const suffix = value.replace(/[0-9.]/g, "");
        if (isNaN(numeric)) { setDisplayed(value); return; }
        let start = 0;
        const duration = 1200;
        const step = 16;
        const increment = numeric / (duration / step);
        const timer = setInterval(() => {
            start += increment;
            if (start >= numeric) {
                setDisplayed(value);
                clearInterval(timer);
            } else {
                const rounded = numeric < 10 ? start.toFixed(1) : Math.floor(start).toString();
                setDisplayed(rounded + suffix);
            }
        }, step);
        return () => clearInterval(timer);
    }, [visible, value]);

    return (
        <div ref={ref} className={`sp-stat-card${visible ? " sp-stat-card--visible" : ""}`}>
            <div className="sp-stat-card__icon-wrap">
                <Icon size={22} />
            </div>
            <p className="sp-stat-card__value">{displayed}</p>
            <p className="sp-stat-card__label">{label}</p>
        </div>
    );
}

// ── FAQ Item ──────────────────────────────────────────────────────────────────
function FAQItem({ question, answer }) {
    const [open, setOpen] = useState(false);
    return (
        <div className={`sp-faq-item${open ? " sp-faq-item--open" : ""}`}>
            <button
                className="sp-faq-item__btn"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
            >
                <span className="sp-faq-item__question">{question}</span>
                <span className={`sp-faq-item__icon${open ? " sp-faq-item__icon--open" : ""}`}>
                    <FiPlus size={15} />
                </span>
            </button>
            <div className={`sp-faq-item__body${open ? " sp-faq-item__body--open" : ""}`}>
                <div className="sp-faq-item__answer">
                    <p>{answer}</p>
                </div>
            </div>
        </div>
    );
}

// ── Condition Card ────────────────────────────────────────────────────────────
function ConditionCard({ Icon, name, description, delay }) {
    return (
        <Reveal delay={delay}>
            <div className="sp-condition-card">
                <div className="sp-condition-card__icon">
                    <Icon size={22} />
                </div>
                <h3 className="sp-condition-card__title">{name}</h3>
                <p className="sp-condition-card__desc">{description}</p>
                <button className="sp-condition-card__link" aria-label={`Learn more about ${name}`}>
                    Learn more <FiArrowRight size={13} />
                </button>
            </div>
        </Reveal>
    );
}

// ── Key Service Card ──────────────────────────────────────────────────────────
function ServiceCard({ Icon, title, description, delay }) {
    return (
        <Reveal delay={delay}>
            <div className="sp-service-card">
                <div className="sp-service-card__icon">
                    <Icon size={22} />
                </div>
                <div>
                    <h4 className="sp-service-card__title">{title}</h4>
                    <p className="sp-service-card__desc">{description}</p>
                </div>
            </div>
        </Reveal>
    );
}

// ── Benefit Card ──────────────────────────────────────────────────────────────
function BenefitCard({ Icon, title, description, delay }) {
    return (
        <Reveal delay={delay}>
            <div className="sp-benefit-card">
                <div className="sp-benefit-card__icon">
                    <Icon size={24} />
                </div>
                <h4 className="sp-benefit-card__title">{title}</h4>
                <p className="sp-benefit-card__desc">{description}</p>
            </div>
        </Reveal>
    );
}

// ── Trust Card ────────────────────────────────────────────────────────────────
function TrustCard({ Icon, title, description, delay }) {
    return (
        <Reveal delay={delay}>
            <div className="sp-trust-card">
                <div className="sp-trust-card__icon">
                    <Icon size={24} />
                </div>
                <h3 className="sp-trust-card__title">{title}</h3>
                <p className="sp-trust-card__desc">{description}</p>
            </div>
        </Reveal>
    );
}

// ── Section Label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
    return <span className="sp-section-label">{children}</span>;
}

// ── Main Page Component ───────────────────────────────────────────────────────
export default function SpecialtyPage({ data = SPECIALTY_DATA }) {
    const [heroLoaded, setHeroLoaded] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setHeroLoaded(true), 80);
        return () => clearTimeout(t);
    }, []);

    return (
        <main className="sp-page">

            {/* ── 1. HERO ────────────────────────────────────────────────────────── */}
            <section className="sp-hero">
                <div className="sp-hero__bg">
                    <img
                        src={data.heroImage}
                        alt={`${data.name} — HumanCare Connect`}
                        className="sp-hero__img"
                        loading="eager"
                    />
                    <div className="sp-hero__overlay" />
                </div>

                <div className="sp-hero__content">
                    <div className={`sp-hero__content-inner${heroLoaded ? " sp-hero__content-inner--loaded" : ""}`}>
                        <span className="sp-hero__badge">HumanCare Connect</span>
                        <h1 className="sp-hero__title">{data.name}</h1>
                        <p className="sp-hero__tagline">{data.tagline}</p>
                        <p className="sp-hero__description">{data.heroDescription}</p>

                        <div className="sp-hero__actions">
                            <a href={`/specialties/${data.slug}/doctors`} className="sp-btn sp-btn--primary">
                                <FiSearch size={17} />
                                Find Specialists
                            </a>
                            <a href={`/specialties/${data.slug}/book`} className="sp-btn sp-btn--ghost">
                                <FiCalendar size={17} />
                                Book Appointment
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── 2. OVERVIEW ────────────────────────────────────────────────────── */}
            <section className="sp-overview">
                <div className="sp-container">

                    <div className="sp-overview__grid">
                        {/* Image column */}
                        <Reveal>
                            <div className="sp-overview__img-wrap">
                                <img
                                    src={data.overviewImage}
                                    alt={`${data.name} specialists`}
                                    className="sp-overview__img"
                                    loading="lazy"
                                />
                                <div className="sp-overview__badge">
                                    <div className="sp-overview__badge-icon">
                                        <FiCheckCircle size={20} />
                                    </div>
                                    <div>
                                        <p className="sp-overview__badge-title">Board-Certified</p>
                                        <p className="sp-overview__badge-sub">{data.name} Specialists</p>
                                    </div>
                                </div>
                            </div>
                        </Reveal>

                        {/* Text column */}
                        <div className="sp-overview__text">
                            <Reveal>
                                <SectionLabel>About the Specialty</SectionLabel>
                                <h2 className="sp-overview__heading">What Is {data.name}?</h2>
                                <p className="sp-overview__para">{data.overviewDescription}</p>
                                <p className="sp-overview__para">{data.overviewImportance}</p>
                            </Reveal>

                            <Reveal delay={80}>
                                <div className="sp-info-box sp-info-box--blue">
                                    <h3 className="sp-info-box__heading">
                                        <FiActivity size={15} color="#083EBD" />
                                        Conditions Treated
                                    </h3>
                                    <p className="sp-info-box__text">{data.conditionsTreated}</p>
                                </div>
                            </Reveal>

                            <Reveal delay={140}>
                                <div className="sp-info-box sp-info-box--gray">
                                    <h3 className="sp-info-box__heading">
                                        <FiAlertCircle size={15} color="#64748b" />
                                        When to Consult
                                    </h3>
                                    <p className="sp-info-box__text">{data.whenToConsult}</p>
                                </div>
                            </Reveal>
                        </div>
                    </div>

                    {/* Key Services */}
                    <Reveal>
                        <div className="sp-section-head">
                            <SectionLabel>What We Offer</SectionLabel>
                            <h3>Key Services</h3>
                        </div>
                    </Reveal>
                    <div className="sp-services-grid">
                        {data.keyServices.map((s, i) => (
                            <ServiceCard key={i} {...s} delay={i * 55} />
                        ))}
                    </div>

                    {/* Benefits */}
                    <Reveal>
                        <div className="sp-section-head">
                            <SectionLabel>Why It Matters</SectionLabel>
                            <h3>Benefits of {data.name}</h3>
                        </div>
                    </Reveal>
                    <div className="sp-benefits-grid">
                        {data.benefits.map((b, i) => (
                            <BenefitCard key={i} {...b} delay={i * 65} />
                        ))}
                    </div>
                </div>
            </section>

            {/* ── 3. CONDITIONS ──────────────────────────────────────────────────── */}
            <section className="sp-conditions">
                <div className="sp-container">
                      <Reveal>
            <div className="sp-conditions__head">
              <SectionLabel>Conditions &amp; Symptoms</SectionLabel>
              <h2>What We Treat</h2>
              <p>
                Our {data.name.toLowerCase()} specialists are experienced in diagnosing and treating a wide
                range of conditions across all age groups.
              </p>
            </div>
          </Reveal>

                    <div className="sp-conditions__grid">
                        {data.conditions.map((c, i) => (
                            <ConditionCard key={i} {...c} delay={Math.min(i, 7) * 45} />
                        ))}
                    </div>
                </div>
            </section>

            {/* ── 4. WHY HUMANCARE ───────────────────────────────────────────────── */}
            <section className="sp-trust">
                <div className="sp-container">

                    <div className="sp-stats-grid">
                        {TRUST_STATS.map((s, i) => (
                            <AnimatedStat key={i} {...s} />
                        ))}
                    </div>

                    <Reveal>
            <div className="sp-trust__head">
              <SectionLabel>Why HumanCare Connect</SectionLabel>
              <h2>Care You Can Trust</h2>
              <p>
            We combine experienced medical professionals with advanced technology to make accessing quality healthcare simpler, faster, and more personalized.
              </p>
            </div>
          </Reveal>

                    <div className="sp-trust-grid">
                        {TRUST_CARDS.map((c, i) => (
                            <TrustCard key={i} {...c} delay={i * 55} />
                        ))}
                    </div>
                </div>
            </section>

            {/* ── 5. FAQ ─────────────────────────────────────────────────────────── */}
            <section className="sp-faq">
                <div className="sp-container--narrow">
                    <Reveal>
                        <div className="sp-faq__head">
                            <SectionLabel>FAQ</SectionLabel>
                            <h2>Frequently Asked Questions</h2>
                            <p>Everything you need to know about {data.name.toLowerCase()} at HumanCare Connect.</p>
                        </div>
                    </Reveal>

                    <div className="sp-faq__list">
                        {data.faqs.map((faq, i) => (
                            <Reveal key={i} delay={i * 45}>
                                <FAQItem question={faq.question} answer={faq.answer} />
                            </Reveal>
                        ))}
                    </div>

                    <Reveal delay={80}>
                        <p className="sp-faq__footer">
                            Still have questions?{" "}
                            <a href="/contact">Chat with our care team →</a>
                        </p>
                    </Reveal>
                </div>
            </section>

            {/* ── 6. CTA ─────────────────────────────────────────────────────────── */}
            <section className="sp-cta">
                <div className="sp-cta__glow-top" aria-hidden="true" />
                <div className="sp-cta__glow-bottom" aria-hidden="true" />

                <div className="sp-cta__inner">
                    <Reveal>
                        <span className="sp-cta__eyebrow">Get Started Today</span>
                        <h2 className="sp-cta__heading">
                            Ready to Connect with a{" "}
                            <span>{data.name}</span>{" "}
                            Specialist?
                        </h2>
                        <p className="sp-cta__sub">
                            Take the next step toward better heart health with expert cardiology care, convenient
                            appointments, and personalized treatment plans to prevent, diagnose, and manage cardiovascular conditions.
                        </p>
                    </Reveal>

                    <Reveal delay={80}>
                        <div className="sp-cta__actions">
                            <a href={`/specialties/${data.slug}/doctors`} className="sp-btn sp-btn--primary-lg">
                                <FiSearch size={18} />
                                Find a Doctor
                            </a>
                            <a href={`/specialties/${data.slug}/book`} className="sp-btn sp-btn--ghost-lg">
                                <FiCalendar size={18} />
                                Book Appointment
                            </a>
                        </div>
                    </Reveal>

                    <Reveal delay={130}>
                        <div className="sp-cta__badges">
                            {[
                                { Icon: FiLock, label: "HIPAA Compliant" },
                                { Icon: FiStar, label: "4.9/5 Patient Rating" },
                                { Icon: FiCheckCircle, label: "Verified Providers" },
                                { Icon: FiShield, label: "100% Secure Platform" },
                            ].map((badge, i) => (
                                <div key={i} className="sp-cta__badge">
                                    <badge.Icon size={15} className="sp-cta__badge-icon" />
                                    <span>{badge.label}</span>
                                </div>
                            ))}
                        </div>
                    </Reveal>

                    <Reveal delay={170}>
                        <div className="sp-cta__contact">
                            <a href="tel:+918008001234" className="sp-cta__contact-link">
                                <FiPhone size={14} />
                                +91 800 800 1234
                            </a>
                            <a href="mailto:care@humancareconnect.co" className="sp-cta__contact-link">
                                <FiMail size={14} />
                                care@humancareconnect.co
                            </a>
                            <span className="sp-cta__contact-item">
                                <FiClock size={14} />
                                Mon – Sun, 8 AM – 10 PM IST
                            </span>
                        </div>
                    </Reveal>
                </div>
            </section>
        </main>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADDITIONAL SPECIALTY DATA EXAMPLES
// ─────────────────────────────────────────────────────────────────────────────

export const CARDIOLOGY_DATA = {
    slug: "cardiology",
    name: "Cardiology",
    tagline: "Expert heart care, from prevention to advanced intervention.",
    heroDescription:
        "Our board-certified cardiologists provide comprehensive cardiac care — from lipid management and ECG interpretation to interventional procedures and heart failure management. Your heart health is our priority.",
    heroImage: "https://images.unsplash.com/photo-1628348068343-c6a848d2b6dd?auto=format&fit=crop&w=1600&q=80",
    overviewImage: "https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80",
    overviewDescription:
        "Cardiology is the branch of medicine concerned with the diagnosis and treatment of diseases of the heart and blood vessels. Cardiologists specialise in managing conditions ranging from coronary artery disease and heart failure to arrhythmias and congenital heart defects.",
    overviewImportance:
        "Cardiovascular disease remains the leading cause of mortality globally. Early detection, lifestyle modification, and timely intervention can significantly reduce the risk of heart attacks, strokes, and other cardiac events.",
    conditionsTreated:
        "Cardiologists treat coronary artery disease, heart failure, arrhythmias, valvular heart disease, hypertension, high cholesterol, pericarditis, and congenital heart defects.",
    whenToConsult:
        "Seek a cardiologist if you experience chest pain, shortness of breath, palpitations, fainting, leg swelling, or if you have risk factors like diabetes, hypertension, or a family history of heart disease.",
    keyServices: [
        { Icon: FiActivity, title: "ECG & Holter Monitoring", description: "Detect arrhythmias and electrical abnormalities with advanced cardiac monitoring." },
        { Icon: MdOutlineMonitorHeart, title: "Echocardiography", description: "Ultrasound imaging of heart structure and function." },
        { Icon: FiTrendingUp, title: "Stress Testing", description: "Exercise treadmill and pharmacological stress tests to assess cardiac fitness." },
        { Icon: GiMedicines, title: "Lipid Management", description: "Cholesterol control through diet, lifestyle, and medication." },
        { Icon: FiRefreshCw, title: "Cardiac Rehabilitation", description: "Structured programmes to strengthen the heart after a cardiac event." },
        { Icon: FiZap, title: "Pacemaker Management", description: "Implantation, programming, and monitoring of pacemakers and ICDs." },
    ],
    benefits: [
        { Icon: FiSearch, title: "Early Risk Detection", description: "Identify silent cardiac risks before a major event." },
        { Icon: GiMedicines, title: "Medication Management", description: "Precision prescribing to optimise your cardiac medications." },
        { Icon: FiBriefcase, title: "Procedural Expertise", description: "Advanced interventions by experienced interventional cardiologists." },
        { Icon: FiBarChart2, title: "Ongoing Monitoring", description: "Long-term cardiac surveillance with remote monitoring options." },
    ],
    conditions: [
        { Icon: GiHeartOrgan, name: "Coronary Artery Disease", description: "Diagnosis and management of plaque-narrowed coronary arteries to prevent heart attacks." },
        { Icon: FiHeart, name: "Heart Failure", description: "Comprehensive management of reduced and preserved ejection fraction heart failure." },
        { Icon: FiZap, name: "Arrhythmias", description: "AF, SVT, VT, and bradyarrhythmias diagnosed and treated with medication or ablation." },
        { Icon: MdOutlineBloodtype, name: "Hypertension", description: "Resistant and secondary hypertension evaluation and treatment." },
        { Icon: FiTrendingUp, name: "High Cholesterol", description: "Dyslipidaemia management including statin therapy and lifestyle modification." },
        { Icon: FiTarget, name: "Valvular Disease", description: "Aortic stenosis, mitral regurgitation, and other valve conditions monitored and managed." },
        { Icon: GiLungs, name: "Pulmonary Hypertension", description: "Specialist evaluation and targeted therapy for elevated pulmonary arterial pressure." },
        { Icon: FiShield, name: "Pericarditis", description: "Inflammation of the pericardium: acute, recurrent, and constrictive forms treated." },
    ],
    faqs: [
        { question: "When should I see a cardiologist?", answer: "See a cardiologist if you have chest pain, palpitations, shortness of breath, dizziness, or known cardiac risk factors such as hypertension, diabetes, or a family history of early heart disease." },
        { question: "What does a cardiologist do on a first visit?", answer: "Your first cardiology visit typically includes a detailed history, physical examination, ECG, and sometimes an echocardiogram or blood tests. The cardiologist will discuss your risk factors and create an initial management plan." },
        { question: "Is cardiology only for older adults?", answer: "No. Heart conditions can affect people of all ages, including children (congenital defects) and young adults (arrhythmias, cardiomyopathy). If you have symptoms, age is not a barrier to seeing a cardiologist." },
        { question: "Can I see a cardiologist via telehealth?", answer: "Yes. Follow-up consultations, medication reviews, and risk factor management can be handled via telehealth. Initial diagnostic visits may require in-person tests, which your cardiologist will organise." },
        { question: "What lifestyle changes reduce heart disease risk?", answer: "A heart-healthy diet low in saturated fats and sodium, regular aerobic exercise (150 minutes/week), not smoking, moderate alcohol intake, maintaining a healthy weight, and managing stress are all evidence-based strategies." },
    ],
};

export const DERMATOLOGY_DATA = {
    slug: "dermatology",
    name: "Dermatology",
    tagline: "Healthy, radiant skin backed by expert medical care.",
    heroDescription:
        "Our board-certified dermatologists address everything from acne and eczema to skin cancer detection and cosmetic concerns. Evidence-based treatments tailored to your skin type, tone, and health goals.",
    heroImage: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=1600&q=80",
    overviewImage: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=800&q=80",
    overviewDescription:
        "Dermatology is the medical specialty focused on the diagnosis and treatment of conditions affecting the skin, hair, and nails. The skin is the body's largest organ and a window into overall health — changes can signal systemic diseases, infections, or malignancies.",
    overviewImportance:
        "Skin conditions affect over 1.9 billion people globally. Early detection of skin cancer dramatically improves survival rates. Effective management of chronic conditions like psoriasis and eczema significantly improves quality of life.",
    conditionsTreated:
        "Dermatologists treat acne, eczema, psoriasis, rosacea, fungal infections, warts, hair loss, skin cancer, vitiligo, and cosmetic skin concerns.",
    whenToConsult:
        "Visit a dermatologist for persistent skin rashes, unusual moles, hair loss, nail changes, chronic itching, suspected skin infections, or when over-the-counter treatments are not working.",
    keyServices: [
        { Icon: FiEye, title: "Skin Cancer Screening", description: "Full-body mole mapping and dermoscopy to detect melanoma and other skin cancers early." },
        { Icon: MdOutlineSpa, title: "Acne Treatment", description: "Medical-grade treatments including topical retinoids, antibiotics, and isotretinoin." },
        { Icon: FiFeather, title: "Eczema & Psoriasis", description: "Personalised care plans including biologics, phototherapy, and topical therapies." },
        { Icon: FiTool, title: "Minor Surgical Procedures", description: "Cyst removal, biopsy, and lesion excision performed in-office." },
        { Icon: GiBodySwapping, title: "Hair & Scalp Treatment", description: "Diagnosis and management of alopecia, dandruff, and scalp conditions." },
        { Icon: FiStar, title: "Cosmetic Dermatology", description: "Chemical peels, PRP, and evidence-based cosmetic treatments." },
    ],
    benefits: [
        { Icon: FiShield, title: "Cancer Prevention", description: "Early detection saves lives. Annual screenings recommended for high-risk individuals." },
        { Icon: FiHeart, title: "Improved Confidence", description: "Effective treatment of visible skin conditions improves mental wellbeing." },
        { Icon: FiSearch, title: "Accurate Diagnosis", description: "Dermoscopy and biopsy ensure correct diagnosis and targeted treatment." },
        { Icon: FiClipboard, title: "Long-Term Management", description: "Chronic condition care plans that evolve with your skin over time." },
    ],
    conditions: [
        { Icon: FiAlertCircle, name: "Acne", description: "From mild comedonal acne to severe nodular cystic acne — treated effectively at every grade." },
        { Icon: FiDroplet, name: "Eczema (Atopic Dermatitis)", description: "Chronic dry, itchy, inflamed skin managed with moisturisers, steroids, and biologics." },
        { Icon: FiActivity, name: "Psoriasis", description: "Autoimmune plaques on skin and scalp managed with topical, systemic, and biologic therapies." },
        { Icon: FiStar, name: "Rosacea", description: "Facial redness, flushing, and papules treated with topical agents and laser therapy." },
        { Icon: FiCrosshair, name: "Fungal Infections", description: "Tinea, athlete's foot, ringworm, and onychomycosis diagnosed and treated." },
        { Icon: FiEye, name: "Skin Cancer", description: "Basal cell, squamous cell, and melanoma detected early and managed by our oncology team." },
        { Icon: FiLayout, name: "Vitiligo", description: "Loss of skin pigmentation treated with phototherapy, topical calcineurin inhibitors, and JAK inhibitors." },
        { Icon: GiBodySwapping, name: "Hair Loss (Alopecia)", description: "Androgenetic alopecia, alopecia areata, and telogen effluvium diagnosed and treated." },
    ],
    faqs: [
        { question: "How often should I have a full skin check?", answer: "Adults should have an annual full-body skin exam, especially if you have fair skin, a history of sunburns, a family history of skin cancer, or many moles. Those with prior skin cancer need more frequent checks." },
        { question: "Can dermatology visits be done via telehealth?", answer: "Many dermatology concerns can be assessed via video or photo submission, including acne, rashes, and follow-up care. Biopsies and surgical procedures require an in-person visit." },
        { question: "What is the difference between a dermatologist and an aesthetician?", answer: "A dermatologist is a medical doctor with 6+ years of specialised training who can diagnose and treat skin diseases, prescribe medications, and perform surgery. An aesthetician provides non-medical cosmetic treatments." },
        { question: "How do I know if a mole is dangerous?", answer: "Use the ABCDE rule: Asymmetry, Border irregularity, Colour variation, Diameter >6mm, and Evolving. If a mole shows any of these signs, see a dermatologist promptly." },
        { question: "What treatments are available for acne scarring?", answer: "Options include chemical peels, microneedling, fractional laser resurfacing, dermal fillers for ice-pick scars, and PRP therapy. Your dermatologist will recommend the best combination based on your scar type and skin tone." },
    ],
};