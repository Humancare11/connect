const User = require("../models/User");
const { marketingConfig } = require("../services/marketing/config");

// Who may use Email Marketing: a Super Admin always, and an admin only after a Super Admin switched it on for
// them (User.emailMarketingAccess). Nobody else (patients, doctors, partners, payment/employee admins) gets
// past this, and the flag is read from the database on every request, so removing access takes effect at once.

async function hasMarketingAccess(user) {
  if (!user?.id) return false;
  if (user.role === "superadmin") return true;
  if (user.role !== "admin") return false;
  const row = await User.findById(user.id).select("emailMarketingAccess accountDisabled").lean();
  return Boolean(row?.emailMarketingAccess) && row.accountDisabled !== true;
}

// The module is off: the API does not exist (404), like an unknown address.
function marketingEnabledGate(getConfig = marketingConfig) {
  return (req, res, next) => {
    if (!getConfig().enabled) return res.status(404).json({ msg: "Not found." });
    return next();
  };
}

function requireMarketingAccess(check = hasMarketingAccess) {
  return async (req, res, next) => {
    try {
      if (await check(req.user)) return next();
      return res.status(403).json({ msg: "Access denied." });
    } catch (err) {
      console.error("[marketing] access check failed:", err?.name || "error");
      return res.status(500).json({ msg: "Something went wrong. Please try again." });
    }
  };
}

module.exports = { hasMarketingAccess, marketingEnabledGate, requireMarketingAccess };
