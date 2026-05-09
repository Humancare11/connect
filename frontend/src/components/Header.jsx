import { useEffect, useState } from "react";
import "./header.css";
import { Link, useLocation } from "react-router-dom";
import { FaUserCircle } from "react-icons/fa";
import logo from "../assets/logo.png";

export default function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    /* Nav pill hover */
    const pill = document.querySelector(".nav-pill");
    const items = document.querySelectorAll(".nav-menu .nav-item");

    items.forEach((item) => {
      const onEnter = () => {
        if (!pill) return;

        pill.style.width = item.offsetWidth + "px";
        pill.style.left = item.offsetLeft + "px";
      };

      item.addEventListener("mouseenter", onEnter);
      item._onEnter = onEnter;
    });

    const navMenu = document.querySelector(".nav-menu");

    const onNavLeave = () => {
      if (pill) pill.style.width = "0px";
    };

    navMenu?.addEventListener("mouseleave", onNavLeave);

    /* Scroll effect */
    const handleScroll = () => {
      const header = document.getElementById("header");

      header?.classList.toggle("shrink", window.scrollY > 50);

      // ✅ Logo hide + H show
      setIsScrolled(window.scrollY > 50);

      const pct =
        (window.scrollY /
          (document.body.scrollHeight - window.innerHeight)) *
        100;

      const prog = document.getElementById("prog");

      if (prog) prog.style.width = pct + "%";
    };

    window.addEventListener("scroll", handleScroll);

    /* Hamburger menu */
    const hamburger = document.getElementById("hamburger");
    const mobileMenu = document.getElementById("mobileMenu");

    const toggleMenu = () => {
      if (!hamburger || !mobileMenu) return;

      hamburger.classList.toggle("open");
      mobileMenu.classList.toggle("open");
    };

    if (hamburger) hamburger.addEventListener("click", toggleMenu);

    if (mobileMenu) {
      const links = mobileMenu.querySelectorAll("a");

      links.forEach((a) => {
        const onMenuClick = () => {
          hamburger?.classList.remove("open");
          mobileMenu?.classList.remove("open");
        };

        a.addEventListener("click", onMenuClick);
        a._onMenuClick = onMenuClick;
      });
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);

      navMenu?.removeEventListener("mouseleave", onNavLeave);

      items.forEach((item) => {
        if (item._onEnter) {
          item.removeEventListener("mouseenter", item._onEnter);
        }
      });

      if (hamburger) {
        hamburger.removeEventListener("click", toggleMenu);
      }

      if (mobileMenu) {
        mobileMenu.querySelectorAll("a").forEach((a) => {
          if (a._onMenuClick) {
            a.removeEventListener("click", a._onMenuClick);
          }
        });
      }
    };
  }, []);

  const navItems = [
    { label: "Home", link: "/" },
    { label: "Find a Doctor", link: "/find-a-doctor" },
    { label: "Ask a Question", link: "/ask-a-question" },
    { label: "Medical Services", link: "/medical-services" },
    { label: "Corporates", link: "/corporates" },
    { label: "Blogs", link: "/blogs" },
  ];

  // ✅ Check login
  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);
  }, []);

  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);
  }, [location.pathname]);

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
