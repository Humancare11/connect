import "./terms.css";

const SECTIONS = [
  {
    id: "acceptance",
    title: "1. Acceptance of Terms",
    body: [
      "By accessing or using the Humancare platform, website, or any associated services (collectively, the \"Services\"), you confirm that you are at least 18 years of age, have read and understood these Terms and Conditions, and agree to be bound by them in their entirety.",
      "If you are accessing the Services on behalf of an organisation, you represent and warrant that you have the authority to bind that organisation to these Terms, and references to \"you\" shall include both you individually and that organisation.",
      "Humancare reserves the right to modify these Terms at any time. Continued use of the Services following the posting of changes constitutes your acceptance of such changes. We will endeavour to notify registered users of material changes via email.",
    ],
  },
  {
    id: "services",
    title: "2. Description of Services",
    body: [
      "Humancare provides a digital corporate healthcare platform that facilitates access to licensed medical professionals, wellness resources, prescription management, and HR health analytics tools. The Services are intended for use by corporate clients and their designated employees.",
      "Our platform connects users with independent, licensed healthcare practitioners. Humancare is not a healthcare provider, hospital, or insurance company. The medical professionals accessible through our platform operate independently and are solely responsible for the medical care they provide.",
      "The Services may include teleconsultation, mental health support, digital prescriptions, absence management tools, and health reporting dashboards. Specific services available to you depend on your organisation's subscription plan.",
    ],
  },
  {
    id: "accounts",
    title: "3. User Accounts & Responsibilities",
    body: [
      "Access to the Services requires the creation of an account using credentials provided by your employing organisation. You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account.",
      "You agree to: (a) provide accurate, current, and complete information; (b) notify Humancare immediately of any unauthorised use of your account; (c) use the Services only for lawful purposes and in compliance with all applicable local, national, and international laws.",
      "Humancare reserves the right to suspend or terminate accounts that violate these Terms, engage in fraudulent activity, or misuse the platform in any manner that may harm other users or the integrity of our Services.",
    ],
  },
  {
    id: "medical",
    title: "4. Medical Disclaimer",
    body: [
      "The Services provide access to licensed healthcare professionals for informational and consultative purposes. Nothing provided through the platform constitutes emergency medical care. In the event of a medical emergency, you must contact your local emergency services immediately.",
      "Medical information provided through the Services is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.",
      "Humancare does not guarantee specific medical outcomes. Results may vary based on individual health conditions, compliance with treatment recommendations, and other factors beyond our control.",
    ],
  },
  {
    id: "ip",
    title: "5. Intellectual Property",
    body: [
      "All content, features, and functionality of the Humancare platform — including but not limited to text, graphics, logos, icons, software, and data compilations — are owned by Humancare or its licensors and are protected by applicable intellectual property laws.",
      "You are granted a limited, non-exclusive, non-transferable licence to access and use the Services for their intended purpose. This licence does not include any right to reproduce, modify, distribute, or create derivative works from any part of the Services.",
      "Any feedback, suggestions, or ideas you provide regarding the Services may be used by Humancare without obligation to compensate you, and you assign all rights in such feedback to Humancare.",
    ],
  },
  {
    id: "liability",
    title: "6. Limitation of Liability",
    body: [
      "To the fullest extent permitted by applicable law, Humancare and its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of, or inability to use, the Services.",
      "Humancare's total aggregate liability to you for any claims arising from or related to the Services shall not exceed the total fees paid by your organisation in the twelve (12) months immediately preceding the claim.",
      "Some jurisdictions do not allow the exclusion of certain warranties or limitation of liability, so some of the above limitations may not apply to you. In such cases, Humancare's liability will be limited to the greatest extent permitted by applicable law.",
    ],
  },
  {
    id: "termination",
    title: "7. Termination",
    body: [
      "Humancare reserves the right to suspend or terminate your access to the Services at any time, with or without cause or notice, including in cases where: your employing organisation's subscription has lapsed; you have violated these Terms; or continued access would pose a legal, security, or reputational risk to Humancare.",
      "Upon termination, your right to use the Services will immediately cease. Provisions of these Terms that by their nature should survive termination shall survive, including ownership provisions, warranty disclaimers, indemnity, and limitations of liability.",
    ],
  },
  {
    id: "governing",
    title: "8. Governing Law & Dispute Resolution",
    body: [
      "These Terms shall be governed by and construed in accordance with the laws of the State of New York, United States, without regard to its conflict of law principles. Any disputes arising from these Terms or the Services shall be resolved through binding arbitration in New York, NY, in accordance with the rules of the American Arbitration Association.",
      "Notwithstanding the above, either party may seek injunctive or other equitable relief in any court of competent jurisdiction to prevent the actual or threatened misappropriation of intellectual property rights.",
      "If any provision of these Terms is found to be unenforceable, the remaining provisions shall continue in full force and effect.",
    ],
  },
];

export default function Terms() {
  return (
    <div className="terms-page">
      <section className="page-hero">
        <div className="page-hero__inner">
          <p className="page-hero__eyebrow">Legal</p>
          <h1 className="page-hero__title">Terms & Conditions</h1>
          <p className="page-hero__desc">Please read these terms carefully before using the Humancare platform and services.</p>
        </div>
      </section>

      <div className="page-body">
        <div className="legal-layout">
          <aside className="legal-sidebar">
            <div className="legal-sidebar__inner hc-card">
              <p className="legal-sidebar__label">On This Page</p>
              <nav className="legal-nav">
                {SECTIONS.map((s) => (
                  <a key={s.id} href={`#${s.id}`} className="legal-nav__link">{s.title}</a>
                ))}
              </nav>
              <div className="legal-sidebar__meta">
                <p className="legal-meta__item"><span>Effective:</span> 1 January 2025</p>
                <p className="legal-meta__item"><span>Revised:</span> 1 March 2025</p>
              </div>
            </div>
          </aside>

          <main className="legal-main">
            <div className="legal-notice hc-card">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p>These Terms & Conditions constitute a legally binding agreement between you and Humancare Inc. By using our Services you agree to all terms stated herein.</p>
            </div>

            {SECTIONS.map((s) => (
              <section key={s.id} id={s.id} className="legal-section">
                <h2 className="legal-section__title">{s.title}</h2>
                {s.body.map((p, i) => (
                  <p key={i} className="legal-section__body">{p}</p>
                ))}
              </section>
            ))}

            <div className="legal-contact hc-card">
              <h3 className="legal-contact__heading">Questions about these terms?</h3>
              <p className="legal-contact__body">If you have any questions about these Terms & Conditions, please contact our legal team.</p>
              <a href="/contact" className="btn-primary">Contact Us</a>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}