const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");
const { paypalFetch } = require("../utils/paypal");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { logAudit } = require("../utils/auditLogger");
const { randomInt } = require("crypto");
const { recordSecurityIncident } = require("../utils/securityMonitor");
const { revokeUserSessions } = require("../utils/tokenRevocation");
const { keyFromStoredValue } = require("../utils/uploadStorage");
const { createS3PresignedGetUrl, DEFAULT_EXPIRY_SECONDS } = require("../utils/s3PresignedUrl");

const STEP_LABELS = ["Identity", "Professional", "Availability", "Payout", "Submitted"];
const DOCTOR_DOCUMENT_FIELDS = new Set([
  "profilePhoto",
  "idProof",
  "degreeFile",
  "medicalLicenseFile",
  "malpracticeInsuranceFile",
]);

const inferProgressFromFields = (enrollment) => {
  if (!enrollment) return { completedSteps: 0, currentStep: 1 };
  if (enrollment.formCompleted) return { completedSteps: 5, currentStep: 5 };
  const hasStep4 = !!(enrollment.accountNumber || enrollment.paypalId || enrollment.payoutEmail);
  const hasStep3 = !!(enrollment.timezone || (enrollment.availability && Object.keys(enrollment.availability || {}).length > 0));
  const hasStep2 = !!(enrollment.specialization || enrollment.qualification);
  const hasStep1 = !!(enrollment.firstName || enrollment.phoneNumber);
  if (hasStep4) return { completedSteps: 4, currentStep: 5 };
  if (hasStep3) return { completedSteps: 3, currentStep: 4 };
  if (hasStep2) return { completedSteps: 2, currentStep: 3 };
  if (hasStep1) return { completedSteps: 1, currentStep: 2 };
  return { completedSteps: 0, currentStep: 1 };
};

const deriveApplicationStatus = (enrollment) => {
  if (enrollment.approvalStatus === "approved") return "Approved";
  if (enrollment.approvalStatus === "rejected") return "Rejected";
  return "Pending";
};

const normalizeApplicationStatus = (value, enrollment) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "approved") return "Approved";
  if (normalized === "rejected") return "Rejected";
  if (normalized === "pending") return "Pending";
  return deriveApplicationStatus(enrollment);
};

const approvalStatusFromApplicationStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "approved") return "approved";
  if (normalized === "rejected") return "rejected";
  if (normalized === "pending") return "pending";
  return null;
};

const normalizeEnrollmentWorkflow = (enrollment) => {
  const fallbackProgress = inferProgressFromFields(enrollment);
  const completedSteps = Number.isFinite(Number(enrollment.completedSteps))
    ? Number(enrollment.completedSteps)
    : fallbackProgress.completedSteps;
  const currentStep = Number.isFinite(Number(enrollment.currentStep))
    ? Number(enrollment.currentStep)
    : fallbackProgress.currentStep;
  const applicationStatus = normalizeApplicationStatus(
    enrollment.applicationStatus,
    { ...enrollment, completedSteps }
  );
  return {
    ...enrollment,
    completedSteps,
    currentStep,
    currentStepLabel: enrollment.currentStepLabel || STEP_LABELS[Math.min(Math.max(currentStep - 1, 0), STEP_LABELS.length - 1)],
    applicationStatus,
    pendingRequestType: enrollment.pendingRequestType || "none",
    profileUpdateRequestStatus: enrollment.profileUpdateRequestStatus || (enrollment.pendingRequestType === "profile_update" ? "pending" : "none"),
    profileDeleteRequestStatus: enrollment.profileDeleteRequestStatus || "none",
  };
};

const getAdminStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: "user" });
    const activeUsers = await User.countDocuments({ role: "user" }); // For now, same as total users
    const totalDoctors = await Enrollment.countDocuments({ approvalStatus: "approved" });
    const totalAppointments = await Appointment.countDocuments();

    res.status(200).json({ totalUsers, activeUsers, totalDoctors, totalAppointments });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ msg: "Failed to fetch admin stats" });
  }
};

// GET /api/admin/doctors — all enrollments for admin review
const getAllDoctors = async (req, res) => {
  try {
    const enrollments = await Enrollment.find()
      .populate("doctorId", "name email doctorId isEnrolled")
      .sort({ updatedAt: -1 })
      .lean();

    const normalized = enrollments.map(normalizeEnrollmentWorkflow);
    res.status(200).json(normalized);
  } catch (error) {
    console.error("getAllDoctors error:", error);
    res.status(500).json({ msg: "Failed to fetch doctors" });
  }
};

// PUT /api/admin/doctors/:id/approve
const approveDoctor = async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id);
    if (!enrollment) return res.status(404).json({ msg: "Enrollment not found" });

    if (enrollment.profileDeleteRequestStatus === "pending") {
      return res.status(400).json({ msg: "This record has a pending delete request. Use delete approval action instead." });
    }

    const isProfileUpdateRequest = enrollment.pendingRequestType === "profile_update";
    if (isProfileUpdateRequest) {
      (enrollment.pendingProfileChanges || []).forEach((change) => {
        if (change?.field) enrollment.set(change.field, change.newValue);
      });
      enrollment.markModified("languagesKnown");
      enrollment.markModified("availability");
    }

    enrollment.approvalStatus = "approved";
    enrollment.verified = true;
    enrollment.formCompleted = true;
    enrollment.completedSteps = 5;
    enrollment.currentStep = 5;
    enrollment.currentStepLabel = STEP_LABELS[4];
    enrollment.applicationStatus = "Approved";
    enrollment.pendingRequestType = "none";
    enrollment.profileUpdateRequestedAt = undefined;
    enrollment.profileUpdateReviewedAt = isProfileUpdateRequest ? new Date() : undefined;
    enrollment.profileUpdateRequestStatus = isProfileUpdateRequest ? "approved" : "none";
    enrollment.pendingProfileChanges = [];
    enrollment.profileUpdateSnapshot = undefined;
    enrollment.profileDeleteRequestStatus = "none";
    enrollment.updatedAt = new Date();
    enrollment.markModified("pendingProfileChanges");
    enrollment.markModified("profileUpdateSnapshot");
    await enrollment.save();

    if (enrollment.doctorId) {
      await Doctor.findByIdAndUpdate(enrollment.doctorId, { isEnrolled: true });
    }

    await logAudit(req, {
      action: "ADMIN_APPROVE_DOCTOR",
      resource: "Enrollment",
      resourceId: req.params.id,
      details: { doctorId: enrollment.doctorId?.toString() },
    });

    res.status(200).json({ msg: "Doctor approved", enrollment: normalizeEnrollmentWorkflow(enrollment.toObject()) });
  } catch (error) {
    console.error("approveDoctor error:", error);
    res.status(500).json({ msg: "Failed to approve doctor" });
  }
};

// PUT /api/admin/doctors/:id/reject
const rejectDoctor = async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id);
    if (!enrollment) return res.status(404).json({ msg: "Enrollment not found" });

    const isProfileUpdateRequest = enrollment.pendingRequestType === "profile_update";
    if (isProfileUpdateRequest) {
      const snapshot = enrollment.profileUpdateSnapshot || {};
      Object.entries(snapshot).forEach(([field, value]) => {
        enrollment.set(field, value);
      });
      enrollment.approvalStatus = "approved";
      enrollment.verified = true;
      enrollment.formCompleted = true;
      enrollment.completedSteps = 5;
      enrollment.currentStep = 5;
      enrollment.currentStepLabel = STEP_LABELS[4];
      enrollment.applicationStatus = "Approved";
      enrollment.pendingRequestType = "none";
      enrollment.profileUpdateRequestedAt = undefined;
      enrollment.profileUpdateReviewedAt = new Date();
      enrollment.profileUpdateRequestStatus = "rejected";
      enrollment.pendingProfileChanges = [];
      enrollment.profileUpdateSnapshot = undefined;
      enrollment.markModified("pendingProfileChanges");
      enrollment.markModified("profileUpdateSnapshot");
      enrollment.markModified("languagesKnown");
      enrollment.markModified("availability");
    } else {
      enrollment.approvalStatus = "rejected";
      enrollment.verified = false;
      enrollment.applicationStatus = "Rejected";
    }
    enrollment.updatedAt = new Date();
    await enrollment.save();

    if (enrollment.doctorId) {
      await Doctor.findByIdAndUpdate(enrollment.doctorId, { isEnrolled: isProfileUpdateRequest });
    }

    await logAudit(req, {
      action: "ADMIN_REJECT_DOCTOR",
      resource: "Enrollment",
      resourceId: req.params.id,
      details: { doctorId: enrollment.doctorId?.toString() },
    });

    res.status(200).json({
      msg: isProfileUpdateRequest ? "Profile update rejected. Previous approved profile restored." : "Doctor rejected",
      enrollment: normalizeEnrollmentWorkflow(enrollment.toObject()),
    });
  } catch (error) {
    console.error("rejectDoctor error:", error);
    res.status(500).json({ msg: "Failed to reject doctor" });
  }
};

// PUT /api/admin/doctors/:id/delete/approve
const approveDoctorDeleteRequest = async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id);
    if (!enrollment) return res.status(404).json({ msg: "Enrollment not found" });

    if (enrollment.profileDeleteRequestStatus !== "pending") {
      return res.status(400).json({ msg: "No pending delete request for this doctor." });
    }

    const doctorId = enrollment.doctorId;
    enrollment.profileDeleteRequestStatus = "approved";
    enrollment.profileDeleteApprovedAt = new Date();
    enrollment.pendingRequestType = "none";
    enrollment.applicationStatus = deriveApplicationStatus(enrollment);
    enrollment.updatedAt = new Date();
    await enrollment.save();

    await Enrollment.deleteOne({ _id: enrollment._id });
    if (doctorId) {
      await Doctor.findByIdAndDelete(doctorId);
    }

    await logAudit(req, {
      action: "ADMIN_DELETE_DOCTOR",
      resource: "Doctor",
      resourceId: doctorId?.toString() || req.params.id,
      details: { enrollmentId: req.params.id },
    });

    return res.status(200).json({ msg: "Doctor profile deleted successfully." });
  } catch (error) {
    console.error("approveDoctorDeleteRequest error:", error);
    return res.status(500).json({ msg: "Failed to approve doctor delete request." });
  }
};

// PUT /api/admin/doctors/:id/delete/reject
const rejectDoctorDeleteRequest = async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id);
    if (!enrollment) return res.status(404).json({ msg: "Enrollment not found" });

    enrollment.profileDeleteRequestStatus = "rejected";
    enrollment.profileDeleteRejectedAt = new Date();
    enrollment.pendingRequestType = "none";
    enrollment.applicationStatus = deriveApplicationStatus(enrollment);
    enrollment.updatedAt = new Date();
    await enrollment.save();

    if (enrollment.doctorId && enrollment.approvalStatus === "approved") {
      await Doctor.findByIdAndUpdate(enrollment.doctorId, { isEnrolled: true });
    }

    return res.status(200).json({
      msg: "Doctor delete request rejected.",
      enrollment: normalizeEnrollmentWorkflow(enrollment.toObject()),
    });
  } catch (error) {
    console.error("rejectDoctorDeleteRequest error:", error);
    return res.status(500).json({ msg: "Failed to reject doctor delete request." });
  }
};

// GET /api/admin/users — all users for admin management
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ role: "user" })
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    if (users.length >= 100) {
      await recordSecurityIncident(req, {
        type: "large_data_export",
        severity: "medium",
        title: "Large user dataset accessed",
        resource: "User",
        metadata: { count: users.length, endpoint: req.originalUrl },
      });
    }

    res.status(200).json(users);
  } catch (error) {
    console.error("getAllUsers error:", error);
    res.status(500).json({ msg: "Failed to fetch users" });
  }
};

// DELETE /api/admin/users/:id — delete a user
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    await revokeUserSessions(user._id, "account_deleted");

    await logAudit(req, {
      action: "ADMIN_DELETE_USER",
      resource: "User",
      resourceId: req.params.id,
      details: { deletedUserEmail: user.email, deletedUserName: user.name, deletedUserRole: user.role },
    });

    res.status(200).json({ msg: "User deleted successfully" });
  } catch (error) {
    console.error("deleteUser error:", error);
    res.status(500).json({ msg: "Failed to delete user" });
  }
};

// GET /api/admin/users/:id — get user details
const getUserDetails = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found" });

    await logAudit(req, {
      action: "ADMIN_VIEW_USER",
      resource: "User",
      resourceId: req.params.id,
      patientId: user.role === "user" ? req.params.id : null,
      details: { viewedUserEmail: user.email, viewedUserRole: user.role },
    });

    res.status(200).json(user);
  } catch (error) {
    console.error("getUserDetails error:", error);
    res.status(500).json({ msg: "Failed to fetch user details" });
  }
};

const forceLogoutUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("email name role");
    if (!user) return res.status(404).json({ msg: "User not found" });
    const revokedCount = await revokeUserSessions(user._id, "forced_logout");
    await logAudit(req, {
      action: "ADMIN_FORCE_LOGOUT_USER",
      resource: "User",
      resourceId: user._id,
      details: { email: user.email, revokedCount },
    });
    res.json({ msg: "Active sessions revoked.", revokedCount });
  } catch (error) {
    console.error("forceLogoutUser error:", error);
    res.status(500).json({ msg: "Failed to force logout user" });
  }
};

const disableUser = async (req, res) => {
  try {
    const { reason = "Administrative security action" } = req.body || {};
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { accountDisabled: true, disabledAt: new Date(), disabledReason: reason },
      { returnDocument: 'after' }
    ).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found" });
    const revokedCount = await revokeUserSessions(user._id, "account_disabled");
    await logAudit(req, {
      action: "ADMIN_DISABLE_USER",
      resource: "User",
      resourceId: user._id,
      details: { email: user.email, reason, revokedCount },
    });
    res.json({ msg: "Account disabled and active sessions revoked.", user, revokedCount });
  } catch (error) {
    console.error("disableUser error:", error);
    res.status(500).json({ msg: "Failed to disable user" });
  }
};

// POST /api/admin/migrate/doctor-ids — one-time migration to assign 5-digit IDs to existing doctors
const migrateDoctorIds = async (req, res) => {
  try {
    const doctors = await Doctor.find({ doctorId: { $exists: false } });
    let updated = 0;

    for (const doctor of doctors) {
      let id;
      let exists = true;
      while (exists) {
        id = randomInt(10000, 100000);
        exists = await Doctor.exists({ doctorId: id });
      }
      await Doctor.findByIdAndUpdate(doctor._id, { doctorId: id });
      updated++;
    }

    res.status(200).json({ msg: `Migration complete. ${updated} doctor(s) assigned a new ID.` });
  } catch (error) {
    console.error("migrateDoctorIds error:", error);
    res.status(500).json({ msg: "Migration failed." });
  }
};

// GET /api/admin/approved-doctors — approved doctors with phone for "Our Doctors" table
const getApprovedDoctors = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ approvalStatus: "approved" })
      .populate("doctorId", "name email doctorId isEnrolled")
      .sort({ updatedAt: -1 })
      .lean();
    res.status(200).json(enrollments);
  } catch (error) {
    console.error("getApprovedDoctors error:", error);
    res.status(500).json({ msg: "Failed to fetch approved doctors" });
  }
};

// GET /api/admin/doctor-workflow-stats â€” counters for doctors dashboard cards
const getDoctorWorkflowStats = async (req, res) => {
  try {
    const [totalDoctors, updateRequests, deleteRequests] = await Promise.all([
      Enrollment.countDocuments({ approvalStatus: "approved" }),
      Enrollment.countDocuments({ pendingRequestType: "profile_update", profileUpdateRequestStatus: "pending" }),
      Enrollment.countDocuments({ profileDeleteRequestStatus: "pending" }),
    ]);

    res.status(200).json({
      totalDoctors,
      profileUpdateRequests: updateRequests,
      profileDeleteRequests: deleteRequests,
    });
  } catch (error) {
    console.error("getDoctorWorkflowStats error:", error);
    res.status(500).json({ msg: "Failed to fetch doctor workflow stats" });
  }
};

// GET /api/admin/doctor-payments — all paid appointments grouped with payout info
const getDoctorPayments = async (req, res) => {
  try {
    const appointments = await Appointment.find({
      paymentStatus: "paid",
    })
      .populate("patientId", "patientId name email")
      .populate("doctorId", "name email doctorId")
      .sort({ createdAt: -1 })
      .lean();

    const PLATFORM_RATE = 0.25;

    const result = appointments.map(a => {
      const consultationAmount = a.paymentAmount || 0;
      const platformFee = Math.round(consultationAmount * PLATFORM_RATE);
      const baseDoctorShare = Math.max(0, consultationAmount - platformFee);
      const hasOverride = Number.isFinite(Number(a.doctorPayoutOverrideAmount));
      const doctorShare = hasOverride
        ? Math.max(0, Math.round(Number(a.doctorPayoutOverrideAmount)))
        : baseDoctorShare;

      return {
        _id:               a._id,
        appointmentId:     a._id,
        doctorId:          a.doctorId,
        patientId:         a.patientId,
        date:              a.date,
        time:              a.time,
        consultationAmount,
        platformFee,
        baseDoctorPayable: baseDoctorShare,
        doctorPayable:     doctorShare,
        doctorPayoutOverrideAmount: hasOverride ? doctorShare : null,
        paymentStatus:     a.paymentStatus,
        doctorPayoutStatus: a.doctorPayoutStatus || "pending",
        doctorPayoutDate:  a.doctorPayoutDate,
        doctorPayoutRef:   a.doctorPayoutRef,
        paymentGateway:    a.paymentGateway || "stripe",
        paymentDate:       a.createdAt,
        transactionReference: a.paymentIntentId || "",
      };
    });

    if (result.length >= 100) {
      await recordSecurityIncident(req, {
        type: "large_data_export",
        severity: "medium",
        title: "Large doctor payment dataset accessed",
        resource: "Appointment",
        metadata: { count: result.length, endpoint: req.originalUrl },
      });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("getDoctorPayments error:", error);
    res.status(500).json({ msg: "Failed to fetch doctor payments" });
  }
};

// PUT /api/admin/doctor-payments/:id/mark-paid — superadmin marks a payout as paid
const markDoctorPayout = async (req, res) => {
  try {
    const { payoutRef } = req.body;
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      {
        doctorPayoutStatus: "paid",
        doctorPayoutDate:   new Date(),
        doctorPayoutRef:    payoutRef || "",
      },
      { returnDocument: 'after' }
    );
    if (!appointment) return res.status(404).json({ msg: "Appointment not found" });
    res.status(200).json({ msg: "Payout marked as paid", appointment });
  } catch (error) {
    console.error("markDoctorPayout error:", error);
    res.status(500).json({ msg: "Failed to update payout" });
  }
};

// PUT /api/admin/doctor-payments/:id — superadmin edits payout amount/ref
const editDoctorPayout = async (req, res) => {
  try {
    const { doctorPayoutStatus, doctorPayoutDate, doctorPayoutRef, doctorPayoutOverrideAmount } = req.body;
    const update = {};
    if (doctorPayoutStatus !== undefined) update.doctorPayoutStatus = doctorPayoutStatus;
    if (doctorPayoutDate   !== undefined) update.doctorPayoutDate   = doctorPayoutDate;
    if (doctorPayoutRef    !== undefined) update.doctorPayoutRef    = doctorPayoutRef;
    if (doctorPayoutOverrideAmount !== undefined) {
      if (doctorPayoutOverrideAmount === null || doctorPayoutOverrideAmount === "") {
        update.doctorPayoutOverrideAmount = null;
      } else {
        const parsed = Number(doctorPayoutOverrideAmount);
        if (!Number.isFinite(parsed) || parsed < 0) {
          return res.status(400).json({ msg: "Invalid payout override amount." });
        }
        update.doctorPayoutOverrideAmount = Math.round(parsed);
      }
    }

    const appointment = await Appointment.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' });
    if (!appointment) return res.status(404).json({ msg: "Appointment not found" });
    res.status(200).json({ msg: "Payout updated", appointment });
  } catch (error) {
    console.error("editDoctorPayout error:", error);
    res.status(500).json({ msg: "Failed to update payout" });
  }
};

// POST /api/admin/doctor-payments/:id/process-payout — process real payout via PayPal/Stripe
const processDoctorPayout = async (req, res) => {
  try {
    const { method } = req.body; // "paypal" or "stripe"
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ msg: "Appointment not found" });

    // Calculate payable (including overrides) from the same amount used by the admin ledger.
    const consultationAmount = Number(appointment.paymentAmount || 0);
    const platformFee = Math.round(consultationAmount * 0.25);
    const basePayable = consultationAmount - platformFee;
    const finalPayable = Number.isFinite(Number(appointment.doctorPayoutOverrideAmount))
      ? Number(appointment.doctorPayoutOverrideAmount)
      : basePayable;

    if (finalPayable <= 0) {
      return res.status(400).json({ msg: "Invalid payout amount (zero or negative)" });
    }

    const enrollment = await Enrollment.findOne({ doctorId: appointment.doctorId });
    if (!enrollment) return res.status(404).json({ msg: "Doctor enrollment not found" });

    let payoutRef = "";
    const amountVal = (finalPayable / 100).toFixed(2);

    if (method === "paypal") {
      const recipient = enrollment.paypalId || enrollment.payoutEmail;
      if (!recipient) return res.status(400).json({ msg: "Doctor has no PayPal ID or Payout Email" });

      const payload = {
        sender_batch_header: {
          sender_batch_id: `batch_${appointment._id}_${Date.now()}`,
          email_subject: "Doctor Consultation Payout",
          email_message: "You have received a payout for your consultation. Thank you!",
        },
        items: [{
          recipient_type: "EMAIL",
          amount: { value: amountVal, currency: enrollment.feeCurrency || "USD" },
          note: `Consultation payout for appointment ${appointment._id}`,
          sender_item_id: `item_${appointment._id}`,
          receiver: recipient,
        }],
      };

      const result = await paypalFetch("POST", "/v1/payments/payouts", payload);
      
      if (result.batch_header && result.batch_header.payout_batch_id) {
        payoutRef = result.batch_header.payout_batch_id;
      } else {
        console.error("PayPal Payout Error:", result);
        return res.status(500).json({ msg: "PayPal payout failed", error: result });
      }
    } 
    else if (method === "stripe") {
      const stripeId = enrollment.stripeAccountId;
      if (!stripeId) return res.status(400).json({ msg: "Doctor has no Stripe Account ID" });

      try {
        const transfer = await stripe.transfers.create({
          amount: finalPayable,
          currency: (enrollment.feeCurrency || "USD").toLowerCase(),
          destination: stripeId,
          description: `Payout for appointment ${appointment._id}`,
          metadata: { appointmentId: String(appointment._id) },
        });
        payoutRef = transfer.id;
      } catch (stErr) {
        console.error("Stripe Transfer Error:", stErr);
        return res.status(500).json({ msg: "Stripe transfer failed", error: stErr.message });
      }
    } 
    else {
      return res.status(400).json({ msg: "Unsupported payout method" });
    }

    appointment.doctorPayoutStatus = "paid";
    appointment.doctorPayoutDate = new Date();
    appointment.doctorPayoutRef = payoutRef;
    await appointment.save();

    res.status(200).json({ 
      msg: `Payout successfully processed via ${method.toUpperCase()}`, 
      payoutRef,
      appointment 
    });

  } catch (error) {
    console.error("processDoctorPayout error:", error);
    res.status(500).json({ msg: "Internal server error during payout processing" });
  }
};

// PUT /api/admin/doctors/:id — admin edits a doctor's enrollment record (all fields)
const updateDoctorByAdmin = async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id);
    if (!enrollment) return res.status(404).json({ msg: "Enrollment not found" });

    const {
      // Personal
      firstName, surname, email, countryCode, phoneNumber, gender, dob,
      // Location
      country, state, city, zip, address,
      // Professional
      specialization, subSpecialization, qualification, experience,
      medicalSchool, registrationYear, medicalCouncilName,
      medicalRegistrationNumber, medicalLicense, idProofType,
      consultationMode, consultantFees, feeCurrency,
      clinicName, clinicAddress, aboutDoctor,
      // Languages (array or CSV string)
      languagesKnown,
      licensedStates,
      internationalLicenses,
      // File URLs (uploaded separately by admin)
      profilePhoto, idProof, degreeFile, medicalLicenseFile, malpracticeInsuranceFile,
      // Payout
      bankName, accountNumber, accountHolderName, ifscCode,
      paypalId, payoutEmail, stripeAccountId,
      // Availability
      timezone, availability,
    } = req.body;

    const updates = {};
    const normalizedFileFields = {
      profilePhoto: profilePhoto === undefined || profilePhoto === "" ? profilePhoto : keyFromStoredValue(profilePhoto),
      idProof: idProof === undefined || idProof === "" ? idProof : keyFromStoredValue(idProof),
      degreeFile: degreeFile === undefined || degreeFile === "" ? degreeFile : keyFromStoredValue(degreeFile),
      medicalLicenseFile: medicalLicenseFile === undefined || medicalLicenseFile === "" ? medicalLicenseFile : keyFromStoredValue(medicalLicenseFile),
      malpracticeInsuranceFile: malpracticeInsuranceFile === undefined || malpracticeInsuranceFile === "" ? malpracticeInsuranceFile : keyFromStoredValue(malpracticeInsuranceFile),
    };

    // ── Scalar string fields ──────────────────────────────────────────
    const strings = {
      firstName, surname, email, countryCode, phoneNumber, gender, dob,
      country, state, city, zip, address,
      specialization, subSpecialization, qualification,
      medicalSchool, registrationYear, medicalCouncilName,
      medicalRegistrationNumber, medicalLicense, idProofType,
      consultationMode, feeCurrency,
      clinicName, clinicAddress, aboutDoctor,
      bankName, accountNumber, accountHolderName, ifscCode,
      paypalId, payoutEmail, stripeAccountId,
      // File URL strings
      ...normalizedFileFields,
      // Availability
      timezone,
    };
    Object.entries(strings).forEach(([k, v]) => { if (v !== undefined) updates[k] = v; });

    // ── Numeric fields ────────────────────────────────────────────────
    if (experience   !== undefined) updates.experience    = Number(experience)    || 0;
    if (consultantFees !== undefined) updates.consultantFees = Number(consultantFees) || 0;

    // ── Languages — accept array or comma-separated string ────────────
    if (languagesKnown !== undefined) {
      updates.languagesKnown = Array.isArray(languagesKnown)
        ? languagesKnown.filter(Boolean)
        : String(languagesKnown).split(",").map(l => l.trim()).filter(Boolean);
    }

    if (licensedStates !== undefined) {
      updates.licensedStates = Array.isArray(licensedStates)
        ? licensedStates.filter(Boolean)
        : String(licensedStates).split(",").map(s => s.trim()).filter(Boolean);
    }

    if (internationalLicenses !== undefined) {
      updates.internationalLicenses = Array.isArray(internationalLicenses)
        ? internationalLicenses.filter(Boolean)
        : String(internationalLicenses).split(",").map(s => s.trim()).filter(Boolean);
    }

    // ── Availability (Mixed) ──────────────────────────────────────────
    if (availability !== undefined && typeof availability === "object") {
      updates.availability = availability;
    }

    // ── Derived boolean flags ─────────────────────────────────────────
    if (profilePhoto !== undefined) {
      updates.hasProfilePhoto = !!normalizedFileFields.profilePhoto;
    }
    if (degreeFile !== undefined || medicalLicenseFile !== undefined) {
      const cert = (degreeFile !== undefined ? normalizedFileFields.degreeFile : enrollment.degreeFile) ||
                   (medicalLicenseFile !== undefined ? normalizedFileFields.medicalLicenseFile : enrollment.medicalLicenseFile);
      updates.hasCertification = !!cert;
    }

    updates.updatedAt = new Date();

    enrollment.set(updates);
    enrollment.markModified("languagesKnown");
    if (licensedStates !== undefined) enrollment.markModified("licensedStates");
    if (internationalLicenses !== undefined) enrollment.markModified("internationalLicenses");
    if (availability !== undefined) enrollment.markModified("availability");
    const syncedApprovalStatus = approvalStatusFromApplicationStatus(enrollment.applicationStatus);
    if (syncedApprovalStatus) {
      enrollment.approvalStatus = syncedApprovalStatus;
      enrollment.verified = syncedApprovalStatus === "approved";
      if (syncedApprovalStatus === "approved") {
        enrollment.formCompleted = true;
        enrollment.completedSteps = 5;
        enrollment.currentStep = 5;
        enrollment.currentStepLabel = STEP_LABELS[4];
        enrollment.pendingRequestType = "none";
        enrollment.profileUpdateRequestedAt = undefined;
        enrollment.profileUpdateReviewedAt = undefined;
        enrollment.profileUpdateRequestStatus = "none";
        enrollment.pendingProfileChanges = [];
        enrollment.profileUpdateSnapshot = undefined;
        enrollment.markModified("pendingProfileChanges");
        enrollment.markModified("profileUpdateSnapshot");
      }
    }
    enrollment.applicationStatus = deriveApplicationStatus(enrollment);
    await enrollment.save();

    if (enrollment.doctorId && ["approved", "rejected"].includes(enrollment.approvalStatus)) {
      await Doctor.findByIdAndUpdate(enrollment.doctorId, { isEnrolled: enrollment.approvalStatus === "approved" });
    }

    return res.status(200).json({
      msg: "Doctor profile updated successfully.",
      enrollment: normalizeEnrollmentWorkflow(enrollment.toObject()),
    });
  } catch (error) {
    console.error("updateDoctorByAdmin error:", error);
    return res.status(500).json({ msg: "Failed to update doctor profile." });
  }
};

const getDoctorDocumentAccessUrl = async (req, res) => {
  try {
    const { id, field } = req.params;
    if (!DOCTOR_DOCUMENT_FIELDS.has(field)) {
      return res.status(400).json({ msg: "Invalid document field." });
    }

    const enrollment = await Enrollment.findById(id).select(`${field} doctorId email firstName surname`).lean();
    if (!enrollment) return res.status(404).json({ msg: "Enrollment not found" });

    const key = keyFromStoredValue(enrollment[field]);
    if (!key) return res.status(404).json({ msg: "Document not uploaded." });

    const signed = await createS3PresignedGetUrl(key, { expiresIn: DEFAULT_EXPIRY_SECONDS });
    await logAudit(req, {
      action: "ADMIN_DOCUMENT_ACCESS_URL_CREATED",
      resource: "DoctorDocument",
      resourceId: id,
      userId: req.user?.id,
      userEmail: req.user?.email || "",
      userRole: req.user?.role || "admin",
      details: { field, key, expiresIn: signed.expiresIn },
    });

    return res.json({
      field,
      key,
      url: signed.url,
      expiresIn: signed.expiresIn,
      expiresAt: signed.expiresAt,
    });
  } catch (error) {
    if (error.name === "CastError") return res.status(404).json({ msg: "Enrollment not found" });
    console.error("getDoctorDocumentAccessUrl error:", error);
    return res.status(500).json({ msg: "Could not generate document access URL." });
  }
};

const getDoctorById = async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id)
      .populate("doctorId", "name email doctorId isEnrolled")
      .lean();
    if (!enrollment) return res.status(404).json({ msg: "Enrollment not found" });
    res.status(200).json(normalizeEnrollmentWorkflow(enrollment));
  } catch (error) {
    if (error.name === "CastError") return res.status(404).json({ msg: "Enrollment not found" });
    console.error("getDoctorById error:", error);
    res.status(500).json({ msg: "Failed to fetch doctor" });
  }
};

module.exports = {
  getAdminStats,
  getAllDoctors,
  getDoctorById,
  getDoctorDocumentAccessUrl,
  updateDoctorByAdmin,
  approveDoctor,
  rejectDoctor,
  approveDoctorDeleteRequest,
  rejectDoctorDeleteRequest,
  getAllUsers,
  deleteUser,
  getUserDetails,
  forceLogoutUser,
  disableUser,
  migrateDoctorIds,
  getApprovedDoctors,
  getDoctorWorkflowStats,
  getDoctorPayments,
  markDoctorPayout,
  editDoctorPayout,
  processDoctorPayout,
};

