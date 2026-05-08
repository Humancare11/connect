const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");

const getAdminStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: "user" });
    const activeUsers = await User.countDocuments({ role: "user" }); // For now, same as total users
    const totalDoctors = await Enrollment.countDocuments({ approvalStatus: "approved" });
    const totalAppointments = await Appointment.countDocuments();

    res.status(200).json({ totalUsers, activeUsers, totalDoctors, totalAppointments });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ msg: "Failed to fetch admin stats" });
  }
};

// GET /api/admin/doctors — all enrollments for admin review
const getAllDoctors = async (req, res) => {
  try {
    const enrollments = await Enrollment.find()
      .populate("doctorId", "name email")
      .sort({ updatedAt: -1 })
      .lean();

    res.status(200).json(enrollments);
  } catch (error) {
    console.error("getAllDoctors error:", error);
    res.status(500).json({ msg: "Failed to fetch doctors" });
  }
};

// PUT /api/admin/doctors/:id/approve
const approveDoctor = async (req, res) => {
  try {
    const enrollment = await Enrollment.findByIdAndUpdate(
      req.params.id,
      { approvalStatus: "approved", verified: true },
      { new: true }
    );
    if (!enrollment) return res.status(404).json({ msg: "Enrollment not found" });

    res.status(200).json({ msg: "Doctor approved", enrollment });
  } catch (error) {
    console.error("approveDoctor error:", error);
    res.status(500).json({ msg: "Failed to approve doctor" });
  }
};

// PUT /api/admin/doctors/:id/reject
const rejectDoctor = async (req, res) => {
  try {
    const enrollment = await Enrollment.findByIdAndUpdate(
      req.params.id,
      { approvalStatus: "rejected", verified: false },
      { new: true }
    );
    if (!enrollment) return res.status(404).json({ msg: "Enrollment not found" });

    res.status(200).json({ msg: "Doctor rejected", enrollment });
  } catch (error) {
    console.error("rejectDoctor error:", error);
    res.status(500).json({ msg: "Failed to reject doctor" });
  }
};

// GET /api/admin/users — all users for admin management
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ role: "user" })
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(users);
  } catch (error) {
    console.error("getAllUsers error:", error);
    res.status(500).json({ msg: "Failed to fetch users" });
  }
};

// DELETE /api/admin/users/:id — delete a user
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    res.status(200).json({ msg: "User deleted successfully" });
  } catch (error) {
    console.error("deleteUser error:", error);
    res.status(500).json({ msg: "Failed to delete user" });
  }
};

// GET /api/admin/users/:id — get user details
const getUserDetails = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found" });

    res.status(200).json(user);
  } catch (error) {
    console.error("getUserDetails error:", error);
    res.status(500).json({ msg: "Failed to fetch user details" });
  }
};

module.exports = { getAdminStats, getAllDoctors, approveDoctor, rejectDoctor, getAllUsers, deleteUser, getUserDetails };
