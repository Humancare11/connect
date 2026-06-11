import React from "react";
import "./footer.css";
 
import {
  FaLinkedinIn,
  FaFacebookF,
  FaYoutube,
  FaInstagram,
} from "react-icons/fa";
 
import { FaThreads } from "react-icons/fa6";
import { FaXTwitter } from "react-icons/fa6";
 
export default function Footer() {
  return (
    <footer className="footer">
 
      {/* MAIN GRID */}
      <div className="footer-container">
 
        {/* BRAND SECTION */}
        <div className="footer-brand">
          <h2>Humancare Connect</h2>

          <p className="footer-tagline">
            Connecting patients with trusted healthcare professionals anytime,
            anywhere through secure and affordable digital healthcare solutions.
          </p>
 
          {/* COMPLIANCE BADGES */}
          <div className="footer-badges">
            <span className="footer-badge">HIPAA</span>
            <span className="footer-badge">GDPR</span>
            <span className="footer-badge">SOC 2 Type II</span>
            <span className="footer-badge">HITRUST R2</span>
          </div>
        </div>
 
        {/* PLATFORM */}
        <div className="footer-col">
          <h5>Navigation </h5>

          <a href="/find-a-doctor">About Us</a>
          <a href="/book-appointment">Services</a>
          <a href="/medical-services">Online Doctor</a>
          <a href="/blogs">Refer a Friend</a>
          <a href="/blogs">Blog</a>
          <a href="/blogs">Partners</a>
          {/* <a href="/blogs">Careers</a> */}
          {/* <a href="/blogs">Contact Us</a> */}
        </div>

        {/* Services Quick Links */}
        <div className="footer-col">
          <h5>Services  </h5>

          <a href="/find-a-doctor">Prescription Refill</a>
          <a href="/book-appointment">Online Doctor Consultation</a>
          <a href="/medical-services">Weight Loss</a>
          <a href="/ask-a-question">Urgent Care</a>
          <a href="/blogs">Sick Notes</a>
          <a href="/blogs">Doctor’s Letter</a>
          <a href="/blogs">Lab Orders</a>
          <a href="/blogs">Medical Questions</a>
        </div>

        {/* COMPANY */}
        <div className="footer-col">
          <h5>Legal & Company Compliance </h5>

          <a href="#">Privacy Policy</a>
          <a href="#">Refund Policy</a>
          <a href="#">Terms & Conditions</a>
          <a href="#">HIPAA Compliance</a>
          <a href="#">GDPR Compliance</a>

        </div>

        {/* SUPPORT */}
        <div className="footer-col">
          <h5>Support</h5>

          <a href="/doctor-login">Doctor Login</a>
          <a href="#">Help Center</a>
          <a href="#">FAQs</a>
          <a href="/blogs">Careers</a>
          <a href="/blogs">Contact Us</a>
        </div>
 
      </div>
 
      {/* WATERMARK — glass fade effect pinned above bottom border */}
      <div className="footer-watermark-wrap" aria-hidden="true">
        <div className="footer-bg-text">HUMANCARE CONNECT</div>
      </div>
 
      {/* FOOTER BOTTOM */}
      <div className="footer-bottom">
        <span>© 2026 HumanCare Connect, Inc.</span>
 
        <div className="footer-socials">
          <a href="https://x.com/HCCofficial_" className="soc-btn" aria-label="X / Twitter">
            <FaXTwitter />
          </a>
          <a href="https://www.linkedin.com/company/122144245" className="soc-btn" aria-label="LinkedIn">
            <FaLinkedinIn />
          </a>
          <a href="https://www.youtube.com/@HumancareConncect" className="soc-btn" aria-label="YouTube">
            <FaYoutube />
          </a>
          <a href="https://www.facebook.com/profile.php?id=61589783051065" className="soc-btn" aria-label="Facebook">
            <FaFacebookF />
          </a>
          <a href="https://www.instagram.com/humancareconnect/" className="soc-btn" aria-label="Instagram">
            <FaInstagram />
          </a>
          <a href="https://www.threads.com/@humancareconnect" className="soc-btn" aria-label="Threads">
            <FaThreads />
          </a>
        </div>
      </div>
 
    </footer>
  );
}
 