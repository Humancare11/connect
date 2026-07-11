import {
    ShieldCheck,
    Monitor,
    AlertTriangle,
    Stethoscope,
    Lock,
    UserCheck,
    HeartHandshake,
    FileText,
    CircleOff,
    CalendarCheck,
    FileSignature,
    Mail,
    MapPin,
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

export default function PatientInformedConsentForm() {
    return (
        <div style={{ width: "100%", minHeight: "100vh", background: "#f1f5f9", fontFamily: "system-ui, -apple-system, sans-serif", boxSizing: "border-box" }}>

            {/* ── Banner — */}
            <div style={{ width: "100%", background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
                <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "28px 28px" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "4px 10px", margin: "80px 0 12px" }}>
                        <ShieldCheck size={11} />
                        HUMANCARE CONNECT, INC
                    </div>
                    <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#0f172a", margin: "15px 0 4px", letterSpacing: "-0.02em" }}>Patient Informed Consent Form</h1>
                    <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>   Effective Date: 2026-06-04 | Version 1.0</p>
                </div>
            </div>

            {/* ── Main Content — explicitly centered with inline styles ── */}
            <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
                <div style={{ width: "100%", maxWidth: "750px", padding: "36px 24px 60px", display: "flex", flexDirection: "column", gap: "16px" }}>

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
                        Please read this consent form carefully before using the Humancare Connect
                        telehealth platform. By proceeding, you confirm that you have read,
                        understood, and agree to the terms below.
                    </div>

                    {/* nature of service*/}
                    <SectionCard icon={Monitor} title="Nature of Telehealth Services">
                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Humancare Connect provides telehealth services including online
                            consultations, prescription management, sick notes, prescription refills,
                            fit-to-fly certificates, house call coordination, and wellness programs.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Services are delivered remotely by licensed healthcare professionals
                            through our secure digital platform.
                        </p>
                    </SectionCard>

                    {/* legal duty */}
                    <SectionCard icon={AlertTriangle} title="Limitations of Telehealth">
                        <p style={{ color: "#64748b", lineHeight: 1.9 }}>
                            • Telehealth consultations are not a substitute for in-person medical care
                            in all situations<br />
                            • Doctors may refer patients for in-person evaluation when necessary<br />
                            • Humancare Connect is NOT an emergency service<br />
                            • Technical failures may occasionally interrupt consultations<br />
                            • Prescriptions and medical certificates remain subject to local laws
                        </p>

                        <div
                            style={{
                                marginTop: "18px",
                                padding: "16px",
                                background: "#fef2f2",
                                border: "1px solid #fecaca",
                                borderRadius: "12px",
                                color: "#dc2626",
                                fontWeight: 600,
                            }}
                        >
                            For medical emergencies, call 911 or your local emergency services.
                        </div>
                    </SectionCard>
                    {/*  treatment */}
                    <SectionCard icon={Stethoscope} title="Consent to Treatment">
                        <p style={{ color: "#64748b", lineHeight: 1.9 }}>
                            I consent to:
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.9 }}>
                            • Receive consultations, medical advice, prescriptions, and clinical services<br />
                            • Allow healthcare providers to review submitted health information<br />
                            • Clinical decisions being based on information I provide<br />
                            • Follow-up communication regarding treatment and prescriptions
                        </p>
                    </SectionCard>

                    {/*PHI*/}
                    <SectionCard icon={Lock} title="Consent to PHI Collection and Use">
                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            I consent to Humancare Connect collecting, storing, and using my
                            Protected Health Information (PHI).
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.9 }}>
                            • Name, contact details, and date of birth<br />
                            • Symptoms, medical history, and consultation details<br />
                            • Consultation notes, diagnoses, prescriptions, and reports<br />
                            • Program-related information for wellness services
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            My PHI will only be used for treatment, operations, and legal compliance
                            as described in the Privacy Notice.
                        </p>
                    </SectionCard>

                    {/* treating dr */}
                    <SectionCard icon={UserCheck} title="Consent to Share with Treating Doctor">
                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            I consent to my PHI being shared with the licensed doctor or consultant
                            assigned to my case for consultation and follow-up care purposes.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            The treating doctor will maintain confidentiality in accordance with
                            applicable healthcare privacy laws.
                        </p>
                    </SectionCard>

                    {/* wellness */}
                    <SectionCard icon={HeartHandshake} title="Mental Health, Sexual Health and Weight Loss Programs">
                        <p style={{ color: "#64748b", lineHeight: 1.9 }}>
                            If I enroll in a wellness program, I understand:
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.9 }}>
                            • Programs are supportive and do not replace specialist care<br />
                            • Referral to specialists may be recommended when appropriate<br />
                            • Program information receives the same PHI protections<br />
                            • I may withdraw from a program at any time
                        </p>
                    </SectionCard>
                    {/* uses requiring */}
                    <SectionCard icon={FileText} title="Prescription and Medical Documentation">
                        <p style={{ color: "#64748b", lineHeight: 1.9 }}>
                            • Prescriptions are issued solely at the doctor's clinical discretion<br />
                            • Prescriptions must comply with local laws and regulations<br />
                            • Sick notes and fit-to-fly certificates are based on clinical assessment<br />
                            • Providing false information is illegal and solely the patient's responsibility
                        </p>


                    </SectionCard>
                    <SectionCard icon={CircleOff} title="Voluntary Consent and Right to Withdraw">
                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Participation is voluntary.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            You may withdraw consent at any time by contacting
                            support@humancareconnect.co.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Withdrawal will not affect treatment already provided but may limit your
                            ability to continue using the Platform.
                        </p>
                    </SectionCard>
                    {/* Breach Notifications */}
                    <SectionCard icon={CalendarCheck} title="Age Confirmation">
                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            I confirm that I am 18 years of age or older.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Humancare Connect does not provide services to individuals under the age
                            of 18.
                        </p>
                    </SectionCard>
                    {/* Changes to this Notice */}
                    <SectionCard icon={FileSignature} title="Acknowledgement">
                        <p style={{ color: "#64748b", lineHeight: 1.9 }}>
                            By using the Humancare Connect platform, I confirm:
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.9 }}>
                            • I have read and understood this Informed Consent Form<br />
                            • I have read and understood the Privacy Notice<br />
                            • I voluntarily consent to the collection and use of my PHI<br />
                            • I consent to receive telehealth services through the Platform<br />
                            • I am 18 years of age or older
                        </p>

                        <div
                            style={{
                                marginTop: "24px",
                                padding: "20px",
                                background: "#f8fafc",
                                borderRadius: "12px",
                                border: "1px solid #e2e8f0",
                            }}
                        >
                            <p><strong>Name:</strong> ___________________________</p>
                            <p><strong>Date:</strong> ___________________________</p>
                            <p><strong>Signature:</strong> _______________________</p>
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
                            For questions regarding this consent form, please contact us.
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
                                <Mail size={16} />

                                <div>
                                    <p
                                        style={{
                                            fontSize: "11px",
                                            fontWeight: 700,
                                            textTransform: "uppercase",
                                            color: "#94a3b8",
                                        }}
                                    >
                                        Email
                                    </p>

                                    <a
                                        href="mailto:support@humancareconnect.co"
                                        style={{
                                            color: "#2563eb",
                                            textDecoration: "none",
                                        }}
                                    >
                                        suppoprt@humancareconnect.co
                                    </a>
                                </div>
                            </div>

                            <div
                                style={{
                                    height: "1px",
                                    background: "#e2e8f0",
                                    margin: "16px 0",
                                }}
                            />

                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: "14px",
                                }}
                            >
                                <MapPin size={16} />

                                <div>
                                    <p
                                        style={{
                                            fontSize: "11px",
                                            fontWeight: 700,
                                            textTransform: "uppercase",
                                            color: "#94a3b8",
                                        }}
                                    >
                                        Mailing Address
                                    </p>

                                    <p
                                        style={{
                                            fontSize: "14px",
                                            color: "#334155",
                                            lineHeight: 1.7,
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