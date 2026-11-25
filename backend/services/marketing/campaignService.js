const mongoose = require("mongoose");
const Mailbox = require("../../models/Mailbox");
const MarketingCampaign = require("../../models/MarketingCampaign");
const MarketingRecipient = require("../../models/MarketingRecipient");
const { marketingConfig, sendReadiness } = require("./config");
const { parseRecipientInput, isValidEmail, RecipientInputError } = require("./recipientParser");
const { sanitizeEmailHtml } = require("./sanitizer");
const { renderMail, unknownPlaceholders, usesPlaceholder } = require("./render");
const { suppressedSet } = require("./suppression");
const { countsFor, countsOrEmpty } = require("./report");
const { textToHtml, MAX_SOURCE_CHARS } = require("./textToHtml");
const sig = require("./signature");

// The rules of Email Marketing in one place; routes/adminEmailMarketing.js only calls these.
// Nothing here logs an address, a name or any content.

class MarketingHttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.name = "MarketingHttpError";
    this.status = status;
    this.extra = extra;
  }
}

const MAX_HTML_BYTES = 1_000_000;
const PREVIEW_LIST = 50;

const cleanLine = (v, max) => String(v ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const idOrThrow = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new MarketingHttpError(404, "Campaign not found.");
  return id;
};

// Mail IDs this admin may send marketing from: active, switched on for marketing, and (like the Email page)
// open to every admin or to this admin in particular.
const marketingMailboxFilter = (actorId) => ({
  isActive: true,
  allowedForMarketing: true,
  $or: [{ allowedAdmins: { $size: 0 } }, { allowedAdmins: actorId }],
});

async function listMailboxes(actor) {
  const rows = await Mailbox.find(marketingMailboxFilter(actor.id)).sort({ sortOrder: 1, address: 1 }).select("address displayName").lean();
  return rows.map((m) => ({ id: String(m._id), address: m.address, displayName: m.displayName }));
}

async function requireMarketingMailbox(actor, mailboxId) {
  if (!mongoose.isValidObjectId(mailboxId)) throw new MarketingHttpError(400, "Choose a Mail ID to send from.");
  const mailbox = await Mailbox.findOne({ _id: mailboxId, ...marketingMailboxFilter(actor.id) }).lean();
  if (!mailbox) throw new MarketingHttpError(400, "That Mail ID is not allowed for marketing.");
  return mailbox;
}

async function loadCampaign(id) {
  const campaign = await MarketingCampaign.findById(idOrThrow(id));
  if (!campaign) throw new MarketingHttpError(404, "Campaign not found.");
  return campaign;
}

const requireDraft = (campaign) => {
  if (campaign.status !== "draft") throw new MarketingHttpError(409, "This campaign has already been sent. It can no longer be edited.");
};

// Parses what the admin typed and removes the people who unsubscribed (or bounced / complained) earlier.
async function parseWithSuppression({ mode, text }, cfg = marketingConfig()) {
  let parsed;
  try {
    parsed = parseRecipientInput({ mode, text }, { max: cfg.maxRecipients });
  } catch (err) {
    if (err instanceof RecipientInputError) throw new MarketingHttpError(400, err.message, { code: err.code });
    throw err;
  }
  const blocked = await suppressedSet(parsed.recipients.map((r) => r.email));
  const recipients = parsed.recipients.filter((r) => !blocked.has(r.email));
  return {
    recipients,
    invalid: parsed.invalid,
    invalidCount: parsed.invalidCount,
    duplicates: parsed.duplicates,
    suppressed: parsed.recipients.filter((r) => blocked.has(r.email)).map((r) => r.email).slice(0, 200),
    suppressedCount: blocked.size,
  };
}

// Dry run for the Recipients step: nothing is saved.
async function previewRecipients(input, cfg = marketingConfig()) {
  const r = await parseWithSuppression(input, cfg);
  return {
    willReceive: r.recipients.length,
    list: r.recipients.slice(0, PREVIEW_LIST),
    invalid: r.invalid,
    invalidCount: r.invalidCount,
    duplicates: r.duplicates,
    suppressed: r.suppressed,
    suppressedCount: r.suppressedCount,
  };
}

async function createDraft({ actor, name, mailboxId }) {
  const mailbox = await requireMarketingMailbox(actor, mailboxId);
  const title = cleanLine(name, 120);
  if (!title) throw new MarketingHttpError(400, "Give the campaign a name.");
  return MarketingCampaign.create({
    name: title,
    mailbox: mailbox._id,
    fromAddress: mailbox.address,
    fromName: cleanLine(mailbox.displayName, 80),
    createdBy: actor.id,
    createdByName: actor.name || "",
  });
}

// Saves any of: name, mailbox, recipients, subject, html, fallbacks. Recipients are replaced as a whole.
async function updateDraft({ campaign, actor, body, cfg = marketingConfig() }) {
  requireDraft(campaign);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new MarketingHttpError(400, "Invalid request.");

  if (body.name !== undefined) {
    const title = cleanLine(body.name, 120);
    if (!title) throw new MarketingHttpError(400, "Give the campaign a name.");
    campaign.name = title;
  }
  if (body.mailboxId !== undefined && String(body.mailboxId) !== String(campaign.mailbox)) {
    const mailbox = await requireMarketingMailbox(actor, body.mailboxId);
    campaign.mailbox = mailbox._id;
    campaign.fromAddress = mailbox.address;
    campaign.fromName = cleanLine(mailbox.displayName, 80);
  }
  if (body.subject !== undefined) {
    if (typeof body.subject !== "string") throw new MarketingHttpError(400, "The subject must be text.");
    campaign.subject = body.subject.replace(/[\r\n\u0000-\u001F\u007F]+/g, " ").trim().slice(0, 300);
  }
  if (body.fallbackName !== undefined) campaign.fallbackName = cleanLine(body.fallbackName, 60) || "there";
  if (body.fallbackCompany !== undefined) campaign.fallbackCompany = cleanLine(body.fallbackCompany, 60);
  if (body.addSignature !== undefined) {
    if (typeof body.addSignature !== "boolean") throw new MarketingHttpError(400, "Add my signature must be true or false.");
    campaign.addSignature = body.addSignature;
  }
  if (body.contentMode !== undefined) {
    if (!["paste", "file", "text"].includes(body.contentMode)) throw new MarketingHttpError(400, "Unknown design type.");
    campaign.contentMode = body.contentMode;
  }
  if (body.sourceText !== undefined) {
    if (typeof body.sourceText !== "string") throw new MarketingHttpError(400, "The text must be text.");
    if (body.sourceText.length > MAX_SOURCE_CHARS) throw new MarketingHttpError(413, "The text is too long.");
    campaign.sourceText = body.sourceText;
  }
  // "Write text": the HTML is always made from the typed text here on the server, whatever html the browser sent.
  const fromText = campaign.contentMode === "text" && (body.sourceText !== undefined || body.contentMode !== undefined);
  if (campaign.contentMode !== "text" && campaign.sourceText) campaign.sourceText = "";
  const incomingHtml = fromText ? textToHtml(campaign.sourceText) : body.html;
  if (incomingHtml !== undefined) {
    if (typeof incomingHtml !== "string") throw new MarketingHttpError(400, "The email design must be text.");
    if (Buffer.byteLength(incomingHtml, "utf8") > MAX_HTML_BYTES) throw new MarketingHttpError(413, "The email design is too large (limit 1 MB).");
    if (incomingHtml.trim()) {
      const clean = sanitizeEmailHtml(incomingHtml);
      campaign.html = clean.html;
      campaign.htmlRemoved = clean.removed;
    } else {
      campaign.html = "";
      campaign.htmlRemoved = { scripts: 0, eventHandlers: 0, otherUnsafe: 0 };
    }
  }

  let summary = null;
  if (body.recipients !== undefined) {
    if (!body.recipients || typeof body.recipients !== "object") throw new MarketingHttpError(400, "Invalid recipients.");
    const parsed = await parseWithSuppression(body.recipients, cfg);
    await MarketingRecipient.deleteMany({ campaign: campaign._id });
    if (parsed.recipients.length) {
      await MarketingRecipient.insertMany(
        parsed.recipients.map((r) => ({ campaign: campaign._id, email: r.email, name: r.name, company: r.company })),
        { ordered: false }
      );
    }
    campaign.invalidCount = parsed.invalidCount;
    campaign.duplicatesCount = parsed.duplicates;
    campaign.suppressedCount = parsed.suppressedCount;
    summary = {
      willReceive: parsed.recipients.length,
      invalid: parsed.invalid,
      invalidCount: parsed.invalidCount,
      duplicates: parsed.duplicates,
      suppressed: parsed.suppressed,
      suppressedCount: parsed.suppressedCount,
    };
  }

  await campaign.save();
  return { campaign, summary };
}

async function deleteDraft(campaign, store = null) {
  requireDraft(campaign);
  if (campaign.signature && store) await sig.removeCampaignSignature(campaign, store);
  await MarketingRecipient.deleteMany({ campaign: campaign._id });
  await MarketingCampaign.deleteOne({ _id: campaign._id });
}

// ── What the pages show ──

const estimateOf = (total, cfg) => ({
  minutes: Math.max(1, Math.ceil(total / cfg.sendRatePerSecond / 60)),
  days: Math.max(1, Math.ceil(total / cfg.dailyCap)),
  dailyCap: cfg.dailyCap,
});

function serializeCampaign(c, counts = null) {
  return {
    id: String(c._id),
    name: c.name,
    mailboxId: String(c.mailbox),
    fromAddress: c.fromAddress,
    fromName: c.fromName,
    subject: c.subject,
    status: c.status,
    holdReason: c.holdReason || "",
    createdBy: c.createdByName || "",
    sentBy: c.sentByName || "",
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    startedAt: c.startedAt,
    finishedAt: c.finishedAt,
    counts,
  };
}

async function listCampaigns() {
  const campaigns = await MarketingCampaign.find({}).sort({ createdAt: -1 }).limit(200).lean();
  const counts = await countsFor(campaigns.map((c) => c._id));
  return campaigns.map((c) => serializeCampaign(c, countsOrEmpty(counts, c._id)));
}

// The editor's view of a draft: settings, content, and the recipients as lines it can show again.
async function draftView(campaign, cfg = marketingConfig(), actorId = null) {
  const rows = await MarketingRecipient.find({ campaign: campaign._id }).sort({ _id: 1 }).select("email name company").lean();
  const lines = rows.map((r) => [r.name, r.company, r.email].filter((x, i) => x || i === 2).join(", ")).join("\n");
  return {
    ...serializeCampaign(campaign),
    html: campaign.html,
    contentMode: campaign.contentMode || "paste",
    sourceText: campaign.sourceText || "",
    addSignature: campaign.addSignature,
    // Does the person looking at the draft (who will be the sender) have a signature image?
    hasSignatureImage: actorId ? Boolean((await sig.loadOwnSignature(actorId)).image) : null,
    htmlRemoved: campaign.htmlRemoved,
    fallbackName: campaign.fallbackName,
    fallbackCompany: campaign.fallbackCompany,
    recipientCount: rows.length,
    recipientsText: lines,
    invalidCount: campaign.invalidCount,
    duplicatesCount: campaign.duplicatesCount,
    suppressedCount: campaign.suppressedCount,
    estimate: estimateOf(rows.length, cfg),
    sendReady: sendReadiness(cfg).length === 0,
  };
}

const MY_SIGNATURE_PATH = "/admin-dashboard/email/settings/my-signature";

// signature: "added" | "none" (box ticked, no image) | "off"
function buildChecks(campaign, bytes, signature = "off") {
  const out = [];
  const used = usesPlaceholder(campaign.subject, campaign.html);
  out.push({
    key: "placeholder",
    ok: used,
    text: used ? "Name placeholder found" : "No {{name}} or {{company}} found, so everyone gets the same text",
  });
  const unknown = unknownPlaceholders(campaign.subject, campaign.html);
  if (unknown.length) out.push({ key: "unknown", ok: false, text: `Unknown placeholder ${unknown.map((n) => `{{${n}}}`).join(", ")} will show as written` });
  const r = campaign.htmlRemoved || {};
  const unsafe = (r.scripts || 0) + (r.eventHandlers || 0) + (r.otherUnsafe || 0);
  out.push({
    key: "scripts",
    ok: unsafe === 0,
    text: unsafe === 0 ? "No scripts" : `${unsafe} unsafe item${unsafe === 1 ? "" : "s"} (scripts, event handlers, forms) removed. Email apps don’t run them`,
  });
  const httpImages = /<img\b[^>]*\ssrc="http:/i.test(campaign.html || "");
  out.push({ key: "http", ok: !httpImages, text: httpImages ? "Some images use http. Use https links" : "Image links look fine" });
  const kb = Math.ceil((bytes || 0) / 1024);
  out.push({ key: "size", ok: kb < 100, text: kb < 100 ? `Size ${kb} KB, fine` : `Size ${kb} KB. Gmail clips emails over 100 KB` });
  if (signature === "added") out.push({ key: "signature", ok: true, text: "Your signature is added before the footer" });
  if (signature === "none") {
    out.push({ key: "signature", ok: false, text: "Signature: none (you have no signature yet)", link: { text: "My signature", href: MY_SIGNATURE_PATH } });
  }
  out.push({ key: "unsubscribe", ok: true, text: "Unsubscribe link is added at the bottom" });
  return out;
}

// One recipient's mail as it will look (no tracking, no real unsubscribe link). `index` walks the recipient list.
async function previewMail(campaign, index = 0, cfg = marketingConfig(), { actor = null, store = null } = {}) {
  const total = await MarketingRecipient.countDocuments({ campaign: campaign._id });
  if (!total) throw new MarketingHttpError(400, "Add recipients first.");
  const i = Number.isInteger(index) ? ((index % total) + total) % total : 0;
  const rec = await MarketingRecipient.findOne({ campaign: campaign._id }).sort({ _id: 1 }).skip(i).select("email name company").lean();
  let signature = null;
  let signatureState = "off";
  if (campaign.addSignature) {
    // A sent campaign shows its own snapshot; a draft shows the current admin's image inline (no public copy exists yet).
    signature = campaign.signature ? sig.campaignBlock(campaign, cfg.baseUrl) : actor && store ? await sig.previewBlock({ ownerId: actor.id, store }) : null;
    signatureState = signature ? "added" : "none";
  }
  const mail = renderMail({
    campaign,
    recipient: rec,
    footerAddress: cfg.footerAddress || "Humancare Connect",
    unsubscribeUrl: "#",
    signature,
  });
  return {
    index: i,
    total,
    recipient: { name: rec.name || "", email: rec.email },
    subject: mail.subject,
    html: mail.html,
    checks: buildChecks(campaign, mail.bytes, signatureState),
  };
}

// ── Test, send, stop, retry ──

async function sendTest({ campaign, actor, to, sender, cfg = marketingConfig(), store = null }) {
  const address = String(to || "").trim();
  if (!isValidEmail(address)) throw new MarketingHttpError(400, "Enter a valid email address for the test.");
  if (!campaign.subject.trim() || !campaign.html.trim()) throw new MarketingHttpError(400, "Add a subject and the email design first.");
  const missing = sendReadiness(cfg);
  if (missing.length) throw new MarketingHttpError(503, "Email Marketing is not fully set up yet.", { missing });
  await requireMarketingMailbox(actor, campaign.mailbox);

  const first = await MarketingRecipient.findOne({ campaign: campaign._id }).sort({ _id: 1 }).select("name company").lean();
  // The tester is the sender: their signature, as a temporary hosted copy (removed automatically after 7 days).
  let signature = null;
  if (campaign.addSignature && store) {
    try {
      signature = await sig.createTestCopy({ ownerId: actor.id, store, baseUrl: cfg.baseUrl });
    } catch (err) {
      console.error("[marketing] test signature copy failed:", err?.name || "error");
      throw new MarketingHttpError(502, "Your signature could not be prepared for the test email. Please try again.");
    }
  }
  const mail = renderMail({
    campaign,
    recipient: first || {},
    footerAddress: cfg.footerAddress,
    unsubscribeUrl: `${cfg.baseUrl}/api/u/test`, // a test mail has no real unsubscribe link
    signature,
  });
  try {
    await sender.send({
      fromAddress: campaign.fromAddress,
      fromName: campaign.fromName,
      to: address,
      replyTo: campaign.fromAddress,
      subject: `[Test] ${mail.subject}`.slice(0, 300),
      html: mail.html,
      text: mail.text,
    });
  } catch (err) {
    console.error("[marketing] test send failed:", err?.name || "error");
    throw new MarketingHttpError(502, "The test email could not be sent. Check that the address is allowed (in the SES sandbox only verified addresses work).");
  }
}

async function startCampaign({ campaign, actor, confirm, cfg = marketingConfig(), store = null }) {
  if (confirm !== true) throw new MarketingHttpError(400, "Tick the box to confirm before sending.");
  const missing = sendReadiness(cfg);
  if (missing.length) throw new MarketingHttpError(503, "Email Marketing is not fully set up yet.", { missing });
  if (campaign.status !== "draft") throw new MarketingHttpError(409, "This campaign has already been started.");
  if (!campaign.subject.trim() || !campaign.html.trim()) throw new MarketingHttpError(400, "Add a subject and the email design first.");
  await requireMarketingMailbox(actor, campaign.mailbox);

  // Anyone who unsubscribed since the list was saved is skipped now, so the counts are true.
  const rows = await MarketingRecipient.find({ campaign: campaign._id, status: "queued" }).select("email").lean();
  if (!rows.length) throw new MarketingHttpError(400, "There are no recipients to send to.");
  const blocked = await suppressedSet(rows.map((r) => r.email));
  if (blocked.size) {
    await MarketingRecipient.updateMany(
      { campaign: campaign._id, status: "queued", email: { $in: [...blocked] } },
      { $set: { status: "skipped", skipReason: "suppressed" } }
    );
  }

  // Signature snapshot: the SENDER's (the session user's) image, copied to a key this campaign owns. Ticked but no
  // signature: send without one. If the copy fails nothing has started, so the admin can simply try again.
  let snapshot = null;
  if (campaign.addSignature && store) {
    try {
      snapshot = await sig.snapshotForCampaign({ campaignId: campaign._id, ownerId: actor.id, store });
    } catch (err) {
      console.error("[marketing] signature snapshot failed:", err?.name || "error");
      throw new MarketingHttpError(502, "Your signature could not be prepared. Please try again.");
    }
  }

  // Atomic: a double click or two admins can start it only once.
  const started = await MarketingCampaign.findOneAndUpdate(
    { _id: campaign._id, status: "draft" },
    { $set: { status: "sending", sentBy: actor.id, sentByName: actor.name || "", confirmedAt: new Date(), startedAt: new Date(), holdReason: "", holdUntil: null, signature: snapshot } },
    { returnDocument: "after" }
  );
  if (!started) {
    if (snapshot) await sig.removeCampaignSignature({ signature: snapshot }, store);
    throw new MarketingHttpError(409, "This campaign has already been started.");
  }
  return started;
}

// Stop sending: whatever is still waiting is skipped; what was already handed to SES cannot be recalled.
async function stopCampaign(campaign) {
  if (campaign.status !== "sending") throw new MarketingHttpError(409, "This campaign is not sending.");
  const updated = await MarketingCampaign.findOneAndUpdate(
    { _id: campaign._id, status: "sending" },
    { $set: { status: "stopped", stoppedAt: new Date(), finishedAt: new Date(), holdReason: "", holdUntil: null } },
    { returnDocument: "after" }
  );
  if (!updated) throw new MarketingHttpError(409, "This campaign is not sending.");
  await MarketingRecipient.updateMany({ campaign: campaign._id, status: "queued" }, { $set: { status: "skipped", skipReason: "stopped" } });
  return updated;
}

// Manual only. These mails were interrupted around the SES call, so they MAY already have been delivered.
async function retryUncertain(campaign) {
  if (!["sending", "sent"].includes(campaign.status)) throw new MarketingHttpError(409, "This campaign cannot be retried.");
  const res = await MarketingRecipient.updateMany(
    { campaign: campaign._id, status: "uncertain" },
    { $set: { status: "queued", errorCode: "", attempts: 0, nextAttemptAt: null, lockedUntil: null } }
  );
  if (res.modifiedCount && campaign.status === "sent") {
    await MarketingCampaign.updateOne({ _id: campaign._id, status: "sent" }, { $set: { status: "sending", finishedAt: null } });
  }
  return res.modifiedCount || 0;
}

module.exports = {
  MarketingHttpError,
  listMailboxes,
  requireMarketingMailbox,
  loadCampaign,
  parseWithSuppression,
  previewRecipients,
  createDraft,
  updateDraft,
  deleteDraft,
  serializeCampaign,
  listCampaigns,
  draftView,
  buildChecks,
  previewMail,
  sendTest,
  startCampaign,
  stopCampaign,
  retryUncertain,
  estimateOf,
};
