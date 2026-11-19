const MarketingSuppression = require("../../models/MarketingSuppression");
const MarketingRecipient = require("../../models/MarketingRecipient");

// The global suppression list (unsubscribes, bounces, complaints). Marketing mail only.

// → Set of the given addresses (lowercase) that must NOT be sent to.
async function suppressedSet(emails) {
  const list = [...new Set(emails.map((e) => String(e || "").toLowerCase()).filter(Boolean))];
  if (!list.length) return new Set();
  const rows = await MarketingSuppression.find({ email: { $in: list } }).select("email").lean();
  return new Set(rows.map((r) => r.email));
}

const isSuppressed = async (email) => (await suppressedSet([email])).has(String(email || "").toLowerCase());

// Idempotent. The first reason stays (an unsubscribe is never overwritten by a later bounce).
async function suppress({ email, reason, campaign = null, at = new Date() }) {
  const address = String(email || "").toLowerCase().trim();
  if (!address) return null;
  await MarketingSuppression.updateOne({ email: address }, { $setOnInsert: { email: address, reason, campaign, at } }, { upsert: true });
  return address;
}

// Every still-waiting row for this address, in every campaign, is skipped at once: a person who unsubscribes
// (or bounces) in the middle of a campaign gets nothing more.
async function skipQueuedFor(email) {
  const address = String(email || "").toLowerCase().trim();
  if (!address) return 0;
  const res = await MarketingRecipient.updateMany(
    { email: address, status: "queued" },
    { $set: { status: "skipped", skipReason: "suppressed" } }
  );
  return res.modifiedCount || 0;
}

module.exports = { suppressedSet, isSuppressed, suppress, skipQueuedFor };
