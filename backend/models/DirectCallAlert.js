const mongoose = require("mongoose");

// One document per admin-facing alert raised about a direct-call room
// (Phase 4). Separate from DirectRoomEvent (the full unstructured signaling
// trail) because alerts need their own read/unread lifecycle and a stable
// `type` enum an admin UI can render icons/labels for.
const directCallAlertSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  type: {
    type: String,
    required: true,
    enum: ["room_full", "repeated_retries", "never_connected"],
  },
  message: { type: String, default: "" },
  doctorName: { type: String, default: "" },
  // Whatever extra context the trigger had (reason, retryCount, waitedMs, …).
  detail: { type: mongoose.Schema.Types.Mixed, default: undefined },
  readAt: { type: Date, default: null },
  readByName: { type: String, default: "" },
  // Same 90-day retention as DirectRoomEvent — see that model's note.
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 },
});

directCallAlertSchema.index({ readAt: 1, createdAt: -1 });
directCallAlertSchema.index({ roomId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model("DirectCallAlert", directCallAlertSchema);
