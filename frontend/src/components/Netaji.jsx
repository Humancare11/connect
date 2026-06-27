import { useState, useRef, useEffect, useCallback } from "react";
import "./WhyChooseUs.css";

import ReduceInsuranceHealthcareCosts from "../assets/MedicalPartnerOrganizationsTrust/healthcare-cost-reduction-insurance-savings.webp";

import ImproveEmployeeClientWellbeing from "../assets/MedicalPartnerOrganizationsTrust/employee-wellbeing-health-benefits.webp";

import AddMedicalSupportValueAddedService from "../assets/MedicalPartnerOrganizationsTrust/healthcare-benefits-value-added-service.webp";

import AccessGlobalLicensedDoctorNetwork from "../assets/MedicalPartnerOrganizationsTrust/global-doctor-network-telehealth.webp";

import MultilingualSupport247 from "../assets/MedicalPartnerOrganizationsTrust/multilingual-telehealth-support.webp";

import HIPAAGDPRCompliantInfrastructure from "../assets/MedicalPartnerOrganizationsTrust/hipaa-gdpr-compliant-healthcare-platform.webp";

import FastImplementationUnder2Weeks from "../assets/MedicalPartnerOrganizationsTrust/healthcare-platform-fast-onboarding.webp";

import IncreaseEmployeeRetentionProductivity from "../assets/MedicalPartnerOrganizationsTrust/employee-productivity-healthcare-benefits.webp";

const CARDS = [
  {
    id: 1,
    size: "sm",
    delay: "0s",
    tag: "Cost Savings",
    title: "Reduce Insurance & Healthcare Costs",
    short: "Cut overhead. Optimize spend.",
    body: "By enabling early intervention and preventing escalation, Humancare helps organisations significantly lower insurance premiums, reduce hospitalisation frequency, and eliminate costly reactive care — delivering measurable ROI within the first year.",
    photo: ReduceInsuranceHealthcareCosts,
    alt: "Healthcare cost reduction and insurance savings for organizations",
  },
  {
    id: 2,
    size: "md",
    delay: "0.5s",
    tag: "Wellbeing",
    title: "Improve Employee & Client Wellbeing",
    short: "Healthier people. Stronger culture.",
    body: "Mental, physical, and preventive care — all in one platform. Humancare ensures your employees feel genuinely supported, boosting morale, reducing burnout, and creating a work culture people want to be part of.",
    photo: ImproveEmployeeClientWellbeing,
    alt: "Employee wellbeing and preventive healthcare support services",
  },
  {
    id: 3,
    size: "sm",
    delay: "1.0s",
    tag: "Differentiation",
    title: "Add Medical Support as a Value-Added Service",
    short: "Stand out from competitors.",
    body: "Offer healthcare access as a premium benefit. Whether you're an employer, insurer, or HR platform, embedding Humancare into your offering creates instant differentiation and builds lasting loyalty.",
    photo: AddMedicalSupportValueAddedService,
    alt: "Healthcare benefits program for employees and clients",
  },
  {
    id: 4,
    size: "lg",
    delay: "0.2s",
    tag: "Network",
    title: "Access Global Licensed Doctor Network",
    short: "500+ verified specialists. Always available.",
    body: "Our network spans 40+ countries, covering 80+ medical specialties. Every doctor is licensed, credentialed, and vetted. Employees get access to the right specialist — regardless of geography, time zone, or language.",
    photo: AccessGlobalLicensedDoctorNetwork,
    alt: "Global network of licensed doctors providing virtual healthcare",
    stat: "500+",
    statLabel: "Verified Doctors",
  },
  {
    id: 5,
    size: "md",
    delay: "0.75s",
    tag: "Availability",
    title: "24/7 Multilingual Support",
    short: "No barriers. No borders.",
    body: "Humancare provides round-the-clock access to care in 30+ languages. Whether it's 2am in Tokyo or a Sunday afternoon in São Paulo, your employees connect with a doctor within minutes — no waiting rooms, no delays.",
    photo: MultilingualSupport247,
    alt: "24/7 multilingual telehealth and virtual medical support",
    stat: "24/7",
    statLabel: "Always On",
  },
  {
    id: 6,
    size: "sm",
    delay: "0.3s",
    tag: "Compliance",
    title: "HIPAA & GDPR Compliant Infrastructure",
    short: "Enterprise-grade data protection.",
    body: "Every consultation, prescription, and health record is stored and transmitted with end-to-end encryption on SOC 2 Type II certified infrastructure. Your organisation remains fully compliant without any additional effort.",
    photo: HIPAAGDPRCompliantInfrastructure,
    alt: "Secure HIPAA and GDPR compliant healthcare technology platform",
  },
  {
    id: 7,
    size: "md",
    delay: "1.2s",
    tag: "Onboarding",
    title: "Fast Implementation Under 2 Weeks",
    short: "From contract to live in days.",
    body: "Our dedicated onboarding team handles everything — SSO setup, HR system integration, employee communication, and training. Most clients go live within 10 business days with zero disruption to existing workflows.",
    photo: FastImplementationUnder2Weeks,
    alt: "Fast healthcare platform implementation and employee onboarding",
    stat: "< 2 wks",
    statLabel: "Go-live time",
  },
  {
    id: 8,
    size: "lg",
    delay: "0.08s",
    tag: "Productivity",
    title: "Increase Employee Retention & Productivity",
    short: "Invest in people. See the return.",
    body: "Organisations using Humancare report a 34% reduction in sick days and a 28% increase in team productivity within 6 months. When employees feel cared for, they show up — physically and mentally.",
    photo: IncreaseEmployeeRetentionProductivity,
    alt: "Employee productivity and retention through healthcare benefits",
    stat: "34%",
    statLabel: "Fewer Sick Days",
  },
];

function Card({ card, onOpen }) {
  const ref = useRef(null);

  const handleClick = () => {
    if (ref.current) {
      onOpen(card.id, ref.current.getBoundingClientRect());
    }
  };

  return (
    <div className="wcu-card-wrap">
      <div
        ref={ref}
        className={`wcu-card wcu-card--${card.size}`}
        style={{ "--delay": card.delay }}
        onClick={handleClick}
      >
        <div className="wcu-card__photo">
          <img
            src={card.photo}
            alt={card.alt}
            title={card.title}
            loading="lazy"
            decoding="async"
          />
        </div>
        {/* <div className="wcu-card__glass" /> */}
        {/* <div className="wcu-card__shine" />  */}
        <div className="wcu-card__body">
          <div className="wcu-card__tag">
            <span className="wcu-card__tag-dot" />
            <span className="wcu-card__tag-text">{card.tag}</span>
          </div>
          <p className="wcu-card__title">{card.title}</p>
          <p className="wcu-card__short">{card.short}</p>
          {card.stat && (
            <div className="wcu-card__stat">
              <span className="wcu-card__stat-num">{card.stat}</span>
              <span className="wcu-card__stat-lbl">{card.statLabel}</span>
            </div>
          )}
          <span className="wcu-card__hint">Tap to learn more →</span>
        </div>
      </div>
    </div>
  );
}

export default function WhyChooseUs() {
  const [activeId, setActiveId] = useState(null);
  const [phase, setPhase] = useState("idle");
  const activeCard = CARDS.find((c) => c.id === activeId);

  const openCard = useCallback((id) => {
    setActiveId(id);
    setPhase("opening");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase("open"));
    });
  }, []);

  const closeCard = useCallback(() => {
    setPhase("closing");
    setTimeout(() => {
      setPhase("idle");
      setActiveId(null);
    }, 420);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && activeId) closeCard();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, closeCard]);

  useEffect(() => {
    document.body.style.overflow =
      phase === "open" || phase === "opening" ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [phase]);

  const overlayClass = [
    "wcu-overlay",
    phase === "open" ? "wcu-overlay--visible" : "",
    phase === "closing" ? "wcu-overlay--hiding" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const popupClass = [
    "wcu-popup",
    phase === "open" ? "wcu-popup--visible" : "",
    phase === "closing" ? "wcu-popup--hiding" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="wcu-section">
      <div className="wcu-bg-scene" />
      <div className="wcu-bg-glow wcu-bg-glow--a" />
      <div className="wcu-bg-glow wcu-bg-glow--b" />

      <div className="wcu-layout">
        <div className="wcu-left">
          <div className="wcu-eyebrow">
            {/* <span className="wcu-eyebrow__line" /> */}
            <span className="wcu-eyebrow__text">
              Why Organizations Choose Us
            </span>
            {/* <span className="wcu-eyebrow__line" /> */}
          </div>

          <h2 className="wcu-heading">
            The Medical Partner
            <em className="wcu-heading__em">Organizations Trust</em>
          </h2>

          <p className="wcu-desc">
            From startups to Fortune 500 enterprises, forward-thinking
            organizations partner with Humancare to deliver measurable health
            outcomes — reducing costs, increasing retention, and building a
            culture of care.
          </p>

          <div className="wcu-metrics">
            <div className="wcu-metric">
              <span className="wcu-metric__num">
                2.4M<sup>+</sup>
              </span>
              <span className="wcu-metric__lbl">Patients Served</span>
            </div>
            <div className="wcu-metric__sep" />
            <div className="wcu-metric">
              <span className="wcu-metric__num">
                500<sup>+</sup>
              </span>
              <span className="wcu-metric__lbl">Doctors Global</span>
            </div>
            <div className="wcu-metric__sep" />
            <div className="wcu-metric">
              <span className="wcu-metric__num">
                98<sup>%</sup>
              </span>
              <span className="wcu-metric__lbl">Satisfaction</span>
            </div>
          </div>

          <button className="wcu-cta">
            <span>Learn More</span>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>

        <div className="wcu-right">
          <div className="wcu-masonry">
            {CARDS.map((card) => (
              <Card key={card.id} card={card} onOpen={openCard} />
            ))}
          </div>
        </div>
      </div>

      {activeId && activeCard && (
        <div className={overlayClass} onClick={closeCard}>
          <div className={popupClass} onClick={(e) => e.stopPropagation()}>
            <div className="wcu-popup__photo">
              <img
                src={activeCard.photo}
                alt={activeCard.alt}
                title={activeCard.title}
              />
            </div>
            <div className="wcu-popup__glass" />
            <div className="wcu-popup__shine" />

            <button
              className="wcu-popup__close"
              onClick={closeCard}
              aria-label="Close"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
                strokeLinecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="wcu-popup__inner">
              <div className="wcu-popup__tag">
                <span className="wcu-popup__tag-dot" />
                <span className="wcu-popup__tag-text">{activeCard.tag}</span>
              </div>

              {activeCard.stat && (
                <div className="wcu-popup__stat-block">
                  <span className="wcu-popup__stat-num">{activeCard.stat}</span>
                  <span className="wcu-popup__stat-lbl">
                    {activeCard.statLabel}
                  </span>
                </div>
              )}

              <h3 className="wcu-popup__title">{activeCard.title}</h3>
              <p className="wcu-popup__short">{activeCard.short}</p>
              <div className="wcu-popup__divider" />
              <p className="wcu-popup__body">{activeCard.body}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
