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

// Turns { timeMorning:"1", timeAfternoon:"0", timeNight:"1", foodTiming:"After Food" }
// into "Morning (1), Night (1) - After Food" — simple for the doctor to set,
// plain-English for the patient to read.
export function buildFrequencyText(med) {
  const parts = [];
  if (Number(med.timeMorning) > 0) parts.push(`Morning (${med.timeMorning})`);
  if (Number(med.timeAfternoon) > 0)
    parts.push(`Afternoon (${med.timeAfternoon})`);
  if (Number(med.timeNight) > 0) parts.push(`Night (${med.timeNight})`);
  const timesText = parts.join(", ");
  if (!timesText) return "";
  return med.foodTiming ? `${timesText} - ${med.foodTiming}` : timesText;
}
