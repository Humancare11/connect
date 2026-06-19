import "./PrivacyConcerns.css";

const privacyTableData = [
  {
    area: "Account Information",
    description:
      "Name, email address, login credentials, and profile details used to manage your account.",
    retention: "Account lifetime + 2 years",
    control: "Yes",
  },
  {
    area: "Medical Information",
    description:
      "Health records, diagnoses, and treatment data stored securely in our databases, never in cookies.",
    retention: "Up to 7 years",
    control: "Limited",
  },
  {
    area: "Communication Preferences",
    description:
      "Email and notification settings to personalize how we contact you.",
    retention: "Up to 1 year",
    control: "Yes",
  },
  {
    area: "Analytics Data",
    description:
      "Anonymized usage patterns collected via Google Analytics to improve platform experience.",
    retention: "Up to 2 years",
    control: "Yes",
  },
];

const sections = [
  {
    number: 1,
    title: "Understanding Your Privacy Rights",
    content: (
      <p className="pc-text">
        You have the right to access, correct, or delete your personal
        information at any time. Under applicable data protection laws, you may
        also request restriction of processing, object to certain uses, and
        exercise data portability. Humancare Connect is committed to honoring
        these rights promptly and transparently.
      </p>
    ),
  },
  {
    number: 2,
    title: "Information We Collect",
    content: (
      <>
        <p className="pc-text pc-text-mb">
          We collect only the information necessary to deliver safe, effective
          healthcare coordination services. This includes account details you
          provide, health-related data shared through the platform, and
          technical data from your device interactions.
        </p>

        {/* Table */}
        <div className="pc-table-wrap">
          <table className="pc-table">
            <thead>
              <tr>
                <th>Privacy Area</th>
                <th>Description</th>
                <th className="pc-nowrap">Retention Period</th>
                <th>User Control</th>
              </tr>
            </thead>
            <tbody>
              {privacyTableData.map((row, i) => (
                <tr
                  key={i}
                  className={i % 2 === 0 ? "pc-row-even" : "pc-row-odd"}
                >
                  <td className="pc-cell-area">{row.area}</td>
                  <td className="pc-cell-muted">{row.description}</td>
                  <td className="pc-cell-muted pc-cell-nowrap">
                    {row.retention}
                  </td>
                  <td>
                    <span
                      className={
                        "pc-pill " +
                        (row.control === "Yes"
                          ? "pc-pill-yes"
                          : "pc-pill-limited")
                      }
                    >
                      {row.control}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="pc-footnote">
          We do not sell your personal data to third parties. We do not use data
          brokers.
        </p>
      </>
    ),
  },
  {
    number: 3,
    title: "How We Protect Your Information",
    content: (
      <p className="pc-text">
        Humancare Connect employs industry-standard security measures including
        AES-256 encryption at rest, TLS 1.3 for data in transit, and strict
        role-based access controls. Our systems undergo regular third-party
        audits and penetration testing to ensure your data remains protected at
        all times. Protected Health Information (PHI) is{" "}
        <strong className="pc-strong">never</strong> stored in cookies or
        browser storage.
      </p>
    ),
  },
  {
    number: 4,
    title: "Managing Privacy Preferences",
    content: (
      <ul className="pc-list">
        {[
          {
            label: "Account Settings:",
            text: "Update or delete personal information directly from your profile dashboard.",
          },
          {
            label: "Communication Opt-Out:",
            text: "Unsubscribe from marketing emails at any time using the link in any email we send.",
          },
          {
            label: "Cookie Preferences:",
            text: "Manage non-essential cookies via our cookie banner or browser settings.",
          },
          {
            label: "Data Deletion Request:",
            text: "Submit a formal erasure request by emailing privacy@humancareconnect.com.",
          },
        ].map((item, i) => (
          <li key={i} className="pc-list-item">
            <span className="pc-list-dot" />
            <span className="pc-list-text">
              <span className="pc-list-label">{item.label}</span> {item.text}
            </span>
          </li>
        ))}
      </ul>
    ),
  },
  {
    number: 5,
    title: "Contact & Privacy Requests",
    content: (
      <>
        <p className="pc-text pc-text-mb">
          If you have questions about this policy or wish to exercise your
          privacy rights, please reach out to our dedicated Privacy Team. We
          respond to all verified requests within 30 days.
        </p>

        {/* Contact card */}
        <div className="pc-contact-card">
          <h4 className="pc-contact-title">Privacy Questions</h4>
          <div className="pc-contact-rows">
            <p className="pc-contact-row">
              <span className="pc-contact-label">Email</span>
              <a
                href="mailto:privacy@humancareconnect.com"
                className="pc-contact-link"
              >
                privacy@humancareconnect.com
              </a>
            </p>
            <p className="pc-contact-row">
              <span className="pc-contact-label">Address</span>
              <span>131 Continental Dr, Suite 305, Newark, DE 19713</span>
            </p>
          </div>
        </div>
      </>
    ),
  },
];

function SectionBlock({ number, title, content }) {
  return (
    <section className="pc-section">
      <div className="pc-section-head">
        <div className="pc-section-number">{number}</div>
        <h2 className="pc-section-title">{title}</h2>
      </div>
      <hr className="pc-section-divider" />
      <div>{content}</div>
    </section>
  );
}

export default function PrivacyConcerns() {
  return (
    <div className="pc-page">
      {/* Hero Banner */}
      <header className="pc-hero">
        <span className="pc-hero-badge">Legal</span>
        <h1 className="pc-hero-title">Privacy Concerns</h1>
        <p className="pc-hero-meta">
          Effective: June 8, 2026&nbsp;&nbsp;|&nbsp;&nbsp;Version 1.0
        </p>
      </header>

      {/* Main Content */}
      <main className="pc-main">
        <div className="pc-container">
          <div className="pc-notice">
            This Privacy Concerns page explains how Humancare Connect handles
            privacy-related requests, user concerns, personal information
            protection, and data management practices. By using our Platform,
            you consent to our privacy practices as described here.
          </div>

          {sections.map((s) => (
            <SectionBlock
              key={s.number}
              number={s.number}
              title={s.title}
              content={s.content}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
