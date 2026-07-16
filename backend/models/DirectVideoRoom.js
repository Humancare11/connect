const mongoose = require("mongoose");

// Fully independent of Appointment/CategoryConsultation — an ad-hoc, link-based
// video room that anyone with the link can join as a guest (no registration,
// login, or doctor/patient binding), same trust model as a Google Meet link.
// Deliberately kept separate from the appointment-based consultation flow.
const directVideoRoomSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdByName: { type: String, default: "" },
    note: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["active", "closed", "expired"],
      default: "active",
      index: true,
    },
    maxParticipants: { type: Number, default: 2 },
    expiresAt: { type: Date, required: true, index: true },
    firstJoinedAt: { type: Date, default: null },
    lastActivityAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

directVideoRoomSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model("DirectVideoRoom", directVideoRoomSchema);
