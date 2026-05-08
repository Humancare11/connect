import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./header.css";
import { Link } from "react-router-dom";
import { FaUserCircle } from "react-icons/fa"; // ✅ ADD ICON



export default function Header() {
  const pillRef = useRef(null);
  const itemRefs = useRef([]);
  const location = useLocation();
  const navigate = useNavigate();

  const [hovered, setHovered] = useState(null);
  const [active, setActive] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const navItems = [
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
  }, [location]);

  // ✅ AUTO ACTIVE BASED ON URL
  useEffect(() => {
    const index = navItems.findIndex(
      (item) => item.link === location.pathname
    );
    if (index !== -1) {
      setActive(index);
    }
  }, [location.pathname]);

  const currentIndex = hovered !== null ? hovered : active;

  useEffect(() => {
    const pill = pillRef.current;
    const currentItem = itemRefs.current[currentIndex];

    if (pill && currentItem) {
      pill.style.width = currentItem.offsetWidth + "px";
      pill.style.left = currentItem.offsetLeft + "px";
    }
  }, [currentIndex]);

  // ✅ Logout function
  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsLoggedIn(false);
    navigate("/");
  };

  return (
    <header className="glass-header">
      <div className="nav-container">

        <a href="/">
          <div className="logo">Humancare</div>
        </a>

        <nav
          className="nav-menu"
          onMouseLeave={() => setHovered(null)}
        >
          <span className="pill" ref={pillRef}></span>

          {navItems.map((item, index) => (
            <a
              key={index}
              href={item.link}
              ref={(el) => (itemRefs.current[index] = el)}
              className={`nav-item ${currentIndex === index ? "active" : ""
                }`}
              onMouseEnter={() => setHovered(index)}
              onClick={() => setActive(index)}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* 🔥 AUTH BUTTONS */}
        <div className="auth-buttons">
          {!isLoggedIn ? (
            <div className="auth-combined">
              <Link to="/login" className="auth-link">Login</Link>
              <span className="divider">/</span>
              <Link to="/register" className="auth-link">Register</Link>
            </div>
          ) : (
            <Link to="/profile" className="profile-icon">
              <FaUserCircle />
            </Link>
          )}
        </div>

      </div>
    </header>
  );
}