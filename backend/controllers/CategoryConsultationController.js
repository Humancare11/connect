const CategoryConsultation = require("../models/CategoryConsultation");

const Enrollment = require("../models/Enrollment");


// Create a new consultation
const createCategoryConsultation = async (req, res) => {
  try {
    const consultation = await CategoryConsultation.create({
      concern: req.body.concern,
      duration: req.body.duration,
      severity: req.body.severity,
      supportType: req.body.supportType,
      urgency: req.body.urgency,
      timeWindow: req.body.timeWindow,
      slot: req.body.slot,
      date: req.body.date,
      patientId: req.user.id,
      medicalReports: req.body.medicalReports,
      consultationPrice: req.body.consultationPrice,
      categoryName: req.body.categoryName,
      specialtyName: req.body.specialtyName,
      conditionName: req.body.conditionName,
    });

    console.log("✅ Saved Document:", consultation);
    console.log("✅ Database:", consultation.db.name);
    console.log("✅ Collection:", consultation.collection.name);

    res.status(201).json({
      success: true,
      message: "Consultation submitted successfully.",
      data: consultation,
    });
  } catch (error) {
    console.error("Create Consultation Error:", error);

    res.status(500).json({
      success: false,
      message: "Something went wrong.",
      error: error.message,
    });
  }
};

// Get all consultations (admin)
const getAllCategoryConsultations = async (req, res) => {
  try {
    const consultations = await CategoryConsultation.find()
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: consultations.length,
      data: consultations,
    });
  } catch (error) {
    console.error("Get Consultation Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch consultations.",
      error: error.message,
    });
  }
};

// Get consultations belonging to the logged-in patient
// Mirrors the shape /api/appointments/mine returns so the frontend
// Appointments.jsx tab logic can treat both lists the same way.
const getMyCategoryConsultations = async (req, res) => {
  try {
    const consultations = await CategoryConsultation.find({
      patientId: req.user.id,
    })
      .populate(
        "assignedDoctorId",
        "firstName surname email specialization city country"
      )
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: consultations.length,
      data: consultations,
    });
  } catch (error) {
    console.error("Get My Consultations Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch your consultations.",
      error: error.message,
    });
  }
};

// Get consultations assigned to the logged-in doctor
//
// IMPORTANT: req.user.id (from the doctorToken JWT) is a Doctor._id, but
// CategoryConsultation.assignedDoctorId stores an Enrollment._id (assignDoctor()
// looks doctors up via Enrollment.findById). Enrollment has its own _id and
// merely *points at* a Doctor via enrollment.doctorId — the two ids are never
// the same value. So we must resolve Doctor._id -> Enrollment._id first,
// then filter consultations by that Enrollment _id.
const getDoctorCategoryConsultations = async (req, res) => {
  try {
    const enrollment = await Enrollment.findOne({ doctorId: req.user.id }).select("_id");

    if (!enrollment) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    const consultations = await CategoryConsultation.find({
      assignedDoctorId: enrollment._id,
    })
      .populate("patientId", "name email mobile gender country dob")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: consultations.length,
      data: consultations,
    });
  } catch (error) {
    console.error("Get Doctor Consultations Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch assigned consultations.",
      error: error.message,
    });
  }
};

// Get Single Consultation
const getCategoryConsultationById = async (req, res) => {
  try {
    const consultation = await CategoryConsultation.findById(req.params.id)
      .populate(
        "patientId",
        "name email mobile gender country dob"
      )
      .populate(
        "assignedDoctorId",
        "firstName surname email phoneNumber specialization qualification city state country"
      );

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: "Consultation not found",
      });
    }

    res.json({
      success: true,
      data: consultation,
    });
  } catch (error) {
    console.error("GET CATEGORY CONSULTATION ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Update Consultation Status
const updateCategoryConsultationStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const consultation = await CategoryConsultation.findById(req.params.id);

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: "Consultation not found",
      });
    }

    consultation.status = status;

    await consultation.save();

    res.json({
      success: true,
      message: "Status updated successfully",
      data: consultation,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// Delete Consultation
const deleteCategoryConsultation = async (req, res) => {
  try {
    const consultation = await CategoryConsultation.findById(req.params.id);

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: "Consultation not found",
      });
    }

    await consultation.deleteOne();

    res.json({
      success: true,
      message: "Consultation deleted successfully",
    });
  } catch (error) {
    console.error("Delete Consultation Error:", error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

const assignDoctor = async (req, res) => {
  try {
    const { doctorId } = req.body;

    if (!doctorId) {
      return res.status(400).json({
        success: false,
        message: "Doctor ID is required",
      });
    }

    const consultation = await CategoryConsultation.findById(req.params.id);

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: "Consultation not found",
      });
    }

    const doctor = await Enrollment.findById(doctorId);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    consultation.assignedDoctorId = doctor._id;
    consultation.assignedDoctorName =
      `${doctor.firstName} ${doctor.surname}`.trim();

    consultation.assignedAt = new Date();
    consultation.status = "Assigned";

    await consultation.save();

    res.json({
      success: true,
      message: "Doctor assigned successfully",
      data: consultation,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

module.exports = {
  createCategoryConsultation,
  getAllCategoryConsultations,
  getMyCategoryConsultations,
  getDoctorCategoryConsultations,
  getCategoryConsultationById,
  updateCategoryConsultationStatus,
  deleteCategoryConsultation,
  assignDoctor,
};