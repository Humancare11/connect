import React from "react";
import "./footer.css";

import {
  FaLinkedinIn,
  FaFacebookF,
  FaYoutube,
  FaPhoneAlt,
  FaEnvelope,
} from "react-icons/fa";

import { FaLocationDot, FaXTwitter } from "react-icons/fa6";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">

        {/* BRAND SECTION */}
        <div className="footer-brand">
          <h2>Humancare Connect</h2>

          <p className="footer-tagline">
            Connecting patients with trusted healthcare professionals anytime,
            anywhere through secure and affordable digital healthcare solutions.
          </p>

          {/* CONTACT INFO */}
          <div className="footer-contact">

            <div className="contact-item">
              <FaEnvelope />
              <span>support@humancareconnect.co</span>
            </div>

            <div className="contact-item">
              <FaPhoneAlt />
              <span>+1 302303993</span>
            </div>

            <div className="contact-item">
              <FaLocationDot />
              <span>
4 Peddlers Row #1091 Newark, DE 19702 USA              </span>
            </div>

          </div>

          {/* SOCIAL ICONS */}
          <div className="footer-socials">

            <a href="#" className="soc-btn">
              <FaXTwitter />
            </a>

            <a href="#" className="soc-btn">
              <FaLinkedinIn />
            </a>

            <a href="#" className="soc-btn">
              <FaYoutube />
            </a>

            <a href="#" className="soc-btn">
              <FaFacebookF />
            </a>

          </div>
        </div>

        {/* PLATFORM */}
        <div className="footer-col">
          <h5>Platform</h5>

          <a href="/find-a-doctor">Find Doctors</a>
          <a href="/book-appointment">Book Appointment</a>
          <a href="/medical-services">Medical Services</a>
          <a href="/ask-a-question">Ask a Question</a>
          <a href="/blogs">Healthcare Blogs</a>
        </div>

        {/* COMPANY */}
        <div className="footer-col">
          <h5>Company</h5>

          <a href="#">About Us</a>
          <a href="#">Careers</a>
          <a href="#">Press & Media</a>
          <a href="#">Privacy Policy</a>
          <a href="#">Terms & Conditions</a>
        </div>

        {/* SUPPORT */}
        <div className="footer-col">
          <h5>Support</h5>

          <a href="/doctor-login">Doctor Login</a>
          <a href="/contact">Contact Support</a>
          <a href="#">Help Center</a>
          <a href="#">HIPAA Compliance</a>
          <a href="#">FAQs</a>
        </div>

      </div>

      {/* FOOTER BOTTOM */}
      <div className="footer-bottom">

        <span>
          © 2026 Humancare Connect. All rights reserved.
        </span>

        <span>
          Designed with care for better healthcare experiences ❤️
        </span>

      </div>
    </footer>
  );
}