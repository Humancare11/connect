const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const doctorSchema = new mongoose.Schema(
  {
    name:       { type: String, required: true, trim: true },
    email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:   { type: String, required: false, default: "" },
    googleId:   { type: String, default: "" },
    appleId:    { type: String, default: "" },
    isEnrolled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Mongoose 9: async pre-save — hash only when password is modified and non-empty
doctorSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
});

doctorSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("Doctor", doctorSchema);
