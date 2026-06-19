import {
    Monitor,
    HeartHandshake,
    AlertTriangle,
    Laptop,
    ShieldCheck,
    Stethoscope,
    ClipboardList,
    Scale,
    FileSignature,
    Mail,
    MapPin,
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

export default function  AccessibilityStatement() {
    return (
        <div style={{ width: "100%", minHeight: "100vh", background: "#f1f5f9", fontFamily: "system-ui, -apple-system, sans-serif", boxSizing: "border-box" }}>

            {/* ── Banner — */}
            <div style={{ width: "100%", background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
                <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "28px 28px" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "4px 10px", margin: "80px 0 12px" }}>
                        <ShieldCheck size={11} />
                        HUMANCARE CONNECT, INC.
                    </div>
                    <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#0f172a", margin: "15px 0 4px", letterSpacing: "-0.02em" }}>Accessibility Statement</h1>
                    <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>Effective Date: June 11, 2026 | Last Updated: June 11, 2026</p>
                </div>
            </div>

            {/* ── Main Content ── */}
            <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
                <div style={{ width: "100%", maxWidth: "750px", padding: "36px 24px 60px", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* Our commitment */}
                    <SectionCard icon={Monitor} title="Our Commitment">
    <p style={{ color: "#64748b", lineHeight: 1.8 }}>
        Humancare Connect, Inc. is committed to ensuring that our website and
        telehealth platform at humancareworldwide.com and related subdomains
        (the "Platform") are accessible to everyone, including people with
        disabilities.
    </p>

    <p style={{ color: "#64748b", lineHeight: 1.8 }}>
        We believe that access to healthcare information and services is a
        fundamental right, and we are actively working to make our Platform
        usable by all individuals regardless of ability.
    </p>

    <p style={{ color: "#64748b", lineHeight: 1.8 }}>
        We aim to conform to the Web Content Accessibility Guidelines (WCAG)
        2.1 Level AA, published by the World Wide Web Consortium (W3C).
    </p>
</SectionCard>

                    {/* scope  */}
                    <SectionCard icon={ClipboardList} title="Scope">
    <p style={{ color: "#64748b", lineHeight: 1.8 }}>
        This Accessibility Statement applies to all pages and features of
        humancareworldwide.com and our patient and provider portals.
    </p>

    <p style={{ color: "#64748b", lineHeight: 1.8 }}>
        Third-party content and services embedded in our Platform, such as
        payment processors and integrated services, are subject to their own
        accessibility policies.
    </p>
</SectionCard>

                    {/* accessbility */}
                    <SectionCard icon={HeartHandshake} title="Our Accessibility Features">
    <p style={{ color: "#64748b", lineHeight: 1.9 }}>
        • Keyboard navigation — all core functions are accessible without a mouse<br/>
        • Screen reader compatibility using semantic HTML and ARIA labels<br/>
        • Text alternatives for meaningful images<br/>
        • Sufficient color contrast meeting WCAG 2.1 AA standards<br/>
        • Resizable text up to 200% browser zoom<br/>
        • No flashing content exceeding accessibility thresholds<br/>
        • Descriptive link text throughout the Platform<br/>
        • Accessible form labels for all inputs<br/>
        • Skip navigation links for faster access to content<br/>
        • Consistent navigation across pages
    </p>
</SectionCard>

                    {/* limitation */}
                    <SectionCard icon={AlertTriangle} title="Current Limitations">
    <p style={{ color: "#64748b", lineHeight: 1.9 }}>
        While we strive for full WCAG 2.1 AA compliance, some areas of the
        Platform may not yet fully meet these standards.
    </p>

    <p style={{ color: "#64748b", lineHeight: 1.9 }}>
        • Some older PDF documents may not yet be fully tagged for screen readers<br/>
        • Certain third-party embedded components may have accessibility limitations<br/>
        • Some video content may not yet include captions or audio descriptions
    </p>

    <p style={{ color: "#64748b", lineHeight: 1.8 }}>
        We are actively conducting accessibility audits and remediating issues
        on an ongoing basis.
    </p>
</SectionCard>

                    {/* technology */}
                   <SectionCard icon={Laptop} title="Assistive Technology Compatibility">
    <p style={{ color: "#64748b", lineHeight: 1.9 }}>
        Our Platform is designed to be compatible with:
    </p>

    <p style={{ color: "#64748b", lineHeight: 1.9 }}>
        • JAWS, NVDA, VoiceOver (iOS/macOS), and TalkBack (Android)<br/>
        • Dragon NaturallySpeaking voice recognition<br/>
        • Browser zoom and text resizing tools<br/>
        • High contrast browser modes
    </p>

    <p style={{ color: "#64748b", lineHeight: 1.8 }}>
        We recommend using the latest versions of browsers and assistive
        technologies for the best experience.
    </p>
</SectionCard>

                    {/* feedback & contact */}
                    <SectionCard icon={Mail} title="Feedback and Contact">
    <p style={{ color: "#64748b", lineHeight: 1.8 }}>
        We welcome your feedback regarding the accessibility of our Platform.
        If you encounter any accessibility barriers, please contact us.
    </p>

    <div
        style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "20px",
            marginTop: "20px"
        }}
    >
        <p><strong>Accessibility Email:</strong> support@humancareconnect.co</p>
        <p><strong>General Support:</strong> support@humancareworldwide.com</p>

        <p style={{ marginTop: "16px" }}>
            <strong>Humancare Connect, Inc.</strong><br />
            131 Continental Dr Suite 305<br />
            Newark, DE 19713
        </p>
    </div>

    <p style={{ color: "#64748b", lineHeight: 1.8, marginTop: "20px" }}>
        We aim to respond to accessibility feedback within 5 business days.
    </p>
</SectionCard>

                    {/* Formal Complaints*/}
                   <SectionCard icon={Scale} title="Formal Complaints">
    <p style={{ color: "#64748b", lineHeight: 1.8 }}>
        If you are not satisfied with our response to your accessibility
        concern, you may contact:
    </p>

    <p style={{ color: "#64748b", lineHeight: 1.9 }}>
        • U.S. Department of Justice, Civil Rights Division (ADA)<br/>
        • U.S. Department of Health and Human Services, Office for Civil Rights
    </p>
</SectionCard>
                    {/* Legal Compliance*/}
                    <SectionCard icon={ShieldCheck} title="Legal Compliance">
    <p style={{ color: "#64748b", lineHeight: 1.9 }}>
        We are committed to compliance with:
    </p>

    <p style={{ color: "#64748b", lineHeight: 1.9 }}>
        • Americans with Disabilities Act (ADA), including Title III<br/>
        • Section 508 of the Rehabilitation Act<br/>
        • California Unruh Civil Rights Act<br/>
        • WCAG 2.1 Level AA
    </p>
</SectionCard>
                    {/* Ongoing Efforts */}
                    <SectionCard icon={Stethoscope} title="Ongoing Accessibility Efforts">
    <p style={{ color: "#64748b", lineHeight: 1.9 }}>
        Accessibility is an ongoing effort. We are committed to:
    </p>

    <p style={{ color: "#64748b", lineHeight: 1.9 }}>
        • Conducting regular accessibility audits<br/>
        • Manual and automated accessibility testing<br/>
        • Integrating accessibility into our development lifecycle<br/>
        • Training development and content teams on accessibility best practices<br/>
        • Reviewing this statement annually
    </p>
</SectionCard>
                    {/* -- */}
                    <SectionCard icon={FileSignature} title="Updates to This Statement">
    <p style={{ color: "#64748b", lineHeight: 1.8 }}>
        We may update this Accessibility Statement from time to time as we
        improve our Platform and accessibility features.
    </p>

    <p style={{ color: "#64748b", lineHeight: 1.8 }}>
        The "Last Updated" date displayed at the top of this page reflects the
        most recent revision.
    </p>
</SectionCard>
                   

                </div>
            </div>
        </div>
    );
} 