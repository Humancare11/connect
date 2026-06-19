import { useState, useRef } from 'react'
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

// ─── FadeIn ──────────────────────────────────────────────────────────────────
function FadeIn({ children, delay = 0, direction = 'up', className = '' }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })
  const variants = {
    hidden: {
      opacity: 0,
      y: direction === 'up' ? 32 : direction === 'down' ? -32 : 0,
      x: direction === 'left' ? 32 : direction === 'right' ? -32 : 0,
    },
    visible: { opacity: 1, y: 0, x: 0 },
  }
  return (
    <motion.div
      ref={ref}
      variants={variants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─── Data ────────────────────────────────────────────────────────────────────
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

// ─── Shared styles ────────────────────────────────────────────────────────────
// Reusable glass-card treatment, expressed as Tailwind utilities (incl. an
// arbitrary box-shadow value) instead of an inline style object, so it can be
// composed via className on any element.
const GLASS_CARD_CLASS =
  'bg-white/90 backdrop-blur-md border border-white/90 shadow-[0_8px_32px_rgba(37,99,235,0.12)]'

// ─── Hero sub-components ─────────────────────────────────────────────────────
// Each card below is rendered twice by <Hero />: once in the simple, stacked
// mobile/tablet layout (normal document flow — nothing can ever overlap) and
// once inside the absolutely-positioned desktop "floating" composition.
// Keeping them as standalone components avoids duplicating markup between
// the two layouts.

function ProviderCard({ floating = true }) {
  return (
    <div
      className={`${GLASS_CARD_CLASS} mx-auto w-[220px] rounded-3xl p-1 ${
        floating ? '[animation:pcpFloat_4s_ease-in-out_infinite]' : ''
      }`}
    >
      <div
        className="relative flex h-40 items-center justify-center overflow-hidden rounded-[20px]"
        style={{ background: 'linear-gradient(135deg,#2563eb 0%,#38bdf8 100%)' }}
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
}

function SocialProofBadge() {
  return (
    <div
      className="w-full rounded-2xl px-3.5 py-2.5"
      style={{ background: 'linear-gradient(135deg,#2563eb 0%,#38bdf8 100%)', boxShadow: '0 8px 28px rgba(37,99,235,0.35)' }}
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
}

function HealthStatusCard() {
  return (
    <div className={`${GLASS_CARD_CLASS} w-full rounded-2xl p-3`}>
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
}

function OnboardingMiniSteps() {
  return (
    <div className={`${GLASS_CARD_CLASS} w-full rounded-2xl px-3.5 py-3`}>
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
      <p className="mt-2 text-[10px] text-slate-400">{ONBOARDING_STEPS.map(s => s.t).join(' → ')}</p>
    </div>
  )
}

function WaitTimePill() {
  return (
    <div className={`${GLASS_CARD_CLASS} flex w-full items-center gap-2.5 rounded-2xl px-3.5 py-2`}>
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
        <Clock size={13} className="text-blue-600" />
      </div>
      <div>
        <p className="text-[10px] text-slate-400">Wait time</p>
        <p className="text-xs font-bold text-slate-800">Under 15 min</p>
      </div>
    </div>
  )
}

// ─── 1. Hero ──────────────────────────────────────────────────────────────────
// Split into two explicit halves — HeroLeft (copy) and HeroRight (visual) —
// composed side by side by <Hero /> via a two-column grid at lg+, and
// stacked top-to-bottom below that.

function HeroLeft() {
  return (
    <div className="space-y-6 text-center lg:text-left">
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
          <span style={{ backgroundImage: 'linear-gradient(135deg,#2563eb 0%,#0ea5e9 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
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
          <a href="#" className="inline-flex items-center gap-2 text-white font-semibold px-6 py-3 rounded-full text-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
            style={{ background: 'linear-gradient(135deg,#2563eb 0%,#0ea5e9 100%)', boxShadow: '0 8px 24px -4px rgba(37,99,235,0.4)' }}>
            Get Started <ArrowRight size={15} />
          </a>
          <a href="#how-it-works" className="inline-flex items-center gap-2 bg-white text-blue-600 font-semibold px-6 py-3 rounded-full shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 border border-blue-100 text-sm">
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
    // Two distinct layouts on purpose, not one layout that scales down: the
    // desktop version is a deliberately art-directed floating arrangement
    // with absolute positioning, which only ever has room to breathe at lg+
    // widths. Below that, the cards switch to plain stacked flow —
    // guaranteed never to overlap, on any screen.
    <div className="relative">

      {/* Mobile / tablet */}
      <div className="lg:hidden max-w-[280px] sm:max-w-xs mx-auto space-y-4">
        <FadeIn delay={0.15}>
          <ProviderCard floating={false} />
        </FadeIn>
        <FadeIn delay={0.25}>
          <div className="grid grid-cols-2 gap-3">
            <SocialProofBadge />
            <WaitTimePill />
          </div>
        </FadeIn>
        <FadeIn delay={0.32}>
          <HealthStatusCard />
        </FadeIn>
      </div>

      {/* Desktop — fixed-width composition so spacing between cards
          (and therefore the no-overlap guarantee below) holds at every
          viewport from the lg breakpoint upward. */}
      <div className="hidden lg:flex relative items-center justify-center mx-auto w-[440px] min-h-[480px]">

        <motion.div
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10"
        >
          <ProviderCard />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -30, y: -10 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 0.65, delay: 0.55 }}
          className="absolute left-0 top-0 z-20 w-[130px] [animation:pcpFloatB_4s_ease-in-out_infinite_1.2s]"
        >
          <SocialProofBadge />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.65, delay: 0.65 }}
          className="absolute left-0 bottom-0 z-20 w-[165px] [animation:pcpFloatC_4s_ease-in-out_infinite_0.6s]"
        >
          <HealthStatusCard />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30, y: -10 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 0.65, delay: 0.45 }}
          className="absolute right-0 top-0 z-20 w-[190px] [animation:pcpFloatD_4s_ease-in-out_infinite_1.8s]"
        >
          <OnboardingMiniSteps />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.72 }}
          className="absolute right-0 bottom-3 z-20 w-[160px] [animation:pcpFloatB_4s_ease-in-out_infinite_2.4s]"
        >
          <WaitTimePill />
        </motion.div>
      </div>
    </div>
  )
}

function Hero() {
  return (
    <section
      style={{ background: 'linear-gradient(160deg, #eaf4ff 0%, #ddeeff 40%, #f0f8ff 100%)' }}
      className="relative overflow-hidden pt-20 pb-16 md:pt-24 md:pb-20"
    >
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle, #bfdbfe 0%, transparent 70%)', filter: 'blur(70px)', opacity: 0.5 }} />
        <div style={{ position: 'absolute', bottom: '-100px', left: '-80px', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, #e0f2fe 0%, transparent 70%)', filter: 'blur(60px)', opacity: 0.4 }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          <HeroLeft />
          <HeroRight />
        </div>
      </div>

      {/* Float keyframes */}
      <style>{`
        @keyframes pcpFloat  { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-10px)} }
        @keyframes pcpFloatB { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-7px)}  }
        @keyframes pcpFloatC { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-5px)}  }
        @keyframes pcpFloatD { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-8px)}  }
        @media (prefers-reduced-motion: reduce) {
          [class*="animation:"] { animation: none !important; }
        }
      `}</style>
    </section>
  )
}

// ─── 2. About Primary Care ────────────────────────────────────────────────────
// Split into AboutLeft (icon grid) and AboutRight (copy + feature list).
// The grid switches to two columns at md (768px) rather than lg (1024px) —
// at md, each column still has ~300px+ to work with, so the icon grid no
// longer has to sit stretched full-width across the awkward tablet range.
// Below md, AboutLeft is also capped to max-w-sm so the 2×2 tiles stay a
// compact, centered cluster instead of stretching edge to edge on phones.

function AboutLeft() {
  return (
    <FadeIn direction="right">
      <div className="relative px-2 pt-2 pb-9 sm:px-3 sm:pb-10">
        {/* Soft background plate — inset stays comfortably inside the
            section's own horizontal padding at every breakpoint */}
        <div
          className="absolute -inset-2 sm:-inset-3 lg:-inset-4 rounded-[28px] z-0"
          style={{ background: 'linear-gradient(135deg,#eff6ff 0%,#f0f9ff 100%)' }}
        />

        <div className="relative z-10 grid grid-cols-2 gap-3 sm:gap-4 max-w-sm mx-auto md:max-w-none">
          {ABOUT_GRID.map((tile, i) => (
            <motion.div
              key={tile.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="flex flex-col items-center gap-3 rounded-2xl border border-blue-100/90 bg-white px-4 py-6 text-center cursor-default sm:px-5 sm:py-7"
              style={{ boxShadow: '0 4px 20px rgba(37,99,235,0.08)' }}
            >
              <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br ${tile.color} flex items-center justify-center shadow-md`}>
                <tile.icon size={22} className="text-white" />
              </div>
              <p className="font-bold text-sm text-slate-800">{tile.label}</p>
            </motion.div>
          ))}
        </div>

        {/* 24/7 corner badge — smaller offsets on phones so it never sits
            flush against the viewport edge */}
        <div
          className="absolute -bottom-2 -right-2 z-20 flex h-16 w-16 items-center justify-center rounded-2xl sm:-bottom-3 sm:-right-3 sm:h-20 sm:w-20"
          style={{ background: 'linear-gradient(135deg,#2563eb 0%,#0ea5e9 100%)', boxShadow: '0 8px 28px rgba(37,99,235,0.35)' }}
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
    <div className="space-y-8">
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
            <div className="flex gap-3 p-4 rounded-xl hover:bg-blue-50/60 transition-colors duration-200 group cursor-default">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 transition-colors duration-200">
                <feature.icon size={18} className="text-blue-600 group-hover:text-white transition-colors duration-200" />
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
    <section id="about" className="py-20 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          <AboutLeft />
          <AboutRight />
        </div>
      </div>
    </section>
  )
}

// ─── 3. How It Works (responsive timeline) ───────────────────────────────────
function HowItWorks() {
  return (
    <section id="how-it-works" style={{ background: '#f8fafc' }} className="py-20 md:py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <FadeIn className="text-center mb-14">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Simple Process</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2">
            Your First Visit, Step by Step
          </h2>
          <p className="text-slate-500 mt-3 max-w-xl mx-auto">
            From sign-up to care in minutes. No referrals, no lengthy waits, no insurance required.
          </p>
        </FadeIn>

        {/* ── Mobile: vertical single-column list ── */}
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

        {/* ── Desktop: alternating timeline ── */}
        <div className="hidden md:block" style={{ position: 'relative' }}>
          {/* Centre spine */}
          <div style={{
            position: 'absolute',
            left: '50%', top: 24, bottom: 24,
            width: 2,
            transform: 'translateX(-50%)',
            background: 'linear-gradient(to bottom,#bfdbfe,#bae6fd,#e9d5ff)',
            borderRadius: 99,
            zIndex: 0,
          }} />

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
                  {/* Left slot */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: 28 }}>
                    {isLeft && (
                      <motion.div
                        initial={{ opacity: 0, x: -32 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.55, delay: i * 0.1 }}
                        className="bg-white rounded-2xl p-5 w-full hover:-translate-y-1 transition-all duration-300"
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

                  {/* Centre icon */}
                  <div style={{ display: 'flex', justifyContent: 'center', zIndex: 10, position: 'relative' }}>
                    <motion.div
                      whileInView={{ scale: [0.5, 1.2, 1] }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.45, delay: i * 0.1 }}
                      className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg`}
                    >
                      <step.icon size={20} className="text-white" />
                    </motion.div>
                  </div>

                  {/* Right slot */}
                  <div style={{ display: 'flex', justifyContent: 'flex-start', paddingLeft: 28 }}>
                    {!isLeft && (
                      <motion.div
                        initial={{ opacity: 0, x: 32 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.55, delay: i * 0.1 }}
                        className="bg-white rounded-2xl p-5 w-full hover:-translate-y-1 transition-all duration-300"
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

        {/* CTA */}
        <FadeIn className="text-center mt-12">
          <a href="#" className="inline-flex items-center gap-2 text-white font-semibold px-8 py-3.5 rounded-full transition-all duration-200 hover:-translate-y-1"
            style={{ background: 'linear-gradient(135deg,#2563eb 0%,#0ea5e9 100%)', boxShadow: '0 8px 24px -4px rgba(37,99,235,0.4)' }}>
            Get Started Now <ArrowRight size={16} />
          </a>
          <p className="text-slate-400 text-xs mt-3">No insurance required · Cancel anytime</p>
        </FadeIn>
      </div>
    </section>
  )
}

// ─── 4. Services ──────────────────────────────────────────────────────────────
function Services() {
  return (
    <section id="services" className="py-20 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn className="text-center mb-14">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">What&apos;s Included</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2">Services Under Primary Care</h2>
          <p className="text-slate-500 mt-3 max-w-xl mx-auto">Everything you need to maintain your health — all in one place.</p>
        </FadeIn>

        {/* Responsive grid: 1 col → 2 → 3 → 5 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {SERVICES.map((service, i) => (
            <FadeIn key={service.title} delay={i * 0.04}>
              <motion.div
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="group bg-white rounded-2xl p-5 border border-slate-100 hover:border-blue-100 transition-all duration-300 cursor-pointer h-full"
                style={{ boxShadow: '0 4px 20px rgba(37,99,235,0.06)' }}
              >
                <div className="w-11 h-11 rounded-xl bg-blue-50 group-hover:bg-blue-600 flex items-center justify-center mb-4 transition-colors duration-300 flex-shrink-0">
                  <service.icon size={20} className="text-blue-600 group-hover:text-white transition-colors duration-300" />
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
function FAQ() {
  const [openIndex, setOpenIndex] = useState(null)

  return (
    <section id="faq" className="py-20 md:py-24 bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn className="text-center mb-14">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Frequently Asked</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2">Got Questions?</h2>
          <p className="text-slate-500 mt-3">Everything you need to know about primary care and HumanCare Connect.</p>
        </FadeIn>

        <div className="space-y-3">
          {FAQS.map((faq, i) => {
            const isOpen = openIndex === i
            return (
              <FadeIn key={faq.q} delay={i * 0.04}>
                <div
                  className="rounded-2xl border transition-all duration-300 overflow-hidden bg-white"
                  style={{
                    borderColor: isOpen ? '#bfdbfe' : '#e2e8f0',
                    boxShadow: isOpen ? '0 4px 24px rgba(37,99,235,0.08)' : 'none',
                  }}
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="w-full flex items-center justify-between p-5 text-left gap-4"
                    aria-expanded={isOpen}
                  >
                    <span className="font-semibold text-slate-800 text-sm leading-snug">{faq.q}</span>
                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.25 }}
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: isOpen ? '#2563eb' : '#f1f5f9' }}
                    >
                      <ChevronDown size={15} className={isOpen ? 'text-white' : 'text-slate-500'} />
                    </motion.div>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
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
function CTA() {
  return (
    <section
      className="py-20 md:py-24 overflow-hidden relative"
      style={{ background: 'linear-gradient(135deg,#1d4ed8 0%,#1e40af 40%,#0369a1 100%)' }}
    >
      <div className="absolute top-0 left-0 w-80 h-80 rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle,#bfdbfe,transparent)', filter: 'blur(50px)' }} />
      <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle,#e0f2fe,transparent)', filter: 'blur(50px)' }} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <FadeIn>
          <div className="inline-flex items-center gap-2 bg-white/20 text-white text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
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
              href="#"
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 bg-white font-bold px-8 py-4 rounded-full shadow-xl hover:shadow-2xl transition-all duration-200 text-sm w-full sm:w-auto justify-center"
              style={{ color: '#1d4ed8' }}
            >
              Get Started Today <ArrowRight size={16} />
            </motion.a>
            <motion.a
              href="#"
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-8 py-4 rounded-full border border-white/30 hover:bg-white/20 transition-all duration-200 text-sm w-full sm:w-auto justify-center"
            >
              <Phone size={16} /> Find a Provider
            </motion.a>
          </div>

          {/* Trust points — wrap gracefully */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mt-10">
            {CTA_TRUST_POINTS.map(point => (
              <div key={point.text} className="flex items-center gap-2 text-white/80 text-xs font-medium">
                <point.icon size={14} className="text-white flex-shrink-0" />
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
    <div className="w-full">
      <Hero />
      <AboutPrimaryCare />
      <HowItWorks />
      <Services />
      <FAQ />
      <CTA />
    </div>
  )
}
