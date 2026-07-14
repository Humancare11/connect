import {
  ShieldCheck,
  UserCheck,
  Briefcase,
  Stethoscope,
  FileCheck,
  Lock,
  DollarSign,
  Monitor,
  FileText,
  Copyright,
  XCircle,
  Scale,
  Gavel,
  BookOpen,
  RefreshCw,
  Mail,
  ShieldAlert,
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

export default function ProviderTermsofService() {
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
              fontSize: "32px",
              fontWeight: 700,
              color: "#0f172a",
              margin: "15px 0 4px",
            }}
          >
            Provider Terms of Service
          </h1>

          <p
            style={{
              fontSize: "13px",
              color: "#94a3b8",
              margin: 0,
            }}
          >
            For Licensed Healthcare Providers | Effective Date: June 8, 2026
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
            These Provider Terms of Service govern the relationship between
            licensed healthcare providers and Humancare Connect regarding the
            provision of telehealth services and medical second opinions through
            the Humancare Connect platform.
          </div>

          {/* Agreement and acceptance*/}
          <SectionCard icon={ShieldCheck} title=" Agreement and Acceptance">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              These Provider Terms of Service ("Provider Agreement") constitute
              a legally binding agreement between you ("Provider," "Physician,"
              or "you") and Humancare Connect, Inc.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              By creating a provider account or providing services through the
              Platform, you agree to be bound by this Provider Agreement, our
              Privacy Policy, and any additional policies referenced herein.
            </p>
          </SectionCard>

          {/* Provider Eligibility and Credentials */}
          <SectionCard
            icon={UserCheck}
            title=" Provider Eligibility and Credentials"
          >
            <ul>
              <li>• Hold a current unrestricted U.S. medical license</li>
              <li>
                • Maintain board certification or eligibility where applicable
              </li>
              <li>
                • Carry malpractice insurance with minimum coverage of $1M / $3M
              </li>
              <li>• Have no suspended or revoked license</li>
              <li>
                • Not be excluded from Medicare, Medicaid, or healthcare
                programs
              </li>
              <li>
                • Be authorized to work and practice medicine in the United
                States
              </li>
              <li>• Be at least 18 years old</li>
            </ul>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Humancare Connect reserves the right to verify credentials and
              conduct ongoing monitoring through NPDB and state licensing
              boards.
            </p>
          </SectionCard>

          {/* Independent Contractor Relationship */}
          <SectionCard
            icon={UserCheck}
            title=" Provider Eligibility and Credentials"
          >
            <ul>
              <li>• Hold a current unrestricted U.S. medical license</li>
              <li>
                • Maintain board certification or eligibility where applicable
              </li>
              <li>
                • Carry malpractice insurance with minimum coverage of $1M / $3M
              </li>
              <li>• Have no suspended or revoked license</li>
              <li>
                • Not be excluded from Medicare, Medicaid, or healthcare
                programs
              </li>
              <li>
                • Be authorized to work and practice medicine in the United
                States
              </li>
              <li>• Be at least 18 years old</li>
            </ul>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Humancare Connect reserves the right to verify credentials and
              conduct ongoing monitoring through NPDB and state licensing
              boards.
            </p>
          </SectionCard>

          {/* Independent  */}
          <SectionCard
            icon={Briefcase}
            title=" Independent Contractor Relationship"
          >
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Providers are independent contractors and not employees, agents,
              partners, or representatives of Humancare Connect.
            </p>

            <ul>
              <li>• Your own taxes and self-employment obligations</li>
              <li>• Your own malpractice insurance</li>
              <li>• Compliance with applicable telehealth laws</li>
              <li>• The quality of your medical services</li>
            </ul>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Humancare Connect provides technology infrastructure only.
              Clinical judgment remains solely yours.
            </p>
          </SectionCard>
          {/* Scope of service */}
          <SectionCard icon={Stethoscope} title="Scope of Services">
            <ul>
              <li>• Medical second opinions</li>
              <li>• Video telehealth consultations</li>
              <li>• Audio consultations</li>
              <li>• Asynchronous text-based consultations</li>
              <li>• Specialist consultations consistent with credentials</li>
            </ul>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Services must be delivered professionally and in accordance with
              applicable standards of care.
            </p>
          </SectionCard>
          {/* hipaa */}
          <SectionCard icon={Lock} title="HIPAA Compliance">
            <ul>
              <li>• Comply with all HIPAA requirements</li>
              <li>• Execute required Business Associate Agreements</li>
              <li>• Protect all PHI accessed through the Platform</li>
              <li>• Report suspected breaches immediately</li>
              <li>• Complete required HIPAA training</li>
            </ul>
          </SectionCard>
          {/* compensation */}
          <SectionCard icon={DollarSign} title="Compensation">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Compensation rates, payment schedules, and reimbursement terms are
              governed by your separate Provider Compensation Agreement or
              provider dashboard.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Humancare Connect reserves the right to withhold payment for
              services that violate applicable law, professional standards, or
              this Agreement.
            </p>
          </SectionCard>
          {/* Platform use and conduct */}
          <SectionCard icon={Monitor} title=" Platform Use and Conduct">
            <h4>Providers Agree To:</h4>

            <ul>
              <li>• Respond within required service timeframes</li>
              <li>• Maintain professional communication standards</li>
              <li>• Use the Platform only for authorized purposes</li>
              <li>• Protect account credentials</li>
              <li>• Report technical issues affecting patient care</li>
            </ul>

            <h4>Providers Shall Not:</h4>

            <ul>
              <li>• Misrepresent credentials</li>
              <li>• Discriminate against patients</li>
              <li>• Solicit patients outside the Platform</li>
              <li>• Damage the reputation of Humancare Connect</li>
            </ul>
          </SectionCard>
          {/* medical reports */}
          <SectionCard icon={FileText} title="9. Medical Records">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Medical records and consultation documentation created through the
              Platform are maintained in accordance with HIPAA and applicable
              record-retention laws.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Providers remain professionally responsible for documentation
              accuracy.
            </p>
          </SectionCard>
          {/* quick assurance */}
          <SectionCard icon={ShieldCheck} title="Quality Assurance">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Humancare Connect may conduct quality assurance reviews for
              platform compliance and service quality purposes.
            </p>
          </SectionCard>
          {/* intellectual property */}
          <SectionCard icon={Copyright} title="Intellectual Property">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Providers grant Humancare Connect a non-exclusive, royalty-free
              license to use their name, credentials, biography, and likeness
              for platform operations and marketing.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              All Platform software, technology, and content remain the property
              of Humancare Connect.
            </p>
          </SectionCard>
          {/* confidentiality */}
          <SectionCard icon={Lock} title="Confidentiality">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Providers must keep confidential all non-public information
              relating to Humancare Connect's business, technology, and
              operations.
            </p>
          </SectionCard>
          {/* terms and trmination */}
          <SectionCard icon={XCircle} title="Term and Termination">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Either party may terminate this Agreement with 30 days written
              notice.
            </p>

            <ul>
              <li>• Material breach of the Agreement</li>
              <li>• License suspension or revocation</li>
              <li>• Loss of required insurance</li>
              <li>• Exclusion from Medicare or Medicaid</li>
              <li>• Patient safety concerns</li>
            </ul>
          </SectionCard>
          {/* limitation */}
          <SectionCard icon={ShieldAlert} title=" Limitation of Liability">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              To the maximum extent permitted by law, Humancare Connect's total
              liability shall not exceed the fees paid to the Provider during
              the three months preceding the claim.
            </p>
          </SectionCard>
          {/* indemnification */}
          <SectionCard icon={Scale} title=" Indemnification">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Providers agree to indemnify and hold harmless Humancare Connect
              and its affiliates from claims arising from medical services,
              legal violations, professional conduct, or patient claims.
            </p>
          </SectionCard>
          {/* dispute Resolution */}
          <SectionCard icon={Gavel} title=" Dispute Resolution">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Disputes shall be resolved through binding arbitration under the
              American Arbitration Association Commercial Arbitration Rules in
              Delaware.
            </p>
          </SectionCard>
          {/* law */}
          <SectionCard icon={BookOpen} title="Governing Law">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              This Agreement is governed by the laws of the State of Delaware.
            </p>
          </SectionCard>

          {/* modification */}
          <SectionCard icon={RefreshCw} title="Modifications">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Humancare Connect may update this Provider Agreement with at least
              30 days notice for material changes.
            </p>
          </SectionCard>
          {/* Contact */}
          {/* Contact */}
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
