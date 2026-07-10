import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import api, { normalizeFileUrl } from "../../api";
import { useDoctorAuth } from "../../context/DoctorAuthContext";
import { uploadFileDirectToS3 } from "../../utils/directUpload";
import { Country, State } from "country-state-city";
import "./DoctorProfile.css";
import PhoneInputField, {
  COUNTRIES as PHONE_COUNTRIES,
} from "../../components/PhoneInputField";

// Helper functions to convert ISO codes to display names
const getCountryName = (isoCode) => {
  if (!isoCode) return "";
  const country = Country.getCountryByCode(isoCode);
  return country?.name || isoCode;
};

const getStateName = (stateIsoCode, countryIsoCode) => {
  if (!stateIsoCode || !countryIsoCode) return "";
  const state = State.getStateByCodeAndCountry(stateIsoCode, countryIsoCode);
  return state?.name || stateIsoCode;
};

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

const getCountryCodeFromDialCode = (dialCode) => {
  if (!dialCode) return "auto";
  const cleanDial = String(dialCode).replace(/\D/g, "");
  const country = PHONE_COUNTRIES.find((c) => c.dial === cleanDial);
  return country?.code || "auto";
};

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];
const QUALIFICATIONS = ["MD", "DO", "NP", "PA", "Other"];
const CONSULTATION_MODES = ["Video Call", "In-Person", "Both", "Phone Call"];
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
const COUNTRIES = [
  "United States",
  "United Kingdom",
  "India",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Brazil",
  "Mexico",
  "South Africa",
  "Nigeria",
  "Kenya",
  "UAE",
  "Saudi Arabia",
  "Singapore",
  "Japan",
  "South Korea",
  "Philippines",
  "Pakistan",
  "Bangladesh",
  "Other",
];
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
const DOCUMENT_FIELDS = new Set([
  "profilePhoto",
  "idProof",
  "degreeFile",
  "medicalLicenseFile",
  "malpracticeInsuranceFile",
]);
const TIMEZONES = [
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
  "Africa/Cairo (EET)",
  "Africa/Lagos (WAT)",
  "Africa/Nairobi (EAT)",
  "Africa/Johannesburg (SAST)",
  "Africa/Casablanca (WET)",
  "Africa/Accra (GMT)",
  "Africa/Abidjan (GMT)",
  "Africa/Addis_Ababa (EAT)",
  "Africa/Dar_es_Salaam (EAT)",
  "Asia/Dubai (GST)",
  "Asia/Riyadh (AST)",
  "Asia/Baghdad (AST)",
  "Asia/Tehran (IRST)",
  "Asia/Kuwait (AST)",
  "Asia/Muscat (GST)",
  "Asia/Bahrain (AST)",
  "Asia/Kolkata (IST)",
  "Asia/Kathmandu (NPT)",
  "Asia/Dhaka (BST)",
  "Asia/Karachi (PKT)",
  "Asia/Colombo (IST)",
  "Asia/Kabul (AFT)",
  "Asia/Bangkok (ICT)",
  "Asia/Jakarta (WIB)",
  "Asia/Yangon (MMT)",
  "Asia/Singapore (SGT)",
  "Asia/Kuala_Lumpur (MYT)",
  "Asia/Manila (PHT)",
  "Asia/Phnom_Penh (ICT)",
  "Asia/Ho_Chi_Minh (ICT)",
  "Asia/Vientiane (ICT)",
  "Asia/Hong_Kong (HKT)",
  "Asia/Shanghai (CST)",
  "Asia/Taipei (CST)",
  "Asia/Seoul (KST)",
  "Asia/Tokyo (JST)",
  "Asia/Tashkent (UZT)",
  "Asia/Almaty (ALMT)",
  "Asia/Yekaterinburg (YEKT)",
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
const DEFAULT_DAY_BLOCK = {
  enabled: false,
  blocks: [{ start: "09:00", end: "17:00" }],
};
const buildDefaultAvailability = (existing = {}) =>
  Object.fromEntries(
    DAYS.map((d) => [
      d,
      existing[d] ?? {
        ...DEFAULT_DAY_BLOCK,
        blocks: [{ start: "09:00", end: "17:00" }],
      },
    ]),
  );

const STATUS_META = {
  pending: { label: "Pending", bg: "#fef3c7", color: "#92400e" },
  approved: { label: "Approved", bg: "#dcfce7", color: "#166534" },
  rejected: { label: "Rejected", bg: "#fee2e2", color: "#991b1b" },
};
const REQUEST_META = {
  pending: {
    label: "Profile Update Pending",
    bg: "#fffbeb",
    border: "#fde68a",
    color: "#92400e",
    text: "Your submitted profile changes are waiting for admin review. Your dashboard access remains active.",
  },
  approved: {
    label: "Profile Update Approved",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    color: "#166534",
    text: "Your latest profile update request was approved.",
  },
  rejected: {
    label: "Profile Update Rejected",
    bg: "#fff1f2",
    border: "#fecdd3",
    color: "#991b1b",
    text: "Your latest profile update request was rejected. Your previously approved profile remains active.",
  },
};

// ─── Unique prefix: drprofile__  (prevents any global CSS collision) ───
const CSS = `
/* ════ SCOPE: drprofile__ ════ */

/* Page shell */
.drprofile__wrap { max-width:980px; margin:0 auto; padding-bottom:40px; }
.drprofile__topnav { display:flex; align-items:center; justify-content:space-between; gap:14px; margin-bottom:24px; }
.drprofile__kicker { font-size:12px; color:#94a3b8; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
.drprofile__title  { margin:0; font-size:20px; font-weight:800; color:#0f172a; }

/* Hero banner */
.drprofile__hero { background:linear-gradient(135deg,#1e3a5f 0%,#1d4ed8 100%); border-radius:16px; padding:24px 28px; margin-bottom:20px; display:flex; align-items:flex-start; gap:20px; flex-wrap:wrap; }
.drprofile__avatar { width:72px; height:72px; border-radius:50%; overflow:hidden; border:2.5px solid rgba(255,255,255,.5); flex-shrink:0; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,.18); color:#fff; font-size:26px; font-weight:800; }
.drprofile__avatar img { width:100%; height:100%; object-fit:cover; display:block; }
.drprofile__hero-main { flex:1; min-width:200px; }
.drprofile__hero-name { font-size:22px; font-weight:800; color:#fff; margin:0 0 4px; }
.drprofile__hero-meta { font-size:14px; color:rgba(255,255,255,.85); margin:0 0 4px; }
.drprofile__chipbox { display:flex; flex-direction:column; gap:8px; align-items:flex-end; }
.drprofile__chip { display:inline-flex; align-items:center; justify-content:center; border-radius:50px; padding:5px 14px; font-size:12px; font-weight:700; white-space:nowrap; }
.drprofile__chip-ghost { background:rgba(255,255,255,.15); color:#fff; border:1px solid rgba(255,255,255,.3); }

/* Section card: icon+title header at top, content below */
.drprofile__card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  overflow: hidden;
  margin-bottom: 16px;
}
.drprofile__card-head {
  padding: 16px 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid #f1f5f9;
}
.drprofile__card-head-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #eff6ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}
.drprofile__card-head-title {
  font-size: 15px;
  font-weight: 800;
  color: #1e293b;
  margin: 0;
}
.drprofile__card-body { padding: 24px; }

/* Edit section card — same top-header look */
.drprofile__edit-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  overflow: hidden;
  margin-bottom: 16px;
}
.drprofile__edit-card-head {
  padding: 16px 24px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f8fafc;
}
.drprofile__edit-card-head h4 { margin:0; font-size:15px; font-weight:800; color:#1e293b; }
.drprofile__edit-card-body { padding: 24px; }

/* 4-column read grid */
.drprofile__grid-read {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

/* Edit grids */
.drprofile__grid      { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:16px 24px; }
.drprofile__grid-wide { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:16px 20px; }

/* Read field */
.drprofile__read { display:flex; flex-direction:column; gap:4px; min-width:0; }
.drprofile__read label { font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.05em; }
.drprofile__read span  { font-size:14px; color:#0f172a; line-height:1.5; word-break:break-word; }
.drprofile__read span.drprofile__empty { color:#cbd5e1; font-style:italic; }

/* Edit field */
.drprofile__field { display:flex; flex-direction:column; gap:4px; min-width:0; }
.drprofile__field label { display:block; font-size:12px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:.04em; margin-bottom:5px; }
.drprofile__field input,
.drprofile__field select,
.drprofile__field textarea {
  width:100%; box-sizing:border-box; border:1.5px solid #e2e8f0; border-radius:8px;
  padding:9px 12px; font:inherit; font-size:14px; color:#0f172a; background:#fff;
  outline:none; transition:border-color .2s;
}
.drprofile__field select {
  appearance:none;
  background-image:url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2364748B' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat:no-repeat; background-position:right 12px center; padding-right:32px; cursor:pointer;
}
.drprofile__field textarea { min-height:110px; resize:vertical; line-height:1.55; }
.drprofile__field input:focus,
.drprofile__field select:focus,
.drprofile__field textarea:focus { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.1); }

/* Buttons */
.drprofile__actions { display:flex; justify-content:flex-end; gap:10px; flex-wrap:wrap; }
.drprofile__btn { border:none; border-radius:8px; padding:9px 16px; font:inherit; font-size:13px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:7px; }
.drprofile__btn:disabled { opacity:.6; cursor:not-allowed; }
.drprofile__btn-primary   { background:#2563eb; color:#fff; }
.drprofile__btn-soft      { background:#eff6ff; color:#1d4ed8; border:1.5px solid #bfdbfe; }
.drprofile__btn-secondary { background:#fff; color:#334155; border:1.5px solid #e2e8f0; }

/* Notice banners */
.drprofile__notice       { border:1px solid; border-radius:12px; padding:14px 18px; margin-bottom:18px; }
.drprofile__notice-title { margin:0 0 4px; font-size:14px; font-weight:800; }
.drprofile__notice-text  { margin:0; font-size:13px; line-height:1.55; }

/* Document cards */
.drprofile__doc          { display:flex; flex-direction:column; gap:12px; padding:16px 18px; border-radius:12px; border:1.5px solid #e2e8f0; background:#fafafa; }
.drprofile__doc-has-file { border-color:#86efac !important; background:#f0fdf4 !important; }
.drprofile__doc-label    { font-size:11px; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:.05em; margin-bottom:4px; }
.drprofile__doc-name     { font-size:13px; color:#1e293b; word-break:break-all; line-height:1.45; }

/* Photo upload row */
.drprofile__upload-row   { display:flex; align-items:center; gap:18px; padding:16px; border:1.5px solid #e2e8f0; background:#f8fafc; border-radius:12px; flex-wrap:wrap; }
.drprofile__photo-circle { width:92px; height:92px; border-radius:50%; overflow:hidden; border:2.5px solid #bfdbfe; background:#e2e8f0; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; }
.drprofile__photo-circle img { width:100%; height:100%; object-fit:cover; display:block; }

/* Change diff */
.drprofile__change      { border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; background:#fff; margin-top:10px; }
.drprofile__change-head { padding:9px 12px; background:#f8fafc; border-bottom:1px solid #f1f5f9; font-size:13px; font-weight:800; color:#334155; }
.drprofile__change-cols { display:grid; grid-template-columns:1fr 1fr; }
.drprofile__change-col  { padding:11px 12px; min-width:0; }
.drprofile__change-col + .drprofile__change-col { border-left:1px solid #f1f5f9; background:#f0fdf4; }

/* Clinic subsection label */
.drprofile__subsec {
  font-size:11px; font-weight:800; color:#64748b; text-transform:uppercase;
  letter-spacing:.06em; padding-top:18px; margin-top:4px; margin-bottom:14px;
  border-top:1px solid #f1f5f9;
}

/* Availability editor */
.drprofile__avail-day { background:#f8fafc; border-radius:10px; padding:14px 16px; margin-bottom:10px; border:1.5px solid #e2e8f0; }
.drprofile__avail-day-on { border-color:#bfdbfe !important; background:#eff6ff !important; }
.drprofile__avail-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
.drprofile__avail-name { font-size:14px; font-weight:700; color:#1e293b; }
.drprofile__avail-toggle { position:relative; width:40px; height:22px; background:#cbd5e1; border-radius:11px; cursor:pointer; border:none; flex-shrink:0; transition:background .2s; }
.drprofile__avail-toggle.on { background:#2563eb; }
.drprofile__avail-toggle::after { content:''; position:absolute; top:2px; left:2px; width:18px; height:18px; background:#fff; border-radius:50%; transition:left .2s; }
.drprofile__avail-toggle.on::after { left:20px; }
.drprofile__time-block { display:flex; align-items:center; gap:8px; margin-bottom:8px; flex-wrap:wrap; }
.drprofile__time-input { padding:7px 10px; border:1.5px solid #e2e8f0; border-radius:8px; font:inherit; font-size:13px; outline:none; transition:border-color .2s; width:115px; }
.drprofile__time-input:focus { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.1); }
.drprofile__time-sep { font-size:12px; font-weight:700; color:#94a3b8; }

/* Spinner */
.drprofile__spinner { width:36px; height:36px; border-radius:50%; border:3px solid #e2e8f0; border-top-color:#2563eb; animation:drprofileSpin .8s linear infinite; }
@keyframes drprofileSpin { to { transform:rotate(360deg); } }

/* Responsive */
@media (max-width:900px) {
  .drprofile__grid-read { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width:760px) {
  .drprofile__topnav, .drprofile__hero { align-items:stretch; }
  .drprofile__chipbox { align-items:flex-start; }
  .drprofile__grid-wide, .drprofile__change-cols { grid-template-columns:1fr; }
  .drprofile__change-col + .drprofile__change-col { border-left:0; border-top:1px solid #f1f5f9; }
  .drprofile__card-body, .drprofile__edit-card-body { padding:18px; }
  .drprofile__grid-read { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width:480px) {
  .drprofile__grid-read { grid-template-columns: 1fr 1fr; }
}

/* MultiSelect */
.ms-wrapper { position: relative; }
.ms-trigger {
  display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 12px;
  border: 1.5px solid #e2e8f0; border-radius: 8px;
  min-height: 44px; align-items: center; cursor: pointer;
  background: #fff; box-sizing: border-box; width: 100%;
}
.ms-trigger:hover { border-color: #cbd5e1; }
.ms-trigger.open { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
.ms-placeholder { font-size: 14px; color: #94a3b8; }
.ms-tag {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 10px; background: rgba(37,99,235,0.1);
  color: #2563eb; border-radius: 6px; font-size: 12px; font-weight: 600;
}
.ms-tag button {
  background: none; border: none; color: #2563eb;
  cursor: pointer; font-size: 14px; line-height: 1; padding: 0 2px;
}
.ms-tag button:hover { color: #dc2626; }
.ms-overflow {
  font-size: 11px; font-weight: 600; color: #2563eb;
  background: rgba(37,99,235,0.08); padding: 3px 8px; border-radius: 50px;
}

/* Pulse animation for online status indicator */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
`;

/* ─── State licensing data (mirrors DoctorEnrollments) ─── */
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
const COUNTRY_NAME_TO_ISO = {
  "United States": "US",
  India: "IN",
  Australia: "AU",
  Canada: "CA",
  Germany: "DE",
  Brazil: "BR",
  Mexico: "MX",
  Nigeria: "NG",
};

/* ─── useDropdownPosition ─── */
function useDropdownPosition(triggerRef, open) {
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  useEffect(() => {
    if (!open || !triggerRef.current) return undefined;
    const update = () => {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, triggerRef]);
  return position;
}

/* ─── MultiSelect ─── */
function MultiSelect({
  items,
  selected,
  onChange,
  placeholder,
  searchPlaceholder,
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
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open && searchInputRef.current)
      setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [open]);

  const filtered = items.filter((item) =>
    item.toLowerCase().includes(search.toLowerCase()),
  );

  const toggle = (item) => {
    onChange(
      selected.includes(item)
        ? selected.filter((s) => s !== item)
        : [...selected, item],
    );
  };

  const dropdown = open
    ? createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: `${position.top - window.scrollY}px`,
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
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
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
                const isSelected = selected.includes(item);
                return (
                  <div
                    key={item}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 14px",
                      background: isSelected ? "#f0fdf4" : "transparent",
                      cursor: "pointer",
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
                    <span style={{ fontSize: 13, color: "#334155", flex: 1 }}>
                      {item}
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
          className={`ms-trigger${open ? " open" : ""}`}
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
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(s);
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

/* ─── helpers ─── */
function slugifyDoctorName(name) {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function displayValue(value) {
  if (value === undefined || value === null || value === "") return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function displayFileName(value) {
  if (!value) return "";
  const raw = String(value);
  try {
    const u = new URL(raw);
    return decodeURIComponent(u.pathname.split("/").pop() || "document");
  } catch {
    return decodeURIComponent(raw.split("?")[0].split("/").pop() || "document");
  }
}

/* ─── Section: header at top, content below ─── */
function Section({ icon, title, children }) {
  return (
    <section className="drprofile__card">
      <div className="drprofile__card-head">
        <div className="drprofile__card-head-icon">{icon}</div>
        <h4 className="drprofile__card-head-title">{title}</h4>
      </div>
      <div className="drprofile__card-body">{children}</div>
    </section>
  );
}

/* ─── EditSection: same top-header style ─── */
function EditSection({ icon, title, children }) {
  return (
    <section className="drprofile__edit-card">
      <div className="drprofile__edit-card-head">
        <div className="drprofile__card-head-icon">{icon}</div>
        <h4>{title}</h4>
      </div>
      <div className="drprofile__edit-card-body">{children}</div>
    </section>
  );
}

function ReadField({ label, value, full, span2 }) {
  return (
    <div
      className="drprofile__read"
      style={{ gridColumn: full ? "1/-1" : span2 ? "span 2" : undefined }}
    >
      <label>{label}</label>
      <span className={value ? "" : "drprofile__empty"}>{value || "—"}</span>
    </div>
  );
}

function InputField({ label, children, full }) {
  return (
    <div
      className="drprofile__field"
      style={{ gridColumn: full ? "1/-1" : undefined }}
    >
      <label>{label}</label>
      {children}
    </div>
  );
}

async function getDoctorDocumentUrl(doctorId, field) {
  const { data } = await api.get(
    `/api/doctor/enrollment/${doctorId}/documents/${field}/access-url`,
  );
  return data.url;
}

function SignedImage({ doctorId, field, alt, fallback, className }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setSrc("");
    setFailed(false);
    if (!doctorId || !DOCUMENT_FIELDS.has(field)) return undefined;
    getDoctorDocumentUrl(doctorId, field)
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [doctorId, field]);
  if (failed || !src) return fallback || null;
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
}

function DocumentCard({ label, value, doctorId, field, editable, onChange }) {
  const ref = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const uploaded = await uploadFileDirectToS3(file);
      onChange?.(uploaded.key || uploaded.url || "");
    } catch (err) {
      setError(err?.response?.data?.msg || err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className={`drprofile__doc ${value ? "drprofile__doc-has-file" : ""}`}>
      <input
        ref={ref}
        type="file"
        accept=".pdf"
        style={{ display: "none" }}
        onChange={(e) => upload(e.target.files?.[0])}
      />
      <div>
        <div className="drprofile__doc-label">{label}</div>
        <div className="drprofile__doc-name">
          {value ? displayFileName(value) : "Not uploaded"}
        </div>
        {error && (
          <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
            {error}
          </div>
        )}
      </div>
      <div
        className="drprofile__actions"
        style={{ justifyContent: "flex-start" }}
      >
        {value && (
          <button
            type="button"
            className="drprofile__btn drprofile__btn-primary"
            onClick={async () => {
              const url = await getDoctorDocumentUrl(doctorId, field);
              window.open(url, "_blank", "noopener,noreferrer");
            }}
          >
            View
          </button>
        )}
        {editable && (
          <button
            type="button"
            className="drprofile__btn drprofile__btn-secondary"
            disabled={uploading}
            onClick={() => ref.current?.click()}
          >
            {uploading ? "Uploading..." : value ? "Replace" : "Upload"}
          </button>
        )}
      </div>
    </div>
  );
}

function PhotoEditor({ value, doctorId, editable, onChange, initials }) {
  const ref = useRef(null);
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const directUrl = normalizeFileUrl(value);
  const showDirect = directUrl && /^https?:\/\//i.test(directUrl);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const upload = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const uploaded = await uploadFileDirectToS3(file);
      onChange(uploaded.key || uploaded.url || "");
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="drprofile__upload-row">
      <input
        ref={ref}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => upload(e.target.files?.[0])}
      />
      <div
        className="drprofile__photo-circle"
        onClick={() => editable && ref.current?.click()}
      >
        {preview ? (
          <img src={preview} alt="Profile preview" />
        ) : showDirect ? (
          <img src={directUrl} alt="Profile" />
        ) : value ? (
          <SignedImage
            doctorId={doctorId}
            field="profilePhoto"
            alt="Profile"
            fallback={<span>{initials}</span>}
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      <div style={{ minWidth: 180, flex: 1 }}>
        <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 14 }}>
          {uploading
            ? "Uploading..."
            : value
              ? "Profile photo uploaded"
              : "No profile photo"}
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
          JPG, PNG, or WebP. Click the avatar to replace.
        </div>
        {editable && (
          <button
            type="button"
            className="drprofile__btn drprofile__btn-soft"
            style={{ marginTop: 10 }}
            disabled={uploading}
            onClick={() => ref.current?.click()}
          >
            {value ? "Replace Photo" : "Upload Photo"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── UNCHANGED: ProfileUpdateStatus component ───────────────────────────────
function ProfileUpdateStatus({ enrollment }) {
  const status =
    enrollment.profileUpdateRequestStatus ||
    (enrollment.pendingRequestType === "profile_update" ? "pending" : "none");
  const meta = REQUEST_META[status];
  if (!meta) return null;
  const changes = Array.isArray(enrollment.pendingProfileChanges)
    ? enrollment.pendingProfileChanges
    : [];
  return (
    <div
      className="drprofile__notice"
      style={{
        background: meta.bg,
        borderColor: meta.border,
        color: meta.color,
      }}
    >
      <p className="drprofile__notice-title">{meta.label}</p>
      <p className="drprofile__notice-text">{meta.text}</p>
      {enrollment.profileUpdateRequestedAt && (
        <p className="drprofile__notice-text" style={{ marginTop: 4 }}>
          Submitted{" "}
          {new Date(enrollment.profileUpdateRequestedAt).toLocaleString()}
        </p>
      )}
      {status === "pending" &&
        (() => {
          const AVAIL_FIELDS = new Set(["availability", "timezone"]);
          const docChanges = changes.filter((c) =>
            DOCUMENT_FIELDS.has(c.field),
          );
          const availChanges = changes.filter((c) => AVAIL_FIELDS.has(c.field));
          const textChanges = changes.filter(
            (c) => !DOCUMENT_FIELDS.has(c.field) && !AVAIL_FIELDS.has(c.field),
          );
          return (
            <>
              {textChanges.map((change) => (
                <div key={change.field} className="drprofile__change">
                  <div className="drprofile__change-head">
                    {change.label || change.field}
                  </div>
                  <div className="drprofile__change-cols">
                    <div className="drprofile__change-col">
                      <div className="drprofile__doc-label">
                        Current approved
                      </div>
                      <div className="drprofile__doc-name">
                        {displayValue(change.previousValue) || "-"}
                      </div>
                    </div>
                    <div className="drprofile__change-col">
                      <div className="drprofile__doc-label">
                        Submitted update
                      </div>
                      <div className="drprofile__doc-name">
                        {displayValue(change.newValue) || "-"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {availChanges.length > 0 && (
                <div className="drprofile__change">
                  <div className="drprofile__change-head">
                    Availability Schedule Updated
                  </div>
                  <div
                    style={{
                      padding: "10px 12px",
                      fontSize: 13,
                      color: "#475569",
                    }}
                  >
                    {availChanges.map((c) => c.label || c.field).join(", ")}{" "}
                    updated. Your new schedule is pending admin review.
                  </div>
                </div>
              )}
              {docChanges.length > 0 && (
                <div className="drprofile__change">
                  <div className="drprofile__change-head">
                    Uploaded Files Edited
                  </div>
                  <div
                    style={{
                      padding: "10px 12px",
                      fontSize: 13,
                      color: "#475569",
                    }}
                  >
                    {docChanges.map((c) => c.label || c.field).join(", ")}{" "}
                    updated. The new file(s) are pending admin review.
                  </div>
                </div>
              )}
            </>
          );
        })()}
    </div>
  );
}

/* ═══════════════════ MAIN COMPONENT ═══════════════════ */
export default function DoctorProfile() {
  const { doctor } = useDoctorAuth();
  const navigate = useNavigate();
  const [enrollment, setEnrollment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // ── NEW: tracks the localStorage key of the last status banner the
  //         user has already seen (for approved / rejected only).
  const [seenStatusKey, setSeenStatusKey] = useState(null);
  const [phoneCountryCode, setPhoneCountryCode] = useState("auto");

  const doctorId = doctor?._id || doctor?.id;

  // ── Fetch enrollment data ────────────────────────────────────────────────
  useEffect(() => {
    if (!doctorId) return;
    setLoading(true);
    api
      .get(`/api/doctor/enrollment/${doctorId}`)
      .then((res) => {
        setEnrollment(res.data || null);
      })
      .catch(() => setEnrollment(null))
      .finally(() => setLoading(false));
  }, [doctorId]);

  // ── NEW: On mount, read the previously seen status key from localStorage.
  //         This tells us which approved/rejected event the doctor already saw.
  useEffect(() => {
    if (!doctorId) return;
    const stored = localStorage.getItem(`profile-status-seen-${doctorId}`);
    if (stored) setSeenStatusKey(stored);
  }, [doctorId]);

  const initialForm = useMemo(() => {
    const e = enrollment || {};
    return {
      firstName: e.firstName || "",
      surname: e.surname || "",
      email: e.email || "",
      countryCode: e.countryCode || "",
      phoneNumber: e.phoneNumber || "",
      gender: e.gender || "",
      dob: e.dob || "",
      languagesKnown: Array.isArray(e.languagesKnown)
        ? e.languagesKnown.join(", ")
        : e.languagesKnown || "",
      licensedStates: Array.isArray(e.licensedStates)
        ? e.licensedStates
        : e.state
          ? [e.state]
          : [],
      internationalLicenses: Array.isArray(e.internationalLicenses)
        ? e.internationalLicenses
        : [],
      country: e.country || "",
      state: e.state || "",
      city: e.city || "",
      zip: e.zip || "",
      address: e.address || "",
      specialization: (() => {
        const saved = e.specialization || "";
        return saved && !SPECIALTIES.includes(saved) ? "Other" : saved;
      })(),
      customSpecialty: (() => {
        const saved = e.specialization || "";
        return saved && !SPECIALTIES.includes(saved) ? saved : "";
      })(),
      subSpecialization: e.subSpecialization || "",
      qualification: e.qualification || "",
      experience: e.experience != null ? String(e.experience) : "",
      medicalSchool: e.medicalSchool || "",
      registrationYear: e.registrationYear || "",
      medicalCouncilName: e.medicalCouncilName || "",
      medicalRegistrationNumber: e.medicalRegistrationNumber || "",
      medicalLicense: e.medicalLicense || "",
      idProofType: e.idProofType || "",
      // consultationMode: e.consultationMode || "",
      consultantFees: e.consultantFees != null ? String(e.consultantFees) : "",
      feeCurrency: e.feeCurrency || "USD",
      clinicName: e.clinicName || "",
      clinicAddress: e.clinicAddress || "",
      aboutDoctor: e.aboutDoctor || "",
      profilePhoto: e.profilePhoto || "",
      idProof: e.idProof || "",
      degreeFile: e.degreeFile || "",
      medicalLicenseFile: e.medicalLicenseFile || "",
      malpracticeInsuranceFile: e.malpracticeInsuranceFile || "",
      bankName: e.bankName || "",
      // accountHolderName: e.accountHolderName || "",
      accountNumber: e.accountNumber || "",
      ifscCode: e.ifscCode || "",
      paypalId: e.paypalId || "",
      // payoutEmail: e.payoutEmail || "",
      timezone: e.timezone || "",
      availability: e.availability || {},
    };
  }, [enrollment]);

  const beginEdit = () => {
    setForm({
      ...initialForm,
      availability: buildDefaultAvailability(initialForm.availability),
    });
    if (initialForm.countryCode) {
      setPhoneCountryCode(getCountryCodeFromDialCode(initialForm.countryCode));
    }
    setToast(null);
    setEditMode(true);
  };
  const update = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  // ── Availability helpers ──────────────────────────────────────────────────
  const toggleAvailDay = (day) =>
    setForm((prev) => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: {
          ...prev.availability[day],
          enabled: !prev.availability[day].enabled,
        },
      },
    }));
  const updateAvailBlock = (day, idx, field, val) =>
    setForm((prev) => {
      const blocks = [...prev.availability[day].blocks];
      blocks[idx] = { ...blocks[idx], [field]: val };
      return {
        ...prev,
        availability: {
          ...prev.availability,
          [day]: { ...prev.availability[day], blocks },
        },
      };
    });
  const addAvailBlock = (day) =>
    setForm((prev) => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: {
          ...prev.availability[day],
          blocks: [
            ...prev.availability[day].blocks,
            { start: "09:00", end: "17:00" },
          ],
        },
      },
    }));
  const removeAvailBlock = (day, idx) =>
    setForm((prev) => {
      const blocks = prev.availability[day].blocks.filter((_, i) => i !== idx);
      return {
        ...prev,
        availability: {
          ...prev.availability,
          [day]: {
            ...prev.availability[day],
            blocks: blocks.length ? blocks : [{ start: "09:00", end: "17:00" }],
          },
        },
      };
    });

  const save = async () => {
    setSaving(true);
    setToast(null);
    try {
      const payload = {
        doctorId,
        ...form,
        specialization:
          form.specialization === "Other"
            ? form.customSpecialty || "Other"
            : form.specialization,
        languagesKnown: form.languagesKnown
          ? form.languagesKnown
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        licensedStates: Array.isArray(form.licensedStates)
          ? form.licensedStates
          : [],
        internationalLicenses: Array.isArray(form.internationalLicenses)
          ? form.internationalLicenses
          : [],
        experience:
          form.experience === "" ? undefined : Number(form.experience),
        consultantFees:
          form.consultantFees === "" ? undefined : Number(form.consultantFees),
      };
      delete payload.customSpecialty;
      const { data } = await api.post("/api/doctor/enrollment", payload);
      setEnrollment(data?.enrollment || enrollment);
      setEditMode(false);
      setToast({ ok: true, text: data?.message || "Profile saved." });
    } catch (err) {
      setToast({
        ok: false,
        text: err?.response?.data?.message || "Could not save profile.",
      });
    } finally {
      setSaving(false);
    }
  };

  const inp = (key, placeholder = "", type = "text") => (
    <input
      type={type}
      value={form[key] || ""}
      placeholder={placeholder}
      onChange={(e) => update(key, e.target.value)}
    />
  );
  const sel = (key, options, placeholder = "Select...") => (
    <select
      value={form[key] || ""}
      onChange={(e) => update(key, e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );

  const stateField = () => {
    if (!form.country) {
      return inp("state", "Select country first");
    }
    const countryData = Country.getAllCountries().find(
      (c) => c.isoCode === form.country,
    );
    if (!countryData) {
      return inp("state", "State / Province");
    }
    const states = State.getStatesOfCountry(countryData.isoCode);
    if (states.length === 0) {
      return inp("state", "State / Province");
    }
    return (
      <select
        value={form.state || ""}
        onChange={(e) => update("state", e.target.value)}
      >
        <option value="">Select state...</option>
        {states.map((s) => (
          <option key={s.isoCode} value={s.name}>
            {s.name}
          </option>
        ))}
      </select>
    );
  };

  if (loading)
    return (
      <>
        <style>{CSS}</style>
        <div
          style={{
            minHeight: 300,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div className="drprofile__spinner" />
        </div>
      </>
    );

  if (!enrollment)
    return (
      <>
        <style>{CSS}</style>
        <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>
          No profile found. Complete your enrollment first.
        </div>
      </>
    );

  const e = enrollment;
  const source = editMode ? form : e;
  const fullName =
    `Dr. ${source.firstName || ""} ${source.surname || ""}`.trim() ||
    doctor?.name ||
    "Doctor";
  const initials =
    `${(source.firstName || "D")[0]}${(source.surname || "R")[0]}`.toUpperCase();
  const statusMeta = STATUS_META[e.approvalStatus] || STATUS_META.pending;

  // Convert ISO codes to display names for location
  const displayCountry = getCountryName(source.country);
  const displayState = getStateName(source.state, source.country);

  const location = [source.city, displayState, displayCountry]
    .filter(Boolean)
    .join(", ");
  const publicSlug = doctor?.doctorId
    ? `${doctor.doctorId}-${slugifyDoctorName(fullName)}`
    : "";
  const languages = Array.isArray(e.languagesKnown)
    ? e.languagesKnown.join(", ")
    : e.languagesKnown;
  const editStateIso = editMode
    ? COUNTRY_NAME_TO_ISO[form.country] || null
    : null;
  const editStateConfig =
    editMode && (form.country === "US" || form.country === "CA")
      ? STATE_LICENSING_COUNTRIES[form.country]
      : null;

  // ── NEW: Status banner visibility logic ─────────────────────────────────
  //
  // Each approved/rejected event is uniquely identified by:
  //   status  +  profileUpdateRequestedAt (submission timestamp)
  //
  // If the doctor has already seen this exact event (key stored in
  // localStorage), the banner is suppressed on refresh.
  // Pending banners are never suppressed — they must show until resolved.
  //
  // When a brand-new approval/rejection arrives later, its timestamp will
  // differ, producing a new key, so the banner reappears automatically.
  const currentStatusEventKey = (() => {
    const status = e.profileUpdateRequestStatus;
    if (!status || status === "none" || status === "pending") return null;
    const eventStamp = e.profileUpdateRequestedAt || "unknown";
    return `profile-status-${doctorId}-${status}-${eventStamp}`;
  })();

  // Show the banner when:
  //   • status is "pending"  (always), OR
  //   • status is approved/rejected AND the doctor hasn't dismissed this
  //     specific event yet.
  const shouldShowStatusBanner =
    e.profileUpdateRequestStatus === "pending" ||
    (currentStatusEventKey !== null && seenStatusKey !== currentStatusEventKey);

  // Called when the doctor clicks the ✕ dismiss button.
  // Writes the event key to localStorage so the banner stays hidden on refresh.
  const markStatusSeen = () => {
    if (!currentStatusEventKey) return;
    localStorage.setItem(
      `profile-status-seen-${doctorId}`,
      currentStatusEventKey,
    );
    setSeenStatusKey(currentStatusEventKey);
  };
  // ────────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{CSS}</style>
      <div className="drprofile__wrap">
        {/* ── Top nav ── */}
        <div className="drprofile__topnav">
          <div>
            <div className="drprofile__kicker">
              Doctor Profile-doctordashboard{" "}
              {editMode && (
                <span style={{ color: "#2563eb" }}>· EDIT MODE</span>
              )}
            </div>
            <h1 className="drprofile__title">{fullName}</h1>
          </div>
          <div className="drprofile__actions">
            {editMode ? (
              <>
                <button
                  className="drprofile__btn drprofile__btn-secondary"
                  type="button"
                  onClick={() => {
                    setEditMode(false);
                    setForm({});
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="drprofile__btn drprofile__btn-primary"
                  type="button"
                  onClick={save}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </>
            ) : (
              <button
                className="drprofile__btn drprofile__btn-soft"
                type="button"
                onClick={beginEdit}
              >
                Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* ── Toast ── */}
        {toast && (
          <div
            className="drprofile__notice"
            style={{
              background: toast.ok ? "#f0fdf4" : "#fff1f2",
              borderColor: toast.ok ? "#bbf7d0" : "#fecdd3",
              color: toast.ok ? "#166534" : "#991b1b",
            }}
          >
            <p className="drprofile__notice-text" style={{ fontWeight: 800 }}>
              {toast.text}
            </p>
          </div>
        )}

        {/* ── Hero ── */}
        <div className="drprofile__hero">
          <div className="drprofile__avatar">
            {source.profilePhoto ? (
              <SignedImage
                doctorId={doctorId}
                field="profilePhoto"
                alt={fullName}
                fallback={<span>{initials}</span>}
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <div className="drprofile__hero-main">
            <div className="drprofile__hero-name">{fullName}</div>
            {(source.qualification || source.specialization) && (
              <div className="drprofile__hero-meta">
                {[source.qualification, source.specialization]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
            {source.experience && (
              <div className="drprofile__hero-meta">
                {source.experience} years experience
              </div>
            )}
            {location && <div className="drprofile__hero-meta">{location}</div>}
          </div>
          <div className="drprofile__chipbox">
            <span
              className="drprofile__chip"
              style={{ background: statusMeta.bg, color: statusMeta.color }}
            >
              {statusMeta.label}
            </span>
            <span className="drprofile__chip drprofile__chip-ghost">
              ID: {doctor?.doctorId || "-"}
            </span>
          </div>
        </div>

        {/* ── NEW: Status update banner with dismiss button ── */}
        {shouldShowStatusBanner && (
          <div style={{ position: "relative" }}>
            <ProfileUpdateStatus enrollment={e} />

            {/* Dismiss button — only for approved / rejected, not pending */}
            {(e.profileUpdateRequestStatus === "approved" ||
              e.profileUpdateRequestStatus === "rejected") && (
              <button
                type="button"
                onClick={markStatusSeen}
                aria-label="Dismiss notification"
                title="Dismiss"
                style={{
                  position: "absolute",
                  // Sits inside the top-right corner of the notice banner.
                  // The banner has 14px top padding + 1px border, so 15px
                  // from the wrapper top lands visually centred in the header row.
                  top: 15,
                  right: 18,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 20,
                  lineHeight: 1,
                  color: "#94a3b8",
                  padding: "2px 4px",
                  borderRadius: 4,
                  // Lift above the notice content so clicks always register
                  zIndex: 1,
                }}
              >
                ×
              </button>
            )}
          </div>
        )}

        {editMode && e.approvalStatus === "approved" && (
          <div
            className="drprofile__notice"
            style={{
              background: "#fffbeb",
              borderColor: "#fde68a",
              color: "#92400e",
            }}
          >
            <p className="drprofile__notice-title">Admin review required</p>
            <p className="drprofile__notice-text">
              Saving changes submits the whole profile update for admin review.
              Your dashboard access remains active.
            </p>
          </div>
        )}

        {/* ══════════ EDIT MODE ══════════ */}
        {editMode ? (
          <>
            <EditSection icon="📷" title="Profile Photo">
              <PhotoEditor
                value={form.profilePhoto}
                doctorId={doctorId}
                editable
                onChange={(v) => update("profilePhoto", v)}
                initials={initials}
              />
            </EditSection>

            <EditSection icon="👤" title="Personal & Contact Details">
              <div className="drprofile__grid-wide">
                <InputField label="First Name">
                  {inp("firstName", "First name")}
                </InputField>
                <InputField label="Surname">
                  {inp("surname", "Surname")}
                </InputField>
                <InputField label="Email">
                  {inp("email", "Email", "email")}
                </InputField>
                <InputField label="Phone">
                  <div className="de-phone-input">
                    <PhoneInputField
                      value={
                        (form.countryCode || "") + (form.phoneNumber || "")
                      }
                      onChange={(value, countryMeta) => {
                        const next = splitPhoneValue(value, countryMeta);
                        update("countryCode", next.countryCode);
                        update("phoneNumber", next.phone);
                      }}
                      onCountryChange={(countryMeta) => {
                        setPhoneCountryCode(countryMeta.code || "auto");
                        update(
                          "countryCode",
                          countryMeta.dialCode || form.countryCode,
                        );
                      }}
                      defaultCountry={phoneCountryCode}
                      placeholder="Mobile number"
                      showCountryNameInDropdown={true}
                    />
                  </div>
                </InputField>
                <InputField label="Gender">{sel("gender", GENDERS)}</InputField>
                <InputField label="Date of Birth">
                  {inp("dob", "", "date")}
                </InputField>
                <InputField label="Languages Known" full>
                  {inp("languagesKnown", "English, Hindi, Spanish")}
                </InputField>
              </div>
            </EditSection>

            <EditSection icon="📍" title="Location">
              <div className="drprofile__grid-wide">
                <InputField label="Country">
                  
                  <select
                    value={form.country || ""}
                    onChange={(e) => {
                      update("country", e.target.value);
                      update("state", "");
                      update("licensedStates", []);
                    }}
                  >
                    <option value="">Select country...</option>
                    {Country.getAllCountries().map((country) => (
                      <option key={country.isoCode} value={country.isoCode}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </InputField>
                <InputField label="State / Province">{stateField()}</InputField>
                <InputField label="City">{inp("city", "City")}</InputField>
                <InputField label="ZIP / Postal">
                  {inp("zip", "ZIP")}
                </InputField>
                <InputField label="Street Address" full>
                  {inp("address", "Street address")}
                </InputField>
              </div>
            </EditSection>

            <EditSection icon="🩺" title="Professional Details">
              <div className="drprofile__grid-wide">
                <InputField label="Specialization">
                  <select
                    value={
                      SPECIALTIES.includes(form.specialization)
                        ? form.specialization
                        : form.specialization
                          ? "Other"
                          : ""
                    }
                    onChange={(e) => {
                      if (e.target.value === "Other") {
                        update("specialization", "Other");
                        update(
                          "customSpecialty",
                          form.specialization &&
                            !SPECIALTIES.includes(form.specialization)
                            ? form.specialization
                            : "",
                        );
                      } else {
                        update("specialization", e.target.value);
                        update("customSpecialty", "");
                      }
                    }}
                  >
                    <option value="">Select specialty...</option>
                    {SPECIALTIES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </InputField>
                {(form.specialization === "Other" ||
                  (form.specialization &&
                    !SPECIALTIES.includes(form.specialization))) && (
                  <InputField label="Custom Specialty">
                    {inp("customSpecialty", "e.g. Sports Medicine")}
                  </InputField>
                )}
                <InputField label="Sub-Specialization">
                  {inp("subSpecialization", "Sub-specialization")}
                </InputField>
                <InputField label="Qualification">
                  {sel("qualification", QUALIFICATIONS)}
                </InputField>
                <InputField label="Experience">
                  {inp("experience", "Years", "number")}
                </InputField>
                <InputField label="Medical School">
                  {inp("medicalSchool", "Medical school")}
                </InputField>
                <InputField label="Graduation Year">
                  {inp("registrationYear", "YYYY")}
                </InputField>
                <InputField label="Medical Council">
                  {inp("medicalCouncilName", "Council")}
                </InputField>
                <InputField label="NPI">
                  {inp("medicalRegistrationNumber", "NPI number")}
                </InputField>
                <InputField label="Medical License No.">
                  {inp("medicalLicense", "License number")}
                </InputField>
                {/* <InputField label="ID Proof Type">
                  {inp("idProofType", "ID proof type")}
                </InputField> */}
                {/* <InputField label="Consultation Mode">
                  {sel("consultationMode", CONSULTATION_MODES)}
                </InputField> */}
                <InputField label="Consultation Fee">
                  {inp("consultantFees", "Fee", "number")}
                </InputField>
                <InputField label="Fee Currency">
                  {sel("feeCurrency", CURRENCIES)}
                </InputField>
                <InputField label="Clinic Name">
                  {inp("clinicName", "Clinic name")}
                </InputField>
                <InputField label="Clinic Address">
                  {inp("clinicAddress", "Clinic address")}
                </InputField>
                <InputField label="About Doctor" full>
                  <textarea
                    value={form.aboutDoctor || ""}
                    onChange={(e) => update("aboutDoctor", e.target.value)}
                  />
                </InputField>
                {editStateConfig && (
                  <InputField
                    label={`${editStateConfig.plural} Licensing`}
                    full
                  >
                    <MultiSelect
                      items={editStateConfig.items}
                      selected={
                        Array.isArray(form.licensedStates)
                          ? form.licensedStates
                          : []
                      }
                      onChange={(v) => update("licensedStates", v)}
                      placeholder={`Select ${editStateConfig.plural.toLowerCase()}...`}
                      searchPlaceholder={`Search ${editStateConfig.plural.toLowerCase()}...`}
                    />
                  </InputField>
                )}
                <InputField label="International Medical Licenses" full>
                  <MultiSelect
                    items={COUNTRIES.filter(
                      (c) => c !== "Other" && c !== form.country,
                    )}
                    selected={
                      Array.isArray(form.internationalLicenses)
                        ? form.internationalLicenses
                        : []
                    }
                    onChange={(v) => update("internationalLicenses", v)}
                    placeholder="Select countries..."
                    searchPlaceholder="Search countries..."
                  />
                </InputField>
              </div>
            </EditSection>

            <EditSection icon="📋" title="Submitted Documents">
              <div className="drprofile__grid">
                <DocumentCard
                  editable
                  label="Government ID / Nationality Proof"
                  value={form.idProof}
                  doctorId={doctorId}
                  field="idProof"
                  onChange={(v) => update("idProof", v)}
                />
                <DocumentCard
                  editable
                  label="Medical Degree Certificate"
                  value={form.degreeFile}
                  doctorId={doctorId}
                  field="degreeFile"
                  onChange={(v) => update("degreeFile", v)}
                />
                <DocumentCard
                  editable
                  label="Medical License Document"
                  value={form.medicalLicenseFile}
                  doctorId={doctorId}
                  field="medicalLicenseFile"
                  onChange={(v) => update("medicalLicenseFile", v)}
                />
                <DocumentCard
                  editable
                  label="Malpractice Insurance License"
                  value={form.malpracticeInsuranceFile}
                  doctorId={doctorId}
                  field="malpracticeInsuranceFile"
                  onChange={(v) => update("malpracticeInsuranceFile", v)}
                />
              </div>
            </EditSection>

            <EditSection icon="�️" title="Availability Schedule">
              <div className="drprofile__field" style={{ marginBottom: 18 }}>
                <label>Timezone</label>
                <select
                  value={form.timezone || ""}
                  onChange={(e) => update("timezone", e.target.value)}
                >
                  <option value="">Select timezone...</option>
                  {form.timezone && !TIMEZONES.includes(form.timezone) && (
                    <option value={form.timezone}>
                      🌐 {form.timezone} (current)
                    </option>
                  )}
                  {TIMEZONES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              {DAYS.map((day) => {
                const d = form.availability?.[day] ?? DEFAULT_DAY_BLOCK;
                return (
                  <div
                    key={day}
                    className={`drprofile__avail-day${d.enabled ? " drprofile__avail-day-on" : ""}`}
                  >
                    <div className="drprofile__avail-header">
                      <span className="drprofile__avail-name">{day}</span>
                      <button
                        type="button"
                        className={`drprofile__avail-toggle${d.enabled ? " on" : ""}`}
                        onClick={() => toggleAvailDay(day)}
                        aria-label={`Toggle ${day}`}
                      />
                    </div>
                    {d.enabled && (
                      <div>
                        {d.blocks.map((block, i) => (
                          <div key={i} className="drprofile__time-block">
                            <input
                              type="time"
                              className="drprofile__time-input"
                              value={block.start}
                              onChange={(e) =>
                                updateAvailBlock(
                                  day,
                                  i,
                                  "start",
                                  e.target.value,
                                )
                              }
                            />
                            <span className="drprofile__time-sep">to</span>
                            <input
                              type="time"
                              className="drprofile__time-input"
                              value={block.end}
                              onChange={(e) =>
                                updateAvailBlock(day, i, "end", e.target.value)
                              }
                            />
                            {d.blocks.length > 1 && (
                              <button
                                type="button"
                                className="drprofile__btn drprofile__btn-secondary"
                                style={{ padding: "4px 10px", fontSize: 12 }}
                                onClick={() => removeAvailBlock(day, i)}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          className="drprofile__btn drprofile__btn-soft"
                          style={{
                            marginTop: 4,
                            padding: "5px 12px",
                            fontSize: 12,
                          }}
                          onClick={() => addAvailBlock(day)}
                        >
                          + Add Time Block
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </EditSection>

            <EditSection icon="�💳" title="Payout Information">
              <div className="drprofile__grid-wide">
                <InputField label="Bank Name">
                  {inp("bankName", "Bank name")}
                </InputField>

                {/* <InputField label="Account Holder">
                  {inp("accountHolderName", "Account holder")}
                </InputField> */}
                <InputField label="Account Number">
                  {inp("accountNumber", "Account number")}
                </InputField>

                <InputField label="SWIFT / BIC">
                  {inp("ifscCode", "SWIFT / BIC")}
                </InputField>
                <InputField label="PayPal ID">
                  {inp("paypalId", "PayPal ID")}
                </InputField>
                {/* <InputField label="Payout Email">
                  {inp("payoutEmail", "Payout email", "email")}
                </InputField> */}
              </div>
            </EditSection>
          </>
        ) : (
          /* ══════════ READ MODE ══════════ */
          <>
            {/* Personal & Contact Details */}
            <Section icon="👤" title="Personal & Contact Details">
              {e.profilePhoto ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "14px 18px",
                    background: "#f0fdf4",
                    border: "1px solid #86efac",
                    borderRadius: 10,
                    marginBottom: 24,
                  }}
                >
                  <div
                    className="drprofile__avatar"
                    style={{
                      width: 64,
                      height: 64,
                      border: "2.5px solid #16a34a",
                      background: "#e2e8f0",
                    }}
                  >
                    <SignedImage
                      doctorId={doctorId}
                      field="profilePhoto"
                      alt={fullName}
                      fallback={<span>{initials}</span>}
                    />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#166534",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span>✅</span> Profile Photo Uploaded
                    </div>
                    <button
                      className="drprofile__btn drprofile__btn-secondary"
                      style={{ marginTop: 8 }}
                      type="button"
                      onClick={async () =>
                        window.open(
                          await getDoctorDocumentUrl(doctorId, "profilePhoto"),
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                    >
                      View full size
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: "12px 16px",
                    background: "#fafafa",
                    border: "1px dashed #e2e8f0",
                    borderRadius: 10,
                    marginBottom: 24,
                    fontSize: 13,
                    color: "#94a3b8",
                  }}
                >
                  No profile photo uploaded.
                </div>
              )}
              <div
                className="drprofile__grid-read"
                style={{ marginBottom: 20 }}
              >
                <ReadField label="First Name" value={e.firstName} />
                <ReadField label="Surname" value={e.surname} />
                <ReadField label="Email" value={e.email || doctor?.email} />
                <ReadField
                  label="Mobile"
                  value={[e.countryCode, e.phoneNumber]
                    .filter(Boolean)
                    .join(" ")}
                />
              </div>
              <div className="drprofile__grid-read">
                <ReadField label="Gender" value={e.gender} />
                <ReadField label="Date of Birth" value={e.dob} />
                <ReadField label="Languages" value={languages} span2 />
              </div>
            </Section>

            {/* Location */}
            <Section icon="📍" title="Location">
              <div
                className="drprofile__grid-read"
                style={{ marginBottom: 20 }}
              >
                <ReadField label="Country" value={getCountryName(e.country)} />
                <ReadField
                  label="State"
                  value={getStateName(e.state, e.country)}
                />
                <ReadField label="City" value={e.city} />
                <ReadField label="ZIP / Postal" value={e.zip} />
              </div>
              <div className="drprofile__grid-read">
                <ReadField label="Street Address" value={e.address} full />
              </div>
            </Section>

            {/* Professional Details */}
            <Section icon="🩺" title="Professional Details">
              <div
                className="drprofile__grid-read"
                style={{ marginBottom: 20 }}
              >
                <ReadField label="Specialization" value={e.specialization} />
                <ReadField
                  label="Sub-Specialization"
                  value={e.subSpecialization}
                />
                <ReadField label="Qualification" value={e.qualification} />
                <ReadField
                  label="Experience"
                  value={e.experience ? `${e.experience} years` : ""}
                />
              </div>
              <div
                className="drprofile__grid-read"
                style={{ marginBottom: 20 }}
              >
                <ReadField label="Medical School" value={e.medicalSchool} />
                <ReadField label="Graduation Year" value={e.registrationYear} />
                <ReadField
                  label="Medical Council"
                  value={e.medicalCouncilName}
                />
                <ReadField label="NPI" value={e.medicalRegistrationNumber} />
              </div>
              <div
                className="drprofile__grid-read"
                style={{ marginBottom: 20 }}
              >
                <ReadField
                  label="Medical License No."
                  value={e.medicalLicense}
                />
                {/* <ReadField label="ID Proof Type" value={e.idProofType} /> */}
                {/* <ReadField
                  label="Consultation Mode"
                  value={e.consultationMode}
                /> */}
                <ReadField
                  label="Consultation Fee"
                  value={
                    e.consultantFees
                      ? `${e.feeCurrency || "USD"} ${e.consultantFees}`
                      : ""
                  }
                />
              </div>
              {(Array.isArray(e.licensedStates)
                ? e.licensedStates
                : e.state
                  ? [e.state]
                  : []
              ).length > 0 && (
                <div style={{ marginTop: 6, marginBottom: 16 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: 8,
                    }}
                  >
                    State/Territory Licensing
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    {(Array.isArray(e.licensedStates)
                      ? e.licensedStates
                      : e.state
                        ? [e.state]
                        : []
                    ).map((stateName) => (
                      <span
                        key={stateName}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "4px 12px",
                          background: "#f8fafc",
                          border: "1px solid #cbd5e1",
                          borderRadius: 20,
                          fontSize: 13,
                          color: "#334155",
                          fontWeight: 600,
                        }}
                      >
                        {stateName}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(e.internationalLicenses) &&
                e.internationalLicenses.length > 0 && (
                  <div style={{ marginTop: 6, marginBottom: 16 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: "#64748b",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginBottom: 8,
                      }}
                    >
                      International Medical Licenses
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      {e.internationalLicenses.map((country) => (
                        <span
                          key={country}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "4px 12px",
                            background: "#eff6ff",
                            border: "1px solid #bfdbfe",
                            borderRadius: 20,
                            fontSize: 13,
                            color: "#1d4ed8",
                            fontWeight: 600,
                          }}
                        >
                          {country}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              <div className="drprofile__subsec">Clinic / Practice</div>
              <div className="drprofile__grid-read">
                <ReadField label="Clinic Name" value={e.clinicName} />
                <ReadField
                  label="Clinic Address"
                  value={e.clinicAddress}
                  span2
                />
              </div>
              {e.aboutDoctor && (
                <p
                  style={{
                    margin: "20px 0 0",
                    paddingTop: 16,
                    borderTop: "1px solid #f1f5f9",
                    fontSize: 14,
                    color: "#334155",
                    lineHeight: 1.7,
                  }}
                >
                  {e.aboutDoctor}
                </p>
              )}
            </Section>

            {/* Submitted Documents */}
            <Section icon="📋" title="Submitted Documents">
              <div className="drprofile__grid">
                <DocumentCard
                  label="Government ID / Nationality Proof"
                  value={e.idProof}
                  doctorId={doctorId}
                  field="idProof"
                />
                <DocumentCard
                  label="Medical Degree Certificate"
                  value={e.degreeFile}
                  doctorId={doctorId}
                  field="degreeFile"
                />
                <DocumentCard
                  label="Medical License Document"
                  value={e.medicalLicenseFile}
                  doctorId={doctorId}
                  field="medicalLicenseFile"
                />
                <DocumentCard
                  label="Malpractice Insurance License"
                  value={e.malpracticeInsuranceFile}
                  doctorId={doctorId}
                  field="malpracticeInsuranceFile"
                />
              </div>
            </Section>

            {/* Availability Schedule */}
            <Section icon="🗓️" title="Availability Schedule">
              {e.timezone && (
                <div
                  style={{
                    marginBottom: 14,
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#1d4ed8",
                  }}
                >
                  Timezone: {e.timezone}
                </div>
              )}
              {e.availability &&
              typeof e.availability === "object" &&
              Object.keys(e.availability).length > 0 ? (
                <div className="drprofile__grid">
                  {DAYS.map((day) => {
                    const d = e.availability?.[day];
                    if (!d) return null;
                    return (
                      <div
                        key={day}
                        style={{
                          padding: "12px 16px",
                          borderRadius: 10,
                          border: `1.5px solid ${d.enabled ? "#bfdbfe" : "#e2e8f0"}`,
                          background: d.enabled ? "#eff6ff" : "#f8fafc",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: 13,
                            color: d.enabled ? "#1d4ed8" : "#94a3b8",
                            marginBottom: d.enabled ? 8 : 0,
                          }}
                        >
                          {day}
                        </div>
                        {d.enabled &&
                          Array.isArray(d.blocks) &&
                          d.blocks.map((b, i) => (
                            <div
                              key={`${b.start}-${b.end}-${i}`}
                              style={{
                                fontSize: 12,
                                color: "#334155",
                                fontWeight: 600,
                              }}
                            >
                              {b.start} - {b.end}
                            </div>
                          ))}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p
                  style={{
                    color: "#94a3b8",
                    fontSize: 14,
                    fontStyle: "italic",
                  }}
                >
                  No availability schedule submitted.
                </p>
              )}
            </Section>

            {/* Payout Information */}
            <Section icon="💳" title="Payout Information">
              <div className="drprofile__grid-read">
                <ReadField label="Bank Name" value={e.bankName} />
                {/* <ReadField label="Account Holder" value={e.accountHolderName} /> */}
                
                                <ReadField label="Account Number" value={e.accountNumber} />

{/* <ReadField
                  label="Account Number"
                  value={
                    e.accountNumber
                      ? `****${String(e.accountNumber).slice(-4)}`
                      : ""
                  }
                /> */}
                <ReadField label="SWIFT / BIC" value={e.ifscCode} />
                <ReadField label="PayPal ID" value={e.paypalId} />
                {/* <ReadField label="Payout Email" value={e.payoutEmail} /> */}
              </div>
            </Section>
          </>
        )}
      </div>
    </>
  );
}
