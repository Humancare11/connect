import React from "react";
import "./PrivacyPolicies.css";

const DeleteAccountPolicyPage = () => {
  return (
    <div className="rcp-page">
      <main className="rcp-content">
        <header className="rcp-hero">
          <h1 className="rcp-title">Delete Your Account</h1>
          <p className="rcp-intro">
            We're sorry to see you go. If you wish to permanently delete your
            Humancare Connect account, you can do so directly from the mobile
            app. This page explains how to submit a deletion request, what
            happens to your data, and how to reach us if you need help.
          </p>
        </header>

        <section className="rcp-section">
          <h2 className="rcp-heading">How to Delete Your Account</h2>
          <p>
            To delete your account, open the Humancare Connect mobile
            application and sign in using your registered credentials. Once
            logged in, go to your Profile section and select the "Delete
            Account" option. You will be shown information about what account
            deletion means before you proceed. Review this information
            carefully, then confirm your request to complete the deletion
            process.
          </p>
        </section>

        <section className="rcp-section">
          <h2 className="rcp-heading">What Happens After Deletion</h2>
          <p>
            Once your account deletion request is completed, your account and
            the personal information associated with it will be removed from our
            active systems. This includes your profile information, contact
            details associated with your account, application preferences and
            settings, and any other user-provided information linked to your
            account.
          </p>
        </section>

        <section className="rcp-section">
          <h2 className="rcp-heading">Need Help?</h2>
          <p>
            If you are unable to access your account, cannot complete the
            deletion process, or have questions regarding your personal data,
            please contact our support team at{" "}
            <a href="mailto:support@humancareconnect.co" className="rcp-link">
              support@humancareconnect.co
            </a>
            . We're happy to assist you.
          </p>
        </section>

        <section className="rcp-section">
          <h2 className="rcp-heading">Learn More</h2>
          <p>
            For more information about how we collect, use, and protect your
            data, please read our{" "}
            <a
              href="https://humancareconnect.co/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="rcp-link"
            >
              Privacy Policy
            </a>
            .
          </p>
        </section>

        <section className="rcp-section">
          <h2 className="rcp-heading">Contact Us</h2>
          <p>
            For any questions or to exercise your rights under this policy,
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

export default DeleteAccountPolicyPage;
