const mongoose = require("mongoose");

const healthcareCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    icon: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      enum: ["USD"],
      default: "USD",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Stable identifier linking this category to its CategoryPricing
    // record (see backend/utils/categoryPricing.js). Generated once from
    // the category's name at creation time and never changed afterward,
    // so renaming a category never breaks its price lookup. Optional at
    // the schema level (sparse index) so existing documents created
    // before this field existed remain valid until backfilled.
    pricingSlug: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 80,
      match: /^[a-z0-9-]+$/,
    },
  },
  { timestamps: true },
);

healthcareCategorySchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });
healthcareCategorySchema.index({ pricingSlug: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("HealthcareCategory", healthcareCategorySchema);
