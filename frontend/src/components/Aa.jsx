import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import "./Aa.css";
import {
  motion as Motion,
  useScroll,
  useTransform,
  useSpring,
} from "framer-motion";

export default function SpecialtiesSection() {
  const [activeTab, setActiveTab] = useState("categories");
  const pillRef  = useRef(null);
  const tabRefs  = useRef([]);
  const wrapperRef = useRef(null);

  /* ── Sliding pill position ── */
  useEffect(() => {
    const pill = pillRef.current;
    const idx  = activeTab === "categories" ? 0 : activeTab === "specialties" ? 1 : 2;
    const tab  = tabRefs.current[idx];

    const updatePill = () => {
      if (pill && tab) {
        pill.style.width = tab.offsetWidth + "px";
        pill.style.left  = tab.offsetLeft  + "px";
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

  const scale   = useTransform(smoothProgress, [0, 1], [0.86, 1]);
  const opacity = useTransform(smoothProgress, [0, 0.3, 1], [0, 0.55, 1]);
  const y       = useTransform(smoothProgress, [0, 1], [56, 0]);

  const handleTabChange = (tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
  };

  const categories = [
    { img: "https://picsum.photos/seed/heart-care/400/260",     name: "Heart & Vascular", count: "52 doctors" },
    { img: "https://picsum.photos/seed/brain-health/400/260",   name: "Brain & Nerves",   count: "36 doctors" },
    { img: "https://picsum.photos/seed/mental-calm/400/260",    name: "Mental Wellness",  count: "76 doctors" },
    { img: "https://picsum.photos/seed/child-health/400/260",   name: "Child Health",     count: "41 doctors" },
    { img: "https://picsum.photos/seed/bones-joints/400/260",   name: "Bones & Joints",   count: "29 doctors" },
    { img: "https://picsum.photos/seed/lungs-breath/400/260",   name: "Respiratory",      count: "33 doctors" },
    { img: "https://picsum.photos/seed/women-health/400/260",   name: "Women's Health",   count: "44 doctors" },
    { img: "https://picsum.photos/seed/genetics-lab/400/260",   name: "Genetics & Labs",  count: "18 doctors" },
  ];

  const specialties = [
    { img: "https://picsum.photos/seed/cardiology-1/400/260",   name: "Cardiology",    count: "48 doctors" },
    { img: "https://picsum.photos/seed/neurology-2/400/260",    name: "Neurology",     count: "32 doctors" },
    { img: "https://picsum.photos/seed/mentalhealth-3/400/260", name: "Mental Health", count: "76 doctors" },
    { img: "https://picsum.photos/seed/pediatrics-4/400/260",   name: "Pediatrics",    count: "41 doctors" },
    { img: "https://picsum.photos/seed/orthopedics-5/400/260",  name: "Orthopedics",   count: "29 doctors" },
    { img: "https://picsum.photos/seed/ophthalmology-6/400/260",name: "Ophthalmology", count: "22 doctors" },
    { img: "https://picsum.photos/seed/primarycare-7/400/260",  name: "Primary Care",  count: "98 doctors" },
    { img: "https://picsum.photos/seed/dermatology-8/400/260",  name: "Dermatology",   count: "35 doctors" },
  ];

  const symptoms = [
    { img: "https://picsum.photos/seed/fever-symp/400/260",     name: "Fever",        count: "120 doctors" },
    { img: "https://picsum.photos/seed/headache-symp/400/260",  name: "Headache",     count: "95 doctors"  },
    { img: "https://picsum.photos/seed/cough-symp/400/260",     name: "Cold & Cough", count: "110 doctors" },
    { img: "https://picsum.photos/seed/chestpain-symp/400/260", name: "Chest Pain",   count: "60 doctors"  },
    { img: "https://picsum.photos/seed/jointpain-symp/400/260", name: "Joint Pain",   count: "70 doctors"  },
    { img: "https://picsum.photos/seed/eye-symp/400/260",       name: "Eye Problems", count: "40 doctors"  },
    { img: "https://picsum.photos/seed/stress-symp/400/260",    name: "Stress",       count: "85 doctors"  },
    { img: "https://picsum.photos/seed/skin-symp/400/260",      name: "Skin Issues",  count: "55 doctors"  },
  ];

  const data =
    activeTab === "categories"
      ? categories
      : activeTab === "specialties"
      ? specialties
      : symptoms;

  const ctaLink =
    activeTab === "categories"
      ? "/categories"
      : activeTab === "specialties"
      ? "/specialty"
      : "/symptoms";

  const ctaLabel =
    activeTab === "categories"
      ? "View All Categories"
      : activeTab === "specialties"
      ? "View All Specialties"
      : "View All Symptoms";

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
              className={`aa-tab${activeTab === "symptoms" ? " aa-tab-active" : ""}`}
              onClick={() => handleTabChange("symptoms")}
            >
              Symptoms
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