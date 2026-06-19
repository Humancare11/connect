import {
    Monitor,
    HeartHandshake,
    AlertTriangle,
    Siren,
    Laptop,
    ShieldCheck,
    Stethoscope,
    ClipboardList,
    Scale,
    MapPinned,
    FileSignature,
    Mail, MapPin

} from "lucide-react";


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




export default function TeleHealthConsent() {
    return (
        <div style={{ width: "100%", minHeight: "100vh", background: "#f1f5f9", fontFamily: "system-ui, -apple-system, sans-serif", boxSizing: "border-box" }}>

            {/* ── Banner — */}
            <div style={{ width: "100%", background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
                <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "28px 150px" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "4px 10px", margin: "80px 0 12px" }}>
                        <ShieldCheck size={11} />
                        HUMANCARE CONNECT, INC
                    </div>
                    <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#0f172a", margin: "15px 0 4px", letterSpacing: "-0.02em" }}>Telehealth Informed Consent</h1>
                    <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>Telehealth Informed Consent</p>
                </div>
            </div>

            {/* ── Main Content ── */}
            <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
                <div style={{ width: "100%", maxWidth: "750px", padding: "36px 24px 60px", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* overview */}
                    <SectionCard icon={Monitor} title="What is Telehealth?">
                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Telehealth involves the use of electronic communications to enable healthcare providers to share individual patient medical information for the purpose of improving patient care.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            This includes the use of interactive audio, video, and data communications, as well as store-and-forward technology.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Humancare Connect provides telehealth services in the form of medical second opinions and consultations delivered by licensed, US-based physicians through secure video, audio, and asynchronous messaging.
                        </p>
                    </SectionCard>

                    {/* Benefits  */}
                    <SectionCard icon={HeartHandshake} title="Benefits of Telehealth">
                        <p style={{ color: "#64748b", lineHeight: 1.9 }}>
                            • Convenient access to licensed US physicians from anywhere<br />
                            • Reduced travel time and cost<br />
                            • Access to specialist opinions without referrals<br />
                            • Timely second opinions on diagnoses and treatment plans<br />
                            • Secure, HIPAA-compliant communication
                        </p>
                    </SectionCard>

                    {/* risk */}
                    <SectionCard icon={AlertTriangle} title="Risks and Limitations">
                        <p style={{ color: "#64748b", lineHeight: 1.9 }}>
                            • Telehealth is not appropriate for all medical conditions. Certain conditions require in-person evaluation.<br />
                            • Technical failures including internet outages or poor audio/video quality may interrupt consultations.<br />
                            • The consulting physician may not have access to your complete medical history unless you provide it.<br />
                            • Telehealth consultations may not replace in-person physical examinations.<br />
                            • A physician may determine that your condition requires an in-person evaluation.<br />
                            • Diagnoses and recommendations are based solely on information provided during the consultation.
                        </p>
                    </SectionCard>

                    {/* emergency */}
                    <SectionCard icon={Siren} title="Emergency Situations">
                        <div
                            style={{
                                background: "#fef2f2",
                                border: "1px solid #fecaca",
                                borderRadius: "12px",
                                padding: "18px",
                                marginBottom: "16px",
                            }}
                        >
                            <p
                                style={{
                                    color: "#dc2626",
                                    fontWeight: 700,
                                    margin: 0,
                                    lineHeight: 1.8,
                                }}
                            >
                                TELEHEALTH IS NOT FOR EMERGENCIES.
                            </p>
                        </div>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            If you are experiencing a medical emergency including chest pain,
                            difficulty breathing, stroke symptoms, severe bleeding, or loss of
                            consciousness, call 911 or go to your nearest emergency room immediately.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Do not use the Platform during an emergency situation.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            If a physician determines that emergency care is needed, you will be advised to seek immediate in-person treatment.
                        </p>
                    </SectionCard>

                    {/* technology */}
                    <SectionCard icon={Laptop} title="Technology Requirements">
                        <p style={{ color: "#64748b", lineHeight: 1.9 }}>
                            • A device with a working camera and microphone for video consultations<br />
                            • A stable internet connection (minimum 1 Mbps recommended)<br />
                            • A supported web browser including Chrome, Firefox, Safari, or Edge<br />
                            • A private and quiet location to maintain confidentiality
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            If technical difficulties prevent completion of a consultation,
                            the physician or Humancare Connect staff may contact you to reschedule.
                        </p>
                    </SectionCard>

                    {/* privacy */}
                    <SectionCard icon={ShieldCheck} title="Privacy and Security">
                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            All telehealth consultations on the Humancare Connect Platform are conducted using HIPAA-compliant encrypted connections.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Your health information is protected in accordance with HIPAA and our Privacy Policy.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Sessions are not recorded without your explicit consent.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Please ensure that you are in a private location during consultations.
                        </p>
                    </SectionCard>

                    {/* physician independance */}
                    <SectionCard icon={Stethoscope} title="Physician Independence">
                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Physicians providing services through Humancare Connect are independent licensed practitioners and are not employees of Humancare Connect.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            The medical second opinion or consultation represents the professional judgment of the consulting physician.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Humancare Connect does not practice medicine and does not supervise clinical decisions.
                        </p>
                    </SectionCard>
                    {/* sope of service */}
                    <SectionCard icon={ClipboardList} title="Scope of Service">
                        <p style={{ color: "#64748b", lineHeight: 1.9 }}>
                            Humancare Connect provides medical second opinions and consultations.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.9 }}>
                            This Platform does not provide:<br /><br />

                            • Primary care services or ongoing care management<br />
                            • Emergency or urgent care<br />
                            • Mental health crisis intervention<br />
                            • Prescriptions in all states (subject to state law and physician discretion)
                        </p>
                    </SectionCard>
                    {/* rigths */}
                    <SectionCard icon={Scale} title="Your Rights">
                        <p style={{ color: "#64748b", lineHeight: 1.9 }}>
                            • You have the right to withdraw consent at any time.<br />
                            • You have the right to ask questions before consenting.<br />
                            • You have the right to withhold or withdraw consent without penalty.<br />
                            • You have the right to request an in-person consultation at any time.
                        </p>
                    </SectionCard>
                    {/* requriments  */}
                    <SectionCard icon={MapPinned} title="State-Specific Requirements">
                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Telehealth laws vary by state. By using this Platform, you represent that you are located within the United States.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Certain states may impose additional consent, prescribing, or licensing requirements.
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.8 }}>
                            Humancare Connect ensures that physicians on the Platform comply with applicable state telehealth laws.
                        </p>
                    </SectionCard>
                    {/* Consent  */}
                    <SectionCard icon={FileSignature} title="Consent Acknowledgement">
                        <p style={{ color: "#64748b", lineHeight: 1.9 }}>
                            By using the Humancare Connect Platform and proceeding with a telehealth consultation, you acknowledge that:
                        </p>

                        <p style={{ color: "#64748b", lineHeight: 1.9 }}>
                            • You have read and understand this Telehealth Informed Consent<br />
                            • You understand the benefits, risks, and limitations of telehealth services<br />
                            • You consent to receive telehealth services through the Platform<br />
                            • You understand this consent does not replace your primary care provider relationship<br />
                            • You will seek emergency care through appropriate channels if needed
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
                            <p><strong>Patient Name:</strong> ___________________________</p>
                            <p><strong>Date:</strong> ___________________________</p>
                            <p><strong>Signature:</strong> ___________________________</p>

                            <p
                                style={{
                                    color: "#64748b",
                                    fontSize: "14px",
                                    marginTop: "16px",
                                }}
                            >
                                (For electronic consent, acceptance during account registration or consultation booking constitutes your signature.)
                            </p>
                        </div>
                    </SectionCard>
                    {/* Contact */}
                    <SectionCard icon={Mail} title="Contact">
                        <p
                            style={{
                                fontSize: "14px",
                                color: "#64748b",
                                lineHeight: 1.8,
                                margin: "0 0 20px",
                            }}
                        >
                            For questions regarding this document or the Humancare Connect Platform,
                            please contact our support team using the information below.
                        </p>

                        <div
                            style={{
                                background: "#f8fafc",
                                border: "1px solid #e2e8f0",
                                borderRadius: "12px",
                                padding: "20px",
                            }}
                        >
                            {/* Email */}
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
                                        width: "40px",
                                        height: "40px",
                                        flexShrink: 0,
                                        borderRadius: "10px",
                                        background: "#fff",
                                        border: "1px solid #e2e8f0",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#64748b",
                                    }}
                                >
                                    <Mail size={16} strokeWidth={1.75} />
                                </div>

                                <div>
                                    <p
                                        style={{
                                            fontSize: "11px",
                                            fontWeight: 700,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.08em",
                                            color: "#94a3b8",
                                            margin: "0 0 4px",
                                        }}
                                    >
                                        Email
                                    </p>

                                    <a
                                        href="mailto:support@humancareconnect.co"
                                        style={{
                                            fontSize: "14px",
                                            color: "#2563eb",
                                            textDecoration: "none",
                                            fontWeight: 500,
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

                            {/* Address */}
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: "14px",
                                }}
                            >
                                <div
                                    style={{
                                        width: "40px",
                                        height: "40px",
                                        flexShrink: 0,
                                        borderRadius: "10px",
                                        background: "#fff",
                                        border: "1px solid #e2e8f0",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#64748b",
                                    }}
                                >
                                    <MapPin size={16} strokeWidth={1.75} />
                                </div>

                                <div>
                                    <p
                                        style={{
                                            fontSize: "11px",
                                            fontWeight: 700,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.08em",
                                            color: "#94a3b8",
                                            margin: "0 0 4px",
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