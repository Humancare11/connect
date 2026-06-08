const User = require("../models/User");

const getAdminStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: "user" });

    res.status(200).json({
      totalUsers,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ msg: "Failed to fetch admin stats" });
  }
};

module.exports = {
  getAdminStats,
};