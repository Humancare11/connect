import React from "react";
import "./hero-new.css";
import heroBg from "../assets/hero-bg1.jpeg";

const CARDS = [
  {
    key: "teleconsult",
    title: "Teleconsultation",
    desc: "Connect with licensed doctors instantly.",
    stat: "98%",
    statLbl: "Visit completion",
    tabs: ["Video", "Audio", "Chat"],
    tabActive: 0,
    logo: (
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 72 72"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M36 10 L36 26" />
        <path d="M24 20 L36 26 L48 20" />
        <path d="M36 26 L36 56" />
        <circle cx="24" cy="38" r="5" />
        <circle cx="48" cy="38" r="5" />
        <path d="M24 43 Q28 48 36 48 Q44 48 48 43" />
      </svg>
    ),
  },
  {
    key: "doctor",
    title: "Doctor On Call",
    desc: "24/7 access to a licensed physician.",
    stat: "< 5 min",
    statLbl: "Avg. wait time",
    tabs: null,
    logo: (
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 54 54"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 10 v14 a11 11 0 0 0 22 0 v-14" />
        <path d="M16 10 h6" />
        <path d="M32 10 h6" />
        <circle cx="27" cy="44" r="4" />
        <path d="M27 35 v5" />
      </svg>
    ),
  },
  {
    key: "rx",
    title: "E-Prescriptions",
    desc: "Digital Rx sent to your pharmacy.",
    stat: "99.7%",
    statLbl: "Accuracy rate",
    tabs: null,
    logo: (
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 54 54"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 10 h14 a4 4 0 0 1 4 4 v28 a4 4 0 0 1-4 4 H18 a4 4 0 0 1-4-4 V14 a4 4 0 0 1 4-4 z" />
        <path d="M20 20 h14" />
        <path d="M20 26 h14" />
        <path d="M20 32 h10" />
      </svg>
    ),
  },
  {
    key: "hr",
    title: "HR Dashboard",
    desc: "Workforce health insights at a glance.",
    stat: "34%",
    statLbl: "Fewer sick days",
    tabs: null,
    logo: (
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 54 54"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="10" y="12" width="34" height="30" rx="3" />
        <path d="M16 34 V28" />
        <path d="M22 34 V22" />
        <path d="M28 34 V25" />
        <path d="M34 34 V18" />
        <path d="M40 34 V20" />
      </svg>
    ),
  },
  {
    key: "mental",
    title: "Mental Health",
    desc: "Confidential therapy, on your schedule.",
    stat: "95%",
    statLbl: "Satisfaction score",
    tabs: null,
    logo: (
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 54 54"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M27 44 C15 34 10 26 14 18 C17 12 25 12 27 18 C29 12 37 12 40 18 C44 26 39 34 27 44 z" />
      </svg>
    ),
  },
];

function Carousel() {
  const N = CARDS.length;
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [tabActive, setTabActive] = React.useState(0);

  React.useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % N), 2800);
    return () => clearInterval(id);
  }, [paused, N]);

  const slotFor = (i) => {
    let d = i - index;
    if (d > N / 2) d -= N;
    if (d < -N / 2) d += N;
    return d;
  };

  const styleFor = (slot) => {
    if (slot === 0)
      return {
        transform: "translate3d(0,-10px,180px) rotateY(0deg)",
        zIndex: 10,
        opacity: 1,
        filter: "none",
      };
    if (slot === -1)
      return {
        transform: "translate3d(-230px,15px,-30px) rotateY(24deg) scale(0.91)",
        zIndex: 7,
        opacity: 0.96,
        filter: "brightness(0.98)",
      };
    if (slot === 1)
      return {
        transform: "translate3d(230px,15px,-30px) rotateY(-24deg) scale(0.91)",
        zIndex: 7,
        opacity: 0.96,
        filter: "brightness(0.98)",
      };
    if (slot === -2)
      return {
        transform: "translate3d(-400px,35px,-130px) rotateY(40deg) scale(0.8)",
        zIndex: 3,
        opacity: 0.52,
        filter: "blur(1.2px) brightness(0.96)",
      };
    if (slot === 2)
      return {
        transform: "translate3d(400px,35px,-130px) rotateY(-40deg) scale(0.8)",
        zIndex: 3,
        opacity: 0.52,
        filter: "blur(1.2px) brightness(0.96)",
      };
    return {
      transform: "translate3d(0,0,-240px)",
      opacity: 0,
      pointerEvents: "none",
    };
  };

  return (
    <div
      className="hce-stage-wrap"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="hce-stage">
        {CARDS.map((c, i) => {
          const slot = slotFor(i);
          const isCenter = slot === 0;
          return (
            <div
              key={c.key}
              className={"hce-card" + (isCenter ? " center" : "")}
              style={styleFor(slot)}
              onClick={() => setIndex(i)}
            >
              <div className="hce-card-logo">{c.logo}</div>
              <div className="hce-card-title">{c.title}</div>
              <div className="hce-card-desc">{c.desc}</div>

              <div className="hce-card-tabs-slot">
                {isCenter && c.tabs && (
                  <div className="hce-card-tabs">
                    {c.tabs.map((t, ti) => (
                      <button
                        key={t}
                        className={
                          "hce-card-tab" + (ti === tabActive ? " active" : "")
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          setTabActive(ti);
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="hce-card-stat">{c.stat}</div>
              <div className="hce-card-stat-lbl">{c.statLbl}</div>
              <button
                className="hce-card-btn"
                onClick={(e) => e.stopPropagation()}
              >
                Learn more
              </button>
            </div>
          );
        })}

        <div className="hce-pedestal">
          <div className="hce-ped-ring-outer" />
          {/* <div className="hce-ped-ring-inner" /> */}
          <div className="hce-ped-core" />
        </div>
      </div>

      <div className="hce-dots">
        {CARDS.map((_, i) => (
          <button
            key={i}
            className={"hce-dot" + (i === index ? " active" : "")}
            onClick={() => setIndex(i)}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

function Badge() {
  return (
    <div className="hce-badge">
      <span className="hce-badge-ic">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      Available in all 50 states — 24/7
    </div>
  );
}

function Search() {
  const [q, setQ] = React.useState("");
  return (
    <form className="hce-search" onSubmit={(e) => e.preventDefault()}>
      <svg
        className="hce-search-ic"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search symptoms, conditions, doctors…"
      />
      <button type="submit">Search</button>
    </form>
  );
}

export default function HeroUpdated() {
  return (
    <section>
      <div
        className="hce-root hce-page"
      >
        <section className="hce-hero">
          <div className="hce-left">
            <Badge />
            <h1>
              Healthcare that puts your{" "}
              <span className="hce-hl">employees</span> first.
            </h1>
            <p>
              Virtual care that's accessible, affordable, and built for the
              modern workforce.
            </p>
            <Search />
            <div className="hce-chips">
              <span className="hce-chip">
                <span className="dot" style={{ background: "#0C8B7A" }} />
                HIPAA Compliant
              </span>
              <span className="hce-chip">
                <span className="dot" style={{ background: "#C97B1A" }} />
                GDPR Ready
              </span>
              <span className="hce-chip">
                <span className="dot" style={{ background: "#223A5E" }} />
                500+ Verified Doctors
              </span>
              <span className="hce-chip">
                <span className="dot" style={{ background: "#0C8B7A" }} />
                Prescriptions Available
              </span>
            </div>
          </div>
          <div>
            <Carousel />
          </div>
        </section>
      </div>
    </section>
  );
}
