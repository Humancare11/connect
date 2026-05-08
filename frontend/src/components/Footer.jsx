import React from "react";
import "./footer.css";

import { FaLinkedinIn, FaFacebookF } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { FaYoutube } from "react-icons/fa";

export default function Footer() {
  return (
    <footer>
      <div className="footer-grid">
        <div>
          <div className="footer-logo">Humancare</div>
          <p className="footer-desc">
            Making quality healthcare accessible and affordable for every
            American, wherever they are.
          </p>
          <div className="footer-socials">
            <div className="soc-btn">
              <FaXTwitter />
            </div>
            <div className="soc-btn">
              <FaLinkedinIn />
            </div>
            <div className="soc-btn">
              <FaYoutube />
            </div>
            <div className="soc-btn">
              <FaFacebookF />
            </div>
          </div>
        </div>
        <div className="footer-col">
          <h5>Platform</h5>
          <a href="#">Find Doctors</a>
          <a href="#">Video Visits</a>
          <a href="#">Prescriptions</a>
          <a href="#">Mental Health</a>
          <a href="#">Chronic Care</a>
        </div>
        <div className="footer-col">
          <h5>Company</h5>
          <a href="#">About Us</a>
          <a href="#">Careers</a>
          <a href="#">Press</a>
          <a href="#">Blog</a>
          <a href="#">Investors</a>
        </div>
        <div className="footer-col">
          <h5>Support</h5>
          <a href="/doctor-login">Doctors Login</a>
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">HIPAA Notice</a>
          <a href="#">Contact</a>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Humancare Technologies Inc. All rights reserved.</span>
        <span>Made with care in the United States 🇺🇸</span>
      </div>
    </footer>
  );
}
