const mongoose = require("mongoose");
const { encryptEmailContent, decryptEmailContent } = require("../utils/emailCrypto");

const { ObjectId } = mongoose.Schema.Types;

const addressSchema = new mongoose.Schema(
  { name: { type: String, default: "", trim: true, maxlength: 200 }, address: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 } },
  { _id: false }
);

// AES-GCM envelope for { text, html, snippet } — see utils/emailCrypto.js.
const contentSchema = new mongoose.Schema(
  { cipherText: String, iv: String, authTag: String, keyVersion: String },
  { _id: false }
);

// One row per mail message, inbound or outbound. The list screens are per
// message; the thread page loads every row sharing a gmailThreadId.
//
// Subject, addresses and names stay plaintext so list filters/search work.
// Body text/html AND the snippet (which is just the body's first characters)
// are encrypted in `content`.
const emailMessageSchema = new mongoose.Schema(
  {
    mailbox: { type: ObjectId, ref: "Mailbox", required: true },
    direction: { type: String, enum: ["in", "out"], required: true },

    // Gmail identity. Null for an outbound row that has not been sent (yet).
    gmailMessageId: { type: String, default: null },
    gmailThreadId: { type: String, default: null, index: true },
    rfcMessageId: { type: String, default: "" },
    inReplyTo: { type: String, default: "" },
    references: [{ type: String }],

    from: { type: addressSchema, required: true },
    to: { type: [addressSchema], default: [] },
    cc: { type: [addressSchema], default: [] },
    subject: { type: String, default: "", trim: true, maxlength: 998 },
    content: { type: contentSchema, default: null },

    // Date shown in lists: Gmail's internalDate for inbound, send time for outbound.
    messageDate: { type: Date, required: true },

    // Spam is a folder in the demo UI. Trash/Drafts are intentionally not tracked.
    isSpam: { type: Boolean, default: false },
    hasAttachments: { type: Boolean, default: false },
    attachmentCount: { type: Number, default: 0 },

    // ── Attribution (outbound) ──
    // Always taken from req.user.id, never from a request body. Null for mail
    // that was sent from the Gmail website (sentOutsideDashboard).
    sentByAdmin: { type: ObjectId, ref: "User", default: null },
    // Name snapshot so history survives an admin being renamed/removed.
    sentByName: { type: String, default: "", trim: true, maxlength: 200 },
    sentOutsideDashboard: { type: Boolean, default: false },

    // inbound: "received". outbound: "sending" → "sent" | "failed", then
    // "replied" once the recipient answers in the same thread.
    status: {
      type: String,
      enum: ["received", "sending", "sent", "replied", "failed"],
      required: true,
    },
    failureReason: { type: String, default: "", maxlength: 500 },

    // inbound:  a dashboard admin replied — repliedBy/repliedByName say who.
    // outbound: the recipient replied — repliedAt only (repliedBy stays null).
    repliedBy: { type: ObjectId, ref: "User", default: null },
    repliedByName: { type: String, default: "", trim: true, maxlength: 200 },
    repliedAt: { type: Date, default: null },

    // First admin to open the mail, set atomically (see EmailView). Denormalised
    // so list rows need no join. Null firstViewedAt = "Not viewed by anyone".
    firstViewedBy: { type: ObjectId, ref: "User", default: null },
    firstViewedByName: { type: String, default: "", trim: true, maxlength: 200 },
    firstViewedAt: { type: Date, default: null },

    // Idempotency key from the compose form so a double-click can't send twice.
    clientRequestId: { type: String, default: null, maxlength: 100 },
  },
  { timestamps: true }
);

// A Gmail message appears once per mailbox (sync + our own sends dedupe on this).
emailMessageSchema.index(
  { mailbox: 1, gmailMessageId: 1 },
  { unique: true, partialFilterExpression: { gmailMessageId: { $type: "string" } } }
);
emailMessageSchema.index(
  { sentByAdmin: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } }
);
// Folder lists + filters.
emailMessageSchema.index({ mailbox: 1, direction: 1, isSpam: 1, messageDate: -1 });
emailMessageSchema.index({ direction: 1, isSpam: 1, messageDate: -1 });
// Unread (= no admin has viewed it) counts.
emailMessageSchema.index({ mailbox: 1, direction: 1, isSpam: 1, firstViewedAt: 1 });
// Thread page, and "Sent by" / "First viewed by" filters.
emailMessageSchema.index({ gmailThreadId: 1, messageDate: 1 });
emailMessageSchema.index({ sentByAdmin: 1, messageDate: -1 });
emailMessageSchema.index({ firstViewedBy: 1, messageDate: -1 });

emailMessageSchema.methods.setContent = function setContent(content) {
  this.content = encryptEmailContent(content);
};

// → { text, html, snippet }
emailMessageSchema.methods.getContent = function getContent() {
  return decryptEmailContent(this.content);
};

module.exports = mongoose.model("EmailMessage", emailMessageSchema);
