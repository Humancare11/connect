import {
  Activity,
  Apple,
  Baby,
  Bone,
  Brain,
  Ear,
  Earth,
  Eye,
  HeartPulse,
  Leaf,
  Mars,
  MessageCircle,
  Stethoscope,
  Syringe,
  Thermometer,
  UserRound,
  UsersRound,
  Utensils,
  Venus,
  Weight,
  Zap,
} from "lucide-react";

export const HEALTHCARE_ICON_OPTIONS = [
  { value: "stethoscope", label: "Stethoscope" },
  { value: "heart", label: "Heart / Cardiology" },
  { value: "brain", label: "Brain / Mental Health" },
  { value: "skin", label: "Skin / Dermatology" },
  { value: "women", label: "Women Care" },
  { value: "men", label: "Men Care" },
  { value: "pediatrics", label: "Pediatrics" },
  { value: "weight", label: "Weight Management" },
  { value: "nutrition", label: "Nutrition" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "bone", label: "Bone / Orthopedics" },
  { value: "eye", label: "Eye Care" },
  { value: "ear", label: "ENT / Ear" },
  { value: "travel", label: "Travel / Global" },
  { value: "family", label: "Family Care" },
  { value: "message", label: "Counselling / Message" },
  { value: "syringe", label: "Injection / Vaccine" },
  { value: "fever", label: "Fever / Temperature" },
  { value: "urgent", label: "Urgent / Symptom" },
  { value: "general", label: "General Health" },
];

const ICONS = {
  activity: Activity,
  apple: Apple,
  baby: Baby,
  behavioral: Brain,
  "behavioral-health": Brain,
  bone: Bone,
  brain: Brain,
  cardiology: HeartPulse,
  chronic: Activity,
  "chronic-care": Activity,
  counselling: MessageCircle,
  dermatology: Activity,
  ear: Ear,
  earth: Earth,
  endocrinology: Activity,
  ent: Ear,
  eye: Eye,
  family: UsersRound,
  "family-medicine": UsersRound,
  fever: Thermometer,
  general: Activity,
  "general-physician": Stethoscope,
  global: Earth,
  heart: HeartPulse,
  heartpulse: HeartPulse,
  lifestyle: Leaf,
  "lifestyle-medicine": Leaf,
  men: Mars,
  "mens-health": Mars,
  message: MessageCircle,
  mental: Brain,
  "mental-health": Brain,
  menopause: Venus,
  nutrition: Utensils,
  "nutrition-dietetics": Utensils,
  obgyn: Venus,
  "ob-gyn": Venus,
  ophthalmology: Eye,
  orthopedics: Bone,
  pediatrics: Baby,
  psychology: MessageCircle,
  psychiatry: Brain,
  pulmonology: Activity,
  skin: Activity,
  "sexual-health": HeartPulse,
  stethoscope: Stethoscope,
  syringe: Syringe,
  travel: Earth,
  "travel-medicine": Earth,
  urgent: Zap,
  urology: Mars,
  user: UserRound,
  weight: Weight,
  "weight-management": Weight,
  women: Venus,
  "womens-health": Venus,
};

function normalizeIconName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}

function isImageValue(value) {
  return /^https?:\/\//i.test(value || "") || String(value || "").startsWith("/");
}

export function getHealthcareIconComponent(name) {
  return ICONS[normalizeIconName(name)] || null;
}

export default function HealthcareIcon({
  name,
  size = 26,
  strokeWidth = 2.2,
  className = "",
  fallback = "HC",
}) {
  if (isImageValue(name)) {
    return <img className={className} src={name} alt="" />;
  }

  const Icon = getHealthcareIconComponent(name);
  if (Icon) {
    return <Icon className={className} size={size} strokeWidth={strokeWidth} aria-hidden="true" />;
  }

  return <span className={className}>{name || fallback}</span>;
}
