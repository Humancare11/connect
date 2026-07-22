import React from "react";
import "./PrivacyPolicies.css";

const PrivacyPolicy1 = () => {
    return (
        <div className="rcp-page">
            <main className="rcp-content">
                <header className="rcp-hero">
                    <h1 className="rcp-title">Privacy Policy</h1>
                    <p className="rcp-intro">
                        This Privacy Policy describes how Humancare Connect, Inc. ("we," "us," or "our") collects, uses, shares, and protects information about you when you visit or use the Humancare Connect telehealth platform at humancareconnect.co (the "Platform"). By using the Platform, you agree to the practices described in this policy. If you do not agree, please do not use the Platform.
                    </p>
                </header>

                <section className="rcp-section">
                    <h2 className="rcp-heading">Information We Collect</h2>
                    <p>
                        We collect information you provide directly, such as your name, date of birth, contact details, health and medical information submitted during consultations or intake forms, and payment information processed through our secure payment provider. When you communicate with us by email, chat, or through our support channels, we retain those communications.
                    </p>
                    <p>
                        We also collect information automatically when you use the Platform, including your device identifiers, IP address, browser type, operating system, pages visited, and session activity. We use cookies and similar technologies for this purpose — see our Cookie Policy for full details. Where you connect to us through a referring provider, insurer, or identity verification service, we may receive information from those third parties as well.
                    </p>
                </section>

                <section className="rcp-section">
                    <h2 className="rcp-heading">How We Use Your Information</h2>
                    <p>
                        We use the information we collect to provide, operate, and improve our telehealth services, including scheduling and facilitating virtual consultations with licensed providers, processing payments and managing billing, and sending appointment confirmations, reminders, and follow-up communications. We use your information to respond to support requests, detect and prevent fraud or security incidents, conduct internal quality improvement, and comply with applicable federal and state laws including HIPAA.
                    </p>
                </section>

                <section className="rcp-section">
                    <h2 className="rcp-heading">How We Share Your Information</h2>
                    <p>
                        We do not sell your personal information. We share your information with licensed healthcare providers on our platform for the purpose of delivering care, and with business associates who perform services on our behalf under signed Business Associate Agreements. We may share information with pharmacies and laboratories to fulfill prescriptions or diagnostic orders, and with insurance companies and payers for billing and claims processing. We may disclose information to law enforcement or government agencies when required by law, and to successor entities in the event of a merger, acquisition, or sale of assets.
                    </p>
                </section>

                <section className="rcp-section">
                    <h2 className="rcp-heading">Health Information and HIPAA</h2>
                    <p>
                        Your protected health information (PHI) is handled in accordance with the Health Insurance Portability and Accountability Act (HIPAA) and its implementing regulations. Humancare Connect, Inc. is a covered entity under HIPAA. Please review our Notice of Privacy Practices for a complete description of your rights and our obligations regarding your PHI.
                    </p>
                </section>

                <section className="rcp-section">
                    <h2 className="rcp-heading">Data Retention</h2>
                    <p>
                        We retain personal information for as long as necessary to provide services, comply with legal obligations, resolve disputes, and enforce our agreements. Medical records are retained in accordance with applicable state and federal law, including after account deletion.
                    </p>
                </section>

                <section className="rcp-section">
                    <h2 className="rcp-heading">Your Rights</h2>
                    <p>Depending on your location, you may have the right to access and receive a copy of your personal information, correct inaccurate or incomplete information, request deletion of your information subject to legal retention requirements, opt out of certain uses of your information, and receive your information in a portable format. California residents have additional rights under the CCPA/CPRA — please see our California Privacy Rights Notice for details. To exercise any of these rights, contact us using the information below.</p>
                </section>

                <section className="rcp-section">
                    <h2 className="rcp-heading">Security</h2>
                    <p>
                        We implement administrative, technical, and physical safeguards designed to protect your information against unauthorized access, disclosure, alteration, or destruction. No system is completely secure. If you believe your account has been compromised, please contact us immediately.
                    </p>
                </section>

                <section className="rcp-section">
                    <h2 className="rcp-heading">Children's Privacy</h2>
                    <p>
                        The Platform is not directed to children under 13. We do not knowingly collect personal information from children under 13 without verifiable parental consent. If you believe we have inadvertently collected such information, please contact us so we may delete it.
                    </p>
                </section>

                <section className="rcp-section">
                    <h2 className="rcp-heading">Changes to This Policy</h2>
                    <p>
                        We may update this Privacy Policy from time to time. When we do, we will revise the effective date at the top of this page. Material changes will be communicated through the Platform or by email. Your continued use of the Platform after changes are posted constitutes your acceptance of the updated policy.
                    </p>
                </section>

                <section className="rcp-section">
                    <h2 className="rcp-heading">Contact Us</h2>
                    <p>For any questions or to exercise your rights under this policy, contact us at:</p>
                    <p className="rcp-address">
                        Humancare Connect, Inc.,
                        <br />
                        4 Peddlers Row, 1091, Newark, DE 19702, USA
                    </p>
                    <p className="rcp-address">Phone: <a href="tel:+13023033993" className="rcp-link">+1 302 303 3993</a></p>
                    <p>
                        Email: <a href="mailto:support@humancareconnect.co " className="rcp-link">support@humancareconnect.co </a>
                    </p>
                </section>
            </main>
        </div>
    );
};

export default PrivacyPolicy1;