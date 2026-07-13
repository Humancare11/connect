import { useEffect, useRef, useState } from "react";
import "./IndividualBlog.css";

const TOC_ITEMS = [
  { id: "definition", label: "What is telemedicine?" },
  { id: "benefits", label: "Benefits of telemedicine" },
  { id: "how-it-works", label: "How telemedicine works" },
  { id: "types", label: "Types of telemedicine" },
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
    >
      #
    </a>
  );
}

export default function IndividualBlog() {
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
                  Types &amp; How It Works
                </h1>
                <p className="hero-dek">
                  Everything you need to know about virtual healthcare —
                  explained clearly, reviewed by a licensed physician, and
                  grounded in how care actually works at Humancare Connect.
                </p>
              </div>

              <div className="meta-bar">
                <div className="meta-person">
                  <div className="avatar reviewer">RM</div>
                  <div>
                    <span className="label">Medically reviewed by</span>
                    <br />
                    <span className="name">Dr. Rohan Mehta, MD</span>
                  </div>
                </div>
                <div className="meta-facts">
                  <div className="meta-fact">
                    Published<span className="val">Jun 2, 2026</span>
                  </div>
                  <div className="meta-fact">
                    Updated<span className="val">Jul 8, 2026</span>
                  </div>
                </div>
                <div
                  className="share-row"
                  role="group"
                  aria-label="Share this article"
                >
                  <button className="share-btn" aria-label="Share on Twitter">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M22 5.9c-.7.3-1.5.6-2.3.7.8-.5 1.4-1.3 1.7-2.3-.8.5-1.7.8-2.6 1a4.1 4.1 0 0 0-7 3.7A11.6 11.6 0 0 1 3.4 4.8a4.1 4.1 0 0 0 1.3 5.5c-.6 0-1.3-.2-1.8-.5v.1c0 2 1.4 3.6 3.3 4a4.2 4.2 0 0 1-1.8.1 4.1 4.1 0 0 0 3.9 2.9A8.3 8.3 0 0 1 2 18.6a11.6 11.6 0 0 0 6.3 1.8c7.5 0 11.7-6.3 11.7-11.7v-.5c.8-.6 1.5-1.3 2-2.3z" />
                    </svg>
                  </button>
                  <button className="share-btn" aria-label="Share on Facebook">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.2-1.5 1.6-1.5H17V3.7C16.6 3.6 15.6 3.5 14.4 3.5c-2.5 0-4.2 1.5-4.2 4.3v2.1H7.5V13h2.7v8h3.3z" />
                    </svg>
                  </button>
                  <button className="share-btn" aria-label="Share on LinkedIn">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M6.9 8.4H3.6V20H6.9V8.4zM5.3 4a1.9 1.9 0 1 0 0 3.9 1.9 1.9 0 0 0 0-3.9zM20.4 20h-3.3v-5.9c0-1.4 0-3.2-2-3.2s-2.3 1.5-2.3 3.1V20H9.5V8.4h3.2v1.6h.1a3.5 3.5 0 0 1 3.1-1.7c3.3 0 3.9 2.2 3.9 5V20z" />
                    </svg>
                  </button>
                  <button
                    className="share-btn"
                    aria-label={copied ? "Link copied" : "Copy link to article"}
                    onClick={handleCopyLink}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M10 14a4 4 0 0 0 5.7 0l2-2a4 4 0 1 0-5.6-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-2 2a4 4 0 1 0 5.6 5.7l1-1"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                  <button
                    className="share-btn"
                    aria-label="Print article"
                    onClick={() => window.print()}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M6 9V4h12v5M6 18H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2M6 14h12v6H6v-6z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
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
                    What is telemedicine? <HeadingLink id="definition" />
                  </h2>
                  <div className="definition-card reveal">
                    <div className="icon" aria-hidden="true">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="4"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                    <div>
                      <div className="term">Definition</div>
                      <p>
                        <strong>Telemedicine</strong> is the delivery of
                        clinical healthcare — consultations, diagnosis,
                        follow-ups and prescriptions — remotely, using video
                        calls, phone, or secure messaging instead of an
                        in-person clinic visit.
                      </p>
                    </div>
                  </div>
                  <p>
                    In practice, this means you can describe your symptoms to a
                    licensed doctor over a live video call, share reports or
                    photos digitally, and receive a diagnosis and prescription
                    without stepping into a waiting room. Humancare Connect uses
                    this model to make credible medical advice reachable from a
                    phone or laptop, anywhere in the country.
                  </p>
                  <p>
                    The term is often used alongside "telehealth," though
                    telehealth is broader — it includes remote monitoring,
                    health education and administrative services, while
                    telemedicine specifically refers to clinical care delivered
                    at a distance.
                  </p>

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
                  </div>
                </section>

                <section id="benefits">
                  <h2>
                    Benefits of telemedicine <HeadingLink id="benefits" />
                  </h2>
                  <p>
                    Virtual care removes many of the practical barriers that
                    keep people from seeing a doctor early. Here's what patients
                    consistently report:
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
                  </div>
                </section>

                <section id="how-it-works">
                  <h2>
                    How telemedicine works <HeadingLink id="how-it-works" />
                  </h2>
                  <p>
                    A typical Humancare Connect consultation follows five simple
                    steps, usually completed within minutes:
                  </p>
                  <div className="timeline">
                    <div className="t-step reveal">
                      <div className="t-num">1</div>
                      <div className="t-body">
                        <h4>Book an appointment</h4>
                        <p>
                          Choose a doctor by specialty and pick a time slot that
                          works for you.
                        </p>
                      </div>
                    </div>
                    <div className="t-step reveal">
                      <div className="t-num">2</div>
                      <div className="t-body">
                        <h4>Upload reports</h4>
                        <p>
                          Share prior prescriptions, test results, or photos
                          securely before the call.
                        </p>
                      </div>
                    </div>
                    <div className="t-step reveal">
                      <div className="t-num">3</div>
                      <div className="t-body">
                        <h4>Meet your doctor</h4>
                        <p>
                          Join a live video or audio consultation at your
                          scheduled time.
                        </p>
                      </div>
                    </div>
                    <div className="t-step reveal">
                      <div className="t-num">4</div>
                      <div className="t-body">
                        <h4>Receive advice</h4>
                        <p>
                          Get a diagnosis, e-prescription, and care plan sent
                          straight to your account.
                        </p>
                      </div>
                    </div>
                    <div className="t-step reveal">
                      <div className="t-num">5</div>
                      <div className="t-body">
                        <h4>Follow up</h4>
                        <p>
                          Book a quick follow-up call if symptoms persist or
                          tests come back.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                <section id="types">
                  <h2>
                    Types of telemedicine <HeadingLink id="types" />
                  </h2>
                  <p>
                    Telemedicine isn't one single format — it covers a few
                    distinct modes of care, often used together:
                  </p>
                  <ul>
                    <li>
                      <strong>Live video consultation:</strong> Real-time video
                      call with a doctor, closest to an in-person visit.
                    </li>
                    <li>
                      <strong>Store-and-forward:</strong> Photos, scans or
                      reports are sent ahead for a specialist to review
                      asynchronously.
                    </li>
                    <li>
                      <strong>Remote patient monitoring:</strong> Wearables or
                      home devices track vitals like blood pressure or glucose
                      over time.
                    </li>
                    <li>
                      <strong>Mobile health (mHealth):</strong> Apps for
                      medication reminders, symptom tracking and health
                      education.
                    </li>
                  </ul>

                  <blockquote className="quote-block reveal">
                    <p>
                      "The biggest shift with telemedicine isn't the technology
                      — it's that patients now seek help at the first sign of a
                      problem, instead of waiting until it becomes urgent."
                    </p>
                    <cite>— Dr. Rohan Mehta, MD, Internal Medicine</cite>
                  </blockquote>
                </section>

                <section id="comparison">
                  <h2>
                    Telemedicine vs. traditional in-person care{" "}
                    <HeadingLink id="comparison" />
                  </h2>
                  <p>
                    Neither model replaces the other entirely — they serve
                    different needs. Here's how they compare:
                  </p>
                  <div className="table-scroll">
                    <table className="compare">
                      <thead>
                        <tr>
                          <th>Factor</th>
                          <th>Telemedicine</th>
                          <th>In-person visit</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <th scope="row">Wait time</th>
                          <td className="good">Minutes, not hours</td>
                          <td>Often 30–60+ minutes</td>
                        </tr>
                        <tr>
                          <th scope="row">Travel required</th>
                          <td className="good">None</td>
                          <td>Yes</td>
                        </tr>
                        <tr>
                          <th scope="row">Physical examination</th>
                          <td>Limited</td>
                          <td className="good">Full examination possible</td>
                        </tr>
                        <tr>
                          <th scope="row">Best for</th>
                          <td>Consults, follow-ups, minor illness</td>
                          <td>Emergencies, surgery, imaging</td>
                        </tr>
                        <tr>
                          <th scope="row">Prescription access</th>
                          <td className="good">Instant e-prescription</td>
                          <td>Paper or pharmacy hand-off</td>
                        </tr>
                        <tr>
                          <th scope="row">Cost</th>
                          <td className="good">Typically lower</td>
                          <td>Higher (facility fees)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section id="stats">
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
                </section>

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
