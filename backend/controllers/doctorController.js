import Doctor from "../models/Doctor.js";
import Enrollment from "../models/Enrollment.js";
import jwt from "jsonwebtoken";

export const registerDoctor = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // check existing
    const existing = await Doctor.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // create doctor
    const doctor = new Doctor({
      name,
      email,
      password,
    });

    await doctor.save();

    res.status(201).json({
      message: "Doctor registered successfully",
      doctor: {
        id: doctor._id,
        name: doctor.name,
        email: doctor.email,
      },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const loginDoctor = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const doctor = await Doctor.findOne({ email });
    if (!doctor) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await doctor.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: doctor._id, email: doctor.email }, process.env.JWT_SECRET || "secret", {
      expiresIn: "7d",
    });

    res.status(200).json({
      message: "Login successful",
      token,
      doctor: {
        id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        isEnrolled: doctor.isEnrolled,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const submitEnrollment = async (req, res) => {
  try {
    const { doctorId, ...enrollmentData } = req.body;

    if (!doctorId) {
      return res.status(400).json({ message: "Doctor ID required" });
    }

    // Check if doctor exists
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Check if enrollment already exists
    let enrollment = await Enrollment.findOne({ doctorId });
    
    if (enrollment) {
      // Update existing enrollment
      enrollment = Object.assign(enrollment, enrollmentData);
      enrollment.updatedAt = new Date();
    } else {
      // Create new enrollment
      enrollment = new Enrollment({
        doctorId,
        ...enrollmentData,
      });
    }

    await enrollment.save();

    // Update doctor's isEnrolled flag
    doctor.isEnrolled = true;
    await doctor.save();

    res.status(201).json({
      message: "Enrollment submitted successfully",
      enrollment,
      doctor,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const getEnrollment = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const enrollment = await Enrollment.findOne({ doctorId });
    if (!enrollment) {
      return res.status(404).json({ message: "Enrollment not found" });
    }

    res.status(200).json(enrollment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getApprovedDoctors = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ approvalStatus: "approved" })
      .populate("doctorId", "name email")
      .lean();

    // Map enrollment data to doctor-friendly format
    const doctors = enrollments.map((e) => ({
      id: e._id,
      doctorId: e.doctorId?._id,
      name: e.firstName && e.surname ? `${e.firstName} ${e.surname}` : e.doctorId?.name || "Dr. Unknown",
      email: e.email || e.doctorId?.email,
      specialty: e.specialization,
      subSpecialty: e.subSpecialization,
      degree: e.qualification,
      experience: e.experience,
      price: e.consultantFees,
      location: e.city && e.state ? `${e.city}, ${e.state}` : "Location not specified",
      languages: e.languagesKnown || [],
      gender: e.gender,
      about: e.aboutDoctor,
      verified: e.verified,
      rating: 4.8, // Default rating
    }));

    res.status(200).json(doctors);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};