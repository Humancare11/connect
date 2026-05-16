import { useEffect, useState } from "react";
import "./header.css";
import { Link, useLocation } from "react-router-dom";
import { FaUserCircle } from "react-icons/fa";
import logo from "../assets/Logo.png";

export default function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

/* Nav pill hover */

const pill = document.querySelector(".nav-pill");

const navMenu = document.querySelector(".nav-menu");

const items = document.querySelectorAll(".nav-menu .nav-item");

items.forEach((item) => {
  const onEnter = () => {
    if (!pill || !navMenu) return;

    const navRect = navMenu.getBoundingClientRect();

    const itemRect = item.getBoundingClientRect();

    pill.style.width = `${itemRect.width}px`;

    pill.style.left = `${itemRect.left - navRect.left}px`;

    pill.style.opacity = "1";
  };

  item.addEventListener("mouseenter", onEnter);

  item._onEnter = onEnter;
});

const onNavLeave = () => {
  if (!pill) return;

  pill.style.width = "0px";

  pill.style.opacity = "0";
};

navMenu?.addEventListener("mouseleave", onNavLeave);

  // ✅ Check login
  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);
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

  // useEffect(() => {
  //   const token = localStorage.getItem("token");
  //   setIsLoggedIn(!!token);
  // }, [location.pathname]);

  // HELP SLIDER
  const helpItems = [
    "Lab Order",
    "Doctor Consultation",
    "Medical Reports",
    "Emergency Care",
    "Health Insurance",
  ];

  return (
    <header className="glass-header" id="header">
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
        <nav className="nav-menu">
          <span className="nav-pill"></span>

          {navItems.map((item, index) => (
            <Link to={item.link} className="nav-item" key={index}>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* 🔥 AUTH BUTTONS */}
        <div className="auth-buttons">
          {!isLoggedIn ? (
            <div className="auth-combined">
              <Link to="/login" className="auth-link">
                Login
              </Link>

              <span className="divider">/</span>

              <Link to="/register" className="auth-link">
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
