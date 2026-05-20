const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { paypalFetch } = require("../utils/paypal");
const { sendEmail } = require("../utils/sendEmail");

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
      medicalReports: Array.isArray(medicalReports) ? medicalReports : [],
      paymentIntentId: paymentRef,
      paymentAmount: paymentAmountFinal,
      paymentStatus: "paid",
      paymentGateway: paymentGateway,
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
      const payload = { appointmentId: appointment._id, status: appointment.status };
      io.to(`patient_${appointment.patientId}`).emit("appointment-updated", payload);
      io.to(`appointment_${appointment._id}`).emit("appointment-updated", payload);
      io.to("admin_room").emit("appointment-updated", payload);
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

    if (appointment.doctorId.toString() === newDoctor._id.toString()) {
      return res.status(200).json({ msg: "Appointment already assigned to this doctor.", appointment });
    }

    const conflict = await Appointment.findOne({
      _id: { $ne: appointment._id },
      doctorId: newDoctor._id,
      date: appointment.date,
      time: appointment.time,
      status: { $in: ["pending", "confirmed"] },
    });
    if (conflict) {
      return res.status(409).json({ msg: "The selected doctor is already booked for this slot." });
    }

    appointment.doctorId = newDoctor._id;
    await appointment.save();

    const patient = await User.findById(appointment.patientId).select("name email");
    if (patient?.email) {
      await sendEmail({
        to: patient.email,
        subject: "Doctor reassigned for your appointment",
        text: "Your doctor has been changed due to the doctor's unavailability. Your appointment time will remain the same, but we are assigning a different doctor.",
        html: `<p>Hello ${patient.name || "Patient"},</p><p>Your doctor has been changed due to the doctor's unavailability. Your appointment time will remain the same, but we are assigning a different doctor.</p><p>Thank you,<br/>Humancare Connect</p>`,
      });
    }

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate("patientId", "name email gender city country")
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

    res.status(200).json({ msg: "Doctor reassigned successfully.", appointment: populatedAppointment });
  } catch (error) {
    console.error("reassignAppointmentDoctor error:", error);
    res.status(500).json({ msg: "Failed to reassign doctor." });
  }
};

const getAllAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate("patientId", "name email gender city country")
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
        },
      };
    });

    res.status(200).json(enhancedAppointments);
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

    // Check by participant ID, not by role — works regardless of which
    // cookie/token the shared verifyToken middleware happened to decode first.
    const userId = req.user.id;
    const patientId = appointment.patientId?._id?.toString() ?? appointment.patientId?.toString();
    const doctorId = appointment.doctorId?._id?.toString() ?? appointment.doctorId?.toString();
    const isParticipant = patientId === userId || doctorId === userId;
    const isAdmin = req.user.role === "admin" || req.user.role === "superadmin";

    if (!isParticipant && !isAdmin) {
      return res.status(403).json({ msg: "Access denied." });
    }

    res.status(200).json(appointment);
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
    const owns = await Appointment.exists({ _id: req.params.id, doctorId: req.user.id });
    console.log("[getDoctorOwnAppointment] owns:", owns);
    if (!owns) {
      const apptRaw = await Appointment.findById(req.params.id).select("doctorId").lean();
      console.log("[getDoctorOwnAppointment] appointment.doctorId in DB:", apptRaw?.doctorId?.toString());
      const exists = !!apptRaw;
      if (!exists) return res.status(404).json({ msg: "Appointment not found." });
      return res.status(403).json({ msg: "Access denied." });
    }

    const appointment = await Appointment.findById(req.params.id)
      .populate("patientId", "name email mobile")
      .populate("doctorId", "name email")
      .lean();

    res.status(200).json(appointment);
  } catch (error) {
    console.error("getDoctorOwnAppointment error:", error);
    res.status(500).json({ msg: "Failed to fetch appointment." });
  }
};

// Patient-specific fetch — DB-level ownership check to avoid mixed-role
// session ambiguity when multiple auth cookies/tokens exist in one browser.
const getPatientOwnAppointment = async (req, res) => {
  try {
    const owns = await Appointment.exists({ _id: req.params.id, patientId: req.user.id });
    if (!owns) {
      const apptRaw = await Appointment.findById(req.params.id).select("patientId").lean();
      const exists = !!apptRaw;
      if (!exists) return res.status(404).json({ msg: "Appointment not found." });
      return res.status(403).json({ msg: "Access denied." });
    }

    const appointment = await Appointment.findById(req.params.id)
      .populate("patientId", "name email mobile")
      .populate("doctorId", "name email")
      .lean();

    res.status(200).json(appointment);
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
  reassignAppointmentDoctor,
  getAllAppointments,
  getAppointmentById,
  getDoctorOwnAppointment,
  getPatientOwnAppointment,
  getBookedSlots,
};
