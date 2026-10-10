const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;

// Append-only log: one row every time an admin opens a mail ("who viewed
// when"). The service must NOT record a view when the admin who sent an
// outbound mail opens their own mail (matches the approved demo).
// The first-view summary lives on EmailMessage (firstViewed*) for fast lists.
const emailViewSchema = new mongoose.Schema(
  {
    message: { type: ObjectId, ref: "EmailMessage", required: true },
    gmailThreadId: { type: String, default: null },
    mailbox: { type: ObjectId, ref: "Mailbox", required: true },
    admin: { type: ObjectId, ref: "User", required: true },
    // Snapshot so the viewer list still reads correctly if the admin changes.
    adminName: { type: String, default: "", trim: true, maxlength: 200 },
    viewedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

emailViewSchema.index({ message: 1, viewedAt: 1 });
emailViewSchema.index({ admin: 1, viewedAt: -1 });

module.exports = mongoose.model("EmailView", emailViewSchema);
