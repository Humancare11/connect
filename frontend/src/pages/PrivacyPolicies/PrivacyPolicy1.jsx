import React, { useEffect } from "react";
import "./PrivacyPolicies.css";

const PrivacyPolicy1 = () => {
    // /privacy-policy#website-chat (the chat widget's AI notice links here): scroll to the section once the page has
    // mounted. The page is a lazy chunk and the app scrolls to the top on a route change, so this runs after both.
    useEffect(() => {
        const hash = typeof window !== "undefined" ? window.location.hash : "";
        if (!hash || hash.length < 2) return;
        let id = hash.slice(1);
        try { id = decodeURIComponent(id); } catch { /* keep the raw id */ }
        document.getElementById(id)?.scrollIntoView();
    }, []);

    return (
        <div className="rcp-page">
            <div className="rcp-content">
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
                        We also collect information automatically when you use the Platform, including your device identifiers, IP address, browser type, operating system, pages visited, and session activity. When you create an account, we also use your IP address to estimate your approximate location (country, state or province, and city) so we can pre-fill your profile; you can review and change it at any time from your profile settings. We use cookies and similar technologies for this purpose — see our Cookie Policy for full details. Where you connect to us through a referring provider, insurer, or identity verification service, we may receive information from those third parties as well.
                    </p>
                    <p>
                        IP geolocation by DB-IP (<a href="https://db-ip.com" target="_blank" rel="noopener noreferrer">https://db-ip.com</a>).
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

                <section className="rcp-section" id="website-chat">
                    <h2 className="rcp-heading">Website Chat and AI Assistant</h2>
                    <p>
                        Our website has a chat window. When you open it, you first chat with Connect AI, an automated assistant. You can ask for a live member of our team at any time.
                    </p>
                    <p>
                        <strong>Connect AI is not a doctor.</strong> It does not diagnose conditions, recommend treatments or medications, or interpret symptoms or test results. It can answer questions about our services, prices and booking, and help you book a visit with a licensed Humancare clinician. The chat is not for emergencies. If you have a medical emergency, call 911 or your local emergency number.
                    </p>
                    <p>
                        <strong>What we collect in chat.</strong> Your name and email address (required), your phone number (optional), the messages and files you send, the language you write in, and technical details such as your device, browser, the pages you visit on our site and your approximate location (city, state and country) based on your IP address.
                    </p>
                    <p>
                        <strong>How we use it.</strong> To answer your questions, connect you with our team, translate messages between you and our staff, email you if we could not reply in the chat, keep a record of the conversation, and protect the chat from abuse.
                    </p>
                    <p>
                        <strong>How the AI assistant processes your messages.</strong> Your messages are processed by our AI service provider, OpenAI, under a Business Associate Agreement as required by HIPAA. Before your messages are sent, we remove your name, email address and phone number. We instruct OpenAI not to store the requests, and OpenAI does not use them to train its models. The same provider helps our staff with translations, reply suggestions and conversation summaries.
                    </p>
                    <p>
                        <strong>Human review.</strong> Members of our support and clinical team can read chat conversations, including those handled only by Connect AI. Conversations about medical topics are flagged and reviewed by our team to check the assistant's answers.
                    </p>
                    <p>
                        <strong>Who else receives your information.</strong> Our hosting, database and email providers, each under an agreement that protects your information. We do not sell your chat information or use it for advertising.
                    </p>
                    <p>
                        <strong>Security and retention.</strong> Chat messages and contact details are encrypted when stored. Conversations are kept for 365 days and then deleted, unless the law requires us to keep them longer.
                    </p>
                    <p>
                        <strong>Your choices and rights.</strong> You can ask to chat with a person instead of Connect AI at any time. You can request a copy of your chat or ask us to delete it by emailing{" "}
                        <a href="mailto:support@humancareconnect.co" className="rcp-link">support@humancareconnect.co</a>. You may have other rights under the laws of your state, as described elsewhere in this policy.
                    </p>
                    <p>
                        <em>Last updated: October 16, 2026</em>
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
            </div>
        </div>
    );
};

export default PrivacyPolicy1;