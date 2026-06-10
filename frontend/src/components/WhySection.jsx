import { useRef } from "react";
import { motion as Motion, useScroll, useTransform, useSpring, useInView } from "framer-motion";
import "./WhySection.css";

/* ── animation variants ── */
const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay },
  },
});

const whyListVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const whyItemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function WhySection() {
  /* ── scroll-driven container pop-up ── */
  const wrapperRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start end", "start 0.52"],
  });
  const smooth = useSpring(scrollYProgress, { stiffness: 75, damping: 18, restDelta: 0.001 });
  const scale   = useTransform(smooth, [0, 1], [0.87, 1]);
  const opacity = useTransform(smooth, [0, 0.3, 1], [0, 0.5, 1]);
  const y       = useTransform(smooth, [0, 1], [56, 0]);

  /* ── inner reveal triggers ── */
  const leftRef  = useRef(null);
  const leftInView = useInView(leftRef, { once: true, margin: "-80px" });

  const whyRef  = useRef(null);
  const whyInView = useInView(whyRef, { once: true, margin: "-60px" });

  const visualRef  = useRef(null);
  const visualInView = useInView(visualRef, { once: true, margin: "-60px" });

  return (
    <div className="why-section-container">
      <Motion.div
        className="why-section"
        id="why"
        ref={wrapperRef}
        style={{ scale, opacity, y }}
      >
        <div className="why-grid">

          {/* ════ LEFT — eyebrow + title + list ════ */}
          <div className="why-left" ref={leftRef}>

            <Motion.div
              className="section-eyebrow"
              variants={fadeUp(0)}
              initial="hidden"
              animate={leftInView ? "visible" : "hidden"}
            >
              Why Humancare
            </Motion.div>

            <Motion.h2
              className="section-title"
              variants={fadeUp(0.1)}
              initial="hidden"
              animate={leftInView ? "visible" : "hidden"}
              style={{ marginBottom: "34px" }}
            >
              Built on trust,<br />at every step.
            </Motion.h2>

            <Motion.div
              className="why-list"
              ref={whyRef}
              variants={whyListVariants}
              initial="hidden"
              animate={whyInView ? "visible" : "hidden"}
            >
              <Motion.div className="why-item" variants={whyItemVariants}>
                <div>
                  <div className="why-item-title">HIPAA &amp; SOC 2 Certified</div>
                  <div className="why-item-desc">
                    End-to-end encryption on every visit, message, and record.
                    Your health data never leaves our secure, audited infrastructure.
                  </div>
                </div>
              </Motion.div>

              <Motion.div className="why-item" variants={whyItemVariants}>
                <div>
                  <div className="why-item-title">Board-Certified Physicians Only</div>
                  <div className="why-item-desc">
                    Every doctor clears a rigorous 9-step credentialing process —
                    state licensure, malpractice history, peer reviews, and ongoing audits.
                  </div>
                </div>
              </Motion.div>

              <Motion.div className="why-item" variants={whyItemVariants}>
                <div>
                  <div className="why-item-title">Transparent, Flat-Fee Pricing</div>
                  <div className="why-item-desc">
                    No surprise bills. See the exact cost before booking. Most major
                    insurance plans accepted, or a flat $49 uninsured rate.
                  </div>
                </div>
              </Motion.div>

              <Motion.div className="why-item" variants={whyItemVariants}>
                <div>
                  <div className="why-item-title">24 / 7 Human Support</div>
                  <div className="why-item-desc">
                    Real people — by chat, phone, or video — available around the clock
                    for urgent questions, escalations, and care coordination.
                  </div>
                </div>
              </Motion.div>
            </Motion.div>
          </div>

          {/* ════ RIGHT — visual stat cards ════ */}
          <div className="why-visual" ref={visualRef}>

            {/* ── centre card ── */}
            <Motion.div
              className="stat-card-main"
              variants={fadeUp(0.15)}
              initial="hidden"
              animate={visualInView ? "visible" : "hidden"}
            >
              <div className="sc-label">Patient outcome improvement</div>
              <div className="sc-big">94<span className="sc-percent">%</span></div>
              <div className="sc-sub">After 3 months on Humancare</div>
              <div className="sc-divider" />
              <div className="sc-row">
                <span>Visit completion rate</span>
                <strong>98.2%</strong>
              </div>
              <div className="sc-prog">
                <div className="sc-fill" style={{ width: "98.2%" }} />
              </div>
              <div className="sc-row">
                <span>Prescription accuracy</span>
                <strong>99.7%</strong>
              </div>
              <div className="sc-prog">
                <div className="sc-fill" style={{ width: "99.7%" }} />
              </div>
              <div className="sc-row">
                <span>Same-day appointments</span>
                <strong>91.4%</strong>
              </div>
              <div className="sc-prog">
                <div className="sc-fill" style={{ width: "91.4%" }} />
              </div>
            </Motion.div>

            {/* ── float 1 — top-right ── */}
            <Motion.div
              className="stat-float sf1"
              variants={fadeUp(0.25)}
              initial="hidden"
              animate={visualInView ? "visible" : "hidden"}
            >
              <div className="sf-label">Patients served</div>
              <div className="sf-val" style={{ color: "#223a5e" }}>2.4M+</div>
            </Motion.div>

            {/* ── float 2 — bottom-left ── */}
            <Motion.div
              className="stat-float sf2"
              variants={fadeUp(0.32)}
              initial="hidden"
              animate={visualInView ? "visible" : "hidden"}
            >
              <div className="sf-label">Avg. response</div>
              <div className="sf-val" style={{ color: "#0c8b7a" }}>&lt;4 min</div>
            </Motion.div>

            {/* ── float 3 — mid-left ── */}
            <Motion.div
              className="stat-float sf3"
              variants={fadeUp(0.38)}
              initial="hidden"
              animate={visualInView ? "visible" : "hidden"}
            >
              <div className="sf-label">Rating</div>
              <div className="sf-val" style={{ color: "#d97706" }}>4.9 ★</div>
            </Motion.div>

            {/* ── float 4 — top-left ── */}
            <Motion.div
              className="stat-float sf4"
              variants={fadeUp(0.44)}
              initial="hidden"
              animate={visualInView ? "visible" : "hidden"}
            >
              <div className="sf-label">Doctors online</div>
              <div className="sf-val" style={{ color: "#436dba" }}>1,200+</div>
            </Motion.div>

            {/* ── float 5 — bottom-right ── */}
            <Motion.div
              className="stat-float sf5"
              variants={fadeUp(0.50)}
              initial="hidden"
              animate={visualInView ? "visible" : "hidden"}
            >
              <div className="sf-label">Satisfaction</div>
              <div className="sf-val" style={{ color: "#0c8b7a" }}>97%</div>
            </Motion.div>

            {/* ── float 6 — mid-right ── */}
            <Motion.div
              className="stat-float sf6"
              variants={fadeUp(0.56)}
              initial="hidden"
              animate={visualInView ? "visible" : "hidden"}
            >
              <div className="sf-label">Rating</div>
              <div className="sf-val" style={{ color: "#d97706" }}>4.9 ★</div>
            </Motion.div>

          </div>
        </div>
      </Motion.div>
    </div>
  );
}
