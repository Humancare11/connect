const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const doctorSchema = new mongoose.Schema(
  {
    doctorId: { type: Number, unique: true, sparse: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: false, default: "" },
    googleId: { type: String, default: "" },
    appleId: { type: String, default: "" },
    isEnrolled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Mongoose 9: async pre-save — hash password and generate unique 5-digit doctorId
doctorSchema.pre("save", async function () {
  if (this.isModified("password") && this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }

  // Generate unique 5-digit doctorId if not already set
  if (!this.doctorId) {
    let doctorId;
    let exists = true;
    while (exists) {
      doctorId = Math.floor(10000 + Math.random() * 90000); // 5-digit number
      exists = await mongoose.models.Doctor.findOne({ doctorId });
    }
    this.doctorId = doctorId;
  }
});

doctorSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("Doctor", doctorSchema);
