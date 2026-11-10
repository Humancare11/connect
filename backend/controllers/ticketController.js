// controllers/ticketController.js
//
// Two collections, same behaviour: Ticket (doctors) and UserTicket (patients).
// A ticket is a conversation: the raiser and an admin exchange messages, and the ticket stays
// open until an admin explicitly closes it (replying never closes it).
const mongoose   = require("mongoose");
const Ticket     = require("../models/Ticket");
const UserTicket = require("../models/UserTicket");
const { notifyAdminSupportTicketCreated } = require("../utils/adminNotifications");
const { notifyAdminsByEmailTicketRaised } = require("../utils/ticketNotifications");
const {
  validTimeZone, serializeTicket, cleanReply, appendReply, closeTicket,
} = require("../utils/ticketThread");

const SERVER_ERROR = { message: "Server error." };
const isId = (id) => mongoose.isValidObjectId(id);
const forAdmin = (t) => serializeTicket(t);
const forUser  = (t) => serializeTicket(t, { forUser: true });

const withAdminRefs = (query) =>
  query.populate("createdBy", "name email").populate("resolvedBy", "name email").populate("closedBy", "name email");

// Create a ticket (for doctors)
const createTicket = async (req, res) => {
  try {
    const { title, description, category, userTimezone } = req.body;
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
      ...(category ? { category } : {}),
      userTimezone: validTimeZone(userTimezone) ? userTimezone : "",
      messages: [{ sender: "user", text: description, createdAt: new Date() }],
      createdBy: doctorId,
    });

    res.status(201).json({
      message: "Ticket created successfully.",
      ticket: forUser(ticket),
    });
    // After the response: both never throw. In-app notification is deduplicated per ticket.
    void notifyAdminSupportTicketCreated({ ticket, source: "doctor" });
    void notifyAdminsByEmailTicketRaised({ ticket, source: "doctor" });
  } catch (error) {
    console.error(error);
    res.status(500).json(SERVER_ERROR);
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

    res.json(tickets.map(forUser));
  } catch (error) {
    console.error(error);
    res.status(500).json(SERVER_ERROR);
  }
};

// Get all tickets (for admin)
const getAllTickets = async (req, res) => {
  try {
    const tickets = await withAdminRefs(Ticket.find({})).sort({ createdAt: -1 });
    res.json(tickets.map(forAdmin));
  } catch (error) {
    console.error(error);
    res.status(500).json(SERVER_ERROR);
  }
};

// Create a ticket (for users/patients)
const createUserTicket = async (req, res) => {
  try {
    const { title, description, category, userTimezone } = req.body;
    if (!title || !description) {
      return res.status(400).json({ message: "Title and description are required." });
    }
    const ticket = await UserTicket.create({
      title,
      description,
      category: category || "other",
      userTimezone: validTimeZone(userTimezone) ? userTimezone : "",
      messages: [{ sender: "user", text: description, createdAt: new Date() }],
      createdBy: req.user.id,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`patient_${req.user.id}`).emit("ticket-created", forUser(ticket));
      io.to("admin_room").emit("user-ticket-created", forUser(ticket));
    }

    res.status(201).json({ message: "Ticket submitted successfully.", ticket: forUser(ticket) });
    // After the response: both never throw. In-app notification is deduplicated per ticket.
    void notifyAdminSupportTicketCreated({ ticket, source: "patient" });
    void notifyAdminsByEmailTicketRaised({ ticket, source: "patient" });
  } catch (error) {
    console.error(error);
    res.status(500).json(SERVER_ERROR);
  }
};

// Get tickets for the logged-in user/patient
const getUserTickets = async (req, res) => {
  try {
    const tickets = await UserTicket.find({ createdBy: req.user.id }).sort({ createdAt: -1 });
    res.json(tickets.map(forUser));
  } catch (error) {
    console.error(error);
    res.status(500).json(SERVER_ERROR);
  }
};

// Get all user tickets (for admin)
const getAllUserTickets = async (req, res) => {
  try {
    const tickets = await withAdminRefs(UserTicket.find({})).sort({ createdAt: -1 });
    res.json(tickets.map(forAdmin));
  } catch (error) {
    console.error(error);
    res.status(500).json(SERVER_ERROR);
  }
};

const replyFailure = (res, outcome) =>
  outcome.status === 404
    ? res.status(404).json({ message: "Ticket not found." })
    : res.status(409).json({ message: "This ticket is resolved. Please raise a new ticket if you still need help." });

// ── Reply by the person who raised the ticket (own tickets only) ──────────────
const userReply = (Model, room) => async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "Ticket not found." });
    const text = cleanReply(req.body?.text);
    if (!text) return res.status(400).json({ message: "Reply text is required." });

    const outcome = await appendReply(Model, { _id: req.params.id, createdBy: req.user.id }, "user", text);
    if (outcome.status !== 200) return replyFailure(res, outcome);

    const io = req.app.get("io");
    if (io) io.to("admin_room").emit("ticket-reply", { kind: room, ticketId: String(outcome.ticket._id) });
    res.status(201).json({ message: "Reply sent.", ticket: forUser(outcome.ticket) });
  } catch (error) {
    console.error(error);
    res.status(500).json(SERVER_ERROR);
  }
};

// ── Reply by an admin. Does NOT close the ticket ──────────────────────────────
const adminReply = (Model, room) => async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "Ticket not found." });
    const text = cleanReply(req.body?.text);
    if (!text) return res.status(400).json({ message: "Reply text is required." });

    const outcome = await appendReply(Model, { _id: req.params.id }, "admin", text);
    if (outcome.status !== 200) return replyFailure(res, outcome);

    const io = req.app.get("io");
    if (io && outcome.ticket.createdBy) {
      io.to(`${room}_${outcome.ticket.createdBy.toString()}`).emit("ticket-updated", forUser(outcome.ticket));
    }
    const populated = await withAdminRefs(Model.findById(outcome.ticket._id));
    res.status(201).json({ message: "Reply sent.", ticket: forAdmin(populated) });
  } catch (error) {
    console.error(error);
    res.status(500).json(SERVER_ERROR);
  }
};

// ── Close a ticket (admin only). The only way a ticket becomes resolved ───────
// `resolution` is optional and kept for older clients: when sent it is added as a last admin message.
const adminClose = (Model, room) => async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "Ticket not found." });
    const note = cleanReply(req.body?.resolution);
    const outcome = await closeTicket(Model, req.params.id, req.user.id, note);
    if (outcome.status === 404) return res.status(404).json({ message: "Ticket not found." });
    if (outcome.status === 409) return res.status(409).json({ message: "Ticket is already closed." });

    const io = req.app.get("io");
    if (io && outcome.ticket.createdBy) {
      io.to(`${room}_${outcome.ticket.createdBy.toString()}`).emit("ticket-updated", forUser(outcome.ticket));
    }
    const populated = await withAdminRefs(Model.findById(outcome.ticket._id));
    res.json({ message: "Ticket closed successfully.", ticket: forAdmin(populated) });
  } catch (error) {
    console.error(error);
    res.status(500).json(SERVER_ERROR);
  }
};

module.exports = {
  createTicket,
  getDoctorTickets,
  getAllTickets,
  createUserTicket,
  getUserTickets,
  getAllUserTickets,
  doctorReply:      userReply(Ticket, "doctor"),
  patientReply:     userReply(UserTicket, "patient"),
  adminReplyDoctor: adminReply(Ticket, "doctor"),
  adminReplyPatient: adminReply(UserTicket, "patient"),
  closeDoctorTicket:  adminClose(Ticket, "doctor"),
  closePatientTicket: adminClose(UserTicket, "patient"),
};
