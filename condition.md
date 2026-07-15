# Condition Consultation Flow Implementation Guide

This guide describes how to replicate the existing **Category Consultation** flow for **Condition Consultations**. You will implement the backend database model, controllers, API routes, and corresponding frontend pages, admin tables, and CTA button linkages.

---

## Part 1: Backend Implementation

### Step 1.1: Create the Mongoose Model
Create a new model at `backend/models/ConditionConsultation.js` to store condition-based consultations.

**File:** `backend/models/ConditionConsultation.js`
```javascript
const mongoose = require("mongoose");

const conditionConsultationSchema = new mongoose.Schema(
  {
    conditionName: {
      type: String,
      required: true,
      trim: true,
    },
    concern: {
      type: String,
      required: true,
      trim: true,
    },
    duration: {
      type: String,
      default: "",
    },
    severity: {
      type: String,
      required: true,
    },
    supportType: {
      type: String,
      required: true,
    },
    urgency: {
      type: String,
      required: true,
    },
    timeWindow: {
      type: String,
      required: true,
    },
    slot: {
      type: String,
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Assigned", "Confirmed", "Completed", "Cancelled"],
      default: "Pending",
    },
    assignedDoctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Enrollment",
      default: null,
    },
    assignedDoctorName: {
      type: String,
      default: "",
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    medicalReports: [
      {
        url:  { type: String },
        name: { type: String },
        type: { type: String },
        size: { type: Number },
      },
    ],
    consultationPrice: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "ConditionConsultation",
  conditionConsultationSchema
);
```

### Step 1.2: Create the Backend Controller
Create `backend/controllers/ConditionConsultationController.js` to handle CRUD operations and doctor assignments.

**File:** `backend/controllers/ConditionConsultationController.js`
```javascript
const ConditionConsultation = require("../models/ConditionConsultation");
const Enrollment = require("../models/Enrollment");

// Create a new condition consultation
exports.createConditionConsultation = async (req, res) => {
  try {
    const consultation = await ConditionConsultation.create({
      conditionName: req.body.conditionName,
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
    });

    res.status(201).json({
      success: true,
      message: "Condition consultation submitted successfully.",
      data: consultation,
    });
  } catch (error) {
    console.error("Create Condition Consultation Error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong.",
      error: error.message,
    });
  }
};

// Get all condition consultations (admin)
exports.getAllConditionConsultations = async (req, res) => {
  try {
    const consultations = await ConditionConsultation.find()
      .populate("patientId", "name email mobile")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: consultations.length,
      data: consultations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch consultations.",
      error: error.message,
    });
  }
};

// Get consultations belonging to the logged-in patient
exports.getMyConditionConsultations = async (req, res) => {
  try {
    const consultations = await ConditionConsultation.find({
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
    res.status(500).json({
      success: false,
      message: "Failed to fetch your consultations.",
      error: error.message,
    });
  }
};

// Get consultations assigned to the logged-in doctor
exports.getDoctorConditionConsultations = async (req, res) => {
  try {
    const enrollment = await Enrollment.findOne({ doctorId: req.user.id }).select("_id");
    if (!enrollment) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    const consultations = await ConditionConsultation.find({
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
    res.status(500).json({
      success: false,
      message: "Failed to fetch assigned consultations.",
      error: error.message,
    });
  }
};

// Get single condition consultation detail
exports.getConditionConsultationById = async (req, res) => {
  try {
    const consultation = await ConditionConsultation.findById(req.params.id)
      .populate("patientId", "name email mobile gender country dob")
      .populate(
        "assignedDoctorId",
        "firstName surname email phoneNumber specialization qualification city state country"
      );

    if (!consultation) {
      return res.status(404).json({ success: false, message: "Consultation not found." });
    }

    res.status(200).json({ success: true, data: consultation });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch details.", error: error.message });
  }
};

// Update status
exports.updateConditionConsultationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const consultation = await ConditionConsultation.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!consultation) {
      return res.status(404).json({ success: false, message: "Consultation not found." });
    }

    res.status(200).json({ success: true, message: "Status updated successfully.", data: consultation });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update status.", error: error.message });
  }
};

// Delete consultation
exports.deleteConditionConsultation = async (req, res) => {
  try {
    const consultation = await ConditionConsultation.findByIdAndDelete(req.params.id);
    if (!consultation) {
      return res.status(404).json({ success: false, message: "Consultation not found." });
    }
    res.status(200).json({ success: true, message: "Consultation deleted." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete.", error: error.message });
  }
};

// Assign a doctor
exports.assignDoctor = async (req, res) => {
  try {
    const { doctorId } = req.body; // Expects Enrollment ID
    const enrollment = await Enrollment.findById(doctorId);
    if (!enrollment) {
      return res.status(404).json({ success: false, message: "Doctor enrollment not found." });
    }

    const doctorName = `${enrollment.firstName} ${enrollment.surname}`.trim();
    const consultation = await ConditionConsultation.findByIdAndUpdate(
      req.params.id,
      {
        assignedDoctorId: enrollment._id,
        assignedDoctorName: doctorName,
        assignedAt: new Date(),
        status: "Assigned",
      },
      { new: true }
    );

    if (!consultation) {
      return res.status(404).json({ success: false, message: "Consultation not found." });
    }

    res.status(200).json({
      success: true,
      message: `Assigned to Dr. ${doctorName} successfully.`,
      data: consultation,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to assign doctor.", error: error.message });
  }
};
```

### Step 1.3: Create API Routes
Create `backend/routes/conditionConsultation.js` to define endpoints.

**File:** `backend/routes/conditionConsultation.js`
```javascript
const express = require("express");
const router = express.Router();
const {
  verifyUserToken,
  verifyDoctorToken,
  verifyAdminToken,
  adminOnly,
} = require("../middleware/verifyToken");

const {
  createConditionConsultation,
  getAllConditionConsultations,
  getMyConditionConsultations,
  getDoctorConditionConsultations,
  getConditionConsultationById,
  updateConditionConsultationStatus,
  deleteConditionConsultation,
  assignDoctor,
} = require("../controllers/ConditionConsultationController");

// Patient: their own consultations
router.get("/mine", verifyUserToken, getMyConditionConsultations);

// Doctor: consultations assigned to them
router.get("/doctor/mine", verifyDoctorToken, getDoctorConditionConsultations);

// Admin: all consultations
router.get("/", verifyAdminToken, adminOnly, getAllConditionConsultations);

// Patient: create a new consultation request
router.post("/", verifyUserToken, createConditionConsultation);

// Admin: single consultation detail
router.get("/:id", verifyAdminToken, adminOnly, getConditionConsultationById);

// Admin: update status
router.patch("/:id/status", verifyAdminToken, adminOnly, updateConditionConsultationStatus);

// Admin: delete
router.delete("/:id", verifyAdminToken, adminOnly, deleteConditionConsultation);

// Admin: assign a doctor
router.patch("/:id/assign-doctor", verifyAdminToken, adminOnly, assignDoctor);

module.exports = router;
```

### Step 1.4: Register Routes in `server.js`
Open `backend/server.js` and mount the router:

```javascript
app.use(
  "/api/condition-consultation",
  require("./routes/conditionConsultation")
);
```

---

## Part 2: Frontend Implementation

### Step 2.1: Create Condition Intake Page (`ConditionConsultant.jsx`)
Create a form similar to `CategoryConsultant.jsx` but tailored to retrieve details for a specific Condition. The page will dynamically pull the condition details or receive them via location state.

**File:** `frontend/src/pages/ConditionConsultant.jsx`
*You can copy the code from `CategoryConsultant.jsx` and replace category-related parameters with condition names and IDs.*

### Step 2.2: Create Condition Appointment Confirmation (`ConditionAppointmentConfirm.jsx`)
Create a payment and confirmation screen similar to `CategoryAppointmentConfirm.jsx` that coordinates payments and posts to the new backend API endpoint `/api/condition-consultation`.

### Step 2.3: Link the "Start Consultation" CTA Button
In your condition page (e.g., `MoodAnxietyTeens.jsx`), update the CTA button click handler to redirect to the new intake page:

```javascript
import { useNavigate } from "react-router-dom";

// Inside MoodAnxietyTeens component:
const navigate = useNavigate();

const handleStartConsultation = () => {
  navigate("/condition-consultant", {
    state: {
      conditionName: "Mood & Anxiety in Teens",
      price: 99, // dynamic or static price of this condition consultation
    }
  });
};

// In the JSX:
<button className="sp-sbc-cta" onClick={handleStartConsultation}>
  Start Consultation →
</button>
```

### Step 2.4: Admin Dashboard Integration
1. Create `AdminConditionConsultations.jsx` in `frontend/src/pages/admin/` to display lists of condition consultation requests.
2. Create `AdminConditionConsultationDetails.jsx` to view detail pages.
3. Add a sidebar link in `AdminLayout.jsx`:
   ```javascript
   {
     path: "/admin-dashboard/condition-consultations",
     label: "Condition Consultation",
     icon: (
       <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" ...>
         ...
       </svg>
     ),
   }
   ```
4. Register the new components and paths in `frontend/src/App.jsx`.

---
**Done!** Use these steps to build out your condition management flow.
