const mongoose = require("mongoose");
const { DEFAULT_SETTINGS } = require("../services/liveChat/settingsDefaults");

// Live Chat settings: a single document (key "default"). Admin-edited in AI agent settings; seeded with the
// defaults from services/liveChat/settingsDefaults.js the first time the module starts.
const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true },
    aiMode: { type: String, enum: ["ai_first", "ai_when_no_agent", "ai_off"], default: "ai_first" },
    agentDisplayName: { type: String, default: "Sam", trim: true, maxlength: 40 },
    greeting: { type: String, default: "", maxlength: 600 },
    supportHours: {
      timezone: { type: String, default: "America/New_York" },
      days: [
        {
          _id: false,
          day: { type: String, enum: ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] },
          enabled: { type: Boolean, default: true },
          open: { type: String, default: "08:00" },
          close: { type: String, default: "22:00" },
        },
      ],
    },
    // When the team counts as offline (the patient is told and gets an email instead of waiting):
    //   hours_or_no_agent  outside support hours OR no agent online (default)
    //   no_agent           no agent online (support hours are not used)
    //   hours              outside support hours (agents being online is not required)
    offlineRule: { type: String, enum: ["hours_or_no_agent", "no_agent", "hours"], default: "hours_or_no_agent" },
    handoffRules: {
      onUnsure: { type: Boolean, default: true }, // the AI hands over when the facts do not answer the question
      onAccountOrPayment: { type: Boolean, default: true }, // ... when the patient asks about their own booking or payment
      onPatientRequest: { type: Boolean, default: true },
      onAiRequest: { type: Boolean, default: true },
      maxAiRepliesPerChat: { type: Number, default: 30, min: 1, max: 200 },
      // If the agent holding a chat goes offline or logs out, the chat returns to the Queue after this long.
      agentOfflineGraceSeconds: { type: Number, default: 120, min: 0, max: 3600 },
    },
    quickOptions: [
      {
        _id: false,
        key: { type: String, required: true },
        label: { type: String, required: true, maxlength: 80 },
        icon: { type: String, default: "dots" },
        reply: { type: String, default: "", maxlength: 1200 },
      },
    ],
    prices: [{ _id: false, name: { type: String, required: true }, price: { type: Number, required: true } }],
    businessFacts: { type: String, default: "", maxlength: 8000 },
    dailySpendCapUsd: { type: Number, default: 3, min: 0 },
    unavailableMessage: { type: String, default: "", maxlength: 600 },
    offlineMessage: { type: String, default: "", maxlength: 600 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// Returns the settings document, creating it with the seeded defaults if it does not exist yet.
settingsSchema.statics.getSettings = async function getSettings() {
  // Read first: an upsert counts as an update to Mongoose and would change updatedAt on every read.
  const existing = await this.findOne({ key: "default" });
  if (existing) return existing;
  return this.findOneAndUpdate(
    { key: "default" },
    { $setOnInsert: DEFAULT_SETTINGS },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
};

module.exports = mongoose.model("LcSettings", settingsSchema);
