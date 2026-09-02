import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import UTIImage from "../../assets/BlogImages/uti-online-treatment.webp";

import "./telemedicine.css";
import SEO from "../../components/Seo";

const PAGE_TITLE = "UTI Symptoms, Causes, Treatment & When to See a Doctor";
const PAGE_DESCRIPTION =
  "Learn about UTI symptoms, causes, treatment, antibiotics for UTIs, prevention, and when to see a doctor. Get expert online care with Humancare Connect.";
const PAGE_URL =
  "https://humancareconnect.co/mens-health/urology/urinary-tract-infection";
const PAGE_IMAGE = UTIImage;

const TOC_ITEMS = [
  { id: "overview", label: "UTI Overview" },
  { id: "symptoms", label: "UTI Symptoms" },
  { id: "causes", label: "UTI Causes" },
  { id: "men-uti", label: "Can Men Get UTIs?" },
  { id: "diagnosis", label: "How Is UTI Diagnosed?" },
  { id: "treatment", label: "How to Get Rid of a UTI" },
  { id: "antibiotics", label: "UTI Medicine & Antibiotics" },
  { id: "go-away", label: "Can a UTI Go Away on Its Own?" },
  { id: "duration", label: "How Long Does a UTI Last?" },
  { id: "pain", label: "UTI Pain" },
  { id: "frequent-uti", label: "Frequent UTIs" },
  { id: "prevention", label: "How to Prevent UTIs" },
  { id: "when-to-see-doctor", label: "When Should You See a Doctor?" },
  { id: "online-help", label: "Get Online Help" },
  { id: "faq", label: "FAQs" },
  { id: "disclaimer", label: "Medical Disclaimer" },
];

const FAQ_ITEMS = [
  {
    q: "1. What are the most common UTI symptoms?",
    a: "Common UTI symptoms include burning during urination, frequent or urgent urination, lower abdominal discomfort, and cloudy, bloody, or strong-smelling urine.",
  },
  {
    q: "2. Can men get UTIs?",
    a: "Yes. Men can get UTIs, although bladder infections are less common in men. Conditions that make it difficult to completely empty the bladder, such as an enlarged prostate, can increase the risk.",
  },
  {
    q: "3. Can a UTI go away on its own?",
    a: "Some urinary symptoms may improve, but you shouldn't assume a suspected bacterial UTI will resolve without appropriate evaluation. An untreated bladder infection can spread to the kidneys.",
  },
  {
    q: "4. What causes a UTI?",
    a: "Most UTIs are caused by bacteria entering and multiplying in the urinary tract. Previous infections, urinary retention, kidney stones, sexual activity, pregnancy, menopause, and certain health conditions can increase the risk.",
  },
  {
    q: "5. How do you get rid of a UTI?",
    a: "Treatment depends on the cause. Bacterial bladder infections are commonly treated with prescription antibiotics when appropriate. Staying hydrated can also help support recovery and relieve some symptoms.",
  },
  {
    q: "6. How long does a UTI last?",
    a: "The duration varies depending on the infection and treatment. If symptoms persist, worsen, or return after treatment, contact a healthcare professional.",
  },
  {
    q: "7. Can a UTI cause blood in urine?",
    a: "Yes. Blood can occur with a bladder infection, but blood in the urine can have other causes and should be evaluated by a healthcare professional.",
  },
  {
    q: "8. Can a UTI cause fever?",
    a: "Fever can occur when an infection has reached the kidneys. Fever accompanied by chills, vomiting, or back or side pain requires prompt medical attention.",
  },
  {
    q: "9. Can a UTI spread to the kidneys?",
    a: "Yes. An untreated bladder infection can spread to one or both kidneys. Kidney infections can become serious and require prompt treatment.",
  },
  {
    q: "10. How can I prevent frequent UTIs?",
    a: "Staying hydrated, not holding urine, fully emptying your bladder, practicing good bathroom hygiene, and discussing recurring infections with a healthcare professional may help reduce your risk.",
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

export default function UTI() {
  const articleRef = useRef(null);
  const [scrollPct, setScrollPct] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [readTime, setReadTime] = useState(1);
  const [activeSection, setActiveSection] = useState("overview");
  const [openFaq, setOpenFaq] = useState(null);
  const [copied, setCopied] = useState(false);

  // Reset scroll on mount
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
      <SEO
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        keywords="UTI symptoms, UTI causes, UTI treatment, urinary tract infection, UTI antibiotics, Humancare Connect"
        url={PAGE_URL}
      />
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
                  <span className="badge">Urology</span>
                  <span className="badge outline">Patient Guide</span>
                </div>
                <h1 className="article-title">
                  UTI: Symptoms, Causes, Treatment &amp; When to See a Doctor
                </h1>
              </div>

              <figure className="hero-media">
                <img
                  src={PAGE_IMAGE}
                  alt="UTI Symptoms, Causes, Treatment & When to See a Doctor"
                  loading="eager"
                />
                <figcaption>
                  Understanding UTI symptoms, causes, diagnosis, and treatment
                  options.
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
                <section id="overview">
                  <h2>
                    UTI: Symptoms, Causes, Treatment &amp; When to See a Doctor
                    <HeadingLink id="overview" />
                  </h2>
                  <p>
                    <a href="https://humancareconnect.co/mens-health/urology/urinary-tract-infection">
                      UTI
                    </a>{" "}
                    is short for urinary tract infection. It’s a common
                    infection that can affect the bladder, urethra, ureters or
                    kidneys. Most UTIs are caused by bacteria that enter the
                    urinary tract and multiply. Cystitis is the most common type
                    of UTI.
                  </p>
                  <p>
                    If you've ever had that sudden urge to pee, burning
                    urination, or UTI pain you know how frustrating it can be.
                    The good news is that bladder infections are most treatable
                    if properly diagnosed and treated.
                  </p>
                  <p>
                    Knowing the symptoms, causes, treatment options and when to
                    see a doctor can help you take action instead of just hoping
                    the discomfort will go away.
                  </p>
                </section>

                <section id="symptoms">
                  <h2>
                    UTI Symptoms: What Should You Look For?
                    <HeadingLink id="symptoms" />
                  </h2>
                  <p>
                    The most common UTI symptoms involve changes in urination.
                    You may notice:
                  </p>
                  <ul>
                    <li>• Burning or pain when urinating</li>
                    <li>• A frequent or sudden urge to urinate</li>
                    <li>• Passing only a small amount of urine</li>
                    <li>• Pain or pressure in the lower abdomen</li>
                    <li>• Cloudy or strong-smelling urine</li>
                    <li>• Blood in the urine</li>
                  </ul>
                  <p>
                    Symptoms of UTI may differ from person to person. Burning
                    when you pee is a common first symptom people notice, but
                    burning or other urinary discomfort doesn't always mean you
                    have a UTI. Other conditions can give similar symptoms and
                    that is why proper evaluation can be important.
                  </p>
                  <p>
                    If you develop fever, chills, nausea, vomiting or pain in
                    your back or side, don’t ignore it. These signs may indicate
                    that an infection has reached the kidneys and that you need
                    medical attention right away.
                  </p>
                </section>

                <section id="causes">
                  <h2>
                    UTI Causes: What Causes UTI?
                    <HeadingLink id="causes" />
                  </h2>
                  <p>
                    So what causes a UTI? In most cases bacteria enter the
                    urinary tract and multiply. Your body has defense mechanisms
                    to keep harmful bacteria in check, such as regular emptying
                    of the bladder. Should bacteria manage to breach these
                    defenses, an infection may follow.
                  </p>
                  <p>
                    Several factors can increase your risk of developing a UTI,
                    including:
                  </p>
                  <ul>
                    <li>• Having had a previous UTI</li>
                    <li>• Sexual activity</li>
                    <li>• Difficulty completely emptying your bladder</li>
                    <li>• Kidney stones or other urinary blockages</li>
                    <li>• Using a urinary catheter</li>
                    <li>• Pregnancy</li>
                    <li>• Menopause</li>
                    <li>• Diabetes</li>
                    <li>• An enlarged prostate</li>
                    <li>• Certain urinary tract abnormalities</li>
                  </ul>
                  <p>
                    Women are more likely to develop bladder infections because
                    of urinary anatomy, but anyone can develop a{" "}
                    <a href="https://humancareconnect.co/mens-health/urology/urinary-tract-infection">
                      UTI
                    </a>
                    .
                  </p>
                </section>

                <section id="men-uti">
                  <h2>
                    Can Men Get UTIs?
                    <HeadingLink id="men-uti" />
                  </h2>
                  <p>
                    Yes, men get UTIs. Bladder infections are less common in
                    men, but urinary symptoms should not be ignored.
                  </p>
                  <p>
                    Some men have conditions like an enlarged prostate that
                    makes it difficult to empty the bladder completely. This
                    might increase the risk of infection. Sometimes bacteria can
                    have an effect on the prostate and this can change the way
                    it is treated.
                  </p>
                  <p>
                    If you are a man and you have symptoms of a UTI such as
                    burning urination, frequent urination or difficulty
                    urinating, you can talk to a healthcare professional to find
                    out the reason why and what you should do next.
                  </p>
                </section>

                <section id="diagnosis">
                  <h2>
                    How Is UTI Diagnosed?
                    <HeadingLink id="diagnosis" />
                  </h2>
                  <p>
                    So, how is UTI diagnosed? A healthcare professional may
                    consider your symptoms, medical history, physical
                    examination, and laboratory tests.
                  </p>
                  <p>Common tests can include:</p>
                  <ul>
                    <li>• Urinalysis</li>
                    <li>• Urine culture</li>
                    <li>
                      • Blood tests when a more serious infection is suspected
                    </li>
                  </ul>
                  <p>
                    A urinalysis may check for blood or white blood cells in the
                    urine. A urine culture can identify certain bacteria and
                    help decide if antibiotics may be appropriate. Sometimes, if
                    you get infections repeatedly extra tests or imaging may be
                    suggested to look for an underlying cause.
                  </p>
                  <p>
                    A correct diagnosis is important, as burning, frequent
                    urination and pelvic discomfort can be signs of other
                    conditions beside a bacterial UTI.
                  </p>
                </section>

                <section id="treatment">
                  <h2>
                    How to Get Rid of a UTI
                    <HeadingLink id="treatment" />
                  </h2>
                  <p>
                    Looking for how to get rid of a UTI? Treatment depends on
                    the cause and severity of the infection.
                  </p>
                  <p>
                    If bacteria cause a bladder infection, a healthcare provider
                    will most likely prescribe antibiotics. The specific
                    medication and duration depend on the bacteria you might
                    have, your symptoms, your allergies, any previous infections
                    and other health issues.
                  </p>
                  <p>
                    Drink plenty of fluids. This can help you stay hydrated and
                    may help ease some symptoms. Water is generally the best. A
                    healthcare professional may also advise appropriate pain
                    relief when needed.
                  </p>
                  <p>
                    Don’t use leftover antibiotics or medicine prescribed for
                    someone else. If you get the wrong medication, it may not
                    clear the infection and may lead to antibiotic resistance.
                  </p>
                </section>

                <section id="antibiotics">
                  <h2>
                    UTI Medicine and UTI Antibiotics
                    <HeadingLink id="antibiotics" />
                  </h2>
                  <p>
                    The treatment of UTI is not standard for all patients. If
                    tests reveal a bacterial infection, then the patient might
                    be prescribed UTI antibiotics.
                  </p>
                  <p>
                    Your doctor can select antibiotics depending on various
                    criteria including the nature of the bacteria, your medical
                    background, allergies, and history of past UTIs. It is
                    essential to follow the prescribed course of treatment, even
                    if you begin feeling better.
                  </p>
                  <p>
                    Do not share antibiotics with another person, keep
                    antibiotics for later use, and do not take any antibiotics
                    without medical advice.
                  </p>
                </section>

                <section id="go-away">
                  <h2>
                    Can a UTI Go Away on Its Own?
                    <HeadingLink id="go-away" />
                  </h2>
                  <p>
                    Will a UTI resolve itself? This is a frequent query,
                    particularly when the symptoms appear mild.
                  </p>
                  <p>
                    One should not just rely on the assumption that a suspected
                    bacterial infection will resolve itself without seeking
                    medical attention. Urinary symptoms could resolve
                    themselves, but a bladder infection left untreated might
                    escalate into something worse and affect the kidneys.
                  </p>
                  <p>
                    If your symptoms have been persistent or severe and are
                    associated with fever, shivers, vomiting, bloody urine, or
                    back or side pain, you should consult a healthcare provider
                    immediately.
                  </p>
                </section>

                <section id="duration">
                  <h2>
                    How Long Does a UTI Last?
                    <HeadingLink id="duration" />
                  </h2>
                  <p>
                    How long does a UTI last?it depends on the kind and severity
                    of infection present and if treatment is given. You may
                    notice an improvement in your symptoms after a treatment has
                    been started. Conversely, some individuals may require
                    additional laboratory testing if their symptoms persist or
                    reappear.
                  </p>
                  <p>
                    If symptoms do not improve or recur following an initial
                    course of treatment your physician may request further
                    laboratory investigation (a repeat urine culture). Rather
                    than just thinking about the duration of the symptoms,
                    consider rather how they are improving.
                  </p>
                  <p>
                    Persistent or mainly worsening symptoms require attention.
                  </p>
                </section>

                <section id="pain">
                  <h2>
                    UTI Pain: What Does It Feel Like?
                    <HeadingLink id="pain" />
                  </h2>
                  <p>
                    UTI pain can feel different depending on where the infection
                    is located.
                  </p>
                  <p>
                    A bladder infection may cause pressure or discomfort in the
                    lower abdomen. Pain in the back, side, or groin,
                    particularly when combined with fever, chills, nausea, or
                    vomiting, can be a warning sign of a kidney infection.
                  </p>
                  <p>
                    Severe or worsening UTI pain shouldn't be ignored. Getting
                    medical care early can help prevent complications.
                  </p>
                </section>

                <section id="frequent-uti">
                  <h2>
                    Frequent UTIs: Why Do They Keep Coming Back?
                    <HeadingLink id="frequent-uti" />
                  </h2>
                  <p>
                    Occasionally, some individuals suffer from UTIs regularly or
                    even a second time within a short time. Old infections,
                    problems emptying the bladder, urinary tract obstructions
                    menopause kinds of contraception, and many other unique
                    factors may contribute to these conditions.
                  </p>
                  <p>
                    If frequent UTIs are something you struggle with on a
                    routine basis, you may find it frustrating that after each
                    occurrence you take the same measures. Don't let go of what
                    is causing this problem. Medical practitioners might suggest
                    analyzing urine samples or other diagnostic tests for them
                    to pinpoint the causes.
                  </p>
                </section>

                <section id="prevention">
                  <h2>
                    How to Prevent UTIs
                    <HeadingLink id="prevention" />
                  </h2>
                  <p>
                    While you can't prevent every UTI, some everyday habits may
                    help reduce your risk:
                  </p>
                  <ul>
                    <li>• Drink enough fluids to stay hydrated</li>
                    <li>
                      • Use the bathroom when you feel the urge to urinate
                    </li>
                    <li>• Take time to fully empty your bladder</li>
                    <li>• Practice good bathroom hygiene</li>
                    <li>• Wipe from front to back</li>
                    <li>• Wear loose-fitting, breathable clothing</li>
                    <li>
                      • Talk with a healthcare professional if you experience
                      recurrent infections
                    </li>
                  </ul>
                  <p>
                    If you regularly develop UTIs, your prevention plan may need
                    to be personalized based on your health and risk factors.
                  </p>
                </section>

                <section id="when-to-see-doctor">
                  <h2>
                    When Should You See a Doctor for a UTI?
                    <HeadingLink id="when-to-see-doctor" />
                  </h2>
                  <p>
                    You should consider talking with a healthcare professional
                    if you develop UTI symptoms, especially if they persist or
                    become worse.
                  </p>
                  <p>Seek prompt medical attention if you experience:</p>
                  <ul>
                    <li>• Fever or chills</li>
                    <li>• Back, side, or groin pain</li>
                    <li>• Nausea or vomiting</li>
                    <li>• Blood in your urine</li>
                    <li>• Severe UTI pain</li>
                    <li>• Symptoms that are rapidly getting worse</li>
                    <li>• Frequent or recurring UTIs</li>
                    <li>• Symptoms during pregnancy</li>
                    <li>• Symptoms that don't improve with treatment</li>
                  </ul>
                  <p>
                    A bladder infection can spread to the kidneys, and kidney
                    infections can cause serious health problems when left
                    untreated.
                  </p>
                </section>

                <section id="online-help">
                  <h2>
                    Get Online Help for UTI Symptoms
                    <HeadingLink id="online-help" />
                  </h2>
                  <p>
                    Having to suffer from urinary health problems while getting
                    medical help is Yes a very inconvenient situation.
                  </p>
                  <p>
                    The beauty of Humancare Connect lies in the possibility of
                    connecting with a health professional for such matters via
                    the Internet without leaving your home. You can talk to a
                    professional health worker about the nature of your urinary
                    issue like burning sensations, frequent visits to the
                    toilet, discomfort in your bladder, or recurring UTIs.
                  </p>
                  <p>
                    In an online consultation session, a professional healthcare
                    will go through the details you provide. If need arise,
                    discussion for diagnostic tests will be a possible step. The
                    professional will then guide you in the next action to
                    carry. Virtual care can be useful when you are in need of a
                    UTI online treatment as this is a very handy way to talk to
                    a qualified healthcare professional and have them explain
                    what is happening to you.
                  </p>
                  <p>
                    Keep in mind that it is not the smartest and the healthiest
                    choice to wait for the symptoms if they do not go away. You
                    should find out the right guidance you need and make sure
                    that you receive proper care and get rid of the symptoms
                    soon.
                  </p>
                </section>

                <section id="faq" className="faq-section">
                  <h2>Frequently Asked Questions About UTIs</h2>
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

                <section id="disclaimer">
                  <div className="takeaway-box reveal">
                    <h3>Medical Disclaimer</h3>
                    <p>
                      This article is for general educational purposes only and
                      is not a substitute for professional medical advice,
                      diagnosis, or treatment. If you have severe, persistent,
                      or worsening symptoms, speak with a qualified healthcare
                      professional.
                    </p>
                  </div>
                </section>
              </article>
            </div>

            {/* CTA */}
            <section className="cta-section reveal">
              <h2>Access Trusted Virtual Healthcare with Humancare Connect</h2>
              <p>
                At <strong>Humancare Connect</strong>, we make healthcare
                accessible through convenient telemedicine services. Connect
                with experienced healthcare professionals, seek specialist
                advice, share medical reports securely, and receive guidance
                without unnecessary travel.
              </p>
              <div className="cta-buttons">
                <Link
                  to="/appointment-booking"
                    state={{ tab: "spec" }}
                  className="btn btn-primary"
                >
                  Book Online Consultation
                </Link>
              </div>
            </section>
          </div>
        </main>
      </div>
    </>
  );
}
