import { useState } from "react";
import "./Serviceareas.css";
import SEO from "../components/Seo";
// Optional: About page wali hero image use karni ho to import karo aur neeche HERO_IMG me daalo
// import HeroImg from "../assets/your-about-hero-image.webp";
const HERO_IMG = null; // e.g. HeroImg

const UNAVAILABLE = ["California", "Massachusetts", "Rhode Island", "Vermont"];

const ALL_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
  "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine",
  "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia",
  "Washington", "West Virginia", "Wisconsin", "Wyoming",
];

const AVAILABLE_COUNT = ALL_STATES.length - UNAVAILABLE.length; // 46

const ACCESS_ITEMS = [
  "Browse the Humancare Connect website",
  "Read healthcare information and condition guides",
  "Explore educational content and health blogs",
  "Use other resources published on our website",
];

const STEPS = [
  {
    title: "Start Registration",
    text: "Begin the Humancare Connect registration process on our website.",
    color: "navy",
  },
  {
    title: "Select Your Current State",
    text: "Choose the state where you are physically located right now, not your home state.",
    color: "blue",
  },
  {
    title: "Confirm Availability",
    text: "Registration confirms whether you can proceed with a teleconsultation from that location.",
    color: "amber",
  },
];

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const Cross = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

function AvailabilityChecker() {
  const [state, setState] = useState("");
  const isUnavailable = UNAVAILABLE.includes(state);

  return (
    <div className="sa-checker">
      <label htmlFor="sa-state" className="sa-checker-label">
        Check your current location
      </label>
      <select
        id="sa-state"
        value={state}
        onChange={(e) => setState(e.target.value)}
      >
        <option value="">Select the state you are in right now</option>
        {ALL_STATES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <div aria-live="polite">
        {state && !isUnavailable && (
          <div className="sa-result sa-result-ok">
            <span className="sa-result-ic"><Check /></span>
            <div>
              <strong>Teleconsultation is available in {state}.</strong>
              <span>Select {state} during registration to continue.</span>
            </div>
          </div>
        )}
        {state && isUnavailable && (
          <div className="sa-result sa-result-no">
            <span className="sa-result-ic"><Cross /></span>
            <div>
              <strong>Not currently available in {state}.</strong>
              <span>
                You can still use our website and health resources, and you may
                access teleconsultation while physically located in a state
                where we operate.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Serviceareas() {
  return (
    <>
      <SEO
        description={`Humancare Connect offers teleconsultation to patients physically located in ${AVAILABLE_COUNT} U.S. states. Teleconsultation is not currently available in California, Massachusetts, Rhode Island, or Vermont.`}
      />

      <main className="sa-page">
        {/* HERO */}
        <section
          className="sa-hero"
          style={
            HERO_IMG
              ? {
                  backgroundImage: `linear-gradient(rgba(15, 27, 52, 0.78), rgba(15, 27, 52, 0.78)), url(${HERO_IMG})`,
                }
              : undefined
          }
        >
          <div className="sa-wrap">
            <div className="sa-hero-text">
              <h1>Where We Operate</h1>
              <p>
                Humancare Connect offers teleconsultation services to patients
                located within the United States. Our coverage currently
                includes {AVAILABLE_COUNT} states, giving patients access to
                convenient virtual healthcare across a broad geographic area.
              </p>
            </div>
          </div>
        </section>

        {/* INTRO + CHECKER */}
        <section className="sa-section sa-white">
          <div className="sa-wrap sa-split">
            <div className="sa-split-left">
              <h2 className="sa-title">
                Teleconsultation in {AVAILABLE_COUNT} States
              </h2>
              <AvailabilityChecker />
            </div>
            <div className="sa-split-right">
              <p>
                When scheduling or requesting a teleconsultation, patients are
                asked to provide the state in which they are currently located.
                This helps Humancare Connect determine whether teleconsultation
                services are available for that location.
              </p>
              <p>
                Our service coverage may be updated periodically as Humancare
                Connect expands or modifies its teleconsultation availability.
              </p>
              <blockquote className="sa-quote">
                What matters for teleconsultation is the state where you are
                physically located when you receive the service, not your home
                state.
              </blockquote>
            </div>
          </div>
        </section>

        {/* UNAVAILABLE STATES */}
        <section className="sa-section sa-dark">
          <div className="sa-wrap">
            <h2 className="sa-title sa-title-light">
              States Where Teleconsultation Is{" "}
              <span className="sa-hl">Currently Unavailable</span>
            </h2>
            <p className="sa-lead-light">
              At this time, Humancare Connect does not offer teleconsultation
              services to patients who are physically located in the following
              four states.
            </p>

            <ul className="sa-dark-cards">
              {UNAVAILABLE.map((s, i) => (
                <li key={s} className="sa-dark-card">
                  <span className="sa-dark-num">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3>{s}</h3>
                  <p>Teleconsultation not available while located here.</p>
                </li>
              ))}
            </ul>

            <p className="sa-dark-note">
              This limitation applies specifically to receiving a
              teleconsultation while physically located in these states.
            </p>
          </div>
        </section>

        {/* ACCESS + TRAVELING */}
        <section className="sa-section sa-white">
          <div className="sa-wrap sa-two">
            <article className="sa-card">
              <h2 className="sa-card-title">
                What Can You Access From These States?
              </h2>
              <p>
                Being located in Massachusetts, Rhode Island, Vermont, or
                California does not prevent you from using the Humancare Connect
                website. The state restriction applies to teleconsultation
                services only.
              </p>
              <ul className="sa-checklist">
                {ACCESS_ITEMS.map((item) => (
                  <li key={item}>
                    <span className="sa-check"><Check /></span>
                    {item}
                  </li>
                ))}
              </ul>
            </article>

            <article className="sa-card">
              <h2 className="sa-card-title">Traveling to Another State?</h2>
              <p>
                If you live in one of the four states where teleconsultation is
                currently unavailable, you may still be able to access Humancare
                Connect teleconsultation services when you travel to a state
                where the service is available.
              </p>
              <div className="sa-travel">
                <div className="sa-travel-row">
                  <span className="sa-travel-dot sa-dot-amber" />
                  <span>
                    <small>Lives in</small>
                    California
                  </span>
                </div>
                <div className="sa-travel-row sa-travel-ok">
                  <span className="sa-travel-dot sa-dot-blue" />
                  <span>
                    <small>Currently in</small>
                    A state we serve
                  </span>
                  <em>
                    <Check /> Can book
                  </em>
                </div>
              </div>
              <p className="sa-muted">
                In other words, your home state does not by itself prevent you
                from using Humancare Connect.
              </p>
            </article>
          </div>
        </section>

        {/* STEPS */}
        <section className="sa-section sa-light">
          <div className="sa-wrap">
            <h2 className="sa-title">
              How to Confirm
              <br />
              Your Availability
            </h2>
            <p className="sa-lead">
              Select your current state during the Humancare Connect
              registration process. If you are traveling, make sure the state
              you select reflects where you are physically located.
            </p>

            <ol className="sa-steps">
              {STEPS.map((step, i) => (
                <li key={step.title} className="sa-step">
                  <span className={`sa-step-num sa-num-${step.color}`}>
                    {i + 1}
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* HELP + NOTICE */}
        <section className="sa-section sa-white">
          <div className="sa-wrap">
            <div className="sa-help">
              <div>
                <h2>Need Help?</h2>
                <p>
                  If you are unsure whether teleconsultation is available in
                  your current location, our support team can help.
                </p>
              </div>
              <a className="sa-help-btn" href="mailto:support@humancareconnect.co">
                support@humancareconnect.co
              </a>
            </div>

            <aside className="sa-notice" aria-label="Service availability notice">
              <h3>Service Availability Notice</h3>
              <p>
                Humancare Connect currently provides teleconsultation services
                in {AVAILABLE_COUNT} states. Teleconsultation is not currently
                available when the patient is physically located in
                Massachusetts, Rhode Island, Vermont, or California. Humancare
                Connect may update its service coverage periodically. Please
                check the registration process or contact our support team for
                the latest availability information.
              </p>
            </aside>
          </div>
        </section>
      </main>
    </>
  );
}