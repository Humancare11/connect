import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import "./telemedicine.css";
import doctorConsultation from "../../assets/BlogImages/doctor-consultation.webp";
import telemedicine from "../../assets/BlogImages/telemedicine.webp";
import topTelemedicinePlatforms from "../../assets/BlogImages/top-telemedicine-platforms.webp";
import telemedicineVsInPersonDoctorVisits from "../../assets/BlogImages/telemedicine-vs-in-person-doctor-visits.webp";
import SEO from "../../components/Seo";
const PAGE_TITLE =
  " Online Doctor Consultation: Benefits, Process & When to Choose It";
const PAGE_DESCRIPTION =
  "Learn how online doctor consultations work, their benefits, limitations, costs, and when virtual care is the right choice for your healthcare needs.";
const PAGE_URL = "https://humancareconnect.co/blog/online-doctor-consultation";
const PAGE_IMAGE = doctorConsultation;

const TOC_ITEMS = [
  { id: "definition", label: "Online Doctor Consultation" },
  { id: "introduction", label: "Introduction" },
  { id: "how-it-works", label: "How Online Doctor Consultation Work?" },
  { id: "benefits", label: "Benefits of Online Doctor Consultation" },
  {
    id: "when",
    label: "When Should You Choose an Online Doctor Consultation?",
  },
  {
    id: "when-not",
    label: "When Is an Online Doctor Consultation Not the Right Choice?",
  },
  { id: "comparison", label: "Telemedicine vs in-person care" },

  { id: "safety", label: "Safety & limitations" },
  { id: "cost", label: "Cost & insurance" },
  { id: "choose-online-doctor", label: "How to Choose the Best Online Doctor" },
  { id: "faq", label: "FAQs" },
  { id: "key-takeaways", label: "Key Takeaways" },
  { id: "Why-choose-us", label: "Why Choose Us?" },
];

const FAQ_ITEMS = [
  {
    q: "What is an online doctor consultation?",
    a: "An online doctor consultation allows patients to speak with healthcare professionals remotely through video calls, phone calls, or secure digital platforms.",
  },
  {
    q: "How does an online doctor consultation work?",
    a: "Patients book an appointment, share relevant health information, connect with the doctor virtually, discuss symptoms, and receive medical guidance.",
  },
  {
    q: "Are online doctor consultations effective?",
    a: "Yes. They can be effective for many non-emergency concerns, follow-ups, chronic disease management, specialist advice, and medical second opinions.",
  },
  {
    q: "Can doctors diagnose health problems online?",
    a: "Doctors can evaluate many conditions based on symptoms, medical history, and reports, but some cases require physical examinations or additional tests.",
  },
  {
    q: "Can I get a prescription during an online consultation?",
    a: "Depending on local laws and your medical situation, healthcare professionals may prescribe certain medications where legally permitted.",
  },
  {
    q: "What conditions can be treated through online consultations?",
    a: "They may be useful for common illnesses, skin concerns, mental health support, chronic disease follow-ups, medication reviews, and specialist discussions.",
  },
  {
    q: "Can I consult a specialist online?",
    a: "Yes. Many specialties, including cardiology, oncology, neurology, orthopedics, and dermatology, may offer virtual consultations where appropriate.",
  },
  {
    q: "Are online doctors real doctors?",
    a: "Online consultations can be provided by qualified and licensed healthcare professionals according to applicable regulations.",
  },
  {
    q: "Are online consultations private?",
    a: "Trusted telemedicine platforms use security measures designed to protect patient information and confidentiality.",
  },
  {
    q: "What technology do I need for an online appointment?",
    a: "You usually need a smartphone, tablet, or computer, a stable internet connection, and a camera and microphone for video consultations.",
  },
  {
    q: "Can international patients use online doctor consultation services?",
    a: "Yes. International patients can discuss reports, seek specialist opinions, and understand treatment options remotely, depending on applicable regulations.",
  },
  {
    q: "How much does an online doctor consultation cost?",
    a: "Costs vary based on the healthcare provider, doctor specialty, consultation type, and location.",
  },
  {
    q: "When should I choose an online doctor consultation?",
    a: "Virtual care may be suitable for non-emergency symptoms, follow-ups, reviewing test results, medication discussions, and obtaining second opinions.",
  },
  {
    q: "When should I avoid online doctor consultations?",
    a: "Avoid relying on online consultations for emergencies such as chest pain, breathing difficulty, severe injuries, or symptoms of stroke.",
  },
  {
    q: "How should I prepare for my online doctor appointment?",
    a: "Keep your medical records, medication list, previous reports, and questions ready, and ensure your device and internet connection are working properly.",
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

export default function OnlineDoctorConsultation() {
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
      <SEO title="Online Doctor Consultation Guide | Virtual Healthcare Benefits" description="Learn about online doctor consultation and virtual healthcare benefits." keywords="Online doctor consultation guide" url="https://humancareconnect.co/online-doctor-consultation-guide" />
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
                  Online Doctor Consultation: Benefits, Process & When to Choose
                  Virtual Care
                </h1>
                {/* <p className="hero-dek">
                  Everything you need to know about virtual healthcare —
                  explained clearly, reviewed by a licensed physician, and
                  grounded in how care actually works at Humancare Connect.
                </p> */}
              </div>

              <figure className="hero-media">
                <img
                  src={doctorConsultation}
                  alt="Patient waiting in line to consult doctor vs Patient having a video consultation with a doctor on a laptop from home"
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
                    What Is an Online Doctor Consultation? (Quick Answer)
                    <HeadingLink id="definition" />
                  </h2>
                  <p>
                    An online doctor consultation is a virtual healthcare
                    appointment where patients connect with doctors or
                    specialists through video calls, phone calls, or secure
                    digital platforms. It allows patients to discuss symptoms,
                    share medical reports, receive professional medical
                    guidance, and understand the next steps in their care
                    without visiting a clinic or hospital in person.
                  </p>
                  <p>
                    Online consultations are commonly used for general health
                    concerns, specialist advice, chronic disease follow-ups,
                    mental health support, and medical second opinions.
                  </p>
                </section>
                {/* intro */}
                <section id="introduction">
                  <h2>
                    Introduction <HeadingLink id="introduction" />
                  </h2>
                  <p>
                    Healthcare has become more accessible with the rise of
                    digital technology. Patients no longer need to travel long
                    distances or wait for hours in a clinic for every medical
                    concern.
                  </p>
                  <p>
                    An online doctor consultation provides a convenient way to
                    connect with healthcare professionals from home. Whether you
                    need advice for a new health concern, a follow-up after
                    treatment, or an expert second opinion, virtual care can
                    make healthcare faster and easier to access.
                  </p>
                  <p>However, many patients still have important questions:</p>
                  <ul>
                    <li>Is an online doctor consultation effective?</li>
                    <li>What happens during a virtual appointment?</li>
                    <li>Can a doctor diagnose a condition online?</li>
                    <li>
                      When should I choose virtual care instead of visiting a
                      hospital?
                    </li>
                  </ul>
                  <p>
                    This guide explains everything you need to know before
                    booking an online doctor consultation.
                  </p>
                </section>

                {/* Online Doctor Consultation  */}
                <section id="how-it-works">
                  <h2>
                    How Does an Online Doctor Consultation Work?
                    <HeadingLink id="how-it-works" />
                  </h2>
                  <p>
                    The process of an online consultation is simple and
                    patient-friendly.
                  </p>
                  <div className="timeline">
                    <div className="t-step reveal">
                      <div className="t-num">1</div>
                      <div className="t-body">
                        <h4>Book Your Appointment</h4>

                        <p>
                          Patients choose a doctor or specialist and schedule a
                          convenient appointment through a secure telemedicine
                          platform.
                        </p>

                        <p>During booking, you may provide:</p>

                        <ul>
                          <li>• Basic health information</li>
                          <li>• Reason for consultation</li>
                          <li>• Previous medical history</li>
                          <li>• Preferred specialty or doctor</li>
                        </ul>
                      </div>
                    </div>

                    <div className="t-step reveal">
                      <div className="t-num">2</div>
                      <div className="t-body">
                        <h4>Prepare Your Medical Records</h4>

                        <p>
                          Before your appointment, keep your relevant medical
                          documents ready so the doctor can better understand
                          your health concerns.
                        </p>

                        <p>This may include:</p>

                        <ul>
                          <li>• Previous prescriptions</li>
                          <li>• Blood test reports</li>
                          <li>• X-rays, CT scans, or MRI reports</li>
                          <li>• Current medication list</li>
                          <li>• Details of existing medical conditions</li>
                        </ul>

                        <p>
                          Having complete information helps the doctor
                          understand your health concerns better.
                        </p>
                      </div>
                    </div>

                    <div className="t-step reveal">
                      <div className="t-num">3</div>
                      <div className="t-body">
                        <h4>Meet the Doctor Virtually</h4>

                        <p>
                          At the scheduled time, you can connect with the doctor
                          through a secure telemedicine platform using your
                          preferred consultation method.
                        </p>

                        <p>You can connect through:</p>

                        <ul>
                          <li>• Video consultation</li>
                          <li>• Phone consultation</li>
                          <li>• Secure online platform</li>
                        </ul>

                        <p>During the appointment, the doctor may ask about:</p>

                        <ul>
                          <li>• Your symptoms</li>
                          <li>• Duration and severity of symptoms</li>
                          <li>• Medical history</li>
                          <li>• Current medications</li>
                          <li>• Previous treatments</li>
                        </ul>

                        <p>
                          The doctor will then provide medical guidance and
                          recommend appropriate next steps.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
                {/* Benefits */}
                <section id="benefits">
                  <h2>
                    Benefits of Using Telemedicine Platforms{" "}
                    <HeadingLink id="benefits" />
                  </h2>

                  <p>
                    Telemedicine platforms make healthcare more accessible by
                    reducing travel, improving convenience, and connecting
                    patients with qualified healthcare professionals from
                    virtually anywhere.
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
                      <h4>Convenient Healthcare Access</h4>
                      <p>
                        Patients can receive medical guidance from the comfort
                        of their home without unnecessary travel or long waiting
                        times, making healthcare more convenient and accessible.
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
                      <h4>Faster Access to Specialists</h4>
                      <p>
                        Telemedicine can make it easier to connect with
                        specialists who may not be available locally, helping
                        patients receive expert medical guidance more quickly.
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
                      <h4>Better Follow-Up Care</h4>
                      <p>
                        Patients with ongoing health concerns can maintain
                        regular communication with healthcare professionals
                        through virtual follow-up appointments, supporting
                        continuity of care.
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
                      <h4>Improved Access for International Patients</h4>
                      <p>
                        Online healthcare platforms reduce geographical
                        barriers, allowing international patients to seek
                        specialist opinions, review medical records, and discuss
                        treatment options remotely.
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
                      <h4>Cost and Time Savings</h4>
                      <p>
                        By reducing travel requirements and improving
                        convenience, telemedicine can help patients save
                        valuable time and reduce additional expenses associated
                        with clinic visits.
                      </p>
                    </div>
                  </div>
                </section>
                <section id="when">
                  <h2>
                    When Should You Choose an Online Doctor Consultation?{" "}
                    <HeadingLink id="when" />
                  </h2>

                  <p>Virtual care may be suitable for:</p>
                  <ul>
                    <li>• Mild illnesses and common symptoms</li>
                    <li>• Follow-up appointments</li>
                    <li>• Chronic disease management</li>
                    <li>• Mental health consultations</li>
                    <li>• Skin concerns that can be visually assessed</li>
                    <li>• Reviewing test results</li>
                    <li>• Medication discussions</li>
                    <li>• Specialist consultations</li>
                    <li>• Medical second opinions</li>
                  </ul>
                </section>

                {/* FIX: this section previously duplicated the "when" section
                    above word-for-word. It's meant to cover the opposite
                    case — when NOT to rely on a virtual visit. */}
                <section id="when-not">
                  <h2>
                    When Is an Online Doctor Consultation Not the Right Choice?{" "}
                    <HeadingLink id="when-not" />
                  </h2>

                  <p>An in-person visit is the safer choice for:</p>
                  <ul>
                    <li>
                      • Medical emergencies (chest pain, difficulty breathing,
                      severe bleeding, stroke symptoms)
                    </li>
                    <li>• Severe injuries or suspected fractures</li>
                    <li>
                      • Conditions requiring a hands-on physical examination
                    </li>
                    <li>
                      • Cases needing imaging, lab work, or in-person testing
                    </li>
                    <li>
                      • Symptoms that are worsening rapidly or unclear over
                      video
                    </li>
                    <li>
                      • Situations requiring immediate procedures or treatment
                    </li>
                  </ul>
                  <p>
                    If you're experiencing a life-threatening emergency, call
                    your local emergency number instead of booking a virtual
                    visit.
                  </p>
                </section>

                <section id="comparison">
                  <h2>
                    Online Doctor Consultation vs In-Person Doctor Visit{" "}
                    <HeadingLink id="comparison" />
                  </h2>

                  <p>
                    Both online doctor consultations and in-person doctor visits
                    play important roles in healthcare. The most appropriate
                    option depends on your medical condition, symptoms, and
                    whether a physical examination or emergency care is
                    required.
                  </p>

                  <div className="table-scroll">
                    <table className="compare">
                      <thead>
                        <tr>
                          <th>Feature</th>
                          <th>Online Doctor Consultation</th>
                          <th>In-Person Doctor Visit</th>
                        </tr>
                      </thead>

                      <tbody>
                        <tr>
                          <th scope="row">Convenience</th>
                          <td className="good">Consult from home</td>
                          <td>Requires clinic or hospital visit</td>
                        </tr>

                        <tr>
                          <th scope="row">Access to Specialists</th>
                          <td className="good">Wider access to specialists</td>
                          <td>Usually limited by location</td>
                        </tr>

                        <tr>
                          <th scope="row">Travel</th>
                          <td className="good">No travel required</td>
                          <td>Travel required</td>
                        </tr>

                        <tr>
                          <th scope="row">Waiting Time</th>
                          <td className="good">Often shorter</td>
                          <td>May be longer</td>
                        </tr>

                        <tr>
                          <th scope="row">Follow-up Care</th>
                          <td className="good">More convenient</td>
                          <td>Requires another visit</td>
                        </tr>

                        <tr>
                          <th scope="row">Physical Examination</th>
                          <td>Limited</td>
                          <td className="good">Complete examination</td>
                        </tr>

                        <tr>
                          <th scope="row">Emergency Treatment</th>
                          <td>Not suitable</td>
                          <td className="good">Required for emergencies</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p>
                    Both methods are valuable and often work together to provide
                    complete healthcare.
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

                <section id="choose-online-doctor">
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
                    {/* FIX: removed a stray <HeadingLink id="cost" /> that was
                        sitting here — it pointed at the "cost" section's
                        anchor (a duplicate/wrong id) and had no reason to be
                        inside the takeaway box at all. */}
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
                        Online doctor consultations allow patients to receive
                        healthcare remotely.
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
                        They provide convenience, faster access, and easier
                        specialist consultations.
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
                        Virtual care is useful for many non-emergency concerns,
                        chronic disease follow-ups, and second opinions.
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
                        examinations need in-person medical care.
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
                        Choosing a trusted telemedicine provider helps ensure a
                        safe and effective healthcare experience.
                      </li>
                    </ul>
                  </div>
                </section>

                <section id="why-choose-us">
                  <h2>
                    Why Choose Humancare Connect for Online Doctor
                    Consultations? <HeadingLink id="why" />
                  </h2>

                  <p>
                    Access expert healthcare from the comfort of your home with
                    Humancare Connect. Connect with experienced doctors and
                    specialists, discuss your health concerns, review medical
                    reports, and receive professional guidance without
                    unnecessary travel.
                  </p>
                  <p>
                    Whether you need a routine consultation, specialist advice,
                    or a medical second opinion, Humancare Connect helps make
                    quality healthcare more accessible.
                    <br />
                    <br />
                    Book your online doctor consultation today and take the next
                    step toward convenient, patient-focused healthcare.
                  </p>
                </section>
              </article>
            </div>

            {/* CTA */}
            <section className="cta-section reveal">
              <h2>Need Expert Medical Advice Without Leaving Your Home?</h2>
              <p>
                Connect with experienced doctors and specialists through
                Humancare Connect’s online doctor consultation services. Whether
                you need guidance for a health concern, a specialist opinion,
                follow-up care, or a medical second opinion, we make expert
                healthcare more accessible and convenient.
              </p>
              <p>
                <strong>
                  {" "}
                  Book your online doctor consultation today and receive trusted
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
