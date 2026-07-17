const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const CategoryConsultation = require("../models/CategoryConsultation");
const mongoose = require("mongoose");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { paypalFetch } = require("../utils/paypal");
const { sendEmail } = require("../utils/sendEmail");
const { recordSecurityEvent } = require("../utils/securityMonitor");
const { keyFromStoredValue } = require("../utils/uploadStorage");
const { getS3ObjectUrl } = require("../config/s3");
const { createS3PresignedGetUrl } = require("../utils/s3PresignedUrl");
const { sendPushToUser } = require("../utils/pushNotifications");

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
      return {
        ...report,
        s3Url: getS3ObjectUrl(key),
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

    let paymentRef = "";
    let paymentGateway = "";
    let paymentAmountFinal = 0;
    let paymentStatus = "unpaid";
    let resolvedDoctorId = null;

    if (doctorId) {
      if (!paymentIntentId && !paypalOrderId) {
        return res.status(400).json({ msg: "Payment is required to book an appointment." });
      }

      if (paymentIntentId) {
        let pi;
        try { pi = await stripe.paymentIntents.retrieve(paymentIntentId); }
        catch { return res.status(400).json({ msg: "Invalid Stripe payment reference." }); }
        if (pi.status !== "succeeded") {
          return res.status(402).json({ msg: "Stripe payment not completed. Please complete payment first." });
        }
        paymentRef = paymentIntentId;
        paymentGateway = "stripe";
        paymentAmountFinal = pi.amount;
      } else {
        let order;
        try { order = await paypalFetch("GET", `/v2/checkout/orders/${paypalOrderId}`); }
        catch { return res.status(400).json({ msg: "Invalid PayPal payment reference." }); }
        if (order.status !== "COMPLETED") {
          return res.status(402).json({ msg: "PayPal payment not completed." });
        }
        const captureData = order.purchase_units[0].payments.captures[0];
        paymentRef = paypalOrderId;
        paymentGateway = "paypal";
        paymentAmountFinal = Math.round(parseFloat(captureData.amount.value) * 100);
      }

      paymentStatus = "paid";
      resolvedDoctorId = await resolveDoctorId(doctorId);
      const doctor = resolvedDoctorId ? await Doctor.findById(resolvedDoctorId) : null;
      if (!doctor) {
        return res.status(404).json({ msg: "Doctor not found." });
      }

      const conflict = await Appointment.findOne({
        doctorId: resolvedDoctorId,
        date,
        time,
        status: { $in: ACTIVE_DOCTOR_STATUSES },
      });
      if (conflict) {
        return res.status(409).json({ msg: "This time slot is already booked. Please choose a different time." });
      }
    }

    // Category-based booking (no specific doctor) — payment required
    if (!resolvedDoctorId) {
      if (!paymentIntentId && !paypalOrderId) {
        return res.status(400).json({ msg: "Payment is required to submit an appointment request." });
      }

      if (paymentIntentId) {
        let pi;
        try { pi = await stripe.paymentIntents.retrieve(paymentIntentId); }
        catch { return res.status(400).json({ msg: "Invalid Stripe payment reference." }); }
        if (pi.status !== "succeeded") {
          return res.status(402).json({ msg: "Stripe payment not completed. Please complete payment first." });
        }
        paymentRef = paymentIntentId;
        paymentGateway = "stripe";
        paymentAmountFinal = pi.amount;
      } else {
        let order;
        try { order = await paypalFetch("GET", `/v2/checkout/orders/${paypalOrderId}`); }
        catch { return res.status(400).json({ msg: "Invalid PayPal payment reference." }); }
        if (order.status !== "COMPLETED") {
          return res.status(402).json({ msg: "PayPal payment not completed." });
        }
        const captureData = order.purchase_units[0].payments.captures[0];
        paymentRef = paypalOrderId;
        paymentGateway = "paypal";
        paymentAmountFinal = Math.round(parseFloat(captureData.amount.value) * 100);
      }
      paymentStatus = "paid";
    }

    // Resolve the UTC instant for the appointment.
    // Prefer the value sent by the frontend (already converted in the patient's browser TZ).
    // Fall back to a server-side conversion using the patient's IANA timezone string.
    const safeTimezone = typeof patientTimezone === "string" ? patientTimezone.slice(0, 80) : "";
    let resolvedUtc = null;
    if (appointmentDateTimeUtc) {
      const d = new Date(appointmentDateTimeUtc);
      if (!Number.isNaN(d.getTime())) resolvedUtc = d;
    }
    if (!resolvedUtc) {
      resolvedUtc = buildUtcDateTime(date, time, safeTimezone);
    }

    const bookedAt = new Date();
    const patient = await User.findById(patientId)
      .select("name email mobile dob gender country city")
      .lean();
    const safePatientDetails = {
      ...(patientDetails || {}),
      email: patientDetails?.email || patient?.email || "",
      phone: patientDetails?.phone || patient?.mobile || "",
      dob: patientDetails?.dob || patient?.dob || "",
      gender: patientDetails?.gender || patient?.gender || "",
    };

    const appointment = await Appointment.create({
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
  } catch (error) {
    console.error("createAppointment error:", error);
    res.status(500).json({ msg: "Failed to book appointment." });
  }
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
    consultationPrice: 49,
    date: cc.date,
    time: cc.slot,
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
        consultationPrice: 49,
        date: cc.date,
        time: cc.slot,
        problem: cc.concern,
        status: mappedStatus,
        medicalReports: [],
        createdAt: cc.createdAt,
        updatedAt: cc.updatedAt,
        isCategoryConsultation: true,
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

    sendPushToUser(appointment.patientId, {
      title: "Appointment confirmed",
      body: "Your doctor has confirmed your appointment.",
      data: { type: "appointment", appointmentId: String(appointment._id) },
    });

    res.status(200).json({ msg: "Appointment confirmed.", appointment });
  } catch (error) {
    console.error("confirmAppointment error:", error);
    res.status(500).json({ msg: "Failed to confirm appointment." });
  }
};

const completeAppointment = async (req, res) => {
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
        return res.status(403).json({ msg: "You can only complete your own appointments." });
      }
    } else {
      if (appointment.doctorId.toString() !== req.user.id) {
        return res.status(403).json({ msg: "You can only complete your own appointments." });
      }
    }

    if (!["assigned", "confirmed"].includes(appointment.status.toLowerCase())) {
      return res.status(400).json({ msg: "Only assigned or confirmed appointments can be marked complete." });
    }

    if (isCategory) {
      appointment.status = "Completed";
    } else {
      appointment.status = "complete";
    }
    await appointment.save();

    const io = req.app.get("io");
    if (io) {
      const patientId = appointment.patientId;
      const payload = {
        appointmentId: appointment._id,
        status: isCategory ? "complete" : appointment.status
      };
      io.to(`patient_${patientId}`).emit("appointment-updated", payload);
      io.to(`appointment_${appointment._id}`).emit("appointment-updated", payload);
      io.to("admin_room").emit("appointment-updated", payload);
    }

    sendPushToUser(appointment.patientId, {
      title: "Appointment completed",
      body: "Your appointment has been marked as complete.",
      data: { type: "appointment", appointmentId: String(appointment._id) },
    });

    res.status(200).json({ msg: "Appointment marked as completed.", appointment });
  } catch (error) {
    console.error("completeAppointment error:", error);
    res.status(500).json({ msg: "Failed to complete appointment." });
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

const reassignAppointmentDoctor = async (req, res) => {
  try {
    const { doctorId } = req.body;
    if (!doctorId) {
      return res.status(400).json({ msg: "A new doctorId is required." });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ msg: "Appointment not found." });
    }

    // Find the new doctor by numeric doctorId
    const newDoctor = await Doctor.findOne({ doctorId });
    if (!newDoctor) {
      return res.status(404).json({ msg: "Alternate doctor not found." });
    }

    if (appointment.doctorId?.toString() === newDoctor._id.toString()) {
      const statusChanged = appointment.status !== "confirmed";
      if (appointment.status !== "confirmed") {
        appointment.status = "confirmed";
        appointment.sessionStarted = true;
        await appointment.save();
      }
      if (statusChanged) {
        const io = req.app.get("io");
        if (io) {
          const payload = {
            appointmentId: appointment._id,
            status: appointment.status,
            doctorId: appointment.doctorId,
          };
          io.to(`patient_${appointment.patientId}`).emit("appointment-updated", payload);
          io.to(`appointment_${appointment._id}`).emit("appointment-updated", payload);
          io.to("admin_room").emit("appointment-updated", payload);
        }
      }
      return res.status(200).json({ msg: "Appointment already assigned to this doctor.", appointment });
    }

    const conflict = await Appointment.findOne({
      _id: { $ne: appointment._id },
      doctorId: newDoctor._id,
      date: appointment.date,
      time: appointment.time,
      status: { $in: ACTIVE_DOCTOR_STATUSES },
    });
    if (conflict) {
      return res.status(409).json({ msg: "The selected doctor is already booked for this slot." });
    }

    const wasRequested = ["upcoming", "requested"].includes(appointment.status) || !appointment.doctorId;
    const assigningAdmin = req.user?.id
      ? await User.findById(req.user.id).select("name email").lean()
      : null;
    const assignedDoctorEnrollment = await Enrollment.findOne({ doctorId: newDoctor._id })
      .select("timezone")
      .lean();

    appointment.doctorId = newDoctor._id;
    appointment.status = "confirmed";
    appointment.sessionStarted = true;
    appointment.doctorTimezone = assignedDoctorEnrollment?.timezone || appointment.doctorTimezone || "";
    appointment.assignedBy = {
      id: req.user?.id || null,
      name: assigningAdmin?.name || req.user?.name || req.user?.email || "Admin",
      email: assigningAdmin?.email || req.user?.email || "",
      assignedAt: new Date(),
    };
    await appointment.save();

    const patient = await User.findById(appointment.patientId).select("name email");
    if (patient?.email) {
      const patientName = patient.name || "Patient";
      const isNew = wasRequested;
      const subject = isNew
        ? "Your appointment has been confirmed — Humancare Connect"
        : "Appointment update — Doctor reassigned";
      const bodyText = isNew
        ? "Great news! Your appointment request has been reviewed and a doctor has been assigned. You will be contacted shortly with further details."
        : "We wanted to let you know that your assigned doctor has changed due to unavailability. Your appointment time remains the same and a new doctor has been assigned to ensure you receive the best care.";
      const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/>
<style>
  body{margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#eef4ff;}
  .wrap{max-width:520px;margin:40px auto;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 6px 24px rgba(11,4,67,.12);}
  .hdr{background:linear-gradient(135deg,#0b0443 0%,#1a0b73 100%);padding:34px 40px;text-align:center;}
  .hdr h1{color:#fff;margin:0;font-size:22px;font-weight:800;}
  .hdr p{color:rgba(255,255,255,.82);margin:8px 0 0;font-size:13px;}
  .body{padding:36px 40px;}
  .body p{color:#374151;font-size:15px;line-height:1.7;margin:0 0 14px;}
  .badge{display:inline-block;background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:20px;padding:6px 16px;font-size:13px;font-weight:600;margin-bottom:18px;}
  .footer{background:#f8f9ff;padding:18px 40px;text-align:center;color:#9ca3af;font-size:11px;border-top:1px solid #e5e7eb;}
  .footer a{color:#0b0443;text-decoration:none;font-weight:600;}
</style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <h1>Humancare Connect</h1>
      <p>${isNew ? "Appointment Confirmed" : "Appointment Update"}</p>
    </div>
    <div class="body">
      <span class="badge">${isNew ? "✓ Doctor Assigned" : "ℹ Doctor Reassigned"}</span>
      <p>Hello ${patientName},</p>
      <p>${bodyText}</p>
      <p>If you have any questions, please don't hesitate to reach out to our support team.</p>
      <p>Thank you for choosing Humancare Connect.</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} HumanCare Connect &nbsp;·&nbsp;
      <a href="https://humancareconnect.co">humancareconnect.co</a>
    </div>
  </div>
</body>
</html>`;
      try {
        await sendEmail({ to: patient.email, subject, html, text: bodyText });
      } catch (mailErr) {
        console.error("Appointment notification email failed (non-fatal):", mailErr.message);
      }
    }

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate("patientId", "patientId name email gender city country")
      .populate("doctorId", "name email doctorId")
      .lean();

    const io = req.app.get("io");
    if (io) {
      io.to(`patient_${appointment.patientId}`).emit("appointment-updated", {
        appointmentId: appointment._id,
        status: appointment.status,
        doctorId: appointment.doctorId,
      });
      io.to("admin_room").emit("appointment-updated", {
        appointmentId: appointment._id,
        status: appointment.status,
        doctorId: appointment.doctorId,
      });
      io.to(`doctor_${newDoctor._id}`).emit("new-appointment", {
        appointmentId: appointment._id,
        patientId: appointment.patientId,
        status: appointment.status,
        date: appointment.date,
        time: appointment.time,
      });
    }

    res.status(200).json({
      msg: wasRequested ? "Appointment confirmed and doctor assigned successfully." : "Doctor reassigned successfully.",
      appointment: populatedAppointment,
    });
  } catch (error) {
    console.error("reassignAppointmentDoctor error:", error);
    res.status(500).json({ msg: "Failed to reassign doctor." });
  }
};

const getAllAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate("patientId", "patientId name email gender dob city country")
      .populate("doctorId", "name email doctorId")
      .sort({ createdAt: -1 })
      .lean();

    const doctorIds = appointments
      .map((appt) => appt.doctorId?._id?.toString() || appt.doctorId?.toString())
      .filter(Boolean);

    const enrollments = await Enrollment.find({ doctorId: { $in: doctorIds } }).lean();
    const enrollmentByDoctor = new Map(
      enrollments.map((e) => [e.doctorId.toString(), e])
    );

    const enhancedAppointments = appointments.map((appt) => {
      const doctorId = appt.doctorId?._id?.toString() || appt.doctorId?.toString();
      const enrollment = doctorId ? enrollmentByDoctor.get(doctorId) : null;
      return {
        ...appt,
        doctorMeta: {
          specialty: enrollment?.specialization || "—",
          city: enrollment?.city || "—",
          country: enrollment?.country || "—",
          experience: enrollment?.experience || "—",
          price: enrollment?.consultantFees || null,
          languages: enrollment?.languagesKnown || [],
          address: enrollment?.clinicAddress || enrollment?.address || "—",
          timezone: enrollment?.timezone || "",
          phoneNumber: enrollment?.phoneNumber || "",
          countryCode: enrollment?.countryCode || "",
        },
      };
    });

    if (enhancedAppointments.length >= 100) {
      await recordSecurityEvent(req, {
        type: "large_data_export",
        severity: "medium",
        title: "Large appointment dataset accessed",
        resource: "Appointment",
        metadata: { count: enhancedAppointments.length, endpoint: req.originalUrl },
      });
    }

    res.status(200).json(await withPresignedMedicalReports(enhancedAppointments));
  } catch (error) {
    console.error("getAllAppointments error:", error);
    res.status(500).json({ msg: "Failed to fetch appointments." });
  }
};

const getAppointmentById = async (req, res) => {
  try {
    let appointment = await Appointment.findById(req.params.id)
      .populate("patientId", "patientId name email mobile gender dob city country")
      .populate("doctorId", "name email doctorId")
      .lean();

    let isCategory = false;
    if (!appointment) {
      const cc = await CategoryConsultation.findById(req.params.id)
        .populate("patientId", "patientId name email mobile gender dob city country")
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
    console.log("[getDoctorOwnAppointment] doctorJwtId:", req.user.id, "appointmentId:", req.params.id);
    let owns = await Appointment.exists({ _id: req.params.id, doctorId: req.user.id });
    console.log("[getDoctorOwnAppointment] owns (Appointment):", owns);

    let appointment;
    if (owns) {
      appointment = await Appointment.findById(req.params.id)
        .populate("patientId", "patientId name email mobile gender dob")
        .populate("doctorId", "name email")
        .lean();
    } else {
      const enrollment = await Enrollment.findOne({ doctorId: req.user.id }).select("_id");
      const ccOwns = enrollment ? await CategoryConsultation.exists({ _id: req.params.id, assignedDoctorId: enrollment._id }) : false;
      console.log("[getDoctorOwnAppointment] owns (CategoryConsultation):", ccOwns);
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
  cancelAppointment,
  reassignAppointmentDoctor,
  getAllAppointments,
  getAppointmentById,
  getDoctorOwnAppointment,
  getPatientOwnAppointment,
  getBookedSlots,
};
