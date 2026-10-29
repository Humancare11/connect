/**
 * MedicalCertificateSlip — letterhead-style certificate component.
 * Mirrors PrescriptionSlip exactly: same logo, same header, same footer,
 * same color scheme, same QR code, same 794 px A4 width.
 *
 * Props:
 *   cert             — certificate object
 *   patient          — { name, dob, gender }
 *   doctor           — { name } from auth context (optional; falls back to cert.doctorId.name)
 *   doctorEnrollment — { specialization, qualification, clinicName, clinicAddress,
 *                        medicalRegistrationNumber, medicalCouncilName } (optional)
 *   slipRef          — ref forwarded to root div for PDF capture
 */

import logoFull from "../assets/Logo.png";
import footerQr from "../assets/New-Footer-QR.jpeg";
import footerLogo from "../assets/prescription-logo.png";

/* ── Shared design tokens (identical to PrescriptionSlip) ─────────────────── */
const PRIMARY = "#12296B"; // navy
const ACCENT = "#1E63D6"; // footer line + verified tick
const LIGHT = "#EEF1F8"; // light bands
const SOFT = "#F6F8FC"; // statement box, clinic row, even table rows
const BORDER = "#D9DDE6";
const MUTED = "#7A8194";
const BODY = "#1F2433";
const FOOT_TEXT = "#4A5268";

const COMPANY = {
  tagline: "Global Health Passport",
  phone: "+1 (302) 303-9993",
  email: "support@humancareconnect.co",
  address: "4 Peddlers Row #1091 Newark, DE 19702, United States",
};

const SLIP_WIDTH = 794; // A4 at 96dpi — matches the slip root width
const SLIP_HEIGHT = 1123; // one A4 page

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function calcAge(dob) {
  if (!dob) return "";
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return "";
  return Math.floor(
    (Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
  );
}

function fmtDate(d) {
  if (!d) return "—";
  const p = new Date(d);
  if (isNaN(p)) return d;
  return p.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ── Sub-components (same as PrescriptionSlip) ───────────────────────────── */
function InfoField({ label, value, style = {} }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, ...style }}>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: PRIMARY,
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
          color: BODY,
          borderBottom: `1.2px solid ${BORDER}`,
          paddingBottom: 2,
          minWidth: 80,
        }}
      >
        {value || " "}
      </span>
    </div>
  );
}

// Footer QR — same image as the prescription footer.
function CertificateQR() {
  return (
    <img
      src={footerQr}
      alt="Humancare Connect QR code"
      width={100}
      height={100}
      style={{
        width: 100,
        height: 100,
        display: "block",
        flexShrink: 0,
        boxSizing: "border-box",
        objectFit: "contain",
        border: "1px solid var(--line, #dde2ea)",
        borderRadius: 6,
        padding: 4,
        background: "#fff",
      }}
      crossOrigin="anonymous"
    />
  );
}

function VerifiedTick() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" style={{ flexShrink: 0 }}>
      <path
        fill="#1E63D6"
        d="M12 1.5l2.6 1.9 3.2-.1 1 3.1 2.6 1.9-1 3.1 1 3.1-2.6 1.9-1 3.1-3.2-.1L12 22.5l-2.6-1.9-3.2.1-1-3.1-2.6-1.9 1-3.1-1-3.1 2.6-1.9 1-3.1 3.2.1z"
      />
      <path
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.8 12.3l2.8 2.8 5.6-5.8"
      />
    </svg>
  );
}

/* ── Details table cells ─────────────────────────────────────────────────── */
const CELL = {
  border: `1px solid ${BORDER}`,
  padding: "10px 16px",
  verticalAlign: "top",
};

function DetailRow({ label, children, shaded }) {
  return (
    <tr style={{ background: shaded ? SOFT : "#fff" }}>
      <td
        style={{
          ...CELL,
          fontSize: 12,
          fontWeight: 700,
          color: PRIMARY,
        }}
      >
        {label}
      </td>
      <td style={{ ...CELL, fontSize: 13, color: BODY }}>{children}</td>
    </tr>
  );
}

const TH = {
  border: `1px solid ${PRIMARY}`,
  padding: "9px 16px",
  fontSize: 12,
  fontWeight: 700,
  color: "#fff",
  background: PRIMARY,
  textAlign: "left",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

/* ── Main Component ──────────────────────────────────────────────────────── */
export function MedicalCertificateSlip({
  cert,
  patient,
  doctor,
  doctorEnrollment,
  slipRef,
}) {
  const age = calcAge(patient?.dob);
  const ageSex = [age ? `${age} yrs` : "", patient?.gender]
    .filter(Boolean)
    .join(" / ");
  const certId = cert?._id
    ? `HC-CERT-${String(cert._id).slice(-8).toUpperCase()}`
    : "—";

  /* Resolve doctor info — prefer passed prop, fall back to embedded cert data */
  const doctorName = doctor?.name || cert?.doctorId?.name || "—";
  const enrollment = doctorEnrollment || cert?.doctorEnrollment || {};
  const specialty = enrollment.specialization || "";
  const qualification = enrollment.qualification || "";
  const regNumber = enrollment.medicalRegistrationNumber || "";
  const councilName = enrollment.medicalCouncilName || "";
  const clinicName = enrollment.clinicName || "Humancare Connect";
  const clinicAddress = enrollment.clinicAddress || COMPANY.address;

  const hasRestPeriod = cert?.restFromDate || cert?.restToDate;
  const issued = fmtDate(cert?.issuedDate || cert?.createdAt);


  const detailRows = [
    { label: "Diagnosis / Condition", value: cert?.diagnosis || "—" },
    cert?.recommendation && {
      label: "Recommendation",
      value: cert.recommendation,
    },
    hasRestPeriod && {
      label: "Rest Period",
      value:
        cert.restFromDate && cert.restToDate
          ? `${fmtDate(cert.restFromDate)} to ${fmtDate(cert.restToDate)}`
          : cert.restFromDate
            ? `From ${fmtDate(cert.restFromDate)}`
            : `Until ${fmtDate(cert.restToDate)}`,
    },
    cert?.notes && { label: "Additional Notes", value: cert.notes },
  ].filter(Boolean);

  return (
    <div
      ref={slipRef}
      style={{
        width: SLIP_WIDTH,
        minHeight: SLIP_HEIGHT,
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        fontFamily: "var(--font-secondary)",
        boxSizing: "border-box",
        color: BODY,
      }}
    >
      {/* Everything above the footer; flex: 1 keeps the footer at the bottom */}
      <div style={{ flex: 1 }}>
        {/* ── Top accent bar ───────────────────────────────────────── */}
        <div
          style={{
            height: 6,
            background: `linear-gradient(90deg, #0C1D4F, ${PRIMARY} 60%, ${ACCENT})`,
          }}
        />

        {/* ── Header ───────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 40px 16px",
            borderBottom: `2px solid ${LIGHT}`,
            background: "#fff",
          }}
        >
          <img
            src={logoFull}
            alt="Humancare Connect"
            style={{ height: 54, objectFit: "contain", display: "block" }}
            crossOrigin="anonymous"
          />
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: PRIMARY,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              {COMPANY.tagline}
            </div>
            <div
              style={{
                width: 48,
                height: 4,
                borderRadius: 2,
                background: PRIMARY,
                marginLeft: "auto",
              }}
            />
          </div>
        </div>

        {/* ── Document type banner ─────────────────────────────────── */}
        <div
          style={{
            background: LIGHT,
            padding: "10px 40px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>
              Medical Certificate
            </div>
            {cert?.diagnosis && (
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                <strong>Reason:</strong> {cert.diagnosis}
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, color: MUTED, textAlign: "right" }}>
            <div style={{ fontWeight: 600, color: PRIMARY }}>{certId}</div>
            <div>Issued: {issued}</div>
          </div>
        </div>

        {/* ── Patient Info ─────────────────────────────────────────── */}
        <div style={{ padding: "20px 40px 16px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px 48px",
            }}
          >
            <InfoField label="Patient Name" value={patient?.name} />
            <InfoField label="Date of Issue" value={issued} />
            <InfoField label="Age / Sex" value={ageSex || "—"} />
            {patient?.dob && (
              <InfoField label="Date of Birth" value={fmtDate(patient.dob)} />
            )}
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            margin: "0 40px",
            height: 1,
            background: `linear-gradient(90deg, ${PRIMARY}, transparent)`,
          }}
        />

        {/* ── Certificate Body ─────────────────────────────────────── */}
        <div style={{ padding: "18px 40px 0" }}>
          {/* "This is to certify" statement */}
          <div
            style={{
              background: SOFT,
              border: `1px solid ${BORDER}`,
              borderLeft: `4px solid ${PRIMARY}`,
              borderRadius: 6,
              padding: "14px 16px 14px 12px",
              marginBottom: 16,
              fontSize: 13,
              color: BODY,
              lineHeight: 1.7,
            }}
          >
            This is to certify that{" "}
            <strong style={{ color: PRIMARY }}>
              {patient?.name || "the patient"}
            </strong>
            {ageSex ? `, ${ageSex},` : ","} has been examined and is suffering
            from <strong>{cert?.diagnosis || "—"}</strong>.
          </div>

          {/* Details table */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              border: `1px solid ${BORDER}`,
              marginBottom: 0,
            }}
          >
            <thead>
              <tr>
                <th style={{ ...TH, width: "30%" }}>Field</th>
                <th style={TH}>Details</th>
              </tr>
            </thead>
            <tbody>
              {detailRows.map((row, i) => (
                <DetailRow
                  key={row.label}
                  label={row.label}
                  shaded={i % 2 === 1}
                >
                  {row.value}
                </DetailRow>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Doctor details + Signature ───────────────────────────── */}
        <div
          style={{
            margin: "16px 40px 0",
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {/* Doctor header row */}
          <div
            style={{
              background: LIGHT,
              borderBottom: `1px solid ${BORDER}`,
              padding: "9px 16px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: PRIMARY,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>
                {doctorName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 13,
                  fontWeight: 700,
                  color: PRIMARY,
                }}
              >
                <span>Dr. {doctorName}</span>
                <VerifiedTick />
              </div>
              {(specialty || qualification) && (
                <div style={{ fontSize: 11, color: MUTED }}>
                  {[specialty, qualification].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              {regNumber && (
                <div style={{ fontSize: 11, color: MUTED }}>
                  Reg. No:{" "}
                  <strong style={{ color: PRIMARY }}>{regNumber}</strong>
                </div>
              )}
              {councilName && (
                <div style={{ fontSize: 10, color: MUTED }}>{councilName}</div>
              )}
            </div>
          </div>

          {/* Clinic info + Signature row */}
          <div
            style={{
              background: SOFT,
              padding: "14px 16px",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 20,
            }}
          >
            {/* Clinic details */}
            <div style={{ fontSize: 12, color: BODY, lineHeight: 1.7 }}>
              {clinicName && (
                <div style={{ fontWeight: 600, color: BODY, marginBottom: 2 }}>
                  {clinicName}
                </div>
              )}
              {clinicAddress && (
                <div style={{ color: MUTED }}>{clinicAddress}</div>
              )}
            </div>

            {/* System-generated note */}
            <div
              style={{
                fontSize: 11,
                color: MUTED,
                fontStyle: "italic",
                textAlign: "center",
                maxWidth: 220,
                lineHeight: 1.6,
              }}
            >
              This is a system-generated certificate and does not require a
              signature or stamp.
            </div>
          </div>
        </div>

        {/* ── Validity notice ──────────────────────────────────────── */}
        <div
          style={{
            margin: "10px 40px 0",
            padding: "7px 16px",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 6,
            fontSize: 11,
            color: "#92400e",
            lineHeight: 1.5,
          }}
        >
          <strong>Note:</strong> This certificate is issued based on the medical
          examination conducted via Humancare Connect telehealth platform. It is
          valid as an official medical document for the purpose stated above.
        </div>
      </div>

      {/* ── Footer — same layout as the prescription footer, pinned to the
           bottom of the page; keeps the certificate's own divider line ── */}
      <div
        style={{
          marginTop: 10,
          background: "var(--panel, #f7f9fc)",
          borderTop: `3px solid ${ACCENT}`,
          padding: "10px 30px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
        }}
      >
        <CertificateQR />

        <div
          style={{
            fontSize: 13,
            lineHeight: 1.9,
            color: "var(--muted, #667085)",
          }}
        >
          {[
            `📞 ${COMPANY.phone}`,
            `✉️ ${COMPANY.email}`,
            `📍 ${COMPANY.address}`,
          ].map((line) => (
            <span
              key={line}
              style={{ display: "flex", alignItems: "center", gap: 7 }}
            >
              {line}
            </span>
          ))}
        </div>

        <img
          src={footerLogo}
          alt="Clinic logo"
          style={{
            maxHeight: 100,
            width: "auto",
            flexShrink: 0,
            opacity: 0.85,
          }}
          crossOrigin="anonymous"
        />
      </div>
    </div>
  );
}

/* ── PDF download utility — shared with the prescription (utils/slipPdf.js) ── */
export async function downloadCertificatePDF(
  element,
  filename = "medical-certificate.pdf",
) {
  const { renderSlipToPdf } = await import("../utils/slipPdf");
  await renderSlipToPdf(element, filename, SLIP_WIDTH);
}
