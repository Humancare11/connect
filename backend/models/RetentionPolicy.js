const mongoose = require("mongoose");

const retentionPolicySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      enum: ["chatMessages", "medicalRecords", "uploadedFiles"],
      required: true,
      unique: true,
    },
    label: { type: String, required: true },
    retentionDays: { type: Number, required: true, min: 1 },
    enabled: { type: Boolean, default: true },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RetentionPolicy", retentionPolicySchema);
