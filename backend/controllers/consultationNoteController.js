const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const Enrollment = require("../models/Enrollment");
const ConsultationNote = require("../models/ConsultationNote");
const User = require("../models/User");
const { FieldError, readFields, pickFieldUpdates, encryptFields } = require("../utils/consultationNoteFields");

const VALID_STATUSES = new Set(["draft", "final", "archived"]);

const isObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));

const CATEGORY_CONSULTATION_STATUS_MAP = {
  pending: "pending",
  assigned: "assigned",
  confirmed: "confirmed",
  completed: "complete",
  complete: "complete",
  cancelled: "cancelled",
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

const normalizeCategoryConsultation = (cc, doctorId) => ({
  _id: cc._id,
  doctorId,
  patientId: cc.patientId,
  date: cc.date,
  time: resolveCategoryConsultationTime(cc),
  problem: cc.concern,
  status: CATEGORY_CONSULTATION_STATUS_MAP[String(cc.status || "").toLowerCase()] || "pending",
  appointmentModel: "CategoryConsultation",
});

// Consultations can originate from two collections: the classic Appointment
// booking (doctorId set directly on the document) or a CategoryConsultation
// booking (assigned to a doctor indirectly via Enrollment). Both are valid
// consultations a doctor can take notes on, so we check both and return a
// normalized shape the rest of this controller can treat uniformly.
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

  if (appointment) {
    return { ...appointment.toObject(), appointmentModel: "Appointment" };
  }

  const enrollment = await Enrollment.findOne({ doctorId }).select("_id");
  if (enrollment) {
    const categoryConsultation = await CategoryConsultation.findOne({
      _id: appointmentId,
      assignedDoctorId: enrollment._id,
    }).select("_id patientId date slot assignedSlot appointmentType urgency concern status");

    if (categoryConsultation) {
      return normalizeCategoryConsultation(categoryConsultation, doctorId);
    }
  }

  const err = new Error("Appointment not found or access denied.");
  err.statusCode = 404;
  throw err;
};

const populateNote = (query) =>
  query
    .populate("patientId", "name email mobile")
    .populate("appointmentId", "date time problem status slot concern")
    .populate("doctorId", "name email");

// CategoryConsultation documents use different field names (slot/concern)
// than Appointment (time/problem). Fold them onto the common names so
// consumers of a populated note never need to know which collection it
// came from. Clinical text is decrypted here and the cipher blob never leaves the server.
const normalizeNote = (note) => {
  if (!note) return note;
  const fields = readFields(note);
  const plain = note.toObject({ getters: true });
  const populatedAppointment = plain.appointmentId;
  if (populatedAppointment && plain.appointmentModel === "CategoryConsultation") {
    populatedAppointment.time = populatedAppointment.time ?? populatedAppointment.slot;
    populatedAppointment.problem = populatedAppointment.problem ?? populatedAppointment.concern;
  }
  delete plain.cipherText;
  delete plain.iv;
  delete plain.authTag;
  delete plain.keyVersion;
  delete plain.content;
  return { ...plain, ...fields, finalised: !!plain.reportId };
};

const handleError = (res, err, fallback) => {
  if (err.statusCode) {
    return res.status(err.statusCode).json({ msg: err.message });
  }
  console.error(fallback, err);
  return res.status(500).json({ msg: fallback });
};

const lockedError = () => new FieldError("This note is finalised into a Visit Note and can no longer be edited.", 409);

const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

    // Note text is encrypted at rest, so search is by patient name / email only.
    const trimmedSearch = String(search).trim();
    if (trimmedSearch) {
      const escaped = escapeRegex(trimmedSearch);
      const matchingPatients = await User.find({
        $or: [
          { name: { $regex: escaped, $options: "i" } },
          { email: { $regex: escaped, $options: "i" } },
        ],
      })
        .select("_id")
        .limit(50);

      const ids = matchingPatients.map((patient) => patient._id);
      query.patientId = query.patientId
        ? { $in: ids.filter((id) => String(id) === String(query.patientId)) }
        : { $in: ids };
    }

    const notes = await populateNote(
      ConsultationNote.find(query).sort({ updatedAt: -1 }).limit(250),
    );

    res.status(200).json({ notes: notes.map(normalizeNote) });
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
      note: normalizeNote(note),
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

// Read-merge-write of the encrypted blob, guarded by the document version so two concurrent auto-saves (e.g. the
// call panel and the Notes page, or two fields saved at once) never silently drop each other's changes.
const saveFields = async (noteId, doctorId, updates, extra = {}) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await ConsultationNote.findOne({ _id: noteId, doctorId });
    if (!current) throw new FieldError("Note not found or access denied.", 404);
    if (current.reportId) throw lockedError();
    const merged = { ...readFields(current), ...updates };
    const result = await ConsultationNote.updateOne(
      { _id: noteId, doctorId, __v: current.__v, reportId: null },
      { $set: { ...encryptFields(merged), ...extra }, $inc: { __v: 1 } },
    );
    if (result.modifiedCount === 1) return;
  }
  throw new FieldError("Note was updated elsewhere. Refresh and try again.", 409);
};

const upsertAppointmentNote = async (req, res) => {
  try {
    const appointment = await ensureDoctorAppointment(req.params.appointmentId, req.user.id);
    const updates = pickFieldUpdates(req.body);

    let note = await ConsultationNote.findOne({ appointmentId: appointment._id, doctorId: req.user.id });
    let created = false;
    if (!note) {
      try {
        note = await ConsultationNote.create({
          appointmentId: appointment._id,
          appointmentModel: appointment.appointmentModel,
          doctorId: req.user.id,
          patientId: appointment.patientId,
          status: "draft",
          ...encryptFields(updates),
        });
        created = true;
      } catch (err) {
        if (err?.code !== 11000) throw err;
        note = await ConsultationNote.findOne({ appointmentId: appointment._id, doctorId: req.user.id });
      }
    }
    if (!created) await saveFields(note._id, req.user.id, updates, { patientId: appointment.patientId });

    const populated = await populateNote(ConsultationNote.findById(note._id));
    res.status(created ? 201 : 200).json({ note: normalizeNote(populated) });
  } catch (err) {
    handleError(res, err, "Failed to save consultation note.");
  }
};

const updateNote = async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ msg: "Invalid note ID." });
    }

    const updates = pickFieldUpdates(req.body);
    let status;
    if (Object.prototype.hasOwnProperty.call(req.body, "status")) {
      if (!VALID_STATUSES.has(req.body.status)) {
        return res.status(400).json({ msg: "Invalid note status." });
      }
      status = req.body.status;
    }

    if (Object.keys(updates).length === 0 && status === undefined) {
      return res.status(400).json({ msg: "No note changes provided." });
    }

    const existing = await ConsultationNote.findOne({ _id: req.params.id, doctorId: req.user.id }).select("status reportId");
    if (!existing) return res.status(404).json({ msg: "Note not found or access denied." });
    if (existing.reportId) throw lockedError();
    // A note only becomes final through Review & Finalise (POST /api/consultation-reports).
    if (status === "final" && existing.status !== "final") {
      return res.status(400).json({ msg: "Use Review & Finalise to add this note to a Visit Note." });
    }

    await saveFields(req.params.id, req.user.id, updates, status ? { status } : {});
    const populated = await populateNote(ConsultationNote.findById(req.params.id));
    res.status(200).json({ note: normalizeNote(populated) });
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
      reportId: null,
    });

    if (!note) {
      return res.status(404).json({ msg: "Note not found, already finalised, or access denied." });
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
  ensureDoctorAppointment,
};
