import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  Globe2,
  ArrowRight,
  ArrowLeft,
  Plane,
  Stethoscope,
  Brain,
  Activity,
  ClipboardPlus,
  Search,
  HeartPulse,
  Venus,
  Mars,
  Baby,
  ShieldCheck,
  Pill,
  Building2,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  MessageCircle,
  Clock,
  Lock,
  MapPin,
  Sparkles,
  Eye,
  Utensils,
} from "lucide-react";
import "./symptoms.css";
import SEO from "../components/Seo";

const previewSpecialties = [
  {
    name: "Primary Care",
    path: "/primary-care-provider",
    icon: Stethoscope,
    tags: ["Cold & Flu", "Fever"],
  },
  {
    name: "Urgent Care",
    path: "/urgent-care",
    icon: ClipboardPlus,
    tags: ["UTI", "Sore Throat"],
  },
  {
    name: "Mental Health",
    path: "/mental-health",
    icon: Brain,
    tags: ["Anxiety", "Depression"],
  },
  {
    name: "Chronic Care",
    path: "/chronic-care",
    icon: Activity,
    tags: ["Diabetes", "Hypertension"],
  },
];

const stats = [
  ["11", "Categories"],
  ["30", "Specialties"],
  ["140+", "Conditions"],
];

const heroSlides = [
  {
    sub: "Virtual care request",
    title: "Traveler needs consult",
    icon: Plane,
    rows: [
      ["Condition", "Food Poisoning While Traveling"],
      ["Need", "Telehealth consult + medical report"],
      ["Route", "English-speaking doctor"],
      ["Status", "Non-emergency triage"],
    ],
    activeIndex: 0,
  },
  {
    sub: "Virtual care request",
    title: "Patient needs urgent care",
    icon: ClipboardPlus,
    rows: [
      ["Condition", "UTI Symptoms Since Last Night"],
      ["Need", "Same-day telehealth consult"],
      ["Route", "Nearest available provider"],
      ["Status", "Non-emergency triage"],
    ],
    activeIndex: 1,
  },
  {
    sub: "Virtual care request",
    title: "Member needs support",
    icon: Brain,
    rows: [
      ["Condition", "Persistent Anxiety & Sleep Loss"],
      ["Need", "Mental health consult"],
      ["Route", "Licensed therapist match"],
      ["Status", "Routine triage"],
    ],
    activeIndex: 2,
  },
  {
    sub: "Virtual care request",
    title: "Patient needs refill review",
    icon: Activity,
    rows: [
      ["Condition", "Type 2 Diabetes Follow-Up"],
      ["Need", "Medication review + refill"],
      ["Route", "Chronic care specialist"],
      ["Status", "Routine triage"],
    ],
    activeIndex: 3,
  },
];

// ----------- Conditions--------

const conditionCategories = [
  {
    category: "Children & Family Care",
    icon: Baby,
    conditions: [
      {
        name: "Ear Pain Children",
        path: "/child-and-family-care/pediatrics/ear-pain-children",
      },
      {
        name: "Feeding Concerns",
        path: "/child-and-family-care/pediatrics/feeding-concerns",
      },
      {
        name: "Pediatrics Cold and Flu",
        path: "/child-and-family-care/pediatrics/pediatric-cold-flu",
      },
      {
        name: "Pediatrics Fever",
        path: "/child-and-family-care/pediatrics/pediatric-fever",
      },
      {
        name: "Skin Rash Children",
        path: "/child-and-family-care/pediatrics/skin-rash-in-children",
      },
      {
        name: "Mood & Anxiety in Teens",
        path: "/child-and-family-care/adolescent-medicine/mood-anxiety-teens",
      },
      {
        name: "Puberty Concerns",
        path: "/child-and-family-care/adolescent-medicine/puberty-concerns",
      },
      {
        name: "Sports Injuries",
        path: "/child-and-family-care/adolescent-medicine/sports-injuries",
      },
    ],
  },
  {
    category: "Chronic Care & Expert Opinion",
    icon: Activity,
    conditions: [
      {
        name: "High Blood Pressure",
        path: "/chronic-care/cardiology/high-blood-pressure",
      },
      {
        name: "Chest Pain (Non-Emergency)",
        path: "/chronic-care/cardiology/chest-pain",
      },
      { name: "Palpitations", path: "/chronic-care/cardiology/palpitations" },
      {
        name: "High Cholesterol",
        path: "/chronic-care/cardiology/high-cholesterol",
      },
      {
        name: "Heart Disease Follow-Up",
        path: "/chronic-care/cardiology/heart-disease-follow-up",
      },
      {
        name: "Pre-Op Cardiac Clearance",
        path: "/chronic-care/cardiology/pre-op-cardiac-clearance",
      },
      {
        name: "Thyroid Disorders",
        path: "/chronic-care/endocrinology/thyroid-disorders",
      },
      {
        name: "Diabetes Type 2",
        path: "/chronic-care/endocrinology/type-2-diabetes",
      },
      {
        name: "Hormone Imbalance",
        path: "/chronic-care/endocrinology/hormone-imbalance",
      },
      {
        name: "Osteoporosis",
        path: "/chronic-care/endocrinology/osteoporosis",
      },
      {
        name: "Cancer Second Opinion",
        path: "/online-second-medical-opinion/cancer-second-opinion",
      },
      {
        name: "Surgery Second Opinion",
        path: "/online-second-medical-opinion/surgery-second-opinion",
      },
      {
        name: "Complex-Diagnosis Review",
        path: "/online-second-medical-opinion/complex-diagnosis-review",
      },
      {
        name: "Treatment-Plan Review",
        path: "/online-second-medical-opinion/treatment-plan-review",
      },
      { name: "Second Medical Opinion", path: "/second-medical-opinion" },
      {
        name: "Acid Reflux / GERD",
        path: "/chronic-care/gastroenterology/acid-reflux-gerd",
      },
      {
        name: "IBS",
        path: "/chronic-care/gastroenterology/irritable-bowel-syndrome",
      },
      {
        name: "Constipation",
        path: "/chronic-care/gastroenterology/constipation",
      },
      {
        name: "Abdominal Pain",
        path: "/chronic-care/gastroenterology/abdominal-pain",
      },
      { name: "Bloating", path: "/chronic-care/gastroenterology/bloating" },
      {
        name: "Fatty Liver Follow-Up",
        path: "/chronic-care/gastroenterology/fatty-liver",
      },
      {
        name: "Migraine",
        path: "/chronic-care/neurology/migraine",
      },
      {
        name: "Chronic Migraine",
        path: "/chronic-care/neurology/chronic-migraine",
      },
      {
        name: "Seizures / Epilepsy Follow-Up",
        path: "/chronic-care/neurology/seizures-epilepsy-follow-up",
      },
      {
        name: "Numbness & Tingling",
        path: "/chronic-care/neurology/numbness-and-tingling",
      },
      { name: "Tremor", path: "/chronic-care/neurology/tremor" },
      { name: "Dizziness", path: "/chronic-care/neurology/dizziness" },
      {
        name: "Memory Concerns",
        path: "/chronic-care/neurology/memory-concerns",
      },
      { name: "Asthma", path: "/chronic-care/pulmonology/asthma" },
      { name: "COPD", path: "/chronic-care/pulmonology/copd" },
      {
        name: "Persistent Cough",
        path: "/chronic-care/pulmonology/persistent-cough",
      },
      {
        name: "Shortness of Breath",
        path: "/chronic-care/pulmonology/shortness-of-breath",
      },
      {
        name: "Sleep Apnea Screening",
        path: "/chronic-care/pulmonology/sleep-apnea-screening",
      },
      {
        name: "Post-COVID Concerns",
        path: "/chronic-care/pulmonology/post-covid-concerns",
      },
    ],
  },
  {
    category: "General & Everyday Care",
    icon: ClipboardPlus,
    conditions: [
      {
        name: "Routine Check-Ups",
        path: "/general-and-everyday-care/family-medicine/routine-check-ups",
      },
      {
        name: "Whole-Family Illnesses",
        path: "/general-and-everyday-care/family-medicine/whole-family-illnesses",
      },
      {
        name: "Vaccination Advice",
        path: "/general-and-everyday-care/family-medicine/vaccination-advice",
      },
      {
        name: "Undiagnosed Symptoms",
        path: "/general-and-everyday-care/internal-medicine/undiagnosed-symptoms",
      },
      {
        name: "Multi-System Complaints",
        path: "/general-and-everyday-care/internal-medicine/multi-system-complaints",
      },
      {
        name: "Preventive Screening",
        path: "/general-and-everyday-care/internal-medicine/preventive-screening",
      },
      {
        name: "Medication Review",
        path: "/general-and-everyday-care/internal-medicine/medication-review",
      },
      {
        name: "Fever",
        path: "/general-and-everyday-care/general-physician/fever",
      },
      {
        name: "Cold & Flu",
        path: "/general-and-everyday-care/general-physician/cold-and-flu",
      },
      {
        name: "Cough",
        path: "/general-and-everyday-care/general-physician/cough",
      },
      {
        name: "Body Aches",
        path: "/general-and-everyday-care/general-physician/body-aches",
      },
      {
        name: "Headache",
        path: "/general-and-everyday-care/general-physician/headache",
      },
      {
        name: "Sinus Infection",
        path: "/general-and-everyday-care/general-physician/sinus-infection",
      },
      {
        name: "Minor Infections",
        path: "/general-and-everyday-care/general-physician/minor-infections",
      },
      {
        name: "Fatigue",
        path: "/general-and-everyday-care/general-physician/fatigue",
      },
      {
        name: "Nausea & Vomiting",
        path: "/general-and-everyday-care/general-physician/nausea-and-vomiting",
      },
      {
        name: "Pink Eye",
        path: "/general-and-everyday-care/general-physician/pink-eye",
      },
    ],
  },
  {
    category: "Eye, Ear & Bone",
    icon: Eye,
    conditions: [
      { name: "Eye Redness", path: "/eye-ear-bone/ophthalmology/eye-redness" },
      { name: "Dry Eyes", path: "/eye-ear-bone/ophthalmology/dry-eyes" },
      {
        name: "Vision Changes",
        path: "/eye-ear-bone/ophthalmology/vision-changes",
      },
      {
        name: "Eye Irritation",
        path: "/eye-ear-bone/ophthalmology/eye-irritation",
      },
      { name: "Stye", path: "/eye-ear-bone/ophthalmology/stye" },
      { name: "Eye-Strain", path: "/eye-ear-bone/ophthalmology/eye-strain" },
      { name: "Back Pain", path: "/eye-ear-bone/orthopedics/back-pain" },
      { name: "Neck Pain", path: "/eye-ear-bone/orthopedics/neck-pain" },
      { name: "Knee Pain", path: "/eye-ear-bone/orthopedics/knee-pain" },
      {
        name: "Muscle Strains",
        path: "/eye-ear-bone/orthopedics/muscle-strain",
      },
      {
        name: "Osteoarthritis",
        path: "/eye-ear-bone/orthopedics/osteoarthritis",
      },
      { name: "Arthritis Advice", path: "/eye-ear-bone/orthopedics/arthritis" },
      { name: "Ear Pain", path: "/eye-ear-bone/ear-nose-throat/ear-pain" },
      {
        name: "Sore Throat",
        path: "/eye-ear-bone/ear-nose-throat/sore-throat",
      },
      {
        name: "Ear Infections",
        path: "/eye-ear-bone/ear-nose-throat/ear-infection",
      },
      { name: "Vertigo", path: "/eye-ear-bone/ear-nose-throat/vertigo" },
      {
        name: "Nasal Congestion",
        path: "/eye-ear-bone/ear-nose-throat/nasal-congestion",
      },
      { name: "Hoarseness", path: "/eye-ear-bone/ear-nose-throat/hoarseness" },
      {
        name: "Tonsillitis",
        path: "/eye-ear-bone/ear-nose-throat/tonsillitis",
      },
    ],
  },
  {
    category: "Men's Health",
    icon: Mars,
    conditions: [
      {
        name: "Erectile Dysfunction",
        path: "/mens-health/men-health/erectile-dysfunction",
      },
      {
        name: "Low Testosterone",
        path: "/mens-health/men-health/low-testosterone-symptoms",
      },
      {
        name: "Hair Loss in men",
        path: "/mens-health/men-health/hair-loss",
      },
      {
        name: "Prostate Health",
        path: "/mens-health/men-health/prostate-health",
      },
      { name: "Low Libido", path: "/mens-health/men-health/low-libido" },
      {
        name: "Urinary Tract Infections",
        path: "/mens-health/urology/urinary-tract-infection",
      },
      { name: "Kidney Stones", path: "/mens-health/urology/kidney-stones" },
      { name: "Blood in Urine", path: "/mens-health/urology/blood-in-urine" },
      {
        name: "Urinary Incontinence",
        path: "/mens-health/urology/urinary-incontinence",
      },
      {
        name: "Bladder Problems",
        path: "/mens-health/urology/bladder-problems",
      },
    ],
  },
  {
    category: "Mental Health",
    icon: Brain,
    conditions: [
      {
        name: "Anger Management",
        path: "/mental-health/behavioral-health/anger-management",
      },
      {
        name: "Adjustment Difficulties",
        path: "/mental-health/behavioral-health/adjustment-difficulties",
      },
      {
        name: "Substance-Use Concerns",
        path: "/mental-health/behavioral-health/substance-use-support",
      },
      {
        name: "Sleep-Related Anxiety",
        path: "/mental-health/behavioral-health/sleep-related-anxiety",
      },
      { name: "Anxiety", path: "/mental-health/psychiatry/anxiety" },
      { name: "Depression", path: "/mental-health/psychiatry/depression" },
      {
        name: "Bipolar Disorder Follow-Up",
        path: "/mental-health/psychiatry/bipolar-disorder-follow-up",
      },
      { name: "OCD", path: "/mental-health/psychiatry/ocd" },
      {
        name: "PTSD",
        path: "/mental-health/psychiatry/ptsd",
      },
      {
        name: "Panic Attacks",
        path: "/mental-health/psychiatry/panic-attacks",
      },
      { name: "Insomnia", path: "/mental-health/psychiatry/insomnia" },
      {
        name: "ADHD (Assessment & Follow-Up)",
        path: "/mental-health/psychiatry/adhd-evaluation",
      },
      { name: "Stress", path: "/mental-health/psychology-counseling/stress" },
      {
        name: "Grief & Loss",
        path: "/mental-health/psychology-counseling/grief-and-loss",
      },
      {
        name: "Relationship Issues",
        path: "/mental-health/psychology-counseling/relationship-stress",
      },
      {
        name: "Low Self-Esteem",
        path: "/mental-health/psychology-counseling/low-self-esteem",
      },
      {
        name: "Trauma Support",
        path: "/mental-health/psychology-counseling/trauma-support",
      },
    ],
  },
  {
    category: "Sexual Health",
    icon: ShieldCheck,
    conditions: [
      {
        name: "Chlamydia",
        path: "/sexual-health/sexual-health-and-wellness/chlamydia",
      },
      {
        name: "Gonorrhea",
        path: "/sexual-health/sexual-health-and-wellness/gonorrhea",
      },
      {
        name: "Herpes",
        path: "/sexual-health/sexual-health-and-wellness/herpes",
      },
      {
        name: "HIV Prevention Guidance",
        path: "/sexual-health/sexual-health-and-wellness/hiv-prevention-guidance",
      },
      {
        name: "Partner Exposure Concerns",
        path: "/sexual-health/sexual-health-and-wellness/partner-exposure-concerns",
      },
      {
        name: "Safe Sex Counseling",
        path: "/sexual-health/sexual-health-and-wellness/safe-sex-counseling",
      },
      {
        name: "STI Consultation",
        path: "/sexual-health/sexual-health-and-wellness/sti-consultation",
      },
    ],
  },
  {
    category: "Skin & Hair",
    icon: Sparkles,
    conditions: [
      { name: "Acne", path: "/skin-and-hair-care/dermatology/acne" },
      { name: "Eczema", path: "/skin-and-hair-care/dermatology/eczema" },
      { name: "Psoriasis", path: "/skin-and-hair-care/dermatology/psoriasis" },
      {
        name: "Skin Rashes",
        path: "/skin-and-hair-care/dermatology/skin-rash",
      },
      { name: "Hives", path: "/skin-and-hair-care/dermatology/hives" },
      { name: "Rosacea", path: "/skin-and-hair-care/dermatology/rosacea" },
      {
        name: "Fungal Infections",
        path: "/skin-and-hair-care/dermatology/fungal-skin-infection",
      },
      { name: "Warts", path: "/skin-and-hair-care/dermatology/warts" },
      {
        name: "Cold Sores",
        path: "/skin-and-hair-care/dermatology/cold-sores",
      },
      { name: "Hair Loss", path: "/skin-and-hair-care/dermatology/hair-loss" },
      {
        name: "Nail Problems",
        path: "/skin-and-hair-care/dermatology/nail-problems",
      },
      {
        name: "Mole & Skin Checks",
        path: "/skin-and-hair-care/dermatology/mole-skin-checks",
      },
    ],
  },
  {
    category: "Travel & Global Care",
    icon: Plane,
    conditions: [
      {
        name: "Pre-Travel Vaccination",
        path: "/travel-and-global-care/travel-medicine/pre-travel-vaccinations",
      },
      {
        name: "Malaria Prevention",
        path: "/travel-and-global-care/travel-medicine/malaria-prevention",
      },
      {
        name: "Altitude-Sickness Guidance",
        path: "/travel-and-global-care/travel-medicine/altitude-sickness",
      },
      {
        name: "Post-Travel Symptoms",
        path: "/travel-and-global-care/travel-medicine/post-travel-symptoms",
      },
      {
        name: "Traveler's Diarrhea",
        path: "/travel-and-global-care/travel-medicine/travelers-diarrhea",
      },
      {
        name: "Food Poisoning While Traveling",
        path: "/travel-and-global-care/travel-medicine/food-poisoning-while-traveling",
      },
      {
        name: "Travel-Related Fever",
        path: "/travel-and-global-care/travel-medicine/travel-related-fever",
      },
      {
        name: "Cross-Border Consultation",
        path: "/travel-and-global-care/global-cross-border-care/cross-border-consultation",
      },
      {
        name: "International Medical Assistance",
        path: "/travel-and-global-care/global-cross-border-care/international-medical-assistance",
      },
      {
        name: "Medication Refill While Traveling",
        path: "travel-and-global-care/global-cross-border-care/medication-refill-while-traveling",
      },
      {
        name: "Referral Coordination Overseas",
        path: "/travel-and-global-care/global-cross-border-care/referral-coordination-overseas",
      },
    ],
  },
  {
    category: "Weight & Nutrition",
    icon: Utensils,
    conditions: [
      {
        name: "Healthy-Habit Coaching",
        path: "/weight-and-nurtrition/lifestyle-medicine/healthy-habit-coaching",
      },
      {
        name: "Diet & Exercise Planning",
        path: "/weight-and-nurtrition/lifestyle-medicine/diet-and-exercise-planning",
      },
      {
        name: "Sleep Hygiene",
        path: "/weight-and-nurtrition/lifestyle-medicine/sleep-hygiene",
      },
      {
        name: "Diabetic Diet",
        path: "/weight-and-nurtrition/nutrition-and-dietetics/diabetic-diet",
      },
      {
        name: "Cholesterol-Lowering Diet",
        path: "/weight-and-nurtrition/nutrition-and-dietetics/cholesterol-lowering-diet",
      },
      {
        name: "Food-Intolerance Planning",
        path: "/weight-and-nurtrition/nutrition-and-dietetics/food-intolerance-planning",
      },
      {
        name: "Pregnancy Nutrition",
        path: "/weight-and-nurtrition/nutrition-and-dietetics/pregnancy-nutrition",
      },
      {
        name: "Sports Nutrition",
        path: "/weight-and-nurtrition/nutrition-and-dietetics/sports-nutrition",
      },
      {
        name: "Obesity",
        path: "/weight-and-nurtrition/weight-management/obesity",
      },
      {
        name: "Weight-Loss Planning",
        path: "/weight-and-nurtrition/weight-management/weight-loss-planning",
      },
      {
        name: "Binge Eating",
        path: "/weight-and-nurtrition/weight-management/binge-eating",
      },
    ],
  },
  {
    category: "Women's Health",
    icon: Venus,
    conditions: [
      {
        name: "Low Milk Supply",
        path: "/women-health/lactation-consulting/low-milk-supply",
      },
      {
        name: "Latch Problems",
        path: "/women-health/lactation-consulting/latch-problems",
      },
      {
        name: "Nipple Pain",
        path: "/women-health/lactation-consulting/nipple-pain",
      },
      {
        name: "Weaning Guidance",
        path: "/women-health/lactation-consulting/weaning-guidance",
      },
      {
        name: "Hot Flashes",
        path: "/women-health/menopause-care/hot-flashes",
      },
      {
        name: "HRT Guidance",
        path: "/women-health/menopause-care/hrt-guidance",
      },
      {
        name: "Menopause Symptoms",
        path: "/women-health/menopause-care/hrt-guidance",
      },
      {
        name: "Irregular Periods",
        path: "/women-health/obstetrics-and-gynaecology/irregular-periods",
      },
      {
        name: "Birth Control",
        path: "/women-health/obstetrics-and-gynaecology/birth-control",
      },
      { name: "PCOS", path: "/women-health/obstetrics-and-gynaecology/pcos" },
      {
        name: "Bacterial Vaginosis",
        path: "/women-health/obstetrics-and-gynaecology/bacterial-vaginosis",
      },
      {
        name: "Menstrual Cramps",
        path: "/women-health/obstetrics-and-gynaecology/menstrual-cramps",
      },
      {
        name: "Pelvic Pain",
        path: "/women-health/obstetrics-and-gynaecology/pelvic-pain",
      },
      {
        name: "Prenatal Teleconsult",
        path: "/women-health/obstetrics-and-gynaecology/prenatal-consultation",
      },
      {
        name: "Fertility Concerns",
        path: "/women-health/obstetrics-and-gynaecology/fertility-concerns",
      },
    ],
  },
];

// ----------- Care section --------
const careFeatures = [
  {
    title: "Symptom Based Medical Guidance",
    desc: "Understand your symptoms and receive professional medical advice to help determine the appropriate next steps for your health.",
  },
  {
    title: "Personalized Healthcare Support",
    desc: "Connect with experienced healthcare professionals who provide recommendations based on your symptoms, medical history, and individual healthcare needs.",
  },
  {
    title: "Quick Access to Medical Advice",
    desc: "Consult a doctor online for symptoms and receive timely healthcare support for new, recurring, or ongoing health concerns.",
  },
  {
    title: "Expert Evaluation & Treatment Guidance",
    desc: "Receive professional insights, treatment recommendations, and support for managing a wide range of symptoms and medical conditions.",
  },
  {
    title: "Continuous Care & Follow-Up Support",
    desc: "Stay connected with healthcare professionals for ongoing guidance, symptom monitoring, and long-term health management.",
  },
  {
    title: "Secure & Convenient Online Doctor Consultation",
    desc: "Access trusted online doctor consultations from the comfort of your home through a private, secure, and patient-centered virtual healthcare experience.",
  },
];

// ----------- FAQ section --------
const faqGroups = [
  {
    group: "Consult a Doctor Online for Symptoms",
    items: [
      {
        q: "What does it mean to consult a doctor online for symptoms?",
        a: "Consulting a doctor online for symptoms allows you to discuss your health concerns with qualified healthcare professionals remotely and receive medical guidance, recommendations, and advice through secure virtual consultations.",
      },
      {
        q: "How can I consult a doctor online for symptoms?",
        a: "You can choose a virtual consultation, share your symptoms, medical history, and concerns, and healthcare professionals will guide you toward appropriate care and treatment options.",
      },
      {
        q: "What symptoms can I discuss during an online doctor consultation?",
        a: "You can discuss many non-emergency symptoms, including common illnesses, skin concerns, mental health concerns, chronic health symptoms, sexual health concerns, and other general medical issues.",
      },
      {
        q: "What if I am not sure what is causing my symptoms?",
        a: "You do not need a confirmed diagnosis before seeking care. Healthcare professionals can evaluate your symptoms and recommend appropriate next steps or additional medical evaluation if needed.",
      },
      {
        q: "Can an online doctor diagnose my symptoms?",
        a: "Healthcare professionals can assess your symptoms, review your medical history, provide medical advice, and determine whether further testing or an in-person examination may be necessary.",
      },
      {
        q: "Can I receive treatment recommendations through an online consultation?",
        a: "Yes, healthcare professionals can discuss suitable treatment options, self-care recommendations, and medical guidance when appropriate.",
      },
      {
        q: "Do I need previous medical records before consulting online?",
        a: "Medical records, test reports, and information about current medications can help healthcare professionals understand your condition, but they are not always required.",
      },
      {
        q: "Can I discuss recurring or long-term symptoms during an online consultation?",
        a: "Yes, online consultations are suitable for discussing ongoing symptoms, receiving continuous healthcare support, and monitoring long-term health concerns.",
      },
      {
        q: "Are online consultations private and secure?",
        a: "Yes, Humancare Connect prioritizes patient confidentiality and uses secure technology to protect your personal health information.",
      },
      {
        q: "Can I discuss multiple symptoms in a single consultation?",
        a: "Yes, sharing all your symptoms helps healthcare professionals gain a complete understanding of your health and provide more personalized guidance.",
      },
      {
        q: "When should I seek emergency care instead of an online consultation?",
        a: "You should seek immediate emergency medical attention for severe chest pain, difficulty breathing, serious injuries, sudden weakness, uncontrolled bleeding, or any other life-threatening symptoms.",
      },
      {
        q: "How quickly can I connect with a healthcare professional?",
        a: "Humancare Connect makes it simple to consult a doctor online for symptoms with convenient access to trusted healthcare professionals and timely medical guidance.",
      },
      {
        q: "What are the benefits of consulting a doctor online for symptoms?",
        a: "The benefits include convenience, faster access to medical support, personalized healthcare guidance, and receiving care from the comfort of your home.",
      },
      {
        q: "Can I receive prescriptions during an online consultation?",
        a: "When medically appropriate and permitted by applicable regulations, healthcare professionals may provide prescriptions or treatment recommendations based on your symptoms and condition.",
      },
      {
        q: "Can I get a second opinion for my symptoms or diagnosis?",
        a: "Yes, you can consult healthcare professionals online to receive additional medical insights about your diagnosis, treatment plan, or ongoing health concerns.",
      },
      {
        q: "Why choose Humancare Connect to consult a doctor online for symptoms?",
        a: "Humancare Connect provides secure online doctor consultations, experienced healthcare professionals, and personalized healthcare support to help you understand your symptoms and make informed healthcare decisions with confidence.",
      },
    ],
  },
];

export default function Symptoms() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("All");
  const [showAll, setShowAll] = useState(false);
  const [hoveredFilter, setHoveredFilter] = useState(null);

  // Hero carousel state
  const [slide, setSlide] = useState(0);
  const slideCount = heroSlides.length;
  const autoplayRef = useRef(null);

  useEffect(() => {
    autoplayRef.current = setInterval(() => {
      setSlide((s) => (s + 1) % slideCount);
    }, 5000);
    return () => clearInterval(autoplayRef.current);
  }, [slideCount]);

  const goTo = (i) => {
    clearInterval(autoplayRef.current);
    setSlide(((i % slideCount) + slideCount) % slideCount);
  };
  const goPrev = () => goTo(slide - 1);
  const goNext = () => goTo(slide + 1);

  const current = heroSlides[slide];
  const CurrentCardIcon = current.icon;

  // FAQ state — track which item is open within each group (one open per group)
  const [openFaq, setOpenFaq] = useState("0-0");

  const allConditions = useMemo(
    () =>
      conditionCategories.flatMap(({ category, icon, conditions }) =>
        conditions.map((condition) => ({
          name: condition.name,
          path: condition.path,
          category,
          icon,
        })),
      ),
    [],
  );

  const filtered = useMemo(
    () =>
      allConditions.filter(({ name, category }) => {
        const matchCat = active === "All" || category === active;
        const matchSearch =
          name.toLowerCase().includes(query.toLowerCase()) ||
          category.toLowerCase().includes(query.toLowerCase());
        return matchCat && matchSearch;
      }),
    [allConditions, active, query],
  );

  // Reset the "show all" expansion whenever the result set changes
  useEffect(() => {
    setShowAll(false);
  }, [query, active]);

  const visibleConditions = showAll ? filtered : filtered.slice(0, 96);
  const remainingCount = Math.max(filtered.length - 96, 0);

  const categories = ["All", ...conditionCategories.map((c) => c.category)];

  return (
    <>
      <SEO
        title="Consult a Doctor Online for Symptoms | Virtual Healthcare | Humancare Connect"
        description="Consult a doctor online for symptoms with Humancare Connect. Get expert medical advice, personalized treatment guidance, and secure virtual healthcare consultations from trusted professionals."
        keywords="Consult a doctor online for symptoms, online doctor consultation, symptom-based online care, virtual healthcare services, symptom evaluation, medical advice online"
        url="https://humancareconnect.co/conditions"
      />
      <Helmet>
        <title>
          Consult a Doctor Online for Symptoms | Virtual Healthcare | Humancare
          Connect
        </title>
        <meta
          name="description"
          content="Consult a doctor online for symptoms with Humancare Connect. Get expert medical advice, personalized treatment guidance, and secure virtual healthcare consultations from trusted professionals."
        />
      </Helmet>

      <section id="top" className="sy-hero">
        <div className="sy-hero-inner">
          <div>
            <div className="sy-hero-badge">
              <Globe2 size={14} />
              US-facing telehealth condition directory
            </div>

            <h1 className="sy-hero-title">
              Consult a Doctor Online for Symptoms and Get the Right Care
            </h1>

            <p className="sy-hero-copy">
              Consult a Doctor Online for Symptoms and Get the Right Care
            </p>

            <div className="sy-hero__stats">
              {stats.map(([num, label]) => (
                <div key={label} className="sy-hero__stat">
                  <div className="sy-hero__stat-num">{num}</div>
                  <div className="sy-hero__stat-label">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="sy-hero-panel">
            <div className="sy-hero__card">
              <div className="sy-hero__card-dark">
                <div className="sy-hero__card-top">
                  <div>
                    <p className="sy-hero__card-sub">{current.sub}</p>
                    <p className="sy-hero__card-title">{current.title}</p>
                  </div>
                  <div className="sy-hero__card-icon">
                    <CurrentCardIcon size={22} />
                  </div>
                </div>
                <div className="sy-hero__card-rows">
                  {current.rows.map(([label, value]) => (
                    <div key={label} className="sy-hero__card-row">
                      <span>{label}</span>
                      <span>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="sy-hero__mini-grid">
                {previewSpecialties.map(
                  ({ name, path, icon: Icon, tags }, i) => (
                    <Link
                      key={name}
                      to={path}
                      className={`sy-hero__mini-card${i === current.activeIndex ? " sy-hero__mini-card--active" : ""}`}
                    >
                      <Icon size={20} />
                      <div className="sy-hero__mini-name">{name}</div>
                      <div className="sy-hero__mini-tags">
                        {tags.join(" · ")}
                      </div>
                    </Link>
                  ),
                )}
              </div>

              <Link
                to={previewSpecialties[current.activeIndex].path}
                className="sy-hero__feature-row"
              >
                <div className="sy-hero__feature-left">
                  {(() => {
                    const Icon = previewSpecialties[current.activeIndex].icon;
                    return <Icon size={16} />;
                  })()}
                  <span>{previewSpecialties[current.activeIndex].name}</span>
                </div>
                <div className="sy-hero__feature-tags">
                  {previewSpecialties[current.activeIndex].tags.map((t) => (
                    <span key={t} className="sy-hero__feature-tag">
                      {t}
                    </span>
                  ))}
                </div>
              </Link>

              <div className="sy-hero__nav">
                <button
                  type="button"
                  className="sy-hero__nav-arrow"
                  onClick={goPrev}
                  aria-label="Previous"
                >
                  <ArrowLeft size={16} />
                </button>
                <div className="sy-hero__nav-dots">
                  {heroSlides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`sy-hero__nav-dot${i === slide ? " sy-hero__nav-dot--active" : ""}`}
                      onClick={() => goTo(i)}
                      aria-label={`Go to slide ${i + 1}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="sy-hero__nav-arrow"
                  onClick={goNext}
                  aria-label="Next"
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------(Conditions / Symptoms directory)--------- */}

      <section id="sy-conditions" className="symptoms">
        <div className="symptoms__container">
          <div className="symptoms__title-block">
            <span className="symptoms__eyebrow">Conditions page</span>
            <h2 className="symptoms__heading">
              Searchable US medical condition directory
            </h2>
            <p className="symptoms__copy">
              Use patient-friendly US terminology. Avoid saying "all
              conditions"; say "Conditions we can help with" or "Common concerns
              we support."
            </p>
          </div>

          {/* Search */}
          <div className="symptoms__search-box">
            <div className="symptoms__search-row">
              <label className="symptoms__input-wrap">
                <Search className="symptoms__input-icon" size={20} />
                <input
                  className="symptoms__input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search: UTI, traveler's diarrhea, anxiety, prescription refill..."
                />
              </label>
              <div className="symptoms__count">{filtered.length} results</div>
            </div>

            {/*
              Filter row: scroll + colors are handled inline here rather than
              purely in symptoms.css, since the previous CSS had hover rules
              overriding the active state (active pill would go white on
              click, then flip blue on mouseout). This guarantees correct
              behavior regardless of what's currently in symptoms.css.
              Move these into real classes any time — just keep the same logic.
            */}
            <div
              className="symptoms__filters"
              style={{
                display: "flex",
                flexWrap: "nowrap",
                gap: "8px",
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
                paddingBottom: "10px",
                scrollbarWidth: "thin",
              }}
            >
              {categories.map((cat) => {
                const isActive = active === cat;
                const isHovered = hoveredFilter === cat && !isActive;
                return (
                  <button
                    key={cat}
                    type="button"
                    className={`symptoms__filter-btn${isActive ? " symptoms__filter-btn--active" : ""}`}
                    onClick={() => setActive(cat)}
                    onMouseEnter={() => setHoveredFilter(cat)}
                    onMouseLeave={() => setHoveredFilter(null)}
                    style={{
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                      cursor: "pointer",
                      padding: "8px 16px",
                      borderRadius: "999px",
                      fontSize: "14px",
                      fontWeight: 500,
                      border: isActive
                        ? "1px solid #0B57E8"
                        : "1px solid rgba(6, 19, 51, 0.15)",
                      background: isActive
                        ? "#0B57E8"
                        : isHovered
                          ? "#EAF1FF"
                          : "#FFFFFF",
                      color: isActive ? "#FFFFFF" : "#061333",
                      transition:
                        "background 0.15s ease, border-color 0.15s ease",
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Results */}
          <div className="symptoms__grid">
            {visibleConditions.map((item, i) => {
              const Icon = item.icon;
              return (
                <Link
                  key={`${item.category}-${item.name}`}
                  to={item.path}
                  className="symptoms__item"
                  style={{ "--delay": `${Math.min(i, 30) * 20}ms` }}
                >
                  <div className="symptoms__item-icon">
                    <Icon size={18} />
                  </div>
                  <div>
                    <div className="symptoms__item-name">{item.name}</div>
                    <div className="symptoms__item-cat">{item.category}</div>
                  </div>
                </Link>
              );
            })}
          </div>

          {!showAll && remainingCount > 0 && (
            <div className="symptoms__overflow">
              <p>
                Showing the first 96 matching conditions. Narrow your search to
                see more, or view all results below.
              </p>
              <button
                type="button"
                className="symptoms__view-more"
                onClick={() => setShowAll(true)}
              >
                View {remainingCount} more conditions
              </button>
            </div>
          )}

          {showAll && filtered.length > 96 && (
            <div className="symptoms__overflow">
              <button
                type="button"
                className="symptoms__view-more symptoms__view-more--ghost"
                onClick={() => setShowAll(false)}
              >
                Show fewer conditions
              </button>
            </div>
          )}
        </div>
      </section>

      {/* --------------------(Care section)--------- */}

      <section id="sy-care" className="sy-care">
        <div className="sy-care__inner">
          <div className="sy-care__left">
            <span className="sy-care__eyebrow">SYMPTOM-BASED ONLINE CARE</span>
            <h2 className="sy-care__heading">
              Consult a Doctor Online for Symptoms with Confidence
            </h2>
            <p className="sy-care__copy">
              Humancare Connect helps you consult a doctor online for symptoms
              through secure and convenient virtual healthcare services. Whether
              you are experiencing a new health concern or managing ongoing
              symptoms, our online consultations provide access to trusted
              healthcare professionals who can guide you toward appropriate
              care.
            </p>
          </div>

          <div className="sy-care__grid">
            {careFeatures.map((f) => (
              <div key={f.title} className="sy-care__card">
                <div className="sy-care__card-name">{f.title}</div>
                <div className="sy-care__card-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------(FAQ section)--------- */}

      <section id="sy-faq" className="sy-faq">
        <div className="sy-faq__inner">
          <div className="sy-faq__left">
            <span className="sy-faq__eyebrow">FAQ</span>
            <h2 className="sy-faq__heading">
              Consult a Doctor Online for Symptoms
            </h2>
            <p className="sy-faq__copy">
              Everything you need to know about consulting a doctor online for
              symptoms with Humancare Connect. Can't find an answer?
            </p>

            <div className="sy-faq__meta">
              <div className="sy-faq__meta-item">
                <Clock size={14} />
                <span>Avg. response in 10 min</span>
              </div>
              <div className="sy-faq__meta-item">
                <Lock size={14} />
                <span>HIPAA secure &amp; private</span>
              </div>
              <div className="sy-faq__meta-item">
                <Globe2 size={14} />
                <span>Available Globally</span>
              </div>
            </div>
          </div>

          <div className="sy-faq__right">
            {faqGroups.map((group, gi) => (
              <div key={group.group} className="sy-faq__group">
                {faqGroups.length > 1 && (
                  <span className="sy-faq__group-label">{group.group}</span>
                )}
                <div className="sy-faq__list">
                  {group.items.map((item, ii) => {
                    const id = `${gi}-${ii}`;
                    const isOpen = openFaq === id;
                    return (
                      <div
                        key={id}
                        className={`sy-faq__item${isOpen ? " sy-faq__item--open" : ""}`}
                      >
                        <button
                          type="button"
                          className="sy-faq__q"
                          onClick={() => setOpenFaq(isOpen ? null : id)}
                          aria-expanded={isOpen}
                        >
                          <span>{item.q}</span>
                          <ChevronDown size={18} className="sy-faq__chev" />
                        </button>
                        {isOpen && (
                          <div className="sy-faq__a">
                            <p>{item.a}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------(CTA section)--------- */}

      <section id="sy-cta" className="sy-cta">
        <div className="sy-cta__card">
          <span className="sy-cta__eyebrow">
            <Sparkles size={12} />
            Ready when you are
          </span>
          <h2 className="sy-cta__heading">
            Find your condition <span>in under 2 minutes.</span>
          </h2>
          <p className="sy-cta__copy">
            Search, look, and consult with a verified physician from anywhere —
            same-day appointments available across all categories.
          </p>
          <div className="sy-cta__actions">
            <a href="/book-appointment" className="sy-cta__btn-primary">
              Book a consultation
              <ArrowRight size={16} />
            </a>
            <a href="/specialties" className="sy-cta__btn-secondary">
              Browse specialties
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
