import React from "react";
import "./PrivacyPolicies.css";

const CaliforniaPrivacyRightsNotice1 = () => {
    return (
        <div className="rcp-page">
            <main className="rcp-content">
                <header className="rcp-hero">
                    <h1 className="rcp-title">California Privacy Rights Notice</h1>
                    <p className="rcp-intro">
                        This notice applies to California residents and supplements our Privacy Policy. It describes your rights under the California Consumer Privacy Act of 2018 and the California Privacy Rights Act of 2020 (collectively, "CCPA/CPRA") and explains how Humancare Connect, Inc. collects, uses, and shares personal information about California consumers.
                    </p>
                </header>

                <section className="rcp-section">
                    <h2 className="rcp-heading">Categories of Personal Information We Collect</h2>
                    <p>
                        Over the past 12 months, we have collected the following categories of personal information about California consumers: identifiers such as name, email address, postal address, IP address, and account username; customer records including contact information, insurance information, and billing details; protected classification characteristics including age, sex, and health conditions; health and medical information such as consultation records, diagnoses, and prescriptions, which we treat as sensitive personal information; internet or network activity data such as usage patterns, cookies, and device identifiers; geolocation data at the state or region level for provider licensing verification; and inferences drawn from the above data to personalize services.
                    </p>
                </section>

                <section className="rcp-section">
                    <h2 className="rcp-heading">How We Collect and Use This Information</h2>
                    <p>
                        We collect personal information directly from you, automatically when you use the Platform, and from third parties such as referring providers and insurance verification services. We collect this information to provide telehealth services, process payments, comply with legal obligations, improve the Platform, and communicate with you. We do not sell your personal information. We do not share your personal information for cross-context behavioral advertising.
                    </p>
                </section>

                <section className="rcp-section">
                    <h2 className="rcp-heading">Your California Privacy Rights</h2>
                    <p>
                        As a California resident, you have the right to know what personal information we have collected about you, the categories of sources from which it was collected, the purposes for collection, and the categories of third parties with whom we have shared it. You have the right to request deletion of personal information we have collected from you, subject to certain exceptions including legal retention obligations and the need to complete transactions. You have the right to request correction of inaccurate personal information. You have the right to limit our use of sensitive personal information to purposes that are necessary to provide the services you requested. We will not discriminate against you for exercising any of these rights.
                    </p>
                </section>

                <section className="rcp-section">
                    <h2 className="rcp-heading">How to Submit a Request</h2>
                    <p>
                        To submit a verifiable consumer request, contact us at the information below. We will respond within 45 days. If we need additional time, up to 90 days in total, we will notify you within the initial 45-day period. We may ask you to verify your identity before fulfilling your request. You may designate an authorized agent to submit a request on your behalf, in which case we may require written proof of the agent's authorization.
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

export default CaliforniaPrivacyRightsNotice1;