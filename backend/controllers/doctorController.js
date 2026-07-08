import mongoose from "mongoose";
import Doctor from "../models/Doctor.js";
import Enrollment from "../models/Enrollment.js";
import jwt from "jsonwebtoken";

// Keep in sync with the frontend's STEP_LABELS (steps 1-4 are form steps,
// step 5 = fully submitted / in admin review).
const STEP_LABELS = ["Identity", "Professional", "Availability", "Payout", "Submitted"];

// Fields each step is allowed to write. Mirrors buildStepPayload() on the
// frontend. Keeping an explicit allow-list here (rather than trusting
// req.body.data wholesale) stops a doctor from smuggling protected fields
// (e.g. approvalStatus, verified, doctorId) into a step-save call.
const STEP_FIELD_ALLOWLIST = {
    1: [
        "firstName", "surname", "email", "countryCode", "phoneNumber", "gender",
        "dob", "country", "state", "city", "zip", "address", "languagesKnown",
        "profilePhoto",
    ],
    2: [
        "specialization", "subSpecialization", "qualification", "experience",
        "medicalSchool", "registrationYear", "medicalCouncilName",
        "medicalRegistrationNumber", "medicalLicense", "consultationMode",
        "consultantFees", "feeCurrency", "clinicName", "clinicAddress",
        "aboutDoctor", "licensedStates", "internationalLicenses", "idProof",
        "degreeFile", "medicalLicenseFile", "malpracticeInsuranceFile",
    ],
    3: ["availability", "timezone"],
    4: [
        "accountHolderName", "payoutEmail", "payoutFrequency", "bankName",
        "accountNumber", "ifscCode", "paypalId",
    ],
};

function pickAllowed(data, allowedKeys) {
    const out = {};
    if (!data || typeof data !== "object") return out;
    for (const key of allowedKeys) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            out[key] = data[key];
        }
    }
    return out;
}

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
                doctorId: doctor.doctorId,
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

// ─────────────────────────────────────────────────────────────────────────
// NEW: Autosave — persists ONE step's field data immediately, creating the
// Enrollment record on first call (upsert) so it appears on the admin
// dashboard right away instead of only after final submit.
// Called from the wizard's "Save" button and automatically on every
// Continue click (handleNext -> saveStepToServer).
// ─────────────────────────────────────────────────────────────────────────
export const saveEnrollmentStep = async (req, res) => {
    try {
        const { doctorId, step, data } = req.body;

        // TEMP DEBUG — remove once the missing-fields issue is confirmed fixed
        console.log("[saveEnrollmentStep] doctorId:", doctorId, "step:", step, "data:", JSON.stringify(data));

        if (!doctorId || !mongoose.isValidObjectId(doctorId)) {
            return res.status(400).json({ message: "Valid doctorId is required" });
        }
        const stepNum = Number(step);
        if (!Number.isInteger(stepNum) || stepNum < 1 || stepNum > 4) {
            return res.status(400).json({ message: "step must be an integer between 1 and 4" });
        }

        const doctor = await Doctor.findById(doctorId).select("_id");
        if (!doctor) {
            return res.status(404).json({ message: "Doctor not found" });
        }

        const safeData = pickAllowed(data, STEP_FIELD_ALLOWLIST[stepNum]);

        const enrollment = await Enrollment.findOneAndUpdate(
            { doctorId },
            {
                $set: {
                    ...safeData,
                    updatedAt: new Date(),
                },
                $setOnInsert: {
                    doctorId,
                },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
        );

        res.status(200).json({ message: "Step saved", enrollment });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────
// NEW: Autosave — persists just the wizard's current position (which step
// the doctor is on) so a returning doctor resumes where they left off.
// Also upserts, for the case where a doctor navigates before any field
// data has been entered/saved yet.
// ─────────────────────────────────────────────────────────────────────────
export const saveEnrollmentProgress = async (req, res) => {
    try {
        const { doctorId, completedSteps, currentStep } = req.body;

        if (!doctorId || !mongoose.isValidObjectId(doctorId)) {
            return res.status(400).json({ message: "Valid doctorId is required" });
        }

        const doctor = await Doctor.findById(doctorId).select("_id");
        if (!doctor) {
            return res.status(404).json({ message: "Doctor not found" });
        }

        const safeCompleted = Math.max(0, Math.min(4, Number(completedSteps) || 0));
        const safeCurrent = Math.max(1, Math.min(4, Number(currentStep) || 1));

        const enrollment = await Enrollment.findOneAndUpdate(
            { doctorId },
            {
                $set: {
                    completedSteps: safeCompleted,
                    currentStep: safeCurrent,
                    currentStepLabel: STEP_LABELS[safeCurrent - 1] || STEP_LABELS[0],
                    updatedAt: new Date(),
                },
                $setOnInsert: {
                    doctorId,
                },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
        );

        res.status(200).json({ message: "Progress saved", enrollment });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error", error: err.message });
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

        // Check if enrollment already exists (it usually will now, thanks to
        // autosave on steps 1-4 — this just fills in step 4's data and flips
        // the record from "draft" to "submitted").
        let enrollment = await Enrollment.findOne({ doctorId });

        const wasRejected = enrollment?.approvalStatus === "rejected";

        if (enrollment) {
            // Update existing enrollment
            enrollment = Object.assign(enrollment, enrollmentData);
            enrollment.updatedAt = new Date();
        } else {
            // Create new enrollment (fallback path — shouldn't normally happen
            // now that steps 1-3 autosave, but kept for safety/back-compat)
            enrollment = new Enrollment({
                doctorId,
                ...enrollmentData,
            });
        }

        // Mark as fully submitted and ready for admin review
        enrollment.formCompleted = true;
        enrollment.completedSteps = 4;
        enrollment.currentStep = 5;
        enrollment.currentStepLabel = STEP_LABELS[4];

        // A fresh submission (or a resubmission after rejection) goes back to
        // "pending" so it re-enters the admin review queue. An already-approved
        // doctor resubmitting through this endpoint (edge case) is left alone
        // here — approvals/rejections are admin-only actions.
        if (!enrollment.approvalStatus || wasRejected || enrollment.approvalStatus === "pending") {
            enrollment.approvalStatus = "pending";
            enrollment.applicationStatus = "Pending";
        }
        enrollment.pendingRequestType = "new_enrollment";

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

export const getDoctorById = async (req, res) => {
    try {
        const enrollment = await Enrollment.findById(req.params.id)
            .populate("doctorId", "name email")
            .lean();

        if (!enrollment || enrollment.approvalStatus !== "approved") {
            return res.status(404).json({ message: "Doctor not found" });
        }

        const e = enrollment;
        const doctor = {
            id: e._id,
            doctorId: e.doctorId?._id,
            name: e.firstName && e.surname ? `${e.firstName} ${e.surname}` : e.doctorId?.name || "Dr. Unknown",
            email: e.email || e.doctorId?.email,
            specialty: e.specialization,
            subSpecialty: e.subSpecialization,
            degree: e.qualification,
            experience: e.experience,
            price: e.consultantFees,
            city: e.city,
            state: e.state,
            country: e.country,
            location: e.city && e.state ? `${e.city}, ${e.state}` : "Location not specified",
            languages: e.languagesKnown || [],
            gender: e.gender,
            about: e.aboutDoctor,
            verified: e.verified,
            rating: 4.8,
            medicalSchool: e.medicalSchool,
            clinicName: e.clinicName,
            clinicAddress: e.clinicAddress,
            consultationMode: e.consultationMode,
            medicalRegistrationNumber: e.medicalRegistrationNumber,
            medicalCouncilName: e.medicalCouncilName,
            registrationYear: e.registrationYear,
            phoneNumber: e.phoneNumber,
            countryCode: e.countryCode,
        };

        res.status(200).json(doctor);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

export const getApprovedDoctors = async (req, res) => {
    try {
        const enrollments = await Enrollment.find({ approvalStatus: "approved" })
            .populate("doctorId", "name email doctorId")
            .lean();

        // Map enrollment data to doctor-friendly format
        const doctors = enrollments.map((e) => ({
            id: e._id,
            doctorId: e.doctorId?.doctorId,
            mongoId: e.doctorId?._id,
            name: e.firstName && e.surname ? `${e.firstName} ${e.surname}` : e.doctorId?.name || "Dr. Unknown",
            email: e.email || e.doctorId?.email,
            specialty: e.specialization,
            subSpecialty: e.subSpecialization,
            degree: e.qualification,
            experience: e.experience,
            price: e.consultantFees,
            country: e.country || "",
            city: e.city || "",
            state: e.state || "",
            location: [e.city, e.state, e.country].filter(Boolean).join(", ") || "Location not specified",
            languages: e.languagesKnown || [],
            gender: e.gender,
            about: e.aboutDoctor,
            verified: e.verified,
            internationalLicenses: e.internationalLicenses || [],
            medicalRegistrationNumber: e.medicalRegistrationNumber || "",
            medicalCouncilName: e.medicalCouncilName || "",
            rating: 4.8, // Default rating
        }));

        res.status(200).json(doctors);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

export const toggleOnlineStatus = async (req, res) => {
    try {
        const { doctorId } = req.body;

        if (!doctorId) {
            return res.status(400).json({ message: "Doctor ID required" });
        }

        const enrollment = await Enrollment.findOne({ doctorId });
        if (!enrollment) {
            return res.status(404).json({ message: "Enrollment not found" });
        }

        // Toggle the online status
        enrollment.isOnline = !enrollment.isOnline;
        enrollment.lastOnlineAt = enrollment.isOnline ? new Date() : enrollment.lastOnlineAt;
        await enrollment.save();

        res.status(200).json({
            message: `Doctor is now ${enrollment.isOnline ? "online" : "offline"}`,
            isOnline: enrollment.isOnline,
            lastOnlineAt: enrollment.lastOnlineAt,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
