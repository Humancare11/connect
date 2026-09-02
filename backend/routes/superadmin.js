const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Partner = require("../models/Partner");
const PartnerCase = require("../models/PartnerCase");
const { verifyAdminToken, superAdminOnly } = require("../middleware/verifyToken");
const { assertPasswordAllowed, rememberPassword } = require("../utils/passwordPolicy");
const { revokeUserSessions } = require("../utils/tokenRevocation");
const { generatePartnerCode } = require("../utils/idSequence");

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

// ── Partner Company management (Super Admin only) ─────────────────────────────

const str = (v) => String(v == null ? "" : v).trim();

const partnerCompanyView = (company, extra = {}) => ({
  _id: company._id,
  partnerCode: company.partnerCode,
  companyName: company.companyName,
  slug: company.slug,
  contactPersonName: company.contactPersonName,
  contactEmail: company.contactEmail,
  contactPhone: company.contactPhone,
  country: company.country,
  address: company.address,
  billingCurrency: company.billingCurrency,
  status: company.status,
  deactivatedAt: company.deactivatedAt,
  createdAt: company.createdAt,
  updatedAt: company.updatedAt,
  ...extra,
});

const partnerUserView = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  accountDisabled: user.accountDisabled,
  createdAt: user.createdAt,
});

async function uniquePartnerSlug(companyName) {
  const base =
    str(companyName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "partner";
  let slug = base;
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await Partner.exists({ slug })) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

// GET /api/superadmin/partners — list companies with account + case counts
router.get("/partners", verifyAdminToken, superAdminOnly, async (req, res) => {
  try {
    const companies = await Partner.find().sort({ createdAt: -1 }).lean();
    const ids = companies.map((c) => c._id);
    const [userRows, caseRows] = await Promise.all([
      User.aggregate([
        { $match: { role: "partner", partner: { $in: ids } } },
        { $group: { _id: "$partner", count: { $sum: 1 } } },
      ]),
      PartnerCase.aggregate([
        { $match: { partner: { $in: ids } } },
        { $group: { _id: "$partner", count: { $sum: 1 } } },
      ]),
    ]);
    const userCounts = Object.fromEntries(userRows.map((r) => [String(r._id), r.count]));
    const caseCounts = Object.fromEntries(caseRows.map((r) => [String(r._id), r.count]));

    res.json(
      companies.map((c) =>
        partnerCompanyView(c, {
          userCount: userCounts[String(c._id)] || 0,
          caseCount: caseCounts[String(c._id)] || 0,
        })
      )
    );
  } catch (err) {
    console.error("list partners error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// GET /api/superadmin/partners/:id — one company + its login account(s)
router.get("/partners/:id", verifyAdminToken, superAdminOnly, async (req, res) => {
  try {
    const company = await Partner.findById(req.params.id).lean();
    if (!company) return res.status(404).json({ msg: "Partner Company not found." });
    const users = await User.find({ role: "partner", partner: company._id })
      .select("-password")
      .sort({ createdAt: 1 })
      .lean();
    res.json(partnerCompanyView(company, { users: users.map(partnerUserView) }));
  } catch (err) {
    console.error("get partner error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// POST /api/superadmin/partners — create a company AND its login account
router.post("/partners", verifyAdminToken, superAdminOnly, async (req, res) => {
  let createdCompany = null;
  try {
    const companyName = str(req.body.companyName);
    const loginEmail = str(req.body.loginEmail).toLowerCase();
    const password = String(req.body.password || "");

    if (!companyName || !loginEmail || !password) {
      return res.status(400).json({ msg: "Company name, login email, and password are required." });
    }
    if (!/^\S+@\S+\.\S+$/.test(loginEmail)) {
      return res.status(400).json({ msg: "Enter a valid login email." });
    }

    const passwordCheck = await assertPasswordAllowed({ userType: "user", password });
    if (!passwordCheck.valid) return res.status(400).json({ msg: passwordCheck.errors.join(" ") });

    if (await User.findOne({ email: loginEmail })) {
      return res.status(409).json({ msg: "This login email is already registered." });
    }

    const partnerCode = await generatePartnerCode();
    const slug = await uniquePartnerSlug(companyName);

    createdCompany = await Partner.create({
      partnerCode,
      companyName,
      slug,
      contactPersonName: str(req.body.contactPersonName),
      contactEmail: str(req.body.contactEmail).toLowerCase(),
      contactPhone: str(req.body.contactPhone),
      country: str(req.body.country),
      address: str(req.body.address),
      billingCurrency: str(req.body.billingCurrency).toLowerCase() || "usd",
      status: "active",
      createdBy: req.user.id,
    });

    let account;
    try {
      const hashed = await bcrypt.hash(password, 10);
      account = await User.create({
        name: companyName,
        email: loginEmail,
        password: hashed,
        role: "partner",
        partner: createdCompany._id,
      });
      await rememberPassword({ userId: account._id, userType: "user", passwordHash: hashed });
    } catch (accountErr) {
      // Compensating rollback — never leave a company without a login.
      await Partner.findByIdAndDelete(createdCompany._id).catch(() => {});
      if (accountErr.code === 11000) {
        return res.status(409).json({ msg: "This login email is already registered." });
      }
      throw accountErr;
    }

    res.status(201).json({
      msg: "Partner Company created successfully.",
      partner: partnerCompanyView(createdCompany.toObject(), {
        userCount: 1,
        caseCount: 0,
        users: [partnerUserView(account)],
      }),
    });
  } catch (err) {
    console.error("create partner error:", err);
    if (err.code === 11000) return res.status(409).json({ msg: "A conflicting record already exists." });
    res.status(500).json({ msg: "Server error" });
  }
});

// PUT /api/superadmin/partners/:id — edit company profile (not status/credentials)
router.put("/partners/:id", verifyAdminToken, superAdminOnly, async (req, res) => {
  try {
    const company = await Partner.findById(req.params.id);
    if (!company) return res.status(404).json({ msg: "Partner Company not found." });

    const editable = [
      "companyName",
      "contactPersonName",
      "contactEmail",
      "contactPhone",
      "country",
      "address",
      "billingCurrency",
    ];
    for (const field of editable) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        let value = str(req.body[field]);
        if (field === "contactEmail" || field === "billingCurrency") value = value.toLowerCase();
        if (field === "companyName" && !value) {
          return res.status(400).json({ msg: "Company name cannot be empty." });
        }
        company[field] = value;
      }
    }
    await company.save();
    res.json({ msg: "Partner Company updated.", partner: partnerCompanyView(company.toObject()) });
  } catch (err) {
    console.error("update partner error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// PUT /api/superadmin/partners/:id/login — update login name/email or reset password
router.put("/partners/:id/login", verifyAdminToken, superAdminOnly, async (req, res) => {
  try {
    const company = await Partner.findById(req.params.id).lean();
    if (!company) return res.status(404).json({ msg: "Partner Company not found." });

    const account = await User.findOne({ role: "partner", partner: company._id }).sort({ createdAt: 1 });
    if (!account) return res.status(404).json({ msg: "Partner login account not found." });

    const name = str(req.body.name);
    const email = str(req.body.email).toLowerCase();
    const password = req.body.password ? String(req.body.password) : "";

    if (name) account.name = name;
    if (email) {
      if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ msg: "Enter a valid email." });
      const conflict = await User.findOne({ email, _id: { $ne: account._id } });
      if (conflict) return res.status(409).json({ msg: "This email is already in use." });
      account.email = email;
    }

    let passwordReset = false;
    if (password) {
      const passwordCheck = await assertPasswordAllowed({
        userId: account._id,
        userType: "user",
        password,
        currentHash: account.password,
      });
      if (!passwordCheck.valid) return res.status(400).json({ msg: passwordCheck.errors.join(" ") });
      const hashed = await bcrypt.hash(password, 10);
      account.password = hashed;
      passwordReset = true;
      await rememberPassword({ userId: account._id, userType: "user", passwordHash: hashed });
    }

    await account.save();
    if (passwordReset || email) await revokeUserSessions(account._id, "credentials_changed");

    res.json({ msg: "Partner login updated.", user: partnerUserView(account) });
  } catch (err) {
    console.error("update partner login error:", err);
    if (err.code === 11000) return res.status(409).json({ msg: "This email is already in use." });
    res.status(500).json({ msg: "Server error" });
  }
});

// PUT /api/superadmin/partners/:id/toggle-status — activate / deactivate a company
router.put("/partners/:id/toggle-status", verifyAdminToken, superAdminOnly, async (req, res) => {
  try {
    const company = await Partner.findById(req.params.id);
    if (!company) return res.status(404).json({ msg: "Partner Company not found." });

    company.status = company.status === "active" ? "inactive" : "active";
    company.deactivatedAt = company.status === "inactive" ? new Date() : null;
    company.deactivatedReason =
      company.status === "inactive" ? str(req.body.reason) || "Deactivated by Super Admin" : "";
    await company.save();

    if (company.status === "inactive") {
      const accounts = await User.find({ role: "partner", partner: company._id }).select("_id").lean();
      await Promise.all(accounts.map((a) => revokeUserSessions(a._id, "account_disabled")));
    }

    res.json({
      msg: company.status === "active" ? "Partner Company activated." : "Partner Company deactivated.",
      status: company.status,
    });
  } catch (err) {
    console.error("toggle partner status error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// DELETE /api/superadmin/partners/:id — remove a company (only if it has no cases)
router.delete("/partners/:id", verifyAdminToken, superAdminOnly, async (req, res) => {
  try {
    const company = await Partner.findById(req.params.id);
    if (!company) return res.status(404).json({ msg: "Partner Company not found." });

    if (await PartnerCase.exists({ partner: company._id })) {
      return res
        .status(409)
        .json({ msg: "This company has submitted cases. Deactivate it instead of deleting." });
    }

    const accounts = await User.find({ role: "partner", partner: company._id }).select("_id").lean();
    await Promise.all(accounts.map((a) => revokeUserSessions(a._id, "account_disabled")));
    await User.deleteMany({ role: "partner", partner: company._id });
    await Partner.findByIdAndDelete(company._id);

    res.json({ msg: "Partner Company removed." });
  } catch (err) {
    console.error("delete partner error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
