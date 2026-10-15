const EmailTrackingOptOut = require("../../models/EmailTrackingOptOut");

// True when any of the mail's recipients is on the "never track" list RIGHT NOW.
// Checked when an open or a click arrives, not only when the mail is sent: a
// recipient who replies "Do not track" after receiving the mail stops being
// recorded from that moment (opens, clicks and downloads alike).
async function anyOptedOut(recipients = []) {
  const addresses = recipients.map((r) => String(r?.address || r || "").toLowerCase().trim()).filter(Boolean);
  if (!addresses.length) return false;
  return Boolean(await EmailTrackingOptOut.exists({ address: { $in: addresses } }));
}

module.exports = { anyOptedOut };
