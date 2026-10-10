import React from "react";
import { Link } from "react-router-dom";
import "./PrivacyPolicies.css";

/*
 * Public account-deletion page (linked from the site footer, and used as the
 * account-deletion URL for app-store listings).
 *
 * TODO(legal review): the "What we delete" / "What we keep" sections describe
 * what the system does TODAY — approving a request removes the user account
 * record only; appointments, payments, invoices, consultation/medical records
 * and activity logs are not removed by that step, and medical records, chat
 * messages and uploaded files are cleared later by the retention schedule.
 * The retention period and the exact wording here MUST be reviewed by legal
 * before launch. Do not add a specific number of years until they have signed
 * it off. Keep this page, the emails in backend/utils/accountDeletionEmail.js
 * and the in-product modal (components/DeleteAccountModal.jsx) consistent.
 */
const DeleteAccountPolicyPage = () => {
  return (
    <div className="rcp-page">
      <main className="rcp-content">
        <header className="rcp-hero">
          <h1 className="rcp-title">Delete Your Account</h1>
          <p className="rcp-intro">
            You can ask us to delete your Humancare Connect account from this
            website or from the mobile app. This page explains how to submit a
            request, what happens next, which information we delete and which
            we keep, and how to reach us if you need help.
          </p>
        </header>

        <section className="rcp-section">
          <h2 className="rcp-heading">How to Request Deletion on the Website</h2>
          <ol className="rcp-list">
            <li>
              Log in to your account at humancareconnect.co with your
              registered email and password, or with Google.
            </li>
            <li>
              Open <strong>Profile Settings</strong> from the account menu.
            </li>
            <li>
              Scroll to the <strong>Delete account</strong> section at the
              bottom of the page and select <strong>Delete my account</strong>.
            </li>
            <li>
              Read the information shown, optionally tell us why you are
              leaving, tick the confirmation box and select{" "}
              <strong>Submit deletion request</strong>.
            </li>
          </ol>
          <p>
            <Link
              to="/login"
              state={{ from: "/user/profile-settings" }}
              className="rcp-link"
            >
              Log in and go to Profile Settings
            </Link>
          </p>
        </section>

        <section className="rcp-section">
          <h2 className="rcp-heading">How to Request Deletion in the Mobile App</h2>
          <ol className="rcp-list">
            <li>Open the Humancare Connect app and sign in.</li>
            <li>
              On the Home screen, tap your profile circle (your initial, at the
              top right) to open your <strong>Account</strong> page.
            </li>
            <li>
              In the <strong>Danger Zone</strong> section, select{" "}
              <strong>Delete My Account</strong>.
            </li>
            <li>
              Review the information, optionally add a reason, confirm, and
              submit your request.
            </li>
          </ol>
        </section>

        <section className="rcp-section">
          <h2 className="rcp-heading">What Happens Next</h2>
          <ul className="rcp-list">
            <li>
              Deletion is not instant. Your request is sent to our team, who
              review it. We email you when we receive it and again once it has
              been processed.
            </li>
            <li>
              Until your request is processed your account stays active and you
              can keep using it.
            </li>
            <li>
              While a request is pending you can cancel it from Profile
              Settings on the website.
            </li>
            <li>
              If we are unable to complete a request we will email you, and your
              account will remain active. You can submit a new request at any
              time.
            </li>
          </ul>
        </section>

        <section className="rcp-section">
          <h2 className="rcp-heading">What We Delete</h2>
          <p>
            When your request is approved, your account is deleted and you can
            no longer sign in. This removes the information stored in your
            account profile, including:
          </p>
          <ul className="rcp-list">
            <li>Your name, email address and mobile number</li>
            <li>Your date of birth, gender and location details</li>
            <li>
              Your sign-in details (your password and any linked Google or
              Apple sign-in)
            </li>
            <li>Your consent settings stored on the account</li>
          </ul>
        </section>

        <section className="rcp-section">
          <h2 className="rcp-heading">What We Keep</h2>
          <p>
            Some information is not removed when your account is deleted
            because we are required to keep it, or need it to run and protect
            the service. This includes:
          </p>
          <ul className="rcp-list">
            <li>
              Appointment and consultation history, including consultation
              notes
            </li>
            <li>Payment records and invoices</li>
            <li>
              Medical records, such as prescriptions and medical certificates
            </li>
            <li>
              Activity and security logs, and records of the consents you gave
            </li>
          </ul>
          <p>
            Medical and billing records are retained as required by applicable
            law. Records that are no longer required are deleted in line with
            our data-retention schedule.
          </p>
          {/* TODO(legal review): retention period and this wording need legal review. No specific period is stated on purpose. */}
          <p>
            To understand how your information is used and kept, please read
            our{" "}
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
          <h2 className="rcp-heading">Need Help?</h2>
          <p>
            If you cannot sign in, cannot complete the steps above, or have
            questions about your personal data, email our support team at{" "}
            <a
              href="mailto:support@humancareconnect.co?subject=Account%20Deletion%20Request"
              className="rcp-link"
            >
              support@humancareconnect.co
            </a>{" "}
            from the email address registered on your account, and we will help.
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
