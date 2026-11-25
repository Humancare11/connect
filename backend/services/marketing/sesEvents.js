const MarketingRecipient = require("../../models/MarketingRecipient");
const { suppress, skipQueuedFor } = require("./suppression");

// Applies one SES event (delivered by SNS, see routes/publicSesEvents.js) to the campaign recipient it is about.
// Idempotent: SNS can deliver the same event twice, and events can arrive out of order.
//   Delivery    sent -> delivered
//   Bounce      Permanent: bounced + address suppressed for good. Transient / Undetermined: remembered, nothing else changes
//   Complaint   complained + address suppressed for good
//   Reject / Rendering failure: failed
// Never logs an address.

const addressesOf = (list) => (Array.isArray(list) ? list.map((r) => String(r?.emailAddress || "").toLowerCase().trim()).filter(Boolean) : []);

// → { handled: boolean, type }
async function applySesEvent(event, { now = new Date() } = {}) {
  const type = String(event?.eventType || event?.notificationType || "");
  const messageId = String(event?.mail?.messageId || "");
  if (!type || !messageId) return { handled: false, type };

  const recipient = await MarketingRecipient.findOne({ sesMessageId: messageId }).select("_id campaign status email").lean();
  if (!recipient) return { handled: false, type }; // not one of ours (system mail, another environment...)

  if (type === "Delivery") {
    await MarketingRecipient.updateOne(
      { _id: recipient._id, status: "sent" },
      { $set: { status: "delivered", deliveredAt: event?.delivery?.timestamp ? new Date(event.delivery.timestamp) : now } }
    );
    return { handled: true, type };
  }

  if (type === "Bounce") {
    const bounceType = String(event?.bounce?.bounceType || "");
    if (bounceType === "Permanent") {
      await MarketingRecipient.updateOne(
        { _id: recipient._id, status: { $in: ["sent", "delivered", "sending", "uncertain"] } },
        { $set: { status: "bounced", bouncedAt: now, bounceType } }
      );
      const addresses = addressesOf(event?.bounce?.bouncedRecipients);
      for (const email of addresses.length ? addresses : [recipient.email].filter(Boolean)) {
        await suppress({ email, reason: "bounce", campaign: recipient.campaign, at: now });
        await skipQueuedFor(email);
      }
    } else {
      await MarketingRecipient.updateOne({ _id: recipient._id }, { $set: { bounceType: bounceType || "Undetermined" } });
    }
    return { handled: true, type };
  }

  if (type === "Complaint") {
    await MarketingRecipient.updateOne(
      { _id: recipient._id, status: { $in: ["sent", "delivered", "sending", "uncertain"] } },
      { $set: { status: "complained", complainedAt: now } }
    );
    const addresses = addressesOf(event?.complaint?.complainedRecipients);
    for (const email of addresses.length ? addresses : [recipient.email].filter(Boolean)) {
      await suppress({ email, reason: "complaint", campaign: recipient.campaign, at: now });
      await skipQueuedFor(email);
    }
    return { handled: true, type };
  }

  if (type === "Reject" || type === "Rendering Failure" || type === "RenderingFailure") {
    await MarketingRecipient.updateOne(
      { _id: recipient._id, status: { $in: ["sent", "sending", "uncertain"] } },
      { $set: { status: "failed", errorCode: type.replace(/\s+/g, "") } }
    );
    return { handled: true, type };
  }

  return { handled: true, type };
}

module.exports = { applySesEvent };
