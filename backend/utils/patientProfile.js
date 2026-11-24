// Patient date of birth + gender: the rules in one place.
//
// DOB and gender belong to the patient's PROFILE (User.dob as "YYYY-MM-DD", User.gender as Male / Female / Other), collected once and
// reused. The booking only keeps a snapshot (age and sex at the time of booking). This file holds the validation, the age maths and
// the "is the profile complete" check used before a payment is started.
const User = require("../models/User");

const DOB_MIN_YEAR = 1900;
const GENDERS = ["Male", "Female", "Other"];
// Age is counted on the clinic's calendar (India), whichever time zone the server runs in.
const AGE_TIME_ZONE = "Asia/Kolkata";

const cleanStr = (value) => String(value ?? "").trim();

// Today's date in Asia/Kolkata as "YYYY-MM-DD".
function todayInIst(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: AGE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

// { valid, msg }. "YYYY-MM-DD", a real calendar date, not after today (India), not before 1900.
function validateDob(dob, now = new Date()) {
  const value = cleanStr(dob);
  if (!value) return { valid: false, msg: "Date of Birth is required." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { valid: false, msg: "Date of Birth must be a valid date." };

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return { valid: false, msg: "Date of Birth must be a valid date." };
  }
  if (value > todayInIst(now)) return { valid: false, msg: "Date of Birth cannot be in the future." };
  if (date.getUTCFullYear() < DOB_MIN_YEAR) {
    return { valid: false, msg: `Date of Birth must be in or after ${DOB_MIN_YEAR}.` };
  }
  return { valid: true };
}

const isValidGender = (gender) => GENDERS.includes(cleanStr(gender));

// Whole years between the DOB and the given moment, counted on the India calendar. null when the DOB is not usable.
function ageAt(dob, at = new Date()) {
  if (!validateDob(dob, at).valid) return null;
  const [by, bm, bd] = cleanStr(dob).split("-").map(Number);
  const [ty, tm, td] = todayInIst(at).split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age < 0 ? null : age;
}

// Which of "dob" / "gender" the profile still lacks (an unusable value counts as missing).
function profileMissing(user) {
  const missing = [];
  if (!validateDob(user?.dob).valid) missing.push("dob");
  if (!isValidGender(user?.gender)) missing.push("gender");
  return missing;
}

// What the booking records: { patientAgeAtBooking, patientSexAtBooking }. Both are empty (null / "") when the profile lacks them.
function bookingSnapshot(user, at = new Date()) {
  return {
    patientAgeAtBooking: ageAt(user?.dob, at),
    patientSexAtBooking: isValidGender(user?.gender) ? cleanStr(user.gender) : "",
  };
}

const PROFILE_INCOMPLETE_MSG = "Please complete your date of birth and gender to continue.";

// Express middleware for the routes that START a payment (after verifyUserToken). Answers 422 PROFILE_INCOMPLETE so the website can
// show the "Complete your details" step. It never runs on a booking-create route: a patient who has already paid is never refused.
async function requireCompleteProfile(req, res, next) {
  try {
    const user = await User.findById(req.user?.id).select("dob gender").lean();
    if (!user) return next(); // the route's own handling decides what a missing user means
    const missing = profileMissing(user);
    if (missing.length) {
      return res.status(422).json({ code: "PROFILE_INCOMPLETE", missing, msg: PROFILE_INCOMPLETE_MSG });
    }
    return next();
  } catch (err) {
    console.error("requireCompleteProfile error:", err.message);
    return res.status(500).json({ msg: "Could not check your profile. Please try again." });
  }
}

module.exports = {
  DOB_MIN_YEAR, GENDERS, AGE_TIME_ZONE, PROFILE_INCOMPLETE_MSG,
  todayInIst, validateDob, isValidGender, ageAt, profileMissing, bookingSnapshot, requireCompleteProfile,
};

// The snapshot for a booking that is being created. A booking whose payment is already taken is never refused for a missing DOB or
// gender: it is created with an empty snapshot and the gap is logged for follow-up. Never throws.
function snapshotForBooking(user, { kind, patientId, at = new Date() } = {}) {
  try {
    const missing = profileMissing(user);
    if (missing.length) {
      console.warn(`[PROFILE_INCOMPLETE] ${kind || "booking"} created without ${missing.join(" and ")} for patient ${patientId || user?._id || "?"} (payment already taken).`);
    }
    return bookingSnapshot(user, at);
  } catch (err) {
    console.error("snapshotForBooking error:", err.message);
    return { patientAgeAtBooking: null, patientSexAtBooking: "" };
  }
}
module.exports.snapshotForBooking = snapshotForBooking;
