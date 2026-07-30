import React from "react";
import "./PrivacyPolicies.css";

const TeleHealthInformedConsent = () => {
  return (
    <div className="rcp-page">
      <main className="rcp-content">
        <header className="rcp-hero">
          <h1 className="rcp-title">Telehealth Informed Consent</h1>
          <p className="rcp-intro">
            This Telehealth Informed Consent ("Consent") describes the nature of
            telehealth services provided through the Humancare Connect platform
            at humancareconnect.co, operated by Humancare Connect, Inc., and
            explains your rights and the limitations of receiving healthcare
            services via telehealth technology.
          </p>
          <p>
            By scheduling and participating in a telehealth consultation, you
            acknowledge that you have read, understood, and agree to the terms
            of this Consent.
          </p>
        </header>

        <section className="rcp-section">
          <h2 className="rcp-heading">What Is Telehealth?</h2>
          <p>
            Telehealth refers to the delivery of healthcare services using
            electronic communications technologies, including secure video
            conferencing, telephone, and messaging platforms. These technologies
            enable a licensed healthcare provider to evaluate, diagnose, and
            treat patients remotely.
          </p>
        </section>

        <section className="rcp-section">
          <h2 className="rcp-heading">Benefits of Telehealth</h2>
          <ul className="rcp-list">
            <li>
              Convenient access to licensed providers without requiring travel
            </li>
            <li>
              Timely care for conditions that do not require in-person
              examination
            </li>
            <li>
              Continuity of care, including follow-up consultations and
              medication management
            </li>
            <li>
              Access to specialist consultations without geographic barriers
            </li>
          </ul>
        </section>

        <section className="rcp-section">
          <h2 className="rcp-heading">Potential Risks and Limitations</h2>
          <p>
            You understand and accept that telehealth involves inherent
            limitations and risks, including:
          </p>
          <ul className="rcp-list">
            <li>
              The provider cannot physically examine you, which may limit the
              ability to fully assess your condition
            </li>
            <li>
              Technical failures, poor connectivity, or equipment issues may
              interrupt or delay your consultation
            </li>
            <li>
              Telehealth may not be appropriate for your specific medical
              condition or presenting symptoms
            </li>
            <li>
              There is a risk of information loss during transmission despite
              security safeguards
            </li>
            <li>
              Prescribing certain medications via telehealth may be restricted
              by federal or state law
            </li>
          </ul>
          <p>
            If you experience a medical emergency, call 911 or go to your
            nearest emergency room immediately. Do not rely on this platform for
            emergency care.
          </p>
        </section>

        <section className="rcp-section">
          <h2 className="rcp-heading">Privacy and Security</h2>
          <p>
            Your telehealth consultations are conducted over encrypted,
            HIPAA-compliant connections. All health information shared during
            your consultation is protected as protected health information (PHI)
            under HIPAA. Please review our Notice of Privacy Practices for a
            complete description of how your information is protected.
          </p>
          <p>
            When participating in a video consultation, please ensure you are in
            a private location where others cannot overhear your conversation.
          </p>
        </section>

        <section className="rcp-section">
          <h2 className="rcp-heading">Provider Identity and Credentials</h2>
          <p>
            The healthcare provider conducting your consultation is an
            independently licensed professional. You have the right to request
            the provider's name, license type, and license number before or
            during your consultation.
          </p>
        </section>

        <section className="rcp-section">
          <h2 className="rcp-heading">Right to Withdraw Consent</h2>
          <p>
            You may withdraw this consent at any time and request an in-person
            appointment instead. Withdrawing consent will not affect any care
            you have already received. Withdrawal does not affect your rights to
            access your medical records.
          </p>
        </section>

        <section className="rcp-section">
          <h2 className="rcp-heading">State-Specific Requirements</h2>
          <p>
            Telehealth laws and regulations vary by state. Your provider will
            comply with the laws of the state in which you are located at the
            time of your consultation. Certain services may not be available in
            all states.
          </p>
        </section>

        <section className="rcp-section">
          <h2 className="rcp-heading">Acknowledgment</h2>
          <p>By proceeding with a telehealth consultation, you confirm that:</p>
          <ul className="rcp-list">
            <li>
              You understand what telehealth is and how it differs from
              in-person care
            </li>
            <li>
              You understand and accept the risks and limitations described
              above
            </li>
            <li>You are located in a private setting for your consultation</li>
            <li>
              You have had the opportunity to ask questions about this consent
            </li>
          </ul>
        </section>

        <section className="rcp-section">
          <h2 className="rcp-heading">Contact Us</h2>
          <p>
            If you have questions about this Consent or telehealth services,
            contact us at:
          </p>
          <p className="rcp-address">
            Humancare Connect, Inc.,
            <br />4 Peddlers Row, 1091, Newark, DE 19702, USA
          </p>
          <p className="rcp-address">
            Phone:{" "}
            <a href="tel:+13023033993" className="rcp-link">
              +1 302 303 3993
            </a>
          </p>
          <p>
            Email:{" "}
            <a href="mailto:support@humancareconnect.co" className="rcp-link">
              support@humancareconnect.co
            </a>
          </p>
        </section>
      </main>
    </div>
  );
};

export default TeleHealthInformedConsent;
