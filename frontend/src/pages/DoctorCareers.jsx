import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  FaClock,
  FaHouseLaptop,
  FaSackDollar,
  FaShieldHalved,
  FaUserDoctor,
  FaHeadset,
  FaCircleCheck,
  FaStethoscope,
  FaBaby,
  FaVenus,
  FaBrain,
  FaPlaneDeparture,
  FaTruckMedical,
  FaHeartPulse,
  FaHeart,
  FaFileShield,
  FaUsers,
  FaGlobe,
  FaChartLine,
  FaGraduationCap,
  FaQuoteLeft,
  FaChevronDown,
  FaArrowRight,
  FaChevronLeft,
  FaChevronRight,
  FaLaptopMedical,
  FaFileSignature,
  FaClipboardCheck,
  FaComments,
  FaRocket,
  FaWifi,
  FaVideo,
  FaClipboardList,
  FaCloudArrowUp,
} from "react-icons/fa6";
import "./DoctorCareers.css";

/* -------------------------------------------------------------------- */
/*  Static content                                                      */
/* -------------------------------------------------------------------- */
const WHY_JOIN = [
  {
    icon: <FaClock />,
    title: "Flexible Schedule",
    desc: "Choose when you're available and manage your consultation hours around your existing practice or personal commitments. You're always in control of your schedule.",
  },
  {
    icon: <FaHouseLaptop />,
    title: "Practice From Anywhere",
    desc: "Provide secure virtual consultations from your clinic, home, or wherever your professional responsibilities take you. All you need is a reliable internet connection.",
  },
  {
    icon: <FaGlobe />,
    title: "Expand Your Professional Reach",
    desc: "Connect with patients beyond geographical boundaries and make quality healthcare more accessible through a trusted global telemedicine platform.",
  },
  {
    icon: <FaShieldHalved />,
    title: "Secure & Reliable Platform",
    desc: "Deliver virtual consultations with confidence using a platform designed with patient privacy, security, and reliability at its core.",
  },
  {
    icon: <FaClipboardList />,
    title: "Simple & Efficient Workflow",
    desc: "Manage appointments, consultation records, and patient interactions through an intuitive platform designed to support your daily practice.",
  },
  {
    icon: <FaHeadset />,
    title: "Dedicated Doctor Support",
    desc: "From onboarding to ongoing assistance, our Doctor Success Team is here to help you every step of the way so you can focus on delivering exceptional care.",
  },
];

const BENEFITS_CHECKLIST = [
  "Reach more patients through one trusted telemedicine platform.",
  "Practice securely with HIPAA-compliant virtual consultations.",
  "Maintain complete clinical autonomy in every consultation.",
  "Choose consultation hours that fit your professional lifestyle.",
  "Receive dedicated onboarding and ongoing physician support.",
  "Be part of a growing community shaping the future of digital healthcare.",
];

const SPECIALTIES = [
  {
    icon: <FaStethoscope />,
    name: "Family Medicine",
    desc: "Comprehensive care for patients of all ages.",
  },
  {
    icon: <FaHeartPulse />,
    name: "Internal Medicine",
    desc: "Manage chronic and complex adult conditions.",
  },
  {
    icon: <FaBaby />,
    name: "Pediatrics",
    desc: "Virtual care for infants, children, and teens.",
  },
  {
    icon: <FaVenus />,
    name: "Women's Health",
    desc: "Reproductive and general wellness care for women.",
  },
  {
    icon: <FaBrain />,
    name: "Mental Health",
    desc: "Therapy and psychiatric support delivered virtually.",
  },
  {
    icon: <FaPlaneDeparture />,
    name: "Travel Medicine",
    desc: "Pre-travel consults, vaccines, and guidance.",
  },
  {
    icon: <FaTruckMedical />,
    name: "Urgent Care",
    desc: "Timely triage and treatment for acute concerns.",
  },
  {
    icon: <FaFileShield />,
    name: "Preventive Care",
    desc: "Screenings, wellness visits, and health coaching.",
  },
];

const REQUIREMENTS = [
  "Passionate about improving patient access to quality healthcare.",
  "Committed to delivering exceptional virtual care.",
  "Ready to expand your professional reach.",
  "Comfortable using secure digital healthcare solutions.",
  "Dedicated to patient-first, ethical medical practice.",
  "Looking for flexibility without compromising quality.",
  "Excited to be part of a trusted global healthcare network.",
];
const PROCESS_STEPS = [
  {
    icon: <FaFileSignature />,
    title: "Submit Your Application",
    desc: "Complete a short application with your professional details, medical specialty, and contact information.",
  },
  {
    icon: <FaClipboardCheck />,
    title: "Verify Your Credentials",
    desc: "Our team reviews your medical license, qualifications, and professional credentials to ensure a trusted healthcare network.",
  },
  {
    icon: <FaComments />,
    title: "Complete Your Onboarding",
    desc: "Meet with our Doctor Success Team and get familiar with the platform, consultation workflow, and best practices.",
  },
  {
    icon: <FaLaptopMedical />,
    title: "Activate Your Profile",
    desc: "Once approved, your professional profile goes live, making it easy for eligible patients to connect with you through Humancare Connect.",
  },
  {
    icon: <FaRocket />,
    title: "Start Delivering Virtual Care",
    desc: "Set your availability, manage your schedule, and begin providing secure, HIPAA-compliant virtual consultations while making a meaningful impact on patients' lives.",
  },
];

const BENEFITS_FEATURES = [
  {
    name: "Dr. Anjali Rao",
    specialty: "Family Medicine",
    photo: "/images/careers/provider-1.jpg",
    quote:
      "Joining Humancare Connect let me build a schedule around my family without stepping away from clinical work I love.",
  },
  {
    icon: <FaGlobe />,
    title: "Global Patient Reach",
    desc: "Expand your practice by connecting with patients across regions through one trusted telemedicine platform.",
  },
  {
    icon: <FaShieldHalved />,
    title: "HIPAA-Compliant Platform",
    desc: "Conduct secure virtual consultations using encrypted technology built to protect patient privacy and sensitive health information.",
  },
  {
    icon: <FaHeadset />,
    title: "Dedicated Doctor Support",
    desc: "Our Doctor Success Team is here to assist you with onboarding, technical guidance, and ongoing platform support.",
  },
  {
    icon: <FaLaptopMedical />,
    title: "Modern Telemedicine Technology",
    desc: "Experience an intuitive platform designed to simplify virtual consultations and create a seamless experience for both doctors and patients.",
  },
  {
    icon: <FaUserDoctor />,
    title: "Clinical Independence",
    desc: "Maintain complete control over your medical decisions while delivering personalized, patient-centered care.",
  },
  {
    icon: <FaUsers />,
    title: "Grow Your Professional Presence",
    desc: "Strengthen your digital practice and connect with more patients through a trusted healthcare network.",
  },
  {
    icon: <FaHeart />,
    title: "Meaningful Patient Impact",
    desc: "Help make quality healthcare more accessible by providing timely, compassionate care to patients wherever they are.",
  },
];
const FAQS = [
  {
    q: "Who can apply to become a partner doctor with Humancare Connect?",
    a: "Licensed physicians and qualified healthcare professionals who meet the applicable licensing and credential requirements can apply to join our telemedicine network.",
  },
  {
    q: "How do I apply?",
    a: "Simply complete the online application form with your professional details. Our Doctor Success Team will review your application and guide you through the next steps.",
  },
  {
    q: "What documents will I need?",
    a: "You'll typically need a valid medical license, professional identification, relevant certifications, and any supporting documents required for credential verification.",
  },
  {
    q: "How does the credential verification process work?",
    a: "Our team carefully reviews your medical credentials and professional standing to help maintain a trusted network of healthcare professionals.",
  },
  {
    q: "Can I continue working at my clinic or hospital?",
    a: "Yes. Humancare Connect is designed to complement your existing practice, allowing you to offer virtual consultations alongside your regular professional commitments.",
  },
  {
    q: "Can I choose my own consultation schedule?",
    a: "Absolutely. You decide when you're available and can update your schedule based on your professional and personal commitments.",
  },
  {
    q: "Do I need previous telemedicine experience?",
    a: "No. Whether you're new to virtual care or already experienced, our onboarding process helps you become familiar with the platform.",
  },
  {
    q: "What medical specialties are welcome?",
    a: "Humancare Connect welcomes healthcare professionals from a wide range of medical specialties, depending on licensing and platform requirements.",
  },
  {
    q: "Is the platform HIPAA compliant?",
    a: "Yes. Humancare Connect uses HIPAA-compliant technology with secure encryption and privacy-focused features to help protect patient health information.",
  },
  {
    q: "How do virtual consultations take place?",
    a: "Consultations are conducted through our secure telemedicine platform using video, audio, or other supported communication methods.",
  },
  {
    q: "Can I provide consultations from home?",
    a: "Yes. As long as you have a secure internet connection and a private environment suitable for patient consultations, you can practice from virtually anywhere.",
  },
  {
    q: "What technology do I need?",
    a: "A computer or laptop with a webcam and microphone, along with a stable high-speed internet connection, is recommended for the best consultation experience.",
  },
  {
    q: "Will I receive onboarding support?",
    a: "Yes. Our Doctor Success Team guides onboarding and is available to assist you with platform-related questions.",
  },
  {
    q: "Can I update my availability later?",
    a: "Yes. You can modify your consultation availability whenever needed to fit your changing schedule.",
  },
  {
    q: "Will I have access to technical support?",
    a: "Yes. Our support team is available to help with technical issues and platform-related assistance whenever you need it.",
  },
  {
    q: "Is there a long-term commitment?",
    a: "No. You have the flexibility to manage your participation according to your professional availability and preferences.",
  },
  {
    q: "How is patient privacy protected?",
    a: "Patient information is safeguarded through secure technologies, encrypted communication, and privacy-focused platform practices.",
  },
  {
    q: "Can I grow my professional presence on Humancare Connect?",
    a: "Yes. By maintaining a complete professional profile and consistently delivering high-quality patient care, you can strengthen your visibility within the platform.",
  },
  {
    q: "What makes Humancare Connect different?",
    a: "Humancare Connect combines secure technology, flexible scheduling, dedicated physician support, and a patient-first approach to help healthcare professionals deliver exceptional virtual care.",
  },
  {
    q: "How soon can I start consulting?",
    a: "Once your application, credential verification, and onboarding are successfully completed, you'll be ready to begin offering virtual consultations.",
  },
  {
    q: "Who can I contact if I have additional questions?",
    a: "Our Doctor Success Team is always available to answer your questions and guide you through every stage of your journey with Humancare Connect.",
  },
];

const INITIAL_FORM_STATE = {
  fullName: "",
  email: "",
  phone: "",
  specialty: "",
  license: "",
  experience: "",
  states: "",
  message: "",
};

/* -------------------------------------------------------------------- */
/*  Motion variants                                                      */
/* -------------------------------------------------------------------- */

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

/* -------------------------------------------------------------------- */
/*  Reusable subcomponents                                              */
/* -------------------------------------------------------------------- */

function FeatureCard({ icon, title, desc }) {
  return (
    <motion.div className="dc-card dc-feature-card" variants={fadeUp}>
      <div className="dc-icon-badge">{icon}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </motion.div>
  );
}

function SpecialtyCard({ icon, name, desc }) {
  return (
    <motion.div className="dc-card dc-specialty-card" variants={fadeUp}>
      <div className="dc-icon-badge dc-icon-badge--gold">{icon}</div>
      <h4>{name}</h4>
      <p>{desc}</p>
    </motion.div>
  );
}

function ChecklistItem({ text }) {
  return (
    <li className="dc-checklist-item">
      <FaCircleCheck className="dc-check-icon" aria-hidden="true" />
      <span>{text}</span>
    </li>
  );
}

function TimelineStep({ step, index, total }) {
  return (
    <motion.div className="dc-timeline-step" variants={fadeUp}>
      <div className="dc-timeline-marker">
        <div className="dc-timeline-icon">{step.icon}</div>
        {index < total - 1 && (
          <div className="dc-timeline-line" aria-hidden="true" />
        )}
      </div>
      <div className="dc-timeline-content">
        <span className="dc-timeline-step-number">Step {index + 1}</span>
        <h4>{step.title}</h4>
        <p>{step.desc}</p>
      </div>
    </motion.div>
  );
}

function BenefitTile({ icon, title, desc }) {
  return (
    <motion.div className="dc-benefit-tile" variants={fadeUp}>
      <div className="dc-icon-badge dc-icon-badge--sm">{icon}</div>
      <div>
        <h4>{title}</h4>
        <p>{desc}</p>
      </div>
    </motion.div>
  );
}

function FAQItem({ item, isOpen, onToggle }) {
  return (
    <div className={`dc-faq-item ${isOpen ? "dc-faq-item--open" : ""}`}>
      <button
        className="dc-faq-question"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span>{item.q}</span>
        <FaChevronDown className="dc-faq-chevron" aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            className="dc-faq-answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <p>{item.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ApplicationForm() {
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [fileName, setFileName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setFileName(file ? file.name : "");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: wire this up to the recruitment API endpoint
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <motion.div
        className="dc-form-success"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <FaCircleCheck aria-hidden="true" />
        <h3>Application received</h3>
        <p>
          Thank you
          {formData.fullName ? `, ${formData.fullName.split(" ")[0]}` : ""}. Our
          recruitment team will review your application and follow up within 5–7
          business days.
        </p>
      </motion.div>
    );
  }

  return (
    <form className="dc-form" onSubmit={handleSubmit} noValidate>
      <div className="dc-form-grid">
        <div className="dc-form-group">
          <label htmlFor="fullName">Full Name</label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            value={formData.fullName}
            onChange={handleChange}
            placeholder="Dr. Jane Smith"
            autoComplete="name"
          />
        </div>

        <div className="dc-form-group">
          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={formData.email}
            onChange={handleChange}
            placeholder="jane.smith@email.com"
            autoComplete="email"
          />
        </div>

        <div className="dc-form-group">
          <label htmlFor="phone">Phone Number</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            value={formData.phone}
            onChange={handleChange}
            placeholder="(555) 123-4567"
            autoComplete="tel"
          />
        </div>

        <div className="dc-form-group">
          <label htmlFor="specialty">Specialty</label>
          <select
            id="specialty"
            name="specialty"
            required
            value={formData.specialty}
            onChange={handleChange}
          >
            <option value="" disabled>
              Select your specialty
            </option>
            {SPECIALTIES.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="dc-form-group">
          <label htmlFor="license">Medical License Number</label>
          <input
            id="license"
            name="license"
            type="text"
            required
            value={formData.license}
            onChange={handleChange}
            placeholder="License #"
          />
        </div>

        <div className="dc-form-group">
          <label htmlFor="experience">Years of Experience</label>
          <input
            id="experience"
            name="experience"
            type="number"
            min="0"
            required
            value={formData.experience}
            onChange={handleChange}
            placeholder="e.g. 8"
          />
        </div>

        <div className="dc-form-group dc-form-group--full">
          <label htmlFor="states">State(s) Licensed In</label>
          <input
            id="states"
            name="states"
            type="text"
            required
            value={formData.states}
            onChange={handleChange}
            placeholder="e.g. California, Texas, New York"
          />
        </div>

        <div className="dc-form-group dc-form-group--full">
          <label htmlFor="resume">Resume / CV</label>
          <div className="dc-form-file-wrap">
            <label className="dc-form-file" htmlFor="resume">
              <FaCloudArrowUp aria-hidden="true" />
              <span>{fileName || "Upload your resume (PDF or DOC)"}</span>
            </label>
            <input
              id="resume"
              name="resume"
              type="file"
              accept=".pdf,.doc,.docx"
              className="dc-form-file-input"
              onChange={handleFileChange}
            />
          </div>
        </div>

        <div className="dc-form-group dc-form-group--full">
          <label htmlFor="message">
            Tell us about your practice (optional)
          </label>
          <textarea
            id="message"
            name="message"
            rows="4"
            value={formData.message}
            onChange={handleChange}
            placeholder="Share your background, availability, or anything else we should know."
          />
        </div>
      </div>

      <button
        type="submit"
        className="dc-btn dc-btn--primary dc-btn--lg dc-form-submit"
      >
        Submit Application <FaArrowRight aria-hidden="true" />
      </button>
      <p className="dc-form-note">
        By submitting, you agree to be contacted by our recruitment team
        regarding this application.
      </p>
    </form>
  );
}

/* -------------------------------------------------------------------- */
/*  Main page                                                            */
/* -------------------------------------------------------------------- */

export default function DoctorCareers() {
  const [openFAQ, setOpenFAQ] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);

  const toggleFAQ = (idx) => setOpenFAQ(openFAQ === idx ? -1 : idx);

  const nextSlide = () =>
    setActiveSlide((prev) => (prev + 1) % TESTIMONIALS.length);
  const prevSlide = () =>
    setActiveSlide(
      (prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length,
    );

  return (
    <main className="doctor-careers-page">
      {/* ---------------------------------------------------------- */}
      {/* 1. Hero                                                     */}
      {/* ---------------------------------------------------------- */}
      <section className="dc-hero">
        <div className="dc-hero-bg" aria-hidden="true">
          <span className="dc-blob dc-blob--1" />
          <span className="dc-blob dc-blob--2" />
        </div>

        <div className="dc-container dc-hero-grid">
          <motion.div
            className="dc-hero-content"
            initial="hidden"
            animate="show"
            variants={staggerContainer}
          >
            <motion.span className="dc-eyebrow" variants={fadeUp}>
              Careers for Physicians
            </motion.span>
            <motion.h1 variants={fadeUp}>
              The Future of Healthcare{" "}
              <span className="dc-text-accent">Needs Doctors Like You. </span>
            </motion.h1>
            <motion.p className="dc-hero-sub" variants={fadeUp}>
              Join a trusted global telemedicine platform built for licensed
              healthcare professionals who want to make a greater impact.
              Humancare Connect helps doctors connect with patients through
              secure virtual consultations, giving you the flexibility to
              practice from anywhere while delivering timely, high-quality care.
              Whether you're growing your practice, supporting underserved
              communities, or embracing the future of healthcare, you'll have
              the technology, support, and professional network to succeed
            </motion.p>
            {/* <motion.div className="dc-hero-actions" variants={fadeUp}> */}
            {/* <a href="#apply" className="dc-btn dc-btn--primary">
                Apply Now <FaArrowRight aria-hidden="true" />
              </a> */}
            {/* <a href="#why-join" className="dc-btn dc-btn--secondary">
                Learn More
              </a> */}
            {/* </motion.div> */}
            <motion.p className="dc-hero-trust" variants={fadeUp}>
              Trusted by licensed physicians across 30+ specialties nationwide.
            </motion.p>
          </motion.div>

          <motion.div
            className="dc-hero-media"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <div className="dc-hero-image-frame">
              <img
                src="/images/careers/hero-doctor-consult.jpg"
                alt="Physician conducting a virtual consultation on a laptop"
                loading="eager"
              />
            </div>
            <div className="dc-hero-floating-card">
              <FaVideo aria-hidden="true" />
              <div>
                <strong>1,200+</strong>
                <span>Active Providers</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* 2. Why Join                                                 */}
      {/* ---------------------------------------------------------- */}
      <section className="dc-section" id="why-join">
        <div className="dc-container">
          <motion.div
            className="dc-section-header"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
          >
            <span className="dc-eyebrow">
              WHY DOCTORS CHOOSE HUMANCARE CONNECT
            </span>
            <h2>WHY DOCTORS CHOOSE HUMANCARE CONNECT</h2>
            <span className="dc-eyebrow">Why Join Humancare Connect</span>
            <h2>Everything you need to practice, minus the overhead</h2>
            <p>
              Healthcare is evolving, and so is the way doctors connect with
              patients. Humancare Connect combines flexible virtual care, secure
              technology, and dedicated support to help you deliver exceptional
              healthcare wherever your expertise is needed.
            </p>
          </motion.div>

          <motion.div
            className="dc-grid dc-grid--3"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.15 }}
            variants={staggerContainer}
          >
            {WHY_JOIN.map((item) => (
              <FeatureCard key={item.title} {...item} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* 3. About Working With HCC                                   */}
      {/* ---------------------------------------------------------- */}
      <section className="dc-section dc-section--muted">
        <div className="dc-container dc-about-grid">
          <motion.div
            className="dc-about-image"
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <img
              src="/images/careers/about-collaboration.jpg"
              alt="Healthcare professionals collaborating in a modern clinical setting"
              loading="lazy"
            />
          </motion.div>

          <motion.div
            className="dc-about-content"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
          >
            <motion.span className="dc-eyebrow" variants={fadeUp}>
              ABOUT WORKING WITH HUMANCARE CONNECT
            </motion.span>
            <motion.h2 variants={fadeUp}>
              Join the Network Trusted by Doctors Who Want to Make a Bigger
              Impact.
            </motion.h2>
            <motion.p variants={fadeUp}>
              Your expertise deserves a platform that respects your profession.
              Humancare Connect combines secure HIPAA-compliant technology, a
              patient-first approach, and dedicated physician support to help
              you deliver exceptional virtual care with confidence. Whether
              you're expanding your practice or embracing the future of
              healthcare, you'll be joining a community committed to clinical
              excellence, professional independence, and better patient
              outcomes.
              <br />
              <br />
              What You'll Experience
            </motion.p>
            <motion.ul className="dc-checklist" variants={fadeUp}>
              {BENEFITS_CHECKLIST.map((text) => (
                <ChecklistItem key={text} text={text} />
              ))}
            </motion.ul>
          </motion.div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* 4. Application Form                                         */}
      {/* ---------------------------------------------------------- */}
      <section className="dc-section" id="apply">
        <div className="dc-container dc-application-container">
          <motion.div
            className="dc-section-header"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
          >
            <span className="dc-eyebrow">JOIN OUR DOCTOR NETWORK</span>
            <h2>Start Your Application</h2>
            <p>
              Take the first step toward joining Humancare Connect's global
              network of licensed healthcare professionals. Submit your
              application below, and our team will be in touch to guide you
              through the next steps.
            </p>
          </motion.div>

          <motion.div
            className="dc-application-form-wrap"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <ApplicationForm />
          </motion.div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* 5. Specialties                                              */}
      {/* ---------------------------------------------------------- */}
      {/* <section className="dc-section">
        <div className="dc-container">
          <motion.div
            className="dc-section-header"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
          >
            <span className="dc-eyebrow">Specialties We're Looking For</span>
            <h2>Currently recruiting across these specialties</h2>
            <p>Don't see yours listed? We're always expanding our network.</p>
          </motion.div>

          <motion.div
            className="dc-grid dc-grid--4"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.1 }}
            variants={staggerContainer}
          >
            {SPECIALTIES.map((item) => (
              <SpecialtyCard key={item.name} {...item} />
            ))}
          </motion.div>
        </div>
      </section> */}

      {/* ---------------------------------------------------------- */}
      {/* 6. What We're Looking For                                   */}
      {/* ---------------------------------------------------------- */}
      <section className="dc-section dc-section--muted">
        <div className="dc-container dc-requirements-grid">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
          >
            <motion.span className="dc-eyebrow" variants={fadeUp}>
              JOIN OUR DOCTOR COMMUNITY
            </motion.span>
            <motion.h2 variants={fadeUp}>
              If This Sounds Like You, Let's Build the Future of Healthcare
              Together.
            </motion.h2>
            <motion.p variants={fadeUp}>
              We're looking for healthcare professionals who believe great care
              shouldn't be limited by location. If you're committed to clinical
              excellence, compassionate care, and embracing the future of
              medicine, Humancare Connect is the right place for you.
            </motion.p>
          </motion.div>

          <motion.ul
            className="dc-checklist dc-checklist--card"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.15 }}
            variants={staggerContainer}
          >
            {REQUIREMENTS.map((text) => (
              <ChecklistItem key={text} text={text} />
            ))}
          </motion.ul>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* 7. Recruitment Process                                      */}
      {/* ---------------------------------------------------------- */}
      <section className="dc-section">
        <div className="dc-container">
          <motion.div
            className="dc-section-header"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
          >
            <span className="dc-eyebrow">HOW IT WORKS</span>
            <h2>Your Journey to Becoming a Partner Doctor</h2>
            <p>
              Joining Humancare Connect is straightforward. From the onboarding
              application, our team supports you every step of the way so you
              can start delivering exceptional virtual care with confidence.
            </p>
          </motion.div>

          <motion.div
            className="dc-timeline"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.1 }}
            variants={staggerContainer}
          >
            {PROCESS_STEPS.map((step, idx) => (
              <TimelineStep
                key={step.title}
                step={step}
                index={idx}
                total={PROCESS_STEPS.length}
              />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* 8. Benefits of Joining                                      */}
      {/* ---------------------------------------------------------- */}
      <section className="dc-section dc-section--muted">
        <div className="dc-container">
          <motion.div
            className="dc-section-header"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
          >
            <span className="dc-eyebrow">BENEFITS OF JOINING</span>
            <h2>Everything You Need to Deliver Exceptional Virtual Care</h2>
            <p>
              Join a platform designed to help you focus on what matters most:
              your patients. From secure technology to dedicated support,
              Humancare Connect empowers you to practice with confidence.{" "}
            </p>
          </motion.div>

          <motion.div
            className="dc-benefit-list"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.1 }}
            variants={staggerContainer}
          >
            {BENEFITS_FEATURES.map((item) => (
              <BenefitTile key={item.title} {...item} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* 10. FAQ                                                      */}
      {/* ---------------------------------------------------------- */}
      <section className="dc-section dc-section--muted">
        <div className="dc-container dc-faq-container">
          <motion.div
            className="dc-section-header"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
          >
            <span className="dc-eyebrow">Frequently Asked Questions</span>
            <h2>Common questions from physicians</h2>
          </motion.div>

          <motion.div
            className="dc-faq-list"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.1 }}
            variants={staggerContainer}
          >
            {FAQS.map((item, idx) => (
              <motion.div key={item.q} variants={fadeUp}>
                <FAQItem
                  item={item}
                  isOpen={openFAQ === idx}
                  onToggle={() => toggleFAQ(idx)}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* 11. Final CTA                                               */}
      {/* ---------------------------------------------------------- */}
      <section className="dc-section dc-final-cta-section" id="get-started">
        <div className="dc-container">
          <motion.div
            className="dc-final-cta-card"
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div className="dc-final-cta-glow" aria-hidden="true" />
            <div className="dc-final-cta-inner">
              <motion.h2
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.4 }}
                variants={fadeUp}
              >
                Ready to bring your practice to more patients?
              </motion.h2>
              <motion.p
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.4 }}
                variants={fadeUp}
              >
                Join a trusted telemedicine network built to support licensed
                physicians every step of the way.
              </motion.p>
              <motion.div
                className="dc-final-cta-actions"
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.4 }}
                variants={fadeUp}
              >
                <a href="#apply" className="dc-btn dc-btn--primary dc-btn--lg">
                  Apply Now <FaArrowRight aria-hidden="true" />
                </a>
                <Link to="/contact" className="dc-btn dc-btn--ghost dc-btn--lg">
                  Contact Recruitment
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
