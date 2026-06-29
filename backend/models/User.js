// models/User.js
const mongoose = require("mongoose");
const { generatePatientId } = require("../utils/idSequence");

const userSchema = new mongoose.Schema(
  {
    patientId: {
      type: Number,
      unique: true,
      sparse: true,
      immutable: true,
      min: 10000,
      max: 99999,
    },

    name: { type: String, required: true, trim: true },

    email: { type: String, required: true, unique: true, lowercase: true, trim: true },

    password: { type: String, required: false, default: "" },

    googleId: { type: String, default: "" },

    appleId:  { type: String, default: "" },

    role: {
      type: String,
      enum: ["user", "admin", "superadmin", "doctor", "paymentadmin", "employeeadmin"],
      default: "user",
    },

    mobile: { type: String, default: "" },

    dob: { type: String, default: "" },

    gender: { type: String, enum: ["Male", "Female", "Other", ""], default: "" },

    country: { type: String, default: "" },

    registrationIp: { type: String, default: "" },

    accountDisabled: { type: Boolean, default: false, index: true },
    disabledAt: { type: Date, default: null },
    disabledReason: { type: String, default: "" },

    privacyConsent: {
      accepted: { type: Boolean, default: false },
      acceptedAt: { type: Date, default: null },
      policyVersion: { type: String, default: "" },
      ipAddress: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

userSchema.pre("validate", async function assignPatientId() {
  if (!this.isNew || this.role !== "user" || this.patientId) return;
  this.patientId = await generatePatientId();
});

// function rejectPatientIdMutation(next) {
//   const update = this.getUpdate() || {};
//   const hasDirectMutation = Object.prototype.hasOwnProperty.call(update, "patientId");
//   const hasSetMutation = update.$set && Object.prototype.hasOwnProperty.call(update.$set, "patientId");
//   const hasUnsetMutation = update.$unset && Object.prototype.hasOwnProperty.call(update.$unset, "patientId");

//   if (hasDirectMutation || hasSetMutation || hasUnsetMutation) {
//     return next(new Error("patientId is immutable and cannot be changed."));
//   }
//   return next();
// }


async function rejectPatientIdMutation() {
  const update = this.getUpdate() || {};

  const hasDirectMutation = Object.prototype.hasOwnProperty.call(update, "patientId");
  const hasUnsetMutation =
    update.$unset &&
    Object.prototype.hasOwnProperty.call(update.$unset, "patientId");

  if (hasDirectMutation || hasUnsetMutation) {
    throw new Error("patientId is immutable and cannot be changed.");
  }
}

userSchema.pre("findOneAndUpdate", rejectPatientIdMutation);
userSchema.pre("updateOne", rejectPatientIdMutation);
userSchema.pre("updateMany", rejectPatientIdMutation);

// userSchema.pre("findOneAndUpdate", rejectPatientIdMutation);
// userSchema.pre("updateOne", rejectPatientIdMutation);
// userSchema.pre("updateMany", rejectPatientIdMutation);

module.exports = mongoose.model("User", userSchema);
