const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const CategoryConsultation = require("../models/CategoryConsultation");
const mongoose = require("mongoose");
const { sendEmail } = require("../utils/sendEmail");
const { keyFromStoredValue } = require("../utils/uploadStorage");
const { getS3ObjectUrl } = require("../config/s3");
const { createS3PresignedGetUrl } = require("../utils/s3PresignedUrl");
const { sendPushToUser } = require("../utils/pushNotifications");
const {
  PaymentVerificationError,
  resolveDoctorFeeCents,
  logOrphanedPayment,
  resolveCategoryFeeCents,
  verifyStripePaymentIntent,
  verifyPaypalOrder,
  claimPaymentOnce,
} = require("../utils/paymentVerification");
const { recordPaymentAndInvoice } = require("../utils/billing");
const {
  LifecycleError,
  isCompleteStatus,
  loadAppointmentAny,
  doctorUserIdOf,
  completeLoaded,
  reopenLoaded,
} = require("../utils/appointmentLifecycle");
const { notifyAppointmentBooked } = require("../utils/bookingNotifications");

const ACTIVE_DOCTOR_STATUSES = ["assigned", "pending", "confirmed"];

function normalizeMedicalReports(reports) {
  if (!Array.isArray(reports)) return [];
  return reports
    .map((report) => {
      const key = keyFromStoredValue(report?.key || report?.url);
      if (!key) return null;
      return {
        url: getS3ObjectUrl(key),
        name: String(report?.name || key.split("/").pop() || "Medical report").slice(0, 180),
        type: String(report?.type || "").slice(0, 120),
        size: Number(report?.size) || 0,
      };
    })
    .filter(Boolean);
}

async function withPresignedMedicalReportUrls(appointment) {
  if (!appointment) return appointment;
  const reports = Array.isArray(appointment.medicalReports) ? appointment.medicalReports : [];
  if (!reports.length) return appointment;

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

  return { ...appointment, medicalReports };
}

async function withPresignedMedicalReports(appointments) {
  return Promise.all(appointments.map(withPresignedMedicalReportUrls));
}

async function resolveDoctorId(value) {
  if (!value) return null;

  const numericId = Number(value);
  if (Number.isInteger(numericId)) {
    const doctor = await Doctor.findOne({ doctorId: numericId }).select("_id").lean();
    if (doctor?._id) return doctor._id;
  }

  if (mongoose.isValidObjectId(value)) {
    const enrollment = await Enrollment.findById(value).select("doctorId").lean();
    if (enrollment?.doctorId) return enrollment.doctorId;
    return value;
  }

  return null;
}

function timeToMinutes(value) {
  if (!value || typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

// Convert a date + time string (in the patient's local timezone) to a UTC Date.
// Uses the Intl API so DST and non-integer offsets (e.g. IST +5:30) are handled correctly.
// Falls back to treating the time as UTC when the timezone is unknown/invalid.
function buildUtcDateTime(date, time, timezone) {
  if (!date || !time) return null;
  const minutes = timeToMinutes(time);
  if (minutes === null) return null;
  const hours = Math.floor(minutes / 60);
  const mins  = minutes % 60;

  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return null;

  if (timezone) {
    try {
      // Create a UTC epoch at the same clock values as the desired local time.
      const utcEstimate = new Date(Date.UTC(year, month - 1, day, hours, mins, 0, 0));

      // Format that UTC instant in the patient's timezone to see what local clock it shows.
      const localStr = utcEstimate.toLocaleString("en-US", {
        timeZone: timezone,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false,
      });

      // Parse the local clock back as if it were UTC to get the raw millisecond offset.
      const localAsUtc = new Date(localStr + " UTC");
      if (Number.isNaN(localAsUtc.getTime())) throw new Error("parse failed");

      // offsetMs = how far ahead/behind the timezone is from UTC.
      // actual UTC = utcEstimate + offsetMs
      const offsetMs = utcEstimate.getTime() - localAsUtc.getTime();
      return new Date(utcEstimate.getTime() + offsetMs);
    } catch {
      // Fall through to UTC fallback below.
    }
  }

  // Fallback: treat the time as UTC (legacy behaviour, no timezone info available).
  return new Date(Date.UTC(year, month - 1, day, hours, mins, 0, 0));
}

const createAppointment = async (req, res) => {
  // Hoisted so the catch block can tell whether payment already succeeded
  // before the booking failed (needed to give the patient/support a safe,
  // reconcilable error instead of silently losing their payment).
  let paymentRef = "";
  let paymentGateway = "";
  let paymentAmountFinal = 0;
  let paymentStatus = "unpaid";
  let paymentDescription = "";

  const session = await mongoose.startSession();
  try {
    const {
      doctorId,
      date,
      time,
      problem,
      medicalReports,
      paymentIntentId,
      paypalOrderId,
      category,
      categoryId,
      specialty,
      condition,
      consultationPrice,
      patientDetails,
      appointmentDateTimeUtc,
      patientTimezone,
    } = req.body;
    const patientId = req.user.id;

    // ── Input validation ──────────────────────────────────────────────────────
    if (!date || !time) {
      return res.status(400).json({ msg: "Date and time are required." });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ msg: "date must be in YYYY-MM-DD format." });
    }
    if (timeToMinutes(time) === null) {
      return res.status(400).json({ msg: "time must be HH:MM or H:MM AM/PM format." });
    }
    if (!doctorId && (!category || !specialty || !condition)) {
      return res.status(400).json({ msg: "Category, specialty, and condition are required." });
    }

    const today = new Date().toISOString().slice(0, 10);
    if (date < today) {
      return res.status(400).json({ msg: "Cannot book an appointment in the past." });
    }
    if (date === today) {
      const now = new Date();
      const selectedMinutes = timeToMinutes(time);
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      if (selectedMinutes !== null && selectedMinutes <= nowMinutes) {
        return res.status(400).json({ msg: "Please choose a future time for today's appointment." });
      }
    }

    // Resolve the canonical UTC instant up front (before any conflict check) so
    // doctor-availability conflicts are detected by actual UTC instant rather
    // than by comparing the patient-local date/time strings, which can miss
    // same-slot conflicts across timezones (e.g. 11PM PST === 2AM EST next day).
    const safeTimezone = typeof patientTimezone === "string" ? patientTimezone.slice(0, 80) : "";
    let resolvedUtc = null;
    if (appointmentDateTimeUtc) {
      const d = new Date(appointmentDateTimeUtc);
      if (!Number.isNaN(d.getTime())) resolvedUtc = d;
    }
    if (!resolvedUtc) {
      resolvedUtc = buildUtcDateTime(date, time, safeTimezone);
    }

    let resolvedDoctorId = null;
    let bookedDoctor = null;

    if (doctorId) {
      if (!paymentIntentId && !paypalOrderId) {
        return res.status(400).json({ msg: "Payment is required to book an appointment." });
      }

      // Resolve + validate the doctor before touching Stripe/PayPal, so an
      // invalid doctorId fails fast without an extra external API call.
      resolvedDoctorId = await resolveDoctorId(doctorId);
      const doctor = resolvedDoctorId ? await Doctor.findById(resolvedDoctorId) : null;
      if (!doctor) {
        return res.status(404).json({ msg: "Doctor not found." });
      }
      bookedDoctor = doctor;

      // The charged amount must match this doctor's real fee — never trust
      // whatever amount happens to be on the payment reference the client
      // sends, otherwise a patient could pay for a $1 booking elsewhere and
      // reuse that reference here. See PaymentVerificationError below.
      let expectedCents;
      try {
        expectedCents = await resolveDoctorFeeCents(resolvedDoctorId);
      } catch (feeErr) {
        // The client already holds a payment reference at this point, so if the
        // fee is unusable the patient may have been charged: flag it for refund.
        await logOrphanedPayment({
          reason: feeErr.message,
          paymentIntentId,
          paypalOrderId,
          doctorId: String(resolvedDoctorId),
          patientId,
        });
        throw feeErr;
      }
      const verified = paymentIntentId
        ? await verifyStripePaymentIntent({ paymentIntentId, expectedCents })
        : await verifyPaypalOrder({ paypalOrderId, expectedCents });

      paymentRef = verified.ref;
      paymentGateway = verified.gateway;
      paymentAmountFinal = verified.amountCents;
      paymentStatus = "paid";
      paymentDescription = `Consultation with Dr. ${doctor.name}`;

      // Note: the authoritative conflict check happens inside the transaction
      // below (right before creation) so it can't race against a concurrent
      // booking for the same slot. This early check is just a fast-path to
      // avoid making the patient wait for the transaction on the common case.
      const earlyConflict = await Appointment.findOne({
        doctorId: resolvedDoctorId,
        status: { $in: ACTIVE_DOCTOR_STATUSES },
        $or: [{ appointmentDateTimeUtc: resolvedUtc }, { date, time }],
      }).select("_id").lean();
      if (earlyConflict) {
        return res.status(409).json({ msg: "This time slot is already booked. Please choose a different time." });
      }
    }

    // Category-based booking (no specific doctor) — payment required
    if (!resolvedDoctorId) {
      if (!paymentIntentId && !paypalOrderId) {
        return res.status(400).json({ msg: "Payment is required to submit an appointment request." });
      }

      // Fail closed: if the category doesn't resolve to a known, priced
      // category, reject rather than silently skipping the amount check
      // (an unresolved category must not become a way to bypass it).
      //
      // requireActive:false + preferring categoryId (stable pricingSlug/_id)
      // over the display name — see the matching comment in
      // CategoryConsultationController.js: this runs after the patient has
      // already been charged, so an admin deactivating/renaming the
      // category in the meantime must not strand that payment.
      const expectedCents = await resolveCategoryFeeCents(categoryId || category, { requireActive: false });
      if (!Number.isFinite(expectedCents) || expectedCents <= 0) {
        return res.status(400).json({ msg: "Unrecognized category. Please reselect and try again." });
      }

      const verified = paymentIntentId
        ? await verifyStripePaymentIntent({ paymentIntentId, expectedCents })
        : await verifyPaypalOrder({ paypalOrderId, expectedCents });

      paymentRef = verified.ref;
      paymentGateway = verified.gateway;
      paymentAmountFinal = verified.amountCents;
      paymentStatus = "paid";
      paymentDescription = `${category || "Category"} consultation booking`;
    }

    const bookedAt = new Date();
    const patient = await User.findById(patientId)
      .select("name email mobile dob gender country city patientId")
      .lean();
    const safePatientDetails = {
      ...(patientDetails || {}),
      email: patientDetails?.email || patient?.email || "",
      phone: patientDetails?.phone || patient?.mobile || "",
      dob: patientDetails?.dob || patient?.dob || "",
      gender: patientDetails?.gender || patient?.gender || "",
    };

    // ── Payment (Stripe/PayPal) is already verified above, outside the
    // transaction — external API calls must never live inside a DB
    // transaction. Everything from here on is a DB write, so the
    // definitive conflict re-check + insert are wrapped in a transaction:
    // this closes the race window where two concurrent requests could both
    // pass the conflict check and double-book the same doctor slot.
    let appointment;
    await session.withTransaction(async () => {
      if (resolvedDoctorId) {
        const conflict = await Appointment.findOne({
          doctorId: resolvedDoctorId,
          status: { $in: ACTIVE_DOCTOR_STATUSES },
          $or: [{ appointmentDateTimeUtc: resolvedUtc }, { date, time }],
        })
          .select("_id")
          .session(session);
        if (conflict) {
          const slotTakenError = new Error("SLOT_TAKEN");
          slotTakenError.code = "SLOT_TAKEN";
          throw slotTakenError;
        }
      }

      // Marks this payment as spent — if it was already used for another
      // booking, this throws and the whole transaction (including the
      // conflict check above) rolls back, so nothing is created twice.
      const appointmentId = new mongoose.Types.ObjectId();
      await claimPaymentOnce({
        gateway: paymentGateway,
        ref: paymentRef,
        consumedFor: "appointment",
        resourceId: appointmentId,
        patientId,
        session,
      });

      const created = await Appointment.create(
        [
          {
            _id: appointmentId,
            patientId,
            doctorId: resolvedDoctorId,
            date,
            time,
            appointmentDateTimeUtc: resolvedUtc,
            bookedAt,
            patientTimezone: safeTimezone,
            problem,
            category,
            specialty,
            condition,
            consultationPrice: Number(consultationPrice) || 0,
            patientDetails: safePatientDetails,
            medicalReports: normalizeMedicalReports(medicalReports),
            status: resolvedDoctorId ? "pending" : "upcoming",
            paymentIntentId: paymentRef,
            paymentAmount: paymentAmountFinal,
            paymentStatus,
            paymentGateway,
          },
        ],
        { session }
      );
      appointment = created[0];
    });

    const io = req.app.get("io");
    if (io) {
      if (resolvedDoctorId) {
        io.to(`doctor_${resolvedDoctorId}`).emit("new-appointment", {
          appointmentId: appointment._id,
          patientId,
          doctorId: resolvedDoctorId,
          status: appointment.status,
          date,
          time,
        });
      }
      io.to("admin_room").emit("new-appointment", {
        appointmentId: appointment._id,
        patientId,
        doctorId: resolvedDoctorId,
        status: appointment.status,
        date,
        time,
      });
      io.to(`patient_${patientId}`).emit("appointment-updated", {
        appointmentId: appointment._id,
        status: appointment.status,
        date,
        time,
      });
    }

    res.status(201).json({
      msg: resolvedDoctorId ? "Appointment booked successfully." : "Appointment request submitted successfully.",
      appointment,
    });

    // Fire-and-forget: notify admins (and the booked doctor, if any). Never
    // throws or rejects, and never delays the response sent above.
    notifyAppointmentBooked({ appointment, patient, doctor: bookedDoctor });

    // Fire-and-forget: ledgering the payment and generating/emailing its
    // invoice must never block or fail the booking response — the booking
    // and the payment have already succeeded by this point. recordPaymentAndInvoice
    // is an async function, so any internal failure becomes a rejected
    // promise here (never a synchronous throw), which .catch() absorbs.
    if (paymentStatus === "paid" && paymentRef) {
      recordPaymentAndInvoice({
        userId: patientId,
        userName: patient?.name || safePatientDetails.firstName,
        userEmail: patient?.email || safePatientDetails.email,
        appointmentId: appointment._id,
        gateway: paymentGateway,
        gatewayReference: paymentRef,
        amountCents: paymentAmountFinal,
        currency: "usd",
        description: paymentDescription,
      }).catch((err) => {
        console.error(`[invoice] Failed to record payment/invoice for appointment ${appointment._id}:`, err.message);
      });
    }
  } catch (error) {
    if (error?.code === "SLOT_TAKEN") {
      return res.status(409).json({ msg: "This time slot is already booked. Please choose a different time." });
    }

    if (error instanceof PaymentVerificationError) {
      return res.status(error.status).json({ msg: error.message });
    }

    console.error("createAppointment error:", error);

    // Payment already succeeded (money was taken) but the booking write failed
    // after that — never show a generic error here, since the patient needs a
    // reference to get this reconciled instead of silently losing their payment.
    if (paymentStatus === "paid" && paymentRef) {
      console.error(
        `[CRITICAL] Payment succeeded (${paymentGateway}:${paymentRef}, amount=${paymentAmountFinal}) ` +
          `but appointment creation failed for patient ${req.user?.id}. Needs manual reconciliation.`
      );
      return res.status(500).json({
        msg: "Your payment was received, but we couldn't finalize the booking due to a server error. " +
          "Please contact support with this reference so we can resolve it immediately.",
        paymentReference: paymentRef,
        paymentGateway,
      });
    }

    res.status(500).json({ msg: "Failed to book appointment." });
  } finally {
    session.endSession();
  }
};
// NEXT_AVAILABLE bookings have no patient-chosen slot, so `cc.slot` is null
// until an admin assigns one (stored in `cc.assignedSlot`). Falls back to
// deriving from `urgency` for records created before appointmentType existed.
const resolveCategoryConsultationTime = (cc) => {
  const appointmentType =
    cc.appointmentType || (cc.urgency === "flexible" ? "FLEXIBLE_TIME" : "NEXT_AVAILABLE");
  if (appointmentType === "FLEXIBLE_TIME") return cc.slot;
  return cc.assignedSlot || "Next Available";
};

const mapCategoryConsultationToAppointment = (cc) => {
  let doctor = null;
  if (cc.assignedDoctorId) {
    doctor = {
      _id: cc.assignedDoctorId.doctorId || null,
      name: `${cc.assignedDoctorId.firstName || ""} ${cc.assignedDoctorId.surname || ""}`.trim() || cc.assignedDoctorName || "Doctor",
      email: cc.assignedDoctorId.email || "",
    };
  } else if (cc.assignedDoctorName) {
    doctor = {
      _id: null,
      name: cc.assignedDoctorName,
      email: "",
    };
  }

  let mappedStatus = "pending";
  const status = (cc.status || "pending").toLowerCase();
  if (status === "pending") mappedStatus = "pending";
  else if (status === "assigned") mappedStatus = "assigned";
  else if (status === "confirmed") mappedStatus = "confirmed";
  else if (status === "completed" || status === "complete") mappedStatus = "complete";
  else if (status === "cancelled") mappedStatus = "cancelled";

  return {
    _id: cc._id,
    patientId: cc.patientId,
    doctorId: doctor,
    category: "Category Consultation",
    specialty: cc.supportType || "",
    condition: cc.urgency || "",
    consultationPrice: Number(cc.consultationPrice) || 0,
    date: cc.date,
    time: resolveCategoryConsultationTime(cc),
    problem: cc.concern,
    status: mappedStatus,
    medicalReports: [],
    createdAt: cc.createdAt,
    updatedAt: cc.updatedAt,
    isCategoryConsultation: true,
  };
};

const getPatientAppointments = async (req, res) => {
  try {
    const [appointments, categoryConsultations] = await Promise.all([
      Appointment.find({ patientId: req.user.id })
        .populate("doctorId", "name email")
        .sort({ createdAt: -1 })
        .lean(),
      CategoryConsultation.find({ patientId: req.user.id })
        .populate("assignedDoctorId")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const mappedCategory = categoryConsultations.map(mapCategoryConsultationToAppointment);
    const combined = [...appointments, ...mappedCategory].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.status(200).json(await withPresignedMedicalReports(combined));
  } catch (error) {
    console.error("getPatientAppointments error:", error);
    res.status(500).json({ msg: "Failed to fetch patient appointments." });
  }
};

const getDoctorAppointments = async (req, res) => {
  try {
    if (req.user.role !== "doctor") {
      return res.status(403).json({ msg: "Access denied. Doctors only." });
    }

    const enrollment = await Enrollment.findOne({ doctorId: req.user.id }).select("_id");

    let categoryConsultations = [];
    if (enrollment) {
      categoryConsultations = await CategoryConsultation.find({
        assignedDoctorId: enrollment._id,
      })
        .populate("patientId", "patientId name email mobile gender country dob")
        .sort({ createdAt: -1 })
        .lean();
    }

    const appointments = await Appointment.find({ doctorId: req.user.id })
      .populate("patientId", "patientId name email mobile")
      .sort({ createdAt: -1 })
      .lean();

    const mappedCategory = categoryConsultations.map((cc) => {
      let mappedStatus = "pending";
      const status = (cc.status || "pending").toLowerCase();
      if (status === "pending") mappedStatus = "pending";
      else if (status === "assigned") mappedStatus = "assigned";
      else if (status === "confirmed") mappedStatus = "confirmed";
      else if (status === "completed" || status === "complete") mappedStatus = "complete";
      else if (status === "cancelled") mappedStatus = "cancelled";

      return {
        _id: cc._id,
        patientId: cc.patientId,
        doctorId: req.user.id,
        category: "Category Consultation",
        specialty: cc.supportType || "",
        condition: cc.urgency || "",
        consultationPrice: Number(cc.consultationPrice) || 0,
        date: cc.date,
        time: cc.slot,
        problem: cc.concern,
        status: mappedStatus,
        medicalReports: [],
        createdAt: cc.createdAt,
        updatedAt: cc.updatedAt,
        isCategoryConsultation: true,
        reopenedByAdmin: cc.reopenedByAdmin || null,
      };
    });

    const combined = [...appointments, ...mappedCategory].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.status(200).json(await withPresignedMedicalReports(combined));
  } catch (error) {
    console.error("getDoctorAppointments error:", error);
    res.status(500).json({ msg: "Failed to fetch doctor appointments." });
  }
};

const confirmAppointment = async (req, res) => {
  try {
    let appointment = await Appointment.findById(req.params.id);
    let isCategory = false;

    if (!appointment) {
      appointment = await CategoryConsultation.findById(req.params.id).populate("assignedDoctorId");
      if (appointment) {
        isCategory = true;
      }
    }

    if (!appointment) {
      return res.status(404).json({ msg: "Appointment not found." });
    }

    if (isCategory) {
      if (!appointment.assignedDoctorId || appointment.assignedDoctorId.doctorId.toString() !== req.user.id) {
        return res.status(403).json({ msg: "You can only confirm your own appointments." });
      }
    } else {
      if (appointment.doctorId.toString() !== req.user.id) {
        return res.status(403).json({ msg: "You can only confirm your own appointments." });
      }
    }

    if (!["assigned", "pending"].includes(appointment.status.toLowerCase())) {
      return res.status(400).json({ msg: "Only assigned or pending appointments can be confirmed." });
    }

    if (isCategory) {
      appointment.status = "Confirmed";
    } else {
      appointment.status = "confirmed";
      appointment.sessionStarted = true;
    }
    // Who confirmed and when, as for an admin's confirm (role tells them apart).
    const confirmingDoctor = await Doctor.findById(req.user.id).select("name email").lean();
    appointment.confirmedBy = {
      id: req.user.id,
      name: confirmingDoctor?.name || "",
      email: confirmingDoctor?.email || "",
      role: "doctor",
    };
    appointment.confirmedAt = new Date();
    await appointment.save();

    const io = req.app.get("io");
    if (io) {
      const patientId = appointment.patientId;
      io.to(`appointment_${appointment._id}`).emit("appointment-updated", {
        appointmentId: appointment._id,
        status: isCategory ? "confirmed" : appointment.status,
      });
      io.to(`patient_${patientId}`).emit("appointment-updated", {
        appointmentId: appointment._id,
        status: isCategory ? "confirmed" : appointment.status,
      });
      io.to("admin_room").emit("appointment-updated", {
        appointmentId: appointment._id,
        status: isCategory ? "confirmed" : appointment.status,
      });
    }

    // Testing bookings never message anyone.
    if (appointment.isTesting !== true) {
      sendPushToUser(appointment.patientId, {
        title: "Appointment confirmed",
        body: "Your doctor has confirmed your appointment.",
        data: { type: "appointment", appointmentId: String(appointment._id) },
      });
    }

    res.status(200).json({ msg: "Appointment confirmed.", appointment });
  } catch (error) {
    console.error("confirmAppointment error:", error);
    res.status(500).json({ msg: "Failed to confirm appointment." });
  }
};

const sendLifecycleError = (res, error, fallbackMsg, label) => {
  if (error instanceof LifecycleError) {
    return res.status(error.statusCode).json({ msg: error.message });
  }
  console.error(`${label} error:`, error);
  return res.status(500).json({ msg: fallbackMsg });
};

const completeAppointment = async (req, res) => {
  try {
    const loaded = await loadAppointmentAny(req.params.id);
    if (!loaded) {
      return res.status(404).json({ msg: "Appointment not found." });
    }

    const ownerId = doctorUserIdOf(loaded);
    if (!ownerId || ownerId !== String(req.user.id)) {
      return res.status(403).json({ msg: "You can only complete your own appointments." });
    }

    const { appointment, alreadyComplete } = await completeLoaded(req.app, loaded);
    res.status(200).json({
      msg: alreadyComplete ? "Appointment is already completed." : "Appointment marked as completed.",
      appointment,
    });
  } catch (error) {
    sendLifecycleError(res, error, "Failed to complete appointment.", "completeAppointment");
  }
};

// Admin/superadmin: same completion as the doctor's, without the ownership check.
const adminCompleteAppointment = async (req, res) => {
  try {
    const loaded = await loadAppointmentAny(req.params.id);
    if (!loaded) {
      return res.status(404).json({ msg: "Appointment not found." });
    }

    const { appointment, alreadyComplete } = await completeLoaded(req.app, loaded);
    res.status(200).json({
      msg: alreadyComplete ? "Appointment is already completed." : "Appointment marked as completed.",
      appointment,
    });
  } catch (error) {
    sendLifecycleError(res, error, "Failed to complete appointment.", "adminCompleteAppointment");
  }
};

// Admin/superadmin: completed -> confirmed again. Existing prescriptions and
// certificates are left untouched.
const reopenAppointment = async (req, res) => {
  try {
    const loaded = await loadAppointmentAny(req.params.id);
    if (!loaded) {
      return res.status(404).json({ msg: "Appointment not found." });
    }

    const admin = req.user?.id ? await User.findById(req.user.id).select("name email").lean() : null;
    const actor = { id: req.user?.id || null, name: admin?.name || req.user?.name || req.user?.email || "Admin" };

    const { appointment } = await reopenLoaded(req.app, loaded, actor);
    res.status(200).json({ msg: "Appointment reopened.", appointment });
  } catch (error) {
    sendLifecycleError(res, error, "Failed to reopen appointment.", "reopenAppointment");
  }
};

const cancelAppointment = async (req, res) => {
  try {
    let appointment = await Appointment.findById(req.params.id);
    let isCategory = false;

    if (!appointment) {
      appointment = await CategoryConsultation.findById(req.params.id).populate("assignedDoctorId");
      if (appointment) {
        isCategory = true;
      }
    }

    if (!appointment) {
      return res.status(404).json({ msg: "Appointment not found." });
    }

    if (isCategory) {
      if (!appointment.assignedDoctorId || appointment.assignedDoctorId.doctorId.toString() !== req.user.id) {
        return res.status(403).json({ msg: "You can only cancel your own appointments." });
      }
    } else {
      if (appointment.doctorId.toString() !== req.user.id) {
        return res.status(403).json({ msg: "You can only cancel your own appointments." });
      }
    }

    if (appointment.status.toLowerCase() === "cancelled") {
      return res.status(400).json({ msg: "Appointment is already cancelled." });
    }

    if (isCategory) {
      appointment.status = "Cancelled";
    } else {
      appointment.status = "cancelled";
    }
    await appointment.save();

    const io = req.app.get("io");
    if (io) {
      const patientId = appointment.patientId;
      io.to(`patient_${patientId}`).emit("appointment-updated", {
        appointmentId: appointment._id,
        status: isCategory ? "cancelled" : appointment.status,
      });
      io.to("admin_room").emit("appointment-updated", {
        appointmentId: appointment._id,
        status: isCategory ? "cancelled" : appointment.status,
      });
    }
    req.app.get("evictAllFromAppointmentRoom")?.(appointment._id, { reason: "cancelled" });

    sendPushToUser(appointment.patientId, {
      title: "Appointment cancelled",
      body: "Your appointment has been cancelled.",
      data: { type: "appointment", appointmentId: String(appointment._id) },
    });

    res.status(200).json({ msg: "Appointment cancelled.", appointment });
  } catch (error) {
    console.error("cancelAppointment error:", error);
    res.status(500).json({ msg: "Failed to cancel appointment." });
  }
};

const getAppointmentById = async (req, res) => {
  try {
    let appointment = await Appointment.findById(req.params.id)
      .populate("patientId", "patientId name email mobile gender dob city state country")
      .populate("doctorId", "name email doctorId")
      .lean();

    let isCategory = false;
    if (!appointment) {
      const cc = await CategoryConsultation.findById(req.params.id)
        .populate("patientId", "patientId name email mobile gender dob city state country")
        .populate("assignedDoctorId")
        .lean();
      if (cc) {
        appointment = mapCategoryConsultationToAppointment(cc);
        isCategory = true;
      }
    }

    if (!appointment) {
      return res.status(404).json({ msg: "Appointment not found." });
    }

    const userId = req.user.id;
    const patientId = appointment.patientId?._id?.toString() ?? appointment.patientId?.toString();
    const doctorId = appointment.doctorId?._id?.toString() ?? appointment.doctorId?.toString();
    const isParticipant = patientId === userId || doctorId === userId;
    const isAdmin = req.user.role === "admin" || req.user.role === "superadmin";

    if (!isParticipant && !isAdmin) {
      return res.status(403).json({ msg: "Access denied." });
    }

    let doctorMeta = null;
    const appointmentDoctorId = appointment.doctorId?._id?.toString() || appointment.doctorId?.toString();
    if (appointmentDoctorId) {
      const enrollment = await Enrollment.findOne({ doctorId: appointmentDoctorId }).lean();
      doctorMeta = {
        specialty: enrollment?.specialization || "-",
        city: enrollment?.city || "-",
        country: enrollment?.country || "-",
        experience: enrollment?.experience || "-",
        price: enrollment?.consultantFees || null,
        languages: enrollment?.languagesKnown || [],
        address: enrollment?.clinicAddress || enrollment?.address || "-",
        timezone: enrollment?.timezone || "",
        phoneNumber: enrollment?.phoneNumber || "",
        countryCode: enrollment?.countryCode || "",
      };
    }

    res.status(200).json(await withPresignedMedicalReportUrls({ ...appointment, doctorMeta }));
  } catch (error) {
    console.error("getAppointmentById error:", error);
    res.status(500).json({ msg: "Failed to fetch appointment." });
  }
};

// Doctor-specific fetch — uses DB-level query so Mongoose handles ObjectId casting.
// Only the owning doctor can access via this endpoint (verifyDoctorToken already
// confirms the caller is a doctor; here we confirm they own this appointment).
const getDoctorOwnAppointment = async (req, res) => {
  try {
    let owns = await Appointment.exists({ _id: req.params.id, doctorId: req.user.id });

    let appointment;
    if (owns) {
      appointment = await Appointment.findById(req.params.id)
        .populate("patientId", "patientId name email mobile gender dob")
        .populate("doctorId", "name email")
        .lean();
    } else {
      const enrollment = await Enrollment.findOne({ doctorId: req.user.id }).select("_id");
      const ccOwns = enrollment ? await CategoryConsultation.exists({ _id: req.params.id, assignedDoctorId: enrollment._id }) : false;
      if (ccOwns) {
        const cc = await CategoryConsultation.findById(req.params.id)
          .populate("patientId", "patientId name email mobile gender dob")
          .populate("assignedDoctorId")
          .lean();
        if (cc) {
          appointment = mapCategoryConsultationToAppointment(cc);
        }
      }
    }

    if (!appointment) {
      const apptRaw = await Appointment.findById(req.params.id).select("doctorId").lean();
      const enrollment = await Enrollment.findOne({ doctorId: req.user.id }).select("_id");
      const ccRaw = enrollment ? await CategoryConsultation.findOne({ _id: req.params.id }).select("assignedDoctorId").lean() : null;

      const exists = !!apptRaw || !!ccRaw;
      if (!exists) return res.status(404).json({ msg: "Appointment not found." });
      return res.status(403).json({ msg: "Access denied." });
    }

    res.status(200).json(await withPresignedMedicalReportUrls(appointment));
  } catch (error) {
    console.error("getDoctorOwnAppointment error:", error);
    res.status(500).json({ msg: "Failed to fetch appointment." });
  }
};

// Patient-specific fetch — DB-level ownership check to avoid mixed-role
// session ambiguity when multiple auth cookies/tokens exist in one browser.
const getPatientOwnAppointment = async (req, res) => {
  try {
    let owns = await Appointment.exists({ _id: req.params.id, patientId: req.user.id });
    let appointment;
    if (owns) {
      appointment = await Appointment.findById(req.params.id)
        .populate("patientId", "patientId name email mobile gender dob")
        .populate("doctorId", "name email")
        .lean();
    } else {
      const ccOwns = await CategoryConsultation.exists({ _id: req.params.id, patientId: req.user.id });
      if (ccOwns) {
        const cc = await CategoryConsultation.findById(req.params.id)
          .populate("patientId", "patientId name email mobile gender dob")
          .populate("assignedDoctorId")
          .lean();
        if (cc) {
          appointment = mapCategoryConsultationToAppointment(cc);
        }
      }
    }

    if (!appointment) {
      const apptRaw = await Appointment.findById(req.params.id).select("patientId").lean();
      const ccRaw = await CategoryConsultation.findById(req.params.id).select("patientId").lean();
      if (!apptRaw && !ccRaw) {
        return res.status(404).json({ msg: "Appointment not found." });
      }
      return res.status(403).json({ msg: "Access denied." });
    }

    res.status(200).json(await withPresignedMedicalReportUrls(appointment));
  } catch (error) {
    console.error("getPatientOwnAppointment error:", error);
    res.status(500).json({ msg: "Failed to fetch appointment." });
  }
};

const getBookedSlots = async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) {
      return res.status(400).json({ msg: "doctorId and date required." });
    }
    const resolvedDoctorId = await resolveDoctorId(doctorId);
    if (!resolvedDoctorId) return res.status(404).json({ msg: "Doctor not found." });
    const appointments = await Appointment.find({
      doctorId: resolvedDoctorId,
      date,
      status: { $in: ACTIVE_DOCTOR_STATUSES },
    }).select("time").lean();
    res.json({ slots: appointments.map((a) => a.time) });
  } catch (err) {
    console.error("getBookedSlots error:", err);
    res.status(500).json({ msg: "Failed to fetch booked slots." });
  }
};

module.exports = {
  createAppointment,
  getPatientAppointments,
  getDoctorAppointments,
  confirmAppointment,
  completeAppointment,
  adminCompleteAppointment,
  reopenAppointment,
  cancelAppointment,
  getAppointmentById,
  getDoctorOwnAppointment,
  getPatientOwnAppointment,
  getBookedSlots,
};
