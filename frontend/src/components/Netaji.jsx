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
  tag: "COST EFFICIENCY",
  title: "Lower Healthcare Expenses Across Your Workforce",
  short: "Smarter healthcare. Better outcomes.",
  body: "Healthcare costs continue to rise for organizations of every size. Humancare Connect helps businesses control spending by improving access to preventive care, reducing unnecessary urgent care visits, and enabling employees to receive timely medical support through secure telemedicine services. By addressing health concerns earlier and minimizing avoidable healthcare expenses, organizations can strengthen workforce wellness while achieving measurable cost savings and long term value.",
  photo: ReduceInsuranceHealthcareCosts,
  alt: "Organizations reducing healthcare expenses through preventive care and corporate telemedicine services",
},
{
  id: 2,
  size: "md",
  delay: "0.5s",
  tag: "EMPLOYEE WELLBEING",
  title: "Support a Healthier, More Engaged Workforce",
  short: "Healthy people. Stronger organizations.",
  body: "Employee wellbeing directly impacts productivity, retention, engagement, and workplace culture. Humancare Connect helps organizations support physical health, mental wellness, preventive care, and ongoing healthcare needs through secure telemedicine services. By making healthcare more accessible, businesses can create a healthier work environment, improve employee satisfaction, and build a workforce that is better equipped to perform at its best.",
  photo: ImproveEmployeeClientWellbeing,
  alt: "Employees accessing telemedicine services that support physical health, mental wellness, and preventive care",
},
{
  id: 3,
  size: "sm",
  delay: "1.0s",
  tag: "COMPETITIVE ADVANTAGE",
  title: "Enhance Employee Benefits With Integrated Healthcare",
  short: "Deliver more value. Strengthen your employer brand.",
  body: "Modern employees expect healthcare benefits that are accessible, convenient, and designed around their needs. Humancare Connect helps organizations differentiate themselves by offering corporate telemedicine services that support employee wellness, improve healthcare access, and enhance the overall benefits experience. By integrating virtual healthcare services into your employee benefits strategy, your organization can attract top talent, improve retention, and demonstrate a stronger commitment to workforce well being.",
  photo: AddMedicalSupportValueAddedService,
  alt: "Integrated healthcare benefits enhancing employee experience and employer brand",
},
{
  id: 4,
  size: "lg",
  delay: "0.2s",
  tag: "GLOBAL PROVIDER NETWORK",
  title: "Connect Your Workforce to Trusted Medical Experts",
  short: "Care without boundaries. Support without delays.",
  body: "Give employees access to a broad network of licensed healthcare providers across multiple specialties through a secure telemedicine platform. Humancare Connect helps organizations improve healthcare accessibility by connecting teams with qualified medical professionals for online doctor appointments, virtual healthcare services, and ongoing clinical support. Whether employees are working remotely, traveling, or located across different regions, expert care is always within reach.",
  photo: AccessGlobalLicensedDoctorNetwork,
  alt: "Global network of licensed healthcare providers delivering secure virtual medical care",
},
{
  id: 5,
  size: "md",
  delay: "0.75s",
  tag: "24/7 ACCESSIBILITY",
  title: "Healthcare Support Whenever Employees Need It",
  short: "Always available. Always connected.",
  body: "Healthcare needs can arise at any time, regardless of location or work schedule. Humancare Connect provides round the clock access to telemedicine services, allowing employees to connect with licensed healthcare providers through secure online consultations whenever care is needed. With multilingual support and global accessibility, organizations can ensure their workforce receives timely healthcare guidance, whether employees are working remotely, traveling, or located across different regions.",
  photo: MultilingualSupport247,
  alt: "24/7 multilingual telemedicine support for employees across different regions",
},
{
  id: 6,
  size: "sm",
  delay: "0.3s",
  tag: "HIPAA & GDPR COMPLIANCE",
  title: "Protect Employee Health Data With Confidence",
  short: "Enterprise grade privacy. Trusted security.",
  body: "Humancare Connect is built on a secure telemedicine infrastructure designed to support both HIPAA and GDPR compliance requirements, helping organizations protect sensitive employee health information while maintaining the highest standards of privacy and security. From encrypted communications and secure data storage to controlled system access and ongoing security monitoring, our platform helps businesses confidently deliver virtual healthcare services while meeting modern regulatory and data protection expectations.",
  photo: HIPAAGDPRCompliantInfrastructure,
  alt: "Secure HIPAA and GDPR compliant telemedicine platform protecting employee health data",
},
{
  id: 7,
  size: "md",
  delay: "1.2s",
  tag: "RAPID DEPLOYMENT",
  title: "Launch Employee Healthcare Benefits Faster",
  short: "From onboarding to care in days.",
  body: "Implementing corporate telemedicine should be simple. Humancare Connect offers a streamlined onboarding process that allows organizations to quickly activate virtual healthcare services for their workforce. From employee enrollment and platform setup to provider access and support, our team ensures a smooth rollout that minimizes administrative burden and helps employees start benefiting from telemedicine services as quickly as possible.",
  photo: FastImplementationUnder2Weeks,
  alt: "Rapid onboarding and deployment of corporate telemedicine services",
},
{
  id: 8,
  size: "lg",
  delay: "0.08s",
  tag: "WORKFORCE PRODUCTIVITY",
  title: "Build a Healthier, More Productive Team",
  short: "Invest in wellbeing. Strengthen performance.",
  body: "Employee health and productivity go hand in hand. Humancare Connect helps organizations reduce healthcare related disruptions by providing fast access to virtual healthcare services, online doctor appointments, and preventive care support. When employees can address health concerns quickly and conveniently, they are better positioned to stay engaged, maintain performance, and contribute to long term business success. The result is a healthier workforce, improved retention, and a stronger workplace culture.",
  photo: IncreaseEmployeeRetentionProductivity,
  alt: "Healthy workforce improving productivity through accessible telemedicine services",
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
        <div className="wcu-card__glass" />
        <div className="wcu-card__shine" /> 
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
             WHY ORGANIZATIONS CHOOSE US
            </span>
            {/* <span className="wcu-eyebrow__line" /> */}
          </div>

          <h2 className="wcu-heading">
           The corporate telemedicine partner 
            <em className="wcu-heading__em">modern Organizations trust.</em>
          </h2>

          <p className="wcu-desc">
            From startups to enterprise teams, businesses choose Humancare Connect for reliable corporate telemedicine services, scalable virtual healthcare solutions, and faster employee access to care. Our secure telemedicine platform helps organizations improve workforce wellness, reduce healthcare delays, and support healthier, more productive teams.
          </p>

          <div className="wcu-metrics">
            <div className="wcu-metric">
              <span className="wcu-metric__num">
                2.4M<sup>+</sup>
              </span>
              <span className="wcu-metric__lbl">2.4M+ patients supported
</span>
            </div>
            <div className="wcu-metric__sep" />
            <div className="wcu-metric">
              <span className="wcu-metric__num">
                500<sup>+</sup>
              </span>
              <span className="wcu-metric__lbl">500+ licensed providers</span>
            </div>
            <div className="wcu-metric__sep" />
            <div className="wcu-metric">
              <span className="wcu-metric__num">
                98<sup>%</sup>
              </span>
              <span className="wcu-metric__lbl">98% patient satisfaction
</span>
            </div>
          </div>

          {/* <button className="wcu-cta">
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
          </button> */}
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
