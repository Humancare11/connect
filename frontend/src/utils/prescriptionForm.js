// Shared helpers for the doctor-facing prescription form — used by both the
// "My Patients" list (certificate modal date formatting) and the dedicated
// "Write Prescription" page, so the medicine/timing model stays in one place.

export function formatShortDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export const EMPTY_MEDICINE = {
  name: "",
  dosage: "",
  frequency: "",
  duration: "",
  notes: "",
  timeMorning: "0",
  timeAfternoon: "0",
  timeNight: "0",
  foodTiming: "After Food",
};

export const EMPTY_RX = {
  diagnosis: "",
  medicines: [{ ...EMPTY_MEDICINE }],
  instructions: "",
  followUpDate: "",
};

// Turns { timeMorning:"1", timeAfternoon:"0", timeNight:"1/2", foodTiming:"After Food" }
// into "Morning (1), Night (1/2) - After Food" — simple for the doctor to set,
// plain-English for the patient to read. Time values are free text (e.g. "1",
// "1/2", "2 tablets"), so any non-empty value other than "0" counts as set.
function hasDose(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed !== "" && trimmed !== "0";
}

export function buildFrequencyText(med) {
  const parts = [];
  if (hasDose(med.timeMorning))
    parts.push(`Morning (${med.timeMorning.trim()})`);
  if (hasDose(med.timeAfternoon))
    parts.push(`Afternoon (${med.timeAfternoon.trim()})`);
  if (hasDose(med.timeNight)) parts.push(`Night (${med.timeNight.trim()})`);
  const timesText = parts.join(", ");
  if (!timesText) return "";
  return med.foodTiming ? `${timesText} - ${med.foodTiming}` : timesText;
}
