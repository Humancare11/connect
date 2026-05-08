const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor");
const User = require("../models/User");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { paypalFetch } = require("../utils/paypal");

const createAppointment = async (req, res) => {
  try {
    const { doctorId, date, time, problem, medicalReports, paymentIntentId, paypalOrderId } = req.body;
    const patientId = req.user.id;

    if (!doctorId || !date || !time) {
      return res.status(400).json({ msg: "Doctor, date, and time are required." });
    }

    // Past date/time guard — compare as strings (YYYY-MM-DD / HH:MM), timezone-safe
    const today = new Date().toISOString().slice(0, 10);
    if (date < today) {
      return res.status(400).json({ msg: "Cannot book an appointment in the past." });
    }
    if (date === today) {
      const nowTime = new Date().toTimeString().slice(0, 5); // "HH:MM"
      if (time <= nowTime) {
        return res.status(400).json({ msg: "Please choose a future time for today's appointment." });
      }
    }

    // Payment verification — accept either Stripe PaymentIntent or PayPal order
    if (!paymentIntentId && !paypalOrderId) {
      return res.status(400).json({ msg: "Payment is required to book an appointment." });
    }

    let paymentRef, paymentGateway, paymentAmountFinal;

    if (paymentIntentId) {
      let pi;
      try { pi = await stripe.paymentIntents.retrieve(paymentIntentId); }
      catch { return res.status(400).json({ msg: "Invalid Stripe payment reference." }); }
      if (pi.status !== "succeeded") {
        return res.status(402).json({ msg: "Stripe payment not completed. Please complete payment first." });
      }
      paymentRef          = paymentIntentId;
      paymentGateway      = "stripe";
      paymentAmountFinal  = pi.amount;
    } else {
      let order;
      try { order = await paypalFetch("GET", `/v2/checkout/orders/${paypalOrderId}`); }
      catch { return res.status(400).json({ msg: "Invalid PayPal payment reference." }); }
      if (order.status !== "COMPLETED") {
        return res.status(402).json({ msg: "PayPal payment not completed." });
      }
      const captureData   = order.purchase_units[0].payments.captures[0];
      paymentRef          = paypalOrderId;
      paymentGateway      = "paypal";
      paymentAmountFinal  = Math.round(parseFloat(captureData.amount.value) * 100);
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ msg: "Doctor not found." });
    }

    // Slot conflict — reject if doctor already has an active booking at this date+time
    const conflict = await Appointment.findOne({
      doctorId,
      date,
      time,
      status: { $in: ["pending", "confirmed"] },
    });
    if (conflict) {
      return res.status(409).json({ msg: "This time slot is already booked. Please choose a different time." });
    }

    const appointment = await Appointment.create({
      patientId,
      doctorId,
      date,
      time,
      problem,
      medicalReports:  Array.isArray(medicalReports) ? medicalReports : [],
      paymentIntentId: paymentRef,
      paymentAmount:   paymentAmountFinal,
      paymentStatus:   "paid",
      paymentGateway:  paymentGateway,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`doctor_${doctorId}`).emit("new-appointment", {
        appointmentId: appointment._id,
        patientId,
        doctorId,
        status: appointment.status,
        date,
        time,
      });
      io.to("admin_room").emit("new-appointment", {
        appointmentId: appointment._id,
        patientId,
        doctorId,
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
      msg: "Appointment booked successfully.",
      appointment,
    });
  } catch (error) {
    console.error("createAppointment error:", error);
    res.status(500).json({ msg: "Failed to book appointment." });
  }
};

const getPatientAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ patientId: req.user.id })
      .populate("doctorId", "name email")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(appointments);
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

    const appointments = await Appointment.find({ doctorId: req.user.id })
      .populate("patientId", "name email mobile")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(appointments);
  } catch (error) {
    console.error("getDoctorAppointments error:", error);
    res.status(500).json({ msg: "Failed to fetch doctor appointments." });
  }
};

const confirmAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ msg: "Appointment not found." });
    }

    if (appointment.doctorId.toString() !== req.user.id) {
      return res.status(403).json({ msg: "You can only confirm your own appointments." });
    }

    appointment.status = "confirmed";
    appointment.sessionStarted = true;
    await appointment.save();

    const io = req.app.get("io");
    if (io) {
      io.to(`appointment_${appointment._id}`).emit("appointment-updated", {
        appointmentId: appointment._id,
        status: appointment.status,
      });
      io.to(`patient_${appointment.patientId}`).emit("appointment-updated", {
        appointmentId: appointment._id,
        status: appointment.status,
      });
      io.to("admin_room").emit("appointment-updated", {
        appointmentId: appointment._id,
        status: appointment.status,
      });
    }

    res.status(200).json({ msg: "Appointment confirmed.", appointment });
  } catch (error) {
    console.error("confirmAppointment error:", error);
    res.status(500).json({ msg: "Failed to confirm appointment." });
  }
};

const completeAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ msg: "Appointment not found." });
    }

    if (appointment.doctorId.toString() !== req.user.id) {
      return res.status(403).json({ msg: "You can only complete your own appointments." });
    }

    if (appointment.status !== "confirmed") {
      return res.status(400).json({ msg: "Only confirmed appointments can be marked complete." });
    }

    appointment.status = "completed";
    await appointment.save();

    const io = req.app.get("io");
    if (io) {
      io.to(`patient_${appointment.patientId}`).emit("appointment-updated", {
        appointmentId: appointment._id,
        status: appointment.status,
      });
      io.to("admin_room").emit("appointment-updated", {
        appointmentId: appointment._id,
        status: appointment.status,
      });
    }

    res.status(200).json({ msg: "Appointment marked as completed.", appointment });
  } catch (error) {
    console.error("completeAppointment error:", error);
    res.status(500).json({ msg: "Failed to complete appointment." });
  }
};

const cancelAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ msg: "Appointment not found." });
    }

    if (appointment.doctorId.toString() !== req.user.id) {
      return res.status(403).json({ msg: "You can only cancel your own appointments." });
    }

    if (appointment.status === "cancelled") {
      return res.status(400).json({ msg: "Appointment is already cancelled." });
    }

    appointment.status = "cancelled";
    await appointment.save();

    const io = req.app.get("io");
    if (io) {
      io.to(`patient_${appointment.patientId}`).emit("appointment-updated", {
        appointmentId: appointment._id,
        status: appointment.status,
      });
      io.to("admin_room").emit("appointment-updated", {
        appointmentId: appointment._id,
        status: appointment.status,
      });
    }

    res.status(200).json({ msg: "Appointment cancelled.", appointment });
  } catch (error) {
    console.error("cancelAppointment error:", error);
    res.status(500).json({ msg: "Failed to cancel appointment." });
  }
};

const getAllAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate("patientId", "name email")
      .populate("doctorId", "name email")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(appointments);
  } catch (error) {
    console.error("getAllAppointments error:", error);
    res.status(500).json({ msg: "Failed to fetch appointments." });
  }
};

const getAppointmentById = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate("patientId", "name email mobile")
      .populate("doctorId", "name email")
      .lean();

    if (!appointment) {
      return res.status(404).json({ msg: "Appointment not found." });
    }

    const isPatient = req.user.role === "user" && appointment.patientId._id.toString() === req.user.id;
    const isDoctor = req.user.role === "doctor" && appointment.doctorId._id.toString() === req.user.id;
    const isAdmin = req.user.role === "admin" || req.user.role === "superadmin";

    if (!isPatient && !isDoctor && !isAdmin) {
      return res.status(403).json({ msg: "Access denied." });
    }

    res.status(200).json(appointment);
  } catch (error) {
    console.error("getAppointmentById error:", error);
    res.status(500).json({ msg: "Failed to fetch appointment." });
  }
};

const getBookedSlots = async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) {
      return res.status(400).json({ msg: "doctorId and date required." });
    }
    const appointments = await Appointment.find({
      doctorId,
      date,
      status: { $in: ["pending", "confirmed"] },
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
  getAllAppointments,
  getAppointmentById,
  getBookedSlots,
};
