const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const ConsultationNote = require("../models/ConsultationNote");
const User = require("../models/User");

const VALID_STATUSES = new Set(["draft", "final", "archived"]);

const isObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));

const normalizeContent = (value) => String(value ?? "").slice(0, 20000);

const ensureDoctorAppointment = async (appointmentId, doctorId) => {
  if (!isObjectId(appointmentId)) {
    const err = new Error("Invalid appointment ID.");
    err.statusCode = 400;
    throw err;
  }

  const appointment = await Appointment.findOne({
    _id: appointmentId,
    doctorId,
  }).select("_id doctorId patientId date time problem status");

  if (!appointment) {
    const err = new Error("Appointment not found or access denied.");
    err.statusCode = 404;
    throw err;
  }

  return appointment;
};

const populateNote = (query) =>
  query
    .populate("patientId", "name email mobile")
    .populate("appointmentId", "date time problem status")
    .populate("doctorId", "name email");

const handleError = (res, err, fallback) => {
  if (err.statusCode) {
    return res.status(err.statusCode).json({ msg: err.message });
  }
  console.error(fallback, err);
  return res.status(500).json({ msg: fallback });
};

const listNotes = async (req, res) => {
  try {
    const {
      search = "",
      status = "",
      patientId = "",
      appointmentId = "",
      dateFrom = "",
      dateTo = "",
    } = req.query;

    const query = { doctorId: req.user.id };

    if (status && VALID_STATUSES.has(status)) query.status = status;
    if (patientId && isObjectId(patientId)) query.patientId = patientId;
    if (appointmentId && isObjectId(appointmentId)) query.appointmentId = appointmentId;

    if (dateFrom || dateTo) {
      query.updatedAt = {};
      if (dateFrom) query.updatedAt.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
      if (dateTo) query.updatedAt.$lte = new Date(`${dateTo}T23:59:59.999Z`);
    }

    const trimmedSearch = String(search).trim();
    if (trimmedSearch) {
      const matchingPatients = await User.find({
        $or: [
          { name: { $regex: trimmedSearch, $options: "i" } },
          { email: { $regex: trimmedSearch, $options: "i" } },
        ],
      })
        .select("_id")
        .limit(50);

      query.$or = [
        { content: { $regex: trimmedSearch, $options: "i" } },
        { patientId: { $in: matchingPatients.map((patient) => patient._id) } },
      ];
    }

    const notes = await populateNote(
      ConsultationNote.find(query).sort({ updatedAt: -1 }).limit(250),
    );

    res.status(200).json({ notes });
  } catch (err) {
    handleError(res, err, "Failed to fetch consultation notes.");
  }
};

const getAppointmentNote = async (req, res) => {
  try {
    const appointment = await ensureDoctorAppointment(req.params.appointmentId, req.user.id);
    const note = await populateNote(
      ConsultationNote.findOne({
        appointmentId: appointment._id,
        doctorId: req.user.id,
      }),
    );

    res.status(200).json({
      note,
      appointment: {
        _id: appointment._id,
        patientId: appointment.patientId,
        date: appointment.date,
        time: appointment.time,
        problem: appointment.problem,
        status: appointment.status,
      },
    });
  } catch (err) {
    handleError(res, err, "Failed to fetch consultation note.");
  }
};

const upsertAppointmentNote = async (req, res) => {
  try {
    const appointment = await ensureDoctorAppointment(req.params.appointmentId, req.user.id);
    const content = normalizeContent(req.body.content);

    const note = await ConsultationNote.findOneAndUpdate(
      {
        appointmentId: appointment._id,
        doctorId: req.user.id,
      },
      {
        $set: {
          patientId: appointment.patientId,
          content,
        },
        $setOnInsert: {
          appointmentId: appointment._id,
          doctorId: req.user.id,
          status: "draft",
        },
        $inc: { __v: 1 },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    const populated = await populateNote(ConsultationNote.findById(note._id));
    res.status(note.createdAt.getTime() === note.updatedAt.getTime() ? 201 : 200).json({ note: populated });
  } catch (err) {
    handleError(res, err, "Failed to save consultation note.");
  }
};

const updateNote = async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ msg: "Invalid note ID." });
    }

    const updates = {};
    if (Object.prototype.hasOwnProperty.call(req.body, "content")) {
      updates.content = normalizeContent(req.body.content);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "status")) {
      if (!VALID_STATUSES.has(req.body.status)) {
        return res.status(400).json({ msg: "Invalid note status." });
      }
      updates.status = req.body.status;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ msg: "No note changes provided." });
    }

    const query = {
      _id: req.params.id,
      doctorId: req.user.id,
    };

    if (Number.isInteger(req.body.version)) {
      query.__v = req.body.version;
    }

    const note = await ConsultationNote.findOneAndUpdate(
      query,
      { $set: updates, $inc: { __v: 1 } },
      { new: true, runValidators: true },
    );

    if (!note) {
      return res.status(409).json({ msg: "Note was updated elsewhere. Refresh and try again." });
    }

    const populated = await populateNote(ConsultationNote.findById(note._id));
    res.status(200).json({ note: populated });
  } catch (err) {
    handleError(res, err, "Failed to update consultation note.");
  }
};

const deleteNote = async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ msg: "Invalid note ID." });
    }

    const note = await ConsultationNote.findOneAndDelete({
      _id: req.params.id,
      doctorId: req.user.id,
    });

    if (!note) {
      return res.status(404).json({ msg: "Note not found or access denied." });
    }

    return res.status(200).json({ msg: "Note deleted.", noteId: note._id });
  } catch (err) {
    return handleError(res, err, "Failed to delete consultation note.");
  }
};

module.exports = {
  listNotes,
  getAppointmentNote,
  upsertAppointmentNote,
  updateNote,
  deleteNote,
};
