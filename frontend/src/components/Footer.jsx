import { useState } from "react";
import "./footer.css";

import {
  FaLinkedinIn,
  FaFacebookF,
  FaYoutube,
  FaInstagram,
} from "react-icons/fa";

import { FaThreads } from "react-icons/fa6";
import { FaXTwitter } from "react-icons/fa6";
import logo from "../assets/Logo.png";
// import FooterHippa from "../assets/new-hippa.png";

import { Link } from "react-router-dom";

export default function Footer() {
  const [openDropdown, setOpenDropdown] = useState(null);

  return (
    <footer className="footer">
      {/* MAIN GRID */}
      <div className="footer-container">
        {/* BRAND SECTION */}
        <div className="footer-brand">
          <Link to="/">
            <img
              src={logo}
              alt="Humancare Connect Logo"
              className="footer-logo-full"
              decoding="async"
            />
          </Link>

          <p className="footer-tagline">
            Connecting patients with trusted healthcare professionals anytime,
            anywhere through secure and affordable digital healthcare solutions.
          </p>

          {/* COMPLIANCE BADGES */}
          {/* <div className="footer-badges">
            <span className="footer-badge">GDPR</span>
            <span className="footer-badge">SOC 2 Type II</span>
            <span className="footer-badge">HITRUST R2</span>
          </div> */}
        </div>

        {/* PLATFORM */}
        <div className="footer-col">
          <h5>Navigation </h5>
          <a href="/about-us">About Us</a>
          <a href="/appointment-booking">Book Appointment</a>
          <a href="/corporates">Corporates</a>
          <a href="/blogs">Blogs</a>
        </div>

        {/* Services Quick Links */}
        <div className="footer-col">
          <h5>Services </h5>
          <a href="/online-prescription-refills">Online Prescription Refill</a>
          <a href="/appointment-booking">Online Doctor Consultation</a>
          <a href="/doctor-note-or-sick-notes">Sick Notes</a>
          <a href="/lab-requisitions">  Lab Requisition  </a>
          <a href="/fit-to-fly-certificate">Fit to Fly Certifications</a>
          {/* <a href="/sexual-health">Sexual Health</a>
          <a href="/weight-loss-programs">Weight Loss Programs</a> */}
        </div>

        <div className="footer-col footer-col-dropdown">
          <h5>Legal & Company Compliance</h5>

          {[
            {
              key: "privacy",
              label: "Privacy Policy",
              children: [
                { label: "Privacy Policy", href: "/privacy-policy" },
                {
                  label: "Patient Privacy Notice",
                  href: "/patient-privacy-notice",
                },
                {
                  label: "Notice of Privacy Practices",
                  href: "/notice-of-privacy-practices",
                },
                { label: "CCPA Compliance", href: "/CCPA" },
                { label: "Privacy Concerns", href: "/privacy-concerns" },
              ],
            },
            {
              key: "terms",
              label: "Terms & Conditions",
              children: [
                { label: "Terms of Service", href: "/terms-of-service" },
                {
                  label: "Provider Terms of Service",
                  href: "/provider-terms-of-service",
                },
              ],
            },
            {
              key: "consent",
              label: "Consent Forms",
              children: [
                {
                  label: "TeleHealth Consent",
                  href: "/tele-health-informed-consent",
                },
                {
                  label: "Patient Informed Consent Form",
                  href: "/patient-informed-consent-form",
                },
              ],
            },
            {
              key: "policies",
              label: "Policies",
              children: [
                { label: "Cookie Policy", href: "/cookie-policy" },
                {
                  label: "Refund & Cancellation Policy",
                  href: "/refund-and-cancellation-policy",
                },
                {
                  label: "Accessibility Statement",
                  href: "/accessibility-statement",
                },
              ],
            },
            {
              key: "agrement",
              label: "Agreements",
              children: [
                {
                  label: "Provider Agreement",
                  href: "/tele-health-provider-agreement",
                },
              ],
            },
            {
              key: "clinical",
              label: "Clinical & Provider Policies",
              children: [
                {
                  label: "Prescription Handling",
                  href: "/prescription-handling-policy",
                },
                {
                  label: "Teleconsultation Workflow",
                  href: "/teleconsultation-workflow-policy",
                },
                {
                  label: "Physician Credentialing",
                  href: "/physician-credentialing-policy",
                },
              ],
            },
          ].map(({ key, label, children }) => (
            <div key={key} className="footer-dropdown-item">
              <button
                type="button"
                className={`footer-dropdown-trigger${
                  openDropdown === key ? " is-open" : ""
                }`}
                onClick={() =>
                  setOpenDropdown(openDropdown === key ? null : key)
                }
                aria-expanded={openDropdown === key}
              >
                <span>{label}</span>
                <svg
                  className="footer-dropdown-chevron"
                  width="10"
                  height="6"
                  viewBox="0 0 10 6"
                  fill="none"
                >
                  <path
                    d="M1 1L5 5L9 1"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              <div
                className="footer-dropdown-panel"
                style={{
                  maxHeight:
                    openDropdown === key
                      ? `${children.length * 36 + 12}px`
                      : "0px",
                }}
              >
                {children.map((child) => (
                  <a
                    key={child.label}
                    href={child.href}
                    className="footer-sublink"
                  >
                    {child.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* SUPPORT */}
        <div className="footer-col">
          <h5>Support</h5>
          <a href="/doctor-login">Doctor Login</a>
          {/* <a href="#">Help Center</a> */}
          <a href="/support-center">Support Center</a>
          <a href="/career">Careers</a>
          <a href="/contact-us">Contact Us</a>
        </div>
      </div>

      {/* WATERMARK */}
      <div className="footer-watermark-wrap" aria-hidden="true">
        <div className="footer-bg-text">HUMANCARE CONNECT</div>
      </div>

      {/* FOOTER BOTTOM */}
      <div className="footer-bottom">
        <span>© 2026 Humancare Connect, Inc.</span>

        <div className="footer-socials">
          <a
            href="https://x.com/HCCofficial_"
            className="soc-btn"
            aria-label="X / Twitter"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaXTwitter />
          </a>
          <a
            href="https://www.linkedin.com/company/122144245"
            className="soc-btn"
            aria-label="LinkedIn"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaLinkedinIn />
          </a>
          <a
            href="https://www.youtube.com/@HumancareConnect"
            className="soc-btn"
            aria-label="YouTube"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaYoutube />
          </a>
          <a
            href="https://www.facebook.com/profile.php?id=61589783051065"
            className="soc-btn"
            aria-label="Facebook"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaFacebookF />
          </a>
          <a
            href="https://www.instagram.com/humancareconnect/"
            className="soc-btn"
            aria-label="Instagram"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaInstagram />
          </a>
          <a
            href="https://www.threads.com/@humancareconnect"
            className="soc-btn"
            aria-label="Threads"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaThreads />
          </a>
        </div>
      </div>
    </footer>
  );
}
