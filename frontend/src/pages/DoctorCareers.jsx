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
    desc: "Set your own hours and consult when it works for you — mornings, evenings, or weekends.",
  },
  {
    icon: <FaHouseLaptop />,
    title: "Remote Practice",
    desc: "Deliver care from anywhere with a secure connection. No commute, no clinic overhead.",
  },
  {
    icon: <FaSackDollar />,
    title: "Competitive Earnings",
    desc: "Transparent, competitive compensation with consistent patient volume and timely payouts.",
  },
  {
    icon: <FaShieldHalved />,
    title: "Secure Technology",
    desc: "HIPAA-compliant platform built for reliable, encrypted virtual consultations.",
  },
  {
    icon: <FaUserDoctor />,
    title: "Clinical Independence",
    desc: "Practice medicine your way. Your clinical judgment always comes first.",
  },
  {
    icon: <FaHeadset />,
    title: "Dedicated Support",
    desc: "A responsive support team handles scheduling, tech, and admin so you can focus on patients.",
  },
];

const BENEFITS_CHECKLIST = [
  "Build your own consultation schedule",
  "Access a growing, nationwide patient base",
  "Practice with full clinical autonomy",
  "Get onboarded with dedicated 1:1 support",
  "Use a modern, HIPAA-compliant platform",
  "Join a network built on quality patient care",
];

const SPECIALTIES = [
  { icon: <FaStethoscope />, name: "Family Medicine", desc: "Comprehensive care for patients of all ages." },
  { icon: <FaHeartPulse />, name: "Internal Medicine", desc: "Manage chronic and complex adult conditions." },
  { icon: <FaBaby />, name: "Pediatrics", desc: "Virtual care for infants, children, and teens." },
  { icon: <FaVenus />, name: "Women's Health", desc: "Reproductive and general wellness care for women." },
  { icon: <FaBrain />, name: "Mental Health", desc: "Therapy and psychiatric support delivered virtually." },
  { icon: <FaPlaneDeparture />, name: "Travel Medicine", desc: "Pre-travel consults, vaccines, and guidance." },
  { icon: <FaTruckMedical />, name: "Urgent Care", desc: "Timely triage and treatment for acute concerns." },
  { icon: <FaFileShield />, name: "Preventive Care", desc: "Screenings, wellness visits, and health coaching." },
];

const REQUIREMENTS = [
  "Active, unrestricted medical license",
  "Good standing with your state medical board",
  "Strong verbal and written communication skills",
  "Comfortable using telemedicine technology",
  "Reliable, high-speed internet connection",
  "Computer with a functioning webcam and microphone",
  "Genuine commitment to patient-centered care",
];

const PROCESS_STEPS = [
  { icon: <FaFileSignature />, title: "Submit Application", desc: "Tell us about your background, license, and specialty in a short online form." },
  { icon: <FaClipboardCheck />, title: "Credential Review", desc: "Our team verifies your license, certifications, and professional standing." },
  { icon: <FaComments />, title: "Interview", desc: "A short conversation to align on expectations, availability, and fit." },
  { icon: <FaLaptopMedical />, title: "Platform Onboarding", desc: "Get hands-on training with our telemedicine platform and workflows." },
  { icon: <FaRocket />, title: "Begin Consulting", desc: "Set your schedule and start seeing patients on your terms." },
];

const BENEFITS_FEATURES = [
  { icon: <FaClock />, title: "Flexible Hours", desc: "Design a schedule around your life, not the other way around." },
  { icon: <FaGlobe />, title: "Work From Anywhere", desc: "All you need is a secure internet connection and a quiet space." },
  { icon: <FaHeadset />, title: "Administrative Support", desc: "We handle scheduling, billing, and patient intake logistics." },
  { icon: <FaShieldHalved />, title: "Secure Platform", desc: "End-to-end encrypted consultations that keep patient data safe." },
  { icon: <FaLaptopMedical />, title: "Modern Technology", desc: "A fast, intuitive interface designed specifically for virtual care." },
  { icon: <FaGraduationCap />, title: "Professional Development", desc: "Ongoing training and resources to help your practice grow." },
  { icon: <FaUsers />, title: "Expanded Patient Reach", desc: "Connect with patients across regions, beyond your local practice." },
  { icon: <FaChartLine />, title: "Efficient Workflow", desc: "Purpose-built tools that reduce admin time and streamline visits." },
];

const TESTIMONIALS = [
  {
    name: "Dr. Anjali Rao",
    specialty: "Family Medicine",
    photo: "/images/careers/provider-1.jpg",
    quote:
      "Joining Human Care Connect let me build a schedule around my family without stepping away from clinical work I love.",
  },
  {
    name: "Dr. Marcus Chen",
    specialty: "Internal Medicine",
    photo: "/images/careers/provider-2.jpg",
    quote:
      "The platform is smooth and the support team is fast. I spend my time with patients, not fighting technology.",
  },
  {
    name: "Dr. Priya Nair",
    specialty: "Mental Health",
    photo: "/images/careers/provider-3.jpg",
    quote:
      "I've reached patients in areas with almost no mental health access nearby. This work feels genuinely meaningful.",
  },
  {
    name: "Dr. Daniel Okafor",
    specialty: "Pediatrics",
    photo: "/images/careers/provider-4.jpg",
    quote:
      "Onboarding was quick and clear. Within two weeks I was seeing patients with full confidence in the platform.",
  },
];

const FAQS = [
  {
    q: "How long does the application process take?",
    a: "Most applicants hear back within 5–7 business days after submitting a complete application. Credential review and interviews typically follow within two weeks.",
  },
  {
    q: "What licenses do I need to join?",
    a: "You'll need an active, unrestricted medical license in good standing in at least one state. We'll work with you on multi-state licensing as your patient base grows.",
  },
  {
    q: "Can I set my own schedule?",
    a: "Yes. You choose your available hours and can adjust them anytime through your provider dashboard — there are no mandatory shifts.",
  },
  {
    q: "How and when am I compensated?",
    a: "Compensation is based on consultation volume and is paid out on a regular, predictable schedule. Full details are shared during onboarding.",
  },
  {
    q: "What equipment do I need?",
    a: "A computer with a webcam and microphone, and a stable high-speed internet connection. No specialized hardware is required.",
  },
  {
    q: "What does onboarding involve?",
    a: "A guided walkthrough of the platform, documentation workflows, and support tools — most providers are fully onboarded within a few days.",
  },
  {
    q: "Is training provided?",
    a: "Yes. We provide platform training at onboarding plus ongoing resources and refreshers as our tools evolve.",
  },
  {
    q: "What support is available after I join?",
    a: "A dedicated provider support team is available to help with scheduling, technical issues, and administrative questions on an ongoing basis.",
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
        {index < total - 1 && <div className="dc-timeline-line" aria-hidden="true" />}
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
          Thank you{formData.fullName ? `, ${formData.fullName.split(" ")[0]}` : ""}
          . Our recruitment team will review your application and follow up
          within 5–7 business days.
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
          <label htmlFor="message">Tell us about your practice (optional)</label>
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

      <button type="submit" className="dc-btn dc-btn--primary dc-btn--lg dc-form-submit">
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

  const nextSlide = () => setActiveSlide((prev) => (prev + 1) % TESTIMONIALS.length);
  const prevSlide = () =>
    setActiveSlide((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);

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
              Practice medicine on <span className="dc-text-accent">your terms</span>
            </motion.h1>
            <motion.p className="dc-hero-sub" variants={fadeUp}>
              Join Human Care Connect's telemedicine network and deliver quality
              virtual care to patients nationwide — with the flexibility, support,
              and clinical independence you deserve.
            </motion.p>
            <motion.div className="dc-hero-actions" variants={fadeUp}>
              <a href="#apply" className="dc-btn dc-btn--primary">
                Apply Now <FaArrowRight aria-hidden="true" />
              </a>
              {/* <a href="#why-join" className="dc-btn dc-btn--secondary">
                Learn More
              </a> */}
            </motion.div>
            <motion.p className="dc-hero-trust" variants={fadeUp}>
              Trusted by licensed physicians across 20+ specialties nationwide.
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
            <span className="dc-eyebrow">Why Join Human Care Connect</span>
            <h2>Everything you need to practice, minus the overhead</h2>
            <p>
              We built our network around what physicians actually need to
              deliver great care remotely — flexibility, support, and the
              right technology.
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
              About Working With Us
            </motion.span>
            <motion.h2 variants={fadeUp}>
              Built for physicians who want more reach, not more burnout
            </motion.h2>
            <motion.p variants={fadeUp}>
              Our mission is to make quality healthcare accessible to every
              patient, wherever they are. We believe the future of medicine is
              virtual-first — and physicians are at the center of that shift.
              Joining our network means extending your practice beyond the
              walls of a clinic while keeping full clinical independence and
              our unwavering commitment to patient-centered care.
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
            <span className="dc-eyebrow">Apply Now</span>
            <h2>Start your application</h2>
            <p>
              Fill out the form below and a member of our recruitment team
              will follow up within 5–7 business days.
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
              What We're Looking For
            </motion.span>
            <motion.h2 variants={fadeUp}>Eligibility at a glance</motion.h2>
            <motion.p variants={fadeUp}>
              We keep requirements clear and straightforward so you know
              exactly what's needed to get started.
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
            <span className="dc-eyebrow">Recruitment Process</span>
            <h2>Five steps from application to your first consult</h2>
          </motion.div>

          <motion.div
            className="dc-timeline"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.1 }}
            variants={staggerContainer}
          >
            {PROCESS_STEPS.map((step, idx) => (
              <TimelineStep key={step.title} step={step} index={idx} total={PROCESS_STEPS.length} />
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
            <span className="dc-eyebrow">Benefits of Joining</span>
            <h2>Support that lets you focus on medicine</h2>
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
      {/* 9. Meet Our Providers                                       */}
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
            <span className="dc-eyebrow">Meet Our Providers</span>
            <h2>Physicians share their experience</h2>
          </motion.div>

          <div className="dc-testimonial-carousel">
            <button
              className="dc-carousel-nav dc-carousel-nav--prev"
              onClick={prevSlide}
              aria-label="Previous testimonial"
            >
              <FaChevronLeft aria-hidden="true" />
            </button>

            <div className="dc-testimonial-track">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSlide}
                  className="dc-testimonial-card"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                >
                  <FaQuoteLeft className="dc-quote-icon" aria-hidden="true" />
                  <p className="dc-testimonial-quote">
                    "{TESTIMONIALS[activeSlide].quote}"
                  </p>
                  <div className="dc-testimonial-author">
                    <img
                      src={TESTIMONIALS[activeSlide].photo}
                      alt={TESTIMONIALS[activeSlide].name}
                      loading="lazy"
                    />
                    <div>
                      <strong>{TESTIMONIALS[activeSlide].name}</strong>
                      <span>{TESTIMONIALS[activeSlide].specialty}</span>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <button
              className="dc-carousel-nav dc-carousel-nav--next"
              onClick={nextSlide}
              aria-label="Next testimonial"
            >
              <FaChevronRight aria-hidden="true" />
            </button>
          </div>

          <div className="dc-carousel-dots">
            {TESTIMONIALS.map((_, idx) => (
              <button
                key={idx}
                className={`dc-carousel-dot ${idx === activeSlide ? "dc-carousel-dot--active" : ""}`}
                onClick={() => setActiveSlide(idx)}
                aria-label={`Go to testimonial ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </section> */}

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