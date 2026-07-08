const mongoose = require("mongoose");

const healthcareConditionSchema = new mongoose.Schema(
  {
    specialtyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HealthcareSpecialty",
      required: true,
      index: true,
    },
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
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

healthcareConditionSchema.index({ specialtyId: 1, name: 1 });
healthcareConditionSchema.index(
  { specialtyId: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);

module.exports = mongoose.model("HealthcareCondition", healthcareConditionSchema);
