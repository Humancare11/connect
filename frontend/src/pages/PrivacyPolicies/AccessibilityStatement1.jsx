import React from "react";
import "./PrivacyPolicies.css";

const AccessibilityStatement1 = () => {
    return (
        <div className="rcp-page">
            <main className="rcp-content">
                <header className="rcp-hero">
                    <h1 className="rcp-title">Accessibility Statement</h1>
                    <p className="rcp-intro">
                        Humancare Connect, Inc. is committed to making the Humancare Connect platform at humancareconnect.co accessible to all users, including individuals with disabilities. We believe access to healthcare should be barrier-free, and we work continuously to improve the accessibility of our Platform.
                    </p>
                </header>

                <section className="rcp-section">
                    <h2 className="rcp-heading">Our Commitment</h2>
                    <p>
                        We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA, published by the World Wide Web Consortium (W3C). These guidelines describe how to make web content more accessible to people with visual, auditory, physical, speech, cognitive, language, learning, and neurological disabilities. WCAG 2.1 AA is also the standard referenced under the Americans with Disabilities Act (ADA) Title III and Section 508 of the Rehabilitation Act.
                    </p>
                </section>

                <section className="rcp-section">
                    <h2 className="rcp-heading">Measures We Take</h2>
                    <p>
                        To support accessibility, we include accessibility considerations in the design and development of all new features and content. We provide text alternatives for non-text content including images, icons, and graphics. We design all Platform pages to work with keyboard-only navigation and screen readers. We maintain sufficient color contrast for text and visual elements, ensure form inputs are properly labelled and error messages are descriptive, and support resizable text without loss of content or functionality. We conduct periodic accessibility reviews and testing across our Platform.
                    </p>
                </section>

                <section className="rcp-section">
                    <h2 className="rcp-heading">Known Limitations</h2>
                    <p>
                        While we strive to meet WCAG 2.1 AA standards across the entire Platform, some legacy content or third-party integrations may not yet fully conform to all criteria. We are actively working to address these gaps as part of our ongoing accessibility improvement program.
                    </p>
                </section>

                <section className="rcp-section">
                    <h2 className="rcp-heading">Assistive Technologies</h2>
                    <p>
                        Our Platform is designed to be compatible with screen readers including NVDA, JAWS, and VoiceOver, keyboard-only navigation, browser-based zoom and text magnification tools, and high contrast display modes.
                    </p>
                </section>

                <section className="rcp-section">
                    <h2 className="rcp-heading">Feedback and Assistance</h2>
                    <p>
                        We welcome feedback on the accessibility of Humancare Connect. If you encounter an accessibility barrier, cannot access any part of the Platform, or need content in an alternative format, please contact us using the information below. We aim to respond to accessibility feedback within 5 business days and to provide a substantive resolution within 30 business days.
                    </p>
                </section>

                <section className="rcp-section">
                    <h2 className="rcp-heading">Alternative Access</h2>
                    <p>If you are unable to use our online Platform due to a disability, please call us at +1 302 303 3993 and we will make reasonable accommodations to provide access to our telehealth services by alternative means.</p>
                </section>

                <section className="rcp-section">
                    <h2 className="rcp-heading">Formal Complaints</h2>
                    <p>
                        If you are not satisfied with our response to your accessibility concern, you may file a complaint with the U.S. Department of Justice (ADA Title III) or the U.S. Department of Health and Human Services Office for Civil Rights.
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

export default AccessibilityStatement1;