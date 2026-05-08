import { useState, useEffect, useRef } from "react";
import "./demo.css";
import { BsBuildingsFill } from "react-icons/bs";
import { MdHealthAndSafety } from "react-icons/md";
import {
  FaAnchor,
  FaBalanceScale,
  FaHotel,
  FaCity,
  FaPlane,
} from "react-icons/fa";

const industries = [
  {
    id: 1,
    icon: <BsBuildingsFill />,
    tab: "Corporates",
    subtitle: "Employee Healthcare",
    tag: "EMPLOYEE HEALTH",
    title: "Corporates",
    description:
      "Empower your workforce with on-demand healthcare access. From routine consultations to specialist referrals, we keep your team healthy and productive.",
    features: [
      "24/7 teleconsultations",
      "Mental health support",
      "Annual health screenings",
      "Insurance integration",
    ],
  },
  {
    id: 2,
    icon: <MdHealthAndSafety />,
    tab: "Insurance Cos.",
    subtitle: "Embedded Telehealth",
    tag: "EMBEDDED TELEHEALTH",
    title: "Insurance Companies",
    description:
      "Enhance your policy offerings with integrated telehealth. Reduce claims costs while delivering superior member experiences across every plan tier.",
    features: [
      "Claims reduction tools",
      "Member wellness portals",
      "Real-time consultations",
      "Data analytics",
    ],
  },
  {
    id: 3,
    icon: <FaAnchor />,
    tab: "Shipping & Maritime",
    subtitle: "Maritime Telemedicine",
    tag: "MARITIME TELEMEDICINE",
    title: "Shipping & Maritime",
    description:
      "Keep crews safe in international waters with specialized maritime medical support. From remote diagnoses to emergency evacuations, we have you covered at sea.",
    features: [
      "Satellite consultations",
      "Emergency evacuations",
      "Port medical liaison",
      "Crew wellness programs",
    ],
  },
  {
    id: 4,
    icon: <FaBalanceScale />,
    tab: "Law Firms",
    subtitle: "Medico-Legal Services",
    tag: "MEDICO-LEGAL SERVICES",
    title: "Law Firms",
    description:
      "Strengthen your cases with expert medico-legal support. Access certified medical professionals who provide accurate documentation and expert witness services.",
    features: [
      "Expert witness reports",
      "Medical record review",
      "IME coordination",
      "Court-ready documentation",
    ],
  },
  {
    id: 5,
    icon: <FaHotel />,
    tab: "Hotels & Rentals",
    subtitle: "Guest Medical Assist.",
    tag: "GUEST MEDICAL ASSISTANCE",
    title: "Hotels & Rentals",
    description:
      "Elevate guest experience with on-demand medical support. From minor illnesses to emergency coordination, we ensure your guests feel safe wherever they stay.",
    features: [
      "24/7 guest teleconsultations",
      "Concierge medical visits",
      "Emergency referrals",
      "Multi-language support",
    ],
  },
  {
    id: 6,
    icon: <FaCity />,
    tab: "Property Cos.",
    subtitle: "Tenant Healthcare",
    tag: "TENANT HEALTHCARE",
    title: "Property Companies",
    description:
      "Add healthcare value to your properties and attract premium tenants. Offer residents convenient medical access as a differentiating amenity.",
    features: [
      "On-site telemedicine",
      "Resident health portals",
      "Emergency response",
      "Wellness programs",
    ],
  },
  {
    id: 7,
    icon: <FaPlane />,
    tab: "Tourism Cos.",
    subtitle: "Traveler Medical Assist.",
    tag: "TRAVELER MEDICAL ASSISTANCE",
    title: "Tourism Companies",
    description:
      "Protect travelers across every destination with comprehensive medical support. Ensure peace of mind with 24/7 assistance that travels with your clients.",
    features: [
      "Destination medical support",
      "Travel insurance coordination",
      "Emergency repatriation",
      "Pre-trip consultations",
    ],
  },
];

const TOTAL = industries.length;

export default function IndustryCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [screenWidth, setScreenWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200,
  );
  const intervalRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const startAuto = () => {
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % TOTAL);
    }, 3000);
  };

  useEffect(() => {
    if (isPlaying) startAuto();
    else clearInterval(intervalRef.current);
    return () => clearInterval(intervalRef.current);
  }, [isPlaying]);

  const handleTabClick = (i) => {
    setActiveIndex(((i % TOTAL) + TOTAL) % TOTAL);
    setIsPlaying(false);
    clearInterval(intervalRef.current);
  };

  const getOffset = (i) => {
    let diff = i - activeIndex;
    if (diff > TOTAL / 2) diff -= TOTAL;
    if (diff < -TOTAL / 2) diff += TOTAL;
    return diff;
  };

  const slotConfig = (offset) => {
    const abs = Math.abs(offset);
    const sign = offset < 0 ? -1 : 1;

    // Responsive positioning based on screen width
    let tx1, tx2, tx3;
    let scale1, scale2, scale3;
    let opacity1, opacity2;

    if (screenWidth < 480) {
      // Extra small mobile
      tx1 = sign * 160;
      tx2 = sign * 220;
      tx3 = sign * 280;
      scale1 = 0.65;
      scale2 = 0.45;
      scale3 = 0.3;
      opacity1 = 0.5;
      opacity2 = 0.2;
    } else if (screenWidth < 640) {
      // Small mobile
      tx1 = sign * 180;
      tx2 = sign * 250;
      tx3 = sign * 320;
      scale1 = 0.68;
      scale2 = 0.48;
      scale3 = 0.32;
      opacity1 = 0.55;
      opacity2 = 0.25;
    } else if (screenWidth < 768) {
      // Mobile
      tx1 = sign * 220;
      tx2 = sign * 300;
      tx3 = sign * 380;
      scale1 = 0.7;
      scale2 = 0.5;
      scale3 = 0.35;
      opacity1 = 0.6;
      opacity2 = 0.3;
    } else if (screenWidth < 1024) {
      // Tablet
      tx1 = sign * 300;
      tx2 = sign * 400;
      tx3 = sign * 500;
      scale1 = 0.73;
      scale2 = 0.52;
      scale3 = 0.36;
      opacity1 = 0.65;
      opacity2 = 0.35;
    } else if (screenWidth < 1400) {
      // Medium desktop
      tx1 = sign * 360;
      tx2 = sign * 480;
      tx3 = sign * 600;
      scale1 = 0.75;
      scale2 = 0.54;
      scale3 = 0.37;
      opacity1 = 0.7;
      opacity2 = 0.36;
    } else {
      // Large desktop (default)
      tx1 = sign * 400;
      tx2 = sign * 540;
      tx3 = sign * 700;
      scale1 = 0.76;
      scale2 = 0.55;
      scale3 = 0.38;
      opacity1 = 0.72;
      opacity2 = 0.38;
    }

    if (offset === 0)
      return { tx: 0, scale: 1, ry: 0, z: 20, opacity: 1, blur: 0 };
    if (abs === 1)
      return {
        tx: tx1,
        scale: scale1,
        ry: -sign * 14,
        z: 10,
        opacity: opacity1,
        blur: 0,
      };
    if (abs === 2)
      return {
        tx: tx2,
        scale: scale2,
        ry: -sign * 24,
        z: 5,
        opacity: opacity2,
        blur: 1,
      };
    return {
      tx: tx3,
      scale: scale3,
      ry: -sign * 32,
      z: 1,
      opacity: 0,
      blur: 3,
    };
  };

  return (
    <>
      <div className="page">
        {/* Header */}
        <div className="eyebrow">WHO WE WORK WITH</div>
        <h1 className="page-h1">Built for Every Industry</h1>
        <p className="subtitle">
          From Fortune 500 corporations to boutique hotels — select your
          industry to see how we tailor our medical support to your specific
          needs.
        </p>

        {/* Tab Bar */}
        <div className="tab-bar">
          {industries.map((ind, i) => (
            <div
              key={ind.id}
              className={`tab-item ${activeIndex === i ? "active" : ""}`}
              onClick={() => handleTabClick(i)}
            >
              <span className="tab-icon">{ind.icon}</span>
              <span className="tab-name">{ind.tab}</span>
              <span className="tab-sub">{ind.subtitle}</span>
            </div>
          ))}
        </div>

        {/* Carousel Stage */}
        <div className="stage">
          {industries.map((ind, i) => {
            const offset = getOffset(i);
            const cfg = slotConfig(offset);
            const isActive = offset === 0;
            const isClickable = Math.abs(offset) <= 2 && !isActive;

            return (
              <div
                key={ind.id}
                className="card-slot"
                style={{
                  transform: `translateX(calc(-50% + ${cfg.tx}px)) translateY(-50%) scale(${cfg.scale}) rotateY(${cfg.ry}deg)`,
                  zIndex: cfg.z,
                  opacity: cfg.opacity,
                  filter: cfg.blur > 0 ? `blur(${cfg.blur}px)` : "none",
                  pointerEvents: cfg.opacity === 0 ? "none" : "auto",
                }}
                onClick={() => isClickable && handleTabClick(i)}
              >
                <div className={`card${isActive ? " active" : ""}`}>
                  <div className="card-header">
                    <div className="icon-wrap">{ind.icon}</div>
                    <div className="card-tag">{ind.tag}</div>
                  </div>
                  <div className="card-title">{ind.title}</div>
                  <div className="card-desc">{ind.description}</div>
                  <div className="features">
                    {ind.features.map((f) => (
                      <span className="feat-pill" key={f}>
                        {f}
                      </span>
                    ))}
                  </div>
                  {isActive && (
                    <div className="card-footer">
                      <div className="badge">🌐 Available in 50+ countries</div>
                      <button className="cta">Get a Proposal</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
