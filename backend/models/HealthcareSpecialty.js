const mongoose = require("mongoose");

const healthcareSpecialtySchema = new mongoose.Schema(
  {
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HealthcareCategory",
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

healthcareSpecialtySchema.index(
  { categoryId: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);

module.exports = mongoose.model("HealthcareSpecialty", healthcareSpecialtySchema);
