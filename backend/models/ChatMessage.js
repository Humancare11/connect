const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", required: true, index: true },
    senderId: { type: String, required: true, index: true },
    senderName: { type: String, default: "" },
    senderRole: { type: String, enum: ["user", "doctor"], default: "user" },
    cipherText: { type: String, default: "" },
    iv: { type: String, default: "" },
    authTag: { type: String, default: "" },
    keyVersion: { type: String, default: "v1" },
    fileUrl: { type: String, default: "" },
    fileName: { type: String, default: "" },
    fileType: { type: String, default: "" },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

chatMessageSchema.index({ appointmentId: 1, createdAt: 1 });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
