import { useEffect, useState, useRef, useCallback } from "react";
import "./header.css";
import { Link, useLocation } from "react-router-dom";
import { FaUserCircle } from "react-icons/fa";
import logo from "../assets/Logo.png";
import miniLogo from "../assets/logo-2.png";
import { useAuth } from "../context/AuthContext";

/* ── Inline SVG icons for the help dropdown ── */
const HelpIcons = {
  "Lab Order": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
    </svg>
  ),
  "Doctor Consultation": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/>
      <circle cx="20" cy="10" r="2"/>
    </svg>
  ),
  "Medical Reports": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <line x1="10" y1="9" x2="8" y2="9"/>
    </svg>
  ),
  "Emergency Care": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  ),
  "Health Insurance": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  "Prescription Refill": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
    </svg>
  ),
  "Mental Health": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a5 5 0 0 1 5 5c0 2-1 3.5-2.5 4.5V13h-5v-1.5C8 10.5 7 9 7 7a5 5 0 0 1 5-5z"/>
      <path d="M9.5 13v2.5a2.5 2.5 0 0 0 5 0V13"/>
    </svg>
  ),
  "Chronic Disease": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12,6 12,12 16,14"/>
    </svg>
  ),
  "Vaccination": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m18 2 4 4-4 4-4-4 4-4z"/><path d="m11.5 6.5-9 9 2 2 2-2 2.5 2.5-1 1 2 2 9-9-2-2-1 1L13.5 8.5l1-1-2-2z"/><path d="M2 22l3-3"/>
    </svg>
  ),
  "Nutrition & Diet": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 2a2 2 0 0 0-2 2v5H4v2c0 4.4 2.8 8.1 7 9.7V22h2v-1.3C17.2 19.1 20 15.4 20 11V9h-5V4a2 2 0 0 0-2-2z"/>
    </svg>
  ),
  "Home Care": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9,22 9,12 15,12 15,22"/>
    </svg>
  ),
  "Second Opinion": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
};

/* ── Route mapping for help items ── */
const helpRoutes = {
  "Lab Order":           "#",
  "Doctor Consultation": "/appointment-booking",
  "Medical Reports":     "#",
  "Emergency Care":      "#",
  "Health Insurance":    "#",
  "Prescription Refill": "#",
  "Mental Health":       "/medical-services",
  "Chronic Disease":     "/medical-services",
  "Vaccination":         "#",
  "Nutrition & Diet":    "#",
  "Home Care":           "#",
  "Second Opinion":      "/appointment-booking",
};

/* ── Short descriptor shown in dropdown ── */
const helpDesc = {
  "Lab Order":           "Book tests & get results fast",
  "Doctor Consultation": "Video or in-person visits",
  "Medical Reports":     "Access & share your records",
  "Emergency Care":      "24 / 7 urgent care support",
  "Health Insurance":    "Plans that work for you",
  "Prescription Refill": "Renew meds in minutes",
  "Mental Health":       "Talk to a therapist today",
  "Chronic Disease":     "Ongoing condition support",
  "Vaccination":         "Schedule your next shot",
  "Nutrition & Diet":    "Personalised diet guidance",
  "Home Care":           "Care delivered at home",
  "Second Opinion":      "Get another expert view",
};

export default function Header() {
  const { user } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen,   setHelpOpen]   = useState(false);

  const pillRef    = useRef(null);
  const navMenuRef = useRef(null);
  const helpWrapRef = useRef(null);
  const headerRef  = useRef(null);

  const location = useLocation();

  /* Close menus on route change */
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => { setHelpOpen(false);   }, [location.pathname]);

  const navItems = [
    ...(location.pathname !== "/" ? [{ label: "Home", link: "/" }] : []),
    { label: "About Us",            link: "/about-us"               },
    { label: "Book Appointment", link: "/appointment-booking" },
    { label: "Medical Services", link: "/medical-services"    },
    { label: "Corporates",       link: "/corporates"          },
    { label: "Blogs",            link: "/blogs"               },
  ];

  const helpItems = [
    "Lab Order",
    "Doctor Consultation",
    "Medical Reports",
    "Emergency Care",
    "Health Insurance",
    "Prescription Refill",
    "Mental Health",
    "Chronic Disease",
    "Vaccination",
    "Nutrition & Diet",
    "Home Care",
    "Second Opinion",
  ];

  /* ==================== SCROLL ==================== */
  useEffect(() => {
    const handleScroll = () => { setIsScrolled(window.scrollY > 40); };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* ==================== PILL ==================== */
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
    pill.style.transition = "none";
    pill.style.opacity    = "0";
    requestAnimationFrame(() => { pill.style.transition = ""; });

    const onEnter = (e) => {
      if (e.currentTarget.classList.contains("active")) {
        pill.style.opacity = "0";
        return;
      }
      positionPill(pill, navMenu, e.currentTarget);
    };
    const onLeave  = () => { pill.style.opacity = "0"; };
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

  /* ==================== HELP DROPDOWN — OUTSIDE CLICK + ESC ==================== */
  useEffect(() => {
    if (!helpOpen) return;

    const handleOutside = (e) => {
      if (helpWrapRef.current && !helpWrapRef.current.contains(e.target)) {
        setHelpOpen(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") setHelpOpen(false);
    };

    /* Delay so the opening click doesn't immediately close the dropdown */
    const tid = setTimeout(() => {
      document.addEventListener("mousedown", handleOutside);
      document.addEventListener("keydown",   handleEsc);
    }, 0);

    return () => {
      clearTimeout(tid);
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown",   handleEsc);
    };
  }, [helpOpen]);

  /* ==================== HEADER HEIGHT (for mobile dropdown positioning) ====================
     FIX: Measures the actual rendered header height and exposes it as the
     `--header-h` CSS variable (consumed by .help-dropdown on mobile in
     header.css). This keeps the fixed-position dropdown aligned with the
     header regardless of its normal vs .shrink height, instead of relying
     on a hardcoded `top: 72px`.
  ==================================================================== */
  useEffect(() => {
    const updateHeaderHeight = () => {
      const el = headerRef.current;
      if (!el) return;
      const h = el.getBoundingClientRect().height;
      const gap = 12; // breathing room below the header
      el.style.setProperty("--header-h", `${Math.round(h + gap)}px`);
    };

    updateHeaderHeight();

    window.addEventListener("resize", updateHeaderHeight, { passive: true });

    // Re-measure shortly after scroll-driven shrink toggles, since the
    // shrink transition changes the header's height.
    const tid = setTimeout(updateHeaderHeight, 320);

    return () => {
      window.removeEventListener("resize", updateHeaderHeight);
      clearTimeout(tid);
    };
  }, [isScrolled, helpOpen]);

  return (
    <>
      <header
        ref={headerRef}
        className={`glass-header ${isScrolled ? "shrink" : ""}`}
      >
        <div className="nav-container">

          {/* LOGO */}
          <Link to="/" className={`logo ${isScrolled ? "scrolled" : ""}`}>
            <img src={logo} alt="Humancare Logo" className="logo-full" decoding="async" />
            <img src={miniLogo} alt="Humancare Mini Logo" className="logo-mini" decoding="async" />
          </Link>

          {/*
            HELP SLIDER WRAP
            FIX: removed the conditional "visible-mobile" class — it was
            never defined in CSS and the mobile reveal is already handled
            by `.glass-header.shrink .help-slider-wrap` in the stylesheet.
          */}
          <div
            className="help-slider-wrap"
            ref={helpWrapRef}
          >
            {/* HELP SLIDER PILL */}
            <div
              className={`help-slider magnetic ${helpOpen ? "help-slider--open" : ""}`}
              onClick={() => setHelpOpen((o) => !o)}
              role="button"
              aria-haspopup="true"
              aria-expanded={helpOpen}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setHelpOpen((o) => !o);
                }
              }}
            >
              <span className="help-label">GET HELP WITH</span>
              <div className="help-slide-wrapper">
                <div className={`help-slide-track ${helpOpen ? "paused" : ""}`}>
                  {helpItems.map((item, i) => (
                    <span key={i} className="help-slide-item">{item}</span>
                  ))}
                  {/* Duplicate items for seamless loop */}
                  {helpItems.map((item, i) => (
                    <span key={`d-${i}`} className="help-slide-item">{item}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* HELP DROPDOWN */}
            {helpOpen && (
              <div
                className="help-dropdown"
                role="menu"
                aria-label="Help options"
              >
                <p className="help-dropdown-heading">How can we help you?</p>
                <ul className="help-dropdown-list">
                  {helpItems.map((item) => (
                    <li key={item} role="none">
                      <Link
                        to={helpRoutes[item]}
                        className="help-dropdown-item"
                        role="menuitem"
                        onClick={() => setHelpOpen(false)}
                      >
                        <span className="help-dropdown-icon">
                          {HelpIcons[item]}
                        </span>
                        <span className="help-dropdown-text">
                          <span className="help-dropdown-label">{item}</span>
                          <span className="help-dropdown-desc">{helpDesc[item]}</span>
                        </span>
                        <span className="help-dropdown-arrow">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 7h8M7 3l4 4-4 4"/>
                          </svg>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {/* /help-slider-wrap */}

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
            {user ? (
              <Link to="/user/dashboard" className="profile-icon">
                <FaUserCircle />
              </Link>
            ) : (
              <div className="auth-combined magnetic">
                <Link to="/login"  className="auth-link">Login</Link>
                <span className="divider">/</span>
                <Link to="/login"  className="auth-link">Register</Link>
              </div>
            )}
          </div>

          {/* HAMBURGER */}
          <button
            className={`hamburger ${mobileOpen ? "open" : ""}`}
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            <span /><span /><span />
          </button>
        </div>

        {/* MOBILE MENU */}
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
            {user ? (
              <Link
                to="/user/dashboard"
                className="mobile-auth-link mobile-auth-cta"
                onClick={() => setMobileOpen(false)}
              >
                My Account
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="mobile-auth-link"
                  onClick={() => setMobileOpen(false)}
                >
                  Login
                </Link>
                <Link
                  to="/login"
                  className="mobile-auth-link mobile-auth-cta"
                  onClick={() => setMobileOpen(false)}
                >
                  Register
                </Link>
              </>
            )}
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