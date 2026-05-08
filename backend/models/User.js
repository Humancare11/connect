// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    email: { type: String, required: true, unique: true, lowercase: true, trim: true },

    password: { type: String, required: false, default: "" },

    googleId: { type: String, default: "" },

    appleId:  { type: String, default: "" },

    role: {
      type: String,
      enum: ["user", "admin", "superadmin", "doctor"],
      default: "user",
    },

    mobile: { type: String, default: "" },

    dob: { type: String, default: "" },

    gender: { type: String, enum: ["Male", "Female", "Other", ""], default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
