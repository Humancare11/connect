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
import cat1 from "../assets/HomeImageCategories/child-family-care-services.webp";
import cat2 from "../assets/HomeImageCategories/chronic-care-expert-medical-opinion.webp";
import cat3 from "../assets/HomeImageCategories/eye-ear-bone-specialty-care.webp";
import cat4 from "../assets/HomeImageCategories/general-everyday-healthcare-services.webp";
import cat5 from "../assets/HomeImageCategories/mens-health-wellness-services.webp";
import cat6 from "../assets/HomeImageCategories/womens-healthcare-services.webp";
import cat7 from "../assets/HomeImageCategories/sexual-health-treatment-services.webp";
import cat8 from "../assets/HomeImageCategories/mental-health-counseling-services.webp";

// specialties
import sp1 from "../assets/HeroImageSpecialities/adolescent-medicine-healthcare-services.webp";
import sp2 from "../assets/HeroImageSpecialities/pediatrics-child-healthcare-services.webp";
import sp3 from "../assets/HeroImageSpecialities/ent-ear-nose-throat-specialist.webp";
import sp4 from "../assets/HeroImageSpecialities/ophthalmology-eye-care-services.webp";
import sp5 from "../assets/HeroImageSpecialities/orthopedic-bone-joint-care.webp";
import sp6 from "../assets/HeroImageSpecialities/neurology-brain-and-nerve-care.webp";
import sp7 from "../assets/HeroImageSpecialities/behavioral-health-mental-wellness.webp"; // was imported but unused — now used
import sp8 from "../assets/HeroImageSpecialities/dermatology-skin-care-services.webp";

// conditions
import cod1 from "../assets/HomeImageConditions/fever-diagnosis-treatment-services.webp";
import cod2 from "../assets/HomeImageConditions/headache-treatment-medical-care.webp";
import cod3 from "../assets/HomeImageConditions/cold-cough-treatment-services.webp";
import cod4 from "../assets/HomeImageConditions/chest-pain-medical-evaluation.webp";
import cod5 from "../assets/HomeImageConditions/joint-pain-orthopedic-care.webp";
import cod6 from "../assets/HomeImageConditions/eye-problems-vision-care-services.webp";
import cod7 from "../assets/HomeImageConditions/stress-management-mental-wellness.webp";
import cod8 from "../assets/HomeImageConditions/skin-issues-dermatology-services.webp";

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
      alt: "Child and Family Care healthcare services for children and families",
      specialties: "2 Specialties",
      conditions: "8 Conditions",
      path: "/child-and-family-care",
    },
    {
      img: cat2,
      name: "Chronic Care ",
      alt: "Specialized chronic disease management and expert medical consultation services",
      specialties: "6 Specialties",
      conditions: "34 Conditions",
      path: "/chronic-care",
    },
    {
      img: cat3,
      name: "Eye Ear Bone",
      alt: "Eye care, ENT, and orthopedic healthcare services",
      specialties: "3 Specialties",
      conditions: "19 Conditions",
      path: "/eye-ear-bone",
    },
    {
      img: cat4,
      name: "General Everyday Care",
      alt: "Primary care and everyday healthcare services",
      name: "General & Everyday Care",
      specialties: "3 Specialties",
      conditions: "17 Conditions",
      path: "/general-and-everyday-care",
    },
    {
      img: cat5,
      name: "Men Health",
      alt: "Men's health services including preventive care, wellness, and treatment",
      name: "Men's Health",
      specialties: "2 Specialties",
      conditions: "10 Conditions",
      path: "/men-health",
    },
    {
      img: cat6,
      name: "Women Health",
      alt: "Women's healthcare services including wellness, reproductive, and preventive care",
      name: "Women's Health",
      specialties: "4 Specialties",
      conditions: "19 Conditions",
      path: "/women-health",
    },
    {
      img: cat7,
      name: "Sexual Health",
      alt: "Confidential sexual health services, STI care, and reproductive health support",
      specialties: "1 Specialties",
      conditions: "7 Conditions",
      path: "/sexual-health",
    },
    {
      img: cat8,
      name: "Mental Health",
      alt: "Mental health counseling, therapy, and emotional wellness support services",
      specialties: "3 Specialties",
      conditions: "17 Conditions",
      path: "/mental-health",
    },
  ];

  const specialties = [
    {
      img: sp1,
      name: "Adolescent Medicine",
      alt: "Adolescent medicine healthcare services for teenagers and young adults",
      conditions: "8 Conditions",
      path: "/child-and-family-care/adolescent-medicine",
    },
    {
      img: sp2,
      name: "Pediatrics",
      alt: "Pediatric healthcare services for infants children and adolescents",
      conditions: "32 Conditions",
      path: "/child-and-family-care/pediatrics",
    },
    {
      img: sp3,
      name: "Ear, Nose, Throat",
      alt: "ENT specialist services for ear nose and throat conditions",
      conditions: "7 Conditions",
      path: "/eye-ear-bone/ear-nose-throat",
    },
    {
      img: sp4,
      name: "Opthalmology",
      alt: "Ophthalmology services for eye care vision health and eye diseases",
      conditions: "6 Conditions",
      path: "/eye-ear-bone/ophthalmology",
    },
    {
      img: sp5,
      name: "Orthopedics",
      alt: "Orthopedic services for bone joint muscle and spine conditions",
      conditions: "6 Conditions",
      path: "/eye-ear-bone/orthopedics",
    },
    {
      img: sp6,
      name: "Family Medicine",
      alt: "Family Medicine specialists provide continuous, personalized healthcare for individuals and families of all ages",
      conditions: "3 Conditions",
      path: "/general-and-everyday-care/family-medicine",
    },
    {
      img: sp7,
      name: "Behaviorial Health",
      alt: "Behavioral health services for mental emotional and psychological wellness",
      conditions: "4 Conditions",
      path: "/mental-health/behavioral-health",
    },
    {
      img: sp8,
      name: "Dermatology",
      alt: "Dermatology services for skin hair and nail conditions",
      conditions: "12 Conditions",
      path: "/skin-and-hair-care/dermatology",
    },
  ];

  const condition = [
    {
      img: cod1,
      name: "Fever",
      alt: "Fever diagnosis and treatment services",
      count: "120 doctors",
      path: "/general-and-everyday-care/general-physician/fever",
    },
    {
      img: cod2,
      name: "Headache",
      alt: "Headache evaluation and treatment services",
      count: "95 doctors",
      path: "/general-and-everyday-care/general-physician/headache",
    },
    {
      img: cod3,
      name: "Cold & Flu",
      alt: "Fever, chills, cough, congestion, body aches, and fatigue caused by common viral infections.",
      count: "110 doctors",
      path: "/general-and-everyday-care/general-physician/cold-and-flu",
    },
    {
      img: cod4,
      name: "Chest Pain",
      alt: "Chest pain evaluation and medical care services",
      count: "60 doctors",
      path: "/chronic-care/cardiology/chest-pain",
    },
    {
      img: cod5,
      name: "Joint Pain",
      alt: "Joint pain diagnosis and orthopedic treatment services",
      count: "70 doctors",
      path: "/joint-pain",
    },
    {
      img: cod6,
      name: "Eye Strain",
      alt: "Eye strain diagnosis and vision care services",
      count: "40 doctors",
      path: "/eye-ear-bone/ophthalmology/eye-strain",
    },
    {
      img: cod7,
      name: "Stress",
      alt: "Stress management and mental wellness support services",
      count: "85 doctors",
      path: "/mental-health/psychology-counseling/stress",
    },
    {
      img: cod8,
      name: "Skin Rash",
      alt: "Red, itchy, irritated skin",
      count: "55 doctors",
      path: "/skin-and-hair-care/dermatology/skin-rash",
    },
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
            <h2 className="aa-title">
              Discover the Care That's Right for You.
            </h2>
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
                  <img
                    src={item.img}
                    alt={item.alt || item.name}
                    title={item.name}
                    loading="lazy"
                    width="400"
                    height="300"
                  />
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
