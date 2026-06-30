const mongoose = require("mongoose");

const employeeTaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    department: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    comment: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    attachments: [
      {
        name: { type: String, trim: true, maxlength: 255 },
        size: { type: String, trim: true, maxlength: 40 },
      },
    ],
    subtasks: [
      {
        title: { type: String, trim: true, maxlength: 140 },
        description: { type: String, default: "", trim: true, maxlength: 2000 },
        comment: { type: String, default: "", trim: true, maxlength: 2000 },
        attachments: [
          {
            name: { type: String, trim: true, maxlength: 255 },
            size: { type: String, trim: true, maxlength: 40 },
          },
        ],
      },
    ],
    startDate: {
      type: Date,
      default: null,
      index: true,
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: 40,
      },
    ],
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Completed", "Blocked"],
      default: "Pending",
      index: true,
    },
    dueDate: {
      type: Date,
      default: null,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EmployeeTask", employeeTaskSchema);
