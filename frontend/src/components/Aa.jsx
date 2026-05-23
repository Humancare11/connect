import { useState, useEffect, useRef } from "react";
import "./Aa.css";
import {
  FaHeartbeat,
  FaBrain,
  FaLeaf,
  FaChild,
  FaBone,
  FaEye,
  FaStethoscope,
  FaPills,
  FaThermometerHalf,
  FaHeadSideCough,
  FaLungsVirus,
  FaHeartBroken,
  FaWalking,
  FaBandAid,
} from "react-icons/fa";

import { motion, AnimatePresence } from "framer-motion";

export default function SpecialtiesSection() {
  const [activeTab, setActiveTab] = useState("specialties");
  const [direction, setDirection] = useState(0); // 1 for forward, -1 for backward
  const pillRef = useRef(null);
  const tabRefs = useRef([]);

  // Pill animation effect
  useEffect(() => {
    const pill = pillRef.current;
    const currentIndex = activeTab === "specialties" ? 0 : 1;
    const currentTab = tabRefs.current[currentIndex];

    if (pill && currentTab) {
      pill.style.width = currentTab.offsetWidth + "px";
      pill.style.left = currentTab.offsetLeft + "px";
    }
  }, [activeTab]);

  const handleTabChange = (tab) => {
    if (tab === activeTab) return;
    setDirection(tab === "symptoms" ? 1 : -1);
    setActiveTab(tab);
  };

  const specialties = [
    { icon: FaHeartbeat, name: "Cardiology", count: "48 doctors" },
    { icon: FaBrain, name: "Neurology", count: "32 doctors" },
    { icon: FaLeaf, name: "Mental Health", count: "76 doctors" },
    { icon: FaChild, name: "Pediatrics", count: "41 doctors" },
    { icon: FaBone, name: "Orthopedics", count: "29 doctors" },
    { icon: FaEye, name: "Ophthalmology", count: "22 doctors" },
    { icon: FaStethoscope, name: "Primary Care", count: "98 doctors" },
    { icon: FaPills, name: "Dermatology", count: "35 doctors" },
  ];

  const symptoms = [
    { icon: FaThermometerHalf, name: "Fever", count: "120 doctors" },
    { icon: FaHeadSideCough, name: "Headache", count: "95 doctors" },
    { icon: FaLungsVirus, name: "Cold & Cough", count: "110 doctors" },
    { icon: FaHeartBroken, name: "Chest Pain", count: "60 doctors" },
    { icon: FaWalking, name: "Joint Pain", count: "70 doctors" },
    { icon: FaEye, name: "Eye Problems", count: "40 doctors" },
    { icon: FaBrain, name: "Stress", count: "85 doctors" },
    { icon: FaBandAid, name: "Skin Issues", count: "55 doctors" },
  ];

  const data = activeTab === "specialties" ? specialties : symptoms;

  // Slider transition variants
  const variants = {
    enter: (dir) => ({
      x: dir > 0 ? "100%" : "-100%",
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        x: { duration: 0.6, ease: [0.23, 1, 0.32, 1] },
        opacity: { duration: 0.4 },
      },
    },
    exit: (dir) => ({
      x: dir > 0 ? "-100%" : "100%",
      opacity: 0,
      transition: {
        x: { duration: 0.6, ease: [0.23, 1, 0.32, 1] },
        opacity: { duration: 0.4 },
      },
    }),
  };

  return (
    <section className="aa-section" id="specialties">
      <div className="aa-container">
        <div className="aa-header">
          <div className="aa-header-content">
            <span className="aa-eyebrow">Discover Specialties</span>
            <h2 className="aa-title">Care for every part of you.</h2>
          </div>
          
          <div className="aa-tabs">
            <span className="aa-pill" ref={pillRef}></span>
            <button
              ref={(el) => (tabRefs.current[0] = el)}
              className={`aa-tab ${activeTab === "specialties" ? "aa-tab-active" : ""}`}
              onClick={() => handleTabChange("specialties")}
            >
              Specialties
            </button>
            <button
              ref={(el) => (tabRefs.current[1] = el)}
              className={`aa-tab ${activeTab === "symptoms" ? "aa-tab-active" : ""}`}
              onClick={() => handleTabChange("symptoms")}
            >
              Symptoms
            </button>
          </div>
        </div>

        <div className="aa-grid-wrapper" style={{ position: "relative" }}>
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div
              key={activeTab}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              className="aa-grid"
              style={{ position: "absolute", top: 0, left: 0, width: "100%" }}
            >
              {data.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div className="aa-card" key={`${activeTab}-${index}`}>
                    <div className="aa-icon">
                      <Icon />
                    </div>
                    <h3 className="aa-name">{item.name}</h3>
                    <p className="aa-count">{item.count}</p>
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
