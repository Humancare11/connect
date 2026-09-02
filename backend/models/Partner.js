const mongoose = require("mongoose");

// A Partner Company — an external organisation that submits care cases to
// Humancare on behalf of its own clients/patients. Created and managed
// exclusively by a Super Admin. The login account itself is a separate
// `User` document with role "partner" and a `partner` reference back to
// this company (see routes/superadmin.js partner-creation flow).
const partnerSchema = new mongoose.Schema(
  {
    // Human-friendly sequential identifier, e.g. "PTR-0001" (via Counter).
    partnerCode: { type: String, required: true, unique: true, index: true },

    companyName: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },

    contactPersonName: { type: String, default: "", trim: true },
    contactEmail: { type: String, default: "", lowercase: true, trim: true },
    contactPhone: { type: String, default: "", trim: true },
    country: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },

    billingCurrency: { type: String, default: "usd", lowercase: true, trim: true },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    deactivatedAt: { type: Date, default: null },
    deactivatedReason: { type: String, default: "" },

    // The Super Admin who created the company.
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Partner", partnerSchema);
