import { useEffect, useRef } from "react";
import "./ECGTimeline.css";

const STEPS = [
  {
    num: "01",
    name: "Register",
    desc: "Sign up with your company code in under 2 minutes",
    accent: "#0C8B7A",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    num: "02",
    name: "Find Doctor",
    desc: "Browse 500+ verified specialists by condition or language",
    accent: "#1A56DB",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
  },
  {
    num: "03",
    name: "Book Slot",
    desc: "Instant same-day or next-day appointments",
    accent: "#0C8B7A",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    num: "04",
    name: "Consult",
    desc: "Video, phone, or chat — encrypted and private",
    accent: "#C97B1A",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.845v6.311a1 1 0 0 1-1.447.893L15 14M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" />
      </svg>
    ),
  },
  {
    num: "05",
    name: "Prescribe",
    desc: "E-prescriptions sent to your pharmacy in minutes",
    accent: "#0C8B7A",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    ),
  },
  {
    num: "06",
    name: "Recovered",
    desc: "Fit-to-work cert issued. HR dashboard updated.",
    accent: "#0C8B7A",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
];

const W = 1100;
const cy = 112;
const padding = 80;
const usableW = W - padding * 2;
const spacing = usableW / (STEPS.length - 1);
const peaks = [-82, 82, -82, 82, -82, 82];
const HEAD_LEN = 90;
const TRAIL_LEN = 180;
const SPEED = 320;

export default function ECGTimeline() {
  const activeStepRef = useRef(-1);
  const startTRef = useRef(null);
  const animFrameRef = useRef(null);
  const pulseFrameRef = useRef(null);

  // Refs for SVG elements
  const ecgBaseRef = useRef(null);
  const ecgTraceRef = useRef(null);
  const ecgTrailRef = useRef(null);
  const ecgLightRef = useRef(null);
  const nodeHalosRef = useRef(null);
  const nodeGroupRef = useRef(null);
  const stepCardsRef = useRef(null);

  // Store computed data
  const nodePositionsRef = useRef([]);
  const totalLenRef = useRef(0);

  useEffect(() => {
    const nodeXs = [];

    function buildPath() {
      const segs = [];
      segs.push({ x: padding - 30, y: cy });
      for (let i = 0; i < STEPS.length; i++) {
        const nx = padding + i * spacing;
        nodeXs.push(nx);
        const pk = peaks[i];
        segs.push({ x: nx - spacing * 0.25, y: cy });
        segs.push({ x: nx - spacing * 0.08, y: cy + (pk > 0 ? -8 : 8) });
        segs.push({ x: nx - spacing * 0.02, y: cy + pk });
        segs.push({ x: nx + spacing * 0.02, y: cy - pk * 0.15 });
        segs.push({ x: nx + spacing * 0.1, y: cy });
        segs.push({ x: nx + spacing * 0.25, y: cy });
      }
      segs.push({ x: W - padding + 30, y: cy });
      return (
        "M " +
        segs.map((p) => p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" L ")
      );
    }

    const pathD = buildPath();

    [ecgBaseRef, ecgTraceRef, ecgTrailRef, ecgLightRef].forEach((ref) => {
      if (ref.current) ref.current.setAttribute("d", pathD);
    });

    const pathEl = ecgBaseRef.current;
    const totalLen = pathEl.getTotalLength();
    totalLenRef.current = totalLen;

    const nodePositions = nodeXs.map((nx) => {
      let lo = 0,
        hi = totalLen,
        mid,
        pt;
      for (let iter = 0; iter < 40; iter++) {
        mid = (lo + hi) / 2;
        pt = pathEl.getPointAtLength(mid);
        if (pt.x < nx) lo = mid;
        else hi = mid;
      }
      return { x: pt.x, y: pt.y, len: mid };
    });
    nodePositionsRef.current = nodePositions;

    // Build halos
    const haloG = nodeHalosRef.current;
    const nodeG = nodeGroupRef.current;
    haloG.innerHTML = "";
    nodeG.innerHTML = "";

    nodePositions.forEach((np, i) => {
      const s = STEPS[i];
      const ns = "http://www.w3.org/2000/svg";

      const halo = document.createElementNS(ns, "circle");
      halo.setAttribute("cx", np.x);
      halo.setAttribute("cy", np.y);
      halo.setAttribute("r", 22);
      halo.setAttribute("fill", "none");
      halo.setAttribute("stroke", s.accent);
      halo.setAttribute("stroke-width", "1");
      halo.setAttribute("opacity", "0");
      halo.id = "halo" + i;
      haloG.appendChild(halo);

      const outer = document.createElementNS(ns, "circle");
      outer.setAttribute("cx", np.x);
      outer.setAttribute("cy", np.y);
      outer.setAttribute("r", 14);
      outer.setAttribute("fill", "#0a1628");
      outer.setAttribute("stroke", "rgba(100,160,220,0.2)");
      outer.setAttribute("stroke-width", "1.5");
      nodeG.appendChild(outer);

      const inner = document.createElementNS(ns, "circle");
      inner.setAttribute("cx", np.x);
      inner.setAttribute("cy", np.y);
      inner.setAttribute("r", 7);
      inner.setAttribute("fill", "#1a3a6a");
      inner.id = "node" + i;
      nodeG.appendChild(inner);

      const txt = document.createElementNS(ns, "text");
      txt.setAttribute("x", np.x);
      txt.setAttribute("y", np.y + 4);
      txt.setAttribute("text-anchor", "middle");
      txt.setAttribute("font-size", "8");
      txt.setAttribute("font-weight", "700");
      txt.setAttribute("fill", "rgba(255,255,255,0.4)");
      txt.setAttribute("font-family", "Inter,sans-serif");
      txt.textContent = i + 1;
      nodeG.appendChild(txt);
    });

    function highlightNode(idx) {
      for (let i = 0; i < STEPS.length; i++) {
        const halo = document.getElementById("halo" + i);
        const inner = document.getElementById("node" + i);
        if (i === idx) {
          halo.setAttribute("opacity", "0.7");
          halo.setAttribute("stroke", STEPS[i].accent);
          inner.setAttribute("fill", STEPS[i].accent);
          inner.setAttribute("r", "9");
        } else {
          halo.setAttribute("opacity", "0");
          inner.setAttribute("fill", "#1a3a6a");
          inner.setAttribute("r", "7");
        }
      }
    }

    function resetNodes() {
      for (let i = 0; i < STEPS.length; i++) {
        document.getElementById("halo" + i).setAttribute("opacity", "0");
        const inner = document.getElementById("node" + i);
        inner.setAttribute("fill", "#1a3a6a");
        inner.setAttribute("r", "7");
      }
    }

    // Build step cards
    const cardsEl = stepCardsRef.current;
    cardsEl.innerHTML = "";
    STEPS.forEach((s, i) => {
      const card = document.createElement("div");
      card.className = "hc-step-card";
      card.innerHTML =
        '<div class="hc-step-card-bar" style="background:' +
          s.accent +
          '"></div>' +
          '<div class="hc-step-num">' +
          s.num +
          "</div>" +
          '<div class="hc-step-icon" style="background:rgba(255,255,255,0.05);color:' +
          s.accent +
          '">' +
          card.appendChild(document.createElement("span")) &&
        "" +
          "</div>" +
          '<div class="hc-step-name">' +
          s.name +
          "</div>" +
          '<div class="hc-step-desc">' +
          s.desc +
          "</div>";

      // Re-build properly to inject SVG icon
      card.innerHTML = "";
      const bar = document.createElement("div");
      bar.className = "hc-step-card-bar";
      bar.style.background = s.accent;

      const num = document.createElement("div");
      num.className = "hc-step-num";
      num.textContent = s.num;

      const iconWrap = document.createElement("div");
      iconWrap.className = "hc-step-icon";
      iconWrap.style.background = "rgba(255,255,255,0.05)";
      iconWrap.style.color = s.accent;
      // Render SVG icon as HTML string
      const iconStrings = [
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.845v6.311a1 1 0 0 1-1.447.893L15 14M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/></svg>',
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      ];
      iconWrap.innerHTML = iconStrings[i];

      const name = document.createElement("div");
      name.className = "hc-step-name";
      name.textContent = s.name;

      const desc = document.createElement("div");
      desc.className = "hc-step-desc";
      desc.textContent = s.desc;

      card.appendChild(bar);
      card.appendChild(num);
      card.appendChild(iconWrap);
      card.appendChild(name);
      card.appendChild(desc);

      card.addEventListener("click", () => {
        const idx = i;
        if (activeStepRef.current === idx) {
          activeStepRef.current = -1;
          document
            .querySelectorAll(".hc-step-card")
            .forEach((c) => c.classList.remove("active"));
          resetNodes();
          return;
        }
        activeStepRef.current = idx;
        document
          .querySelectorAll(".hc-step-card")
          .forEach((c, j) => c.classList.toggle("active", j === idx));
        highlightNode(idx);
      });

      cardsEl.appendChild(card);
    });

    // Animation loop
    function animate(ts) {
      if (!startTRef.current) startTRef.current = ts;
      const elapsed = (ts - startTRef.current) / 1000;
      const headPos = (elapsed * SPEED) % totalLen;

      const lightEl = ecgLightRef.current;
      const trailEl = ecgTrailRef.current;
      const nps = nodePositionsRef.current;

      let nodeAhead = null;
      for (let i = 0; i < nps.length; i++) {
        if (nps[i].len > headPos && nps[i].len < headPos + HEAD_LEN + 60) {
          nodeAhead = i;
          break;
        }
      }

      let lightColor = "#7fd4f8";
      if (nodeAhead !== null) lightColor = STEPS[nodeAhead].accent;

      for (let j = 0; j < nps.length; j++) {
        const dist = Math.abs(nps[j].len - headPos);
        const halo = document.getElementById("halo" + j);
        if (!halo) continue;
        if (activeStepRef.current === j) continue;
        if (dist < 40) {
          const glow = (1 - dist / 40) * 0.55;
          halo.setAttribute("opacity", glow.toFixed(3));
          halo.setAttribute("stroke", STEPS[j].accent);
          document
            .getElementById("node" + j)
            .setAttribute("fill", STEPS[j].accent);
        } else if (dist < 80) {
          halo.setAttribute("opacity", "0");
          if (activeStepRef.current !== j)
            document.getElementById("node" + j).setAttribute("fill", "#1a3a6a");
        }
      }

      lightEl.style.strokeDasharray = HEAD_LEN + " " + (totalLen + 100);
      lightEl.style.strokeDashoffset = (totalLen - headPos + HEAD_LEN).toFixed(
        1,
      );
      lightEl.setAttribute("stroke", lightColor);

      trailEl.style.strokeDasharray = TRAIL_LEN + " " + (totalLen + 100);
      trailEl.style.strokeDashoffset = (
        totalLen -
        headPos +
        TRAIL_LEN * 0.7
      ).toFixed(1);
      trailEl.setAttribute("stroke", lightColor);
      trailEl.setAttribute("opacity", "0.12");

      animFrameRef.current = requestAnimationFrame(animate);
    }

    function pulseLoop(ts) {
      if (activeStepRef.current >= 0) {
        const halo = document.getElementById("halo" + activeStepRef.current);
        if (halo) {
          const pulse = 0.4 + 0.3 * Math.sin(ts / 600);
          halo.setAttribute("opacity", pulse.toFixed(3));
        }
      }
      pulseFrameRef.current = requestAnimationFrame(pulseLoop);
    }

    animFrameRef.current = requestAnimationFrame(animate);
    pulseFrameRef.current = requestAnimationFrame(pulseLoop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (pulseFrameRef.current) cancelAnimationFrame(pulseFrameRef.current);
    };
  }, []);

  return (
    <div className="hc-ecg-container">
      {/* Header */}
      <div className="hc-header">
        <p className="hc-header-eyebrow">
          <span className="hc-header-line" />
          How It Works
          <span className="hc-header-line" />
        </p>
        <h2 className="hc-header-title">From signup to care in minutes</h2>
        <p className="hc-header-desc">
          A seamless digital experience designed around your employees
        </p>
      </div>

      {/* SVG ECG */}
      <div className="hc-svg-wrapper">
        <svg
          id="ecgSvg"
          viewBox="0 0 1100 220"
          width="100%"
          style={{ display: "block", overflow: "visible" }}
        >
          <defs>
            <filter id="hcGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter
              id="hcGlowSoft"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path
            id="ecgBase"
            ref={ecgBaseRef}
            fill="none"
            stroke="rgba(100,160,220,0.12)"
            strokeWidth="1.5"
          />
          <path
            id="ecgTrace"
            ref={ecgTraceRef}
            fill="none"
            stroke="#1a4a8a"
            strokeWidth="1.5"
          />
          <path
            id="ecgTrail"
            ref={ecgTrailRef}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            filter="url(#hcGlowSoft)"
          />
          <path
            id="ecgLight"
            ref={ecgLightRef}
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            filter="url(#hcGlow)"
          />

          <g id="nodeHalos" ref={nodeHalosRef} />
          <g id="nodeGroup" ref={nodeGroupRef} />
        </svg>
      </div>

      {/* Step cards */}
      <div id="stepCards" ref={stepCardsRef} />
    </div>
  );
}
