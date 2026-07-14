import { ShieldCheck, ClipboardList, Stethoscope, FileSignature, PillBottle, ShieldAlert, BadgeCheck, Mail, MapPin, FileText } from "lucide-react";

const documentInfo = [
  {
    label: "Document Owner",
    value: "Head of Operations, Humancare Connect, Inc.",
  },
  {
    label: "Effective Date",
    value: "June 2026",
  },
  {
    label: "Review Cycle",
    value: "Annual or upon regulatory change",
  },
  {
    label: "Applies To",
    value:
      "All providers, operations staff, and technology systems on the Humancare Connect platform",
  },
];

const roleTableData = [
  {
    area: "Audiovisual infrastructure",
    description: "Secure video and audio infrastructure that enables physician-patient consultations.",
    role: "Provided by platform",
    control: "Yes",
  },
  {
    area: "Electronic health records",
    description: "EHR system in which physicians document encounters and generate electronic prescriptions.",
    role: "Provided by platform",
    control: "Yes",
  },
  {
    area: "e-Rx transmission",
    description: "Physician-generated prescriptions transmitted to the patient's chosen pharmacy via a certified e-Rx network.",
    role: "Provided by platform",
    control: "Yes",
  },
  {
    area: "Prescribing decision",
    description: "Whether a medication is appropriate, and which one, based on clinical evaluation.",
    role: "Physician only",
    control: "No",
  },
  {
    area: "Dispensing & fulfillment",
    description: "Selling, compounding, storing, or shipping any prescription medication.",
    role: "Not performed",
    control: "No",
  },
];

const prohibitedItems = [
  {
    label: "No dispensing or pharmacy ownership",
    text: "The Company does not sell, dispense, compound, store, or ship medications, and holds no pharmacy license in any jurisdiction.",
  },
  {
    label: "No financial ties to pharmacies",
    text: "No ownership, financial relationship, or referral arrangement with any pharmacy or pharmacy benefit manager.",
  },
  {
    label: "No volume-based compensation",
    text: "The Company receives no compensation or rebates tied to prescription volume, drug type, or pharmacy selection.",
  },
  {
    label: "No prescribing influence",
    text: "The platform does not direct, prompt, nudge, or rank physicians in ways that incentivize prescribing, and never guarantees a prescription will be issued.",
  },
];

const documentationItems = [
  {
    label: "Clinical indication",
    text: "The reason for the prescription, supported by the documented patient evaluation.",
  },
  {
    label: "Medication details",
    text: "Drug name, dosage, route of administration, frequency, and quantity dispensed.",
  },
  {
    label: "Safety review",
    text: "Relevant contraindications reviewed and patient allergies considered.",
  },
  {
    label: "Treatment plan",
    text: "Duration of treatment and any follow-up instructions communicated to the patient.",
  },
  {
    label: "Transmission record",
    text: "Prescription transmission confirmation or reference number from the e-Rx system.",
  },
];

function ControlBadge({ value }) {
  const styles = {
    Yes: "bg-emerald-50 text-emerald-700 border-emerald-200",
    No: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span
      className={`inline-flex items-center text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${styles[value] ?? "bg-slate-50 text-slate-600 border-slate-200"
        }`}
    >
      {value}
    </span>
  );
}

function SectionCard({ icon: Icon, title, children }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "28px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingBottom: "20px", marginBottom: "20px", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ width: "36px", height: "36px", flexShrink: 0, borderRadius: "10px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
          <Icon size={17} strokeWidth={1.75} />
        </div>
        <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function PrescriptionHandlingPolicy() {
  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#f1f5f9", fontFamily: "system-ui, -apple-system, sans-serif", boxSizing: "border-box" }}>

      {/* ── Banner ── */}
      <div style={{ width: "100%", background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 28px 28px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "4px 10px" }}>
            <ShieldCheck size={11} />
            HUMANCARE CONNECT, INC
          </div>
          <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#0f172a", margin: "15px 0 4px", letterSpacing: "-0.02em" }}>Prescription Handling Policy</h1>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>How the platform's technology role relates to physician prescribing decisions</p>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: "750px", padding: "36px 24px 60px", display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Document Info */}
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
                      style={{
                        background: i % 2 === 0 ? "#fff" : "#f8fafc",
                      }}
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

          {/* Platform Role */}
          <SectionCard icon={ClipboardList} title="Platform role — technology facilitator only">
            <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.8, margin: "0 0 20px" }}>
              Humancare Connect, Inc. is a telehealth technology platform. Our role in relation to prescriptions is
              strictly limited to the infrastructure below — all clinical decisions belong to the prescribing physician.
            </p>

            <div style={{ border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "44%" }} />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "12%" }} />
                </colgroup>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Area", "Description", "Role", "Platform-controlled"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "#94a3b8", borderBottom: "1px solid #e2e8f0" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roleTableData.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", fontWeight: 600, color: "#1e293b", verticalAlign: "top", fontSize: "13px" }}>{row.area}</td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", color: "#64748b", verticalAlign: "top", lineHeight: 1.6, fontSize: "13px" }}>{row.description}</td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", color: "#64748b", verticalAlign: "top", fontSize: "13px" }}>{row.role}</td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" }}>
                        <ControlBadge value={row.control} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "12px", lineHeight: 1.6 }}>
              The Company does not direct physicians to prescribe or not prescribe any specific medication.
            </p>
          </SectionCard>

          {/* Physician Prescribing Discretion */}
          <SectionCard icon={Stethoscope} title="Physician prescribing discretion">
            <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.8, margin: 0 }}>
              All prescribing decisions are made exclusively by the licensed physician or authorized prescriber
              conducting the consultation. A prescription is issued only if, in the prescriber's sole clinical
              judgment, it is medically appropriate following a clinically sufficient evaluation. Patients are
              informed at booking that a consultation does not guarantee a prescription, and physicians may
              decline to prescribe at their professional discretion <strong style={{ fontWeight: 600, color: "#0f172a" }}>without adverse consequence</strong> from
              the platform. The platform does not algorithmically prompt, nudge, or rank physicians in ways that
              incentivize prescribing.
            </p>
          </SectionCard>

          {/* Electronic Prescription Standards */}
          <SectionCard icon={FileSignature} title="Electronic prescription standards">
            <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.8, margin: 0 }}>
              Where a physician elects to issue a prescription, it must be generated through a DEA-registered e-Rx
              system compliant with applicable EPCS standards, and transmitted via a certified Surescripts-enabled
              or equivalent network. Paper prescriptions are not issued through the platform. Patients may nominate
              any licensed pharmacy of their choice as their preferred receiving pharmacy.
            </p>
          </SectionCard>

          {/* Controlled Substances */}
          <SectionCard icon={PillBottle} title="Controlled substances policy">
            <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.8, margin: "0 0 16px" }}>
              Schedule II–V controlled substances are subject to additional rules:
            </p>
            <ul style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.9, margin: 0, paddingLeft: "20px" }}>
              <li>Telehealth prescribing of controlled substances is permitted only where expressly allowed under applicable law, including DEA regulations and Ryan Haight Act provisions.</li>
              <li>Prescribing physicians must hold a valid DEA registration and, where required, a state-specific controlled substance registration for the patient's state.</li>
              <li>Schedule II substances (e.g., stimulants, opioids) are not prescribed through the platform unless all applicable in-person or telehealth exemption requirements are met.</li>
              <li>Opioids for chronic pain management as a primary telehealth service are prohibited, as is any medication where the primary consumer demand pattern suggests misuse.</li>
              <li>All EPCS transactions comply with 21 CFR Part 1311 two-factor authentication requirements.</li>
            </ul>
          </SectionCard>

          {/* Evaluation Requirement */}
          <SectionCard icon={ShieldAlert} title="No prescription without adequate evaluation">
            <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.8, margin: 0 }}>
              No prescription may be issued based solely on self-reported symptoms submitted via a form or chat,
              without a synchronous live audio or video consultation. Physicians are responsible for determining
              whether a telehealth evaluation provides sufficient clinical information for a prescribing decision;
              if not, an in-person evaluation must be recommended. Asynchronous, store-and-forward consultations
              may support prescribing only where permitted by applicable state law and clinically appropriate for
              the condition presented.
            </p>
          </SectionCard>

          {/* No Pharmacy Ownership or Steering */}
          <SectionCard icon={BadgeCheck} title="No pharmacy ownership or steering">
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {prohibitedItems.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: "14px", alignItems: "flex-start", background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: "12px", padding: "14px 18px" }}>
                  <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#3b82f6", flexShrink: 0, marginTop: "5px" }} />
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b", margin: "0 0 3px" }}>{item.label}</p>
                    <p style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.65, margin: 0 }}>{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "14px", lineHeight: 1.6 }}>
              These commitments are designed to comply with the federal Anti-Kickback Statute and applicable state
              pharmacy referral laws. Patients are free to fill prescriptions at any pharmacy of their choice.
            </p>
          </SectionCard>

          {/* Documentation Requirements */}
          <SectionCard icon={ClipboardList} title="Prescription documentation requirements">
            <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.8, margin: "0 0 16px" }}>
              For every prescription issued on the platform, the prescribing physician must document the following
              in the patient record:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {documentationItems.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: "14px", alignItems: "flex-start", background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: "12px", padding: "14px 18px" }}>
                  <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#3b82f6", flexShrink: 0, marginTop: "5px" }} />
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b", margin: "0 0 3px" }}>{item.label}</p>
                    <p style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.65, margin: 0 }}>{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Patient Communication & Compliance */}
          <SectionCard icon={ShieldAlert} title="Patient communication & policy compliance">
            <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.8, margin: 0 }}>
              Following any consultation where a prescription is issued or declined, patients receive a consultation
              summary including the physician's clinical notes and any prescription details, are informed of platform
              limitations on medications that can be prescribed via telehealth, and are directed to seek emergency or
              in-person care when clinically appropriate. Any violation of this policy — including prescribing without
              adequate evaluation, prescribing controlled substances in prohibited circumstances, or any financial
              arrangement with a pharmacy — is grounds for <strong style={{ fontWeight: 600, color: "#0f172a" }}>immediate suspension and removal</strong> from
              the platform. This policy is reviewed annually and updated to reflect changes in DEA telehealth
              regulations, Ryan Haight Act guidance, state prescribing laws, or platform operations.
            </p>
          </SectionCard>

          {/* Contact */}
          <SectionCard icon={Mail} title="Contact & policy questions">
            <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.8, margin: "0 0 20px" }}>
              Questions about this policy or a specific prescribing scenario? Reach out to our operations team —
              we respond to all verified requests within 30 days.
            </p>

            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "16px" }}>
                <div style={{ width: "32px", height: "32px", flexShrink: 0, borderRadius: "8px", background: "#fff", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
                  <Mail size={14} strokeWidth={1.75} />
                </div>
                <div>
                  <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#94a3b8", margin: "0 0 3px" }}>Email</p>
                  <a href="mailto:support@humancareconnect.co" style={{ fontSize: "13px", color: "#2563eb", textDecoration: "none" }}>
                    support@humancareconnect.co
                  </a>
                </div>
              </div>

              <div style={{ height: "1px", background: "#e2e8f0", margin: "0 0 16px" }} />

              <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                <div style={{ width: "32px", height: "32px", flexShrink: 0, borderRadius: "8px", background: "#fff", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
                  <MapPin size={14} strokeWidth={1.75} />
                </div>
                <div>
                  <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#94a3b8", margin: "0 0 3px" }}>Mailing address</p>
                  <p style={{ fontSize: "13px", color: "#334155", lineHeight: 1.65, margin: 0 }}>
                    131 Continental Dr, Suite 305<br />Newark, DE 19713
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