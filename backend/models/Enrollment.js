const mongoose = require("mongoose");

const enrollmentSchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true, unique: true },
  
  // Section 1 - Personal Details
  email: String,
  countryCode: String,
  phoneNumber: String,
  firstName: String,
  surname: String,
  gender: String,
  dob: String,
  qualification: String,
  specialization: String,
  subSpecialization: String,
  consultantFees: Number,
  feeCurrency: { type: String, default: "USD" },
  address: String,
  country: String,
  state: String,
  city: String,
  zip: String,
  experience: Number,
  aboutDoctor: String,
  consultationMode: String,
  languagesKnown: [String],
  clinicName: String,
  clinicAddress: String,

  // Section 2 - Verification + Payout
  medicalRegistrationNumber: String,
  medicalLicense: String,
  idProof: String,
  medicalLicenseFile: String,
  medicalCouncilName: String,
  registrationYear: String,
  idProofType: String,
  payoutEmail: String,
  paypalId: String,
  accountHolderName: String,
  bankName: String,
  accountNumber: String,
  ifscCode: String,

  // Education
  medicalSchool: String,

  // Availability
  availability: { type: mongoose.Schema.Types.Mixed },
  timezone: String,

  // Flags
  hasProfilePhoto: { type: Boolean, default: false },
  hasCertification: { type: Boolean, default: false },
  verified: { type: Boolean, default: false },
  formCompleted: { type: Boolean, default: false },

  // Admin approval
  approvalStatus: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },

  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Enrollment", enrollmentSchema);
