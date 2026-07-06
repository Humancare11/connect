const express = require("express");
const router = express.Router();
const { verifyDoctorToken } = require("../middleware/verifyToken");
const {
  listNotes,
  getAppointmentNote,
  upsertAppointmentNote,
  updateNote,
  deleteNote,
} = require("../controllers/consultationNoteController");

router.use(verifyDoctorToken);

router.get("/", listNotes);
router.get("/appointment/:appointmentId", getAppointmentNote);
router.put("/appointment/:appointmentId", upsertAppointmentNote);
router.patch("/:id", updateNote);
router.delete("/:id", deleteNote);

module.exports = router;
