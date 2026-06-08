// routes/tickets.js
const express = require("express");
const router  = express.Router();
const {
  createTicket, getDoctorTickets, getAllTickets, resolveTicket,
  createUserTicket, getUserTickets, getAllUserTickets, resolveUserTicket,
} = require("../controllers/ticketController");
const { verifyUserToken, verifyDoctorToken, verifyAdminToken, adminOnly } = require("../middleware/verifyToken");

// Doctor routes
router.post("/create", verifyDoctorToken, createTicket);
router.get("/my",      verifyDoctorToken, getDoctorTickets);

// Patient/User routes
router.post("/user/create", verifyUserToken, createUserTicket);
router.get("/user/my",      verifyUserToken, getUserTickets);

// Admin routes
router.get("/all",           verifyAdminToken, adminOnly, getAllTickets);
router.put("/:id/resolve",   verifyAdminToken, adminOnly, resolveTicket);
router.get("/user/all",      verifyAdminToken, adminOnly, getAllUserTickets);
router.put("/user/:id/resolve", verifyAdminToken, adminOnly, resolveUserTicket);

module.exports = router;
