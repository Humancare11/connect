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
  const scale = useTransform(smooth, [0, 1], [0.87, 1]);
  const opacity = useTransform(smooth, [0, 0.3, 1], [0, 0.5, 1]);
  const y = useTransform(smooth, [0, 1], [56, 0]);

  /* ── inner reveal triggers ── */
  const leftRef = useRef(null);
  const leftInView = useInView(leftRef, { once: true, margin: "-80px" });

  const whyRef = useRef(null);
  const whyInView = useInView(whyRef, { once: true, margin: "-60px" });

  const visualRef = useRef(null);
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
              WHY HUMANCARE CONNECT
            </Motion.div>

            <Motion.h2
              className="section-title"
              variants={fadeUp(0.1)}
              initial="hidden"
              animate={leftInView ? "visible" : "hidden"}
              style={{ marginBottom: "34px" }}
            >
              Built on trust,<br />backed by real healthcare expertise.

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
                  <div className="why-item-title">HIPAA  Certified</div>
                  <div className="why-item-desc">
                    Your privacy comes first. Our secure telemedicine platform uses advanced encryption and compliance standards to protect every online doctor consultation, medical record, prescription, and patient interaction.
                  </div>
                </div>
              </Motion.div>

              <Motion.div className="why-item" variants={whyItemVariants}>
                <div>
                  <div className="why-item-title">Board-Certified Physicians Only</div>
                  <div className="why-item-desc">
                    Every provider on Humancare Connect is carefully credentialed and licensed to deliver trusted telehealth services, virtual healthcare consultations, and high-quality patient care across multiple specialties.

                  </div>
                </div>
              </Motion.div>

              <Motion.div className="why-item" variants={whyItemVariants}>
                <div>
                  <div className="why-item-title">Transparent, Flat-Fee Pricing</div>
                  <div className="why-item-desc">
                    No surprise medical bills or hidden costs. Get affordable telemedicine services, upfront pricing, and flexible online healthcare access with or without insurance coverage.

                  </div>
                </div>
              </Motion.div>

              <Motion.div className="why-item" variants={whyItemVariants}>
                <div>
                  <div className="why-item-title">24/7 Human Support
                  </div>
                  <div className="why-item-desc">
                    Talk to real people whenever you need help. Our support team is available around the clock to assist with online doctor appointments, prescriptions, virtual care coordination, and patient questions.

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
              <div className="sc-label">Healthcare That Puts You First</div>
              <div className="sc-big">94<span className="sc-percent">%</span></div>
              <div className="sc-sub">Simple. Secure. Accessible.</div>
              <div className="sc-divider" />
              <div className="sc-row">
                <span>Better Care Experiences</span>
                {/* <strong>98.2%</strong> */}
              </div>
              <div className="sc-prog">
                <div className="sc-fill" style={{ width: "98.2%" }} />
              </div>
              <div className="sc-row">
                <span> Seamless Consultations </span>
                {/* <strong>99.7%</strong> */}
              </div>
              <div className="sc-prog">
                <div className="sc-fill" style={{ width: "99.7%" }} />
              </div>
              <div className="sc-row">
                <span>Continuous Healthcare Support</span>
                {/* <strong>91.4%</strong> */}
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
              <div className="sf-label">ONLINE CARE 24/7</div>
              {/* <div className="sf-val" style={{ color: "#223a5e" }}>2.4M+</div> */}
            </Motion.div>

            {/* ── float 2 — bottom-left ── */}
            <Motion.div
              className="stat-float sf2"
              variants={fadeUp(0.32)}
              initial="hidden"
              animate={visualInView ? "visible" : "hidden"}
            >
              <div className="sf-label">Multiple Specialities</div>
              {/* <div className="sf-val" style={{ color: "#0c8b7a" }}>&lt;4 min</div> */}
            </Motion.div>

            {/* ── float 3 — mid-left ── */}
            <Motion.div
              className="stat-float sf3"
              variants={fadeUp(0.38)}
              initial="hidden"
              animate={visualInView ? "visible" : "hidden"}
            >
              <div className="sf-label">Same Day Appointments</div>
              {/* <div className="sf-val" style={{ color: "#d97706" }}>4.9 ★</div> */}
            </Motion.div>

            {/* ── float 4 — top-left ── */}
            <Motion.div
              className="stat-float sf4"
              variants={fadeUp(0.44)}
              initial="hidden"
              animate={visualInView ? "visible" : "hidden"}
            >
              <div className="sf-label" >LICENSED PROVIDERS VERIFIED</div>
              {/* <div className="sf-val" style={{ color: "#436dba" }}>1,200+</div> */}
            </Motion.div>

            {/* ── float 5 — bottom-right ── */}
            <Motion.div
              className="stat-float sf5"
              variants={fadeUp(0.50)}
              initial="hidden"
              animate={visualInView ? "visible" : "hidden"}
            >
              <div className="sf-label">Digital Prescriptions</div>
              {/* <div className="sf-val" style={{ color: "#0c8b7a" }}>97%</div> */}
            </Motion.div>

            {/* ── float 6 — mid-right ── */}
            <Motion.div
              className="stat-float sf6"
              variants={fadeUp(0.56)}
              initial="hidden"
              animate={visualInView ? "visible" : "hidden"}
            >
              <div className="sf-label"> Secure & Private Consultations
              </div>
              {/* <div className="sf-val" style={{ color: "#d97706" }}>98% +  </div> */}
            </Motion.div>

          </div>
        </div>
      </Motion.div>
    </div>
  );
}
