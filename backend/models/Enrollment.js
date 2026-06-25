const mongoose = require("mongoose");

const APPLICATION_STATUSES = ["Pending", "Approved", "Rejected"];
const normalizeApplicationStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "approved") return "Approved";
  if (normalized === "rejected") return "Rejected";
  return "Pending";
};

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
  licensedStates: [String],
  internationalLicenses: [String],
  clinicName: String,
  clinicAddress: String,

  // Section 2 - Verification + Payout
  medicalRegistrationNumber: String,
  medicalLicense: String,
  idProof: String,
  degreeFile: String,
  medicalLicenseFile: String,
  malpracticeInsuranceFile: String,
  medicalCouncilName: String,
  registrationYear: String,
  idProofType: String,
  payoutEmail: String,
  paypalId: String,
  stripeAccountId: String,

  accountHolderName: String,
  bankName: String,
  accountNumber: String,
  ifscCode: String,

  // Education
  medicalSchool: String,

  // Availability
  availability: { type: mongoose.Schema.Types.Mixed },
  timezone: String,
  profilePhoto: String,

  // Flags
  hasProfilePhoto: { type: Boolean, default: false },
  hasCertification: { type: Boolean, default: false },
  verified: { type: Boolean, default: false },
  formCompleted: { type: Boolean, default: false },

  // Live onboarding progress
  completedSteps: { type: Number, default: 0, min: 0, max: 5 },
  currentStep: { type: Number, default: 1, min: 1, max: 5 },
  currentStepLabel: { type: String, default: "Identity" },
  applicationStatus: {
    type: String,
    enum: APPLICATION_STATUSES,
    default: "Pending",
    set: normalizeApplicationStatus,
  },

  // Active workflow request being handled by admin
  pendingRequestType: {
    type: String,
    enum: ["none", "new_enrollment", "profile_update", "profile_delete"],
    default: "new_enrollment",
  },
  profileUpdateRequestedAt: Date,
  profileUpdateReviewedAt: Date,
  profileUpdateRequestStatus: {
    type: String,
    enum: ["none", "pending", "approved", "rejected"],
    default: "none",
  },
  pendingProfileChanges: {
    type: [{
      field: String,
      label: String,
      previousValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed,
    }],
    default: [],
  },
  profileUpdateSnapshot: {
    type: mongoose.Schema.Types.Mixed,
    default: undefined,
  },
  profileDeleteReason: String,
  profileDeleteRequestedAt: Date,
  profileDeleteApprovedAt: Date,
  profileDeleteRejectedAt: Date,
  profileDeleteRequestStatus: {
    type: String,
    enum: ["none", "pending", "approved", "rejected"],
    default: "none",
  },

  // Admin approval
  approvalStatus: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },

  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Enrollment", enrollmentSchema);
