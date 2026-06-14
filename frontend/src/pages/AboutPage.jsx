import { useEffect, useRef, useState } from "react";
import "./AboutPage.css";

/* ─── Reusable Hooks ─── */
function useRevealObserver() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setVisible(true); return; }
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); io.unobserve(el); } },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, visible];
}

function useCounterObserver(targets) {
  const ref = useRef(null);
  const [counts, setCounts] = useState(targets.map(() => 0));
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setCounts(targets); return; }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const dur = 1500;
        const start = performance.now();
        function tick(now) {
          const p = Math.min((now - start) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          setCounts(targets.map((t) => Math.round(eased * t)));
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []); // eslint-disable-line
  return [ref, counts];
}

/* ─── Shared primitives ─── */
function Eyebrow({ children, light }) {
  return (
    <span className={`eyebrow ${light ? "eyebrow--light" : ""}`}>
      <span className="eyebrow__dash" />
      {children}
    </span>
  );
}

function Btn({ href, ghost, children }) {
  return (
    <a href={href} className={`btn ${ghost ? "btn--ghost" : "btn--solid"}`}>
      {children}
    </a>
  );
}

function Rv({ children, className = "", delay = 0 }) {
  const [ref, visible] = useRevealObserver();
  return (
    <div
      ref={ref}
      className={`reveal ${visible ? "reveal--visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* Photo placeholder */
function PhotoSlot({ label, icon, className = "", variant = "teal" }) {
  return (
    <div className={`photo-slot photo-slot--${variant} ${className}`}>
      <div className="photo-slot__texture" />
      <div className="photo-slot__sheen" />
      <div className="photo-slot__content">
        <div className="photo-slot__icon">{icon}</div>
        <span className="photo-slot__label">{label}</span>
      </div>
    </div>
  );
}

/* Arrow connector between steps */
function ArrowIcon() {
  return (
    <svg className="step-arrow" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/* ─── SECTIONS ─── */

/* 1. Hero */
function HeroSection() {
  const [ref, visible] = useRevealObserver();
  const [ref2, visible2] = useRevealObserver();
  return (
    <section className="hero">
      <div className="hero__glow hero__glow--teal" />
      <div className="hero__glow hero__glow--gold" />
      <div className="container">
        <div className="hero__grid">
          {/* Text */}
          <div ref={ref} className={`hero__text ${visible ? "is-visible" : ""}`}>
            <Eyebrow>About Humancare Connect</Eyebrow>
            <h1 className="hero__title">
              Your health shouldn&apos;t{" "}
              <span className="hero__title-accent">stop at the border.</span>
            </h1>
            <p className="hero__lead">
              Humancare Connect is global telehealth for people who live, work, and travel across the world — and for the organizations responsible for keeping them safe.
            </p>
            <div className="hero__actions">
              <Btn href="#how">See how it works</Btn>
              <Btn href="#why" ghost>Why we started</Btn>
            </div>

            {/* trust strip */}
            <div className="trust-strip">
              {["GDPR", "HIPAA-aligned", "Verified doctors"].map((b) => (
                <div key={b} className="trust-strip__item">
                  <span className="trust-strip__dot" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Photo */}
          <div ref={ref2} className={`hero__photo ${visible2 ? "is-visible" : ""}`}>
            <div className="hero__photo-frame">
              <PhotoSlot
                label="Photo: patient on a video consult"
                variant="teal"
                className="photo-slot--portrait"
                icon={
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#223A5E" strokeWidth="1.4">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="9" cy="9" r="2.2" />
                    <path d="M21 16l-5-5L5 21" />
                  </svg>
                }
              />
            </div>
            {/* floating badge */}
            <div className="hero__badge">
              <div className="hero__badge-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0C8B7A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12l2 2 4-4" />
                  <path d="M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7l7-4z" />
                </svg>
              </div>
              <div>
                <div className="hero__badge-title">Verified specialist</div>
                <div className="hero__badge-sub">Connected in &lt; 2 min</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* 2. Why We Started */
function WhySection() {
  return (
    <section id="why" className="section section--white">
      <div className="container">
        <div className="why__grid">
          <Rv>
            <h2 className="heading heading--lg why__heading">
              Why we
              <br />
              started
            </h2>
          </Rv>
          <Rv delay={100}>
            <div>
              <p className="why__intro">
                Humancare Connect began with a simple, frustrating truth: the moment you leave your home country, your healthcare stops working.
              </p>
              <p className="why__body">
                We spent years inside global healthcare operations — telehealth, medical assistance, claims, denial management — and we kept seeing the same people fall through the cracks. The traveler stranded in a foreign hospital. The expat with no doctor who knows their history. The family abroad who couldn&apos;t tell a real clinic from a tourist trap.
              </p>
              <blockquote className="quote">
                &ldquo;The further people were from home, the easier they were to confuse, overcharge, and turn away.&rdquo;
              </blockquote>
              <p className="why__closing">
                So we built the platform we wished existed: one trusted place to reach a verified doctor, at a price you can see before you book, no matter where in the world you happen to be standing. Not a directory. A health passport.
              </p>
            </div>
          </Rv>
        </div>
      </div>
    </section>
  );
}

/* 3. Problem Section */
function ProblemSection() {
  const problems = [
    {
      num: "01",
      title: "No trusted entry point",
      body: "In an unfamiliar country, there's no way to tell a credentialed specialist from an opportunist. Patients gamble on strangers.",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0C8B7A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      ),
    },
    {
      num: "02",
      title: "Opaque, inflated pricing",
      body: "Foreigners are routinely overcharged. Costs appear after care, not before — and rarely reflect what locals pay.",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0C8B7A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1v22" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
    },
    {
      num: "03",
      title: "Care that doesn't follow you",
      body: "Records, prescriptions, and history reset at every border. Each new doctor starts from zero, in a language you may not share.",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0C8B7A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
      ),
    },
  ];
  return (
    <section className="section section--navy">
      <div className="section__glow section__glow--bl" />
      <div className="section__glow section__glow--tr" />
      <div className="container">
        <Rv>
          <Eyebrow light>The system we&apos;re fixing</Eyebrow>
        </Rv>
        <Rv delay={80}>
          <h2 className="heading heading--lg problem__title">
            Away from home, patients don&apos;t just lack care — they get{" "}
            <span className="text-gold">worked by a system</span> that wasn&apos;t built for them.
          </h2>
        </Rv>
        <div className="grid grid--3">
          {problems.map((p, i) => (
            <Rv key={p.num} delay={i * 90}>
              <div className="problem-card">
                <div className="problem-card__top">
                  <div className="problem-card__icon">{p.icon}</div>
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
  );
}

/* 4. How It Works */
function HowSection() {
  const steps = [
    { n: 1, title: "Tell us what's wrong", body: "Describe your symptom or concern. Our intent-first search points you to the right specialty — not an endless list of doctors.", color: "navy" },
    { n: 2, title: "See the price up front", body: "Get a clear, flat price for your consultation before you commit — the same fair rate wherever in the world you are.", color: "teal" },
    { n: 3, title: "Meet your verified doctor", body: "Connect by secure video with a credential-checked specialist who can advise, diagnose, and prescribe where permitted.", color: "gold" },
    { n: 4, title: "Carry your care with you", body: "Your notes, prescriptions, and history stay in one place — secure, private, and ready for your next visit anywhere.", color: "navy" },
  ];
  return (
    <section id="how" className="section section--bg">
      <div className="container">
        <Rv>
          <div className="section-head">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="heading heading--lg section-head__title">
              From &ldquo;I don&apos;t feel well&rdquo; to seen by the right doctor
            </h2>
            <p className="section-head__lead">
              No directories to dig through, no guesswork. Tell us what&apos;s wrong and we route you to a verified specialist — in four simple steps.
            </p>
          </div>
        </Rv>
        <div className="grid grid--4">
          {steps.map((s, i) => (
            <Rv key={s.n} delay={i * 90}>
              <div className="step-card">
                <div className={`step-card__num step-card__num--${s.color}`}>{s.n}</div>
                {i < steps.length - 1 && <ArrowIcon />}
                <h4 className="step-card__title">{s.title}</h4>
                <p className="step-card__body">{s.body}</p>
              </div>
            </Rv>
          ))}
        </div>
      </div>
    </section>
  );
}

/* 5. Network */
function NetworkSection() {
  const stats = [
    { t: 11, label: "Clinical categories", suffix: "" },
    { t: 30, label: "Medical specialties", suffix: "+" },
    { t: 175, label: "Conditions covered", suffix: "+" },
    { t: 3, label: "Regions served", suffix: "" },
  ];
  const [gridRef, counts] = useCounterObserver(stats.map((s) => s.t));
  const [headRef, headVisible] = useRevealObserver();
  const [regRef, regVisible] = useRevealObserver();

  const regions = [
    { name: "United States", icon: "🇺🇸" },
    { name: "Canada", icon: "🇨🇦" },
    { name: "Europe (EU)", icon: "🇪🇺" },
    { name: "Travel & Global Care", icon: "🌍" },
  ];

  return (
    <section className="section section--white">
      <div className="container">
        <div ref={headRef} className={`section-head ${headVisible ? "is-visible" : ""}`}>
          <Eyebrow>A network built like a health system</Eyebrow>
          <h2 className="heading heading--lg section-head__title">
            Strong where it matters — across borders
          </h2>
          <p className="section-head__lead">
            We don&apos;t list every doctor on earth. We build a verified, structured network organized the way medicine actually works — so the right specialist is always one step away.
          </p>
        </div>

        {/* Stats grid */}
        <div ref={gridRef} className="stats-grid">
          {stats.map((s, i) => (
            <div key={i} className="stats-cell">
              <div className="stats-cell__num">
                {counts[i]}
                {s.suffix && <span className="text-gold">{s.suffix}</span>}
              </div>
              <div className="stats-cell__label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Region chips */}
        <div ref={regRef} className={`chip-row ${regVisible ? "is-visible" : ""}`}>
          {regions.map((r) => (
            <span key={r.name} className="chip">
              <span aria-hidden="true">{r.icon}</span>
              {r.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* 6. What We Solve */
function SolveSection() {
  const cards = [
    {
      color: "teal",
      title: "Verified doctors only",
      body: "Every physician is credential-checked against official medical registries before they ever take a patient — so you never have to guess who's real.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0C8B7A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 12l2 2 4-4" /><path d="M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7l7-4z" />
        </svg>
      ),
    },
    {
      color: "gold",
      title: "One honest price",
      body: "Flat, tier-based pricing shown up front — the same whether you're a local or a visitor. No foreigner markup, no surprise bills.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C97B1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
        </svg>
      ),
    },
    {
      color: "navy",
      title: "Care across borders",
      body: "One account that works in the US, Canada, and across Europe — GDPR and HIPAA-aligned, so your care and your data move with you.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#223A5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.5 2.6 4 5.7 4 9s-1.5 6.4-4 9c-2.5-2.6-4-5.7-4-9s1.5-6.4 4-9z" />
        </svg>
      ),
    },
    {
      color: "teal",
      title: "Help, fast — anytime",
      body: "Reach the right specialty in minutes through an intent-first flow: tell us what's wrong, and we route you to the doctor who handles it.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0C8B7A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" /><circle cx="12" cy="12" r="4" />
        </svg>
      ),
    },
  ];
  return (
    <section className="section section--bg">
      <div className="container">
        <Rv>
          <div className="section-head">
            <Eyebrow>What we solve</Eyebrow>
            <h2 className="heading heading--lg section-head__title">
              Trust, restored — before, during, and after care
            </h2>
            <p className="section-head__lead">
              Every part of Humancare Connect is built to remove the uncertainty that hurts patients far from home.
            </p>
          </div>
        </Rv>
        <div className="grid grid--2">
          {cards.map((c, i) => (
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
  );
}

/* 7. Services */
function ServicesSection() {
  const services = [
    { tier: "Primary tier", title: "Everyday & primary care", body: "Common illness, infections, prescriptions, sick notes, and general health questions — your first point of contact, anywhere.", price: "$39", unit: "/ consult", featured: false },
    { tier: "Specialist tier", title: "Specialist consultations", body: "Direct access to verified specialists across dermatology, mental health, pediatrics, cardiology and more — no referral maze.", price: "$69", unit: "/ consult", featured: false },
    { tier: "Super-specialist tier", title: "Super-specialist & second opinions", body: "Complex cases and expert second opinions from senior consultants — clarity when the stakes are highest.", price: "$99", unit: "/ consult", featured: false },
    { tier: "Flagship", title: "Travel & Global Care", body: "Our differentiator: care designed for travelers, expats, and remote workers — fit-to-fly, urgent help abroad, and continuity wherever you go.", price: "Tailored", unit: "", featured: true },
    { tier: "Organizations", title: "For insurers, TPAs & assistance", body: "A teleconsultation network you can plug in — covering members across the US, Canada, and Europe with verified, compliant care.", price: "Partner", unit: "", featured: false },
    { tier: "Corporates", title: "For employers & teams", body: "Global health benefits for distributed workforces — one consistent standard of care across every country your people are in.", price: "Partner", unit: "", featured: false },
  ];
  return (
    <section id="services" className="section section--white">
      <div className="container">
        <Rv>
          <div className="section-head">
            <Eyebrow>What we offer</Eyebrow>
            <h2 className="heading heading--lg section-head__title">
              Services, organized by who you need
            </h2>
            <p className="section-head__lead">
              Care is grouped by specialty tier, with one clear price per consultation — and a dedicated track for people on the move.
            </p>
          </div>
        </Rv>
        <div className="grid grid--3 grid--services">
          {services.map((s, i) => (
            <Rv key={s.title} delay={i * 50}>
              <div className={`service-card ${s.featured ? "service-card--featured" : ""}`}>
                {s.featured && <div className="service-card__glow" />}
                <span className="service-card__tier">{s.tier}</span>
                <h4 className="service-card__title">{s.title}</h4>
                <p className="service-card__body">{s.body}</p>
                <div className="service-card__price">
                  {s.price}{" "}
                  {s.unit && <small>{s.unit}</small>}
                </div>
              </div>
            </Rv>
          ))}
        </div>
      </div>
    </section>
  );
}

/* 8. Trust */
function TrustSection() {
  return (
    <section id="trust" className="section section--bg">
      <div className="container">
        <Rv>
          <div className="section-head">
            <Eyebrow>Trust, by design</Eyebrow>
            <h2 className="heading heading--lg section-head__title">
              Care people rely on — and doctors are proud to give
            </h2>
            <p className="section-head__lead">
              Trust isn&apos;t a tagline for us. It&apos;s the product. Here&apos;s how we earn it on both sides of every consultation.
            </p>
          </div>
        </Rv>

        <div className="trust-grid">
          {/* Patient trust */}
          <Rv>
            <div className="trust-panel">
              <PhotoSlot
                label="Photo: reassured patient"
                variant="teal"
                className="photo-slot--panel"
                icon={
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#223A5E" strokeWidth="1.4">
                    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" />
                  </svg>
                }
              />
              <div className="trust-panel__text">
                <h3 className="trust-panel__title">Patients feel safe</h3>
                <p className="trust-panel__body">
                  No mystery doctors, no surprise bills, no being treated as an easy mark. People know who they&apos;re seeing and what it costs — before anything happens.
                </p>
              </div>
            </div>
          </Rv>

          {/* Doctor satisfaction */}
          <Rv delay={80}>
            <div className="trust-panel">
              <div className="trust-panel__text trust-panel__text--first">
                <h3 className="trust-panel__title">Doctors do their best work</h3>
                <p className="trust-panel__body">
                  Verified credentials, fair compensation, and patients routed by genuine need mean clinicians spend their time on care — not chasing or vetting.
                </p>
              </div>
              <PhotoSlot
                label="Photo: doctor at work"
                variant="gold"
                className="photo-slot--panel"
                icon={
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#223A5E" strokeWidth="1.4">
                    <path d="M8 2v4M16 2v4M3 9h18" /><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M9 14l2 2 4-4" />
                  </svg>
                }
              />
            </div>
          </Rv>

          {/* Privacy — full width */}
          <Rv delay={120} className="trust-privacy-wrap">
            <div className="trust-privacy">
              <div className="trust-privacy__glow" />
              <div className="trust-privacy__icon">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
              </div>
              <div className="trust-privacy__text">
                <h3>Your privacy is the foundation</h3>
                <p>
                  Health data is the most personal data there is. We treat it that way — secure handling, strict access controls, and compliance with the rules that protect you on both sides of the Atlantic.
                </p>
              </div>
              <div className="trust-privacy__badges">
                {["GDPR", "HIPAA-aligned", "Encrypted"].map((b) => (
                  <span key={b} className="badge">{b}</span>
                ))}
              </div>
            </div>
          </Rv>
        </div>
      </div>
    </section>
  );
}

/* 9. Contact */
function ContactSection() {
  return (
    <section id="contact" className="section section--white">
      <div className="container">
        <div className="contact-grid">
          <Rv>
            <Eyebrow>Where to find us</Eyebrow>
            <h2 className="heading heading--md contact__title">Get in touch</h2>
            <p className="contact__lead">
              Whether you&apos;re a patient with a question, a clinician who wants to join the network, or an organization exploring a partnership — we&apos;d love to hear from you.
            </p>
          </Rv>
          <Rv delay={80}>
            <div className="address-list">
              {[
                {
                  label: "United States",
                  name: "Humancare Connect, Inc.",
                  lines: ["4 Peddlers Row, #1091", "Newark, DE 19702, USA"],
                  email: "hello@humancareconnect.com",
                },
                {
                  label: "India",
                  name: "Humancare Worldwide Pvt Ltd",
                  lines: ["Mumbai, Maharashtra, India"],
                  email: "hello@humancareconnect.com",
                },
              ].map((addr) => (
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
                    <a href={`mailto:${addr.email}`} className="address-card__email">
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
  );
}

/* ─── ROOT EXPORT ─── */
export default function AboutPage() {
  return (
    <div className="about-page">
      <HeroSection />
      <WhySection />
      <ProblemSection />
      <HowSection />
      <NetworkSection />
      <SolveSection />
      <ServicesSection />
      <TrustSection />
      <ContactSection />
    </div>
  );
}