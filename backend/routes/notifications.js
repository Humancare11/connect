const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/verifyToken");
const User = require("../models/User");

const MAX_TOKENS_PER_USER = 10;

// Registers/refreshes the calling device's FCM token so the backend can push
// notifications to it. Only patient-role logins persist a token today since
// the mobile app is patient-facing; other roles get a 200 no-op so the app's
// endpoint-discovery loop (it tries a few route names) stops on the first
// non-404/405 response without erroring.
router.post("/fcm-token", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "user") {
      return res.status(200).json({ msg: "Device token not stored for this role." });
    }

    const token = String(
      req.body.token || req.body.fcmToken || req.body.deviceToken || ""
    ).trim();
    if (!token) {
      return res.status(400).json({ msg: "token is required." });
    }

    const platform = String(req.body.platform || "").trim().slice(0, 32);

    const user = await User.findById(req.user.id).select("fcmTokens");
    if (!user) {
      return res.status(404).json({ msg: "User not found." });
    }

    user.fcmTokens = (user.fcmTokens || []).filter((entry) => entry.token !== token);
    user.fcmTokens.push({ token, platform, updatedAt: new Date() });
    if (user.fcmTokens.length > MAX_TOKENS_PER_USER) {
      user.fcmTokens = user.fcmTokens.slice(-MAX_TOKENS_PER_USER);
    }
    await user.save();

    res.status(200).json({ msg: "Device token saved." });
  } catch (error) {
    console.error("fcm-token save error:", error);
    res.status(500).json({ msg: "Failed to save device token." });
  }
});

module.exports = router;
