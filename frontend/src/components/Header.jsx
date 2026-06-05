import { useEffect, useState, useRef, useCallback } from "react";
import "./header.css";
import { Link, useLocation } from "react-router-dom";
import { FaUserCircle } from "react-icons/fa";
import logo from "../assets/Logo.png";
import miniLogo from "../assets/single-logo.png";

export default function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const pillRef    = useRef(null);
  const navMenuRef = useRef(null);

  const location = useLocation();

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const navItems = [
    ...(location.pathname !== "/" ? [{ label: "Home", link: "/" }] : []),
    { label: "Find a Doctor",    link: "/find-a-doctor"    },
    { label: "Ask a Question",   link: "/ask-a-question"   },
    { label: "Medical Services", link: "/medical-services" },
    { label: "Corporates",       link: "/corporates"       },
    { label: "Blogs",            link: "/blogs"            },
  ];

  /* ==================== SCROLL ==================== */
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ==================== PILL ==================== */
  /*
   * Single source of truth: JS owns ALL pill positioning.
   * CSS provides only: transition timing, border-radius, pointer-events.
   * No scaleX, no CSS overrides of left/width. No conflicting sibling selectors.
   *
   * Mode "hover"  → full capsule behind hovered item
   * Mode "active" → small glowing dot centered under active item
   * Mode "hide"   → opacity 0 (stays at last position, no jump)
   */
  const positionPill = useCallback((pill, navMenu, item) => {
    if (!pill || !navMenu || !item) return;

    const navRect  = navMenu.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const relLeft  = itemRect.left - navRect.left;

    pill.style.left       = `${relLeft}px`;
    pill.style.width      = `${itemRect.width}px`;
    pill.style.opacity    = "1";
    pill.style.background = "rgba(255,255,255,.28)";
    pill.style.boxShadow  = "inset 0 1px 0 rgba(255,255,255,.55)";
    pill.style.border     = "1px solid rgba(255,255,255,.38)";
  }, []);

  useEffect(() => {
    const pill    = pillRef.current;
    const navMenu = navMenuRef.current;
    if (!pill || !navMenu) return;

    const items = Array.from(navMenu.querySelectorAll(".nav-item"));

    // Pill starts hidden — it only appears on hover
    pill.style.transition = "none";
    pill.style.opacity    = "0";
    requestAnimationFrame(() => { pill.style.transition = ""; });

    const onEnter = (e) => {
      // Hovering the active item — explicitly hide the pill so it
      // doesn't linger from the previous non-active item hover
      if (e.currentTarget.classList.contains("active")) {
        pill.style.opacity = "0";
        return;
      }
      positionPill(pill, navMenu, e.currentTarget);
    };
    const onLeave = () => {
      // Pill fades out — the CSS ::before bar is the active indicator
      pill.style.opacity = "0";
    };
    // On resize just hide the pill — it re-appears correctly on next hover
    const onResize = () => { pill.style.opacity = "0"; };

    items.forEach((el) => el.addEventListener("mouseenter", onEnter));
    navMenu.addEventListener("mouseleave", onLeave);
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      items.forEach((el) => el.removeEventListener("mouseenter", onEnter));
      navMenu.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("resize", onResize);
    };
  }, [location.pathname, positionPill]);

  const helpItems = [
    "Lab Order", "Doctor Consultation", "Medical Reports",
    "Emergency Care", "Health Insurance",
  ];

  return (
    <>
      <header className={`glass-header ${isScrolled ? "shrink" : ""}`}>
        <div className="nav-container">

          {/* LOGO */}
          <Link to="/" className={`logo ${isScrolled ? "scrolled" : ""}`}>
            <img src={logo}     alt="Humancare Logo"      className="logo-full" />
            <img src={miniLogo} alt="Humancare Mini Logo" className="logo-mini" />
          </Link>

          {/* HELP SLIDER */}
          <div className="help-slider magnetic">
            <span className="help-label">GET HELP WITH</span>
            <div className="help-slide-wrapper">
              <div className="help-slide-track">
                {helpItems.map((item, i) => (
                  <span key={i} className="help-slide-item">{item}</span>
                ))}
                {helpItems.map((item, i) => (
                  <span key={`d-${i}`} className="help-slide-item">{item}</span>
                ))}
              </div>
            </div>
          </div>

          {/* DESKTOP NAV */}
          <nav className="nav-menu" ref={navMenuRef}>
            <span className="nav-pill" ref={pillRef} aria-hidden="true" />
            {navItems.map((item, i) => (
              <Link
                key={i}
                to={item.link}
                className={`nav-item ${location.pathname === item.link ? "active" : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* AUTH */}
          <div className="auth-buttons">
            {!isLoggedIn ? (
              <div className="auth-combined magnetic">
                <Link to="/login" className="auth-link">Login</Link>
                <span className="divider">/</span>
                <Link to="/login" className="auth-link">Register</Link>
              </div>
            ) : (
              <Link to="/profile" className="profile-icon">
                <FaUserCircle />
              </Link>
            )}
          </div>

          {/* HAMBURGER — margin-left:auto keeps it pinned to the right */}
          <button
            className={`hamburger ${mobileOpen ? "open" : ""}`}
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            style={{ marginLeft: "auto" }}
          >
            <span /><span /><span />
          </button>
        </div>

        {/* MOBILE MENU — outside nav-container so it isn't clipped by overflow:hidden */}
        <div className={`mobile-menu ${mobileOpen ? "open" : ""}`}>
          {navItems.map((item, i) => (
            <Link
              key={i}
              to={item.link}
              className={`mobile-nav-item ${location.pathname === item.link ? "active" : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <div className="mobile-auth">
            <Link to="/login"    className="mobile-auth-link"                  onClick={() => setMobileOpen(false)}>Login</Link>
            <Link to="/register" className="mobile-auth-link mobile-auth-cta"  onClick={() => setMobileOpen(false)}>Register</Link>
          </div>
        </div>
      </header>

      {/* Backdrop — click to close mobile menu */}
      {mobileOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}