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
  const [direction, setDirection] = useState(0); // 1 for forward (L->R), -1 for backward (R->L)
  const [hovered, setHovered] = useState(null);
  const pillRef = useRef(null);
  const tabRefs = useRef([]);

  // Pill animation effect
  useEffect(() => {
    const pill = pillRef.current;
    const currentIndex =
      hovered !== null ? hovered : activeTab === "specialties" ? 0 : 1;
    const currentTab = tabRefs.current[currentIndex];

    if (pill && currentTab) {
      pill.style.width = currentTab.offsetWidth + "px";
      pill.style.left = currentTab.offsetLeft + "px";
    }
  }, [activeTab, hovered]);

  const handleTabChange = (tab) => {
    if (tab === "symptoms" && activeTab === "specialties") {
      setDirection(1); // Moving forward, slide left
    } else if (tab === "specialties" && activeTab === "symptoms") {
      setDirection(-1); // Moving backward, slide right
    }
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

  // Framer Motion Variants - Mobile App Slide Effect
  const slideVariants = {
    enter: (direction) => ({
      x: direction > 0 ? 400 : -400,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1],
      },
    },
    exit: (direction) => ({
      x: direction > 0 ? -400 : 400,
      opacity: 0,
      transition: {
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1],
      },
    }),
  };

  return (
    <section className="aa-section" id="specialties">
      <div className="aa-container">
        <div className="aa-header">
          <div>
            <div className="aa-eyebrow">SPECIALTIES</div>
            <h2 className="aa-title">Care for every part of you.</h2>
            <div className="aa-tabs" onMouseLeave={() => setHovered(null)}>
              <span className="aa-pill" ref={pillRef}></span>
              <button
                ref={(el) => (tabRefs.current[0] = el)}
                className={`aa-tab ${
                  activeTab === "specialties" ? "aa-tab-active" : ""
                } ${hovered === 0 ? "aa-tab-hovered" : ""} ${
                  hovered !== null && hovered !== 0 ? "aa-tab-inactive" : ""
                }`}
                onClick={() => handleTabChange("specialties")}
                onMouseEnter={() => setHovered(0)}
              >
                Specialties
              </button>
              <button
                ref={(el) => (tabRefs.current[1] = el)}
                className={`aa-tab ${
                  activeTab === "symptoms" ? "aa-tab-active" : ""
                } ${hovered === 1 ? "aa-tab-hovered" : ""} ${
                  hovered !== null && hovered !== 1 ? "aa-tab-inactive" : ""
                }`}
                onClick={() => handleTabChange("symptoms")}
                onMouseEnter={() => setHovered(1)}
              >
                Symptoms
              </button>
            </div>
          </div>
        </div>

        <div className="aa-grid-wrapper">
          <AnimatePresence mode="sync" initial={false} custom={direction}>
            <motion.div
              key={activeTab}
              className="aa-grid"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              {data.map((item, index) => {
                const Icon = item.icon;

                return (
                  <motion.div
                    className="aa-card"
                    key={`${activeTab}-${index}`}
                    whileHover={{
                      y: -8,
                      transition: { duration: 0.1, ease: "easeOut" },
                    }}
                  >
                    <motion.span
                      className="aa-icon"
                      whileHover={{
                        scale: 1.15,
                        rotate: [0, -5, 5, 0],
                        transition: { duration: 0.3 },
                      }}
                    >
                      <Icon />
                    </motion.span>
                    <span className="aa-name">{item.name}</span>
                    <span className="aa-count">{item.count}</span>
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
