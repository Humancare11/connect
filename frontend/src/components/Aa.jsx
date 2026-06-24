import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import "./Aa.css";
import {
  motion as Motion,
  useScroll,
  useTransform,
  useSpring,
} from "framer-motion";

// categories
import cat1 from "../assets/CATEGORIES/1.png";
import cat2 from "../assets/CATEGORIES/2.png";
import cat3 from "../assets/CATEGORIES/3.png";
import cat4 from "../assets/CATEGORIES/4.png";
import cat5 from "../assets/CATEGORIES/5.png";
import cat6 from "../assets/CATEGORIES/6.png";

// specialties
import sp1 from "../assets/SPECIALITIES/1.png";
import sp2 from "../assets/SPECIALITIES/2.png";
import sp3 from "../assets/SPECIALITIES/3.png";
import sp4 from "../assets/SPECIALITIES/4.png";
import sp5 from "../assets/SPECIALITIES/5.png";
import sp6 from "../assets/SPECIALITIES/6.png";
import sp7 from "../assets/SPECIALITIES/7.png"; // was imported but unused — now used

// conditions
import cod1 from "../assets/CONDITIONS/1.png";
import cod2 from "../assets/CONDITIONS/2.png";
import cod3 from "../assets/CONDITIONS/3.png";
import cod4 from "../assets/CONDITIONS/4.png";
import cod5 from "../assets/CONDITIONS/5.png";
import cod6 from "../assets/CONDITIONS/6.png";
import cod7 from "../assets/CONDITIONS/7.png";
import cod8 from "../assets/CONDITIONS/8.png";

export default function SpecialtiesSection() {
  const [activeTab, setActiveTab] = useState("categories");
  const pillRef = useRef(null);
  const tabRefs = useRef([]);
  const wrapperRef = useRef(null);

  /* ── Sliding pill position ── */
  useEffect(() => {
    const pill = pillRef.current;
    const idx =
      activeTab === "categories" ? 0 : activeTab === "specialties" ? 1 : 2;
    const tab = tabRefs.current[idx];

    const updatePill = () => {
      if (pill && tab) {
        pill.style.width = tab.offsetWidth + "px";
        pill.style.left = tab.offsetLeft + "px";
      }
    };

    const raf = requestAnimationFrame(updatePill);
    const ro = new ResizeObserver(() => requestAnimationFrame(updatePill));
    if (pill && pill.parentElement) ro.observe(pill.parentElement);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [activeTab]);

  /* ── Scroll-driven card pop-up ── */
  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start end", "start 0.52"],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 70,
    damping: 18,
    restDelta: 0.001,
  });

  const scale = useTransform(smoothProgress, [0, 1], [0.86, 1]);
  const opacity = useTransform(smoothProgress, [0, 0.3, 1], [0, 0.55, 1]);
  const y = useTransform(smoothProgress, [0, 1], [56, 0]);

  const handleTabChange = (tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
  };

  const categories = [
    {
      img: cat1,
      name: "Child & Family Care",
      specialties: "2 Specialties",
      conditions: "8 Conditions",
      path: "/child-and-family-care",
    },
    {
      img: cat2,
      name: "Chronic Care & Expert Opinion",
      specialties: "6 Specialties",
      conditions: "34 Conditions",
      path: "/chronic-care-and-expert-opinion",
    },
    {
      img: cat3,
      name: "Eye Ear Bone",
      specialties: "3 Specialties",
      conditions: "19 Conditions",
      path: "/eye-ear-bone",
    },
    {
      img: cat4,
      name: "General & Everyday Care",
      specialties: "3 Specialties",
      conditions: "17 Conditions",
      path: "/general-and-everyday-care",
    },
    {
      img: cat5,
      name: "Men's Health",
      specialties: "2 Specialties",
      conditions: "10 Conditions",
      path: "/men-health",
    },
    {
      img: cat6,
      name: "Women's Health",
      specialties: "4 Specialties",
      conditions: "19 Conditions",
      path: "/women-health",
    },
    {
      img: cat1,
      name: "Sexual Health",
      specialties: "1 Specialties",
      conditions: "7 Conditions",
      path: "/categories-sexual-health",
    },
    {
      img: cat2,
      name: "Mental Health",
      specialties: "3 Specialties",
      conditions: "17 Conditions",
      path: "/mental-health",
    },
  ];

  const specialties = [
    {
      img: sp1,
      name: "Adolescent Medicine",
      conditions: "8 Conditions",
      path: "/adolescent-medicine",
    },
    {
      img: sp2,
      name: "Pediatrics",
      conditions: "32 Conditions",
      path: "/pediatrics",
    },
    {
      img: sp3,
      name: "Ear, Nose, Throat",
      conditions: "7 Conditions",
      path: "/ear-nose-throat",
    },
    {
      img: sp4,
      name: "Opthalmology",
      conditions: "6 Conditions",
      path: "/opthalmology",
    },
    {
      img: sp5,
      name: "Orthopedics",
      conditions: "6 Conditions",
      path: "/orthopedics",
    },
    {
      img: sp6,
      name: "Brain & Nerves",
      conditions: "32 Conditions",
      path: "/care/brain-and-nerves",
    },
    {
      img: sp7,
      name: "Behaviorial Health",
      conditions: "4 Conditions",
      path: "/cardiology",
    },
    {
      img: sp2,
      name: "Dermatology",
      conditions: "12 Conditions",
      path: "/dermatology",
    },
  ];

  const condition = [
    { img: cod1, name: "Fever", count: "120 doctors", path: "/fever" },
    { img: cod2, name: "Headache", count: "95 doctors", path: "/headache" },
    { img: cod3, name: "Cold & Cough", count: "110 doctors", path: "/cold-cough" },
    { img: cod4, name: "Chest Pain", count: "60 doctors", path: "/chest-pain" },
    { img: cod5, name: "Joint Pain", count: "70 doctors", path: "/joint-pain" },
    { img: cod6, name: "Eye Problems", count: "40 doctors", path: "/eye-problems" },
    { img: cod7, name: "Stress", count: "85 doctors", path: "/stress" },
    { img: cod8, name: "Skin Issues", count: "55 doctors", path: "/skin-issues" },
  ];

  const data =
    activeTab === "categories"
      ? categories
      : activeTab === "specialties"
        ? specialties
        : condition;

  const ctaLink =
    activeTab === "categories"
      ? "/categories"
      : activeTab === "specialties"
        ? "/specialties"
        : "/conditions";

  const ctaLabel =
    activeTab === "categories"
      ? "View All Categories"
      : activeTab === "specialties"
        ? "View All Specialties"
        : "View All Conditions";

  return (
    <Motion.section
      ref={wrapperRef}
      className="aa-section"
      id="specialties"
      style={{ scale, opacity, y }}
    >
      <div className="aa-container">

        {/* ── Header ── */}
        <div className="aa-header">
          <div className="aa-header-content">
            <span className="aa-eyebrow">Discover Care</span>
            <h2 className="aa-title">Discover the Care That's Right for You.</h2>
          </div>

          <div className="aa-tabs">
            <span className="aa-pill" ref={pillRef} />
            <button
              ref={(el) => (tabRefs.current[0] = el)}
              className={`aa-tab${activeTab === "categories" ? " aa-tab-active" : ""}`}
              onClick={() => handleTabChange("categories")}
            >
              Categories
            </button>
            <button
              ref={(el) => (tabRefs.current[1] = el)}
              className={`aa-tab${activeTab === "specialties" ? " aa-tab-active" : ""}`}
              onClick={() => handleTabChange("specialties")}
            >
              Specialties
            </button>
            <button
              ref={(el) => (tabRefs.current[2] = el)}
              className={`aa-tab${activeTab === "conditions" ? " aa-tab-active" : ""}`}
              onClick={() => handleTabChange("conditions")}
            >
              Conditions
            </button>
          </div>
        </div>

        {/* ── Grid ── */}
        <div className="aa-grid-wrapper">
          <div className="aa-grid">
            {data.map((item, index) => (
              // ✅ fix #1 — wrap card in Link so clicking navigates
              <Link
                to={item.path || "#"}
                className="aa-card"
                key={`${activeTab}-${index}`}
                style={{ animationDelay: `${index * 55}ms` }}
              >
                {/* Background image */}
                <div className="aa-card-img">
                  <img src={item.img} alt={item.name} loading="lazy" />
                </div>

                {/* Permanent dark gradient so text is always readable */}
                <div className="aa-card-gradient" />

                {/* Glass panel — slides up on hover */}
                {/* ✅ fix #3 — show correct fields per tab on hover panel */}
                <div className="aa-card-glass">
                  <h3 className="aa-name">{item.name}</h3>
                  <div className="aa-count-wrap">
                    {activeTab === "conditions" ? (
                      <p className="aa-count">{item.count}</p>
                    ) : (
                      <>
                        <p className="aa-count">{item.specialties}</p>
                        <p className="aa-count">{item.conditions}</p>
                      </>
                    )}
                  </div>
                </div>

                {/* ✅ fix #2 + #6 — resting body: show name + correct meta field only */}
                <div className="aa-card-body">
                  <h3 className="aa-name">{item.name}</h3>
                  {activeTab === "conditions" ? (
                    <p className="aa-count">{item.count}</p>
                  ) : (
                    <p className="aa-count">{item.conditions}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── CTA button ── */}
        <div className="aa-bottom-btn-wrap">
          <Link to={ctaLink} className="aa-bottom-btn">
            <span>{ctaLabel}</span>
            <span className="aa-btn-arrow">→</span>
          </Link>
        </div>

      </div>
    </Motion.section>
  );
}