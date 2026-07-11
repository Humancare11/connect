import {
  ShieldCheck,
  Stethoscope,
  CreditCard,
  Building2,
  FileSignature,
  Lock,
  Eye,
  FileText,
  Bell,
  AlertTriangle,
  Mail,
  MapPin,
  Scale,
} from "lucide-react";

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

export default function NoticePrivacy() {
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
            NOTICE OF PRIVACY PRACTICES{" "}
          </h1>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
            {" "}
            Effective Date: June 8, 2026
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
            THIS NOTICE DESCRIBES HOW MEDICAL INFORMATION ABOUT YOU MAY BE USED
            AND DISCLOSED AND HOW YOU CAN GET ACCESS TO THIS INFORMATION. PLEASE
            REVIEW IT CAREFULLY.
          </div>

          {/* notice */}
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
            We are required by HIPAA and applicable federal and state laws to
            protect the privacy and security of your Protected Health
            Information (PHI).
          </div>

          {/* legal duty */}
          <SectionCard icon={ShieldCheck} title="Our Legal Duty">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              We are required by law to maintain the privacy of your Protected
              Health Information (PHI), provide you with this Notice of our
              privacy practices, and follow the terms currently in effect.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              We are required by the Health Insurance Portability and
              Accountability Act of 1996 (HIPAA) and applicable federal and
              state laws to safeguard your health information.
            </p>
          </SectionCard>
          {/* for treatment */}
          <SectionCard
            icon={Stethoscope}
            title="Use and Disclosure for Treatment"
          >
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              We may use or disclose your health information to provide,
              coordinate, or manage your healthcare and related services.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              For example, information may be shared with physicians providing
              medical consultations, second opinions, or healthcare providers
              involved in your care.
            </p>
          </SectionCard>

          {/* payment */}
          <SectionCard icon={CreditCard} title="Use and Disclosure for Payment">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              We may use or disclose your health information to process payments
              for services provided to you.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              This may include sharing information with payment processors and
              billing partners as necessary to complete transactions.
            </p>
          </SectionCard>

          {/* HEalth */}
          <SectionCard icon={Building2} title="Health Care Operations">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              We may use health information for quality assurance, compliance,
              training, auditing, credentialing, and operational management.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Consultation records may be reviewed internally to improve service
              quality and patient care.
            </p>
          </SectionCard>

          {/* other permitted uses */}
          <SectionCard
            icon={FileText}
            title="Other Permitted Uses and Disclosures"
          >
            <p style={{ color: "#64748b", lineHeight: 1.9 }}>
              • As required by law, including court orders and subpoenas
              <br />
              • Public health reporting and disease prevention activities
              <br />
              • Government audits, inspections, and investigations
              <br />
              • Law enforcement requests permitted by law
              <br />
              • Preventing serious threats to health or safety
              <br />• Business associates performing services on our behalf
              under HIPAA agreements
            </p>
          </SectionCard>
          {/* uses requiring */}
          <SectionCard
            icon={FileSignature}
            title="Uses and Disclosures Requiring Authorization"
          >
            <p style={{ color: "#64748b", lineHeight: 1.9 }}>
              We will obtain your written authorization before:
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.9 }}>
              • Using or disclosing psychotherapy notes
              <br />
              • Marketing activities involving PHI
              <br />
              • Sale of PHI
              <br />• Any use not otherwise described in this Notice
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              You may revoke authorization at any time in writing, except where
              we have already relied on it.
            </p>
          </SectionCard>
          {/* your rights  */}
          <SectionCard
            icon={Lock}
            title="Your Rights Regarding Health Information"
          >
            <p style={{ color: "#64748b", lineHeight: 1.9 }}>
              • Right to access your records
              <br />
              • Right to request amendments
              <br />
              • Right to an accounting of disclosures
              <br />
              • Right to request restrictions
              <br />
              • Right to confidential communications
              <br />• Right to receive a paper copy of this Notice
            </p>
          </SectionCard>
          {/* Breach Notifications */}
          <SectionCard icon={Bell} title="Right to Be Notified of Breaches">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              We are required by law to notify you if we discover a breach
              involving your unsecured Protected Health Information.
            </p>
          </SectionCard>
          {/* Changes to this Notice */}
          <SectionCard icon={AlertTriangle} title="Changes to This Notice">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              We reserve the right to modify this Notice and make revised
              provisions effective for all health information we maintain.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Updated versions will be posted on our website and made available
              upon request.
            </p>
          </SectionCard>
          {/* complaint */}
          <SectionCard icon={Scale} title="How to File a Complaint">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              If you believe your privacy rights have been violated, you may
              file a complaint with us or with the U.S. Department of Health and
              Human Services.
            </p>

            <div
              style={{
                marginTop: "18px",
                padding: "18px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
              }}
            >
              <p>
                <strong>Federal Office for Civil Rights</strong>
              </p>

              <p style={{ color: "#64748b", marginTop: "8px" }}>
                U.S. Department of Health and Human Services
                <br />
                200 Independence Ave., S.W.
                <br />
                Washington, D.C. 20201
              </p>

              <p style={{ color: "#64748b" }}>Toll-Free: 1-877-696-6775</p>
            </div>
          </SectionCard>
          {/* Contact */}
          <SectionCard icon={Mail} title="Contact Us">
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                lineHeight: 1.8,
                margin: "0 0 20px",
              }}
            >
              For questions about this Notice or your privacy rights, please
              contact our Privacy Officer.
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
                    borderRadius: "8px",
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Mail size={14} />
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
                    Privacy Officer
                  </p>

                  <p
                    style={{
                      fontSize: "13px",
                      color: "#334155",
                      margin: 0,
                    }}
                  >
                    Nethaji Nallathambi
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
                    borderRadius: "8px",
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MapPin size={14} />
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
                    Mailing Address
                  </p>

                  <p
                    style={{
                      fontSize: "13px",
                      color: "#334155",
                      lineHeight: 1.65,
                      margin: 0,
                    }}
                  >
                    4 Peddlers Row, 1091
                    <br />
                   Newark, DE 19702, USA
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
