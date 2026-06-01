import { useEffect, useState, useRef } from "react";
import "./header.css";
import { Link, useLocation } from "react-router-dom";
import { FaUserCircle } from "react-icons/fa";
import logo from "../assets/Logo.png";

export default function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  /* Nav pill hover */
const pillRef = useRef(null);
const navMenuRef = useRef(null);

useEffect(() => {
  const pill = pillRef.current;
  const navMenu = navMenuRef.current;

  if (!pill || !navMenu) return;

  const items = navMenu.querySelectorAll(".nav-item");

  const movePill = (e) => {
    const item = e.currentTarget;

    const navRect = navMenu.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();

    pill.style.width = `${itemRect.width}px`;

    pill.style.left = `${itemRect.left - navRect.left}px`;

    pill.style.opacity = "1";
    pill.style.transform = "translateY(-50%) scale(1)";
  };

  const hidePill = () => {
    pill.style.opacity = "0";
    pill.style.transform = "translateY(50%) scale(0.92)";
    
  };

  items.forEach((item) => {
    item.addEventListener("mouseenter", movePill);
  });

  navMenu.addEventListener("mouseleave", hidePill);

  return () => {
    items.forEach((item) => {
      item.removeEventListener("mouseenter", movePill);
    });

    navMenu.removeEventListener("mouseleave", hidePill);
  };
}, []);

  const location = useLocation();
  const navItems = [
    ...(location.pathname !== "/"
      ? [{ label: "Home", link: "/" }]
      : []),

    { label: "Find a Doctor", link: "/find-a-doctor" },
    { label: "Ask a Question", link: "/ask-a-question" },
    { label: "Medical Services", link: "/medical-services" },
    { label: "Corporates", link: "/corporates" },
    { label: "Blogs", link: "/blogs" },
  ];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };

    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  // HELP SLIDER
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

        {/* ✅LOGO */}
        <Link to="/" className="logo">
          {!isScrolled ? (
            <img src={logo} alt="Humancare Logo" className="logo-img" />
          ) : (
            <div id="logo-h-h">H</div>
          )}
        </Link>

        <div className="help-slider">
          <span className="help-label">GET HELP WITH</span>

          <div className="help-slide-wrapper">
            <div className="help-slide-track">
              {helpItems.map((item, index) => (
                <span key={index} className="help-slide-item">
                  {item}
                </span>
              ))}

              {/* duplicate for smooth loop */}
              {helpItems.map((item, index) => (
                <span key={`dup-${index}`} className="help-slide-item">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
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

        {/* 🔥 AUTH BUTTONS */}
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

        {/* HAMBURGER */}
        <div className="hamburger" id="hamburger">
          <span></span>
          <span></span>
          <span></span>
        </div>

        {/* MOBILE MENU */}
        <div className="mobile-menu" id="mobileMenu">
          {navItems.map((item, index) => (
            <Link to={item.link} className="nav-item" key={index}>
              {item.label}
            </Link>
          ))}

          <Link to="/book-appointment" className="nav-cta">
            Book Appointment
          </Link>
        </div>
      </div>
    </header>
  );
}
