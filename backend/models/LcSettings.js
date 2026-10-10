const mongoose = require("mongoose");
const { DEFAULT_SETTINGS } = require("../services/liveChat/settingsDefaults");

// Live Chat settings: a single document (key "default"). Admin-edited in AI agent settings; seeded with the
// defaults from services/liveChat/settingsDefaults.js the first time the module starts.
const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true },
    aiMode: { type: String, enum: ["ai_first", "ai_off"], default: "ai_first" }, // an older "ai_when_no_agent" reads as ai_first
    agentDisplayName: { type: String, default: "Sam", trim: true, maxlength: 40 },
    greeting: { type: String, default: "", maxlength: 600 },
    // Minutes in the Queue without an admin reply before the patient is told an email follows (and gets it).
    followUpMinutes: { type: Number, default: 1, min: 1, max: 30 },
    handoffRules: {
      onUnsure: { type: Boolean, default: true }, // "unanswered": hands over after two misses in a row
      onAccountOrPayment: { type: Boolean, default: true }, // ... when the patient asks about their own booking or payment
      onPatientRequest: { type: Boolean, default: true }, // explicit_request
      onTechnicalIssue: { type: Boolean, default: true },
      onComplaint: { type: Boolean, default: true },
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
        link: { type: String, default: "", maxlength: 200 }, // optional site page shown as a button under the reply
      },
    ],
    prices: [{ _id: false, name: { type: String, required: true }, price: { type: Number, required: true } }],
    businessFacts: { type: String, default: "", maxlength: 8000 },
    dailySpendCapUsd: { type: Number, default: 3, min: 0 },
    unavailableMessage: { type: String, default: "", maxlength: 600 },
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
