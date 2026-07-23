import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./industrySlider.css";
import { BsBuildingsFill } from "react-icons/bs";
import { MdHealthAndSafety } from "react-icons/md";
import { FaAnchor, FaBalanceScale, FaHotel } from "react-icons/fa";

// Swiper imports
import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCoverflow, Autoplay, Pagination } from "swiper/modules";

import CorporateHealthcareImg from "../assets/Industries/corporate-employee-healthcare-solutions.webp";
import InsuranceTelehealthImg from "../assets/Industries/insurance-telehealth-solutions.webp";
import MaritimeTelemedicineImg from "../assets/Industries/maritime-telemedicine-services.webp";
import MedicoLegalHealthcareImg from "../assets/Industries/medico-legal-healthcare-support.webp";
import HotelGuestHealthcareImg from "../assets/Industries/hotel-guest-medical-assistance.webp";

// Swiper Styles
import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/pagination";

const industries = [
  {
    id: 1,
    icon: <BsBuildingsFill />,
    tab: "Employee Health",
    tag: "EMPLOYEE HEALTH",
    title: "Corporate Healthcare Solutions",
    description:
      "Empower your workforce with convenient access to corporate telemedicine services, virtual healthcare solutions, and licensed healthcare providers. From routine medical consultations to preventive care and mental health support, Humancare Connect helps organizations build healthier, more productive teams through one secure telemedicine platform.",
    features: [
      "24/7 Telehealth Consultations",
      "Mental Health & Wellness Support",
      "Preventive Health Screenings",
    ],
    accent: "#1d68a4",
    image: CorporateHealthcareImg,
    imageAlt:
      "Corporate employees accessing virtual healthcare and online doctor consultations through an employee wellness program",
  },
  {
    id: 2,
    icon: <MdHealthAndSafety />,
    tab: "Insurance",
    tag: "EMBEDDED CARE",
    title: "Insurance & Healthcare Partners",
    description:
      "Enhance member experiences with integrated telehealth solutions. Support preventive care, improve healthcare accessibility, and help reduce unnecessary healthcare utilization through secure virtual healthcare services designed for insurers, health plans, and healthcare partners.",
    features: [
      "Claims Cost Reduction Strategies",
      "Member Wellness & Engagement Programs",
      "Real Time Virtual Consultations",
    ],
    accent: "#1a56db",
    image: InsuranceTelehealthImg,
    imageAlt:
      "Health insurance members receiving secure virtual healthcare services through an integrated telehealth platform",
  },
  {
    id: 3,
    icon: <FaAnchor />,
    tab: "Maritime",
    tag: "REMOTE MEDICAL",
    title: "Maritime Healthcare Solutions",
    description:
      "Keep crews connected to expert medical support wherever operations take them. Humancare Connect provides remote healthcare services for maritime organizations, helping vessels access medical guidance, telemedicine consultations, and coordinated care support while at sea or in international waters.",
    features: [
      "Remote Telemedicine Consultations",
      "Emergency Medical Coordination",
      "Port & Crew Healthcare Support",
    ],
    accent: "#0c8b7a",
    image: MaritimeTelemedicineImg,
    imageAlt:
      "Maritime crew receiving remote telemedicine consultations and coordinated healthcare support while at sea",
  },
  {
    id: 4,
    icon: <FaBalanceScale />,
    tab: "Law Firms",
    tag: "MEDICO LEGAL",
    title: "Healthcare Support for Legal Professionals",
    description:
      "Strengthen legal cases with access to qualified medical experts, healthcare documentation, and medico legal support services. Humancare Connect helps law firms obtain professional medical insights, coordinate independent medical evaluations, and access healthcare expertise that supports case preparation and informed legal decision making.",
    features: [
      "Expert Medical Opinions & Reports",
      "Medical Record Review Services",
      "Independent Medical Evaluation Coordination",
    ],
    accent: "#7c3aed",
    image: MedicoLegalHealthcareImg,
    imageAlt:
      "Medical expert providing healthcare documentation, medical record review, and medico legal support for legal professionals",
  },
  {
    id: 5,
    icon: <FaHotel />,
    tab: "Hotels",
    tag: "GUEST HEALTHCARE",
    title: "Healthcare Support for Hospitality & Travel",
    description:
      "Enhance the guest experience with convenient access to healthcare services and medical support whenever needed. Humancare Connect helps hotels, resorts, and hospitality providers offer trusted telemedicine services, giving guests access to licensed healthcare providers for routine medical concerns, travel related health issues, and urgent care coordination.",
    features: [
      "Virtual Medical Consultations for Guests",
      "Concierge Healthcare Coordination",
      "Emergency Referral & Care Support",
    ],
    accent: "#c97b1a",
    image: HotelGuestHealthcareImg,
    imageAlt:
      "Hotel guest receiving virtual medical consultations and healthcare support through telemedicine services while traveling",
  },
];

export default function IndustrySlider() {
  const [activeIndex, setActiveIndex] = useState(0);
  const swiperRef = useRef(null);

  const handleTabClick = (index) => {
    if (swiperRef.current) {
      swiperRef.current.slideToLoop(index);
    }
  };

  return (
    <section className="industry-slider-section">
      <div className="slider-page-wrap">
        <motion.div
          className="slider-header-modern"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="slider-h1-v2">
            Telemedicine expertise across every <span> industry.</span>
          </h2>
          <p className="slider-subtitle">
            Flexible telehealth services, online doctor appointments, and virtual healthcare solutions designed for corporate teams, healthcare organizations, logistics, technology, hospitality, education, manufacturing, and more.
          </p>
        </motion.div>

        {/* Sync Tabs — scroll wrapper keeps nav on one line on mobile */}
        <motion.div
          className="slider-nav-scroll-wrap"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="slider-nav-v2">
            {industries.map((ind, i) => (
              <button
                key={ind.id}
                className={`nav-v2-item ${activeIndex === i ? "active" : ""}`}
                onClick={() => handleTabClick(i)}
                style={{
                  "--accent-color": ind.accent,
                }}
              >
                {activeIndex === i && (
                  <motion.span
                    layoutId="activeTabPill"
                    className="nav-v2-active-bg"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="nav-v2-icon">{ind.icon}</span>
                <span className="nav-v2-text">{ind.tab}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* 3D PANORAMIC STAGE */}
        <div className="slider-stage-v2">
          <Swiper
            effect={"coverflow"}
            grabCursor={true}
            centeredSlides={true}
            loop={true}
            slidesPerView={"auto"}
            speed={1000}
            coverflowEffect={{
              rotate: 0,
              stretch: 0,
              depth: 100,
              modifier: 2.5,
              slideShadows: false,
            }}
            autoplay={{
              delay: 5000,
              disableOnInteraction: false,
            }}
            pagination={{ clickable: true }}
            onSwiper={(swiper) => (swiperRef.current = swiper)}
            onSlideChange={(swiper) => setActiveIndex(swiper.realIndex)}
            modules={[EffectCoverflow, Autoplay, Pagination]}
            className="industry-panoramic-swiper"
          >
            {industries.map((ind, index) => (
              <SwiperSlide key={ind.id} style={{ width: "min(90vw, 1000px)" }}>
                <motion.div
                  className="industry-card-v3"
                  style={{ "--accent": ind.accent }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{
                    opacity: activeIndex === index ? 1 : 0.4,
                    scale: activeIndex === index ? 1 : 0.9,
                    filter: activeIndex === index ? "blur(0px)" : "blur(2px)",
                  }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="v3-image-area">
                    <img
                      src={ind.image}
                      alt={ind.imageAlt}
                      title={ind.title}
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="v3-overlay"></div>
                    <motion.div
                      className="v3-icon-badge"
                      initial={{ scale: 0 }}
                      animate={{ scale: activeIndex === index ? 1 : 0 }}
                      transition={{
                        delay: 0.3,
                        type: "spring",
                        stiffness: 200,
                      }}
                    >
                      {ind.icon}
                    </motion.div>
                  </div>

                  <div className="v3-content">
                    <motion.div
                      className="v3-tag"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{
                        opacity: activeIndex === index ? 1 : 0.45,
                        x: activeIndex === index ? 0 : -8,
                      }}
                      transition={{ delay: 0.4 }}
                    >
                      {ind.tag}
                    </motion.div>
                    <motion.h3
                      className="v3-title"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{
                        opacity: activeIndex === index ? 1 : 0.55,
                        y: activeIndex === index ? 0 : 8,
                      }}
                      transition={{ delay: 0.5 }}
                    >
                      {ind.title}
                    </motion.h3>
                    <motion.p
                      className="v3-desc"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{
                        opacity: activeIndex === index ? 1 : 0.42,
                        y: activeIndex === index ? 0 : 8,
                      }}
                      transition={{ delay: 0.6 }}
                    >
                      {ind.description}
                    </motion.p>

                    <div className="v3-features">
                      {ind.features.map((f, idx) => (
                        <motion.div
                          className="v3-feat"
                          key={idx}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{
                            opacity: activeIndex === index ? 1 : 0.38,
                            x: activeIndex === index ? 0 : 8,
                          }}
                          transition={{ delay: 0.7 + idx * 0.1 }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          {f}
                        </motion.div>
                      ))}
                    </div>

                    <motion.div
                      className="v3-footer"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{
                        opacity: activeIndex === index ? 1 : 0.45,
                        y: activeIndex === index ? 0 : 8,
                      }}
                      transition={{ delay: 1 }}
                    >
                      {/* <button className="v3-cta">View Case Study</button> */}
                    </motion.div>
                  </div>
                </motion.div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>
    </section>
  );
}
