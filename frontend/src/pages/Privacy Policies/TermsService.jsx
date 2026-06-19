import {
  FileText,
  Stethoscope,
  UserCheck,
  UserPlus,
  ShieldAlert,
  CreditCard,
  Ban,
  Copyright,
  Lock,
  AlertTriangle,
  Shield,
  Scale,
  Gavel,
  RefreshCw,
  XCircle,
  Mail,
  MapPin,
  ShieldCheck
} from "lucide-react";


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

export default function TermsService() {
    return (
        <div style={{ width: "100%", minHeight: "100vh", background: "#f1f5f9", fontFamily: "system-ui, -apple-system, sans-serif", boxSizing: "border-box" }}>

            {/* ── Banner — */}
            <div style={{ width: "100%", background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
                <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "28px 28px" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "4px 10px", margin: "80px 0 12px" }}>
                        <ShieldCheck size={11} />
                        HUMANCARE CONNECT, INC
                    </div>
                    <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#0f172a", margin: "15px 0 4px", letterSpacing: "-0.02em" }}>Terms of Service</h1>
                    <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>Effective Date: June 8, 2026 | Last Updated: June 8, 2026</p>
                </div>
            </div>

            {/* ── Main Content  ── */}
            <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
                <div style={{ width: "100%", maxWidth: "750px", padding: "36px 24px 60px", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* acceptance  */}
                    <SectionCard icon={FileText} title="Acceptance of Terms">
                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            By accessing or using the Humancare Connect platform at humancareworldwide.com (the "Platform"), you agree to be bound by these Terms of Service ("Terms").
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            If you do not agree to these Terms, do not use the Platform.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            These Terms constitute a legally binding agreement between you and Humancare Connect, Inc. ("Humancare Connect," "we," "us," or "our"), a Delaware corporation.
                        </p>
                    </SectionCard>

                    {/* Desc */}
                    <SectionCard icon={Stethoscope} title="Description of Services">
                        <p style={{ color: "#64748b", lineHeight: 1.9 }}>
                            Humancare Connect is a telehealth marketplace platform that connects patients with licensed, US-based physicians for obtaining medical second opinions and consultations.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.9 }}>
                            • Asynchronous and synchronous medical consultations via secure video, audio, or messaging<br />
                            • Medical second opinions on diagnoses, treatment plans, and health concerns<br />
                            • Access to licensed physicians across multiple specialties
                        </p>

                        <div
                            style={{
                                background: "#fef2f2",
                                border: "1px solid #fecaca",
                                borderRadius: "12px",
                                padding: "16px",
                                marginTop: "16px",
                            }}
                        >
                            <p style={{ color: "#dc2626", fontWeight: 700, margin: 0 }}>
                                IMPORTANT: Humancare Connect is NOT an emergency medical service. If you are experiencing a medical emergency, call 911 or visit your nearest emergency room immediately.
                            </p>
                        </div>
                    </SectionCard>

                    {/* Eligiblity */}
                    <SectionCard icon={UserCheck} title="Eligibility">
                        <p style={{ color: "#64748b", lineHeight: 1.9 }}>
                            To use the Platform, you must:
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.9 }}>
                            • Be at least 18 years of age<br />
                            • Be a resident of or located in the United States at the time of consultation<br />
                            • Have the legal capacity to enter into a binding agreement<br />
                            • Provide accurate, complete, and current registration information
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            By using the Platform, you represent and warrant that you meet all eligibility requirements.
                        </p>
                    </SectionCard>

                    {/* account */}
                    <SectionCard icon={UserPlus} title="Account Registration">
                        <p style={{ color: "#64748b", lineHeight: 1.9 }}>
                            You must create an account to access most features of the Platform.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.9 }}>
                            • Provide accurate and complete registration information<br />
                            • Maintain the security of your account credentials<br />
                            • Notify us immediately of any unauthorized use of your account<br />
                            • Not share your account credentials with others
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            You are responsible for all activity that occurs under your account. Humancare Connect is not liable for losses arising from failure to maintain account security.
                        </p>
                    </SectionCard>

                    {/* Medical Disclaimer */}
                    <SectionCard icon={ShieldAlert} title="Medical Disclaimer">
                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            THE PLATFORM PROVIDES ACCESS TO MEDICAL SECOND OPINIONS AND CONSULTATIONS ONLY.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            IT IS NOT A SUBSTITUTE FOR PROFESSIONAL MEDICAL ADVICE, DIAGNOSIS, OR TREATMENT FROM YOUR PRIMARY CARE PHYSICIAN OR SPECIALIST.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Physicians on the Platform are independent contractors and not employees of Humancare Connect.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            The physician-patient relationship exists solely between you and the consulting physician.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Always seek the advice of a qualified healthcare provider regarding any medical condition.
                        </p>
                    </SectionCard>

                    {/* payment terms  */}
                    <SectionCard icon={CreditCard} title="Payment Terms">
                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Consultation fees are displayed on the Platform prior to booking. Fees vary by physician and consultation type.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            All fees are charged in U.S. Dollars (USD).
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Payments are processed securely through Stripe, Inc.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            By providing payment information, you authorize Humancare Connect and Stripe to charge your selected payment method.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Please review our Refund & Cancellation Policy for details regarding refunds and cancellations.
                        </p>
                    </SectionCard>
                    {/* user conduct */}
                    <SectionCard icon={Ban} title="User Conduct">
                        <p style={{ color: "#64748b", lineHeight: 1.9 }}>
                            You agree not to:
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.9 }}>
                            • Use the Platform for unlawful purposes<br />
                            • Provide false or misleading health information<br />
                            • Attempt unauthorized access to Platform systems<br />
                            • Interfere with Platform operations or servers<br />
                            • Harass, abuse, or harm other users<br />
                            • Reproduce or distribute Platform content without permission<br />
                            • Use bots, scrapers, or automated tools on the Platform
                        </p>
                    </SectionCard>
                    {/* intellectual */}
                    <SectionCard icon={Copyright} title="Intellectual Property">
                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            All content on the Platform, including text, graphics, logos, and software, is owned by Humancare Connect or its licensors and is protected by applicable intellectual property laws.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            You are granted a limited, non-exclusive, non-transferable license to use the Platform solely for personal, non-commercial purposes.
                        </p>
                    </SectionCard>
                    {/* privacy */}
                    <SectionCard icon={Lock} title="Privacy">
                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Your use of the Platform is governed by our Privacy Policy and our HIPAA Notice of Privacy Practices.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            By using the Platform, you consent to the collection, use, and disclosure of information as described in those documents.
                        </p>
                    </SectionCard>
                    {/* Limitation of Liability */}
                    <SectionCard icon={AlertTriangle} title="Limitation of Liability">
                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            TO THE MAXIMUM EXTENT PERMITTED BY LAW, HUMANCARE CONNECT SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM USE OF THE PLATFORM.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT PAID TO US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
                        </p>
                    </SectionCard>

                    {/* indemnification */}
                    <SectionCard icon={Shield} title="Indemnification">
                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            You agree to indemnify and hold harmless Humancare Connect and its officers, directors, employees, and agents from claims, damages, liabilities, losses, and expenses arising from:
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.9 }}>
                            • Your use of the Platform<br />
                            • Violation of these Terms<br />
                            • Infringement of third-party rights
                        </p>
                    </SectionCard>
                    {/* dispute resoultion */}
                    <SectionCard icon={Scale} title="Dispute Resolution">
                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Any disputes arising from these Terms or use of the Platform shall be resolved through binding arbitration in accordance with the American Arbitration Association Consumer Arbitration Rules.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            You waive the right to participate in class action litigation.
                        </p>
                    </SectionCard>
                    {/* govt law */}
                    <SectionCard icon={Gavel} title="Governing Law">
                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            These Terms are governed by the laws of the State of Delaware without regard to conflict of law principles.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Any legal action not subject to arbitration shall be brought exclusively in the courts of New Castle County, Delaware.
                        </p>
                    </SectionCard>

                    {/* modification */}
                    <SectionCard icon={RefreshCw} title="Modifications">
                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            We reserve the right to modify these Terms at any time.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Material changes will be posted on the Platform along with an updated effective date.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Continued use of the Platform after changes are posted constitutes acceptance of the revised Terms.
                        </p>
                    </SectionCard>
                    {/* termination */}
                    <SectionCard icon={XCircle} title="Termination">
                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            We reserve the right to suspend or terminate your account and access to the Platform at our discretion, with or without notice.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Upon termination, your right to use the Platform ceases immediately.
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