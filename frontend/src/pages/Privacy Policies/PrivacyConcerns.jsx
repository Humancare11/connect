import { ShieldCheck, Lock, Database, ShieldAlert, SlidersHorizontal, Mail, MapPin } from "lucide-react";

const privacyTableData = [
  {
    area: "Account info",
    description: "Name, email address, login credentials, and profile details used to manage your account.",
    retention: "Account lifetime + 2 years",
    control: "Yes",
  },
  {
    area: "Medical data",
    description: "Health records, diagnoses, and treatment data — stored securely, never in cookies.",
    retention: "Up to 7 years",
    control: "Limited",
  },
  {
    area: "Comms preferences",
    description: "Email and notification settings that personalize how we contact you.",
    retention: "Up to 1 year",
    control: "Yes",
  },
  {
    area: "Analytics data",
    description: "Anonymized usage patterns via Google Analytics to help us improve the platform experience.",
    retention: "Up to 2 years",
    control: "Yes",
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
        <a href="mailto:privacy@humancareconnect.com" className="text-blue-600 hover:underline">
          privacy@humancareconnect.com
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

export default function PrivacyConcerns() {
  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#f1f5f9", fontFamily: "system-ui, -apple-system, sans-serif", boxSizing: "border-box" }}>

      {/* ── Banner — */}
      <div style={{ width: "100%", background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "28px 28px"}}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "4px 10px", margin: "80px 0 12px" }}>
            <ShieldCheck size={11} />
           HUMANCARE CONNECT, INC
          </div>
          <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#0f172a", margin: "15px 0 4px", letterSpacing: "-0.02em" }}>Telehealth Informed Consent</h1>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>Please read carefully before your consultation</p>
        </div>
      </div>

      {/* ── Main Content — explicitly centered with inline styles ── */}
      <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: "750px", padding: "36px 24px 60px", display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Notice */}
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "14px", padding: "18px 22px", fontSize: "14px", color: "#1e40af", lineHeight: 1.7 }}>
            By using our platform, you consent to the privacy practices described on this page — what we collect, how long we keep it, and how you can control it.
          </div>

          {/* Privacy Rights */}
          <SectionCard icon={Lock} title="Your privacy rights">
            <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.8, margin: 0 }}>
              You have the right to access, correct, or delete your personal information at any time. Under applicable
              data protection laws, you may also request restriction of processing, object to certain uses, and exercise
              data portability. We are committed to honoring these rights promptly and transparently.
            </p>
          </SectionCard>

          {/* Information We Collect */}
          <SectionCard icon={Database} title="Information we collect">
            <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.8, margin: "0 0 20px" }}>
              We collect only what's necessary to deliver safe, effective healthcare coordination services.
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
            </p>
          </SectionCard>

          {/* How We Protect */}
          <SectionCard icon={ShieldAlert} title="How we protect your information">
            <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.8, margin: 0 }}>
              We use AES-256 encryption at rest and TLS 1.3 for data in transit, with strict role-based access controls.
              Our systems undergo regular third-party audits and penetration testing. Protected health information (PHI)
              is <strong style={{ fontWeight: 600, color: "#0f172a" }}>never</strong> stored in cookies or browser storage.
            </p>
          </SectionCard>

          {/* Managing Preferences */}
          <SectionCard icon={SlidersHorizontal} title="Managing your privacy preferences">
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {managementItems.map((item, i) => (
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

          {/* Contact */}

                    <SectionCard icon={Mail} title="Contact & privacy requests">
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