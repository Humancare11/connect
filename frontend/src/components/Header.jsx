import { useEffect, useState, useRef } from "react";
import "./header.css";
import { Link, useLocation } from "react-router-dom";
import { FaUserCircle } from "react-icons/fa";
import logo from "../assets/Logo.png";
import miniLogo from "../assets/single-logo.png";

export default function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const pillRef = useRef(null);
  const navMenuRef = useRef(null);

  const location = useLocation();

  const navItems = [
    ...(location.pathname !== "/" ? [{ label: "Home", link: "/" }] : []),
    { label: "Find a Doctor", link: "/find-a-doctor" },
    { label: "Ask a Question", link: "/ask-a-question" },
    { label: "Medical Services", link: "/medical-services" },
    { label: "Corporates", link: "/corporates" },
    { label: "Blogs", link: "/blogs" },
  ];


  /* ==================== NAV PILL LOGIC ==================== */
useEffect(() => {
  const pill = pillRef.current;
  const navMenu = navMenuRef.current;
  if (!pill || !navMenu) return;

  const items = Array.from(navMenu.querySelectorAll(".nav-item"));

  const updatePill = (item, isHover = false) => {
    const navRect = navMenu.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();

    pill.style.left = `${itemRect.left - navRect.left}px`;
    pill.style.opacity = "1";

    if (isHover) {
      pill.classList.add("hover");
      pill.classList.remove("active");
      pill.style.width = `${itemRect.width}px`;
    } else {
      pill.classList.remove("hover");
      pill.classList.add("active");
      pill.style.width = "4px";
    }
  };

  const handleMouseEnter = (e) => updatePill(e.currentTarget, true);
  const handleMouseLeave = () => {
    const activeItem = navMenu.querySelector(".nav-item.active");
    if (activeItem) updatePill(activeItem, false);
  };

  items.forEach(item => item.addEventListener("mouseenter", handleMouseEnter));
  navMenu.addEventListener("mouseleave", handleMouseLeave);

  const initialActive = navMenu.querySelector(".nav-item.active");
  if (initialActive) updatePill(initialActive, false);

  return () => {
    items.forEach(item => item.removeEventListener("mouseenter", handleMouseEnter));
    navMenu.removeEventListener("mouseleave", handleMouseLeave);
  };
}, [location.pathname]);


  const helpItems = [
  "Lab Order",
  "Doctor Consultation",
  "Medical Reports",
  "Emergency Care",
  "Health Insurance",
];


  return (
    <header className={`glass-header ${isScrolled ? "shrink" : ""}`}>
      <div className="nav-container">
        {/* LOGO */}
        <Link to="/" className={`logo ${isScrolled ? "scrolled" : ""}`}>
  <img
    src={logo}
    alt="Humancare Logo"
    className="logo-full"
  />
  <img 
    src={miniLogo} 
    alt="Humancare Mini Logo"
    className="logo-mini"
  />
</Link>

        {/* HELP SLIDER */}
        <div className="help-slider magnetic">
          <span className="help-label">GET HELP WITH</span>
          <div className="help-slide-wrapper">
            <div className="help-slide-track">
              {helpItems.map((item, index) => (
                <span key={index} className="help-slide-item">
                  {item}
                </span>
              ))}
              {helpItems.map((item, index) => (
                <span key={`dup-${index}`} className="help-slide-item">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* NAV MENU WITH PILL */}
        <nav className="nav-menu" ref={navMenuRef}>
          <span className="nav-pill" ref={pillRef}></span>

          {navItems.map((item, index) => (
            <Link
              to={item.link}
              className={`nav-item ${
                location.pathname === item.link ? "active" : ""
              }`}
              key={index}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* AUTH BUTTONS */}
        <div className="auth-buttons">
          {!isLoggedIn ? (
            <div className="auth-combined magnetic">
              <Link to="/login" className="auth-link">
                Login
              </Link>
              <span className="divider">/</span>
              <Link to="/login" className="auth-link">
                Register
              </Link>
            </div>
          ) : (
            <Link to="/profile" className="profile-icon">
              <FaUserCircle />
            </Link>
          )}
        </div>

        {/* Hamburger & Mobile Menu (unchanged) */}
        <div className="hamburger" id="hamburger">
          <span></span>
          <span></span>
          <span></span>
        </div>

        <div className="mobile-menu" id="mobileMenu">
          {/* ... your mobile menu */}
        </div>
      </div>
    </header>
  );
}
