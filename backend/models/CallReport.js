const mongoose = require("mongoose");

// One document per appointment / category-consultation video call: who joined
// from what, when, how often they dropped, and a bounded event trail. The
// admin-only "Call report" page is rendered from this. Written fire-and-forget
// by utils/callReportRecorder.js from the signaling server's own join / drop /
// leave / completion events, so a client that crashes (and never sends a final
// summary) still leaves an accurate report.
//
// Deliberately NOT stored: IP addresses (only the same masked form the direct
// report keeps, admin-only), the raw User-Agent string, SDP / ICE candidate
// addresses, chat, or any media.
const participantSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["doctor", "patient"], required: true },
    userId: { type: String, default: "" },

    // Where they joined from. `platform` "app" = a native app whose OS we could
    // not tell (e.g. a client that does not declare itself); `source` says how
    // we know: "declared" (the client said so and the User-Agent agrees),
    // "ua-inferred" (only the User-Agent), "ua-overrode-declared" (they
    // disagreed; the User-Agent wins). Informational only - never used for access.
    platform: { type: String, enum: ["web", "android", "ios", "app", "unknown"], default: "unknown" },
    platformSource: { type: String, default: "" },
    appVersion: { type: String, default: "" },
    osName: { type: String, default: "" },
    osVersion: { type: String, default: "" },
    browser: { type: String, default: "" },
    browserVersion: { type: String, default: "" },
    deviceModel: { type: String, default: "" },
    maskedIp: { type: String, default: "" },

    firstJoinedAt: { type: Date },
    lastSeenAt: { type: Date },
    leftAt: { type: Date },
    joins: { type: Number, default: 0 },
    reconnects: { type: Number, default: 0 },
    disconnects: { type: Number, default: 0 },
    connectionState: { type: String, default: "" }, // connected | disconnected | left
  },
  { _id: false },
);

const eventSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    type: { type: String, required: true },
    role: { type: String, default: "" },
    detail: { type: mongoose.Schema.Types.Mixed, default: undefined },
  },
  { _id: false },
);

const callReportSchema = new mongoose.Schema({
  // Appointment._id or CategoryConsultation._id, as a string.
  appointmentId: { type: String, required: true, unique: true, index: true },
  kind: { type: String, enum: ["appointment", "category_consultation"], default: "appointment" },

  participants: {
    doctor: { type: participantSchema, default: undefined },
    patient: { type: participantSchema, default: undefined },
  },

  firstActivityAt: { type: Date },
  lastActivityAt: { type: Date },
  // First moment both sides were in the call together.
  bothPresentAt: { type: Date },
  // First moment a client reported its peer connection as connected (or, if
  // none ever did, the server's own both-present-for-a-while inference).
  connectedAt: { type: Date },
  connectedSource: { type: String, default: "" }, // "client" | "server-inferred"
  callEndedAt: { type: Date },
  // Sum of the periods during which both participants were in the call.
  durationSec: { type: Number, default: 0 },
  endReason: { type: String, default: "" }, // completed | cancelled | participants_left | ""

  // Date fields have NO default on purpose: first-wins fields are written with
  // $min, which would never overwrite a null default.
  // Capped trail (see EVENT_CAP in the recorder).
  events: { type: [eventSchema], default: [] },

  // Who opened the report (audit trail; recordActivity itself is a no-op here).
  views: {
    type: [new mongoose.Schema({ at: Date, adminId: String, adminName: String }, { _id: false })],
    default: [],
  },

  // 90-day retention, refreshed on every write.
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

module.exports = mongoose.model("CallReport", callReportSchema);
