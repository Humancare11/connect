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
const EverydayCareSection = lazy(
  () => import("../components/EverydayCareSection"),
);
const Aa = lazy(() => import("../components/Aa"));
// import sceneVideo from "../assets/gifts/scene-card-bg-video.mp4";
import sceneVideo from "../assets/gifts/HeroVideo.mp4";
import heroPoster from "../assets/gifts/HeroPoster.webp";
import PreloadImage from "../components/PreloadImage";
import WordReveal from "../components/WordReveal";
import StepProgress from "../components/StepProgress";
import SEO from "../components/Seo";
import FAQ from "../components/FAQ/FAQ";
const LogoMarquee = lazy(() => import("../components/LogoMarquee"));
import {
  FiSmartphone,
  FiUserCheck,
  FiClock,
  FiVideo,
  FiFileText,
  FiCheckCircle,
} from "react-icons/fi";

import {
  createSearchSession,
  describeEmptyState,
  toSuggestions,
  SEARCH_MIN_LENGTH,
} from "../api/searchApi";
import { chooseExplicitAction, runSubmitSearch } from "../api/searchSubmit";
import { createAutoFullSearch } from "../api/searchAuto";

import { useNavigate, Link } from "react-router-dom";

import LazySection from "../components/LazySection";

const PCP = lazy(() => import("../components/PCPSection"));
const Why = lazy(() => import("../components/WhySection"));

// ─── Scene data ───────────────────────────────────────────────────────────────
const SCENES = [
  {
    step: 1,
    badge: "Create Account",
    title: " Create your account",
    desc: "Sign up in under two minutes. Registration is quick, secure, and hassle-free..",
    metricValue: "< 2 Min",
    metricLabel: "Sign-up time",
    metricIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    step: 2,
    badge: "Choose Service",
    title: "Choose the care you need",
    desc: "Browse 10+ categories, 30+ specialties, and 150+ conditions to find the right care fast.",
    metricValue: "10+ Categories · 30+ Specialties · 150+ Conditions",
    // metricLabel: "Specialties available",
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
    desc: "We'll match you with a licensed doctor and schedule a time that works for you. No waiting rooms. No phone tag.",
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
    title: "Consult with your doctor",
    desc: "Meet securely by video, discuss your symptoms, receive a diagnosis, and get a personalized treatment plan.",
    metricValue: "",
    metricLabel: "Secure connection",
    metricIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    step: 5,
    badge: "Complete Care",
    title: "Complete Care: Your care, all in one place",
    desc: "Access your consultation summary, personalized care plan, and follow-up guidance anytime through your secure patient dashboard.",
    metricValue: "Anytime",
    metricLabel: "Access Your Care",
    metricIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
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
  "Complete Care",
];
const TOTAL_STEPS = 5;
const STEP_DURATION = 4000;
const CIRCUMFERENCE = 2 * Math.PI * 10;
// NOTE: must match RADIUS (18) used inside StepProgress.jsx's <circle r={...}>
const STEP_CIRCUMFERENCE = 2 * Math.PI * 18;

const HOME_FAQS = [
  {
    title: "General Telemedicine",
    items: [
      {
        question: "What is telemedicine and how does it work?",
        answer:
          "Telemedicine allows you to consult with a licensed healthcare provider online through a secure digital platform. You can discuss symptoms, receive medical advice, get treatment recommendations, and obtain prescriptions when medically appropriate without visiting a clinic.",
      },
      {
        question: "How quickly can I see an online doctor?",
        answer:
          "Virtual doctor appointments are designed to provide convenient access to healthcare, often allowing patients to connect with a licensed provider quickly for non-emergency medical concerns.",
      },
      {
        question: "Are online doctors real licensed healthcare providers?",
        answer:
          "Yes. Online doctors and healthcare providers are licensed professionals who can evaluate symptoms, review medical history, provide treatment guidance, and recommend appropriate next steps based on your health needs.",
      },
      {
        question:
          "What conditions can be treated through telemedicine services?",
        answer:
          "Telemedicine services can help with many common healthcare needs including cold and flu symptoms, infections, allergies, skin concerns, digestive issues, mental health support, prescription refills, chronic care management, and general wellness consultations.",
      },
    ],
  },
  {
    title: "Prescriptions & Care",
    items: [
      {
        question:
          "Can I get a prescription through an online doctor appointment?",
        answer:
          "Yes. A licensed provider can evaluate your condition during a virtual consultation and prescribe medications when medically appropriate and allowed under applicable healthcare regulations.",
      },
      {
        question: "Can I get same-day online medical care?",
        answer:
          "Many non-emergency health concerns can be addressed through same-day telehealth appointments, allowing patients to receive timely medical support without long waiting periods.",
      },
      {
        question:
          "Is a virtual doctor visit as effective as an in-person visit?",
        answer:
          "For many routine and non-emergency conditions, virtual healthcare can be an effective and convenient way to receive diagnosis guidance, treatment recommendations, and follow-up care. Some medical concerns may still require in-person examinations or testing.",
      },
      {
        question: "What should I prepare before my online doctor appointment?",
        answer:
          "Before your virtual visit, prepare details about your symptoms, current medications, allergies, medical history, and any questions you would like to discuss with your healthcare provider.",
      },
    ],
  },
  {
    title: "Security & Insurance",
    items: [
      {
        question: "Is Humancare Connect HIPAA compliant and secure?",
        answer:
          "Yes. Humancare Connect follows strict HIPAA privacy and security standards designed to protect your personal health information. Your online consultations, medical records, and communications are handled through a secure telemedicine platform.",
      },
      {
        question: "Can I use telemedicine without health insurance?",
        answer:
          "Yes. Telemedicine can provide flexible healthcare options for patients with or without insurance, making it easier to access medical guidance and treatment when needed.",
      },
      {
        question: "How much does an online doctor appointment cost?",
        answer:
          "The cost of an online doctor consultation depends on the type of service and healthcare needs. Humancare Connect offers transparent pricing with convenient access to affordable virtual healthcare services.",
      },
      {
        question: "Why choose Humancare Connect for virtual healthcare?",
        answer:
          "Humancare Connect provides access to licensed healthcare providers, secure online consultations, prescription support when appropriate, mental health services, chronic care management, and personalized treatment guidance from the comfort of home.",
      },
    ],
  },
  {
    title: "Mental Health & Refills",
    items: [
      {
        question: "Can telemedicine help with mental health concerns?",
        answer:
          "Yes. Telehealth services provide convenient access to mental health support for concerns such as anxiety, stress, depression, burnout, and emotional wellness.",
      },
      {
        question: "Can I get prescription refills online?",
        answer:
          "Yes. Licensed providers can review your medical history and current treatment needs to determine whether a prescription refill is appropriate.",
      },
      {
        question: "What if I do not have a primary care doctor?",
        answer:
          "You can still receive virtual healthcare services even if you do not have a primary care physician. Online providers can help with everyday health concerns, treatment guidance, and ongoing healthcare support.",
      },
      {
        question: "Can telemedicine help manage chronic health conditions?",
        answer:
          "Yes. Telemedicine can support ongoing management of chronic conditions such as diabetes, high blood pressure, asthma, thyroid disorders, and high cholesterol through regular virtual follow-ups and personalized care.",
      },
    ],
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  // ── Search state ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchRef = useRef(null);
  // null, or { kind, reason } when the dropdown has nothing to list (see describeEmptyState).
  const [emptyState, setEmptyState] = useState(null);
  const noResults = emptyState !== null;
  const emptyCopy = describeEmptyState(emptyState ?? {}, searchQuery);
  const [isSearching, setIsSearching] = useState(false);
  // Backend search (POST /api/search). One session per search box: each new
  // request cancels the previous one, so stale responses never show.
  const [searchSession] = useState(createSearchSession);
  const [autoFull] = useState(() => createAutoFullSearch({ session: searchSession }));
  const searchDebounceRef = useRef(null);

  const itemRefs = useRef([]);
  const suggestionsRef = useRef(null);

  // Keep the highlighted option visible by scrolling the dropdown itself, never the page,
  // and only when the option is cut off.
  useEffect(() => {
    const box = suggestionsRef.current;
    const item = itemRefs.current[activeIndex];
    if (activeIndex < 0 || !box || !item) return;
    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;
    if (top < box.scrollTop) box.scrollTop = top;
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight;
  }, [activeIndex]);

  // Keep the open dropdown (results or a status message) on screen. The hero puts the search
  // bar near the fold, so on laptop-height screens the dropdown opens below it. Scroll the page
  // only as far as needed to show it, and never so far that the bar slides under the fixed header.
  useEffect(() => {
    const box = suggestionsRef.current;
    if (!box || isSearching) return;
    const margin = 12;
    const headerBottom = document.querySelector(".glass-header")?.getBoundingClientRect().bottom ?? 0;
    // The dropdown fades in with a transform, so its bottom is taken from layout, not from its rect.
    const wrapperTop = searchRef.current.getBoundingClientRect().top;
    const needed = wrapperTop + box.offsetTop + box.offsetHeight - (window.innerHeight - margin);
    const room = wrapperTop - (headerBottom + margin);
    const delta = Math.min(needed, room);
    if (delta > 1) {
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      window.scrollBy({ top: delta, behavior: reduced ? "auto" : "smooth" });
    }
  }, [isSearching, filteredSuggestions, emptyState, showSuggestions, searchQuery]);

  // Video lazy loading with Intersection Observer
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  useEffect(() => {
    let observer;
    let timer;
    // The 1.7 MB hero video is decorative (its poster is already on screen), so it must not compete with
    // the page's own JS/CSS/fonts for bandwidth: start observing only after the page has loaded and gone idle.
    const start = () => {
      timer = setTimeout(() => {
        observer = new IntersectionObserver(
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
      }, 1500);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });

    return () => {
      window.removeEventListener("load", start);
      clearTimeout(timer);
      if (observer) observer.disconnect();
    };
  }, []);

  // ── As-you-type search: backend "instant" mode (never uses AI) ───────────
  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < SEARCH_MIN_LENGTH) {
      searchSession.reset(); // cancels any request and ends the analytics episode
      autoFull.cancel();
      setFilteredSuggestions([]);
      setEmptyState(null);
      setIsSearching(false);
      setActiveIndex(-1);
      return;
    }

    setIsSearching(true);
    setEmptyState(null);
    setActiveIndex(-1);

    // Debounce keeps typing smooth and request volume under the API limit.
    searchDebounceRef.current = setTimeout(async () => {
      const response = await searchSession.run(query, { mode: "instant" });
      if (!response) return; // superseded by a newer query
      const suggestions = toSuggestions(response);
      setFilteredSuggestions(suggestions);
      if (response.success === false) setEmptyState({ kind: "error", reason: response.error });
      else if (suggestions.length === 0) setEmptyState({ kind: query.split(/\s+/).length >= 3 ? "broad" : "none" });
      else setEmptyState(null);
      setIsSearching(false);
      // No automatic AI ("full") search here: text typed so far is never sent
      // to the AI provider because of a typing pause. A full search runs only
      // on an explicit submit (Enter / the search button).
    }, 250);

    return () => {
      clearTimeout(searchDebounceRef.current);
      autoFull.cancel(); // the query changed: drop pending/running enhancement
    };
  }, [searchQuery, searchSession, autoFull]);

  // Cancel any in-flight search and end the analytics episode on unmount.
  useEffect(
    () => () => {
      searchSession.reset();
      autoFull.cancel();
    },
    [searchSession, autoFull],
  );

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
      navigate(item.route); // route is already the full path,
      setSearchQuery("");
      setShowSuggestions(false);
    },
    [filteredSuggestions, navigate],
  );

  // ── Submit (Search button / Enter): backend "full" mode ───────────────────
  // Full mode lets the backend apply its query understanding; the page only
  // receives catalog results. A single result, or a query that exactly matches
  // the top result's name, opens directly; otherwise the results are shown so
  // the user can choose (see runSubmitSearch).
  const submitSearch = useCallback(async () => {
    const query = searchQuery.trim();
    if (query.length < SEARCH_MIN_LENGTH) return;
    clearTimeout(searchDebounceRef.current); // no instant run after submit
    setShowSuggestions(true);
    setIsSearching(true);
    setEmptyState(null);
    setActiveIndex(-1);

    // Reuse an automatic full search for this query instead of sending a second.
    const { action, suggestions, reason, degraded } = await (autoFull.join(query) ?? runSubmitSearch(searchSession, query));
    if (action === "superseded") return; // the user kept typing or cleared
    setFilteredSuggestions(suggestions);
    setIsSearching(false);
    if (action === "navigate") {
      handleSearch(suggestions[0]); // a single result opens directly
    } else if (action === "error") {
      setEmptyState({ kind: "error", reason });
    } else if (action === "empty") {
      setEmptyState({ kind: degraded ? "degraded" : "none" });
    } else {
      // "show": several results stay in the dropdown for the user to pick. The
      // top-ranked one is highlighted so a second Enter opens it.
      setActiveIndex(0);
    }
  }, [searchQuery, searchSession, autoFull, handleSearch]);

  // One handler for the Search button and Enter: a highlighted result that is on
  // screen is opened (no new search); otherwise a full search runs.
  const handleExplicitSubmit = useCallback(() => {
    const choice = chooseExplicitAction({ isSearching, suggestions: filteredSuggestions, activeIndex });
    if (choice.action === "open") {
      searchSession.select(); // analytics only: never throws, changes nothing visible
      handleSearch(choice.item);
    } else {
      submitSearch();
    }
  }, [isSearching, filteredSuggestions, activeIndex, searchSession, handleSearch, submitSearch]);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e) => {
      // Arrow keys only move within results currently on screen.
      const hasVisibleResults = !isSearching && filteredSuggestions.length > 0;
      switch (e.key) {
        case "ArrowDown":
          if (!hasVisibleResults) return;
          e.preventDefault();
          setActiveIndex((prev) =>
            prev < filteredSuggestions.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          if (!hasVisibleResults) return;
          e.preventDefault();
          setActiveIndex((prev) =>
            prev > 0 ? prev - 1 : filteredSuggestions.length - 1,
          );
          break;
        case "Enter":
          e.preventDefault();
          handleExplicitSubmit();
          break;
        case "Escape":
          setShowSuggestions(false);
          break;
        default:
          break;
      }
    },
    [filteredSuggestions, isSearching, handleExplicitSubmit],
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
        "My therapist on Humancare Connect remembers every detail, follows up proactively, and has been a genuine partner in my recovery. Exceptional mental health care.",
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
        ? 1 - timerOffset / CIRCUMFERENCE // fraction filled (0 → 1) for the active ring
        : isCompleted
          ? 1
          : 0;
      const progressOffset = STEP_CIRCUMFERENCE * (1 - progress);
      el.style.strokeDashoffset = String(progressOffset);
    });
  }, []);

  // ── Jump to a specific step (dot click) ────────────────────────────────────
  const handleStepClick = useCallback(
    (i) => {
      setCurrent(i);
      currentRef.current = i;
      elapsedRef.current = 0;
      timerOffsetRef.current = CIRCUMFERENCE; // clicked step's ring starts empty
      lastTickRef.current = 0; // rebase so the next tick doesn't count stale elapsed time
      updateVisuals();
    },
    [updateVisuals],
  );

  // ── Pause/resume the single timer on dot hover ─────────────────────────────
  const handleHoverChange = useCallback((hovering) => {
    pausedRef.current = hovering;
    if (hovering) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    } else {
      lastTickRef.current = 0;
      rafRef.current = requestAnimationFrame(() => tickRef.current?.());
    }
  }, []);

  // ── Animation tick ────────────────────────────────────────────────────────
  // Declared with useRef so it can reference itself without circular deps
  const tickRef = useRef(null);

  tickRef.current = () => {
    if (pausedRef.current) return;

    const now = performance.now();
    if (lastTickRef.current === 0) {
      // First tick after mount / resume / jump — set baseline without adding delta
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
      <SEO />
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
            Talk to a{" "}
            <span className="fancy-underline">licensed doctor online </span>
            {/* <br /> */}
            in minutes.
          </h1>

          <p>
            Get rapid, reliable telemedicine services from expert doctors on our
            secure virtual healthcare platform. Book an online doctor
            appointment. Contact a telemedicine doctor for expert medical
            advice, personalized treatment plans & prescriptions from licensed
            healthcare providers at your home. Our HIPAA compliant telemedicine
            and secure healthcare platform makes it easy, convenient, and
            available to access quality digital healthcare.
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
            {/* <span className="trust-chip">
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
            </span> */}
            {/* <span className="trust-chip">
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
              50+ Verified Providers
            </span> */}

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
              Prescriptions Available
            </span>
          </div>
          {/* SEARCH BAR */}
          <div className="search-wrapper" ref={searchRef}>
            <div className="search-bar">
              <input
                type="text"
                role="combobox"
                aria-label="Search conditions, specialties and treatments"
                aria-autocomplete="list"
                aria-expanded={showSuggestions && searchQuery.trim().length >= SEARCH_MIN_LENGTH}
                aria-controls="search-suggestions"
                aria-activedescendant={!isSearching && activeIndex >= 0 && activeIndex < filteredSuggestions.length ? `search-option-${activeIndex}` : undefined}
                value={searchQuery}
                placeholder="Search doctors, specialties, conditions..."
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={handleKeyDown}
              />
              <button onClick={handleExplicitSubmit}>Search</button>
            </div>

            {showSuggestions &&
              searchQuery.trim().length >= SEARCH_MIN_LENGTH && (
                <div
                  className="search-suggestions"
                  id="search-suggestions"
                  ref={suggestionsRef}
                  data-lenis-prevent
                  role={!isSearching && !noResults && filteredSuggestions.length > 0 ? "listbox" : undefined}
                >
                  {/* Loading state */}
                  {isSearching && (
                    <div className="search-state" role="status">
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
                    <div className="search-state no-results" role="status">
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
                          {emptyCopy.title}
                        </span>
                        <span className="search-state-subtitle">
                          {emptyCopy.subtitle}
                        </span>
                      </div>
                      {emptyCopy.hint && (
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
                      )}
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
                        id={`search-option-${index}`}
                        role="option"
                        aria-selected={activeIndex === index}
                        ref={(el) => (itemRefs.current[index] = el)}
                        className={`suggestion-item${activeIndex === index ? " active" : ""}`}
                        onClick={() => {
                          searchSession.select(); // analytics only: never throws, changes nothing visible
                          handleSearch(item);
                        }}
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
          {/* The poster is the page's LCP image; start fetching it before the video element mounts. */}
          <PreloadImage src={heroPoster} />
          {/* The poster is a real <img> in the server HTML, so the LCP image paints before any JavaScript
              runs. The video is mounted on top of it later with the same class and no poster of its own
              (a second poster would become a later, larger LCP candidate). */}
          <img
            src={heroPoster}
            alt=""
            aria-hidden="true"
            className="hero-right-video-bg"
            width="1600"
            height="900"
            decoding="async"
            fetchPriority="high"
          />
          {shouldLoadVideo && (
            <video
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
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
                THE HUMANCARE CONNECT EXPERIENCE
              </div>
              <h3>
                Your Care Journey, <span> Simplified</span>
              </h3>
              <p>
                {" "}
                Five simple steps to connect with trusted healthcare
                <br />
                professionals from anywhere.
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
                current={current}
                onStepClick={handleStepClick}
                onHoverChange={handleHoverChange}
                registerRing={(el, i) => {
                  ringFillRefs.current[i] = el;
                }}
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

      {/* ════════ EVERYDAY & PEDIATRIC CARE ═════════════════════════════════ */}
      <LazySection>
        <Suspense fallback={null}>
          <EverydayCareSection />
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
            <Link to="/appointment-booking" state={{ tab: "spec" }}>
              <button className="cta-btn-g">Talk to a Doctor Now</button>
            </Link>
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
              Same Day Appointments{" "}
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
              Care From Anywhere{" "}
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
              Easy Online Booking{" "}
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
              Transparent Pricing{" "}
            </span>
          </div>
        </div>
      </section>

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

      <FAQ
        badge="FAQ"
        title="Frequently Asked Questions"
        description="Everything you need to know about our virtual healthcare services, online doctors, and platform security."
        stats={[
          "Avg. response in 10 min",
          "HIPAA secure & private",
          "Available in the U.S.",
        ]}
        sections={HOME_FAQS}
      />
    </>
  );
}
