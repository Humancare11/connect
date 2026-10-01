const mongoose = require("mongoose");

const MAX_ALIASES = 30;

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
    // Search-language terms for the specialty, e.g. "skin doctor" for
    // Dermatology. Internal: not returned by /api/appointment-tree, which
    // projects specialties to an explicit field list.
    aliases: {
      type: [{ type: String, trim: true, maxlength: 60 }],
      default: [],
      validate: {
        validator: (value) => !Array.isArray(value) || value.length <= MAX_ALIASES,
        message: `A specialty can have at most ${MAX_ALIASES} aliases.`,
      },
    },
  },
  { timestamps: true },
);

healthcareSpecialtySchema.index(
  { categoryId: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);

module.exports = mongoose.model("HealthcareSpecialty", healthcareSpecialtySchema);
