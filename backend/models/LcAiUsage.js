const mongoose = require("mongoose");

// AI usage per day (US Eastern date, YYYY-MM-DD). Feeds the daily spend cap and the reports.
const aiUsageSchema = new mongoose.Schema(
  {
    day: { type: String, required: true, unique: true },
    requests: { type: Number, default: 0 },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    costUsd: { type: Number, default: 0 },
    capReachedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LcAiUsage", aiUsageSchema);
