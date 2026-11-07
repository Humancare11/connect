const mongoose = require("mongoose");
const CountryChangeLog = require("../models/CountryChangeLog");
const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");

// True when the user has at least one paid booking of either kind.
async function userHasPaidBooking(userId) {
  const [appointment, consultation] = await Promise.all([
    Appointment.exists({ patientId: userId, paymentStatus: "paid" }),
    CategoryConsultation.exists({ patientId: userId, paymentStatus: "paid" }),
  ]);
  return Boolean(appointment || consultation);
}

// Records one profile country change: who, old -> new, when (changedAt), from
// which IP. If the user already has a paid booking the row is flagged
// (needsReview) for an admin to look at. This is a record only: the profile
// country plays no part in the currency (the visitor's IP decides that).
//
// Best-effort by design: it never throws, so a logging problem can never stop
// a customer saving their profile. A failure is logged loudly instead.
async function recordCountryChange({ userId, oldCountry, newCountry, ip = "", changedBy = "self", changedByUser = null }) {
  try {
    const before = String(oldCountry || "").trim();
    const after = String(newCountry || "").trim();
    if (before === after) return null;

    const hadPaidBooking = await userHasPaidBooking(userId);
    return await CountryChangeLog.create({
      user: userId,
      oldCountry: before,
      newCountry: after,
      changedBy,
      changedByUser,
      ip: String(ip || "").slice(0, 64),
      hadPaidBooking,
      needsReview: hadPaidBooking,
    });
  } catch (err) {
    console.error(
      `[COUNTRY_CHANGE_LOG_FAILED] user=${userId} old="${oldCountry}" new="${newCountry}" error=${err.message}`,
    );
    return null;
  }
}

// For the Manage Users list: which of these users have an unreviewed country
// change after a paid booking. Returns a Set of user id strings.
async function usersNeedingCountryReview(userIds) {
  const ids = (userIds || []).filter((id) => mongoose.isValidObjectId(id));
  if (ids.length === 0) return new Set();
  const rows = await CountryChangeLog.distinct("user", { user: { $in: ids }, needsReview: true });
  return new Set(rows.map(String));
}

module.exports = { recordCountryChange, userHasPaidBooking, usersNeedingCountryReview };
