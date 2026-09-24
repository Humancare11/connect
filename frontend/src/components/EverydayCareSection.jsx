import React, { useRef } from "react";
import { Link } from "react-router-dom";
import "./EverydayCareSection.css";
import { motion as Motion, useInView } from "framer-motion";

import gpImage from "../assets/SpecialitiesImage/general-physician-patient-health-checkup.webp";
import pediaImage from "../assets/SpecialitiesImage/pediatric-specialist-child-health-checkup-consultation.webp";

/* ── Animation Variants ── */
const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      ease: [0.22, 1, 0.36, 1],
      delay,
    },
  },
});

export default function EverydayCareSection() {
  const headerRef = useRef(null);
  const gridRef = useRef(null);

  const headerInView = useInView(headerRef, { once: true, margin: "-60px" });
  const gridInView = useInView(gridRef, { once: true, margin: "-60px" });

  return (
    <section className="ecs-section">
      <div className="ecs-container">
        {/* ── Section Header ── */}
        <div className="ecs-header" ref={headerRef}>
          <Motion.div
            className="ecs-eyebrow"
            variants={fadeUp(0)}
            initial="hidden"
            animate={headerInView ? "visible" : "hidden"}
          >
            <span className="ecs-eyebrow-dot" />
            EVERYDAY & PEDIATRIC CARE
          </Motion.div>

          <Motion.h2
            className="ecs-title"
            variants={fadeUp(0.1)}
            initial="hidden"
            animate={headerInView ? "visible" : "hidden"}
          >
            The Care You Need, All in One Place
          </Motion.h2>

          <Motion.p
            className="ecs-subtitle"
            variants={fadeUp(0.2)}
            initial="hidden"
            animate={headerInView ? "visible" : "hidden"}
          >
            Everyday healthcare and pediatric care, made more accessible through
            Humancare Connect.
          </Motion.p>
        </div>

        {/* ── 2-Column Banner Cards Grid ── */}
        <div className="ecs-grid" ref={gridRef}>
          {/* ── Card 1: General Practitioner ── */}
          <Motion.div
            variants={fadeUp(0.12)}
            initial="hidden"
            animate={gridInView ? "visible" : "hidden"}
          >
            <Link
              to="/general-and-everyday-care/general-physician"
              className="ecs-card-link"
              aria-label="Find Your General Practitioner for everyday care"
            >
              <div className="ecs-card ecs-card--gp">
                {/* Background image & gradient overlay */}
                <div className="ecs-card-bg-wrap">
                  <img
                    src={gpImage}
                    alt="General Practitioner doctor consultation"
                    className="ecs-card-bg-img"
                    loading="lazy"
                  />
                </div>
                <div className="ecs-card-gradient-overlay" />

                {/* Card Content Left */}
                <div className="ecs-card-content">
                  <div className="ecs-card-body">
                    <span className="ecs-card-badge">
                      <span className="ecs-card-badge-dot" />
                      General Practitioner
                    </span>
                    <h3 className="ecs-card-title">
                      <span className="text-white">Everyday Care</span>
                      <span className="text-accent">Starts Here</span>
                    </h3>
                    <p className="ecs-card-desc">
                      Get convenient access to a qualified General Practitioner
                      for routine healthcare, medical concerns, and personalized
                      guidance.
                    </p>
                  </div>

                  <div className="ecs-card-footer">
                    <span className="ecs-card-cta">
                      Find Your General Practitioner
                      <span className="ecs-card-cta-arrow">→</span>
                    </span>
                  </div>
                </div>

                {/* Corner Arrow Icon */}
                <div className="ecs-corner-arrow" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            </Link>
          </Motion.div>

          {/* ── Card 2: Pediatrics ── */}
          <Motion.div
            variants={fadeUp(0.24)}
            initial="hidden"
            animate={gridInView ? "visible" : "hidden"}
          >
            <Link
              to="/child-and-family-care/pediatrics"
              className="ecs-card-link"
              aria-label="Find a Pediatrician for your child"
            >
              <div className="ecs-card ecs-card--pedia">
                {/* Background image & gradient overlay */}
                <div className="ecs-card-bg-wrap">
                  <img
                    src={pediaImage}
                    alt="Pediatrician examining a child patient"
                    className="ecs-card-bg-img"
                    loading="lazy"
                  />
                </div>
                <div className="ecs-card-gradient-overlay" />

                {/* Card Content Left */}
                <div className="ecs-card-content">
                  <div className="ecs-card-body">
                    <span className="ecs-card-badge">
                      <span className="ecs-card-badge-dot" />
                      Pediatrics
                    </span>
                    <h3 className="ecs-card-title">
                      <span className="text-accent">Expert Care</span>
                      <span className="text-white">for Your Child</span>
                    </h3>
                    <p className="ecs-card-desc">
                      Find the right pediatric care for your child, from routine
                      checkups to common childhood concerns.
                    </p>
                  </div>

                  <div className="ecs-card-footer">
                    <span className="ecs-card-cta">
                      Find a Pediatrician
                      <span className="ecs-card-cta-arrow">→</span>
                    </span>
                  </div>
                </div>

                {/* Corner Arrow Icon */}
                <div className="ecs-corner-arrow" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            </Link>
          </Motion.div>
        </div>
      </div>
    </section>
  );
}
