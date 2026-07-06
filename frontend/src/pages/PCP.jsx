import { useState, useRef, useMemo, memo } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import {
  ArrowRight,
  CirclePlay,
  CircleCheckBig,
  Star,
  Stethoscope,
  Activity,
  Clock,
  Shield,
  Calendar,
  Eye,
  HeartHandshake,
  ClipboardList,
  UserCheck,
  Users,
  Heart,
  ChevronDown,
  Phone,
  BadgeCheck,
  Thermometer,
  RefreshCw,
  Pill,
  Microscope,
  Syringe,
} from 'lucide-react'
import './PCP.css'

// ─── Animation variants ───────────────────────────────────────────────────────
const FADE_VARIANTS = {
  up:    { hidden: { opacity: 0, y: 28 },  visible: { opacity: 1, y: 0, x: 0 } },
  down:  { hidden: { opacity: 0, y: -28 }, visible: { opacity: 1, y: 0, x: 0 } },
  left:  { hidden: { opacity: 0, x: -28 }, visible: { opacity: 1, y: 0, x: 0 } },
  right: { hidden: { opacity: 0, x: 28 },  visible: { opacity: 1, y: 0, x: 0 } },
}

const EASE_SPRING = [0.22, 1, 0.36, 1]

// ─── FadeIn ───────────────────────────────────────────────────────────────────
function FadeIn({ children, delay = 0, direction = 'up', className = '' }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-60px 0px' })

  return (
    <motion.div
      ref={ref}
      variants={FADE_VARIANTS[direction]}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      transition={{ duration: 0.55, delay, ease: EASE_SPRING }}
      className={`w-full ${className}`}
    >
      {children}
    </motion.div>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const TRUST_BADGES = [' No Insurance Required', ' Same-Day Appointments', ' Connect Anytime']

const ONBOARDING_STEPS = [
  { n: 1, t: 'Create account' },
  { n: 2, t: 'Health intake' },
  { n: 3, t: 'Match provider' },
  { n: 4, t: 'Start video visit' },
]

const ABOUT_GRID = [
  { icon: Stethoscope,    label: 'Diagnosis',      gradClass: 'pcp-tile-grad-1' },
  { icon: Shield,         label: 'Prevention',     gradClass: 'pcp-tile-grad-2' },
  { icon: HeartHandshake, label: 'Long-term Care', gradClass: 'pcp-tile-grad-3' },
  { icon: ClipboardList,  label: 'Referrals',      gradClass: 'pcp-tile-grad-4' },
]

const ABOUT_FEATURES = [
  { icon: Shield,   title: 'Preventive Care',            desc: 'Stay proactive with wellness visits, vaccinations, and personalized health guidance designed to help prevent future health concerns.' },
  { icon: Calendar, title: 'Annual Wellness Visits',            desc: 'Monitor your overall health through routine checkups and regular assessments that support long-term well-being.' },
  { icon: Activity, title: 'Chronic Condition Management', desc: 'Receive ongoing support for conditions such as diabetes, high blood pressure, asthma, high cholesterol, and other long-term health concerns.' },
  { icon: Eye,      title: 'Health Screenings & Referrals',          desc: 'Get guidance on recommended screenings and specialist referrals based on your health needs, age, and medical history.' },
]

const HOW_IT_WORKS_STEPS = [
  { icon: UserCheck,     title: 'Create Your Free Account',    desc: 'Sign up in under 2 minutes. No credit card required to get started.',             stepClass: 'pcp-step-1', textClass: 'pcp-step-text-1' },
  { icon: ClipboardList, title: 'Complete Health Intake',      desc: 'Share your medical history and current concerns through our secure form.',          stepClass: 'pcp-step-2', textClass: 'pcp-step-text-2' },
  { icon: Users,         title: 'Get Matched With a Provider', desc: 'We surface the best licensed PCP for your needs, location, and schedule.',          stepClass: 'pcp-step-3', textClass: 'pcp-step-text-3' },
  { icon: Calendar,      title: 'Schedule Your Visit',         desc: 'Book a same-day telehealth or in-person appointment that fits your life.',           stepClass: 'pcp-step-4', textClass: 'pcp-step-text-4' },
  { icon: Heart,         title: 'Receive Ongoing Care',        desc: 'Get prescriptions, referrals, follow-ups, and continuous health support.',           stepClass: 'pcp-step-5', textClass: 'pcp-step-text-5' },
]

const SERVICES = [
  { icon: Activity,    title: 'Annual Wellness Visits',      desc: 'Routine health evaluations that help monitor your overall well-being and identify potential concerns early.' },
  { icon: Thermometer, title: 'Sick Visits',                desc: 'Get care for common illnesses, infections, cold and flu symptoms, allergies, minor injuries, and everyday health concerns.' },
  { icon: Shield,      title: 'Preventive Health Screenings',      desc: 'Stay proactive with recommended screenings and health assessments based on your age, lifestyle, and medical history.' },
  { icon: RefreshCw,   title: 'Chronic Condition Management', desc: 'Receive ongoing support for diabetes, high blood pressure, asthma, high cholesterol, and other long-term health conditions.' },
  { icon: Pill,        title: 'Prescription Refills',       desc: 'Manage medications and request prescription renewals when clinically appropriate through convenient online consultations.' },
  { icon: Microscope,  title: 'Lab Orders & Diagnostic Testing',                 desc: 'Get lab requests for blood work and other diagnostic tests, with guidance on understanding your results.' },
  { icon: Users,       title: 'Specialist Referrals',       desc: 'When additional care is needed, your provider can help connect you with the appropriate specialist.' },
  { icon: Heart,       title: "Women's Health Support",             desc: 'Access care for reproductive health, hormonal concerns, wellness needs, and preventive screenings.' },
  { icon: Stethoscope, title: "Men's Health Support",               desc: "Get personalized care for men's wellness, preventive health, and age-related health concerns." },
  // { icon: Syringe,     title: 'Vaccinations',               desc: 'Flu shots, COVID boosters, travel vaccines, and full immunization records.' },
]

const FAQS = [
  {
    q: "What is a Primary Care Provider (PCP)?",
    a: "A Primary Care Provider is a healthcare professional who helps manage your overall health, preventive care, routine medical concerns, and chronic conditions.",
  },
  {
    q: "Why is primary care important?",
    a: "Primary care helps detect health issues early, manage ongoing conditions, coordinate specialist care, and support long-term wellness.",
  },
  {
    q: "Can I see a primary care doctor online?",
    a: "Yes. Humancare Connect allows patients to connect with licensed providers through secure telemedicine services for many primary care needs.",
  },
  {
    q: "What conditions can a PCP treat?",
    a: "PCPs can help with common illnesses, preventive care, medication management, chronic conditions, minor infections, allergies, and many everyday health concerns.",
  },
  {
    q: "Can I get same-day appointments?",
    a: "Yes. Same-day and convenient appointment options may be available based on provider availability.",
  },
  {
    q: "Can a PCP prescribe medication online?",
    a: "Providers may prescribe medications when medically appropriate and permitted by applicable laws and regulations.",
  },
  {
    q: "Can I request prescription refills?",
    a: "Yes. Providers can review your medical history and determine whether a prescription refill is appropriate.",
  },
  {
    q: "Can a PCP order lab tests?",
    a: "Yes. Providers may order laboratory tests when medically necessary to help evaluate your health concerns.",
  },
  {
    q: "Can I discuss test results online?",
    a: "Yes. Providers can review and explain lab results during your virtual appointment.",
  },
  {
    q: "Can I get referrals to specialists?",
    a: "Yes. Your provider can recommend specialist care when additional evaluation or treatment is needed.",
  },
  {
    q: "Do I need insurance to use Humancare Connect?",
    a: "No. Patients can access care regardless of insurance status.",
  },
  {
    q: "What is included in a primary care visit?",
    a: "Visits may include symptom evaluation, treatment recommendations, preventive care guidance, medication review, and follow-up planning.",
  },
  {
    q: "Is virtual primary care effective?",
    a: "Virtual primary care can effectively address many routine healthcare needs, ongoing condition management, and preventive care discussions.",
  },
  {
    q: "How long does an online appointment take?",
    a: "Appointment length varies depending on your needs, but most visits are completed within a reasonable timeframe.",
  },
  {
    q: "Can I discuss chronic conditions with a PCP?",
    a: "Yes. Providers can help monitor and manage conditions such as diabetes, hypertension, asthma, and high cholesterol.",
  },
  {
    q: "Can primary care help with preventive healthcare?",
    a: "Yes. Preventive care is one of the most important roles of a primary care provider.",
  },
  {
    q: "Is my health information secure?",
    a: "Yes. Humancare Connect uses secure technology designed to protect patient privacy and health information.",
  },
  {
    q: "Can I use primary care services while traveling?",
    a: "Yes. Availability may depend on provider licensing requirements and your location at the time of service.",
  },
  {
    q: "What should I prepare before my appointment?",
    a: "Have a list of symptoms, medications, medical history, and any questions you would like to discuss.",
  },
  {
    q: "Can a PCP help with high blood pressure?",
    a: "Yes. Primary care providers commonly diagnose, monitor, and manage hypertension.",
  },
  {
    q: "Can a PCP help with diabetes management?",
    a: "Yes. Providers can help monitor diabetes, review medications, and support ongoing treatment plans.",
  },
  {
    q: "Can I receive follow-up care online?",
    a: "Yes. Many follow-up appointments can be completed through virtual consultations.",
  },
  {
    q: "What if I need specialized care?",
    a: "Your provider can discuss treatment options and refer you to a specialist when appropriate.",
  },
  {
    q: "When should I see a primary care doctor?",
    a: "You should see a PCP for preventive care, routine health concerns, medication management, chronic condition support, and non-emergency medical issues.",
  },
  {
    q: "Is Humancare Connect available year-round?",
    a: "Yes. Patients can access primary care services throughout the year based on provider availability.",
  },
];

const CTA_TRUST_POINTS = [
  { icon: BadgeCheck, text: "Licensed Providers" },
  { icon: Shield, text: "Secure Telemedicine" },
  { icon: Clock, text: "Convenient Appointments" },
  { icon: Star, text: "Patient-Centered Care" },
]
// ─── Hero Sub-Components ──────────────────────────────────────────────────────

const ProviderCard = memo(function ProviderCard({ floating = true }) {
  return (
    <div className={`pcp-glass pcp-provider-card mx-auto ${floating ? 'pcp-float' : ''}`}>
      <div className="pcp-provider-card__image">
        {[0, 1, 2, 3].map(r => (
          <div
            key={r}
            className="pcp-provider-card__ring"
            style={{ width: 60 + r * 48, height: 60 + r * 48 }}
          />
        ))}
        <Stethoscope size={60} className="pcp-provider-card__icon" />
      </div>
      <div className="pcp-provider-card__body">
        <div className="pcp-provider-card__name-row">
          <span className="pcp-provider-card__name">Dr. Sarah Mitchell</span>
          <span className="pcp-provider-card__rating">
            <Star size={11} fill="currentColor" /> 4.9
          </span>
        </div>
        <p className="pcp-provider-card__specialty">Family Medicine · 12 yrs</p>
        <div className="pcp-provider-card__avail">
          <span className="pcp-provider-card__avail-dot" />
          Available Today · Telehealth
        </div>
      </div>
    </div>
  )
})

const SocialProofBadge = memo(function SocialProofBadge() {
  return (
    <div className="pcp-social-proof">
      <div className="pcp-social-proof__stars">
        {[1, 2, 3, 4, 5].map(i => (
          <Star key={i} size={10} fill="#fde047" color="#f59e0b" />
        ))}
      </div>
      <p className="pcp-social-proof__count">50k+ patients</p>
      <p className="pcp-social-proof__label">trust HumanCare</p>
    </div>
  )
})

const HealthStatusCard = memo(function HealthStatusCard() {
  return (
    <div className="pcp-glass pcp-health-status">
      <div className="pcp-health-status__header">
        <div className="pcp-health-status__icon-wrap">
          <Activity size={14} color="#16a34a" />
        </div>
        <div>
          <p className="pcp-health-status__label">Health Status</p>
          <p className="pcp-health-status__value">Excellent</p>
        </div>
      </div>
      <div className="pcp-health-status__bar-bg">
        <div className="pcp-health-status__bar-fill" />
      </div>
      <p className="pcp-health-status__date">Last check: 2 days ago</p>
    </div>
  )
})

const OnboardingMiniSteps = memo(function OnboardingMiniSteps() {
  const stepLabel = ONBOARDING_STEPS.map(s => s.t).join(' → ')
  return (
    <div className="pcp-glass pcp-onboarding">
      <p className="pcp-onboarding__eyebrow">Your First Visit · Free</p>
      <div className="pcp-onboarding__steps">
        {ONBOARDING_STEPS.map((step, i) => (
          <div key={step.n} className={`pcp-onboarding__step-wrap ${i < ONBOARDING_STEPS.length - 1 ? 'flex-1' : ''}`}>
            <span className="pcp-onboarding__dot">{step.n}</span>
            {i < ONBOARDING_STEPS.length - 1 && <span className="pcp-onboarding__line" />}
          </div>
        ))}
      </div>
      <p className="pcp-onboarding__label">{stepLabel}</p>
    </div>
  )
})

const WaitTimePill = memo(function WaitTimePill() {
  return (
    <div className="pcp-glass pcp-wait-time">
      <div className="pcp-wait-time__icon">
        <Clock size={13} color="var(--blue)" />
      </div>
      <div>
        <p className="pcp-wait-time__label">Wait time</p>
        <p className="pcp-wait-time__value">Under 15 min</p>
      </div>
    </div>
  )
})

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroLeft() {
  return (
    <div className="pcp-hero__left">
      <FadeIn delay={0.05}>
        <div className="pcp-hero__badge-wrap">
          <span className="pcp-hero__badge">
            <span className="pcp-hero__badge-dot" />
            NO PCP? NO PROBLEM.
          </span>
        </div>
      </FadeIn>

      <FadeIn delay={0.12}>
        <h1 className="pcp-hero__h1">
          Primary Care That Fits Your Life<br />
          <span className="pcp-grad-text"> Connect with a Licensed Provider in Minutes.
 </span>
        </h1>
      </FadeIn>

      <FadeIn delay={0.2}>
        <p className="pcp-hero__sub">
         Skip the wait and get the care you need with secure telemedicine services. Humancare Connect is your primary care destination for preventive care, prescription refills, daily health concerns and ongoing support wherever you are.
        </p>
      </FadeIn>

      <FadeIn delay={0.28}>
        <div className="pcp-hero__ctas">
          <a href="/appointment-booking" aria-label="Get started with HumanCare Connect" className="pcp-btn-primary">
           Get Started <ArrowRight size={15} />
          </a>
          <a href="#how-it-works" className="pcp-btn-secondary">
            <CirclePlay size={15} /> How It Works
          </a>
        </div>
      </FadeIn>

      <FadeIn delay={0.33}>
        <div className="pcp-hero__trust">
          {TRUST_BADGES.map(badge => (
            <div key={badge} className="pcp-hero__trust-item">
              <CircleCheckBig size={13} color="var(--blue)" className="pcp-flex-shrink-0" />
              {badge}
            </div>
          ))}
        </div>
      </FadeIn>
    </div>
  )
}

function HeroRight() {
  return (
    <div className="pcp-hero__right">
      {/* Mobile / tablet: stacked flow */}
      <div className="pcp-hero__right-mobile">
        <FadeIn delay={0.15}><ProviderCard floating={false} /></FadeIn>
        <FadeIn delay={0.25}>
          <div className="pcp-hero__right-mobile-row">
            <SocialProofBadge />
            <WaitTimePill />
          </div>
        </FadeIn>
        <FadeIn delay={0.32}><HealthStatusCard /></FadeIn>
        <FadeIn delay={0.38}><OnboardingMiniSteps /></FadeIn>
      </div>

      {/* Desktop: art-directed composition */}
      <div className="pcp-hero__right-desktop">
        {/* Centre card */}
        <div className="pcp-hero-card-anchor">
          <motion.div
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.15, ease: EASE_SPRING }}
          >
            <ProviderCard />
          </motion.div>
        </div>

        {/* Top-left: Social proof badge */}
        <motion.div
          initial={{ opacity: 0, x: -30, y: -10 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 0.65, delay: 0.55 }}
          className="pcp-widget pcp-widget--tl pcp-float-b"
        >
          <SocialProofBadge />
        </motion.div>

        {/* Bottom-left: Health status */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.65, delay: 0.65 }}
          className="pcp-widget pcp-widget--bl pcp-float-c"
        >
          <HealthStatusCard />
        </motion.div>

        {/* Top-right: Onboarding steps */}
        <motion.div
          initial={{ opacity: 0, x: 30, y: -10 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 0.65, delay: 0.45 }}
          className="pcp-widget pcp-widget--tr pcp-float-d"
        >
          <OnboardingMiniSteps />
        </motion.div>

        {/* Bottom-right: Wait time */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.72 }}
          className="pcp-widget pcp-widget--br pcp-float-e"
        >
          <WaitTimePill />
        </motion.div>
      </div>
    </div>
  )
}

function Hero() {
  return (
    <section aria-label="Primary Care Hero" className="pcp-hero">
      <div className="pcp-hero__blob pcp-hero__blob--tr" aria-hidden="true" />
      <div className="pcp-hero__blob pcp-hero__blob--bl" aria-hidden="true" />

      <div className="pcp-container">
        <div className="pcp-hero__grid">
          <HeroLeft />
          <HeroRight />
        </div>
      </div>
    </section>
  )
}

// ─── About Primary Care ───────────────────────────────────────────────────────

function AboutLeft() {
  return (
    <FadeIn direction="left">
      <div className="pcp-about__left">
        <div className="pcp-about__backdrop" aria-hidden="true" />

        <div className="pcp-about__tiles">
          {ABOUT_GRID.map((tile, i) => (
            <motion.div
              key={tile.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="pcp-about__tile"
            >
              <div className={`pcp-about__tile-icon ${tile.gradClass}`}>
                <tile.icon size={22} color="#fff" />
              </div>
              <p className="pcp-about__tile-label">{tile.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="pcp-about__badge" aria-hidden="true">
          <div>
            <p className="pcp-about__badge-main">24/7</p>
            <p className="pcp-about__badge-sub">Access</p>
          </div>
        </div>
      </div>
    </FadeIn>
  )
}

function AboutRight() {
  return (
    <div className="pcp-about__right">
      <FadeIn>
        <span className="pcp-eyebrow">WHAT IS PRIMARY CARE?</span>
        <h2 className="pcp-about__intro-title">
          Your Partner for Better Everyday Health
        </h2>
        <p className="pcp-about__intro-p">
        Primary care is the foundation of long-term health and wellness. A Primary Care Provider (PCP) helps you stay healthy through preventive care, routine checkups, treatment for common illnesses, prescription management, and ongoing support for chronic conditions.

        </p>
        <p className="pcp-about__intro-p">
         At Humancare Connect, you can access licensed healthcare providers through secure telemedicine services without the hassle of long wait times or scheduling barriers. Whether you need help managing your health, addressing new symptoms, or staying on top of preventive care, we're here to make quality healthcare more accessible.
        </p>
      </FadeIn>

      <div className="pcp-about__features">
        {ABOUT_FEATURES.map((feature, i) => (
          <FadeIn key={feature.title} delay={i * 0.08}>
            <div className="pcp-about__feature">
              <div className="pcp-about__feature-icon">
                <feature.icon size={18} />
              </div>
              <div>
                <p className="pcp-about__feature-title">{feature.title}</p>
                <p className="pcp-about__feature-desc">{feature.desc}</p>
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
    </div>
  )
}

function AboutPrimaryCare() {
  return (
    <section id="about" aria-label="About Primary Care" className="pcp-section pcp-about">
      <div className="pcp-container">
        <div className="pcp-about__grid">
          <AboutLeft />
          <AboutRight />
        </div>
      </div>
    </section>
  )
}

// ─── How It Works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <section id="how-it-works" aria-label="How It Works" className="pcp-section pcp-hiw">
      <div className="pcp-container--narrow">
        <FadeIn>
          <div className="pcp-section-header">
            <span className="pcp-eyebrow">Simple Process</span>
            <h2 className="pcp-section-title">Your First Visit, Step by Step</h2>
            <p className="pcp-section-sub">
              From sign-up to care in minutes. No referrals, no lengthy waits, no insurance required.
            </p>
          </div>
        </FadeIn>

        {/* Mobile: vertical list */}
        <div className="pcp-hiw__mobile">
          {HOW_IT_WORKS_STEPS.map((step, i) => (
            <FadeIn key={step.title} delay={i * 0.08}>
              <div className="pcp-hiw__mobile-card">
                <div className={`pcp-step-icon ${step.stepClass}`}>
                  <step.icon size={20} color="#fff" />
                </div>
                <div>
                  <span className={`pcp-timeline-card__step ${step.textClass}`}>
                    Step {i + 1}
                  </span>
                  <h3 className="pcp-timeline-card__title">{step.title}</h3>
                  <p className="pcp-timeline-card__desc">{step.desc}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Desktop: alternating timeline */}
        <div className="pcp-hiw__desktop pcp-timeline-container">
          <div className="pcp-timeline-line" aria-hidden="true" />

          {HOW_IT_WORKS_STEPS.map((step, i) => {
            const isLeft = i % 2 === 0
            return (
              <FadeIn key={step.title} delay={i * 0.1}>
                <div className="pcp-timeline-row">
                  <div className="pcp-timeline-left">
                    {isLeft && (
                      <motion.div
                        initial={{ opacity: 0, x: -32 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.55, delay: i * 0.1 }}
                        className="pcp-timeline-card pcp-timeline-card--left pcp-card-lift"
                      >
                        <span className={`pcp-timeline-card__step ${step.textClass}`}>
                          Step {i + 1}
                        </span>
                        <h3 className="pcp-timeline-card__title">{step.title}</h3>
                        <p className="pcp-timeline-card__desc">{step.desc}</p>
                      </motion.div>
                    )}
                  </div>

                  <div className="pcp-timeline-center">
                    <motion.div
                      whileInView={{ scale: [0.5, 1.2, 1] }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.45, delay: i * 0.1 }}
                      className={`pcp-step-icon ${step.stepClass}`}
                      aria-hidden="true"
                    >
                      <step.icon size={20} color="#fff" />
                    </motion.div>
                  </div>

                  <div className="pcp-timeline-right">
                    {!isLeft && (
                      <motion.div
                        initial={{ opacity: 0, x: 32 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.55, delay: i * 0.1 }}
                        className="pcp-timeline-card pcp-timeline-card--right pcp-card-lift"
                      >
                        <span className={`pcp-timeline-card__step ${step.textClass}`}>
                          Step {i + 1}
                        </span>
                        <h3 className="pcp-timeline-card__title">{step.title}</h3>
                        <p className="pcp-timeline-card__desc">{step.desc}</p>
                      </motion.div>
                    )}
                  </div>
                </div>
              </FadeIn>
            )
          })}
        </div>

        <FadeIn>
          <div className="pcp-hiw__footer">
            <a href="/get-started" className="pcp-btn-primary pcp-btn-inline">
              Get Started Now <ArrowRight size={16} />
            </a>
            <p className="pcp-hiw__footer-note">No insurance required · Cancel anytime</p>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

// ─── Services ─────────────────────────────────────────────────────────────────

function Services() {
  return (
    <section id="services" aria-label="Services" className="pcp-section pcp-services">
      <div className="pcp-container">
        <FadeIn>
          <div className="pcp-section-header">
            <span className="pcp-eyebrow">WHAT'S INCLUDED</span>
            <h2 className="pcp-section-title">Comprehensive Primary Care Services
</h2>
            <p className="pcp-section-sub">Everyday Healthcare, All Here</p>
            <p className="pcp-section-sub-1">From preventive care and routine wellness visits to prescription management and chronic condition support, Humancare Connect makes it easy to access essential primary care services through secure virtual appointments.
</p>
          </div>
        </FadeIn>

        <div className="pcp-services-grid">
          {SERVICES.map((service, i) => (
            <FadeIn key={service.title} delay={i * 0.04}>
              <motion.div
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="pcp-service-card"
              >
                <div className="pcp-service-card__icon">
                  <service.icon size={20} />
                </div>
                <h3 className="pcp-service-card__title">{service.title}</h3>
                <p className="pcp-service-card__desc">{service.desc}</p>
              </motion.div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

function FAQ() {
  const [openIndex, setOpenIndex] = useState(null)

  return (
    <section id="faq" aria-label="Frequently Asked Questions" className="pcp-section pcp-faq">
      <div className="pcp-container--narrow">
        <FadeIn>
          <div className="pcp-section-header">
            <span className="pcp-eyebrow">Frequently Asked</span>
            <h2 className="pcp-section-title">Got Questions?</h2>
            <p className="pcp-section-sub">
              Everything you need to know about primary care and HumanCare Connect.
            </p>
          </div>
        </FadeIn>

        <div className="pcp-faq__list">
          {FAQS.map((faq, i) => {
            const isOpen = openIndex === i
            const panelId = `faq-panel-${i}`
            const btnId   = `faq-btn-${i}`

            return (
              <FadeIn key={faq.q} delay={i * 0.04}>
                <div className={`pcp-faq__item ${isOpen ? 'pcp-faq__item--open' : ''}`}>
                  <button
                    id={btnId}
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="pcp-faq__btn"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                  >
                    <span className="pcp-faq__question">{faq.q}</span>
                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.25 }}
                      className={`pcp-faq__chevron-wrap ${isOpen ? 'pcp-faq__chevron-wrap--open' : 'pcp-faq__chevron-wrap--closed'}`}
                      aria-hidden="true"
                    >
                      <ChevronDown
                        size={15}
                        className={isOpen ? 'pcp-faq__chevron--open' : 'pcp-faq__chevron--closed'}
                      />
                    </motion.div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={panelId}
                        role="region"
                        aria-labelledby={btnId}
                        key="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="pcp-faq-panel"
                      >
                        <div className="pcp-faq__answer">{faq.a}</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </FadeIn>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── CTA ──────────────────────────────────────────────────────────────────────

function CTA() {
  return (
    <section aria-label="Call to Action" className="pcp-section pcp-cta">
      <div className="pcp-cta__blob pcp-cta__blob--tl" aria-hidden="true" />
      <div className="pcp-cta__blob pcp-cta__blob--br" aria-hidden="true" />

      <div className="pcp-container--narrow pcp-cta__inner">
        <FadeIn>
          <div className="pcp-cta__live-badge">
            <span className="pcp-cta__live-dot" aria-hidden="true" />
           Ready to Take Charge of Your Health?

          </div>

          <h2 className="pcp-cta__title">
            Ready to Find Your<br />Primary Care Provider?
          </h2>

          <p className="pcp-cta__sub">
            Whether you need preventive care, help managing a chronic condition, prescription support, or treatment for everyday health concerns, Humancare Connect makes quality primary care simple and accessible. <br /><br />
            Connect with a licensed provider through secure telemedicine services and get the care you need when and where it works best for you.
          </p>

          <div className="pcp-cta__actions">
            <motion.a
              href="/get-started"
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="pcp-btn-cta-white"
            >
              Get Started Today <ArrowRight size={16} />
            </motion.a>
            <motion.a
              href="/find-provider"
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="pcp-btn-cta-ghost"
            >
              <Phone size={16} /> Find a Provider
            </motion.a>
          </div>

          <div className="pcp-cta-trust">
            {CTA_TRUST_POINTS.map(point => (
              <div key={point.text} className="pcp-cta-trust__item">
                <point.icon size={14} color="rgba(255,255,255,0.85)" aria-hidden="true" />
                {point.text}
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

// ─── Page composition ──────────────────────────────────────────────────────────
export default function PCP() {
  return (
    <main className="pcp-root">
      <Hero />
      <AboutPrimaryCare />
      <HowItWorks />
      <Services />
      <FAQ />
      <CTA />
    </main>
  )
}