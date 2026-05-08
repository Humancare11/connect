// controllers/ticketController.js
const Ticket     = require("../models/Ticket");
const UserTicket = require("../models/UserTicket");
const Doctor     = require("../models/Doctor");
const User       = require("../models/User");

// Create a ticket (for doctors)
const createTicket = async (req, res) => {
  try {
    const { title, description } = req.body;
    const doctorId = req.user.id;

    if (req.user.role !== "doctor") {
      return res.status(403).json({ message: "Access denied. Doctors only." });
    }

    if (!title || !description) {
      return res.status(400).json({ message: "Title and description are required." });
    }

    const ticket = await Ticket.create({
      title,
      description,
      createdBy: doctorId,
    });

    res.status(201).json({
      message: "Ticket created successfully.",
      ticket,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
};

// Get tickets for the logged-in doctor
const getDoctorTickets = async (req, res) => {
  try {
    const doctorId = req.user.id;

    if (req.user.role !== "doctor") {
      return res.status(403).json({ message: "Access denied. Doctors only." });
    }

    const tickets = await Ticket.find({ createdBy: doctorId }).sort({ createdAt: -1 });

    res.json(tickets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
};

// Get all tickets (for admin)
const getAllTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({})
      .populate("createdBy", "name email")
      .populate("resolvedBy", "name email")
      .sort({ createdAt: -1 });

    res.json(tickets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
};

// Resolve a ticket (for admin)
const resolveTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution } = req.body;
    const adminId = req.user.id; // Assuming req.user for admin

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found." });
    }

    ticket.status = "resolved";
    ticket.resolvedBy = adminId;
    ticket.resolution = resolution || "";

    await ticket.save();

    res.json({
      message: "Ticket resolved successfully.",
      ticket,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
};

// Create a ticket (for users/patients)
const createUserTicket = async (req, res) => {
  try {
    const { title, description, category } = req.body;
    if (!title || !description) {
      return res.status(400).json({ message: "Title and description are required." });
    }
    const ticket = await UserTicket.create({
      title,
      description,
      category: category || "other",
      createdBy: req.user.id,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`patient_${req.user.id}`).emit("ticket-created", ticket);
      io.to("admin_room").emit("user-ticket-created", ticket);
    }

    res.status(201).json({ message: "Ticket submitted successfully.", ticket });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
};

// Get tickets for the logged-in user/patient
const getUserTickets = async (req, res) => {
  try {
    const tickets = await UserTicket.find({ createdBy: req.user.id }).sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
};

// Get all user tickets (for admin)
const getAllUserTickets = async (req, res) => {
  try {
    const tickets = await UserTicket.find({})
      .populate("createdBy", "name email")
      .populate("resolvedBy", "name email")
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
};

// Resolve a user ticket (for admin)
const resolveUserTicket = async (req, res) => {
  try {
    const ticket = await UserTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found." });
    ticket.status     = "resolved";
    ticket.resolvedBy = req.user.id;
    ticket.resolution = req.body.resolution || "";
    await ticket.save();

    const io = req.app.get("io");
    if (io && ticket.createdBy) {
      io.to(`patient_${ticket.createdBy.toString()}`).emit("ticket-updated", ticket);
    }

    res.json({ message: "Ticket resolved successfully.", ticket });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
};

module.exports = {
  createTicket,
  getDoctorTickets,
  getAllTickets,
  resolveTicket,
  createUserTicket,
  getUserTickets,
  getAllUserTickets,
  resolveUserTicket,
};
