import {
  Mail,
  Lock,
  ShieldCheck,
  ShieldAlert,
  Globe,
  Bell,
  RefreshCw,
  UserCheck,
  Database,
  FileCheck,
  Share2,
  Stethoscope,
  MapPin,
} from "lucide-react";

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

export default function PatientPrivacyNotice() {
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
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "28px 150px",
          }}
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
            HUMANCARE CONNECT, INC.
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
            Patient Privacy Notice
          </h1>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
            Effective Date: 2026-06-04 | Version 1.0
          </p>
        </div>
      </div>

      {/* ── Main Content — explicitly centered with inline styles ── */}
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
            This Privacy Notice describes how Humancare Connect, Inc.
            ("Humancare Connect", "we", "us", or "our") collects, uses,
            discloses, and protects your Protected Health Information (PHI) and
            personal data when you use our telehealth platform and services.
            Please read this notice carefully.
          </div>

          {/* Privacy Rights */}
          <SectionCard icon={Lock} title="Who We Are">
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                lineHeight: 1.8,
                margin: 0,
              }}
            >
              Humancare Connect, Inc. is a telehealth platform incorporated in
              Delaware, USA, providing teleconsultation, prescription
              management, medical report handling, appointment booking, and
              wellness programs including mental health, sexual health, and
              weight management services. We operate as a HIPAA Business
              Associate and handle your PHI in accordance with applicable law.
            </p>
          </SectionCard>

          {/* Information We Collect */}
          <SectionCard icon={Database} title="What Information We Collect">
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                lineHeight: 1.8,
                margin: "0 0 20px",
              }}
            >
              We may collect and use the following categories of
              information:{" "}
            </p>
            <ul>
              <li>
                • Identity information: full name, date of birth, email address,
                phone number
              </li>
              <li>
                • Health information: symptoms, medical history relevant to your
                consultation, diagnoses, prescriptions, consultation notes,
                medical reports, lab results
              </li>
              <li>
                • Program information: information related to mental health,
                sexual health, or weight loss programs you enroll in
              </li>
              <li>
                • Payment information: payment status and invoice details (no
                medical information is stored in payment records)
              </li>
              <li>
                Technical information: IP address, device type, browser, session
                data for platform security purposes
              </li>
            </ul>
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                lineHeight: 1.8,
                margin: "0 0 20px",
              }}
            >
              We collect only the minimum information necessary to provide your
              requested service.
            </p>
          </SectionCard >
          {/* <div style={{ border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" }}>

                    {/* Privacy Rights */}
          <SectionCard icon={Lock} title="Who We Are">
            <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.8, margin: 0 }}>
              Humancare Connect, Inc. is a telehealth platform incorporated in Delaware, USA, providing teleconsultation, prescription management, medical report handling, appointment booking, and wellness programs including mental health, sexual health, and weight management services. We operate as a   Business Associate and handle your PHI in accordance with applicable law.
            </p>
          </SectionCard>

          {/* Information We Collect */}
          <SectionCard icon={Database} title="What Information We Collect">
            <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.8, margin: "0 0 20px" }}>
              We may collect and use the following categories of information: </p>
            <ul>
              <li>• Identity information: full name, date of birth, email address, phone number</li>
              <li>• Health information: symptoms, medical history relevant to your consultation, diagnoses, prescriptions, consultation notes, medical reports, lab results</li>
              <li>• Program information: information related to mental health, sexual health, or weight loss programs you enroll in</li>
              <li>• Payment information: payment status and invoice details (no medical information is stored in payment records)</li>
              <li>Technical information: IP address, device type, browser, session data for platform security purposes</li>
            </ul>
            <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.8, margin: "0 0 20px" }}>We collect only the minimum information necessary to provide your requested service.</p>

            {/* <div style={{ border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" }}>

                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", tableLayout: "fixed" }}>
                                <colgroup>
                                    <col style={{ width: "22%" }} />
                                    <col style={{ width: "44%" }} />
                                    <col style={{ width: "22%" }} />
                                    <col style={{ width: "12%" }} />
                                </colgroup>
                                <thead>
                                    <tr style={{ background: "#f8fafc" }}>
                                        {["Area", "Description", "Retention", "Control"].map((h) => (
                                            <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "#94a3b8", borderBottom: "1px solid #e2e8f0" }}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {privacyTableData.map((row, i) => (
                                        <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                                            <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", fontWeight: 600, color: "#1e293b", verticalAlign: "top", fontSize: "13px" }}>{row.area}</td>
                                            <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", color: "#64748b", verticalAlign: "top", lineHeight: 1.6, fontSize: "13px" }}>{row.description}</td>
                                            <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", color: "#64748b", verticalAlign: "top", fontSize: "13px" }}>{row.retention}</td>
                                            <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" }}>
                                                <ControlBadge value={row.control} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "12px", lineHeight: 1.6 }}>
                            We do not sell your personal data to third parties and do not use data brokers.
                        </p> */}
          </SectionCard>

          {/* How We Protect */}
          <SectionCard icon={ShieldAlert} title="How We Use Your Information">
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                lineHeight: 1.8,
                margin: 0,
              }}
            >
              We use your PHI and personal data for the following purposes:
            </p>
            <ul>
              <li>
                • Treatment: to facilitate teleconsultations, issue
                prescriptions, sick notes, fit-to-fly certificates, and other
                medical documentation
              </li>
              <li>
                • Program delivery: to provide mental health, sexual health, and
                weight loss programs
              </li>
              <li>
                • Operations: for appointment scheduling, case coordination, and
                platform administration
              </li>
              <li>
                • Legal compliance: to comply with applicable laws including
                HIPAA, GDPR, and other applicable regulations
              </li>
              <li>
                • Safety: to protect the safety of patients, doctors, and the
                public in emergency situations
              </li>
            </ul>
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                lineHeight: 1.8,
                margin: 0,
              }}
            >
              We do not use your PHI for marketing, advertising, or sale to
              third parties.
            </p>
          </SectionCard>
          {/* How We Share Your Information */}
          <SectionCard icon={Share2} title="How We Share Your Information">
            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              {[
                "With your treating doctor or consultant for the purpose of your consultation",
                "With approved cloud infrastructure vendors (AWS, Google Workspace) under signed Business Associate Agreements (BAAs)",
                "With our communication platform (QUO) for appointment coordination under a signed BAA",
                "As required by law, court order, or regulatory authority",
                "In a genuine medical emergency to protect your life or the life of another person",
                "With your explicit written consent for any other purpose",
              ].map((item, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    gap: "12px",
                    padding: "14px",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#2563eb",
                      marginTop: "7px",
                      flexShrink: 0,
                    }}
                  />
                  <p style={{ margin: 0, color: "#475569", lineHeight: 1.7 }}>
                    {item}
                  </p>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: "18px",
                padding: "16px",
                borderRadius: "12px",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
              }}
            >
              <strong style={{ color: "#1e40af" }}>
                We never share your PHI with WhatsApp, social media, AI tools,
                or any unapproved platform.
              </strong>
            </div>
          </SectionCard>

          {/* Your Rights */}
          <SectionCard icon={ShieldCheck} title="Your Rights">
            <div style={{ display: "grid", gap: "12px" }}>
              {[
                {
                  title: "Right to Access",
                  text: "Request a copy of your PHI held by us.",
                },
                {
                  title: "Right to Correction",
                  text: "Request correction of inaccurate information.",
                },
                {
                  title: "Right to Deletion",
                  text: "Request deletion of your data subject to legal retention requirements.",
                },
                {
                  title: "Right to Restriction",
                  text: "Request restriction of how we use your data.",
                },
                {
                  title: "Right to Portability",
                  text: "Receive your data in a portable format (GDPR).",
                },
                {
                  title: "Right to Object",
                  text: "Object to certain uses of your data.",
                },
                {
                  title: "Right to Complain",
                  text: "Lodge a complaint with your relevant data protection authority.",
                },
              ].map((item, index) => (
                <div
                  key={index}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "16px",
                  }}
                >
                  <h4
                    style={{
                      margin: "0 0 6px",
                      fontSize: "14px",
                      color: "#0f172a",
                    }}
                  >
                    {item.title}
                  </h4>
                  <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
                    {item.text}
                  </p>
                </div>
              ))}
            </div>

            <p
              style={{
                marginTop: "16px",
                color: "#475569",
                lineHeight: 1.7,
              }}
            >
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:support@humancareconnect.co">
                support@humancareconnect.co
              </a>
            </p>
          </SectionCard>

          {/* Data Retention */}
          <SectionCard icon={Database} title="Data Retention">
            <p style={{ color: "#64748b", lineHeight: 1.8, margin: 0 }}>
              We retain your PHI for a minimum of 6 years from the date of
              creation or last activity, as required by HIPAA (45 CFR 164.316).
              Longer retention periods may apply based on applicable state or
              national law. After the retention period, data is securely deleted
              using industry-standard methods.
            </p>
          </SectionCard>

          {/* Data Security */}
          <SectionCard icon={Lock} title="Data Security">
            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              {[
                "Encryption in transit (TLS 1.3) and at rest (AES-256)",
                "Multi-factor authentication for all staff with PHI access",
                "Role-based access control — only authorized personnel access your data",
                "Regular security assessments and risk analysis per HIPAA requirements",
                "Signed Business Associate Agreements with all vendors handling your PHI",
              ].map((item, index) => (
                <div
                  key={index}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "14px 16px",
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </SectionCard>

          {/* International Data Transfers */}
          <SectionCard icon={Globe} title="International Data Transfers">
            <p style={{ color: "#64748b", lineHeight: 1.8, margin: 0 }}>
              Humancare Connect serves patients globally including the United
              States, Europe, and the Middle East. If you are located in the
              European Economic Area (EEA), your data may be transferred to and
              processed in the United States. We ensure appropriate safeguards
              are in place for such transfers in compliance with GDPR
              requirements.
            </p>
          </SectionCard>

          {/* GDPR Rights */}
          <SectionCard
            icon={FileCheck}
            title="GDPR — Additional Rights for EU/EEA Patients"
          >
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              If you are located in the EU or EEA, you have additional rights
              under the General Data Protection Regulation (GDPR). Our legal
              basis for processing your health data is Article 9(2)(h) GDPR
              (medical treatment purposes) and your explicit consent where
              required.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              You may withdraw consent at any time without affecting the
              lawfulness of prior processing.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Data Protection Contact:{" "}
              <a href="mailto:support@humancareconnect.co">
                support@humancareconnect.co
              </a>
            </p>
          </SectionCard>

          {/* Breach Notification */}
          <SectionCard icon={Bell} title="Breach Notification">
            <p style={{ color: "#64748b", lineHeight: 1.8, margin: 0 }}>
              In the event of a data breach affecting your PHI, we will notify
              you in accordance with HIPAA Breach Notification Rule requirements
              (within 60 days of discovery) and GDPR requirements (within 72
              hours to supervisory authority where required). We will inform you
              of the nature of the breach, data affected, and steps taken.
            </p>
          </SectionCard>

          {/* Telehealth Disclaimer */}
          <SectionCard icon={Stethoscope} title="Telehealth Disclaimer">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Humancare Connect provides telehealth services for non-emergency
              medical consultations only.
            </p>

            <div
              style={{
                marginTop: "12px",
                padding: "16px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "12px",
                color: "#991b1b",
                fontWeight: 600,
              }}
            >
              Our platform is NOT a substitute for emergency medical care. If
              you are experiencing a medical emergency, please call your local
              emergency services immediately (911 in the USA).
            </div>
          </SectionCard>

          {/* Minimum Age */}
          <SectionCard icon={UserCheck} title="Minimum Age">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Our services are available to individuals aged 18 years and older
              only. We do not knowingly collect PHI from minors. If you believe
              a minor has used our services, please contact us immediately at
              support@humancareconnect.co.
            </p>
          </SectionCard>

          {/* Changes to This Notice */}
          <SectionCard icon={RefreshCw} title="Changes to This Notice">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              We may update this Privacy Notice periodically. We will notify you
              of material changes by email or through the platform. The
              effective date at the top of this notice reflects the most recent
              update.
            </p>
          </SectionCard>

          {/* Contact Us */}

          <SectionCard icon={Mail} title="Contact & privacy requests">
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                lineHeight: 1.8,
                margin: "0 0 20px",
              }}
            >
              Questions about this policy or want to exercise your rights? Reach
              out to our privacy team — we respond to all verified requests
              within 30 days.
            </p>

            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "14px",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    flexShrink: 0,
                    borderRadius: "8px",
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#94a3b8",
                  }}
                >
                  <Mail size={14} strokeWidth={1.75} />
                </div>
                <div>
                  <p
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      color: "#94a3b8",
                      margin: "0 0 3px",
                    }}
                  >
                    Email
                  </p>
                  <a
                    href="mailto:support@humancareconnect.co"
                    style={{
                      fontSize: "13px",
                      color: "#2563eb",
                      textDecoration: "none",
                    }}
                  >
                    support@humancareconnect.co
                  </a>
                </div>
              </div>

              <div
                style={{
                  height: "1px",
                  background: "#e2e8f0",
                  margin: "0 0 16px",
                }}
              />

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "14px",
                }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    flexShrink: 0,
                    borderRadius: "8px",
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#94a3b8",
                  }}
                >
                  <MapPin size={14} strokeWidth={1.75} />
                </div>
                <div>
                  <p
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      color: "#94a3b8",
                      margin: "0 0 3px",
                    }}
                  >
                    Mailing address
                  </p>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#334155",
                      lineHeight: 1.65,
                      margin: 0,
                    }}
                  >
                    131 Continental Dr, Suite 305
                    <br />
                    Newark, DE 19713
                  </p>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
