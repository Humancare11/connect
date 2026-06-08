const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    name:     { type: String, default: "Anonymous", trim: true },
    category: { type: String, default: "General",   trim: true },
    question: { type: String, required: true,        trim: true },

    // Workflow status
    status: {
      type: String,
      enum: ["pending", "assigned", "answered", "approved"],
      default: "pending",
    },

    // Set by admin when assigning to a doctor
    assignedDoctorId:   { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", default: null },
    assignedDoctorName: { type: String, default: "" },
    assignedDoctorSpec: { type: String, default: "" },

    // Set by doctor when answering
    answer: { type: String, default: "" },
    doctor: {
      name:           { type: String, default: "" },
      specialization: { type: String, default: "" },
    },

    // Attachments uploaded with the question
    attachments: [{
      url:  { type: String },
      name: { type: String },
      type: { type: String },
      size: { type: Number },
    }],

    // Legacy field — true only when status === "approved"
    answered: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Question", questionSchema);
