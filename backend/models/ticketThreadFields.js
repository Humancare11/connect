// Fields shared by Ticket (doctors) and UserTicket (patients): the conversation thread, the
// raiser's timezone and who closed the ticket. Kept in one place so both models stay identical.
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: { type: String, enum: ["user", "admin"], required: true },
  text: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});

const threadFields = {
  // IANA name sent by the browser (Intl.DateTimeFormat().resolvedOptions().timeZone). "" when unknown.
  userTimezone: { type: String, default: "", trim: true, maxlength: 64 },
  messages: { type: [messageSchema], default: [] },
  closedAt: { type: Date, default: null },
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
};

module.exports = { messageSchema, threadFields };
