import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import api, { normalizeFileUrl } from "../../api";
import { uploadFileDirectToS3 } from "../../utils/directUpload";

import { Country, State } from "country-state-city";
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

// ─── Constants ───────────────────────────────────────────────────────────────
const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const GENDERS = ["Male", "Female", "Others"];
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
  "Sri Lanka",
  "Nepal",
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
const ID_PROOF_TYPES = [
  "Passport",
  "National ID",
  "Driver's License",
  "Aadhaar",
  "PAN Card",
  "Voter ID",
  "Other",
];
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
};
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
];

// ─── Status metadata ──────────────────────────────────────────────────────────
const STATUS_META = {
  pending: { label: "Pending", bg: "#fef3c7", color: "#92400e" },
  approved: { label: "Approved", bg: "#dcfce7", color: "#166534" },
  rejected: { label: "Rejected", bg: "#fee2e2", color: "#991b1b" },
};
const REQUEST_META = {
  none: { label: "No Active Request", bg: "#f8fafc", color: "#64748b" },
  new_enrollment: { label: "New Enrollment", bg: "#eff6ff", color: "#1d4ed8" },
  profile_update: {
    label: "Profile Update Request",
    bg: "#fef3c7",
    color: "#92400e",
  },
  profile_delete: {
    label: "Profile Delete Request",
    bg: "#fee2e2",
    color: "#991b1b",
  },
};
const STEP_LABELS = [
  "Identity",
  "Professional",
  "Availability",
  "Payout",
  "Submitted",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getProgress(e) {
  if (!e) return { completedSteps: 0, currentStep: 1, status: "pending" };
  const completedSteps = Math.max(
    0,
    Math.min(5, Number(e.completedSteps) || 0),
  );
  const currentStep = Math.max(1, Math.min(5, Number(e.currentStep) || 1));
  const applicationStatus = String(e.applicationStatus || "")
    .trim()
    .toLowerCase();
  const status =
    applicationStatus === "approved"
      ? "approved"
      : applicationStatus === "rejected"
        ? "rejected"
        : applicationStatus === "pending"
          ? "pending"
          : e.approvalStatus === "approved"
            ? "approved"
            : e.approvalStatus === "rejected"
              ? "rejected"
              : "pending";
  return {
    completedSteps,
    currentStep,
    status,
    currentStepLabel:
      e.currentStepLabel || STEP_LABELS[Math.max(0, currentStep - 1)],
  };
}
function getRequestType(e) {
  if (!e) return "none";
  if (e.profileDeleteRequestStatus === "pending") return "profile_delete";
  if (e.pendingRequestType === "profile_delete") return "profile_delete";
  if (e.pendingRequestType === "profile_update") return "profile_update";
  if (e.pendingRequestType === "new_enrollment") return "new_enrollment";
  return "none";
}

// ─── Shared display sub-components ───────────────────────────────────────────
function Section({ icon, title, children, accent }) {
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${accent ? "#bfdbfe" : "#e2e8f0"}`,
        borderRadius: 14,
        overflow: "visible",
        marginBottom: 20,
      }}
    >
      <div
        style={{
          padding: "14px 22px",
          borderBottom: "1px solid #f1f5f9",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: accent ? "#eff6ff" : "#f8fafc",
        }}
      >
        <span style={{ fontSize: 18 }}>{icon}</span>
        <h4
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            color: accent ? "#1d4ed8" : "#223a5e",
          }}
        >
          {title}
        </h4>
        {accent && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: "#2563eb",
              fontWeight: 700,
              background: "#dbeafe",
              padding: "2px 10px",
              borderRadius: 50,
            }}
          >
            EDITING
          </span>
        )}
      </div>
      <div style={{ padding: "18px 22px" }}>{children}</div>
    </div>
  );
}
function Field({ label, value, full }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        gridColumn: full ? "1/-1" : undefined,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#94a3b8",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 14,
          color: value ? "#0f172a" : "#cbd5e1",
          fontStyle: value ? "normal" : "italic",
        }}
      >
        {value || "—"}
      </span>
    </div>
  );
}

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"]);
const DOCUMENT_FIELDS = new Set([
  "profilePhoto",
  "idProof",
  "degreeFile",
  "medicalLicenseFile",
  "malpracticeInsuranceFile",
]);

function formatChangeValue(value) {
  if (value === undefined || value === null || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function ProfileChangeSummary({ changes = [], requestedAt }) {
  if (!Array.isArray(changes) || changes.length === 0) return null;
  const AVAIL_FIELDS = new Set(["availability", "timezone"]);
  const docChanges = changes.filter((c) => DOCUMENT_FIELDS.has(c.field));
  const availChanges = changes.filter((c) => AVAIL_FIELDS.has(c.field));
  const textChanges = changes.filter(
    (c) => !DOCUMENT_FIELDS.has(c.field) && !AVAIL_FIELDS.has(c.field),
  );
  // Display count: text fields individually + 1 per group (availability, documents) if any changed
  const displayCount =
    textChanges.length +
    (availChanges.length > 0 ? 1 : 0) +
    (docChanges.length > 0 ? 1 : 0);
  return (
    <Section icon="📝" title="Profile Changes Submitted by Doctor">
      <div
        style={{
          background: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: 10,
          padding: "12px 16px",
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>
          {displayCount} field{displayCount === 1 ? "" : "s"} changed
        </div>
        {requestedAt && (
          <div style={{ fontSize: 12, color: "#a16207", marginTop: 3 }}>
            Submitted {new Date(requestedAt).toLocaleString()}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {textChanges.map((change) => (
          <div
            key={change.field}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              overflow: "hidden",
              background: "#fff",
            }}
          >
            <div
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid #f1f5f9",
                background: "#f8fafc",
                fontSize: 13,
                fontWeight: 800,
                color: "#334155",
              }}
            >
              {change.label || change.field}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 0,
              }}
            >
              <div
                style={{
                  padding: "12px 14px",
                  borderRight: "1px solid #f1f5f9",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#94a3b8",
                    textTransform: "uppercase",
                    marginBottom: 5,
                  }}
                >
                  Before
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#475569",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {formatChangeValue(change.previousValue)}
                </div>
              </div>
              <div style={{ padding: "12px 14px", background: "#f0fdf4" }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#16a34a",
                    textTransform: "uppercase",
                    marginBottom: 5,
                  }}
                >
                  After
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#14532d",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {formatChangeValue(change.newValue)}
                </div>
              </div>
            </div>
          </div>
        ))}
        {availChanges.length > 0 && (
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              overflow: "hidden",
              background: "#fff",
            }}
          >
            <div
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid #f1f5f9",
                background: "#f8fafc",
                fontSize: 13,
                fontWeight: 800,
                color: "#334155",
              }}
            >
              Availability Schedule Updated
            </div>
            <div
              style={{
                padding: "12px 14px",
                fontSize: 13,
                color: "#475569",
                lineHeight: 1.6,
              }}
            >
              {availChanges.map((c) => c.label || c.field).join(", ")} — new
              schedule submitted.
            </div>
          </div>
        )}
        {docChanges.length > 0 && (
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              overflow: "hidden",
              background: "#fff",
            }}
          >
            <div
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid #f1f5f9",
                background: "#f8fafc",
                fontSize: 13,
                fontWeight: 800,
                color: "#334155",
              }}
            >
              Uploaded Files Edited
            </div>
            <div
              style={{
                padding: "12px 14px",
                fontSize: 13,
                color: "#475569",
                lineHeight: 1.6,
              }}
            >
              {docChanges.map((c) => c.label || c.field).join(", ")} — new
              file(s) submitted.
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
function getFileType(url) {
  if (!url) return "other";
  const ext = url.split("?")[0].split(".").pop().toLowerCase();
  if (IMAGE_EXTS.has(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "other";
}

function displayFileName(value) {
  if (!value) return "";
  const raw = String(value);
  try {
    const url = new URL(raw);
    return (
      decodeURIComponent(url.pathname.split("/").pop() || "document").replace(
        /^\d{10,}-[a-f0-9]+-/,
        "",
      ) || "document"
    );
  } catch {
    return (
      decodeURIComponent(
        raw.split("?")[0].split("/").pop() || "document",
      ).replace(/^\d{10,}-[a-f0-9]+-/, "") || "document"
    );
  }
}

async function getAdminDocumentAccessUrl(enrollmentId, field) {
  const { data } = await api.get(
    `/api/admin/doctors/${enrollmentId}/documents/${field}/access-url`,
  );
  return data.url;
}

function SignedDocumentButton({ enrollmentId, field, label, style }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");

  const openDocument = async () => {
    if (!enrollmentId || !DOCUMENT_FIELDS.has(field)) return;
    setOpening(true);
    setError("");
    const opened = window.open("", "_blank");
    if (opened) {
      opened.opener = null;
      opened.document.write(
        '<!doctype html><title>Opening document</title><body style="font-family:system-ui;padding:24px;color:#334155">Opening document...</body>',
      );
    }
    try {
      const signedUrl = await getAdminDocumentAccessUrl(enrollmentId, field);
      if (opened) opened.location.href = signedUrl;
      else {
        throw new Error("Popup blocked. Please allow popups and try again.");
      }
    } catch (err) {
      const message =
        err?.response?.data?.msg || err?.message || "Could not open document.";
      if (opened) {
        opened.document.open();
        opened.document.write(
          `<!doctype html><title>Document error</title><body style="font-family:system-ui;padding:24px;color:#991b1b">${message}</body>`,
        );
        opened.document.close();
      }
      setError(message);
    } finally {
      setOpening(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openDocument}
        disabled={opening}
        style={
          style || {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            padding: "9px 14px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: opening ? "wait" : "pointer",
            fontFamily: "inherit",
          }
        }
      >
        {opening ? "Opening..." : label}
      </button>
      {error && (
        <div style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>
          {error}
        </div>
      )}
    </>
  );
}

function SignedImage({ enrollmentId, field, alt, style, fallback }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setSrc("");
    setFailed(false);
    if (!enrollmentId || !DOCUMENT_FIELDS.has(field)) return undefined;
    getAdminDocumentAccessUrl(enrollmentId, field)
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [enrollmentId, field]);

  if (failed) return fallback || null;
  if (!src) return fallback || null;
  return (
    <img src={src} alt={alt} style={style} onError={() => setFailed(true)} />
  );
}

function DocItem({ label, filename, enrollmentId, field }) {
  const fileType = filename ? getFileType(filename) : "other";
  const isImage = fileType === "image";
  const isPdf = fileType === "pdf";
  const displayName = filename ? displayFileName(filename) : "";
  const icon = filename ? (isImage ? "IMG" : isPdf ? "PDF" : "DOC") : "-";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "16px 18px",
        background: filename ? "#f0fdf4" : "#fafafa",
        border: `1.5px solid ${filename ? "#86efac" : "#e2e8f0"}`,
        borderRadius: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span
          style={{
            fontSize: 13,
            lineHeight: 1,
            flexShrink: 0,
            marginTop: 2,
            fontWeight: 800,
            color: "#2563eb",
          }}
        >
          {icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 4,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 13,
              color: filename ? "#1e293b" : "#94a3b8",
              fontStyle: filename ? "normal" : "italic",
              wordBreak: "break-all",
              lineHeight: 1.5,
            }}
          >
            {filename ? displayName : "Not uploaded"}
          </div>
        </div>
        {filename && (
          <span
            style={{
              fontSize: 11,
              background: "#dcfce7",
              color: "#166534",
              padding: "3px 10px",
              borderRadius: 50,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            Submitted
          </span>
        )}
      </div>

      {filename ? (
        <SignedDocumentButton
          enrollmentId={enrollmentId}
          field={field}
          label={
            isImage ? "Open Full Image" : isPdf ? "Open PDF" : "View Document"
          }
        />
      ) : (
        <div
          style={{
            fontSize: 12,
            color: "#94a3b8",
            padding: "6px 0",
            textAlign: "center",
            fontStyle: "italic",
          }}
        >
          no document provided
        </div>
      )}
    </div>
  );
}
function ProgressBar({ progress }) {
  const color =
    progress.status === "approved"
      ? "#16a34a"
      : progress.status === "rejected"
        ? "#ef4444"
        : "#2563eb";
  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
        {STEP_LABELS.map((label, idx) => {
          const done = idx + 1 <= progress.completedSteps;
          const active = idx + 1 === progress.currentStep && !done;
          return (
            <div
              key={label}
              title={`Step ${idx + 1}: ${label}`}
              style={{
                flex: 1,
                height: 7,
                borderRadius: 4,
                background: done ? color : active ? "#fbbf24" : "#e2e8f0",
                transition: "all 0.3s",
              }}
            />
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>
          {progress.completedSteps}/5 STEPS COMPLETED
        </span>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>
          Current: {progress.currentStepLabel}
        </span>
      </div>
    </div>
  );
}

// ─── AdminPhotoUpload ─────────────────────────────────────────────────────────
function AdminPhotoUpload({ currentUrl, onChange, enrollmentId }) {
  const ref = useRef();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [localUrl, setLocalUrl] = useState(currentUrl || "");
  const [err, setErr] = useState("");

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [],
  ); // eslint-disable-line

  const handleFile = async (raw) => {
    if (!raw) return;
    if (!raw.type.startsWith("image/")) {
      setErr("Please select an image (JPG, PNG, WebP).");
      return;
    }
    setErr("");
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(raw));
    setUploading(true);
    try {
      const uploaded = await uploadFileDirectToS3(raw, {
        ownerType: "doctor",
        ownerId: enrollmentId,
      });
      setLocalUrl(uploaded.key);
      onChange(uploaded.key);
    } catch {
      setErr("Upload failed — please try again.");
    } finally {
      setUploading(false);
    }
  };

  const normalizedLocalUrl = normalizeFileUrl(localUrl);
  const isDirectUrl =
    normalizedLocalUrl &&
    (normalizedLocalUrl.startsWith("http://") ||
      normalizedLocalUrl.startsWith("https://"));
  const imgSrc = preview || (isDirectUrl ? normalizedLocalUrl : null);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: 16,
        background: "#f8fafc",
        borderRadius: 12,
        border: "1.5px solid #e2e8f0",
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          width: 90,
          height: 90,
          borderRadius: "50%",
          overflow: "hidden",
          border: `2.5px solid ${localUrl ? "#2563eb" : "#e2e8f0"}`,
          background: "#e2e8f0",
          flexShrink: 0,
          cursor: uploading ? "default" : "pointer",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onClick={() => !uploading && ref.current?.click()}
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt="Profile"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : localUrl && enrollmentId ? (
          <SignedImage
            enrollmentId={enrollmentId}
            field="profilePhoto"
            alt="Profile"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
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
              background: "rgba(255,255,255,0.85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          >
            ⏳
          </div>
        )}
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 160,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
          {uploading
            ? "⏳ Uploading…"
            : localUrl
              ? "✅ Photo uploaded"
              : "No profile photo"}
        </div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Accepted: JPG, PNG, WebP · Max 5 MB
        </div>
        {err && <div style={{ fontSize: 12, color: "#dc2626" }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => ref.current?.click()}
            disabled={uploading}
            style={{
              padding: "7px 14px",
              borderRadius: 7,
              border: "1.5px solid #2563eb",
              background: "#eff6ff",
              color: "#1d4ed8",
              fontSize: 12,
              fontWeight: 700,
              cursor: uploading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {localUrl ? "Change Photo" : "Upload Photo"}
          </button>
          {localUrl && (
            <>
              <button
                type="button"
                onClick={() => {
                  setLocalUrl("");
                  setPreview(null);
                  onChange("");
                }}
                style={{
                  padding: "7px 14px",
                  borderRadius: 7,
                  border: "1.5px solid #fecdd3",
                  background: "#fff1f2",
                  color: "#be123c",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Remove
              </button>
              {enrollmentId && (
                <SignedDocumentButton
                  enrollmentId={enrollmentId}
                  field="profilePhoto"
                  label="View full size"
                  style={{
                    padding: "7px 14px",
                    borderRadius: 7,
                    border: "1.5px solid #e2e8f0",
                    background: "#f8fafc",
                    color: "#64748b",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
      <input
        ref={ref}
        type="file"
        hidden
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={(e) => handleFile(e.target.files[0])}
      />
    </div>
  );
}

// ─── AdminDocUpload ───────────────────────────────────────────────────────────
function AdminDocUpload({
  label,
  currentUrl,
  onChange,
  accept,
  enrollmentId,
  field,
}) {
  const ref = useRef();
  const [uploading, setUploading] = useState(false);
  const [localUrl, setLocalUrl] = useState(currentUrl || "");
  const [err, setErr] = useState("");

  const handleFile = async (raw) => {
    if (!raw) return;

    // Client-side validation — PDF only
    const ext = raw.name.split(".").pop().toLowerCase();
    const BLOCKED = [
      "php",
      "html",
      "htm",
      "js",
      "exe",
      "bat",
      "cmd",
      "sh",
      "py",
      "rb",
      "dll",
      "vbs",
      "msi",
      "ps1",
      "jar",
      "svg",
      "xml",
      "ts",
      "jsx",
      "tsx",
    ];
    if (BLOCKED.includes(ext)) {
      setErr(
        `".${ext}" files are not allowed. Only PDF files may be uploaded.`,
      );
      return;
    }
    if (ext !== "pdf") {
      setErr(
        `".${ext}" files are not accepted. Only PDF files may be uploaded.`,
      );
      return;
    }
    if (raw.type && raw.type !== "application/pdf") {
      setErr(
        "Only PDF files are accepted. Please select a valid PDF document.",
      );
      return;
    }

    setErr("");
    setUploading(true);
    try {
      const uploaded = await uploadFileDirectToS3(raw, {
        ownerType: "doctor",
        ownerId: enrollmentId,
      });
      setLocalUrl(uploaded.key);
      onChange(uploaded.key);
    } catch (uploadErr) {
      const apiMsg = uploadErr?.response?.data?.msg;
      setErr(apiMsg || "Upload failed — please try again.");
    } finally {
      setUploading(false);
    }
  };

  const fileUrl = normalizeFileUrl(localUrl);
  const hasFile = Boolean(localUrl);
  const isUrl =
    fileUrl &&
    (fileUrl.startsWith("http://") || fileUrl.startsWith("https://"));
  const fileType = hasFile ? getFileType(localUrl) : "other";
  const isImage = fileType === "image";
  const isPdf = fileType === "pdf";
  const displayName = hasFile ? displayFileName(localUrl) : "";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 14,
        background: hasFile ? "#f0fdf4" : "#fafafa",
        border: `1.5px solid ${hasFile ? "#86efac" : "#e2e8f0"}`,
        borderRadius: 10,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
      {/* Inline preview — image */}
      {isUrl && isImage && (
        <div
          style={{
            borderRadius: 6,
            overflow: "hidden",
            background: "#f1f5f9",
            lineHeight: 0,
          }}
        >
          <img
            src={fileUrl}
            alt={label}
            crossOrigin="use-credentials"
            style={{
              width: "100%",
              maxHeight: 140,
              objectFit: "contain",
              display: "block",
            }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
      )}
      {/* Inline preview — PDF */}
      {isUrl && isPdf && (
        <div
          style={{
            borderRadius: 6,
            overflow: "hidden",
            border: "1px solid #e2e8f0",
            lineHeight: 0,
            height: 180,
          }}
        >
          <iframe
            key={fileUrl}
            src={fileUrl}
            title={label}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              display: "block",
            }}
          />
        </div>
      )}
      {localUrl ? (
        <div
          style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}
        >
          <span style={{ fontSize: 16 }}>
            {isUrl ? (isImage ? "🖼️" : isPdf ? "📄" : "✅") : "⚠️"}
          </span>
          <span
            style={{
              fontSize: 12,
              color: "#1e293b",
              wordBreak: "break-all",
              flex: 1,
              lineHeight: 1.4,
            }}
          >
            {displayName}
          </span>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>
          No file uploaded
        </div>
      )}
      {err && <div style={{ fontSize: 11, color: "#dc2626" }}>{err}</div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {localUrl && enrollmentId && field && (
          <SignedDocumentButton
            enrollmentId={enrollmentId}
            field={field}
            label={isImage ? "View" : "Open"}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1.5px solid #2563eb",
              background: "#eff6ff",
              color: "#1d4ed8",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          />
        )}
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={uploading}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1.5px solid #e2e8f0",
            background: "#fff",
            color: "#334155",
            fontSize: 11,
            fontWeight: 700,
            cursor: uploading ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {uploading ? "⏳ Uploading…" : localUrl ? "🔄 Replace" : "📤 Upload"}
        </button>
        {localUrl && (
          <button
            type="button"
            onClick={() => {
              setLocalUrl("");
              onChange("");
            }}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1.5px solid #fecdd3",
              background: "#fff1f2",
              color: "#be123c",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ✕ Remove
          </button>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        hidden
        accept={accept || "application/pdf,.pdf"}
        onChange={(e) => handleFile(e.target.files[0])}
      />
    </div>
  );
}

// const FG = ({ label, children, full }) => (
//   <div
//     style={{
//       display: "flex",
//       flexDirection: "column",
//       gap: 4,
//       gridColumn: full ? "1/-1" : undefined,
//     }}
//   >
//     <label style={LBL}>{label}</label>
//     {children}
//   </div>
// );

function FG({ label, children, full }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        gridColumn: full ? "1/-1" : undefined,
      }}
    >
      <label
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 700,
          color: "#475569",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 5,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function AdminMultiSelect({ items, selected, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef();

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (item) => {
    onChange(
      selected.includes(item)
        ? selected.filter((s) => s !== item)
        : [...selected, item],
    );
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          padding: "8px 12px",
          border: "1.5px solid #e2e8f0",
          borderRadius: 8,
          minHeight: 44,
          alignItems: "center",
          cursor: "pointer",
          background: "#fff",
        }}
      >
        {selected.length === 0 ? (
          <span style={{ fontSize: 14, color: "#94a3b8" }}>{placeholder}</span>
        ) : (
          selected.map((s) => (
            <span
              key={s}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 10px",
                background: "rgba(37,99,235,0.1)",
                color: "#2563eb",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {s}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(s);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#2563eb",
                  cursor: "pointer",
                  fontSize: 14,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
      {open && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1.5px solid #e2e8f0",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            maxHeight: 220,
            overflowY: "auto",
            overflowX: "hidden",
            zIndex: 9999,
            WebkitOverflowScrolling: "touch",
          }}
        >
          {items.map((item) => {
            const isSelected = selected.includes(item);
            return (
              <div
                key={item}
                onClick={() => toggle(item)}
                style={{
                  padding: "8px 12px",
                  fontSize: 13,
                  cursor: "pointer",
                  background: isSelected ? "#f0fdf4" : "transparent",
                  userSelect: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isSelected
                    ? "#dcfce7"
                    : "#f8fafc";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isSelected
                    ? "#f0fdf4"
                    : "transparent";
                }}
              >
                {isSelected ? "✓ " : ""}
                {item}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── AdminEditForm — full inline edit, no modal ───────────────────────────────
function AdminEditForm({ enrollment, onSaved, onCancel, showToast }) {
  const e = enrollment;

  // ── All text field state ──
  const [d, setD] = useState({
    firstName: e.firstName || "",
    surname: e.surname || "",
    gender: e.gender || "",
    dob: e.dob || "",
    email: e.email || e.doctorId?.email || "",
    countryCode: e.countryCode || "",
    phoneNumber: e.phoneNumber || "",
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
    experience: e.experience ? String(e.experience) : "",
    medicalSchool: e.medicalSchool || "",
    registrationYear: e.registrationYear || "",
    medicalCouncilName: e.medicalCouncilName || "",
    medicalRegistrationNumber: e.medicalRegistrationNumber || "",
    medicalLicense: e.medicalLicense || "",
    idProofType: e.idProofType || "",
    consultationMode: e.consultationMode || "",
    consultantFees: e.consultantFees ? String(e.consultantFees) : "",
    feeCurrency: e.feeCurrency || "USD",
    clinicName: e.clinicName || "",
    clinicAddress: e.clinicAddress || "",
    aboutDoctor: e.aboutDoctor || "",
    licensedStates: Array.isArray(e.licensedStates)
      ? e.licensedStates
      : e.licensedStates
        ? [e.licensedStates]
        : e.state
          ? [e.state]
          : [],
    internationalLicenses: Array.isArray(e.internationalLicenses)
      ? e.internationalLicenses
      : e.internationalLicenses
        ? [e.internationalLicenses]
        : [],
    bankName: e.bankName || "",
    // accountHolderName: e.accountHolderName || "",
    accountNumber: e.accountNumber || "",
    ifscCode: e.ifscCode || "",
    paypalId: e.paypalId || "",
    // payoutEmail: e.payoutEmail || "",
    // stripeAccountId: e.stripeAccountId || "",
  });
  const f = (k) => (v) =>
    setD((p) => ({ ...p, [k]: typeof v === "string" ? v : v.target.value }));
  const [phoneCountryCode, setPhoneCountryCode] = useState(
    getCountryCodeFromDialCode(e.countryCode),
  );
  const stateConfig = STATE_LICENSING_COUNTRIES[d.country] || null;

  // ── File URLs ──
  const [urls, setUrls] = useState({
    profilePhoto: e.profilePhoto || "",
    idProof: e.idProof || "",
    degreeFile: e.degreeFile || "",
    medicalLicenseFile: e.medicalLicenseFile || "",
    malpracticeInsuranceFile: e.malpracticeInsuranceFile || "",
  });
  const setUrl = (k) => (v) => setUrls((p) => ({ ...p, [k]: v }));

  // ── Languages ──
  const rawLangs = e.languagesKnown;
  const [langsInput, setLangsInput] = useState(
    Array.isArray(rawLangs)
      ? rawLangs.join(", ")
      : typeof rawLangs === "string"
        ? rawLangs
        : "",
  );

  // ── Availability ──
  const [timezone, setTimezone] = useState(e.timezone || "");
  const [avail, setAvail] = useState(() => {
    const saved = e.availability;
    const hasData =
      saved && typeof saved === "object" && Object.keys(saved).length > 0;
    return hasData
      ? saved
      : DAYS.reduce(
        (a, day) => ({
          ...a,
          [day]: {
            enabled: false,
            blocks: [{ start: "09:00", end: "17:00" }],
          },
        }),
        {},
      );
  });

  const toggleDay = (day) =>
    setAvail((p) => ({ ...p, [day]: { ...p[day], enabled: !p[day].enabled } }));
  const addBlock = (day) =>
    setAvail((p) => ({
      ...p,
      [day]: {
        ...p[day],
        blocks: [...p[day].blocks, { start: "09:00", end: "17:00" }],
      },
    }));
  const removeBlock = (day, i) =>
    setAvail((p) => {
      const blocks = p[day].blocks.filter((_, j) => j !== i);
      return {
        ...p,
        [day]: {
          ...p[day],
          blocks: blocks.length ? blocks : [{ start: "09:00", end: "17:00" }],
        },
      };
    });
  const updateBlock = (day, i, field, val) =>
    setAvail((p) => {
      const blocks = [...p[day].blocks];
      blocks[i] = { ...blocks[i], [field]: val };
      return { ...p, [day]: { ...p[day], blocks } };
    });

  // ── Save state ──
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setBusy(true);
    setError("");
    try {
      const languagesKnown = langsInput
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean);
      const payload = {
        ...d,
        specialization:
          d.specialization === "Other"
            ? d.customSpecialty || "Other"
            : d.specialization,
        experience: d.experience ? Number(d.experience) : undefined,
        consultantFees: d.consultantFees ? Number(d.consultantFees) : undefined,
        languagesKnown,
        licensedStates: Array.isArray(d.licensedStates)
          ? d.licensedStates
          : typeof d.licensedStates === "string"
            ? d.licensedStates.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
        internationalLicenses: Array.isArray(d.internationalLicenses)
          ? d.internationalLicenses
          : typeof d.internationalLicenses === "string"
            ? d.internationalLicenses.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
        ...urls,
        timezone,
        availability: avail,
      };
      delete payload.customSpecialty;
      const res = await api.put(`/api/admin/doctors/${e._id}`, payload);
      onSaved(res.data.enrollment);
      showToast("Doctor profile updated successfully.");
    } catch (err) {
      setError(err?.response?.data?.msg || "Save failed — please try again.");
    } finally {
      setBusy(false);
    }
  };

  // ── Shared input styles ──
  const INP = {
    padding: "9px 12px",
    border: "1.5px solid #e2e8f0",
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "inherit",
    color: "#0f172a",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    background: "#fff",
    transition: "border-color 0.2s",
  };
  const SEL = {
    ...INP,
    cursor: "pointer",
    appearance: "none",
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2364748B' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    paddingRight: 32,
  };
  const TA = { ...INP, resize: "vertical", minHeight: 90 };
  const LBL = {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: 5,
  };
  const G2 = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: "16px 20px",
  };

  /* ── Save/Cancel toolbar ── */
  const Toolbar = () => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 18px",
        background: "#eff6ff",
        border: "1.5px solid #bfdbfe",
        borderRadius: 10,
        marginBottom: 20,
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 20 }}>✏️</span>
        <div>
          <div style={{ fontWeight: 700, color: "#1d4ed8", fontSize: 14 }}>
            Edit Mode Active
          </div>
          <div style={{ fontSize: 12, color: "#3b82f6" }}>
            Changes are saved to the database when you click "Save Changes".
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onCancel}
          disabled={busy}
          style={{
            padding: "8px 18px",
            borderRadius: 8,
            border: "1.5px solid #e2e8f0",
            background: "#fff",
            color: "#334155",
            fontWeight: 600,
            fontSize: 13,
            cursor: busy ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}
        >
          ✕ Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={busy}
          style={{
            padding: "8px 22px",
            borderRadius: 8,
            border: "none",
            background: busy ? "#93c5fd" : "#2563eb",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            cursor: busy ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {busy ? "Saving…" : "💾 Save Changes"}
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <Toolbar />

      {/* ── 1. Profile Photo ── */}
      <Section icon="📷" title="Profile Photo" accent>
        <AdminPhotoUpload
          currentUrl={urls.profilePhoto}
          onChange={setUrl("profilePhoto")}
          enrollmentId={e._id}
        />
      </Section>

      {/* ── 2. Personal Information ── */}
      <Section icon="👤" title="Personal Information" accent>
        <div style={G2}>
          <FG label="First Name">
            <input
              style={INP}
              value={d.firstName}
              onChange={f("firstName")}
              placeholder="First name"
            />
          </FG>
          <FG label="Last Name / Surname">
            <input
              style={INP}
              value={d.surname}
              onChange={f("surname")}
              placeholder="Surname"
            />
          </FG>
          <FG label="Gender">
            <select style={SEL} value={d.gender} onChange={f("gender")}>
              <option value="">Select…</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </FG>
          <FG label="Date of Birth">
            <input style={INP} type="date" value={d.dob} onChange={f("dob")} />
          </FG>
          <FG label="Email">
            <input
              style={INP}
              type="email"
              value={d.email}
              onChange={f("email")}
              placeholder="doctor@email.com"
            />
          </FG>
          <FG label="Phone Number">
            <PhoneInputField
              value={(d.countryCode || "") + (d.phoneNumber || "")}
              onChange={(value, countryMeta) => {
                const next = splitPhoneValue(value, countryMeta);
                setD((p) => ({
                  ...p,
                  countryCode: next.countryCode,
                  phoneNumber: next.phone,
                }));
              }}
              onCountryChange={(countryMeta) => {
                setPhoneCountryCode(countryMeta.code || "auto");
                setD((p) => ({
                  ...p,
                  countryCode: countryMeta.dialCode || p.countryCode,
                }));
              }}
              defaultCountry={phoneCountryCode}
              placeholder="Mobile number"
              showCountryNameInDropdown={true}
            />
          </FG>
        </div>
      </Section>

      {/* ── 3. Location ── */}
      {/* <Section icon="📍" title="Location" accent>
        <div style={G2}>
          <FG label="Country">
            <select style={SEL} value={d.country} onChange={f("country")}>
              <option value="">Select country…</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FG>
          <FG label="State / Province">
            <input
              style={INP}
              value={d.state}
              onChange={f("state")}
              placeholder="State or province"
            />
          </FG>
          <FG label="City">
            <input
              style={INP}
              value={d.city}
              onChange={f("city")}
              placeholder="City"
            />
          </FG>
          <FG label="ZIP / Postal Code">
            <input
              style={INP}
              value={d.zip}
              onChange={f("zip")}
              placeholder="ZIP or postal code"
            />
          </FG>
          <FG label="Street Address" full>
            <input
              style={INP}
              value={d.address}
              onChange={f("address")}
              placeholder="Full street address"
            />
          </FG>
        </div>
      </Section> */}
      {/* ── 3. Location ── */}
      <Section icon="📍" title="Location" accent>
        <div style={G2}>
          <FG label="Country">
            <select
              style={SEL}
              value={d.country}
              onChange={(ev) => {
                f("country")(ev);
                setD((p) => ({ ...p, state: "" })); // reset state when country changes
              }}
            >
              <option value="">Select country…</option>
              {Country.getAllCountries().map((c) => (
                <option key={c.isoCode} value={c.isoCode}>
                  {c.name}
                </option>
              ))}
            </select>
          </FG>
          <FG label="State / Province">
            {(() => {
              const states = d.country
                ? State.getStatesOfCountry(d.country)
                : [];
              return states.length > 0 ? (
                <select style={SEL} value={d.state} onChange={f("state")}>
                  <option value="">
                    {d.country ? "Select state…" : "Select country first"}
                  </option>
                  {states.map((s) => (
                    <option key={s.isoCode} value={s.isoCode}>
                      {s.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  style={INP}
                  value={d.state}
                  onChange={f("state")}
                  placeholder={
                    d.country ? "State or province" : "Select country first"
                  }
                  disabled={!d.country}
                />
              );
            })()}
          </FG>
          <FG label="City">
            <input
              style={INP}
              value={d.city}
              onChange={f("city")}
              placeholder="City"
            />
          </FG>
          <FG label="ZIP / Postal Code">
            <input
              style={INP}
              value={d.zip}
              onChange={f("zip")}
              placeholder="ZIP or postal code"
            />
          </FG>
          <FG label="Street Address" full>
            <input
              style={INP}
              value={d.address}
              onChange={f("address")}
              placeholder="Full street address"
            />
          </FG>
        </div>
      </Section>

      {/* ── 4. Professional Details ── */}
      <Section icon="🩺" title="Professional Details" accent>
        <div style={G2}>
          <FG label="Specialization">
            <select
              style={SEL}
              value={
                SPECIALTIES.includes(d.specialization)
                  ? d.specialization
                  : d.specialization
                    ? "Other"
                    : ""
              }
              onChange={(ev) => {
                if (ev.target.value === "Other") {
                  f("specialization")("Other");
                  if (
                    !d.customSpecialty &&
                    d.specialization &&
                    !SPECIALTIES.includes(d.specialization)
                  ) {
                    f("customSpecialty")(d.specialization);
                  }
                } else {
                  f("specialization")(ev.target.value);
                  f("customSpecialty")("");
                }
              }}
            >
              <option value="">Select…</option>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FG>
          {(d.specialization === "Other" ||
            (d.specialization && !SPECIALTIES.includes(d.specialization))) && (
              <FG label="Custom Specialty">
                <input
                  style={INP}
                  value={
                    d.customSpecialty ||
                    (d.specialization && !SPECIALTIES.includes(d.specialization)
                      ? d.specialization
                      : "")
                  }
                  onChange={f("customSpecialty")}
                  placeholder="e.g. Sports Medicine"
                />
              </FG>
            )}
          <FG label="Sub-Specialization">
            <input
              style={INP}
              value={d.subSpecialization}
              onChange={f("subSpecialization")}
              placeholder="e.g. Interventional Cardiology"
            />
          </FG>
          <FG label="Qualification">
            <select
              style={SEL}
              value={d.qualification}
              onChange={f("qualification")}
            >
              <option value="">Select…</option>
              {QUALIFICATIONS.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </FG>
          <FG label="Years of Experience">
            <input
              style={INP}
              type="text"
              inputMode="numeric"
              value={d.experience}
              onChange={(ev) =>
                f("experience")(ev.target.value.replace(/[^0-9]/g, ""))
              }
              placeholder="e.g. 10"
            />
          </FG>
          <FG label="Medical School">
            <input
              style={INP}
              value={d.medicalSchool}
              onChange={f("medicalSchool")}
              placeholder="School name"
            />
          </FG>
          <FG label="Graduation / Registration Year">
            <input
              style={INP}
              value={d.registrationYear}
              onChange={f("registrationYear")}
              placeholder="YYYY"
            />
          </FG>
          <FG label="Medical Council Name">
            <input
              style={INP}
              value={d.medicalCouncilName}
              onChange={f("medicalCouncilName")}
              placeholder="e.g. MCI, GMC, AMA"
            />
          </FG>
          <FG label="Registration Number / NPI">
            <input
              style={INP}
              value={d.medicalRegistrationNumber}
              onChange={f("medicalRegistrationNumber")}
              placeholder="Registration or NPI"
            />
          </FG>
          <FG label="Medical License Number">
            <input
              style={INP}
              value={d.medicalLicense}
              onChange={f("medicalLicense")}
              placeholder="License number"
            />
          </FG>
          {/* <FG label="ID Proof Type">
            <select
              style={SEL}
              value={d.idProofType}
              onChange={f("idProofType")}
            >
              <option value="">Select…</option>
              {ID_PROOF_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FG> */}
          {stateConfig && (
            <FG label={`${stateConfig.label} Licensing`} full>
              <AdminMultiSelect
                items={stateConfig.items}
                selected={
                  Array.isArray(d.licensedStates) ? d.licensedStates : []
                }
                onChange={(v) => setD((p) => ({ ...p, licensedStates: v }))}
                placeholder={`Select ${stateConfig.plural.toLowerCase()}...`}
              />
            </FG>
          )}
          <FG label="International Medical Licenses" full>
            <AdminMultiSelect
              items={Country.getAllCountries()
                .filter((c) => c.isoCode !== d.country)
                .map((c) => c.name)}
              selected={
                Array.isArray(d.internationalLicenses)
                  ? d.internationalLicenses
                  : []
              }
              onChange={(v) =>
                setD((p) => ({ ...p, internationalLicenses: v }))
              }
              placeholder="Select countries where you hold a medical license..."
            />
          </FG>
        </div>
      </Section>

      {/* ── 5. Consultation & Practice ── */}
      <Section icon="🏥" title="Consultation & Practice" accent>
        <div style={G2}>
          {/* <FG label="Consultation Mode">
            <select
              style={SEL}
              value={d.consultationMode}
              onChange={f("consultationMode")}
            >
              <option value="">Select…</option>
              {CONSULTATION_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </FG> */}
          <FG label="Consultation Fee">
            <div
              style={{
                display: "flex",
                border: "1.5px solid #e2e8f0",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <select
                value={d.feeCurrency}
                onChange={f("feeCurrency")}
                style={{
                  padding: "9px 8px",
                  background: "#f8fafc",
                  border: "none",
                  borderRight: "1.5px solid #e2e8f0",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  outline: "none",
                  flexShrink: 0,
                }}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                style={{ ...INP, border: "none", borderRadius: 0, flex: 1 }}
                type="number"
                min="0"
                step="1"
                value={d.consultantFees}
                onChange={f("consultantFees")}
                placeholder="500"
              />
            </div>
          </FG>
          <FG label="Clinic / Practice Name">
            <input
              style={INP}
              value={d.clinicName}
              onChange={f("clinicName")}
              placeholder="Clinic or practice name"
            />
          </FG>
          <FG label="Clinic Address" full>
            <input
              style={INP}
              value={d.clinicAddress}
              onChange={f("clinicAddress")}
              placeholder="Clinic street address"
            />
          </FG>
          <FG label="About Doctor" full>
            <textarea
              style={TA}
              value={d.aboutDoctor}
              onChange={f("aboutDoctor")}
              placeholder="Professional bio, areas of focus, patient care philosophy…"
            />
          </FG>
        </div>
      </Section>

      {/* ── 6. Languages ── */}
      <Section icon="🌐" title="Languages Known" accent>
        <FG label="Languages (comma-separated)">
          <input
            style={INP}
            value={langsInput}
            onChange={(e) => setLangsInput(e.target.value)}
            placeholder="English, Hindi, French, Spanish…"
          />
        </FG>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
          Separate each language with a comma.
        </div>
        {langsInput.trim() && (
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}
          >
            {langsInput
              .split(",")
              .map((l) => l.trim())
              .filter(Boolean)
              .map((lang) => (
                <span
                  key={lang}
                  style={{
                    padding: "3px 10px",
                    background: "rgba(37,99,235,0.1)",
                    color: "#2563eb",
                    borderRadius: 50,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {lang}
                </span>
              ))}
          </div>
        )}
      </Section>

      {/* ── 7. Documents ── */}
      <Section icon="📋" title="Submitted Documents" accent>
        <div
          style={{
            padding: "10px 14px",
            background: "#fef9c3",
            border: "1px solid #fde68a",
            borderRadius: 8,
            fontSize: 12,
            color: "#92400e",
            marginBottom: 14,
          }}
        >
          ℹ️ Upload a new file to replace an existing document. Existing
          documents remain unchanged unless you upload a replacement.
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          <AdminDocUpload
            label="Government ID / Nationality Proof"
            currentUrl={urls.idProof}
            onChange={setUrl("idProof")}
            enrollmentId={e._id}
            field="idProof"
          />
          <AdminDocUpload
            label="Medical Degree Certificate"
            currentUrl={urls.degreeFile}
            onChange={setUrl("degreeFile")}
            enrollmentId={e._id}
            field="degreeFile"
          />
          <AdminDocUpload
            label="Medical License Document"
            currentUrl={urls.medicalLicenseFile}
            onChange={setUrl("medicalLicenseFile")}
            enrollmentId={e._id}
            field="medicalLicenseFile"
          />
          <AdminDocUpload
            label="Malpractice Insurance License"
            currentUrl={urls.malpracticeInsuranceFile}
            onChange={setUrl("malpracticeInsuranceFile")}
            enrollmentId={e._id}
            field="malpracticeInsuranceFile"
          />
        </div>
      </Section>

      {/* ── 8. Availability ── */}
      <Section icon="🗓️" title="Availability Schedule" accent>
        {/* Timezone */}
        <div style={{ marginBottom: 20 }}>
          <label style={LBL}>Timezone</label>
          <select
            style={SEL}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            <option value="">Select timezone…</option>
            {timezone && !TIMEZONES.includes(timezone) && (
              <option value={timezone}>{timezone} (current)</option>
            )}
            {TIMEZONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {timezone && (
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
              Current: {timezone}
            </div>
          )}
        </div>

        {/* Day-by-day schedule */}
        {DAYS.map((day) => {
          const day_data = avail[day] || {
            enabled: false,
            blocks: [{ start: "09:00", end: "17:00" }],
          };
          return (
            <div
              key={day}
              style={{
                background: day_data.enabled ? "#eff6ff" : "#f8fafc",
                border: `1px solid ${day_data.enabled ? "#bfdbfe" : "#e2e8f0"}`,
                borderRadius: 10,
                padding: 14,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: day_data.enabled ? 10 : 0,
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: day_data.enabled ? "#1d4ed8" : "#94a3b8",
                  }}
                >
                  {day}
                </span>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: day_data.enabled ? "#1d4ed8" : "#94a3b8",
                      fontWeight: 600,
                    }}
                  >
                    {day_data.enabled ? "Available" : "Off"}
                  </span>
                  <div
                    style={{
                      position: "relative",
                      width: 40,
                      height: 22,
                      background: day_data.enabled ? "#2563eb" : "#e2e8f0",
                      borderRadius: 11,
                      cursor: "pointer",
                      transition: "background 0.2s",
                      flexShrink: 0,
                    }}
                    onClick={() => toggleDay(day)}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 2,
                        left: day_data.enabled ? 20 : 2,
                        width: 18,
                        height: 18,
                        background: "#fff",
                        borderRadius: "50%",
                        transition: "left 0.2s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }}
                    />
                  </div>
                </label>
              </div>
              {day_data.enabled && (
                <div>
                  {(day_data.blocks || []).map((block, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <input
                        type="time"
                        value={block.start}
                        onChange={(ev) =>
                          updateBlock(day, i, "start", ev.target.value)
                        }
                        style={{
                          padding: "7px 10px",
                          border: "1.5px solid #e2e8f0",
                          borderRadius: 7,
                          fontSize: 13,
                          outline: "none",
                          width: 120,
                          fontFamily: "inherit",
                        }}
                      />
                      <span
                        style={{
                          color: "#94a3b8",
                          fontWeight: 600,
                          fontSize: 13,
                        }}
                      >
                        to
                      </span>
                      <input
                        type="time"
                        value={block.end}
                        onChange={(ev) =>
                          updateBlock(day, i, "end", ev.target.value)
                        }
                        style={{
                          padding: "7px 10px",
                          border: "1.5px solid #e2e8f0",
                          borderRadius: 7,
                          fontSize: 13,
                          outline: "none",
                          width: 120,
                          fontFamily: "inherit",
                        }}
                      />
                      {(day_data.blocks || []).length > 1 && (
                        <button
                          onClick={() => removeBlock(day, i)}
                          style={{
                            padding: "5px 10px",
                            borderRadius: 6,
                            border: "1.5px solid #fecdd3",
                            background: "#fff1f2",
                            color: "#be123c",
                            fontSize: 11,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => addBlock(day)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 6,
                      border: "1.5px solid #e2e8f0",
                      background: "#fff",
                      color: "#334155",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      marginTop: 2,
                      fontFamily: "inherit",
                    }}
                  >
                    + Add Time Block
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </Section>

      {/* ── 9. Payout ── */}
      <Section icon="💳" title="Payout Information" accent>
        <div style={G2}>
          <FG label="Bank Name">
            <input
              style={INP}
              value={d.bankName}
              onChange={f("bankName")}
              placeholder="Bank name"
            />
          </FG>
          {/* <FG label="Account Holder Name">
            <input
              style={INP}
              value={d.accountHolderName}
              onChange={f("accountHolderName")}
              placeholder="Full name on account"
            />
          </FG> */}
          <FG label="Account Number">
            <input
              style={INP}
              value={d.accountNumber}
              onChange={f("accountNumber")}
              placeholder="Account number"
            />
          </FG>
          <FG label="SWIFT / IFSC / BIC Code">
            <input
              style={INP}
              value={d.ifscCode}
              onChange={f("ifscCode")}
              placeholder="SWIFT, IFSC, or BIC"
            />
          </FG>
          <FG label="PayPal ID">
            <input
              style={INP}
              value={d.paypalId}
              onChange={f("paypalId")}
              placeholder="PayPal email or username"
            />
          </FG>
          {/* <FG label="Payout Email">
            <input
              style={INP}
              type="email"
              value={d.payoutEmail}
              onChange={f("payoutEmail")}
              placeholder="Payout email address"
            /> 
          </FG> */}
          {/* <FG label="Stripe Account ID">
            <input
              style={INP}
              value={d.stripeAccountId}
              onChange={f("stripeAccountId")}
              placeholder="acct_xxxxxxxx"
            />
          </FG> */}
        </div>
      </Section>

      {/* ── Error ── */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            background: "#fff1f2",
            border: "1px solid #fecdd3",
            borderRadius: 8,
            color: "#be123c",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* ── Bottom Save/Cancel ── */}
      <div
        style={{
          display: "flex",
          gap: 12,
          justifyContent: "flex-end",
          paddingTop: 20,
          borderTop: "1px solid #e2e8f0",
        }}
      >
        <button
          onClick={onCancel}
          disabled={busy}
          style={{
            padding: "10px 24px",
            borderRadius: 8,
            border: "1.5px solid #e2e8f0",
            background: "#fff",
            color: "#334155",
            fontWeight: 600,
            fontSize: 14,
            cursor: busy ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}
        >
          ✕ Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={busy}
          style={{
            padding: "10px 28px",
            borderRadius: 8,
            border: "none",
            background: busy ? "#93c5fd" : "#2563eb",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            cursor: busy ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {busy ? "Saving…" : "💾 Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminDoctorProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [enrollment, setEnrollment] = useState(
    location.state?.enrollment || null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const from = location.state?.from || "manage-doctors";
  const backPath =
    from === "our-doctors"
      ? "/admin-dashboard/our-doctors"
      : "/admin-dashboard/manage-doctors";

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .get(`/api/admin/doctors/${id}`)
      .then((res) => setEnrollment(res.data))
      .catch(() => setError("Failed to load doctor profile."))
      .finally(() => setLoading(false));
  }, [id]);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get(`/api/admin/doctors/${id}`);
      setEnrollment(res.data);
    } catch { }
  }, [id]);

  const handleApprove = async () => {
    if (!enrollment) return;
    setBusy(true);
    try {
      const res = await api.put(
        `/api/admin/doctors/${enrollment._id}/approve`,
        {},
      );
      setEnrollment(res.data?.enrollment || enrollment);
      showToast("Doctor approved successfully.");
    } catch (err) {
      showToast(err?.response?.data?.msg || "Approve failed.", false);
    } finally {
      setBusy(false);
    }
  };
  const handleReject = async () => {
    if (!enrollment) return;
    setBusy(true);
    try {
      const res = await api.put(
        `/api/admin/doctors/${enrollment._id}/reject`,
        {},
      );
      setEnrollment(res.data?.enrollment || enrollment);
      showToast("Doctor rejected.");
    } catch (err) {
      showToast(err?.response?.data?.msg || "Reject failed.", false);
    } finally {
      setBusy(false);
    }
  };
  const handleApproveDelete = async () => {
    if (!enrollment) return;
    if (
      !window.confirm(
        "This will permanently delete the doctor's profile. Proceed?",
      )
    )
      return;
    setBusy(true);
    try {
      await api.put(`/api/admin/doctors/${enrollment._id}/delete/approve`, {});
      showToast("Doctor profile deleted.");
      setTimeout(() => navigate(backPath), 1500);
    } catch (err) {
      showToast(err?.response?.data?.msg || "Delete approval failed.", false);
    } finally {
      setBusy(false);
    }
  };
  const handleRejectDelete = async () => {
    if (!enrollment) return;
    setBusy(true);
    try {
      const res = await api.put(
        `/api/admin/doctors/${enrollment._id}/delete/reject`,
        {},
      );
      setEnrollment(res.data?.enrollment || enrollment);
      showToast("Delete request rejected.");
    } catch (err) {
      showToast(err?.response?.data?.msg || "Delete rejection failed.", false);
    } finally {
      setBusy(false);
    }
  };

  /* ── Loading / Error states ── */
  if (loading)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 300,
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div className="adp-spinner" />
        <p style={{ color: "#64748b", fontSize: 14 }}>
          Loading doctor profile…
        </p>
      </div>
    );
  if (error || !enrollment)
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <h3 style={{ color: "#334155", marginBottom: 8 }}>
          {error || "Doctor not found"}
        </h3>
        <button
          className="adp-btn adp-btn--view"
          onClick={() => navigate(backPath)}
        >
          ← Back to List
        </button>
      </div>
    );

  const e = enrollment;
  const progress = getProgress(e);
  const requestType = getRequestType(e);
  const statusMeta = STATUS_META[progress.status] || STATUS_META.pending;
  const requestMeta = REQUEST_META[requestType] || REQUEST_META.none;
  const fullName =
    `Dr. ${e.firstName || ""} ${e.surname || ""}`.trim() ||
    e.doctorId?.name ||
    "Unknown Doctor";
  const initials =
    `${(e.firstName || e.doctorId?.name || "D")[0]}${(e.surname || " ")[0]}`.toUpperCase();
  const phone = [e.countryCode, e.phoneNumber].filter(Boolean).join(" ");
  const location_ = [
    e.city,
    getStateName(e.state, e.country),
    getCountryName(e.country),
  ]
    .filter(Boolean)
    .join(", ");
  const langs = Array.isArray(e.languagesKnown)
    ? e.languagesKnown.join(", ")
    : e.languagesKnown || "";
  const hasPendingProfileUpdate =
    requestType === "profile_update" &&
    (e.profileUpdateRequestStatus || "pending") === "pending";
  // const canApprove =
  //   hasPendingProfileUpdate ||
  //   (e.approvalStatus !== "approved" &&
  //     (progress.completedSteps >= 4 || e.approvalStatus === "rejected"));
  const canApprove =
    hasPendingProfileUpdate ||
    (e.approvalStatus !== "approved" && progress.completedSteps >= 5);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", paddingBottom: 40 }}>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}
      </style>
      {/* Toast */}
      {toast && (
        <div
          className={`adp-toast ${toast.ok ? "adp-toast--ok" : "adp-toast--err"}`}
        >
          <span>{toast.ok ? "✓" : "!"}</span> {toast.msg}
        </div>
      )}

      {/* ── Top nav ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: 24,
        }}
      >
        <button
          onClick={() => navigate(backPath)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            borderRadius: 8,
            border: "1.5px solid #e2e8f0",
            background: "#fff",
            color: "#334155",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          ← Back
        </button>
        <div>
          <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>
            DOCTOR PROFILE{" "}
            {editMode && <span style={{ color: "#2563eb" }}>· EDIT MODE</span>}
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            {fullName}
          </h1>
        </div>
      </div>

      {/* ── Hero card ── */}
      <div
        style={{
          background: "linear-gradient(135deg,#1e3a5f 0%,#1d4ed8 100%)",
          borderRadius: 16,
          padding: "24px 28px",
          marginBottom: 24,
          display: "flex",
          alignItems: "flex-start",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            overflow: "hidden",
            border: "2.5px solid rgba(255,255,255,0.5)",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.18)",
          }}
        >
          {e.profilePhoto ? (
            <SignedImage
              enrollmentId={e._id}
              field="profilePhoto"
              alt={fullName}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              fallback={
                <span style={{ fontSize: 26, fontWeight: 800, color: "#fff" }}>
                  {initials}
                </span>
              }
            />
          ) : (
            <span style={{ fontSize: 26, fontWeight: 800, color: "#fff" }}>
              {initials}
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#fff",
              marginBottom: 4,
            }}
          >
            {fullName}
          </div>
          {(e.qualification || e.specialization) && (
            <div
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.85)",
                marginBottom: 4,
              }}
            >
              {[e.qualification, e.specialization].filter(Boolean).join(" · ")}
            </div>
          )}
          {e.experience && (
            <div
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.75)",
                marginBottom: 2,
              }}
            >
              🏅 {e.experience} years experience
            </div>
          )}
          {location_ && (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
              📍 {location_}
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            alignItems: "flex-end",
          }}
        >
          <span
            style={{
              background: statusMeta.bg,
              color: statusMeta.color,
              padding: "5px 14px",
              borderRadius: 50,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {statusMeta.label}
          </span>
          <span
            style={{
              background: requestMeta.bg,
              color: requestMeta.color,
              padding: "5px 14px",
              borderRadius: 50,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {requestMeta.label}
          </span>
          {e.doctorId?.doctorId && (
            <span
              style={{
                background: "rgba(255,255,255,0.15)",
                color: "#fff",
                padding: "5px 14px",
                borderRadius: 50,
                fontSize: 12,
                fontWeight: 700,
                border: "1px solid rgba(255,255,255,0.3)",
              }}
            >
              ID: {e.doctorId.doctorId}
            </span>
          )}
          <span
            style={{
              background: e.isOnline ? "#10b981" : "#6b7280",
              color: "#fff",
              padding: "5px 14px",
              borderRadius: 50,
              fontSize: 12,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#fff",
                animation: e.isOnline ? "pulse 2s infinite" : "none",
              }}
            />
            {e.isOnline ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      {/* ── Progress & Actions ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 20,
          marginBottom: 24,
          alignItems: "start",
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            padding: "18px 22px",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#64748b",
              marginBottom: 10,
            }}
          >
            ENROLLMENT PROGRESS
          </div>
          <ProgressBar progress={progress} />
        </div>
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            padding: "18px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            minWidth: 190,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#64748b",
              marginBottom: 4,
            }}
          >
            ADMIN ACTIONS
          </div>

          {editMode ? (
            /* In edit mode — show save/cancel shortcuts */
            <>
              <button
                onClick={() => {
                  setEditMode(false);
                  refresh();
                }}
                style={{
                  padding: "9px 16px",
                  borderRadius: 8,
                  border: "1.5px solid #e2e8f0",
                  background: "#fff",
                  color: "#334155",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "center",
                }}
              >
                ✕ Cancel Edit
              </button>
            </>
          ) : (
            /* Normal mode */
            <>
              <button
                onClick={() => setEditMode(true)}
                style={{
                  padding: "9px 16px",
                  borderRadius: 8,
                  border: "1.5px solid #2563eb",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  width: "100%",
                }}
              >
                ✏️ Edit Profile
              </button>

              {requestType === "profile_delete" ? (
                <>
                  <button
                    className="adp-btn adp-btn--approve"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={handleApproveDelete}
                    disabled={busy}
                  >
                    {busy ? "Processing…" : "Approve Delete"}
                  </button>
                  <button
                    className="adp-btn adp-btn--reject"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={handleRejectDelete}
                    disabled={busy}
                  >
                    {busy ? "Processing…" : "Reject Delete"}
                  </button>
                </>
              ) : (
                <>
                  {canApprove && (
                    <button
                      className="adp-btn adp-btn--approve"
                      style={{ width: "100%", justifyContent: "center" }}
                      onClick={handleApprove}
                      disabled={busy}
                    >
                      {busy ? "Processing…" : "✓ Approve"}
                    </button>
                  )}
                  {e.approvalStatus !== "rejected" && (
                    <button
                      className="adp-btn adp-btn--reject"
                      style={{ width: "100%", justifyContent: "center" }}
                      onClick={handleReject}
                      disabled={busy}
                    >
                      {busy ? "Processing…" : "✕ Reject"}
                    </button>
                  )}
                  {!canApprove && e.approvalStatus === "approved" && (
                    <span
                      style={{
                        fontSize: 13,
                        color: "#16a34a",
                        fontWeight: 600,
                        textAlign: "center",
                      }}
                    >
                      ✓ Approved
                    </span>
                  )}
                </>
              )}
            </>
          )}

          <button
            onClick={refresh}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: "1.5px solid #e2e8f0",
              background: "#f8fafc",
              color: "#64748b",
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════
          EDIT MODE — inline form
      ════════════════════════════════════ */}
      {editMode ? (
        <AdminEditForm
          enrollment={enrollment}
          onSaved={(updated) => {
            setEnrollment(updated);
            setEditMode(false);
          }}
          onCancel={() => setEditMode(false)}
          showToast={showToast}
        />
      ) : (
        /* ════════════════════════════════════
           VIEW MODE — read-only sections
        ════════════════════════════════════ */
        <>
          {requestType === "profile_update" && (
            <ProfileChangeSummary
              changes={e.pendingProfileChanges}
              requestedAt={e.profileUpdateRequestedAt}
            />
          )}

          {/* ── Personal & Contact ── */}
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
                  marginBottom: 18,
                }}
              >
                <SignedImage
                  enrollmentId={e._id}
                  field="profilePhoto"
                  alt={fullName}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "2.5px solid #16a34a",
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div
                    style={{ fontSize: 13, fontWeight: 700, color: "#166534" }}
                  >
                    ✅ Profile Photo Uploaded
                  </div>
                  <SignedDocumentButton
                    enrollmentId={e._id}
                    field="profilePhoto"
                    label="View full size"
                    style={{
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      color: "#2563eb",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: "12px 16px",
                  background: "#fafafa",
                  border: "1px dashed #e2e8f0",
                  borderRadius: 10,
                  marginBottom: 18,
                  fontSize: 13,
                  color: "#94a3b8",
                  fontStyle: "italic",
                }}
              >
                📷 No profile photo uploaded.
              </div>
            )}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
                gap: "16px 24px",
              }}
            >
              <Field label="First Name" value={e.firstName} />
              <Field label="Surname" value={e.surname} />
              <Field label="Email" value={e.email || e.doctorId?.email} />
              <Field label="Mobile" value={phone} />
              <Field label="Gender" value={e.gender} />
              <Field label="Date of Birth" value={e.dob} />
              <Field
                label="Languages"
                value={langs}
                full={langs?.length > 40}
              />
            </div>
          </Section>

          {/* ── Location ── */}
          <Section icon="📍" title="Location">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
                gap: "16px 24px",
              }}
            >
              <Field label="Country" value={getCountryName(e.country)} />
              <Field label="State" value={getStateName(e.state, e.country)} />
              <Field label="City" value={e.city} />
              <Field label="ZIP / Postal" value={e.zip} />
              <Field label="Street Address" value={e.address} full />
            </div>
          </Section>

          {/* ── Professional ── */}
          <Section icon="🩺" title="Professional Details">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
                gap: "16px 24px",
              }}
            >
              <Field label="Specialization" value={e.specialization} />
              <Field label="Sub-Specialization" value={e.subSpecialization} />
              <Field label="Qualification" value={e.qualification} />
              <Field
                label="Experience"
                value={e.experience ? `${e.experience} years` : ""}
              />
              <Field label="Medical School" value={e.medicalSchool} />
              <Field label="Graduation Year" value={e.registrationYear} />
              <Field label="Medical Council" value={e.medicalCouncilName} />
              <Field label="NPI" value={e.medicalRegistrationNumber} />
              <Field label="Medical License No." value={e.medicalLicense} />
              {/* <Field label="ID Proof Type" value={e.idProofType} /> */}
              {/* <Field label="Consultation Mode" value={e.consultationMode} /> */}
              <Field
                label="Consultation Fee"
                value={
                  e.consultantFees
                    ? `${e.feeCurrency || "USD"} ${e.consultantFees}`
                    : ""
                }
              />
            </div>
            {(e.clinicName || e.clinicAddress) && (
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 16,
                  borderTop: "1px solid #f1f5f9",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#94a3b8",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 10,
                  }}
                >
                  Clinic / Practice
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
                    gap: "16px 24px",
                  }}
                >
                  <Field label="Clinic Name" value={e.clinicName} />
                  <Field label="Clinic Address" value={e.clinicAddress} full />
                </div>
              </div>
            )}
            {(Array.isArray(e.licensedStates)
              ? e.licensedStates
              : e.state
                ? [e.state]
                : []
            ).length > 0 && (
                <div
                  style={{
                    marginTop: 16,
                    paddingTop: 16,
                    borderTop: "1px solid #f1f5f9",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: 10,
                    }}
                  >
                    🏛️ State/Territory Licensing (AU)
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
                          gap: 6,
                          padding: "4px 12px",
                          background: "#f8fafc",
                          border: "1px solid #cbd5e1",
                          borderRadius: 20,
                          fontSize: 13,
                          color: "#334155",
                          fontWeight: 500,
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
                <div
                  style={{
                    marginTop: 16,
                    paddingTop: 16,
                    borderTop: "1px solid #f1f5f9",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: 10,
                    }}
                  >
                    🌍 International Medical Licenses
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {e.internationalLicenses.map((country) => (
                      <span
                        key={country}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "4px 12px",
                          background: "#eff6ff",
                          border: "1px solid #bfdbfe",
                          borderRadius: 20,
                          fontSize: 13,
                          color: "#1d4ed8",
                          fontWeight: 500,
                        }}
                      >
                        {country}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            {e.aboutDoctor && (
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 16,
                  borderTop: "1px solid #f1f5f9",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#94a3b8",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 8,
                  }}
                >
                  About Doctor
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: "#334155",
                    lineHeight: 1.7,
                  }}
                >
                  {e.aboutDoctor}
                </p>
              </div>
            )}
          </Section>

          {/* ── Documents ── */}
          <Section icon="📋" title="Submitted Documents">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
                gap: 14,
              }}
            >
              <DocItem
                label="Government ID / Nationality Proof"
                filename={e.idProof}
                enrollmentId={e._id}
                field="idProof"
              />
              <DocItem
                label="Medical Degree Certificate"
                filename={e.degreeFile}
                enrollmentId={e._id}
                field="degreeFile"
              />
              <DocItem
                label="Medical License Document"
                filename={e.medicalLicenseFile}
                enrollmentId={e._id}
                field="medicalLicenseFile"
              />
              <DocItem
                label="Malpractice Insurance License"
                filename={e.malpracticeInsuranceFile}
                enrollmentId={e._id}
                field="malpracticeInsuranceFile"
              />
            </div>
          </Section>

          {/* ── Availability ── */}
          <Section icon="🗓️" title="Availability Schedule">
            {e.timezone && (
              <div
                style={{
                  marginBottom: 14,
                  padding: "8px 14px",
                  background: "#eff6ff",
                  borderRadius: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 12 }}>🕐</span>
                <span
                  style={{ fontSize: 13, fontWeight: 600, color: "#1d4ed8" }}
                >
                  Timezone: {e.timezone}
                </span>
              </div>
            )}
            {e.availability &&
              typeof e.availability === "object" &&
              Object.keys(e.availability).length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
                  gap: 10,
                }}
              >
                {DAYS.map((day) => {
                  const dayData = e.availability[day];
                  if (!dayData) return null;
                  return (
                    <div
                      key={day}
                      style={{
                        padding: "12px 16px",
                        borderRadius: 10,
                        border: `1.5px solid ${dayData.enabled ? "#bfdbfe" : "#e2e8f0"}`,
                        background: dayData.enabled ? "#eff6ff" : "#f8fafc",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: dayData.enabled ? 8 : 0,
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 13,
                            color: dayData.enabled ? "#1d4ed8" : "#94a3b8",
                          }}
                        >
                          {day}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 50,
                            background: dayData.enabled ? "#dcfce7" : "#f1f5f9",
                            color: dayData.enabled ? "#166534" : "#94a3b8",
                          }}
                        >
                          {dayData.enabled ? "Available" : "Off"}
                        </span>
                      </div>
                      {dayData.enabled &&
                        Array.isArray(dayData.blocks) &&
                        dayData.blocks.map((b, i) => (
                          <div
                            key={i}
                            style={{
                              fontSize: 12,
                              color: "#334155",
                              fontWeight: 500,
                              marginTop: 4,
                            }}
                          >
                            {b.start} – {b.end}
                          </div>
                        ))}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p
                style={{ color: "#94a3b8", fontSize: 14, fontStyle: "italic" }}
              >
                No availability schedule submitted.
              </p>
            )}
          </Section>

          {/* ── Payout ── */}
          <Section icon="💳" title="Payout Information">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
                gap: "16px 24px",
              }}
            >
              <Field label="Bank Name" value={e.bankName} />
              {/* <Field label="Account Holder" value={e.accountHolderName} /> */}

              <Field label="Account Number" value={e.accountNumber} />

              {/* <Field
                label="Account Number"
                value={
                  e.accountNumber
                    ? `****${String(e.accountNumber).slice(-4)}`
                    : ""
                }
              /> */}
              <Field label="SWIFT / BIC" value={e.ifscCode} />
              <Field label="PayPal ID" value={e.paypalId} />
              {/* <Field label="Payout Email" value={e.payoutEmail} /> */}
              {/* <Field label="Stripe Account" value={e.stripeAccountId} /> */}
            </div>
          </Section>

          {/* ── Profile Delete Request ── */}
          {requestType === "profile_delete" && (
            <Section icon="🗑️" title="Profile Delete Request">
              <div
                style={{
                  background: "#fff7f7",
                  border: "1px solid #fecaca",
                  borderRadius: 10,
                  padding: "14px 18px",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
                    gap: "12px 24px",
                  }}
                >
                  <Field
                    label="Requested At"
                    value={
                      e.profileDeleteRequestedAt
                        ? new Date(e.profileDeleteRequestedAt).toLocaleString()
                        : ""
                    }
                  />
                  <Field label="Reason" value={e.profileDeleteReason} full />
                </div>
              </div>
            </Section>
          )}

          {/* ── Bottom action bar ── */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "18px 22px",
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
            }}
          >
            <button
              onClick={() => navigate(backPath)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 20px",
                borderRadius: 8,
                border: "1.5px solid #e2e8f0",
                background: "#fff",
                color: "#334155",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              ← Back to List
            </button>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => setEditMode(true)}
                style={{
                  padding: "9px 20px",
                  borderRadius: 8,
                  border: "1.5px solid #2563eb",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                ✏️ Edit Profile
              </button>
              {requestType === "profile_delete" ? (
                <>
                  <button
                    className="adp-btn adp-btn--approve"
                    onClick={handleApproveDelete}
                    disabled={busy}
                  >
                    {busy ? "Processing…" : "Approve Delete"}
                  </button>
                  <button
                    className="adp-btn adp-btn--reject"
                    onClick={handleRejectDelete}
                    disabled={busy}
                  >
                    {busy ? "Processing…" : "Reject Delete"}
                  </button>
                </>
              ) : (
                <>
                  {canApprove && (
                    <button
                      className="adp-btn adp-btn--approve"
                      onClick={handleApprove}
                      disabled={busy}
                    >
                      {busy ? "Processing…" : "✓ Approve"}
                    </button>
                  )}
                  {e.approvalStatus !== "rejected" && (
                    <button
                      className="adp-btn adp-btn--reject"
                      onClick={handleReject}
                      disabled={busy}
                    >
                      {busy ? "Processing…" : "✕ Reject"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
