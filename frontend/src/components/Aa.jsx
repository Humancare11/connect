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

// specilities
import sp1 from "../assets/SPECIALITIES/1.png";
import sp2 from "../assets/SPECIALITIES/2.png";
import sp3 from "../assets/SPECIALITIES/3.png";
import sp4 from "../assets/SPECIALITIES/4.png";
import sp5 from "../assets/SPECIALITIES/5.png";
import sp6 from "../assets/SPECIALITIES/6.png";
import sp7 from "../assets/SPECIALITIES/7.png";

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
    const idx = activeTab === "categories" ? 0 : activeTab === "specialties" ? 1 : 2;
    const tab = tabRefs.current[idx];

    const updatePill = () => {
      if (pill && tab) {
        pill.style.width = tab.offsetWidth + "px";
        pill.style.left = tab.offsetLeft + "px";
      }
    };

    // rAF ensures the DOM has reflowed (critical on mobile where tabs go full-width)
    const raf = requestAnimationFrame(updatePill);

    // ResizeObserver keeps pill in sync if the tab bar changes width (orientation change, resize)
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
  { img: cat1, name: "Heart & Vascular", count: "52 doctors" },
  { img: cat2, name: "Brain & Nerves", count: "36 doctors" },
  { img: cat3, name: "Mental Wellness", count: "76 doctors" },
  { img: cat4, name: "Child Health", count: "41 doctors" },
  { img: cat5, name: "Bones & Joints", count: "29 doctors" },
  { img: cat6, name: "Respiratory", count: "33 doctors" },
  { img: cat1, name: "Women's Health", count: "44 doctors" },
  { img: cat2, name: "Genetics & Labs", count: "18 doctors" },
];

const specialties = [
  { img: sp1, name: "Primary Care", count: "48 doctors", path: "/primary-care" },
  { img: sp2, name: "Neurology", count: "32 doctors" },
  { img: sp3, name: "Mental Health", count: "76 doctors" },
  { img: sp4, name: "Pediatrics", count: "41 doctors" },
  { img: sp5, name: "Orthopedics", count: "29 doctors" },
  { img: sp6, name: "Ophthalmology", count: "22 doctors" },
  { img: sp7, name: "Cardiology", count: "98 doctors" },

  { img: cod8, name: "Dermatology", count: "35 doctors" },
];

const condition = [
  { img: cod1, name: "Fever", count: "120 doctors" },
  { img: cod2, name: "Headache", count: "95 doctors" },
  { img: cod3, name: "Cold & Cough", count: "110 doctors" },
  { img: cod4, name: "Chest Pain", count: "60 doctors" },
  { img: cod5, name: "Joint Pain", count: "70 doctors" },
  { img: cod6, name: "Eye Problems", count: "40 doctors" },
  { img: cod7, name: "Stress", count: "85 doctors" },
  { img: cod8, name: "Skin Issues", count: "55 doctors" },
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
            <span className="aa-eyebrow">Discover Specialties</span>
            <h2 className="aa-title">Care for every part of you.</h2>
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
              <div
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
                <div className="aa-card-glass">
                  <h3 className="aa-name">{item.name}</h3>
                  <p className="aa-count">{item.count}</p>
                </div>

                {/* Resting text — always visible, fades out on hover */}
                <div className="aa-card-body">
                  <h3 className="aa-name">{item.name}</h3>
                  <p className="aa-count">{item.count}</p>
                </div>
              </div>
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