import {
  ShieldCheck,
  ClipboardList,
  Database,
  FileSignature,
  Scale,
  Lock,
  ShieldAlert,
  Mail,
  MapPin,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

const privacyTableData = [
  {
    area: "Identifiers",
    description: "Name, email, IP address, account username",
    retention: "Collected",
    control: "Yes",
  },
  {
    area: "Customer Records",
    description: "Account information and payment information",
    retention: "Collected",
    control: "Yes",
  },
  {
    area: "Protected Classifications",
    description: "Age and sex (if provided)",
    retention: "Limited",
    control: "Limited",
  },
  {
    area: "Commercial Information",
    description: "Services purchased and consultation history",
    retention: "Collected",
    control: "Yes",
  },
  {
    area: "Internet Activity",
    description: "Cookies, browsing activity, log data",
    retention: "Collected",
    control: "Yes",
  },
  {
    area: "Geolocation Data",
    description: "State or city information",
    retention: "Collected",
    control: "Yes",
  },
  {
    area: "Professional Information",
    description: "Provider credentials",
    retention: "Providers Only",
    control: "Limited",
  },
  {
    area: "Sensitive Information",
    description: "Health information governed by HIPAA",
    retention: "HIPAA Protected",
    control: "Limited",
  },
];
const managementItems = [
  {
    label: "Account settings",
    text: "Update or delete personal information directly from your profile dashboard.",
  },
  {
    label: "Communication opt-out",
    text: "Unsubscribe from marketing emails at any time using the link in any email we send.",
  },
  {
    label: "Cookie preferences",
    text: "Manage non-essential cookies via our cookie banner or your browser settings.",
  },
  {
    label: "Data deletion request",
    text: (
      <>
        Submit a formal erasure request by emailing{" "}
        <a
          href="mailto:support@humancareconnect.co"
          className="text-blue-600 hover:underline"
        >
          support@humancareconnect.co
        </a>
        .
      </>
    ),
  },
];

function ControlBadge({ value }) {
  const styles = {
    Yes: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Limited: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span
      className={`inline-flex items-center text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
        styles[value] ?? "bg-slate-50 text-slate-600 border-slate-200"
      }`}
    >
      {value}
    </span>
  );
}

function SectionCard({ icon: Icon, title, children }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: "16px",
        padding: "28px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          paddingBottom: "20px",
          marginBottom: "20px",
          borderBottom: "1px solid #f1f5f9",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            flexShrink: 0,
            borderRadius: "10px",
            background: "#f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#64748b",
          }}
        >
          <Icon size={17} strokeWidth={1.75} />
        </div>
        <h2
          style={{
            fontSize: "16px",
            fontWeight: 600,
            color: "#0f172a",
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

export default function CCPA() {
  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        background: "#f1f5f9",
        fontFamily: "system-ui, -apple-system, sans-serif",
        boxSizing: "border-box",
      }}
    >
      {/* ── Banner — */}
      <div
        style={{
          width: "100%",
          background: "#fff",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div
          style={{ maxWidth: "1200px", margin: "0 auto", padding: "28px 28px" }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#94a3b8",
              background: "#f1f5f9",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              padding: "4px 10px",
              margin: "80px 0 12px",
            }}
          >
            <ShieldCheck size={11} />
            HUMANCARE CONNECT, INC
          </div>
          <h1
            style={{
              fontSize: "26px",
              fontWeight: 700,
              color: "#0f172a",
              margin: "15px 0 4px",
              letterSpacing: "-0.02em",
            }}
          >
            California Consumer Privacy Act (CCPA) California Privacy Rights
            Notice
          </h1>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
            {" "}
            Effective Date: June 8, 2026 | Last Updated: June 8, 2026{" "}
          </p>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <div
          style={{
            width: "100%",
            maxWidth: "750px",
            padding: "36px 24px 60px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Notice */}
          <div
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "14px",
              padding: "18px 22px",
              fontSize: "14px",
              color: "#1e40af",
              lineHeight: 1.7,
            }}
          >
            This California Privacy Rights Notice applies to California
            residents and supplements our Privacy Policy in accordance with the
            California Consumer Privacy Act (CCPA), California Privacy Rights
            Act (CPRA), and CalOPPA.
          </div>

          {/* Privacy Rights */}
          <SectionCard icon={ClipboardList} title="Scope and Applicability">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              This California Privacy Rights Notice applies to California
              residents and supplements our Privacy Policy.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              It explains your rights regarding personal information, how we
              collect, use, disclose, and protect that information, and how you
              may exercise those rights.
            </p>

            <div
              style={{
                background: "#fefce8",
                border: "1px solid #fde68a",
                borderRadius: "12px",
                padding: "16px",
                marginTop: "16px",
              }}
            >
              <strong>Important:</strong> Certain information classified as
              Protected Health Information (PHI) under HIPAA is exempt from CCPA
              requirements.
            </div>
          </SectionCard>

          {/* Information We Collect */}
          <SectionCard icon={Database} title="Information we collect">
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                lineHeight: 1.8,
                margin: "0 0 20px",
              }}
            >
              We collect only what's necessary to deliver safe, effective
              healthcare coordination services.
            </p>

            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                overflow: "hidden",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "13px",
                  tableLayout: "fixed",
                }}
              >
                <colgroup>
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "44%" }} />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "12%" }} />
                </colgroup>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Area", "Description", "Retention", "Control"].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            padding: "10px 14px",
                            fontSize: "11px",
                            fontWeight: 600,
                            letterSpacing: "0.07em",
                            textTransform: "uppercase",
                            color: "#94a3b8",
                            borderBottom: "1px solid #e2e8f0",
                          }}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {privacyTableData.map((row, i) => (
                    <tr
                      key={i}
                      style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}
                    >
                      <td
                        style={{
                          padding: "12px 14px",
                          borderBottom: "1px solid #f1f5f9",
                          fontWeight: 600,
                          color: "#1e293b",
                          verticalAlign: "top",
                          fontSize: "13px",
                        }}
                      >
                        {row.area}
                      </td>
                      <td
                        style={{
                          padding: "12px 14px",
                          borderBottom: "1px solid #f1f5f9",
                          color: "#64748b",
                          verticalAlign: "top",
                          lineHeight: 1.6,
                          fontSize: "13px",
                        }}
                      >
                        {row.description}
                      </td>
                      <td
                        style={{
                          padding: "12px 14px",
                          borderBottom: "1px solid #f1f5f9",
                          color: "#64748b",
                          verticalAlign: "top",
                          fontSize: "13px",
                        }}
                      >
                        {row.retention}
                      </td>
                      <td
                        style={{
                          padding: "12px 14px",
                          borderBottom: "1px solid #f1f5f9",
                          verticalAlign: "top",
                        }}
                      >
                        <ControlBadge value={row.control} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p
              style={{
                fontSize: "12px",
                color: "#94a3b8",
                marginTop: "12px",
                lineHeight: 1.6,
              }}
            >
              We do not sell your personal data to third parties and do not use
              data brokers.
            </p>
          </SectionCard>

          {/* How We Protect */}
          <SectionCard icon={Database} title="How We Use Personal Information">
            <p style={{ color: "#64748b", lineHeight: 1.9 }}>
              • Providing and operating telehealth services
              <br />
              • Processing payments and managing accounts
              <br />
              • Verifying provider credentials
              <br />
              • Communicating service-related information
              <br />
              • Improving Platform functionality and performance
              <br />
              • Detecting fraud and security threats
              <br />• Complying with legal obligations
            </p>

            <div
              style={{
                marginTop: "16px",
                padding: "16px",
                borderRadius: "12px",
                background: "#ecfdf5",
                border: "1px solid #bbf7d0",
                color: "#166534",
              }}
            >
              We do not sell personal information and do not use personal
              information for behavioral advertising.
            </div>
          </SectionCard>

          {/* Managing Preferences */}
          <SectionCard
            icon={ShieldAlert}
            title="Disclosure of Personal Information"
          >
            <p style={{ color: "#64748b", lineHeight: 1.9 }}>
              We may disclose personal information to:
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.9 }}>
              • Service providers such as payment processors, communication
              platforms, and cloud infrastructure providers
              <br />
              • Healthcare providers facilitating consultations
              <br />• Law enforcement or government agencies when required by
              law
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              We do not sell personal information and do not share personal
              information for cross-context behavioral advertising.
            </p>
          </SectionCard>
          {/*  */}

          <SectionCard icon={Lock} title="Your California Privacy Rights">
            <p style={{ color: "#64748b", lineHeight: 1.9 }}>
              • Right to Know what information we collect and disclose
              <br />
              • Right to Delete personal information (subject to legal
              exceptions)
              <br />
              • Right to Correct inaccurate information
              <br />
              • Right to Opt-Out of Sale or Sharing (not applicable because we
              do not sell data)
              <br />
              • Right to Limit Use of Sensitive Personal Information
              <br />• Right to Non-Discrimination for exercising privacy rights
            </p>
          </SectionCard>

          {/*  */}
          <SectionCard icon={ShieldCheck} title="HIPAA Exemption">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Personal information that constitutes Protected Health Information
              (PHI) under HIPAA is exempt from CCPA.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Health information created, received, or maintained in connection
              with medical consultations is governed by HIPAA rather than CCPA.
            </p>
          </SectionCard>
          {/*  */}
          <SectionCard icon={FileSignature} title="How to Exercise Your Rights">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              To submit a verifiable consumer request:
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.9 }}>
              • Email: support@humancareconnect.co
              <br />
              • Subject Line: "California Privacy Request"
              <br />• Include your full name, account email, and request details
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              We will verify your identity before processing requests and
              generally respond within 45 days.
            </p>
          </SectionCard>

          {/*  */}
          <SectionCard icon={Scale} title="Authorized Agents">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              You may designate an authorized agent to submit requests on your
              behalf.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              The authorized agent must provide written permission signed by
              you, and we may require identity verification before processing
              the request.
            </p>
          </SectionCard>
          {/*  */}
          <SectionCard icon={AlertTriangle} title="Shine the Light">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              California Civil Code Section 1798.83 allows California residents
              to request information regarding disclosure of personal
              information for direct marketing purposes.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              We do not disclose personal information to third parties for
              direct marketing purposes.
            </p>
          </SectionCard>
          {/*  */}
          <SectionCard icon={ShieldAlert} title="Do Not Track">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Our Platform currently does not respond to browser Do Not Track
              (DNT) signals.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Please refer to our Cookie Policy for additional information
              regarding tracking technologies.
            </p>
          </SectionCard>

          <SectionCard icon={RefreshCw} title="Updates">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              We review and update this California Privacy Rights Notice at
              least once every 12 months.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              The Last Updated date at the top of this page reflects the most
              recent revision.
            </p>
          </SectionCard>
          {/* Contact */}

          <SectionCard icon={Mail} title="California Privacy Contact">
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                lineHeight: 1.8,
                margin: "0 0 20px",
              }}
            >
              Privacy inquiries from California residents may be directed to:
            </p>

            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "20px",
              }}
            >
              <p>
                <strong>Email:</strong> support@humancareconnect.co
              </p>

              <p style={{ marginTop: "16px" }}>
                <strong>Humancare Connect, Inc.</strong>
                <br />
                4 Peddlers Row, 1091
                <br />
                Newark, DE 19702, USA
              </p>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
