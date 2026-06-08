import "./privacy.css";

const SECTIONS = [
  {
    id: "overview",
    title: "1. Overview",
    body: [
      "Humancare Inc. (\"Humancare\", \"we\", \"us\", or \"our\") is committed to protecting the privacy and security of your personal information. This Privacy Policy describes how we collect, use, disclose, and safeguard your information when you access or use our corporate healthcare platform and related services.",
      "We operate in compliance with applicable data protection laws, including the Health Insurance Portability and Accountability Act (HIPAA), the General Data Protection Regulation (GDPR), and the California Consumer Privacy Act (CCPA), where applicable.",
      "By using our Services, you consent to the data practices described in this Privacy Policy. If you do not agree with our practices, please do not use our Services.",
    ],
  },
  {
    id: "collect",
    title: "2. Information We Collect",
    body: [
      "Account & Identity Information: When you register, we collect your name, email address, employee ID, and corporate credentials provided by your employer. This information is used solely to authenticate your identity and manage your account.",
      "Health & Medical Information: In connection with teleconsultation and medical services, we may collect health history, symptoms, diagnoses, prescriptions, and other Protected Health Information (PHI) as defined by HIPAA. This information is collected only with your explicit consent.",
      "Usage & Technical Data: We automatically collect certain technical information, including IP address, browser type, device identifiers, session duration, and features accessed. This data helps us improve platform performance, detect security threats, and analyse usage patterns.",
      "Communication Data: If you contact us directly, we may retain records of those communications, including email content, support tickets, and feedback submissions, to improve our services and respond to your enquiries.",
    ],
  },
  {
    id: "use",
    title: "3. How We Use Your Information",
    body: [
      "We use the information we collect to: (a) deliver, maintain, and improve the Services; (b) facilitate medical consultations and coordinate care between you and healthcare providers; (c) send service-related communications, including appointment confirmations and prescription notifications; (d) comply with legal obligations and enforce our agreements.",
      "We do not sell your personal information to third parties. We do not use your health information for advertising or marketing purposes without your explicit consent.",
      "Aggregate, de-identified data may be used for research, analytics, and business intelligence purposes. This data cannot be used to identify you individually.",
    ],
  },
  {
    id: "sharing",
    title: "4. Information Sharing & Disclosure",
    body: [
      "Healthcare Providers: We share your health information with the licensed medical professionals you consult with through our platform. These professionals are bound by medical confidentiality obligations and applicable law.",
      "Corporate Clients: Your employer (our corporate client) receives aggregate, anonymised health utilisation reports. Your individual health records and consultation details are never shared with your employer without your explicit consent.",
      "Service Providers: We engage third-party vendors to help operate our platform (e.g., cloud infrastructure, payment processing). These vendors are bound by data processing agreements and are prohibited from using your data for their own purposes.",
      "Legal Obligations: We may disclose information where required by law, court order, or governmental authority, or where we believe disclosure is necessary to protect the rights, property, or safety of Humancare, our users, or the public.",
    ],
  },
  {
    id: "security",
    title: "5. Data Security",
    body: [
      "We implement industry-standard technical and organisational security measures to protect your information against unauthorised access, loss, destruction, or alteration. These measures include AES-256 encryption at rest, TLS 1.3 encryption in transit, multi-factor authentication, and regular third-party security audits.",
      "Humancare maintains SOC 2 Type II certification, demonstrating our commitment to the highest standards of data security, availability, and confidentiality.",
      "While we take every reasonable precaution to protect your data, no method of transmission over the internet or electronic storage is 100% secure. We encourage you to use a strong, unique password and to contact us immediately if you suspect any unauthorised access to your account.",
    ],
  },
  {
    id: "rights",
    title: "6. Your Rights & Choices",
    body: [
      "Depending on your jurisdiction, you may have the following rights with respect to your personal information: the right to access and receive a copy of your data; the right to rectify inaccurate information; the right to erasure (\"right to be forgotten\"); the right to restrict or object to processing; and the right to data portability.",
      "HIPAA Rights: As a patient, you have the right to access your medical records, request amendments, and receive an accounting of disclosures. To exercise these rights, please contact your designated organisational administrator or our Privacy Officer.",
      "To exercise any of your rights, please submit a request to privacy@humancare.com. We will respond to all verified requests within 30 days, or within the timeframe required by applicable law.",
    ],
  },
  {
    id: "retention",
    title: "7. Data Retention",
    body: [
      "We retain personal information for as long as your account is active or as needed to provide Services, comply with legal obligations, resolve disputes, and enforce our agreements. Medical records are retained in accordance with applicable healthcare regulations, which typically require retention for a minimum of seven (7) years.",
      "When data is no longer required, we securely delete or anonymise it using industry-standard methods. Anonymised or aggregated data may be retained indefinitely for analytics and research purposes.",
    ],
  },
  {
    id: "international",
    title: "8. International Data Transfers",
    body: [
      "Humancare operates globally and may transfer your information to countries outside your home jurisdiction, including the United States. Where we transfer personal data from the European Economic Area (EEA), we do so in accordance with GDPR requirements, using Standard Contractual Clauses or other approved transfer mechanisms.",
      "By using our Services, you acknowledge that your information may be processed in countries with different data protection standards than your own country of residence.",
    ],
  },
  {
    id: "contact",
    title: "9. Contact & Data Protection Officer",
    body: [
      "If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact our Privacy Officer at: privacy@humancare.com, or by post at Humancare Inc., 350 Fifth Avenue, New York, NY 10118, United States.",
      "EU/EEA residents may also lodge a complaint with their local data protection supervisory authority if they believe their rights under the GDPR have been violated.",
    ],
  },
];

export default function Privacy() {
  return (
    <div className="privacy-page">
      <section className="page-hero">
        <div className="page-hero__inner">
          <p className="page-hero__eyebrow">Legal</p>
          <h1 className="page-hero__title">Privacy Policy</h1>
          <p className="page-hero__desc">We are committed to protecting your privacy. Learn how we collect, use, and safeguard your information.</p>
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
            <div className="privacy-badges">
              <div className="privacy-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                HIPAA Compliant
              </div>
              <div className="privacy-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                GDPR Ready
              </div>
              <div className="privacy-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                SOC 2 Certified
              </div>
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
              <h3 className="legal-contact__heading">Privacy questions or requests?</h3>
              <p className="legal-contact__body">Contact our Privacy Officer directly at privacy@humancare.com or use our contact form.</p>
              <a href="/contact" className="btn-primary">Contact Our Privacy Team</a>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}