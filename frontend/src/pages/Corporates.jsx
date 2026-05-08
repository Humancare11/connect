

import { useState, useEffect, useRef, useCallback } from "react";
import "./Corporates.css";
import ECGTimeline from "../components/ECGTimeline";
import Netaji from "../components/Netaji";
import Demo from "../components/Demo";

/* ================================================================
   SERVICES DATA
================================================================ */
const SERVICES = [
  {
    label: "Teleconsultation",
    title: "On-Demand Video Visits",
    desc: "Employees connect with a certified doctor within minutes — from any device, any location.",
    stat: "< 5 min wait",
    accent: "linear-gradient(90deg,#0C8B7A,#1B2F4B)",
    statNum: "< 5 min",
    statLbl: "Avg. wait time",
    centreRows: [
      {
        label: "Visit completion",
        val: "98.2%",
        pct: 98,
        grad: "linear-gradient(90deg,#223A5E,#0C8B7A)",
      },
      {
        label: "Same-day slots",
        val: "100%",
        pct: 100,
        grad: "linear-gradient(90deg,#0C8B7A,#0a6b5e)",
      },
    ],
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.845v6.311a1 1 0 0 1-1.447.893L15 14M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" />
      </svg>
    ),
  },
  {
    label: "Doctor On Call",
    title: "24/7 Medical Helpline",
    desc: "Round-the-clock access to a licensed physician for urgent health questions and triage.",
    stat: "24/7 access",
    accent: "linear-gradient(90deg,#1A56DB,#223A5E)",
    statNum: "24/7",
    statLbl: "Doctor availability",
    centreRows: [
      {
        label: "Calls answered",
        val: "< 60s",
        pct: 97,
        grad: "linear-gradient(90deg,#1A56DB,#0f3a8a)",
      },
      {
        label: "Resolution rate",
        val: "94%",
        pct: 94,
        grad: "linear-gradient(90deg,#0C8B7A,#223A5E)",
      },
    ],
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.11 11.9 19.79 19.79 0 0 1 1 3.28 2 2 0 0 1 2.98 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    ),
  },
  {
    label: "Mental Health",
    title: "Employee Wellness & EAP",
    desc: "Licensed therapists, counsellors, and mental health support — accessible and confidential.",
    stat: "95% satisfaction",
    accent: "linear-gradient(90deg,#7C3AED,#223A5E)",
    statNum: "95%",
    statLbl: "Employee satisfaction",
    centreRows: [
      {
        label: "Sessions booked",
        val: "10K+/mo",
        pct: 90,
        grad: "linear-gradient(90deg,#7C3AED,#4c1d95)",
      },
      {
        label: "Return rate",
        val: "87%",
        pct: 87,
        grad: "linear-gradient(90deg,#0C8B7A,#223A5E)",
      },
    ],
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
  {
    label: "Prescriptions",
    title: "Digital Prescription Service",
    desc: "Doctors issue e-prescriptions sent directly to the employee's nearest pharmacy within minutes.",
    stat: "99.7% accuracy",
    accent: "linear-gradient(90deg,#0C8B7A,#065f52)",
    statNum: "99.7%",
    statLbl: "Prescription accuracy",
    centreRows: [
      {
        label: "Rx issued",
        val: "50K+",
        pct: 99,
        grad: "linear-gradient(90deg,#0C8B7A,#C97B1A)",
      },
      {
        label: "Pharmacy delivery",
        val: "< 2hrs",
        pct: 95,
        grad: "linear-gradient(90deg,#0C8B7A,#065f52)",
      },
    ],
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        <path d="M3.22 12H9.5l.5-1 2 4.5.5-1.5H20.8" />
      </svg>
    ),
  },
  {
    label: "HR Dashboard",
    title: "Health Analytics & Reporting",
    desc: "Real-time workforce health insights, absenteeism trends, and utilisation reports for HR teams.",
    stat: "34% fewer sick days",
    accent: "linear-gradient(90deg,#C97B1A,#7a4a10)",
    statNum: "34%",
    statLbl: "Reduction in sick days",
    centreRows: [
      {
        label: "Data dashboards",
        val: "Live",
        pct: 100,
        grad: "linear-gradient(90deg,#C97B1A,#7a4a10)",
      },
      {
        label: "Report accuracy",
        val: "99.9%",
        pct: 100,
        grad: "linear-gradient(90deg,#223A5E,#0C8B7A)",
      },
    ],
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
  },
  {
    label: "Sick Leave",
    title: "Absence Management",
    desc: "Streamlined medical certificates, fit-to-work notes, and sick leave validation — all digital.",
    stat: "60% faster process",
    accent: "linear-gradient(90deg,#223A5E,#0C8B7A)",
    statNum: "60%",
    statLbl: "Faster HR processing",
    centreRows: [
      {
        label: "Certs issued",
        val: "< 1hr",
        pct: 95,
        grad: "linear-gradient(90deg,#223A5E,#0C8B7A)",
      },
      {
        label: "Compliance rate",
        val: "100%",
        pct: 100,
        grad: "linear-gradient(90deg,#0C8B7A,#065f52)",
      },
    ],
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
];

/* ── Default centre card data ── */
const DEFAULT_CENTRE = {
  eyebrow: "Why Choose Us",
  stat: "2.4M+",
  statLbl: "Patients Served",
  tag: "HIPAA · SOC 2 · 500+ Doctors",
  rows: [
    {
      label: "Visit completion",
      val: "98.2%",
      pct: 98,
      grad: "linear-gradient(90deg,#223A5E,#0C8B7A)",
    },
    {
      label: "Prescription accuracy",
      val: "99.7%",
      pct: 99.7,
      grad: "linear-gradient(90deg,#0C8B7A,#C97B1A)",
    },
  ],
};

const N = SERVICES.length;
const AUTO_SPEED = 0.00018; // radians per ms

/* ================================================================
   COMPONENT
================================================================ */
export default function CorporateHub() {
  const stageRef = useRef(null);
  const linesRef = useRef(null);
  const orbitRef = useRef(null);
  const cardEls = useRef([]); // DOM refs for satellite cards
  const rotOffset = useRef(0); // current rotation in radians
  const animating = useRef(false);
  const autoRafId = useRef(null);
  const resizeTimer = useRef(null);

  /* Centre card content state */
  const [centreData, setCentreData] = useState(DEFAULT_CENTRE);
  const [centreFade, setCentreFade] = useState(false); // triggers opacity 0
  const [activeIdx, setActiveIdx] = useState(-1);
  const activeIdxRef = useRef(-1); // ref copy for RAF callbacks

  /* ── Helpers ── */
  const baseAngle = (i) => (i / N) * 2 * Math.PI - Math.PI / 2;
  const satAngle = (i) => baseAngle(i) + rotOffset.current;

  const getPos = useCallback((angleRad) => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const W = stage.offsetWidth;
    const H = stage.offsetHeight;
    const cx = W / 2;
    const cy = H / 2;

    // Responsive orbit sizing
    let radiusMultiplierX = 0.4;
    let radiusMultiplierY = 0.38;

    // Adjust orbit size for smaller screens
    if (W <= 380) {
      radiusMultiplierX = 0.35;
      radiusMultiplierY = 0.33;
    } else if (W <= 480) {
      radiusMultiplierX = 0.37;
      radiusMultiplierY = 0.35;
    } else if (W <= 640) {
      radiusMultiplierX = 0.38;
      radiusMultiplierY = 0.36;
    }

    const rx = Math.min(W * radiusMultiplierX, 320);
    const ry = Math.min(H * radiusMultiplierY, 260);

    return {
      x: cx + rx * Math.cos(angleRad),
      y: cy + ry * Math.sin(angleRad),
    };
  }, []);

  /* ── Place satellite cards ── */
  const placeCards = useCallback(
    (skipTransition = false) => {
      const cards = cardEls.current;
      if (!cards.length) return;

      const CARD_W = cards[0]?.offsetWidth || 190;
      const CARD_H = cards[0]?.offsetHeight || 220;
      const stage = stageRef.current;
      const isMobile = stage && stage.offsetWidth <= 640;

      cards.forEach((el, i) => {
        if (!el) return;
        const ang = satAngle(i);
        const pos = getPos(ang);

        const depthFactor = (Math.sin(ang) + 1) / 2;

        // Adjust scale range for mobile
        let scaleMin = isMobile ? 0.88 : 0.85;
        let scaleRange = isMobile ? 0.12 : 0.15;
        let scale = scaleMin + scaleRange * (1 - depthFactor);
        let opacity = 0.6 + 0.4 * (1 - depthFactor);

        if (activeIdxRef.current === i) {
          scale = isMobile ? 1.04 : 1.06;
          opacity = 1;
        }

        const left = pos.x - CARD_W / 2;
        const top = pos.y - CARD_H / 2;

        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        el.style.transform = `scale(${scale})`;
        el.style.opacity = opacity;
        el.style.zIndex =
          Math.round(opacity * 10) + (activeIdxRef.current === i ? 20 : 0);
        el.style.transition = skipTransition
          ? "none"
          : "left 0.65s cubic-bezier(0.34,1.06,0.64,1)," +
            "top  0.65s cubic-bezier(0.34,1.06,0.64,1)," +
            "transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94)," +
            "opacity 0.5s ease," +
            "box-shadow 0.35s ease";
      });

      drawLines();
    },
    [getPos],
  );

  /* ── Draw SVG connector lines ── */
  const drawLines = useCallback(() => {
    const svg = linesRef.current;
    const stage = stageRef.current;
    if (!svg || !stage) return;

    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const W = stage.offsetWidth;
    const H = stage.offsetHeight;
    const cx = W / 2;
    const cy = H / 2;
    const ns = "http://www.w3.org/2000/svg";

    SERVICES.forEach((_, i) => {
      const ang = satAngle(i);
      const pos = getPos(ang);
      const isActive = i === activeIdxRef.current;

      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", cx);
      line.setAttribute("y1", cy);
      line.setAttribute("x2", pos.x);
      line.setAttribute("y2", pos.y);
      line.setAttribute("stroke", isActive ? "#0C8B7A" : "rgba(34,58,94,0.08)");
      line.setAttribute("stroke-width", isActive ? "1.5" : "1");
      if (!isActive) line.setAttribute("stroke-dasharray", "5 6");
      svg.appendChild(line);

      const dot = document.createElementNS(ns, "circle");
      dot.setAttribute("cx", pos.x);
      dot.setAttribute("cy", pos.y);
      dot.setAttribute("r", isActive ? 5 : 3);
      dot.setAttribute("fill", isActive ? "#0C8B7A" : "rgba(34,58,94,0.15)");
      svg.appendChild(dot);
    });

    const centre = document.createElementNS(ns, "circle");
    centre.setAttribute("cx", cx);
    centre.setAttribute("cy", cy);
    centre.setAttribute("r", 6);
    centre.setAttribute("fill", "#0C8B7A");
    centre.setAttribute("opacity", "0.4");
    svg.appendChild(centre);
  }, [getPos]);

  /* ── Animate centre card content with fade ── */
  const fadeCentreTo = useCallback((data) => {
    setCentreFade(true);
    setTimeout(() => {
      setCentreData(data);
      setCentreFade(false);
    }, 200);
  }, []);

  const resetCentre = useCallback(() => {
    fadeCentreTo(DEFAULT_CENTRE);
  }, [fadeCentreTo]);

  const previewCard = useCallback(
    (idx) => {
      const d = SERVICES[idx];
      fadeCentreTo({
        eyebrow: d.label,
        stat: d.statNum,
        statLbl: d.statLbl,
        tag: d.title,
        rows: d.centreRows,
      });
      cardEls.current.forEach((el, i) => {
        if (!el) return;
        el.classList.toggle("hc-sat-active", i === idx);
      });
      drawLines();
    },
    [fadeCentreTo, drawLines],
  );

  /* ── Smooth rotation via RAF ── */
  const rotateTo = useCallback(
    (target, onDone) => {
      const start = rotOffset.current;
      const diff = target - start;
      let t0 = null;
      const dur = 700;

      const easeInOut = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

      const step = (ts) => {
        if (!t0) t0 = ts;
        const elapsed = ts - t0;
        const progress = Math.min(elapsed / dur, 1);
        rotOffset.current = start + diff * easeInOut(progress);
        placeCards(false);
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          rotOffset.current = target;
          placeCards(false);
          onDone?.();
        }
      };
      requestAnimationFrame(step);
    },
    [placeCards],
  );

  /* ── Activate card (click) ── */
  const activateCard = useCallback(
    (idx) => {
      if (animating.current) return;

      // Toggle off
      if (activeIdxRef.current === idx) {
        activeIdxRef.current = -1;
        setActiveIdx(-1);
        cardEls.current.forEach((el) => el?.classList.remove("hc-sat-active"));
        rotateTo(0);
        resetCentre();
        return;
      }

      animating.current = true;
      activeIdxRef.current = idx;
      setActiveIdx(idx);

      cardEls.current.forEach((el, i) =>
        el?.classList.toggle("hc-sat-active", i === idx),
      );

      const d = SERVICES[idx];
      fadeCentreTo({
        eyebrow: d.label,
        stat: d.statNum,
        statLbl: d.statLbl,
        tag: d.title,
        rows: d.centreRows,
      });

      const targetAngle = -Math.PI / 2;
      const currentAngle = satAngle(idx);
      let delta = targetAngle - currentAngle;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;

      rotateTo(rotOffset.current + delta, () => {
        animating.current = false;
      });
    },
    [rotateTo, resetCentre, fadeCentreTo],
  );

  /* ── Auto-rotate ── */
  const startAutoRotate = useCallback(() => {
    if (autoRafId.current) cancelAnimationFrame(autoRafId.current);
    let last = null;

    const tick = (ts) => {
      if (activeIdxRef.current !== -1) {
        last = null;
        autoRafId.current = requestAnimationFrame(tick);
        return;
      }
      if (last !== null) {
        const dt = ts - last;
        rotOffset.current += AUTO_SPEED * dt;
        placeCards(false);
      }
      last = ts;
      autoRafId.current = requestAnimationFrame(tick);
    };
    autoRafId.current = requestAnimationFrame(tick);
  }, [placeCards]);

  const stopAutoRotate = useCallback(() => {
    if (autoRafId.current) {
      cancelAnimationFrame(autoRafId.current);
      autoRafId.current = null;
    }
  }, []);

  /* ── Initial placement + resize listener ── */
  useEffect(() => {
    // Wait one frame so card heights are measured
    const init = setTimeout(() => {
      placeCards(true);
      startAutoRotate();
    }, 80);

    const handleResize = () => {
      clearTimeout(resizeTimer.current);
      resizeTimer.current = setTimeout(() => placeCards(true), 150);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(init);
      clearTimeout(resizeTimer.current);
      window.removeEventListener("resize", handleResize);
      stopAutoRotate();
    };
  }, [placeCards, startAutoRotate, stopAutoRotate]);

  /* ── Stage hover: pause / resume auto-rotate ── */
  const handleStageEnter = () => stopAutoRotate();
  const handleStageLeave = () => {
    if (activeIdxRef.current === -1) resetCentre();
    startAutoRotate();
  };

  /* ── Satellite card hover ── */
  const handleSatEnter = (idx) => {
    if (!animating.current && activeIdxRef.current !== idx) previewCard(idx);
  };
  const handleSatLeave = () => {
    if (activeIdxRef.current === -1) resetCentre();
  };

  /* ── Assign satellite card DOM ref ── */
  const setCardRef = (el, i) => {
    cardEls.current[i] = el;
  };

  return (
    <>
      <section className="hc-hub">
        <section>
          <div className="corp-hero">
            <div className="corp-hero-inner">
              <h1>Corporate Solutions & Insights</h1>
              <p>
                Empowering businesses with innovative strategies, expert
                consulting, and scalable solutions to drive sustainable growth
                and success.
              </p>
            </div>
          </div>
        </section>
        <Demo />
        <ECGTimeline />
        {/* Header */}
        <div className="hc-hub-head">
          <p className="hc-hub-eyebrow">Corporate Solutions</p>
          <h2 className="hc-hub-title">Everything your organization needs</h2>
          <p className="hc-hub-sub">
            Click any service to bring it to focus. Built for enterprises that
            take employee health seriously.
          </p>
        </div>

        {/* Stage */}
        <div
          className="hc-hub-stage"
          ref={stageRef}
          onMouseEnter={handleStageEnter}
          onMouseLeave={handleStageLeave}
        >
          {/* Centre card */}
          <div className="hc-hub-centre">
            <div
              className={`hc-hub-centre-inner${centreFade ? " hc-fading" : ""}`}
            >
              <div className="hc-centre-eyebrow">{centreData.eyebrow}</div>
              <div className="hc-centre-stat">{centreData.stat}</div>
              <div className="hc-centre-stat-label">{centreData.statLbl}</div>
              <div className="hc-centre-divider" />
              <div className="hc-centre-rows">
                {centreData.rows.map((row, i) => (
                  <div key={i}>
                    <div className="hc-centre-row">
                      <span>{row.label}</span>
                      <strong>{row.val}</strong>
                    </div>
                    <div className="hc-centre-bar">
                      <div
                        className="hc-centre-fill"
                        style={{ width: `${row.pct}%`, background: row.grad }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="hc-centre-tag">{centreData.tag}</div>
            </div>
          </div>

          {/* Orbit — satellite cards absolutely positioned by placeCards() */}
          <div className="hc-hub-orbit" ref={orbitRef}>
            {SERVICES.map((svc, i) => (
              <div
                key={svc.label}
                ref={(el) => setCardRef(el, i)}
                className={`hc-sat${activeIdx === i ? " hc-sat-active" : ""}`}
                onClick={() => activateCard(i)}
                onMouseEnter={() => handleSatEnter(i)}
                onMouseLeave={handleSatLeave}
              >
                <div
                  className="hc-sat-accent"
                  style={{ background: svc.accent }}
                />
                <div className="hc-sat-body">
                  <div className="hc-sat-icon">{svc.icon}</div>
                  <div className="hc-sat-label">{svc.label}</div>
                  <div className="hc-sat-title">{svc.title}</div>
                  <div className="hc-sat-desc">{svc.desc}</div>
                  <span className="hc-sat-stat">{svc.stat}</span>
                </div>
              </div>
            ))}
          </div>

          {/* SVG connector lines */}
          <svg
            className="hc-hub-lines"
            ref={linesRef}
            xmlns="http://www.w3.org/2000/svg"
          />
        </div>

        {/* Mobile hint */}
        <p className="hc-hub-mobile-hint">Tap a card to explore</p>
      </section>

      <Netaji />
    </>
  );
}
