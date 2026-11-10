// routes/tickets.js
const express = require("express");
const router  = express.Router();
const {
  createTicket, getDoctorTickets, getAllTickets,
  createUserTicket, getUserTickets, getAllUserTickets,
  doctorReply, patientReply, adminReplyDoctor, adminReplyPatient,
  closeDoctorTicket, closePatientTicket,
} = require("../controllers/ticketController");
const { verifyUserToken, verifyDoctorToken, verifyAdminToken, adminOnly } = require("../middleware/verifyToken");

// Doctor routes
router.post("/create",     verifyDoctorToken, createTicket);
router.get("/my",          verifyDoctorToken, getDoctorTickets);
router.post("/:id/reply",  verifyDoctorToken, doctorReply);

// Patient/User routes
router.post("/user/create",    verifyUserToken, createUserTicket);
router.get("/user/my",         verifyUserToken, getUserTickets);
router.post("/user/:id/reply", verifyUserToken, patientReply);

// Admin routes. Replying never closes a ticket; only /close does.
router.get("/all",                    verifyAdminToken, adminOnly, getAllTickets);
router.post("/:id/admin-reply",       verifyAdminToken, adminOnly, adminReplyDoctor);
router.put("/:id/close",              verifyAdminToken, adminOnly, closeDoctorTicket);
router.get("/user/all",               verifyAdminToken, adminOnly, getAllUserTickets);
router.post("/user/:id/admin-reply",  verifyAdminToken, adminOnly, adminReplyPatient);
router.put("/user/:id/close",         verifyAdminToken, adminOnly, closePatientTicket);

// Older name for "close", kept so existing clients keep working (same handler, same rules).
router.put("/:id/resolve",       verifyAdminToken, adminOnly, closeDoctorTicket);
router.put("/user/:id/resolve",  verifyAdminToken, adminOnly, closePatientTicket);

module.exports = router;
