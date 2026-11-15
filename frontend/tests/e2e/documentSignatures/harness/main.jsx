/* eslint-disable react-refresh/only-export-components -- test harness, not part of the app bundle */
// Renders the REAL slips (RxSlip in both layouts, MedicalCertificateSlip, VisitNoteSlip) with fixed data, signed or
// unsigned, and exposes window.makePdf() which runs the app's own PDF code (utils/slipPdf.js).
//   ?doc=rx|rx-legacy|cert|visit   &signed=1   &sig=normal|wide|tall   &long=1 (long content, pushes to 2 pages)
import React from "react";
import { createRoot } from "react-dom/client";
import "./base.css";
import RxSlip, { downloadPrescriptionPDF } from "../../../../src/components/RxSlip.jsx";
import { MedicalCertificateSlip, downloadCertificatePDF } from "../../../../src/components/MedicalCertificateSlip.jsx";
import VisitNoteSlip from "../../../../src/components/VisitNoteSlip.jsx";

const params = new URLSearchParams(window.location.search);
const doc = params.get("doc") || "rx";
const signed = params.get("signed") === "1";
const sigKind = params.get("sig") || "normal";
const long = params.get("long") === "1";

// A transparent-background scribble signature, drawn on a canvas, as a data: URL (what the app hands the slips).
function makeSignature(kind) {
  const [w, h] = kind === "wide" ? [1000, 120] : kind === "tall" ? [300, 400] : [520, 160];
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.strokeStyle = "#0b1f4d";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(8, h * 0.7);
  for (let i = 0; i < 8; i += 1) {
    ctx.bezierCurveTo((w / 8) * (i + 0.2), h * 0.05, (w / 8) * (i + 0.6), h * 0.95, (w / 8) * (i + 1) - 6, h * 0.5);
  }
  ctx.stroke();
  ctx.fillStyle = "#0b1f4d";
  ctx.fillRect(w - 12, 2, 10, 10); // marks the top-right corner so cut-off edges are obvious
  ctx.fillRect(2, h - 12, 10, 10); // and the bottom-left corner
  return c.toDataURL("image/png");
}

const signatureUrl = signed ? makeSignature(sigKind) : "";
const signedAt = "2026-11-15T09:42:00.000Z";
const enrollment = {
  specialization: "Internal Medicine", qualification: "MBBS, MD", clinicName: "Humancare Connect",
  medicalRegistrationNumber: "MCI-12345", medicalCouncilName: "Medical Council", country: "IN",
};
const patient = { name: "Jane Patient", gender: "Female", dob: "1990-05-20" };
const doctor = { name: "Asha Verma" };
const moreMeds = long ? Array.from({ length: 14 }, (_, i) => ({ name: `Medicine ${i + 4}`, dosage: "500 mg", frequency: "Twice daily", duration: "5 days", notes: "After food" })) : [];

const rx = {
  _id: "64b000000000000000000001", createdAt: "2026-11-15T09:40:00.000Z", diagnosis: "Acute viral pharyngitis",
  medicines: [
    { name: "Paracetamol", dosage: "500 mg", frequency: "Morning - Night", duration: "5 days", notes: "After food" },
    { name: "Cetirizine", dosage: "10 mg", frequency: "Night", duration: "3 days", notes: "" },
    { name: "Saline gargle", dosage: "-", frequency: "Thrice daily", duration: "5 days", notes: "" },
    ...moreMeds,
  ],
  instructions: "Rest, warm fluids, avoid cold drinks.", followUpDate: "2026-11-22", patientId: patient, doctorId: doctor,
  isSigned: signed, signedAt: signed ? signedAt : undefined,
};
const cert = {
  _id: "64b000000000000000000002", issuedDate: "2026-11-15", diagnosis: "Acute viral pharyngitis",
  recommendation: "Bed rest recommended", restFromDate: "2026-11-15", restToDate: "2026-11-18",
  notes: long ? "Additional remarks. ".repeat(80) : "Avoid strenuous activity.",
  isSigned: signed, signedAt: signed ? signedAt : undefined,
};
const report = {
  reportNumber: "HCR-2026-0001", signedAt,
  patient: { ...patient, age: "36" }, consultation: { date: "2026-11-15", time: "10:00 AM", mode: "Video Consultation" },
  physician: { name: "Asha Verma", registrationNumber: "MCI-12345", speciality: "Internal Medicine", country: "IN" },
  symptoms: "Sore throat and fever for two days.", clinicalFindings: "Throat congested, chest clear.", plan: "Rest, fluids, paracetamol.",
  note: "", amendments: [],
};

const slipRef = React.createRef();
const node = {
  rx: <RxSlip slipRef={slipRef} rx={rx} patient={patient} doctor={doctor} doctorEnrollment={enrollment} signatureUrl={signatureUrl} certStyle />,
  "rx-legacy": <RxSlip slipRef={slipRef} rx={rx} patient={patient} doctorEnrollment={enrollment} signatureUrl={signatureUrl} />,
  cert: <MedicalCertificateSlip slipRef={slipRef} cert={cert} patient={patient} doctor={doctor} doctorEnrollment={enrollment} signatureUrl={signatureUrl} />,
  visit: <VisitNoteSlip slipRef={slipRef} report={report} signatureUrl={signatureUrl} />,
}[doc];

window.makePdf = async () => {
  const name = `${doc}${signed ? "-signed" : "-unsigned"}.pdf`;
  // Same calls the app makes: Rx + Visit Note use downloadPrescriptionPDF, the certificate its own.
  if (doc === "cert") await downloadCertificatePDF(slipRef.current, name);
  else await downloadPrescriptionPDF(slipRef.current, name);
};

createRoot(document.getElementById("root")).render(<div style={{ padding: 16, background: "#e5e7eb", width: 830 }}>{node}</div>);
