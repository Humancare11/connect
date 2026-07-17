import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import "./telemedicine.css";
import telemedicineVsInPersonDoctorVisits from "../../assets/BlogImages/telemedicine-vs-in-person-doctor-visits.webp";
import telemedicine from "../../assets/BlogImages/telemedicine.webp";
import topTelemedicinePlatforms from "../../assets/BlogImages/top-telemedicine-platforms.webp";
import doctorConsultation from "../../assets/BlogImages/doctor-consultation.webp";

const PAGE_TITLE =
  "Telemedicine vs In-Person Doctor Visits: Key Differences, Pros & Cons";
const PAGE_DESCRIPTION =
  "Compare telemedicine and in-person doctor visits, including benefits, limitations, costs, convenience, safety, and when each option is the right choice for your healthcare needs.";
const PAGE_URL = "https://humancareconnect.co/blog/online-doctor-consultation";
const PAGE_IMAGE = telemedicineVsInPersonDoctorVisits;

const TOC_ITEMS = [
  { id: "definition", label: "Quick Answer:" },
  { id: "introduction", label: "Introduction" },
  {
    id: "what-is-a-telemedicine-visit",
    label: "What Is a Telemedicine Visit?",
  },
  {
    id: "what-is-an-in-person-doctor-visit",
    label: "What Is an In-Person Doctor Visit?",
  },
  {
    id: "comparison",
    label: "Key Differences",
  },
  { id: "benefits", label: "Benefits" },
  {
    id: "in-person-benefits",
    label: "Benefits of In-Person Doctor Visits",
  },
  {
    id: "when-to-choose-telemedicine",
    label: "When to Choose Telemedicine?",
  },
  {
    id: "when-to-choose-in-person",
    label: "When Should You Choose an In-Person Doctor Visit?",
  },
  { id: "limitations", label: "Limitations of Telemedicine" },
  {
    id: "in-person-limitations",
    label: "Limitations of In-Person Doctor Visits",
  },
  { id: "myths-vs-facts", label: "Myths vs Facts" },

  { id: "faq", label: "FAQs" },
  { id: "key-takeaways", label: "Key Takeaways" },
];
const FAQ_ITEMS = [
  {
    q: "Is telemedicine as effective as an in-person doctor visit?",
    a: "Telemedicine can be effective for many non-emergency health concerns, follow-up care, specialist consultations, and chronic disease management. However, some conditions require in-person examination or testing.",
  },
  {
    q: "What are the main differences between telemedicine and traditional doctor visits?",
    a: "The main differences include location, convenience, physical examination ability, access to specialists, and the need for travel. Both approaches have important roles in modern healthcare.",
  },
  {
    q: "When is telemedicine a better option?",
    a: "Telemedicine is often a good choice for follow-up appointments, reviewing medical reports, medication discussions, chronic disease management, mental health support, and obtaining specialist opinions.",
  },
  {
    q: "When should I choose an in-person doctor visit?",
    a: "Choose in-person care for emergencies, severe symptoms, conditions requiring physical examination, diagnostic tests, or medical procedures.",
  },
  {
    q: "Can telemedicine replace hospitals?",
    a: "No. Telemedicine complements traditional healthcare but does not replace emergency departments, surgeries, or other medical services that require direct medical care.",
  },
  {
    q: "Is telemedicine suitable for elderly patients?",
    a: "Yes. Many elderly patients benefit from telemedicine because it reduces travel and makes regular follow-up appointments more convenient.",
  },
  {
    q: "Can international patients use telemedicine?",
    a: "Yes. International patients may use telemedicine for specialist consultations, medical second opinions, and discussing medical reports, depending on provider services and applicable regulations.",
  },
  {
    q: "Are telemedicine consultations private and secure?",
    a: "Trusted telemedicine providers use security measures designed to protect patient information and maintain confidentiality.",
  },
  {
    q: "Does insurance cover telemedicine and in-person visits?",
    a: "Coverage varies depending on the country, insurance provider, healthcare plan, and applicable regulations.",
  },
  {
    q: "Which is better: telemedicine or an in-person doctor visit?",
    a: "Neither option is always better. The right choice depends on your symptoms, the urgency of your condition, and whether a physical examination, diagnostic testing, or medical procedures are required.",
  },
];

const RELATED_ARTICLES = [
  {
    href: "/what-is-telemedicine",
    img: telemedicine,
    alt: "Doctor reviewing patient chart",
    // cat: "Chronic Care",
    title:
      "What Is Telemedicine? Complete Guide to Meaning, Benefits, Types & How It Works",
    desc: "Telemedicine refers to the delivery of healthcare services remotely through digital technologies, including video consultations, phone calls, mobile applications, and secure online platforms.",
    time: "6 min read",
  },
  {
    href: "/online-doctor-consultation",
    img: doctorConsultation,
    alt: "Online Doctor Consultation: Benefits, Process & When to Choose Virtual Care",
    // cat: "Prescriptions",
    title:
      "Online Doctor Consultation: Benefits, Process & When to Choose Virtual Care",
    desc: "What Is an Online Doctor Consultation? (Quick Answer)",
    time: "5 min read",
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

export default function TelemedicineInPerson() {
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
                  Telemedicine vs In-Person Doctor Visits: Benefits, Differences
                  & Limitations
                </h1>
                {/* <p className="hero-dek">
                  Everything you need to know about virtual healthcare —
                  explained clearly, reviewed by a licensed physician, and
                  grounded in how care actually works at Humancare Connect.
                </p> */}
              </div>

              <figure className="hero-media">
                <img
                  src={telemedicineVsInPersonDoctorVisits}
                  alt="Patient having a video consultation with a doctor on a laptop from home"
                  loading="eager"
                />
                {/* <figcaption>
                  A virtual consultation in progress — patient and physician
                  connected by video from home.
                </figcaption> */}
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
                    Quick Answer: Is Telemedicine Better Than an In-Person
                    Doctor Visit?
                    <HeadingLink id="definition" />
                  </h2>
                  <p>
                    Telemedicine and in-person doctor visits each have unique
                    advantages. Telemedicine provides convenience, faster access
                    to healthcare professionals, easier follow-up care, and
                    access to specialists without travel. In-person visits are
                    essential for physical examinations, emergency treatment,
                    diagnostic procedures, and complex medical situations
                    requiring direct evaluation.
                  </p>
                  <p>
                    The best choice depends on your medical condition, symptoms,
                    urgency, and the healthcare professional’s recommendation.
                  </p>
                </section>
                {/* intro */}
                <section id="introduction">
                  <h2>
                    Introduction <HeadingLink id="introduction" />
                  </h2>
                  <p>
                    Healthcare has evolved significantly with digital
                    technology. Today, patients can receive medical guidance
                    from home through telemedicine or visit healthcare
                    facilities for traditional face-to-face care.
                  </p>
                  <p>
                    Both approaches play an important role in modern healthcare,
                    but many patients wonder:
                  </p>
                  <ul>
                    <li>Is telemedicine as effective as an in-person visit?</li>
                    <li>When should I choose a virtual consultation?</li>
                    <li>What are the limitations of online healthcare?</li>
                    <li>
                      Which option is safer and more suitable for my condition?
                    </li>
                  </ul>
                  <p>
                    The answer is not that one option is always better than the
                    other. Telemedicine and traditional healthcare often work
                    together to provide complete patient care.
                  </p>

                  <p>
                    Understanding their differences can help you make informed
                    healthcare decisions.
                  </p>
                </section>
                {/* What Is a Telemedicine Visit? */}
                <section id="what-is-a-telemedicine-visit">
                  <h2>
                    What Is a Telemedicine Visit?{" "}
                    <HeadingLink id="what-is-a-telemedicine-visit" />
                  </h2>

                  <p>
                    A telemedicine visit is a remote medical consultation that
                    allows patients to connect with healthcare professionals
                    without visiting a clinic or hospital. Consultations are
                    conducted through secure digital communication technologies,
                    making healthcare more accessible and convenient.
                  </p>

                  <p>Telemedicine visits may take place using:</p>

                  <ul>
                    <li>• Video consultations</li>
                    <li>• Phone consultations</li>
                    <li>• Secure digital healthcare platforms</li>
                  </ul>

                  <p>
                    During a telemedicine visit, patients can discuss symptoms,
                    review medical reports, receive specialist opinions, manage
                    chronic conditions, and attend follow-up appointments from
                    the comfort of their home.
                  </p>
                </section>
                {/* in person doctor */}
                <section id="what-is-an-in-person-doctor-visit">
                  <h2>
                    What Is an In-Person Doctor Visit?{" "}
                    <HeadingLink id="what-is-an-in-person-doctor-visit" />
                  </h2>

                  <p>
                    An in-person doctor visit is a face-to-face consultation
                    that takes place at a clinic, hospital, or other healthcare
                    facility. It allows healthcare professionals to perform
                    physical assessments and provide medical care that cannot be
                    delivered remotely.
                  </p>

                  <p>
                    During an in-person appointment, healthcare professionals
                    can:
                  </p>

                  <ul>
                    <li>• Perform a physical examination</li>
                    <li>• Conduct medical procedures</li>
                    <li>• Perform certain diagnostic tests</li>
                    <li>
                      • Observe physical signs that may not be visible during a
                      virtual consultation
                    </li>
                    <li>• Provide emergency and urgent medical treatment</li>
                  </ul>

                  <p>
                    In-person care remains essential for many medical
                    conditions, particularly those requiring hands-on
                    evaluation, diagnostic testing, procedures, or emergency
                    treatment.
                  </p>
                </section>
                {/* Key Differences */}
                <section id="comparison">
                  <h2>
                    Key Differences Between Telemedicine and In-Person Doctor
                    Visits <HeadingLink id="comparison" />
                  </h2>

                  <p>
                    Telemedicine and in-person healthcare each have unique
                    advantages. The right choice depends on your symptoms,
                    medical needs, and whether a physical examination or
                    emergency treatment is required.
                  </p>

                  <div className="table-scroll">
                    <table className="compare">
                      <thead>
                        <tr>
                          <th>Factor</th>
                          <th>Telemedicine</th>
                          <th>In-Person Visit</th>
                        </tr>
                      </thead>

                      <tbody>
                        <tr>
                          <th scope="row">Location</th>
                          <td className="good">
                            Consult from home or any private place
                          </td>
                          <td>Requires visiting a clinic or hospital</td>
                        </tr>

                        <tr>
                          <th scope="row">Travel</th>
                          <td className="good">No travel required</td>
                          <td>Travel required</td>
                        </tr>

                        <tr>
                          <th scope="row">Waiting Time</th>
                          <td className="good">Often shorter</td>
                          <td>May involve longer waits</td>
                        </tr>

                        <tr>
                          <th scope="row">Physical Examination</th>
                          <td>Limited</td>
                          <td className="good">
                            Complete examination possible
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">Access to Specialists</th>
                          <td className="good">
                            Can connect with specialists in different regions
                          </td>
                          <td>Usually limited by location</td>
                        </tr>

                        <tr>
                          <th scope="row">Emergency Care</th>
                          <td>Not suitable</td>
                          <td className="good">Essential for emergencies</td>
                        </tr>

                        <tr>
                          <th scope="row">Follow-Up Visits</th>
                          <td className="good">More convenient</td>
                          <td>Requires another physical visit</td>
                        </tr>

                        <tr>
                          <th scope="row">Medical Procedures</th>
                          <td>Not possible</td>
                          <td className="good">Available when required</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <p>
                    Both telemedicine and in-person care play important roles in
                    healthcare and often work together to provide comprehensive
                    patient care.
                  </p>
                </section>

                {/* Benefits */}
                <section id="benefits">
                  <h2>
                    Benefits of Telemedicine <HeadingLink id="benefits" />
                  </h2>

                  <p>
                    Telemedicine makes healthcare more accessible by reducing
                    travel, improving convenience, and helping patients connect
                    with healthcare professionals from wherever they are.
                  </p>

                  <div className="card-grid">
                    <div className="info-card reveal">
                      <div className="icon">{/* Your existing icon */}</div>
                      <h4>Greater Convenience</h4>
                      <p>
                        Patients can receive medical guidance without spending
                        time traveling, waiting in clinics, or arranging
                        transportation. This is especially helpful for elderly
                        patients, busy professionals, people with mobility
                        limitations, and international patients.
                      </p>
                    </div>

                    <div className="info-card reveal">
                      <div className="icon">{/* Your existing icon */}</div>
                      <h4>Better Access to Specialists</h4>
                      <p>
                        Telemedicine removes geographical barriers, allowing
                        patients to connect with specialists who may not be
                        available nearby. It is particularly valuable for
                        complex health conditions, rare diseases, medical second
                        opinions, and chronic disease management.
                      </p>
                    </div>

                    <div className="info-card reveal">
                      <div className="icon">{/* Your existing icon */}</div>
                      <h4>Easier Follow-Up Care</h4>
                      <p>
                        Virtual follow-up appointments make it easier to discuss
                        test results, medication changes, recovery progress, and
                        long-term treatment plans without unnecessary travel,
                        helping maintain continuity of care.
                      </p>
                    </div>

                    <div className="info-card reveal">
                      <div className="icon">{/* Your existing icon */}</div>
                      <h4>Reduced Time and Additional Expenses</h4>
                      <p>
                        By reducing travel requirements and minimizing time away
                        from work or daily activities, telemedicine can help
                        patients save both time and travel-related expenses
                        while accessing quality healthcare.
                      </p>
                    </div>
                  </div>
                </section>

                {/* doc patient */}
                {/* Benefits of In-Person Care */}
                <section id="in-person-benefits">
                  <h2>
                    Benefits of In-Person Doctor Visits{" "}
                    <HeadingLink id="in-person-benefits" />
                  </h2>

                  <p>
                    In-person healthcare remains essential for many medical
                    situations, especially when physical examinations,
                    diagnostic testing, or immediate treatment are required.
                  </p>

                  <div className="card-grid">
                    <div className="info-card reveal">
                      <div className="icon">{/* Your existing icon */}</div>
                      <h4>Physical Examination</h4>
                      <p>
                        Doctors can examine the body directly, allowing them to
                        assess symptoms, identify physical signs, and accurately
                        evaluate many medical conditions that cannot be fully
                        assessed through virtual consultations.
                      </p>
                    </div>

                    <div className="info-card reveal">
                      <div className="icon">{/* Your existing icon */}</div>
                      <h4>Diagnostic Tests and Procedures</h4>
                      <p>
                        Certain tests and treatments require specialized
                        equipment or direct medical intervention. These include
                        blood tests, imaging procedures, surgeries, and other
                        treatments that can only be performed at a healthcare
                        facility.
                      </p>
                    </div>

                    <div className="info-card reveal">
                      <div className="icon">{/* Your existing icon */}</div>
                      <h4>Immediate Emergency Care</h4>
                      <p>
                        Medical emergencies such as severe chest pain,
                        difficulty breathing, major injuries, severe bleeding,
                        or symptoms of stroke require immediate in-person
                        evaluation and treatment at a hospital or emergency
                        department.
                      </p>
                    </div>
                  </div>
                </section>
                {/* When to Choose Telemedicine */}
                <section id="when-to-choose-telemedicine">
                  <h2>
                    When Should You Choose Telemedicine?{" "}
                    <HeadingLink id="when-to-choose-telemedicine" />
                  </h2>

                  <p>
                    Telemedicine can be a convenient option for many
                    non-emergency healthcare needs. It is particularly useful
                    when a physical examination or immediate medical procedure
                    is not required.
                  </p>

                  <p>Telemedicine may be suitable for:</p>

                  <ul>
                    <li>• General health questions and minor illnesses</li>
                    <li>• Follow-up appointments</li>
                    <li>• Reviewing blood tests and imaging reports</li>
                    <li>• Chronic disease management</li>
                    <li>• Medication discussions</li>
                    <li>• Mental health consultations</li>
                    <li>• Skin concerns that can be evaluated visually</li>
                    <li>• Specialist consultations</li>
                    <li>• Medical second opinions</li>
                    <li>
                      • Patients living in remote areas or international
                      patients seeking expert opinions
                    </li>
                  </ul>

                  <p>
                    A healthcare professional can determine whether virtual care
                    is appropriate based on your symptoms and medical history.
                  </p>
                </section>
                {/* When to Choose In-Person Care */}
                <section id="when-to-choose-in-person">
                  <h2>
                    When Should You Choose an In-Person Doctor Visit?{" "}
                    <HeadingLink id="when-to-choose-in-person" />
                  </h2>

                  <p>
                    Traditional face-to-face healthcare remains essential for
                    many medical situations, especially when physical
                    examinations, diagnostic testing, or immediate treatment are
                    required.
                  </p>

                  <p>You should choose an in-person visit for:</p>

                  <ul>
                    <li>• Symptoms requiring a physical examination</li>
                    <li>• Medical procedures and treatments</li>
                    <li>• Diagnostic testing that cannot be done remotely</li>
                    <li>• Worsening or severe symptoms</li>
                    <li>• Conditions requiring direct monitoring</li>
                  </ul>

                  <p>Seek immediate emergency medical care for:</p>

                  <ul>
                    <li>• Severe chest pain</li>
                    <li>• Difficulty breathing</li>
                    <li>• Sudden weakness or facial drooping</li>
                    <li>• Difficulty speaking or signs of stroke</li>
                    <li>• Severe bleeding</li>
                    <li>• Loss of consciousness</li>
                    <li>• Serious accidents or injuries</li>
                    <li>• Severe allergic reactions</li>
                  </ul>

                  <p>
                    If you are unsure whether your condition can be managed
                    through telemedicine, consult a healthcare professional.
                    They can advise whether virtual care is appropriate or if an
                    in-person evaluation is necessary.
                  </p>
                </section>
                {/* Limitations of Telemedicine */}
                <section id="limitations">
                  <h2>
                    Limitations of Telemedicine <HeadingLink id="limitations" />
                  </h2>

                  <p>
                    Although telemedicine offers many advantages, it also has
                    certain limitations. Some healthcare needs require in-person
                    evaluation, diagnostic testing, or medical procedures that
                    cannot be provided remotely.
                  </p>

                  <div className="card-grid">
                    <div className="info-card reveal">
                      <div className="icon">{/* Your existing icon */}</div>
                      <h4>Limited Physical Examination</h4>
                      <p>
                        Healthcare professionals cannot perform a complete
                        hands-on physical examination during a virtual
                        consultation, which may limit the assessment of certain
                        medical conditions.
                      </p>
                    </div>

                    <div className="info-card reveal">
                      <div className="icon">{/* Your existing icon */}</div>
                      <h4>Dependence on Technology</h4>
                      <p>
                        Telemedicine requires a smartphone, tablet, or computer,
                        a stable internet connection, and basic digital skills.
                        Technical issues may occasionally affect communication
                        during appointments.
                      </p>
                    </div>

                    <div className="info-card reveal">
                      <div className="icon">{/* Your existing icon */}</div>
                      <h4>Not Suitable for Every Condition</h4>
                      <p>
                        Some medical concerns require laboratory tests, imaging
                        studies, procedures, or direct observation by a
                        healthcare professional, making an in-person visit
                        necessary.
                      </p>
                    </div>
                  </div>
                </section>
                {/* Limitations of In-Person Care */}
                <section id="in-person-limitations">
                  <h2>
                    Limitations of In-Person Doctor Visits{" "}
                    <HeadingLink id="in-person-limitations" />
                  </h2>

                  <p>
                    Traditional healthcare remains essential for many medical
                    conditions, but it can also present practical challenges
                    depending on a patient's location, schedule, and access to
                    healthcare services.
                  </p>

                  <div className="card-grid">
                    <div className="info-card reveal">
                      <div className="icon">{/* Your existing icon */}</div>
                      <h4>Travel and Time Commitment</h4>
                      <p>
                        Patients may need to travel long distances, arrange
                        transportation, and spend additional time waiting for
                        appointments, making healthcare less convenient for some
                        individuals.
                      </p>
                    </div>

                    <div className="info-card reveal">
                      <div className="icon">{/* Your existing icon */}</div>
                      <h4>Limited Access to Specialists</h4>
                      <p>
                        Patients living in rural or underserved areas may have
                        limited access to experienced specialists and may need
                        to travel to receive expert medical care.
                      </p>
                    </div>

                    <div className="info-card reveal">
                      <div className="icon">{/* Your existing icon */}</div>
                      <h4>Scheduling Challenges</h4>
                      <p>
                        Appointment availability may vary depending on the
                        specialty, location, and healthcare provider, sometimes
                        resulting in longer waiting periods before receiving
                        care.
                      </p>
                    </div>
                  </div>
                </section>
                {/* Telemedicine Myths vs Facts */}
                <section id="myths-vs-facts">
                  <h2>
                    Telemedicine Myths vs Facts{" "}
                    <HeadingLink id="myths-vs-facts" />
                  </h2>

                  <p>
                    There are many misconceptions about telemedicine.
                    Understanding the facts can help patients make informed
                    decisions about when virtual healthcare is the right choice.
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
                            Telemedicine is not real healthcare
                          </th>
                          <td>
                            Qualified healthcare professionals can provide
                            appropriate medical guidance remotely when suitable.
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">
                            Online consultations are only for minor illnesses
                          </th>
                          <td>
                            Telemedicine can also support chronic disease
                            management, specialist consultations, and medical
                            second opinions.
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">
                            Telemedicine can replace all doctor visits
                          </th>
                          <td>
                            Many conditions still require physical examinations,
                            diagnostic testing, medical procedures, or emergency
                            care.
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">
                            In-person visits are always better
                          </th>
                          <td>
                            The best option depends on the medical condition,
                            patient needs, and the healthcare professional's
                            recommendation.
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">
                            Telemedicine is complicated to use
                          </th>
                          <td>
                            Most telemedicine platforms are designed to make
                            booking and attending appointments simple and
                            user-friendly.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <p>
                    Both telemedicine and in-person healthcare have important
                    roles. Choosing the right option depends on your symptoms,
                    medical needs, and your healthcare professional's advice.
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
                        Telemedicine and in-person healthcare each have unique
                        benefits and limitations.
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
                        Telemedicine provides convenience, easier access to
                        specialists, and simpler follow-up care.
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
                        In-person visits are necessary for emergencies, physical
                        examinations, procedures, and certain diagnostic
                        evaluations.
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
                        The best healthcare approach often combines virtual care
                        with traditional medical visits based on individual
                        patient needs.
                      </li>
                    </ul>
                  </div>
                </section>
              </article>
            </div>

            {/* CTA */}
            <section className="cta-section reveal">
              <h2>
                Get the Right Care at the Right Time with Humancare Connect
              </h2>
              <p>
                Whether you need a convenient online consultation, a specialist
                opinion, or a medical second opinion, Humancare Connect helps
                you access experienced healthcare professionals from wherever
                you are.
              </p>
              <p>
                Our telemedicine services are designed to provide secure,
                convenient, and patient-focused healthcare while helping you
                make informed decisions about your health.
              </p>
              <p>
                <strong>
                  Book your online consultation today and experience expert
                  healthcare without unnecessary travel.
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
