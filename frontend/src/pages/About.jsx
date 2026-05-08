import "./about.css";

const SERVICES = [
  {
    num: "01",
    title: "Medical Assistance",
    desc: "From finding the right specialist to navigating complex treatment pathways, we coordinate every step so you never face healthcare alone. Our team stays with you from first consultation to full recovery.",
  },
  {
    num: "02",
    title: "Emergency Coordination",
    desc: "When time matters most, we act fast. We manage emergency hospitalisation, ambulance coordination, and immediate medical access — 24 hours a day, across borders if needed.",
  },
  {
    num: "03",
    title: "Corporate Healthcare Support",
    desc: "We design and manage complete healthcare programs for organisations — covering employee medical access, policy management, wellness coordination, and real-time case reporting for HR teams.",
  },
  {
    num: "04",
    title: "Medical Tourism & Overseas Treatment",
    desc: "We arrange safe, well-coordinated treatment journeys abroad — managing hospital selection, travel logistics, accommodation, and post-treatment care so patients can focus entirely on getting better.",
  },
  {
    num: "05",
    title: "Lab & Diagnostic Services",
    desc: "Access trusted diagnostic labs and imaging centres, with seamless appointment booking, sample collection coordination, and result management — all through a single point of contact.",
  },
];

const WHO_WE_SERVE = [
  { label: "Individuals & Families", desc: "People who want a reliable healthcare partner in times of need — not a helpline, but a real team that shows up." },
  { label: "Law Firms", desc: "Supporting legal professionals and their clients with medico-legal documentation, expert coordination, and case-linked healthcare management." },
  { label: "Corporate Companies", desc: "End-to-end employee healthcare programs — designed for HR teams who want measurable, managed health support for their workforce." },
  { label: "Shipping & Maritime Companies", desc: "Specialist healthcare coordination for crew members and seafarers, including port-side medical access and repatriation support." },
  { label: "Hotels & Tourism Companies", desc: "On-call medical coordination for guests, ensuring hospitality brands can respond quickly and professionally when a health situation arises." },
  { label: "Travel Insurance Companies", desc: "Seamless backend medical assistance and claims coordination that helps insurers deliver on their promises, faster." },
];

const WHY_US = [
  { title: "Personalized Support", desc: "Every case is different. We assign dedicated coordinators who understand your situation, not a generic call centre agent reading from a script." },
  { title: "Fast Response", desc: "We move quickly. Whether it's an emergency or a scheduled procedure, we respond with urgency because delays in healthcare are never acceptable." },
  { title: "Trusted Network", desc: "Our relationships with hospitals, specialists, labs, and insurers are built on years of partnership — giving you access to quality care you can rely on." },
  { title: "End-to-End Coordination", desc: "We don't hand you a list and walk away. We manage everything — appointments, documentation, transport, follow-up — from start to finish." },
  { title: "Human-First Approach", desc: "Technology helps us work better, but it's our people who make the difference. Every interaction is led by empathy, clarity, and genuine care." },
];

const VALUES = [
  { label: "Trust", desc: "We earn it through consistent action, honest communication, and showing up — every time.", color: "teal" },
  { label: "Care", desc: "Not as a word on a wall, but as the standard we hold every interaction to, whether it's urgent or routine.", color: "primary" },
  { label: "Reliability", desc: "Our clients depend on us during vulnerable moments. We take that responsibility seriously.", color: "gold" },
  { label: "Transparency", desc: "We communicate clearly, keep you informed, and never leave you guessing about your care or your costs.", color: "teal" },
  { label: "Human Connection", desc: "Healthcare is deeply personal. We treat every person, not every case — and we never forget the difference.", color: "primary" },
];

const STATS = [
  { num: "10K+", label: "Cases Coordinated" },
  { num: "40+", label: "Countries Covered" },
  { num: "200+", label: "Partner Organisations" },
  { num: "24/7", label: "Always Available" },
];

export default function AboutUs() {
  return (
    <div className="au-page">

      {/* ── Hero ── */}
     <section>
  <div className="about-hero">
    <div className="about-hero-inner">
      <h1>About Humancare Connect</h1>
      <p>
        We are your trusted partner in healthcare support and medical coordination —
        connecting individuals and organizations to reliable treatment, diagnostics,
        emergency, and medical assistance services through one seamless network.
      </p>
    </div>
  </div>
</section>

      <div className="au-body">

        {/* ── Who We Are ── */}
        <section className="au-section au-who">
          <div className="au-who__text">
            <p className="au-eyebrow">Who We Are</p>
            <h2 className="au-heading">One connected partner for all your healthcare needs.</h2>
            <p className="au-body-text">
              Humancare Connect is a healthcare assistance and coordination company. We exist because navigating healthcare — whether for yourself, your family, or your entire workforce — is far more complex than it should be.
            </p>
            <p className="au-body-text">
              We work with individuals who need a trusted guide through treatment and recovery, and with corporate clients and partner organisations who need a reliable, managed healthcare layer for the people they're responsible for.
            </p>
            <p className="au-body-text">
              We're not a hospital. We're not an insurance company. We are the layer that connects everything — coordinating care across treatment, diagnostics, emergency response, and travel-related medical support, through one team that knows you by name.
            </p>
          </div>
          <div className="au-who__visual">
            <div className="au-who__card au-who__card--main">
              <div className="au-who__card-tag">Our Promise</div>
              <p className="au-who__card-text">"You will never have to navigate a health crisis alone. We are with you — from the first call to the final step of recovery."</p>
            </div>
            <div className="au-who__card au-who__card--secondary">
              <div className="au-who__card-tag">What makes us different</div>
              <p className="au-who__card-text">We don't just connect you to services. We coordinate them — end to end, with a dedicated team that stays accountable throughout.</p>
            </div>
          </div>
        </section>

        {/* ── Mission & Vision ── */}
        <section className="au-mv-section">
          <div className="au-mv-card au-mv-card--mission">
            <div className="au-mv-card__tag">
              <span className="au-mv-card__tag-dot au-mv-card__tag-dot--teal" />
              Our Mission
            </div>
            <h3 className="au-mv-card__heading">
              To simplify healthcare for everyone we serve — delivering fast, Personalized, and end-to-end medical coordination that individuals and organisations can trust completely.
            </h3>
            <p className="au-mv-card__body">
              We believe quality healthcare coordination shouldn't be a privilege. It should be available to anyone who needs it — regardless of complexity, location, or circumstance.
            </p>
          </div>
          <div className="au-mv-card au-mv-card--vision">
            <div className="au-mv-card__tag">
              <span className="au-mv-card__tag-dot au-mv-card__tag-dot--gold" />
              Our Vision
            </div>
            <h3 className="au-mv-card__heading">
              To be the most trusted healthcare coordination partner in the world — a name synonymous with reliability, compassion, and seamless access to care.
            </h3>
            <p className="au-mv-card__body">
              We're building a future where geography, language, and complexity are never barriers to getting the right medical help — and where every person and organisation has one dependable partner to turn to.
            </p>
          </div>
        </section>

        {/* ── What We Do ── */}
        <section className="au-section">
          <div className="au-section-header">
            <p className="au-eyebrow">What We Do</p>
            <h2 className="au-heading">End-to-end healthcare coordination, across every situation.</h2>
            <p className="au-section-sub">From routine diagnostic coordination to complex overseas treatment — we manage the details so you can focus on health.</p>
          </div>
          <div className="au-services-grid">
            {SERVICES.map((s) => (
              <div key={s.num} className="au-service-card">
                <span className="au-service-card__num">{s.num}</span>
                <h4 className="au-service-card__title">{s.title}</h4>
                <p className="au-service-card__desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Who We Serve ── */}
        <section className="au-section au-serve-section">
          <div className="au-section-header">
            <p className="au-eyebrow">Who We Serve</p>
            <h2 className="au-heading">Built for those who carry responsibility for others' health.</h2>
            <p className="au-section-sub">We partner with individuals, businesses, and organisations across sectors — each with unique healthcare needs that demand a reliable, experienced coordinator.</p>
          </div>
          <div className="au-serve-grid">
            {WHO_WE_SERVE.map((w) => (
              <div key={w.label} className="au-serve-card">
                <div className="au-serve-card__dot" />
                <h4 className="au-serve-card__label">{w.label}</h4>
                <p className="au-serve-card__desc">{w.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Why Choose Us ── */}
        <section className="au-why-section">
          <div className="au-why-left">
            <p className="au-eyebrow au-eyebrow--light">Why Choose Us</p>
            <h2 className="au-heading au-heading--light">What separates a coordinator from a true partner.</h2>
            <p className="au-body-text au-body-text--light">
              Plenty of services claim to support healthcare. Very few are actually there when things get difficult. Here's what makes Humancare Connect different.
            </p>
          </div>
          <div className="au-why-right">
            {WHY_US.map((w) => (
              <div key={w.title} className="au-why-item">
                <div className="au-why-item__icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <h4 className="au-why-item__title">{w.title}</h4>
                  <p className="au-why-item__desc">{w.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Values ── */}
        <section className="au-section">
          <div className="au-section-header">
            <p className="au-eyebrow">Our Values</p>
            <h2 className="au-heading">The principles we refuse to compromise on.</h2>
          </div>
          <div className="au-values-grid">
            {VALUES.map((v) => (
              <div key={v.label} className={`au-value-card au-value-card--${v.color}`}>
                <div className="au-value-card__accent" />
                <h4 className="au-value-card__label">{v.label}</h4>
                <p className="au-value-card__desc">{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="au-cta">
          <div className="au-cta__orb" />
          <div className="au-cta__inner">
            <p className="au-cta__eyebrow">Your healthcare. Our responsibility.</p>
            <h2 className="au-cta__heading">Ready to have a partner you can count on?</h2>
            <p className="au-cta__body">
              Whether you're an individual facing a complex health situation, a corporate looking to build a serious healthcare programme, or an organisation that needs a dependable coordination partner — Humancare Connect is ready. We don't just answer calls. We solve problems, coordinate care, and stand with you until the job is done.
            </p>
            <div className="au-cta__actions">
              <a href="/contact" className="au-cta__btn-primary">Get in Touch</a>
              <a href="/services" className="au-cta__btn-outline">Explore Our Services</a>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}