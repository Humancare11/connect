const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { verifyAdminToken, superAdminOnly } = require("../middleware/verifyToken");
const { assertPasswordAllowed, rememberPassword } = require("../utils/passwordPolicy");
const { revokeUserSessions } = require("../utils/tokenRevocation");

const MANAGED_ADMIN_ROLES = ["admin", "paymentadmin"];
const MANAGED_EA_ROLES = ["employeeadmin"];

// GET /api/superadmin/admins — list all admins
router.get("/admins", verifyAdminToken, superAdminOnly, async (req, res) => {
  try {
    const admins = await User.find({ role: { $in: MANAGED_ADMIN_ROLES } })
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
    const { name, email, password, role = "admin" } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ msg: "Name, email and password are required." });
    if (!MANAGED_ADMIN_ROLES.includes(role))
      return res.status(400).json({ msg: "Invalid admin role." });

    const passwordCheck = await assertPasswordAllowed({ userType: "user", password });
    if (!passwordCheck.valid)
      return res.status(400).json({ msg: passwordCheck.errors.join(" ") });

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists)
      return res.status(409).json({ msg: "This email is already registered." });

    const hashed = await bcrypt.hash(password, 10);
    const admin = await User.create({
      name,
      email: email.toLowerCase().trim(),
      password: hashed,
      role,
    });
    await rememberPassword({ userId: admin._id, userType: "user", passwordHash: hashed });

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
    const admin = await User.findOneAndDelete({ _id: req.params.id, role: { $in: MANAGED_ADMIN_ROLES } });
    if (!admin) return res.status(404).json({ msg: "Admin not found." });
    await revokeUserSessions(admin._id, "account_disabled");
    res.json({ msg: "Admin removed." });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// ── Employee Admin CRUD ───────────────────────────────────────────────────────

// GET /api/superadmin/employee-admins — list all employee admins
router.get("/employee-admins", verifyAdminToken, superAdminOnly, async (req, res) => {
  try {
    const employees = await User.find({ role: { $in: MANAGED_EA_ROLES } })
      .select("-password")
      .sort({ createdAt: -1 });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// POST /api/superadmin/employee-admins — create a new employee admin
router.post("/employee-admins", verifyAdminToken, superAdminOnly, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ msg: "Name, email, and password are required." });

    const passwordCheck = await assertPasswordAllowed({ userType: "user", password });
    if (!passwordCheck.valid)
      return res.status(400).json({ msg: passwordCheck.errors.join(" ") });

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists)
      return res.status(409).json({ msg: "This email is already registered." });

    const hashed = await bcrypt.hash(password, 10);
    const employee = await User.create({
      name,
      email: email.toLowerCase().trim(),
      password: hashed,
      role: "employeeadmin",
    });
    await rememberPassword({ userId: employee._id, userType: "user", passwordHash: hashed });

    res.status(201).json({
      msg: "Employee Admin created successfully.",
      employee: {
        _id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        accountDisabled: employee.accountDisabled,
        createdAt: employee.createdAt,
      },
    });
  } catch (err) {
    console.error("create employee admin error:", err);
    if (err.code === 11000) return res.status(409).json({ msg: "This email is already registered." });
    res.status(500).json({ msg: "Server error" });
  }
});

// PUT /api/superadmin/employee-admins/:id — update name and/or email
router.put("/employee-admins/:id", verifyAdminToken, superAdminOnly, async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name && !email)
      return res.status(400).json({ msg: "At least one field (name or email) is required." });

    const employee = await User.findOne({ _id: req.params.id, role: { $in: MANAGED_EA_ROLES } });
    if (!employee) return res.status(404).json({ msg: "Employee Admin not found." });

    if (name) employee.name = name.trim();
    if (email) {
      const clean = email.toLowerCase().trim();
      const conflict = await User.findOne({ email: clean, _id: { $ne: employee._id } });
      if (conflict) return res.status(409).json({ msg: "This email is already in use." });
      employee.email = clean;
    }

    await employee.save();
    res.json({
      msg: "Employee Admin updated.",
      employee: {
        _id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        accountDisabled: employee.accountDisabled,
        createdAt: employee.createdAt,
      },
    });
  } catch (err) {
    console.error("update employee admin error:", err);
    if (err.code === 11000) return res.status(409).json({ msg: "This email is already in use." });
    res.status(500).json({ msg: "Server error" });
  }
});

// PUT /api/superadmin/employee-admins/:id/toggle-disable — enable or disable account
router.put("/employee-admins/:id/toggle-disable", verifyAdminToken, superAdminOnly, async (req, res) => {
  try {
    const employee = await User.findOne({ _id: req.params.id, role: { $in: MANAGED_EA_ROLES } });
    if (!employee) return res.status(404).json({ msg: "Employee Admin not found." });

    employee.accountDisabled = !employee.accountDisabled;
    employee.disabledAt = employee.accountDisabled ? new Date() : null;
    employee.disabledReason = employee.accountDisabled ? "Disabled by Super Admin" : "";
    await employee.save();

    if (employee.accountDisabled) {
      await revokeUserSessions(employee._id, "account_disabled");
    }

    res.json({
      msg: employee.accountDisabled ? "Employee Admin disabled." : "Employee Admin enabled.",
      accountDisabled: employee.accountDisabled,
    });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// DELETE /api/superadmin/employee-admins/:id — remove an employee admin
router.delete("/employee-admins/:id", verifyAdminToken, superAdminOnly, async (req, res) => {
  try {
    const employee = await User.findOneAndDelete({ _id: req.params.id, role: { $in: MANAGED_EA_ROLES } });
    if (!employee) return res.status(404).json({ msg: "Employee Admin not found." });
    await revokeUserSessions(employee._id, "account_disabled");
    res.json({ msg: "Employee Admin removed." });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
