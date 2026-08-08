import { useState, useEffect, useRef, useCallback } from "react";
import "./Corporates.css";
import IndustrySlider from "../components/IndustrySlider";
import ECGTimeline from "../components/ECGTimeline";
import Netaji from "../components/Netaji";
import Demo from "../components/Demo";
import CorporateImg from "../assets/Corporate.webp";

import TeleconsultImg from "../assets/CorporateSolutions/on-demand-video-doctor-consultation.webp";
import DoctorOnCallImg from "../assets/CorporateSolutions/24-7-doctor-on-call-medical-helpline.webp";
import MentalHealthImg from "../assets/CorporateSolutions/employee-mental-health-wellness-program.webp";
import PrescriptionsImg from "../assets/CorporateSolutions/digital-prescription-service-telehealth.webp";
import HrDashboardImg from "../assets/CorporateSolutions/health-analytics-reporting-dashboard.webp";
import SickLeaveImg from "../assets/CorporateSolutions/employee-absence-management-solution.webp";
import SEO from "../components/Seo";
import FAQ from "../components/FAQ/FAQ";

const SERVICES = [
  {
    label: "Teleconsultation",
    title: "On-Demand Video Visits",
    desc: "Employees connect with licensed providers in minutes through secure corporate telemedicine services from any device, anywhere.",
    stat: "Under 5-minute average wait time",
    accent: "linear-gradient(90deg,#0C8B7A,#1B2F4B)",
    img: TeleconsultImg,
    alt: "Employees connecting with licensed healthcare providers through secure corporate telemedicine services",
    statNum: "< 5 min",
    statLbl: "Average wait time",
    centreRows: [
      {
        label: "Visit completion",
        val: "98%+",
        pct: 98,
        grad: "linear-gradient(90deg,#223A5E,#0C8B7A)",
      },
      {
        label: "Same-day appointments",
        val: "Available",
        pct: 100,
        grad: "linear-gradient(90deg,#0C8B7A,#0a6b5e)",
      },
    ],
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.845v6.311a1 1 0 0 1-1.447.893L15 14M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" />
      </svg>
    ),
  },
  {
    label: "Doctor On Call",
    title: "24/7 Medical Helpline",
    desc: "Round-the-clock telemedicine support from licensed providers for urgent health questions and virtual care guidance.",
    stat: "24/7 doctor availability",
    accent: "linear-gradient(90deg,#1A56DB,#223A5E)",
    img: DoctorOnCallImg,
    alt: "24/7 doctor on call service providing telemedicine support and virtual healthcare guidance",
    statNum: "24/7",
    statLbl: "Doctor availability",
    centreRows: [
      {
        label: "Calls answered",
        val: "< 60 sec",
        pct: 97,
        grad: "linear-gradient(90deg,#1A56DB,#0f3a8a)",
      },
      {
        label: "Resolution rate",
        val: "94%",
        pct: 94,
        grad: "linear-gradient(90deg,#0C8B7A,#223A5E)",
      },
    ],
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.11 11.9 19.79 19.79 0 0 1 1 3.28 2 2 0 0 1 2.98 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    ),
  },
  {
    label: "Mental Health",
    title: "Employee Wellness & EAP",
    desc: "Confidential mental health support, therapy, and wellness care through secure telehealth services for modern teams.",
    stat: "95% employee satisfaction",
    accent: "linear-gradient(90deg,#7C3AED,#223A5E)",
    img: MentalHealthImg,
    alt: "Employees accessing confidential mental health counseling, therapy, and wellness support through telehealth",
    statNum: "95%",
    statLbl: "Employee satisfaction",
    centreRows: [
      {
        label: "Sessions booked",
        val: "10K+/mo",
        pct: 90,
        grad: "linear-gradient(90deg,#7C3AED,#4c1d95)",
      },
      {
        label: "Employee return rate",
        val: "87%",
        pct: 87,
        grad: "linear-gradient(90deg,#0C8B7A,#223A5E)",
      },
    ],
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
  {
    label: "Prescriptions",
    title: "Digital Prescription Service",
    desc: "Secure e-prescriptions delivered directly to your employee’s preferred pharmacy through fast corporate telemedicine services.",
    stat: "99.7% prescription accuracy",
    accent: "linear-gradient(90deg,#0C8B7A,#065f52)",
    img: PrescriptionsImg,
    alt: "Digital e-prescription service with secure prescription delivery through corporate telemedicine",
    statNum: "99.7%",
    statLbl: "Prescription accuracy",
    centreRows: [
      {
        label: "Prescriptions issued",
        val: "50K+",
        pct: 99,
        grad: "linear-gradient(90deg,#0C8B7A,#C97B1A)",
      },
      {
        label: "Pharmacy delivery",
        val: "< 2 hrs",
        pct: 95,
        grad: "linear-gradient(90deg,#0C8B7A,#065f52)",
      },
    ],
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        <path d="M3.22 12H9.5l.5-1 2 4.5.5-1.5H20.8" />
      </svg>
    ),
  },
  {
    label: "HR Dashboard",
    title: "Absence Management",
    desc: "Simplify sick leave validation, return-to-work notes, and medical certificates through secure corporate telemedicine services.",
    stat: "60% faster HR processing",
    accent: "linear-gradient(90deg,#C97B1A,#7a4a10)",
    img: HrDashboardImg,
    alt: "Corporate absence management dashboard for sick leave validation, medical certificates, and HR compliance",
    statNum: "60%",
    statLbl: "Faster HR processing",
    centreRows: [
      {
        label: "Medical certificates",
        val: "< 1 hr",
        pct: 100,
        grad: "linear-gradient(90deg,#C97B1A,#7a4a10)",
      },
      {
        label: "Compliance support",
        val: "100%",
        pct: 100,
        grad: "linear-gradient(90deg,#223A5E,#0C8B7A)",
      },
    ],
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
  },
  {
    label: "Sick Leave",
    title: "Health Analytics & Reporting",
    desc: "Real-time workforce health insights, utilization tracking, and absenteeism reporting for smarter healthcare decisions.",
    stat: "34% reduction in sick days",
    accent: "linear-gradient(90deg,#223A5E,#0C8B7A)",
    img: SickLeaveImg,
    alt: "Workforce health analytics dashboard showing utilization tracking, absenteeism reporting, and healthcare insights",
    statNum: "34%",
    statLbl: "Reduction in sick days",
    centreRows: [
      {
        label: "Health dashboards",
        val: "Live",
        pct: 100,
        grad: "linear-gradient(90deg,#223A5E,#0C8B7A)",
      },
      {
        label: "Reporting accuracy",
        val: "99.9%",
        pct: 100,
        grad: "linear-gradient(90deg,#0C8B7A,#065f52)",
      },
    ],
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
];

/* ── Default centre card data ── */
const DEFAULT_CENTRE = {
  eyebrow: "Why Choose Us",
  stat: "2.4M+",
  statLbl: "Patients Served",
  tag: "HIPAA · SOC 2 · 500+ Doctors",
  rows: [
    {
      label: "Visit completion",
      val: "98.2%",
      pct: 98,
      grad: "linear-gradient(90deg,#223A5E,#0C8B7A)",
    },
    {
      label: "Prescription accuracy",
      val: "99.7%",
      pct: 99.7,
      grad: "linear-gradient(90deg,#0C8B7A,#C97B1A)",
    },
  ],
};

const N = SERVICES.length;
const AUTO_SPEED = 0.00018; // radians per ms

/* ================================================================
   COMPONENT
================================================================ */
const CORPORATE_FAQS = [
  {
    title: "Services & Benefits",
    items: [
      {
        question: "What are corporate telemedicine services?",
        answer: "Corporate telemedicine services allow businesses to provide employees with convenient access to licensed healthcare providers through virtual doctor appointments, digital prescriptions, mental health support, and ongoing healthcare guidance without requiring in-person clinic visits."
      },
      {
        question: "How does corporate telemedicine benefit employees?",
        answer: "Corporate telehealth services help employees receive faster medical care, reduce travel and waiting time, access healthcare more conveniently, and support their overall physical and mental well-being."
      },
      {
        question: "How can corporate healthcare improve employee productivity?",
        answer: "Fast access to healthcare allows employees to address medical concerns sooner, reduce unnecessary time away from work, manage chronic conditions effectively, and maintain better overall workplace productivity."
      },
      {
        question: "What businesses can use corporate telemedicine solutions?",
        answer: "Corporate telemedicine solutions are suitable for businesses of all sizes, including startups, enterprises, healthcare organizations, technology companies, logistics providers, hospitality businesses, educational institutions, and manufacturing teams."
      },
      {
        question: "How quickly can employees connect with an online doctor?",
        answer: "Employees can access virtual doctor consultations through the corporate telemedicine platform, often connecting with licensed providers within minutes depending on availability."
      }
    ]
  },
  {
    title: "Care & Support",
    items: [
      {
        question: "Are corporate telemedicine services available 24/7?",
        answer: "Yes. Employees can access healthcare guidance and medical support at any time through 24/7 telehealth services, including evenings, weekends, and holidays."
      },
      {
        question: "What healthcare services are included in a corporate telemedicine program?",
        answer: "Corporate healthcare programs may include online doctor consultations, urgent medical guidance, mental health support, digital prescriptions, medical certificates, absence management, and employee wellness services."
      },
      {
        question: "Does Humancare Connect provide mental health support for employees?",
        answer: "Yes. Humancare Connect offers confidential mental health support, therapy access, and employee wellness services designed to improve emotional health and workplace well-being."
      },
      {
        question: "Can employees receive prescriptions through virtual consultations?",
        answer: "Yes. Licensed healthcare providers can evaluate employees during virtual appointments and provide prescriptions when medically appropriate and permitted by applicable healthcare regulations."
      },
      {
        question: "How does telemedicine reduce employee absenteeism?",
        answer: "Telemedicine reduces healthcare delays by giving employees faster access to medical advice, treatment recommendations, and documentation, helping them return to work sooner when appropriate."
      }
    ]
  },
  {
    title: "Implementation & Compliance",
    items: [
      {
        question: "What is digital absence management?",
        answer: "Digital absence management simplifies processes such as sick leave validation, medical certificates, and return-to-work documentation through secure virtual healthcare services."
      },
      {
        question: "How does corporate telemedicine support remote and distributed teams?",
        answer: "Virtual healthcare allows employees to access medical support from home, the office, or while traveling, making it an effective healthcare solution for remote, hybrid, and geographically distributed workforces."
      },
      {
        question: "Is employee healthcare information private and secure?",
        answer: "Yes. Employee consultations and health information are protected through secure telemedicine systems designed to maintain patient privacy and confidentiality."
      },
      {
        question: "Can corporate telemedicine integrate with existing employee benefits?",
        answer: "Yes. Corporate telehealth solutions can complement existing employee wellness programs and healthcare benefits to create a more comprehensive employee support system."
      },
      {
        question: "How does Humancare Connect help HR teams?",
        answer: "Humancare Connect helps HR teams streamline healthcare access, reduce administrative burdens, manage employee wellness programs, and gain valuable workforce health insights."
      }
    ]
  },
  {
    title: "Streamlining & Scale",
    items: [
      {
        question: "What workforce health analytics are available?",
        answer: "Organizations can access insights such as healthcare utilization trends, absenteeism patterns, and workforce wellness data to make more informed healthcare decisions."
      },
      {
        question: "How long does it take to implement a corporate telemedicine program?",
        answer: "Corporate telemedicine platforms are designed for quick onboarding, allowing businesses to provide employees with fast and seamless access to virtual healthcare services."
      },
      {
        question: "Can small businesses use corporate telehealth services?",
        answer: "Yes. Corporate telemedicine solutions are scalable and can support small businesses, growing companies, and large enterprises with flexible healthcare options."
      },
      {
        question: "Why should companies invest in employee telehealth programs?",
        answer: "Employee telehealth programs can improve healthcare accessibility, increase employee satisfaction, support workplace wellness, and help organizations build healthier and more productive teams."
      },
      {
        question: "Why choose Humancare Connect as your corporate telemedicine partner?",
        answer: "Humancare Connect combines licensed healthcare providers, secure technology, employee wellness services, digital healthcare solutions, and scalable telemedicine programs to support organizations of every size."
      }
    ]
  }
];

export default function CorporateDemo() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const activeSvc = SERVICES[activeIdx];

  // Auto cycle through services (pauses when user clicks or hovers)
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % SERVICES.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isPaused]);

  return (
    <>
      <SEO
        title="Corporate Telemedicine Services | Humancare Connect for Corporates"
        description="Corporate telemedicine services designed to improve employee wellness, workforce productivity, and healthcare access through secure virtual healthcare services, online doctor appointments, and scalable telehealth solutions by Humancare Connect."
        keywords="Corporate telemedicine services, Virtual healthcare services, Online doctor appointment, Employee healthcare solutions"
        url="https://humancareconnect.co/corporates"
      />
      {/* HERO */}
      <section>
        <div
          className="corp-hero"
          style={{
            backgroundImage: `
      linear-gradient(
            rgba(51, 71, 121, 0.75),
        rgba(0, 0, 0, 0.75)
      ),
      url(${CorporateImg})
    `,
          }}
        >
          <div className="corp-hero-inner">
            <h1>Corporate healthcare solutions built for modern teams.</h1>
            <p>
              Support employee wellness, productivity, and long-term workforce
              health with secure corporate telemedicine services designed for
              businesses of every size. Humancare Connect helps companies
              simplify healthcare access through fast online doctor
              appointments, virtual healthcare services, and a scalable
              telemedicine platform employees can access anytime, anywhere.
            </p>
          </div>
        </div>
      </section>

      {/* Slider */}
      <IndustrySlider />
      {/* ECG  */}
      <ECGTimeline />

      {/* PREMIUM ACCORDION SECTION */}
      <section className="corp-accordion-section">
        <div className="corp-accordion-header">
          <div className="accordion-eyebrow">
            CORPORATE HEALTHCARE SOLUTIONS
          </div>
          <h2 className="accordion-title">
            Everything your workforce needs in one telemedicine platform.
          </h2>
          <p className="accordion-desc">
            Build a healthier, more productive workforce with scalable corporate
            telemedicine services, virtual doctor visits, primary care support,
            and connected healthcare solutions employees can access anytime,
            anywhere.
          </p>
        </div>

        <div
          className="corp-accordion-container"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {SERVICES.map((svc, i) => {
            const isActive = i === activeIdx;
            return (
              <div
                key={svc.label}
                className={`accordion-panel ${isActive ? "active" : ""}`}
                onMouseEnter={() => {
                  setActiveIdx(i);
                  setIsPaused(true);
                }}
                onClick={() => {
                  setActiveIdx(i);
                  setIsPaused(true);
                }}
                style={{
                  "--panel-accent": svc.accent,
                  "--panel-image": `url(${svc.img})`,
                }}
              >
                {/* Always visible collapsed spine */}
                <div className="accordion-spine">
                  <div className="spine-icon">{svc.icon}</div>
                  <div className="spine-label">{svc.label}</div>
                </div>

                {/* Expanded Content */}
                <div className="accordion-content">
                  <div className="accordion-content-inner">
                    <h3 className="ac-title">{svc.title}</h3>
                    <p className="ac-desc">{svc.desc}</p>

                    <div className="ac-stats">
                      <div className="ac-stat-main">
                        <span className="val">{svc.statNum}</span>
                        <span className="lbl">{svc.statLbl}</span>
                      </div>

                      <div className="ac-stat-rows">
                        {svc.centreRows.map((row, idx) => (
                          <div className="ac-row" key={idx}>
                            <div className="ac-row-top">
                              <span className="ac-row-lbl">{row.label}</span>
                              <span className="ac-row-val">{row.val}</span>
                            </div>
                            <div className="ac-progress">
                              <div
                                className="ac-progress-fill"
                                style={{
                                  width: `${row.pct}%`,
                                  background: row.grad,
                                }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* <button className="ac-btn">Explore Feature</button> */}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Netaji />

      <FAQ
        badge="FAQ"
        title="Frequently Asked Questions"
        description="Everything you need to know about our corporate telemedicine services, benefits, and implementation."
        stats={[
          "Avg. response in 10 min",
          "HIPAA secure & private",
          "Available Globally",
        ]}
        sections={CORPORATE_FAQS}
      />
    </>
  );
}
