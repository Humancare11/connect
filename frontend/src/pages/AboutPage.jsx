import "./AboutPage.css";
import AboutHeroImg from "../assets/AboutUsPage/about-humancare-connect-telehealth.webp";
import WhyHumancareImg from "../assets/AboutUsPage/why-humancare-connect-healthcare.webp";
import PatientTrustImg from "../assets/AboutUsPage/global-healthcare-professionals-network.webp";
import NetworkDoctorsImg from "../assets/AboutUsPage//patient-virtual-healthcare-experience.webp";
import DoctorTrustImg from "../assets/AboutUsPage/doctor-telemedicine-consultation.webp";
import SEO from "../components/Seo";
/* ─── Shared primitives ─── */
function Eyebrow({ children, light }) {
  return (
    <span className={`eyebrow${light ? " eyebrow--light" : ""}`}>
      {children}
    </span>
  );
}

function Btn({ href, ghost, children }) {
  return (
    <a href={href} className={`btn${ghost ? " btn--ghost" : " btn--solid"}`}>
      {children}
    </a>
  );
}

function Rv({ children, className = "", delay = 0 }) {
  return (
    <div
      className={`reveal reveal--visible ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function PhotoSlot({ label, image, icon, className = "", variant = "blue" }) {
  return (
    <div className={`photo-slot photo-slot--${variant} ${className}`}>
      <div className="photo-slot__texture" />
      <div className="photo-slot__sheen" />
      {image ? (
        <img
          src={image}
          alt={label}
          className="photo-slot__image"
          loading="lazy"
        />
      ) : (
        <div className="photo-slot__content">
          <div className="photo-slot__icon">{icon}</div>
          <span className="photo-slot__label">{label}</span>
        </div>
      )}
    </div>
  );
}

/* Arrow connector between steps */
function ArrowIcon() {
  return (
    <svg
      className="step-arrow"
      width="34"
      height="34"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/* ─── Data used inline below ─── */
const problems = [
  {
    num: "01",
    title: "Trusted Care, Made Accessible",
    body: "Finding the right healthcare provider should never feel uncertain. Humancare Connect connects patients with experienced healthcare professionals through a secure and reliable virtual healthcare platform.",
  },
  {
    num: "02",
    title: "Transparent & Convenient Healthcare",
    body: "We believe patients deserve clarity and convenience. Our online doctor consultations provide a straightforward way to receive professional medical guidance without unnecessary delays.",
  },
  {
    num: "03",
    title: "Connected Care That Puts Patients First",
    body: "Healthcare is a journey, not a single appointment. That's why we focus on creating a seamless digital healthcare experience where patients receive continuous, personalized support whenever they need it.",
  },
];

const steps = [
  {
    n: 1,
    title: "Share Your Health Concern",
    body: "Tell us about your symptoms or healthcare needs, and we'll help connect you with the right medical professional for the appropriate care.",
    color: "navy",
  },
  {
    n: 2,
    title: "Know Your Consultation Cost",
    body: "No hidden fees or surprises. View transparent consultation pricing upfront so you can make informed healthcare decisions with confidence.",
    color: "blue",
  },
  {
    n: 3,
    title: "Connect With a Trusted Doctor",
    body: "Meet with licensed healthcare professionals through secure online doctor consultations and receive expert medical guidance, diagnosis, and treatment recommendations where applicable.",
    color: "gold",
  },
  {
    n: 4,
    title: "Experience Continuous Care",
    body: "Your healthcare journey doesn't end after one appointment. Stay connected with ongoing support, medical records, and a more personalised virtual healthcare experience.",
    color: "navy",
  },
];

const networkStats = [
  { value: 11, label: "Clinical categories", suffix: "" },
  { value: 30, label: "Medical specialties", suffix: "+" },
  { value: 140, label: "Conditions covered", suffix: "+" },
];

const regions = [
  { name: "United States", icon: "🇺🇸" },
  { name: "Canada", icon: "🇨🇦" },
  { name: "Europe (EU)", icon: "🇪🇺" },
  { name: "Travel & Global Care", icon: "🌍" },
];

const solveCards = [
  {
    color: "blue",
    title: "Verified Healthcare Professionals",
    body: "Your health deserves trusted expertise. Every healthcare professional on our platform is carefully verified, ensuring you receive care from qualified and experienced medical providers.",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#2563EB"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 12l2 2 4-4" />
        <path d="M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7l7-4z" />
      </svg>
    ),
  },
  {
    color: "gold",
    title: "Transparent Consultation Pricing",
    body: "No hidden costs or unexpected fees. We believe healthcare should be straightforward, with clear consultation pricing that helps you make informed decisions with confidence.",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#C97B1A"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    color: "navy",
    title: "Secure & Connected Healthcare Experience",
    body: "Your healthcare journey should be simple and seamless. With secure technology and protected health information, we make it easier to stay connected with your care and medical history.",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#1E3A5F"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3c2.5 2.6 4 5.7 4 9s-1.5 6.4-4 9c-2.5-2.6-4-5.7-4-9s1.5-6.4 4-9z" />
      </svg>
    ),
  },
  {
    color: "blue",
    title: "Fast Access to the Right Care",
    body: "Getting medical support should not mean waiting for days. Our streamlined virtual healthcare platform helps you connect with the right healthcare professional quickly and conveniently.",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#2563EB"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
];

const services = [
  {
    tier: "Primary tier",
    title: "Primary & Everyday Care",
    body: "Receive convenient online doctor consultations for common illnesses, preventive care, general health concerns, prescriptions, and routine medical guidance.",
  },
  {
    tier: "Specialist tier",
    title: "Specialty Care & Expert Consultations",
    body: "Connect with experienced specialists across various medical fields, including mental health, pediatrics, dermatology, cardiology, and many other areas of healthcare.",
  },
  {
    tier: "Super-specialist tier",
    title: "Advanced Care & Second Opinions",
    body: "Access expert medical opinions for complex health conditions, helping you make confident and informed decisions about your treatment journey.",
  },
  {
    tier: "Flagship",
    title: "Healthcare for Travelers & Global Communities",
    body: "Stay connected to trusted medical support wherever life takes you with accessible virtual healthcare designed for modern lifestyles.",
  },
  {
    tier: "Corporates",
    title: "Corporate Healthcare Solutions",
    body: "Support your workforce with convenient telehealth services, employee healthcare programs, and scalable virtual care solutions designed for organisations.",
  },
];

const offices = [
  {
    label: "United States",
    name: "Humancare Connect, Inc.",
    lines: ["4 Peddlers Row, 1091", "Newark, DE 19702, USA"],
    email: "support@humancareconnect.co",
  },
];

/* ─── ROOT EXPORT — every section's markup lives directly in here ─── */
export default function AboutPage() {
  return (
    <>
    <SEO
  title="About Humancare Connect | Trusted Virtual Healthcare"
  description="Learn about Humancare Connect, a trusted virtual healthcare platform offering secure online doctor consultations, quality care, and telemedicine services."
  keywords="virtual healthcare platform, online doctor consultations, virtual healthcare services, telemedicine services, online healthcare, virtual care, online medical consultation, digital healthcare, licensed providers, Humancare Connect"
  url="https://humancareconnect.co/about-us"
/>
    <div className="about-page">
      {/* 1. Hero */}
      <section className="about-hero">
        <div className="about-hero__glow about-hero__glow--blue" />
        <div className="about-hero__glow about-hero__glow--gold" />
        <div className="container">
          <div className="about-hero__grid">
            <div className="about-hero__text is-visible">
              <Eyebrow>About Humancare Connect</Eyebrow>
              <h1 className="about-hero__title">
                One Global Connection{" "}
                <span className="about-hero__title-accent">
                  to Better Healthcare
                </span>
              </h1>
              <p className="about-hero__lead">
                At Humancare Connect, we make quality healthcare accessible
                beyond borders. Through secure online doctor consultations and
                virtual healthcare services, we connect individuals, travelers,
                and organizations with trusted medical care anytime, anywhere.
              </p>
              <div className="about-hero__actions">
                <Btn href="#how">See how it works</Btn>
                <Btn href="#why" ghost>
                  Why we started
                </Btn>
              </div>

              <div className="trust-strip">
                {["GDPR", "HIPAA-aligned", "Verified doctors"].map((b) => (
                  <div key={b} className="trust-strip__item">
                    <span className="trust-strip__dot" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="about-hero__photo is-visible">
              <div className="about-hero__photo-frame">
                <img
                  src={AboutHeroImg}
                  alt="About Humancare Connect providing secure virtual healthcare and online doctor consultations"
                  loading="eager"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Why We Started */}
      <section id="why" className="section section--white">
        <div className="container">
          <div className="why__grid">
            <Rv>
              <div className="why__left">
                <Eyebrow>Our story</Eyebrow>
                <h2
                  className="heading heading--lg why__heading"
                  style={{ marginTop: 16 }}
                >
                  Why we
                  <br />
                  started
                </h2>
                <div className="why__img-wrap">
                  <img
                    src={WhyHumancareImg}
                    alt="Healthcare professionals collaborating to improve access to virtual healthcare services"
                    className="why__img"
                    loading="lazy"
                  />
                </div>
              </div>
            </Rv>
            <Rv delay={100}>
              <div>
                <p className="why__intro">
                  Humancare Connect was founded with a simple vision: to
                  transform the way people experience healthcare by making it
                  more accessible, convenient, and connected.
                </p>
                <p className="why__body">
                  With years of experience in healthcare and telemedicine, we
                  recognized the need for a smarter approach — one that removes
                  unnecessary barriers and gives patients seamless access to
                  trusted healthcare professionals.
                </p>
                <blockquote className="quote">
                  That's why we created Humancare Connect: A secure virtual
                  healthcare platform designed to deliver online doctor
                  consultations and personalized medical support whenever you
                  need it.
                </blockquote>
                <p className="why__closing">
                  We believe great healthcare is not just about treating
                  symptoms — it's about providing peace of mind, building
                  lasting trust, and ensuring every patient receives the quality
                  care they deserve.
                </p>
              </div>
            </Rv>
          </div>
        </div>
      </section>

      {/* 3. Problem Section */}
      <section className="section section--navy">
        <div className="section__glow section__glow--bl" />
        <div className="section__glow section__glow--tr" />
        <div className="container">
          <Rv>
            <Eyebrow light>The system we're fixing</Eyebrow>
          </Rv>
          <Rv delay={80}>
            <h2 className="heading heading--lg problem__title">
              The Healthcare Challenges{" "}
              <span className="text-blue">We're Solving</span>
            </h2>
            <p className="heading heading--lg problem__desc">
              Healthcare should be simple, transparent, and built around the
              patient. Yet too many people still face challenges like long wait
              times, limited access to trusted medical professionals, unclear
              costs, and disconnected care experiences.
            </p>
          </Rv>
          <div className="grid grid--3">
            {problems.map((p, i) => (
              <Rv key={p.num} delay={i * 90}>
                <div className="problem-card">
                  <div className="problem-card__top">
                    <div className="problem-card__num">{p.num}</div>
                  </div>
                  <h4 className="problem-card__title">{p.title}</h4>
                  <p className="problem-card__body">{p.body}</p>
                </div>
              </Rv>
            ))}
          </div>
        </div>
      </section>

      {/* 4. How It Works */}
      <section id="how" className="section section--bg">
        <div className="container">
          <Rv>
            <div className="section-head">
              <Eyebrow>How it works</Eyebrow>
              <h2 className="heading heading--lg section-head__title">
                Healthcare Made Simple, From Start to Finish
              </h2>
              <p className="section-head__lead">
                Getting the care you need shouldn't be complicated. Humancare
                Connect makes online healthcare easy with a seamless virtual
                care experience designed around your needs.
              </p>
            </div>
          </Rv>
          <div className="grid grid--4">
            {steps.map((s, i) => (
              <Rv key={s.n} delay={i * 90}>
                <div className="step-card">
                  <div className={`step-card__num step-card__num--${s.color}`}>
                    {s.n}
                  </div>
                  {i < steps.length - 1 && <ArrowIcon />}
                  <h4 className="step-card__title">{s.title}</h4>
                  <p className="step-card__body">{s.body}</p>
                </div>
              </Rv>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Network — static stats, 3 equal-width columns */}
      <section className="section section--white">
        <div className="container">
          <div className="network__top">
            <div className="network__copy">
              <Eyebrow>Our Network</Eyebrow>
              <h2 className="heading heading--lg section-head__title">
                A Trusted Network of Healthcare Professionals
              </h2>
              <p className="section-head__lead">
                Quality healthcare starts with the right connection. At
                Humancare Connect, we have built a trusted network of licensed
                healthcare professionals across multiple specialties, ensuring
                patients receive the right care from the right medical expert.
                <br />
                <br />
                Our virtual healthcare platform is designed around quality,
                accessibility, and trust — making it simple to connect with
                experienced doctors, receive personalised medical guidance, and
                experience seamless healthcare whenever you need it.
              </p>
            </div>
            <div className="network__img-wrap">
              <img
                src={NetworkDoctorsImg}
                alt="Licensed healthcare professionals providing trusted online medical consultations"
                className="network__img"
                loading="lazy"
              />
            </div>
          </div>

          <div className="stats-grid">
            {networkStats.map((s, i) => (
              <div key={i} className="stats-cell">
                <div className="stats-cell__num">
                  {s.value}
                  {s.suffix && <span className="text-blue">{s.suffix}</span>}
                </div>
                <div className="stats-cell__label">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="chip-row chip-row--visible">
            {regions.map((r) => (
              <span key={r.name} className="chip">
                <span aria-hidden="true">{r.icon}</span>
                {r.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 6. What We Solve */}
      <section className="section section--bg">
        <div className="container">
          <Rv>
            <div className="section-head">
              <Eyebrow>What we solve</Eyebrow>
              <h2 className="heading heading--lg section-head__title">
                Care You Can Trust, Every Step of the Way
              </h2>
              <p className="section-head__lead">
                At Humancare Connect, every part of our virtual healthcare
                experience is designed to provide confidence, clarity, and
                continuous support — so you always feel informed and cared for.
              </p>
            </div>
          </Rv>
          <div className="grid grid--2">
            {solveCards.map((c, i) => (
              <Rv key={c.title} delay={i * 70}>
                <div className={`solve-card solve-card--${c.color}`}>
                  <div className="solve-card__glow" />
                  <div className="solve-card__icon">{c.icon}</div>
                  <h3 className="solve-card__title">{c.title}</h3>
                  <p className="solve-card__body">{c.body}</p>
                </div>
              </Rv>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Services */}
      <section id="services" className="section section--white">
        <div className="container">
          <Rv>
            <div className="section-head">
              <Eyebrow>What we offer</Eyebrow>
              <h2 className="heading heading--lg section-head__title">
                Services, organised by who you need
              </h2>
              <p className="section-head__lead">
                Care is grouped by specialty tier, with one clear price per
                consultation — and a dedicated track for people on the move.
              </p>
            </div>
          </Rv>
          <div className="grid grid--3 grid--services">
            {services.map((s, i) => (
              <Rv key={s.title} delay={i * 50}>
                <div
                  className={`service-card${s.featured ? " service-card--featured" : ""}`}
                >
                  {s.featured && <div className="service-card__glow" />}
                  <span className="service-card__tier">{s.tier}</span>
                  <h4 className="service-card__title">{s.title}</h4>
                  <p className="service-card__body">{s.body}</p>
                </div>
              </Rv>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Trust */}
      <section id="trust" className="section section--bg">
        <div className="container">
          <Rv>
            <div className="section-head">
              <Eyebrow>Trust, by design</Eyebrow>
              <h2 className="heading heading--lg section-head__title">
                Built on Trust. Designed for Better Care.
              </h2>
              <p className="section-head__lead">
                At Humancare Connect, trust is at the heart of every
                consultation. We create a healthcare experience where patients
                feel confident, and healthcare professionals are empowered to
                deliver their best care.
              </p>
            </div>
          </Rv>

          <div className="trust-grid">
            {/* Patient trust */}
            <Rv>
              <div className="trust-panel">
                <PhotoSlot
                  label="Reassured Patient"
                  image={PatientTrustImg}
                  variant="blue"
                  className="photo-slot--panel photo-slot--no-sheen"
                />
                <div className="trust-panel__text">
                  <h3 className="trust-panel__title">
                    Patients Feel Confident
                  </h3>
                  <p className="trust-panel__body">
                    From verified healthcare professionals to transparent
                    consultation pricing and secure virtual visits, we ensure
                    every patient knows who they are connecting with and what to
                    expect before their care begins.
                  </p>
                </div>
              </div>
            </Rv>

            {/* Doctor satisfaction */}
            <Rv delay={80}>
              <div className="trust-panel">
                <div className="trust-panel__text trust-panel__text--first">
                  <h3 className="trust-panel__title">
                    Healthcare Professionals Deliver Their Best
                  </h3>
                  <p className="trust-panel__body">
                    Our platform allows doctors to focus on what matters most —
                    providing quality patient care. With a streamlined virtual
                    healthcare experience and a trusted care environment,
                    healthcare professionals can deliver personalised medical
                    support with confidence.
                  </p>
                </div>
                <PhotoSlot
                  label="Doctor at Work"
                  image={DoctorTrustImg}
                  variant="gold"
                  className="photo-slot--panel photo-slot--no-sheen"
                />
              </div>
            </Rv>

            {/* Privacy — full width */}
            <Rv delay={120} className="trust-privacy-wrap">
              <div className="trust-privacy">
                <div className="trust-privacy__glow" />
                <div className="trust-privacy__icon">
                  <svg
                    width="30"
                    height="30"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="4" y="11" width="16" height="10" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                </div>
                <div className="trust-privacy__text">
                  <h3>Your Privacy. Our Priority.</h3>
                  <p>
                    At Humancare Connect, we understand that your health
                    information is personal and deserves the highest level of
                    protection. That's why our virtual healthcare platform is
                    built with secure technology, strict privacy practices, and
                    a commitment to protecting patient confidentiality.
                  </p>
                  <p style={{ marginTop: 10 }}>
                    From secure online doctor consultations to protected medical
                    records, we are dedicated to providing a safe and trusted
                    digital healthcare experience where your privacy always
                    comes first.
                  </p>
                </div>
                <div className="trust-privacy__badges">
                  {["GDPR", "HIPAA-aligned", "Encrypted"].map((b) => (
                    <span key={b} className="badge">
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            </Rv>
          </div>
        </div>
      </section>

      {/* 9. Contact */}
      <section id="contact" className="section section--white">
        <div className="container">
          <div className="contact-grid">
            <Rv>
              <Eyebrow>Where to find us</Eyebrow>
              <h2 className="heading heading--md contact__title">
                Get in touch
              </h2>
              <p className="contact__lead">
                Whether you're looking for trusted online healthcare, a
                healthcare professional interested in joining our network, or an
                organization exploring virtual healthcare solutions, our team is
                here to help.
                <br />
                <br />
                Get in touch with Humancare Connect and discover how we're
                making quality healthcare more accessible, connected, and
                patient-centred.
              </p>
            </Rv>
            <Rv delay={80}>
              <div className="address-list">
                {offices.map((addr) => (
                  <div key={addr.label} className="address-card">
                    <div className="address-card__label">{addr.label}</div>
                    <h4 className="address-card__name">{addr.name}</h4>
                    <p className="address-card__lines">
                      {addr.lines.map((l) => (
                        <span key={l}>
                          {l}
                          <br />
                        </span>
                      ))}
                      <a
                        href={`mailto:${addr.email}`}
                        className="address-card__email"
                      >
                        {addr.email}
                      </a>
                    </p>
                  </div>
                ))}
              </div>
            </Rv>
          </div>
        </div>
      </section>
    </div>
    </>
  );
}
