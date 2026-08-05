const CategoryConsultation = require("../models/CategoryConsultation");

const Enrollment = require("../models/Enrollment");
const { keyFromStoredValue } = require("../utils/uploadStorage");
const { createS3PresignedGetUrl } = require("../utils/s3PresignedUrl");
const {
  PaymentVerificationError,
  resolveCategoryFeeCents,
  resolveServiceFeeCents,
  verifyStripePaymentIntent,
  verifyPaypalOrder,
  claimPaymentOnce,
} = require("../utils/paymentVerification");

async function withPresignedMedicalReportUrls(consultation) {
  if (!consultation) return consultation;

  const plainConsultation =
    typeof consultation.toObject === "function"
      ? consultation.toObject()
      : consultation;
  const reports = Array.isArray(plainConsultation.medicalReports)
    ? plainConsultation.medicalReports
    : [];

  if (!reports.length) return plainConsultation;

  const medicalReports = await Promise.all(
    reports.map(async (report) => {
      const key = keyFromStoredValue(report?.key || report?.url);
      if (!key) return report;

      const signed = await createS3PresignedGetUrl(key);
      // Only the short-lived presigned URL is returned to clients — a raw
      // getS3ObjectUrl() would be a permanent, unauthenticated link to a PHI
      // document (medical report) that keeps working even if the bucket's
      // ACL is ever loosened, unlike a presigned URL which expires.
      return {
        ...report,
        url: signed.url,
        urlExpiresAt: signed.expiresAt,
      };
    })
  );

  return {
    ...plainConsultation,
    medicalReports,
  };
}


// Create a new consultation
const createCategoryConsultation = async (req, res) => {
  try {
    // Derived server-side (not trusted from the client) so a stale/tampered
    // payload can't claim a slot for a "next available" booking or vice versa.
    const appointmentType =
      req.body.urgency === "flexible" ? "FLEXIBLE_TIME" : "NEXT_AVAILABLE";
    const isFlexible = appointmentType === "FLEXIBLE_TIME";

    const { paymentIntentId, paypalOrderId, serviceName, categoryName } = req.body;

    // Payment validation
    if (!paymentIntentId && !paypalOrderId) {
      return res.status(400).json({
        success: false,
        message: "Payment is required to submit a consultation request.",
      });
    }

    let paymentRef = "";
    let paymentGateway = "";
    let paymentAmountFinal = 0;
    let paymentStatus = "unpaid";

    try {
      // The charged amount must match the real price of the service/category
      // being booked — resolved server-side, never trusted from the client.
      // Fail closed if neither identifies a known priced item.
      const expectedCents = serviceName
        ? await resolveServiceFeeCents(serviceName)
        : await resolveCategoryFeeCents(categoryName);
      if (!Number.isFinite(expectedCents) || expectedCents <= 0) {
        return res.status(400).json({
          success: false,
          message: "Unrecognized service/category. Please reselect and try again.",
        });
      }

      const verified = paymentIntentId
        ? await verifyStripePaymentIntent({ paymentIntentId, expectedCents })
        : await verifyPaypalOrder({ paypalOrderId, expectedCents });

      paymentRef = verified.ref;
      paymentGateway = verified.gateway;
      paymentAmountFinal = verified.amountCents;
      paymentStatus = "paid";

      // Marks this payment as spent so the same reference can't fund a
      // second consultation/appointment.
      await claimPaymentOnce({
        gateway: paymentGateway,
        ref: paymentRef,
        consumedFor: "categoryConsultation",
        patientId: req.user.id,
      });
    } catch (err) {
      if (err instanceof PaymentVerificationError) {
        return res.status(err.status).json({ success: false, message: err.message });
      }
      throw err;
    }

    let consultation;
    try {
      consultation = await CategoryConsultation.create({
        concern: req.body.concern,
        duration: req.body.duration,
        severity: req.body.severity,
        supportType: req.body.supportType,
        urgency: req.body.urgency,
        appointmentType,
        timeWindow: isFlexible ? req.body.timeWindow : "",
        slot: isFlexible ? req.body.slot : null,
        date: req.body.date,
        patientId: req.user.id,
        medicalReports: req.body.medicalReports,
        consultationPrice: paymentAmountFinal / 100,
        categoryName: req.body.categoryName,
        specialtyName: req.body.specialtyName,
        conditionName: req.body.conditionName,
        serviceName: req.body.serviceName,
        pcpName: req.body.pcpName,
        paymentIntentId: paymentRef,
        paymentAmount: paymentAmountFinal,
        paymentStatus,
        paymentGateway,
      });
    } catch (err) {
      // Payment was already claimed above (money was taken) but the write
      // failed after that — surface a reconciliation reference instead of a
      // generic error, matching the same pattern used for doctor bookings.
      console.error(
        `[CRITICAL] Payment succeeded (${paymentGateway}:${paymentRef}, amount=${paymentAmountFinal}) ` +
          `but consultation creation failed for patient ${req.user?.id}. Needs manual reconciliation.`,
      );
      return res.status(500).json({
        success: false,
        message: "Your payment was received, but we couldn't finalize the request due to a server error. " +
          "Please contact support with this reference so we can resolve it immediately.",
        paymentReference: paymentRef,
        paymentGateway,
      });
    }

    res.status(201).json({
      success: true,
      message: "Consultation submitted successfully.",
      data: consultation,
    });
  } catch (error) {
    console.error("Create Consultation Error:", error);

    res.status(500).json({
      success: false,
      message: "Something went wrong.",
      error: error.message,
    });
  }
};

// Get all consultations (admin)
const getAllCategoryConsultations = async (req, res) => {
  try {
    const consultations = await CategoryConsultation.find()
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: consultations.length,
      data: consultations,
    });
  } catch (error) {
    console.error("Get Consultation Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch consultations.",
      error: error.message,
    });
  }
};

// Get consultations belonging to the logged-in patient
// Mirrors the shape /api/appointments/mine returns so the frontend
// Appointments.jsx tab logic can treat both lists the same way.
const getMyCategoryConsultations = async (req, res) => {
  try {
    const consultations = await CategoryConsultation.find({
      patientId: req.user.id,
    })
      .populate(
        "assignedDoctorId",
        "firstName surname email specialization city country"
      )
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: consultations.length,
      data: consultations,
    });
  } catch (error) {
    console.error("Get My Consultations Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch your consultations.",
      error: error.message,
    });
  }
};

// Get consultations assigned to the logged-in doctor
//
// IMPORTANT: req.user.id (from the doctorToken JWT) is a Doctor._id, but
// CategoryConsultation.assignedDoctorId stores an Enrollment._id (assignDoctor()
// looks doctors up via Enrollment.findById). Enrollment has its own _id and
// merely *points at* a Doctor via enrollment.doctorId — the two ids are never
// the same value. So we must resolve Doctor._id -> Enrollment._id first,
// then filter consultations by that Enrollment _id.
const getDoctorCategoryConsultations = async (req, res) => {
  try {
    const enrollment = await Enrollment.findOne({ doctorId: req.user.id }).select("_id");

    if (!enrollment) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    const consultations = await CategoryConsultation.find({
      assignedDoctorId: enrollment._id,
    })
      .populate("patientId", "name email mobile gender country dob")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: consultations.length,
      data: consultations,
    });
  } catch (error) {
    console.error("Get Doctor Consultations Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch assigned consultations.",
      error: error.message,
    });
  }
};

// Get Single Consultation
const getCategoryConsultationById = async (req, res) => {
  try {
    const consultation = await CategoryConsultation.findById(req.params.id)
      .populate(
        "patientId",
        "name email mobile gender country dob"
      )
      .populate(
        "assignedDoctorId",
        "firstName surname email phoneNumber specialization qualification city state country"
      );

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: "Consultation not found",
      });
    }

    res.json({
      success: true,
      data: await withPresignedMedicalReportUrls(consultation),
    });
  } catch (error) {
    console.error("GET CATEGORY CONSULTATION ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Update Consultation Status
const updateCategoryConsultationStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const consultation = await CategoryConsultation.findById(req.params.id);

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: "Consultation not found",
      });
    }

    consultation.status = status;

    await consultation.save();

    res.json({
      success: true,
      message: "Status updated successfully",
      data: consultation,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// Delete Consultation
const deleteCategoryConsultation = async (req, res) => {
  try {
    const consultation = await CategoryConsultation.findById(req.params.id);

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: "Consultation not found",
      });
    }

    await consultation.deleteOne();

    res.json({
      success: true,
      message: "Consultation deleted successfully",
    });
  } catch (error) {
    console.error("Delete Consultation Error:", error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

const assignDoctor = async (req, res) => {
  try {
    const { doctorId, appointmentTime } = req.body;

    if (!doctorId) {
      return res.status(400).json({
        success: false,
        message: "Doctor ID is required",
      });
    }

    // Peek at appointmentType (read-only) to decide whether to stamp
    // assignedSlot — this doesn't mutate anything, so it's safe outside
    // the atomic update below. Checked first to preserve the original
    // "Consultation not found" vs "Doctor not found" precedence.
    const existing = await CategoryConsultation.findById(req.params.id)
      .select("appointmentType")
      .lean();

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Consultation not found",
      });
    }

    const doctor = await Enrollment.findById(doctorId);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    const update = {
      assignedDoctorId: doctor._id,
      assignedDoctorName: `${doctor.firstName} ${doctor.surname}`.trim(),
      assignedAt: new Date(),
      status: "Assigned",
    };

    // NEXT_AVAILABLE bookings have no patient-chosen slot, so the admin
    // supplies the actual appointment time being assigned here. Ignored for
    // FLEXIBLE_TIME bookings, which already have their slot set.
    if (existing.appointmentType === "NEXT_AVAILABLE" && appointmentTime) {
      update.assignedSlot = appointmentTime;
    }

    // Atomic $set-by-_id instead of the previous find → mutate 4 fields on
    // the in-memory document → .save() pattern. .save() on a Mongoose
    // document re-persists the whole document as it was loaded, so if
    // another request (e.g. a payment webhook, or another admin) changed an
    // unrelated field in between, that concurrent change could be silently
    // clobbered. Scoping the write to $set on just these fields removes
    // that lost-update window while still allowing intentional reassignment
    // (the UI explicitly supports assigning a different doctor later).
    const consultation = await CategoryConsultation.findOneAndUpdate(
      { _id: req.params.id },
      { $set: update },
      { new: true }
    );

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: "Consultation not found",
      });
    }

    res.json({
      success: true,
      message: "Doctor assigned successfully",
      data: consultation,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

module.exports = {
  createCategoryConsultation,
  getAllCategoryConsultations,
  getMyCategoryConsultations,
  getDoctorCategoryConsultations,
  getCategoryConsultationById,
  updateCategoryConsultationStatus,
  deleteCategoryConsultation,
  assignDoctor,
};
