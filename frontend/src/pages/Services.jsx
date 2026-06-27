/**
 * HealthcareAlternating.jsx
 * Premium Zig-Zag Healthcare Services Page
 * React functional component — separate CSS, no Tailwind/Bootstrap
 */

import { useEffect, useRef } from "react";
import "./Services.css";

import OnlinePrescriptionImg from "../assets/MedicalServices/online-prescription-digital-healthcare.webp";

import SickNotesDoctorNotesImg from "../assets/MedicalServices/sick-notes-medical-certificates.webp";

import FitToFlyCertificateImg from "../assets/MedicalServices/fit-to-fly-medical-certificate.webp";

import LabServicesImg from "../assets/MedicalServices/laboratory-diagnostic-testing-services.webp";

import HomeCareServicesImg from "../assets/MedicalServices/home-healthcare-nursing-services.webp";

import HospitalizationSupportImg from "../assets/MedicalServices/hospitalization-support-care-coordination.webp";

import OnlineDoctorConsultationImg from "../assets/MedicalServices/online-doctor-video-consultation.webp";

/* ─────────────────────────────────────────
   SERVICES DATA
   Replace imageUrl with real assets or API
───────────────────────────────────────── */
const SERVICES = [
  // {
  //   id: 1,
  //   label: "Digital Health",
  //   title: "Overseas Medical Solutions ",
  //   description:
  //     "Skip the waiting room. Our licensed doctors review your medical history and issue valid prescriptions digitally — safely, quickly, and from anywhere in the world.",
  //   features: [
  //     "Reviewed and signed by certified physicians",
  //     "Sent directly to your pharmacy or inbox",
  //     "Valid for all standard medications",
  //   ],
  //   imageUrl:
  //     OnlinePrescriptionImg,

  //   imageAlt: "Doctor issuing an online prescription through a secure digital healthcare platform",
  //   badgeNum: "2K+",
  //   badgeLabel: "Prescriptions Issued",
  // },
  {
    id: 2,
    label: "Digital Health",
    title: "Online Prescription",
    description:
      "Skip the waiting room. Our licensed doctors review your medical history and issue valid prescriptions digitally — safely, quickly, and from anywhere in the world.",
    features: [
      "Reviewed and signed by certified physicians",
      "Sent directly to your pharmacy or inbox",
      "Valid for all standard medications",
    ],
    imageUrl: OnlinePrescriptionImg,
    imageAlt:
      "Doctor issuing an online prescription through a secure digital healthcare platform",
    badgeNum: "2K+",
    badgeLabel: "Prescriptions Issued",
  },
  {
    id: 3,
    label: "Medical Certificates",
    title: "Sick Notes / Doctor Notes",
    description:
      "Need official documentation for work, school, or insurance? Our doctors provide verified sick notes and medical certificates accepted by employers and institutions nationwide.",
    features: [
      "Legally recognised by employers and schools",
      "Issued within hours, not days",
      "Available for single or extended periods",
    ],
    imageUrl: SickNotesDoctorNotesImg,
    imageAlt:
      "Doctor reviewing and issuing medical certificates and sick notes for patients",
    badgeNum: "98%",
    badgeLabel: "Acceptance Rate",
  },
  {
    id: 4,
    label: "Travel Health",
    title: "Fit to Fly Certificate",
    description:
      "Planning to travel but need medical clearance? Our doctors assess your health condition and issue a fit-to-fly certificate that meets airline and airport requirements worldwide.",
    features: [
      "Accepted by all major international airlines",
      "Quick turnaround — same day available",
      "Includes complete health assessment",
    ],
    imageUrl: FitToFlyCertificateImg,
    imageAlt:
      "Medical assessment for fit to fly certificate before international travel",
    badgeNum: "500+",
    badgeLabel: "Airlines Covered",
  },
  {
    id: 5,
    label: "Diagnostics",
    title: "Lab Services",
    description:
      "Accurate diagnostics from the comfort of your home or at a nearby certified partner clinic. Our lab network covers hundreds of tests with fast digital reporting.",
    features: [
      "Book at-home or walk-in sample collection",
      "Results reviewed by our medical panel",
      "Integrated with your health records",
    ],
    imageUrl: LabServicesImg,
    imageAlt:
      "Laboratory technician performing diagnostic testing and sample analysis",
    badgeNum: "300+",
    badgeLabel: "Tests Available",
  },
  {
    id: 6,
    label: "At-Home Care",
    title: "Home Care Services",
    description:
      "Professional nursing, physiotherapy, and post-surgery recovery care delivered straight to your door. Recover comfortably with round-the-clock qualified medical staff.",
    features: [
      "Trained nurses and physiotherapists",
      "Post-surgery and chronic care support",
      "Scheduled or on-demand visits",
    ],
    imageUrl: HomeCareServicesImg,
    imageAlt:
      "Professional home healthcare nurse providing medical support to a patient",
    badgeNum: "24/7",
    badgeLabel: "Care Available",
  },
  {
    id: 7,
    label: "Hospital Services",
    title: "Hospitalization Support",
    description:
      "From hospital admission to discharge planning, our coordinators work alongside your medical team to ensure a smooth, stress-free hospitalization experience for you and your family.",
    features: [
      "End-to-end admission coordination",
      "Specialist referral and bed arrangement",
      "Insurance claim and billing assistance",
    ],
    imageUrl: HospitalizationSupportImg,
    imageAlt:
      "Hospital care coordination and patient hospitalization support services",
    badgeNum: "150+",
    badgeLabel: "Partner Hospitals",
  },
  {
    id: 8,
    label: "Teleconsultation",
    title: "Online Doctor Consultation",
    description:
      "Speak face-to-face with a qualified doctor via video or chat in minutes. Get expert advice, second opinions, and Personalized follow-up care — no appointment needed.",
    features: [
      "Connect with specialists in under 5 minutes",
      "Secure video, audio, or chat sessions",
      "Follow-up care and prescriptions included",
    ],
    imageUrl: OnlineDoctorConsultationImg,
    imageAlt:
      "Patient attending an online doctor consultation through a telemedicine platform",
    badgeNum: "4.9★",
    badgeLabel: "Patient Rating",
  },
];

/* ─────────────────────────────────────────
   ICONS
───────────────────────────────────────── */
const CheckIcon = () => (
  <svg viewBox="0 0 12 12">
    <polyline points="2 6 5 9 10 3" />
  </svg>
);

const ArrowIcon = () => (
  <svg viewBox="0 0 10 10">
    <line x1="2" y1="5" x2="8" y2="5" />
    <polyline points="5 2 8 5 5 8" />
  </svg>
);

/* ─────────────────────────────────────────
   HOOK — Intersection Observer for scroll
───────────────────────────────────────── */
function useScrollReveal(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.12 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
}

/* ─────────────────────────────────────────
   SUB-COMPONENT — ServiceBlock
───────────────────────────────────────── */
function ServiceBlock({ service, isReverse }) {
  const blockRef = useRef(null);
  useScrollReveal(blockRef);

  return (
    <section
      className={`ha-service-block${isReverse ? " reverse" : ""}`}
      aria-labelledby={`service-title-${service.id}`}
    >
      <div className="ha-service-inner ha-animate" ref={blockRef}>
        {/* ── Image side ── */}
        <div className="ha-img-wrap">
          <img
            src={service.imageUrl}
            alt={service.imageAlt}
            loading="lazy"
            decoding="async"
          />
          <div className="ha-img-badge">
            <span className="ha-img-badge-num">{service.badgeNum}</span>
            <span className="ha-img-badge-label">{service.badgeLabel}</span>
          </div>
        </div>

        {/* ── Content side ── */}
        <div className="ha-content">
          <span className="ha-content-label">{service.label}</span>

          <h2 className="ha-content-title" id={`service-title-${service.id}`}>
            {service.title}
          </h2>

          <p className="ha-content-desc">{service.description}</p>

          <ul
            className="ha-features"
            aria-label={`Features of ${service.title}`}
          >
            {service.features.map((feat, i) => (
              <li key={i} className="ha-feature-item">
                <span className="ha-feature-icon">
                  <CheckIcon />
                </span>
                {feat}
              </li>
            ))}
          </ul>

          <button
            className="ha-cta-btn"
            type="button"
            aria-label={`Know more about ${service.title}`}
            onClick={() =>
              console.log(
                `[HealthcareAlternating] Know More → ${service.title}`,
              )
            }
          >
            <span>Know More</span>
            <span className="ha-cta-btn-icon">
              <ArrowIcon />
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   MAIN COMPONENT — HealthcareAlternating
───────────────────────────────────────── */
export default function HealthcareAlternating() {
  return (
    <div className="ha-page">
      {/* ── Page Header ── */}
      {/* <header className="ha-page-header">
        <div className="ha-page-eyebrow">
          <span className="ha-page-eyebrow-dot" />
          What We Offer
        </div>
        <h1 className="ha-page-title">
          Our <span>Healthcare</span> Services
        </h1>
        <p className="ha-page-subtitle">
          Reliable, fast &amp; professional medical support — available anytime, anywhere.
        </p>
      </header> */}
      <section>
        <div className="ms-hero">
          <div className="ms-hero-inner">
            <h1>Our Healthcare Services</h1>
            <p>
              Reliable, fast & professional medical support — available anytime,
              anywhere.
            </p>
          </div>
        </div>
      </section>

      {/* ── Alternating Service Blocks ── */}
      <main>
        {SERVICES.map((service, index) => (
          <ServiceBlock
            key={service.id}
            service={service}
            isReverse={index % 2 !== 0}
          />
        ))}
      </main>

      {/* ── Footer CTA Strip ── */}
      <div className="ha-footer-strip">
        <div className="ha-footer-strip-inner">
          <h3>Not sure which service you need?</h3>
          <p>
            Talk to one of our medical advisors and we'll guide you to the right
            solution — completely free.
          </p>
          <button className="ha-footer-strip-btn" type="button">
            Talk to a Doctor Now
            <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
