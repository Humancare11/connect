import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import "./telemedicine.css";
import telemedicineAppointment from "../../assets/BlogImages/telemedicine-appointment.webp";

import telemedicine from "../../assets/BlogImages/telemedicine.webp";
import topTelemedicinePlatforms from "../../assets/BlogImages/top-telemedicine-platforms.webp";
import telemedicineVsInPersonDoctorVisits from "../../assets/BlogImages/telemedicine-vs-in-person-doctor-visits.webp";

const PAGE_TITLE =
  "How Does a Telemedicine Appointment Work? Step-by-Step Guide";
const PAGE_DESCRIPTION =
  "Learn how a telemedicine appointment works, what happens before, during, and after your online doctor consultation, and how to prepare for a successful virtual visit.";
const PAGE_URL =
  "https://humancareconnect.co/blog/how-does-a-telemedicine-appointment-work";
const PAGE_IMAGE = telemedicineAppointment;

const TOC_ITEMS = [
  {
    id: "definition",
    label: "Quick Answer ",
  },
  { id: "introduction", label: "Introduction" },
  { id: "before-your-appointment", label: "Before Telemedicine Appointment" },
  {
    id: "common-situations",
    label: "Where Telemedicine Appointments Are Helpful",
  },
  { id: "benefits", label: "Benefits of Telemedicine Appointments" },
  { id: "who-should-consider", label: " Who Should Consider an Appointment?" },
  { id: "not-appropriate", label: "When it is Not Appropriate?" },
  { id: "emergency-care", label: "Emergency Situations" },
  { id: "privacy-safety", label: "Safety and Privacy" },
  { id: "costs", label: "Telemedicine Appointment Costs" },
  { id: "myths-vs-facts", label: "Myths vs Facts" },
  { id: "future", label: "Future of Telemedicine" },
  { id: "why-humancare-connect", label: "Why Choose Us" },
  { id: "faq", label: "FAQs" },
  { id: "key-takeaways", label: "Key Takeaways" },
];

const FAQ_ITEMS = [
  {
    q: "What is a telemedicine appointment?",
    a: "A telemedicine appointment is a virtual healthcare consultation where patients communicate with doctors or healthcare professionals using video calls, phone calls, or secure digital platforms. It allows patients to receive medical guidance without visiting a clinic or hospital physically.",
  },
  {
    q: "How long does a telemedicine appointment usually take?",
    a: "The duration of a telemedicine appointment depends on the healthcare concern, the complexity of the case, and the healthcare provider. Many virtual consultations may last anywhere from a few minutes to longer discussions for complex medical issues or specialist opinions.",
  },
  {
    q: "What should I do before my first telemedicine appointment?",
    a: "Before your appointment, write down your symptoms and health concerns, prepare a list of questions for the doctor, keep your medications available, collect previous medical records, reports, and imaging studies, test your internet connection, camera, and microphone, and choose a quiet and private place for the consultation. Good preparation helps make the appointment more productive.",
  },
  {
    q: "What happens during a telemedicine appointment?",
    a: "During a telemedicine appointment, the doctor reviews your symptoms, medical history, medications, and available reports. The healthcare professional may ask detailed questions, discuss possible causes of your concerns, recommend further testing if needed, and provide treatment guidance or next steps.",
  },
  {
    q: "Can a doctor diagnose a medical condition during an online appointment?",
    a: "In many situations, healthcare professionals can assess symptoms and review medical information during a virtual consultation. However, some conditions require physical examinations, laboratory tests, imaging studies, or additional procedures before a diagnosis can be confirmed.",
  },
  {
    q: "Can doctors prescribe medication through telemedicine?",
    a: "Depending on local laws, regulations, and the patient's clinical situation, healthcare professionals may prescribe certain medications during telemedicine appointments where legally allowed.",
  },
  {
    q: "Are telemedicine appointments private and secure?",
    a: "Yes, telemedicine appointments can be private and secure when provided through trusted healthcare platforms that use appropriate security measures and follow applicable healthcare privacy requirements. Patients should also protect their privacy by using secure internet connections and attending consultations from a private environment.",
  },
  {
    q: "What technology do I need for a telemedicine visit?",
    a: "Most telemedicine appointments require a smartphone, tablet, laptop, or desktop computer, a working camera and microphone for video consultations, a stable internet connection, and access to the telemedicine platform or application.",
  },
  {
    q: "Can I use telemedicine for specialist consultations?",
    a: "Yes. Many specialists provide telemedicine consultations, including specialists in cardiology, oncology, neurology, orthopedics, dermatology, and other fields where virtual care is appropriate.",
  },
  {
    q: "Can I get a second opinion through telemedicine?",
    a: "Yes. Telemedicine allows patients to connect with specialists, share diagnostic reports, discuss treatment plans, and receive expert second opinions without unnecessary travel. This can be especially helpful for complex conditions, major surgeries, or cancer treatment decisions.",
  },
  {
    q: "Are telemedicine appointments suitable for elderly patients?",
    a: "Yes. Telemedicine can be very beneficial for elderly patients because it reduces travel, minimizes physical strain, and makes regular follow-up appointments more convenient. Family members or caregivers can also assist older adults during virtual consultations when needed.",
  },
  {
    q: "Can international patients book telemedicine appointments?",
    a: "Yes. International patients can use telemedicine to discuss health concerns, review medical reports, obtain specialist opinions, and understand possible treatment options. Service availability depends on local regulations and healthcare provider capabilities.",
  },
  {
    q: "How much does an online doctor appointment cost?",
    a: "The cost varies based on the doctor's specialty, the country or region, the complexity of the consultation, and the healthcare provider's pricing. Some insurance plans may cover telemedicine services depending on applicable policies and regulations.",
  },
  {
    q: "What conditions can be treated during a telemedicine appointment?",
    a: "Many non-emergency conditions can be addressed through telemedicine, including common illnesses, skin concerns, mental health consultations, chronic disease follow-ups, medication discussions, specialist consultations, and medical second opinions. However, some conditions require in-person examinations or emergency care.",
  },
  {
    q: "What are the advantages of a telemedicine appointment?",
    a: "The main benefits include convenience, reduced travel time, faster access to healthcare professionals, easier specialist access, better follow-up care, and improved access for international and rural patients.",
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
                  How Does a Telemedicine Appointment Work? A Complete
                  Step-by-Step Guide
                </h1>
              </div>

              <figure className="hero-media">
                <img
                  src={telemedicineAppointment}
                  alt="Process of Telemedicine Appointment Working"
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
                    Quick Answer: How Does a Telemedicine Appointment Work?
                    <HeadingLink id="definition" />
                  </h2>
                  <p>
                    A telemedicine appointment is a virtual healthcare visit
                    where patients communicate with doctors through video calls,
                    phone calls, or secure digital platforms. The process
                    usually includes scheduling an appointment, sharing medical
                    information, connecting with the healthcare professional
                    remotely, discussing symptoms and medical history, receiving
                    medical guidance, and arranging follow-up care if needed.
                  </p>
                  <p>
                    Telemedicine appointments make healthcare more convenient by
                    reducing the need for travel while allowing patients to
                    receive professional medical advice from their home or any
                    private location with an internet connection.
                  </p>
                </section>
                {/* intro */}
                <section id="introduction">
                  <h2>
                    Introduction <HeadingLink id="introduction" />
                  </h2>
                  <p>
                    Visiting a doctor traditionally involved traveling to a
                    clinic, waiting for your appointment, and having an
                    in-person consultation. While face-to-face medical care
                    remains essential in many situations, digital technology has
                    created a more convenient way to access healthcare —
                    telemedicine appointments.
                  </p>
                  <p>
                    Today, patients can speak with doctors, specialists, and
                    healthcare professionals through secure online platforms
                    without leaving their homes. This is particularly helpful
                    for people with busy schedules, elderly patients,
                    individuals living far from specialists, and international
                    patients seeking expert medical opinions.
                  </p>
                  <p>
                    However, many people who have never used virtual healthcare
                    often ask:
                  </p>
                  <ul>
                    <li>What happens during an online doctor appointment?</li>
                    <li>How should I prepare for a telemedicine visit?</li>
                    <li>What technology do I need?</li>
                    <li>
                      Will the doctor be able to understand my health concerns
                      remotely?
                    </li>
                    <li>Is a virtual appointment private and secure?</li>
                  </ul>

                  <p>
                    Understanding the telemedicine process can help patients
                    feel more comfortable and prepared before their first
                    virtual consultation.
                  </p>
                  <p>
                    This complete guide explains every stage of a telemedicine
                    appointment, from booking the consultation to receiving
                    follow-up care.
                  </p>
                </section>
                {/* step */}
                <section id="before-your-appointment">
                  <h2>
                    Before Your Telemedicine Appointment: Getting Started{" "}
                    <HeadingLink id="before-your-appointment" />
                  </h2>

                  <p>
                    A successful virtual healthcare visit begins before you
                    speak with a doctor. Proper preparation helps healthcare
                    professionals better understand your condition and provide
                    appropriate medical guidance.
                  </p>
                  <div className="timeline">
                    {/* Step 1 */}
                    <div className="t-step reveal">
                      <div className="t-num">1</div>
                      <div className="t-body">
                        <h4>Choose the Right Telemedicine Provider</h4>

                        <p>
                          Start by selecting a trusted telemedicine provider
                          that offers the healthcare services you need. A
                          reliable platform should make the consultation process
                          simple while maintaining high standards of patient
                          care.
                        </p>

                        <p>When comparing providers, consider:</p>

                        <ul>
                          <li>• Qualified healthcare professionals</li>
                          <li>• Availability of specialists</li>
                          <li>• Patient support services</li>
                          <li>• Privacy and data security practices</li>
                          <li>• Easy appointment scheduling</li>
                          <li>• Transparent consultation fees</li>
                        </ul>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="t-step reveal">
                      <div className="t-num">2</div>
                      <div className="t-body">
                        <h4>Schedule Your Online Doctor Appointment</h4>

                        <p>
                          After choosing a provider, book your appointment
                          through the available platform. Most providers allow
                          scheduling through a website, mobile app, patient
                          portal, or customer support.
                        </p>

                        <p>You may be asked to provide:</p>

                        <ul>
                          <li>• Your name and contact information</li>
                          <li>• Basic medical history</li>
                          <li>• Reason for the consultation</li>
                          <li>• Preferred doctor or specialty</li>
                          <li>• Preferred appointment date and time</li>
                        </ul>

                        <p>
                          Selecting the appropriate healthcare professional
                          helps ensure you receive guidance suited to your
                          medical needs.
                        </p>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="t-step reveal">
                      <div className="t-num">3</div>
                      <div className="t-body">
                        <h4>Prepare Your Medical Information</h4>

                        <p>
                          Before your appointment, gather important medical
                          documents so your healthcare professional can better
                          understand your health history and current condition.
                        </p>

                        <p>Prepare the following if available:</p>

                        <ul>
                          <li>• Previous medical records</li>
                          <li>• Blood test results</li>
                          <li>• X-rays, CT scans, or MRI reports</li>
                          <li>• Current medications</li>
                          <li>• Allergy information</li>
                          <li>• Previous treatments or surgeries</li>
                        </ul>

                        <p>
                          Complete medical records are especially valuable when
                          seeking specialist consultations or medical second
                          opinions.
                        </p>
                      </div>
                    </div>

                    {/* Step 4 */}
                    <div className="t-step reveal">
                      <div className="t-num">4</div>
                      <div className="t-body">
                        <h4>Prepare Your Technology and Environment</h4>

                        <p>
                          A successful telemedicine visit depends on having the
                          right technology and a comfortable environment before
                          your consultation begins.
                        </p>

                        <p>Before your appointment:</p>

                        <ul>
                          <li>
                            • Use a smartphone, tablet, laptop, or desktop
                            computer
                          </li>
                          <li>
                            • Ensure your camera and microphone work properly
                          </li>
                          <li>• Test your internet connection</li>
                          <li>
                            • Charge your device or keep it connected to power
                          </li>
                          <li>• Choose a quiet, private location</li>
                          <li>
                            • Ensure good lighting for video consultations
                          </li>
                        </ul>

                        <p>
                          Proper preparation helps create a smoother
                          consultation and improves communication with your
                          healthcare professional.
                        </p>
                      </div>
                    </div>

                    {/* Step 5 */}
                    <div className="t-step reveal">
                      <div className="t-num">5</div>
                      <div className="t-body">
                        <h4>Connect With Your Doctor Online</h4>

                        <p>
                          At your scheduled appointment time, join the
                          telemedicine platform using your preferred device.
                          Depending on the provider, consultations may be
                          conducted through different communication methods.
                        </p>

                        <p>Common consultation options include:</p>

                        <ul>
                          <li>
                            • Video consultations for face-to-face interaction
                          </li>
                          <li>
                            • Telephone consultations for suitable follow-up
                            care
                          </li>
                          <li>
                            • Secure messaging for non-emergency communication
                          </li>
                          <li>• Medical report and document sharing</li>
                        </ul>

                        <p>
                          During the consultation, your healthcare professional
                          will discuss your symptoms, review your medical
                          information, answer your questions, and recommend the
                          appropriate next steps based on your individual
                          healthcare needs.
                        </p>
                      </div>
                    </div>
                    {/* Step 6 */}
                    <div className="t-step reveal">
                      <div className="t-num">6</div>
                      <div className="t-body">
                        <h4>Discuss Your Symptoms and Medical History</h4>

                        <p>
                          During your consultation, your healthcare professional
                          will ask detailed questions to better understand your
                          condition and provide appropriate medical guidance.
                        </p>

                        <p>You may be asked about:</p>

                        <ul>
                          <li>• When your symptoms started</li>
                          <li>• How severe your symptoms are</li>
                          <li>• What makes your symptoms better or worse</li>
                          <li>• Previous medical conditions</li>
                          <li>• Current medications</li>
                          <li>• Allergies</li>
                          <li>• Family medical history</li>
                          <li>• Previous treatments or surgeries</li>
                        </ul>

                        <p>
                          Providing complete and accurate information helps your
                          healthcare professional understand your health
                          concerns and recommend appropriate next steps.
                        </p>
                      </div>
                    </div>

                    {/* Step 7 */}
                    <div className="t-step reveal">
                      <div className="t-num">7</div>
                      <div className="t-body">
                        <h4>Share Medical Reports and Diagnostic Results</h4>

                        <p>
                          Most telemedicine platforms allow patients to securely
                          upload medical documents before or during the
                          consultation, giving doctors important information for
                          evaluation.
                        </p>

                        <p>Documents may include:</p>

                        <ul>
                          <li>• Blood test reports</li>
                          <li>• X-rays</li>
                          <li>• MRI scans</li>
                          <li>• CT scan reports</li>
                          <li>• Pathology reports</li>
                          <li>• Previous prescriptions</li>
                          <li>• Hospital discharge summaries</li>
                        </ul>

                        <p>
                          Sharing complete medical records is especially
                          valuable for specialist consultations and medical
                          second opinions.
                        </p>
                      </div>
                    </div>

                    {/* Step 8 */}
                    <div className="t-step reveal">
                      <div className="t-num">8</div>
                      <div className="t-body">
                        <h4>Receive Doctor Evaluation and Medical Guidance</h4>

                        <p>
                          After reviewing your symptoms, medical history, and
                          available reports, your healthcare professional will
                          explain their assessment and discuss the most
                          appropriate recommendations.
                        </p>

                        <p>You may receive:</p>

                        <ul>
                          <li>• Possible causes of your symptoms</li>
                          <li>• Guidance for managing your condition</li>
                          <li>• Lifestyle recommendations where appropriate</li>
                          <li>• Advice on additional tests if needed</li>
                          <li>
                            • Recommendations for in-person care when necessary
                          </li>
                          <li>
                            • Prescriptions where permitted by applicable laws
                          </li>
                        </ul>

                        <p>
                          Some conditions require physical examinations,
                          laboratory tests, imaging, or medical procedures, and
                          your doctor may recommend an in-person visit when
                          additional evaluation is necessary.
                        </p>
                      </div>
                    </div>

                    {/* Step 9 */}
                    <div className="t-step reveal">
                      <div className="t-num">9</div>
                      <div className="t-body">
                        <h4>Review Your Treatment Plan and Next Steps</h4>

                        <p>
                          Before your consultation ends, your healthcare
                          professional will explain the next stage of your care
                          and answer any questions you may have.
                        </p>

                        <p>Your treatment plan may include:</p>

                        <ul>
                          <li>• Treatment recommendations</li>
                          <li>• Lifestyle and self-care guidance</li>
                          <li>• Recommended diagnostic tests</li>
                          <li>• Follow-up appointments</li>
                          <li>• Referrals to specialists when appropriate</li>
                        </ul>

                        <p>
                          Understanding your treatment plan helps you
                          confidently manage your health after the consultation.
                        </p>
                      </div>
                    </div>

                    {/* Step 10 */}
                    <div className="t-step reveal">
                      <div className="t-num">10</div>
                      <div className="t-body">
                        <h4>Attend Follow-Up Telemedicine Appointments</h4>

                        <p>
                          Healthcare often requires ongoing communication.
                          Follow-up virtual appointments help healthcare
                          professionals monitor your progress and make
                          adjustments when needed.
                        </p>

                        <p>Follow-up visits can help you:</p>

                        <ul>
                          <li>• Monitor recovery</li>
                          <li>• Discuss changes in symptoms</li>
                          <li>• Review test results</li>
                          <li>• Adjust treatment plans</li>
                          <li>• Manage long-term medical conditions</li>
                        </ul>

                        <p>
                          Regular follow-up appointments support continuity of
                          care while reducing unnecessary travel and making
                          healthcare more convenient.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Common Situations Where Telemedicine Appointments Are Helpful */}
                <section id="common-situations">
                  <h2>
                    Common Situations Where Telemedicine Appointments Are
                    Helpful <HeadingLink id="common-situations" />
                  </h2>

                  <p>
                    Telemedicine can be a convenient option for many
                    non-emergency healthcare needs, allowing patients to receive
                    timely medical guidance without unnecessary travel.
                  </p>

                  <div className="card-grid">
                    {/* Card 1 */}
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

                      <h4>General Health Concerns</h4>

                      <p>
                        Telemedicine is suitable for discussing many common
                        non-emergency medical concerns, including:
                      </p>

                      <ul>
                        <li>• Cold or flu symptoms</li>
                        <li>• Allergies</li>
                        <li>• Minor infections</li>
                        <li>• Digestive concerns</li>
                        <li>• Headaches</li>
                      </ul>
                    </div>

                    {/* Card 2 */}
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

                      <h4>Chronic Disease Follow-Ups</h4>

                      <p>
                        Virtual appointments can support ongoing monitoring and
                        management of long-term health conditions such as:
                      </p>

                      <ul>
                        <li>• Diabetes</li>
                        <li>• High blood pressure</li>
                        <li>• Asthma</li>
                        <li>• Thyroid disorders</li>
                      </ul>
                    </div>

                    {/* Card 3 */}
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

                      <h4>Specialist Consultations</h4>

                      <p>
                        Patients can connect with specialists across multiple
                        medical specialties, including:
                      </p>

                      <ul>
                        <li>• Cardiology</li>
                        <li>• Neurology</li>
                        <li>• Orthopedics</li>
                        <li>• Dermatology</li>
                        <li>• Oncology second opinions</li>
                      </ul>
                    </div>

                    {/* Card 4 */}
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

                      <h4>Reviewing Medical Reports</h4>

                      <p>
                        Telemedicine is an effective way to review medical
                        documents and discuss treatment progress, including:
                      </p>

                      <ul>
                        <li>• Blood test results</li>
                        <li>• Imaging reports</li>
                        <li>• Treatment progress</li>
                        <li>• Previous diagnoses</li>
                      </ul>
                    </div>
                  </div>
                </section>

                {/* Benefits of Telemedicine Appointments */}
                <section id="benefits">
                  <h2>
                    Benefits of Telemedicine Appointments{" "}
                    <HeadingLink id="benefits" />
                  </h2>

                  <p>
                    Telemedicine appointments make healthcare more convenient,
                    accessible, and efficient by allowing patients to connect
                    with qualified healthcare professionals without unnecessary
                    travel.
                  </p>

                  <div className="card-grid">
                    {/* Card 1 */}
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

                      <h4>Convenience and Comfort</h4>

                      <p>
                        Consult healthcare professionals from the comfort of
                        your home while avoiding:
                      </p>

                      <ul>
                        <li>• Long travel times</li>
                        <li>• Transportation difficulties</li>
                        <li>• Waiting rooms</li>
                        <li>• Time away from work or family</li>
                      </ul>
                    </div>

                    {/* Card 2 */}
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

                      <h4>Faster Access to Healthcare Professionals</h4>

                      <p>
                        Virtual appointments often provide quicker access to
                        medical guidance for:
                      </p>

                      <ul>
                        <li>• Minor health concerns</li>
                        <li>• Follow-up consultations</li>
                        <li>• Medication discussions</li>
                        <li>• Test report reviews</li>
                        <li>• Specialist consultations</li>
                      </ul>
                    </div>

                    {/* Card 3 */}
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

                      <h4>Access to Specialists</h4>

                      <p>
                        Connect with experienced specialists across multiple
                        medical fields, including:
                      </p>

                      <ul>
                        <li>• Cardiology</li>
                        <li>• Oncology</li>
                        <li>• Neurology</li>
                        <li>• Orthopedics</li>
                        <li>• Dermatology</li>
                        <li>• Gastroenterology</li>
                      </ul>
                    </div>

                    {/* Card 4 */}
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

                      <h4>Medical Second Opinions</h4>

                      <p>
                        Securely share important medical documents to receive
                        expert second opinions, including:
                      </p>

                      <ul>
                        <li>• Medical records</li>
                        <li>• Blood reports</li>
                        <li>• Imaging scans</li>
                        <li>• Previous treatment plans</li>
                      </ul>
                    </div>

                    {/* Card 5 */}
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

                      <h4>Better Continuity of Care</h4>

                      <p>
                        Telemedicine supports ongoing healthcare by making it
                        easier to:
                      </p>

                      <ul>
                        <li>• Monitor long-term conditions</li>
                        <li>• Review recovery progress</li>
                        <li>• Discuss medication changes</li>
                        <li>• Evaluate test results</li>
                        <li>• Schedule follow-up appointments</li>
                      </ul>
                    </div>
                  </div>
                </section>

                {/* Who Should Consider a Telemedicine Appointment? */}
                <section id="who-should-consider">
                  <h2>
                    Who Should Consider a Telemedicine Appointment?{" "}
                    <HeadingLink id="who-should-consider" />
                  </h2>

                  <p>
                    Telemedicine can benefit many patients by making healthcare
                    more convenient, accessible, and easier to fit into everyday
                    life. It is particularly helpful for the following groups:
                  </p>

                  <div className="points-grid">
                    <div className="point-card reveal">
                      <h4>Elderly Patients</h4>
                      <p>
                        Older adults with mobility challenges or chronic health
                        conditions can receive medical guidance from home,
                        reducing the need for frequent travel while maintaining
                        regular communication with healthcare professionals.
                      </p>
                    </div>

                    <div className="point-card reveal">
                      <h4>Busy Professionals</h4>
                      <p>
                        People with demanding schedules can save time by
                        avoiding travel and long waiting periods, making it
                        easier to keep up with routine consultations and
                        follow-up appointments.
                      </p>
                    </div>

                    <div className="point-card reveal">
                      <h4>Patients in Rural or Remote Areas</h4>
                      <p>
                        Individuals with limited access to nearby hospitals or
                        specialists can connect with qualified healthcare
                        professionals from different cities or regions through
                        virtual consultations.
                      </p>
                    </div>

                    <div className="point-card reveal">
                      <h4>International Patients</h4>
                      <p>
                        Telemedicine allows international patients to discuss
                        medical concerns, securely share reports and imaging
                        studies, obtain specialist opinions, and understand
                        treatment options before medical travel, especially for
                        complex conditions.
                      </p>
                    </div>

                    <div className="point-card reveal">
                      <h4>Patients Managing Chronic Conditions</h4>
                      <p>
                        Patients with long-term conditions such as diabetes,
                        high blood pressure, heart disease, asthma, or thyroid
                        disorders can use regular virtual follow-up appointments
                        to monitor their health and discuss ongoing treatment
                        with their healthcare providers.
                      </p>
                    </div>
                  </div>
                </section>
                {/* When Is a Telemedicine Appointment Not Appropriate? */}
                <section id="not-appropriate">
                  <h2>
                    When Is a Telemedicine Appointment Not Appropriate?{" "}
                    <HeadingLink id="not-appropriate" />
                  </h2>

                  <p>
                    While telemedicine is a convenient option for many
                    non-emergency healthcare needs, some medical situations
                    require an in-person evaluation, diagnostic testing, or
                    immediate medical attention.
                  </p>

                  <div className="points-grid">
                    <div className="point-card reveal">
                      <h4>Severe Injuries</h4>
                      <p>
                        Serious injuries such as fractures, deep wounds, or
                        major trauma require immediate in-person assessment and
                        treatment.
                      </p>
                    </div>

                    <div className="point-card reveal">
                      <h4>Conditions Requiring Surgery</h4>
                      <p>
                        Medical conditions that need surgical procedures or
                        direct medical intervention must be managed at a
                        hospital or healthcare facility.
                      </p>
                    </div>

                    <div className="point-card reveal">
                      <h4>Physical Examinations</h4>
                      <p>
                        Some symptoms can only be properly evaluated through a
                        hands-on physical examination performed by a healthcare
                        professional.
                      </p>
                    </div>

                    <div className="point-card reveal">
                      <h4>Emergency Medical Conditions</h4>
                      <p>
                        Severe chest pain, difficulty breathing, signs of
                        stroke, severe bleeding, or loss of consciousness
                        require immediate emergency medical care rather than a
                        virtual consultation.
                      </p>
                    </div>

                    <div className="point-card reveal">
                      <h4>Diagnostic Tests and Procedures</h4>
                      <p>
                        Certain laboratory tests, imaging studies, and
                        specialized diagnostic procedures must be performed in
                        person to support accurate diagnosis and treatment.
                      </p>
                    </div>
                  </div>

                  <p>
                    If a virtual consultation does not provide enough
                    information, your healthcare professional may recommend an
                    in-person visit for further evaluation or treatment.
                  </p>
                </section>
                {/* Emergency Situations */}
                <section id="emergency-care">
                  <h2>
                    Emergency Situations That Require Immediate In-Person
                    Medical Care <HeadingLink id="emergency-care" />
                  </h2>

                  <p>
                    Telemedicine should not be used for life-threatening
                    emergencies.
                    <br />
                    <br />
                    Seek immediate emergency medical assistance if you
                    experience:
                  </p>

                  <ul>
                    <li>• Severe chest pain</li>
                    <li>• Difficulty breathing</li>
                    <li>• Sudden weakness or paralysis</li>
                    <li>
                      • Signs of stroke, such as difficulty speaking or facial
                      drooping
                    </li>
                    <li>• Heavy bleeding</li>
                    <li>• Loss of consciousness</li>
                    <li>• Severe allergic reactions</li>
                    <li>• Major accidents or injuries</li>
                  </ul>

                  <p>
                    Immediate emergency services or the nearest emergency
                    department should be contacted in these situations.
                  </p>
                </section>
                {/* Privacy & Safety */}
                <section id="privacy-safety">
                  <h2>
                    Is a Telemedicine Appointment Safe and Private?{" "}
                    <HeadingLink id="privacy-safety" />
                  </h2>

                  <p>
                    Patient safety and confidentiality are essential parts of
                    virtual healthcare.
                  </p>

                  <p>
                    Reputable telemedicine providers use secure technologies and
                    follow appropriate healthcare privacy and data protection
                    practices to protect patient information.
                  </p>

                  <p>Patients can improve their privacy by:</p>

                  <ul>
                    <li>• Using a secure internet connection</li>
                    <li>• Attending appointments in a private location</li>
                    <li>
                      • Avoiding public Wi-Fi when discussing sensitive health
                      information
                    </li>
                    <li>• Choosing trusted telemedicine providers</li>
                  </ul>
                </section>
                {/* Cost */}
                <section id="costs">
                  <h2>
                    Understanding Telemedicine Appointment Costs{" "}
                    <HeadingLink id="costs" />
                  </h2>

                  <p>
                    The cost of a telemedicine appointment depends on multiple
                    factors, including:
                  </p>

                  <ul>
                    <li>• Type of healthcare professional</li>
                    <li>• Medical specialty</li>
                    <li>• Country or region</li>
                    <li>• Duration and complexity of the consultation</li>
                    <li>• Healthcare provider's pricing structure</li>
                  </ul>

                  <p>
                    In some regions, health insurance may cover certain
                    telemedicine services depending on the patient’s insurance
                    plan and local regulations.
                  </p>

                  <p>
                    Patients should check with both their healthcare provider
                    and insurance company to understand their coverage and
                    potential out-of-pocket costs.
                  </p>
                </section>
                {/* Cost */}
                <section id="costs">
                  <h2>
                    Understanding Telemedicine Appointment Costs{" "}
                    <HeadingLink id="costs" />
                  </h2>

                  <p>
                    The cost of a telemedicine appointment depends on multiple
                    factors, including:
                  </p>

                  <ul>
                    <li>• Type of healthcare professional</li>
                    <li>• Medical specialty</li>
                    <li>• Country or region</li>
                    <li>• Duration and complexity of the consultation</li>
                    <li>• Healthcare provider's pricing structure</li>
                  </ul>

                  <p>
                    In some regions, health insurance may cover certain
                    telemedicine services depending on the patient’s insurance
                    plan and local regulations.
                  </p>

                  <p>
                    Patients should check with both their healthcare provider
                    and insurance company to understand their coverage and
                    potential out-of-pocket costs.
                  </p>
                </section>
                {/* Telemedicine Myths vs Facts */}

                <section id="myths-vs-facts">
                  <h2>
                    Telemedicine Appointment Myths vs Facts{" "}
                    <HeadingLink id="myths-vs-facts" />
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
                            Online doctor appointments are not real medical
                            consultations
                          </th>
                          <td>
                            Qualified healthcare professionals can provide
                            appropriate medical guidance remotely where
                            suitable.
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">
                            Telemedicine is only useful for minor illnesses
                          </th>
                          <td>
                            Telemedicine can also support specialist
                            consultations, chronic disease management, and
                            medical second opinions.
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">
                            A virtual appointment can replace every hospital
                            visit
                          </th>
                          <td>
                            Some conditions require physical examinations,
                            tests, procedures, or emergency treatment.
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">Telemedicine is not secure</th>
                          <td>
                            Reputable platforms use security measures designed
                            to protect patient information.
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">
                            Older adults cannot use telemedicine
                          </th>
                          <td>
                            Many elderly patients successfully use virtual
                            healthcare with appropriate support.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
                {/* Future of Telemedicine */}
                <section id="future">
                  <h2>
                    The Future of Telemedicine Appointments{" "}
                    <HeadingLink id="future" />
                  </h2>

                  <p>
                    Telemedicine continues to evolve with advancements in
                    digital healthcare technology, making virtual care more
                    accessible, efficient, and patient-centered.
                  </p>

                  <p>Future developments may include:</p>

                  <ul>
                    <li>• Better video communication systems</li>
                    <li>• Improved patient portals</li>
                    <li>• Remote monitoring devices</li>
                    <li>• Artificial intelligence-assisted healthcare tools</li>
                    <li>• More personalized virtual healthcare experiences</li>
                  </ul>

                  <p>
                    These advancements aim to improve convenience and healthcare
                    accessibility while supporting healthcare professionals in
                    delivering effective care.
                  </p>
                </section>
                {/* Why Choose Humancare Connect */}
                <section id="why-humancare-connect">
                  <h2>
                    Why Choose Humancare Connect for Your Telemedicine
                    Appointment? <HeadingLink id="why-humancare-connect" />
                  </h2>

                  <p>
                    At Humancare Connect, we aim to make quality healthcare
                    accessible and convenient for patients across different
                    regions. Our telemedicine services connect you with
                    experienced healthcare professionals through a secure and
                    patient-centered virtual care experience.
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
                          <circle
                            cx="12"
                            cy="8"
                            r="4"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                          <path
                            d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>

                      <h4>Experienced Healthcare Professionals</h4>

                      <p>
                        Connect with qualified doctors and specialists who can
                        review your concerns, evaluate your medical information,
                        and guide you through the next steps of your healthcare
                        journey.
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
                            d="M12 3v18M3 12h18"
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

                      <h4>Specialist Consultations</h4>

                      <p>
                        Access expert opinions across multiple medical
                        specialties without the need for unnecessary travel,
                        helping you receive the care and guidance you need more
                        conveniently.
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
                            d="M12 6v6l4 2"
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

                      <h4>Medical Second Opinions</h4>

                      <p>
                        Receive additional expert insights on complex diagnoses,
                        major treatment decisions, and ongoing treatment plans
                        to help you make informed healthcare decisions.
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
                            d="M12 3C7 3 3 7 3 12s4 9 9 9 9-4 9-9-4-9-9-9z"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                          <path
                            d="M3 12h18M12 3c2.5 2.5 4 5.8 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.8-4-9s1.5-6.5 4-9z"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                        </svg>
                      </div>

                      <h4>International Patient Support</h4>

                      <p>
                        Patients from different countries can securely share
                        medical reports, discuss treatment options, and seek
                        specialist guidance remotely before planning further
                        care.
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
                            d="M5 12h14M12 5v14"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                          />
                          <rect
                            x="3"
                            y="3"
                            width="18"
                            height="18"
                            rx="3"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                        </svg>
                      </div>

                      <h4>Convenient and Patient-Centered Care</h4>

                      <p>
                        Our goal is to simplify healthcare by providing an easy,
                        secure, and patient-focused way to connect with
                        healthcare professionals from the comfort of your home.
                      </p>
                    </div>
                  </div>

                  <p>
                    Book your telemedicine appointment with Humancare Connect
                    today and take the first step toward accessible, modern
                    healthcare.
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
                {/* Key Takeaways */}
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
                        A telemedicine appointment allows patients to consult
                        healthcare professionals remotely using secure digital
                        technology.
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
                        The process typically involves booking an appointment,
                        preparing medical information, attending the virtual
                        consultation, receiving medical guidance, and scheduling
                        follow-up care when necessary.
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
                        Telemedicine provides convenient access to doctors,
                        specialists, and second opinions without unnecessary
                        travel.
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
                        It is suitable for many non-emergency healthcare needs
                        but does not replace emergency medical treatment or
                        situations requiring physical examination.
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
                        safe, private, and effective healthcare experience.
                      </li>
                    </ul>
                  </div>
                </section>
              </article>
            </div>

            {/* CTA */}
            <section className="cta-section reveal">
              <h2>Ready to Schedule Your Telemedicine Appointment?</h2>
              <p>
                Getting expert medical guidance is now easier than ever. With
                Humancare Connect, you can connect with experienced healthcare
                professionals from the comfort and privacy of your home.
              </p>
              <p>Our telemedicine services allow you to:</p>
              <ul>
                <li>Book convenient online doctor appointments</li>
                <li>Consult experienced specialists</li>
                <li>Share medical reports and receive expert guidance</li>
                <li>
                  Obtain medical second opinions for complex health concerns
                </li>
                <li>Receive follow-up care without unnecessary travel</li>
              </ul>
              <p>
                Whether you are seeking a routine consultation, specialist
                advice, or a second opinion, Humancare Connect is here to make
                quality healthcare more accessible.
              </p>
              <p>
                <strong>
                  Book your telemedicine appointment today and take the first
                  step toward convenient, personalized healthcare.
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
