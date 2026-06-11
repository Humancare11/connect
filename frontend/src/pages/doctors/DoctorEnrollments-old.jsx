import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import PhoneInputField, {
  COUNTRIES as PHONE_COUNTRIES,
  getFlagUrl,
  findCountryByName,
} from "../../components/PhoneInputField";
import DatePickerField from "../../components/DatePickerField";
import { Country, State, City } from "country-state-city";
// ─── Constants ───

const SPECIALTIES = [
  "General Practice",
  "Internal Medicine",
  "Cardiology",
  "Dermatology",
  "Endocrinology",
  "Gastroenterology",
  "Neurology",
  "Oncology",
  "Ophthalmology",
  "Orthopedics",
  "Pediatrics",
  "Psychiatry",
  "Pulmonology",
  "Radiology",
  "Surgery",
  "Urology",
  "OB/GYN",
  "Emergency Medicine",
  "Anesthesiology",
  "Pathology",
  "Other",
];
const QUALIFICATIONS = ["MD", "DO", "NP", "PA", "Other"];
const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const splitPhoneValue = (fullValue, countryMeta) => {
  const digits = String(fullValue || "").replace(/\D/g, "");
  const dial = String(countryMeta?.dial || countryMeta?.dialCode || "").replace(
    /\D/g,
    "",
  );
  if (!dial) return { countryCode: "", phone: digits };
  return {
    countryCode: `+${dial}`,
    phone: digits.startsWith(dial) ? digits.slice(dial.length) : digits,
  };
};

// Helper to find country code from dial code
const getCountryCodeFromDialCode = (dialCode) => {
  if (!dialCode) return "auto";
  const cleanDial = String(dialCode).replace(/\D/g, "");
  const country = PHONE_COUNTRIES.find((c) => c.dial === cleanDial);
  return country?.code || "auto";
};

// Countries with state/province-level medical licensing
const STATE_LICENSING_COUNTRIES = {
  US: {
    label: "State",
    plural: "States",
    items: [
      "Alabama",
      "Alaska",
      "Arizona",
      "Arkansas",
      "California",
      "Colorado",
      "Connecticut",
      "Delaware",
      "District of Columbia",
      "Florida",
      "Georgia",
      "Hawaii",
      "Idaho",
      "Illinois",
      "Indiana",
      "Iowa",
      "Kansas",
      "Kentucky",
      "Louisiana",
      "Maine",
      "Maryland",
      "Massachusetts",
      "Michigan",
      "Minnesota",
      "Mississippi",
      "Missouri",
      "Montana",
      "Nebraska",
      "Nevada",
      "New Hampshire",
      "New Jersey",
      "New Mexico",
      "New York",
      "North Carolina",
      "North Dakota",
      "Ohio",
      "Oklahoma",
      "Oregon",
      "Pennsylvania",
      "Rhode Island",
      "South Carolina",
      "South Dakota",
      "Tennessee",
      "Texas",
      "Utah",
      "Vermont",
      "Virginia",
      "Washington",
      "West Virginia",
      "Wisconsin",
      "Wyoming",
    ],
  },
  IN: {
    label: "State/UT",
    plural: "States/UTs",
    items: [
      "Andhra Pradesh",
      "Arunachal Pradesh",
      "Assam",
      "Bihar",
      "Chhattisgarh",
      "Delhi",
      "Goa",
      "Gujarat",
      "Haryana",
      "Himachal Pradesh",
      "Jammu & Kashmir",
      "Jharkhand",
      "Karnataka",
      "Kerala",
      "Ladakh",
      "Madhya Pradesh",
      "Maharashtra",
      "Manipur",
      "Meghalaya",
      "Mizoram",
      "Nagaland",
      "Odisha",
      "Puducherry",
      "Punjab",
      "Rajasthan",
      "Sikkim",
      "Tamil Nadu",
      "Telangana",
      "Tripura",
      "Uttar Pradesh",
      "Uttarakhand",
      "West Bengal",
      "Chandigarh",
    ],
  },
  AU: {
    label: "State/Territory",
    plural: "States/Territories",
    items: [
      "New South Wales",
      "Victoria",
      "Queensland",
      "South Australia",
      "Western Australia",
      "Tasmania",
      "Northern Territory",
      "Australian Capital Territory",
    ],
  },
  CA: {
    label: "Province/Territory",
    plural: "Provinces/Territories",
    items: [
      "Alberta",
      "British Columbia",
      "Manitoba",
      "New Brunswick",
      "Newfoundland and Labrador",
      "Northwest Territories",
      "Nova Scotia",
      "Nunavut",
      "Ontario",
      "Prince Edward Island",
      "Quebec",
      "Saskatchewan",
      "Yukon",
    ],
  },
  DE: {
    label: "Bundesland",
    plural: "Bundesländer",
    items: [
      "Baden-Württemberg",
      "Bavaria",
      "Berlin",
      "Brandenburg",
      "Bremen",
      "Hamburg",
      "Hesse",
      "Lower Saxony",
      "Mecklenburg-Vorpommern",
      "North Rhine-Westphalia",
      "Rhineland-Palatinate",
      "Saarland",
      "Saxony",
      "Saxony-Anhalt",
      "Schleswig-Holstein",
      "Thuringia",
    ],
  },
  BR: {
    label: "State",
    plural: "States",
    items: [
      "Acre",
      "Alagoas",
      "Amapá",
      "Amazonas",
      "Bahia",
      "Ceará",
      "Distrito Federal",
      "Espírito Santo",
      "Goiás",
      "Maranhão",
      "Mato Grosso",
      "Mato Grosso do Sul",
      "Minas Gerais",
      "Pará",
      "Paraíba",
      "Paraná",
      "Pernambuco",
      "Piauí",
      "Rio de Janeiro",
      "Rio Grande do Norte",
      "Rio Grande do Sul",
      "Rondônia",
      "Roraima",
      "Santa Catarina",
      "São Paulo",
      "Sergipe",
      "Tocantins",
    ],
  },
  MX: {
    label: "State",
    plural: "States",
    items: [
      "Aguascalientes",
      "Baja California",
      "Baja California Sur",
      "Campeche",
      "Chiapas",
      "Chihuahua",
      "Ciudad de México",
      "Coahuila",
      "Colima",
      "Durango",
      "Guanajuato",
      "Guerrero",
      "Hidalgo",
      "Jalisco",
      "México",
      "Michoacán",
      "Morelos",
      "Nayarit",
      "Nuevo León",
      "Oaxaca",
      "Puebla",
      "Querétaro",
      "Quintana Roo",
      "San Luis Potosí",
      "Sinaloa",
      "Sonora",
      "Tabasco",
      "Tamaulipas",
      "Tlaxcala",
      "Veracruz",
      "Yucatán",
      "Zacatecas",
    ],
  },
  NG: {
    label: "State",
    plural: "States",
    items: [
      "Abia",
      "Adamawa",
      "Akwa Ibom",
      "Anambra",
      "Bauchi",
      "Bayelsa",
      "Benue",
      "Borno",
      "Cross River",
      "Delta",
      "Ebonyi",
      "Edo",
      "Ekiti",
      "Enugu",
      "FCT Abuja",
      "Gombe",
      "Imo",
      "Jigawa",
      "Kaduna",
      "Kano",
      "Katsina",
      "Kebbi",
      "Kogi",
      "Kwara",
      "Lagos",
      "Nasarawa",
      "Niger",
      "Ogun",
      "Ondo",
      "Osun",
      "Oyo",
      "Plateau",
      "Rivers",
      "Sokoto",
      "Taraba",
      "Yobe",
      "Zamfara",
    ],
  },
};

const TIMEZONES = [
  // Americas
  "America/New_York (EST/EDT)",
  "America/Chicago (CST/CDT)",
  "America/Denver (MST/MDT)",
  "America/Los_Angeles (PST/PDT)",
  "America/Anchorage (AKST)",
  "Pacific/Honolulu (HST)",
  "America/Toronto (EST/EDT)",
  "America/Vancouver (PST/PDT)",
  "America/Sao_Paulo (BRT)",
  "America/Argentina/Buenos_Aires (ART)",
  "America/Mexico_City (CST/CDT)",
  "America/Bogota (COT)",
  "America/Lima (PET)",
  // Europe
  "Europe/London (GMT/BST)",
  "Europe/Paris (CET/CEST)",
  "Europe/Berlin (CET/CEST)",
  "Europe/Madrid (CET/CEST)",
  "Europe/Rome (CET/CEST)",
  "Europe/Amsterdam (CET/CEST)",
  "Europe/Stockholm (CET/CEST)",
  "Europe/Moscow (MSK)",
  "Europe/Istanbul (TRT)",
  "Europe/Athens (EET/EEST)",
  "Europe/Bucharest (EET/EEST)",
  "Europe/Warsaw (CET/CEST)",
  // Africa
  "Africa/Cairo (EET)",
  "Africa/Lagos (WAT)",
  "Africa/Nairobi (EAT)",
  "Africa/Johannesburg (SAST)",
  "Africa/Casablanca (WET)",
  "Africa/Accra (GMT)",
  "Africa/Abidjan (GMT)",
  "Africa/Addis_Ababa (EAT)",
  "Africa/Dar_es_Salaam (EAT)",
  // Middle East
  "Asia/Dubai (GST)",
  "Asia/Riyadh (AST)",
  "Asia/Baghdad (AST)",
  "Asia/Tehran (IRST)",
  "Asia/Kuwait (AST)",
  "Asia/Muscat (GST)",
  "Asia/Bahrain (AST)",
  // South Asia
  "Asia/Kolkata (IST)",
  "Asia/Kathmandu (NPT)",
  "Asia/Dhaka (BST)",
  "Asia/Karachi (PKT)",
  "Asia/Colombo (IST)",
  "Asia/Kabul (AFT)",
  // Southeast Asia
  "Asia/Bangkok (ICT)",
  "Asia/Jakarta (WIB)",
  "Asia/Yangon (MMT)",
  "Asia/Singapore (SGT)",
  "Asia/Kuala_Lumpur (MYT)",
  "Asia/Manila (PHT)",
  "Asia/Phnom_Penh (ICT)",
  "Asia/Ho_Chi_Minh (ICT)",
  "Asia/Vientiane (ICT)",
  // East Asia
  "Asia/Hong_Kong (HKT)",
  "Asia/Shanghai (CST)",
  "Asia/Taipei (CST)",
  "Asia/Seoul (KST)",
  "Asia/Tokyo (JST)",
  // Central Asia
  "Asia/Tashkent (UZT)",
  "Asia/Almaty (ALMT)",
  "Asia/Yekaterinburg (YEKT)",
  // Oceania
  "Australia/Sydney (AEST/AEDT)",
  "Australia/Melbourne (AEST/AEDT)",
  "Australia/Brisbane (AEST)",
  "Australia/Adelaide (ACST/ACDT)",
  "Australia/Perth (AWST)",
  "Pacific/Auckland (NZST/NZDT)",
  "Pacific/Fiji (FJT)",
  "Pacific/Guam (ChST)",
  "Other",
];
const CURRENCIES = [
  "USD",
  "GBP",
  "EUR",
  "INR",
  "AED",
  "SAR",
  "AUD",
  "CAD",
  "SGD",
  "JPY",
  "Other",
];
const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Arabic",
  "Hindi",
  "Portuguese",
  "Chinese (Mandarin)",
  "Chinese (Cantonese)",
  "Japanese",
  "Korean",
  "Italian",
  "Russian",
  "Dutch",
  "Turkish",
  "Urdu",
  "Bengali",
  "Tamil",
  "Telugu",
  "Swahili",
  "Other",
];
const GENDERS = ["Male", "Female", "Others"];
const CONSULTATION_MODES = ["Video Call", "In-Person", "Both", "Phone Call"];
const STATUS_PIPELINE = [
  { key: "pending", label: "Pending Verification", icon: "⏳" },
  { key: "review", label: "Under Review", icon: "🔍" },
  { key: "documents", label: "Waiting for Documents", icon: "📄" },
  { key: "approved", label: "Approved", icon: "✅" },
  { key: "completed", label: "Completed", icon: "🎉" },
];

// ─── Styles ───
const css = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Outfit:wght@400;500;600;700;800&display=swap');

:root {
  --navy: #223A5E;
  --teal: #13338e;
  --gold: #C97B1A;
  --bg: #F4F7FB;
  --section-tint: #DCE6F2;
  --white: #FFFFFF;
  --gray-50: #F8FAFC;
  --gray-100: #F1F5F9;
  --gray-200: #E2E8F0;
  --gray-300: #CBD5E1;
  --gray-400: #94A3B8;
  --gray-500: #64748B;
  --gray-600: #475569;
  --gray-700: #334155;
  --red: #DC2626;
  --green: #16A34A;
  --amber: #D97706;
  --radius: 16px;
  --radius-sm: 10px;
  --radius-xs: 6px;
  --shadow-sm: 0 1px 3px rgba(34,58,94,0.06);
  --shadow-md: 0 4px 16px rgba(34,58,94,0.08);
  --shadow-lg: 0 8px 32px rgba(34,58,94,0.12);
  --shadow-xl: 0 16px 48px rgba(34,58,94,0.16);
  --transition: 0.25s cubic-bezier(0.4,0,0.2,1);
}

* { margin:0; padding:0; box-sizing:border-box; }
body, html {
  font-family: 'DM Sans', sans-serif;
  background: var(--bg);
  color: var(--navy);
  -webkit-font-smoothing: antialiased;
}
h1,h2,h3,h4,h5,h6 {
  font-family: 'Outfit', sans-serif;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.wizard-root {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 40px;
  display: flex;
  flex-direction: column;
}

/* ─── Top Bar ─── */
.top-bar {
  background: var(--navy); padding: 14px 32px;
  display: flex; align-items: center; justify-content: space-between;
  position: sticky; top: 0; z-index: 100;
}
.top-bar-logo {
  font-family: 'Outfit', sans-serif; font-weight: 800;
  font-size: 18px; color: var(--white); letter-spacing: -0.03em;
}
// .top-bar-logo span { color: var(--teal); }
.draft-badge {
  background: rgba(201,123,26,0.2); color: var(--gold);
  padding: 5px 14px; border-radius: 50px; font-size: 12px;
  font-weight: 600; display: flex; align-items: center; gap: 6px;
}
.draft-badge .dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--gold); animation: pulse-dot 2s infinite;
}
@keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.3} }

/* ─── Progress ─── */
.progress-section { max-width: 880px; margin: 28px auto 0; padding: 0 24px; }
.progress-steps { display: flex; align-items: center; position: relative; }
.progress-step {
  display: flex; flex-direction: column; align-items: center;
  flex: 1; position: relative; z-index: 2; padding: 0 20px;
}
.progress-circle {
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 14px;
  transition: var(--transition); border: 2.5px solid var(--gray-300);
  background: var(--white); color: var(--gray-400);
}
.progress-circle.active {
  border-color: var(--teal); background: var(--teal); color: var(--white);
  box-shadow: 0 0 0 4px rgba(37,99,235,0.15);
}
.progress-circle.done { border-color: var(--teal); background: var(--teal); color: var(--white); }
.progress-label {
  margin-top: 8px; font-size: 11px; font-weight: 500;
  color: var(--gray-400); text-align: center; white-space: nowrap;
}
.progress-label.active { color: var(--teal); font-weight: 600; }
.progress-label.done { color: var(--teal); }
.progress-line-bg {
  position: absolute; top: 18px; left: 10%; right: 10%;
  height: 3px; background: var(--gray-200); z-index: 1; border-radius: 2px;
}
.progress-line-fill {
  position: absolute; top: 18px; left: 10%; height: 3px;
  background: var(--teal); z-index: 1; border-radius: 2px;
  transition: width 0.5s cubic-bezier(0.4,0,0.2,1);
}

/* ─── Card ─── */
.de-step-card {
  max-width: 880px;
  margin: 24px auto 0;
  padding: 0 24px;
  width: 100%;
}
.de-card {
  background: var(--white); border-radius: var(--radius);
  box-shadow: var(--shadow-md); border: 1px solid rgba(34,58,94,0.06);
  overflow: visible; width: 100%;
  // max-height: min(980px, calc(100dvh - 220px));
  display: flex; flex-direction: column;
  min-height: 0;
}
.de-card-header { padding: 28px 32px 20px; border-bottom: 1px solid var(--gray-100); }
.de-card-header h2 { font-size: 22px; color: var(--navy); margin-bottom: 4px; }
.de-card-header p { font-size: 14px; color: var(--gray-500); line-height: 1.5; }
.de-card-body {
  padding: 28px 32px 32px;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
}

/* ─── Form ─── */
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; overflow: visible;  }
.form-grid .full-width { grid-column: 1 / -1; }
.location-row { display: -webkit-inline-box; grid-template-columns: repeat(3, 1fr); gap: 20px; width: 100%; }
.location-row .field-group { width: 64.5%; min-width: 0; }
.field-group {
  display: flex; flex-direction: column; gap: 6px;
  position: relative;
  overflow: visible;
  min-width: 0;
}
.field-label { font-size: 13px; font-weight: 600; color: var(--navy); display: flex; align-items: center; gap: 4px; }
.field-label .req { color: var(--red); font-size: 14px; }
.field-input, .field-select, .field-textarea {
  padding: 11px 14px; border: 1.5px solid var(--gray-200);
  border-radius: var(--radius-sm); font-family: 'DM Sans', sans-serif;
  font-size: 14px; color: var(--navy); background: var(--white);
  transition: var(--transition); outline: none; width: 100%;
  box-sizing: border-box; min-width: 0;
}
.field-input:focus, .field-select:focus, .field-textarea:focus {
  border-color: var(--teal); box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
}
.field-input.error, .field-select.error {
  border-color: var(--red); box-shadow: 0 0 0 3px rgba(220,38,38,0.08);
}
.field-input:disabled, .field-select:disabled {
  background: #f3f4f6; color: #9ca3af; cursor: not-allowed; opacity: 0.6; border-color: #e5e7eb;
}
.field-error { font-size: 12px; color: var(--red); font-weight: 500; }
.field-textarea { resize: vertical; min-height: 80px; }
.field-select {
  cursor: pointer; appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2364748B' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 14px center; padding-right: 36px;
}

/* ─── Buttons ─── */
.btn {
  padding: 12px 28px; border-radius: 50px; font-family: 'DM Sans', sans-serif;
  font-size: 14px; font-weight: 600; cursor: pointer; border: none;
  transition: var(--transition); display: inline-flex; align-items: center; gap: 8px;
}
.btn-primary { background: var(--teal); color: var(--white); }
.btn-primary:hover { background: #1d4ed8; transform: translateY(-1px); box-shadow: var(--shadow-md); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
.btn-secondary { background: var(--gray-100); color: var(--navy); }
.btn-secondary:hover { background: var(--gray-200); }
.btn-outline { background: transparent; border: 1.5px solid var(--gray-200); color: var(--navy); }
.btn-outline:hover { border-color: var(--teal); color: var(--teal); }
.btn-gold { background: var(--gold); color: var(--white); }
.btn-gold:hover { background: #b56e16; }
.btn-danger { background: rgba(220,38,38,0.08); color: var(--red); }
.btn-danger:hover { background: rgba(220,38,38,0.15); }
.btn-sm { padding: 8px 18px; font-size: 13px; }
.btn-xs { padding: 5px 12px; font-size: 12px; border-radius: 8px; }
.btn-row {
  display: flex; justify-content: space-between; align-items: center;
  padding-top: 24px; border-top: 1px solid var(--gray-100); margin-top: 28px;
}

/* ─── Success ─── */
.success-banner {
  display: flex; align-items: center; gap: 8px;
  color: var(--green); font-weight: 600; font-size: 14px;
  padding: 10px 16px; background: rgba(22,163,74,0.08); border-radius: var(--radius-sm);
}

/* ─── File Upload ─── */
.upload-zone {
  border: 2px dashed var(--gray-300); border-radius: var(--radius-sm);
  padding: 24px; text-align: center; cursor: pointer;
  transition: var(--transition); background: var(--gray-50);
}
.upload-zone:hover { border-color: var(--teal); background: rgba(37,99,235,0.03); }
.upload-zone.has-file { border-color: var(--teal); border-style: solid; background: rgba(37,99,235,0.04); }
.upload-zone.error { border-color: var(--amber) !important; background: rgba(217,119,6,0.04) !important; }
.upload-icon { font-size: 28px; margin-bottom: 8px; }
.upload-text { font-size: 13px; color: var(--gray-500); }
.upload-text strong { color: var(--teal); }
.file-preview {
  display: flex; align-items: center; gap: 12px; padding: 10px;
  background: var(--white); border-radius: var(--radius-xs);
  margin-top: 10px; border: 1px solid var(--gray-200);
}
.file-icon { font-size: 24px; }
.file-info { flex: 1; }
.file-name { font-size: 13px; font-weight: 600; color: var(--navy); }
.file-size { font-size: 11px; color: var(--gray-400); }
.file-remove { background: none; border: none; color: var(--gray-400); cursor: pointer; font-size: 16px; padding: 4px; }
.file-remove:hover { color: var(--red); }

/* ─── MultiSelect ─── */
.ms-wrapper { position: relative; }
.ms-trigger {
  display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 12px;
  border: 1.5px solid var(--gray-200); border-radius: var(--radius-sm);
  min-height: 44px; align-items: center; cursor: pointer;
  transition: var(--transition); background: var(--white);
}
.ms-trigger:hover { border-color: var(--gray-300); }
.ms-trigger.open { border-color: var(--teal); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
.ms-trigger.error { border-color: var(--red); box-shadow: 0 0 0 3px rgba(220,38,38,0.08); }
.ms-placeholder { font-size: 13px; color: var(--gray-400); }
.ms-tag {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 10px; background: rgba(37,99,235,0.1);
  color: var(--teal); border-radius: 6px; font-size: 12px; font-weight: 600;
}
.ms-tag button {
  background: none; border: none; color: var(--teal);
  cursor: pointer; font-size: 14px; line-height: 1; padding: 0 2px;
}
.ms-tag button:hover { color: var(--red); }
.ms-overflow {
  font-size: 11px; font-weight: 600; color: var(--teal);
  background: rgba(37,99,235,0.08); padding: 3px 8px; border-radius: 50px;
}
.ms-dropdown {
  background: var(--white); border: 1.5px solid var(--gray-200);
  border-radius: var(--radius-sm); box-shadow: var(--shadow-lg);
  z-index: 9999; max-height: 260px; overflow: hidden;
  display: flex; flex-direction: column;
}
.ms-search {
  padding: 10px 12px; border: none; border-bottom: 1px solid var(--gray-100);
  font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none;
  background: var(--gray-50); flex-shrink: 0;
}
.ms-list { overflow-y: auto; flex: 1; padding: 4px 0; }
.ms-option {
  padding: 8px 14px; font-size: 13px; cursor: pointer;
  display: flex; align-items: center; gap: 10px; transition: background 0.15s;
}
.ms-option:hover { background: var(--gray-50); }
.ms-check {
  width: 18px; height: 18px; border-radius: 4px;
  border: 1.5px solid var(--gray-300); display: flex;
  align-items: center; justify-content: center;
  flex-shrink: 0; transition: var(--transition); font-size: 11px;
}
.ms-check.on { background: var(--teal); border-color: var(--teal); color: var(--white); }
.ms-empty { padding: 16px; text-align: center; font-size: 13px; color: var(--gray-400); }

/* ─── License Sections ─── */
.license-section {
  margin-top: 24px; padding: 20px; background: var(--gray-50);
  border-radius: var(--radius-sm); border: 1px solid var(--gray-200); overflow: visible;
}
.license-section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
.license-section-header h4 { font-size: 15px; }
.ls-icon {
  width: 30px; height: 30px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; flex-shrink: 0;
}
.ls-icon.state { background: rgba(37,99,235,0.1); }
.ls-icon.intl { background: rgba(201,123,26,0.1); }
.ls-desc { font-size: 13px; color: var(--gray-500); margin-bottom: 14px; line-height: 1.5; }
.selected-licenses-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.sel-license-card {
  padding: 8px 14px; background: var(--white);
  border: 1px solid var(--gray-200); border-radius: var(--radius-xs);
  font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px;
}
.sel-license-card .sl-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--teal); }

/* ─── Availability ─── */
.avail-day {
  background: var(--gray-50); border-radius: var(--radius-sm);
  padding: 16px; margin-bottom: 12px; border: 1px solid var(--gray-100);
}
.avail-day-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.avail-day-name { font-family: 'Outfit', sans-serif; font-weight: 600; font-size: 14px; }
.avail-toggle {
  position: relative; width: 40px; height: 22px;
  background: var(--gray-300); border-radius: 11px;
  cursor: pointer; border: none; transition: var(--transition);
}
.avail-toggle.on { background: var(--teal); }
.avail-toggle::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 18px; height: 18px; background: var(--white);
  border-radius: 50%; transition: var(--transition);
}
.avail-toggle.on::after { left: 20px; }
.time-block { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.time-input {
  padding: 8px 12px; border: 1.5px solid var(--gray-200);
  border-radius: var(--radius-xs); font-family: 'DM Sans', sans-serif;
  font-size: 13px; outline: none; transition: var(--transition); width: 120px;
}
.time-input:focus { border-color: var(--teal); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
.time-sep { color: var(--gray-400); font-weight: 600; font-size: 13px; }

/* ─── Status ─── */
.status-dashboard { max-width: 700px; margin: 0 auto; }
.status-pipeline { display: flex; align-items: center; margin: 24px 0; position: relative; }
.status-node { flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; z-index: 2; }
.status-dot {
  width: 44px; height: 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; border: 2.5px solid var(--gray-300);
  background: var(--white); transition: var(--transition);
}
.status-dot.reached { border-color: var(--teal); background: rgba(37,99,235,0.08); }
.status-dot.current { border-color: var(--teal); background: var(--teal); box-shadow: 0 0 0 4px rgba(37,99,235,0.15); }
.status-dot.current .st-icon { filter: grayscale(1) brightness(10); }
.status-name { margin-top: 8px; font-size: 10px; font-weight: 500; color: var(--gray-400); text-align: center; max-width: 80px; }
.status-name.reached { color: var(--teal); }
.status-name.current { color: var(--teal); font-weight: 700; }
.status-line-bg { position: absolute; top: 22px; left: 10%; right: 10%; height: 3px; background: var(--gray-200); z-index: 1; }
.status-line-fill { position: absolute; top: 22px; left: 10%; height: 3px; background: var(--teal); z-index: 1; transition: width 0.5s ease; }
.status-info-card {
  background: var(--gray-50); border-radius: var(--radius-sm);
  padding: 20px; text-align: center; border: 1px solid var(--gray-200); margin-top: 16px;
}
.status-info-card h3 { font-size: 16px; margin-bottom: 6px; }
.status-info-card p { font-size: 13px; color: var(--gray-500); line-height: 1.6; }
.postal-section {
  margin-top: 20px; padding: 20px; background: rgba(201,123,26,0.06);
  border-radius: var(--radius-sm); border: 1px solid rgba(201,123,26,0.2);
}
.postal-section h4 { color: var(--gold); font-size: 14px; margin-bottom: 8px; }


/* ─── Responsive ─── */
@media (max-width: 900px) {
  .de-step-card { padding: 0 16px; }
  .progress-section { padding: 0 16px; }
  .location-row { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 720px) {
  .form-grid { grid-template-columns: 1fr; }
  .location-row { grid-template-columns: 1fr; }
  .de-card-body { padding: 22px 18px 28px; }
  .de-card-header { padding: 20px 18px 16px; }
  .de-card-header h2 { font-size: 19px; }
  .progress-section { padding: 0 12px; }
  .progress-step { padding: 0 10px; }
  .progress-label { font-size: 10px; }
  .btn { padding: 11px 20px; font-size: 13px; }
}

@media (max-width: 640px) {
  .form-grid { grid-template-columns: 1fr; }
  .top-bar { padding: 12px 16px; flex-wrap: wrap; gap: 8px; }
  .top-bar-logo { font-size: 15px; }
  .de-step-card { padding: 0 10px; }
  .de-card-body { padding: 18px 14px 22px; }
  .de-card-header { padding: 18px 14px 14px; }
  .de-card-header h2 { font-size: 17px; }
  .de-card-header p { font-size: 13px; }
  .de-card { max-height: none; }
  .progress-section { margin-top: 16px; padding: 0 8px; }
  .progress-step { padding: 0 6px; }
  .progress-circle { width: 28px; height: 28px; font-size: 12px; }
  .progress-label { font-size: 8px; white-space: normal; text-align: center; }
  .progress-line-bg { top: 14px; }
  .progress-line-fill { top: 14px; }
  .btn-row { flex-direction: column-reverse; gap: 10px; }
  .btn-row .btn { width: 100%; justify-content: center; }
  .btn-row div { display: flex; flex-direction: column; gap: 8px; width: 100%; }
  .btn-row div .btn { width: 100%; }
  .time-block { flex-wrap: wrap; }
  .time-input { width: 100px; }
  .ms-dropdown { max-height: 220px; }
  .license-section { padding: 14px; }
  .upload-zone { padding: 16px; }
}

@media (max-width: 420px) {
  .progress-label { display: none; }
  .de-card-header h2 { font-size: 16px; }
  .btn { padding: 10px 16px; }
}

@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-in { animation: fadeSlideIn 0.35s ease forwards; }
`;

// ═══════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════

// ─── Custom hook for dropdown positioning ───
function useDropdownPosition(triggerRef, open) {
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePosition = () => {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    };

    updatePosition();

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, triggerRef]);

  return position;
}

function MultiSelect({
  items,
  selected,
  onChange,
  placeholder,
  searchPlaceholder,
  hasError,
  showFlags = false,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef();
  const triggerRef = useRef();
  const dropdownRef = useRef();
  const searchInputRef = useRef();
  const position = useDropdownPosition(triggerRef, open);

  useEffect(() => {
    const handler = (e) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [open]);

  const getDisplayName = (item) =>
    typeof item === "string" ? item : item.name;

  const filtered = items.filter((i) =>
    getDisplayName(i).toLowerCase().includes(search.toLowerCase()),
  );

  const toggle = (item) => {
    const displayName = getDisplayName(item);
    onChange(
      selected.includes(displayName)
        ? selected.filter((s) => s !== displayName)
        : [...selected, displayName],
    );
  };

  const dropdown =
    open && position.width > 0
      ? createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "absolute",
              top: `${position.top}px`,
              left: `${position.left}px`,
              width: `${position.width}px`,
              background: "#fff",
              border: "1.5px solid #e2e8f0",
              borderRadius: 12,
              boxShadow:
                "0 16px 48px rgba(0,0,0,0.13), 0 4px 12px rgba(0,0,0,0.06)",
              zIndex: 9999,
              overflow: "hidden",
            }}
          >
            {/* Search */}
            <div
              style={{
                padding: "10px 10px 6px",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  background: "#f8fafc",
                  border: "1.5px solid #e8edf2",
                  borderRadius: 10,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  style={{ flexShrink: 0 }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={searchPlaceholder || "Search..."}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    flex: 1,
                    border: "none",
                    background: "transparent",
                    fontSize: 13,
                    fontFamily: "inherit",
                    color: "#1e293b",
                    outline: "none",
                  }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      color: "#cbd5e1",
                      fontSize: 14,
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {filtered.length === 0 ? (
                <div
                  style={{
                    padding: "18px 16px",
                    textAlign: "center",
                    color: "#94a3b8",
                    fontSize: 13,
                  }}
                >
                  No results found
                </div>
              ) : (
                filtered.map((item) => {
                  const displayName = getDisplayName(item);
                  const countryData =
                    typeof item === "string" ? findCountryByName(item) : null;
                  const isSelected = selected.includes(displayName);

                  return (
                    <div
                      key={displayName}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        padding: "9px 14px",
                        border: "none",
                        background: isSelected ? "#f0fdf4" : "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                        fontFamily: "inherit",
                        transition: "background 0.1s",
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        toggle(item);
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected)
                          e.currentTarget.style.background = "#f8fafc";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isSelected
                          ? "#f0fdf4"
                          : "transparent";
                      }}
                    >
                      {showFlags && countryData && (
                        <img
                          src={getFlagUrl(countryData.code)}
                          alt={countryData.code}
                          style={{
                            width: 20,
                            height: 15,
                            objectFit: "cover",
                            borderRadius: 2,
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <span style={{ fontSize: 13, color: "#334155", flex: 1 }}>
                        {displayName}
                      </span>
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          border: "1.5px solid #cbd5e1",
                          borderRadius: 3,
                          background: isSelected ? "#10b981" : "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {isSelected && (
                          <span
                            style={{
                              color: "#fff",
                              fontSize: 12,
                              fontWeight: "bold",
                            }}
                          >
                            ✓
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="ms-wrapper" ref={wrapperRef}>
        <div
          ref={triggerRef}
          className={`ms-trigger ${open ? "open" : ""} ${hasError ? "error" : ""}`}
          onClick={() => setOpen(!open)}
        >
          {selected.length === 0 ? (
            <span className="ms-placeholder">{placeholder}</span>
          ) : (
            <>
              {selected.slice(0, 3).map((s) => (
                <span key={s} className="ms-tag">
                  {s}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const item = items.find((i) => getDisplayName(i) === s);
                      toggle(item || s);
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
              {selected.length > 3 && (
                <span className="ms-overflow">+{selected.length - 3} more</span>
              )}
            </>
          )}
        </div>
      </div>
      {dropdown}
    </>
  );
}

// ─── Single-select with search bar ───
function SingleSelect({ items, value, onChange, placeholder, hasError }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef();
  const triggerRef = useRef();
  const dropdownRef = useRef();
  const position = useDropdownPosition(triggerRef, open);

  useEffect(() => {
    const handler = (e) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = items.filter((i) =>
    i.toLowerCase().includes(search.toLowerCase()),
  );

  const dropdown =
    open && position.width > 0
      ? createPortal(
          <div
            ref={dropdownRef}
            className="ms-dropdown animate-in"
            style={{
              position: "absolute",
              top: `${position.top}px`,
              left: `${position.left}px`,
              width: `${position.width}px`,
            }}
          >
            <input
              className="ms-search"
              placeholder="Search specialty..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
            <div className="ms-list" onWheel={(e) => e.stopPropagation()}>
              {filtered.length === 0 ? (
                <div className="ms-empty">No results found</div>
              ) : (
                filtered.map((item) => (
                  <div
                    key={item}
                    className="ms-option"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onChange(item);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <div className={`ms-check ${value === item ? "on" : ""}`}>
                      {value === item && "✓"}
                    </div>
                    <span>{item}</span>
                  </div>
                ))
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="ms-wrapper" ref={wrapperRef}>
        <div
          ref={triggerRef}
          className={`field-select ${hasError ? "error" : ""}`}
          style={{
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            userSelect: "none",
          }}
          onClick={() => setOpen(!open)}
        >
          <span style={{ color: value ? "var(--navy)" : "var(--gray-400)" }}>
            {value || placeholder || "Select..."}
          </span>
          <svg
            width="12"
            height="8"
            viewBox="0 0 12 8"
            fill="none"
            style={{
              flexShrink: 0,
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform 0.2s",
            }}
          >
            <path
              d="M1 1.5L6 6.5L11 1.5"
              stroke="#64748B"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      {dropdown}
    </>
  );
}

// ─── Profile Photo Upload (circular avatar with live preview) ───
function ProfilePhotoUpload({ file, onFile, onRemove, hasError, errorMsg }) {
  const ref = useRef();
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [localPreview, setLocalPreview] = useState(null);

  // Revoke object URL on unmount to avoid memory leak
  useEffect(
    () => () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    },
    [],
  ); // eslint-disable-line

  const handlePick = async (rawFile) => {
    if (!rawFile) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];
    const fileExtension = rawFile.name
      .toLowerCase()
      .slice(rawFile.name.lastIndexOf("."));

    if (
      !allowedTypes.includes(rawFile.type) ||
      !allowedExtensions.includes(fileExtension)
    ) {
      setUploadErr("Only JPG, JPEG, PNG, and WebP images are allowed.");
      return;
    }
    setUploadErr("");
    // Show local preview immediately — don't wait for server
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(URL.createObjectURL(rawFile));
    setUploading(true);
    onFile({ name: rawFile.name, url: null });
    try {
      const fd = new FormData();
      fd.append("file", rawFile);
      const { data } = await api.post("/api/upload", fd);
      onFile({ name: data.name || rawFile.name, url: data.url });
    } catch {
      setUploadErr("Upload failed — please remove and try again.");
    } finally {
      setUploading(false);
    }
  };

  const fileUrl = file?.url || "";
  const canPreviewStoredUrl =
    fileUrl.startsWith("http://") ||
    fileUrl.startsWith("https://") ||
    fileUrl.startsWith("blob:");
  const imgSrc = localPreview || (canPreviewStoredUrl ? fileUrl : null);
  const isReady = !!file?.url;
  const showValidationErr = hasError && !file && !uploadErr;

  return (
    <div className="field-group">
      <label className="field-label">
        Profile Photo <span className="req">*</span>
      </label>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          padding: "18px 20px",
          background: "var(--gray-50)",
          borderRadius: "var(--radius-sm)",
          border: `1.5px ${showValidationErr ? "solid var(--red)" : isReady ? "solid var(--teal)" : "solid var(--gray-200)"}`,
          boxShadow: showValidationErr
            ? "0 0 0 3px rgba(220,38,38,0.08)"
            : isReady
              ? "0 0 0 3px rgba(37,99,235,0.08)"
              : "none",
          flexWrap: "wrap",
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
      >
        {/* ── Avatar circle ── */}
        <div
          onClick={() => !uploading && ref.current?.click()}
          style={{
            width: 90,
            height: 90,
            borderRadius: "50%",
            flexShrink: 0,
            border: `2.5px ${isReady ? "solid var(--teal)" : showValidationErr ? "dashed var(--red)" : "dashed var(--gray-300)"}`,
            background: imgSrc ? "none" : "var(--gray-100)",
            cursor: uploading ? "default" : "pointer",
            overflow: "hidden",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "border-color 0.2s",
          }}
        >
          {imgSrc ? (
            <img
              src={imgSrc}
              alt="Profile preview"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            /* SVG person silhouette placeholder */
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="14" r="9" fill="#CBD5E1" />
              <path
                d="M2 40c0-9.941 8.059-18 18-18s18 8.059 18 18"
                fill="#CBD5E1"
              />
            </svg>
          )}
          {uploading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(255,255,255,0.88)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 24 }}>⏳</span>
            </div>
          )}
        </div>

        {/* ── Info + actions ── */}
        <div
          style={{
            flex: 1,
            minWidth: 160,
            display: "flex",
            flexDirection: "column",
            gap: 5,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--navy)" }}>
            {isReady
              ? "✅ Photo uploaded"
              : uploading
                ? "⏳ Uploading…"
                : file
                  ? file.name
                  : "No photo selected"}
          </div>
          <div
            style={{ fontSize: 12, color: "var(--gray-500)", lineHeight: 1.55 }}
          >
            A professional headshot helps patients identify you.
            <br />
            Accepted: JPG, PNG, WebP · Max 5 MB
          </div>
          {(uploadErr || showValidationErr) && (
            <div className="field-error">
              {uploadErr || errorMsg || "Profile photo is required"}
            </div>
          )}
          <div
            style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}
          >
            <button
              type="button"
              className="btn btn-outline btn-xs"
              onClick={() => ref.current?.click()}
              disabled={uploading}
            >
              {file ? "Change Photo" : "Choose Photo"}
            </button>
            {file && (
              <button
                type="button"
                className="btn btn-danger btn-xs"
                onClick={() => {
                  setLocalPreview(null);
                  setUploadErr("");
                  onRemove();
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>
        <input
          ref={ref}
          type="file"
          hidden
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={(e) => handlePick(e.target.files[0])}
        />
      </div>
    </div>
  );
}

// file prop shape: null | { name: string, url: string|null }
// Uploads to /api/upload immediately when a file is picked, then calls onFile({ name, url })
function FileUpload({ label, file, onFile, onRemove, required }) {
  const ref = useRef();
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");

  const handlePick = async (rawFile) => {
    if (!rawFile) return;
    setUploadErr("");
    setUploading(true);
    // Optimistically show the filename while uploading
    onFile({ name: rawFile.name, url: null });
    try {
      const fd = new FormData();
      fd.append("file", rawFile);
      const { data } = await api.post("/api/upload", fd);
      onFile({ name: data.name || rawFile.name, url: data.url });
    } catch {
      setUploadErr("Upload failed — please remove and try again.");
      // Keep the { name, url: null } so the user sees the error state
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handlePick(e.dataTransfer.files[0]);
  };

  const hasUrl = !!file?.url;
  const hasFile = !!file;

  return (
    <div className="field-group">
      <div className="field-label">
        {label} {required && <span className="req">*</span>}
      </div>

      {!hasFile ? (
        /* ── Empty drop zone ── */
        <div
          className="upload-zone"
          onClick={() => ref.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="upload-icon">📁</div>
          <div className="upload-text">
            <strong>Click to upload</strong> or drag and drop
          </div>
          <div className="upload-text" style={{ fontSize: 11, marginTop: 4 }}>
            PDF, JPG, PNG up to 10MB
          </div>
          <input
            ref={ref}
            type="file"
            hidden
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={(e) => handlePick(e.target.files[0])}
          />
        </div>
      ) : uploading ? (
        /* ── Uploading spinner ── */
        <div
          className="upload-zone has-file"
          style={{ justifyContent: "center", flexDirection: "column", gap: 6 }}
        >
          <div style={{ fontSize: 22 }}>⏳</div>
          <div className="upload-text">
            Uploading <strong>{file.name}</strong>…
          </div>
        </div>
      ) : (
        /* ── File ready / error state ── */
        <div
          className={`upload-zone has-file ${uploadErr ? "error" : ""}`}
          onClick={() => ref.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          title="Click to replace"
        >
          <div className="file-preview">
            <div className="file-icon">{hasUrl ? "✅" : "⚠️"}</div>
            <div className="file-info">
              <div className="file-name">{file.name}</div>
              <div
                className="file-size"
                style={{
                  color: hasUrl ? "var(--green)" : "var(--amber)",
                  fontWeight: 600,
                }}
              >
                {hasUrl
                  ? "Uploaded ✓"
                  : uploadErr || "Not yet on server — click to retry"}
              </div>
            </div>
            <button
              className="file-remove"
              onClick={(e) => {
                e.stopPropagation();
                setUploadErr("");
                onRemove();
              }}
            >
              ✕
            </button>
          </div>
          <input
            ref={ref}
            type="file"
            hidden
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={(e) => handlePick(e.target.files[0])}
          />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════
export default function DoctorOnboardingWizard({
  doctorId,
  initialData,
  onComplete,
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [draftSaved, setDraftSaved] = useState(false);
  const draftTimerRef = useRef(null);
  const lastProgressKeyRef = useRef("");
  const progressSyncTimerRef = useRef(null);

  // Step 1
  const [s1, setS1] = useState({
    firstName: "",
    surname: "",
    countryCode: "",
    phone: "",
    email: "",
    gender: "",
    dob: "",
    country: "",
    state: "",
    city: "",
    zip: "",
    address: "",
  });
  const countries = Country.getAllCountries();

  const states = s1.country ? State.getStatesOfCountry(s1.country) : [];
  const hasStates = states.length > 0;
  const cities = s1.country
    ? hasStates
      ? s1.state
        ? City.getCitiesOfState(s1.country, s1.state)
        : []
      : City.getCitiesOfCountry(s1.country)
    : [];
  const hasCities = cities.length > 0;

  useEffect(() => {
    if (!hasStates && s1.state) {
      setS1((prev) => ({
        ...prev,
        state: "",
      }));
    }
  }, [hasStates]);
  const [languagesKnown, setLanguagesKnown] = useState([]);
  const [s1Errors, setS1Errors] = useState({});
  const [phoneCountryCode, setPhoneCountryCode] = useState("auto");

  // Step 2
  const [s2, setS2] = useState({
    npi: "",
    licenseNum: "",
    specialty: "",
    customSpecialty: "",
    subSpecialization: "",
    qualification: "",
    school: "",
    gradYear: "",
    experience: "",
    medicalCouncilName: "",
    consultationMode: "",
    consultantFees: "",
    feeCurrency: "USD",
    clinicName: "",
    clinicAddress: "",
    aboutDoctor: "",
    certifications: "",
  });
  const [files, setFiles] = useState({
    profilePhoto: null,
    govId: null,
    degree: null,
    medicalLicense: null,
    malpractice: null,
  });
  const [s2Errors, setS2Errors] = useState({});
  const [licensedStates, setLicensedStates] = useState([]);
  const [otherLicenseCountries, setOtherLicenseCountries] = useState([]);

  // Step 3
  const [availability, setAvailability] = useState(
    DAYS.reduce(
      (a, d) => ({
        ...a,
        [d]: { enabled: false, blocks: [{ start: "09:00", end: "17:00" }] },
      }),
      {},
    ),
  );
  const [timezone, setTimezone] = useState("");

  // Step 4
  const [payoutFreq, setPayoutFreq] = useState("monthly");
  const [s4, setS4] = useState({
    bankName: "",
    accountNum: "",
    swift: "",
    iban: "",
    currency: "USD",
    paypalId: "",
  });
  const [s4Errors, setS4Errors] = useState({});

  // Step 5
  const [regStatus, setRegStatus] = useState("pending");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  const isUS = s1.country === "US";
  const stateConfig = STATE_LICENSING_COUNTRIES[s1.country];
  const otherCountryOptions = countries.filter((c) => c.isoCode !== s1.country);
  const mobileValue = `${s1.countryCode || ""}${s1.phone || ""}`;
  const handleMobileChange = (value, countryMeta) => {
    const nextPhone = splitPhoneValue(value, countryMeta);
    setS1((prev) => ({ ...prev, ...nextPhone }));
  };
  const handleMobileCountryChange = (countryMeta) => {
    setPhoneCountryCode(countryMeta.code || "auto");
    setS1((prev) => ({
      ...prev,
      countryCode: countryMeta.dialCode || prev.countryCode,
    }));
  };
  const STEP_LABELS = [
    "Identity",
    "Professional",
    "Availability",
    "Payout",
    "Status",
  ];

  // Populate form states from saved enrollment data
  const loadFromData = useCallback((data) => {
    if (!data) return;
    setS1({
      firstName: data.firstName || "",
      surname: data.surname || "",
      countryCode: data.countryCode || "",
      phone: data.phoneNumber || "",
      email: data.email || "",
      gender: data.gender || "",
      dob: data.dob || "",
      country: data.country || "",
      state: data.state || "",
      city: data.city || "",
      zip: data.zip || "",
      address: data.address || "",
    });
    if (data.countryCode) {
      setPhoneCountryCode(getCountryCodeFromDialCode(data.countryCode));
    }
    const rawLangs = data.languagesKnown;
    setLanguagesKnown(
      Array.isArray(rawLangs)
        ? rawLangs
        : typeof rawLangs === "string" && rawLangs.trim()
          ? rawLangs
              .split(",")
              .map((l) => l.trim())
              .filter(Boolean)
          : [],
    );
    setS2({
      npi: data.medicalRegistrationNumber || "",
      licenseNum: data.medicalLicense || data.medicalRegistrationNumber || "",
      specialty: data.specialization || "",
      customSpecialty: "",
      subSpecialization: data.subSpecialization || "",
      qualification: data.qualification || "",
      school: data.medicalSchool || "",
      gradYear: data.registrationYear || "",
      experience: data.experience ? String(data.experience) : "",
      medicalCouncilName: data.medicalCouncilName || "",
      consultationMode: data.consultationMode || "",
      consultantFees: data.consultantFees ? String(data.consultantFees) : "",
      feeCurrency: data.feeCurrency || "USD",
      clinicName: data.clinicName || "",
      clinicAddress: data.clinicAddress || "",
      aboutDoctor: data.aboutDoctor || "",
      certifications: "",
    });
    setS4({
      bankName: data.bankName || "",
      accountNum: data.accountNumber || "",
      swift: data.ifscCode || "",
      iban: data.ifscCode || "",
      currency: "USD",
      paypalId: data.paypalId || "",
    });
    if (data.timezone) setTimezone(data.timezone);
    if (data.state) setLicensedStates([data.state]);

    const makeFileRef = (nameOrUrl) => {
      if (!nameOrUrl) return null;
      const name = decodeURIComponent(
        String(nameOrUrl).split("?")[0].split("/").pop() || "document",
      );
      return { name, url: nameOrUrl };
    };
    setFiles({
      profilePhoto: makeFileRef(data.profilePhoto),
      govId: makeFileRef(data.idProof),
      degree: makeFileRef(data.degreeFile),
      medicalLicense: makeFileRef(data.medicalLicenseFile),
      malpractice: makeFileRef(data.malpracticeInsuranceFile),
    });
  }, []);

  // Restore draft from localStorage when no backend data yet
  useEffect(() => {
    if (!doctorId || initialData) return;
    const saved = localStorage.getItem(`hc_enroll_draft_${doctorId}`);
    if (!saved) return;
    try {
      const d = JSON.parse(saved);
      if (d.s1) setS1((prev) => ({ ...prev, ...d.s1 }));
      if (d.s2) setS2((prev) => ({ ...prev, ...d.s2 }));
      if (Array.isArray(d.languagesKnown)) setLanguagesKnown(d.languagesKnown);
      if (d.availability) setAvailability(d.availability);
      if (d.timezone) setTimezone(d.timezone);
      if (d.s4) setS4((prev) => ({ ...prev, ...d.s4 }));
      if (d.payoutFreq) setPayoutFreq(d.payoutFreq);
      if (Array.isArray(d.licensedStates)) setLicensedStates(d.licensedStates);
      if (Array.isArray(d.otherLicenseCountries))
        setOtherLicenseCountries(d.otherLicenseCountries);
      if (d.step && d.step >= 1 && d.step <= 4) setStep(d.step);
    } catch {}
  }, [doctorId, initialData]);

  // Auto-detect timezone on mount.
  // Strategy:
  //   1. IMMEDIATELY set from browser's Intl API (synchronous, always works, no network needed).
  //   2. THEN try IP-based geolocation APIs for refinement (e.g. accurate when on VPN).
  //      Tries three free services in order; aborts after 5 s each.
  //   Uses "prev => prev || value" so a value already restored from draft/backend is never clobbered.
  useEffect(() => {
    // IANA aliases that some OS/browsers still emit (map to our list entries)
    const IANA_ALIASES = {
      "Asia/Calcutta": "Asia/Kolkata",
      "Asia/Saigon": "Asia/Ho_Chi_Minh",
      "Europe/Kiev": "Europe/Bucharest",
      "Asia/Ulaanbaatar": "Asia/Shanghai",
    };

    const matchTz = (iana) => {
      const canonical = IANA_ALIASES[iana] || iana;
      return (
        TIMEZONES.find((t) => t.startsWith(canonical)) ||
        TIMEZONES.find((t) => t.startsWith(iana)) ||
        iana // fallback: store raw IANA — the select will render it as an extra option
      );
    };

    // ── Step 1: immediate synchronous detection (never fails) ──────────────
    try {
      const iana = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (iana) setTimezone((prev) => prev || matchTz(iana));
    } catch {}

    // ── Step 2: async IP-based refinement (best-effort, 3 fallback APIs) ───
    const fetchTz = async (url, extract) => {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 5000);
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(tid);
        if (!res.ok) return null;
        const data = await res.json();
        return extract(data) || null;
      } catch {
        clearTimeout(tid);
        return null;
      }
    };

    (async () => {
      const tz =
        (await fetchTz("https://ipapi.co/json/", (d) => d.timezone)) ||
        (await fetchTz("https://worldtimeapi.org/api/ip", (d) => d.timezone)) ||
        (await fetchTz("https://ipwho.is/", (d) => d.timezone));
      if (tz) setTimezone((prev) => prev || matchTz(tz));
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!initialData) return;
    const nextStatus = ["pending", "approved", "rejected"].includes(
      initialData.approvalStatus,
    )
      ? initialData.approvalStatus
      : "pending";
    setRegStatus(nextStatus);

    if (initialData.formCompleted) {
      // Full form was already submitted — show status screen
      setStep(5);
    } else {
      // Resume from saved in-progress step when available.
      loadFromData(initialData);
      const apiStep = Number(initialData.currentStep);
      const apiCompleted = Number(initialData.completedSteps);
      let nextStep = 1;
      if (Number.isFinite(apiStep) && apiStep >= 1 && apiStep <= 4) {
        nextStep = Math.trunc(apiStep);
      } else if (Number.isFinite(apiCompleted)) {
        nextStep = Math.max(1, Math.min(4, Math.trunc(apiCompleted) + 1));
      }
      setStep(nextStep);
    }
    window.scrollTo(0, 0);
  }, [initialData, loadFromData]);

  const handleEditResubmit = () => {
    loadFromData(initialData);
    setStep(1);
  };

  const persistProgress = useCallback(
    (wizardStep) => {
      if (!doctorId) return;
      const normalizedStep = Math.max(1, Math.min(5, Number(wizardStep) || 1));
      if (normalizedStep >= 5) return;

      const completedSteps = Math.max(0, Math.min(4, normalizedStep - 1));
      const currentStep = Math.max(1, Math.min(4, normalizedStep));
      const progressKey = `${completedSteps}:${currentStep}`;
      if (lastProgressKeyRef.current === progressKey) return;
      lastProgressKeyRef.current = progressKey;

      if (progressSyncTimerRef.current)
        clearTimeout(progressSyncTimerRef.current);
      progressSyncTimerRef.current = setTimeout(() => {
        api
          .patch("/api/doctor/enrollment/progress", {
            doctorId,
            completedSteps,
            currentStep,
          })
          .catch(() => {});
      }, 250);
    },
    [doctorId],
  );

  useEffect(() => {
    persistProgress(step);
    window.scrollTo(0, 0);
  }, [step, persistProgress]);

  useEffect(() => {
    return () => {
      if (progressSyncTimerRef.current)
        clearTimeout(progressSyncTimerRef.current);
    };
  }, []);

  // Validation
  const validateS1 = () => {
    const e = {};
    if (!files.profilePhoto) e.profilePhoto = "Profile photo is required";
    else if (!files.profilePhoto.url)
      e.profilePhoto = "Please wait for the photo upload to complete";
    if (!s1.firstName.trim()) e.firstName = "Required";
    if (!s1.phone.trim()) e.phone = "Required";
    if (!s1.email.trim()) e.email = "Required";
    else if (!/\S+@\S+\.\S+/.test(s1.email)) e.email = "Invalid email";
    if (!s1.gender) e.gender = "Required";
    if (!s1.dob) e.dob = "Required";
    if (!s1.country) e.country = "Required";
    if (s1.country === "United States" && !s1.state.trim())
      e.state = "Required for US";
    if (languagesKnown.length === 0) e.languages = "Required";
    setS1Errors(e);
    return Object.keys(e).length === 0;
  };
  const validateS2 = () => {
    const e = {};
    if (isUS && !s2.npi.trim()) e.npi = "NPI required for US";
    if (!isUS && !s2.licenseNum.trim())
      e.licenseNum = "License number required";
    if (!s2.specialty) e.specialty = "Required";
    if (s2.specialty === "Other" && !s2.customSpecialty.trim())
      e.customSpecialty = "Required";
    if (!s2.qualification) e.qualification = "Required";
    if (!s2.school.trim()) e.school = "Required";
    if (!s2.gradYear.trim()) e.gradYear = "Required";
    if (!String(s2.experience).trim()) e.experience = "Required";
    if (!s2.consultantFees || Number(s2.consultantFees) <= 0)
      e.consultantFees = "Required";
    if (!files.degree) e.degree = "Required";
    else if (!files.degree.url)
      e.degree =
        "Upload still in progress or failed — please wait or re-upload";
    if (!files.medicalLicense) e.medicalLicense = "Required";
    else if (!files.medicalLicense.url)
      e.medicalLicense =
        "Upload still in progress or failed — please wait or re-upload";
    setS2Errors(e);
    return Object.keys(e).length === 0;
  };
  const validateS4 = () => {
    setS4Errors({});
    return true;
  };

  const handleNext = () => {
    if (submitBusy) return;
    if (step === 1 && validateS1()) setStep(2);
    else if (step === 2 && validateS2()) setStep(3);
    else if (step === 3) setStep(4);
    else if (step === 4 && validateS4()) submitEnrollment();
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };
  const saveDraft = useCallback(() => {
    if (!doctorId) return;
    const draftData = {
      s1,
      s2,
      languagesKnown,
      availability,
      timezone,
      s4,
      payoutFreq,
      licensedStates,
      otherLicenseCountries,
      step,
    };
    try {
      localStorage.setItem(
        `hc_enroll_draft_${doctorId}`,
        JSON.stringify(draftData),
      );
    } catch {}
    setDraftSaved(true);
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => setDraftSaved(false), 2500);
  }, [
    s1,
    s2,
    languagesKnown,
    availability,
    timezone,
    s4,
    payoutFreq,
    licensedStates,
    otherLicenseCountries,
    step,
    doctorId,
  ]);

  const submitEnrollment = async () => {
    if (!doctorId) {
      setSubmitError("Doctor session not found. Please sign in again.");
      return;
    }

    setSubmitBusy(true);
    setSubmitError("");
    setSubmitSuccess("");

    // Files are already uploaded to the server when the doctor selected them in Step 2.
    // files[x] = { name: string, url: string } — use the stored URL directly.
    const payload = {
      doctorId,
      firstName: s1.firstName.trim(),
      surname: s1.surname.trim(),
      email: s1.email.trim(),
      countryCode: s1.countryCode.trim(),
      phoneNumber: s1.phone.trim(),
      gender: s1.gender,
      dob: s1.dob,
      country: s1.country,
      state: licensedStates[0] || s1.state,
      city: s1.city.trim(),
      zip: s1.zip.trim(),
      address: s1.address.trim(),
      languagesKnown,
      specialization:
        s2.specialty === "Other"
          ? s2.customSpecialty.trim() || "Other"
          : s2.specialty,
      subSpecialization: s2.subSpecialization.trim(),
      qualification: s2.qualification,
      experience: s2.experience ? Number(s2.experience) : undefined,
      medicalSchool: s2.school.trim(),
      registrationYear: s2.gradYear.trim(),
      medicalCouncilName: s2.medicalCouncilName.trim(),
      medicalRegistrationNumber: isUS ? s2.npi.trim() : s2.licenseNum.trim(),
      medicalLicense: s2.licenseNum.trim(),
      consultationMode: s2.consultationMode,
      consultantFees: s2.consultantFees ? Number(s2.consultantFees) : 0,
      feeCurrency: s2.feeCurrency || "USD",
      clinicName: s2.clinicName.trim(),
      clinicAddress: s2.clinicAddress.trim(),
      aboutDoctor: s2.aboutDoctor.trim() || s2.certifications.trim(),
      profilePhoto: files.profilePhoto?.url || files.profilePhoto?.name || "",
      hasProfilePhoto: !!files.profilePhoto?.url,
      idProof: files.govId?.url || files.govId?.name || "",
      degreeFile: files.degree?.url || files.degree?.name || "",
      medicalLicenseFile:
        files.medicalLicense?.url || files.medicalLicense?.name || "",
      malpracticeInsuranceFile:
        files.malpractice?.url || files.malpractice?.name || "",
      accountHolderName: `${s1.firstName} ${s1.surname}`.trim(),
      payoutEmail: s1.email.trim(),
      bankName: s4.bankName.trim(),
      accountNumber: s4.accountNum.trim(),
      ifscCode: s4.swift.trim(),
      paypalId: s4.paypalId.trim(),
      availability,
      timezone,
    };

    try {
      const res = await api.post("/api/doctor/enrollment", payload);
      const enrollment = res.data?.enrollment || null;
      const nextStatus =
        enrollment?.approvalStatus === "approved" ? "approved" : "pending";
      setRegStatus(nextStatus);
      // setSubmitSuccess(res.data?.message || "Enrollment submitted successfully.");
      try {
        localStorage.removeItem(`hc_enroll_draft_${doctorId}`);
      } catch {}
      setStep(5);
      if (enrollment && typeof onComplete === "function")
        onComplete(enrollment);
    } catch (err) {
      setSubmitError(
        err.response?.data?.message ||
          "Failed to submit enrollment. Please try again.",
      );
    } finally {
      setSubmitBusy(false);
    }
  };

  // ─── STEP 1 ───
  const renderStep1 = () => (
    <div className="animate-in">
      <div className="de-card-header">
        <h2>Personal &amp; Contact Details</h2>
        <p>
          Enter your details exactly as they appear on your official documents.
        </p>
      </div>
      <div className="de-card-body">
        <ProfilePhotoUpload
          file={files.profilePhoto}
          onFile={(f) => setFiles({ ...files, profilePhoto: f })}
          onRemove={() => setFiles({ ...files, profilePhoto: null })}
          hasError={!!s1Errors.profilePhoto}
          errorMsg={s1Errors.profilePhoto}
        />
        <h4
          style={{
            fontSize: 13,
            margin: "24px 0 16px",
            color: "var(--gray-600)",
          }}
        >
          Name
        </h4>
        <div className="form-grid">
          <div className="field-group">
            <label className="field-label">
              First Name <span className="req">*</span>
            </label>
            <input
              className={`field-input ${s1Errors.firstName ? "error" : ""}`}
              placeholder="First name"
              value={s1.firstName}
              onChange={(e) => setS1({ ...s1, firstName: e.target.value })}
            />
            {s1Errors.firstName && (
              <div className="field-error">{s1Errors.firstName}</div>
            )}
          </div>
          <div className="field-group">
            <label className="field-label">Last Name</label>
            <input
              className="field-input"
              placeholder="Last name"
              value={s1.surname}
              onChange={(e) => setS1({ ...s1, surname: e.target.value })}
            />
          </div>
        </div>

        <h4
          style={{
            fontSize: 13,
            margin: "24px 0 16px",
            color: "var(--gray-600)",
          }}
        >
          Contact
        </h4>
        <div className="form-grid">
          <div className="field-group">
            <label className="field-label">
              Mobile Number <span className="req">*</span>
            </label>
            <div className={`de-phone-input ${s1Errors.phone ? "error" : ""}`}>
              <PhoneInputField
                value={s1.countryCode + s1.phone}
                onChange={handleMobileChange}
                onCountryChange={handleMobileCountryChange}
                defaultCountry={phoneCountryCode}
                placeholder="Mobile number"
                showCountryNameInDropdown={true}
              />
            </div>
            {s1Errors.phone && (
              <div className="field-error">{s1Errors.phone}</div>
            )}
          </div>
          <div className="field-group">
            <label className="field-label">
              Email Address <span className="req">*</span>
            </label>
            <input
              className={`field-input ${s1Errors.email ? "error" : ""}`}
              placeholder="doctor@email.com"
              type="email"
              value={s1.email}
              onChange={(e) => setS1({ ...s1, email: e.target.value })}
            />
            {s1Errors.email && (
              <div className="field-error">{s1Errors.email}</div>
            )}
          </div>
          <div className="field-group">
            <label className="field-label">
              Gender <span className="req">*</span>
            </label>
            <select
              className={`field-select ${s1Errors.gender ? "error" : ""}`}
              value={s1.gender}
              onChange={(e) => setS1({ ...s1, gender: e.target.value })}
            >
              <option value="">Select...</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            {s1Errors.gender && (
              <div className="field-error">{s1Errors.gender}</div>
            )}
          </div>
          <div className="field-group">
            <label className="field-label">
              Date of Birth <span className="req">*</span>
            </label>
            <DatePickerField
              value={s1.dob}
              onChange={(v) => setS1({ ...s1, dob: v })}
              min="1900-01-01"
              max={new Date().toISOString().slice(0, 10)}
              placeholder="Select date of birth"
            />
            {s1Errors.dob && <div className="field-error">{s1Errors.dob}</div>}
          </div>
        </div>

        <h4
          style={{
            fontSize: 13,
            margin: "24px 0 16px",
            color: "var(--gray-600)",
          }}
        >
          Location
        </h4>
        <div className="form-grid">
          <div className="field-group full-width">
            <label className="field-label">
              Country <span className="req">*</span>
            </label>

            <select
              className={`field-select ${s1Errors.country ? "error" : ""}`}
              value={s1.country}
              onChange={(e) =>
                setS1((prev) => ({
                  ...prev,
                  country: e.target.value,
                  state: "",
                  city: "",
                }))
              }
            >
              <option value="">Select country...</option>

              {countries.map((country) => (
                <option key={country.isoCode} value={country.isoCode}>
                  {country.name}
                </option>
              ))}
            </select>
            {s1Errors.country && (
              <div className="field-error">{s1Errors.country}</div>
            )}
            {!hasStates && !hasCities && s1.country && (
              <div
                style={{
                  fontSize: 13,
                  color: "var(--red-500)",
                  marginTop: 6,
                }}
              >
                This country does not have state or city data available.
              </div>
            )}
          </div>
          <div className="location-row">
            {hasStates && (
              <div className="field-group">
                <label className="field-label">
                  State / Province
                  {s1.country === "United States" && (
                    <span className="req">*</span>
                  )}
                  {!s1.country && (
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "red",
                        marginLeft: "auto",
                      }}
                    >
                      ⓘ Select country first
                    </span>
                  )}
                </label>
                <select
                  className={`field-select ${s1Errors.state ? "error" : ""}`}
                  value={s1.state}
                  disabled={!s1.country}
                  onChange={(e) =>
                    setS1((prev) => ({
                      ...prev,
                      state: e.target.value,
                      city: "",
                    }))
                  }
                >
                  <option value="">Select state</option>

                  {states.map((state) => (
                    <option key={state.isoCode} value={state.isoCode}>
                      {state.name}
                    </option>
                  ))}
                </select>
                {s1Errors.state && (
                  <div className="field-error">{s1Errors.state}</div>
                )}
              </div>
            )}
            {hasCities && (
              <div className="field-group">
                <label className="field-label">
                  City
                  {!s1.state && (
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "red",
                        marginLeft: "auto",
                      }}
                    >
                      ⓘ Select state first
                    </span>
                  )}
                </label>
                <select
                  className="field-select"
                  value={s1.city}
                  disabled={!s1.state}
                  onChange={(e) =>
                    setS1((prev) => ({
                      ...prev,
                      city: e.target.value,
                    }))
                  }
                >
                  <option value="">Select city</option>

                  {cities.map((city) => (
                    <option key={city.name} value={city.name}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="field-group">
              <label className="field-label">ZIP / Postal Code</label>
              <input
                className="field-input"
                placeholder="ZIP or postal code"
                value={s1.zip}
                onChange={(e) => setS1({ ...s1, zip: e.target.value })}
              />
            </div>
          </div>

          <div className="field-group full-width">
            <label className="field-label">Street Address</label>
            <input
              className="field-input"
              placeholder="Full street address"
              value={s1.address}
              onChange={(e) => setS1({ ...s1, address: e.target.value })}
            />
          </div>
        </div>

        <h4
          style={{
            fontSize: 13,
            margin: "24px 0 16px",
            color: "var(--gray-600)",
          }}
        >
          Languages
        </h4>
        <div className="field-group">
          <label className="field-label">
            Languages Known <span className="req">*</span>
          </label>
          <MultiSelect
            items={LANGUAGES}
            selected={languagesKnown}
            onChange={setLanguagesKnown}
            placeholder="Select languages you speak..."
            searchPlaceholder="Search languages..."
            hasError={!!s1Errors.languages}
          />
          {s1Errors.languages && (
            <div className="field-error">{s1Errors.languages}</div>
          )}
        </div>

        <div className="btn-row">
          <div />
          <button className="btn btn-primary" onClick={handleNext}>
            Continue to Professional Info →
          </button>
        </div>
      </div>
    </div>
  );

  // ─── STEP 2 ───
  const renderStep2 = () => (
    <div className="animate-in">
      <div className="de-card-header">
        <h2>Professional Information</h2>
        <p>
          Provide your medical credentials, licensing details, and upload
          required documents.
        </p>
      </div>
      <div className="de-card-body">
        <h4
          style={{ fontSize: 13, marginBottom: 16, color: "var(--gray-600)" }}
        >
          Credentials &amp; Licensing
        </h4>
        <div className="form-grid">
          {isUS ? (
            <div className="field-group">
              <label className="field-label">
                NPI Number <span className="req">*</span>
              </label>
              <input
                className={`field-input ${s2Errors.npi ? "error" : ""}`}
                placeholder="10-digit NPI"
                value={s2.npi}
                onChange={(e) => setS2({ ...s2, npi: e.target.value })}
              />
              {s2Errors.npi && (
                <div className="field-error">{s2Errors.npi}</div>
              )}
            </div>
          ) : (
            <div className="field-group">
              <label className="field-label">
                Medical License Number <span className="req">*</span>
              </label>
              <input
                className={`field-input ${s2Errors.licenseNum ? "error" : ""}`}
                placeholder="License number"
                value={s2.licenseNum}
                onChange={(e) => setS2({ ...s2, licenseNum: e.target.value })}
              />
              {s2Errors.licenseNum && (
                <div className="field-error">{s2Errors.licenseNum}</div>
              )}
            </div>
          )}
          <div className="field-group">
            <label className="field-label">Medical Council Name</label>
            <input
              className="field-input"
              placeholder="e.g. MCI, GMC, AMA"
              value={s2.medicalCouncilName}
              onChange={(e) =>
                setS2({ ...s2, medicalCouncilName: e.target.value })
              }
            />
          </div>
          <div className="field-group">
            <label className="field-label">
              Specialty <span className="req">*</span>
            </label>
            <SingleSelect
              items={SPECIALTIES}
              value={s2.specialty}
              onChange={(v) =>
                setS2({
                  ...s2,
                  specialty: v,
                  customSpecialty: v !== "Other" ? "" : s2.customSpecialty,
                })
              }
              placeholder="Select specialty..."
              hasError={!!s2Errors.specialty}
            />
            {s2Errors.specialty && (
              <div className="field-error">{s2Errors.specialty}</div>
            )}
          </div>
          {s2.specialty === "Other" && (
            <div className="field-group">
              <label className="field-label">
                Specify Your Specialty <span className="req">*</span>
              </label>
              <input
                className={`field-input ${s2Errors.customSpecialty ? "error" : ""}`}
                placeholder="e.g. Sports Medicine, Addiction Psychiatry..."
                value={s2.customSpecialty}
                onChange={(e) =>
                  setS2({ ...s2, customSpecialty: e.target.value })
                }
                autoFocus
              />
              {s2Errors.customSpecialty && (
                <div className="field-error">{s2Errors.customSpecialty}</div>
              )}
            </div>
          )}
          <div className="field-group">
            <label className="field-label">Sub-Specialization</label>
            <input
              className="field-input"
              placeholder="e.g. Interventional Cardiology"
              value={s2.subSpecialization}
              onChange={(e) =>
                setS2({ ...s2, subSpecialization: e.target.value })
              }
            />
          </div>
          <div className="field-group">
            <label className="field-label">
              Qualification <span className="req">*</span>
            </label>
            <select
              className={`field-select ${s2Errors.qualification ? "error" : ""}`}
              value={s2.qualification}
              onChange={(e) => setS2({ ...s2, qualification: e.target.value })}
            >
              <option value="">Select...</option>
              {QUALIFICATIONS.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
            {s2Errors.qualification && (
              <div className="field-error">{s2Errors.qualification}</div>
            )}
          </div>
          <div className="field-group">
            <label className="field-label">
              Years of Experience <span className="req">*</span>
            </label>
            <input
              className={`field-input ${s2Errors.experience ? "error" : ""}`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="e.g. 10"
              value={s2.experience}
              onChange={(e) =>
                setS2({
                  ...s2,
                  experience: e.target.value.replace(/[^0-9]/g, ""),
                })
              }
              onKeyDown={(e) => {
                const allowed = [
                  "Backspace",
                  "Delete",
                  "ArrowLeft",
                  "ArrowRight",
                  "ArrowUp",
                  "ArrowDown",
                  "Tab",
                  "Enter",
                  "Home",
                  "End",
                ];
                if (!allowed.includes(e.key) && !/^[0-9]$/.test(e.key))
                  e.preventDefault();
              }}
            />
            {s2Errors.experience && (
              <div className="field-error">{s2Errors.experience}</div>
            )}
          </div>
        </div>

        {/* ═══ STATE / PROVINCE LICENSING ═══ */}
        {stateConfig && (
          <div className="license-section animate-in">
            <div className="license-section-header">
              <div className="ls-icon state">🏛️</div>
              <h4>
                {stateConfig.label} Licensing — {s1.country}
              </h4>
            </div>
            <p className="ls-desc">
              In {s1.country}, doctors require {stateConfig.label.toLowerCase()}
              -level licensing. Select all {stateConfig.plural.toLowerCase()}{" "}
              where you are currently licensed to practice medicine.
            </p>
            <div className="field-group">
              <label className="field-label">
                Licensed {stateConfig.plural}
              </label>
              <MultiSelect
                items={stateConfig.items}
                selected={licensedStates}
                onChange={setLicensedStates}
                placeholder={`Select ${stateConfig.plural.toLowerCase()}...`}
                searchPlaceholder={`Search ${stateConfig.plural.toLowerCase()}...`}
              />
            </div>
            {licensedStates.length > 0 && (
              <div className="selected-licenses-grid">
                {licensedStates.map((st) => (
                  <div key={st} className="sel-license-card">
                    <div className="sl-dot" />
                    {st}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ INTERNATIONAL LICENSES ═══ */}
        <div
          className="license-section animate-in"
          style={{ marginTop: stateConfig ? 16 : 24 }}
        >
          <div className="license-section-header">
            <div className="ls-icon intl">🌍</div>
            <h4>International Medical Licenses</h4>
          </div>
          <p className="ls-desc">
            Do you hold a valid medical license in any other countries besides{" "}
            {s1.country || "your primary country"}? This helps us determine
            cross-border telehealth eligibility and widen your patient reach.
          </p>
          <div className="field-group">
            <label className="field-label">
              Other Countries Where You Hold a Medical License
            </label>
            <MultiSelect
              items={otherCountryOptions}
              selected={otherLicenseCountries}
              onChange={setOtherLicenseCountries}
              placeholder="Select countries (if applicable)..."
              searchPlaceholder="Search countries..."
              showFlags={true}
            />
          </div>
          {otherLicenseCountries.length > 0 && (
            <div className="selected-licenses-grid">
              {otherLicenseCountries.map((c) => (
                <div key={c} className="sel-license-card">
                  <div
                    className="sl-dot"
                    style={{ background: "var(--gold)" }}
                  />
                  {c}
                </div>
              ))}
            </div>
          )}
        </div>

        <h4
          style={{
            fontSize: 13,
            margin: "24px 0 16px",
            color: "var(--gray-600)",
          }}
        >
          Education
        </h4>
        <div className="form-grid">
          <div className="field-group">
            <label className="field-label">
              Medical School <span className="req">*</span>
            </label>
            <input
              className={`field-input ${s2Errors.school ? "error" : ""}`}
              placeholder="School name"
              value={s2.school}
              onChange={(e) => setS2({ ...s2, school: e.target.value })}
            />
            {s2Errors.school && (
              <div className="field-error">{s2Errors.school}</div>
            )}
          </div>
          <div className="field-group">
            <label className="field-label">
              Graduation Year <span className="req">*</span>
            </label>
            <input
              className={`field-input ${s2Errors.gradYear ? "error" : ""}`}
              placeholder="YYYY"
              value={s2.gradYear}
              onChange={(e) => setS2({ ...s2, gradYear: e.target.value })}
            />
            {s2Errors.gradYear && (
              <div className="field-error">{s2Errors.gradYear}</div>
            )}
          </div>
          <div className="field-group full-width">
            <label className="field-label">Additional Certifications</label>
            <textarea
              className="field-textarea"
              placeholder="Board certifications, fellowships, etc."
              value={s2.certifications}
              onChange={(e) => setS2({ ...s2, certifications: e.target.value })}
            />
          </div>
        </div>

        <h4
          style={{
            fontSize: 13,
            margin: "24px 0 16px",
            color: "var(--gray-600)",
          }}
        >
          Consultation &amp; Practice
        </h4>
        <div className="form-grid">
          <div className="field-group">
            <label className="field-label">
              Consultation Fee <span className="req">*</span>
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                border: `1.5px solid ${s2Errors.consultantFees ? "var(--red)" : "var(--gray-200)"}`,
                borderRadius: "var(--radius-sm)",
                overflow: "hidden",
                background: "var(--white)",
                boxShadow: s2Errors.consultantFees
                  ? "0 0 0 3px rgba(220,38,38,0.08)"
                  : "none",
              }}
            >
              <select
                value={s2.feeCurrency}
                onChange={(e) => setS2({ ...s2, feeCurrency: e.target.value })}
                style={{
                  padding: "11px 10px",
                  background: "var(--gray-100)",
                  color: "var(--gray-700)",
                  fontWeight: 700,
                  borderRight: "1.5px solid var(--gray-200)",
                  fontSize: 13,
                  border: "none",
                  outline: "none",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {[
                  "USD",
                  "INR",
                  "GBP",
                  "EUR",
                  "AUD",
                  "CAD",
                  "AED",
                  "SAR",
                  "SGD",
                  "JPY",
                ].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                className="field-input"
                style={{ border: "none", borderRadius: 0, boxShadow: "none" }}
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 500"
                value={s2.consultantFees}
                onChange={(e) =>
                  setS2({ ...s2, consultantFees: e.target.value })
                }
              />
            </div>
            {s2Errors.consultantFees && (
              <div className="field-error">{s2Errors.consultantFees}</div>
            )}
          </div>
          <div className="field-group">
            <label className="field-label">Clinic / Practice Name</label>
            <input
              className="field-input"
              placeholder="e.g. City Health Clinic"
              value={s2.clinicName}
              onChange={(e) => setS2({ ...s2, clinicName: e.target.value })}
            />
          </div>
          <div className="field-group">
            <label className="field-label">Clinic Address</label>
            <input
              className="field-input"
              placeholder="Clinic street address"
              value={s2.clinicAddress}
              onChange={(e) => setS2({ ...s2, clinicAddress: e.target.value })}
            />
          </div>
          <div className="field-group full-width">
            <label className="field-label">About You</label>
            <textarea
              className="field-textarea"
              placeholder="Brief professional bio, areas of focus, patient care philosophy..."
              value={s2.aboutDoctor}
              onChange={(e) => setS2({ ...s2, aboutDoctor: e.target.value })}
            />
          </div>
        </div>

        <h4
          style={{
            fontSize: 13,
            margin: "24px 0 16px",
            color: "var(--gray-600)",
          }}
        >
          Required Documents
        </h4>
        <div className="form-grid">
          <FileUpload
            label="Medical Degree Certificate"
            required
            file={files.degree}
            onFile={(f) => setFiles({ ...files, degree: f })}
            onRemove={() => setFiles({ ...files, degree: null })}
          />
          <FileUpload
            label="Medical License Document"
            required
            file={files.medicalLicense}
            onFile={(f) => setFiles({ ...files, medicalLicense: f })}
            onRemove={() => setFiles({ ...files, medicalLicense: null })}
          />
          <FileUpload
            label="Government ID / Nationality Proof"
            file={files.govId}
            onFile={(f) => setFiles({ ...files, govId: f })}
            onRemove={() => setFiles({ ...files, govId: null })}
          />
          <FileUpload
            label="Malpractice Insurance License"
            file={files.malpractice}
            onFile={(f) => setFiles({ ...files, malpractice: f })}
            onRemove={() => setFiles({ ...files, malpractice: null })}
          />
        </div>
        {(s2Errors.degree || s2Errors.medicalLicense) && (
          <div className="field-error" style={{ marginTop: 8 }}>
            Please upload all required documents (Medical Degree &amp; License).
          </div>
        )}

        <div className="btn-row">
          <button className="btn btn-secondary" onClick={handleBack}>
            ← Back
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="btn btn-sm"
              onClick={saveDraft}
              style={
                draftSaved
                  ? {
                      background: "rgba(37,99,235,0.1)",
                      color: "var(--teal)",
                      border: "1.5px solid var(--teal)",
                    }
                  : {
                      background: "transparent",
                      border: "1.5px solid var(--gray-200)",
                      color: "var(--navy)",
                    }
              }
            >
              {draftSaved ? "Saved ✓" : "Save Draft"}
            </button>
            <button className="btn btn-primary" onClick={handleNext}>
              Continue →
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── STEP 3 ───
  const toggleDay = (day) =>
    setAvailability((p) => ({
      ...p,
      [day]: { ...p[day], enabled: !p[day].enabled },
    }));
  const updateBlock = (day, idx, field, val) =>
    setAvailability((p) => {
      const blocks = [...p[day].blocks];
      blocks[idx] = { ...blocks[idx], [field]: val };
      return { ...p, [day]: { ...p[day], blocks } };
    });
  const addBlock = (day) =>
    setAvailability((p) => ({
      ...p,
      [day]: {
        ...p[day],
        blocks: [...p[day].blocks, { start: "09:00", end: "17:00" }],
      },
    }));
  const removeBlock = (day, idx) =>
    setAvailability((p) => {
      const blocks = p[day].blocks.filter((_, i) => i !== idx);
      return {
        ...p,
        [day]: {
          ...p[day],
          blocks: blocks.length ? blocks : [{ start: "09:00", end: "17:00" }],
        },
      };
    });

  const renderStep3 = () => (
    <div className="animate-in">
      <div className="de-card-header">
        <h2>Availability Setup</h2>
        <p>
          Set your weekly schedule. Patients will book based on these time
          slots.
        </p>
      </div>
      <div className="de-card-body">
        <div className="field-group" style={{ marginBottom: 20 }}>
          <label className="field-label">
            Timezone <span className="req">*</span>
          </label>
          <select
            className="field-select"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            <option value="">Select timezone...</option>
            {/* If the auto-detected IANA is not in our standard list, render it as an extra option
                so the select always reflects the detected value rather than showing blank */}
            {timezone && !TIMEZONES.includes(timezone) && (
              <option value={timezone}>🌐 {timezone} (auto-detected)</option>
            )}
            {TIMEZONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {timezone && (
            <div
              style={{ fontSize: 11, color: "var(--gray-500)", marginTop: 4 }}
            >
              🌐 Auto-detected: <strong>{timezone}</strong> — you can change
              this if needed.
            </div>
          )}
        </div>
        {DAYS.map((day) => (
          <div key={day} className="avail-day">
            <div className="avail-day-header">
              <span className="avail-day-name">{day}</span>
              <button
                className={`avail-toggle ${availability[day].enabled ? "on" : ""}`}
                onClick={() => toggleDay(day)}
                aria-label={`Toggle ${day}`}
              />
            </div>
            {availability[day].enabled && (
              <div className="animate-in">
                {availability[day].blocks.map((block, i) => (
                  <div key={i} className="time-block">
                    <input
                      type="time"
                      className="time-input"
                      value={block.start}
                      onChange={(e) =>
                        updateBlock(day, i, "start", e.target.value)
                      }
                    />
                    <span className="time-sep">to</span>
                    <input
                      type="time"
                      className="time-input"
                      value={block.end}
                      onChange={(e) =>
                        updateBlock(day, i, "end", e.target.value)
                      }
                    />
                    {availability[day].blocks.length > 1 && (
                      <button
                        className="btn btn-danger btn-xs"
                        onClick={() => removeBlock(day, i)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  className="btn btn-outline btn-xs"
                  style={{ marginTop: 4 }}
                  onClick={() => addBlock(day)}
                >
                  + Add Time Block
                </button>
              </div>
            )}
          </div>
        ))}
        <div className="btn-row">
          <button className="btn btn-secondary" onClick={handleBack}>
            ← Back
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="btn btn-sm"
              onClick={saveDraft}
              style={
                draftSaved
                  ? {
                      background: "rgba(37,99,235,0.1)",
                      color: "var(--teal)",
                      border: "1.5px solid var(--teal)",
                    }
                  : {
                      background: "transparent",
                      border: "1.5px solid var(--gray-200)",
                      color: "var(--navy)",
                    }
              }
            >
              {draftSaved ? "Saved ✓" : "Save Draft"}
            </button>
            <button className="btn btn-primary" onClick={handleNext}>
              Continue →
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── STEP 4 ───
  const renderStep4 = () => (
    <div className="animate-in">
      <div className="de-card-header">
        <h2>Payout Setup</h2>
        <p>
          Configure how and when you'd like to receive payments.
          {isUS
            ? " US banking details required."
            : " International transfer details required."}
        </p>
      </div>
      <div className="de-card-body">
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          {["weekly", "monthly"].map((f) => (
            <button
              key={f}
              className={`btn ${payoutFreq === f ? "btn-primary" : "btn-outline"} btn-sm`}
              onClick={() => setPayoutFreq(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)} Payout
            </button>
          ))}
        </div>
        {isUS ? (
          <div className="form-grid">
            <div className="field-group">
              <label className="field-label">Bank Name</label>
              <input
                className="field-input"
                placeholder="Bank name"
                value={s4.bankName}
                onChange={(e) => setS4({ ...s4, bankName: e.target.value })}
              />
            </div>
            <div className="field-group">
              <label className="field-label">Account Number</label>
              <input
                className="field-input"
                placeholder="Account number"
                value={s4.accountNum}
                onChange={(e) => setS4({ ...s4, accountNum: e.target.value })}
              />
            </div>
            <div className="field-group">
              <label className="field-label">SWIFT / BIC Code</label>
              <input
                className="field-input"
                placeholder="SWIFT code"
                value={s4.swift}
                onChange={(e) => setS4({ ...s4, swift: e.target.value })}
              />
            </div>
            <div className="field-group">
              <label className="field-label">PayPal ID</label>
              <input
                className="field-input"
                placeholder="PayPal email or username"
                value={s4.paypalId}
                onChange={(e) => setS4({ ...s4, paypalId: e.target.value })}
              />
            </div>
          </div>
        ) : (
          <div className="form-grid">
            <div className="field-group">
              <label className="field-label">IBAN</label>
              <input
                className="field-input"
                placeholder="International Bank Account Number"
                value={s4.iban}
                onChange={(e) => setS4({ ...s4, iban: e.target.value })}
              />
            </div>
            <div className="field-group">
              <label className="field-label">SWIFT / BIC Code</label>
              <input
                className="field-input"
                placeholder="SWIFT code"
                value={s4.swift}
                onChange={(e) => setS4({ ...s4, swift: e.target.value })}
              />
            </div>
            <div className="field-group">
              <label className="field-label">PayPal ID</label>
              <input
                className="field-input"
                placeholder="PayPal email or username"
                value={s4.paypalId}
                onChange={(e) => setS4({ ...s4, paypalId: e.target.value })}
              />
            </div>
          </div>
        )}
        {submitError && (
          <div className="field-error" style={{ marginTop: 12 }}>
            {submitError}
          </div>
        )}
        {submitSuccess && (
          <div className="success-banner" style={{ marginTop: 12 }}>
            {submitSuccess}
          </div>
        )}
        <div className="btn-row">
          <button className="btn btn-secondary" onClick={handleBack}>
            ← Back
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="btn btn-sm"
              onClick={saveDraft}
              style={
                draftSaved
                  ? {
                      background: "rgba(37,99,235,0.1)",
                      color: "var(--teal)",
                      border: "1.5px solid var(--teal)",
                    }
                  : {
                      background: "transparent",
                      border: "1.5px solid var(--gray-200)",
                      color: "var(--navy)",
                    }
              }
            >
              {draftSaved ? "Saved ✓" : "Save Draft"}
            </button>
            <button
              className="btn btn-primary"
              onClick={handleNext}
              disabled={submitBusy}
            >
              {submitBusy ? "Submitting..." : "Submit Application →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── STEP 5 ───
  const approvalPipeline = [
    { key: "pending", label: "Awaiting Approval", icon: "⏳" },
    { key: "approved", label: "Approved", icon: "✅" },
  ];
  const statusIdx = approvalPipeline.findIndex((s) => s.key === regStatus);
  const safeStatusIdx = statusIdx === -1 ? 0 : statusIdx;
  const isRejected = regStatus === "rejected";
  const renderStep5 = () => (
    <div className="animate-in">
      <div className="de-card-header">
        <h2>Registration Status</h2>
        <p>
          Your application has been submitted and sent to admin for approval.
        </p>
      </div>
      <div className="de-card-body">
        <div className="status-dashboard">
          <div className="status-pipeline">
            <div className="status-line-bg" />
            <div
              className="status-line-fill"
              style={{
                width: `${(safeStatusIdx / (approvalPipeline.length - 1)) * 80}%`,
              }}
            />
            {approvalPipeline.map((st, i) => (
              <div key={st.key} className="status-node">
                <div
                  className={`status-dot ${i < safeStatusIdx ? "reached" : ""} ${i === safeStatusIdx ? "current" : ""}`}
                >
                  <span className="st-icon">{st.icon}</span>
                </div>
                <div
                  className={`status-name ${i < safeStatusIdx ? "reached" : ""} ${i === safeStatusIdx ? "current" : ""}`}
                >
                  {st.label}
                </div>
              </div>
            ))}
          </div>
          <div className="status-info-card">
            <h3>
              {isRejected
                ? "❌ Rejected"
                : `${approvalPipeline[safeStatusIdx]?.icon} ${approvalPipeline[safeStatusIdx]?.label}`}
            </h3>
            <p>
              {regStatus === "pending" &&
                "Your request has been sent to admin and is awaiting approval."}
              {regStatus === "approved" &&
                "Your application has been approved by admin."}
              {regStatus === "rejected" &&
                "Your application was rejected by admin. Please update details and resubmit."}
            </p>
          </div>
          <div
            style={{
              marginTop: 20,
              padding: 16,
              background: "var(--gray-50)",
              borderRadius: "var(--radius-sm)",
              border: "1px dashed var(--gray-300)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--gray-500)",
              }}
            >
              Status updates are managed by admin review.
            </div>
          </div>
          {regStatus === "approved" && (
            <div style={{ marginTop: 16 }}>
              <div
                className="success-banner animate-in"
                style={{ marginBottom: 12 }}
              >
                ✓ Approved by admin — your profile is now live on the platform.
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => navigate("/doctor-dashboard")}
              >
                Go to Dashboard →
              </button>
            </div>
          )}
          {regStatus === "pending" && (
            <div
              style={{
                marginTop: 16,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                className="btn btn-outline btn-sm"
                onClick={handleEditResubmit}
              >
                Edit Application
              </button>
              {/* <button
                className="btn btn-primary btn-sm"
                onClick={() => navigate("/doctor-pending")}
              >
                View Application Status →
              </button> */}
            </div>
          )}
          {regStatus === "rejected" && (
            <div
              style={{
                marginTop: 16,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                className="btn btn-primary btn-sm"
                onClick={handleEditResubmit}
              >
                Edit &amp; Resubmit
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => navigate("/doctor-dashboard/enrollments")}
              >
                View Status
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // --- MAIN RENDER ---
  return (
    <>
      <style>{css}</style>
      <div className="wizard-root">
        <div className="top-bar">
          <div className="top-bar-logo">
            Humancare<span>Connect</span>
          </div>
          {step < 5 && (
            <div
              className="draft-badge"
              style={
                draftSaved
                  ? { background: "rgba(37,99,235,0.2)", color: "#93c5fd" }
                  : {}
              }
            >
              <div className="dot" />{" "}
              {draftSaved ? "Draft Saved ✓" : "In Progress"}
            </div>
          )}
        </div>

        <div className="progress-section">
          <div className="progress-steps">
            <div className="progress-line-bg" />
            <div
              className="progress-line-fill"
              style={{
                width: `${((step - 1) / (STEP_LABELS.length - 1)) * 80}%`,
              }}
            />
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="progress-step">
                <div
                  className={`progress-circle ${i + 1 === step ? "active" : ""} ${i + 1 < step ? "done" : ""}`}
                >
                  {i + 1 < step ? "✓" : i + 1}
                </div>
                <div
                  className={`progress-label ${i + 1 === step ? "active" : ""} ${i + 1 < step ? "done" : ""}`}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="de-step-card">
          <div className="de-card">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
            {step === 5 && renderStep5()}
          </div>
        </div>
      </div>
    </>
  );
}
