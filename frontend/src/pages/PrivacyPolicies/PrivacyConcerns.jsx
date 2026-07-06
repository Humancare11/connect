import { ShieldCheck,
Lock,
Database,
ShieldAlert,
SlidersHorizontal,
Mail,
MapPin,
FileText } from "lucide-react";

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
    value: "Annual",
  },
  {
    label: "Applies To",
    value:
      "All patients, providers, and staff involved in teleconsultations on the Humancare Connect platform",
  },
];

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

export default function TeleconsultationWorkflowPolicy() {
  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#f1f5f9", fontFamily: "system-ui, -apple-system, sans-serif", boxSizing: "border-box" }}>

      {/* ── Banner — */}
      <div style={{ width: "100%", background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "28px 28px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "4px 10px", margin: "80px 0 12px" }}>
            <ShieldCheck size={11} />
            HUMANCARE CONNECT, INC
          </div>
          <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#0f172a", margin: "15px 0 4px", letterSpacing: "-0.02em" }}>Teleconsultation Workflow Policy</h1>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>Version 1.0 | Effective: June 2026</p>
        </div>
      </div>

      {/* ── Main Content — explicitly centered with inline styles ── */}
      <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: "750px", padding: "36px 24px 60px", display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Notice */}
          {/* <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "14px", padding: "18px 22px", fontSize: "14px", color: "#1e40af", lineHeight: 1.7 }}>
            By using our platform, you consent to the privacy practices described on this page — what we collect, how long we keep it, and how you can control it.
          </div> */}

          {/* Document  */}
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

          {/* Information We Collect */}
          <SectionCard icon={FileText} title="1. Purpose">
  <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.8, margin: 0 }}>
    This Teleconsultation Workflow Policy describes the end-to-end process through
    which a patient engages with a licensed physician via the Humancare Connect
    platform, from initial registration through post-consultation follow-up.
    The policy ensures that every consultation meets applicable clinical,
    legal, and operational standards.
  </p>
</SectionCard>
          {/* How We Protect */}
          <SectionCard icon={ShieldCheck} title="2. Platform Overview">
  <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.8, margin: 0 }}>
    Humancare Connect is a specialty-based telehealth platform connecting
    patients with licensed US physicians for secure audio/video consultations.
    Patients select their medical concern and are matched with a qualified
    physician based on specialty, licensure, and availability.
    Physician identity is not disclosed prior to payment to protect provider
    privacy. Consultations may or may not result in a prescription, referral,
    or additional recommendations, depending on the physician's independent
    clinical judgment.
  </p>
</SectionCard>

          {/* Managing Preferences */}
          <SectionCard icon={Database} title="3. Patient Registration">
  <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "18px", lineHeight: 1.8 }}>
    Before accessing teleconsultation services, patients must complete the
    following registration steps:
  </p>

  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
    {[
      ["Account Creation", "Provide full legal name, date of birth, email address, and create a secure account."],
      ["Identity Verification", "Verify email using a one-time passcode (OTP). Additional verification may be required for controlled substance consultations."],
      ["State of Residence", "Confirm current state of residence to determine physician eligibility and applicable telehealth regulations."],
      ["Payment Method", "Add a valid payment method. Consultations are charged on a flat-fee per visit."],
      ["Medical History Intake", "Complete a structured intake form including medications, allergies, medical history, and chief complaint."],
      ["Informed Consent", "Review and acknowledge the Telehealth Informed Consent document before proceeding."]
    ].map(([title, text], index) => (
      <div key={index} style={{
        background:"#f8fafc",
        border:"1px solid #e2e8f0",
        borderRadius:"12px",
        padding:"16px"
      }}>
        <p style={{fontWeight:600,fontSize:"13px",margin:"0 0 6px",color:"#1e293b"}}>
          {index+1}. {title}
        </p>
        <p style={{fontSize:"13px",color:"#64748b",lineHeight:1.7,margin:0}}>
          {text}
        </p>
      </div>
    ))}
  </div>
</SectionCard>

{/* Appoinment */}
<SectionCard icon={FileText} title="4. Appointment Booking">
  <ul style={{ margin:0, paddingLeft:"20px", color:"#64748b", lineHeight:1.9, fontSize:"14px" }}>
    <li>Select a medical category based on the presenting concern.</li>
    <li>Select the appropriate specialty or condition.</li>
    <li>View available appointment slots based on physician availability.</li>
    <li>Select a preferred time slot and complete payment.</li>
    <li>Receive an email confirmation containing appointment details and access instructions.</li>
    <li>Physician assignment is completed automatically based on licensure, specialty, and availability. Physician identity is disclosed 24 hours before the consultation (or immediately for on-demand appointments).</li>
  </ul>
</SectionCard>
{/* PRe */}
<SectionCard icon={ShieldAlert} title="5. Pre-Consultation">
  <ul style={{ margin:0, paddingLeft:"20px", color:"#64748b", lineHeight:1.9, fontSize:"14px" }}>
    <li>Patient receives an appointment reminder with consultation link.</li>
    <li>Technical requirements including browser, camera, and microphone access are provided.</li>
    <li>Patient reviews and confirms submitted intake information.</li>
    <li>Physician reviews the patient's medical history and chief complaint.</li>
    <li>The platform performs an automated audio/video system check before the consultation begins.</li>
  </ul>
</SectionCard>
{/* Live consultaion */}
<SectionCard icon={ShieldCheck} title="6. Live Consultation">
  <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
    {[
      "Patient and physician join the secure audio/video session.",
      "Physician verifies the patient's identity.",
      "Clinical interview is conducted based on the presenting complaint.",
      "Symptoms, medications, allergies, and relevant medical history are reviewed.",
      "Physician exercises independent clinical judgment.",
      "Diagnosis, treatment recommendations, or referrals are provided as appropriate.",
      "Electronic prescription is issued when clinically appropriate and legally permissible.",
      "Follow-up instructions, emergency warning signs, and telehealth limitations are explained.",
      "Session concludes and only session metadata is retained; audio/video is not recorded."
    ].map((item,index)=>(
      <div key={index} style={{
        borderLeft:"4px solid #2563eb",
        background:"#f8fafc",
        padding:"14px 16px",
        borderRadius:"8px"
      }}>
        <span style={{fontWeight:600,color:"#1e293b"}}>Step {index+1}</span>
        <p style={{margin:"6px 0 0",color:"#64748b",fontSize:"13px",lineHeight:1.7}}>
          {item}
        </p>
      </div>
    ))}
  </div>
</SectionCard>
{/*Post */}
<SectionCard icon={Database} title="7. Post-Consultation">
  <ul style={{ margin:0, paddingLeft:"20px", color:"#64748b", lineHeight:1.9, fontSize:"14px" }}>
    <li>Physician completes clinical encounter notes within 24 hours.</li>
    <li>Patient receives a secure consultation summary.</li>
    <li>Prescription details and pharmacy confirmation are provided when applicable.</li>
    <li>Follow-up instructions and emergency guidance are included.</li>
    <li>Patients receive a satisfaction survey within 48 hours.</li>
    <li>Records are retained within the HIPAA-compliant EHR system according to applicable retention laws.</li>
  </ul>
</SectionCard>

<SectionCard icon={ShieldAlert} title="8. Emergency & Escalation Protocol">
  <div style={{
    background:"#fef2f2",
    border:"1px solid #fecaca",
    borderRadius:"12px",
    padding:"18px",
    marginBottom:"18px"
  }}>
    <strong style={{color:"#991b1b"}}>Humancare Connect is NOT an emergency service.</strong>
  </div>

  <ul style={{ margin:0, paddingLeft:"20px", color:"#64748b", lineHeight:1.9, fontSize:"14px" }}>
    <li>Patients experiencing life-threatening emergencies must call 911 or visit the nearest emergency room.</li>
    <li>The platform prominently displays emergency contact information during consultations.</li>
    <li>Physicians may discontinue telehealth visits requiring urgent in-person care.</li>
    <li>Mental health crises are escalated to 988 or 911 in accordance with applicable laws.</li>
    <li>Critical patient safety incidents are documented in the platform's incident log.</li>
  </ul>
</SectionCard>
{/*  */}
<SectionCard icon={SlidersHorizontal} title="9. Quality Assurance">
  <ul style={{ margin:0, paddingLeft:"20px", color:"#64748b", lineHeight:1.9, fontSize:"14px" }}>
    <li>Clinical encounter notes are periodically audited.</li>
    <li>Low patient satisfaction scores trigger consultation reviews.</li>
    <li>Clinical complaints are escalated through the provider credentialing process.</li>
    <li>Quarterly prescribing analytics identify potential quality concerns.</li>
    <li>Providers with repeated quality issues undergo structured performance reviews and may be suspended if necessary.</li>
  </ul>
</SectionCard>
{/*  */}
<SectionCard icon={Lock} title="10. No Recording Policy">
  <p style={{ fontSize:"14px", color:"#64748b", lineHeight:1.8, margin:0 }}>
    Humancare Connect does not record audio or video consultations.
    Physician encounter notes constitute the official clinical record.
    Patients and physicians may not independently record consultations
    without the explicit written consent of both parties and in compliance
    with applicable state recording laws.
  </p>
</SectionCard>
<SectionCard icon={ShieldAlert} title="11. Platform Downtime & Technical Failure">
  <ul style={{ margin:0, paddingLeft:"20px", color:"#64748b", lineHeight:1.9, fontSize:"14px" }}>
    <li>Patients should use the in-app chat feature to contact support.</li>
    <li>If technical issues prevent consultation completion, patients will receive either a full refund or a complimentary rescheduled appointment.</li>
    <li>Where clinical advice has already been partially delivered, physicians will follow up through the secure platform messaging system to ensure continuity of care.</li>
  </ul>
</SectionCard>
          {/* Contact */}

          <SectionCard icon={Mail} title="Contact Information">
            <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.8, margin: "0 0 20px" }}>
              Questions about this policy or want to exercise your rights? Reach out to our privacy team — we respond
              to all verified requests within 30 days.
            </p>

            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "16px" }}>
                <div style={{ width: "32px", height: "32px", flexShrink: 0, borderRadius: "8px", background: "#fff", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
                  <Mail size={14} strokeWidth={1.75} />
                </div>
                <div>
                  <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#94a3b8", margin: "0 0 3px" }}>Email</p>
                  <a href="mailto:support@humancareconnect.com" style={{ fontSize: "13px", color: "#2563eb", textDecoration: "none" }}>
                    support@humancareconnect.com
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