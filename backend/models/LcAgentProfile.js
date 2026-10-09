const mongoose = require("mongoose");

// Live-chat profile of an admin / superadmin: the name patients see and the Online/Offline switch.
const agentProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    displayName: { type: String, default: "", trim: true, maxlength: 40 },
    online: { type: Boolean, default: false },
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LcAgentProfile", agentProfileSchema);
