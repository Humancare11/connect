const CategoryConsultation = require("../models/CategoryConsultation");

const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const {
  PaymentVerificationError,
  verifyCategoryPayment,
  verifyServicePayment,
  claimPaymentOnce,
} = require("../utils/paymentVerification");
const { recordPaymentAndInvoice } = require("../utils/billing");
const { notifyCategoryConsultationBooked } = require("../utils/bookingNotifications");
const { bookingSourceFor } = require("../utils/bookingSource");

// Create a new consultation
const createCategoryConsultation = async (req, res) => {
  try {
    // Derived server-side (not trusted from the client) so a stale/tampered
    // payload can't claim a slot for a "next available" booking or vice versa.
    const appointmentType =
      req.body.urgency === "flexible" ? "FLEXIBLE_TIME" : "NEXT_AVAILABLE";
    const isFlexible = appointmentType === "FLEXIBLE_TIME";

    const {
      paymentIntentId,
      paypalOrderId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      serviceName,
      categoryName,
      categoryId,
    } = req.body;

    // Payment validation
    if (!paymentIntentId && !paypalOrderId && !razorpayPaymentId && !razorpayOrderId) {
      return res.status(400).json({
        success: false,
        message: "Payment is required to submit a consultation request.",
      });
    }

    let paymentRef = "";
    let paymentGateway = "";
    // Razorpay only (INR category bookings): the order and payment ids of the verified payment.
    let paymentRazorpayOrderId = "";
    let paymentRazorpayPaymentId = "";
    let paymentAmountFinal = 0;
    // Currency of paymentAmountFinal, as verified with the gateway (lower-case).
    let paymentCurrency = "usd";
    let paymentStatus = "unpaid";

    try {
      // The charged amount must match the real price of the service/category
      // being booked — resolved server-side, never trusted from the client.
      // Fail closed if neither identifies a known priced item.
      //
      // requireActive:false — the Stripe/PayPal payment for this booking was
      // already created (and, by the time the client calls this endpoint,
      // already charged) against whatever the category's price was back
      // then. Re-requiring isActive here would let an admin deactivating or
      // renaming the category *after* the charge went through turn an
      // already-paid booking into an orphaned charge with no way to
      // complete it. categoryId (the stable pricingSlug/_id, when the
      // client sends one) is preferred over categoryName so a rename in
      // that window can't break the lookup either.
      //
      // A service (verifyServicePayment) and a category (verifyCategoryPayment) are checked the same way: the payment's own
      // currency (USD / EUR / GBP, or INR through Razorpay) against the stored price in that currency - no conversion.
      const unrecognized = "Unrecognized service/category. Please reselect and try again.";
      let verified;
      if (serviceName) {
        // Priced in the currency the payment was taken in (USD / EUR / GBP, or INR through Razorpay); verifyServicePayment checks the
        // amount against the service's stored price in that currency (no conversion), the gateway, and that it is this user's payment.
        verified = await verifyServicePayment({
          paymentIntentId,
          paypalOrderId,
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature,
          patientId: req.user.id,
          priceRef: serviceName,
          unrecognizedMessage: unrecognized,
        });
      } else {
        verified = await verifyCategoryPayment({
          paymentIntentId,
          paypalOrderId,
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature,
          patientId: req.user.id,
          priceRef: categoryId || categoryName,
          requireActive: false,
          unrecognizedMessage: unrecognized,
        });
      }

      paymentRef = verified.ref;
      paymentGateway = verified.gateway;
      paymentRazorpayOrderId = verified.razorpayOrderId || "";
      paymentRazorpayPaymentId = verified.razorpayPaymentId || "";
      paymentAmountFinal = verified.amountCents;
      paymentCurrency = String(verified.currency || "USD").toLowerCase();
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
        paymentCurrency,
        paymentStatus,
        paymentGateway,
        razorpayOrderId: paymentRazorpayOrderId,
        razorpayPaymentId: paymentRazorpayPaymentId,
        source: bookingSourceFor(req),
      });
    } catch (err) {
      // Payment was already claimed above (money was taken) but the write
      // failed after that — surface a reconciliation reference instead of a
      // generic error, matching the same pattern used for doctor bookings.
      console.error(
        `[CRITICAL] Payment succeeded (${paymentGateway}:${paymentRef}, amount=${paymentAmountFinal} ${paymentCurrency}) ` +
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

    // Fire-and-forget: admin "new booking" email. Never throws or rejects.
    notifyCategoryConsultationBooked({ consultation });

    // Fire-and-forget: see the matching comment in appointmentController.js —
    // the booking + payment already succeeded, so a ledger/invoice failure
    // here must never surface as a request failure to the patient.
    if (paymentStatus === "paid" && paymentRef) {
      User.findById(req.user.id).select("name email").lean()
        .then((patient) =>
          recordPaymentAndInvoice({
            userId: req.user.id,
            userName: patient?.name,
            userEmail: patient?.email,
            categoryConsultationId: consultation._id,
            gateway: paymentGateway,
            gatewayReference: paymentRef,
            razorpayOrderId: paymentRazorpayOrderId,
            razorpayPaymentId: paymentRazorpayPaymentId,
            amountCents: paymentAmountFinal,
            currency: paymentCurrency,
            description: `${req.body.categoryName || req.body.serviceName || "Category"} consultation booking`,
          })
        )
        .catch((err) => {
          console.error(`[invoice] Failed to record payment/invoice for consultation ${consultation._id}:`, err.message);
        });
    }
  } catch (error) {
    console.error("Create Consultation Error:", error);

    res.status(500).json({
      success: false,
      message: "Something went wrong.",
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

module.exports = {
  createCategoryConsultation,
  getMyCategoryConsultations,
  getDoctorCategoryConsultations,
};
