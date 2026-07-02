import { useState, useRef } from "react";
import "./FAQPage.css";

/**
 * FAQPage — Nurecare Connect
 * Hero banner + floating CTA card + categorized accordion.
 */

const CATEGORIES = [
  {
    id: "appointments",
    label: "Appointments",
    eyebrow: "Getting started",
    icon: CalendarIcon,
    items: [
      {
        q: "What is an online doctor consultation?",
        a: "An online doctor consultation lets you connect with a licensed, board-certified physician over video or chat — no waiting room required. You'll get the same clinical attention as an in-person visit: history review, diagnosis, and a treatment plan, all from wherever you are.",
      },
      {
        q: "How do I choose the right doctor for my consultation?",
        a: "Browse doctor profiles by specialty, years of experience, and patient rating before you book. You can also let our matching tool suggest a doctor based on your symptoms and preferred language.",
      },
      {
        q: "What types of online doctor consultation services are available on Nurecare Connect?",
        a: "We offer general medicine, pediatrics, dermatology, mental health, and chronic care follow-ups, plus urgent same-day slots for non-emergency concerns.",
      },
    ],
  },
  {
    id: "virtual-care",
    label: "Virtual Care",
    eyebrow: "During your visit",
    icon: PulseIcon,
    items: [
      {
        q: "Can I access healthcare services online with an online doctor consultation?",
        a: "Yes. Consultations, prescriptions, lab referrals, and specialist follow-ups can all be handled virtually — end to end, without an in-person visit unless your doctor recommends one.",
      },
      {
        q: "What if I am not sure which service I need to consult with?",
        a: "Start a chat with our care team. They'll ask a few quick questions and route you to the right specialty, so you don't have to figure it out alone.",
      },
      {
        q: "Are online consultations suitable for different age groups?",
        a: "We support patients from toddlers to seniors, with pediatric and geriatric specialists available. A guardian must be present for consultations involving minors.",
      },
      {
        q: "Can I discuss more than one health concern during an online consultation?",
        a: "Absolutely — mention every concern when you book so your doctor can allocate enough time and review everything in one session.",
      },
      {
        q: "Are online doctor consultations private and secure?",
        a: "Every session runs on an encrypted, HIPAA-compliant platform. Your records and video calls are never shared without your written consent.",
      },
      {
        q: "Can I receive medical advice for routine and ongoing health concerns?",
        a: "Yes — from seasonal illnesses to ongoing management of conditions like hypertension or diabetes, our doctors can adjust care plans and monitor progress over time.",
      },
      {
        q: "Do I need a referral for an online doctor consultation?",
        a: "No referral is needed for general consultations. Some specialist visits may ask for recent records, which you can upload before your appointment.",
      },
      {
        q: "Can I receive prescriptions during an online consultation?",
        a: "If clinically appropriate, your doctor can send a prescription directly to your preferred pharmacy before the call ends.",
      },
    ],
  },
  {
    id: "benefits",
    label: "Benefits & Care",
    eyebrow: "Why it works",
    icon: HeartIcon,
    items: [
      {
        q: "Are online consultations suitable for preventive care?",
        a: "Yes — regular check-ins, screening reminders, and lifestyle guidance are all part of preventive care we deliver virtually, helping catch issues early.",
      },
      {
        q: "How quickly can I connect with a healthcare professional online?",
        a: "Most patients are matched with a doctor in under two minutes during business hours, and urgent slots are typically available same-day.",
      },
      {
        q: "What are the benefits of online doctor consultation?",
        a: "No commute, no waiting room, flexible scheduling, and access to specialists outside your local area — with the same quality of clinical care.",
      },
      {
        q: "Can I receive specialized medical support through Nurecare Connect?",
        a: "Yes, our network includes specialists across dermatology, mental health, endocrinology, and more, bookable directly from your dashboard.",
      },
      {
        q: "Why choose Nurecare Connect for online doctor consultation?",
        a: "Licensed physicians, encrypted care, and an average response time under two minutes — built so getting care feels as easy as sending a message.",
      },
    ],
  },
   {
    id: "Dummy",
    label: "Demo",
    eyebrow: "Write your own questions and answers",
    icon: HeartIcon,
    items: [
      {
        q: "Are online consultations suitable for preventive care?",
        a: "Yes — regular check-ins, screening reminders, and lifestyle guidance are all part of preventive care we deliver virtually, helping catch issues early.",
      },
      {
        q: "How quickly can I connect with a healthcare professional online?",
        a: "Most patients are matched with a doctor in under two minutes during business hours, and urgent slots are typically available same-day.",
      },
      
    ],
  },
];

export default function FAQPage() {
  return (
    <div className="faq-page">
      <Hero />
      <FAQContent />
    </div>
  );
}

function Hero() {
  return (
    <header className="hero">
      <div className="hero__inner">
        <div className="hero__copy">
          <p className="eyebrow">Support center</p>
          <h1 className="hero__title">
            Answers land <em>before</em> the worry does.
          </h1>
          <p className="hero__sub">
            Everything you need to know about consulting a doctor online with
            Nurecare Connect — from booking your first visit to getting a
            prescription sent to your pharmacy.
          </p>

          <ul className="hero__stats">
            <li>
              <span className="hero__stat-value">2 min</span>
              <span className="hero__stat-label">avg. response time</span>
            </li>
            <li>
              <span className="hero__stat-value">HIPAA</span>
              <span className="hero__stat-label">secure by default</span>
            </li>
            <li>
              <span className="hero__stat-value">50</span>
              <span className="hero__stat-label">states covered</span>
            </li>
          </ul>
        </div>

        <CTACard />
      </div>

      <PulseDivider />
    </header>
  );
}

function CTACard() {
  return (
    <aside className="cta-card" aria-label="Chat with the care team">
      <div className="cta-card__top">
        <span className="cta-card__avatar">
          <ChatIcon />
        </span>
        <span className="cta-card__status">
          <span className="pulse-dot" aria-hidden="true" />
          Care team online
        </span>
      </div>

      <h2 className="cta-card__title">Still have a question?</h2>
      <p className="cta-card__text">
        Talk to a real person on our care team — no bots, no hold music.
        Average reply time is under two minutes.
      </p>

      <button className="cta-card__button" type="button">
        Chat with our team
        <ArrowIcon />
      </button>

      <p className="cta-card__footnote">
        Or email <span>care@nurecareconnect.com</span>
      </p>
    </aside>
  );
}

function PulseDivider() {
  return (
    <svg
      className="pulse-divider"
      viewBox="0 0 1200 60"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        className="pulse-divider__line"
        d="M0,30 L340,30 L365,30 L385,8 L405,52 L425,30 L455,30 L470,20 L485,30 L1200,30"
        fill="none"
      />
    </svg>
  );
}

function FAQContent() {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].id);
  const sectionRefs = useRef({});

  const scrollToCategory = (id) => {
    setActiveCategory(id);
    sectionRefs.current[id]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <main className="faq-content">
      <nav className="quick-nav" aria-label="Jump to category">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={
              "quick-nav__pill" +
              (activeCategory === cat.id ? " quick-nav__pill--active" : "")
            }
            onClick={() => scrollToCategory(cat.id)}
          >
            <cat.icon />
            {cat.label}
          </button>
        ))}
      </nav>

      <div className="faq-sections">
        {CATEGORIES.map((cat) => (
          <section
            key={cat.id}
            id={cat.id}
            ref={(el) => (sectionRefs.current[cat.id] = el)}
            className="faq-section"
          >
            <div className="faq-section__heading">
              <span className="faq-section__icon">
                <cat.icon />
              </span>
              <div>
                <p className="eyebrow eyebrow--muted">{cat.eyebrow}</p>
                <h2>{cat.label}</h2>
              </div>
            </div>

            <AccordionGroup items={cat.items} />
          </section>
        ))}
      </div>
    </main>
  );
}

function AccordionGroup({ items }) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <ul className="accordion">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <li key={item.q} className="accordion__item">
            <button
              type="button"
              className="accordion__trigger"
              aria-expanded={isOpen}
              onClick={() => setOpenIndex(isOpen ? -1 : i)}
            >
              <span>{item.q}</span>
              <span
                className={
                  "accordion__icon" + (isOpen ? " accordion__icon--open" : "")
                }
                aria-hidden="true"
              >
                <PlusIcon />
              </span>
            </button>
            <div
              className="accordion__panel"
              style={{
                gridTemplateRows: isOpen ? "1fr" : "0fr",
              }}
            >
              <p className="accordion__answer">{item.a}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Icons (inline, no dependency) ---------- */

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 9.5H20.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3V6.5M16 3V6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
      <path
        d="M2.5 12H8L10 6.5L14 17.5L16 12H21.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
      <path
        d="M12 20.2C12 20.2 3 15 3 8.8C3 5.9 5.2 4 7.8 4C9.6 4 11.1 5 12 6.4C12.9 5 14.4 4 16.2 4C18.8 4 21 5.9 21 8.8C21 15 12 20.2 12 20.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
      <path
        d="M4 12.2C4 7.9 7.8 4.5 12.2 4.5C16.6 4.5 20.2 7.9 20.2 12.2C20.2 16.5 16.6 19.9 12.2 19.9C10.9 19.9 9.7 19.6 8.6 19.1L4 20.2L5.2 16.2C4.4 15 4 13.6 4 12.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
      <path
        d="M5 12H19M19 12L13 6M19 12L13 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
      <path
        d="M12 5V19M5 12H19"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
