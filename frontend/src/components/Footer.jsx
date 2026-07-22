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

        {/* Services Quick Links */}
        <div className="footer-col">
          <h5>Legal & Company Compliance</h5>
          <a href="/refund-cancellation-policy">Refund & Cancellation Policy</a>
          <a href="/provider-terms-of-service">Provider Terms of Service</a>
          <a href="/privacy-policy">Privacy Policy</a>
          <a href="/terms-of-service">Terms of Service</a>
          <a href="/hippa-notice-of-privacy-practices">Notice of Privacy Practices</a>
          <a href="/california-privacy-rights-notice">California Privacy Rights Notice</a>
          <a href="/cookie-policy">Cookie Policy</a>
          <a href="/accessibility-statement">Accessibility Statement</a>
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
