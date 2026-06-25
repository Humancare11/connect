import {
  ShieldCheck,
  Lock,
  Users,
  ShieldAlert,
  Clipboard,
  Mail,
  MapPin,
  FileText,
  Award,
  Gavel,
  Coins,
  CalendarX,
  PenLine,
  FileCheck,
  Stethoscope,
} from "lucide-react";

const documentInfo = [
  {
    label: "Platform Operator",
    value: 'Humancare Connect, Inc. ("Company"), a Delaware Corporation',
  },
  {
    label: "Provider",
    value:
      'Licensed healthcare professional ("Provider") as identified in the onboarding application',
  },
  {
    label: "Effective Date",
    value: "Date of countersignature by Company",
  },
  {
    label: "Governing Law",
    value: "State of Delaware; applicable federal telehealth laws",
  },
];

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

export default function TelehealthProviderAgreement() {
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
      {/* Banner */}
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
            padding: "28px 28px",
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
            Telehealth Provider Agreement
          </h1>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
            Version 1.0 | Effective: June 2026
          </p>
        </div>
      </div>

      {/* Main Content */}
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
          {/* Document Information */}
          <SectionCard icon={FileText} title="Document Information">
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
                  <col style={{ width: "28%" }} />
                  <col style={{ width: "72%" }} />
                </colgroup>
                <tbody>
                  {documentInfo.map((item, i) => (
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
                          fontSize: "13px",
                          verticalAlign: "top",
                        }}
                      >
                        {item.label}
                      </td>
                      <td
                        style={{
                          padding: "12px 14px",
                          borderBottom: "1px solid #f1f5f9",
                          color: "#64748b",
                          lineHeight: 1.6,
                          fontSize: "13px",
                        }}
                      >
                        {item.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* 1. Relationship of Parties */}
          <SectionCard icon={Users} title="1. Relationship of Parties">
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                lineHeight: 1.8,
                margin: 0,
              }}
            >
              Provider is engaged as an independent contractor and not as an
              employee, agent, or partner of Humancare Connect, Inc. Nothing in
              this Agreement creates an employment relationship. Provider is
              solely responsible for all taxes, professional fees, and statutory
              obligations arising from the independent contractor relationship.
            </p>
          </SectionCard>

          {/* 2. Services */}
          <SectionCard icon={Stethoscope} title="2. Services">
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                marginBottom: "18px",
                lineHeight: 1.8,
              }}
            >
              Provider agrees to make themselves available on the Humancare
              Connect platform to deliver telehealth consultations to patients
              who have scheduled an appointment within Provider's available
              hours. Provider shall:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                "Conduct consultations via the secure audio/video infrastructure provided by the platform.",
                "Maintain accurate availability schedules within the provider portal.",
                "Document clinical encounters contemporaneously in the platform's electronic health record system.",
                "Respond to consultation requests within agreed response windows.",
                "Maintain continuous professional liability insurance meeting minimum platform requirements.",
              ].map((item, index) => (
                <div
                  key={index}
                  style={{
                    borderLeft: "4px solid #2563eb",
                    background: "#f8fafc",
                    padding: "14px 16px",
                    borderRadius: "8px",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      color: "#64748b",
                      fontSize: "13px",
                      lineHeight: 1.7,
                    }}
                  >
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* 3. Clinical Independence */}
          <SectionCard icon={ShieldCheck} title="3. Clinical Independence — Critical Clause">
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                marginBottom: "18px",
                lineHeight: 1.8,
              }}
            >
              Provider retains full, exclusive, and independent clinical
              judgment in all patient encounters conducted through the platform.
              Humancare Connect, Inc. explicitly acknowledges and affirms that:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "18px" }}>
              {[
                "The Company does not direct, supervise, or influence any clinical decision made by Provider, including but not limited to diagnoses, treatment plans, referrals, or prescribing decisions.",
                "No platform algorithm, business rule, or Company representative has authority to override or countermand Provider's clinical judgment.",
                "Prescribing medication, ordering investigations, or recommending specialist referrals is solely at Provider's professional discretion based on the clinical presentation of each patient.",
                "Provider is not required to prescribe any medication and shall not face any adverse platform action for declining to prescribe where clinically inappropriate.",
                "The Company's fee structure and business model do not influence or create incentives for specific clinical outcomes.",
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
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#64748b",
                      lineHeight: 1.7,
                      margin: 0,
                    }}
                  >
                    {item}
                  </p>
                </div>
              ))}
            </div>
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                lineHeight: 1.8,
                margin: 0,
              }}
            >
              Provider acknowledges that this provision is consistent with
              applicable state laws governing the Corporate Practice of Medicine
              (CPOM) and that Provider's clinical obligations are governed
              exclusively by applicable medical licensing standards, ethics
              codes, and patient care duties.
            </p>
          </SectionCard>

          {/* 4. Licensing */}
          <SectionCard icon={FileText} title="4. Licensing and Credentialing">
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                marginBottom: "18px",
                lineHeight: 1.8,
              }}
            >
              Provider represents and warrants at the time of execution and on a
              continuing basis throughout the term of this Agreement that:
            </p>
            <ul
              style={{
                margin: 0,
                paddingLeft: "20px",
                color: "#64748b",
                lineHeight: 1.9,
                fontSize: "14px",
              }}
            >
              <li>Provider holds a valid, active, and unrestricted medical license in each state in which Provider delivers services through the platform.</li>
              <li>Provider maintains valid DEA registration for any controlled substance prescribing activities.</li>
              <li>Provider is not currently excluded, debarred, or suspended from participation in any federal or state healthcare program.</li>
              <li>Provider will immediately notify Humancare Connect within 24 hours of any change in licensure status, disciplinary proceeding, malpractice claim, or OIG/SAM exclusion.</li>
              <li>Provider maintains professional liability insurance as required by the platform's Physician Credentialing Policy.</li>
            </ul>
          </SectionCard>

          {/* 5. HIPAA */}
          <SectionCard icon={Lock} title="5. HIPAA and Data Privacy Compliance">
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                marginBottom: "18px",
                lineHeight: 1.8,
              }}
            >
              Provider acknowledges that the Company maintains HIPAA-compliant
              infrastructure and that both parties are subject to applicable
              HIPAA requirements. Provider agrees to:
            </p>
            <ul
              style={{
                margin: 0,
                paddingLeft: "20px",
                color: "#64748b",
                lineHeight: 1.9,
                fontSize: "14px",
              }}
            >
              <li>Handle all Protected Health Information (PHI) in accordance with HIPAA Privacy and Security Rules.</li>
              <li>Access patient records only for the purposes of providing direct patient care or as otherwise legally required.</li>
              <li>Not disclose PHI to any third party except as permitted under HIPAA and the Business Associate Agreement executed with the Company.</li>
              <li>Immediately report any suspected PHI breach or security incident to the Company's Privacy Officer.</li>
              <li>Complete annual HIPAA training as required by the platform.</li>
            </ul>
          </SectionCard>

          {/* 6. Telehealth Practice Standards */}
          <SectionCard icon={Clipboard} title="6. Telehealth Practice Standards">
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                marginBottom: "18px",
                lineHeight: 1.8,
              }}
            >
              Provider agrees to conduct all telehealth consultations in
              compliance with applicable state telehealth practice standards,
              including:
            </p>
            <ul
              style={{
                margin: 0,
                paddingLeft: "20px",
                color: "#64748b",
                lineHeight: 1.9,
                fontSize: "14px",
              }}
            >
              <li>Establishing a valid provider-patient relationship as required by the patient's state of residence.</li>
              <li>Conducting a clinically appropriate evaluation before prescribing any medication.</li>
              <li>Not prescribing controlled substances via telehealth where prohibited by applicable federal or state law.</li>
              <li>Documenting each consultation with sufficient clinical detail to meet applicable standards of care.</li>
              <li>Providing patients with a summary of the consultation, follow-up instructions, and emergency referral guidance where clinically indicated.</li>
              <li>Maintaining appropriate boundaries for telehealth — recognizing when an in-person evaluation is required and communicating this clearly to the patient.</li>
            </ul>
          </SectionCard>

          {/* 7. Compensation */}
          <SectionCard icon={FileText} title="7. Compensation">
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                lineHeight: 1.8,
                margin: 0,
              }}
            >
              Provider will be compensated per completed consultation at the
              rates established in the Provider Rate Schedule, which is
              incorporated by reference. Compensation is processed within 14
              business days following the end of each calendar month for all
              consultations completed in that period. The Company reserves the
              right to withhold payment for consultations that are subject to a
              verified patient complaint or quality review, pending resolution.
            </p>
          </SectionCard>

          {/* 8. Term and Termination */}
          <SectionCard icon={ShieldAlert} title="8. Term and Termination">
            <ul
              style={{
                margin: 0,
                paddingLeft: "20px",
                color: "#64748b",
                lineHeight: 1.9,
                fontSize: "14px",
              }}
            >
              <li>This Agreement commences on the Effective Date and continues until terminated by either party.</li>
              <li>Either party may terminate this Agreement without cause upon 30 days' written notice.</li>
              <li>The Company may terminate this Agreement immediately upon: (a) loss or restriction of Provider's medical license; (b) OIG exclusion or SAM debarment; (c) DEA registration revocation; (d) material breach of this Agreement; (e) substantiated patient safety concern; or (f) material misrepresentation in the credentialing application.</li>
              <li>Upon termination, Provider's access to the platform will be deactivated. Patient records generated during the engagement will be retained by the Company as required by applicable law.</li>
            </ul>
          </SectionCard>

          {/* 9. Indemnification */}
          <SectionCard icon={ShieldCheck} title="9. Indemnification">
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                lineHeight: 1.8,
                margin: 0,
              }}
            >
              Provider agrees to indemnify, defend, and hold harmless Humancare
              Connect, Inc., its officers, directors, and employees from any
              claim, loss, liability, or expense arising from: (a) Provider's
              professional negligence or misconduct; (b) Provider's breach of
              any representation or warranty in this Agreement; or (c)
              Provider's violation of applicable law.
            </p>
          </SectionCard>

          {/* 10. Governing Law */}
          <SectionCard icon={FileText} title="10. Governing Law and Dispute Resolution">
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                lineHeight: 1.8,
                margin: 0,
              }}
            >
              This Agreement is governed by the laws of the State of Delaware.
              Any dispute arising out of or relating to this Agreement that
              cannot be resolved by mutual agreement shall be submitted to
              binding arbitration under the rules of the American Arbitration
              Association, with proceedings conducted in Delaware.
            </p>
          </SectionCard>

          {/* 11. Entire Agreement */}
          <SectionCard icon={FileText} title="11. Entire Agreement">
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                lineHeight: 1.8,
                margin: 0,
              }}
            >
              This Agreement, together with the Physician Credentialing Policy,
              Prescription Handling Policy, and Business Associate Agreement,
              constitutes the entire agreement between the parties with respect
              to Provider's engagement on the platform and supersedes all prior
              negotiations, representations, and agreements.
            </p>
          </SectionCard>

          {/* Signatures */}
          <SectionCard icon={FileText} title="Signatures">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
              }}
            >
              {[
                { party: "For Humancare Connect, Inc.", fields: ["Authorized Signatory", "Date"] },
                { party: "Provider", fields: ["Full Name", "Date"] },
              ].map((sig, i) => (
                <div
                  key={i}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "20px",
                  }}
                >
                  <p
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      color: "#94a3b8",
                      margin: "0 0 16px",
                    }}
                  >
                    {sig.party}
                  </p>
                  {sig.fields.map((field, j) => (
                    <div key={j} style={{ marginBottom: j < sig.fields.length - 1 ? "16px" : 0 }}>
                      <div
                        style={{
                          borderBottom: "1px solid #cbd5e1",
                          height: "32px",
                          marginBottom: "6px",
                        }}
                      />
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#94a3b8",
                          margin: 0,
                        }}
                      >
                        {field}
                      </p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Contact */}
          <SectionCard icon={Mail} title="Contact Information">
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                lineHeight: 1.8,
                margin: "0 0 20px",
              }}
            >
              Questions about this agreement or want to get in touch? Reach out
              to our operations team — we respond to all verified requests
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