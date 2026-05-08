import React, { useEffect, useRef, useState, useCallback } from "react";
// import "./Home-22.css";
import sceneVideo from "../assets/gifts/scene-card-bg-video.mp4";
import WordReveal from "../components/WordReveal";

// Swiper imports
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import {
  FaFileMedical,
  FaSyncAlt,
  FaCalendarAlt,
  FaBrain,
  FaStethoscope,
  FaHeart,
  FaHeartbeat,
  FaPills,
  FaBalanceScale,
  FaLeaf,
  FaChild,
  FaBone,
  FaEye,
  FaThermometerHalf,
  FaHeadSideCough,
  FaLungsVirus,
  FaHeartBroken,
  FaWalking,
  FaBandAid,
} from "react-icons/fa";
import {
  FiSmartphone,
  FiUserCheck,
  FiClock,
  FiVideo,
  FiFileText,
  FiCheckCircle,
} from "react-icons/fi";

import { motion, AnimatePresence } from "framer-motion";

const SCENE_VISUALS = [
  {
    bg: "linear-gradient(135deg, #E8F0FE 0%, #DCE6F2 100%)",
    icon: <FiSmartphone />,
    label: "Phone",
  },
  {
    bg: "linear-gradient(135deg, #E8F5F3 0%, #DCE6F2 100%)",
    icon: <FiUserCheck />,
    label: "Doctor",
  },
  {
    bg: "linear-gradient(135deg, #FEF3E2 0%, #F4F7FB 100%)",
    icon: <FiClock />,
    label: "Timer",
  },
  {
    bg: "linear-gradient(135deg, #E8F0FE 0%, #E8F5F3 100%)",
    icon: <FiVideo />,
    label: "Video",
  },
  {
    bg: "linear-gradient(135deg, #E8F5F3 0%, #F4F7FB 100%)",
    icon: <FiFileText />,
    label: "Rx",
  },
  {
    bg: "linear-gradient(135deg, #E8F5F3 0%, #FEF3E2 100%)",
    icon: <FiCheckCircle />,
    label: "Done",
  },
];

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

  class Particle {
    constructor(canvas) {
      this.canvas = canvas;
      this.init();
    }

    init() {
      this.x = Math.random() * this.canvas.width;
      this.y = Math.random() * this.canvas.height;
      this.vx = 0;
      this.vy = 0;
      this.age = 0;
      this.maxAge = Math.random() * 200 + 100;
      this.color = Math.random() > 0.5 ? "#3B372E" : "#24221D";
    }

    update(mouse, noiseScale = 0.005) {
      // Base Flow Logic
      let angle =
        (Math.sin(this.x * noiseScale) + Math.cos(this.y * noiseScale)) *
        Math.PI *
        2;
      this.vx = Math.cos(angle) * 1.2;
      this.vy = Math.sin(angle) * 1.2;

      // STRONG REPULSION LOGIC
      let dx = this.x - mouse.x;
      let dy = this.y - mouse.y;
      let distance = Math.sqrt(dx * dx + dy * dy);
      let forceRadius = 150;

      if (distance < forceRadius) {
        let force = (forceRadius - distance) / forceRadius;
        let dirX = dx / distance;
        let dirY = dy / distance;
        this.vx += dirX * force * 5; // Push away force
        this.vy += dirY * force * 5;
      }

      this.x += this.vx;
      this.y += this.vy;
      this.age++;

      if (
        this.x < 0 ||
        this.x > this.canvas.width ||
        this.y < 0 ||
        this.y > this.canvas.height ||
        this.age > this.maxAge
      ) {
        this.init();
      }
    }

    draw(ctx) {
      ctx.beginPath();
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1;
      ctx.moveTo(this.x - this.vx, this.y - this.vy);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
    }
  }

  class Hologram {
    constructor(canvas, type) {
      this.canvas = canvas;
      this.type = type;
      this.x = Math.random() * (canvas.width - 200) + 100;
      this.y = Math.random() * (canvas.height - 200) + 100;
      this.opacity = 0;
      this.maxOpacity = 0.6;
      this.scale = 0.5;
      this.state = "fadein"; // fadein, float, fadeout
      this.timer = 0;
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(this.scale, this.scale);
      ctx.strokeStyle = `rgba(45, 212, 191, ${this.opacity})`;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.shadowBlur = 15;
      ctx.shadowColor = "#2dd4bf";

      ctx.beginPath();
      // if (this.type === "heart") this.drawHeart(ctx);
      // if (this.type === "eye") this.drawEye(ctx);
      // if (this.type === "cross") this.drawCross(ctx);
      // if (this.type === "dna") this.drawDNA(ctx);
      ctx.stroke();
      ctx.restore();
    }

    drawHeart(ctx) {
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-10, -10, -20, 0, 0, 20);
      ctx.bezierCurveTo(20, 0, 10, -10, 0, 0);
    }

    drawEye(ctx) {
      ctx.arc(0, 0, 15, 0, Math.PI * 2); // Outer
      ctx.moveTo(-5, 0);
      ctx.lineTo(5, 0); // Pupil
    }

    drawCross(ctx) {
      ctx.moveTo(-10, 0);
      ctx.lineTo(10, 0);
      ctx.moveTo(0, -10);
      ctx.lineTo(0, 10);
    }

    drawDNA(ctx) {
      ctx.moveTo(-10, -10);
      ctx.quadraticCurveTo(0, 0, 10, -10);
      ctx.moveTo(-10, 10);
      ctx.quadraticCurveTo(0, 0, 10, 10);
    }

    update() {
      this.timer++;
      if (this.state === "fadein") {
        this.opacity += 0.01;
        this.scale += 0.005;
        if (this.opacity >= this.maxOpacity) this.state = "float";
      } else if (this.state === "float") {
        this.y += Math.sin(this.timer * 0.05) * 0.2;
        if (this.timer > 200) this.state = "fadeout";
      } else {
        this.opacity -= 0.01;
        if (this.opacity <= 0) return false;
      }
      return true;
    }
  }

  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return; // Add null check

    const ctx = canvas.getContext("2d");
    if (!ctx) return; // Add context check

    let particles = [];
    let holograms = [];
    let animationFrameId;
    let spawnInterval;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const spawnHologram = () => {
      const types = ["heart", "eye", "cross", "dna"];
      const randomType = types[Math.floor(Math.random() * types.length)];
      holograms.push(new Hologram(canvas, randomType));
    };

    const handleMouseMove = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const animate = () => {
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.update(mouseRef.current);
        p.draw(ctx);
      });

      holograms = holograms.filter((h) => {
        const alive = h.update();
        if (alive) h.draw(ctx);
        return alive;
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove);

    for (let i = 0; i < 700; i++) {
      particles.push(new Particle(canvas));
    }

    spawnInterval = setInterval(spawnHologram, 5000);
    animate();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
      clearInterval(spawnInterval);
    };
  }, []);

  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [timerOffset, setTimerOffset] = useState(CIRCUMFERENCE);
  const elapsedRef = useRef(0);
  const lastTickRef = useRef(Date.now());
  const rafRef = useRef(null);
  const pausedRef = useRef(false);
  const currentRef = useRef(0);

  // Keep refs in sync
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  const tick = useCallback(() => {
    if (pausedRef.current) return;
    const now = Date.now();
    elapsedRef.current += now - lastTickRef.current;
    lastTickRef.current = now;

    const pct = elapsedRef.current / STEP_DURATION;
    setTimerOffset(CIRCUMFERENCE * (1 - pct));

    if (elapsedRef.current >= STEP_DURATION) {
      elapsedRef.current = 0;
      setCurrent((prev) => (prev + 1) % TOTAL_STEPS);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    lastTickRef.current = Date.now();
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  const jumpTo = (step) => {
    elapsedRef.current = 0;
    lastTickRef.current = Date.now();
    setCurrent(step);
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
  const currentStepProgress = 1 - timerOffset / CIRCUMFERENCE;
  // Divide by TOTAL_STEPS so progress continues during the last step
  let progressPct = ((current + currentStepProgress) / TOTAL_STEPS) * 100;
  progressPct = Math.min(progressPct, 100); // Cap at 100%

  const items = ["figma", "framer", "webflow", "raycast", "supabase", "clerk"];

  const trackRef = useRef(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const buildSet = (copies) => {
      track.innerHTML = "";
      for (let c = 0; c < copies; c++) {
        items.forEach((item) => {
          const tag = document.createElement("span");
          tag.className = "sb-tag";
          tag.textContent = item;
          track.appendChild(tag);
        });
        // optional separator
        const sep = document.createElement("span");
        sep.className = "sb-sep";
        sep.textContent = "\u00A0"; // small gap
        track.appendChild(sep);
      }
    };

    const recalc = () => {
      // 1) build a single set to measure width
      buildSet(1);

      requestAnimationFrame(() => {
        const singleWidth = track.scrollWidth || 0; // width of one set
        const containerWidth =
          track.parentElement?.clientWidth || window.innerWidth;

        // Determine how many copies we need so the scrolling content always exceeds the viewport
        const minNeeded = Math.ceil(
          (containerWidth * 2) / Math.max(singleWidth, 1),
        );
        const copies = Math.max(2, minNeeded);

        buildSet(copies);

        // expose width of one copy for the CSS animation to translate by
        track.style.setProperty("--scroll-width", `${singleWidth}px`);
      });
    };

    recalc();
    window.addEventListener("resize", recalc);

    return () => window.removeEventListener("resize", recalc);
  }, [items]);

  const smallCards = [
    {
      id: "mental-health",
      icon: FaBrain,
      title: "Mental Health",
      description:
        "Therapy, psychiatry, anxiety & depression treatment with licensed therapists and psychiatrists.",
      cta: "Get support →",
    },
    {
      id: "general-consultation",
      icon: FaStethoscope,
      title: "General Consultation",
      description:
        "Sick visits, wellness checks, infections, minor injuries — same-day access to a doctor for whatever is on your mind.",
      cta: "See a doctor →",
    },
    {
      id: "sexual-health",
      icon: FaHeart,
      title: "Sexual Health",
      description:
        "Confidential, judgment-free care for STI testing, ED, birth control, UTIs, and more.",
      cta: "Learn more →",
    },
    {
      id: "chronic-care",
      icon: FaHeartbeat,
      title: "Chronic Care",
      description:
        "Ongoing support for diabetes, hypertension, thyroid, and asthma with a dedicated care team.",
      cta: "Manage condition →",
    },
  ];

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
    <>
      {/* ════════════════════ HERO section ═════════════════════════════════════════════ */}
      <section className="hero">
        {/* <canvas ref={canvasRef} className="hero-canvas"></canvas> */}
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
            care from board-certified physicians — without leaving home.
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
            <span className="trust-chip">
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
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="step-dots">
              {DOT_LABELS.map((label, i) => {
                const isActive = i === current;
                const isCompleted = i < current;
                // Calculate progress: convert timerOffset (0-CIRCUMFERENCE) to STEP_CIRCUMFERENCE range
                const progress = isActive
                  ? timerOffset / CIRCUMFERENCE
                  : isCompleted
                    ? 0
                    : 1;
                const progressOffset = progress * STEP_CIRCUMFERENCE;
                return (
                  <div
                    key={i}
                    className={`step-dot${isActive ? " active" : ""}${isCompleted ? " completed" : ""}`}
                    onClick={() => jumpTo(i)}
                  >
                    <div className="ring">
                      <svg className="progress-ring" viewBox="0 0 44 44">
                        <circle
                          className="progress-ring-bg"
                          cx="22"
                          cy="22"
                          r="20"
                        />
                        <circle
                          className="progress-ring-fill"
                          cx="22"
                          cy="22"
                          r="20"
                          style={{
                            strokeDasharray: STEP_CIRCUMFERENCE,
                            strokeDashoffset: progressOffset,
                          }}
                        />
                      </svg>
                      <div className="ring-icon">{STEP_ICONS[i]}</div>
                    </div>
                    <span className="dot-label">{label}</span>
                  </div>
                );
              })}
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
                      className={`scene-content-container${isActive ? " active" : ""
                        }${isExitUp ? " exit-up" : ""}`}
                    >
                      <div className="scene-content">
                        <div className="scene-step-badge">
                          <span className="num">{scene.step}</span>
                          {scene.badge}
                        </div>

                        {/* ✅ WORD REVEAL APPLIED HERE */}
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

        <div className="sb-bar">
          <div className="sb-track" ref={trackRef} />
        </div>
      </section>
      {/* ════════════════════ HERO section ═════════════════════════════════════════════ */}

      <section className="services-section-wrapper">
        <div className="services-inner-container">
          {/* Section Header */}
          <div className="services-header-block">
            <span className="services-eyebrow-label">— SERVICES</span>
            <h2 className="services-main-heading">
              Everything you need,
              <br />
              <span className="services-heading-highlight">
                all in one place.
              </span>
            </h2>
          </div>

          {/* Bento Grid */}
          <div className="services-bento-grid">
            {/* Large Product Card - Top Left */}
            <div className="services-card-item services-bento-large">
              <span className="services-feature-badge">MOST REQUESTED</span>
              <div className="services-icon-box">
                <FaPills />
              </div>
              <div className="services-content-split">
                {/* Left Side - Title and Description */}
                <div className="services-content-left">
                  <h3 className="services-card-title">Prescription Refills</h3>
                  <p className="services-card-description">
                    Running low on medication? Fast-track refill from a licensed
                    provider — often within the same day. No appointment
                    required. Works even if you're between doctors.
                  </p>
                </div>

                {/* Right Side - Stats */}
                <div className="services-content-right">
                  <div className="services-stat-mini">
                    <span className="services-stat-value-text">2 hrs</span>
                    <span className="services-stat-label-text">Avg. time</span>
                  </div>
                  <div className="services-stat-mini">
                    <span className="services-stat-value-text">94%</span>
                    <span className="services-stat-label-text">Same-day</span>
                  </div>
                </div>
              </div>

              <a href="#" className="services-card-cta-link">
                Request refill →
              </a>
            </div>

            {/* Weight Loss - Top Right (Tall) */}
            <div className="services-card-item services-bento-small-weightloss">
              <div className="services-icon-box services-icon-box--gold">
                <FaBalanceScale />
              </div>
              <h3 className="services-card-title">Weight Loss Programs</h3>
              <p className="services-card-description">
                Personalized plans including GLP-1 medications (Ozempic,
                Wegovy), lifestyle coaching, and monthly monitoring.
              </p>
              <div className="services-weight-stat-block">
                <span className="services-weight-stat-eyebrow">
                  AVG. WEIGHT LOSS
                </span>
                <div className="services-weight-stat-row">
                  <span className="services-weight-stat-number">15 lbs</span>
                  <span className="services-weight-stat-period">
                    / 3 months
                  </span>
                </div>
              </div>
              <a href="#" className="services-card-cta-link">
                Start program →
              </a>
            </div>

            {/* Mental Health - Middle Left (Tall) */}
            <div className="services-card-item services-bento-smal-1">
              <div className="services-icon-box">
                <FaBrain />
              </div>
              <h3 className="services-card-title">Mental Health</h3>
              <p className="services-card-description">
                Professional therapy, psychiatry, and counseling for anxiety,
                depression, and stress management.
              </p>
              <a href="#" className="services-card-cta-link">
                Get support →
              </a>
            </div>

            {/* Chronic Care - Middle Right */}

            {/* General Consultation - Bottom Left */}
            <div className="services-card-item services-bento-small">
              <div className="services-icon-box">
                <FaStethoscope />
              </div>
              <h3 className="services-card-title">General Consultation</h3>
              <p className="services-card-description">
                Sick visits, wellness checks, infections, minor injuries.
                Same-day access to a doctor.
              </p>
              <a href="#" className="services-card-cta-link">
                See a doctor →
              </a>
            </div>

            {/* Sexual Health - Bottom Right */}
            <div className="services-card-item services-bento-small">
              <div className="services-icon-box">
                <FaHeart />
              </div>
              <h3 className="services-card-title">Sexual Health</h3>
              <p className="services-card-description">
                Confidential, judgment-free care for STI testing, ED, birth
                control, and more.
              </p>
              <a href="#" className="services-card-cta-link">
                Learn more →
              </a>
            </div>
            <div className="services-card-item services-bento-wide">
              <div className="services-icon-box">
                <FaHeartbeat />
              </div>
              <h3 className="services-card-title">Chronic Care</h3>
              <p className="services-card-description">
                Ongoing support for diabetes, hypertension, thyroid, and asthma
                with a dedicated care team.
              </p>
              <a href="#" className="services-card-cta-link">
                Manage condition →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SPECIALTIES
      ══════════════════════════════════════════════ */}
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
                  className={`aa-tab ${activeTab === "specialties" ? "aa-tab-active" : ""
                    } ${hovered === 0 ? "aa-tab-hovered" : ""} ${hovered !== null && hovered !== 0 ? "aa-tab-inactive" : ""
                    }`}
                  onClick={() => handleTabChange("specialties")}
                  onMouseEnter={() => setHovered(0)}
                >
                  Specialties
                </button>
                <button
                  ref={(el) => (tabRefs.current[1] = el)}
                  className={`aa-tab ${activeTab === "symptoms" ? "aa-tab-active" : ""
                    } ${hovered === 1 ? "aa-tab-hovered" : ""} ${hovered !== null && hovered !== 1 ? "aa-tab-inactive" : ""
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
      {/* ══════════════════════════════════════════════
          DOCTORS
      ══════════════════════════════════════════════ */}
      <section className="pcp-section-wrapper">
        <div className="pcp-container">
          {/* HEADER */}
          <div className="pcp-header">
            <span className="pcp-eyebrow">— NO PCP? NO PROBLEM.</span>

            <h2 className="pcp-heading">
              Don't have a primary care doctor?
              <span>We've got you.</span>
            </h2>

            <p className="pcp-desc">
              Millions of Americans lack access to a regular physician. MediLink
              bridges that gap — giving you instant access to licensed providers
              who can serve as your primary care team.
            </p>
          </div>

          {/* LEFT - Features */}
          <div className="pcp-left">
            <div className="pcp-features">
              <div className="pcp-feature">
                <div className="pcp-icon">
                  <FaFileMedical />
                </div>
                <div>
                  <h4>Acts as Your PCP</h4>
                  <p>
                    Our providers manage ongoing health, maintain your records,
                    and coordinate specialist referrals.
                  </p>
                </div>
              </div>

              <div className="pcp-feature">
                <div className="pcp-icon">
                  <FaSyncAlt />
                </div>
                <div>
                  <h4>Continuity of Care</h4>
                  <p>
                    Build a relationship with the same doctor across visits.
                    Your health history stays in one secure place.
                  </p>
                </div>
              </div>

              <div className="pcp-feature">
                <div className="pcp-icon">
                  <FaCalendarAlt />
                </div>
                <div>
                  <h4>365 Days a Year</h4>
                  <p>
                    No more 3-week waits. Connect the same day — including
                    evenings and weekends.
                  </p>
                </div>
              </div>
            </div>

            {/* <button className="pcp-btn">
              Get a doctor today — free to start
            </button> */}
            <button className="pcp-btn">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              Get a doctor today — free to start
            </button>
          </div>

          {/* RIGHT */}
          <div className="pcp-right">
            <h3 className="pcp-right-title">Your first visit, step by step</h3>

            <div className="pcp-steps">
              {[1, 2, 3, 4, 5].map((step, i) => {
                const data = [
                  [
                    "Create your free account",
                    "Under 2 minutes. No credit card required.",
                  ],
                  [
                    "Complete a health intake",
                    "Share your medical history and current medications.",
                  ],
                  [
                    "Match with a provider",
                    "We surface the best-fit doctor for your needs and state.",
                  ],
                  [
                    "Start your video visit",
                    "Meet face-to-face from anywhere, on any device.",
                  ],
                  [
                    "Receive care instantly",
                    "Prescription sent to your pharmacy within minutes.",
                  ],
                ];

                return (
                  <div className="pcp-step" key={i}>
                    <div className="pcp-step-circle">{step}</div>
                    <div>
                      <h4>{data[i][0]}</h4>
                      <p>{data[i][1]}</p>
                    </div>
                  </div>
                );
              })}
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
                  94<span style={{ fontSize: "24px" }}>%</span>
                </div>
                <div className="sc-sub">After 3 months on Humancare</div>
                <div className="sc-divider"></div>
                <div className="sc-row">
                  <span>Visit completion rate</span>
                  <strong>98.2%</strong>
                </div>
                <div className="sc-prog">
                  <div className="sc-fill" style={{ width: "98%" }}></div>
                </div>
                <div className="sc-row">
                  <span>Prescription accuracy</span>
                  <strong>99.7%</strong>
                </div>
                <div className="sc-prog">
                  <div
                    className="sc-fill"
                    style={{
                      width: "99.7%",
                      background:
                        "linear-gradient(90deg,var(--teal),var(--gold))",
                    }}
                  ></div>
                </div>
              </div>
              <div className="stat-float sf1">
                <div className="sf-label">Patients served</div>
                <div className="sf-val" style={{ color: "var(--primary)" }}>
                  2.4M+
                </div>
              </div>
              <div className="stat-float sf2">
                <div className="sf-label">Avg. response</div>
                <div className="sf-val" style={{ color: "var(--teal)" }}>
                  &lt;4 min
                </div>
              </div>
              <div className="stat-float sf3">
                <div className="sf-label">Rating</div>
                <div className="sf-val" style={{ color: "var(--gold)" }}>
                  4.9 ★
                </div>
              </div>
            </div>

            <div>
              <div className="section-eyebrow">Why Humancare</div>
              <h2 className="section-title" style={{ marginBottom: "34px" }}>
                Built on trust, at every step.
              </h2>
              <div className="why-list">
                <div className="why-item reveal">
                  {/* <div className="why-icon">🔒</div> */}
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
                </div>
                <div className="why-item reveal">
                  {/* <div className="why-icon">✅</div> */}
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
                </div>
                <div className="why-item reveal">
                  {/* <div className="why-icon">💳</div> */}
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
                </div>
                <div className="why-item reveal">
                  {/* <div className="why-icon">📞</div> */}
                  <div>
                    <div className="why-item-title">24 / 7 Human Support</div>
                    <div className="why-item-desc">
                      Real people — by chat, phone, or video — available around
                      the clock for urgent questions, escalations, and care
                      coordination.
                    </div>
                  </div>
                </div>
              </div>
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
          modules={[Pagination]}
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
