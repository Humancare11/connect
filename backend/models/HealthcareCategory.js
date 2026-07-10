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
  },
  { timestamps: true },
);

healthcareCategorySchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

module.exports = mongoose.model("HealthcareCategory", healthcareCategorySchema);
