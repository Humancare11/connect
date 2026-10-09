const mongoose = require("mongoose");
const { ENC_FIELD } = require("../utils/liveChat/crypto");

// One chat. mode: ai (AI only) | queue (waiting for an agent) | live (agent joined) | archived (closed).
// everLive stays true once an agent has been involved, so the chat remains under "Live agent chats".
const conversationSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, unique: true }, // public id, e.g. HC7K2M9QX
    visitorId: { type: String, required: true, index: true },
    mode: { type: String, enum: ["ai", "queue", "live", "archived"], default: "ai", index: true },
    everLive: { type: Boolean, default: false, index: true },
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    closedReason: {
      type: String,
      enum: ["", "resolved", "patient_left", "offline_request", "ai_unavailable"],
      default: "",
    },
    topic: { type: String, default: "", maxlength: 80 },
    optionsUsed: { type: Boolean, default: false }, // quick-option cards are shown until one is picked
    offlineRequested: { type: Boolean, default: false }, // asked for an agent while the team was offline
    aiNoticeShown: { type: Boolean, default: false }, // the "AI unavailable" notice was shown in this chat
    source: { type: String, default: "", maxlength: 120 },
    referrer: { type: String, default: "", maxlength: 120 }, // referring host only
    timeZone: { type: String, default: "", maxlength: 64 }, // reported by the patient's browser, for "their time"
    cookieChoice: { type: String, enum: ["", "accepted", "declined", "unknown"], default: "" },
    agentName: { type: String, default: "", maxlength: 40 }, // display name patients see while an agent holds the chat
    queuedAt: { type: Date, default: null },
    // Unread tracking per admin: patientMessageCount grows with every patient message; reads holds, per admin, the
    // count they had seen when they last opened the chat. unread = patientMessageCount - that count.
    patientMessageCount: { type: Number, default: 0 },
    reads: [{ _id: false, userId: { type: mongoose.Schema.Types.ObjectId }, count: { type: Number, default: 0 } }],
    aiSummary: ENC_FIELD,
    tags: [{ type: String, trim: true, maxlength: 40 }],
    contact: { name: ENC_FIELD, email: ENC_FIELD, phone: ENC_FIELD },
    ip: { type: String, default: "" },
    geo: {
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      country: { type: String, default: "" },
    },
    device: {
      type: { type: String, default: "" },
      os: { type: String, default: "" },
      browser: { type: String, default: "" },
    },
    startedPage: { path: { type: String, default: "" }, title: { type: String, default: "" } },
    startedAt: { type: Date, default: Date.now },
    liveStartedAt: { type: Date, default: null },
    firstAgentReplyAt: { type: Date, default: null },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    closedAt: { type: Date, default: null },
    aiReplyCount: { type: Number, default: 0 },
    tokens: { input: { type: Number, default: 0 }, output: { type: Number, default: 0 } },
    rating: { stars: { type: Number, min: 1, max: 5, default: null }, ratedAt: { type: Date, default: null } },
  },
  { timestamps: true }
);

conversationSchema.index({ mode: 1, lastMessageAt: -1 });

module.exports = mongoose.model("LcConversation", conversationSchema);
