const mongoose = require("mongoose");

// One row each time a user's profile country changes (not the first value set
// at signup). A change after a paid booking is flagged (`needsReview`) for an
// admin to look at. It is a record only: the currency does not depend on the
// profile country (the visitor's IP decides it). This is its own collection because the generic activity logger is a
// deliberate no-op.
const countryChangeLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    oldCountry: { type: String, default: "" },
    newCountry: { type: String, default: "" },
    // "self" = the user edited their profile; "admin" = an admin edited it.
    changedBy: { type: String, enum: ["self", "admin"], default: "self" },
    changedByUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    ip: { type: String, default: "" },
    hadPaidBooking: { type: Boolean, default: false },
    needsReview: { type: Boolean, default: false },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: "changedAt", updatedAt: false } },
);

countryChangeLogSchema.index({ needsReview: 1, changedAt: -1 });

module.exports = mongoose.model("CountryChangeLog", countryChangeLogSchema);
