import { useEffect, useState, useRef, useCallback } from "react";
import "./header.css";
import { Link, useLocation } from "react-router-dom";
import { FaUserCircle } from "react-icons/fa";
import logo from "../assets/NewLogo.png";
import miniLogo from "../assets/logo-2.png";
import { useAuth } from "../context/AuthContext";
import {
  Baby,
  Activity,
  Eye,
  Stethoscope,
  Mars,
  Brain,
  Heart,
  Sparkles,
  Plane,
  Salad,
  Venus,
} from "lucide-react";

/* ── Lucide icon map for the 11 categories ── */
const HelpIcons = {
  "Child & Family Care": <Baby size={18} strokeWidth={1.8} />,
  "Chronic Care & Expert Opinion": <Activity size={18} strokeWidth={1.8} />,
  "Eye, Ear & Bone": <Eye size={18} strokeWidth={1.8} />,
  "General & Everyday Care": <Stethoscope size={18} strokeWidth={1.8} />,
  "Men's Health": <Mars size={18} strokeWidth={1.8} />,
  "Mental Health": <Brain size={18} strokeWidth={1.8} />,
  "Sexual Health": <Heart size={18} strokeWidth={1.8} />,
  "Skin & Hair": <Sparkles size={18} strokeWidth={1.8} />,
  "Travel & Global Care": <Plane size={18} strokeWidth={1.8} />,
  "Weight & Nutrition": <Salad size={18} strokeWidth={1.8} />,
  "Women's Health": <Venus size={18} strokeWidth={1.8} />,
};

/* ── Route mapping for each category ── */
const helpRoutes = {
  "Child & Family Care": "/child-and-family-care",
  "Chronic Care & Expert Opinion": "/chronic-care-and-expert-opinion",
  "Eye, Ear & Bone": "/eye-ear-bone",
  "General & Everyday Care": "/general-and-everyday-care",
  "Men's Health": "/men-health",
  "Mental Health": "/mental-health",
  "Sexual Health": "/categories-sexual-health",
  "Skin & Hair": "/skin-and-hair-care",
  "Travel & Global Care": "/travel-global-care",
  "Weight & Nutrition": "/weight-nurtrition",
  "Women's Health": "/women-health",
};

/* ── Short descriptor shown in dropdown ── */
const helpDesc = {
  "Child & Family Care": "Pediatrics, adolescent & family health",
  "Chronic Care & Expert Opinion": "Ongoing conditions & specialist review",
  "Eye, Ear & Bone": "Vision, hearing & orthopaedic care",
  "General & Everyday Care": "Primary care for everyday concerns",
  "Men's Health": "Health built around men's needs",
  "Mental Health": "Talk to a therapist or psychiatrist",
  "Sexual Health": "Confidential STI & sexual wellness care",
  "Skin & Hair": "Dermatology & hair loss treatment",
  "Travel & Global Care": "Pre-travel advice & global teleconsults",
  "Weight & Nutrition": "Diet plans & weight management",
  "Women's Health": "OB-GYN, hormones & women's wellness",
};

export default function Header() {
  const { user } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const pillRef = useRef(null);
  const navMenuRef = useRef(null);
  const helpWrapRef = useRef(null);
  const headerRef = useRef(null);

  const location = useLocation();

  const helpItems = [
    "Child & Family Care",
    "Chronic Care & Expert Opinion",
    "Eye, Ear & Bone",
    "General & Everyday Care",
    "Men's Health",
    "Mental Health",
    "Sexual Health",
    "Skin & Hair",
    "Travel & Global Care",
    "Weight & Nutrition",
    "Women's Health",
  ];

  /* Close menus on route change */
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    setHelpOpen(false);
  }, [location.pathname]);

  const navItems = [
    ...(location.pathname !== "/" ? [{ label: "Home", link: "/" }] : []),
    { label: "About Us", link: "/about-us" },
    { label: "Book Appointment", link: "/appointment-booking" },
    { label: "Corporates", link: "/corporates" },
    { label: "Blogs", link: "/blogs" },
  ];

  /* ==================== SCROLL ==================== */
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* ==================== PILL ==================== */
  const positionPill = useCallback((pill, navMenu, item) => {
    if (!pill || !navMenu || !item) return;
    const navRect = navMenu.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const relLeft = itemRect.left - navRect.left;
    pill.style.left = `${relLeft}px`;
    pill.style.width = `${itemRect.width}px`;
    pill.style.opacity = "1";
    pill.style.background = "rgba(255,255,255,.28)";
    pill.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,.55)";
    pill.style.border = "1px solid rgba(255,255,255,.38)";
  }, []);

  useEffect(() => {
    const pill = pillRef.current;
    const navMenu = navMenuRef.current;
    if (!pill || !navMenu) return;

    const items = Array.from(navMenu.querySelectorAll(".nav-item"));
    pill.style.transition = "none";
    pill.style.opacity = "0";
    requestAnimationFrame(() => {
      pill.style.transition = "";
    });

    const onEnter = (e) => {
      if (e.currentTarget.classList.contains("active")) {
        pill.style.opacity = "0";
        return;
      }
      positionPill(pill, navMenu, e.currentTarget);
    };
    const onLeave = () => {
      pill.style.opacity = "0";
    };
    const onResize = () => {
      pill.style.opacity = "0";
    };

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

    const tid = setTimeout(() => {
      document.addEventListener("mousedown", handleOutside);
      document.addEventListener("keydown", handleEsc);
    }, 0);

    return () => {
      clearTimeout(tid);
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [helpOpen]);

  /* ==================== HEADER HEIGHT ==================== */
  useEffect(() => {
    const updateHeaderHeight = () => {
      const el = headerRef.current;
      if (!el) return;
      const h = el.getBoundingClientRect().height;
      const gap = 12;
      el.style.setProperty("--header-h", `${Math.round(h + gap)}px`);
    };

    updateHeaderHeight();
    window.addEventListener("resize", updateHeaderHeight, { passive: true });
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
            <img
              src={logo}
              alt="Humancare Logo"
              className="logo-full"
              decoding="async"
            />
            <img
              src={miniLogo}
              alt="Humancare Mini Logo"
              className="logo-mini"
              decoding="async"
            />
          </Link>

          {/* CENTER GROUP — help slider + desktop nav, perfectly centered */}
          <div className="nav-center">
            {/* HELP SLIDER WRAP */}
            <div className="help-slider-wrap" ref={helpWrapRef}>
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
                <span className="help-label">GET HELP FOR</span>
                <div className="help-slide-wrapper">
                  <div
                    className={`help-slide-track ${helpOpen ? "paused" : ""}`}
                  >
                    {helpItems.map((item, i) => (
                      <span key={i} className="help-slide-item">
                        {item}
                      </span>
                    ))}
                    {/* Duplicate for seamless loop */}
                    {helpItems.map((item, i) => (
                      <span key={`d-${i}`} className="help-slide-item">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* HELP DROPDOWN */}
              {helpOpen && (
                <div
                  className="help-dropdown"
                  role="menu"
                  aria-label="Care categories"
                >
                  <p className="help-dropdown-heading">
                    Browse by Care Category
                  </p>
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
                            <span className="help-dropdown-desc">
                              {helpDesc[item]}
                            </span>
                          </span>
                          <span className="help-dropdown-arrow">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 14 14"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M3 7h8M7 3l4 4-4 4" />
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
          </div>
          {/* /nav-center */}

          {/* AUTH */}
          <div className="auth-buttons">
            {user ? (
              <Link to="/user/dashboard" className="profile-icon">
                <FaUserCircle />
              </Link>
            ) : (
              <div className="auth-combined magnetic">
                <Link to="/login" className="auth-link">
                  Login
                </Link>
                <span className="divider">/</span>
                <Link to="/login" className="auth-link">
                  Register
                </Link>
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
            <span />
            <span />
            <span />
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
