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

export default function PhysicianCredentialingPolicy() {
    return (
        <div style={{ width: "100%", minHeight: "100vh", background: "#f1f5f9", fontFamily: "system-ui, -apple-system, sans-serif", boxSizing: "border-box" }}>

            {/* ── Banner — */}
            <div style={{ width: "100%", background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
                <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "28px 28px" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "4px 10px", margin: "80px 0 12px" }}>
                        <ShieldCheck size={11} />
                        HUMANCARE CONNECT, INC
                    </div>
                    <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#0f172a", margin: "15px 0 4px", letterSpacing: "-0.02em" }}>Physician Credentialing Policy</h1>
                    <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>Version 1.0  |  Effective: June 2026</p>
                </div>
            </div>

            {/* ── Main Content — explicitly centered with inline styles ── */}
            <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
                <div style={{ width: "100%", maxWidth: "750px", padding: "36px 24px 60px", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* Notice */}
                    <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "14px", padding: "18px 22px", fontSize: "14px", color: "#1e40af", lineHeight: 1.7 }}>
                        By using our platform, you consent to the privacy practices described on this page — what we collect, how long we keep it, and how you can control it.
                    </div>



                    {/* Information We Collect */}
                    import {FileText} from "lucide-react";

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
                    "All physicians, nurse practitioners, and licensed prescribers onboarding to or practicing on the Humancare Connect platform",
  },
                    ];

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
                    {/* Privacy Rights */}


                    <SectionCard icon={Target} title="Purpose">
                        <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.8, margin: 0 }}>
                            This Physician Credentialing Policy establishes the standards and procedures Humancare Connect, Inc.
                            uses to verify the qualifications, licensure, and professional standing of all healthcare providers
                            admitted to practice on the platform.
                        </p>

                        <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.8, marginTop: "12px" }}>
                            The goal is to ensure that patients receive telehealth services only from duly licensed, competent,
                            and professionally accountable providers.
                        </p>
                    </SectionCard>

                    {/* How We Protect */}
                    <SectionCard icon={Users} title="Scope">
                        <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.8, margin: 0 }}>
                            This policy applies to:
                        </p>

                        <div style={{ marginTop: "10px" }}>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• All physicians (MD/DO) applying to deliver telehealth consultations via Humancare Connect</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• Nurse Practitioners (NP) and Physician Assistants (PA) where permitted by applicable state law</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• All licensed prescribers regardless of specialty</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• Existing providers at each annual re-credentialing cycle</p>
                        </div>
                    </SectionCard>

                    {/* Managing Preferences */}
                    <SectionCard icon={FileCheck} title="Credentialing Requirements">
                        <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.8, margin: 0 }}>
                            All applicants must complete mandatory documentation, primary source verification, and background screening before activation.
                        </p>
                    </SectionCard>

                    <SectionCard icon={FileText} title="Mandatory Documentation">
                        <div>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• Valid, current, unrestricted medical license for each US state in which they intend to practice</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• National Provider Identifier (NPI) — Type 1 individual provider NPI</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• Board certification certificate (where applicable)</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• Drug Enforcement Administration (DEA) registration (if prescribing controlled substances)</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• Malpractice insurance — minimum $1,000,000 / $3,000,000 aggregate</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• Professional CV or resume</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• Government-issued photo ID</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• Signed Provider Agreement</p>
                        </div>
                    </SectionCard>

                    <SectionCard icon={SearchCheck} title="Primary Source Verification">
                        <div>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• Medical license verified with state medical boards or NCQA-compliant services</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• NPI verified via NPPES database</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• Board certification verified with ABMS, AOA, or equivalent boards</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• DEA registration verified with DEA Diversion Control Division</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• Malpractice insurance verified with insurer directly</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• OIG and SAM exclusion checks performed</p>
                        </div>
                    </SectionCard>

                    <SectionCard icon={ShieldAlert} title="Background Screening">
                        <div>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• Healthcare-related felony or misdemeanor conviction</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• Medicare/Medicaid or federal healthcare exclusion</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• License revocation, suspension, or restriction within past 5 years</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• DEA revocation or surrender in lieu of revocation</p>
                        </div>
                    </SectionCard>

                    <SectionCard icon={GitBranch} title="Credentialing Workflow">
                        <div>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>1. Provider submits application via portal with documents</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>2. Operations review completed within 3 business days</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>3. Primary source verification conducted</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>4. OIG/SAM checks completed</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>5. Background screening reviewed</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>6. Credentialing decision issued</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>7. Notification sent within 15 business days</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>8. Provider completes onboarding and activation</p>
                        </div>
                    </SectionCard>

                    <SectionCard icon={RefreshCw} title="Re-Credentialing">
                        <div>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• Annual license verification and validity checks</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• Updated OIG/SAM exclusion checks</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• Review of disciplinary actions or malpractice claims</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• Malpractice insurance verification</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• DEA registration verification (if applicable)</p>
                        </div>
                    </SectionCard>

                    <SectionCard icon={Activity} title="Continuous Monitoring">
                        <div>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• Monthly OIG exclusion list checks</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• Automated license expiry alerts (90 & 30 days)</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• Patient complaint pattern monitoring</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• Adverse event and disciplinary tracking</p>
                        </div>
                    </SectionCard>

                    <SectionCard icon={Ban} title="Disqualification & Termination">
                        <div>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• Misrepresentation or omission in application</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• License suspension, restriction, or revocation</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• OIG/SAM exclusion or debarment</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• DEA revocation</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• Lapsed malpractice insurance</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.8 }}>• Patient safety concerns</p>
                        </div>
                    </SectionCard>

                    <SectionCard icon={Gavel} title="Appeals">
                        <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.8, margin: 0 }}>
                            Providers may appeal adverse credentialing decisions in writing within 15 business days.
                            Appeals are reviewed by the Head of Operations, and a final decision is issued within 30 business days.
                        </p>
                    </SectionCard>

                    <SectionCard icon={Archive} title="Recordkeeping">
                        <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.8, margin: 0 }}>
                            All credentialing records are retained for a minimum of seven years and stored in a secure,
                            access-controlled system. Records may be disclosed to regulatory authorities when legally required.
                        </p>
                    </SectionCard>

                    <SectionCard icon={ClipboardCheck} title="Policy Review">
                        <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.8, margin: 0 }}>
                            This policy is reviewed annually and updated as necessary to reflect changes in law,
                            accreditation standards, or operational requirements. The Head of Operations is responsible
                            for maintaining compliance and timely updates.
                        </p>
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