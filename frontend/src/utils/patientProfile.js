// Checkout "Complete your details" step: the checks the website makes before it shows the step. The server enforces the same rules
// (backend/utils/patientProfile.js); these only decide what to show and give quick feedback.
export const GENDER_OPTIONS = ["Male", "Female", "Other"];
export const DOB_MIN = "1900-01-01";

// Today's date in India ("YYYY-MM-DD"), the calendar the server counts ages on.
export function todayIst(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// An error message for a DOB, or "" when it is fine.
export function dobError(dob, now = new Date()) {
  const value = String(dob || "").trim();
  if (!value) return "Date of Birth is required.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Date of Birth must be a valid date.";
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return "Date of Birth must be a valid date.";
  if (value > todayIst(now)) return "Date of Birth cannot be in the future.";
  if (value < DOB_MIN) return "Date of Birth must be in or after 1900.";
  return "";
}

export const genderError = (gender) => (GENDER_OPTIONS.includes(String(gender || "").trim()) ? "" : "Please select a gender.");

// True when the signed-in patient's profile already has a usable DOB and gender (the step is then skipped).
export const profileIsComplete = (user) => !!user && !dobError(user.dob) && !genderError(user.gender);

// True for the server's "start of payment" refusal, so the page can show the details step instead of a payment error.
export const isProfileIncompleteError = (err) => err?.response?.status === 422 && err?.response?.data?.code === "PROFILE_INCOMPLETE";
