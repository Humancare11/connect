import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";

// ─── Constants ───
const COUNTRIES = [
  "United States","United Kingdom","India","Canada","Australia","Germany","France",
  "Brazil","Mexico","South Africa","Nigeria","Kenya","UAE","Saudi Arabia","Singapore",
  "Japan","South Korea","Philippines","Pakistan","Bangladesh","Sri Lanka","Nepal","Other"
];
const SPECIALTIES = [
  "General Practice","Internal Medicine","Cardiology","Dermatology","Endocrinology",
  "Gastroenterology","Neurology","Oncology","Ophthalmology","Orthopedics","Pediatrics",
  "Psychiatry","Pulmonology","Radiology","Surgery","Urology","OB/GYN","Emergency Medicine",
  "Anesthesiology","Pathology","Other"
];
const QUALIFICATIONS = ["MD","DO","NP","PA","Other"];
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

// Countries with state/province-level medical licensing
const STATE_LICENSING_COUNTRIES = {
  "United States": {
    label: "State",
    plural: "States",
    items: [
      "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware",
      "District of Columbia","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
      "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota",
      "Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey",
      "New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon",
      "Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah",
      "Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming"
    ]
  },
  "India": {
    label: "State/UT",
    plural: "States/UTs",
    items: [
      "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Goa",
      "Gujarat","Haryana","Himachal Pradesh","Jammu & Kashmir","Jharkhand","Karnataka",
      "Kerala","Ladakh","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
      "Nagaland","Odisha","Puducherry","Punjab","Rajasthan","Sikkim","Tamil Nadu",
      "Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Chandigarh"
    ]
  },
  "Australia": {
    label: "State/Territory",
    plural: "States/Territories",
    items: [
      "New South Wales","Victoria","Queensland","South Australia","Western Australia",
      "Tasmania","Northern Territory","Australian Capital Territory"
    ]
  },
  "Canada": {
    label: "Province/Territory",
    plural: "Provinces/Territories",
    items: [
      "Alberta","British Columbia","Manitoba","New Brunswick","Newfoundland and Labrador",
      "Northwest Territories","Nova Scotia","Nunavut","Ontario","Prince Edward Island",
      "Quebec","Saskatchewan","Yukon"
    ]
  },
  "Germany": {
    label: "Bundesland",
    plural: "Bundesländer",
    items: [
      "Baden-Württemberg","Bavaria","Berlin","Brandenburg","Bremen","Hamburg","Hesse",
      "Lower Saxony","Mecklenburg-Vorpommern","North Rhine-Westphalia","Rhineland-Palatinate",
      "Saarland","Saxony","Saxony-Anhalt","Schleswig-Holstein","Thuringia"
    ]
  },
  "Brazil": {
    label: "State",
    plural: "States",
    items: [
      "Acre","Alagoas","Amapá","Amazonas","Bahia","Ceará","Distrito Federal",
      "Espírito Santo","Goiás","Maranhão","Mato Grosso","Mato Grosso do Sul",
      "Minas Gerais","Pará","Paraíba","Paraná","Pernambuco","Piauí","Rio de Janeiro",
      "Rio Grande do Norte","Rio Grande do Sul","Rondônia","Roraima","Santa Catarina",
      "São Paulo","Sergipe","Tocantins"
    ]
  },
  "Mexico": {
    label: "State",
    plural: "States",
    items: [
      "Aguascalientes","Baja California","Baja California Sur","Campeche","Chiapas",
      "Chihuahua","Ciudad de México","Coahuila","Colima","Durango","Guanajuato",
      "Guerrero","Hidalgo","Jalisco","México","Michoacán","Morelos","Nayarit",
      "Nuevo León","Oaxaca","Puebla","Querétaro","Quintana Roo","San Luis Potosí",
      "Sinaloa","Sonora","Tabasco","Tamaulipas","Tlaxcala","Veracruz","Yucatán","Zacatecas"
    ]
  },
  "Nigeria": {
    label: "State",
    plural: "States",
    items: [
      "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno",
      "Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT Abuja","Gombe","Imo",
      "Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa",
      "Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara"
    ]
  }
};

const TIMEZONES = [
  "America/New_York (EST)","America/Chicago (CST)","America/Denver (MST)",
  "America/Los_Angeles (PST)","America/Anchorage (AKST)","Pacific/Honolulu (HST)",
  "Europe/London (GMT)","Europe/Berlin (CET)","Asia/Kolkata (IST)","Asia/Dubai (GST)",
  "Asia/Tokyo (JST)","Asia/Singapore (SGT)","Australia/Sydney (AEST)","Other"
];
const CURRENCIES = ["USD","GBP","EUR","INR","AED","SAR","AUD","CAD","SGD","JPY","Other"];
const LANGUAGES = [
  "English","Spanish","French","German","Arabic","Hindi","Portuguese",
  "Chinese (Mandarin)","Chinese (Cantonese)","Japanese","Korean","Italian",
  "Russian","Dutch","Turkish","Urdu","Bengali","Tamil","Telugu","Swahili","Other"
];
const GENDERS = ["Male","Female","Non-binary","Prefer not to say"];
const CONSULTATION_MODES = ["Video Call","In-Person","Both","Phone Call"];
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
  --teal: #0C8B7A;
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
.top-bar-logo span { color: var(--teal); }
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
  flex: 1; position: relative; z-index: 2;
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
  box-shadow: 0 0 0 4px rgba(12,139,122,0.15);
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
  overflow: hidden; width: 100%;
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
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* ─── Form ─── */
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.form-grid .full-width { grid-column: 1 / -1; }
.field-group { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 13px; font-weight: 600; color: var(--navy); display: flex; align-items: center; gap: 4px; }
.field-label .req { color: var(--red); font-size: 14px; }
.field-input, .field-select, .field-textarea {
  padding: 11px 14px; border: 1.5px solid var(--gray-200);
  border-radius: var(--radius-sm); font-family: 'DM Sans', sans-serif;
  font-size: 14px; color: var(--navy); background: var(--white);
  transition: var(--transition); outline: none; width: 100%;
}
.field-input:focus, .field-select:focus, .field-textarea:focus {
  border-color: var(--teal); box-shadow: 0 0 0 3px rgba(12,139,122,0.1);
}
.field-input.error, .field-select.error {
  border-color: var(--red); box-shadow: 0 0 0 3px rgba(220,38,38,0.08);
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
.btn-primary:hover { background: #0a7a6b; transform: translateY(-1px); box-shadow: var(--shadow-md); }
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
.upload-zone:hover { border-color: var(--teal); background: rgba(12,139,122,0.03); }
.upload-zone.has-file { border-color: var(--teal); border-style: solid; background: rgba(12,139,122,0.04); }
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
.ms-trigger.open { border-color: var(--teal); box-shadow: 0 0 0 3px rgba(12,139,122,0.1); }
.ms-placeholder { font-size: 13px; color: var(--gray-400); }
.ms-tag {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 10px; background: rgba(12,139,122,0.1);
  color: var(--teal); border-radius: 6px; font-size: 12px; font-weight: 600;
}
.ms-tag button {
  background: none; border: none; color: var(--teal);
  cursor: pointer; font-size: 14px; line-height: 1; padding: 0 2px;
}
.ms-tag button:hover { color: var(--red); }
.ms-overflow {
  font-size: 11px; font-weight: 600; color: var(--teal);
  background: rgba(12,139,122,0.08); padding: 3px 8px; border-radius: 50px;
}
.ms-dropdown {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0;
  background: var(--white); border: 1.5px solid var(--gray-200);
  border-radius: var(--radius-sm); box-shadow: var(--shadow-lg);
  z-index: 50; max-height: 260px; overflow: hidden;
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
  border-radius: var(--radius-sm); border: 1px solid var(--gray-200);
}
.license-section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
.license-section-header h4 { font-size: 15px; }
.ls-icon {
  width: 30px; height: 30px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; flex-shrink: 0;
}
.ls-icon.state { background: rgba(12,139,122,0.1); }
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
.time-input:focus { border-color: var(--teal); box-shadow: 0 0 0 3px rgba(12,139,122,0.1); }
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
.status-dot.reached { border-color: var(--teal); background: rgba(12,139,122,0.08); }
.status-dot.current { border-color: var(--teal); background: var(--teal); box-shadow: 0 0 0 4px rgba(12,139,122,0.15); }
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
@media (max-width: 640px) {
  .form-grid { grid-template-columns: 1fr; }
  .top-bar { padding: 12px 16px; flex-wrap: wrap; gap: 10px; }
  .de-card-body { padding: 20px 16px 24px; }
  .de-card-header { padding: 20px 16px 16px; }
  .de-card { max-height: none; }
  .progress-label { font-size: 9px; }
  .btn-row { flex-direction: column-reverse; gap: 10px; }
  .btn-row .btn { width: 100%; justify-content: center; }
  .time-block { flex-wrap: wrap; }
  .ms-dropdown { max-height: 220px; }
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

function MultiSelect({ items, selected, onChange, placeholder, searchPlaceholder }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = items.filter(i => i.toLowerCase().includes(search.toLowerCase()));
  const toggle = (item) => {
    onChange(selected.includes(item) ? selected.filter(s => s !== item) : [...selected, item]);
  };

  return (
    <div className="ms-wrapper" ref={ref}>
      <div className={`ms-trigger ${open ? "open" : ""}`} onClick={() => setOpen(!open)}>
        {selected.length === 0 ? (
          <span className="ms-placeholder">{placeholder}</span>
        ) : (
          <>
            {selected.slice(0, 3).map(s => (
              <span key={s} className="ms-tag">
                {s}
                <button onClick={e => { e.stopPropagation(); toggle(s); }}>×</button>
              </span>
            ))}
            {selected.length > 3 && <span className="ms-overflow">+{selected.length - 3} more</span>}
          </>
        )}
      </div>
      {open && (
        <div className="ms-dropdown animate-in">
          <input className="ms-search" placeholder={searchPlaceholder || "Search..."}
            value={search} onChange={e => setSearch(e.target.value)}
            onClick={e => e.stopPropagation()} autoFocus />
          <div className="ms-list">
            {filtered.length === 0 ? (
              <div className="ms-empty">No results found</div>
            ) : filtered.map(item => (
              <div key={item} className="ms-option" onClick={e => { e.stopPropagation(); toggle(item); }}>
                <div className={`ms-check ${selected.includes(item) ? "on" : ""}`}>
                  {selected.includes(item) && "✓"}
                </div>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FileUpload({ label, file, onFile, onRemove, required }) {
  const ref = useRef();
  const handleDrop = e => { e.preventDefault(); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); };
  return (
    <div className="field-group">
      <div className="field-label">{label} {required && <span className="req">*</span>}</div>
      {!file ? (
        <div className="upload-zone" onClick={() => ref.current?.click()}
          onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
          <div className="upload-icon">📁</div>
          <div className="upload-text"><strong>Click to upload</strong> or drag and drop</div>
          <div className="upload-text" style={{ fontSize: 11, marginTop: 4 }}>PDF, JPG, PNG up to 10MB</div>
          <input ref={ref} type="file" hidden accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]); }} />
        </div>
      ) : (
        <div className="upload-zone has-file">
          <div className="file-preview">
            <div className="file-icon">📄</div>
            <div className="file-info">
              <div className="file-name">{file.name}</div>
              <div className="file-size">{(file.size / 1024).toFixed(1)} KB</div>
            </div>
            <button className="file-remove" onClick={e => { e.stopPropagation(); onRemove(); }}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════
export default function DoctorOnboardingWizard({ doctorId, initialData, onComplete }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState({});

  // Step 1
  const [s1, setS1] = useState({
    firstName:"", surname:"", countryCode:"", phone:"", email:"",
    gender:"", dob:"", country:"", state:"", city:"", zip:"", address:"",
  });
  const [languagesKnown, setLanguagesKnown] = useState([]);
  const [s1Errors, setS1Errors] = useState({});

  // Step 2
  const [s2, setS2] = useState({
    npi:"", licenseNum:"", specialty:"", subSpecialization:"", qualification:"",
    school:"", gradYear:"", experience:"", medicalCouncilName:"",
    consultationMode:"", consultantFees:"", clinicName:"", clinicAddress:"",
    aboutDoctor:"", certifications:"",
  });
  const [files, setFiles] = useState({ govId: null, degree: null, medicalLicense: null });
  const [s2Errors, setS2Errors] = useState({});
  const [licensedStates, setLicensedStates] = useState([]);
  const [otherLicenseCountries, setOtherLicenseCountries] = useState([]);

  // Step 3
  const [availability, setAvailability] = useState(
    DAYS.reduce((a, d) => ({ ...a, [d]: { enabled: false, blocks: [{ start: "09:00", end: "17:00" }] } }), {})
  );
  const [timezone, setTimezone] = useState("");

  // Step 4
  const [payoutFreq, setPayoutFreq] = useState("monthly");
  const [s4, setS4] = useState({ bankName:"", accountNum:"", swift:"", iban:"", currency:"USD", paypalId:"" });
  const [s4Errors, setS4Errors] = useState({});

  // Step 5
  const [regStatus, setRegStatus] = useState("pending");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  const isUS = s1.country === "United States";
  const stateConfig = STATE_LICENSING_COUNTRIES[s1.country];
  const otherCountryOptions = COUNTRIES.filter(c => c !== s1.country && c !== "Other");
  const STEP_LABELS = ["Identity", "Professional", "Availability", "Payout", "Status"];

  // Populate form states from saved enrollment data
  const loadFromData = useCallback((data) => {
    if (!data) return;
    setS1({
      firstName:   data.firstName || "",
      surname:     data.surname || "",
      countryCode: data.countryCode || "",
      phone:       data.phoneNumber || "",
      email:       data.email || "",
      gender:      data.gender || "",
      dob:         data.dob || "",
      country:     data.country || "",
      state:       data.state || "",
      city:        data.city || "",
      zip:         data.zip || "",
      address:     data.address || "",
    });
    setLanguagesKnown(Array.isArray(data.languagesKnown) ? data.languagesKnown : []);
    setS2({
      npi:               data.medicalRegistrationNumber || "",
      licenseNum:        data.medicalLicense || data.medicalRegistrationNumber || "",
      specialty:         data.specialization || "",
      subSpecialization: data.subSpecialization || "",
      qualification:     data.qualification || "",
      school:            data.medicalSchool || "",
      gradYear:          data.registrationYear || "",
      experience:        data.experience ? String(data.experience) : "",
      medicalCouncilName: data.medicalCouncilName || "",
      consultationMode:  data.consultationMode || "",
      consultantFees:    data.consultantFees ? String(data.consultantFees) : "",
      clinicName:        data.clinicName || "",
      clinicAddress:     data.clinicAddress || "",
      aboutDoctor:       data.aboutDoctor || "",
      certifications:    "",
    });
    setS4({
      bankName:  data.bankName || "",
      accountNum: data.accountNumber || "",
      swift:     data.ifscCode || "",
      iban:      data.ifscCode || "",
      currency:  "USD",
      paypalId:  data.paypalId || "",
    });
    if (data.state) setLicensedStates([data.state]);
  }, []);

  useEffect(() => {
    if (!initialData) return;
    const nextStatus = ["pending", "approved", "rejected"].includes(initialData.approvalStatus)
      ? initialData.approvalStatus
      : "pending";
    setRegStatus(nextStatus);

    if (initialData.formCompleted) {
      // Full form was already submitted — show status screen
      setStep(5);
    } else {
      // Auto-created enrollment (just registered) — pre-fill basic info and start form
      loadFromData(initialData);
      setStep(1);
    }
  }, [initialData, loadFromData]);

  const handleEditResubmit = () => {
    loadFromData(initialData);
    setStep(1);
  };

  // Validation
  const validateS1 = () => {
    const e = {};
    if (!s1.firstName.trim()) e.firstName = "Required";
    if (!s1.phone.trim()) e.phone = "Required";
    if (!s1.email.trim()) e.email = "Required";
    else if (!/\S+@\S+\.\S+/.test(s1.email)) e.email = "Invalid email";
    if (!s1.country) e.country = "Required";
    setS1Errors(e);
    return Object.keys(e).length === 0;
  };
  const validateS2 = () => {
    const e = {};
    if (isUS && !s2.npi.trim()) e.npi = "NPI required for US";
    if (!isUS && !s2.licenseNum.trim()) e.licenseNum = "License number required";
    if (!s2.specialty) e.specialty = "Required";
    if (!s2.qualification) e.qualification = "Required";
    if (!s2.school.trim()) e.school = "Required";
    if (!s2.gradYear.trim()) e.gradYear = "Required";
    if (!files.govId) e.govId = "Required";
    if (!files.degree) e.degree = "Required";
    if (!files.medicalLicense) e.medicalLicense = "Required";
    setS2Errors(e);
    return Object.keys(e).length === 0;
  };
  const validateS4 = () => {
    const e = {};
    if (isUS) {
      if (!s4.bankName.trim()) e.bankName = "Required";
      if (!s4.accountNum.trim()) e.accountNum = "Required";
      if (!s4.swift.trim()) e.swift = "Required";
    } else {
      if (!s4.iban.trim()) e.iban = "Required";
      if (!s4.swift.trim()) e.swift = "Required";
      if (!s4.currency) e.currency = "Required";
    }
    setS4Errors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (submitBusy) return;
    if (step === 1 && validateS1()) setStep(2);
    else if (step === 2 && validateS2()) setStep(3);
    else if (step === 3) setStep(4);
    else if (step === 4 && validateS4()) submitEnrollment();
  };
  const handleBack = () => { if (step > 1) setStep(step - 1); };
  const saveDraft = () => setDraft({ s1, s2, languagesKnown, files, availability, timezone, s4, payoutFreq, licensedStates, otherLicenseCountries, step });

  const submitEnrollment = async () => {
    if (!doctorId) {
      setSubmitError("Doctor session not found. Please sign in again.");
      return;
    }

    const payload = {
      doctorId,
      firstName:     s1.firstName.trim(),
      surname:       s1.surname.trim(),
      email:         s1.email.trim(),
      countryCode:   s1.countryCode.trim(),
      phoneNumber:   s1.phone.trim(),
      gender:        s1.gender,
      dob:           s1.dob,
      country:       s1.country,
      state:         licensedStates[0] || s1.state,
      city:          s1.city.trim(),
      zip:           s1.zip.trim(),
      address:       s1.address.trim(),
      languagesKnown,
      specialization:        s2.specialty,
      subSpecialization:     s2.subSpecialization.trim(),
      qualification:         s2.qualification,
      experience:            s2.experience ? Number(s2.experience) : undefined,
      medicalSchool:         s2.school.trim(),
      registrationYear:      s2.gradYear.trim(),
      medicalCouncilName:    s2.medicalCouncilName.trim(),
      medicalRegistrationNumber: isUS ? s2.npi.trim() : s2.licenseNum.trim(),
      medicalLicense:        s2.licenseNum.trim(),
      consultationMode:      s2.consultationMode,
      consultantFees:        s2.consultantFees ? Number(s2.consultantFees) : 0,
      clinicName:            s2.clinicName.trim(),
      clinicAddress:         s2.clinicAddress.trim(),
      aboutDoctor:           s2.aboutDoctor.trim() || s2.certifications.trim(),
      idProof:               files.govId?.name || "",
      medicalLicenseFile:    files.medicalLicense?.name || "",
      accountHolderName:     `${s1.firstName} ${s1.surname}`.trim(),
      payoutEmail:           s1.email.trim(),
      bankName:              s4.bankName.trim(),
      accountNumber:         s4.accountNum.trim(),
      ifscCode:              s4.swift.trim(),
      paypalId:              s4.paypalId.trim(),
    };

    setSubmitBusy(true);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const res = await api.post("/api/doctor/enrollment", payload);
      const enrollment = res.data?.enrollment || null;
      const nextStatus = enrollment?.approvalStatus === "approved" ? "approved" : "pending";
      setRegStatus(nextStatus);
      setSubmitSuccess(res.data?.message || "Enrollment submitted successfully.");
      setStep(5);
      if (enrollment && typeof onComplete === "function") onComplete(enrollment);
    } catch (err) {
      setSubmitError(err.response?.data?.message || "Failed to submit enrollment. Please try again.");
    } finally {
      setSubmitBusy(false);
    }
  };

  // ─── STEP 1 ───
  const renderStep1 = () => (
    <div className="animate-in">
      <div className="de-card-header">
        <h2>Personal &amp; Contact Details</h2>
        <p>Enter your details exactly as they appear on your official documents.</p>
      </div>
      <div className="de-card-body">
        <h4 style={{fontSize:13,marginBottom:14,color:"var(--gray-600)"}}>Name</h4>
        <div className="form-grid">
          <div className="field-group">
            <label className="field-label">First Name <span className="req">*</span></label>
            <input className={`field-input ${s1Errors.firstName?"error":""}`} placeholder="First name"
              value={s1.firstName} onChange={e => setS1({...s1, firstName: e.target.value})} />
            {s1Errors.firstName && <div className="field-error">{s1Errors.firstName}</div>}
          </div>
          <div className="field-group">
            <label className="field-label">Surname / Last Name</label>
            <input className="field-input" placeholder="Surname"
              value={s1.surname} onChange={e => setS1({...s1, surname: e.target.value})} />
          </div>
        </div>

        <h4 style={{fontSize:13,margin:"20px 0 14px",color:"var(--gray-600)"}}>Contact</h4>
        <div className="form-grid">
          <div className="field-group">
            <label className="field-label">Mobile Number <span className="req">*</span></label>
            <div style={{display:"flex",gap:8}}>
              <input className="field-input" style={{width:80,flexShrink:0}} placeholder="+1"
                value={s1.countryCode} onChange={e => setS1({...s1, countryCode: e.target.value})} />
              <input className={`field-input ${s1Errors.phone?"error":""}`} placeholder="555-000-0000"
                value={s1.phone} onChange={e => setS1({...s1, phone: e.target.value})} />
            </div>
            {s1Errors.phone && <div className="field-error">{s1Errors.phone}</div>}
          </div>
          <div className="field-group">
            <label className="field-label">Email Address <span className="req">*</span></label>
            <input className={`field-input ${s1Errors.email?"error":""}`} placeholder="doctor@email.com" type="email"
              value={s1.email} onChange={e => setS1({...s1, email: e.target.value})} />
            {s1Errors.email && <div className="field-error">{s1Errors.email}</div>}
          </div>
          <div className="field-group">
            <label className="field-label">Gender</label>
            <select className="field-select" value={s1.gender} onChange={e => setS1({...s1, gender: e.target.value})}>
              <option value="">Select...</option>
              {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label className="field-label">Date of Birth</label>
            <input className="field-input" type="date"
              value={s1.dob} onChange={e => setS1({...s1, dob: e.target.value})} />
          </div>
        </div>

        <h4 style={{fontSize:13,margin:"20px 0 14px",color:"var(--gray-600)"}}>Location</h4>
        <div className="form-grid">
          <div className="field-group full-width">
            <label className="field-label">Country of Practice <span className="req">*</span></label>
            <select className={`field-select ${s1Errors.country?"error":""}`}
              value={s1.country} onChange={e => { setS1({...s1, country: e.target.value, state:""}); setLicensedStates([]); setOtherLicenseCountries([]); }}>
              <option value="">Select country...</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {s1Errors.country && <div className="field-error">{s1Errors.country}</div>}
          </div>
          <div className="field-group">
            <label className="field-label">State / Province / Region</label>
            <input className="field-input" placeholder="e.g. California, Maharashtra"
              value={s1.state} onChange={e => setS1({...s1, state: e.target.value})} />
          </div>
          <div className="field-group">
            <label className="field-label">City</label>
            <input className="field-input" placeholder="City"
              value={s1.city} onChange={e => setS1({...s1, city: e.target.value})} />
          </div>
          <div className="field-group">
            <label className="field-label">ZIP / Postal Code</label>
            <input className="field-input" placeholder="ZIP or postal code"
              value={s1.zip} onChange={e => setS1({...s1, zip: e.target.value})} />
          </div>
          <div className="field-group full-width">
            <label className="field-label">Street Address</label>
            <input className="field-input" placeholder="Full street address"
              value={s1.address} onChange={e => setS1({...s1, address: e.target.value})} />
          </div>
        </div>

        <h4 style={{fontSize:13,margin:"20px 0 14px",color:"var(--gray-600)"}}>Languages</h4>
        <div className="field-group">
          <label className="field-label">Languages Known</label>
          <MultiSelect
            items={LANGUAGES}
            selected={languagesKnown}
            onChange={setLanguagesKnown}
            placeholder="Select languages you speak..."
            searchPlaceholder="Search languages..."
          />
        </div>

        <div className="btn-row">
          <div />
          <button className="btn btn-primary" onClick={handleNext}>Continue to Professional Info →</button>
        </div>
      </div>
    </div>
  );

  // ─── STEP 2 ───
  const renderStep2 = () => (
    <div className="animate-in">
      <div className="de-card-header">
        <h2>Professional Information</h2>
        <p>Provide your medical credentials, licensing details, and upload required documents.</p>
      </div>
      <div className="de-card-body">
        <h4 style={{fontSize:13,marginBottom:14,color:"var(--gray-600)"}}>Credentials &amp; Licensing</h4>
        <div className="form-grid">
          {isUS ? (
            <div className="field-group">
              <label className="field-label">NPI Number <span className="req">*</span></label>
              <input className={`field-input ${s2Errors.npi?"error":""}`} placeholder="10-digit NPI"
                value={s2.npi} onChange={e => setS2({...s2, npi: e.target.value})} />
              {s2Errors.npi && <div className="field-error">{s2Errors.npi}</div>}
            </div>
          ) : (
            <div className="field-group">
              <label className="field-label">Medical License Number <span className="req">*</span></label>
              <input className={`field-input ${s2Errors.licenseNum?"error":""}`} placeholder="License number"
                value={s2.licenseNum} onChange={e => setS2({...s2, licenseNum: e.target.value})} />
              {s2Errors.licenseNum && <div className="field-error">{s2Errors.licenseNum}</div>}
            </div>
          )}
          <div className="field-group">
            <label className="field-label">Medical Council Name</label>
            <input className="field-input" placeholder="e.g. MCI, GMC, AMA"
              value={s2.medicalCouncilName} onChange={e => setS2({...s2, medicalCouncilName: e.target.value})} />
          </div>
          <div className="field-group">
            <label className="field-label">Specialty <span className="req">*</span></label>
            <select className={`field-select ${s2Errors.specialty?"error":""}`}
              value={s2.specialty} onChange={e => setS2({...s2, specialty: e.target.value})}>
              <option value="">Select specialty...</option>
              {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {s2Errors.specialty && <div className="field-error">{s2Errors.specialty}</div>}
          </div>
          <div className="field-group">
            <label className="field-label">Sub-Specialization</label>
            <input className="field-input" placeholder="e.g. Interventional Cardiology"
              value={s2.subSpecialization} onChange={e => setS2({...s2, subSpecialization: e.target.value})} />
          </div>
          <div className="field-group">
            <label className="field-label">Qualification <span className="req">*</span></label>
            <select className={`field-select ${s2Errors.qualification?"error":""}`}
              value={s2.qualification} onChange={e => setS2({...s2, qualification: e.target.value})}>
              <option value="">Select...</option>
              {QUALIFICATIONS.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
            {s2Errors.qualification && <div className="field-error">{s2Errors.qualification}</div>}
          </div>
          <div className="field-group">
            <label className="field-label">Years of Experience</label>
            <input className="field-input" type="number" min="0" placeholder="e.g. 10"
              value={s2.experience} onChange={e => setS2({...s2, experience: e.target.value})} />
          </div>
        </div>

        {/* ═══ STATE / PROVINCE LICENSING ═══ */}
        {stateConfig && (
          <div className="license-section animate-in">
            <div className="license-section-header">
              <div className="ls-icon state">🏛️</div>
              <h4>{stateConfig.label} Licensing — {s1.country}</h4>
            </div>
            <p className="ls-desc">
              In {s1.country}, doctors require {stateConfig.label.toLowerCase()}-level licensing. Select all {stateConfig.plural.toLowerCase()} where you are currently licensed to practice medicine.
            </p>
            <div className="field-group">
              <label className="field-label">Licensed {stateConfig.plural}</label>
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
                {licensedStates.map(st => (
                  <div key={st} className="sel-license-card"><div className="sl-dot" />{st}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ INTERNATIONAL LICENSES ═══ */}
        <div className="license-section animate-in" style={{marginTop: stateConfig ? 16 : 24}}>
          <div className="license-section-header">
            <div className="ls-icon intl">🌍</div>
            <h4>International Medical Licenses</h4>
          </div>
          <p className="ls-desc">
            Do you hold a valid medical license in any other countries besides {s1.country || "your primary country"}? This helps us determine cross-border telehealth eligibility and widen your patient reach.
          </p>
          <div className="field-group">
            <label className="field-label">Other Countries Where You Hold a Medical License</label>
            <MultiSelect
              items={otherCountryOptions}
              selected={otherLicenseCountries}
              onChange={setOtherLicenseCountries}
              placeholder="Select countries (if applicable)..."
              searchPlaceholder="Search countries..."
            />
          </div>
          {otherLicenseCountries.length > 0 && (
            <div className="selected-licenses-grid">
              {otherLicenseCountries.map(c => (
                <div key={c} className="sel-license-card">
                  <div className="sl-dot" style={{background:"var(--gold)"}} />{c}
                </div>
              ))}
            </div>
          )}
        </div>

        <h4 style={{fontSize:13,margin:"20px 0 14px",color:"var(--gray-600)"}}>Education</h4>
        <div className="form-grid">
          <div className="field-group">
            <label className="field-label">Medical School <span className="req">*</span></label>
            <input className={`field-input ${s2Errors.school?"error":""}`} placeholder="School name"
              value={s2.school} onChange={e => setS2({...s2, school: e.target.value})} />
            {s2Errors.school && <div className="field-error">{s2Errors.school}</div>}
          </div>
          <div className="field-group">
            <label className="field-label">Graduation Year <span className="req">*</span></label>
            <input className={`field-input ${s2Errors.gradYear?"error":""}`} placeholder="YYYY"
              value={s2.gradYear} onChange={e => setS2({...s2, gradYear: e.target.value})} />
            {s2Errors.gradYear && <div className="field-error">{s2Errors.gradYear}</div>}
          </div>
          <div className="field-group full-width">
            <label className="field-label">Additional Certifications</label>
            <textarea className="field-textarea" placeholder="Board certifications, fellowships, etc."
              value={s2.certifications} onChange={e => setS2({...s2, certifications: e.target.value})} />
          </div>
        </div>

        <h4 style={{fontSize:13,margin:"20px 0 14px",color:"var(--gray-600)"}}>Consultation &amp; Practice</h4>
        <div className="form-grid">
          <div className="field-group">
            <label className="field-label">Consultation Fee (USD)</label>
            <div style={{display:"flex",alignItems:"center",border:"1.5px solid var(--gray-200)",borderRadius:"var(--radius-sm)",overflow:"hidden",background:"var(--white)"}}>
              <span style={{padding:"11px 12px",background:"var(--gray-100)",color:"var(--gray-600)",fontWeight:700,borderRight:"1.5px solid var(--gray-200)",fontSize:15}}>$</span>
              <input className="field-input" style={{border:"none",borderRadius:0,boxShadow:"none"}} type="number" min="0" step="1" placeholder="e.g. 50"
                value={s2.consultantFees} onChange={e => setS2({...s2, consultantFees: e.target.value})} />
              <span style={{padding:"11px 10px",fontSize:12,color:"var(--gray-400)",whiteSpace:"nowrap"}}>USD</span>
            </div>
          </div>
          <div className="field-group">
            <label className="field-label">Clinic / Practice Name</label>
            <input className="field-input" placeholder="e.g. City Health Clinic"
              value={s2.clinicName} onChange={e => setS2({...s2, clinicName: e.target.value})} />
          </div>
          <div className="field-group">
            <label className="field-label">Clinic Address</label>
            <input className="field-input" placeholder="Clinic street address"
              value={s2.clinicAddress} onChange={e => setS2({...s2, clinicAddress: e.target.value})} />
          </div>
          <div className="field-group full-width">
            <label className="field-label">About You</label>
            <textarea className="field-textarea" placeholder="Brief professional bio, areas of focus, patient care philosophy..."
              value={s2.aboutDoctor} onChange={e => setS2({...s2, aboutDoctor: e.target.value})} />
          </div>
        </div>

        <h4 style={{fontSize:14,margin:"24px 0 16px",color:"var(--gray-600)"}}>Required Documents</h4>
        <div className="form-grid">
          <FileUpload label="Government ID / Nationality Proof" required file={files.govId}
            onFile={f => setFiles({...files, govId: f})} onRemove={() => setFiles({...files, govId: null})} />
          <FileUpload label="Medical Degree Certificate" required file={files.degree}
            onFile={f => setFiles({...files, degree: f})} onRemove={() => setFiles({...files, degree: null})} />
          <FileUpload label="Medical License Document" required file={files.medicalLicense}
            onFile={f => setFiles({...files, medicalLicense: f})} onRemove={() => setFiles({...files, medicalLicense: null})} />
        </div>
        {(s2Errors.govId||s2Errors.degree||s2Errors.medicalLicense) && (
          <div className="field-error" style={{marginTop:8}}>Please upload all required documents.</div>
        )}

        <div className="btn-row">
          <button className="btn btn-secondary" onClick={handleBack}>← Back</button>
          <div style={{display:"flex",gap:10}}>
            <button className="btn btn-outline btn-sm" onClick={saveDraft}>Save Draft</button>
            <button className="btn btn-primary" onClick={handleNext}>Continue →</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── STEP 3 ───
  const toggleDay = day => setAvailability(p => ({...p,[day]:{...p[day],enabled:!p[day].enabled}}));
  const updateBlock = (day,idx,field,val) => setAvailability(p => {
    const blocks=[...p[day].blocks]; blocks[idx]={...blocks[idx],[field]:val};
    return {...p,[day]:{...p[day],blocks}};
  });
  const addBlock = day => setAvailability(p => ({...p,[day]:{...p[day],blocks:[...p[day].blocks,{start:"09:00",end:"17:00"}]}}));
  const removeBlock = (day,idx) => setAvailability(p => {
    const blocks=p[day].blocks.filter((_,i)=>i!==idx);
    return {...p,[day]:{...p[day],blocks:blocks.length?blocks:[{start:"09:00",end:"17:00"}]}};
  });

  const renderStep3 = () => (
    <div className="animate-in">
      <div className="de-card-header">
        <h2>Availability Setup</h2>
        <p>Set your weekly schedule. Patients will book based on these time slots.</p>
      </div>
      <div className="de-card-body">
        <div className="field-group" style={{marginBottom:20}}>
          <label className="field-label">Timezone <span className="req">*</span></label>
          <select className="field-select" value={timezone} onChange={e => setTimezone(e.target.value)}>
            <option value="">Select timezone...</option>
            {TIMEZONES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {DAYS.map(day => (
          <div key={day} className="avail-day">
            <div className="avail-day-header">
              <span className="avail-day-name">{day}</span>
              <button className={`avail-toggle ${availability[day].enabled?"on":""}`}
                onClick={() => toggleDay(day)} aria-label={`Toggle ${day}`} />
            </div>
            {availability[day].enabled && (
              <div className="animate-in">
                {availability[day].blocks.map((block,i) => (
                  <div key={i} className="time-block">
                    <input type="time" className="time-input" value={block.start} onChange={e => updateBlock(day,i,"start",e.target.value)} />
                    <span className="time-sep">to</span>
                    <input type="time" className="time-input" value={block.end} onChange={e => updateBlock(day,i,"end",e.target.value)} />
                    {availability[day].blocks.length > 1 && <button className="btn btn-danger btn-xs" onClick={() => removeBlock(day,i)}>✕</button>}
                  </div>
                ))}
                <button className="btn btn-outline btn-xs" style={{marginTop:4}} onClick={() => addBlock(day)}>+ Add Time Block</button>
              </div>
            )}
          </div>
        ))}
        <div className="btn-row">
          <button className="btn btn-secondary" onClick={handleBack}>← Back</button>
          <div style={{display:"flex",gap:10}}>
            <button className="btn btn-outline btn-sm" onClick={saveDraft}>Save Draft</button>
            <button className="btn btn-primary" onClick={handleNext}>Continue →</button>
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
        <p>Configure how and when you'd like to receive payments.{isUS ? " US banking details required." : " International transfer details required."}</p>
      </div>
      <div className="de-card-body">
        <div style={{display:"flex",gap:10,marginBottom:24}}>
          {["weekly","monthly"].map(f => (
            <button key={f} className={`btn ${payoutFreq===f?"btn-primary":"btn-outline"} btn-sm`}
              onClick={() => setPayoutFreq(f)}>{f.charAt(0).toUpperCase()+f.slice(1)} Payout</button>
          ))}
        </div>
        {isUS ? (
          <div className="form-grid">
            <div className="field-group">
              <label className="field-label">Bank Name <span className="req">*</span></label>
              <input className={`field-input ${s4Errors.bankName?"error":""}`} placeholder="Bank name"
                value={s4.bankName} onChange={e => setS4({...s4,bankName:e.target.value})} />
              {s4Errors.bankName && <div className="field-error">{s4Errors.bankName}</div>}
            </div>
            <div className="field-group">
              <label className="field-label">Account Number <span className="req">*</span></label>
              <input className={`field-input ${s4Errors.accountNum?"error":""}`} placeholder="Account number"
                value={s4.accountNum} onChange={e => setS4({...s4,accountNum:e.target.value})} />
              {s4Errors.accountNum && <div className="field-error">{s4Errors.accountNum}</div>}
            </div>
            <div className="field-group">
              <label className="field-label">SWIFT / BIC Code <span className="req">*</span></label>
              <input className={`field-input ${s4Errors.swift?"error":""}`} placeholder="SWIFT code"
                value={s4.swift} onChange={e => setS4({...s4,swift:e.target.value})} />
              {s4Errors.swift && <div className="field-error">{s4Errors.swift}</div>}
            </div>
            <div className="field-group">
              <label className="field-label">PayPal ID</label>
              <input className="field-input" placeholder="PayPal email or username"
                value={s4.paypalId} onChange={e => setS4({...s4,paypalId:e.target.value})} />
            </div>
          </div>
        ) : (
          <div className="form-grid">
            <div className="field-group">
              <label className="field-label">IBAN <span className="req">*</span></label>
              <input className={`field-input ${s4Errors.iban?"error":""}`} placeholder="International Bank Account Number"
                value={s4.iban} onChange={e => setS4({...s4,iban:e.target.value})} />
              {s4Errors.iban && <div className="field-error">{s4Errors.iban}</div>}
            </div>
            <div className="field-group">
              <label className="field-label">SWIFT / BIC Code <span className="req">*</span></label>
              <input className={`field-input ${s4Errors.swift?"error":""}`} placeholder="SWIFT code"
                value={s4.swift} onChange={e => setS4({...s4,swift:e.target.value})} />
              {s4Errors.swift && <div className="field-error">{s4Errors.swift}</div>}
            </div>
            <div className="field-group">
              <label className="field-label">Preferred Currency <span className="req">*</span></label>
              <select className={`field-select ${s4Errors.currency?"error":""}`}
                value={s4.currency} onChange={e => setS4({...s4,currency:e.target.value})}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field-group">
              <label className="field-label">PayPal ID</label>
              <input className="field-input" placeholder="PayPal email or username"
                value={s4.paypalId} onChange={e => setS4({...s4,paypalId:e.target.value})} />
            </div>
          </div>
        )}
        {submitError && <div className="field-error" style={{ marginTop: 12 }}>{submitError}</div>}
        {submitSuccess && <div className="success-banner" style={{ marginTop: 12 }}>{submitSuccess}</div>}
        <div className="btn-row">
          <button className="btn btn-secondary" onClick={handleBack}>← Back</button>
          <div style={{display:"flex",gap:10}}>
            <button className="btn btn-outline btn-sm" onClick={saveDraft}>Save Draft</button>
            <button className="btn btn-primary" onClick={handleNext} disabled={submitBusy}>
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
  const statusIdx = approvalPipeline.findIndex(s => s.key === regStatus);
  const safeStatusIdx = statusIdx === -1 ? 0 : statusIdx;
  const isRejected = regStatus === "rejected";
  const renderStep5 = () => (
    <div className="animate-in">
      <div className="de-card-header">
        <h2>Registration Status</h2>
        <p>Your application has been submitted and sent to admin for approval.</p>
      </div>
      <div className="de-card-body">
        <div className="status-dashboard">
          <div className="status-pipeline">
            <div className="status-line-bg" />
            <div className="status-line-fill" style={{width:`${safeStatusIdx/(approvalPipeline.length-1)*80}%`}} />
            {approvalPipeline.map((st,i) => (
              <div key={st.key} className="status-node">
                <div className={`status-dot ${i<safeStatusIdx?"reached":""} ${i===safeStatusIdx?"current":""}`}>
                  <span className="st-icon">{st.icon}</span>
                </div>
                <div className={`status-name ${i<safeStatusIdx?"reached":""} ${i===safeStatusIdx?"current":""}`}>{st.label}</div>
              </div>
            ))}
          </div>
          <div className="status-info-card">
            <h3>{isRejected ? "❌ Rejected" : `${approvalPipeline[safeStatusIdx]?.icon} ${approvalPipeline[safeStatusIdx]?.label}`}</h3>
            <p>
              {regStatus==="pending"&&"Your request has been sent to admin and is awaiting approval."}
              {regStatus==="approved"&&"Your application has been approved by admin."}
              {regStatus==="rejected"&&"Your application was rejected by admin. Please update details and resubmit."}
            </p>
          </div>
          <div style={{marginTop:20,padding:16,background:"var(--gray-50)",borderRadius:"var(--radius-sm)",border:"1px dashed var(--gray-300)"}}>
            <div style={{fontSize:12,fontWeight:600,color:"var(--gray-500)"}}>
              Status updates are managed by admin review.
            </div>
          </div>
          {regStatus === "approved" && (
            <div style={{marginTop:16}}>
              <div className="success-banner animate-in" style={{marginBottom:12}}>
                ✓ Approved by admin — your profile is now live on the platform.
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => navigate("/doctor-dashboard")}>
                Go to Dashboard →
              </button>
            </div>
          )}
          {regStatus === "pending" && (
            <div style={{ marginTop: 16, display:"flex", gap:10, flexWrap:"wrap" }}>
              <button className="btn btn-outline btn-sm" onClick={handleEditResubmit}>
                Edit Application
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => navigate("/doctor-pending")}>
                View Application Status →
              </button>
            </div>
          )}
          {regStatus === "rejected" && (
            <div style={{ marginTop: 16, display:"flex", gap:10, flexWrap:"wrap" }}>
              <button className="btn btn-primary btn-sm" onClick={handleEditResubmit}>
                Edit &amp; Resubmit
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => navigate("/doctor-pending")}>
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
          <div className="top-bar-logo">Humancare<span>Connect</span></div>
          {step < 5 && <div className="draft-badge"><div className="dot" /> Draft Saved</div>}
        </div>

        <div className="progress-section">
          <div className="progress-steps">
            <div className="progress-line-bg" />
            <div className="progress-line-fill" style={{ width: `${((step - 1) / (STEP_LABELS.length - 1)) * 80}%` }} />
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="progress-step">
                <div className={`progress-circle ${i + 1 === step ? "active" : ""} ${i + 1 < step ? "done" : ""}`}>
                  {i + 1 < step ? "✓" : i + 1}
                </div>
                <div className={`progress-label ${i + 1 === step ? "active" : ""} ${i + 1 < step ? "done" : ""}`}>{label}</div>
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

