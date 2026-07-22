import React from "react";
import "./PrivacyPolicies.css";

const CookiePolicy1 = () => {
    return (
        <div className="rcp-page">
            <main className="rcp-content">
                <header className="rcp-hero">
                    <h1 className="rcp-title">Cookie Policy</h1>
                    <p className="rcp-intro">
                        This Cookie Policy explains how Humancare Connect, Inc. uses cookies and similar tracking technologies on the Humancare Connect platform at humancareconnect.co. By continuing to use the Platform, you agree to our use of cookies as described in this policy.
                    </p>
                </header>

                <section className="rcp-section">
                    <h2 className="rcp-heading">What Are Cookies</h2>
                    <p>
                        Cookies are small text files placed on your device when you visit a website. They allow the site to recognize your device, remember your preferences, and collect information about how you use the site. Similar technologies include web beacons, pixel tags, and local storage objects.
                    </p>
                </section>

                <section className="rcp-section">
                    <h2 className="rcp-heading">Cookies We Use</h2>
                    <p>
                        We use strictly necessary cookies that are essential for the Platform to function — they enable secure login, session management, and navigation, and cannot be disabled without significantly impairing your use of the Platform. We use functional cookies that remember your preferences and settings, such as language and appointment preferences, to provide a more personalized experience. We use analytics cookies that collect aggregated, anonymous information about how visitors use the Platform, including which pages are visited most often, so we can improve the Platform over time. We use security cookies that help detect and prevent fraudulent activity and protect your session.
                    </p>
                </section>

                <section className="rcp-section">
                    <h2 className="rcp-heading">Third-Party Cookies</h2>
                    <p>
                        Some third-party services integrated into the Platform — such as analytics providers and video conferencing tools — may place their own cookies on your device. These third parties have their own privacy policies governing their use of cookie data. We do not control third-party cookies.
                    </p>
                </section>

                <section className="rcp-section">
                    <h2 className="rcp-heading">How Long Cookies Last</h2>
                    <p>
                        Session cookies expire when you close your browser. Persistent cookies remain on your device for a defined period or until you delete them manually. We use session cookies for authentication and persistent cookies for preference storage and analytics purposes.
                    </p>
                </section>

                <section className="rcp-section">
                    <h2 className="rcp-heading">Managing Cookies</h2>
                    <p>
                        You can control and manage cookies through your browser settings. Most browsers allow you to view and delete individual cookies, block cookies from specific websites, block all third-party cookies, and clear all cookies when you close your browser. Please note that disabling certain cookies may affect the functionality of the Platform. Strictly necessary cookies cannot be turned off without disrupting core Platform features.
                    </p>
                </section>

                <section className="rcp-section">
                    <h2 className="rcp-heading">Do Not Track</h2>
                    <p>Some browsers offer a "Do Not Track" signal. Because there is no established industry-wide standard for responding to these signals, we do not currently alter our data collection practices in response to Do Not Track requests.</p>
                </section>

                <section className="rcp-section">
                    <h2 className="rcp-heading">Changes to This Policy</h2>
                    <p>
                        We may update this Cookie Policy from time to time. Changes will be reflected in the effective date shown at the top of this page.
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

export default CookiePolicy1;