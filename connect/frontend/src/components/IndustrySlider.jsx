import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./industrySlider.css";
import { BsBuildingsFill } from "react-icons/bs";
import { MdHealthAndSafety } from "react-icons/md";
import {
  FaAnchor,
  FaBalanceScale,
  FaHotel,
} from "react-icons/fa";

// Swiper imports
import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCoverflow, Autoplay, Pagination } from "swiper/modules";

// Swiper Styles
import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/pagination";

const industries = [
  {
    id: 1,
    icon: <BsBuildingsFill />,
    tab: "Corporates",
    tag: "EMPLOYEE HEALTH",
    title: "Corporates",
    description: "Empower your workforce with on-demand healthcare access. From routine consultations to specialist referrals.",
    features: ["24/7 teleconsultations", "Mental health support", "Annual screenings"],
    accent: "#0c8b7a",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=90"
  },
  {
    id: 2,
    icon: <MdHealthAndSafety />,
    tab: "Insurance",
    tag: "EMBEDDED CARE",
    title: "Insurance Cos.",
    description: "Enhance your policy offerings with integrated telehealth. Reduce claims costs while delivering superior experiences.",
    features: ["Claims reduction tools", "Member wellness portals", "Real-time consults"],
    accent: "#1a56db",
    image: "https://images.unsplash.com/photo-1509017174183-0b7e0278f1ec?auto=format&fit=crop&w=1200&q=90"
  },
  {
    id: 3,
    icon: <FaAnchor />,
    tab: "Maritime",
    tag: "REMOTE MEDICAL",
    title: "Maritime",
    description: "Keep crews safe in international waters with specialized support. Remote diagnoses and emergency evacuations.",
    features: ["Satellite consultations", "Emergency evacuations", "Port medical liaison"],
    accent: "#0c8b7a",
    image: "https://images.unsplash.com/photo-1534312527009-56c7016453e6?auto=format&fit=crop&w=1200&q=90"
  },
  {
    id: 4,
    icon: <FaBalanceScale />,
    tab: "Law Firms",
    tag: "MEDICO-LEGAL",
    title: "Law Firms",
    description: "Strengthen your cases with expert medico-legal support. Access certified medical professionals for documentation.",
    features: ["Expert witness reports", "Medical record review", "IME coordination"],
    accent: "#7c3aed",
    image: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=90"
  },
  {
    id: 5,
    icon: <FaHotel />,
    tab: "Hotels",
    tag: "GUEST ASSIST",
    title: "Hotels",
    description: "Elevate guest experience with on-demand support. From minor illnesses to emergency coordination.",
    features: ["Guest teleconsultations", "Concierge medical visits", "Emergency referrals"],
    accent: "#c97b1a",
    image: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=90"
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
      {/* Dynamic Background */}
      {/* <AnimatePresence mode="wait"> */}
        {/* <motion.div 
          key={activeIndex}
          className="slider-dynamic-bg"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.4, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          style={{ '--accent': industries[activeIndex].accent }}
        /> */}
      {/* </AnimatePresence> */}

      <div className="slider-page-wrap">
        <motion.div 
          className="slider-header-modern"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="slider-h1-v2">Our Expertise Across <span>Industries</span></h2>
          <p className="slider-subtitle">Tailored medical solutions designed for the unique challenges of your sector.</p>
        </motion.div>

        {/* Sync Tabs */}
        <motion.div 
          className="slider-nav-v2"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {industries.map((ind, i) => (
            <button
              key={ind.id}
              className={`nav-v2-item ${activeIndex === i ? "active" : ""}`}
              onClick={() => handleTabClick(i)}
            >
              {ind.tab}
            </button>
          ))}
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
            pagination={{
              clickable: true,
              dynamicBullets: true,
            }}
            onSwiper={(swiper) => (swiperRef.current = swiper)}
            onSlideChange={(swiper) => setActiveIndex(swiper.realIndex)}
            modules={[EffectCoverflow, Autoplay, Pagination]}
            className="industry-panoramic-swiper"
          >
            {industries.map((ind, index) => (
              // <SwiperSlide key={ind.id} style={{ width: 'min(90vw, 1000px)' }}>
              <SwiperSlide key={ind.id} style={{ width: 'min(90vw, 1000px)' }}>
                <motion.div 
                  className="industry-card-v3" 
                  style={{ '--accent': ind.accent }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ 
                    opacity: activeIndex === index ? 1 : 0.4,
                    scale: activeIndex === index ? 1 : 0.9,
                    filter: activeIndex === index ? "blur(0px)" : "blur(2px)"
                  }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="v3-image-area">
                    <img src={ind.image} alt={ind.title} />
                    <div className="v3-overlay"></div>
                    <motion.div 
                      className="v3-icon-badge"
                      initial={{ scale: 0 }}
                      animate={{ scale: activeIndex === index ? 1 : 0 }}
                      transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                    >
                      {ind.icon}
                    </motion.div>
                  </div>
                  
                  <div className="v3-content">
                    <motion.div 
                      className="v3-tag"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: activeIndex === index ? 1 : 0.45, x: activeIndex === index ? 0 : -8 }}
                      transition={{ delay: 0.4 }}
                    >
                      {ind.tag}
                    </motion.div>
                    <motion.h3 
                      className="v3-title"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: activeIndex === index ? 1 : 0.55, y: activeIndex === index ? 0 : 8 }}
                      transition={{ delay: 0.5 }}
                    >
                      {ind.title}
                    </motion.h3>
                    <motion.p 
                      className="v3-desc"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: activeIndex === index ? 1 : 0.42, y: activeIndex === index ? 0 : 8 }}
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
                          animate={{ opacity: activeIndex === index ? 1 : 0.38, x: activeIndex === index ? 0 : 8 }}
                          transition={{ delay: 0.7 + idx * 0.1 }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          {f}
                        </motion.div>
                      ))}
                    </div>

                    <motion.div 
                      className="v3-footer"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: activeIndex === index ? 1 : 0.45, y: activeIndex === index ? 0 : 8 }}
                      transition={{ delay: 1 }}
                    >
                      <button className="v3-cta">View Case Study</button>
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

