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

// ─── Animation variants (defined OUTSIDE components so they are stable
//     references — no recreation on every render) ───────────────────────────
const FADE_VARIANTS = {
  up:    { hidden: { opacity: 0, y: 32 },  visible: { opacity: 1, y: 0, x: 0 } },
  down:  { hidden: { opacity: 0, y: -32 }, visible: { opacity: 1, y: 0, x: 0 } },
  // FIX: direction naming was inverted — 'left' now slides in FROM the left (x starts positive → 0)
  left:  { hidden: { opacity: 0, x: -32 }, visible: { opacity: 1, y: 0, x: 0 } },
  right: { hidden: { opacity: 0, x: 32 },  visible: { opacity: 1, y: 0, x: 0 } },
}

const EASE_SPRING = [0.22, 1, 0.36, 1]

// ─── FadeIn ──────────────────────────────────────────────────────────────────
// FIX: `w-full` added as base class so the motion.div never collapses to
//      content-width and left-aligns inside a centred flex/grid parent.
//      Callers can still pass className to override or extend.
function FadeIn({ children, delay = 0, direction = 'up', className = '' }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-60px 0px' })

  return (
    <motion.div
      ref={ref}
      variants={FADE_VARIANTS[direction]}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      transition={{ duration: 0.6, delay, ease: EASE_SPRING }}
      className={`w-full ${className}`}
    >
      {children}
    </motion.div>
  )
}

// ─── Data (unchanged) ─────────────────────────────────────────────────────────
const TRUST_BADGES = ['No Insurance Required', 'Same-Day Care', 'Cancel Anytime']

const ONBOARDING_STEPS = [
  { n: 1, t: 'Create account' },
  { n: 2, t: 'Health intake' },
  { n: 3, t: 'Match provider' },
  { n: 4, t: 'Start video visit' },
]

const ABOUT_GRID = [
  { icon: Stethoscope,    label: 'Diagnosis',      color: 'from-blue-500 to-blue-600' },
  { icon: Shield,         label: 'Prevention',     color: 'from-sky-400 to-sky-500' },
  { icon: HeartHandshake, label: 'Long-term Care', color: 'from-teal-500 to-teal-600' },
  { icon: ClipboardList,  label: 'Referrals',      color: 'from-indigo-500 to-indigo-600' },
]

const ABOUT_FEATURES = [
  { icon: Shield,   title: 'Preventive Care',            desc: 'Regular screenings and vaccinations to catch issues before they start.' },
  { icon: Calendar, title: 'Annual Checkups',            desc: 'Comprehensive yearly wellness exams to track your overall health.' },
  { icon: Activity, title: 'Chronic Disease Management', desc: 'Ongoing support for diabetes, hypertension, asthma, and more.' },
  { icon: Eye,      title: 'Health Screenings',          desc: 'Targeted tests based on your age, gender, and health history.' },
]

const HOW_IT_WORKS_STEPS = [
  { icon: UserCheck,     title: 'Create Your Free Account',    desc: 'Sign up in under 2 minutes. No credit card required to get started.',             color: 'from-blue-500 to-blue-600' },
  { icon: ClipboardList, title: 'Complete Health Intake',      desc: 'Share your medical history and current concerns through our secure form.',          color: 'from-sky-500 to-sky-600' },
  { icon: Users,         title: 'Get Matched With a Provider', desc: 'We surface the best licensed PCP for your needs, location, and schedule.',          color: 'from-teal-500 to-teal-600' },
  { icon: Calendar,      title: 'Schedule Your Visit',         desc: 'Book a same-day telehealth or in-person appointment that fits your life.',           color: 'from-indigo-500 to-indigo-600' },
  { icon: Heart,         title: 'Receive Ongoing Care',        desc: 'Get prescriptions, referrals, follow-ups, and continuous health support.',           color: 'from-purple-500 to-purple-600' },
]

const SERVICES = [
  { icon: Activity,    title: 'Annual Wellness Exams',      desc: 'Comprehensive head-to-toe physical evaluations to monitor your overall health.' },
  { icon: Thermometer, title: 'Sick Visits',                desc: 'Quick consultations for infections, fevers, colds, sore throats, and more.' },
  { icon: Shield,      title: 'Preventive Screenings',      desc: 'Blood pressure, cholesterol, diabetes, and cancer screening tests.' },
  { icon: RefreshCw,   title: 'Chronic Disease Management', desc: 'Ongoing care plans for diabetes, hypertension, heart disease, and asthma.' },
  { icon: Pill,        title: 'Prescription Refills',       desc: 'Convenient medication management and prescription renewals.' },
  { icon: Microscope,  title: 'Lab Orders',                 desc: 'Order blood work, urinalysis, and diagnostic tests from any lab.' },
  { icon: Users,       title: 'Specialist Referrals',       desc: 'Coordinated referrals to trusted specialists within our network.' },
  { icon: Heart,       title: "Women's Health",             desc: 'Pap smears, reproductive health, prenatal guidance, and hormone checks.' },
  { icon: Stethoscope, title: "Men's Health",               desc: "Prostate screenings, testosterone panels, and targeted men's wellness care." },
  { icon: Syringe,     title: 'Vaccinations',               desc: 'Flu shots, COVID boosters, travel vaccines, and full immunization records.' },
]

const FAQS = [
  { q: 'What does a primary care physician (PCP) do?',           a: 'A PCP provides comprehensive, ongoing medical care — including preventive checkups, diagnosis of new conditions, management of chronic diseases, referrals to specialists, prescription management, and coordination of all your healthcare needs.' },
  { q: 'How often should I see a primary care doctor?',          a: 'Most adults should schedule at least one annual wellness visit. If you have chronic conditions like diabetes, hypertension, or asthma, your PCP may recommend check-ins every 3–6 months to monitor your health and adjust treatment plans.' },
  { q: 'Can a primary care physician prescribe medications?',    a: 'Yes. PCPs can prescribe a wide range of medications — antibiotics, blood pressure medications, diabetes management drugs, mental health medications (within their scope), and much more. Certain controlled substances may require specialist involvement.' },
  { q: 'Do I need insurance to use HumanCare Connect?',          a: "No. HumanCare Connect accepts most major insurance plans, but we also offer transparent self-pay pricing. You'll see the full cost before you book — no surprise bills, ever." },
  { q: 'Can I use telehealth for primary care visits?',          a: 'Absolutely. The majority of primary care visits — wellness checkups, sick visits, chronic disease management, prescription refills, and mental health screenings — can be handled entirely through video or phone consultations.' },
  { q: 'What conditions can a PCP treat?',                       a: "PCPs treat a broad spectrum: infections, high blood pressure, diabetes, anxiety, depression, asthma, allergies, high cholesterol, thyroid disorders, skin conditions, obesity, and much more. They're your first stop for nearly every health concern." },
  { q: 'How quickly can I see a provider on HumanCare Connect?', a: 'Most patients are matched with an available provider within minutes and can start a telehealth visit the same day. In-person appointments are typically available within 24–48 hours.' },
]

const CTA_TRUST_POINTS = [
  { icon: BadgeCheck, text: 'Board-Certified Providers' },
  { icon: Shield,     text: 'HIPAA Compliant' },
  { icon: Clock,      text: 'Same-Day Care' },
  { icon: Star,       text: '4.9 Average Rating' },
]

// ─── Shared style tokens ─────────────────────────────────────────────────────
const GLASS_CARD = 'bg-white/90 backdrop-blur-md border border-white/90 shadow-[0_8px_32px_rgba(37,99,235,0.12)]'
const GRAD_BLUE  = 'linear-gradient(135deg,#2563eb 0%,#0ea5e9 100%)'

// ─── Hero sub-components (memo-ised: static props, no re-render needed) ──────

const ProviderCard = memo(function ProviderCard({ floating = true }) {
  return (
    <div className={`${GLASS_CARD} mx-auto w-[220px] rounded-3xl p-1 ${floating ? 'pcp-float' : ''}`}>
      <div
        className="relative flex h-40 items-center justify-center overflow-hidden rounded-[20px]"
        style={{ background: GRAD_BLUE }}
      >
        {[0, 1, 2, 3].map(r => (
          <div
            key={r}
            className="absolute rounded-full border border-white/25"
            style={{ width: 60 + r * 48, height: 60 + r * 48 }}
          />
        ))}
        <Stethoscope
          size={60}
          className="relative z-10 text-white/90"
          style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.2))' }}
        />
      </div>
      <div className="flex flex-col gap-1 px-3.5 pb-3.5 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Dr. Sarah Mitchell</span>
          <span className="flex items-center gap-0.5 text-[11px] font-bold text-amber-500">
            <Star size={11} fill="currentColor" /> 4.9
          </span>
        </div>
        <p className="text-[11px] font-semibold text-slate-600">Family Medicine · 12 yrs</p>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-green-600">
          <span className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500" />
          Available Today · Telehealth
        </div>
      </div>
    </div>
  )
})

const SocialProofBadge = memo(function SocialProofBadge() {
  return (
    <div
      className="w-full rounded-2xl px-3.5 py-2.5"
      style={{ background: GRAD_BLUE, boxShadow: '0 8px 28px rgba(37,99,235,0.35)' }}
    >
      <div className="mb-1 flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star key={i} size={10} fill="#fde047" className="text-amber-300" />
        ))}
      </div>
      <p className="text-xs font-bold leading-tight text-white">50k+ patients</p>
      <p className="text-[10px] text-white/70">trust HumanCare</p>
    </div>
  )
})

const HealthStatusCard = memo(function HealthStatusCard() {
  return (
    <div className={`${GLASS_CARD} w-full rounded-2xl p-3`}>
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[10px] bg-green-100">
          <Activity size={14} className="text-green-600" />
        </div>
        <div>
          <p className="text-[10px] font-medium text-slate-400">Health Status</p>
          <p className="text-xs font-bold text-slate-800">Excellent</p>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100">
        <div className="h-full w-4/5 rounded-full" style={{ background: 'linear-gradient(90deg,#4ade80,#14b8a6)' }} />
      </div>
      <p className="mt-1 text-[10px] text-slate-400">Last check: 2 days ago</p>
    </div>
  )
})

// FIX: Memoised; step label text is derived once and stable
const OnboardingMiniSteps = memo(function OnboardingMiniSteps() {
  const stepLabel = ONBOARDING_STEPS.map(s => s.t).join(' → ')
  return (
    <div className={`${GLASS_CARD} w-full rounded-2xl px-3.5 py-3`}>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-blue-600">Your First Visit · Free</p>
      <div className="flex items-center">
        {ONBOARDING_STEPS.map((step, i) => (
          <div key={step.n} className={`flex items-center ${i < ONBOARDING_STEPS.length - 1 ? 'flex-1' : ''}`}>
            <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
              {step.n}
            </span>
            {i < ONBOARDING_STEPS.length - 1 && <span className="mx-1 h-0.5 flex-1 bg-blue-100" />}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-slate-400">{stepLabel}</p>
    </div>
  )
})

const WaitTimePill = memo(function WaitTimePill() {
  return (
    <div className={`${GLASS_CARD} flex w-full items-center gap-2.5 rounded-2xl px-3.5 py-2`}>
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
        <Clock size={13} className="text-blue-600" />
      </div>
      <div>
        <p className="text-[10px] text-slate-400">Wait time</p>
        <p className="text-xs font-bold text-slate-800">Under 15 min</p>
      </div>
    </div>
  )
})

function HeroLeft() {
  return (
    // min-w-0 prevents the grid cell from blowing out at mid-widths
    <div className="min-w-0 w-full space-y-6 text-center lg:text-left">
      <FadeIn delay={0.05}>
        <div className="flex justify-center lg:justify-start">
          <span className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            No PCP? No Problem.
          </span>
        </div>
      </FadeIn>

      <FadeIn delay={0.12}>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-[1.1] tracking-tight text-slate-900">
          Don&apos;t Have a<br />Primary Care Doctor?<br />
          <span style={{ backgroundImage: GRAD_BLUE, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            We&apos;ve Got You Covered.
          </span>
        </h1>
      </FadeIn>

      <FadeIn delay={0.2}>
        <p className="text-base text-slate-500 leading-relaxed mx-auto lg:mx-0 max-w-lg">
          Whether you&apos;re new to the area, between providers, or simply need care today —
          HumanCare Connect helps you reach licensed primary care providers quickly,
          conveniently, and without the wait.
        </p>
      </FadeIn>

      <FadeIn delay={0.28}>
        <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
          <a
            href="/get-started"
            aria-label="Get started with HumanCare Connect"
            className="inline-flex items-center gap-2 text-white font-semibold px-6 py-3 rounded-full text-sm pcp-card-lift"
            style={{ background: GRAD_BLUE, boxShadow: '0 8px 24px -4px rgba(37,99,235,0.4)' }}
          >
            Get Started <ArrowRight size={15} />
          </a>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 bg-white text-blue-600 font-semibold px-6 py-3 rounded-full shadow-md hover:shadow-lg pcp-transition hover:-translate-y-1 border border-blue-100 text-sm"
          >
            <CirclePlay size={15} /> How It Works
          </a>
        </div>
      </FadeIn>

      <FadeIn delay={0.33}>
        <div className="flex flex-wrap items-center gap-4 justify-center lg:justify-start pt-1">
          {TRUST_BADGES.map(badge => (
            <div key={badge} className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <CircleCheckBig size={13} className="text-blue-500 flex-shrink-0" />
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
    <div className="relative min-w-0 w-full">

      {/* ── Mobile / tablet: stacked flow — always centered ── */}
      <div className="lg:hidden w-full max-w-[300px] sm:max-w-sm mx-auto space-y-4">
        <FadeIn delay={0.15}><ProviderCard floating={false} /></FadeIn>
        <FadeIn delay={0.25}>
          <div className="grid grid-cols-2 gap-3">
            <SocialProofBadge />
            <WaitTimePill />
          </div>
        </FadeIn>
        <FadeIn delay={0.32}><HealthStatusCard /></FadeIn>
        <FadeIn delay={0.38}><OnboardingMiniSteps /></FadeIn>
      </div>

      {/* ── Desktop: art-directed composition, centred in the column ── */}
      <div className="hidden lg:block pcp-hero-right-desktop">

        {/* Centre card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.15, ease: EASE_SPRING }}
          style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10 }}
        >
          <ProviderCard />
        </motion.div>

        {/* Top-left: Social proof badge */}
        <motion.div
          initial={{ opacity: 0, x: -30, y: -10 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 0.65, delay: 0.55 }}
          className="pcp-float-b"
          style={{ position: 'absolute', left: 0, top: 20, zIndex: 20, width: 130 }}
        >
          <SocialProofBadge />
        </motion.div>

        {/* Bottom-left: Health status */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.65, delay: 0.65 }}
          className="pcp-float-c"
          style={{ position: 'absolute', left: 0, bottom: 20, zIndex: 20, width: 165 }}
        >
          <HealthStatusCard />
        </motion.div>

        {/* Top-right: Onboarding steps */}
        <motion.div
          initial={{ opacity: 0, x: 30, y: -10 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 0.65, delay: 0.45 }}
          className="pcp-float-d"
          style={{ position: 'absolute', right: 0, top: 20, zIndex: 20, width: 190 }}
        >
          <OnboardingMiniSteps />
        </motion.div>

        {/* Bottom-right: Wait time */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.72 }}
          className="pcp-float-e"
          style={{ position: 'absolute', right: 0, bottom: 20, zIndex: 20, width: 160 }}
        >
          <WaitTimePill />
        </motion.div>
      </div>
    </div>
  )
}

// Hero: two-column grid (copy left, cards right) with navbar-offset top padding
function Hero() {
  return (
    <section
      aria-label="Primary Care Hero"
      style={{ background: 'linear-gradient(160deg, #eaf4ff 0%, #ddeeff 40%, #f0f8ff 100%)' }}
      className="relative w-full overflow-x-hidden pt-28 pb-24 md:pt-32 md:pb-28"
    >
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle, #bfdbfe 0%, transparent 70%)', filter: 'blur(70px)', opacity: 0.5 }} />
        <div style={{ position: 'absolute', bottom: '-100px', left: '-80px', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, #e0f2fe 0%, transparent 70%)', filter: 'blur(60px)', opacity: 0.4 }} />
      </div>

      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Two-column grid: copy left, cards right. Single column on mobile. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-center">
          <HeroLeft />
          <HeroRight />
        </div>
      </div>
    </section>
  )
}

// ─── 2. About Primary Care ────────────────────────────────────────────────────
// FIX: backdrop now uses CSS classes (pcp-about-backdrop) instead of
//      Tailwind negative-inset shorthands that were expanding the grid cell.
function AboutLeft() {
  // FIX: tile hover style extracted so it isn't a new object each render
  const tileStyle = useMemo(() => ({ boxShadow: '0 4px 20px rgba(37,99,235,0.08)' }), [])

  return (
    <FadeIn direction="left">
      {/* FIX: isolation + overflow via CSS class; no more negative Tailwind insets
               fighting the grid layout */}
      <div className="pcp-about-left-wrapper px-2 pt-2 pb-10 sm:px-3 sm:pb-12">
        <div className="pcp-about-backdrop" aria-hidden="true" />

        <div className="relative grid grid-cols-2 gap-3 sm:gap-4 max-w-sm mx-auto md:max-w-none">
          {ABOUT_GRID.map((tile, i) => (
            <motion.div
              key={tile.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="flex flex-col items-center gap-3 rounded-2xl border border-blue-100/90 bg-white px-4 py-6 text-center cursor-default sm:px-5 sm:py-7"
              style={tileStyle}
            >
              <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br ${tile.color} flex items-center justify-center shadow-md`}>
                <tile.icon size={22} className="text-white" />
              </div>
              <p className="font-bold text-sm text-slate-800">{tile.label}</p>
            </motion.div>
          ))}
        </div>

        {/* 24/7 badge — z-20 is contained inside this stacking context */}
        <div
          className="absolute -bottom-3 -right-3 z-20 flex h-16 w-16 items-center justify-center rounded-2xl sm:-bottom-4 sm:-right-4 sm:h-20 sm:w-20"
          style={{ background: GRAD_BLUE, boxShadow: '0 8px 28px rgba(37,99,235,0.35)' }}
          aria-hidden="true"
        >
          <div className="text-center">
            <p className="text-white text-base sm:text-xl font-black leading-none">24/7</p>
            <p className="text-white/75 text-[9px] sm:text-[10px] font-medium">Access</p>
          </div>
        </div>
      </div>
    </FadeIn>
  )
}

function AboutRight() {
  return (
    <div className="space-y-8 min-w-0">
      <FadeIn>
        <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">What Is Primary Care?</span>
        <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2 leading-tight">
          Your First Line of Defense<br />for Lifelong Health
        </h2>
        <p className="text-slate-500 leading-relaxed mt-4">
          A primary care physician (PCP) is your main healthcare partner — the doctor you see
          for routine visits, preventive care, and when you&apos;re not feeling well. They
          coordinate all aspects of your medical care and refer you to specialists when needed.
        </p>
        <p className="text-slate-500 leading-relaxed mt-3">
          Studies show people with a regular PCP have better health outcomes, lower medical
          costs, and longer lives. Yet millions of Americans lack access to one. That&apos;s
          exactly the gap HumanCare Connect was built to close.
        </p>
      </FadeIn>

      <div className="grid sm:grid-cols-2 gap-3">
        {ABOUT_FEATURES.map((feature, i) => (
          <FadeIn key={feature.title} delay={i * 0.08}>
            {/* FIX: `pcp-transition` replaces `transition-all duration-200` */}
            <div className="flex gap-3 p-4 rounded-xl hover:bg-blue-50/60 pcp-transition group cursor-default">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 pcp-transition">
                <feature.icon size={18} className="text-blue-600 group-hover:text-white pcp-transition" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">{feature.title}</p>
                <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{feature.desc}</p>
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
    <section id="about" aria-label="About Primary Care" className="w-full py-20 md:py-24 bg-white overflow-x-hidden">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-start">
          <AboutLeft />
          <AboutRight />
        </div>
      </div>
    </section>
  )
}

// ─── 3. How It Works ─────────────────────────────────────────────────────────
function HowItWorks() {
  return (
    <section id="how-it-works" aria-label="How It Works" style={{ background: '#f8fafc' }} className="w-full py-20 md:py-24">
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        <FadeIn className="text-center mb-14">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Simple Process</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2">
            Your First Visit, Step by Step
          </h2>
          <p className="text-slate-500 mt-3 max-w-xl mx-auto">
            From sign-up to care in minutes. No referrals, no lengthy waits, no insurance required.
          </p>
        </FadeIn>

        {/* Mobile: vertical list */}
        <div className="block md:hidden space-y-4">
          {HOW_IT_WORKS_STEPS.map((step, i) => (
            <FadeIn key={step.title} delay={i * 0.08}>
              <div className="flex gap-4 bg-white rounded-2xl p-5" style={{ boxShadow: '0 4px 20px rgba(37,99,235,0.08)' }}>
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center flex-shrink-0 shadow-md`}>
                  <step.icon size={20} className="text-white" />
                </div>
                <div>
                  <span className={`text-[10px] font-bold uppercase tracking-widest bg-gradient-to-r ${step.color} bg-clip-text text-transparent`}>
                    Step {i + 1}
                  </span>
                  <h3 className="font-bold text-slate-800 text-sm mt-0.5">{step.title}</h3>
                  <p className="text-slate-500 text-xs mt-1 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Desktop: alternating timeline */}
        <div className="hidden md:block" style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute',
            left: '50%', top: 24, bottom: 24,
            width: 2,
            transform: 'translateX(-50%)',
            background: 'linear-gradient(to bottom,#bfdbfe,#bae6fd,#e9d5ff)',
            borderRadius: 99,
            zIndex: 0,
          }} aria-hidden="true" />

          {HOW_IT_WORKS_STEPS.map((step, i) => {
            const isLeft = i % 2 === 0
            return (
              <FadeIn key={step.title} delay={i * 0.1}>
                <div style={{
                  position: 'relative',
                  display: 'grid',
                  gridTemplateColumns: '1fr 56px 1fr',
                  alignItems: 'center',
                  marginBottom: i < HOW_IT_WORKS_STEPS.length - 1 ? 32 : 0,
                  minHeight: 80,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: 28 }}>
                    {isLeft && (
                      <motion.div
                        initial={{ opacity: 0, x: -32 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.55, delay: i * 0.1 }}
                        className="bg-white rounded-2xl p-5 w-full pcp-card-lift"
                        style={{ boxShadow: '0 4px 24px rgba(37,99,235,0.09)', textAlign: 'right', maxWidth: 280 }}
                      >
                        <span className={`text-[10px] font-bold uppercase tracking-widest bg-gradient-to-r ${step.color} bg-clip-text text-transparent`}>
                          Step {i + 1}
                        </span>
                        <h3 className="font-bold text-slate-800 text-sm mt-1">{step.title}</h3>
                        <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">{step.desc}</p>
                      </motion.div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', zIndex: 10, position: 'relative' }}>
                    <motion.div
                      whileInView={{ scale: [0.5, 1.2, 1] }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.45, delay: i * 0.1 }}
                      className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg`}
                      aria-hidden="true"
                    >
                      <step.icon size={20} className="text-white" />
                    </motion.div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-start', paddingLeft: 28 }}>
                    {!isLeft && (
                      <motion.div
                        initial={{ opacity: 0, x: 32 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.55, delay: i * 0.1 }}
                        className="bg-white rounded-2xl p-5 w-full pcp-card-lift"
                        style={{ boxShadow: '0 4px 24px rgba(37,99,235,0.09)', maxWidth: 280 }}
                      >
                        <span className={`text-[10px] font-bold uppercase tracking-widest bg-gradient-to-r ${step.color} bg-clip-text text-transparent`}>
                          Step {i + 1}
                        </span>
                        <h3 className="font-bold text-slate-800 text-sm mt-1">{step.title}</h3>
                        <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">{step.desc}</p>
                      </motion.div>
                    )}
                  </div>
                </div>
              </FadeIn>
            )
          })}
        </div>

        <FadeIn className="text-center mt-12">
          <a
            href="/get-started"
            className="inline-flex items-center gap-2 text-white font-semibold px-8 py-3.5 rounded-full pcp-card-lift"
            style={{ background: GRAD_BLUE, boxShadow: '0 8px 24px -4px rgba(37,99,235,0.4)' }}
          >
            Get Started Now <ArrowRight size={16} />
          </a>
          <p className="text-slate-400 text-xs mt-3">No insurance required · Cancel anytime</p>
        </FadeIn>
      </div>
    </section>
  )
}

// ─── 4. Services ──────────────────────────────────────────────────────────────
// FIX: replaced Tailwind responsive grid classes with `pcp-services-grid` CSS
//      class that uses auto-fill columns — no orphan card at any breakpoint.
function Services() {
  return (
    <section id="services" aria-label="Services" className="w-full py-20 md:py-24 bg-white">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn className="text-center mb-14">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">What&apos;s Included</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2">Services Under Primary Care</h2>
          <p className="text-slate-500 mt-3 max-w-xl mx-auto">Everything you need to maintain your health — all in one place.</p>
        </FadeIn>

        {/* FIX: `.pcp-services-grid` from PCP.css replaces the brittle
                 xl:grid-cols-5 that left an orphan card at lg breakpoint */}
        <div className="pcp-services-grid">
          {SERVICES.map((service, i) => (
            <FadeIn key={service.title} delay={i * 0.04}>
              <motion.div
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="group bg-white rounded-2xl p-5 border border-slate-100 hover:border-blue-100 pcp-transition cursor-pointer h-full"
                style={{ boxShadow: '0 4px 20px rgba(37,99,235,0.06)' }}
              >
                <div className="w-11 h-11 rounded-xl bg-blue-50 group-hover:bg-blue-600 flex items-center justify-center mb-4 pcp-transition flex-shrink-0">
                  <service.icon size={20} className="text-blue-600 group-hover:text-white pcp-transition" />
                </div>
                <h3 className="font-semibold text-slate-800 text-sm leading-snug mb-1.5">{service.title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{service.desc}</p>
              </motion.div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── 5. FAQ ───────────────────────────────────────────────────────────────────
// FIX: Added aria-controls / id pairing, aria-expanded, and descriptive
//      aria-label on the chevron button so screen readers understand the toggle.
function FAQ() {
  const [openIndex, setOpenIndex] = useState(null)

  return (
    <section id="faq" aria-label="Frequently Asked Questions" className="w-full py-20 md:py-24 bg-slate-50">
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn className="text-center mb-14">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Frequently Asked</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2">Got Questions?</h2>
          <p className="text-slate-500 mt-3">Everything you need to know about primary care and HumanCare Connect.</p>
        </FadeIn>

        <div className="space-y-3">
          {FAQS.map((faq, i) => {
            const isOpen = openIndex === i
            const panelId = `faq-panel-${i}`
            const btnId   = `faq-btn-${i}`

            return (
              <FadeIn key={faq.q} delay={i * 0.04}>
                <div
                  className="rounded-2xl border pcp-transition overflow-hidden bg-white"
                  style={{
                    borderColor: isOpen ? '#bfdbfe' : '#e2e8f0',
                    boxShadow:   isOpen ? '0 4px 24px rgba(37,99,235,0.08)' : 'none',
                  }}
                >
                  <button
                    id={btnId}
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="w-full flex items-center justify-between p-5 text-left gap-4"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                  >
                    <span className="font-semibold text-slate-800 text-sm leading-snug">{faq.q}</span>
                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.25 }}
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: isOpen ? '#2563eb' : '#f1f5f9' }}
                      aria-hidden="true"
                    >
                      <ChevronDown size={15} className={isOpen ? 'text-white' : 'text-slate-500'} />
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
                        style={{ overflow: 'hidden' }}
                      >
                        <div className="px-5 pb-5 text-slate-500 text-sm leading-relaxed border-t border-slate-100 pt-4">
                          {faq.a}
                        </div>
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

// ─── 6. CTA ───────────────────────────────────────────────────────────────────
// FIX: trust points replaced flex-wrap with `pcp-cta-trust` grid class
//      for consistent 2-col layout on mobile, single row on sm+.
function CTA() {
  return (
    <section
      aria-label="Call to Action"
      className="w-full py-20 md:py-24 overflow-hidden relative"
      style={{ background: 'linear-gradient(135deg,#1d4ed8 0%,#1e40af 40%,#0369a1 100%)' }}
    >
      <div className="absolute top-0 left-0 w-80 h-80 rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle,#bfdbfe,transparent)', filter: 'blur(50px)' }}
        aria-hidden="true"
      />
      <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle,#e0f2fe,transparent)', filter: 'blur(50px)' }}
        aria-hidden="true"
      />

      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <FadeIn>
          <div className="inline-flex items-center gap-2 bg-white/20 text-white text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" aria-hidden="true" />
            Ready to Get Started?
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight mb-5">
            Ready to Find Your<br />Primary Care Provider?
          </h2>
          <p className="text-white/80 text-base md:text-lg leading-relaxed mb-10 max-w-xl mx-auto">
            Get connected with trusted, licensed healthcare professionals and receive the care you need —
            without the wait, without the confusion.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <motion.a
              href="/get-started"
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 bg-white font-bold px-8 py-4 rounded-full shadow-xl hover:shadow-2xl pcp-transition text-sm w-full sm:w-auto justify-center"
              style={{ color: '#1d4ed8' }}
            >
              Get Started Today <ArrowRight size={16} />
            </motion.a>
            <motion.a
              href="/find-provider"
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-8 py-4 rounded-full border border-white/30 hover:bg-white/20 pcp-transition text-sm w-full sm:w-auto justify-center"
            >
              <Phone size={16} /> Find a Provider
            </motion.a>
          </div>

          {/* FIX: replaced flex-wrap with pcp-cta-trust grid for clean mobile layout */}
          <div className="pcp-cta-trust">
            {CTA_TRUST_POINTS.map(point => (
              <div key={point.text} className="flex items-center gap-2 text-white/80 text-xs font-medium">
                <point.icon size={14} className="text-white flex-shrink-0" aria-hidden="true" />
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
    <main className="pcp-root w-full block">
      <Hero />
      <AboutPrimaryCare />
      <HowItWorks />
      <Services />
      <FAQ />
      <CTA />
    </main>
  )
}