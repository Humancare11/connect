import {
  ShieldCheck,
  Cookie,
  Info,
  Layers,
  Database,
  Globe,
  Lock,
  Settings2,
  EyeOff,
  Users,
  RefreshCw,
  Mail,
  MapPin,
} from "lucide-react";

const cookieTypes = [
  {
    type: "Strictly Necessary",
    purpose: "Login sessions, security tokens, CSRF protection",
    duration: "Session / 24 hrs",
    optout: "No",
  },
  {
    type: "Functional",
    purpose: "Language, timezone and preference settings",
    duration: "Up to 1 year",
    optout: "Yes",
  },
  {
    type: "Analytics",
    purpose: "Usage statistics and platform insights",
    duration: "Up to 2 years",
    optout: "Yes",
  },
  {
    type: "Performance",
    purpose: "Reliability and performance monitoring",
    duration: "Up to 1 year",
    optout: "Yes",
  },
];
const cookieList = [
  {
    name: "session_id",
    provider: "Humancare Connect",
    type: "Strictly Necessary",
    purpose: "Maintains user login session",
  },
  {
    name: "csrf_token",
    provider: "Humancare Connect",
    type: "Strictly Necessary",
    purpose: "Prevents cross-site request forgery",
  },
  {
    name: "user_prefs",
    provider: "Humancare Connect",
    type: "Functional",
    purpose: "Stores user preferences",
  },
  {
    name: "_ga",
    provider: "Google Analytics",
    type: "Analytics",
    purpose: "Distinguishes visitors",
  },
  {
    name: "_ga_*",
    provider: "Google Analytics",
    type: "Analytics",
    purpose: "Analytics session tracking",
  },
];

function ControlBadge({ value }) {
  const styles = {
    Yes: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Limited: "bg-amber-50 text-amber-700 border-amber-200",
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

export default function CookiePolicy() {
  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#f1f5f9", fontFamily: "system-ui, -apple-system, sans-serif", boxSizing: "border-box" }}>

      {/* ── Banner — */}
      <div style={{ width: "100%", background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "28px 28px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "4px 10px", margin: "80px 0 12px" }}>
            <ShieldCheck size={11} />
            HUMANCARE CONNECT, INC
          </div>
          <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#0f172a", margin: "15px 0 4px", letterSpacing: "-0.02em" }}>Cookie Policy</h1>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>  Effective Date: June 8, 2026</p>
        </div>
      </div>

      {/* ── Main Content — explicitly centered with inline styles ── */}
      <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: "750px", padding: "36px 24px 60px", display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Notice */}
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "14px", padding: "18px 22px", fontSize: "14px", color: "#1e40af", lineHeight: 1.7 }}>
            THIS NOTICE DESCRIBES HOW MEDICAL INFORMATION ABOUT YOU MAY BE USED AND DISCLOSED AND HOW YOU CAN GET ACCESS TO THIS INFORMATION. PLEASE REVIEW IT CAREFULLY.
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
            This Cookie Policy explains how Humancare Connect uses cookies and similar
            technologies on our Platform, what information they collect, and how you can
            manage your preferences.
          </div>

          {/* intro*/}
          <SectionCard icon={Info} title="Introduction">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Humancare Connect, Inc. uses cookies and similar tracking technologies on
              humancareconnect.co and related subdomains.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              This Cookie Policy explains what cookies are, how we use them, your
              choices regarding their use, and how to manage your preferences.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              This Cookie Policy forms part of our Privacy Policy.
            </p>
          </SectionCard>
          {/* cookies */}
          <SectionCard icon={Cookie} title="What Are Cookies?">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Cookies are small text files stored on your device when you visit a
              website.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              They help websites function efficiently, remember preferences, improve
              user experience, and provide information about website usage.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              We may also use web beacons, pixels, local storage, and session storage
              technologies for similar purposes.
            </p>
          </SectionCard>

          {/* type */}
          <SectionCard icon={Layers} title="Types of Cookies We Use">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              We use a limited number of cookies necessary to operate and improve our
              Platform.
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
                  {cookieTypes.map((row, i) => (
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
          </SectionCard>

          {/* */}

          <SectionCard icon={Database} title="Specific Cookies We Use">
            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              Below are the primary cookies used on our Platform.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {cookieList.map((item, i) => (
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

          {/* 3 party*/}
          <SectionCard icon={Globe} title="Third-Party Cookies">
            <p style={{ color: "#64748b", lineHeight: 1.9 }}>
              • Google Analytics for website usage analytics<br />
              • Stripe for payment processing and fraud prevention
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.8 }}>
              We do not permit third-party advertising networks or social media
              platforms to place tracking cookies through our Platform.
            </p>
          </SectionCard>

          {/*   */}
          <SectionCard icon={Lock} title="Cookies and Protected Health Information">
  <p style={{ color: "#64748b", lineHeight: 1.8 }}>
    Cookies used on our Platform do not contain Protected Health Information
    (PHI).
  </p>

  <p style={{ color: "#64748b", lineHeight: 1.8 }}>
    Medical records, consultation history, and health information are stored
    securely in protected databases and are never stored in cookies.
  </p>

  <p style={{ color: "#64748b", lineHeight: 1.8 }}>
    We do not use cookies to track health information across third-party
    websites.
  </p>
</SectionCard>
          {/*  */}
         <SectionCard icon={Settings2} title="Your Cookie Choices">
  <p style={{ color: "#64748b", lineHeight: 1.9 }}>
    • Use our Cookie Consent Banner to accept, reject, or customize cookies<br />
    • Configure browser settings to block or delete cookies<br />
    • Disable Google Analytics using Google's opt-out browser add-on
  </p>

  <div
    style={{
      marginTop: "18px",
      padding: "16px",
      background: "#f8fafc",
      borderRadius: "12px",
      border: "1px solid #e2e8f0",
    }}
  >
    <p style={{ margin: 0, color: "#64748b" }}>
      Disabling strictly necessary cookies may prevent parts of the Platform
      from functioning correctly.
    </p>
  </div>
</SectionCard>
          {/*  */}
         <SectionCard icon={EyeOff} title="Do Not Track">
  <p style={{ color: "#64748b", lineHeight: 1.8 }}>
    Some browsers send "Do Not Track" (DNT) signals.
  </p>

  <p style={{ color: "#64748b", lineHeight: 1.8 }}>
    Our Platform currently does not respond to DNT signals because there is
    no universally accepted industry standard for interpreting them.
  </p>
</SectionCard>
          {/* gdpr */}
          <SectionCard icon={Users} title="GDPR and International Users">
  <p style={{ color: "#64748b", lineHeight: 1.8 }}>
    Users located in the EEA, United Kingdom, or Switzerland receive
    additional protections under GDPR and related privacy laws.
  </p>

  <p style={{ color: "#64748b", lineHeight: 1.8 }}>
    Non-essential cookies are processed only with consent, and consent may
    be withdrawn at any time.
  </p>
</SectionCard> 
{/*  */}
<SectionCard icon={ShieldCheck} title="California Residents">
  <p style={{ color: "#64748b", lineHeight: 1.8 }}>
    California residents may have additional rights under the California
    Consumer Privacy Act (CCPA).
  </p>

  <p style={{ color: "#64748b", lineHeight: 1.8 }}>
    Please review our California Privacy Rights Notice for additional
    information.
  </p>
</SectionCard>

<SectionCard icon={RefreshCw} title="Changes to This Policy">
  <p style={{ color: "#64748b", lineHeight: 1.8 }}>
    We may update this Cookie Policy from time to time.
  </p>

  <p style={{ color: "#64748b", lineHeight: 1.8 }}>
    The Last Updated date reflects the most recent revision.
  </p>

  <p style={{ color: "#64748b", lineHeight: 1.8 }}>
    Material changes may be communicated through email or a prominent notice
    on the Platform.
  </p>
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
              For questions about this Notice or your privacy rights, please contact
              our Privacy Officer.
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