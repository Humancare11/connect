import React from "react";
import "./RxSlip.css";
import defaultClinicLogoUrl from "../assets/prescription-logo.png";
import newFooterQrUrl from "../assets/New-Footer-QR.jpeg";
import SlipContactIcon from "./SlipContactIcon";
import {
  C_PRIMARY, C_ACCENT, C_LIGHT, C_SOFT, C_BORDER, C_MUTED, C_BODY, C_TAGLINE,
  C_SLIP_WIDTH, C_SLIP_HEIGHT, C_CELL, CertInfoField, getCountryName,
} from "./slipShared";
import { fmtDate, fmtDateTime } from "../utils/visitNote";

// "Visit Note" paper: the Prescription Preview design (same tokens, header, footer and table styling) with the
// Visit Note content. Rendered by the doctor, patient and admin previews and captured to PDF by the same
// utils/slipPdf.js the prescription uses. `signatureUrl` is a blob: URL fetched through the authenticated API.
export default function VisitNoteSlip({
  slipRef,
  report,
  signatureUrl = "",
  clinicLogoUrl = defaultClinicLogoUrl,
  qrCodeUrl = newFooterQrUrl,
  clinicPhone = "+1 (302) 303-9993",
  clinicEmail = "support@humancareconnect.co",
  clinicAddress = "4 Peddlers Row #1091 Newark, DE 19702, United States",
}) {
  const patient = report?.patient || {};
  const consult = report?.consultation || {};
  const physician = report?.physician || {};
  const amendments = report?.amendments || [];
  const consultWhen = [consult.date ? fmtDate(consult.date) : "", consult.time].filter(Boolean).join(" · ");

  const detailRows = [
    { label: "Clinical Findings :", value: report?.clinicalFindings },
    { label: "Plan / Treatment :", value: report?.plan },
    ...(String(report?.note || "").trim() ? [{ label: "Note :", value: report.note }] : []),
  ];
  const physicianFields = [
    { label: "Doctor's Name", value: physician.name },
    { label: "Medical Reg No", value: physician.registrationNumber },
    { label: "Speciality", value: physician.speciality },
    { label: "Country", value: getCountryName(physician.country) },
  ];
  const pre = { whiteSpace: "pre-wrap", wordBreak: "break-word" };

  return (
    <div className="rx-slip-wrapper rx-slip-wrapper--cert">
      <div
        className="rx-slip rx-slip--cert"
        ref={slipRef}
        style={{
          width: C_SLIP_WIDTH,
          minHeight: C_SLIP_HEIGHT,
          display: "flex",
          flexDirection: "column",
          background: "#fff",
          boxSizing: "border-box",
          color: C_BODY,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ height: 6, background: `linear-gradient(90deg, #0C1D4F, ${C_PRIMARY} 60%, ${C_ACCENT})` }} />

          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "18px 40px 16px", borderBottom: `2px solid ${C_LIGHT}`, background: "#fff",
            }}
          >
            <img
              src={clinicLogoUrl}
              alt="Humancare Connect"
              style={{ height: 68, width: "auto", objectFit: "contain", display: "block" }}
              crossOrigin="anonymous"
            />
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C_PRIMARY, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>
                {C_TAGLINE}
              </div>
              <div style={{ width: 48, height: 4, borderRadius: 2, background: C_PRIMARY, marginLeft: "auto" }} />
            </div>
          </div>

          <div
            style={{
              background: C_LIGHT, padding: "10px 40px", display: "flex", alignItems: "center", gap: 12,
              borderBottom: `1px solid ${C_BORDER}`,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C_PRIMARY }}>Visit Note</div>
            </div>
            <div style={{ fontSize: 11, color: C_MUTED, textAlign: "right" }}>
              <div>Report ID : {report?.reportNumber}</div>
              <div>Date : {fmtDate(report?.signedAt)}</div>
            </div>
          </div>

          <div style={{ padding: "20px 40px 16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 48px" }}>
              <CertInfoField label="Patient Name" value={patient.name} />
              <CertInfoField label="Gender" value={patient.gender || "—"} />
              <CertInfoField label="DOB" value={patient.dob || "—"} />
              <CertInfoField label="Age" value={patient.age || "—"} />
              <CertInfoField label="Consultation" value={consultWhen || "—"} />
              <CertInfoField label="Mode" value={consult.mode || "Video Consultation"} />
            </div>
          </div>

          <div style={{ margin: "0 40px", height: 1, background: `linear-gradient(90deg, ${C_PRIMARY}, transparent)` }} />

          <div style={{ padding: "18px 40px 0" }}>
            {/* Symptoms - same box as the prescription's Diagnosis */}
            <div
              style={{
                background: C_SOFT, border: `1px solid ${C_BORDER}`, borderLeft: `4px solid ${C_PRIMARY}`,
                borderRadius: 6, padding: "14px 16px 14px 12px", marginBottom: 16, fontSize: 13, color: C_BODY, lineHeight: 1.7,
              }}
            >
              <strong style={{ color: C_PRIMARY }}>Symptoms :</strong> <span style={pre}>{report?.symptoms}</span>
            </div>

            <div style={{ fontSize: 14, fontWeight: 700, color: C_PRIMARY, marginBottom: 8 }}>Consultation Details</div>
            <table style={{ width: "100%", borderCollapse: "collapse", border: `1px solid ${C_BORDER}` }}>
              <tbody>
                {detailRows.map((row, i) => (
                  <tr key={row.label} style={{ background: i % 2 === 1 ? C_SOFT : "#fff" }}>
                    <td style={{ ...C_CELL, width: "30%", fontSize: 12, fontWeight: 700, color: C_PRIMARY }}>{row.label}</td>
                    <td style={{ ...C_CELL, ...pre }}>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ margin: "16px 40px 0", border: `1px solid ${C_BORDER}`, borderRadius: 8, overflow: "hidden" }}>
            <div
              style={{
                background: C_LIGHT, borderBottom: `1px solid ${C_BORDER}`, padding: "9px 16px",
                fontSize: 13, fontWeight: 700, color: C_PRIMARY, letterSpacing: 0.4,
              }}
            >
              PHYSICIAN DETAILS
            </div>
            <div style={{ background: C_SOFT, padding: "14px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
              {physicianFields.map((f) => (
                <div key={f.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C_PRIMARY }}>{f.label}</span>
                  <span style={{ fontSize: 13, color: C_BODY }}>{f.value}</span>
                </div>
              ))}
              <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C_PRIMARY }}>Signature</span>
                {signatureUrl ? (
                  <img
                    src={signatureUrl}
                    alt="Doctor's signature"
                    style={{ height: 56, width: "auto", maxWidth: 220, objectFit: "contain", objectPosition: "left", display: "block" }}
                  />
                ) : (
                  <div style={{ height: 56 }} />
                )}
                <span style={{ fontSize: 11, color: C_MUTED }}>Digitally signed · {fmtDateTime(report?.signedAt)}</span>
              </div>
            </div>
          </div>

          {amendments.length > 0 && (
            <div style={{ margin: "16px 40px 0", border: `1px solid ${C_BORDER}`, borderRadius: 8, overflow: "hidden" }}>
              <div
                style={{
                  background: C_LIGHT, borderBottom: `1px solid ${C_BORDER}`, padding: "9px 16px",
                  fontSize: 13, fontWeight: 700, color: C_PRIMARY, letterSpacing: 0.4,
                }}
              >
                AMENDMENTS
              </div>
              {amendments.map((a, i) => (
                <div
                  key={a._id}
                  style={{ padding: "12px 16px", background: i % 2 === 1 ? C_SOFT : "#fff", borderTop: i ? `1px solid ${C_BORDER}` : "none", fontSize: 13, lineHeight: 1.6 }}
                >
                  <div style={{ fontSize: 11, color: C_MUTED, marginBottom: 4 }}>
                    Amendment {i + 1} · {a.authorName} · {fmtDateTime(a.createdAt)}
                  </div>
                  <div><strong style={{ color: C_PRIMARY }}>Reason :</strong> <span style={pre}>{a.reason}</span></div>
                  <div><strong style={{ color: C_PRIMARY }}>Correction :</strong> <span style={pre}>{a.text}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer - same as the prescription */}
        <div className="rx-footer" style={{ marginTop: 10, borderTop: `3px solid ${C_ACCENT}` }}>
          {qrCodeUrl ? (
            <img className="rx-qr" src={qrCodeUrl} alt="Verification QR" />
          ) : (
            <div className="rx-qr rx-qr-placeholder" aria-hidden="true" />
          )}
          <div className="rx-contact-lines">
            <span><SlipContactIcon type="phone" /> {clinicPhone}</span>
            <span><SlipContactIcon type="email" /> {clinicEmail}</span>
            <span><SlipContactIcon type="location" /> {clinicAddress}</span>
          </div>
          <img className="rx-footer-logo" src={clinicLogoUrl} alt="Clinic logo" />
        </div>
      </div>
    </div>
  );
}
