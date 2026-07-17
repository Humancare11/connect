import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import "./telemedicine.css";
import medicalConditions from "../../assets/BlogImages/medical-conditions.webp";
import telemedicine from "../../assets/BlogImages/telemedicine.webp";
import topTelemedicinePlatforms from "../../assets/BlogImages/top-telemedicine-platforms.webp";
import telemedicineVsInPersonDoctorVisits from "../../assets/BlogImages/telemedicine-vs-in-person-doctor-visits.webp";
const PAGE_TITLE =
  " How to Choose the Best Telemedicine Provider: 10 Key Factors";
const PAGE_DESCRIPTION =
  "Learn how to choose the best telemedicine provider by evaluating doctor qualifications, specialties, security, technology, patient support, and more.";
const PAGE_URL =
  "https://humancareconnect.co/blog/choose-best-telemedicine-provider";
const PAGE_IMAGE = medicalConditions;

const TOC_ITEMS = [
  {
    id: "definition",
    label: "Quick Answer",
  },
  { id: "introduction", label: "Introduction" },
  {
    id: "factors-to-consider",
    label: "10 Factors to Consider",
  },

  { id: "avoid", label: "Red Flags to Avoid" },
  { id: "provider-comparison-checklist", label: "Chronic Disease Management" },
  {
    id: "provider-comparison-checklist",
    label: "Provider Comparison",
  },
  { id: "questions-before-booking", label: "Questions to Ask Before Booking" },
  {
    id: "why-choose-the-right-provider",
    label: "Why Choosing the Right Telemedicine Provider Matters",
  },
  { id: "faq", label: "FAQs" },
  { id: "key-takeaways", label: "Key Takeaways" },
];

const FAQ_ITEMS = [
  {
    q: "What makes a telemedicine provider trustworthy?",
    a: "A trustworthy telemedicine provider offers qualified healthcare professionals, secure technology, transparent pricing, reliable patient support, and clear information about its services.",
  },
  {
    q: "How do I know if an online doctor is qualified?",
    a: "Check the healthcare professional's qualifications, experience, specialty, and applicable licensing information according to the region where they practice.",
  },
  {
    q: "Are telemedicine providers safe to use?",
    a: "Yes. Reputable providers use secure systems and follow healthcare privacy requirements to protect patient information.",
  },
  {
    q: "Should I choose a telemedicine provider with multiple specialties?",
    a: "A provider with access to multiple specialties can make it easier to receive comprehensive healthcare support, especially if you require specialist opinions.",
  },
  {
    q: "Can I get a second opinion through a telemedicine provider?",
    a: "Yes. Many telemedicine providers allow patients to share medical records, reports, and imaging studies to obtain expert medical second opinions.",
  },
  {
    q: "Do telemedicine providers accept international patients?",
    a: "Some providers support international patients by offering remote consultations, specialist opinions, and medical report reviews, depending on applicable regulations and services offered.",
  },
  {
    q: "How much do telemedicine services usually cost?",
    a: "Costs vary based on the healthcare professional, specialty, location, consultation type, and provider pricing structure.",
  },
  {
    q: "What technology is required for telemedicine consultations?",
    a: "Most virtual appointments require a smartphone, tablet, or computer, a stable internet connection, and access to the provider's communication platform.",
  },
  {
    q: "Can telemedicine replace all hospital visits?",
    a: "No. Telemedicine is suitable for many non-emergency healthcare needs but cannot replace emergency treatment, surgeries, or situations requiring physical examinations.",
  },
  {
    q: "What should I check before booking an online consultation?",
    a: "Review doctor credentials, specialties available, privacy practices, consultation costs, appointment availability, and patient support services.",
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

export default function MedicalConditions() {
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
                  How to Choose the Best Telemedicine Provider: 10 Important
                  Factors to Consider
                </h1>
              </div>

              <figure className="hero-media">
                <img
                  src={medicalConditions}
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
                    Quick Answer: How Do You Choose the Best Telemedicine
                    Provider?
                    <HeadingLink id="definition" />
                  </h2>
                  <p>
                    The best telemedicine provider should offer qualified
                    healthcare professionals, multiple medical specialties,
                    secure technology, transparent pricing, convenient
                    appointment scheduling, and reliable patient support.
                    Patients should also consider privacy standards, ease of
                    use, availability of second opinions, and the provider’s
                    overall healthcare approach before making a decision.
                  </p>
                </section>
                {/* intro */}
                <section id="introduction">
                  <h2>
                    Introduction <HeadingLink id="introduction" />
                  </h2>
                  <p>
                    Telemedicine has made healthcare more accessible than ever
                    before. Patients can now consult doctors, receive specialist
                    opinions, review medical reports, and manage ongoing health
                    concerns without traveling to a hospital or clinic.
                  </p>
                  {/* FIX: this paragraph was duplicated verbatim right after
                      the one above — removed the repeat. */}
                  <p>
                    Not every provider offers the same level of medical
                    expertise, technology, patient support, or range of
                    services. Selecting a trusted telemedicine provider is
                    important because your healthcare decisions depend on
                    accurate guidance, privacy, and a smooth patient experience.
                  </p>

                  <p>
                    This guide explains the 10 most important factors to
                    consider before choosing an online healthcare provider.
                  </p>
                </section>
                {/* 10 factors timeline */}
                {/* FIX: this section previously had its <h2>/HeadingLink
                    commented out, so it rendered with no title at all and
                    wasn't reachable from the TOC. Restored a heading that
                    matches the content and added it to TOC_ITEMS above. */}
                <section id="factors-to-consider">
                  <h2>
                    10 Factors to Consider When Choosing a Telemedicine Provider
                    <HeadingLink id="factors-to-consider" />
                  </h2>
                  <p>
                    The process of an online consultation is simple and
                    patient-friendly.
                  </p>
                  <div className="timeline">
                    <div className="t-step reveal">
                      <div className="t-num">1</div>
                      <div className="t-body">
                        <h4>Verify Doctor Qualifications and Experience</h4>

                        <p>
                          The quality of a telemedicine service depends heavily
                          on the healthcare professionals behind it. Before
                          booking a consultation, check whether the provider
                          works with qualified and appropriately licensed
                          healthcare professionals according to applicable
                          regulations.
                        </p>

                        <p>Consider:</p>

                        <ul>
                          <li>• Medical qualifications</li>
                          <li>• Clinical experience</li>
                          <li>• Areas of specialization</li>
                          <li>
                            • Experience treating your type of health concern
                          </li>
                        </ul>

                        <p>
                          Experienced specialists can provide better guidance,
                          especially for complex conditions and medical second
                          opinions.
                        </p>
                      </div>
                    </div>

                    <div className="t-step reveal">
                      <div className="t-num">2</div>
                      <div className="t-body">
                        <h4>Check the Availability of Medical Specialties</h4>

                        <p>
                          A strong telemedicine provider should offer access to
                          multiple specialties to support a wide range of
                          healthcare needs.
                        </p>

                        <p>
                          Depending on your needs, you may require specialists
                          in areas such as:
                        </p>

                        <ul>
                          <li>• Cardiology</li>
                          <li>• Oncology</li>
                          <li>• Neurology</li>
                          <li>• Orthopedics</li>
                          <li>• Dermatology</li>
                          <li>• Gastroenterology</li>
                          <li>• Endocrinology</li>
                        </ul>

                        <p>
                          Having multiple specialties available allows patients
                          to receive more comprehensive healthcare support from
                          a single platform.
                        </p>
                      </div>
                    </div>

                    <div className="t-step reveal">
                      <div className="t-num">3</div>
                      <div className="t-body">
                        <h4>Evaluate Privacy and Data Security</h4>

                        <p>
                          Medical information is highly personal and should be
                          protected. Choose a provider that uses secure
                          communication methods and follows applicable privacy
                          and data protection requirements.
                        </p>

                        <p>Important factors include:</p>

                        <ul>
                          <li>• Secure patient communication</li>
                          <li>• Protected medical records</li>
                          <li>• Clear privacy policies</li>
                          <li>• Appropriate data handling practices</li>
                        </ul>

                        <p>
                          Patients should avoid sharing sensitive medical
                          information through unsecured channels.
                        </p>
                      </div>
                    </div>

                    <div className="t-step reveal">
                      <div className="t-num">4</div>
                      <div className="t-body">
                        <h4>Consider Ease of Booking and Technology</h4>

                        <p>
                          A telemedicine platform should make healthcare simple
                          and convenient.
                        </p>

                        <p>Look for features such as:</p>

                        <ul>
                          <li>• Easy online appointment booking</li>
                          <li>• User-friendly website or mobile application</li>
                          <li>• Stable video consultation technology</li>
                          <li>• Simple medical report upload process</li>
                          <li>• Clear appointment instructions</li>
                        </ul>

                        <p>
                          Good technology improves the overall patient
                          experience.
                        </p>
                      </div>
                    </div>

                    <div className="t-step reveal">
                      <div className="t-num">5</div>
                      <div className="t-body">
                        <h4>Look at Available Consultation Types</h4>

                        <p>
                          Different patients have different healthcare needs.
                          The best telemedicine providers usually offer a wide
                          range of consultation services.
                        </p>

                        <p>These may include:</p>

                        <ul>
                          <li>• General online doctor consultations</li>
                          <li>• Specialist consultations</li>
                          <li>• Follow-up appointments</li>
                          <li>• Medical second opinions</li>
                          <li>• Chronic disease management</li>
                        </ul>

                        <p>
                          Choosing a provider with a wide range of services
                          helps support your current and future healthcare
                          needs.
                        </p>
                      </div>
                    </div>

                    <div className="t-step reveal">
                      <div className="t-num">6</div>
                      <div className="t-body">
                        <h4>Check Availability and Appointment Flexibility</h4>

                        <p>
                          Convenience is one of the biggest advantages of
                          telemedicine.
                        </p>

                        <p>Before choosing a provider, consider:</p>

                        <ul>
                          <li>• Appointment availability</li>
                          <li>• Waiting times</li>
                          <li>
                            • Time-zone flexibility for international patients
                          </li>
                          <li>• Ease of rescheduling appointments</li>
                        </ul>

                        <p>
                          A provider that offers flexible scheduling can make
                          healthcare more accessible.
                        </p>
                      </div>
                    </div>

                    <div className="t-step reveal">
                      <div className="t-num">7</div>
                      <div className="t-body">
                        <h4>Review Patient Support and Communication</h4>

                        <p>
                          Reliable patient support can improve your telemedicine
                          experience.
                        </p>

                        <p>Good providers should offer assistance with:</p>

                        <ul>
                          <li>• Appointment scheduling</li>
                          <li>• Technical issues</li>
                          <li>• Uploading medical records</li>
                          <li>• General service-related questions</li>
                        </ul>

                        <p>
                          Clear communication helps patients feel more
                          comfortable throughout their healthcare journey.
                        </p>
                      </div>
                    </div>

                    <div className="t-step reveal">
                      <div className="t-num">8</div>
                      <div className="t-body">
                        <h4>Understand Pricing and Payment Transparency</h4>

                        <p>
                          Before booking a consultation, understand the
                          provider's pricing structure.
                        </p>

                        <p>Check:</p>

                        <ul>
                          <li>• Consultation fees</li>
                          <li>• Additional service charges</li>
                          <li>• Accepted payment methods</li>
                          <li>• Insurance information where applicable</li>
                        </ul>

                        <p>
                          Transparent pricing helps patients make informed
                          decisions and avoid unexpected costs.
                        </p>
                      </div>
                    </div>

                    <div className="t-step reveal">
                      <div className="t-num">9</div>
                      <div className="t-body">
                        <h4>Consider International Patient Support</h4>

                        <p>
                          For patients seeking healthcare beyond their country,
                          international support is essential.
                        </p>

                        <p>Look for providers that can help with:</p>

                        <ul>
                          <li>• Sharing medical reports securely</li>
                          <li>• Specialist consultations</li>
                          <li>• Medical second opinions</li>
                          <li>• Cross-border patient communication</li>
                          <li>
                            • Understanding treatment options before travel
                          </li>
                        </ul>

                        <p>
                          This is especially valuable for complex conditions
                          requiring expert opinions.
                        </p>
                      </div>
                    </div>

                    <div className="t-step reveal">
                      <div className="t-num">10</div>
                      <div className="t-body">
                        <h4>Look for a Patient-Centered Approach</h4>

                        <p>
                          The best telemedicine provider does not only offer
                          technology—it focuses on the patient's overall
                          healthcare experience.
                        </p>

                        <p>A patient-centered provider should offer:</p>

                        <ul>
                          <li>• Clear communication</li>
                          <li>• Respect for patient concerns</li>
                          <li>• Personalized guidance</li>
                          <li>• Convenient healthcare access</li>
                          <li>• Support throughout the consultation process</li>
                        </ul>

                        <p>
                          A positive healthcare experience builds trust and
                          helps patients make informed decisions.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
                {/* Red Flags to Avoid When Choosing a Telemedicine Provider*/}
                <section id="avoid">
                  <h2>
                    Red Flags to Avoid When Choosing a Telemedicine Provider{" "}
                    <HeadingLink id="avoid" />
                  </h2>

                  <p>
                    While many telemedicine platforms offer quality healthcare
                    services, patients should be cautious of providers that lack
                    transparency or do not prioritize patient safety.
                  </p>
                  <p>Avoid providers that:</p>
                  <ul>
                    <li>
                      • Do not clearly explain doctor qualifications or
                      specialties
                    </li>
                    <li>• Have unclear pricing or hidden fees</li>
                    <li>
                      • Use insecure methods for sharing medical information
                    </li>
                    <li>• Provide poor customer support</li>
                    <li>
                      • Make unrealistic promises or guarantee treatment
                      outcomes
                    </li>
                    <li>• Do not clearly explain their consultation process</li>
                    <li>• Offer limited options for follow-up care</li>
                  </ul>

                  <p>
                    Choosing a trustworthy provider is essential for receiving
                    safe and reliable virtual healthcare.
                  </p>
                </section>

                {/* comparison */}

                <section id="provider-comparison-checklist">
                  <h2>
                    Telemedicine Provider Comparison Checklist{" "}
                    <HeadingLink id="provider-comparison-checklist" />
                  </h2>

                  <p>
                    Use this checklist when comparing different telemedicine
                    providers.
                  </p>

                  <div className="table-scroll">
                    <table className="compare">
                      <thead>
                        <tr>
                          <th>Factor</th>
                          <th>What to Look For</th>
                        </tr>
                      </thead>

                      <tbody>
                        <tr>
                          <th scope="row">Doctor Credentials</th>
                          <td>
                            Qualified and appropriately licensed healthcare
                            professionals
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">Medical Specialties</th>
                          <td>
                            Access to specialists based on your health needs
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">Privacy &amp; Security</th>
                          <td>
                            Secure communication and responsible data handling
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">Appointment Booking</th>
                          <td>Simple scheduling and convenient availability</td>
                        </tr>

                        <tr>
                          <th scope="row">Technology</th>
                          <td>
                            Easy-to-use platform with reliable communication
                            tools
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">Services Offered</th>
                          <td>
                            Consultations, follow-ups, second opinions, and more
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">Pricing</th>
                          <td>
                            Clear consultation fees and payment information
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">Patient Support</th>
                          <td>
                            Responsive assistance before and after appointments
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">International Support</th>
                          <td>
                            Ability to assist patients across different
                            locations where applicable
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
                {/* Questions to Ask Before Booking */}
                <section id="questions-before-booking">
                  <h2>
                    Questions to Ask Before Booking a Telemedicine Appointment{" "}
                    <HeadingLink id="questions-before-booking" />
                  </h2>

                  <p>
                    Before selecting an online healthcare provider, consider
                    asking:
                  </p>

                  <ul>
                    <li>
                      • What qualifications and experience do the healthcare
                      professionals have?
                    </li>
                    <li>
                      • Does the provider offer specialists for my medical
                      condition?
                    </li>
                    <li>• How is my medical information protected?</li>
                    <li>
                      • What are the consultation costs and payment options?
                    </li>
                    <li>
                      • Can I upload my medical reports and imaging studies?
                    </li>
                    <li>• Is follow-up care available after my appointment?</li>
                    <li>
                      • How do I contact support if I have technical problems?
                    </li>
                    <li>
                      • Is the service suitable for international patients?
                    </li>
                  </ul>

                  <p>
                    The answers to these questions can help you choose a
                    provider that matches your healthcare needs.
                  </p>
                </section>
                {/* WHY CHOOSE THE RIGHT PROVIDER */}
                <section id="why-choose-the-right-provider">
                  <h2>
                    Why Choosing the Right Telemedicine Provider Matters{" "}
                    <HeadingLink id="why-choose-the-right-provider" />
                  </h2>

                  <p>
                    A telemedicine provider is more than just a digital
                    platform—it is part of your healthcare journey.
                  </p>

                  <p>The right provider can help you:</p>

                  <ul>
                    <li>• Access qualified healthcare professionals</li>
                    <li>• Receive specialist opinions</li>
                    <li>• Manage chronic conditions</li>
                    <li>• Obtain medical second opinions</li>
                    <li>• Understand your diagnosis and treatment options</li>
                    <li>• Receive convenient follow-up care</li>
                  </ul>

                  <p>
                    A well-chosen telemedicine service can improve
                    accessibility, save time, and support better healthcare
                    decisions.
                  </p>
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
                {/* Key Takeaways */}
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
                        Choosing the right telemedicine provider is important
                        for receiving safe and effective virtual healthcare.
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
                        Look for qualified healthcare professionals, multiple
                        specialties, secure technology, transparent pricing, and
                        reliable patient support.
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
                        Avoid providers that lack transparency, make unrealistic
                        claims, or have poor communication.
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
                        The best provider should offer a convenient, secure, and
                        patient-focused healthcare experience.
                      </li>
                    </ul>
                  </div>
                </section>
              </article>
            </div>

            {/* CTA */}
            <section className="cta-section reveal">
              <h2>
                Choose a Trusted Partner for Your Virtual Healthcare Journey
              </h2>
              <p>
                At <strong>Humancare Connect</strong>, we focus on making expert
                healthcare accessible through secure and convenient telemedicine
                services. Connect with experienced healthcare professionals,
                seek specialist opinions, share medical reports, and receive
                guidance from the comfort of your home.
              </p>
              <p>
                Whether you need a routine online consultation or a medical
                second opinion for a complex condition, we are here to support
                your healthcare decisions.
              </p>
              <p>
                <strong>
                  Book your online consultation with Humancare Connect today and
                  experience patient-focused virtual healthcare.
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
