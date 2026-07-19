import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import "./telemedicine.css";
import realDoctors from "../../assets/BlogImages/real-doctors.webp";
import telemedicine from "../../assets/BlogImages/telemedicine.webp";
import topTelemedicinePlatforms from "../../assets/BlogImages/top-telemedicine-platforms.webp";
import telemedicineVsInPersonDoctorVisits from "../../assets/BlogImages/telemedicine-vs-in-person-doctor-visits.webp";
import SEO from "../../components/Seo";
const PAGE_TITLE =
  "Are Online Doctors Real Doctors? Credentials, Qualifications & Safety Explained";
const PAGE_DESCRIPTION =
  "Learn whether online doctors are real doctors, how their credentials are verified, the quality of virtual healthcare, and how to choose a trusted telemedicine provider.";
const PAGE_URL = "https://humancareconnect.co/are-online-doctors-real-doctors";
const PAGE_IMAGE = realDoctors;

const TOC_ITEMS = [
  { id: "definition", label: "Are Online Doctors Real Doctors?" },
  { id: "introduction", label: "Introduction" },
  { id: "licensed", label: "Are Online Doctors Licensed?" },
  { id: "credentials", label: "How Credentials Are Verified" },
  { id: "quality-of-care", label: "Quality of Care" },
  { id: "what-can-help", label: "What Online Doctors Can Help With" },
  { id: "safety", label: "Are Online Doctors Safe & Reliable?" },
  { id: "choose-doctor", label: "How to Choose a Trustworthy Doctor" },
  { id: "red-flags", label: "Red Flags to Avoid" },
  { id: "comparison", label: "Online vs In-Person Doctors" },
  { id: "myths", label: "Common Myths" },
  { id: "faq", label: "FAQs" },
  { id: "key-takeaways", label: "Key Takeaways" },
  { id: "why-choose-us", label: "Why Choose Us?" },
];

const FAQ_ITEMS = [
  {
    q: "Are online doctors actual licensed doctors?",
    a: "Yes. Reputable telemedicine services work with qualified healthcare professionals who meet licensing and professional requirements applicable to their region of practice.",
  },
  {
    q: "Do online doctors have the same qualifications as traditional doctors?",
    a: "The method of consultation does not change a doctor's medical education, training, or professional responsibilities. The difference is that care is delivered through digital communication.",
  },
  {
    q: "Can online doctors diagnose medical conditions?",
    a: "Online doctors can assess many health concerns by reviewing symptoms, medical history, and available reports. Some conditions may require physical examinations, tests, or in-person evaluations.",
  },
  {
    q: "Can online doctors prescribe medications?",
    a: "Depending on local laws, regulations, and the patient's medical situation, doctors may prescribe certain medications during online consultations where legally permitted.",
  },
  {
    q: "Are online consultations safe and private?",
    a: "Yes. Trusted telemedicine platforms use secure technologies and privacy practices to help protect patient information and confidentiality.",
  },
  {
    q: "Can I consult a specialist online?",
    a: "Yes. Many specialists, including cardiologists, neurologists, dermatologists, orthopedic specialists, and oncologists, may offer telemedicine consultations when appropriate.",
  },
  {
    q: "How can I verify an online doctor's credentials?",
    a: "Check the information provided by the telemedicine platform regarding the doctor's qualifications, specialty, clinical experience, and professional background.",
  },
  {
    q: "Are online doctors suitable for second opinions?",
    a: "Yes. Telemedicine makes it easier to obtain medical second opinions by allowing specialists to review medical records, imaging studies, and treatment plans.",
  },
  {
    q: "When should I choose an in-person doctor instead?",
    a: "You should seek in-person care for emergencies, severe symptoms, conditions requiring physical examination, diagnostic procedures, or treatments that cannot be performed remotely.",
  },
  {
    q: "How do I choose the best online doctor?",
    a: "Choose a healthcare professional based on qualifications, relevant experience, specialty, communication quality, privacy standards, and the reputation of the telemedicine provider.",
  },
];

const RELATED_ARTICLES = [
  {
    href: "/what-is-telemedicine",
    img: telemedicine,
    alt: "Doctor reviewing patient chart",
    title:
      "What Is Telemedicine? Complete Guide to Meaning, Benefits, Types & How It Works",
    desc: "Telemedicine refers to the delivery of healthcare services remotely through digital technologies, including video consultations, phone calls, mobile applications, and secure online platforms.",
    time: "6 min read",
  },
  {
    href: "/telemedicine-vs-in-person-doctor-visits",
    img: telemedicineVsInPersonDoctorVisits,
    alt: "Virtual doctor vs teleconsultation doctor  ",
    title:
      "Telemedicine vs In-Person Doctor Visits: Benefits, Differences & Limitations",
    desc: "Quick Answer: Is Telemedicine Better Than an In-Person Doctor Visit?",
    time: "7 min read",
  },
  {
    href: "/top-telemedicine-platforms-providers",
    img: topTelemedicinePlatforms,
    alt: "Top Telemedicine Platforms & Providers",
    desc: "Quick Answer: What Are the Best Telemedicine Platforms?",
    title:
      "Top Telemedicine Platforms & Providers: Features, Benefits & How to Choose",
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

export default function OnlineDoctorsRealDoctors() {
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
      <SEO title="Are Online Doctors Real Doctors? | Telemedicine Facts" description="Learn the truth about online doctors and telemedicine." keywords="Are online doctors real doctors" url="https://humancareconnect.co/are-online-doctors-real-doctors" />
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
                  <span className="badge">Telemedicine</span>
                  <span className="badge outline">Patient Guide</span>
                </div>
                <h1 className="article-title">
                  Are Online Doctors Real Doctors? Understanding Credentials &
                  Quality of Care
                </h1>
              </div>

              <figure className="hero-media">
                <img
                  src={realDoctors}
                  alt="Licensed doctor speaking with a patient during a secure video consultation"
                  loading="eager"
                />
                {/* <figcaption>
                  A licensed physician meeting with a patient through a secure
                  telemedicine platform.
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
                    Quick Answer: Are Online Doctors Real Doctors?
                    <HeadingLink id="definition" />
                  </h2>
                  <p>
                    Yes, online doctors can be real, qualified healthcare
                    professionals. Telemedicine consultations are provided by
                    licensed and appropriately qualified doctors and healthcare
                    professionals who offer medical services remotely through
                    secure digital platforms.
                  </p>
                  <p>
                    However, the qualifications, licensing requirements, and
                    scope of practice depend on the country, region, and the
                    healthcare provider. Patients should always choose reputable
                    telemedicine services that clearly provide information about
                    their doctors' credentials, specialties, and professional
                    experience.
                  </p>
                </section>

                {/* intro */}
                <section id="introduction">
                  <h2>
                    Introduction <HeadingLink id="introduction" />
                  </h2>
                  <p>
                    The rise of telemedicine has changed how people access
                    healthcare. Patients can now speak with doctors through
                    video calls, phone consultations, and secure digital
                    platforms without visiting a hospital or clinic.
                  </p>
                  <p>
                    Despite the convenience of virtual healthcare, many patients
                    have concerns:
                  </p>
                  <ul>
                    <li>Are online doctors actually licensed physicians?</li>
                    <li>
                      Can a doctor diagnose me without seeing me in person?
                    </li>
                    <li>
                      Is the quality of online healthcare the same as a clinic
                      visit?
                    </li>
                    <li>
                      How do I know if a telemedicine doctor is qualified?
                    </li>
                  </ul>
                  <p>
                    These questions are natural because healthcare decisions
                    require trust and confidence.
                  </p>
                  <p>
                    The truth is that telemedicine does not create a different
                    type of doctor. It changes the method of communication. A
                    qualified doctor providing a virtual consultation is still
                    the same medical professional who may also practice in
                    hospitals, clinics, or private practices.
                  </p>
                </section>

                <section id="licensed">
                  <h2>
                    Are Online Doctors Licensed Healthcare Professionals?
                    <HeadingLink id="licensed" />
                  </h2>
                  <p>
                    In reputable telemedicine services, doctors are required to
                    meet the same professional standards expected in traditional
                    healthcare.
                  </p>
                  <p>They generally have:</p>
                  <ul>
                    <li>• Medical degrees and professional qualifications</li>
                    <li>• Required training and clinical experience</li>
                    <li>
                      • Licensing or registration according to applicable laws
                      and regulations
                    </li>
                    <li>• Expertise in specific areas of medicine</li>
                  </ul>
                  <p>
                    A virtual consultation does not reduce a doctor's education,
                    training, or professional responsibility.
                  </p>
                </section>

                <section id="credentials">
                  <h2>
                    How Are Online Doctor Credentials Verified?
                    <HeadingLink id="credentials" />
                  </h2>
                  <p>
                    Trusted telemedicine providers usually have processes to
                    confirm the qualifications of healthcare professionals
                    working on their platforms.
                  </p>
                  <p>This may include reviewing:</p>

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
                            d="M12 3l8 4-8 4-8-4 8-4z"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M4 11v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                        </svg>
                      </div>
                      <h4>Medical Education</h4>
                      <p>
                        Medical education and degrees earned by the healthcare
                        professional.
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
                            y="4"
                            width="16"
                            height="16"
                            rx="2"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                          <path
                            d="M8 12h8M8 16h5"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                      <h4>Licenses & Registrations</h4>
                      <p>
                        Professional licenses or registrations where applicable,
                        according to regional regulations.
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
                      <h4>Clinical Experience</h4>
                      <p>
                        Years of hands-on clinical experience treating patients.
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
                            d="M12 21s-7.5-4.6-9.5-9.3C.9 8 2.7 4.3 6.4 4.3c2 0 3.6 1.1 4.6 2.5 1-1.4 2.6-2.5 4.6-2.5 3.7 0 5.5 3.7 3.9 7.4C19.5 16.4 12 21 12 21z"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                        </svg>
                      </div>
                      <h4>Specialty Training</h4>
                      <p>
                        Specialty training and certifications relevant to the
                        doctor's field.
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
                      <h4>Professional Background</h4>
                      <p>
                        Overall professional background and credentials of the
                        healthcare provider.
                      </p>
                    </div>
                  </div>

                  <p>
                    Patients can also check available information provided by
                    the healthcare platform about the doctor's expertise and
                    experience.
                  </p>
                </section>

                <section id="quality-of-care">
                  <h2>
                    Do Online Doctors Provide the Same Quality of Care?
                    <HeadingLink id="quality-of-care" />
                  </h2>
                  <p>
                    The quality of healthcare depends on factors such as the
                    doctor's expertise, the accuracy of the medical information
                    available, and whether telemedicine is appropriate for the
                    medical situation.
                  </p>
                  <p>
                    For many non-emergency healthcare needs, online
                    consultations can provide effective access to medical
                    advice, follow-up care, chronic disease management, mental
                    health support, specialist opinions, and medical second
                    opinions.
                  </p>
                  <p>
                    However, telemedicine has limitations. Some conditions
                    require:
                  </p>
                  <ul>
                    <li>• A physical examination</li>
                    <li>• Laboratory testing</li>
                    <li>• Medical imaging</li>
                    <li>• Procedures or emergency treatment</li>
                  </ul>
                  <p>
                    In these situations, the doctor may recommend an in-person
                    appointment or emergency care.
                  </p>
                </section>

                <section id="what-can-help">
                  <h2>
                    What Can Online Doctors Help With?
                    <HeadingLink id="what-can-help" />
                  </h2>
                  <p>
                    Online doctors may assist with many healthcare needs,
                    including:
                  </p>

                  <div className="timeline">
                    <div className="t-step reveal">
                      <div className="t-num">1</div>
                      <div className="t-body">
                        <h4>General Medical Consultations</h4>
                        <p>Patients may discuss:</p>
                        <ul>
                          <li>• Common illnesses</li>
                          <li>• Mild symptoms</li>
                          <li>• General health questions</li>
                          <li>• Medication concerns</li>
                        </ul>
                      </div>
                    </div>

                    <div className="t-step reveal">
                      <div className="t-num">2</div>
                      <div className="t-body">
                        <h4>Chronic Disease Follow-Ups</h4>
                        <p>
                          Virtual healthcare can support ongoing management of
                          conditions such as:
                        </p>
                        <ul>
                          <li>• Diabetes</li>
                          <li>• High blood pressure</li>
                          <li>• Asthma</li>
                          <li>• Thyroid disorders</li>
                        </ul>
                      </div>
                    </div>

                    <div className="t-step reveal">
                      <div className="t-num">3</div>
                      <div className="t-body">
                        <h4>Specialist Consultations</h4>
                        <p>Patients may connect with specialists for:</p>
                        <ul>
                          <li>• Cardiology discussions</li>
                          <li>• Neurology consultations</li>
                          <li>• Orthopedic concerns</li>
                          <li>• Dermatology evaluations</li>
                          <li>• Oncology second opinions</li>
                        </ul>
                      </div>
                    </div>

                    <div className="t-step reveal">
                      <div className="t-num">4</div>
                      <div className="t-body">
                        <h4>Medical Second Opinions</h4>
                        <p>
                          Patients with complex diagnoses or major treatment
                          decisions may use telemedicine to obtain additional
                          expert opinions by sharing medical records, imaging
                          studies, and treatment history.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                <section id="safety">
                  <h2>
                    Are Online Doctors Safe and Reliable?
                    <HeadingLink id="safety" />
                  </h2>
                  <p>
                    Online doctors can be safe and reliable when patients use
                    trusted telemedicine providers.
                  </p>

                  <div className="callout tip reveal">
                    <div className="icon" aria-hidden="true"></div>
                    <div>
                      <h4>A reliable provider should offer:</h4>
                      <ul>
                        <li>• Qualified healthcare professionals</li>
                        <li>• Secure communication technology</li>
                        <li>• Patient privacy protections</li>
                        <li>• Clear information about services</li>
                        <li>• Transparent appointment processes</li>
                      </ul>
                      <p>
                        Patients should avoid unverified platforms that do not
                        provide clear information about healthcare professionals
                        or privacy practices.
                      </p>
                    </div>
                  </div>
                </section>

                <section id="choose-doctor">
                  <h2>
                    How to Choose a Trustworthy Online Doctor
                    <HeadingLink id="choose-doctor" />
                  </h2>
                  <p>
                    Choosing the right online doctor is essential for receiving
                    safe and reliable healthcare. Before booking a virtual
                    appointment, consider the following factors.
                  </p>

                  <div className="myth-grid">
                    <div className="myth-card fact reveal">
                      <span className="tag">
                        1. Verify Qualifications & Experience
                      </span>
                      <p>
                        Look for healthcare professionals whose qualifications,
                        training, experience, and areas of expertise are clearly
                        provided by the telemedicine platform, including medical
                        education, years of clinical experience, specialty, and
                        experience treating conditions similar to yours.
                      </p>
                    </div>

                    <div className="myth-card fact reveal">
                      <span className="tag">
                        2. Choose a Reputable Provider
                      </span>
                      <p>
                        A trusted telemedicine provider should offer clear
                        information about healthcare professionals, secure
                        communication systems, transparent consultation
                        processes, reliable patient support, and privacy
                        protections.
                      </p>
                    </div>

                    <div className="myth-card fact reveal">
                      <span className="tag">
                        3. Match the Doctor to Your Needs
                      </span>
                      <p>
                        Different medical concerns may require different
                        specialists — a dermatologist for skin concerns, a
                        cardiologist for heart-related discussions, an
                        endocrinologist for hormonal conditions, or an
                        oncologist for cancer-related second opinions.
                      </p>
                    </div>

                    <div className="myth-card fact reveal">
                      <span className="tag">
                        4. Prepare Your Medical Information
                      </span>
                      <p>
                        Doctors can provide better guidance when they understand
                        your complete health history. Keep ready previous
                        medical reports, blood test results, imaging studies,
                        current medications, and your questions.
                      </p>
                    </div>
                  </div>
                </section>

                <section id="red-flags">
                  <h2>
                    Red Flags to Avoid When Choosing an Online Doctor
                    <HeadingLink id="red-flags" />
                  </h2>
                  <p>Be cautious of healthcare services that:</p>
                  <ul>
                    <li>• Do not clearly explain doctor qualifications</li>
                    <li>• Promise guaranteed cures or unrealistic results</li>
                    <li>• Do not explain privacy or security practices</li>
                    <li>
                      • Offer consultations without understanding your medical
                      history
                    </li>
                    <li>• Provide unclear pricing or hidden charges</li>
                    <li>• Do not offer proper patient support</li>
                  </ul>
                  <p>
                    A trustworthy healthcare provider focuses on transparency,
                    patient safety, and appropriate medical guidance.
                  </p>
                </section>

                <section id="comparison">
                  <h2>
                    Online Doctors vs In-Person Doctors
                    <HeadingLink id="comparison" />
                  </h2>

                  <div className="table-scroll">
                    <table className="compare">
                      <thead>
                        <tr>
                          <th>Factor</th>
                          <th>Online Doctors</th>
                          <th>In-Person Doctors</th>
                        </tr>
                      </thead>

                      <tbody>
                        <tr>
                          <th scope="row">Medical Qualifications</th>
                          <td className="good">
                            Same professional qualifications and licensing
                            requirements according to applicable regulations
                          </td>
                          <td className="good">Same professional standards</td>
                        </tr>

                        <tr>
                          <th scope="row">Consultation Method</th>
                          <td>
                            Video calls, phone calls, or secure digital
                            platforms
                          </td>
                          <td>Face-to-face clinic or hospital visits</td>
                        </tr>

                        <tr>
                          <th scope="row">Physical Examination</th>
                          <td>Limited</td>
                          <td className="good">
                            Complete hands-on examination
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">Convenience</th>
                          <td className="good">High, no travel required</td>
                          <td>Requires travel and waiting time</td>
                        </tr>

                        <tr>
                          <th scope="row">Follow-Up Care</th>
                          <td className="good">
                            Convenient for many situations
                          </td>
                          <td>Requires another visit</td>
                        </tr>

                        <tr>
                          <th scope="row">Emergency Care</th>
                          <td>Not suitable</td>
                          <td className="good">Essential for emergencies</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p>
                    The main difference is not the doctor's knowledge—it is the
                    way the consultation takes place.
                  </p>
                </section>

                <section id="myths">
                  <h2>
                    Common Myths About Online Doctors
                    <HeadingLink id="myths" />
                  </h2>

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
                            Online doctors are not real doctors
                          </th>
                          <td className="good">
                            Qualified online doctors have the same medical
                            education and professional responsibilities as
                            doctors seen in clinics, subject to applicable
                            regulations
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">Online healthcare is low quality</th>
                          <td className="good">
                            Telemedicine can provide effective care for many
                            non-emergency concerns, follow-ups, specialist
                            consultations, and second opinions
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">
                            Doctors cannot understand my condition online
                          </th>
                          <td className="good">
                            Doctors can evaluate many concerns through
                            discussion, medical history, and review of reports,
                            although some situations require physical
                            examinations or tests
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">Online consultations are unsafe</th>
                          <td className="good">
                            Trusted telemedicine providers use security measures
                            to protect patient information and confidentiality
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">
                            Telemedicine can replace every hospital visit
                          </th>
                          <td>
                            Emergency care, procedures, and many physical
                            examinations still require in-person treatment
                          </td>
                        </tr>
                      </tbody>
                    </table>
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
                        Online doctors can be qualified healthcare professionals
                        with the same medical training and responsibilities as
                        traditional doctors.
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
                        The main difference between online and in-person care is
                        the method of communication, not the doctor's expertise.
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
                        Telemedicine can provide effective care for many
                        non-emergency concerns, specialist consultations,
                        follow-up care, and medical second opinions.
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
                        Patients should choose trusted telemedicine providers
                        that prioritize qualified doctors, privacy, security,
                        and transparent healthcare practices.
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
                        Some medical conditions still require physical
                        examinations, testing, or emergency treatment.
                      </li>
                    </ul>
                  </div>
                </section>

                <section id="why-choose-us">
                  <h2>
                    Connect with Qualified Healthcare Professionals Through
                    Humancare Connect <HeadingLink id="why-choose-us" />
                  </h2>

                  <p>
                    At Humancare Connect, we believe quality healthcare should
                    be accessible, trustworthy, and convenient. Our telemedicine
                    services connect patients with experienced healthcare
                    professionals for online consultations, specialist advice,
                    follow-up care, and medical second opinions.
                  </p>
                  <p>
                    Receive expert medical guidance from the comfort of your
                    home while maintaining privacy, security, and a
                    patient-focused healthcare experience.
                    <br />
                    <br />
                    Book your online consultation today and connect with trusted
                    healthcare professionals wherever you are.
                  </p>
                </section>
              </article>
            </div>

            {/* CTA */}
            <section className="cta-section reveal">
              <h2>Want to Consult a Verified, Qualified Doctor Online?</h2>
              <p>
                Connect with experienced, credentialed doctors and specialists
                through Humancare Connect's online doctor consultation services.
                Whether you need guidance for a health concern, a specialist
                opinion, follow-up care, or a medical second opinion, we make
                expert healthcare more accessible and convenient.
              </p>
              <p>
                <strong>
                  Book your online doctor consultation today and receive trusted
                  healthcare guidance from anywhere in the world.
                </strong>
              </p>
              <div className="cta-buttons">
                <a href="/appointment-booking" className="btn btn-primary">
                  Book Online Consultation
                </a>
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
