/* eslint-disable react-refresh/only-export-components -- shared layout tokens + a tiny component, not a routed module */
import { Country } from "country-state-city";

// Letterhead layout tokens and small pieces shared by the prescription slip (RxSlip) and the Visit Note slip, so both
// papers look the same. Moved here unchanged from RxSlip.jsx.
/* ── Certificate-style layout tokens (same as MedicalCertificateSlip) ──────── */
export const C_PRIMARY = "#12296B";
export const C_ACCENT = "#1E63D6";
export const C_LIGHT = "#EEF1F8";
export const C_SOFT = "#F6F8FC";
export const C_BORDER = "#D9DDE6";
export const C_MUTED = "#7A8194";
export const C_BODY = "#1F2433";
export const C_TAGLINE = "Global Health Passport";
export const C_SLIP_WIDTH = 794; // A4 at 96dpi
export const C_SLIP_HEIGHT = 1123; // one A4 page

export const C_CELL = {
  border: `1px solid ${C_BORDER}`,
  padding: "10px 16px",
  verticalAlign: "top",
  fontSize: 13,
  color: C_BODY,
};

export const C_TH = {
  border: `1px solid ${C_PRIMARY}`,
  padding: "9px 16px",
  fontSize: 12,
  fontWeight: 700,
  color: "#fff",
  background: C_PRIMARY,
  textAlign: "left",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

export function CertInfoField({ label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: C_PRIMARY,
          whiteSpace: "nowrap",
          letterSpacing: 0.3,
        }}
      >
        {label} :
      </span>
      <span
        style={{
          flex: 1,
          fontSize: 13,
          color: C_BODY,
          borderBottom: `1.2px solid ${C_BORDER}`,
          paddingBottom: 2,
          minWidth: 80,
        }}
      >
        {value || " "}
      </span>
    </div>
  );
}

export function getCountryName(countryCode) {
  if (!countryCode) return "";
  return Country.getCountryByCode(countryCode)?.name || countryCode;
}
