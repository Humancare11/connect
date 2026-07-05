import React, {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import "./home.css";
const Sa = lazy(() => import("../components/Sa"));
const Aa = lazy(() => import("../components/Aa"));
// import sceneVideo from "../assets/gifts/scene-card-bg-video.mp4";
import sceneVideo from "../assets/gifts/HeroVideo.mp4";
import heroPoster from "../assets/gifts/HeroPoster.webp";
import WordReveal from "../components/WordReveal";
import StepProgress from "../components/StepProgress";
const LogoMarquee = lazy(() => import("../components/LogoMarquee"));
import {
  FiSmartphone,
  FiUserCheck,
  FiClock,
  FiVideo,
  FiFileText,
  FiCheckCircle,
} from "react-icons/fi";

import searchIndex from "../data/searchIndex.js";
import { searchTreatments } from "../utils/search";

import { useNavigate } from "react-router-dom";

import LazySection from "../components/LazySection";

const PCP = lazy(() => import("../components/PCPSection"));
const Why = lazy(() => import("../components/WhySection"));

// ─── Scene data ───────────────────────────────────────────────────────────────
const SCENES = [
  {
    step: 1,
    badge: "Create Account",
    title: " Create your account",
    desc: " Sign up in under a minute. Registration is frictionless and seamless.",
    metricValue: "< 10s",
    metricLabel: " Sign-up time",
    metricIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    step: 2,
    badge: "Choose Service",
    title: "Choose the service you need",
    desc: "Browse by category, specialty, or condition, or describe your concern. From general care to travel medicine, pick the right service in a few taps.",
    metricValue: "30+",
    metricLabel: "Specialties available",
    metricIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
      </svg>
    ),
  },
  {
    step: 3,
    badge: "Book Appointment",
    title: "Book your appointment",
    desc: "We match you with a verified doctor and confirm a time that works. No waiting rooms, no phone tag, just a slot that fits your day.",
    metricValue: " 24/7",
    metricLabel: "Booking availability",
    metricIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    step: 4,
    badge: "Consult",
    title: "Consult your doctor",
    desc: " Connect by secure video from anywhere. Discuss your symptoms, get a diagnosis, and ask everything you need, face to face.",
    metricValue: "100% ",
    metricLabel: " erified physicians",
    metricIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    step: 5,
    badge: " Rx & Complete",
    title: "Get your Rx and complete",
    desc: "Receive your prescription and visit summary right in your dashboard. Care is documented, secure, and ready when you need it.",
    metricValue: "< 30s ",
    metricLabel: "Total to prescription",
    metricIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  // {
  //   step: 6,
  //   badge: "Done",
  //   title: "Visit Complete!",
  //   desc: "Rate your experience, schedule follow ups, and access visit notes, all from one dashboard.",
  //   metricValue: "4.9 ★",
  //   metricLabel: "Avg rating",
  //   metricIcon: (
  //     <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
  //       <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
  //     </svg>
  //   ),
  // },
];

const STEP_ICONS = [
  <FiSmartphone key="smartphone" />,
  <FiUserCheck key="usercheck" />,
  <FiClock key="clock" />,
  <FiVideo key="video" />,
  <FiFileText key="filetext" />,
];

const DOT_LABELS = [
  " Create Account",
  "Choose Service",
  "Book Appointment",
  "Consult",
  " Rx & Complete",
];
const TOTAL_STEPS = 5;
const STEP_DURATION = 4000;
const CIRCUMFERENCE = 2 * Math.PI * 10;
const STEP_CIRCUMFERENCE = 2 * Math.PI * 20;

export default function HomePage() {
  const navigate = useNavigate();

  // ── Search state ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchRef = useRef(null);
  const [noResults, setNoResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const itemRefs = useRef([]);

  useEffect(() => {
    if (activeIndex >= 0 && itemRefs.current[activeIndex]) {
      itemRefs.current[activeIndex].scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [activeIndex]);
  // Video lazy loading with Intersection Observer
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShouldLoadVideo(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }, // Load before visible
    );

    const videoSection = rightRef.current;
    if (videoSection) observer.observe(videoSection);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSuggestions([]);
      setNoResults(false);
      return;
    }

    setIsSearching(true);
    setNoResults(false);

    // small debounce just for smoother UX while typing
    const delay = setTimeout(() => {
      const { conditions } = searchTreatments(searchQuery);
      setFilteredSuggestions(conditions);
      setNoResults(conditions.length === 0);
      setIsSearching(false);
    }, 150);

    return () => clearTimeout(delay);
  }, [searchQuery]);

  // ── Close dropdown on outside click ──────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Navigate on search ────────────────────────────────────────────────────
  const handleSearch = useCallback(
    (selectedItem = null) => {
      const item = selectedItem || filteredSuggestions[0];
      if (!item) return;
      navigate(item.route); // route is already the full path, e.g. "/knee-pain"
      setSearchQuery("");
      setShowSuggestions(false);
    },
    [filteredSuggestions, navigate],
  );

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e) => {
      if (!filteredSuggestions.length) return;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) =>
            prev < filteredSuggestions.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) =>
            prev > 0 ? prev - 1 : filteredSuggestions.length - 1,
          );
          break;
        case "Enter":
          e.preventDefault();
          if (activeIndex >= 0) {
            handleSearch(filteredSuggestions[activeIndex]);
          } else {
            handleSearch();
          }
          break;
        case "Escape":
          setShowSuggestions(false);
          break;
        default:
          break;
      }
    },
    [filteredSuggestions, activeIndex, handleSearch],
  );

  // ── Testimonials data ─────────────────────────────────────────────────────
  const testimonials = [
    {
      id: 1,
      quote:
        "Saw a doctor within 4 minutes of signing up. Had my prescription at the pharmacy an hour later. This completely changed how I think about healthcare.",
      name: "Alex M.",
    },
    {
      id: 2,
      quote:
        "As someone without insurance, the flat $49 fee was a revelation. Dr. Nair took 45 full minutes with me. I felt truly heard for the first time in years.",
      name: "Jordan S.",
    },
    {
      id: 3,
      quote:
        "My daughter had a fever at 2am. We got a same-night video call with a pediatrician who was calm, thorough, and reassuring. Absolute lifesaver.",
      name: "Rachel P.",
    },
    {
      id: 4,
      quote:
        "Managing my chronic condition used to mean multiple in-office visits a month. Now I check in via video and my health has genuinely improved — costs way down too.",
      name: "David T.",
    },
    {
      id: 5,
      quote:
        "My therapist on Humancare remembers every detail, follows up proactively, and has been a genuine partner in my recovery. Exceptional mental health care.",
      name: "Laura K.",
    },
  ];

  // ── Intersection observer for reveal animations ───────────────────────────
  useEffect(() => {
    const ro = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("in");
        });
      },
      { threshold: 0.12 },
    );
    document.querySelectorAll(".reveal").forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, []);

  // ── Step carousel state & refs ────────────────────────────────────────────
  const [current, setCurrent] = useState(0);

  const timerOffsetRef = useRef(CIRCUMFERENCE);
  const elapsedRef = useRef(0);
  // Fix: initialise with a stable value (not Date.now() during render)
  const lastTickRef = useRef(0);
  const rafRef = useRef(null);
  const pausedRef = useRef(false);
  const currentRef = useRef(0);
  const progressFillRef = useRef(null);
  const ringFillRefs = useRef([]);

  // Keep refs in sync with state
  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  // ── Visual update (ring + progress bar) ──────────────────────────────────
  const updateVisuals = useCallback(() => {
    const currentIdx = currentRef.current;
    const timerOffset = timerOffsetRef.current;
    const currentStepProgress = 1 - timerOffset / CIRCUMFERENCE;
    let progressPct = ((currentIdx + currentStepProgress) / TOTAL_STEPS) * 100;
    progressPct = Math.min(progressPct, 100);

    if (progressFillRef.current) {
      progressFillRef.current.style.width = `${progressPct}%`;
    }

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
      el.style.strokeDashoffset = String(progressOffset);
    });
  }, []);

  // ── handleProgress passed to StepProgress child ───────────────────────────
  const handleProgress = useCallback(
    (progress) => {
      const frac = Math.min(Math.max(progress, 0), 1);
      const total = frac * TOTAL_STEPS;
      const idx = Math.min(Math.floor(total), TOTAL_STEPS - 1);
      const inStep = total - idx;

      if (currentRef.current !== idx) {
        setCurrent(idx);
        currentRef.current = idx;
      }
      elapsedRef.current = inStep * STEP_DURATION;
      timerOffsetRef.current = CIRCUMFERENCE * (1 - inStep);
      updateVisuals();
    },
    [updateVisuals],
  );

  // ── Animation tick ────────────────────────────────────────────────────────
  // Declared with useRef so it can reference itself without circular deps
  const tickRef = useRef(null);

  tickRef.current = () => {
    if (pausedRef.current) return;

    const now = performance.now();
    if (lastTickRef.current === 0) {
      // First tick after mount / resume — set baseline without adding delta
      lastTickRef.current = now;
    } else {
      elapsedRef.current += now - lastTickRef.current;
      lastTickRef.current = now;
    }

    const pct = Math.min(elapsedRef.current / STEP_DURATION, 1);
    timerOffsetRef.current = CIRCUMFERENCE * (1 - pct);
    updateVisuals();

    if (elapsedRef.current >= STEP_DURATION) {
      elapsedRef.current = 0;
      setCurrent((prev) => {
        const next = (prev + 1) % TOTAL_STEPS;
        currentRef.current = next;
        return next;
      });
    }
    rafRef.current = requestAnimationFrame(() => tickRef.current?.());
  };

  useEffect(() => {
    ringFillRefs.current = ringFillRefs.current.slice(0, TOTAL_STEPS);
    updateVisuals();
    lastTickRef.current = 0; // reset so first tick sets baseline
    rafRef.current = requestAnimationFrame(() => tickRef.current?.());

    // Pause animation when page not visible
    const handleVisibilityChange = () => {
      if (document.hidden) {
        pausedRef.current = true;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      } else {
        pausedRef.current = false;
        lastTickRef.current = 0;
        rafRef.current = requestAnimationFrame(() => tickRef.current?.());
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Also pause when scrolled out of view
    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries[0].isIntersecting;
        if (!isVisible && !pausedRef.current) {
          // Going out of view - pause
          pausedRef.current = true;
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
        } else if (isVisible && pausedRef.current && !document.hidden) {
          // Coming into view and not paused by visibility - resume
          pausedRef.current = false;
          lastTickRef.current = 0;
          rafRef.current = requestAnimationFrame(() => tickRef.current?.());
        }
      },
      { threshold: 0 },
    );

    if (rightRef.current) observer.observe(rightRef.current);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      observer.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [updateVisuals]);

  // ── GSAP scroll-pinned section refs ──────────────────────────────────────
  const wrapperRef = useRef(null);
  const headerRef = useRef(null);
  const featuresRef = useRef([]);
  const btnRef = useRef(null);
  const rightRef = useRef(null);

  useEffect(() => {
    let ctx;
    let cancelled = false;

    // Use requestIdleCallback to defer non-critical animations until after paint
    const idleCallback =
      window.requestIdleCallback || ((cb) => setTimeout(cb, 1));

    idleCallback(() => {
      import("gsap").then(({ default: gsap }) => {
        if (cancelled) return;

        ctx = gsap.context(() => {
          const tl = gsap.timeline();

          tl.fromTo(
            headerRef.current,
            { opacity: 0, y: 60 },
            { opacity: 1, y: 0, duration: 1.2 },
          );
          tl.fromTo(
            featuresRef.current[0],
            { opacity: 0, x: -70 },
            { opacity: 1, x: 0, duration: 0.8 },
            "+=0.2",
          );
          tl.fromTo(
            featuresRef.current[1],
            { opacity: 0, x: -70 },
            { opacity: 1, x: 0, duration: 0.8 },
            "+=0.1",
          );
          tl.fromTo(
            featuresRef.current[2],
            { opacity: 0, x: -70 },
            { opacity: 1, x: 0, duration: 0.8 },
            "+=0.1",
          );
          tl.fromTo(
            btnRef.current,
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration: 0.7 },
            "+=0.1",
          );
          tl.fromTo(
            rightRef.current,
            { opacity: 0, y: 80, scale: 0.95 },
            { opacity: 1, y: 0, scale: 1, duration: 1.2, ease: "power3.out" },
            "+=0.3",
          );
        }, wrapperRef);
      });
    });

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, []);

  // ── Testimonials parallax ─────────────────────────────────────────────────
  const testimonialsRef = useRef(null);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const section = testimonialsRef.current;
          if (!section) return;

          const rect = section.getBoundingClientRect();
          const viewH = window.innerHeight;
          const progress = (viewH - rect.top) / (viewH + rect.height);
          const p = Math.max(0, Math.min(1, progress));
          const offset = (p - 0.5) * 120;

          // Apply subtle parallax to the header inside the section
          const header = section.querySelector(".testi-header");
          if (header) {
            header.style.transform = `translateY(${offset * 0.3}px)`;
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="hero-light" />
      <div className="hero-grid" />

      {/* ════════ HERO ═══════════════════════════════════════════════════════ */}
      <section className="hero">
        {/* ── LEFT ── */}
        <div className="hero-left" ref={headerRef}>
          <div className="hero-badge">
            <div className="badge-pulse" />
            Available 24/7
          </div>

          <h1>
            Talk to a <span className="fancy-underline">licensed doctor </span>
            {/* <br /> */}
            in minutes.
          </h1>

          <p>
            Get fast, reliable telemedicine services from board-certified
            healthcare providers without leaving home. Schedule an online doctor
            appointment, discuss symptoms, receive treatment guidance, and get
            prescriptions through our secure virtual healthcare platform
            available across globally.
          </p>
          <div className="trust" ref={btnRef}>
            <span className="trust-chip">
              <svg
                width="12"
                height="12"
                fill="none"
                stroke="#7CB7FF"
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
                stroke="#7CB7FF"
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
                stroke="#7CB7FF"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Board-Certified Doctor's
            </span>

            <span className="trust-chip">
              <svg
                width="12"
                height="12"
                fill="none"
                stroke="#7CB7FF"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Rx / Sick Note's Available
            </span>
          </div>
          {/* SEARCH BAR */}
          <div className="search-wrapper" ref={searchRef}>
            <div className="search-bar">
              <input
                type="text"
                value={searchQuery}
                placeholder="Search doctors, specialties, conditions..."
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={handleKeyDown}
              />
              <button onClick={() => handleSearch()}>Search</button>
            </div>

            {showSuggestions && searchQuery.trim() && (
              <div className="search-suggestions">
                {/* Loading state */}
                {isSearching && (
                  <div className="search-state">
                    <div className="search-state-icon searching-pulse">
                      <svg
                        width="20"
                        height="20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35" />
                      </svg>
                    </div>
                    <span className="search-state-text">
                      Searching treatments...
                    </span>
                  </div>
                )}

                {/* No results state */}
                {!isSearching && noResults && (
                  <div className="search-state no-results">
                    <div className="search-state-icon">
                      <svg
                        width="22"
                        height="22"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        viewBox="0 0 24 24"
                      >
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35" />
                        <path d="M8 11h6M11 8v6" strokeOpacity="0.3" />
                      </svg>
                    </div>
                    <div className="search-state-content">
                      <span className="search-state-title">
                        No treatments found for "{searchQuery}"
                      </span>
                      <span className="search-state-subtitle">
                        Try searching by symptom, condition, or specialty
                      </span>
                    </div>
                    <div className="search-state-suggestions">
                      <span>Try:</span>
                      {["Anxiety", "Knee Pain", "Diabetes", "Skin Rash"].map(
                        (s) => (
                          <button
                            key={s}
                            className="search-pill"
                            onClick={() => {
                              setSearchQuery(s);
                              setShowSuggestions(true);
                            }}
                          >
                            {s}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                )}

                {/* Results */}
                {!isSearching &&
                  !noResults &&
                  (itemRefs.current = itemRefs.current.slice(
                    0,
                    filteredSuggestions.length,
                  )) &&
                  filteredSuggestions.map((item, index) => (
                    <div
                      key={item.id}
                      ref={(el) => (itemRefs.current[index] = el)}
                      className={`suggestion-item${activeIndex === index ? " active" : ""}`}
                      onClick={() => handleSearch(item)}
                    >
                      <div className="suggestion-left">
                        <span className="suggestion-title">{item.title}</span>
                      </div>
                      <span className="suggestion-arrow">→</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT ── */}
        <div className="hero-right" ref={rightRef}>
          {shouldLoadVideo && (
            <video
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              poster={heroPoster}
              className="hero-right-video-bg"
            >
              <source src={sceneVideo} type="video/mp4" />
            </video>
          )}

          <div className="hero-right-overlay" />

          <div className="timeline-container">
            <div className="t-orb t-orb-1" />
            <div className="t-orb t-orb-2" />
            <div className="t-orb t-orb-3" />

            <div className="timeline-header">
              <div className="eyebrow-hero">
                The Humancare Connect Experience
              </div>
              <h3>
                Your Visit in <span>30 Seconds</span>
              </h3>
              <p>
                {" "}
                From sign-up to prescription, five simple steps to care anywhere
                in the world.
              </p>
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
                {SCENES.map((scene, i) => {
                  const isActive = i === current;
                  const isExitUp =
                    i === (current - 1 + TOTAL_STEPS) % TOTAL_STEPS &&
                    current !== 0;

                  return (
                    <div
                      key={i}
                      className={`scene-content-container${isActive ? " active" : ""}${isExitUp ? " exit-up" : ""}`}
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
                          {/* <div className="metric-icon">{scene.metricIcon}</div> */}
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

      {/* ════════ LOGO MARQUEE ═══════════════════════════════════════════════ */}
      <LazySection>
        <Suspense fallback={null}>
          <LogoMarquee />
        </Suspense>
      </LazySection>

      {/* ════════ SERVICES ═══════════════════════════════════════════════════ */}
      <LazySection>
        <Suspense fallback={null}>
          <Sa />
        </Suspense>
      </LazySection>

      {/* ════════ SPECIALTIES ════════════════════════════════════════════════ */}
      <LazySection>
        <Suspense fallback={null}>
          <Aa />
        </Suspense>
      </LazySection>

      {/* ════════ HOW IT WORKS / PCP ════════════════════════════════════════ */}
      <LazySection>
        <Suspense fallback={null}>
          <PCP />
        </Suspense>
      </LazySection>

      {/* ════════ WHY HUMANCARE ═════════════════════════════════════════════ */}

      <LazySection>
        <Suspense fallback={null}>
          <Why />
        </Suspense>
      </LazySection>

      {/* ════════ TESTIMONIALS ══════════════════════════════════════════════ */}
      <section
        className="testimonials-section reveal reveal-stagger"
        ref={testimonialsRef}
      >
        <div className="testi-header">
          <div className="testi-eyebrow">Testimonials</div>
          <h2 className="testi-title">
            What patients are saying about Humancare Connect.
          </h2>
          <p className="testi-desc">
            Real stories. Real care. Real results from trusted virtual
            healthcare services and licensed online doctors.
          </p>
        </div>

        <div className="testi-marquee-container">
          {/* ROW 1 — Left to Right */}
          <div className="testi-marquee-row marquee-left">
            {[...testimonials, ...testimonials].map((t, i) => (
              <div className="testi-card-v2" key={`r1-${i}`}>
                <p className="testi-quote">&ldquo;{t.quote}&rdquo;</p>
                <div className="testi-author-simple">— {t.name}</div>
              </div>
            ))}
          </div>

          {/* ROW 2 — Right to Left */}
          <div className="testi-marquee-row marquee-right">
            {[...testimonials, ...testimonials].reverse().map((t, i) => (
              <div className="testi-card-v2" key={`r2-${i}`}>
                <p className="testi-quote">&ldquo;{t.quote}&rdquo;</p>
                <div className="testi-author-simple">— {t.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ CTA BAND ══════════════════════════════════════════════════ */}
      <section className="cta-band">
        <div className="cta-inner">
          <div className="cta-eyebrow">Get Started</div>
          <h2 className="cta-title">
            Your health
            <br />
            deserves better virtual care.
          </h2>
          <p className="cta-desc">
            Affordable telehealth services, same-day online doctor
            consultations, prescriptions, and ongoing care all through one
            secure telemedicine platform.
          </p>
          <div className="cta-btns">
            <a href="/login">
              <button className="cta-btn-w">Create Free Account</button>
            </a>
            <a href="/appointment-booking">
              <button className="cta-btn-g">Talk to a Doctor Now</button>
            </a>
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
    </>
  );
}
