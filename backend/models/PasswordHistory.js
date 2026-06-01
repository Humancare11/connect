const mongoose = require("mongoose");

const passwordHistorySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    userType: { type: String, enum: ["user", "doctor"], required: true, index: true },
    passwordHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

passwordHistorySchema.index({ userId: 1, userType: 1, createdAt: -1 });

module.exports = mongoose.model("PasswordHistory", passwordHistorySchema);
