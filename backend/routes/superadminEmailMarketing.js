const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const { verifyAdminToken, superAdminOnly } = require("../middleware/verifyToken");
const { marketingEnabledGate } = require("../middleware/marketingAccess");

// Super Admin only: who may use Email Marketing. The flag lives on the admin's user record
// (User.emailMarketingAccess, default false). A Super Admin always has access and is not listed here.
//
// Options exist so tests can run without the real session layer.
function createSuperadminEmailMarketingRouter({ guard = [verifyAdminToken, superAdminOnly, marketingEnabledGate()] } = {}) {
  const router = express.Router();
  router.use(...guard);

  const serialize = (u) => ({ id: String(u._id), name: u.name || "", email: u.email || "", allowed: Boolean(u.emailMarketingAccess) });

  router.get("/admins", async (req, res) => {
    try {
      const admins = await User.find({ role: "admin", accountDisabled: { $ne: true } }).sort({ name: 1 }).select("name email emailMarketingAccess").lean();
      res.json({ admins: admins.map(serialize) });
    } catch (err) {
      console.error("[email-marketing-access]", err?.name || "error");
      res.status(500).json({ msg: "Something went wrong. Please try again." });
    }
  });

  router.patch("/admins/:id", async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ msg: "Admin not found." });
      if (typeof req.body?.allowed !== "boolean") return res.status(400).json({ msg: "allowed must be true or false." });
      // Only plain admins can be switched: a Super Admin always has access, and other roles can never have it.
      const admin = await User.findOneAndUpdate(
        { _id: req.params.id, role: "admin" },
        { $set: { emailMarketingAccess: req.body.allowed } },
        { returnDocument: "after" }
      )
        .select("name email emailMarketingAccess")
        .lean();
      if (!admin) return res.status(404).json({ msg: "Admin not found." });
      res.json({ admin: serialize(admin) });
    } catch (err) {
      console.error("[email-marketing-access]", err?.name || "error");
      res.status(500).json({ msg: "Something went wrong. Please try again." });
    }
  });

  return router;
}

module.exports = createSuperadminEmailMarketingRouter();
module.exports.create = createSuperadminEmailMarketingRouter;
