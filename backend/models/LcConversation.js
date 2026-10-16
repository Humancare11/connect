const mongoose = require("mongoose");
const { ENC_FIELD } = require("../utils/liveChat/crypto");

// One chat. mode: ai (AI only) | queue (waiting for an agent) | live (agent joined) | archived (closed).
// "trashed" = deleted by a Super Admin, kept 30 days in Trash (restorable), then purged; invisible everywhere else.
// everLive stays true once an agent has been involved, so the chat remains under "Live agent chats".
const conversationSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, unique: true }, // public id, e.g. HC7K2M9QX
    visitorId: { type: String, required: true, index: true },
    mode: { type: String, enum: ["ai", "queue", "live", "archived", "trashed"], default: "ai", index: true },
    everLive: { type: Boolean, default: false, index: true },
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    closedReason: {
      type: String,
      enum: ["", "resolved", "patient_left", "patient_ended", "offline_request", "ai_unavailable", "blocked", "inactive"],
      default: "",
    },
    topic: { type: String, default: "", maxlength: 80 },
    // Why the chat went to the Queue: explicit_request | account_issue | technical_issue | emergency | complaint |
    // unanswered (from the AI), or ai_unavailable | ai_off | ai_limit (server). Older chats may hold the previous
    // names patient_request | account_or_payment | unsure.
    handoffReason: { type: String, default: "", maxlength: 40 },
    offTopicStreak: { type: Number, default: 0 }, // consecutive off-topic patient messages
    unansweredStreak: { type: Number, default: 0 }, // consecutive questions the AI could not answer
    invited: { type: Boolean, default: false }, // an admin started this chat; the visitor has not replied yet
    leftAt: { type: Date, default: null }, // archived as "patient left" at this time
    modeBeforeLeft: { type: String, enum: ["", "ai", "queue", "live"], default: "" }, // lets a returning visitor continue
    // Persisted "patient left" time: set (now + leave grace) when the visitor's last connection closes, cleared when
    // they connect again. A job archives the chat as "patient left" once it has passed and nobody is connected, so a
    // restart that loses the in-memory timer cannot leave an abandoned chat open.
    leaveDueAt: { type: Date, default: null, index: true },
    // The follow-up step: when the chat entered the Queue, this is when "Our team will connect with you by email" is
    // due (cleared when an admin takes the chat, the patient goes back to the AI, or the notice was given).
    followUpDueAt: { type: Date, default: null, index: true },
    // Auto-archive: when the last message is from the AI or an admin, this is when the chat is closed as "Inactive"
    // if the patient sent nothing (cleared by a patient message, a move to the Queue, or archiving).
    inactiveDueAt: { type: Date, default: null, index: true },
    followUpNoticeAt: { type: Date, default: null }, // the notice was shown (and the email sent): once per chat
    followUp: {
      // the generic follow-up email: sent at most once per chat
      status: { type: String, enum: ["", "sending", "sent", "failed", "skipped"], default: "" },
      at: { type: Date, default: null },
    },
    optionsUsed: { type: Boolean, default: false }, // quick-option cards are shown until one is picked
    offlineRequested: { type: Boolean, default: false }, // the email notice was shown (also set on older chats): stays in the Queue
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
    // The AI-notice acceptance of the visitor who started this chat (copied from the visitor when the chat starts, and
    // refreshed when they accept again). Only written while the Super Admin setting "Show AI notice" is on.
    consent: {
      aiNoticeAcceptedAt: { type: Date, default: null },
      policyVersion: { type: String, default: "", maxlength: 20 },
    },
    // Safety flags for the AI Review page. medical: the reply filter blocked a reply, the emergency detector fired, or the
    // model's topic / handoff reason was medical or emergency. reasons: reply_blocked | emergency_keyword |
    // model_emergency | model_medical (each at most once). lastAt: the latest time one of them happened.
    flags: {
      medical: { type: Boolean, default: false, index: true },
      reasons: [{ type: String, maxlength: 40 }],
      firstAt: { type: Date, default: null },
      lastAt: { type: Date, default: null },
    },
    // Summary of the append-only review log (LcReviewLog) for fast filtering: a new flag after a review makes the chat
    // unreviewed again. The log itself is the record.
    review: {
      status: { type: String, enum: ["", "unreviewed", "reviewed"], default: "" },
      lastOutcome: { type: String, enum: ["", "ok", "issue"], default: "" },
      lastAt: { type: Date, default: null },
      count: { type: Number, default: 0 },
    },
    // Who downloaded the transcript, newest last (a record of access for PHI, like LcFile.accessLog).
    transcriptLog: [{ _id: false, userId: { type: mongoose.Schema.Types.ObjectId }, at: { type: Date, default: Date.now } }],
    // The patient's language (not PHI): detected from the AI reply, or by one small model call. No badge for "en".
    language: {
      code: { type: String, default: "", maxlength: 8 },
      name: { type: String, default: "", maxlength: 40 },
      detectedAt: { type: Date, default: null },
    },
    // Admin side only: which view each admin chose for this chat ("original" or "en").
    translateViews: [{ _id: false, userId: { type: mongoose.Schema.Types.ObjectId }, view: { type: String, enum: ["original", "en"], default: "original" } }],
    tags: [{ type: String, trim: true, maxlength: 40 }],
    contact: { name: ENC_FIELD, email: ENC_FIELD, phone: ENC_FIELD },
    // Blind indexes of the contact (keyed hashes, never the values) for the Archive search. See utils/liveChat/crypto.js.
    searchKeys: {
      emailHash: { type: String, default: "", index: true },
      phoneHash: { type: String, default: "", index: true },
    },
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
    lastActivityAt: { type: Date, default: null }, // last visible patient / AI / agent message (decides Active / Recent / Archive)
    closedAt: { type: Date, default: null },
    // Set only while mode is "trashed": when, by whom (user id), and when the daily job purges it.
    trash: {
      at: { type: Date, default: null },
      byId: { type: mongoose.Schema.Types.ObjectId, default: null },
      purgeAfter: { type: Date, default: null },
    },
    aiReplyCount: { type: Number, default: 0 },
    tokens: { input: { type: Number, default: 0 }, output: { type: Number, default: 0 } },
    rating: { stars: { type: Number, min: 1, max: 5, default: null }, ratedAt: { type: Date, default: null } },
  },
  { timestamps: true }
);

conversationSchema.index({ mode: 1, lastMessageAt: -1 });
conversationSchema.index({ lastActivityAt: -1 });
conversationSchema.index({ "trash.purgeAfter": 1 }, { partialFilterExpression: { mode: "trashed" } });
conversationSchema.index({ "flags.medical": 1, "flags.lastAt": -1 }); // AI Review list
conversationSchema.index({ mode: 1, closedAt: -1 }); // Archive list and Archive temp

module.exports = mongoose.model("LcConversation", conversationSchema);
