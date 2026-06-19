import { useRef } from "react";
import "./PCPSection.css";
import {
  motion as Motion,
  useScroll,
  useTransform,
  useSpring,
  useInView,
} from "framer-motion";

/* ─────────────────────────────────────────
   Shared animation variants
───────────────────────────────────────── */
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

const fadeLeft = (delay = 0) => ({
  hidden: { opacity: 0, x: 40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
      delay,
    },
  },
});

const scaleIn = (delay = 0) => ({
  hidden: { opacity: 0, scale: 0.88 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.6,
      ease: [0.34, 1.4, 0.64, 1],
      delay,
    },
  },
});

/* ─────────────────────────────────────────
   AnimBlock — triggers fadeUp when in view
───────────────────────────────────────── */
function AnimBlock({ children, variant, className, style }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <Motion.div
      ref={ref}
      className={className}
      style={style}
      variants={variant}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
    >
      {children}
    </Motion.div>
  );
}

/* ─────────────────────────────────────────
   Steps data
───────────────────────────────────────── */
const STEPS = [
  { n: 1, title: "Create your free account",   desc: "Under 2 minutes. No credit card required." },
  { n: 2, title: "Complete a health intake",    desc: "Share your medical history and current medications." },
  { n: 3, title: "Match with a provider",       desc: "We surface the best-fit doctor for your needs and state." },
  { n: 4, title: "Start your video visit",      desc: "Meet face-to-face from anywhere, on any device." },
  { n: 5, title: "Receive care instantly",      desc: "Prescription sent to your pharmacy within minutes." },
];

/* ─────────────────────────────────────────
   Component
───────────────────────────────────────── */
export default function PCPSection() {
  /* ── Scroll-driven container pop-up ── */
  const wrapperRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start end", "start 0.52"],
  });
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 75,
    damping: 18,
    restDelta: 0.001,
  });
  const scale   = useTransform(smoothProgress, [0, 1], [0.87, 1]);
  const opacity = useTransform(smoothProgress, [0, 0.3, 1], [0, 0.5, 1]);
  const y       = useTransform(smoothProgress, [0, 1], [56, 0]);

  /* ── Left / right column inView triggers ── */
  const leftRef  = useRef(null);
  const rightRef = useRef(null);
  const leftInView  = useInView(leftRef,  { once: true, margin: "-80px" });
  const rightInView = useInView(rightRef, { once: true, margin: "-80px" });

  return (
    <Motion.section
      className="pcp-section"
      ref={wrapperRef}
      style={{ scale, opacity, y }}
    >
      <div className="pcp-container">

        {/* ════════════ LEFT CONTENT ════════════ */}
        <div className="pcp-left" ref={leftRef}>

          <Motion.div
            className="pcp-badge"
            variants={fadeUp(0)}
            initial="hidden"
            animate={leftInView ? "visible" : "hidden"}
          >
            NO PCP? NO PROBLEM.

          </Motion.div>

          <Motion.h2
            className="pcp-title"
            variants={fadeUp(0.1)}
            initial="hidden"
            animate={leftInView ? "visible" : "hidden"}
          >
           Don’t have a primary care doctor?
            <span>We've got you.</span>
          </Motion.h2>

          <Motion.p
            className="pcp-desc"
            variants={fadeUp(0.2)}
            initial="hidden"
            animate={leftInView ? "visible" : "hidden"}
          >
           Whether you’re between doctors, new to an area, or simply can’t get an appointment soon enough, Humancare Connect gives you fast access to licensed providers for the care you need today, without the long wait.

          </Motion.p>

          <div className="pcp-features">
            {[
              {
                n: "01",
                title: "Get Care Today",
                desc: "Skip the long wait times. Connect with a licensed provider the same day for everyday health concerns and quick medical support.",
              },
              {
                n: "02",
                title: "Handle Everyday Health Needs",
                desc: "Prescription refills, lab orders, specialist referrals, and quick consultations — all in one convenient place.",
              },
              {
                n: "03",
                title: "365 Days a Year",
                desc: "Your health doesn’t wait, and neither do we. Get care when you need it — including evenings, weekends, and holidays.",
              },
            ].map((f, i) => (
              <Motion.div
                key={f.n}
                className="pcp-feature-card"
                variants={fadeUp(0.3 + i * 0.12)}
                initial="hidden"
                animate={leftInView ? "visible" : "hidden"}
                whileHover={{ y: -6, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }}
              >
                <div className="pcp-icon">{f.n}</div>
                <div>
                  <h4>{f.title}</h4>
                  <p>{f.desc}</p>
                </div>
              </Motion.div>
            ))}
          </div>
        </div>

        {/* ════════════ RIGHT SIDE ════════════ */}
        <div className="pcp-right" ref={rightRef}>

          {/* Image stack — hidden on tablet/mobile via CSS */}
          <div className="pcp-image-stack">
            <Motion.img
              src="https://images.unsplash.com/photo-1584515933487-779824d29309?q=80&w=1200&auto=format&fit=crop"
              alt=""
              className="pcp-img-main"
              variants={scaleIn(0.15)}
              initial="hidden"
              animate={rightInView ? "visible" : "hidden"}
              whileInView={{ opacity: 1 }}
              style={{ originX: 1, originY: 0 }}
            />
            <Motion.img
              src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=1200&auto=format&fit=crop"
              alt=""
              className="pcp-img-small"
              variants={scaleIn(0.3)}
              initial="hidden"
              animate={rightInView ? "visible" : "hidden"}
              style={{ originX: 0, originY: 1 }}
            />
          </div>

          {/* Steps card */}
          <Motion.div
            className="pcp-steps-card"
            variants={fadeLeft(0.2)}
            initial="hidden"
            animate={rightInView ? "visible" : "hidden"}
          >
            <div className="pcp-step-head">
              <span className="pcp-mini">Get a doctor today — free to start</span>
              <h3>Your first visit, step by step</h3>
            </div>

            <div className="pcp-steps">
              {STEPS.map((step, i) => (
                <Motion.div
                  key={step.n}
                  className="pcp-step-wrap"
                  variants={fadeUp(0.35 + i * 0.08)}
                  initial="hidden"
                  animate={rightInView ? "visible" : "hidden"}
                >
                  <div className="pcp-step">
                    <Motion.div
                      className="pcp-step-num"
                      whileHover={{
                        scale: 1.12,
                        backgroundColor: "#436dba",
                        color: "#fff",
                        borderColor: "#436dba",
                        transition: { duration: 0.22 },
                      }}
                    >
                      {step.n}
                    </Motion.div>
                    <div>
                      <h4>{step.title}</h4>
                      <p>{step.desc}</p>
                    </div>
                  </div>
                  {i < 4 && <div className="pcp-step-line" />}
                </Motion.div>
              ))}
            </div>
          </Motion.div>

          {/* ════ KNOW MORE — bottom of right column ════ */}
          <Motion.div
            className="pcp-know-more-wrap"
            variants={fadeUp(0.8)}
            initial="hidden"
            animate={rightInView ? "visible" : "hidden"}
          >
            <Motion.button
              className="pcp-know-more-btn"
              whileHover={{
                y: -4,
                boxShadow: "0 20px 48px rgba(67, 109, 186, 0.28)",
                transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
              }}
              whileTap={{ scale: 0.97 }}
            >
              <a href="/appointment-booking">
              Know More
              <span className="pcp-btn-arrow" aria-hidden="true">→</span></a>
            </Motion.button>

            <Motion.p
              className="pcp-know-more-hint"
              variants={fadeUp(0.92)}
              initial="hidden"
              animate={rightInView ? "visible" : "hidden"}
            >
              No insurance needed · Cancel anytime
            </Motion.p>
          </Motion.div>

        </div>{/* /pcp-right */}
      </div>{/* /pcp-container */}
    </Motion.section>
  );
}