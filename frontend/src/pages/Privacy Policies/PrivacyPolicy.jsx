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
  SlidersHorizontal,
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

export default function PrivacyPolicy() {
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
            HUMANCARE CONNECT, INC.
          </div>

          <h1
            style={{
              fontSize: "32px",
              fontWeight: 700,
              color: "#0f172a",
              margin: "15px 0 4px",
            }}
          >
            Privacy Policy
          </h1>

          <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
            Effective Date: June 8, 2026 | Last Updated: June 8, 2026
          </p>
        </div>
      </div>

      {/* ── Main Content  ── */}
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
            This Privacy Policy explains how Humancare Connect, Inc. collects,
            uses, protects, and shares your personal information and Protected
            Health Information (PHI) when you use our telehealth platform,
            applications, and services.
          </div>

          {/* Section card 1*/}
          <SectionCard icon={ShieldCheck} title="1. Introduction">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Humancare Connect, Inc. ("Humancare Connect," "we," "us," or
              "our") operates the telehealth platform at humancareworldwide.com
              and its associated mobile and web applications (collectively, the
              "Platform").
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              We are committed to protecting the privacy and security of your
              personal information, including Protected Health Information (PHI)
              as defined under HIPAA.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              By using the Platform, you agree to the terms of this Privacy
              Policy.
            </p>
          </SectionCard>

          {/* Section Card 2 */}
          <SectionCard icon={Database} title="2. Information We Collect">
            <h4>Information You Provide</h4>

            <ul>
              <li>
                • Account registration information: name, email, DOB, phone
                number and password
              </li>
              <li>
                • Patient health information including symptoms, conditions,
                medications and medical history
              </li>
              <li>• Payment information processed securely through Stripe</li>
              <li>• Communications with physicians and support staff</li>
              <li>• Identity verification information where required</li>
            </ul>

            <h4 style={{ marginTop: "20px" }}>
              Information Collected Automatically
            </h4>

            <ul>
              <li>• IP address and browser information</li>
              <li>• Operating system and device information</li>
              <li>• Usage analytics and platform activity</li>
              <li>• Cookies and tracking technologies</li>
              <li>• Server logs and access records</li>
            </ul>
          </SectionCard>

          {/* Section Card 3 */}
          <SectionCard
            icon={ShieldAlert}
            title="3. How We Use Your Information"
          >
            <ul>
              <li>• Provide and improve telehealth services</li>
              <li>• Connect patients with licensed physicians</li>
              <li>• Process payments and manage accounts</li>
              <li>• Communicate regarding appointments and results</li>
              <li>• Comply with HIPAA and applicable regulations</li>
              <li>• Prevent fraud and security incidents</li>
              <li>• Analyze usage trends and improve user experience</li>
              <li>• Send marketing communications when consented to</li>
            </ul>
          </SectionCard>

          {/* PHI and HIPAA */}
          <SectionCard
            icon={Lock}
            title="4. Protected Health Information (PHI) and HIPAA"
          >
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Humancare Connect is a HIPAA-covered entity. We handle Protected
              Health Information (PHI) in accordance with HIPAA regulations.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Your PHI is used only as permitted under HIPAA for treatment,
              payment, and healthcare operations.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              We maintain Business Associate Agreements (BAAs) with third-party
              vendors including AWS, MongoDB Atlas, and communication providers.
            </p>
          </SectionCard>

          {/* How We Share Information */}
          <SectionCard icon={Share2} title="5. How We Share Your Information">
            <ul>
              <li>• With licensed physicians providing consultations</li>
              <li>
                • With service providers under BAAs and data processing
                agreements
              </li>
              <li>• With your consent or direction</li>
              <li>• When required by law or court order</li>
              <li>• During mergers, acquisitions, or asset sales</li>
              <li>• To protect rights, safety, and security</li>
            </ul>

            <div
              style={{
                marginTop: "16px",
                padding: "16px",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: "12px",
                color: "#1e40af",
                fontWeight: 600,
              }}
            >
              We do not sell your personal information or PHI.
            </div>
          </SectionCard>
          {/* Data Retention */}
          <SectionCard icon={Database} title="6. Data Retention">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Medical records are retained for a minimum of 7 years from the
              date of last service, or longer where required by law.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Account information is retained for the duration of your account
              plus a reasonable period after closure.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Deletion requests may be submitted to privacy@humancareconnect.co
            </p>
          </SectionCard>
          {/* cookies */}
          <SectionCard
            icon={SlidersHorizontal}
            title="7. Cookies and Tracking Technologies"
          >
            <ul>
              <li>
                • Essential Cookies - Authentication and session management
              </li>
              <li>• Analytics Cookies - Google Analytics usage insights</li>
              <li>• Preference Cookies - Remember user settings</li>
            </ul>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              You may control cookies through browser settings. Disabling
              essential cookies may impact platform functionality.
            </p>
          </SectionCard>
          {/* Data Security */}
          <SectionCard icon={ShieldAlert} title="8. Data Security">
            <ul>
              <li>• HTTPS / TLS encryption</li>
              <li>• Role-based access controls</li>
              <li>• Multi-factor authentication</li>
              <li>• Regular security assessments</li>
            </ul>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              While we implement strong safeguards, no method of transmission
              over the internet can be guaranteed 100% secure.
            </p>
          </SectionCard>

          {/*  your rights */}
          <SectionCard icon={ShieldCheck} title="9. Your Rights">
            <h4>HIPAA Rights</h4>

            <p style={{ color: "#64748b" }}>
              Access, amend, and request restrictions on your PHI.
            </p>

            <h4>General Privacy Rights</h4>

            <ul>
              <li>• Access your data</li>
              <li>• Correct inaccurate information</li>
              <li>• Request deletion</li>
              <li>• Opt-out of marketing</li>
              <li>• Data portability</li>
            </ul>
          </SectionCard>
          {/*  */}
          <SectionCard
            icon={ShieldCheck}
            title="10. California Privacy Rights (CCPA)"
          >
            <p>
              California residents may exercise rights under the CCPA. Humancare
              Connect does not sell personal information.
            </p>
          </SectionCard>

          <SectionCard icon={ShieldCheck} title="11. Children's Privacy">
            <p>
              The Platform is not intended for individuals under 18 years of
              age.
            </p>
          </SectionCard>

          <SectionCard icon={ShieldCheck} title="12. Third-Party Links">
            <p>
              We are not responsible for privacy practices of third-party
              websites linked from our Platform.
            </p>
          </SectionCard>

          <SectionCard icon={Globe} title="13. International Users">
            <p>
              Information may be transferred to and processed in the United
              States.
            </p>
          </SectionCard>

          <SectionCard icon={RefreshCw} title="14. Changes to This Policy">
            <p>
              We may update this Privacy Policy periodically. Continued use of
              the Platform constitutes acceptance of changes.
            </p>
          </SectionCard>
          {/* Contact us  */}

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
                    href="mailto:support@humancareconnect.com"
                    style={{
                      fontSize: "13px",
                      color: "#2563eb",
                      textDecoration: "none",
                    }}
                  >
                    support@humancareconnect.com
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
