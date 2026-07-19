import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import "./telemedicine.css";
import telemedicine from "../../assets/BlogImages/telemedicine.webp";
import topTelemedicinePlatforms from "../../assets/BlogImages/top-telemedicine-platforms.webp";
import telemedicineVsInPersonDoctorVisits from "../../assets/BlogImages/telemedicine-vs-in-person-doctor-visits.webp";
import telemedicineServices from "../../assets/BlogImages/telemedicine-services.webp";
import SEO from "../../components/Seo";
const PAGE_TITLE =
  "What Is Telemedicine? Meaning, Benefits, Types & How It Works";
const PAGE_DESCRIPTION =
  "Discover what telemedicine is, how it works, its benefits, different types, limitations, costs, and how online healthcare is changing the future of medicine.";
const PAGE_URL = "https://humancareconnect.co/blog/what-is-telemedicine";
const PAGE_IMAGE = telemedicine;

const TOC_ITEMS = [
  { id: "definition", label: "What is telemedicine?" },
  { id: "introduction", label: "Introduction" },
  { id: "meaning", label: "Meaning & definition" },
  {
    id: "modern-healthcare",
    label: "Why Is Telemedicine Important in Modern Healthcare?",
  },
  { id: "how-it-works", label: "How telemedicine works" },
  { id: "types", label: "Types of telemedicine" },
  { id: "technology", label: "Technology Behind Telemedicine" },
  { id: "comparison", label: "Telemedicine vs in-person care" },
  { id: "conditions", label: "Conditions commonly treated" },
  { id: "safety", label: "Safety & limitations" },
  { id: "cost", label: "Cost & insurance" },
  { id: "myths", label: "Myths vs facts" },
  { id: "faq", label: "FAQs" },
];

const FAQ_ITEMS = [
  {
    q: "Is telemedicine as effective as an in-person visit?",
    a: "For consultations, follow-ups and many chronic conditions, studies show outcomes comparable to in-person visits. Conditions needing physical examination or imaging still require an in-clinic appointment.",
  },
  {
    q: "Can I get a prescription through telemedicine?",
    a: "Yes. Licensed doctors can issue e-prescriptions for most medications during or after a virtual consultation, sent directly to your account or preferred pharmacy.",
  },
  {
    q: "Is my medical information kept private during a video call?",
    a: "Yes. Consultations run over encrypted video, and records are stored under the same privacy standards used by hospitals and clinics.",
  },
  {
    q: "What do I need to start a telemedicine consultation?",
    a: "A smartphone, tablet or computer with a camera and stable internet connection is enough. Having recent reports or medications on hand helps the doctor assess you faster.",
  },
  {
    q: "Does insurance cover telemedicine consultations?",
    a: "Most major insurers now reimburse virtual visits at parity with in-person care, though coverage depends on your specific plan and the specialty consulted.",
  },
];

const RELATED_ARTICLES = [
  {
    href: "/telemedicine-services",
    img: telemedicineServices,
    alt: "Doctor reviewing patient chart",
    // cat: "Chronic Care",
    title:
      "Telemedicine Services: Everything You Need to Know About Virtual Healthcare",
    desc: "What Are Telemedicine Services?",
    time: "6 min read",
  },
  {
    href: "/telemedicine-vs-in-person-doctor-visits",
    img: telemedicineVsInPersonDoctorVisits,
    alt: "Virtual doctor vs teleconsultation doctor  ",
    // cat: "Mental Health",
    title:
      "Telemedicine vs In-Person Doctor Visits: Benefits, Differences & Limitations",
    desc: "Quick Answer: Is Telemedicine Better Than an In-Person Doctor Visit?",
    time: "7 min read",
  },
  {
    href: "/top-telemedicine-platforms-providers",
    img: topTelemedicinePlatforms,
    alt: "Top Telemedicine Platforms & Providers",
    // cat: "Prescriptions",
    title:
      "Top Telemedicine Platforms & Providers: Features, Benefits & How to Choose",
    desc: "Quick Answer: What Are the Best Telemedicine Platforms?",
    time: "5 min read",
  },
];

function HeadingLink({ id }) {
  return (
    <a
      className="heading-link"
      href={`#${id}`}
      aria-label="Link to this section"
    >
      #
    </a>
  );
}

export default function Telemedicine() {
  const articleRef = useRef(null);
  const [scrollPct, setScrollPct] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [readTime, setReadTime] = useState(1);
  const [activeSection, setActiveSection] = useState("definition");
  const [openFaq, setOpenFaq] = useState(null);
  const [copied, setCopied] = useState(false);

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

  // Scroll reveal
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
    revealEls.forEach((el) => revealObs.observe(el));
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
      <SEO title="What Is Telemedicine? | Virtual Healthcare Explained" description="Learn what telemedicine is and how it works." keywords="What is telemedicine" url="https://humancareconnect.co/what-is-telemedicine" />
      <Helmet>
        <title>{PAGE_TITLE}</title>
        <meta name="description" content={PAGE_DESCRIPTION} />
        <link rel="canonical" href={PAGE_URL} />

        {/* Open Graph */}
        <meta property="og:type" content="article" />
        <meta property="og:title" content={PAGE_TITLE} />
        <meta property="og:description" content={PAGE_DESCRIPTION} />
        <meta property="og:url" content={PAGE_URL} />
        <meta property="og:image" content={PAGE_IMAGE} />
        <meta property="og:site_name" content="Humancare Connect" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={PAGE_TITLE} />
        <meta name="twitter:description" content={PAGE_DESCRIPTION} />
        <meta name="twitter:image" content={PAGE_IMAGE} />
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
                  What Is Telemedicine? Complete Guide to Meaning, Benefits,
                  Types & How It Works
                </h1>
                {/* <p className="hero-dek">
                  Everything you need to know about virtual healthcare —
                  explained clearly, reviewed by a licensed physician, and
                  grounded in how care actually works at Humancare Connect.
                </p> */}
              </div>

              <figure className="hero-media">
                <img
                  src={telemedicine}
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
                    What Is Telemedicine?
                    <HeadingLink id="definition" />
                  </h2>
                  <p>
                    Telemedicine refers to the delivery of healthcare services
                    remotely through digital technologies, including video
                    consultations, phone calls, mobile applications, and secure
                    online platforms. It enables the patients to get the
                    consultation of doctors and healthcare professionals without
                    visiting the hospital or a clinic physically.
                  </p>
                  <p>
                    General health issues, specialist consults, follow-up
                    visits, chronic disease management, mental health care,
                    preventive care and medical second opinions can all be
                    managed with telemedicine. It makes healthcare more
                    accessible by overcoming geographical boundaries and making
                    medical services more convenient for patients.
                  </p>
                  {/* 
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
                        Telemedicine lets you consult a licensed doctor remotely
                        by video, phone, or chat.
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
                        It's best suited to consultations, follow-ups, chronic
                        care and minor illness — not emergencies.
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
                        Most insurance plans in India and the US now reimburse
                        virtual consultations.
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
                        Humancare Connect verifies every doctor's license before
                        they see patients.
                      </li>
                    </ul>
                  </div> */}
                </section>
                {/* intro */}
                <section id="introduction">
                  <h2>
                    Introduction <HeadingLink id="introduction" />
                  </h2>
                  <p>
                    A lot has changed within the healthcare industry in recent
                    years. Previously, it was only possible to obtain medical
                    help if a person visited a clinic, scheduled an appointment,
                    and visited a doctor in person. Although traditional
                    healthcare is still important, thanks to technological
                    advances, it has become possible to introduce a new approach
                    to connecting patients and doctors through telemedicine.
                  </p>
                  <p>
                    Telemedicine makes it possible for patients to contact a
                    medical expert anywhere in the world via smartphones,
                    computer, or any other device with internet access.
                    Regardless of whether a person needs consultations
                    concerning a common disease, follow-up after surgery,
                    treatment of chronic illness, or second opinion by a
                    specialist living thousands of miles away, telemedicine can
                    be helpful.
                  </p>
                  <p>
                    Digital healthcare has revolutionized the experience of
                    obtaining medical services. Nowadays, millions of people
                    across the globe take advantage of telemedicine because of
                    its convenience and quick access to specialists.
                  </p>
                  <p>However, many people still ask important questions:</p>
                  <ul>
                    <li>What does telemedicine actually mean?</li>
                    <li>How does a telemedicine appointment work?</li>
                    <li>Are online doctors trustworthy?</li>
                    <li>
                      What medical conditions can be treated through
                      telemedicine?
                    </li>
                    <li>Is telemedicine safe and secure?</li>
                    <li>What are its advantages and limitations?</li>
                  </ul>
                  <p>
                    This comprehensive guide answers these questions and
                    explains everything patients should know about telemedicine.
                  </p>

                  {/* <div className="card-grid">
                    <div className="info-card reveal">
                      <div className="icon">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M12 21s-7.5-4.6-9.5-9.3C.9 8 2.7 4.3 6.4 4.3c2 0 3.6 1.1 4.6 2.5 1-1.4 2.6-2.5 4.6-2.5 3.7 0 5.5 3.7 3.9 7.4C19.5 16.4 12 21 12 21z"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                        </svg>
                      </div>
                      <h4>Better access to care</h4>
                      <p>
                        Reach a doctor from rural areas or underserved regions
                        without long travel times.
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
                            d="M3 12h4l3-8 4 16 3-8h4"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <h4>Saves time and travel</h4>
                      <p>
                        Skip the commute and waiting room — consult from home,
                        work, or on the go.
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
                            d="M12 8v4l3 2"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                          />
                          <circle
                            cx="12"
                            cy="12"
                            r="9"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                        </svg>
                      </div>
                      <h4>Convenient chronic care</h4>
                      <p>
                        Regular check-ins for diabetes, hypertension and other
                        ongoing conditions.
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
                            d="M8 10h8M8 14h5"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                          />
                          <path
                            d="M21 12c0 4.4-4 8-9 8-1.4 0-2.8-.3-4-.8L3 20l1-4.3C3.4 14.4 3 13.2 3 12c0-4.4 4-8 9-8s9 3.6 9 8z"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                        </svg>
                      </div>
                      <h4>Easy second opinions</h4>
                      <p>
                        Get a specialist's perspective on a diagnosis without a
                        new round of referrals.
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
                            x="3"
                            y="4"
                            width="18"
                            height="16"
                            rx="2"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                          <path
                            d="M8 2v4M16 2v4M3 10h18"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                      <h4>Flexible scheduling</h4>
                      <p>
                        Evening and weekend slots that fit around work and
                        family commitments.
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
                            d="M12 2a5 5 0 0 0-5 5v3a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                          <path
                            d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                      <h4>Reduced infection risk</h4>
                      <p>
                        Avoid crowded waiting rooms, especially valuable for
                        immunocompromised patients.
                      </p>
                    </div>
                  </div> */}
                </section>

                {/* MEaning and defination */}
                <section id="meaning">
                  <h2>
                    Telemedicine Meaning and Definition
                    <HeadingLink id="meaning" />
                  </h2>
                  <p>The term telemedicine combines two words:</p>
                  <ul>
                    <li>• Tele – meaning distance</li>
                    <li>• Medicine – meaning medical care</li>
                  </ul>
                  <p>
                    In simple terms, telemedicine means delivering medical care
                    from a distance using communication technologies.
                  </p>
                  <p>
                    The telemedicine physician can communicate with the patient
                    via video calls, phone, messages, or dedicated health care
                    platform. The doctor during a virtual consultation can talk
                    about symptoms, consider medical history, assess the results
                    or medical images, give medical advice, recommend treatment
                    alternatives, and determine if a visit to the clinic is
                    required.
                  </p>
                  <p>
                    Telemedicine plays a key role in digital health care and has
                    become one of the most crucial solutions in providing
                    good-quality medical care.
                  </p>
                </section>
                {/* Modern Healthcare */}
                <section id="modern-healthcare">
                  <h2>
                    Why Is Telemedicine Important in Modern Healthcare?{" "}
                    <HeadingLink id="modern-healthcare" />
                  </h2>
                  <p>
                    Access to quality healthcare is not equal for everyone. Many
                    patients face challenges such as:
                  </p>
                  <p>
                    Telemedicine makes it possible for patients to contact a
                    medical expert anywhere in the world via smartphones,
                    computer, or any other device with internet access.
                    Regardless of whether a person needs consultations
                    concerning a common disease, follow-up after surgery,
                    treatment of chronic illness, or second opinion by a
                    specialist living thousands of miles away, telemedicine can
                    be helpful.
                  </p>
                  <p>
                    Digital healthcare has revolutionized the experience of
                    obtaining medical services. Nowadays, millions of people
                    across the globe take advantage of telemedicine because of
                    its convenience and quick access to specialists.
                  </p>
                  <p>However, many people still ask important questions:</p>
                  <ul>
                    <li>• Living far from experienced specialists</li>
                    <li>• Long waiting times for appointments</li>
                    <li>• Difficulty traveling due to illness or disability</li>
                    <li>• Busy personal and professional schedules</li>
                    <li>
                      Limited access to specific medical expertise in their
                      region
                    </li>
                  </ul>
                  <p>
                    Telemedicine helps overcome many of these barriers by
                    connecting patients with healthcare providers remotely.
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
                            d="M12 21s-7.5-4.6-9.5-9.3C.9 8 2.7 4.3 6.4 4.3c2 0 3.6 1.1 4.6 2.5 1-1.4 2.6-2.5 4.6-2.5 3.7 0 5.5 3.7 3.9 7.4C19.5 16.4 12 21 12 21z"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                        </svg>
                      </div>
                      <h4>Better Access to Medical Specialists</h4>
                      <p>
                        A patient living in a small city or a different country
                        may not have access to highly experienced specialists.
                        Through telemedicine services, patients can consult
                        doctors from other regions without immediately traveling
                        long distances. <br />
                        This is particularly valuable for complex medical
                        conditions where expert opinions can influence important
                        treatment decisions.
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
                            d="M3 12h4l3-8 4 16 3-8h4"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <h4>Saves time and travel</h4>
                      <p>
                        One of the biggest advantages of telemedicine is
                        convenience. Patients can attend a medical consultation
                        from their home, office, or any location with internet
                        access.
                        <br />
                        This reduces travel time, transportation costs, and the
                        stress associated with visiting a healthcare facility.
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
                            d="M12 8v4l3 2"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                          />
                          <circle
                            cx="12"
                            cy="12"
                            r="9"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                        </svg>
                      </div>
                      <h4> Support for Chronic Disease Management</h4>
                      <p>
                        Patients with long-term health conditions often require
                        regular medical follow-ups. Telemedicine can help
                        patients maintain communication with healthcare
                        providers, discuss symptoms, review treatment progress,
                        and receive guidance for ongoing care.
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
                            d="M8 10h8M8 14h5"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                          />
                          <path
                            d="M21 12c0 4.4-4 8-9 8-1.4 0-2.8-.3-4-.8L3 20l1-4.3C3.4 14.4 3 13.2 3 12c0-4.4 4-8 9-8s9 3.6 9 8z"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                        </svg>
                      </div>
                      <h4>Faster Medical Second Opinions</h4>
                      <p>
                        Many patients seek a second opinion before undergoing
                        major procedures or making important treatment
                        decisions.
                        <br />
                        Through telemedicine, patients can share medical
                        reports, imaging scans, and health records with
                        specialists across different locations and receive
                        expert guidance remotely.
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
                            x="3"
                            y="4"
                            width="18"
                            height="16"
                            rx="2"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                          <path
                            d="M8 2v4M16 2v4M3 10h18"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                      <h4>Reduced Unnecessary Hospital Visits</h4>
                      <p>
                        Not every medical concern requires an immediate physical
                        visit to a hospital or clinic. For many non-emergency
                        situations, telemedicine provides a convenient first
                        step to discuss symptoms and receive professional
                        medical advice.
                      </p>
                    </div>
                  </div>
                </section>

                <section id="how-it-works">
                  <h2>
                    How Does Telemedicine Work?
                    <HeadingLink id="how-it-works" />
                  </h2>
                  <p>
                    How does telemedicine work?” is one of the most popular
                    questions asked by patients.
                    <br />
                    <br />
                    The procedure is supposed to be simple and easy for patients
                    of all ages to access. A telemedicine visit is the means
                    through which patients are able to interact with medical
                    personnel without being in the same physical space as them
                    via technology.
                  </p>
                  <div className="timeline">
                    <div className="t-step reveal">
                      <div className="t-num">1</div>
                      <div className="t-body">
                        <h4>Schedule a Telemedicine Appointment</h4>

                        <p>
                          The journey begins by booking an online appointment
                          with a doctor or specialist. Patients can schedule
                          their consultation through a healthcare website,
                          mobile application, telephone call, or a secure
                          telemedicine platform.
                        </p>

                        <p>
                          You can choose the type of consultation that best
                          suits your healthcare needs:
                        </p>

                        <ul>
                          <li>• General physician consultation</li>
                          <li>• Specialist consultation</li>
                          <li>• Follow-up appointment</li>
                          <li>• Medical second opinion</li>
                          <li>• Chronic disease management consultation</li>
                        </ul>
                      </div>
                    </div>

                    <div className="t-step reveal">
                      <div className="t-num">2</div>
                      <div className="t-body">
                        <h4>Share Medical Information</h4>

                        <p>
                          Before your consultation, you may be asked to provide
                          important medical information so the doctor can better
                          understand your condition and offer personalized
                          medical guidance.
                        </p>

                        <p>This may include:</p>

                        <ul>
                          <li>• Medical history</li>
                          <li>• Current symptoms</li>
                          <li>• Previous diagnoses</li>
                          <li>• Current medications</li>
                          <li>• Allergies</li>
                          <li>• Laboratory reports</li>
                          <li>• Medical scans and imaging reports</li>
                        </ul>

                        <p>
                          Providing complete and accurate information helps the
                          doctor make a more informed clinical assessment and
                          recommend the most appropriate treatment.
                        </p>
                      </div>
                    </div>

                    <div className="t-step reveal">
                      <div className="t-num">3</div>
                      <div className="t-body">
                        <h4>Connect With the Doctor Online</h4>

                        <p>
                          At your scheduled appointment time, you will connect
                          with your healthcare professional through a secure
                          telemedicine platform. Depending on the service,
                          consultations may take place through video, telephone,
                          or secure messaging.
                        </p>

                        <h5>Video Consultation</h5>

                        <p>
                          Video consultations are the most widely used form of
                          telemedicine because they allow doctors and patients
                          to communicate face-to-face remotely.
                        </p>

                        <p>During a video consultation, the doctor may:</p>

                        <ul>
                          <li>• Discuss your symptoms</li>
                          <li>
                            • Observe visible signs such as skin conditions or
                            swelling
                          </li>
                          <li>• Assess your overall appearance</li>
                          <li>• Explain treatment options</li>
                          <li>• Answer your questions</li>
                        </ul>

                        <h5>Telephone Consultation</h5>

                        <p>
                          Phone consultations are useful for discussing
                          symptoms, reviewing medications, receiving follow-up
                          advice, or obtaining general health guidance.
                        </p>

                        <h5>Secure Messaging</h5>

                        <p>
                          Some telemedicine services also offer secure
                          text-based messaging, allowing patients to ask
                          non-emergency questions, share updates, and receive
                          medical instructions from their healthcare provider.
                        </p>
                      </div>
                    </div>

                    <div className="t-step reveal">
                      <div className="t-num">4</div>
                      <div className="t-body">
                        <h4>Receive Medical Advice & Treatment Guidance</h4>

                        <p>
                          After reviewing your symptoms, medical history, and
                          any reports you have shared, the doctor will provide
                          medical advice tailored to your health condition.
                        </p>

                        <p>You may receive:</p>

                        <ul>
                          <li>• A possible diagnosis or clinical assessment</li>
                          <li>• Advice on managing symptoms</li>
                          <li>• Lifestyle recommendations</li>
                          <li>
                            • Suggestions for additional tests or investigations
                          </li>
                          <li>
                            • Guidance on whether an in-person examination is
                            necessary
                          </li>
                        </ul>

                        <p>
                          Depending on local regulations and the healthcare
                          provider's policies, doctors may also issue electronic
                          prescriptions where legally appropriate.
                        </p>
                      </div>
                    </div>

                    <div className="t-step reveal">
                      <div className="t-num">5</div>
                      <div className="t-body">
                        <h4>Follow-Up Care</h4>

                        <p>
                          Healthcare does not always end after a single
                          consultation. Many patients benefit from follow-up
                          appointments to ensure their treatment is working
                          effectively and their health continues to improve.
                        </p>

                        <p>Follow-up consultations may be recommended to:</p>

                        <ul>
                          <li>• Monitor recovery</li>
                          <li>• Discuss test results</li>
                          <li>• Adjust treatment plans</li>
                          <li>• Manage chronic conditions</li>
                          <li>• Track long-term health progress</li>
                        </ul>

                        <p>
                          Telemedicine makes follow-up care more convenient by
                          reducing unnecessary travel while allowing patients to
                          stay connected with their healthcare providers from
                          the comfort of home.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                <section id="types">
                  <h2>
                    Types of Telemedicine <HeadingLink id="types" />
                  </h2>

                  <p>
                    Telemedicine includes several different approaches to
                    delivering healthcare remotely. Understanding these types
                    helps patients choose the most suitable service for their
                    healthcare needs. Each type is designed to improve access to
                    medical care while making consultations more convenient and
                    efficient.
                  </p>

                  <div className="content-block">
                    <h3>1. Real-Time Interactive Telemedicine</h3>

                    <p>
                      Also known as <strong>live telemedicine</strong>, this
                      involves real-time communication between a patient and a
                      healthcare provider. It is the most common form of
                      telemedicine and is widely used for routine medical
                      consultations, follow-up visits, and specialist opinions.
                    </p>

                    <p>Common examples include:</p>

                    <ul>
                      <li>• Video consultations</li>
                      <li>• Telephone appointments</li>
                      <li>• Live virtual meetings with doctors</li>
                    </ul>
                  </div>

                  <div className="content-block">
                    <h3>2. Store-and-Forward Telemedicine</h3>

                    <p>
                      Store-and-forward telemedicine allows medical information
                      to be collected and securely sent to a healthcare
                      specialist for review at a later time. The specialist
                      evaluates the information and provides recommendations
                      without requiring a live consultation.
                    </p>

                    <p>Patients may share:</p>

                    <ul>
                      <li>• Medical images</li>
                      <li>• Laboratory reports</li>
                      <li>• X-rays</li>
                      <li>• MRI or CT scan reports</li>
                      <li>• Patient medical records</li>
                    </ul>

                    <p>
                      This model is commonly used in specialties such as
                      <strong> radiology</strong>, <strong>dermatology</strong>,
                      and
                      <strong> pathology</strong>.
                    </p>
                  </div>

                  <div className="content-block">
                    <h3>3. Remote Patient Monitoring (RPM)</h3>

                    <p>
                      Remote Patient Monitoring (RPM) uses digital devices to
                      collect and transmit patient health information directly
                      to healthcare professionals. This enables doctors to
                      monitor a patient's condition without requiring frequent
                      clinic visits.
                    </p>

                    <p>Common health measurements include:</p>

                    <ul>
                      <li>• Blood pressure</li>
                      <li>• Blood glucose levels</li>
                      <li>• Heart rate</li>
                      <li>• Oxygen saturation</li>
                      <li>• Body weight</li>
                    </ul>

                    <p>
                      This approach is especially beneficial for patients living
                      with chronic medical conditions who require regular
                      monitoring and ongoing care.
                    </p>
                  </div>

                  <div className="content-block">
                    <h3>4. Mobile Health (mHealth)</h3>

                    <p>
                      Mobile Health (mHealth) refers to healthcare services
                      delivered through smartphones, tablets, wearable devices,
                      and mobile health applications. It helps patients stay
                      connected with their healthcare providers and actively
                      manage their health.
                    </p>

                    <p>Examples include:</p>

                    <ul>
                      <li>• Medication reminders</li>
                      <li>• Health tracking apps</li>
                      <li>• Fitness monitoring</li>
                      <li>• Appointment reminders</li>
                      <li>• Communication with healthcare providers</li>
                    </ul>

                    <p>
                      mHealth makes it easier for patients to stay engaged in
                      their healthcare journey while supporting better long-term
                      health management.
                    </p>
                  </div>

                  {/* <blockquote className="quote-block reveal">
                    <p>
                      "The biggest shift with telemedicine isn't the technology
                      — it's that patients now seek help at the first sign of a
                      problem, instead of waiting until it becomes urgent."
                    </p>
                    <cite>— Dr. Rohan Mehta, MD, Internal Medicine</cite>
                  </blockquote> */}
                </section>

                {/* Technology */}
                <section id="technology">
                  <h2>
                    Technology Behind Telemedicine{" "}
                    <HeadingLink id="technology" />
                  </h2>
                  <p>
                    Modern telemedicine relies on several technologies that
                    allow doctors and patients to communicate effectively and
                    securely.
                  </p>
                  <p>These technologies include:</p>

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
                            d="M12 21s-7.5-4.6-9.5-9.3C.9 8 2.7 4.3 6.4 4.3c2 0 3.6 1.1 4.6 2.5 1-1.4 2.6-2.5 4.6-2.5 3.7 0 5.5 3.7 3.9 7.4C19.5 16.4 12 21 12 21z"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                        </svg>
                      </div>
                      <h4>Secure Video Conferencing Platforms</h4>
                      <p>
                        High-quality video communication enables real-time
                        doctor-patient interaction while maintaining privacy and
                        confidentiality.
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
                            d="M3 12h4l3-8 4 16 3-8h4"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <h4>Electronic Health Records (EHR)</h4>
                      <p>
                        Digital health records allow doctors to access patient
                        history, previous treatments, test reports, and other
                        important information more efficiently.
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
                            d="M12 8v4l3 2"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                          />
                          <circle
                            cx="12"
                            cy="12"
                            r="9"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                        </svg>
                      </div>
                      <h4> Mobile Applications</h4>
                      <p>Healthcare apps allow patients to:</p>
                      <ul>
                        <li>• Book appointments</li>
                        <li>• Receive reminders</li>
                        <li>• Track health metrics</li>
                        <li>• Communicate with healthcare providers</li>
                      </ul>
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
                            d="M8 10h8M8 14h5"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                          />
                          <path
                            d="M21 12c0 4.4-4 8-9 8-1.4 0-2.8-.3-4-.8L3 20l1-4.3C3.4 14.4 3 13.2 3 12c0-4.4 4-8 9-8s9 3.6 9 8z"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                        </svg>
                      </div>
                      <h4>Digital Medical Devices</h4>
                      <p>
                        Connected devices such as blood pressure monitors,
                        glucose monitors, and wearable sensors help healthcare
                        professionals monitor patient health remotely.
                      </p>
                    </div>
                  </div>
                </section>

                <section id="comparison">
                  <h2>
                    Telemedicine vs Traditional Healthcare: Understanding the
                    Difference <HeadingLink id="comparison" />
                  </h2>

                  <p>
                    Both telemedicine and in-person healthcare have important
                    roles in modern medicine. The right choice depends on the
                    patient's medical condition, urgency, and healthcare needs.
                  </p>

                  <div className="table-scroll">
                    <table className="compare">
                      <thead>
                        <tr>
                          <th>Feature</th>
                          <th>Telemedicine</th>
                          <th>Traditional Healthcare</th>
                        </tr>
                      </thead>

                      <tbody>
                        <tr>
                          <th scope="row">Location</th>
                          <td>Access from home or any location</td>
                          <td>Requires travel to a clinic or hospital</td>
                        </tr>

                        <tr>
                          <th scope="row">Convenience</th>
                          <td className="good">Very convenient</td>
                          <td>May involve waiting and travel time</td>
                        </tr>

                        <tr>
                          <th scope="row">Access to Specialists</th>
                          <td className="good">
                            Can connect with specialists globally
                          </td>
                          <td>Usually limited to local availability</td>
                        </tr>

                        <tr>
                          <th scope="row">Follow-up Visits</th>
                          <td className="good">Easier and faster</td>
                          <td>Requires physical visits</td>
                        </tr>

                        <tr>
                          <th scope="row">Physical Examination</th>
                          <td>Limited</td>
                          <td className="good">
                            Complete hands-on examination
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">Emergency Care</th>
                          <td>Not suitable</td>
                          <td className="good">Essential for emergencies</td>
                        </tr>

                        <tr>
                          <th scope="row">Cost and Travel Expenses</th>
                          <td className="good">
                            Often lower due to reduced travel
                          </td>
                          <td>May include transportation and other expenses</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* <section id="stats">
                  <h2>Telemedicine by the numbers</h2>
                  <div className="stat-grid">
                    <div className="stat-card reveal">
                      <div className="stat-num">76%</div>
                      <div className="stat-label">
                        of patients say virtual visits meet their needs as well
                        as in-person care
                      </div>
                    </div>
                    <div className="stat-card reveal">
                      <div className="stat-num">38 min</div>
                      <div className="stat-label">
                        average time saved per consultation compared to a clinic
                        visit
                      </div>
                    </div>
                    <div className="stat-card reveal">
                      <div className="stat-num">4.2x</div>
                      <div className="stat-label">
                        growth in telemedicine adoption across India since 2021
                      </div>
                    </div>
                  </div>
                </section> */}

                <section id="conditions">
                  <h2>
                    Conditions commonly treated over telemedicine{" "}
                    <HeadingLink id="conditions" />
                  </h2>
                  <ul>
                    <li>Cold, flu, allergies and minor infections</li>
                    <li>Skin conditions (rashes, acne, mild eczema)</li>
                    <li>Diabetes and hypertension follow-ups</li>
                    <li>Mental health and counselling sessions</li>
                    <li>Prescription renewals and medication reviews</li>
                    <li>Post-surgical follow-up checks</li>
                  </ul>

                  <div className="callout warning reveal">
                    <div className="icon" aria-hidden="true">
                      <svg
                        width="26"
                        height="26"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M12 9v4M12 17h.01"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4>When to skip telemedicine</h4>
                      <p>
                        Chest pain, difficulty breathing, severe bleeding,
                        stroke symptoms, or any life-threatening emergency need
                        immediate in-person emergency care — call your local
                        emergency number instead of booking a virtual visit.
                      </p>
                    </div>
                  </div>
                </section>

                <section id="safety">
                  <h2>
                    Safety, privacy &amp; limitations{" "}
                    <HeadingLink id="safety" />
                  </h2>
                  <p>
                    Reputable telemedicine platforms use encrypted video and
                    store medical records under the same privacy standards as a
                    hospital. At Humancare Connect, every doctor is verified
                    against national medical council registrations before they
                    can consult.
                  </p>
                  <p>
                    That said, virtual care has real limits — a doctor can't
                    listen to your lungs or press on your abdomen through a
                    screen. Some conditions genuinely require hands-on
                    examination, imaging, or lab work that only a physical visit
                    can provide.
                  </p>

                  <div className="callout tip reveal">
                    <div className="icon" aria-hidden="true">
                      <svg
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
                      </svg>
                    </div>
                    <div>
                      <h4>Tip: get the most out of your consult</h4>
                      <p>
                        Keep your recent reports, current medications, and a
                        list of symptoms ready before the call — it helps the
                        doctor reach a clearer diagnosis faster.
                      </p>
                    </div>
                  </div>
                </section>

                <section id="cost">
                  <h2>
                    Cost and insurance coverage <HeadingLink id="cost" />
                  </h2>
                  <p>
                    Virtual consultations are typically priced lower than an
                    in-clinic visit since they remove facility overheads. Most
                    major insurers now reimburse telemedicine at parity with
                    in-person visits, though coverage varies by plan and
                    specialty. Always confirm with your provider before booking
                    if reimbursement matters to you.
                  </p>
                </section>

                <section id="myths">
                  <h2>
                    Myths vs. facts <HeadingLink id="myths" />
                  </h2>
                  <div className="myth-grid">
                    <div className="myth-card myth reveal">
                      <span className="tag">Myth</span>
                      <p>
                        Telemedicine doctors aren't "real" or fully licensed
                        physicians.
                      </p>
                    </div>
                    <div className="myth-card fact reveal">
                      <span className="tag">Fact</span>
                      <p>
                        Every doctor must hold the same medical license required
                        for in-person practice.
                      </p>
                    </div>
                    <div className="myth-card myth reveal">
                      <span className="tag">Myth</span>
                      <p>You can't get a prescription through a video call.</p>
                    </div>
                    <div className="myth-card fact reveal">
                      <span className="tag">Fact</span>
                      <p>
                        Licensed doctors can issue e-prescriptions for most
                        non-controlled medications.
                      </p>
                    </div>
                    <div className="myth-card myth reveal">
                      <span className="tag">Myth</span>
                      <p>Telemedicine is only useful for minor colds.</p>
                    </div>
                    <div className="myth-card fact reveal">
                      <span className="tag">Fact</span>
                      <p>
                        It also supports chronic disease management, mental
                        health and specialist follow-ups.
                      </p>
                    </div>
                  </div>
                </section>

                {/* CTA */}
                <section className="cta-section reveal">
                  <h2>Need medical advice?</h2>
                  <p>
                    Connect with licensed healthcare professionals from
                    anywhere, in minutes.
                  </p>
                  <div className="cta-buttons">
                    <a href="/book" className="btn btn-primary">
                      Book Online Consultation
                    </a>
                    <a href="/specialists" className="btn btn-secondary">
                      Talk to a Specialist
                    </a>
                  </div>
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
              </article>
            </div>

            {/* ============ RELATED ARTICLES ============ */}
            <section className="related-section" aria-label="Related articles">
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
            </section>
          </div>
        </main>
      </div>
    </>
  );
}
