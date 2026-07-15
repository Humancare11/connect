import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import "./telemedicine.css";

const PAGE_TITLE =
  "Is Telemedicine Safe? Privacy, Security & Patient Confidentiality Explained";
const PAGE_DESCRIPTION =
  "Learn how telemedicine protects patient privacy, secures medical information, and maintains confidentiality. Understand telemedicine safety, risks, and best practices.";
const PAGE_URL = "https://humancareconnect.co/blog/online-doctor-consultation";
const PAGE_IMAGE =
  "https://images.unsplash.com/photo-1580281657702-257584239a55?q=80&w=1400&auto=format&fit=crop";

const TOC_ITEMS = [
  { id: "definition", label: "Quick Answer:" },
  { id: "introduction", label: "Introduction" },
  {
    id: "privacy-security",
    label: "Why Privacy and Security Matter",
  },
  {
    id: "protect-patient-info",
    label: "How Telemedicine Platforms Protect Patient Information",
  },
  {
    id: "doctor-patient-confidentiality",
    label: "Doctor-Patient Confidentiality",
  },
  {
    id: "telemedicine-security-risks",
    label: "Common Security Risks",
  },
  {
    id: "protect-privacy-telemedicine",
    label: "How Patients Can Protect Their Privacy",
  },
  { id: "eme-trend", label: "Choose a Secure Telemedicine Provider" },
  {
    id: "privacy-myths-facts",
    label: "Myths vs Facts",
  },
  {
    id: "telemedicine-vs-in-person-privacy",
    label: "Is Telemedicine Safer ?",
  },
  {
    id: "when-to-avoid-telemedicine",
    label: "When to Avoid Telemedicine?",
  },
  { id: "faq", label: "FAQs" },
  { id: "key-takeaways", label: "Key Takeaways" },
];
const FAQ_ITEMS = [
  {
    q: "Is telemedicine safe to use?",
    a: "Yes. Telemedicine can be safe when you use a trusted provider that follows appropriate privacy practices and uses secure technology to protect patient information.",
  },
  {
    q: "Are online doctor consultations private?",
    a: "Yes. Healthcare providers use secure communication methods and confidentiality practices to protect patient discussions and medical information.",
  },
  {
    q: "Can someone access my medical records during a telemedicine appointment?",
    a: "Trusted providers restrict access to patient information through security controls, authentication procedures, and appropriate privacy practices.",
  },
  {
    q: "Are telemedicine video calls recorded?",
    a: "Recording policies vary depending on the provider, patient consent requirements, and applicable laws. Patients can ask their provider about their specific practices.",
  },
  {
    q: "Is it safe to share medical reports online?",
    a: "Yes, when reports are shared through secure and approved channels provided by a trusted telemedicine service.",
  },
  {
    q: "How can I protect my privacy during a virtual consultation?",
    a: "Use a private location, avoid public Wi-Fi, use strong passwords, keep your devices updated, and only use official healthcare platforms.",
  },
  {
    q: "Are telemedicine doctors real and qualified professionals?",
    a: "Telemedicine consultations can be provided by qualified and appropriately licensed healthcare professionals according to applicable regulations.",
  },
  {
    q: "Can telemedicine replace hospital visits?",
    a: "No. Telemedicine is suitable for many non-emergency healthcare needs but cannot replace emergency treatment, surgeries, or situations requiring physical examinations.",
  },
  {
    q: "What security features should a telemedicine platform have?",
    a: "Look for secure communication, protected medical records, identity verification measures, clear privacy policies, and reliable patient support.",
  },
  {
    q: "Is telemedicine suitable for international patients?",
    a: "Yes. Many telemedicine services support international patients seeking specialist consultations, medical second opinions, and medical guidance, depending on applicable regulations and provider services.",
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

export default function TelemedicineSafe() {
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
                  Is Telemedicine Safe? Understanding Privacy, Security &
                  Patient Confidentiality
                </h1>
                {/* <p className="hero-dek">
                  Everything you need to know about virtual healthcare —
                  explained clearly, reviewed by a licensed physician, and
                  grounded in how care actually works at Humancare Connect.
                </p> */}
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
                    Quick Answer: Is Telemedicine Safe?
                    <HeadingLink id="definition" />
                  </h2>
                  <p>
                    Yes, telemedicine can be a safe and secure way to receive
                    healthcare when provided through reputable healthcare
                    organizations using appropriate security practices and
                    following applicable privacy and healthcare regulations.
                  </p>
                  <p>
                    Secure telemedicine platforms are designed to protect
                    patient information, maintain confidentiality, and provide
                    private communication between patients and healthcare
                    professionals. However, patients should also take
                    precautions such as using secure internet connections and
                    choosing trusted providers.
                  </p>
                </section>
                {/* intro */}
                <section id="introduction">
                  <h2>
                    Introduction <HeadingLink id="introduction" />
                  </h2>
                  <p>
                    The ability to consult a doctor from home has transformed
                    healthcare, making medical advice more convenient and
                    accessible. However, many patients hesitate to use virtual
                    healthcare because they are concerned about the safety of
                    sharing personal medical information online.
                  </p>
                  <p>
                    Questions such as “Is my medical data protected?” and “Can
                    someone access my online consultation?” are common and
                    understandable.
                  </p>
                  <p>
                    Healthcare information is among the most sensitive types of
                    personal information. Therefore, privacy, security, and
                    confidentiality are essential components of every
                    telemedicine service
                  </p>

                  <p>
                    Modern telemedicine platforms use various security measures
                    to protect patient information, but understanding how these
                    protections work helps patients make informed decisions when
                    choosing a telemedicine provider.
                  </p>
                </section>

                {/* Privacy security*/}
                <section id="privacy-security">
                  <h2>
                    Why Privacy and Security Matter in Telemedicine{" "}
                    <HeadingLink id="privacy-security" />
                  </h2>

                  <p>
                    During a telemedicine appointment, patients may share
                    sensitive health information with healthcare professionals.
                    Protecting this information is essential to maintain patient
                    privacy and confidentiality.
                  </p>

                  <p>Patients may share:</p>

                  <ul>
                    <li>• Personal details</li>
                    <li>• Medical history</li>
                    <li>• Current symptoms</li>
                    <li>• Prescriptions</li>
                    <li>• Blood reports</li>
                    <li>
                      • Imaging reports such as X-rays, CT scans, or MRI scans
                    </li>
                  </ul>

                  <p>
                    Healthcare records contain sensitive personal information. A
                    trusted telemedicine provider should use secure systems and
                    follow applicable healthcare privacy requirements to help
                    protect patient confidentiality and medical information.
                  </p>
                </section>

                {/* Benefits */}
                <section id="protect-patient-info">
                  <h2>
                    How Telemedicine Platforms Protect Patient Information{" "}
                    <HeadingLink id="protect-patient-info" />
                  </h2>

                  <p>
                    Modern telemedicine platforms use multiple layers of
                    security to protect patient data.
                  </p>

                  <div className="card-grid">
                    <div className="info-card reveal">
                      <div className="icon">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M12 3l8 4v5c0 5-3.4 8.8-8 10-4.6-1.2-8-5-8-10V7l8-4z"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                          <path
                            d="M9.5 12l2 2 3-4"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <h4>Secure Communication Technology</h4>
                      <p>
                        Virtual consultations usually take place through secure
                        platforms designed to protect conversations and medical
                        information from unauthorized access. Patients should
                        avoid sharing sensitive health information through
                        unsecured channels or unknown websites.
                      </p>
                    </div>

                    <div className="info-card reveal">
                      <div className="icon">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <rect
                            x="4"
                            y="10"
                            width="16"
                            height="10"
                            rx="2"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                          <path
                            d="M8 10V7a4 4 0 018 0v3"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                      <h4>Access Controls and User Authentication</h4>
                      <p>
                        Reliable telemedicine systems use secure login methods
                        and identity verification to help ensure only authorized
                        individuals can access patient information and medical
                        records.
                      </p>
                    </div>

                    <div className="info-card reveal">
                      <div className="icon">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M6 3h9l3 3v15H6z"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                          <path
                            d="M15 3v3h3"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                          <path
                            d="M9 11h6M9 15h6"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                      <h4>Secure Storage of Medical Records</h4>
                      <p>
                        Healthcare providers often use secure digital systems to
                        store medical documents, consultation records, and
                        health reports while limiting unauthorized access and
                        maintaining patient confidentiality.
                      </p>
                    </div>

                    <div className="info-card reveal">
                      <div className="icon">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="9"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                          <path
                            d="M8 12l2.5 2.5L16 9"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <h4>Healthcare Privacy Standards and Regulations</h4>
                      <p>
                        Telemedicine providers may follow applicable healthcare
                        privacy and data protection requirements depending on
                        the regions where they operate, helping protect how
                        patient information is collected, stored, used, and
                        shared.
                      </p>
                    </div>
                  </div>
                </section>
                {/* doc patient */}
                <section id="doctor-patient-confidentiality">
                  <h2>
                    Doctor-Patient Confidentiality in Telemedicine{" "}
                    <HeadingLink id="doctor-patient-confidentiality" />
                  </h2>

                  <p>
                    Patient confidentiality is a fundamental part of healthcare,
                    whether a consultation takes place in person or through a
                    telemedicine platform. Healthcare professionals are
                    generally expected to protect patient information and
                    maintain confidentiality in accordance with applicable laws,
                    regulations, and professional standards.
                  </p>

                  <p>
                    Medical information should only be shared in appropriate
                    circumstances as permitted by applicable legal and
                    professional requirements. This helps safeguard patient
                    privacy while supporting safe and effective healthcare.
                  </p>

                  <p>
                    Patients should feel comfortable discussing their symptoms,
                    medical history, medications, and health concerns honestly.
                    Providing accurate and complete information helps healthcare
                    professionals better understand the patient's condition and
                    provide appropriate medical guidance.
                  </p>
                </section>
                {/* Security */}
                <section id="telemedicine-security-risks">
                  <h2>
                    Common Telemedicine Security Risks{" "}
                    <HeadingLink id="telemedicine-security-risks" />
                  </h2>

                  <p>
                    Telemedicine platforms are generally designed with security
                    measures to protect patient information. However, like any
                    digital service, no system is completely free from risk.
                    Understanding common security risks can help patients take
                    simple steps to protect their personal health information.
                  </p>

                  <p>Potential concerns may include:</p>

                  <ul>
                    <li>• Using unsecured public Wi-Fi networks</li>
                    <li>• Weak passwords or poor account security</li>
                    <li>
                      • Sharing medical information through unofficial channels
                    </li>
                    <li>• Unauthorized access due to compromised devices</li>
                  </ul>

                  <p>
                    By using trusted telemedicine platforms, securing personal
                    devices, and following good online safety practices,
                    patients can help reduce these risks and better protect
                    their healthcare information.
                  </p>
                </section>
                {/* protect */}
                <section id="protect-privacy-telemedicine">
                  <h2>
                    How Patients Can Protect Their Privacy During a Telemedicine
                    Appointment{" "}
                    <HeadingLink id="protect-privacy-telemedicine" />
                  </h2>

                  <p>
                    Telemedicine providers play an important role in protecting
                    patient information, but patients can also take simple steps
                    to improve their own digital safety and privacy during
                    virtual consultations.
                  </p>

                  <p>Follow these best practices:</p>

                  <ul>
                    <li>
                      • Use a private and quiet location for your consultation
                    </li>
                    <li>
                      • Avoid using public Wi-Fi when discussing sensitive
                      medical information
                    </li>
                    <li>
                      • Use strong and unique passwords for healthcare accounts
                    </li>
                    <li>• Keep your phone, computer, or tablet updated</li>
                    <li>
                      • Log out of healthcare platforms after using shared
                      devices
                    </li>
                    <li>
                      • Share medical records only through approved and secure
                      channels
                    </li>
                    <li>
                      • Verify that you are using the official website or
                      application of your telemedicine provider
                    </li>
                  </ul>

                  <p>
                    These simple precautions can help reduce privacy risks and
                    create a safer, more secure virtual healthcare experience.
                  </p>
                </section>

                {/* Emerging Telemedicine Trends for the Next Decade  */}
                <section id="eme-trend">
                  <h2>
                    How to Choose a Secure Telemedicine Provider
                    <HeadingLink id="how-it-works" />
                  </h2>
                  <p>
                    Not all online healthcare platforms offer the same level of
                    privacy and security. Before booking an appointment,
                    consider the following factors.
                  </p>
                  <div className="timeline">
                    <div className="t-step reveal">
                      <div className="t-num">1</div>
                      <div className="t-body">
                        <h4>Secure Communication Platform</h4>

                        <p>
                          Choose a telemedicine provider that uses secure
                          communication systems designed to protect virtual
                          consultations and patient information.
                        </p>

                        <p>Look for features such as:</p>

                        <ul>
                          <li>• Secure video consultations</li>
                          <li>• Protected messaging systems</li>
                          <li>• Secure sharing of medical information</li>
                        </ul>

                        <p>
                          Secure communication helps reduce the risk of
                          unauthorized access to sensitive healthcare
                          information.
                        </p>
                      </div>
                    </div>

                    <div className="t-step reveal">
                      <div className="t-num">2</div>
                      <div className="t-body">
                        <h4>Clear Privacy Policies</h4>

                        <p>
                          A trustworthy telemedicine provider should clearly
                          explain how patient information is collected, stored,
                          used, and protected.
                        </p>

                        <p>Review information about:</p>

                        <ul>
                          <li>• Data collection practices</li>
                          <li>• Storage and protection of medical records</li>
                          <li>• Patient privacy policies</li>
                        </ul>

                        <p>
                          Transparent privacy practices help patients understand
                          how their healthcare information is managed.
                        </p>
                      </div>
                    </div>

                    <div className="t-step reveal">
                      <div className="t-num">3</div>
                      <div className="t-body">
                        <h4>Qualified Healthcare Professionals</h4>

                        <p>
                          Choose providers that work with qualified and
                          appropriately licensed healthcare professionals
                          according to applicable regulations.
                        </p>

                        <p>Consider:</p>

                        <ul>
                          <li>• Professional qualifications</li>
                          <li>• Clinical experience</li>
                          <li>• Areas of medical specialization</li>
                        </ul>

                        <p>
                          Qualified healthcare professionals are essential for
                          safe and reliable virtual healthcare.
                        </p>
                      </div>
                    </div>

                    <div className="t-step reveal">
                      <div className="t-num">4</div>
                      <div className="t-body">
                        <h4>Secure Medical Record Handling</h4>

                        <p>
                          A reliable telemedicine platform should provide secure
                          methods for uploading, storing, and accessing medical
                          documents.
                        </p>

                        <p>Look for:</p>

                        <ul>
                          <li>• Secure document uploads</li>
                          <li>• Protected medical record storage</li>
                          <li>• Controlled access to patient information</li>
                        </ul>

                        <p>
                          Proper record management helps maintain patient
                          confidentiality and supports continuity of care.
                        </p>
                      </div>
                    </div>

                    <div className="t-step reveal">
                      <div className="t-num">5</div>
                      <div className="t-body">
                        <h4>Reliable Patient Support</h4>

                        <p>
                          Good customer support helps patients use the platform
                          confidently and resolve issues quickly when needed.
                        </p>

                        <p>Reliable support should assist with:</p>

                        <ul>
                          <li>• Technical issues</li>
                          <li>• Appointment scheduling</li>
                          <li>• Platform guidance</li>
                          <li>• General service-related questions</li>
                        </ul>

                        <p>
                          Responsive patient support contributes to a smoother,
                          safer, and more reliable telemedicine experience.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                <section id="privacy-myths-facts">
                  <h2>
                    Telemedicine Privacy Myths vs Facts{" "}
                    <HeadingLink id="privacy-myths-facts" />
                  </h2>

                  <p>
                    There are many misconceptions about privacy and security in
                    telemedicine. Understanding the facts can help patients make
                    informed decisions when choosing virtual healthcare
                    services.
                  </p>

                  <div className="table-scroll">
                    <table className="compare">
                      <thead>
                        <tr>
                          <th>Myth</th>
                          <th>Fact</th>
                        </tr>
                      </thead>

                      <tbody>
                        <tr>
                          <th scope="row">
                            Online doctor consultations are not private
                          </th>
                          <td>
                            Trusted telemedicine platforms use security measures
                            designed to protect patient confidentiality.
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">
                            Anyone can access my medical records
                          </th>
                          <td>
                            Access to health information is typically restricted
                            to authorized individuals according to applicable
                            policies and regulations.
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">
                            Telemedicine is less professional than in-person
                            care
                          </th>
                          <td>
                            Virtual healthcare follows professional standards
                            and can be appropriate for many non-emergency
                            healthcare needs.
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">
                            Video consultations are always recorded
                          </th>
                          <td>
                            Recording practices depend on the provider, patient
                            consent requirements, and applicable laws.
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">
                            Telemedicine is only for minor illnesses
                          </th>
                          <td>
                            It can also support specialist consultations,
                            chronic disease management, and medical second
                            opinions when appropriate.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <p>
                    Choosing a trusted telemedicine provider and understanding
                    how your information is protected can help you use virtual
                    healthcare with greater confidence.
                  </p>
                </section>

                <section id="telemedicine-vs-in-person-privacy">
                  <h2>
                    Is Telemedicine Safer Than In-Person Healthcare?{" "}
                    <HeadingLink id="telemedicine-vs-in-person-privacy" />
                  </h2>

                  <p>
                    Both telemedicine and traditional healthcare have important
                    responsibilities when it comes to protecting patient privacy
                    and maintaining confidentiality. The safety of either
                    approach depends on the healthcare provider's practices, the
                    technology used, and patient awareness.
                  </p>

                  <p>
                    In a physical clinic or hospital, healthcare providers
                    protect medical records and maintain patient confidentiality
                    through established healthcare procedures. Similarly,
                    trusted telemedicine providers use digital security measures
                    to help protect virtual consultations, medical records, and
                    other patient information.
                  </p>

                  <p>
                    Choosing a reputable healthcare provider, using secure
                    technology, and following good privacy practices can help
                    create a safe healthcare experience, whether your
                    consultation takes place online or in person.
                  </p>
                </section>

                <section id="when-to-avoid-telemedicine">
                  <h2>
                    When Should You Avoid Telemedicine?{" "}
                    <HeadingLink id="when-to-avoid-telemedicine" />
                  </h2>

                  <p>
                    Telemedicine can be a safe and effective option for many
                    non-emergency healthcare needs, but it is not appropriate
                    for every medical situation. Some conditions require
                    immediate in-person evaluation, physical examination,
                    diagnostic testing, or emergency treatment.
                  </p>

                  <p>
                    Seek immediate in-person medical care if you experience:
                  </p>

                  <ul>
                    <li>• Severe chest pain</li>
                    <li>• Difficulty breathing</li>
                    <li>
                      • Symptoms of stroke, such as sudden weakness or
                      difficulty speaking
                    </li>
                    <li>• Severe bleeding</li>
                    <li>• Loss of consciousness</li>
                    <li>• Major injuries or accidents</li>
                    <li>• Severe allergic reactions</li>
                  </ul>

                  <p>
                    Certain medical conditions may also require a physical
                    examination, diagnostic testing, imaging studies, or
                    procedures that cannot be performed remotely. A healthcare
                    professional can help determine whether an in-person visit
                    is necessary based on your symptoms and medical needs.
                  </p>
                </section>
                {/* FAQ */}
                <section id="faq" className="faq-section">
                  <h2>Frequently asked questions</h2>
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
                      Key takeaways
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
                        Telemedicine can provide a safe and secure way to access
                        healthcare when using trusted providers
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
                        Patient privacy and confidentiality remain essential in
                        virtual healthcare.
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
                        Secure technology, proper data protection practices, and
                        patient awareness help improve telemedicine safety.
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
                        Patients should choose providers with strong privacy
                        policies, secure systems, and qualified healthcare
                        professionals
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
                        Emergency situations and conditions requiring physical
                        examinations still require in-person medical care.
                      </li>
                    </ul>
                  </div>
                </section>
              </article>
            </div>

            {/* CTA */}
            <section className="cta-section reveal">
              <h2> Your Privacy Matters at Humancare Connect</h2>
              <p>
                At Humancare Connect, we understand that trust is essential in
                healthcare. Our telemedicine services are designed to provide a
                convenient and secure way for patients to connect with
                experienced healthcare professionals while maintaining respect
                for patient privacy and confidentiality.
              </p>
              <p>
                Whether you need an online consultation, specialist guidance, or
                a medical second opinion, we aim to make quality healthcare
                accessible with a patient-focused approach.
              </p>
              <p>
                <strong>
                  Book your secure online consultation with Humancare Connect
                  today and receive expert healthcare guidance from wherever you
                  are.
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
