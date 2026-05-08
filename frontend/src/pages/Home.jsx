import React, { useEffect, useRef, useState, useCallback } from "react";
import "./home.css";
import Sa from "../components/Sa";
import Aa from "../components/Aa";
import sceneVideo from "../assets/gifts/scene-card-bg-video.mp4";
import WordReveal from "../components/WordReveal";
import StepProgress from "../components/StepProgress";
import LogoMarquee from "../components/LogoMarquee";

// import HeroNew from "./hero-new";

// Swiper imports
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import { FaFileMedical, FaSyncAlt, FaCalendarAlt } from "react-icons/fa";
import {
  FiSmartphone,
  FiUserCheck,
  FiClock,
  FiVideo,
  FiFileText,
  FiCheckCircle,
} from "react-icons/fi";

// framer-motion not used in this file
import { motion, useInView } from "framer-motion";

import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";



gsap.registerPlugin(ScrollTrigger);


// ─── Scene data ───────────────────────────────────────────────────────────────
const SCENES = [
  {
    step: 1,
    badge: "Open App",
    title: "Launch Humancare",
    desc: "Open the app or website. Your health dashboard loads instantly with your profile ready.",
    metricValue: "< 1s",
    metricLabel: "App load time",
    metricIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    step: 2,
    badge: "AI Match",
    title: "Matched to Dr. Patel",
    desc: "Our AI matches you to the best available physician based on your symptoms and history.",
    metricValue: "4 sec",
    metricLabel: "Match time",
    metricIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
      </svg>
    ),
  },
  {
    step: 3,
    badge: "Waiting",
    title: "Virtual Waiting Room",
    desc: "A brief hold while your doctor prepares. Average wait is under 90 seconds nationwide.",
    metricValue: "~12 sec",
    metricLabel: "Your wait today",
    metricIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    step: 4,
    badge: "Connected",
    title: "Video Consultation",
    desc: "Face to face with your doctor over HIPAA secured, HD video. Share symptoms, ask questions.",
    metricValue: "256-bit",
    metricLabel: "Encrypted",
    metricIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    step: 5,
    badge: "E-Prescribe",
    title: "Prescription Sent",
    desc: "Your doctor sends the prescription electronically to your preferred pharmacy. Ready for pickup.",
    metricValue: "Instant",
    metricLabel: "E-Rx delivery",
    metricIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  {
    step: 6,
    badge: "Done",
    title: "Visit Complete!",
    desc: "Rate your experience, schedule follow ups, and access visit notes, all from one dashboard.",
    metricValue: "4.9 ★",
    metricLabel: "Avg rating",
    metricIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
      </svg>
    ),
  },
];

const STEP_ICONS = [
  <FiSmartphone />, // Mobile device
  <FiUserCheck />, // User + verification
  <FiClock />, // Time / process
  <FiVideo />, // Video call
  <FiFileText />, // Document/report
  <FiCheckCircle />, // Success/complete
];

const DOT_LABELS = [
  "Open App",
  "Match Doctor",
  "Wait Room",
  "Video Call",
  "Rx Sent",
  "Complete",
];
const TOTAL_STEPS = 6;
const STEP_DURATION = 4000;
const CIRCUMFERENCE = 2 * Math.PI * 10; // For auto-timer (radius 10)
const STEP_CIRCUMFERENCE = 2 * Math.PI * 20; // For step dots (radius 20)

export default function HomePage() {
  // Testimonials data
  const testimonials = [
    {
      id: 1,
      stars: "★★★★★",
      quote:
        "Saw a doctor within 4 minutes of signing up. Had my prescription at the pharmacy an hour later. This completely changed how I think about healthcare.",
      initials: "AM",
      name: "Alex M.",
      location: "Austin, TX",
    },
    {
      id: 2,
      stars: "★★★★★",
      quote:
        "As someone without insurance, the flat $49 fee was a revelation. Dr. Nair took 45 full minutes with me. I felt truly heard for the first time in years.",
      initials: "JS",
      name: "Jordan S.",
      location: "Chicago, IL",
    },
    {
      id: 3,
      stars: "★★★★★",
      quote:
        "My daughter had a fever at 2am. We got a same-night video call with a pediatrician who was calm, thorough, and reassuring. Absolute lifesaver.",
      initials: "RP",
      name: "Rachel P.",
      location: "Seattle, WA",
    },
    {
      id: 4,
      stars: "★★★★★",
      quote:
        "Managing my chronic condition used to mean multiple in-office visits a month. Now I check in via video and my health has genuinely improved — costs way down too.",
      initials: "DT",
      name: "David T.",
      location: "Miami, FL",
    },
    {
      id: 5,
      stars: "★★★★★",
      quote:
        "My therapist on Humancare remembers every detail, follows up proactively, and has been a genuine partner in my recovery. Exceptional mental health care.",
      initials: "LK",
      name: "Laura K.",
      location: "Denver, CO",
    },
    {
      id: 6,
      stars: "★★★★★",
      quote:
        "My therapist on Humancare remembers every detail, follows up proactively, and has been a genuine partner in my recovery. Exceptional mental health care.",
      initials: "LK",
      name: "Laura K.",
      location: "Denver, CO",
    },
  ];

  const features = [
    {
      icon: <FaFileMedical />,
      title: "Acts as Your PCP",
      desc: "Our providers manage ongoing health, maintain your records, and coordinate specialist referrals.",
    },
    {
      icon: <FaSyncAlt />,
      title: "Continuity of Care",
      desc: "Build a relationship with the same doctor across visits. Your health history stays in one secure place.",
    },
    {
      icon: <FaCalendarAlt />,
      title: "365 Days a Year",
      desc: "No more 3-week waits. Connect the same day — including evenings and weekends.",
    },
  ];

  const steps = [
    {
      title: "Create your free account",
      desc: "Under 2 minutes. No credit card required.",
    },
    {
      title: "Complete a health intake",
      desc: "Share your medical history and current medications.",
    },
    {
      title: "Match with a provider",
      desc: "We surface the best-fit doctor for your needs and state.",
    },
    {
      title: "Start your video visit",
      desc: "Meet face-to-face from anywhere, on any device.",
    },
    {
      title: "Receive care instantly",
      desc: "Prescription sent to your pharmacy within minutes.",
    },
  ];

  useEffect(() => {
    // Scroll reveal
    const ro = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("in");
        });
      },
      { threshold: 0.12 },
    );
    document.querySelectorAll(".reveal").forEach((el) => ro.observe(el));

    return () => {
      ro.disconnect();
    };
  }, []);

  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  // Replace per-frame state for timerOffset with a ref to avoid re-renders
  const timerOffsetRef = useRef(CIRCUMFERENCE);
  const elapsedRef = useRef(0);
  const lastTickRef = useRef(Date.now());
  const rafRef = useRef(null);
  const pausedRef = useRef(false);
  const currentRef = useRef(0);

  // Refs for direct DOM updates to avoid re-rendering the whole page each animation frame
  const progressFillRef = useRef(null);
  const ringFillRefs = useRef([]);

  // Keep refs in sync
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  // External progress handler for StepProgress (fraction 0..1)
  const handleProgress = useCallback((progress) => {
    const frac = Math.min(Math.max(progress, 0), 1);
    const pct = Math.round(frac * 10000) / 100; // keep 2 decimals
    if (progressFillRef.current) {
      progressFillRef.current.style.width = `${pct}%`;
    }

    // Derive current step and intra-step progress from the total fraction
    const total = frac * TOTAL_STEPS;
    const idx = Math.min(Math.floor(total), TOTAL_STEPS - 1);
    const inStep = total - idx; // 0..1 progress inside the step

    // Sync Home's timing refs so scene cards match the StepProgress component
    if (currentRef.current !== idx) {
      setCurrent(idx);
      currentRef.current = idx;
    }
    elapsedRef.current = inStep * STEP_DURATION;
    timerOffsetRef.current = CIRCUMFERENCE * (1 - inStep);
  }, []);

  const updateVisuals = useCallback(() => {
    // update continuous track and rings from refs
    const currentIdx = currentRef.current;
    const timerOffset = timerOffsetRef.current;
    const currentStepProgress = 1 - timerOffset / CIRCUMFERENCE;
    let progressPct = ((currentIdx + currentStepProgress) / TOTAL_STEPS) * 100;
    progressPct = Math.min(progressPct, 100);

    // update continuous progress via shared handler (expects 0..1)
    if (typeof handleProgress === "function") {
      handleProgress(progressPct / 100);
    }

    // update ring fills (small number of rings, fine to update each frame)
    ringFillRefs.current.forEach((el, i) => {
      if (!el) return;
      const isActive = i === currentIdx;
      const isCompleted = i < currentIdx;
      const progress = isActive
        ? timerOffset / CIRCUMFERENCE
        : isCompleted
          ? 0
          : 1;
      const progressOffset = progress * STEP_CIRCUMFERENCE;
      // set attribute for SVG stroke dashoffset
      try {
        el.setAttribute("stroke-dashoffset", String(progressOffset));
      } catch (e) {
        el.style.strokeDashoffset = String(progressOffset);
      }
    });
  }, []);

  const tick = useCallback(() => {
    if (pausedRef.current) return;
    const now = Date.now();
    elapsedRef.current += now - lastTickRef.current;
    lastTickRef.current = now;

    const pct = Math.min(elapsedRef.current / STEP_DURATION, 1);
    timerOffsetRef.current = CIRCUMFERENCE * (1 - pct);

    // update visuals directly
    updateVisuals();

    if (elapsedRef.current >= STEP_DURATION) {
      elapsedRef.current = 0;
      setCurrent((prev) => {
        const next = (prev + 1) % TOTAL_STEPS;
        // keep currentRef in sync
        currentRef.current = next;
        return next;
      });
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [updateVisuals]);

  useEffect(() => {
    // initialize refs and start RAF
    // ensure ringFillRefs current array has proper length
    ringFillRefs.current = ringFillRefs.current.slice(0, TOTAL_STEPS);

    // set initial visuals
    updateVisuals();

    lastTickRef.current = Date.now();
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick, updateVisuals]);

  const jumpTo = (step) => {
    elapsedRef.current = 0;
    lastTickRef.current = Date.now();
    setCurrent(step);
    currentRef.current = step;
    // update visuals instantly
    updateVisuals();
  };

  const togglePause = () => {
    setPaused((p) => {
      const next = !p;
      if (!next) {
        lastTickRef.current = Date.now();
        rafRef.current = requestAnimationFrame(tick);
      }
      return next;
    });
  };

  // Continuous progress: includes completed steps + progress within current step
  // Progress should reach 100% only when the last step completes
  const currentStepProgress =
    1 - (timerOffsetRef.current ?? CIRCUMFERENCE) / CIRCUMFERENCE;
  // Divide by TOTAL_STEPS so progress continues during the last step
  let progressPct = ((current + currentStepProgress) / TOTAL_STEPS) * 100;
  progressPct = Math.min(progressPct, 100); // Cap at 100%

  // const items = ["figma", "framer", "webflow", "raycast", "supabase", "clerk"];

  // const trackRef = useRef(null);

  // useEffect(() => {
  //   const track = trackRef.current;
  //   if (!track) return;

  //   const buildSet = (copies) => {
  //     track.innerHTML = "";
  //     for (let c = 0; c < copies; c++) {
  //       items.forEach((item) => {
  //         const tag = document.createElement("span");
  //         tag.className = "sb-tag";
  //         tag.textContent = item;
  //         track.appendChild(tag);
  //       });
  //       // optional separator
  //       const sep = document.createElement("span");
  //       sep.className = "sb-sep";
  //       sep.textContent = "\u00A0"; 
  //       track.appendChild(sep);
  //     }
  //   };

    // const recalc = () => {
      // 1) build a single set to measure width
      // buildSet(1);

      // requestAnimationFrame(() => {
        // const singleWidth = track.scrollWidth || 0;  width of one set
        // const containerWidth =
          // track.parentElement?.clientWidth || window.innerWidth;

        // Determine how many copies we need so the scrolling content always exceeds the viewport
        // const minNeeded = Math.ceil(
          // (containerWidth * 2) / Math.max(singleWidth, 1),
        // );
        // const copies = Math.max(2, minNeeded);

        // buildSet(copies);

        // expose width of one copy for the CSS animation to translate by
        // track.style.setProperty("--scroll-width", `${singleWidth}px`);
      // });
    // };

    // recalc();
    // window.addEventListener("resize", recalc);

    // return () => window.removeEventListener("resize", recalc);
  // }, [items]);

  const wrapperRef = useRef(null);
  const headerRef = useRef(null);
  const featuresRef = useRef([]);
  const btnRef = useRef(null);
  const stepsRef = useRef([]);
  const rightRef = useRef(null);
  const whyRef = useRef(null);
  const whyInView = useInView(whyRef, { once: true, amount: 0.15 });

  const whyListVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.2 } },
  };

  const whyItemVariants = {
    hidden: { opacity: 0, x: 60 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 1.5, ease: [0.25, 0.46, 0.45, 0.94] },
    },
  };

  useEffect(() => {
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: wrapperRef.current,
        start: "top top",
        end: "+=220%",
        pin: true,
        pinSpacing: true,
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrapperRef.current,
          start: "top top",
          end: "+=220%",
          scrub: 1.2,
        },
      });

      // 1. Header
      tl.fromTo(
        headerRef.current,
        { opacity: 0, y: 60 },
        { opacity: 1, y: 0, duration: 1.2 },
      );

      // 2. Feature card 1
      tl.fromTo(
        featuresRef.current[0],
        { opacity: 0, x: -70 },
        { opacity: 1, x: 0, duration: 0.8 },
        "+=0.2",
      );

      // 3. Feature card 2
      tl.fromTo(
        featuresRef.current[1],
        { opacity: 0, x: -70 },
        { opacity: 1, x: 0, duration: 0.8 },
        "+=0.1",
      );

      // 4. Feature card 3
      tl.fromTo(
        featuresRef.current[2],
        { opacity: 0, x: -70 },
        { opacity: 1, x: 0, duration: 0.8 },
        "+=0.1",
      );

      // 5. Button
      tl.fromTo(
        btnRef.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.7 },
        "+=0.1",
      );

      // 6. Entire right panel as one whole box — steps visible inside it
      tl.fromTo(
        rightRef.current,
        { opacity: 0, y: 80, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 1.2, ease: "power3.out" },
        "+=0.3",
      );

      // ✅ No stepsRef animation — they're visible inside rightRef
    }, wrapperRef);

    return () => ctx.revert();
  }, []);

  // inside your component
  const testimonialsRef = useRef(null);
  const bgRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      const section = testimonialsRef.current;
      const bg = bgRef.current;
      if (!section || !bg) return;

      const rect = section.getBoundingClientRect();
      const viewH = window.innerHeight;
      const progress = (viewH - rect.top) / (viewH + rect.height);
      const p = Math.max(0, Math.min(1, progress));
      const offset = (p - 0.5) * 120;

      bg.style.transform = `translateY(${offset}px)`;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
    
      {/* ════════════════════ HERO section ═════════════════════════════════════════════ */}
      <section className="hero">
        {/* hero canvas removed for production: decorative particles were disabled */}
        <div className="hero-left">
          <div className="hero-badge">
            <div className="badge-pulse"></div>
            Available in all 50 states — 24 / 7
          </div>

          <h1>
            Talk to a <span className="fancy-underline">licensed doctor</span>
            <br />
            in minutes.
          </h1>

          <p>
            Book video consultations, get prescriptions, and receive follow-up
            care from board-certified physicians, without leaving home.
          </p>

          <div className="search-bar">
            <input
              type="text"
              placeholder="Search doctors, specialties, conditions…"
            />
            <button>Search</button>
          </div>

          <div className="trust">
            <span className="trust-chip">
              <svg
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              HIPAA Compliant
            </span>
            <span className="trust-chip">
              <svg
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              GDPR Ready
            </span>
            <span className="trust-chip">
              <svg
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              500+ Verified Doctors
            </span>
            < span className="trust-chip">
              <svg
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              Prescriptions Available
            </span>
          </div>
        </div>

        <div className="hero-right">
          <div className="timeline-container">
            <div className="t-orb t-orb-1" />
            <div className="t-orb t-orb-2" />
            <div className="t-orb t-orb-3" />

            <div className="timeline-header">
              <div className="eyebrow-hero">The Humancare Experience</div>
              <h3>
                Your Visit in <span>90 Seconds</span>
              </h3>
            </div>

            <div className="progress-track">
              <div
                className="progress-fill"
                ref={progressFillRef}
                style={{ width: "0%" }}
              />
            </div>

            <div className="step-dots">
              <StepProgress
                steps={DOT_LABELS.map((label, i) => ({
                  label,
                  icon: STEP_ICONS[i],
                }))}
                duration={3000}
                onProgress={handleProgress}
              />
            </div>

            {/* Scene Cards */}
            <div className="scene-viewport">
              <div className="scene-card">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="scene-video-bg"
                >
                  <source src={sceneVideo} type="video/mp4" />
                </video>

                {SCENES.map((scene, i) => {
                  const isActive = i === current;
                  const isExitUp =
                    i === (current - 1 + TOTAL_STEPS) % TOTAL_STEPS &&
                    current !== 0;

                  return (
                    <div
                      key={i}
                      className={`scene-content-container${
                        isActive ? " active" : ""
                      }${isExitUp ? " exit-up" : ""}`}
                    >
                      <div className="scene-content">
                        <div className="scene-step-badge">
                          <span className="num">{scene.step}</span>
                          {scene.badge}
                        </div>

                        <WordReveal
                          text={scene.title}
                          className="scene-title"
                          active={isActive}
                        />

                        <WordReveal
                          text={scene.desc}
                          className="scene-desc"
                          active={isActive}
                        />

                        <div className="scene-metric">
                          <div className="metric-icon">{scene.metricIcon}</div>
                          <div className="metric-text">
                            <span className="metric-value">
                              {scene.metricValue}
                            </span>
                            <span className="metric-label">
                              {scene.metricLabel}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* <HeroNew /> */}


      {/* ✅ sb-bar is now OUTSIDE <section className="hero"> */}
      {/* <div className="sb-bar">
        <div className="sb-track" ref={trackRef} />
      </div> */}
      {/* ════════════════════ HERO section ═════════════════════════════════════════════ */}
{/* ---------------------------------------------------------------- */}
 <LogoMarquee />
      <Sa />

      {/* ══════════════════════════════════════════════
          SPECIALTIES
      ══════════════════════════════════════════════ */}
      <Aa />
      {/* ══════════════════════════════════════════════
          DOCTORS
      ══════════════════════════════════════════════ */}
      <section ref={wrapperRef} className="pcp-section-wrapper">
        <div className="pcp-section">
          <div className="pcp-container">
            {/* HEADER */}
            <div className="pcp-header" ref={headerRef}>
              <span className="pcp-eyebrow">— NO PCP? NO PROBLEM.</span>
              <h2 className="pcp-heading">
                Don't have a primary care doctor?<span> We've got you.</span>
              </h2>
              <p className="pcp-desc">
                Millions of Americans lack access to a regular physician.
                MediLink bridges that gap — giving you instant access to
                licensed providers who can serve as your primary care team.
              </p>
            </div>

            {/* LEFT — Features */}
            <div className="pcp-left">
              <div className="pcp-features">
                {features.map((f, i) => (
                  <div
                    className="pcp-feature"
                    key={i}
                    ref={(el) => (featuresRef.current[i] = el)}
                  >
                    <div className="pcp-icon">{f.icon}</div>
                    <div>
                      <h4>{f.title}</h4>
                      <p>{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button className="pcp-btn" ref={btnRef}>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                Get a doctor today — free to start
              </button>
            </div>

            {/* RIGHT — Steps */}
            <div className="pcp-right" ref={rightRef}>
              <h3 className="pcp-right-title">
                Your first visit, step by step
              </h3>
              <div className="pcp-steps">
                {steps.map((step, i) => (
                  <div
                    className="pcp-step"
                    key={i}
                    // ✅ no ref here anymore
                  >
                    <div className="pcp-step-circle">{i + 1}</div>
                    <div>
                      <h4>{step.title}</h4>
                      <p>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* ══════════════════════════════════════════════
          WHY HUMANCARE
      ══════════════════════════════════════════════ */}
      <section className="why-section-container">
        <div className="why-section" id="why">
          <div className="why-grid">
            <div className="why-visual">
              <div className="stat-card-main">
                <div className="sc-label">Patient outcome improvement</div>
                <div className="sc-big">
                  94<span className="sc-percent">%</span>
                </div>
                <div className="sc-sub">After 3 months on Humancare</div>
                <div className="sc-divider"></div>
                <div className="sc-row">
                  <span>Visit completion rate</span>
                  <strong>98.2%</strong>
                </div>
                <div className="sc-prog">
                  <div className="sc-fill visit-completion"></div>
                </div>
                <div className="sc-row">
                  <span>Prescription accuracy</span>
                  <strong>99.7%</strong>
                </div>
                <div className="sc-prog">
                  <div className="sc-fill prescription-accuracy"></div>
                </div>
              </div>

              <div className="stat-float sf1">
                <div className="sf-label">Patients served</div>
                <div className="sf-val">2.4M+</div>
              </div>
              <div className="stat-float sf2">
                <div className="sf-label">Avg. response</div>
                <div className="sf-val">&lt;4 min</div>
              </div>
              <div className="stat-float sf3">
                <div className="sf-label">Rating</div>
                <div className="sf-val">4.9 ★</div>
              </div>
            </div>

            <div>
              <div className="section-eyebrow">Why Humancare</div>
              <h2 className="section-title" style={{ marginBottom: "34px" }}>
                Built on trust, at every step.
              </h2>
              <motion.div
                className="why-list"
                ref={whyRef}
                variants={whyListVariants}
                initial="hidden"
                animate={whyInView ? "visible" : "hidden"}
              >
                <motion.div className="why-item" variants={whyItemVariants}>
                  <div>
                    <div className="why-item-title">
                      HIPAA &amp; SOC 2 Certified
                    </div>
                    <div className="why-item-desc">
                      End-to-end encryption on every visit, message, and record.
                      Your health data never leaves our secure, audited
                      infrastructure.
                    </div>
                  </div>
                </motion.div>
                <motion.div className="why-item" variants={whyItemVariants}>
                  <div>
                    <div className="why-item-title">
                      Board-Certified Physicians Only
                    </div>
                    <div className="why-item-desc">
                      Every doctor clears a rigorous 9-step credentialing
                      process — state licensure, malpractice history, peer
                      reviews, and ongoing audits.
                    </div>
                  </div>
                </motion.div>
                <motion.div className="why-item" variants={whyItemVariants}>
                  <div>
                    <div className="why-item-title">
                      Transparent, Flat-Fee Pricing
                    </div>
                    <div className="why-item-desc">
                      No surprise bills. See the exact cost before booking. Most
                      major insurance plans accepted, or a flat $49 uninsured
                      rate.
                    </div>
                  </div>
                </motion.div>
                <motion.div className="why-item" variants={whyItemVariants}>
                  <div>
                    <div className="why-item-title">24 / 7 Human Support</div>
                    <div className="why-item-desc">
                      Real people — by chat, phone, or video — available around
                      the clock for urgent questions, escalations, and care
                      coordination.
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════════════ */}
      <section className="testimonials-section">
        <div className="section-eyebrow">Patient Stories</div>
        <h2 className="section-title">Real people, real outcomes.</h2>
        <Swiper
          modules={[Pagination, Autoplay]}
          spaceBetween={20}
          loop={true}
          autoplay={{
            delay: 3000,
            disableOnInteraction: false,
          }}
          pagination={{
            clickable: true,
          }}
          breakpoints={{
            0: {
              slidesPerView: 1,
              spaceBetween: 16,
            },
            576: {
              slidesPerView: 1,
              spaceBetween: 16,
            },
            768: {
              slidesPerView: 1,
              spaceBetween: 18,
            },
            1024: {
              slidesPerView: 2,
              spaceBetween: 20,
            },
            1280: {
              slidesPerView: 3,
              spaceBetween: 20,
            },
            1600: {
              slidesPerView: 3,
              spaceBetween: 20,
            },
          }}
          className="testi-track"
        >
          {testimonials.map((testimonial) => (
            <SwiperSlide key={testimonial.id}>
              <div className="testi-card">
                <div className="testi-stars">
                  <div className="testi-au">
                    <div className="testi-avi">{testimonial.initials}</div>
                    <div>
                      <div className="testi-aname">{testimonial.name}</div>
                      <div>{testimonial.stars}</div>
                    </div>
                  </div>
                </div>
                <p className="testi-q">"{testimonial.quote}"</p>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </section>

      {/* ══════════════════════════════════════════════
          CTA BAND
      ══════════════════════════════════════════════ */}
      <section className="cta-band">
        <div className="cta-inner">
          <div className="section-eyebrow">Get Started</div>
          <h2 className="cta-title">
            Your health
            <br />
            deserves better.
          </h2>
          <p className="cta-desc">
            Join 2.4 million Americans who chose a smarter way to access care.
          </p>
          <div className="cta-btns">
            <button className="cta-btn-w">Create Free Account</button>
            <button className="cta-btn-g">Talk to a Doctor Now</button>
          </div>
          <div className="cta-pills">
            <span className="cta-pill">
              <svg
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              HIPAA Compliant
            </span>
            <span className="cta-pill">
              <svg
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Board-Certified Doctors
            </span>
            <span className="cta-pill">
              <svg
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              24/7 Available
            </span>
            <span className="cta-pill">
              <svg
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              No Surprise Bills
            </span>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════ */}
    </>
  );
}
