const MarketingRecipient = require("../../models/MarketingRecipient");
const { marketingConfig } = require("./config");

// Retention: after MARKETING_RETENTION_MONTHS (12) the recipients' personal fields (email, name, company) are removed.
// Campaign counts and the recipient rows' numbers stay; the suppression list is never touched (it is what keeps
// honouring unsubscribes).
async function purgeOldRecipients({ now = new Date(), months = marketingConfig().retentionMonths } = {}) {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  const res = await MarketingRecipient.updateMany(
    { createdAt: { $lt: cutoff }, purgedAt: null },
    { $unset: { email: "", name: "", company: "" }, $set: { purgedAt: now } }
  );
  return res.modifiedCount || 0;
}

module.exports = { purgeOldRecipients };
