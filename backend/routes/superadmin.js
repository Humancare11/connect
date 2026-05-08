const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { verifyAdminToken, superAdminOnly } = require("../middleware/verifyToken");

// GET /api/superadmin/admins — list all admins
router.get("/admins", verifyAdminToken, superAdminOnly, async (req, res) => {
  try {
    const admins = await User.find({ role: "admin" })
      .select("-password")
      .sort({ createdAt: -1 });
    res.json(admins);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// POST /api/superadmin/admins — create a new admin
router.post("/admins", verifyAdminToken, superAdminOnly, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ msg: "Name, email and password are required." });

    if (password.length < 6)
      return res.status(400).json({ msg: "Password must be at least 6 characters." });

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists)
      return res.status(409).json({ msg: "This email is already registered." });

    const hashed = await bcrypt.hash(password, 10);
    const admin = await User.create({
      name,
      email: email.toLowerCase().trim(),
      password: hashed,
      role: "admin",
    });

    res.status(201).json({
      msg: "Admin created successfully.",
      admin: { _id: admin._id, name: admin.name, email: admin.email, role: admin.role, createdAt: admin.createdAt },
    });
  } catch (err) {
    console.error("create admin error:", err);
    if (err.code === 11000) return res.status(409).json({ msg: "This email is already registered." });
    res.status(500).json({ msg: "Server error" });
  }
});

// DELETE /api/superadmin/admins/:id — remove an admin
router.delete("/admins/:id", verifyAdminToken, superAdminOnly, async (req, res) => {
  try {
    const admin = await User.findOneAndDelete({ _id: req.params.id, role: "admin" });
    if (!admin) return res.status(404).json({ msg: "Admin not found." });
    res.json({ msg: "Admin removed." });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
