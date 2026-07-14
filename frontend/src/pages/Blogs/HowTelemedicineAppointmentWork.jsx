import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import "./telemedicine.css";

const PAGE_TITLE =
  " What Medical Conditions Can Be Treated Through Telemedicine?";
const PAGE_DESCRIPTION =
  " Discover the medical conditions that can be treated through telemedicine, including common illnesses, chronic diseases, mental health concerns, specialist consultations, and second opinions.";
const PAGE_URL =
  "https://humancareconnect.co/blog/how-does-a-telemedicine-appointment-work";
const PAGE_IMAGE =
  "https://images.unsplash.com/photo-1580281657702-257584239a55?q=80&w=1400&auto=format&fit=crop";

const TOC_ITEMS = [
  {
    id: "definition",
    label: "What Medical Conditions Can Be Treated Through Telemedicine? ",
  },
  { id: "introduction", label: "Introduction" },
  { id: "illnesses", label: "Common Illnesses" },
  { id: "chronic", label: "Chronic Disease Management" },
  {
    id: "skin",
    label: "Skin Conditions",
  },
  {
    id: "mental",
    label: "Mental Health Conditions",
  },
  { id: "digestive", label: "Digestive Health" },
  { id: "musculoskeletal", label: "Musculoskeletal Conditions" },
  { id: "heart", label: "Heart and Cardiovascular Conditions" },
  { id: "neurological", label: "Neurological Conditions" },
  { id: "cancer", label: "Cancer Care" },
  { id: "women", label: "Women's Health" },
  { id: "men", label: "Men’s Health" },
  { id: "pediatric", label: "Pediatric Telemedicine" },
  { id: "when-not", label: "When Telemedicine Is Not Appropriate" },
  { id: "emergency", label: "Emergency Symptoms" },
  { id: "comparison", label: "Telemedicine vs In-Person Care" },
  { id: "faq", label: "FAQs" },
  { id: "key-takeaways", label: "Key Takeaways" },
  { id: "Why-choose-us", label: "Why Choose Us?" },
];
const FAQ_ITEMS = [
  {
    q: "What conditions can be treated through telemedicine?",
    a: "Telemedicine can support many non-emergency conditions, including common illnesses, chronic disease follow-ups, skin concerns, mental health conditions, digestive issues, and specialist consultations.",
  },
  {
    q: "Can chronic diseases be managed through telemedicine?",
    a: "Yes. Conditions such as diabetes, high blood pressure, asthma, and thyroid disorders can often be managed through regular virtual follow-up appointments.",
  },
  {
    q: "Can I consult a specialist online?",
    a: "Yes. Many specialists, including cardiologists, neurologists, oncologists, dermatologists, and orthopedic doctors, offer telemedicine consultations when appropriate.",
  },
  {
    q: "Can telemedicine help with a cancer second opinion?",
    a: "Yes. Patients can share medical reports, pathology results, and imaging studies with specialists to receive expert opinions on their diagnosis and treatment options.",
  },
  {
    q: "Are skin conditions suitable for telemedicine?",
    a: "Many skin concerns, such as acne, rashes, eczema, and follow-up dermatology visits, can be discussed through online consultations.",
  },
  {
    q: "Can I use telemedicine for mental health support?",
    a: "Yes. Telemedicine may support counseling, therapy follow-ups, stress management, and discussions regarding mental health concerns.",
  },
  {
    q: "Can children receive telemedicine care?",
    a: "Yes. Telemedicine may be suitable for certain non-emergency pediatric concerns, but severe symptoms require immediate in-person evaluation.",
  },
  {
    q: "When should I avoid telemedicine?",
    a: "Avoid telemedicine for emergencies, severe symptoms, major injuries, or situations where a physical examination or immediate treatment is necessary.",
  },
  {
    q: "Can doctors prescribe medication through telemedicine?",
    a: "Depending on local laws and regulations, healthcare professionals may prescribe certain medications during telemedicine consultations where appropriate.",
  },
  {
    q: "Is telemedicine as effective as an in-person visit?",
    a: "Telemedicine can be effective for many healthcare needs, but it does not replace physical examinations, emergency treatment, or procedures that require direct medical care.",
  },
];

const RELATED_ARTICLES = [
  {
    href: "#",
    img: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=800&auto=format&fit=crop",
    alt: "Doctor reviewing patient chart",
    cat: "Chronic Care",
    title: "Managing Diabetes with Remote Monitoring",
    desc: "How continuous glucose data and virtual check-ins improve long-term control.",
    time: "6 min read",
  },
  {
    href: "#",
    img: "https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?q=80&w=800&auto=format&fit=crop",
    alt: "Person taking notes during a virtual therapy session",
    cat: "Mental Health",
    title: "Online Therapy: What to Expect from Your First Session",
    desc: "A practical walkthrough of booking, privacy, and what happens in session one.",
    time: "7 min read",
  },
  {
    href: "#",
    img: "https://images.unsplash.com/photo-1550831107-1553da8c8464?q=80&w=800&auto=format&fit=crop",
    alt: "Pharmacist checking an e-prescription",
    cat: "Prescriptions",
    title: "How E-Prescriptions Work — and Where They're Valid",
    desc: "Everything about getting, filling, and renewing prescriptions issued online.",
    time: "5 min read",
  },
];

function HeadingLink({ id }) {
  return (
    <a
      className="heading-link"
      href={`#${id}`}
      aria-label="Link to this section"
      style={{ opacity: 0 }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = 0)}
      onFocus={(e) => (e.currentTarget.style.opacity = 1)}
      onBlur={(e) => (e.currentTarget.style.opacity = 0)}
    >
      #
    </a>
  );
}

export default function HowTelemedicineAppointmentWork() {
  const articleRef = useRef(null);
  const [scrollPct, setScrollPct] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [readTime, setReadTime] = useState(1);
  const [activeSection, setActiveSection] = useState("definition");
  const [openFaq, setOpenFaq] = useState(null);
  const [copied, setCopied] = useState(false);

  // Reset scroll on mount so IntersectionObserver bounds are correct from
  // the start (protects against stale scroll position on client-side nav).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Word count + read time
  useEffect(() => {
    const text = articleRef.current ? articleRef.current.innerText || "" : "";
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    setWordCount(words);
    setReadTime(Math.max(1, Math.round(words / 200)));
  }, []);

  // Reading progress
  useEffect(() => {
    function onScroll() {
      const scrollTop = window.scrollY;
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const pct =
        docHeight > 0
          ? Math.min(100, Math.max(0, (scrollTop / docHeight) * 100))
          : 0;
      setScrollPct(Math.round(pct));
    }
    document.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => document.removeEventListener("scroll", onScroll);
  }, []);

  // TOC scrollspy
  useEffect(() => {
    const sections = TOC_ITEMS.map((item) =>
      document.getElementById(item.id),
    ).filter(Boolean);
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-140px 0px -70% 0px", threshold: 0 },
    );
    sections.forEach((s) => spy.observe(s));
    return () => spy.disconnect();
  }, []);

  // Scroll reveal — reveal anything already in view synchronously on mount,
  // only hand off to the observer for elements below the fold.
  useEffect(() => {
    const revealEls = document.querySelectorAll(".blog-page .reveal");
    const revealObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );

    revealEls.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const alreadyInView = rect.top < window.innerHeight && rect.bottom > 0;
      if (alreadyInView) {
        el.classList.add("is-visible");
      } else {
        revealObs.observe(el);
      }
    });

    return () => revealObs.disconnect();
  }, []);

  function handleCopyLink() {
    navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  return (
    <>
      <Helmet>
        <title>{PAGE_TITLE}</title>
        <meta name="description" content={PAGE_DESCRIPTION} />
        <link rel="canonical" href={PAGE_URL} />
      </Helmet>

      <div className="blog-page">
        <a className="skip-link" href="#main-content">
          Skip to article content
        </a>

        {/* Reading progress */}
        <div className="progress-rail" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${scrollPct}%` }} />
        </div>
        <div className="progress-meta">
          <div className="wrap">
            <span>
              <svg viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M12 7v5l3 3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span>{readTime} min read</span>
            </span>
            <span>
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 6h16M4 12h16M4 18h10"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span>{wordCount.toLocaleString()} words</span>
            </span>
            <span>
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3v18M4 12l8-8 8 8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  transform="rotate(90 12 12)"
                />
              </svg>
              <span>{scrollPct}% read</span>
            </span>
          </div>
        </div>

        <main id="main-content">
          <div className="wrap">
            {/* ============ HERO ============ */}
            <section className="hero">
              <div className="hero-top">
                <div className="badge-row">
                  <span className="badge">Telehealth</span>
                  <span className="badge outline">Patient Guide</span>
                </div>
                <h1 className="article-title">
                  What Medical Conditions Can Be Treated Through Telemedicine?
                  Complete List
                </h1>
              </div>

              <figure className="hero-media">
                <img
                  src="https://images.unsplash.com/photo-1580281657702-257584239a55?q=80&w=1400&auto=format&fit=crop"
                  alt="Patient having a video consultation with a doctor on a laptop from home"
                  loading="eager"
                />
                <figcaption>
                  A virtual consultation in progress — patient and physician
                  connected by video from home.
                </figcaption>
              </figure>
            </section>

            {/* ============ ARTICLE LAYOUT — TOC + CONTENT ============ */}
            <div className="article-layout">
              {/* Desktop sticky TOC */}
              <aside className="toc-col" aria-label="Table of contents">
                <nav className="toc-card">
                  <h2>In this guide</h2>
                  <ol>
                    {TOC_ITEMS.map((item) => (
                      <li key={item.id}>
                        <a
                          href={`#${item.id}`}
                          className={activeSection === item.id ? "active" : ""}
                        >
                          {item.label}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              </aside>

              {/* Mobile collapsible TOC */}
              <details className="toc-mobile">
                <summary className="toc-mobile-summary">
                  Jump to a section
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M6 9l6 6 6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </summary>
                <ol className="toc-mobile-list">
                  {TOC_ITEMS.map((item) => (
                    <li key={item.id}>
                      <a href={`#${item.id}`}>{item.label}</a>
                    </li>
                  ))}
                </ol>
              </details>

              {/* ============ BLOG CONTENT ============ */}
              <article
                className="content-col"
                id="articleBody"
                ref={articleRef}
              >
                <section id="definition">
                  <h2>
                    Quick Answer: What Conditions Can Be Treated Through
                    Telemedicine?
                    <HeadingLink id="definition" />
                  </h2>
                  <p>
                    Telemedicine can help manage many non-emergency health
                    concerns, including common illnesses, chronic disease
                    follow-ups, skin conditions, mental health concerns,
                    medication reviews, specialist consultations, and medical
                    second opinions.
                  </p>
                  <p>
                    However, some conditions require physical examinations,
                    diagnostic tests, procedures, or emergency medical
                    treatment. A healthcare professional can determine whether
                    virtual care is appropriate for your situation.
                  </p>
                </section>
                {/* intro */}
                <section id="introduction">
                  <h2>
                    Introduction <HeadingLink id="introduction" />
                  </h2>
                  <p>
                    Telemedicine has changed how patients access healthcare by
                    allowing them to consult doctors and specialists remotely
                    using video calls, phone consultations, and secure online
                    platforms.
                  </p>
                  <p>
                    Many patients ask, “Can my medical condition be treated
                    through telemedicine?”
                  </p>
                  <p>
                    The answer depends on the type and severity of the
                    condition. While telemedicine cannot replace every hospital
                    visit, it can provide convenient access to medical advice,
                    follow-up care, and specialist opinions for many health
                    concerns.
                  </p>

                  <p>
                    This guide explains the common conditions that may be
                    suitable for telemedicine and when an in-person medical
                    evaluation may be necessary.
                  </p>
                </section>

                {/* Online Doctor Consultation  */}
                <section id="illnesses">
                  <h2>
                    Common Illnesses That Can Be Managed Through Telemedicine
                    <HeadingLink id="how-it-works" />
                  </h2>
                  <p>
                    Many everyday health concerns can be evaluated through an
                    online doctor consultation.
                  </p>
                  <p>Examples include:</p>
                  <ul>
                    <li>• Cold and flu symptoms</li>
                    <li>• Fever</li>
                    <li>• Sore throat</li>
                    <li>• Cough</li>
                    <li>• Allergies</li>
                    <li>• Sinus symptoms</li>
                    <li>• Headaches</li>
                    <li>• Mild digestive problems</li>
                    <li>• Minor infections (where appropriate)</li>
                    <li>• General health questions</li>
                  </ul>
                  <p>
                    During the virtual consultation, the doctor will discuss
                    your symptoms and determine whether home care, additional
                    testing, medication (where appropriate and legally
                    permitted), or an in-person visit is needed.
                  </p>
                </section>
                {/* chronic */}
                <section id="chronic">
                  <h2>
                    Chronic Disease Management Through Telemedicine{" "}
                    <HeadingLink id="benefits" />
                  </h2>
                  <p>
                    People living with long-term medical conditions often
                    require regular follow-ups. Telemedicine can make ongoing
                    care more convenient.
                  </p>
                  <div className="card-grid">
                    <div className="info-card reveal">
                      <div className="icon">{/* Keep existing SVG */}</div>
                      <h4>Diabetes</h4>
                      <p>
                        Patients with diabetes may use telemedicine for
                        reviewing blood sugar records, discussing medications,
                        receiving lifestyle and dietary guidance, and attending
                        follow-up appointments.
                      </p>
                    </div>

                    <div className="info-card reveal">
                      <div className="icon">{/* Keep existing SVG */}</div>
                      <h4>High Blood Pressure (Hypertension)</h4>
                      <p>
                        Virtual consultations may support blood pressure
                        monitoring discussions, medication reviews, lifestyle
                        recommendations, and regular follow-up care.
                      </p>
                    </div>

                    <div className="info-card reveal">
                      <div className="icon">{/* Keep existing SVG */}</div>
                      <h4>Asthma and Respiratory Conditions</h4>
                      <p>
                        Telemedicine can help with reviewing symptoms,
                        discussing inhaler use, monitoring disease control, and
                        scheduling follow-up appointments.
                      </p>
                    </div>

                    <div className="info-card reveal">
                      <div className="icon">{/* Keep existing SVG */}</div>
                      <h4>Thyroid Disorders</h4>
                      <p>
                        Patients may consult doctors online to discuss thyroid
                        test results, medication adjustments, symptoms, and
                        ongoing treatment follow-up.
                      </p>
                    </div>
                  </div>
                </section>

                <section id="skin">
                  <h2>
                    Skin Conditions and Dermatology Consultations{" "}
                    <HeadingLink id="when" />
                  </h2>

                  <p>
                    Dermatology is one of the most suitable specialties for
                    telemedicine because many skin concerns can be visually
                    assessed.
                  </p>
                  <p>Common conditions include:</p>
                  <ul>
                    <li>• Acne</li>
                    <li>• Rashes</li>
                    <li>• Eczema</li>
                    <li>• Psoriasis</li>
                    <li>• Skin irritation</li>
                    <li>• Follow-up for existing skin conditions</li>
                  </ul>
                  <p>
                    Doctors may recommend an in-person examination if additional
                    testing or procedures are required.
                  </p>
                </section>

                {/* mental */}
                <section id="mental">
                  <h2>
                    Mental Health Conditions <HeadingLink id="mental" />
                  </h2>

                  <p>
                    Virtual consultations have improved access to mental
                    healthcare.
                  </p>
                  <p>Telemedicine may support patients dealing with:</p>
                  <ul>
                    <li>• Anxiety concerns</li>
                    <li>• Depression management</li>
                    <li>• Stress-related concerns</li>
                    <li>• Counseling and therapy follow-ups</li>
                    <li>• Medication discussions</li>
                  </ul>
                  <p>
                    Patients experiencing a mental health crisis or immediate
                    danger should seek emergency support.
                  </p>
                </section>
                {/* digestive */}
                <section id="digestive">
                  <h2>
                    Digestive Health Conditions <HeadingLink id="digestive" />
                  </h2>

                  <p>
                    Patients may use telemedicine for digestive concerns such
                    as:
                  </p>
                  <p>Telemedicine may support patients dealing with:</p>
                  <ul>
                    <li>• Acid reflux</li>
                    <li>• Stomach discomfort</li>
                    <li>• Constipation</li>
                    <li>• Diarrhea</li>
                    <li>• Irritable bowel symptoms</li>
                    <li>• Follow-up for chronic digestive conditions</li>
                  </ul>
                  <p>
                    Doctors may recommend further testing or in-person
                    evaluation depending on symptoms.
                  </p>
                </section>
                {/* Musculoskeletal Conditions */}
                <section id="musculoskeletal">
                  <h2>
                    Musculoskeletal Conditions{" "}
                    <HeadingLink id="musculoskeletal" />
                  </h2>

                  <p>
                    Many bone, joint, and muscle concerns can initially be
                    discussed through telemedicine. as:
                  </p>
                  <p>Examples include:</p>
                  <ul>
                    <li>• Back pain</li>
                    <li>• Neck pain</li>
                    <li>• Knee pain</li>
                    <li>• Joint discomfort</li>
                    <li>• Minor sports-related injuries</li>
                    <li>• Follow-up after orthopedic treatment</li>
                  </ul>
                  <p>
                    Medical imaging or a physical examination may be required in
                    certain cases.
                  </p>
                </section>

                {/* Heart and Cardiovascular Conditions
                 */}
                <section id="heart">
                  <h2>
                    Heart and Cardiovascular Conditions{" "}
                    <HeadingLink id="heart" />
                  </h2>

                  <p>
                    Telemedicine can support certain aspects of cardiovascular
                    care, especially regular monitoring and follow-up
                    consultations.
                  </p>
                  <p>Patients may use online consultations for:</p>
                  <ul>
                    <li>• High blood pressure follow-ups</li>
                    <li>• Reviewing blood pressure records</li>
                    <li>• Discussing heart-related symptoms</li>
                    <li>• Medication reviews</li>
                    <li>• Lifestyle and heart health guidance</li>
                    <li>• Understanding test reports and treatment plans</li>
                  </ul>
                  <p>
                    However, symptoms such as severe chest pain, sudden
                    shortness of breath, or fainting require immediate emergency
                    medical attention.
                  </p>
                </section>
                {/* neuro */}
                <section id="neurological">
                  <h2>
                    Neurological Conditions <HeadingLink id="neurological" />
                  </h2>

                  <p>
                    Telemedicine can be useful for discussing and managing
                    certain neurological concerns.
                  </p>

                  <p>Examples include:</p>

                  <ul>
                    <li>• Migraine and recurring headaches</li>
                    <li>
                      • Follow-up care for chronic neurological conditions
                    </li>
                    <li>• Medication reviews</li>
                    <li>• Discussion of neurological test reports</li>
                    <li>• Treatment follow-ups</li>
                  </ul>

                  <p>
                    Emergency symptoms such as sudden weakness, difficulty
                    speaking, confusion, loss of balance, or signs of a stroke
                    require urgent in-person medical care.
                  </p>
                </section>

                {/* 'cancer-care-second-opinions */}
                <section id="cancer">
                  <h2>
                    Cancer Care and Medical Second Opinions{" "}
                    <HeadingLink id="cancer" />
                  </h2>

                  <p>
                    A cancer diagnosis often involves complex decisions.
                    Telemedicine allows patients to connect with specialists and
                    seek expert medical second opinions.
                  </p>

                  <p>Online cancer consultations may include:</p>

                  <ul>
                    <li>• Reviewing pathology reports</li>
                    <li>
                      • Discussing imaging studies such as CT scans, MRI scans,
                      and PET scans
                    </li>
                    <li>• Understanding diagnosis and staging information</li>
                    <li>• Discussing available treatment options</li>
                    <li>• Reviewing existing treatment plans</li>
                  </ul>

                  <p>
                    Telemedicine can help patients make informed decisions, but
                    treatments such as surgery, chemotherapy administration, or
                    radiation therapy require appropriate in-person medical
                    care.
                  </p>
                </section>

                {/* women's health */}
                <section id="women">
                  <h2>
                    Women’s Health Consultations <HeadingLink id="women" />
                  </h2>

                  <p>
                    Many non-emergency women’s health concerns can be discussed
                    through telemedicine, including:
                  </p>

                  <ul>
                    <li>• Menstrual concerns</li>
                    <li>• Birth control discussions</li>
                    <li>• Menopause-related symptoms</li>
                    <li>• Follow-up consultations</li>
                    <li>• Review of laboratory reports</li>
                  </ul>

                  <p>
                    Certain symptoms may require physical examinations or
                    diagnostic testing.
                  </p>
                </section>
                {/* men */}
                <section id="men">
                  <h2>
                    Men’s Health Consultations <HeadingLink id="men" />
                  </h2>

                  <p>Telemedicine may support discussions related to:</p>

                  <ul>
                    <li>• Sexual health concerns</li>
                    <li>• Hormonal health discussions</li>
                    <li>• General wellness concerns</li>
                    <li>• Follow-up appointments</li>
                    <li>• Review of test results</li>
                  </ul>

                  <p>
                    Patients should seek in-person care when physical
                    examination or urgent evaluation is needed.
                  </p>
                </section>
                {/* pediatric telemedicine */}
                <section id="pediatric">
                  <h2>
                    Pediatric Telemedicine <HeadingLink id="pediatric" />
                  </h2>

                  <p>
                    Parents may use telemedicine for certain non-emergency
                    concerns involving children, such as:
                  </p>

                  <ul>
                    <li>• Mild fever</li>
                    <li>• Common cold symptoms</li>
                    <li>• Allergies</li>
                    <li>• Minor skin concerns</li>
                    <li>• Follow-up discussions</li>
                  </ul>

                  <p>
                    However, infants, severe symptoms, breathing difficulties,
                    dehydration, or emergencies require immediate medical
                    evaluation.
                  </p>
                </section>
                {/* when telemedicine is not appropriate */}
                <section id="when-not">
                  <h2>
                    When Is Telemedicine Not Appropriate?{" "}
                    <HeadingLink id="when-telemedicine-not-appropriate" />
                  </h2>

                  <p>
                    Although telemedicine can manage many healthcare concerns,
                    some situations require direct medical attention.
                  </p>

                  <p>Telemedicine may not be suitable for:</p>

                  <ul>
                    <li>• Severe injuries or trauma</li>
                    <li>• Conditions requiring physical examination</li>
                    <li>• Surgical procedures</li>
                    <li>• Complex diagnostic testing</li>
                    <li>• Severe or rapidly worsening symptoms</li>
                    <li>• Medical emergencies</li>
                  </ul>

                  <p>
                    A healthcare professional can guide you on whether an
                    in-person visit is necessary.
                  </p>
                </section>
                {/* Emergency Symptoms */}
                <section id="emergency">
                  <h2>
                    Emergency Symptoms That Require Immediate Medical Care{" "}
                    <HeadingLink id="emergency" />
                  </h2>

                  <p>Do not rely on telemedicine if you experience:</p>

                  <ul>
                    <li>• Severe chest pain</li>
                    <li>• Difficulty breathing</li>
                    <li>
                      • Signs of stroke (facial drooping, arm weakness,
                      difficulty speaking)
                    </li>
                    <li>• Severe bleeding</li>
                    <li>• Loss of consciousness</li>
                    <li>• Serious injuries</li>
                    <li>• Severe allergic reactions</li>
                  </ul>

                  <p>
                    Contact your local emergency services or visit the nearest
                    emergency department immediately.
                  </p>
                </section>
                {/* comparison */}
                <section id="comparison">
                  <h2>
                    Telemedicine vs In-Person Care: Which Is Right for You?{" "}
                    <HeadingLink id="telemedicine-vs-in-person-care" />
                  </h2>

                  <p>
                    The right choice depends on your symptoms, medical history,
                    urgency, and your healthcare professional’s recommendation.
                  </p>

                  <div className="table-scroll">
                    <table className="compare">
                      <thead>
                        <tr>
                          <th>Healthcare Need</th>
                          <th>Telemedicine</th>
                          <th>In-Person Visit</th>
                        </tr>
                      </thead>

                      <tbody>
                        <tr>
                          <th scope="row">Common illnesses</th>
                          <td className="good">✓ Often suitable</td>
                          <td>Sometimes needed</td>
                        </tr>

                        <tr>
                          <th scope="row">Chronic disease follow-ups</th>
                          <td className="good">✓ Often suitable</td>
                          <td>Sometimes needed</td>
                        </tr>

                        <tr>
                          <th scope="row">Medication reviews</th>
                          <td className="good">✓ Suitable</td>
                          <td>Sometimes needed</td>
                        </tr>

                        <tr>
                          <th scope="row">Specialist advice</th>
                          <td className="good">✓ Suitable</td>
                          <td>May be needed</td>
                        </tr>

                        <tr>
                          <th scope="row">Medical second opinions</th>
                          <td className="good">✓ Suitable</td>
                          <td>Sometimes needed</td>
                        </tr>

                        <tr>
                          <th scope="row">Physical examination</th>
                          <td>Limited</td>
                          <td className="good">✓ Required</td>
                        </tr>

                        <tr>
                          <th scope="row">Diagnostic procedures</th>
                          <td>Not available</td>
                          <td className="good">✓ Required</td>
                        </tr>

                        <tr>
                          <th scope="row">Emergency treatment</th>
                          <td>Not suitable</td>
                          <td className="good">✓ Required</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <p>
                    The right choice depends on your symptoms, medical history,
                    urgency, and your healthcare professional’s recommendation.
                  </p>
                </section>

                <section id="safety">
                  <h2>
                    Is an Online Doctor Consultation Safe?{" "}
                    <HeadingLink id="safety" />
                  </h2>
                  <p>
                    Yes, online consultations can be safe when conducted through
                    trusted healthcare providers that use secure communication
                    systems and follow appropriate privacy and medical
                    standards.
                  </p>

                  <div className="callout tip reveal">
                    <div className="icon" aria-hidden="true">
                      {/* <svg
                        width="26"
                        height="26"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                        />
                      </svg> */}
                    </div>
                    <div>
                      <h4>For a safer experience:</h4>
                      <ul>
                        <li>• Use a private and quiet location</li>
                        <li>
                          • Avoid public Wi-Fi when discussing sensitive health
                          information
                        </li>
                        <li>• Use trusted telemedicine platforms</li>
                        <li>
                          • Verify the healthcare professional’s credentials
                        </li>
                      </ul>
                      <p>
                        Protecting patient privacy and maintaining
                        confidentiality are essential parts of quality virtual
                        healthcare.
                      </p>
                    </div>
                  </div>
                </section>

                <section id="cost">
                  <h2>
                    How Much Does an Online Doctor Consultation Cost?{" "}
                    <HeadingLink id="cost" />
                  </h2>
                  <p>
                    The cost of an online consultation varies depending on
                    several factors:
                  </p>
                  <ul>
                    <li>• Doctor’s specialty</li>
                    <li>• Country or location</li>
                    <li>• Type of consultation</li>
                    <li>• Duration and complexity of the medical concern</li>
                    <li>• Healthcare provider’s pricing</li>
                  </ul>

                  <p>
                    Some health insurance plans may cover online consultations
                    depending on the provider, policy, and local regulations.
                    Patients should confirm coverage and costs before booking an
                    appointment.
                  </p>
                </section>

                <section id="choose">
                  <h2>
                    How to Choose the Best Online Doctor Consultation Service{" "}
                    <HeadingLink id="choose-online-doctor" />
                  </h2>

                  <div className="myth-grid">
                    <div className="myth-card fact reveal">
                      <span className="tag">Qualified Doctors</span>
                      <p>
                        Choose a service that connects you with licensed and
                        experienced healthcare professionals.
                      </p>
                    </div>

                    <div className="myth-card fact reveal">
                      <span className="tag">Medical Specialties</span>
                      <p>
                        Ensure the platform offers access to the specialists you
                        may need.
                      </p>
                    </div>

                    <div className="myth-card fact reveal">
                      <span className="tag">Privacy & Security</span>
                      <p>
                        Check whether the provider uses secure systems to
                        protect your medical information.
                      </p>
                    </div>

                    <div className="myth-card fact reveal">
                      <span className="tag">Easy Appointments</span>
                      <p>
                        A good platform should make scheduling, communication,
                        and sharing medical records simple.
                      </p>
                    </div>

                    <div className="myth-card fact reveal">
                      <span className="tag">Patient Support</span>
                      <p>
                        Reliable customer assistance can help resolve technical
                        or appointment-related issues.
                      </p>
                    </div>
                  </div>
                </section>

                {/* FAQ */}
                <section id="faq" className="faq-section">
                  <h2>Frequently Asked Questions (FAQs)</h2>
                  {FAQ_ITEMS.map((item, idx) => (
                    <details
                      key={item.q}
                      className="faq-item"
                      open={openFaq === idx}
                      onToggle={(e) =>
                        setOpenFaq(e.currentTarget.open ? idx : null)
                      }
                    >
                      <summary className="faq-q">
                        {item.q}
                        <svg
                          className="chev"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M6 9l6 6 6-6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </summary>
                      <div className="faq-a">{item.a}</div>
                    </details>
                  ))}
                </section>
                {/* key */}
                <section id="key-takeaways">
                  <div className="takeaway-box reveal">
                    <h3>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M9 12l2 2 4-4"
                          stroke="#7FB3FF"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                          stroke="#7FB3FF"
                          strokeWidth="1.5"
                        />
                      </svg>
                      Key Takeaways
                    </h3>

                    <ul>
                      <li>
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M5 13l4 4L19 7"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Telemedicine can help patients access care for many
                        non-emergency medical conditions.
                      </li>

                      <li>
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M5 13l4 4L19 7"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Common illnesses, chronic diseases, skin concerns,
                        mental health conditions, and specialist consultations
                        are often suitable for virtual care.
                      </li>

                      <li>
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M5 13l4 4L19 7"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Online medical second opinions allow patients to discuss
                        complex diagnoses and treatment options with experts.
                      </li>

                      <li>
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M5 13l4 4L19 7"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Some situations require physical examinations, tests,
                        procedures, or emergency treatment.
                      </li>

                      <li>
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M5 13l4 4L19 7"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Choosing the right healthcare option depends on your
                        symptoms and the advice of your healthcare professional.
                      </li>
                    </ul>
                  </div>
                </section>
              </article>
            </div>

            {/* CTA */}
            <section className="cta-section reveal">
              <h2>Need Expert Medical Guidance From Home?</h2>
              <p>
                Humancare Connect makes healthcare more accessible by connecting
                patients with experienced doctors and specialists through secure
                telemedicine services.
                <br />
                <br />
                Whether you need a general consultation, specialist advice,
                chronic disease follow-up, or a medical second opinion, our team
                is here to support your healthcare journey.
              </p>
              <p>
                <strong>
                  Book your online consultation today and receive expert
                  healthcare guidance from anywhere in the world.
                </strong>
              </p>
              <div className="cta-buttons">
                <a href="/appointment-booking" className="btn btn-primary">
                  Book Online Consultation
                </a>
                {/* <a href="/specialists" className="btn btn-secondary">
                  Talk to a Specialist
                </a> */}
              </div>
            </section>
            {/* ============ RELATED ARTICLES ============ */}
            {/* <section className="related-section" aria-label="Related articles">
              <div className="eyebrow" style={{ marginBottom: "8px" }}>
                Keep reading
              </div>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: "26px",
                  color: "var(--navy-900)",
                  margin: "0 0 24px",
                }}
              >
                Related articles
              </h2>
              <div className="related-grid">
                {RELATED_ARTICLES.map((article) => (
                  <a
                    href={article.href}
                    className="related-card"
                    key={article.title}
                  >
                    <div className="thumb">
                      <img src={article.img} alt={article.alt} loading="lazy" />
                    </div>
                    <div className="body">
                      <span className="cat">{article.cat}</span>
                      <h4>{article.title}</h4>
                      <p>{article.desc}</p>
                      <span className="rtime">{article.time}</span>
                    </div>
                  </a>
                ))}
              </div>
            </section> */}
          </div>
        </main>
      </div>
    </>
  );
}
